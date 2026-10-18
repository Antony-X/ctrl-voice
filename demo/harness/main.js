'use strict';
// Electron screenshot harness.
//
//   electron main.js --plan plan.json
//
// Loads one renderer page in a never-shown window, with a stubbed preload bridge,
// runs the plan's shots in order and writes PNGs. See README.md for the formats.
//
// It is deliberately NOT the app's main process: no single-instance lock, its own
// userData directory and an in-memory session, so it cannot collide with a running
// copy of the app or touch the app's data.

const { app, BrowserWindow, nativeTheme, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const HARNESS_DIR = __dirname;
const PARTITION = 'harness'; // no "persist:" prefix -> in-memory session, clean every run
const EXIT_OK = 0;
const EXIT_FAIL = 1;
const EXIT_TIMEOUT = 2;
const EXIT_USAGE = 64;
const NAMED_BACKDROPS = new Set(['wallpaper-dark', 'wallpaper-light', 'checker']);
const CHECKER_CSS = 'repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px';

// ---------- output ----------
function say(tag, msg) {
  process.stdout.write(`[${tag}] ${msg}\n`);
}

let exiting = false;
function finish(code, msg) {
  if (exiting) return;
  exiting = true;
  if (msg) say('harness', msg);
  // Let piped stdout drain before the hard exit.
  process.stdout.write('', () => app.exit(code));
  setTimeout(() => app.exit(code), 2000);
}

process.on('uncaughtException', (err) => finish(EXIT_FAIL, `FATAL ${err && err.stack || err}`));
process.on('unhandledRejection', (err) => finish(EXIT_FAIL, `FATAL ${err && err.stack || err}`));

// ---------- plan ----------
function argValue(name) {
  const argv = process.argv;
  const i = argv.indexOf(name);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

const isUrl = (s) => /^(https?|file):/i.test(s);

function loadPlan() {
  const planArg = argValue('--plan');
  if (!planArg) throw new UsageError('missing --plan <plan.json>');
  const planPath = path.resolve(planArg);
  if (!fs.existsSync(planPath)) throw new UsageError(`plan not found: ${planPath}`);
  const raw = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const baseDir = path.dirname(planPath);
  const resolve = (p) => (p && !isUrl(p) ? path.resolve(baseDir, p) : p);

  if (!raw.page) throw new UsageError('plan.page is required');
  if (!Array.isArray(raw.shots) || raw.shots.length === 0) throw new UsageError('plan.shots must be a non-empty array');

  const plan = {
    page: resolve(raw.page),
    width: Math.round(raw.width || 1280),
    height: Math.round(raw.height || 800),
    transparent: !!raw.transparent,
    backgroundColor: raw.backgroundColor || null,
    backdrop: raw.backdrop || null,
    stub: raw.stub ? resolve(raw.stub) : null,
    bridge: raw.bridge || 'respeak',
    colorScheme: raw.colorScheme || 'system',
    // offscreen: page runs at 60 fps (rAF, CSS transitions advance). hidden: a never-shown
    // native window; on Windows an opaque one barely produces frames, so animations freeze.
    mode: raw.mode || 'offscreen',
    scale: raw.scale || null,
    timeout: raw.timeout || 30000,
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
    keepRaw: !!raw.keepRaw,
    userData: resolve(raw.userData) || path.join(HARNESS_DIR, 'harness-data'),
    shots: raw.shots.map((s, i) => {
      if (!s || !s.out) throw new UsageError(`shots[${i}].out is required`);
      return {
        wait: s.wait || 0,
        js: s.js || null,
        settle: s.settle || 0,
        out: resolve(s.out),
        backdrop: s.backdrop !== undefined ? s.backdrop : undefined,
      };
    }),
  };

  if (!['hidden', 'offscreen'].includes(plan.mode)) throw new UsageError(`plan.mode must be "hidden" or "offscreen"`);
  if (!['dark', 'light', 'system'].includes(plan.colorScheme)) throw new UsageError('plan.colorScheme must be dark|light|system');
  if (!isUrl(plan.page) && !fs.existsSync(plan.page)) throw new UsageError(`page not found: ${plan.page}`);
  if (plan.stub && !fs.existsSync(plan.stub)) throw new UsageError(`stub not found: ${plan.stub}`);

  // Hard guard: never share a profile with the real app.
  const appData = process.env.APPDATA ? path.resolve(process.env.APPDATA) : null;
  const ud = path.resolve(plan.userData).toLowerCase();
  if (appData && ud.startsWith(path.join(appData, 'Ctrl+Voice').toLowerCase())) {
    throw new UsageError(`refusing userData inside the app's profile: ${plan.userData}`);
  }
  return plan;
}

class UsageError extends Error {}

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Two animation frames, with a timer fallback in case rAF is paused in a hidden page.
const NEXT_FRAME_JS = `new Promise((resolve) => {
  let done = false;
  const fin = () => { if (!done) { done = true; resolve(); } };
  requestAnimationFrame(() => requestAnimationFrame(fin));
  setTimeout(fin, 300);
})`;

function preview(v) {
  let s;
  try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch { s = String(v); }
  return s && s.length > 200 ? `${s.slice(0, 200)}…` : s;
}

function shortSource(src, pageDir) {
  if (!src) return '';
  try {
    if (src.startsWith('file:')) {
      const p = decodeURIComponent(new URL(src).pathname).replace(/^\/([A-Za-z]:)/, '$1');
      const rel = path.relative(pageDir, p);
      return rel.startsWith('..') ? p : rel;
    }
  } catch {}
  return src;
}

function imageStats(img) {
  const buf = img.toBitmap(); // BGRA
  const n = Math.floor(buf.length / 4);
  let transparent = 0;
  let translucent = 0;
  let uniform = true;
  const b0 = buf[0], g0 = buf[1], r0 = buf[2], a0 = buf[3];
  for (let i = 0; i < n * 4; i += 4) {
    const a = buf[i + 3];
    if (a === 0) transparent++;
    else if (a < 255) translucent++;
    if (uniform && (buf[i] !== b0 || buf[i + 1] !== g0 || buf[i + 2] !== r0 || a !== a0)) uniform = false;
  }
  return {
    transparentPct: (100 * transparent) / n,
    translucentPct: (100 * translucent) / n,
    uniform,
    first: `rgba(${r0},${g0},${b0},${a0})`,
  };
}

function describe(img) {
  const { width, height } = img.getSize();
  const st = imageStats(img);
  let s = `${width}x${height}, alpha: ${st.transparentPct.toFixed(1)}% fully transparent, ${st.translucentPct.toFixed(1)}% partial`;
  if (st.uniform) s += `  WARNING: single flat color ${st.first} (blank capture?)`;
  return s;
}

function writePng(file, img) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, img.toPNG());
}

