// Ctrl+Voice — main process.
// Owns the tray, the main window, the floating recording bar (overlay),
// global shortcuts, a small on-disk message store, the connection to the
// ReSpeak engine, and sending finished messages into the chat app you
// recorded from (Discord, WhatsApp, …).
const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain,
  nativeImage, nativeTheme, screen, session, Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { WinHelper } = require('./winhelper');
const { Engine, EngineError } = require('./engine');
const Edits = require('../shared/edits');

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'assets', 'icon.png');
const TRAY_ICON = path.join(ROOT, 'assets', 'tray.png');

const OVERLAY_W = 680;
const OVERLAY_H = 240;

const SHORTCUTS_VERSION = 3;
const DEFAULT_SETTINGS = {
  shortcuts: {
    toggle: 'Alt+`',                             // start / finish & send (global) — the key under Esc
    open: 'Alt+Shift+`',                         // open the main window (global)
    undo: 'CommandOrControl+Z',                  // semantic undo (only while recording)
    review: 'CommandOrControl+Alt+Enter',        // finish & open the editor (only while recording)
    cancel: 'Escape',                            // discard recording (only while recording)
  },
  shortcutsVersion: SHORTCUTS_VERSION,
  backendUrl: 'https://zaa3ajj8o85hhq-7860.proxy.runpod.net',
  finishAction: 'send',     // 'send' = fix and paste into the app you recorded from, 'review' = open the editor
  autoSend: true,           // press Enter after pasting
  fix: { cleanup: true, grammar: true, pronunciation: true }, // applied before sending
  showIdleBar: true,
  launchAtStartup: false,
  startHidden: false,
  micId: 'default',
};
// Shortcuts that used to be the defaults; replaced on upgrade unless the user changed them.
const LEGACY_SHORTCUTS = {
  toggle: ['CommandOrControl+Shift+Space', 'CommandOrControl+Alt+Space'],
  open: ['CommandOrControl+Shift+R', 'CommandOrControl+Alt+Shift+Space'],
};
const RETIRED_SETTINGS = ['demoMode', 'ttsVoice', 'userName', 'cutFillers', 'theme', 'openEditorAfter'];

// Words re-said or corrected automatically per message; more are left as suggestions.
const MAX_AUTO_REPLACE = 3;

// Apps that accept a pasted audio file in their message box.
const SEND_APPS = {
  discord: 'Discord', discordptb: 'Discord', discordcanary: 'Discord',
  vesktop: 'Discord', equibop: 'Discord', legcord: 'Discord', // Vencord / Equicord / Legcord desktop clients
  whatsapp: 'WhatsApp', 'whatsapp.root': 'WhatsApp',
  telegram: 'Telegram', slack: 'Slack', signal: 'Signal', 'ms-teams': 'Teams', teams: 'Teams',
  chrome: 'your browser', msedge: 'your browser', firefox: 'your browser', brave: 'your browser', opera: 'your browser',
};
const APP_PROCESSES = {
  Discord: ['Discord', 'DiscordPTB', 'DiscordCanary', 'vesktop', 'Equibop', 'legcord'], WhatsApp: ['WhatsApp', 'WhatsApp.Root'], Telegram: ['Telegram'],
  Slack: ['slack'], Signal: ['Signal'], Teams: ['ms-teams', 'Teams'],
};

let mainWin = null;
let overlay = null;
let tray = null;
let recording = false;
let hiddenNoticeShown = false;
let settings = null;
let shortcutStatus = {};
let recordTarget = null;   // window that had focus when recording started
const helper = new WinHelper();
const engine = new Engine(() => settings.backendUrl);

// ---------- persistence ----------
const dataDir = () => path.join(app.getPath('userData'), 'messages');
const exportDir = () => path.join(app.getPath('userData'), 'exports');
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

