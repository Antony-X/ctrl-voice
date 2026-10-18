// Ctrl+Voice — main window: your messages, the editor and settings.
// The transcript is the editor. Cuts, words the engine re-made and words that
// came out unclear show inline; every change is rendered by the engine in the
// background, and the original recording is never touched.
const api = window.respeak;
const $ = (id) => document.getElementById(id);
const mainEl = $('main');
const popEl = $('pop');
const menuEl = $('menu');
const toneEl = $('tone');

// ---------- helpers ----------
const ICON = {
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24">${ICON[name]}</svg>`;
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const joinAnd = (parts) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`);
const bare = (w = '') => w.replace(/^[^\w']+|[^\w']+$/g, '');
const errText = (err) => String(err?.message || err)
  .replace(/^Error invoking remote method '[^']+': /, '')
  .replace(/^\w*Error: /, '');

const KEY_LABELS = { CommandOrControl: 'Ctrl', Super: 'Win', Escape: 'Esc', Up: '↑', Down: '↓', Left: '←', Right: '→' };
const keycaps = (accel) => (accel || '').split('+').filter(Boolean).map(k => `<kbd>${esc(KEY_LABELS[k] || k)}</kbd>`).join('');

function dayOf(ts) {
  const d = new Date(ts);
  const now = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 864e5);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
const timeOf = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const NATURAL_STYLES = ['confident', 'calm', 'warm'];
const AI_STYLES = ['calm', 'friendly', 'excited', 'confident'];
// The engine's natural presets (PRESETS in respeak app/prosody.py), to describe
// what a mix of sliders does. A slider at full is MAX_AMOUNT times the preset.
const NATURAL_PRESETS = {
  confident: { shift: 0.95, range: 1.0, speed: 1.07, fall: true, blurb: 'Lower and quicker' },
  calm: { shift: 0.97, range: 0.7, speed: 0.95, fall: true, blurb: 'Slower and steadier' },
  warm: { shift: 1.04, range: 1.15, speed: 1.0, fall: false, blurb: 'Brighter and livelier' },
};
const MAX_AMOUNT = 1.5;
const SEND_APPS = ['Discord', 'WhatsApp', 'Telegram', 'Slack', 'Signal', 'Teams'];

// ---------- state ----------
const S = {
  settings: null, shortcutStatus: {}, defaults: null,
  messages: [],
  route: 'home',        // home | editor | settings
  id: null,             // open message
  meta: null,
  ops: [],              // the editor's edit list; the engine renders it
  version: 0,           // bumps on every change to ops
  history: [], future: [],
  dirty: false,         // ops changed since the last render
  rendering: false,
  sel: null,            // { i, j } selected words
  anchor: null,         // word a drag or shift-click started from
  dragging: false,
  pop: 'actions',       // what the word popover shows: actions | replace | tone
  opening: false,       // waiting for the engine session
  job: null,            // what the engine is doing for this message
  fixing: null,         // the main process is fixing this message (status text)
  notice: null,         // { text, retry } a problem with this message
  hints: [],            // words that may have been misheard, from /intent
  view: 'output',       // what the player plays: output | original
  audio: { output: null, original: null }, // { url, peaks, dur }
  recording: false, elapsed: 0, recStatus: 'idle',
  capturing: null, mics: [], health: null,
  armedDelete: false,
};
const canEdit = () => S.route === 'editor' && S.meta && !S.fixing && !S.job && !S.opening;

// Engine calls for a message run one at a time, so the stored message is
// never written by two calls at once.
let queue = Promise.resolve();
function enqueue(fn) {
  const p = queue.then(fn);
  queue = p.catch(() => {});
  return p;
}

// ---------- messages list ----------
function upsert(meta) {
  const k = S.messages.findIndex(m => m.id === meta.id);
  if (k >= 0) S.messages[k] = meta;
  else S.messages.unshift(meta);
  S.messages.sort((a, b) => b.createdAt - a.createdAt);
  renderList();
}

function renderRecordButton() {
  const btn = $('recordBtn');
  btn.classList.toggle('on', S.recording);
  btn.innerHTML = S.recording
    ? `<span class="dot"></span>Finish<span class="time">${fmt(S.elapsed)}</span>`
    : `<span class="dot"></span>Record<span class="keys">${keycaps(S.settings?.shortcuts.toggle)}</span>`;
  btn.title = S.recording ? 'Finish recording' : 'Record a voice message';
}

function renderList() {
  const list = $('list');
  $('settingsBtn').classList.toggle('active', S.route === 'settings');
  // an empty list stays empty; the main pane explains how to record
  if (!S.messages.length) { list.innerHTML = ''; return; }
  let html = '';
  let day = null;
  for (const m of S.messages) {
    const d = dayOf(m.createdAt);
    if (d !== day) { html += `<div class="day">${d}</div>`; day = d; }
    const left = m.sentTo ? `<span class="sent">Sent to ${esc(m.sentTo)}</span>` : `<span>${fmt(m.output?.dur ?? m.dur)}</span>`;
    html += `
      <button class="row ${S.route === 'editor' && m.id === S.id ? 'active' : ''}" data-action="open" data-id="${m.id}">
        <div class="row-title">${esc(m.title || 'Voice message')}</div>
        <div class="row-meta">${left}<span>${timeOf(m.createdAt)}</span></div>
      </button>`;
  }
  list.innerHTML = html;
}

// ---------- routing ----------
function render() {
  renderList();
  closeMenu();
  closeTone();
  if (S.route === 'settings') return renderSettings();
  if (S.route === 'editor' && S.meta) return renderEditor();
  renderEmpty();
}

// A still of the recording bar on the empty page, so you know what to look for.
const STILL_BARS = [5, 9, 15, 8, 19, 12, 6, 14, 21, 10, 5, 13, 17, 8, 11, 5];
function stillHtml() {
  const bars = STILL_BARS.map(h => `<i style="height:${h}px"></i>`).join('');
  return `<div class="still" aria-hidden="true">
    <div class="still-say">I'll meet you on <s>Monday, no wait,</s> Wednesday</div>
    <div class="still-pill"><span class="x">${svg('x')}</span><span class="still-wave">${bars}</span><span class="ok">${svg('check')}</span></div>
  </div>`;
}

function renderEmpty() {
  stopAudio();
  mainEl.innerHTML = `
    <div class="empty"><div class="empty-inner">
      ${stillHtml()}
      <h1>Press ${keycaps(S.settings.shortcuts.toggle)} in any chat to record</h1>
      <p>Talk like you normally would. Ctrl+Voice cuts the ums and false starts, re-says words that came out unclear, and sends the message in your own voice.</p>
      <p>Say “scratch that” to drop the last thing you said.</p>
    </div></div>`;
}

function goHome() {
  S.route = 'home';
  S.id = null;
  S.meta = null;
  if (S.messages.length) return openMessage(S.messages[0].id);
  render();
}

function navigate(route) {
  if (!route) return;
  if (route.startsWith('editor:')) return openMessage(route.slice(7));
  if (route === 'settings') return openSettings();
  goHome();
}

// ---------- editor: opening ----------
async function openMessage(id) {
  stopAudio();
  dropAudio();
  closePop();
  const meta = S.messages.find(m => m.id === id) || null;
  Object.assign(S, {
    route: 'editor', id, meta, ops: meta?.ops || Edits.fromRemoved(meta?.removed), version: S.version + 1,
    history: [], future: [], dirty: false, sel: null, hints: [], job: null, fixing: null, notice: null,
    view: 'output', opening: true, armedDelete: false,
  });
  render();
  let r;
  try {
    r = await api.invoke('edit:open', id);
  } catch (err) {
    r = { error: errText(err) };
  }
  if (S.id !== id) return;
  S.opening = false;
  if (r.meta) {
    S.meta = r.meta;
    S.ops = r.meta.ops || Edits.fromRemoved(r.meta.removed);
    upsert(r.meta);
  }
  if (!S.meta) return goHome();
  S.fixing = r.fixing || null;
  S.notice = r.error ? { text: r.error, retry: 'reopen' } : null;
  render();
  loadAudio('output');
  // Edits made while the engine was away were never rendered.
  if (!S.fixing && !r.error && Edits.forRender(S.ops).length && !S.meta.output) {
    S.dirty = true;
    scheduleRender(0);
  }
}

// The engine re-created the session (it restarted, or the message was
// recorded offline): main kept the cuts and dropped words the old session made.
function adopt(meta) {
  if (!meta || meta.id !== S.id) return false;
  const reset = S.meta?.sid && meta.sid !== S.meta.sid;
  S.meta = meta;
  upsert(meta);
  if (reset) {
    S.ops = meta.ops || [];
    S.history = [];
    S.future = [];
    S.hints = [];
    toast('The engine restarted, so words it had made were reset');
  }
  return true;
}

// ---------- editor: rendering the page ----------
function renderEditor() {
  if (S.route !== 'editor' || !S.meta) return;
  const m = S.meta;
  const scroll = mainEl.querySelector('.col') ? mainEl.scrollTop : 0;
  const where = m.sentTo ? `, sent to ${esc(m.sentTo)}` : m.from ? `, recorded in ${esc(m.from)}` : '';
  mainEl.innerHTML = `
    <div class="col">
      <div class="head">
        <div class="head-text">
          <input class="title" id="title" value="${esc(m.title || 'Voice message')}" spellcheck="false" aria-label="Title" />
          <div class="meta">${dayOf(m.createdAt)} at ${timeOf(m.createdAt)}${where}</div>
        </div>
        <button class="icon-btn delete-btn ${S.armedDelete ? 'armed' : ''}" data-action="delete" title="Delete this message">
          ${S.armedDelete ? 'Delete' : svg('trash')}
        </button>
      </div>
      ${noticeHtml()}
      <div class="transcript ${canEdit() || S.opening ? '' : 'locked'}" id="transcript">${transcriptHtml()}</div>
      ${summaryHtml()}
    </div>
    <div class="dock"><div class="bar glass" id="bar"></div></div>`;
  mainEl.scrollTop = scroll;
  renderBar();
  if (S.sel) openPop();
}

function noticeHtml() {
  const busy = S.fixing || S.job || (S.opening && 'Connecting to the engine…');
  if (busy) return `<div class="notice"><span class="spin"></span><span class="grow">${esc(busy)}</span></div>`;
  if (S.notice) {
    return `<div class="notice warn"><span class="grow">${esc(S.notice.text)}</span>
      <button class="text-btn link" data-action="retry">Try again</button></div>`;
  }
  return '';
}

function transcriptHtml() {
  const W = S.meta.words || [];
  if (!W.length) {
    // recorded while the engine was unreachable: nothing has transcribed it yet
    const why = S.meta.sid ? 'No words were heard in this recording.' : 'The words show up once the engine has this message.';
    return `<span class="transcript-empty">${why}</span>`;
  }
  const flagged = new Map((S.meta.pron?.items || []).map(p => [p.i, p]));
  const hinted = new Set(S.hints.flatMap(h => range(h.i, h.j)));
  const sel = S.sel;
  let html = '';
  for (let k = 0; k < W.length; k++) {
    const w = W[k];
    const cls = ['w'];
    let text = w.w;
    let end = k;
    const cut = Edits.cutFor(w, S.ops);
    const rep = !cut && Edits.replaceFor(k, S.ops);
    if (cut) cls.push('cut');
    else if (Edits.suggestionFor(w, S.ops)) cls.push('sugg');
    else if (rep) {
      if (k !== rep.i) continue;
      cls.push('ai');
      text = rep.new + trailing(W[rep.j].w, rep.new);
      end = rep.j;
    } else if (flagged.has(k) || hinted.has(k)) cls.push('unclear');
    if (sel && k <= sel.j && end >= sel.i) cls.push('sel');
    html += `<span class="${cls.join(' ')}" data-k="${k}" data-end="${end}">${esc(text)}</span><span class="sp"> </span>`;
  }
  return html;
}
const range = (i, j) => Array.from({ length: j - i + 1 }, (_, n) => i + n);
// Keep the sentence punctuation of the replaced words ("Monday," → "Tuesday,").
function trailing(oldLast, text) {
  const p = (oldLast.match(/[.,!?;:]+$/) || [''])[0];
  return p && !text.endsWith(p) ? p : '';
}

function summaryHtml() {
  if (S.opening || !S.meta.words?.length) return ''; // nothing to fix or shorten without words
  const on = S.ops.filter(o => o.on);
  const cuts = on.filter(Edits.isCut).length;
  const reps = on.filter(o => !Edits.isCut(o));
  const resaid = reps.filter(o => o.kind === 'pronunciation').length;
  const changed = reps.filter(o => o.kind === 'replace' || o.kind === 'grammar').length;
  const restyled = reps.length - resaid - changed;
  const parts = [];
  if (cuts) parts.push(plural(cuts, 'cut'));
  if (changed) parts.push(`${plural(changed, 'word')} changed`);
  if (resaid) parts.push(`${plural(resaid, 'word')} re-said`);
  if (restyled) parts.push(`${plural(restyled, 'part')} in a new tone`);
  if (S.meta.take) {
    const tones = takeTones(S.meta.take);
    parts.push(`${/^[aeiou]/.test(tones[0]) ? 'an' : 'a'} ${tones.join(', ')} tone${S.meta.take.engine === 'tone' ? ' (AI voice)' : ''}`);
  }
  let what = parts.length ? cap(joinAnd(parts)) : S.meta.fixed ? 'Nothing needed fixing' : 'No changes yet';
  const outDur = S.meta.take?.dur ?? S.meta.output?.dur;
  if (outDur && !S.dirty && S.meta.dur - outDur >= 1) what += `, ${Math.round(S.meta.dur - outDur)} seconds shorter`;

  const suggestions = S.ops.filter(o => !o.on && o.auto === false && Edits.isCut(o)).length;
  const can = canEdit() ? '' : 'disabled';
  const actions = [];
  if (!S.meta.fixed) actions.push(`<button class="text-btn primary" data-action="fix" ${can}>Fix it</button>`);
  if (suggestions) actions.push(`<button class="text-btn" data-action="take-suggestions" ${can}>Cut ${plural(suggestions, 'suggestion')}</button>`);
  else actions.push(`<button class="text-btn" data-action="shorten" ${can}>Shorten it</button>`);
  actions.push(`<button class="text-btn" data-action="misheard" ${can}>Check for misheard words</button>`);
  return `<div class="summary"><span class="what">${what}.</span>${actions.join('')}</div>`;
}

// ---------- editor: selection and the word popover ----------
function spanOf(k) {
  return mainEl.querySelector(`.w[data-k="${k}"]`) || [...mainEl.querySelectorAll('.w')].find(el => +el.dataset.k <= k && k <= +el.dataset.end);
}

function paintSelection() {
  mainEl.querySelectorAll('.w').forEach(el => {
    const k = +el.dataset.k, end = +el.dataset.end;
    el.classList.toggle('sel', !!S.sel && k <= S.sel.j && end >= S.sel.i);
  });
}

function clearSelection() {
  S.sel = null;
  paintSelection();
  closePop();
}

// What the selected words are: one cut, one suggestion, one engine-made
// replacement, an unclear word, a possibly misheard word, or plain words.
function contextOf({ i, j }) {
  const W = S.meta.words;
  const same = (find) => {
    const first = find(i);
    return first && range(i, j).every(k => find(k) === first) ? first : null;
  };
  const cut = same(k => Edits.cutFor(W[k], S.ops));
  if (cut) return { kind: 'cut', op: cut };
  const sugg = same(k => !Edits.cutFor(W[k], S.ops) && Edits.suggestionFor(W[k], S.ops));
  if (sugg) return { kind: 'sugg', op: sugg };
  const rep = same(k => Edits.replaceFor(k, S.ops));
  if (rep && rep.i === i && rep.j === j) return { kind: 'rep', op: rep };
  const hint = S.hints.find(h => h.i <= i && j <= h.j);
  if (hint) return { kind: 'hint', hint };
  const pron = i === j && (S.meta.pron?.items || []).find(p => p.i === i);
  if (pron && !Edits.replaceFor(i, S.ops)) return { kind: 'unclear', pron };
  return { kind: 'words', anyCut: range(i, j).some(k => Edits.cutFor(W[k], S.ops)) };
}

const btn = (action, label, extra = '') => `<button data-action="${action}" ${extra}>${esc(label)}</button>`;

function popHtml() {
  const { i, j } = S.sel;
  const W = S.meta.words;
  if (S.pop === 'replace') {
    const text = Edits.keptText(W.slice(i, j + 1), []) ;
    return `<div class="pop-edit">
      <input id="popInput" value="${esc(text)}" spellcheck="true" aria-label="New words" />
      <button class="go" data-action="replace-go">Say it</button></div>`;
  }
  if (S.pop === 'tone') {
    const opts = (engine, styles) => styles.map(s => `<button data-action="tone-sel" data-engine="${engine}" data-style="${s}">
      ${avatar(s, engine === 'tone')}${cap(s)}</button>`).join('');
    return `<div class="pop-styles">
      <span class="lab">Your voice</span><div class="opts">${opts('natural', NATURAL_STYLES)}</div>
      <span class="lab">AI voice</span><div class="opts">${opts('tone', AI_STYLES)}</div></div>`;
  }
  const c = contextOf(S.sel);
  const words = [btn('replace', 'Replace…'), btn('say-clearly', 'Say clearly'), btn('cut', 'Cut'), btn('tone', 'Tone')];
  let head = '';
  let row = words;
  if (c.kind === 'cut') {
    head = Edits.label(c.op);
    row = [btn('restore', 'Restore')];
  } else if (c.kind === 'sugg') {
    head = 'Suggested cut';
    row = [btn('take-suggestion', 'Cut it'), btn('keep', 'Keep it')];
  } else if (c.kind === 'rep') {
    const o = c.op;
    head = o.kind === 'pronunciation' ? 'Re-said clearly'
      : /^natural |^(calm|friendly|excited|confident|warm)$/.test(o.kind) ? `${Edits.label(o)}`
      : `Was <b>“${esc(o.old)}”</b>`;
    row = [btn('use-original', 'Use original'), btn('try-again', 'Try again')];
    return `<div class="pop-head">${head}</div><div class="pop-row">${row.join('')}</div>`;
  } else if (c.kind === 'hint') {
    head = `Did you mean <b>“${esc(c.hint.new)}”</b>?`;
    row = [btn('use-hint', `Use “${c.hint.new}”`), btn('replace', 'Replace…'), btn('dismiss-hint', 'Dismiss')];
    return `<div class="pop-head">${head}</div><div class="pop-row">${row.join('')}</div>`;
  } else if (c.kind === 'unclear') {
    head = 'This word came out unclear';
    row = [btn('say-clearly', 'Say clearly'), btn('replace', 'Replace…'), btn('cut', 'Cut')];
  } else if (c.anyCut) {
    row = [btn('restore', 'Restore'), ...words];
  }
  return `${head ? `<div class="pop-head">${esc(head)}</div>` : ''}<div class="pop-row">${row.join('')}</div>`;
}

function openPop() {
  if (!S.sel || !canEdit()) return closePop();
  const first = spanOf(S.sel.i);
  const last = spanOf(S.sel.j);
  if (!first || !last) return closePop();
  popEl.innerHTML = popHtml();
  popEl.hidden = false;
  const a = first.getBoundingClientRect();
  const b = last.getBoundingClientRect();
  const w = popEl.offsetWidth, h = popEl.offsetHeight;
  const sameLine = Math.abs(a.top - b.top) < 4;
  const cx = sameLine ? (a.left + b.right) / 2 : a.left + w / 2;
  const area = mainEl.getBoundingClientRect();
  const left = Math.max(area.left + 12, Math.min(cx - w / 2, area.right - w - 12));
  const top = a.top - h - 8 < area.top + 8 ? b.bottom + 8 : a.top - h - 8;
  popEl.style.left = `${left}px`;
  popEl.style.top = `${top}px`;
  const input = $('popInput');
  if (input) { input.focus(); input.select(); }
}

function closePop() {
  popEl.hidden = true;
  S.pop = 'actions';
}

mainEl.addEventListener('mousedown', (e) => {
  const w = e.target.closest('.w');
  if (!w || !canEdit()) return;
  e.preventDefault();
  closeMenu();
  const k = +w.dataset.k, end = +w.dataset.end;
  if (e.shiftKey && S.sel) {
    S.sel = { i: Math.min(S.sel.i, k), j: Math.max(S.sel.j, end) };
  } else {
    S.anchor = { i: k, j: end };
    S.sel = { i: k, j: end };
  }
  S.dragging = true;
  S.pop = 'actions';
  popEl.hidden = true;
  paintSelection();
});

mainEl.addEventListener('mouseover', (e) => {
  if (!S.dragging) return;
  const w = e.target.closest('.w');
  if (!w) return;
  const k = +w.dataset.k, end = +w.dataset.end;
  S.sel = { i: Math.min(S.anchor.i, k), j: Math.max(S.anchor.j, end) };
  paintSelection();
});

document.addEventListener('mouseup', () => {
  if (!S.dragging) return;
  S.dragging = false;
  if (!S.sel) return;
  // A click on a cut or suggestion selects all of it.
  if (S.sel.i === S.anchor?.i && S.sel.j === S.anchor?.j) {
    const W = S.meta.words;
    const op = Edits.cutFor(W[S.sel.i], S.ops) || Edits.suggestionFor(W[S.sel.i], S.ops);
    const r = op && Edits.rangeOf(op, W);
    if (r) S.sel = r;
  }
  paintSelection();
  openPop();
});

document.addEventListener('mousedown', (e) => {
  if (!popEl.hidden && !popEl.contains(e.target) && !e.target.closest('.w')) clearSelection();
  if (!menuEl.hidden && !menuEl.contains(e.target) && !e.target.closest('[data-menu]')) closeMenu();
  // the player bar stays usable while the tone panel is open
  if (!toneEl.hidden && !toneEl.contains(e.target) && !e.target.closest('.dock')) closeTone();
});

// ---------- editor: changing the edit list ----------
function commit(ops) {
  S.history.push(S.ops);
  if (S.history.length > 100) S.history.shift();
  S.future = [];
  setOps(ops);
}

function setOps(ops) {
  const audible = JSON.stringify(Edits.forRender(ops)) !== JSON.stringify(Edits.forRender(S.ops));
  S.ops = ops;
  S.version++;
  S.sel = null;
  closePop();
  if (audible) {
    S.dirty = true;
    scheduleRender();
  }
  renderEditor();
}

function undoEdit() {
  if (!canEdit() || !S.history.length) return;
  S.future.push(S.ops);
  setOps(S.history.pop());
}

function redoEdit() {
  if (!canEdit() || !S.future.length) return;
  S.history.push(S.ops);
  setOps(S.future.pop());
}

const setOn = (ids, on) => S.ops.map(o => (ids.includes(o.id) ? { ...o, on } : o));

// A new engine-made part replaces older ones over the same words.
function addReplacement(op, on = true) {
  const next = S.ops.map(o => (!Edits.isCut(o) && o.on && o.i <= op.j && op.i <= o.j ? { ...o, on: false } : o));
  commit([...next, Edits.fromOp(op, on)]);
}

function cutsIn({ i, j }) {
  const W = S.meta.words;
  return S.ops.filter(o => o.on && Edits.isCut(o) && range(i, j).some(k => Edits.cutFor(W[k], [o])));
}

// Runs an engine call for the open message with a status line.
async function job(text, fn) {
  const id = S.id;
  S.job = text;
  S.sel = null;
  closePop();
  renderEditor();
  try {
    return await enqueue(fn);
  } catch (err) {
    if (S.id === id) toast(errText(err), true);
    return null;
  } finally {
    if (S.id === id) { S.job = null; renderEditor(); }
  }
}

async function replaceWords({ i, j }, text) {
  text = text.trim();
  if (!text) return;
  const id = S.id;
  const r = await job(`Saying “${text}”…`, () => api.invoke('edit:replace', { id, i, j, new: text, kind: 'replace' }));
  if (!r || !adopt(r.meta)) return;
  addReplacement(r.op);
  if (!r.op.verified) toast("It may not sound quite right. Listen to check, or try again");
}

async function sayClearly({ i, j }) {
  const id = S.id;
  const words = S.meta.words.slice(i, j + 1).map(w => bare(w.w)).join(' ');
  const r = await job(`Re-saying “${words}”…`, () => api.invoke('edit:replace', { id, i, j, same: true }));
  if (!r || !adopt(r.meta)) return;
  addReplacement(r.op);
  if (!r.op.verified) toast("Couldn't confirm it's clearer. Listen to check");
}

async function toneWords({ i, j }, engine, style) {
  const id = S.id;
  const text = engine === 'tone' ? `Making it ${style} with the AI voice…` : `Making it ${style}…`;
  const r = await job(text, () => api.invoke('edit:restyle', { id, engine, style, i, j }));
  if (!r || !adopt(r.meta)) return;
  addReplacement(r.op);
}

async function tryAgain(op) {
  const id = S.id;
  const seed = Math.floor(Math.random() * 1e4);
  const natural = /^natural /.test(op.kind);
  const toned = !natural && ['calm', 'friendly', 'excited', 'confident', 'warm'].includes(op.kind);
  const r = await job('Trying again…', () => {
    if (natural) return api.invoke('edit:restyle', { id, engine: 'natural', style: op.kind.slice(8), i: op.i, j: op.j });
    if (toned) return api.invoke('edit:restyle', { id, engine: 'tone', style: op.kind, i: op.i, j: op.j });
    if (op.kind === 'pronunciation') return api.invoke('edit:replace', { id, i: op.i, j: op.j, same: true, seed });
    return api.invoke('edit:replace', { id, i: op.i, j: op.j, new: op.new, kind: op.kind, seed });
  });
  if (!r || !adopt(r.meta)) return;
  commit(S.ops.map(o => (o.id === op.id ? Edits.fromOp(r.op, true) : o)));
}

async function fixIt() {
  if (!canEdit()) return;
  if (!(await ensureRendered())) return;
  const id = S.id;
  S.fixing = 'Starting…';
  S.notice = null;
  renderEditor();
  // Progress and the result arrive as edit:status events.
  enqueue(() => api.invoke('edit:autofix', id)).catch((err) => {
    if (S.id !== id) return;
    S.fixing = null;
    S.notice = { text: `Couldn't fix it: ${errText(err)}`, retry: 'fix' };
    renderEditor();
  });
}