// ---------- page window ----------
function wireDiagnostics(wc, label, pageDir, { errorsOnly = false } = {}) {
  const LEVELS = ['debug', 'info', 'warn', 'error'];
  wc.on('console-message', (e, level, message, line, sourceId) => {
    // Electron 33 passes positional args; newer versions put them on the event object.
    const lvl = typeof level === 'number' ? LEVELS[level] || level : (e && e.level) || 'log';
    if (errorsOnly && lvl !== 'error') return;
    const msg = message !== undefined ? message : e && e.message;
    const src = shortSource(sourceId !== undefined ? sourceId : e && e.sourceId, pageDir);
    const ln = line !== undefined ? line : e && e.lineNumber;
    say(label, `${lvl}: ${msg}${src ? `  (${src}:${ln})` : ''}`);
  });
  wc.on('preload-error', (_e, preloadPath, err) => {
    say(label, `preload-error in ${preloadPath}: ${err && err.stack || err}`);
  });
  wc.on('render-process-gone', (_e, details) => {
    say(label, `render-process-gone: ${details.reason} (exit code ${details.exitCode})`);
    finish(EXIT_FAIL, 'renderer died; aborting');
  });
  wc.on('unresponsive', () => say(label, 'renderer unresponsive'));
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    say(label, `did-fail-load${isMainFrame ? ' (main frame)' : ''}: ${code} ${desc} ${url}`);
  });
}