// A message is <id>.json plus its audio: <id>.wav (the original, never changed;
// .webm for old recordings), <id>.edit.wav (latest render) and <id>.take.wav (tone take).
const AUDIO_KINDS = ['wav', 'webm', 'edit.wav', 'take.wav'];
const msgFile = (id, kind) => path.join(dataDir(), `${id}.${kind}`);

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    const s = {
      ...DEFAULT_SETTINGS, ...raw,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw.shortcuts || {}) },
      fix: { ...DEFAULT_SETTINGS.fix, ...(raw.fix || {}) },
    };
    if ((raw.shortcutsVersion || 1) < SHORTCUTS_VERSION) {
      for (const [k, olds] of Object.entries(LEGACY_SHORTCUTS)) {
        if (olds.includes(s.shortcuts[k])) s.shortcuts[k] = DEFAULT_SETTINGS.shortcuts[k];
      }
      s.shortcutsVersion = SHORTCUTS_VERSION;
    }
    if (raw.cutFillers === false && !raw.fix) s.fix.cleanup = false;
    for (const k of RETIRED_SETTINGS) delete s[k];
    return s;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

// One-time move of recordings made before the ReSpeak → Ctrl+Voice rename.
function migrateLegacyData() {
  const legacy = path.join(app.getPath('appData'), 'respeak');
  if (!fs.existsSync(legacy)) return;
  try {
    const oldMessages = path.join(legacy, 'messages');
    if (fs.existsSync(oldMessages) && !fs.existsSync(dataDir())) fs.cpSync(oldMessages, dataDir(), { recursive: true });
    const oldSettings = path.join(legacy, 'settings.json');
    if (fs.existsSync(oldSettings) && !fs.existsSync(settingsFile())) fs.copyFileSync(oldSettings, settingsFile());
  } catch (err) {
    console.warn('Legacy data migration skipped', err);
  }
}

function listMessages() {
  const dir = dataDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function readMessage(id) {
  try { return JSON.parse(fs.readFileSync(msgFile(id, 'json'), 'utf8')); } catch { return null; }
}

function saveMessage(meta) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(msgFile(meta.id, 'json'), JSON.stringify(meta, null, 2));
  return meta;
}

