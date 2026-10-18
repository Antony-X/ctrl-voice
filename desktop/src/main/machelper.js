// The macOS counterpart of winhelper.js, with the same request() interface:
// the focused app, files on the clipboard and simulated keystrokes, through
// osascript (JavaScript for Automation). An app is identified by its pid,
// which stands in for the Windows window handle (hwnd).
// Pasting needs Accessibility access for the app running Ctrl+Voice (System
// Settings → Privacy & Security → Accessibility; Terminal when started with
// npm start), and macOS asks once to let it control System Events.
const { execFile } = require('child_process');

const PASTEBOARD = `ObjC.import('AppKit');
function setFile(path) {
  const pb = $.NSPasteboard.generalPasteboard;
  pb.clearContents;
  pb.writeObjects($.NSArray.arrayWithObject($.NSURL.fileURLWithPath(path)));
}`;

const SCRIPTS = {
  ping: `function run() { return '{}'; }`,
  foreground: `function run() {
    const p = Application('System Events').applicationProcesses.whose({ frontmost: true })[0];
    return JSON.stringify({ hwnd: p.unixId(), pid: p.unixId(), process: p.name(), title: '' });
  }`,
  find: `function run(argv) {
    const ps = Application('System Events').applicationProcesses.whose({ name: argv[0] });
    return JSON.stringify(ps.length ? { hwnd: ps[0].unixId(), pid: ps[0].unixId(), process: ps[0].name(), title: '' } : { hwnd: 0 });
  }`,
  clipboard: `${PASTEBOARD}
  function run(argv) { setFile(argv[0]); return '{}'; }`,
  paste: `${PASTEBOARD}
  function run(argv) {
    const file = argv[0], pid = Number(argv[1]), autoSend = argv[2] === '1', sendDelay = Number(argv[3]);
    // Wait until the finish shortcut's keys are let go, or they would join the Cmd+V.
    const t0 = Date.now();
    while (($.NSEvent.modifierFlags & 0x1E0000) && Date.now() - t0 < 2500) delay(0.03);
    setFile(file);
    const se = Application('System Events');
    const front = () => se.applicationProcesses.whose({ frontmost: true })[0].unixId();
    const target = pid ? se.applicationProcesses.whose({ unixId: pid }) : [];
    if (target.length && front() !== pid) { target[0].frontmost = true; delay(0.3); }
    // Only type into the app we were asked to; never into whatever else has focus.
    const focused = !!pid && front() === pid;
    if (focused) {
      se.keystroke('v', { using: 'command down' });
      if (autoSend) { delay(sendDelay / 1000); if (front() === pid) se.keyCode(36); } // Return
    }
    return JSON.stringify({ focused });
  }`,
};

const ARGS = {
  find: (a) => [a.process],
  clipboard: (a) => [a.file],
  paste: (a) => [a.file, String(a.hwnd || 0), a.autoSend ? '1' : '0', String(a.sendDelay || 0)],
};

class MacHelper {
  start() {}

  request(cmd, args = {}, timeoutMs = 15000) {
    const script = SCRIPTS[cmd];
    if (!script) return Promise.reject(new Error(`Not available on macOS: ${cmd}`));
    const argv = (ARGS[cmd] || (() => []))(args).map(String);
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-l', 'JavaScript', '-e', script, ...argv], { timeout: timeoutMs }, (err, stdout, stderr) => {
        if (err) return reject(new Error(String(stderr || err.message).trim() || 'osascript failed'));
        try { resolve({ ok: true, ...JSON.parse(String(stdout).trim() || '{}') }); } catch (e) { reject(e); }
      });
    });
  }

  stop() {}
}

module.exports = { MacHelper };
