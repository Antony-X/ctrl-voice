// Floating recording bar (Wispr Flow-style), lives at the bottom of the screen.
// While recording it streams the mic to the ReSpeak engine (LiveSession) and
// shows the live transcript; undo and a spoken "scratch that" cut the last
// thought on the engine side. Finishing hands everything to the main process,
// which fixes the message and sends it.
const api = window.respeak;
const $ = (id) => document.getElementById(id);

const pill = $('pill');
const caption = $('caption');
const capText = $('capText');
const wave = $('wave');
const wctx = wave.getContext('2d');

let config = { server: '', micId: 'default', showIdleBar: true, shortcuts: {}, finishAction: 'send' };
let session = null;
let state = 'idle';
let raf = 0;
let lastBroadcast = 0;
let words = [];
let offline = false;
let recentCut = null;     // { t0, t1 } of the last removal, shown struck for a moment
let restoreTimer = 0;
let doneTimer = 0;

const KEY_LABELS = { '`': '`', Escape: 'Esc' };
const prettyKey = (a = '') => a.replace('CommandOrControl', 'Ctrl').split('+').map(k => KEY_LABELS[k] || k).join(' ');
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setState(next) {
  state = next;
  pill.classList.remove('idle', 'rec', 'proc', 'ok', 'failed', 'hidden-idle');
  pill.classList.add(next);
  if (next === 'idle' && !config.showIdleBar) pill.classList.add('hidden-idle');
  caption.hidden = next !== 'rec';
}

// ---------- mouse pass-through: only the glass surfaces catch clicks ----------
document.querySelectorAll('.interactive').forEach((el) => {
  el.addEventListener('mouseenter', () => api.send('overlay:mouse', true));
  el.addEventListener('mouseleave', () => api.send('overlay:mouse', false));
});

// ---------- recording lifecycle ----------
async function start() {
  if (state !== 'idle') return;
  words = [];
  offline = false;
  recentCut = null;
  showRestore(false);
  $('capNote').textContent = 'Connecting…';
  session = new LiveSession({ server: config.server, micId: config.micId });
  session.on('words', (m) => { words = m.words; renderCaption(); });
  session.on('undone', onUndone);
  session.on('status', onStatus);
  setState('rec');
  renderCaption();
  try {
    await session.start();
  } catch (err) {
    console.error('Recording failed to start', err);
    session = null;
    setState('proc');
    result("Couldn't use the microphone", false);
    return;
  }
  api.send('rec:started');
  loop();
}

// mode: 'review' opens the editor instead of sending
async function finish(opts) {
  if (state !== 'rec' || !session) return;
  const mode = opts?.mode || 'default';
  cancelAnimationFrame(raf);
  setState('proc');
  setProc(offline ? 'Saving…' : 'Finishing up…');
  const s = session;
  session = null;
  let res;
  try {
    res = await s.stop();
  } catch (err) {
    console.error('Recording failed to stop', err);
    api.send('rec:ended');
    result("Couldn't save the recording", false);
    return;
  }
  broadcast(true, 'proc');
  api.send('rec:ended');
  api.send('rec:finished', { ...res, mode });
  // main replies with overlay:status / overlay:done; never hang if it doesn't
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => result('Saved in Ctrl+Voice', true), 90000);
}

function cancel() {
  if (state !== 'rec' || !session) return;
  cancelAnimationFrame(raf);
  session.cancel();
  session = null;
  setState('idle');
  broadcast(true, 'idle');
  api.send('rec:ended');
}

function setProc(text) {
  pill.classList.remove('ok', 'failed');
  $('procText').textContent = text;
}

function result(text, ok) {
  if (state !== 'proc') return;
  clearTimeout(doneTimer);
  $('procText').textContent = text;
  pill.classList.add(ok ? 'ok' : 'failed');
  setTimeout(() => {
    if (state !== 'proc') return;
    setState('idle');
    broadcast(true, 'idle');
  }, ok ? 1800 : 3600);
}

// ---------- undo / restore ----------
function undo() {
  if (state !== 'rec' || !session) return;
  if (offline) { flash($('undoBtn')); return; }
  session.undo();
  flash($('undoBtn'));
}

function restore() {
  if (!session) return;
  session.redo();
  recentCut = null;
  showRestore(false);
}

function onUndone({ r }) {
  if (!r) { $('capNote').textContent = 'Nothing to undo'; return; }
  recentCut = { t0: r.t0, t1: r.t1 };
  setTimeout(() => { if (recentCut?.t0 === r.t0) { recentCut = null; renderCaption(); } }, 1400);
  $('capNote').textContent = r.kind === 'command' ? 'Scratched that' : 'Undone';
  showRestore(true);
  renderCaption();
}