function deleteMessage(id) {
  for (const kind of ['json', ...AUDIO_KINDS]) {
    const p = msgFile(id, kind);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

const existing = (p) => (fs.existsSync(p) ? p : null);
const originalFile = (meta) => existing(msgFile(meta.id, 'wav')) || existing(msgFile(meta.id, 'webm'));
// What gets sent: the tone take, else the latest render, else the untouched original.
const outputFile = (meta) =>
  (meta.take && existing(msgFile(meta.id, 'take.wav'))) ||
  (meta.output && existing(msgFile(meta.id, 'edit.wav'))) ||
  originalFile(meta);

function readAudio(meta, which) {
  const p = which === 'original' ? originalFile(meta) : outputFile(meta);
  return p ? fs.readFileSync(p) : null;
}

// Chat apps show the file name, so the pasted copy is named after the message.
function writeExport(name, srcFile) {
  fs.mkdirSync(exportDir(), { recursive: true });
  const safe = (name || 'voice message').replace(/[^\w\s.,'-]+/g, '').trim().slice(0, 60) || 'voice message';
  const file = path.join(exportDir(), `${safe}${path.extname(srcFile) || '.wav'}`);
  fs.copyFileSync(srcFile, file);
  return file;
}

function titleFor(words, ops) {
  const text = Edits.keptText(words, ops).split(/\s+/).slice(0, 7).join(' ').replace(/[,;:.!?]+$/, '');
  return text || 'Voice message';
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const notifyMessage = (meta) => mainWin?.webContents.send('message:new', meta);

// ---------- engine ----------
// Engine sessions live on the GPU server. If one is gone (server rebuilt,
// recorded offline, an old message), the original audio is uploaded again.
// Cuts are times in the original audio, so they carry over; engine-made
// inserts belonged to the old session and are dropped.
async function uploadOriginal(meta) {
  const src = originalFile(meta);
  if (!src) throw new EngineError('This message has no audio', 0);
  const up = await engine.upload(fs.readFileSync(src), path.basename(src));
  meta.sid = up.sid;
  meta.words = up.words.map(({ w, s, e, p }) => ({ w, s, e, p }));
  meta.dur = up.dur;
  meta.ops = (meta.ops || Edits.fromRemoved(meta.removed)).filter(Edits.isCut);
  meta.output = null;
  meta.take = null;
  saveMessage(meta);
}

async function withSession(meta, fn) {
  if (!meta.sid) await uploadOriginal(meta);
  try {
    return await fn(meta.sid);
  } catch (err) {
    if (err.status !== 404) throw err;
    await uploadOriginal(meta);
    return fn(meta.sid);
  }
}

async function renderMessage(meta) {
  const r = await withSession(meta, (sid) => engine.render(sid, Edits.forRender(meta.ops || [])));
  fs.writeFileSync(msgFile(meta.id, 'edit.wav'), await engine.download(r.url));
  meta.output = { file: r.url.split('/').pop(), dur: r.dur, ai: r.ai, at: Date.now() };
  meta.take = null;
  saveMessage(meta);
}

const wordsCut = (meta, i, j) => meta.words.slice(i, j + 1).some(w => Edits.cutFor(w, meta.ops));

// The fixes applied before a message is sent, or when it opens for review.
// all: run every fix regardless of settings (the editor's "Fix it").
async function autoFix(meta, status, { all = false } = {}) {
  const fix = all ? { cleanup: true, grammar: true, pronunciation: true } : settings.fix;
  meta.ops ||= Edits.fromRemoved(meta.removed);
  if (fix.cleanup) {
    status('Cleaning up…');
    const { items } = await withSession(meta, (sid) => engine.clean(sid));
    meta.ops.push(...Edits.fromCuts(items, meta.ops));
  }
  if (fix.grammar) {
    status('Checking grammar…');
    const { items } = await withSession(meta, (sid) => engine.grammar(sid));
    for (const g of items.filter(g => !wordsCut(meta, g.i, g.j)).slice(0, MAX_AUTO_REPLACE)) {
      status(`Saying “${g.new}”…`);
      const r = await withSession(meta, (sid) => engine.replace(sid, { i: g.i, j: g.j, new: g.new, kind: 'grammar' }));
      meta.ops.push(Edits.fromOp(r.op, r.op.verified));
    }
  }
  if (fix.pronunciation) {
    status('Checking pronunciation…');
    const pr = await withSession(meta, (sid) => engine.pron(sid));
    meta.pron = { items: pr.items, accent: pr.accent, median: pr.median };
    for (const p of pr.items.filter(p => !wordsCut(meta, p.i, p.i)).slice(0, MAX_AUTO_REPLACE)) {
      status(`Re-saying “${p.word.replace(/[^\w']/g, '')}”…`);
      const r = await withSession(meta, (sid) => engine.replace(sid, { i: p.i, j: p.i, same: true }));
      // Keep the new take only when the recognizer hears the word and it scores better.
      const better = r.op.verified && (r.op.after == null || r.op.after > p.acc);
      meta.ops.push(Edits.fromOp(r.op, better));
    }
  }
  if (!meta.renamed) meta.title = titleFor(meta.words, meta.ops);
  meta.fixed = Date.now();
  saveMessage(meta);
  status('Finishing…');
  await renderMessage(meta);
}

// Messages opened for review are fixed in the background while the editor
// shows progress. The editor stays read-only for that message until it ends.
const fixing = new Map(); // id -> status text
async function fixInBackground(meta, opts) {
  if (fixing.has(meta.id)) return { meta, error: 'Already fixing this message' };
  const status = (text) => {
    fixing.set(meta.id, text);
    mainWin?.webContents.send('edit:status', { id: meta.id, text });
  };
  status('Starting…');
  let error = null;
  try {
    await autoFix(meta, status, opts);
  } catch (err) {
    console.error('Fix failed', err);
    error = err.message;
  }
  fixing.delete(meta.id);
  const latest = readMessage(meta.id) || meta;
  mainWin?.webContents.send('edit:status', { id: meta.id, text: null, meta: latest, error });
  notifyMessage(latest);
  return { meta: latest, error };
}
const wantsFix = () => Object.values(settings.fix).some(Boolean);

// ---------- windows ----------
function createMainWindow(show) {
  mainWin = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1f24' : '#e9edf1',
    icon: ICON,
    title: 'Ctrl+Voice',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWin.loadFile(path.join(ROOT, 'src', 'app', 'index.html'));
  mainWin.once('ready-to-show', () => { if (show) mainWin.show(); });

  mainWin.on('close', (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    mainWin.hide();
    if (!hiddenNoticeShown && Notification.isSupported()) {
      hiddenNoticeShown = true;
      new Notification({
        title: 'Ctrl+Voice is still running',
        body: `Press ${pretty(settings.shortcuts.toggle)} in any chat to record a voice message.`,
        icon: ICON,
      }).show();
    }
  });
  mainWin.on('maximize', () => mainWin.webContents.send('win:state', { maximized: true }));
  mainWin.on('unmaximize', () => mainWin.webContents.send('win:state', { maximized: false }));
}

function createOverlay() {
  overlay = new BrowserWindow({
    width: OVERLAY_W,
    height: OVERLAY_H,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false, // never steals focus from the chat you're recording in
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  positionOverlay();
  overlay.loadFile(path.join(ROOT, 'src', 'overlay', 'overlay.html'));
  overlay.webContents.on('did-finish-load', () => {
    sendOverlayConfig();
    if (settings.showIdleBar) overlay.showInactive();
  });
  screen.on('display-metrics-changed', positionOverlay);
}

function positionOverlay() {
  if (!overlay) return;
  const wa = screen.getPrimaryDisplay().workArea;
  overlay.setBounds({
    x: Math.round(wa.x + (wa.width - OVERLAY_W) / 2),
    y: Math.round(wa.y + wa.height - OVERLAY_H - 6),
    width: OVERLAY_W,
    height: OVERLAY_H,
  });
}

function sendOverlayConfig() {
  overlay?.webContents.send('overlay:config', {
    server: settings.backendUrl,
    micId: settings.micId,
    showIdleBar: settings.showIdleBar,
    shortcuts: settings.shortcuts,
    finishAction: settings.finishAction,
  });
}

function showMain(route) {
  if (!mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  if (route) mainWin.webContents.send('nav:go', route);
}

// ---------- send targets ----------
function sendLabel(target) {
  if (!target || target.pid === process.pid) return null;
  return SEND_APPS[(target.process || '').toLowerCase()] || null;
}

async function findApp(appName) {
  for (const proc of APP_PROCESSES[appName] || [appName]) {
    try {
      const r = await helper.request('find', { process: proc });
      if (r.hwnd) return r;
    } catch {}
  }
  return null;
}

// Discord needs a moment to attach the file before Enter sends it.
const sendDelay = (bytes) => Math.min(3200, 1100 + Math.round((bytes / 1e6) * 350));

async function pasteInto(target, file, { autoSend }) {
  const bytes = fs.statSync(file).size;
  return helper.request('paste', { file, hwnd: target?.hwnd || 0, autoSend: !!autoSend, sendDelay: sendDelay(bytes) }, 20000);
}

function markSent(meta, appName) {
  meta.sentTo = appName;
  meta.sentAt = Date.now();
  saveMessage(meta);
  notifyMessage(meta);
}

const overlayStatus = (text) => overlay?.webContents.send('overlay:status', { text });
const overlayDone = (text, ok = true) => overlay?.webContents.send('overlay:done', { text, ok });

async function finishRecording({ sid, words = [], removed = [], dur = 0, wav }, mode) {
  const target = recordTarget;
  const label = sendLabel(target);
  const ops = Edits.fromRemoved(removed);
  const meta = {
    id: newId(), createdAt: Date.now(), sid: sid || null, dur,
    words: words.map(({ w, s, e, p }) => ({ w, s, e, p })), removed, ops,
    title: titleFor(words, ops), from: label, output: null, take: null,
  };
  fs.mkdirSync(dataDir(), { recursive: true }); // the first recording on a new install
  if (wav) fs.writeFileSync(msgFile(meta.id, 'wav'), Buffer.from(wav));
  saveMessage(meta);
  notifyMessage(meta);

  if (mode === 'review' || settings.finishAction !== 'send' || !label) {
    if (wantsFix()) fixInBackground(meta); // marks the message as fixing before the editor asks
    overlayDone('Opened in Ctrl+Voice');
    showMain(`editor:${meta.id}`);
    return;
  }

  try {
    await autoFix(meta, overlayStatus);
    notifyMessage(meta);
    overlayStatus(`Sending to ${label}…`);
    const r = await pasteInto(target, writeExport(meta.title, outputFile(meta)), { autoSend: settings.autoSend });
    if (!r.focused) {
      overlayDone(`Couldn't reach ${label}. The audio is on your clipboard`, false);
      return;
    }
    markSent(meta, label);
    overlayDone(settings.autoSend ? `Sent to ${label}` : `Pasted into ${label}. Press Enter to send`);
  } catch (err) {
    console.error('Send failed', err);
    const why = err instanceof EngineError ? err.message : "Couldn't send";
    overlayDone(`${why}. Opened in Ctrl+Voice`, false);
    showMain(`editor:${meta.id}`);
  }
}

// ---------- recording control ----------
function toggleRecording() {
  if (!overlay) return;
  if (!overlay.isVisible()) overlay.showInactive();
  if (!recording) {
    // Remember where the user is (e.g. a Discord channel) so we can send there.
    recordTarget = null;
    helper.request('foreground', {}, 4000).then((t) => {
      recordTarget = t;
      overlay?.webContents.send('overlay:target', { label: sendLabel(t), finishAction: settings.finishAction });
    }).catch(() => {});
  }
  overlay.webContents.send(recording ? 'rec:stop' : 'rec:start');
}
const undoRecording = () => recording && overlay?.webContents.send('rec:undo');
const cancelRecording = () => recording && overlay?.webContents.send('rec:cancel');
const reviewRecording = () => recording && overlay?.webContents.send('rec:stop', { mode: 'review' });

const SCOPED = () => ({ undo: undoRecording, cancel: cancelRecording, review: reviewRecording });

function setRecording(on) {
  recording = on;
  // Undo / review / cancel are only grabbed while recording, so Ctrl+Z,
  // Escape etc. keep working normally in every other app.
  for (const [k, fn] of Object.entries(SCOPED())) {
    const accel = settings.shortcuts[k];
    if (on) shortcutStatus[k] = tryRegister(accel, fn);
    else safeUnregister(accel);
  }
  updateTray();
  mainWin?.webContents.send('rec:recording', on);
}

// ---------- shortcuts ----------
function tryRegister(accel, fn) {
  if (!accel) return false;
  try { return globalShortcut.isRegistered(accel) || globalShortcut.register(accel, fn); } catch { return false; }
}
function safeUnregister(accel) {
  try { if (accel && globalShortcut.isRegistered(accel)) globalShortcut.unregister(accel); } catch {}
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  const s = settings.shortcuts;
  shortcutStatus = {
    toggle: tryRegister(s.toggle, toggleRecording),
    open: tryRegister(s.open, () => showMain()),
    undo: null, review: null, cancel: null, // scoped to a recording
  };
  if (recording) setRecording(true);
}

function pretty(accel) {
  return (accel || '').replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ');
}

// ---------- tray ----------
function updateTray() {
  if (!tray) return;
  const s = settings.shortcuts;
  tray.setToolTip(recording ? 'Ctrl+Voice — recording…' : 'Ctrl+Voice');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Ctrl+Voice', click: () => showMain() },
    { label: recording ? 'Finish recording' : 'Record voice message', accelerator: s.toggle, click: toggleRecording },
    { type: 'separator' },
    {
      label: 'Show floating bar', type: 'checkbox', checked: settings.showIdleBar,
      click: (item) => applySettings({ showIdleBar: item.checked }),
    },
    { label: 'Settings', click: () => showMain('settings') },
    { type: 'separator' },
    { label: 'Quit Ctrl+Voice', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON).resize({ width: 16, height: 16 }));
  tray.on('click', () => (mainWin.isVisible() && mainWin.isFocused() ? mainWin.hide() : showMain()));
  updateTray();
}

// ---------- settings ----------
function applySettings(patch) {
  const prevShortcuts = JSON.stringify(settings.shortcuts);
  settings = {
    ...settings, ...patch,
    shortcuts: { ...settings.shortcuts, ...(patch.shortcuts || {}) },
    fix: { ...settings.fix, ...(patch.fix || {}) },
  };
  saveSettings();
  if (JSON.stringify(settings.shortcuts) !== prevShortcuts) registerGlobalShortcuts();
  if ('launchAtStartup' in patch || 'startHidden' in patch) {
    app.setLoginItemSettings({
      openAtLogin: settings.launchAtStartup,
      args: settings.startHidden ? ['--hidden'] : [],
    });
  }
  if ('showIdleBar' in patch && overlay) {
    if (settings.showIdleBar) overlay.showInactive();
    else if (!recording) overlay.hide();
  }
  sendOverlayConfig();
  updateTray();
  const payload = { settings, shortcutStatus, defaults: DEFAULT_SETTINGS };
  mainWin?.webContents.send('settings:changed', payload);
  return payload;
}

// ---------- IPC ----------
// Editor calls run against the stored message, so the engine session can be
// re-created underneath them. Each returns the updated message.
function messageOrThrow(id) {
  const meta = readMessage(id);
  if (!meta) throw new Error('This message no longer exists');
  return meta;
}

function wireIpc() {
  ipcMain.on('win:minimize', () => mainWin.minimize());
  ipcMain.on('win:maximize', () => (mainWin.isMaximized() ? mainWin.unmaximize() : mainWin.maximize()));
  ipcMain.on('win:close', () => mainWin.close());
  ipcMain.on('app:quit', () => { app.isQuitting = true; app.quit(); });

  ipcMain.on('rec:toggle', toggleRecording);
  ipcMain.on('rec:undo', undoRecording);
  ipcMain.on('rec:cancel', cancelRecording);

  // From the overlay
  ipcMain.on('rec:started', () => setRecording(true));
  ipcMain.on('rec:ended', () => {
    setRecording(false);
    if (!settings.showIdleBar) setTimeout(() => !recording && overlay.hide(), 2600);
  });
  ipcMain.on('rec:state', (_e, state) => mainWin?.webContents.send('rec:state', state));
  ipcMain.on('rec:finished', (_e, { mode, ...result }) => {
    finishRecording(result, mode).catch((err) => {
      console.error('Saving the recording failed', err);
      overlayDone("Couldn't save the recording", false);
    });
  });
  ipcMain.on('overlay:mouse', (_e, interactive) => {
    overlay?.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  ipcMain.on('overlay:open', (_e, route) => showMain(route));

  // Engine, from the main window
  ipcMain.handle('engine:health', async () => ({ ...(await engine.health()), url: settings.backendUrl }));

  ipcMain.handle('edit:open', async (_e, id) => {
    const meta = messageOrThrow(id);
    if (fixing.has(id)) return { meta, fixing: fixing.get(id) };
    try {
      await withSession(meta, (sid) => engine.state(sid));
      return { meta };
    } catch (err) {
      return { meta, error: err.message };
    }
  });
  ipcMain.handle('edit:autofix', (_e, id) => fixInBackground(messageOrThrow(id), { all: true }));
  // what: clean | tighten | grammar | pron | intent. Returns the engine's items.
  ipcMain.handle('edit:check', async (_e, { id, what }) => {
    const meta = messageOrThrow(id);
    const res = await withSession(meta, (sid) => engine[what](sid));
    if (what === 'pron') { meta.pron = { items: res.items, accent: res.accent, median: res.median }; saveMessage(meta); }
    return { meta, ...res };
  });
  // {i, j, new, kind} or {i, j, same: true}. Returns an engine op; the editor adds it.
  ipcMain.handle('edit:replace', async (_e, { id, ...body }) => {
    const meta = messageOrThrow(id);
    const r = await withSession(meta, (sid) => engine.replace(sid, body));
    return { meta, op: r.op };
  });
  ipcMain.handle('edit:render', async (_e, { id, ops }) => {
    const meta = messageOrThrow(id);
    // Keep the edits even if the engine can't render them right now; until
    // it does, there is no fixed version to play or send.
    meta.ops = ops;
    meta.output = null;
    meta.take = null;
    saveMessage(meta);
    await renderMessage(meta);
    return { meta, audio: readAudio(meta, 'output') };
  });
  // engine: natural (pitch and timing, own voice) | tone (AI). With i/j it
  // returns an op for those words; without, a take of the whole message.
  ipcMain.handle('edit:restyle', async (_e, { id, engine: kind, style, i, j }) => {
    const meta = messageOrThrow(id);
    const call = kind === 'tone' ? 'tone' : 'natural';
    if (i != null) {
      const r = await withSession(meta, (sid) => engine[call](sid, { style, i, j }));
      return { meta, op: r.op };
    }
    const r = await withSession(meta, async (sid) => {
      if (!meta.output) await renderMessage(meta); // the session was re-created
      return engine[call](sid, { style, file: meta.output.file });
    });
    fs.writeFileSync(msgFile(meta.id, 'take.wav'), await engine.download(r.url));
    meta.take = { engine: kind, style, dur: r.dur, by: r.engine || 'praat', wordsKept: r.words_kept ?? null, voiceSim: r.voice_sim ?? null };
    saveMessage(meta);
    return { meta, audio: readAudio(meta, 'output') };
  });
  ipcMain.handle('edit:clear-take', (_e, id) => {
    const meta = messageOrThrow(id);
    meta.take = null;
    saveMessage(meta);
    return { meta, audio: readAudio(meta, 'output') };
  });

  ipcMain.handle('send:message', async (_e, { id, app: appName }) => {
    const meta = messageOrThrow(id);
    const src = outputFile(meta);
    if (!src) return { ok: false, message: 'This message has no audio' };
    const file = writeExport(meta.title, src);
    const target = appName && await findApp(appName);
    if (!target) {
      await helper.request('clipboard', { file });
      return { ok: !appName, message: appName ? `${appName} isn't open. The audio is on your clipboard` : 'Copied. Paste it into any chat' };
    }
    const r = await pasteInto(target, file, { autoSend: settings.autoSend });
    if (!r.focused) return { ok: false, message: `Couldn't focus ${appName}. The audio is on your clipboard` };
    markSent(meta, appName);
    return { ok: true, message: settings.autoSend ? `Sent to ${appName}` : `Pasted into ${appName}. Press Enter to send` };
  });

  ipcMain.handle('settings:get', () => ({ settings, shortcutStatus, defaults: DEFAULT_SETTINGS }));
  ipcMain.handle('settings:set', (_e, patch) => applySettings(patch));
  ipcMain.handle('shortcuts:suspend', (_e, on) => {
    // Let the shortcut recorder capture keys without triggering actions.
    if (on) globalShortcut.unregisterAll(); else registerGlobalShortcuts();
    return true;
  });

  ipcMain.handle('messages:list', () => listMessages());
  ipcMain.handle('messages:rename', (_e, { id, title }) => {
    const meta = messageOrThrow(id);
    meta.title = title.trim() || titleFor(meta.words, meta.ops || []);
    meta.renamed = !!title.trim();
    return saveMessage(meta);
  });
  ipcMain.handle('messages:delete', (_e, id) => { deleteMessage(id); return true; });
  // which: 'original' | 'output' (what would be sent)
  ipcMain.handle('messages:audio', (_e, { id, which }) => {
    const meta = readMessage(id);
    return meta ? readAudio(meta, which) : null;
  });
}

// ---------- boot ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
  app.setAppUserModelId('com.ctrlvoice.app');

  app.whenReady().then(() => {
    migrateLegacyData();
    settings = loadSettings();
    saveSettings();
    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
    session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');

    const startHidden = process.argv.includes('--hidden') || settings.startHidden;
    wireIpc();
    createMainWindow(!startHidden);
    createOverlay();
    createTray();
    registerGlobalShortcuts();
    if (!shortcutStatus.toggle && Notification.isSupported()) {
      new Notification({
        title: 'Ctrl+Voice shortcut is taken',
        body: `${pretty(settings.shortcuts.toggle)} is used by another app. Pick a different one in Settings.`,
        icon: ICON,
      }).on('click', () => showMain('settings')).show();
    }
    helper.request('ping', {}, 20000).catch((e) => console.warn('Helper warm-up failed', e.message));
  });

  app.on('will-quit', () => { globalShortcut.unregisterAll(); helper.stop(); });
  app.on('window-all-closed', (e) => e.preventDefault()); // keep running in the tray
}

// Exposed for the test harness only.
module.exports = { helper, SEND_APPS, toggleRecording };