function createPageWindow(plan) {
  const win = new BrowserWindow({
    width: plan.width,
    height: plan.height,
    useContentSize: true,
    show: false,
    paintWhenInitiallyHidden: true,
    frame: false,
    transparent: plan.transparent,
    backgroundColor: plan.backgroundColor || (plan.transparent ? '#00000000' : '#ffffff'),
    hasShadow: false,
    resizable: false,
    enableLargerThanScreen: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(HARNESS_DIR, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: plan.mode === 'offscreen',
      partition: PARTITION,
      spellcheck: false,
      additionalArguments: [`--harness-stub=${plan.stub || ''}`, `--harness-bridge=${plan.bridge}`],
    },
  });
  if (plan.mode === 'offscreen') win.webContents.setFrameRate(60);
  win.webContents.setAudioMuted(true); // never play page audio out loud
  // Windows clamps a new window to the display's work area; a small or remote display would
  // then shrink the capture. Re-apply the requested size after creation.
  const [cw, ch] = win.getContentSize();
  if (cw !== plan.width || ch !== plan.height) {
    win.setContentSize(plan.width, plan.height);
    const [nw, nh] = win.getContentSize();
    say('harness', `window was clamped to ${cw}x${ch}; resized to ${nw}x${nh}`);
  }
  return win;
}

async function capture(win) {
  const img = await win.webContents.capturePage();
  if (img.isEmpty()) throw new Error('capturePage returned an empty image');
  return img;
}

// ---------- backdrop compositing ----------
// A second never-shown, opaque window draws the backdrop and the captured PNG on top
// of it (the browser does the alpha compositing), and is then captured itself.
let compositor = null;

function backdropSpec(backdrop, planDir) {
  if (backdrop === 'checker') return { kind: 'css', css: CHECKER_CSS };
  if (NAMED_BACKDROPS.has(backdrop)) return { kind: 'wallpaper', name: backdrop };
  const asPath = path.resolve(planDir, backdrop);
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(backdrop) || fs.existsSync(asPath)) {
    if (!fs.existsSync(asPath)) throw new Error(`backdrop image not found: ${asPath}`);
    return { kind: 'image', url: pathToFileURL(asPath).href };
  }
  return { kind: 'css', css: backdrop };
}

async function getCompositor(plan) {
  if (compositor) return compositor;
  const win = new BrowserWindow({
    width: plan.width,
    height: plan.height,
    useContentSize: true,
    show: false,
    paintWhenInitiallyHidden: true,
    frame: false,
    backgroundColor: '#000000',
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      offscreen: plan.mode === 'offscreen',
      partition: PARTITION,
    },
  });
  wireDiagnostics(win.webContents, 'compositor', HARNESS_DIR, { errorsOnly: true });
  await win.loadFile(path.join(HARNESS_DIR, 'compose.html'));
  compositor = win;
  return win;
}

async function composite(plan, img, backdrop) {
  const win = await getCompositor(plan);
  const spec = backdropSpec(backdrop, plan.planDir);
  const args = JSON.stringify({ backdrop: spec, png: img.toDataURL() });
  const info = await win.webContents.executeJavaScript(`window.compose(${args})`);
  await win.webContents.executeJavaScript(NEXT_FRAME_JS);
  const out = await capture(win);
  const a = img.getSize();
  const b = out.getSize();
  if (a.width !== b.width || a.height !== b.height) {
    say('harness', `WARNING composite is ${b.width}x${b.height} but capture was ${a.width}x${a.height} (dpr ${info.dpr})`);
  }
  return out;
}