async function shorten() {
  const id = S.id;
  const r = await job('Looking for parts to shorten…', () => api.invoke('edit:check', { id, what: 'tighten' }));
  if (!r || !adopt(r.meta)) return;
  // Offered as suggestions; nothing is cut until you take them.
  const add = Edits.fromCuts(r.items, S.ops).map(o => ({ ...o, on: false, auto: false }));
  if (!add.length) return toast('Nothing to shorten');
  commit([...S.ops, ...add]);
  toast(`${plural(add.length, 'part')} could go. Click one to cut it`);
}

async function checkMisheard() {
  const id = S.id;
  const r = await job('Listening for misheard words…', () => api.invoke('edit:check', { id, what: 'intent' }));
  if (!r || !adopt(r.meta)) return;
  S.hints = r.items || [];
  renderEditor();
  toast(S.hints.length ? `${plural(S.hints.length, 'word')} may have been misheard. They're underlined` : 'No misheard words found');
}

// ---------- rendering the message ----------
let renderTimer = 0;
let renderPromise = null;

function scheduleRender(delay = 450) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(ensureRendered, delay);
}

// Renders the latest edits; resolves false if the engine couldn't.
function ensureRendered() {
  clearTimeout(renderTimer);
  if (!S.dirty) return Promise.resolve(true);
  if (renderPromise) return renderPromise;
  renderPromise = (async () => {
    const id = S.id;
    S.rendering = true;
    renderBar();
    try {
      while (S.dirty && S.id === id) {
        const version = S.version;
        const ops = S.ops;
        const r = await enqueue(() => api.invoke('edit:render', { id, ops }));
        if (!adopt(r.meta)) return false;
        if (S.version === version) S.dirty = false;
        setAudio('output', r.audio);
      }
      return S.id === id;
    } catch (err) {
      if (S.id === id) toast(`${errText(err)}. Your edits are saved`, true);
      return false;
    } finally {
      renderPromise = null;
      if (S.id === id) { S.rendering = false; renderEditor(); }
    }
  })();
  return renderPromise;
}

