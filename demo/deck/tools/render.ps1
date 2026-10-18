param(
  [Parameter(Mandatory=$true)][string]$Pptx,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$Width = 1600,
  [int]$Height = 900
)
# Renders every slide of a .pptx to PNG with PowerPoint COM, without a window.
# Opens read-only, closes only the presentation it opened, and quits PowerPoint
# only if no other presentation is open (so a user's PowerPoint is never closed).
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
Get-ChildItem $OutDir -Filter 'slide-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
$alreadyRunning = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -gt 0
$app = New-Object -ComObject PowerPoint.Application
$pres = $null
try {
  # Open(FileName, ReadOnly, Untitled, WithWindow)
  $pres = $app.Presentations.Open($Pptx, -1, 0, 0)
  $n = $pres.Slides.Count
  for ($i = 1; $i -le $n; $i++) {
    $f = Join-Path $OutDir ("slide-{0:D2}.png" -f $i)
    $pres.Slides.Item($i).Export($f, 'PNG', $Width, $Height)
  }
  Write-Output "rendered $n slides to $OutDir"
} finally {
  if ($pres -ne $null) { $pres.Close() }
  if (-not $alreadyRunning -and $app.Presentations.Count -eq 0) { $app.Quit() }
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($app) | Out-Null
}
