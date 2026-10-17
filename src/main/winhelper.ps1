# Ctrl+Voice Windows helper.
# Long-lived process: reads one JSON request per line on stdin, writes one JSON
# response per line on stdout. Started with -STA (the clipboard needs it).
#
#   foreground            -> which window/app currently has focus
#   find    {process}     -> main window of a running app (e.g. Discord)
#   paste   {file, hwnd, autoSend, sendDelay}
#                         -> put the file on the clipboard, focus the window,
#                            press Ctrl+V (and Enter) like the user would
#   clipboard {file}      -> just put the file on the clipboard
#   speak   {text, file, voice}
#                         -> stand-in TTS (Windows SAPI) until the voice backend exists

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Speech
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CvWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);

  public static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
  public static void Key(byte vk, bool up) { keybd_event(vk, 0, up ? 2u : 0u, UIntPtr.Zero); }
  public static void Chord(byte mod, byte key) { Key(mod, false); Key(key, false); Key(key, true); Key(mod, true); }
  // Shift, Ctrl, Alt, Space, Win, Enter: wait until the user lets go of the shortcut.
  public static bool AnyHeld() {
    int[] vks = { 0x10, 0x11, 0x12, 0x20, 0x5B, 0x5C, 0x0D };
    foreach (var v in vks) if ((GetAsyncKeyState(v) & 0x8000) != 0) return true;
    return false;
  }
  public static void Focus(IntPtr h) {
    if (IsIconic(h)) ShowWindow(h, 9);
    // A tap of Alt lets a background process hand focus to another window.
    Key(0x12, false); Key(0x12, true);
    SetForegroundWindow(h);
  }
}
"@

function Out-Res($o) {
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

function Set-FileClipboard([string]$file) {
  $files = New-Object System.Collections.Specialized.StringCollection
  [void]$files.Add($file)
  for ($i = 0; $i -lt 6; $i++) {
    try { [System.Windows.Forms.Clipboard]::SetFileDropList($files); return } catch { Start-Sleep -Milliseconds 60 }
  }
  throw 'Clipboard is busy'
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if (-not $line.Trim()) { continue }
  $req = $null
  try {
    $req = $line | ConvertFrom-Json
    $res = @{ id = $req.id; ok = $true }
    switch ($req.cmd) {
      'ping' { }
      'foreground' {
        $h = [CvWin]::GetForegroundWindow()
        $ownerPid = [uint32]0
        [void][CvWin]::GetWindowThreadProcessId($h, [ref]$ownerPid)
        $name = ''
        try { $name = (Get-Process -Id $ownerPid).ProcessName } catch { }
        $res.hwnd = [int64]$h; $res.pid = [int]$ownerPid; $res.process = $name; $res.title = [CvWin]::Title($h)
      }
      'find' {
        $p = Get-Process -Name $req.process -ErrorAction SilentlyContinue |
          Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
        if ($p) { $res.hwnd = [int64]$p.MainWindowHandle; $res.pid = $p.Id; $res.process = $p.ProcessName; $res.title = $p.MainWindowTitle }
        else { $res.hwnd = 0 }
      }
      'clipboard' { Set-FileClipboard ([string]$req.file) }
      'paste' {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        while ([CvWin]::AnyHeld() -and $sw.ElapsedMilliseconds -lt 2500) { Start-Sleep -Milliseconds 30 }
        Set-FileClipboard ([string]$req.file)
        $h = [IntPtr][int64]$req.hwnd
        if ($h -ne [IntPtr]::Zero -and [CvWin]::IsWindow($h) -and [CvWin]::GetForegroundWindow() -ne $h) {
          [CvWin]::Focus($h)
          Start-Sleep -Milliseconds 300
        }
        # Only type into the window we were asked to; never into whatever else has focus.
        $res.focused = ($h -ne [IntPtr]::Zero -and [CvWin]::GetForegroundWindow() -eq $h)
        if ($res.focused) {
          [CvWin]::Chord(0x11, 0x56)            # Ctrl+V
          if ($req.autoSend) {
            Start-Sleep -Milliseconds ([int]$req.sendDelay)
            if ([CvWin]::GetForegroundWindow() -eq $h) { [CvWin]::Key(0x0D, $false); [CvWin]::Key(0x0D, $true) }   # Enter
          }
        }
      }
      'speak' {
        $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
        try {
          if ($req.voice) {
            $match = $s.GetInstalledVoices() | Where-Object {
              $_.Enabled -and ($_.VoiceInfo.Name.Split(' ').Count -gt 1) -and ($req.voice -like ('*' + $_.VoiceInfo.Name.Split(' ')[1] + '*'))
            } | Select-Object -First 1
            if ($match) { $s.SelectVoice($match.VoiceInfo.Name) }
          }
          $s.SetOutputToWaveFile([string]$req.file)
          $s.Speak([string]$req.text)
          $s.SetOutputToNull()
        } finally { $s.Dispose() }
      }
      default { throw "Unknown command: $($req.cmd)" }
    }
    Out-Res $res
  } catch {
    $rid = 0
    if ($req) { $rid = $req.id }
    Out-Res @{ id = $rid; ok = $false; error = $_.Exception.Message }
  }
}