// ---------- audio ----------
const player = new Audio();
let actx = null;
let raf = 0;

async function loadAudio(which) {
  const id = S.id;
  const buf = await api.invoke('messages:audio', { id, which }).catch(() => null);
  if (S.id !== id) return;
  setAudio(which, buf);
}

function setAudio(which, buf) {
  if (!buf) return;
  const old = S.audio[which];
  if (old) URL.revokeObjectURL(old.url);
  const isWav = buf[0] === 0x52 && buf[1] === 0x49; // "RI"FF
  const entry = { url: URL.createObjectURL(new Blob([buf], { type: isWav ? 'audio/wav' : 'audio/webm' })), peaks: null, dur: 0 };
  S.audio[which] = entry;
  if (S.view === which) useSource();
  peaksOf(buf).then(({ peaks, dur }) => {
    entry.peaks = peaks;
    entry.dur = dur;
    if (S.audio[which] === entry) renderBar();
  }).catch(() => {});
}

function dropAudio() {
  for (const k of ['output', 'original']) {
    if (S.audio[k]) URL.revokeObjectURL(S.audio[k].url);
    S.audio[k] = null;
  }
  player.removeAttribute('src');
}

async function peaksOf(buf) {
  actx ||= new AudioContext();
  const decoded = await actx.decodeAudioData(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const ch = decoded.getChannelData(0);
  const n = 480;
  const step = Math.max(1, Math.floor(ch.length / n));
  const peaks = new Float32Array(n);
  for (let b = 0; b < n; b++) {
    let sum = 0;
    const end = Math.min(ch.length, (b + 1) * step);
    for (let k = b * step; k < end; k++) sum += ch[k] * ch[k];
    peaks[b] = Math.sqrt(sum / Math.max(1, end - b * step));
  }
  // Scale to a loud-but-typical level so one click or plosive doesn't flatten the rest.
  const ref = Math.max(1e-4, [...peaks].sort((a, b) => a - b)[Math.floor(n * 0.95)]);
  for (let b = 0; b < n; b++) peaks[b] = Math.min(1, Math.pow(peaks[b] / ref, 0.8));
  return { peaks, dur: decoded.duration };
}

function useSource() {
  const a = S.audio[S.view];
  player.pause();
  if (!a) { player.removeAttribute('src'); return; }
  if (player.src !== a.url) player.src = a.url;
  renderBar();
}

function stopAudio() {
  player.pause();
  cancelAnimationFrame(raf);
}

async function togglePlay() {
  if (S.route !== 'editor') return;
  if (!player.paused) return player.pause();
  if (S.view === 'output' && S.dirty && !(await ensureRendered())) return;
  if (!S.audio[S.view]) return;
  if (player.ended) player.currentTime = 0;
  player.play().catch(() => {});
}

function setView(view) {
  if (S.view === view) return;
  S.view = view;
  if (!S.audio[view]) loadAudio(view);
  useSource();
}

player.addEventListener('play', () => { renderBar(); tick(); });
player.addEventListener('pause', () => { cancelAnimationFrame(raf); renderBar(); markNow(-1); });
player.addEventListener('ended', () => { cancelAnimationFrame(raf); renderBar(); markNow(-1); });

function tick() {
  drawWave();
  if (S.view === 'original') {
    const t = player.currentTime;
    markNow((S.meta?.words || []).findIndex(w => w.s <= t && t <= w.e + 0.08));
  }
  const time = $('time');
  if (time) time.textContent = fmt(player.currentTime);
  if (!player.paused) raf = requestAnimationFrame(tick);
}

let nowK = -1;
function markNow(k) {
  if (k === nowK) return;
  spanOf(nowK)?.classList.remove('now');
  nowK = k;
  if (k >= 0) spanOf(k)?.classList.add('now');
}

// ---------- player bar ----------
function renderBar() {
  const bar = $('bar');
  if (!bar || !S.meta) return;
  const updating = S.view === 'output' && (S.dirty || S.rendering);
  const a = S.audio[S.view];
  const dur = a?.dur || (S.view === 'original' ? S.meta.dur : S.meta.take?.dur ?? S.meta.output?.dur ?? S.meta.dur);
  const playing = !player.paused;
  const time = updating ? 'Updating…' : playing || player.currentTime > 0 ? fmt(player.currentTime) : fmt(dur);
  const take = S.meta.take;
  const tones = take ? takeTones(take) : [];
  const toneLabel = !tones.length ? 'Tone' : tones.length === 1 ? cap(tones[0]) : `${tones.length} tones`;
  const avatars = tones.length ? `<span class="avs">${tones.slice(0, 3).map(s => avatar(s, take.engine === 'tone')).join('')}</span>` : '';
  const target = sendTarget();
  const busy = !canEdit() ? 'disabled' : '';
  bar.innerHTML = `
    <div class="bar-group bar-play">
      <button class="play" data-action="play" title="${playing ? 'Pause' : 'Play'} (Space)" aria-label="${playing ? 'Pause' : 'Play'}">${svg(playing ? 'pause' : 'play')}</button>
      <canvas class="wave" id="wave" title="Click to jump"></canvas>
      <span class="time" id="time">${time}</span>
    </div>
    <div class="bar-group seg" role="group" aria-label="Which version to play">
      <button class="${S.view === 'original' ? 'on' : ''}" data-action="view" data-view="original">Original</button>
      <button class="${S.view === 'output' ? 'on' : ''}" data-action="view" data-view="output">Fixed</button>
    </div>
    <div class="bar-group">
      <button class="pill-btn" data-action="tone-panel" data-menu aria-expanded="${!toneEl.hidden}" ${busy}>${avatars}${esc(toneLabel)}${svg('chevron')}</button>
      <div class="send">
        <button data-action="send" ${busy}>${target ? `Send to ${esc(target)}` : 'Copy audio'}</button>
        <button class="more" data-action="send-menu" data-menu title="More ways to send" aria-label="More ways to send" ${busy}>${svg('chevron')}</button>
      </div>
    </div>`;
  drawWave();
  paintToneStatus();
}

function sendTarget() {
  const app = S.meta.from || S.meta.sentTo;
  return app && app !== 'your browser' ? app : null;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawWave() {
  const cv = $('wave');
  if (!cv) return;
  const a = S.audio[S.view];
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const bw = 2, gap = 2;
  const n = Math.floor((w + gap) / (bw + gap));
  const dur = a?.dur || 1;
  const progress = player.src && a && player.src === a.url ? player.currentTime / dur : 0;
  const ai = S.view !== 'output' ? [] : S.meta.take?.engine === 'tone' ? [[0, dur]] : S.meta.take ? [] : S.meta.output?.ai || [];
  const ink = cssVar('--ink'), soft = cssVar('--ink-3'), made = cssVar('--made');
  const stale = S.view === 'output' && (S.dirty || S.rendering);
  for (let b = 0; b < n; b++) {
    const v = a?.peaks ? a.peaks[Math.floor((b / n) * a.peaks.length)] : 0.08;
    const bh = Math.max(2, v * h);
    const t = ((b + 0.5) / n) * dur;
    const isMade = ai.some(([s, e]) => s <= t && t <= e);
    const played = b / n < progress;
    g.fillStyle = isMade ? made : played ? ink : soft;
    g.globalAlpha = stale ? 0.3 : isMade ? (played ? 1 : 0.6) : played ? 1 : 0.55;
    g.beginPath();
    g.roundRect(b * (bw + gap), (h - bh) / 2, bw, bh, 1);
    g.fill();
  }
  g.globalAlpha = 1;
}

mainEl.addEventListener('click', (e) => {
  const cv = e.target.closest('#wave');
  const a = S.audio[S.view];
  if (!cv || !a?.dur) return;
  const r = cv.getBoundingClientRect();
  player.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.dur;
  tick();
});

window.addEventListener('resize', () => { drawWave(); closePop(); closeMenu(); if (!toneEl.hidden) placeTone(); });

// ---------- menus ----------
function openMenu(anchor, html) {
  menuEl.innerHTML = html;
  menuEl.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = menuEl.offsetWidth;
  menuEl.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
  menuEl.style.top = `${r.top - menuEl.offsetHeight - 10}px`;
}
function closeMenu() { menuEl.hidden = true; }

function sendMenuHtml() {
  const target = sendTarget();
  return `
    ${SEND_APPS.filter(a => a !== target).map(a => `<button class="menu-item" data-action="send-to" data-app="${a}">Send to ${a}</button>`).join('')}
    ${target ? '<div class="menu-sep"></div><button class="menu-item" data-action="send-to" data-app="">Copy audio</button>' : ''}`;
}

// ---------- tone panel ----------
// Your voice: a slider per tone, mixed into one pitch-and-pace change of your
// own recording. AI voice: one tone at a time, re-made by the AI voice.
// Letting go of a slider (or picking an AI tone) makes the new take and plays it.
const TONE = {
  id: null,                                  // the message the panel was opened for
  tab: 'natural',                            // natural | ai
  levels: { confident: 0, calm: 0, warm: 0 }, // slider positions, 0..1
  timer: 0,
  busy: false,                               // a take is being made
  again: false,                              // the sliders moved while it was
};

// The tones in a take, strongest first.
function takeTones(take) {
  const mix = take.mix || { [take.style]: 1 };
  return Object.entries(mix).filter(([, a]) => a > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

const avatar = (tone, ai = false) => `<span class="av k-${tone}${ai ? ' ai' : ''}">${character(tone, true)}</span>`;

const levelName = (v) => (v <= 0 ? 'Off' : v < 0.4 ? 'Light' : v < 0.8 ? 'Medium' : 'Strong');

function levelsOf(take) {
  const levels = { confident: 0, calm: 0, warm: 0 };
  if (take?.engine !== 'natural') return levels;
  for (const [k, a] of Object.entries(take.mix || { [take.style]: 1 })) if (k in levels) levels[k] = Math.min(1, a / MAX_AMOUNT);
  return levels;
}

// Slider positions to what the engine takes: {style: amount}, 1 = the preset.
function mixOf(levels) {
  const mix = {};
  for (const [k, v] of Object.entries(levels)) if (v > 0) mix[k] = Math.round(v * MAX_AMOUNT * 100) / 100;
  return mix;
}

// What the mix does, in plain words: "Pitch 5% lower, 7% faster, firm endings".
function describeMix(mix) {
  let shift = 1, range = 1, speed = 1, fall = false;
  for (const [k, a] of Object.entries(mix)) {
    const p = NATURAL_PRESETS[k];
    shift *= p.shift ** a; range *= p.range ** a; speed *= p.speed ** a;
    fall ||= p.fall;
  }
  const pct = (x) => Math.round(Math.abs(x - 1) * 100);
  const parts = [];
  if (pct(shift)) parts.push(`pitch ${pct(shift)}% ${shift < 1 ? 'lower' : 'higher'}`);
  if (pct(speed)) parts.push(`${pct(speed)}% ${speed > 1 ? 'faster' : 'slower'}`);
  if (range < 0.95) parts.push('steadier');
  else if (range > 1.05) parts.push('more lively');
  if (fall) parts.push('firm endings');
  return parts.length ? cap(parts.join(', ')) : 'Move a slider to change how you sound';
}

function openTone() {
  if (!canEdit()) return;
  closeMenu();
  const take = S.meta.take;
  TONE.id = S.id;
  TONE.tab = take?.engine === 'tone' ? 'ai' : 'natural';
  TONE.levels = levelsOf(take);
  toneEl.hidden = false;
  renderTone();
  renderBar();
}

function closeTone() {
  if (toneEl.hidden) return;
  toneEl.hidden = true;
  renderBar();
}

function renderTone() {
  if (toneEl.hidden) return;
  const take = S.meta?.take;
  const locked = S.fixing || S.opening ? 'disabled' : '';
  const tab = (key, label) => `<button class="${TONE.tab === key ? 'on' : ''}" data-action="tone-tab" data-tab="${key}">${label}</button>`;
  let body;
  if (TONE.tab === 'natural') {
    body = `<div class="tone-cards">${NATURAL_STYLES.map((s) => {
      const v = TONE.levels[s];
      return `<div class="tc k-${s} ${v > 0 ? 'on' : ''}" data-tone="${s}" style="--a:${v}">
        <button class="tc-art" data-action="tone-bump" data-tone="${s}" title="Click to step through Off, Medium and Strong" ${locked}>${character(s)}</button>
        <div class="tc-name"><span>${cap(s)}</span><span class="lvl">${levelName(v)}</span></div>
        <div class="tc-blurb">${NATURAL_PRESETS[s].blurb}</div>
        <input class="tc-range" type="range" min="0" max="100" value="${Math.round(v * 100)}" data-tone="${s}"
          aria-label="How ${s}" aria-valuetext="${levelName(v)}" ${locked} />
      </div>`;
    }).join('')}</div>
    <div class="tone-foot"><span class="grow tone-read">${esc(describeMix(mixOf(TONE.levels)))}</span><span class="tone-status"></span></div>`;
  } else {
    body = `<div class="tone-cards ai">${AI_STYLES.map((s) => {
      const on = take?.engine === 'tone' && take.style === s;
      return `<button class="tc k-${s} ${on ? 'on' : ''}" data-action="tone-ai" data-tone="${s}" style="--a:${on ? 1 : 0}" aria-pressed="${on}" ${locked}>
        <span class="tc-art">${character(s)}</span><span class="tc-name">${cap(s)}</span></button>`;
    }).join('')}</div>
    <div class="tone-foot"><span class="grow">Re-made by an AI voice, so it sounds less like you</span><span class="tone-status"></span></div>`;
  }
  toneEl.innerHTML = `
    <div class="tone-head">
      <div class="seg" role="group" aria-label="Which voice">${tab('natural', 'Your voice')}${tab('ai', 'AI voice')}</div>
      <button class="text-btn" data-action="tone-reset">No tone change</button>
    </div>
    ${body}`;
  paintToneStatus();
  placeTone();
}

// Above the player bar, at its right end, so it stays put as the Tone button's label changes.
function placeTone() {
  const bar = $('bar');
  if (!bar) return closeTone();
  const r = bar.getBoundingClientRect();
  const w = toneEl.offsetWidth;
  toneEl.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
  toneEl.style.top = `${Math.max(8, r.top - toneEl.offsetHeight - 10)}px`;
}

// Updates a card while its slider moves, without re-rendering the panel.
function paintToneCard(tone) {
  const card = toneEl.querySelector(`.tc[data-tone="${tone}"]`);
  if (!card) return;
  const v = TONE.levels[tone];
  card.style.setProperty('--a', v);
  card.classList.toggle('on', v > 0);
  card.querySelector('.lvl').textContent = levelName(v);
  const input = card.querySelector('.tc-range');
  if (+input.value !== Math.round(v * 100)) input.value = Math.round(v * 100);
  input.setAttribute('aria-valuetext', levelName(v));
  const read = toneEl.querySelector('.tone-read');
  if (read) read.textContent = describeMix(mixOf(TONE.levels));
  paintToneStatus();
}

// What the engine is doing, and whether there is a tone to remove.
function paintToneStatus() {
  const el = toneEl.hidden ? null : toneEl.querySelector('.tone-status');
  if (!el) return;
  const text = S.job || S.fixing;
  el.innerHTML = text ? `<span class="spin"></span>${esc(text)}` : '';
  toneEl.querySelector('[data-action="tone-reset"]').disabled = !S.meta?.take && !Object.values(TONE.levels).some(v => v > 0);
}

// Makes the take for the sliders once they settle; if they move while a take
// is being made, the newest positions win.
function scheduleTone(delay = 280) {
  clearTimeout(TONE.timer);
  TONE.timer = setTimeout(applyTone, delay);
}

async function applyTone() {
  if (TONE.busy) { TONE.again = true; return; }
  if (S.id !== TONE.id || !S.meta) return;
  const want = mixOf(TONE.levels);
  const have = mixOf(levelsOf(S.meta.take));
  if (JSON.stringify(want) === JSON.stringify(have)) return;
  TONE.busy = true;
  let ok = false;
  try {
    if (!Object.keys(want).length) ok = await clearTone();
    else {
      const tones = Object.keys(want).sort((a, b) => want[b] - want[a]);
      ok = await toneAll('natural', tones[0], want);
    }
  } finally {
    TONE.busy = false;
  }
  if (TONE.again) { TONE.again = false; return applyTone(); }
  if (ok) preview();
}

// Plays the new take from the start.
function preview() {
  if (S.id !== TONE.id || !S.audio.output) return;
  player.currentTime = 0;
  player.play().catch(() => {});
}

async function pickAiTone(style) {
  if (TONE.busy || !S.meta) return;
  const take = S.meta.take;
  if (take?.engine === 'tone' && take.style === style) return preview();
  TONE.busy = true;
  let ok = false;
  try {
    ok = await toneAll('tone', style);
  } finally {
    TONE.busy = false;
  }
  TONE.levels = levelsOf(S.meta.take);
  renderTone();
  if (ok) preview();
}

async function resetTone() {
  clearTimeout(TONE.timer);
  TONE.levels = { confident: 0, calm: 0, warm: 0 };
  renderTone();
  if (!S.meta?.take || TONE.busy) return;
  TONE.busy = true;
  try {
    await clearTone();
  } finally {
    TONE.busy = false;
  }
  renderTone();
}

// A take of the whole message: natural (a mix of presets, in your own voice)
// or tone (the AI voice). Resolves true when there is a new take.
async function toneAll(engine, style, mix) {
  if (!canEdit() || !(await ensureRendered())) return false;
  const id = S.id;
  const what = mix ? joinAnd(Object.keys(mix).sort((a, b) => mix[b] - mix[a])) : style;
  const text = engine === 'tone' ? `Making it ${what} with the AI voice…` : `Making it ${what}…`;
  const r = await job(text, () => api.invoke('edit:restyle', { id, engine, style, mix }));
  if (!r || !adopt(r.meta)) return false;
  renderEditor();
  setView('output');
  setAudio('output', r.audio);
  if (engine === 'tone' && r.meta.take?.wordsKept != null && r.meta.take.wordsKept < 0.9) {
    toast('Some words changed in the restyle. Listen before sending', true);
  }
  return true;
}

async function clearTone() {
  const id = S.id;
  const r = await job('Removing the tone…', () => api.invoke('edit:clear-take', id));
  if (!r || !adopt(r.meta)) return false;
  renderEditor();
  setAudio('output', r.audio);
  return true;
}

toneEl.addEventListener('input', (e) => {
  const tone = e.target.matches('.tc-range') && e.target.dataset.tone;
  if (!tone) return;
  clearTimeout(TONE.timer);
  TONE.levels[tone] = e.target.value / 100;
  paintToneCard(tone);
});
// change fires when the slider is let go (or after a key press on it)
toneEl.addEventListener('change', (e) => {
  if (e.target.matches('.tc-range')) scheduleTone();
});

async function send(appName) {
  closeMenu();
  if (!canEdit() || !(await ensureRendered())) return;
  const id = S.id;
  const r = await job(appName ? `Sending to ${appName}…` : 'Copying…', () => api.invoke('send:message', { id, app: appName || undefined }));
  if (r) toast(r.message, !r.ok);
}

// ---------- toast ----------
let toastTimer = 0;
function toast(text, bad = false) {
  const el = $('toast');
  el.textContent = text;
  el.classList.toggle('bad', bad);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 5200 : 3200);
}

// ---------- settings ----------
const SHORTCUT_INFO = [
  ['toggle', 'Record, then send', 'Works in any app'],
  ['review', 'Finish and edit first', 'While recording'],
  ['undo', 'Undo the last thing you said', 'While recording'],
  ['cancel', 'Discard the recording', 'While recording'],
  ['open', 'Open Ctrl+Voice', 'Works in any app'],
];

async function openSettings() {
  stopAudio();
  closePop();
  S.route = 'settings';
  S.id = null;
  S.meta = null;
  render();
  listMics();
  checkHealth();
}

async function checkHealth() {
  S.health = null;
  if (S.route === 'settings') renderSettings();
  S.health = await api.invoke('engine:health').catch(() => ({ ok: false, message: "Can't reach the engine" }));
  if (S.route === 'settings') renderSettings();
}

async function listMics() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    S.mics = devices.filter(d => d.kind === 'audioinput' && !['default', 'communications'].includes(d.deviceId));
  } catch {
    S.mics = [];
  }
  if (S.route === 'settings') renderSettings();
}
navigator.mediaDevices?.addEventListener('devicechange', listMics);

function renderSettings() {
  const s = S.settings;
  const sw = (key, on) => `<button class="switch ${on ? 'on' : ''}" data-action="switch" data-key="${key}" role="switch" aria-checked="${!!on}"></button>`;
  const row = (title, desc, control) => `
    <div class="set"><div class="set-text"><div class="set-title">${title}</div>${desc ? `<div class="set-desc">${desc}</div>` : ''}</div>${control}</div>`;
  const h = S.health;
  const status = !h ? '<span class="set-status">Checking…</span>'
    : h.ok ? `<span class="set-status ok"><span class="dot"></span>Connected, ${h.ms} ms</span>`
    : `<span class="set-status bad"><span class="dot"></span>${esc(h.message)}</span>`;
  const mics = [`<option value="default">System default</option>`, ...S.mics.map(d =>
    `<option value="${esc(d.deviceId)}" ${s.micId === d.deviceId ? 'selected' : ''}>${esc(d.label || 'Microphone')}</option>`)].join('');
  const scroll = mainEl.querySelector('.col') ? mainEl.scrollTop : 0;
  mainEl.innerHTML = `
    <div class="col">
      <h1 class="page-title">Settings</h1>

      <section class="section"><h2>Engine</h2><div class="group">
        ${row('Server address', 'The ReSpeak engine that fixes your messages', `<input class="field url" id="backendUrl" value="${esc(s.backendUrl)}" spellcheck="false" />`)}
        ${row('Status', '', `${status}<button class="small-btn" data-action="health">Check</button>`)}
      </div></section>

      <section class="section"><h2>Recording</h2><div class="group">
        ${row('Microphone', '', `<select class="field" id="micId">${mics}</select>`)}
        ${row('When you finish', 'Sending works in Discord, WhatsApp, Telegram, Slack, Signal and Teams. Anywhere else, the editor opens.', `
          <div class="seg">
            <button class="${s.finishAction === 'send' ? 'on' : ''}" data-action="finish" data-value="send">Send it</button>
            <button class="${s.finishAction === 'review' ? 'on' : ''}" data-action="finish" data-value="review">Open the editor</button>
          </div>`)}
        ${row('Press Enter after pasting', 'Turn off to check the message in the chat before it goes', sw('autoSend', s.autoSend))}
      </div></section>

      <section class="section"><h2>Automatic fixes</h2><div class="group">
        ${row('Cut filler words and false starts', '“Um”, “uh”, repeats, and things you corrected yourself', sw('fix.cleanup', s.fix.cleanup))}
        ${row('Fix grammar', 'Up to 3 words per message, said again in your voice', sw('fix.grammar', s.fix.grammar))}
        ${row('Re-say unclear words', 'Up to 3 words, kept only when the new take is clearer', sw('fix.pronunciation', s.fix.pronunciation))}
      </div></section>

      <section class="section"><h2>Shortcuts</h2><div class="group">
        ${SHORTCUT_INFO.map(([k, title, desc]) => {
          const taken = S.shortcutStatus[k] === false;
          const capturing = S.capturing === k;
          return row(title, taken ? '<span style="color:var(--amber)">In use by another app. Pick another</span>' : desc,
            `<button class="keys-btn ${capturing ? 'capturing' : ''}" data-action="capture" data-key="${k}">${capturing ? 'Press keys, Esc to cancel' : keycaps(s.shortcuts[k])}</button>`);
        }).join('')}
      </div></section>

      <section class="section"><h2>App</h2><div class="group">
        ${row('Floating bar when idle', 'A small handle at the bottom of the screen. Hover it to record.', sw('showIdleBar', s.showIdleBar))}
        ${row('Launch at startup', '', sw('launchAtStartup', s.launchAtStartup))}
        ${row('Start in the background', 'Open to the tray without showing this window', sw('startHidden', s.startHidden))}
      </div></section>

      <div class="foot">
        <button class="small-btn" data-action="reset-shortcuts">Reset shortcuts</button>
        <button class="small-btn danger" data-action="quit">Quit Ctrl+Voice</button>
      </div>
    </div>`;
  mainEl.scrollTop = scroll;
  $('micId').addEventListener('change', (e) => setSetting({ micId: e.target.value }));
  $('backendUrl').addEventListener('change', async (e) => {
    const url = e.target.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/\S+$/.test(url)) return toast('Enter an address that starts with https://', true);
    await setSetting({ backendUrl: url });
    checkHealth();
  });
}

