// Talks to winhelper.ps1, a long-lived PowerShell process that does the
// Windows-only work (focused app, clipboard files, simulated keystrokes, SAPI).
// One process for the app's lifetime keeps each request to a few milliseconds.
const { spawn } = require('child_process');
const path = require('path');

class WinHelper {
  constructor() {
    this.script = path.join(__dirname, 'winhelper.ps1');
    this.seq = 0;
    this.pending = new Map();
    this.buf = '';
    this.proc = null;
  }

  start() {
    this.proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-STA', '-File', this.script], {
      windowsHide: true,
    });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      this.buf += chunk;
      let nl;
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        const p = this.pending.get(msg.id);
        if (!p) continue;
        this.pending.delete(msg.id);
        msg.ok ? p.resolve(msg) : p.reject(new Error(msg.error || 'helper error'));
      }
    });
    this.proc.stderr.on('data', (d) => console.warn('[winhelper]', String(d).trim()));
    this.proc.on('exit', () => {
      for (const p of this.pending.values()) p.reject(new Error('helper exited'));
      this.pending.clear();
      this.proc = null;
    });
  }

  request(cmd, args = {}, timeoutMs = 15000) {
    if (!this.proc) this.start();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`helper timed out on ${cmd}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n');
    });
  }

  stop() {
    try { this.proc?.stdin.end(); this.proc?.kill(); } catch {}
  }
}

module.exports = { WinHelper };
