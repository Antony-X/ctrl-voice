// Ctrl+Voice — main process.
// Owns the tray, the main window, the floating recording bar (overlay),
// global shortcuts, a small on-disk message store, and sending finished
// messages into the chat app you recorded from (Discord, WhatsApp, …).
const {
  app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain,
  nativeImage, screen, session, Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { WinHelper } = require('./winhelper');
const { createBackend } = require('./backend');

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
  finishAction: 'send',     // 'send' = paste into the app you recorded from, 'review' = open the editor
  autoSend: true,           // press Enter after pasting
  cutFillers: true,         // drop "um", "like"… when sending without review
  showIdleBar: true,
  launchAtStartup: false,
  startHidden: false,
  demoMode: true,
  micId: 'default',
  ttsVoice: '',
  userName: '',
};
// Shortcuts that used to be the defaults; replaced on upgrade unless the user changed them.
const LEGACY_SHORTCUTS = {
  toggle: ['CommandOrControl+Shift+Space', 'CommandOrControl+Alt+Space'],
  open: ['CommandOrControl+Shift+R', 'CommandOrControl+Alt+Shift+Space'],
};

// Apps that accept a pasted audio file in their message box.
const SEND_APPS = {
  discord: 'Discord', discordptb: 'Discord', discordcanary: 'Discord',
  whatsapp: 'WhatsApp', 'whatsapp.root': 'WhatsApp',
  telegram: 'Telegram', slack: 'Slack', signal: 'Signal', 'ms-teams': 'Teams', teams: 'Teams',
  chrome: 'your browser', msedge: 'your browser', firefox: 'your browser', brave: 'your browser', opera: 'your browser',
};
const APP_PROCESSES = { Discord: ['Discord', 'DiscordPTB', 'DiscordCanary'], WhatsApp: ['WhatsApp', 'WhatsApp.Root'], Telegram: ['Telegram'] };

let mainWin = null;
let overlay = null;
let tray = null;
let recording = false;
let hiddenNoticeShown = false;
let settings = null;
let shortcutStatus = {};
let recordTarget = null;   // window that had focus when recording started
const helper = new WinHelper();
const backend = createBackend({ helper });

// ---------- persistence ----------
const dataDir = () => path.join(app.getPath('userData'), 'messages');
const exportDir = () => path.join(app.getPath('userData'), 'exports');
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    const s = { ...DEFAULT_SETTINGS, ...raw, shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw.shortcuts || {}) } };
    if ((raw.shortcutsVersion || 1) < SHORTCUTS_VERSION) {
      for (const [k, olds] of Object.entries(LEGACY_SHORTCUTS)) {
        if (olds.includes(s.shortcuts[k])) s.shortcuts[k] = DEFAULT_SETTINGS.shortcuts[k];
      }
      s.shortcutsVersion = SHORTCUTS_VERSION;
    }
    if ('openEditorAfter' in raw && !('finishAction' in raw)) delete s.openEditorAfter;
    delete s.theme;
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
  try { return JSON.parse(fs.readFileSync(path.join(dataDir(), `${id}.json`), 'utf8')); } catch { return null; }
}