// The undo button turns into Restore for a few seconds after a removal.
function showRestore(on) {
  clearTimeout(restoreTimer);
  const btn = $('undoBtn');
  btn.classList.toggle('restore', on);
  $('undoLabel').textContent = on ? 'Restore' : 'Undo';
  btn.title = on ? 'Put it back' : `Undo the last thought (${prettyKey(config.shortcuts.undo)})`;
  if (on) restoreTimer = setTimeout(() => { showRestore(false); if (state === 'rec') $('capNote').textContent = noteText(); }, 3500);
}

function flash(el) {
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

function onStatus({ state: s }) {
  offline = s === 'offline' || s === 'error';
  $('capNote').textContent = noteText();
  renderCaption();
}

function noteText() {
  if (offline) return 'Engine offline. Recording without live text';
  return `Say “scratch that” or press ${prettyKey(config.shortcuts.undo)} to undo`;
}

// ---------- rendering ----------
function renderCaption() {
  if (state !== 'rec') return;
  const inCut = (w) => recentCut && recentCut.t0 <= (w.s + w.e) / 2 && (w.s + w.e) / 2 <= recentCut.t1;
  const shown = words.filter(w => !w.x || inCut(w)).slice(-28);
  if (!shown.length) {
    capText.innerHTML = `<span class="line empty">${offline ? 'Recording. Fixes run when you finish' : 'Listening…'}</span>`;
    return;
  }
  const html = shown.map(w => (w.x ? `<span class="cut">${escapeHtml(w.w)}</span>` : escapeHtml(w.w))).join(' ');
  capText.innerHTML = `<span class="line">${html}</span>`;
}

function drawWave() {
  const dpr = window.devicePixelRatio || 1;
  const w = wave.clientWidth, h = wave.clientHeight;
  if (wave.width !== Math.round(w * dpr)) { wave.width = Math.round(w * dpr); wave.height = Math.round(h * dpr); }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.clearRect(0, 0, w, h);
  const n = Math.max(8, Math.floor(w / 6));
  const levels = session.levels(n);
  const bw = 3, gap = (w - n * bw) / Math.max(1, n - 1);
  wctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--wave');
  levels.forEach((v, i) => {
    const bh = Math.max(3, Math.min(1, v) * h);
    wctx.globalAlpha = 0.35 + 0.65 * (i / n);
    wctx.beginPath();
    wctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, 1.5);
    wctx.fill();
  });
  wctx.globalAlpha = 1;
}

function loop() {
  if (state !== 'rec' || !session) return;
  $('time').textContent = fmt(session.elapsed);
  drawWave();
  broadcast();
  raf = requestAnimationFrame(loop);
}

// Mirror live state to the main window a few times per second.
function broadcast(force = false, status = state) {
  const now = performance.now();
  if (!force && now - lastBroadcast < 250) return;
  lastBroadcast = now;
  api.send('rec:state', { status, elapsed: session?.elapsed ?? 0 });
}

// ---------- wiring ----------
$('idleHit').addEventListener('click', () => api.send('rec:toggle'));
$('undoBtn').addEventListener('click', () => ($('undoBtn').classList.contains('restore') ? restore() : undo()));
$('cancelBtn').addEventListener('click', cancel);
$('doneBtn').addEventListener('click', () => finish());
$('reviewBtn').addEventListener('click', () => finish({ mode: 'review' }));

api.on('rec:start', start);
api.on('rec:stop', (opts) => finish(opts));
api.on('rec:undo', undo);
api.on('rec:cancel', cancel);
api.on('overlay:config', (cfg) => {
  config = cfg;
  $('hintToggle').textContent = prettyKey(cfg.shortcuts.toggle);
  $('doneBtn').title = `${cfg.finishAction === 'send' ? 'Finish and send' : 'Finish'} (${prettyKey(cfg.shortcuts.toggle)})`;
  $('reviewBtn').title = `Finish and review (${prettyKey(cfg.shortcuts.review)})`;
  $('cancelBtn').title = `Discard (${prettyKey(cfg.shortcuts.cancel)})`;
  showRestore(false);
  if (state === 'idle') setState('idle');
});
// Where the message will go, e.g. "To Discord"
api.on('overlay:target', ({ label, finishAction }) => {
  $('capTarget').textContent = label && finishAction === 'send' ? `To ${label}` : '';
});
api.on('overlay:status', ({ text }) => state === 'proc' && setProc(text));
api.on('overlay:done', ({ text, ok }) => result(text, ok));

setState('idle');