// ---------- run ----------
async function run(plan) {
  await app.whenReady();
  nativeTheme.themeSource = plan.colorScheme;

  const ses = session.fromPartition(PARTITION);
  ses.setPermissionRequestHandler((_wc, perm, cb) => cb(plan.permissions.includes(perm)));
  ses.setPermissionCheckHandler((_wc, perm) => plan.permissions.includes(perm));

  ipcMain.on('harness:log', (_e, line) => process.stdout.write(`${line}\n`)); // preload adds the [stub] prefix
  ipcMain.on('harness:fatal', (_e, line) => {
    process.stdout.write(`${line}\n`);
    finish(EXIT_FAIL, 'aborting: stub failed to load');
  });

  const pageDir = isUrl(plan.page) ? '' : path.dirname(plan.page);
  const win = createPageWindow(plan);
  const wc = win.webContents;
  wireDiagnostics(wc, 'page', pageDir);

  say('harness', `loading ${plan.page} (${plan.width}x${plan.height}, ${plan.transparent ? 'transparent' : 'opaque'}, ${plan.mode}, ${plan.colorScheme})`);
  try {
    if (isUrl(plan.page)) await win.loadURL(plan.page);
    else await win.loadFile(plan.page);
  } catch (err) {
    return finish(EXIT_FAIL, `LOAD FAILED: ${err.message}`);
  }

  let jsErrors = 0;
  for (let i = 0; i < plan.shots.length; i++) {
    const shot = plan.shots[i];
    const tag = `shot ${i + 1}/${plan.shots.length}`;
    if (shot.wait) await sleep(shot.wait);
    if (shot.js) {
      try {
        const result = await wc.executeJavaScript(shot.js, true);
        if (result !== undefined) say('harness', `${tag} js returned ${preview(result)}`);
      } catch (err) {
        const msg = (err && err.message) || String(err);
        if (/could not be cloned/i.test(msg)) {
          say('harness', `${tag} js ran, but its completion value could not be cloned back (ignored)`);
        } else {
          jsErrors++;
          say('harness', `ERROR ${tag} js threw: ${msg}`);
        }
      }
    }
    if (shot.settle) await sleep(shot.settle);
    await wc.executeJavaScript(NEXT_FRAME_JS);

    const raw = await capture(win);
    const backdrop = shot.backdrop !== undefined ? shot.backdrop : plan.backdrop;
    if (backdrop) {
      if (plan.keepRaw) writePng(shot.out.replace(/(\.png)?$/i, '.raw.png'), raw);
      const comp = await composite(plan, raw, backdrop);
      writePng(shot.out, comp);
      say('harness', `${tag} -> ${shot.out}  [raw ${describe(raw)}] [composited over ${backdrop}]`);
    } else {
      writePng(shot.out, raw);
      say('harness', `${tag} -> ${shot.out}  [${describe(raw)}]`);
    }
  }

  finish(EXIT_OK, `done: ${plan.shots.length} shot(s)${jsErrors ? `, ${jsErrors} shot js error(s)` : ''}`);
}

// ---------- boot (everything before ready must happen synchronously here) ----------
let plan;
try {
  plan = loadPlan();
  plan.planDir = path.dirname(path.resolve(argValue('--plan')));
} catch (err) {
  process.stdout.write(`[harness] ${err instanceof UsageError ? 'USAGE' : 'BAD PLAN'}: ${err.message}\n`);
  process.stdout.write('[harness] usage: electron main.js --plan <plan.json>\n', () => app.exit(EXIT_USAGE));
}

if (plan) {
  fs.mkdirSync(plan.userData, { recursive: true });
  app.setPath('userData', plan.userData);
  if (plan.scale) app.commandLine.appendSwitch('force-device-scale-factor', String(plan.scale));
  app.on('window-all-closed', () => {}); // never quit on our own; we exit explicitly
  setTimeout(() => finish(EXIT_TIMEOUT, `TIMEOUT after ${plan.timeout} ms`), plan.timeout);
  run(plan).catch((err) => finish(EXIT_FAIL, `FAILED: ${err && err.stack || err}`));
}
