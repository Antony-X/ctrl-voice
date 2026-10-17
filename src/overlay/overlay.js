// Floating recording bar (Wispr Flow-style), lives at the bottom of the screen.
const api = window.respeak;
const $ = (id) => document.getElementById(id);

const pill = $('pill');
const caption = $('caption');
const captionLines = $('captionLines');
const toast = $('toast');
const wave = $('wave');
const wctx = wave.getContext('2d');

let config = { demoMode: true, micId: 'default', showIdleBar: true, shortcuts: {} };
let session = null;
let state = 'idle';
let raf = 0;
let lastBroadcast = 0;
let leaving = new Set();
let toastTimer = 0;
let lastUndone = null;
let undoCount = 0;
const history = []; // rolling level history for the waveform

const KEY_LABELS = { '`': '~`', Escape: 'Esc' };
const prettyKey = (a = '') => a.replace('CommandOrControl', 'Ctrl').split('+').map(k => KEY_LABELS[k] || k).join(' ');
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function setState(next) {
  state = next;
  pill.classList.remove('idle', 'rec', 'proc', 'hidden-idle');
  pill.classList.add(next);
  if (next === 'idle' && !config.showIdleBar) pill.classList.add('hidden-idle');
  caption.hidden = next !== 'rec';
  if (next !== 'rec') hideToast();
}

// ---------- mouse pass-through: only the glass surfaces catch clicks ----------
document.querySelectorAll('.interactive').forEach((el) => {
  el.addEventListener('mouseenter', () => api.send('overlay:mouse', true));
  el.addEventListener('mouseleave', () => api.send('overlay:mouse', false));
});

// ---------- recording lifecycle ----------
async function start() {
  if (state !== 'idle') return;
  undoCount = 0;
  leaving = new Set();
  history.length = 0;
  $('capTarget').hidden = true;
  session = new RecordingSession({ demoMode: config.demoMode, micId: config.micId });
  session.on('change', renderCaption);
  session.on('undo', onUndo);
  setState('rec');
  renderCaption();
  await session.start();
  api.send('rec:started');
  loop();
}

// mode: 'send' (default action) or 'review' (open the editor instead)
async function finish(opts) {
  if (state !== 'rec' || !session) return;
  const mode = opts?.mode || 'default';
  cancelAnimationFrame(raf);
  setState('proc');
  setProc(mode === 'review' ? 'Opening the editor…' : 'Polishing your message…');
  const result = await session.stop();
  session = null;
  broadcast(true, 'proc');
  api.send('rec:ended');
  const kept = result.segments.filter(s => !s.undone && s.words.length);
  const meta = {
    id: `m${Date.now().toString(36)}`,
    type: 'voice',
    title: kept.length ? makeTitle(kept[0].words.map(w => w.w).join(' ')) : `Voice message · ${fmt(result.duration)}`,
    createdAt: Date.now(),
    duration: result.duration,
    demoMode: config.demoMode,
    segments: result.segments,
    undoCount,
    edits: [],
    tone: null,
  };
  api.send('rec:finished', { meta, audio: result.audio, mode });
  // main replies with overlay:status / overlay:done; never hang if it doesn't
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => done({ text: 'Saved', ok: true }), 50000);
}

let doneTimer = 0;
function setProc(text, icon = '✦', spin = true) {
  $('procText').textContent = text;
  const s = pill.querySelector('.spark');
  s.textContent = icon;
  s.classList.toggle('still', !spin);
}
function done({ text, ok }) {
  if (state !== 'proc') return;
  clearTimeout(doneTimer);
  setProc(text, ok ? '✓' : '!', false);
  pill.classList.toggle('failed', !ok);
  setTimeout(() => {
    if (state !== 'proc') return;
    pill.classList.remove('failed');
    setState('idle');
    broadcast(true, 'idle');
  }, ok ? 1800 : 3200);
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

function undo() {
  if (state !== 'rec' || !session) return;
  session.undo();
  const btn = $('undoBtn');
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 260);
}

function onUndo(seg) {
  undoCount++;
  lastUndone = seg;
  leaving.add(seg.id);
  setTimeout(() => { leaving.delete(seg.id); renderCaption(); }, 650);
  const text = seg.words.length ? `“${seg.words.map(w => w.w).join(' ')}”` : `thought ${seg.id.slice(1)} (${fmt(seg.start)})`;
  $('toastText').textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 3200);
}

function hideToast() { toast.hidden = true; }

$('toastRestore').addEventListener('click', () => {
  if (!lastUndone || !session) return;
  lastUndone.undone = false;
  undoCount = Math.max(0, undoCount - 1);
  hideToast();
  renderCaption();
});