async function setSetting(patch) {
  applySettingsPayload(await api.invoke('settings:set', patch));
  if (S.route === 'settings') renderSettings();
}

function applySettingsPayload({ settings, shortcutStatus, defaults }) {
  S.settings = settings;
  S.shortcutStatus = shortcutStatus || {};
  if (defaults) S.defaults = defaults;
  renderRecordButton();
}

function accelFromEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');
  const c = e.code;
  let key = null;
  if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
  else if (/^Digit\d$/.test(c)) key = c.slice(5);
  else if (/^F\d{1,2}$/.test(c)) key = c;
  else key = { Space: 'Space', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert' }[c];
  if (!key) return null; // a modifier on its own
  return [...parts, key].join('+');
}

async function startCapture(key) {
  S.capturing = S.capturing === key ? null : key;
  await api.invoke('shortcuts:suspend', !!S.capturing);
  renderSettings();
}

async function endCapture(accel) {
  const key = S.capturing;
  S.capturing = null;
  await api.invoke('shortcuts:suspend', false);
  if (accel) await setSetting({ shortcuts: { [key]: accel } });
  else renderSettings();
}

// ---------- actions ----------
const ACTIONS = {
  'win-min': () => api.send('win:minimize'),
  'win-max': () => api.send('win:maximize'),
  'win-close': () => api.send('win:close'),
  'rec-toggle': () => api.send('rec:toggle'),
  'go-settings': () => openSettings(),
  open: (el) => openMessage(el.dataset.id),
  retry: () => (S.notice?.retry === 'fix' ? fixIt() : openMessage(S.id)),
  delete: async () => {
    if (!S.armedDelete) {
      S.armedDelete = true;
      renderEditor();
      setTimeout(() => { if (S.armedDelete) { S.armedDelete = false; renderEditor(); } }, 3000);
      return;
    }
    const id = S.id;
    stopAudio();
    await api.invoke('messages:delete', id);
    S.messages = S.messages.filter(m => m.id !== id);
    toast('Message deleted');
    goHome();
  },

  // words
  replace: () => { S.pop = 'replace'; openPop(); },
  'replace-go': () => { const sel = S.sel; const text = $('popInput').value; clearSelection(); replaceWords(sel, text); },
  'say-clearly': () => sayClearly(S.sel),
  cut: () => commit([...S.ops, Edits.cutRange(S.meta.words, S.sel.i, S.sel.j, S.meta.dur)]),
  restore: () => commit(setOn(cutsIn(S.sel).map(o => o.id), false)),
  'take-suggestion': () => { const c = contextOf(S.sel); commit(setOn([c.op.id], true)); },
  keep: () => { const c = contextOf(S.sel); commit(S.ops.filter(o => o.id !== c.op.id)); },
  'take-suggestions': () => commit(S.ops.map(o => (!o.on && o.auto === false && Edits.isCut(o) ? { ...o, on: true } : o))),
  'use-original': () => { const c = contextOf(S.sel); commit(setOn([c.op.id], false)); },
  'try-again': () => tryAgain(contextOf(S.sel).op),
  tone: () => { S.pop = 'tone'; openPop(); },
  'tone-sel': (el) => toneWords(S.sel, el.dataset.engine, el.dataset.style),
  'use-hint': () => { const { hint } = contextOf(S.sel); S.hints = S.hints.filter(h => h !== hint); replaceWords({ i: hint.i, j: hint.j }, hint.new); },
  'dismiss-hint': () => { const { hint } = contextOf(S.sel); S.hints = S.hints.filter(h => h !== hint); clearSelection(); renderEditor(); },

  // message
  fix: () => fixIt(),
  shorten: () => shorten(),
  misheard: () => checkMisheard(),
  play: () => togglePlay(),
  view: (el) => setView(el.dataset.view),
  'tone-panel': () => (toneEl.hidden ? openTone() : closeTone()),
  'tone-tab': (el) => { TONE.tab = el.dataset.tab; renderTone(); },
  // clicking a character steps it Off, Medium (the preset), Strong
  'tone-bump': (el) => {
    const tone = el.dataset.tone;
    const v = TONE.levels[tone];
    TONE.levels[tone] = v < 0.66 ? 2 / 3 : v < 1 ? 1 : 0;
    paintToneCard(tone);
    scheduleTone(450);
  },
  'tone-ai': (el) => pickAiTone(el.dataset.tone),
  'tone-reset': () => resetTone(),
  send: () => send(sendTarget()),
  'send-menu': (el) => (menuEl.hidden ? openMenu(el, sendMenuHtml()) : closeMenu()),
  'send-to': (el) => send(el.dataset.app),

  // settings
  health: () => checkHealth(),
  switch: (el) => {
    const [a, b] = el.dataset.key.split('.');
    const on = !el.classList.contains('on');
    setSetting(b ? { [a]: { [b]: on } } : { [a]: on });
  },
  finish: (el) => setSetting({ finishAction: el.dataset.value }),
  capture: (el) => startCapture(el.dataset.key),
  'reset-shortcuts': () => setSetting({ shortcuts: S.defaults.shortcuts }),
  quit: () => api.send('app:quit'),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) fn(el, e);
});