function saveMessage(meta, audio) {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  if (audio) {
    fs.writeFileSync(path.join(dir, `${meta.id}.webm`), Buffer.from(audio));
    meta.hasAudio = true;
  }
  fs.writeFileSync(path.join(dir, `${meta.id}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

function deleteMessage(id) {
  for (const ext of ['json', 'webm']) {
    const p = path.join(dataDir(), `${id}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function writeExport(name, wav) {
  fs.mkdirSync(exportDir(), { recursive: true });
  const safe = (name || 'voice message').replace(/[^\w\s.,'-]+/g, '').trim().slice(0, 60) || 'voice message';
  const file = path.join(exportDir(), `${safe}.wav`);
  fs.writeFileSync(file, Buffer.from(wav));
  return file;
}

// ---------- windows ----------
function createMainWindow(show) {
  mainWin = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: '#08080a',
    icon: ICON,
    title: 'Ctrl+Voice',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // it renders exports while hidden in the tray
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
        body: `Press ${pretty(settings.shortcuts.toggle)} in Discord to record a voice message.`,
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
    demoMode: settings.demoMode,
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

function markSent(id, appName) {
  const meta = readMessage(id);
  if (!meta) return;
  meta.sentTo = appName;
  meta.sentAt = Date.now();
  saveMessage(meta);
  mainWin?.webContents.send('message:new', meta);
}

// Ask the main window to render the edited audio (it owns the editing model).
let renderSeq = 0;
const renderWaiters = new Map();
function renderInWindow(id, opts) {
  const reqId = ++renderSeq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { renderWaiters.delete(reqId); reject(new Error('Rendering timed out')); }, 45000);
    renderWaiters.set(reqId, (res) => { clearTimeout(timer); res.error ? reject(new Error(res.error)) : resolve(res); });
    mainWin.webContents.send('export:render', { reqId, id, ...opts });
  });
}

const overlayDone = (text, ok = true) => overlay?.webContents.send('overlay:done', { text, ok });

async function finishRecording(meta, audio, mode) {
  const saved = saveMessage(meta, audio);
  mainWin?.webContents.send('message:new', saved);
  const target = recordTarget;
  const label = sendLabel(target);

  if (mode === 'review' || settings.finishAction !== 'send' || !label) {
    overlayDone(label || mode === 'review' ? 'Opened in the editor' : 'Saved — opened in the editor');
    showMain(`editor:${saved.id}`);
    return;
  }

  try {
    overlay?.webContents.send('overlay:status', { text: `Sending to ${label}…` });
    const { wav } = await renderInWindow(saved.id, { cutFillers: settings.cutFillers });
    const file = writeExport(saved.title, wav);
    const r = await pasteInto(target, file, { autoSend: settings.autoSend });
    if (!r.focused) {
      overlayDone(`Couldn't reach ${label}. The audio is on your clipboard`, false);
      return;
    }
    markSent(saved.id, label);
    overlayDone(settings.autoSend ? `Sent to ${label}` : `Pasted into ${label}. Press Enter to send`);
  } catch (err) {
    console.error('Send failed', err);
    overlayDone('Couldn\'t send. Opened in the editor', false);
    showMain(`editor:${saved.id}`);
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
    { label: 'Type to speak…', click: () => showMain('compose:type') },
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
  settings = { ...settings, ...patch, shortcuts: { ...settings.shortcuts, ...(patch.shortcuts || {}) } };
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
  ipcMain.on('rec:finished', (_e, { meta, audio, mode }) => { finishRecording(meta, audio, mode); });
  ipcMain.on('overlay:mouse', (_e, interactive) => {
    overlay?.setIgnoreMouseEvents(!interactive, { forward: true });
  });
  ipcMain.on('overlay:open', (_e, route) => showMain(route));

  // From the main window
  ipcMain.on('export:rendered', (_e, res) => {
    const done = renderWaiters.get(res.reqId);
    if (done) { renderWaiters.delete(res.reqId); done(res); }
  });
  ipcMain.handle('voice:synthesize', async (_e, { text }) => backend.synthesize(text, { voice: settings.ttsVoice }));
  ipcMain.handle('send:to-app', async (_e, { app: appName, wav, name, id }) => {
    const file = writeExport(name, wav);
    const target = await findApp(appName);
    if (!target) {
      await helper.request('clipboard', { file });
      return { ok: false, message: `${appName} isn't open. The audio file is on your clipboard`, file };
    }
    const r = await pasteInto(target, file, { autoSend: settings.autoSend });
    if (!r.focused) return { ok: false, message: `Couldn't focus ${appName}. The audio is on your clipboard`, file };
    if (id) markSent(id, appName);
    return { ok: true, message: settings.autoSend ? `Sent to ${appName}` : `Pasted into ${appName}. Press Enter to send`, file };
  });

  ipcMain.handle('settings:get', () => ({ settings, shortcutStatus, defaults: DEFAULT_SETTINGS }));
  ipcMain.handle('settings:set', (_e, patch) => applySettings(patch));
  ipcMain.handle('shortcuts:suspend', (_e, on) => {
    // Let the shortcut recorder capture keys without triggering actions.
    if (on) globalShortcut.unregisterAll(); else registerGlobalShortcuts();
    return true;
  });

  ipcMain.handle('messages:list', () => listMessages());
  ipcMain.handle('messages:save', (_e, meta) => saveMessage(meta));
  ipcMain.handle('messages:create', (_e, meta) => {
    const saved = saveMessage(meta);
    mainWin?.webContents.send('message:new', saved);
    return saved;
  });
  ipcMain.handle('messages:delete', (_e, id) => { deleteMessage(id); return true; });
  ipcMain.handle('messages:audio', (_e, id) => {
    const p = path.join(dataDir(), `${id}.webm`);
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
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
        body: `${pretty(settings.shortcuts.toggle)} is used by another app. Pick a different one in Shortcuts.`,
        icon: ICON,
      }).on('click', () => showMain('shortcuts')).show();
    }
    helper.request('ping', {}, 20000).catch((e) => console.warn('Helper warm-up failed', e.message));
  });

  app.on('will-quit', () => { globalShortcut.unregisterAll(); helper.stop(); });
  app.on('window-all-closed', (e) => e.preventDefault()); // keep running in the tray
}

// Exposed for the test harness only.
module.exports = { helper, SEND_APPS, toggleRecording };