// ---------- rendering ----------
function renderCaption() {
  if (!session) return;
  const segs = session.segments.filter(s => !s.undone || leaving.has(s.id));
  const shown = segs.slice(-3);
  const live = session.current;

  if (!shown.length) {
    const next = config.demoMode ? DEMO_SCRIPT[session.scriptIdx] : null;
    captionLines.innerHTML = next
      ? `<div class="cap-empty">Listening… <b>Demo script:</b> “${next}”</div>`
      : `<div class="cap-empty">Listening… speak naturally. Press <b>${prettyKey(config.shortcuts.undo)}</b> to undo the last thought.</div>`;
    return;
  }

  captionLines.innerHTML = shown.map((s) => {
    const cls = ['cap-line'];
    if (s === live) cls.push('live');
    if (s.undone) cls.push('leaving');
    const n = `<span class="num">${s.id.slice(1)}</span>`;
    const body = s.words.length
      ? s.words.map(w => `<span class="w">${escapeHtml(w.w)}</span>`).join(' ')
      : (s === live ? 'Speaking…' : `Thought · ${fmt(s.start)}–${fmt(s.end ?? session.elapsed)}`);
    return `<div class="${cls.join(' ')}">${n}${body}</div>`;
  }).join('');

  // teleprompter hint for the next line of the demo script
  if (config.demoMode && !live && session.scriptIdx < DEMO_SCRIPT.length) {
    captionLines.insertAdjacentHTML('beforeend', `<div class="cap-line" style="opacity:.45"><span class="num">›</span>${DEMO_SCRIPT[session.scriptIdx]}</div>`);
  }
}

function drawWave() {
  const dpr = window.devicePixelRatio || 1;
  const w = wave.clientWidth, h = wave.clientHeight;
  if (wave.width !== w * dpr) { wave.width = w * dpr; wave.height = h * dpr; }
  wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wctx.clearRect(0, 0, w, h);

  const levels = session.levels(36);
  const n = levels.length;
  const gap = 3;
  const bw = Math.max(2, (w - gap * (n - 1)) / n);
  wctx.fillStyle = '#ffffff';
  levels.forEach((v, i) => {
    const bh = Math.max(3, v * h);
    const x = i * (bw + gap);
    const y = (h - bh) / 2;
    wctx.beginPath();
    wctx.roundRect(x, y, bw, bh, bw / 2);
    wctx.fill();
  });
}

function loop() {
  if (state !== 'rec' || !session) return;
  $('time').textContent = fmt(session.elapsed);
  drawWave();
  broadcast();
  raf = requestAnimationFrame(loop);
}

// Mirror live state to the main window (Compose page) ~12x per second.
function broadcast(force = false, status = state) {
  const now = performance.now();
  if (!force && now - lastBroadcast < 80) return;
  lastBroadcast = now;
  api.send('rec:state', {
    status,
    elapsed: session?.elapsed ?? 0,
    levels: session ? session.levels(24) : [],
    segments: session ? session.segments.map(s => ({ id: s.id, undone: s.undone, complete: s.complete, start: s.start, end: s.end, text: s.words.map(w => w.w).join(' ') })) : [],
    next: session && config.demoMode ? DEMO_SCRIPT[session.scriptIdx] ?? null : null,
    undoCount,
  });
}

// First sentence, cut at a word boundary around 42 chars.
function makeTitle(text) {
  const t = text.replace(/[.!?…]+$/, '');
  if (t.length <= 42) return t;
  return t.slice(0, 42).replace(/\s+\S*$/, '') + '…';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- wiring ----------
$('idleHit').addEventListener('click', () => api.send('rec:toggle'));
$('undoBtn').addEventListener('click', undo);
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
  $('hintUndo').textContent = prettyKey(cfg.shortcuts.undo);
  $('doneBtn').title = `Finish & send (${prettyKey(cfg.shortcuts.toggle)})`;
  $('reviewBtn').title = `Finish & review (${prettyKey(cfg.shortcuts.review)})`;
  if (state === 'idle') setState('idle');
});
// Where the message will go, e.g. "→ Discord"
api.on('overlay:target', ({ label, finishAction }) => {
  const chip = $('capTarget');
  chip.hidden = !(label && finishAction === 'send' && state === 'rec');
  chip.textContent = label ? `→ ${label}` : '';
});
api.on('overlay:status', ({ text }) => state === 'proc' && setProc(text));
api.on('overlay:done', done);

setState('idle');