mainEl.addEventListener('change', (e) => {
  if (e.target.id !== 'title' || !S.meta) return;
  const id = S.id;
  api.invoke('messages:rename', { id, title: e.target.value }).then((meta) => {
    if (meta.id === S.id) S.meta = { ...S.meta, title: meta.title, renamed: meta.renamed };
    upsert(S.id === id ? S.meta : meta);
  });
});

document.addEventListener('keydown', (e) => {
  if (S.capturing) {
    e.preventDefault();
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) return endCapture(null);
    const accel = accelFromEvent(e);
    if (accel) endCapture(accel);
    return;
  }
  const typing = e.target.matches('input, select, textarea');
  if (e.target.id === 'popInput') {
    if (e.key === 'Enter') ACTIONS['replace-go']();
    if (e.key === 'Escape') { S.pop = 'actions'; openPop(); }
    return;
  }
  if (e.target.id === 'title' && (e.key === 'Enter' || e.key === 'Escape')) { e.target.blur(); return; }
  if (e.key === 'Escape' && !toneEl.hidden) { closeTone(); return; }
  if (typing) return;
  if (e.key === 'Escape') { closeMenu(); clearSelection(); return; }
  if (S.route !== 'editor') return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undoEdit(); }
  else if (ctrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redoEdit(); }
  else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel && canEdit()) { e.preventDefault(); ACTIONS.cut(); }
});

// ---------- events from the main process ----------
api.on('nav:go', navigate);
api.on('settings:changed', (payload) => {
  applySettingsPayload(payload);
  if (S.route === 'settings') renderSettings();
});
api.on('message:new', (meta) => {
  upsert(meta);
  if (S.route === 'home') return openMessage(meta.id);
  // Header fields only: the editor's own edit list stays the source of truth.
  if (meta.id === S.id && S.meta) {
    S.meta = { ...S.meta, title: meta.title, sentTo: meta.sentTo, sentAt: meta.sentAt };
    renderEditor();
  }
});
api.on('edit:status', ({ id, text, meta, error }) => {
  if (id !== S.id) return;
  S.fixing = text;
  if (text === null) {
    if (meta) {
      S.meta = meta;
      S.ops = meta.ops || [];
      S.version++;
      S.history = [];
      S.future = [];
      S.dirty = false;
      loadAudio('output');
    }
    S.notice = error ? { text: `Couldn't fix it: ${error}`, retry: 'fix' } : null;
  }
  renderEditor();
});
api.on('rec:recording', (on) => {
  S.recording = on;
  if (on) S.elapsed = 0;
  renderRecordButton();
});
api.on('rec:state', ({ status, elapsed }) => {
  S.recStatus = status;
  S.elapsed = elapsed || 0;
  if (S.recording) renderRecordButton();
});
api.on('win:state', ({ maximized }) => {
  $('maxBtn').innerHTML = maximized ? '&#xE923;' : '&#xE922;';
  $('maxBtn').title = maximized ? 'Restore' : 'Maximize';
});

// ---------- boot ----------
(async function boot() {
  applySettingsPayload(await api.invoke('settings:get'));
  S.messages = (await api.invoke('messages:list')) || [];
  goHome();
})();
