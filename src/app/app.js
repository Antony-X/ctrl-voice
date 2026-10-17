// Ctrl+Voice — main window renderer.
const api = window.respeak;
const view = document.getElementById('view');
const player = new Player();

// ---------- icons (lucide-style strokes) ----------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  library: '<path d="M4 5h16M4 12h16M4 19h10"/>',
  voice: '<path d="M2 10v4M6 6v12M10 3v18M14 8v8M18 5v14M22 10v4"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"/>',
  type: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  download: '<path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  wand: '<path d="m15 4 5 5L9 20H4v-5L15 4Z"/><path d="m12 7 5 5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  user: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0"/>',
  bar: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7.5 10.5v3M10 8.5v7M12.5 6.5v11M15 8.5v7M17.5 10.5v3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;
const ic = (n) => `<i>${svg(n)}</i>`;
const hydrateIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((el) => { el.innerHTML = svg(el.dataset.icon); el.removeAttribute('data-icon'); });

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s = 0) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const KEY_LABELS = { '`': '~ `', Escape: 'Esc' };
const keyParts = (a = '') => a.replace('CommandOrControl', 'Ctrl').split('+').map(k => KEY_LABELS[k] || k);
const keycaps = (a, cls = '') => `<span class="keys ${cls}">${keyParts(a).map(k => `<span class="key">${esc(k)}</span>`).join('')}</span>`;
const clone = (o) => JSON.parse(JSON.stringify(o));
const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function dayOf(ts) {
  const d = new Date(ts), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
function toast(text, icon = 'spark') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="t-icon">${ic(icon)}</span><span>${text}</span>`;
  el.querySelector('i').style.cssText = 'width:16px;height:16px;display:inline-flex';
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
}

// ---------- state ----------
const S = {
  route: 'home',
  settings: null,
  shortcutStatus: {},
  messages: [],
  rec: { status: 'idle', elapsed: 0, levels: [], segments: [], next: null, undoCount: 0 },
  composeTab: 'speak',
  tts: { text: '', tone: 'original', busy: false },
  library: { q: '', filter: 'all' },
  ed: null,
  capturing: null,
  mics: [],
  voices: [],
  voice: {
    samples: [
      'The quick brown fox jumps over the lazy dog.',
      'Can you send me the slides before the meeting?',
      "I'm really excited about how this turned out!",
      'Hmm, let me think about that for a second.',
      'Wednesday works great, see you at five.',
      'Honestly? That was the best demo all weekend.',
    ],
    done: [true, true, true, true, false, false],
    busy: -1,
    style: { expressive: 62, pace: 80, breath: 55, warmth: 70 },
    watermark: true,
    ownOnly: true,
  },
};

// ---------- message model helpers ----------
function tokens(seg, edits) {
  const es = edits.filter(e => e.segId === seg.id);
  const out = [];
  let i = 0;
  while (i < seg.words.length) {
    const e = es.find(x => x.start === i);
    if (e) { out.push({ type: e.text == null ? 'del' : 'gen', text: e.text, from: i, to: e.end, edit: e }); i = e.end + 1; }
    else { out.push({ type: 'w', text: seg.words[i].w, i }); i++; }
  }
  return out;
}
function segEditedText(msg, seg) {
  if (msg.tone?.texts?.[seg.id]) return msg.tone.texts[seg.id];
  return tokens(seg, msg.edits || []).filter(t => t.type !== 'del').map(t => t.text).join(' ');
}
function editedText(msg) {
  return msg.segments.filter(s => !s.undone).map(s => segEditedText(msg, s)).filter(Boolean).join(' ');
}
const undoneCount = (m) => m.segments.filter(s => s.undone).length;
const editCount = (m) => (m.edits?.length || 0) + (m.tone ? 1 : 0);
const msgDuration = (m) => m.duration || m.segments.reduce((a, s) => a + s.words.length * 0.38, 0);
function overlaps(a, b) { return a.segId === b.segId && a.start <= b.end && b.start <= a.end; }

// ---------- routing ----------
function go(route) {
  if (S.route.startsWith('editor') && route !== S.route) { player.stop(); S.ed = null; }
  if (route.startsWith('compose:')) { S.composeTab = route.split(':')[1]; route = 'compose'; }
  S.route = route;
  if (route.startsWith('editor:')) return openEditor(route.slice(7));
  render();
}

function render() {
  const keepScroll = view.dataset.route === S.route ? view.scrollTop : 0;
  const base = S.route.split(':')[0];
  document.querySelectorAll('[data-action="nav"]').forEach(b => b.classList.toggle('active', b.dataset.route === base || (base === 'editor' && b.dataset.route === 'library')));
  const page = PAGES[base] || PAGES.home;
  view.innerHTML = `<div class="page">${page()}</div>`;
  view.dataset.route = S.route;
  view.scrollTop = keepScroll;
  hydrateIcons(view);
  renderSetup();
  AFTER[base]?.();
}

// ---------- pages ----------
const PAGES = {};
const AFTER = {};

PAGES.home = () => {
  const m = S.messages;
  const sc = S.settings.shortcuts;
  const name = S.settings?.userName ? ` ${esc(S.settings.userName)}` : '';
  const undos = m.reduce((a, x) => a + undoneCount(x), 0);
  const fixes = m.reduce((a, x) => a + editCount(x), 0);
  const v = S.voice, vDone = v.done.filter(Boolean).length;
  const rec = S.rec.status === 'rec';
  return `
    <h1 class="headline">Hey${name}, speak from anywhere with <span class="keycap-hl">${keyParts(sc.toggle).join(' + ')}</span></h1>

    <div class="home-grid">
      <div>
        <section class="banner">
          <div class="banner-copy">
            <div class="banner-title">Send it straight to Discord</div>
            <div class="banner-sub">Open a channel, press ${keycaps(sc.toggle, 'inline')}, talk, press it again. It lands in the chat.</div>
            <button class="btn primary" data-action="rec-toggle">${rec ? 'Finish recording' : 'Get started'}</button>
          </div>
          <div class="banner-art">${bannerArt()}</div>
        </section>

        ${m.length ? feed(m.slice(0, 8), { search: true }) : `
          <h2 class="h-sec">How it works</h2>
          <div class="tips">
            <div class="tip glass"><div class="tip-num">1</div><div class="tip-title">Just talk</div><p>Press ${keycaps(sc.toggle, 'inline')} in any app. A floating bar appears at the bottom of your screen.</p></div>
            <div class="tip glass"><div class="tip-num">2</div><div class="tip-title">Undo a thought</div><p>Misspoke? Hit ${keycaps(sc.undo, 'inline')} and the whole last sentence disappears. Keep going.</p></div>
            <div class="tip glass"><div class="tip-num">3</div><div class="tip-title">Polish &amp; send</div><p>Fix grammar, filler and tone, or rewrite a phrase. It's regenerated in your own voice.</p></div>
          </div>`}
      </div>

      <aside class="side-col glass">
        <div class="side-stats">
          <div class="stat-line"><b>${m.length}</b> messages</div>
          <div class="stat-line"><b>${undos}</b> thoughts undone</div>
          <div class="stat-line"><b>${fixes}</b> AI fixes</div>
          <div class="stat-line" style="margin:0"><b>${streak()}</b> day streak</div>
        </div>
        <div class="profile-card">
          <div class="t">Your Voice Profile</div>
          <p>${vDone < v.samples.length ? `Record ${v.samples.length - vDone} more samples so edits sound exactly like you.` : 'Fully trained. Edits sound like you.'}</p>
          <div class="row"><div class="meter grow" style="margin:0"><div style="width:${(vDone / v.samples.length) * 100}%"></div></div><span class="small faint">${vDone}/${v.samples.length}</span></div>
        </div>
      </aside>
    </div>
  `;
};

function bannerArt() {
  const bubble = [8, 14, 22, 12, 26, 18, 10, 20, 28, 16, 9, 18, 24, 12, 7, 15, 21, 11].map(h => `<span style="height:${h}px"></span>`).join('');
  const bars = [8, 14, 20, 12, 18, 9, 15].map((h, i) => `<span style="height:${h}px;animation-delay:${i * -0.15}s"></span>`).join('');
  return `
    <div class="chat-mock">
      <div class="chat-line"><div class="chat-av"></div><div class="chat-bar" style="width:38%"></div></div>
      <div class="chat-line"><div class="chat-av b"></div><div class="bubble"><div class="play"></div>${bubble}</div></div>
      <div class="chat-line"><div class="chat-av"></div><div class="chat-bar" style="width:56%"></div></div>
      <div class="chat-line"><div class="chat-av b"></div><div class="chat-bar" style="width:30%"></div></div>
    </div>
    <div class="pill-mock"><span class="rd"></span>0:07<span class="bars">${bars}</span><span class="u">↶ Undo</span></div>`;
}

function streak() {
  const days = new Set(S.messages.map(x => new Date(x.createdAt).toDateString()));
  let n = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // streak survives until tonight
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const shortTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase();

// Flow-style feed: one bordered table per day, time on the left.
function feed(list, { search = false, withDelete = false } = {}) {
  const days = [];
  list.forEach((m) => {
    const d = dayOf(m.createdAt);
    if (!days.length || days[days.length - 1].day !== d) days.push({ day: d, items: [] });
    days[days.length - 1].items.push(m);
  });
  return days.map(({ day, items }, i) => `
    <div class="feed-head">
      <h2 class="h-sec">${day}</h2>
      ${search && i === 0 ? `<button class="btn ghost sm icon" data-action="nav" data-route="library" title="Search all messages">${ic('search')}</button>` : ''}
    </div>
    <div class="feed">${items.map(m => feedRow(m, withDelete)).join('')}</div>`).join('');
}

function feedRow(m, withDelete) {
  const typed = m.type === 'tts';
  const u = undoneCount(m), e = editCount(m);
  const text = editedText(m);
  return `
    <div class="feed-row" data-action="open" data-id="${m.id}">
      <div class="feed-time">${shortTime(m.createdAt)}</div>
      <div class="feed-text">
        <div class="snip">${text ? esc(text) : `<span class="faint">${esc(m.title)} · no transcript (live mode)</span>`}</div>
        ${typed || u || e || m.sentTo ? `<div class="pills">
          ${typed ? '<span class="tag">Typed → voice</span>' : ''}
          ${u ? `<span class="tag red">↶ ${u} undone</span>` : ''}
          ${e ? `<span class="tag accent">✦ ${e} AI edit${e > 1 ? 's' : ''}</span>` : ''}
          ${m.tone ? `<span class="tag accent">${MockAI.TONES[m.tone.name]?.label}</span>` : ''}
          ${m.sentTo ? `<span class="tag sent">✓ Sent to ${esc(m.sentTo)}</span>` : ''}
        </div>` : ''}
      </div>
      <div class="feed-meta">
        <span class="msg-icon">${ic(typed ? 'type' : 'mic')}</span>${fmt(msgDuration(m))}
        ${withDelete ? `<button class="btn ghost sm icon" data-action="delete-msg" data-id="${m.id}" title="Delete">${ic('trash')}</button>` : ''}
      </div>
    </div>`;
}

function renderSetup() {
  const m = S.messages;
  const items = [
    ['Record your first message', m.some(x => x.type !== 'tts'), 'compose'],
    ['Undo a thought mid-sentence', m.some(x => undoneCount(x) > 0), 'compose'],
    ['Apply an AI fix', m.some(x => editCount(x) > 0), 'library'],
    ['Send one to Discord', m.some(x => x.sentTo), 'compose'],
    ['Type a message to speak', m.some(x => x.type === 'tts'), 'compose:type'],
    ['Train your voice', S.voice.done.every(Boolean), 'voice'],
  ];
  const done = items.filter(i => i[1]).length;
  const el = document.getElementById('setupCard');
  el.hidden = done === items.length;
  el.innerHTML = `
    <div class="setup-title">Get started</div>
    <div class="meter"><div style="width:${(done / items.length) * 100}%"></div></div>
    ${items.map(([label, ok, to]) => `<button class="setup-item ${ok ? 'done' : ''}" data-action="go" data-to="${to}"><span class="ring">${ok ? svg('check').replace('stroke-width="1.8"', 'stroke-width="3"') : ''}</span><span class="label">${label}</span></button>`).join('')}`;
}

// ---------- compose ----------
PAGES.compose = () => `
  <div class="row between wrap">
    <div>
      <h1 class="h-page">New message</h1>
      <p class="sub">Speak it, or type it and send it in your voice.</p>
    </div>
    <div class="segmented">
      <button class="${S.composeTab === 'speak' ? 'active' : ''}" data-action="compose-tab" data-tab="speak">${ic('mic')}Speak</button>
      <button class="${S.composeTab === 'type' ? 'active' : ''}" data-action="compose-tab" data-tab="type">${ic('type')}Type to speak</button>
    </div>
  </div>
  ${S.composeTab === 'speak' ? composeSpeak() : composeType()}
`;

function composeSpeak() {
  const r = S.rec;
  const sc = S.settings.shortcuts;
  const stage = r.status === 'rec' ? `
      <button class="orb rec" data-action="rec-toggle" title="Finish">${ic('stop')}<canvas id="ring" width="400" height="400"></canvas></button>
      <div class="timer" id="liveTimer">${fmt(r.elapsed)}</div>
      <div class="live-transcript" id="liveTranscript">${liveSegments()}</div>
      <div class="stage-actions">
        <button class="btn" data-action="rec-undo">${ic('undo')}Undo thought ${keycaps(sc.undo, 'inline')}</button>
        <button class="btn ghost" data-action="rec-cancel">${ic('x')}Discard</button>
        <button class="btn primary" data-action="rec-toggle">${ic('check')}Finish</button>
      </div>`
    : r.status === 'proc' ? `
      <div class="orb">${ic('spark')}</div>
      <div class="timer grad-text">Polishing…</div>
      <p class="muted small" style="margin-top:6px">Finding thoughts · cleaning transitions</p>`
    : `
      <button class="orb" data-action="rec-toggle" title="Start recording">${ic('mic')}</button>
      <div class="orb-label">Tap the orb or press ${keycaps(sc.toggle, 'inline')}</div>
      <p class="muted small" style="margin-top:28px;max-width:420px;text-align:center">
        The floating bar at the bottom of your screen records too, so you never have to leave the chat you're in.
      </p>`;

  return `
    <div class="compose-grid">
      <section class="stage glass">${stage}</section>
      <aside>
        ${S.settings.demoMode ? `
        <div class="teleprompter glass">
          <div class="panel-title"><span>Demo script</span><span class="tag accent">read aloud</span></div>
          <p class="small muted" style="margin-bottom:10px">Demo mode streams this transcript while you speak. Undo line 2 to show off semantic undo.</p>
          <div id="teleprompter">${teleprompter()}</div>
        </div>` : `
        <div class="teleprompter glass">
          <div class="panel-title">Live mode</div>
          <p class="small muted">No speech model is connected, so thoughts are split by your pauses. Undo still removes the last spoken thought from the real audio.</p>
        </div>`}
      </aside>
    </div>`;
}

function liveSegments() {
  const segs = S.rec.segments;
  if (!segs.length) return '<p class="muted small" style="text-align:center">Listening…</p>';
  const lastLive = segs.findLast(s => !s.complete && !s.undone);
  return segs.map(s => `
    <div class="live-seg ${s.undone ? 'undone' : ''} ${s === lastLive ? 'live' : ''}">
      <span class="n">${s.id.slice(1)}</span><span>${esc(s.text) || (s.complete ? `Thought · ${fmt(s.start)}–${fmt(s.end)}` : 'Speaking…')}</span>
    </div>`).join('');
}

function teleprompter() {
  const script = [
    'Hey Sam, quick update on the launch.',
    "So um, I'll meet you on Monday... wait, that's wrong.",
    "I'll meet you on Wednesday at five.",
    "Me and Priya has finished the deck, so we're basically like ready.",
    'Can you just send me the final numbers tonight?',
    'Thanks, talk soon.',
  ];
  const cues = { 1: '↶ press undo here', 3: 'grammar + filler', 4: 'try tone: confident' };
  const idx = S.rec.status === 'rec' ? script.indexOf(S.rec.next ?? '') : -1;
  const doneUpTo = S.rec.status === 'rec' ? (idx === -1 ? script.length : idx) : 0;
  return script.map((l, i) => `
    <div class="tp-line ${i === idx ? 'now' : ''} ${i < doneUpTo ? 'done' : ''}">
      ${cues[i] ? `<span class="cue">${cues[i]}</span>` : ''}${esc(l)}
    </div>`).join('');
}

function composeType() {
  const t = S.tts;
  const preview = t.text.trim() ? MockAI.toneRewrite(t.text.trim(), t.tone) : '';
  return `
    <div class="compose-grid">
      <section class="glass" style="padding:22px">
        <textarea class="tts" id="ttsText" placeholder="Type what you want to say… it will be spoken in your voice, with natural pacing and intonation.">${esc(t.text)}</textarea>
        <div class="row between wrap" style="margin-top:14px">
          <span class="small faint" id="ttsCount">${t.text.trim() ? t.text.trim().split(/\s+/).length : 0} words · ~${fmt((t.text.trim() ? t.text.trim().split(/\s+/).length : 0) * 0.38)}</span>
          <div class="row">
            <button class="btn" data-action="tts-preview" ${t.text.trim() ? '' : 'disabled'}>${ic('play')}Preview</button>
            <button class="btn grad" data-action="tts-generate" ${t.text.trim() && !t.busy ? '' : 'disabled'}>${ic('spark')}${t.busy ? 'Generating in your voice…' : 'Generate voice message'}</button>
          </div>
        </div>
      </section>
      <aside>
        <div class="panel glass">
          <div class="panel-title">Voice</div>
          <div class="sample" style="margin-bottom:6px">
            <div class="voice-avatar sm">${ic('bar')}</div>
            <div class="grow"><div style="font-weight:600">My voice</div><div class="small muted">Clone · 96% similarity</div></div>
            <span class="status-ok">Ready</span>
          </div>
        </div>
        <div class="panel glass">
          <div class="panel-title">Tone</div>
          <div class="tone-grid">${toneChips(t.tone, 'tts-tone')}</div>
          ${preview && t.tone !== 'original' ? `<div class="tone-preview"><b>${esc(preview)}</b></div>` : ''}
        </div>
      </aside>
    </div>`;
}

function toneChips(active, action) {
  return Object.entries(MockAI.TONES).map(([k, v]) =>
    `<button class="chip ${active === k ? 'active accent' : ''}" data-action="${action}" data-tone="${k}">${v.label}</button>`).join('');
}

AFTER.compose = () => {
  const ta = document.getElementById('ttsText');
  if (ta) {
    ta.addEventListener('input', () => {
      const had = !!S.tts.text.trim();
      S.tts.text = ta.value;
      if (had !== !!ta.value.trim() || S.tts.tone !== 'original') { const pos = ta.selectionStart; render(); const n = document.getElementById('ttsText'); n.focus(); n.setSelectionRange(pos, pos); }
      else { const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0; document.getElementById('ttsCount').textContent = `${w} words · ~${fmt(w * 0.38)}`; }
    });
  }
  drawRing();
};

function drawRing() {
  const c = document.getElementById('ring');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  const lv = S.rec.levels.length ? S.rec.levels : new Array(24).fill(0);
  const bars = 64;
  const r0 = W * 0.36;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  for (let i = 0; i < bars; i++) {
    const v = lv[Math.floor((i % (bars / 2)) / (bars / 2) * lv.length)] || 0;
    const len = 6 + v * 46;
    const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
}

function updateLive() {
  const ind = document.getElementById('recIndicator');
  ind.hidden = S.rec.status !== 'rec';
  document.getElementById('sideRecLabel').textContent = S.rec.status === 'rec' ? 'Finish recording' : 'Start recording';
  document.getElementById('recIndicatorTime').textContent = fmt(S.rec.elapsed);
  if (S.route !== 'compose' || S.composeTab !== 'speak') return;
  const t = document.getElementById('liveTimer');
  if (t) t.textContent = fmt(S.rec.elapsed);
  const lt = document.getElementById('liveTranscript');
  if (lt) {
    const html = liveSegments();
    if (lt.dataset.html !== html) { lt.innerHTML = html; lt.dataset.html = html; lt.scrollTop = lt.scrollHeight; }
  }
  const tp = document.getElementById('teleprompter');
  if (tp) { const html = teleprompter(); if (tp.dataset.html !== html) { tp.innerHTML = html; tp.dataset.html = html; } }
  drawRing();
}

// ---------- library ----------
PAGES.library = () => {
  const { q, filter } = S.library;
  const list = S.messages.filter(m =>
    (filter === 'all' || (filter === 'tts' ? m.type === 'tts' : m.type !== 'tts')) &&
    (!q || (m.title + ' ' + editedText(m)).toLowerCase().includes(q.toLowerCase())));
  return `
    <h1 class="h-page">Library</h1>
    <p class="sub">Every message keeps its original recording until you delete it.</p>
    <div class="row wrap" style="margin:22px 0 6px;gap:12px">
      <input type="search" id="libSearch" placeholder="Search messages…" value="${esc(q)}" style="width:280px" />
      <div class="segmented">
        ${[['all', 'All'], ['voice', 'Spoken'], ['tts', 'Typed']].map(([k, l]) => `<button class="${filter === k ? 'active' : ''}" data-action="lib-filter" data-filter="${k}">${l}</button>`).join('')}
      </div>
    </div>
    ${list.length ? feed(list, { withDelete: true }) : `
      <div class="empty glass" style="margin-top:16px">${svg('library').replace('<svg', '<svg class="big-icon"')}<div style="font-weight:600;color:var(--text)">${q ? 'No matches' : 'No messages yet'}</div><div class="small">${q ? 'Try another search.' : 'Record one with the shortcut or the New message page.'}</div></div>`}
  `;
};
AFTER.library = () => {
  const s = document.getElementById('libSearch');
  s?.addEventListener('input', () => {
    S.library.q = s.value;
    const pos = s.selectionStart;
    render();
    const n = document.getElementById('libSearch'); n.focus(); n.setSelectionRange(pos, pos);
  });
};

// ---------- editor ----------
async function openEditor(id) {
  const m = S.messages.find(x => x.id === id);
  if (!m) { S.route = 'library'; return render(); }
  S.ed = {
    msg: clone({ edits: [], sugg: {}, tone: null, ...m }),
    history: [], future: [], sel: null, focus: null,
    playMode: null, playItem: -1, playSeg: null, playTime: 0,
    busy: new Set(), toneDraft: m.tone?.name || 'original', loaded: false,
  };
  S.ed.msg.edits ||= [];
  S.ed.msg.sugg ||= {};
  render();
  const buf = m.hasAudio ? await api.invoke('messages:audio', id) : null;
  try { await player.load(buf ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : null); } catch (e) { console.warn(e); await player.load(null); }
  if (!S.ed || S.ed.msg.id !== id) return;
  S.ed.loaded = true;
  render();
}

function activeSuggestions(msg) {
  if (msg.tone) return [];
  // Drop suggestions that clash with edits already made. Filler is the exception:
  // it keeps whichever of its words are still untouched.
  return MockAI.suggest(msg)
    .filter(s => !msg.sugg[s.id])
    .map(s => ({ ...s, free: s.edits.filter(e => !msg.edits.some(x => overlaps(x, e))) }))
    .filter(s => s.free.length && (s.kind === 'filler' || s.free.length === s.edits.length))
    .map(({ free, ...s }) => ({ ...s, edits: free }));
}

PAGES.editor = () => {
  const ed = S.ed;
  if (!ed) return '';
  const m = ed.msg;
  const sugg = activeSuggestions(m);
  const hasAudio = !!player.buffer;
  const dur = hasAudio ? player.duration : msgDuration(m);
  const playing = ed.playMode;

  // pending suggestion highlights
  const pend = {};
  sugg.forEach(s => s.edits.forEach(e => { for (let i = e.start; i <= e.end; i++) pend[`${e.segId}:${i}`] = s; }));

  const segRows = m.segments.map((seg) => {
    const time = seg.start != null ? `<b>${seg.id.slice(1)}</b>${fmt(seg.start)}` : `<b>${seg.id.slice(1)}</b>`;
    if (seg.undone) {
      const text = seg.words.map(w => w.w).join(' ') || `Thought ${fmt(seg.start)}–${fmt(seg.end)}`;
      return `
        <div class="seg removed" data-seg="${seg.id}">
          <div class="seg-time">${time}</div>
          <div class="seg-body"><div class="removed-note"><span class="removed-badge">↶ Undone${m.type === 'voice' && seg.removedInEditor !== true ? ' while recording' : ''}</span><span class="strike">${esc(text)}</span></div></div>
          <div class="seg-tools" style="opacity:1"><button class="btn ghost sm" data-action="seg-restore" data-seg="${seg.id}">${ic('restore')}Restore</button></div>
        </div>`;
    }
    let body;
    if (m.tone?.texts?.[seg.id]) {
      body = `<span class="gen ${ed.busy.has('tone') ? 'busy' : ''}" title="Original: ${esc(seg.words.map(w => w.w).join(' '))}"><span class="gen-text">${esc(m.tone.texts[seg.id])}</span></span>`;
    } else if (!seg.words.length) {
      body = `<span class="muted">Spoken thought · ${fmt(seg.start)}–${fmt(seg.end)}</span> <span class="tag">no transcript in live mode</span>`;
    } else {
      body = tokens(seg, m.edits).map((t) => {
        if (t.type === 'w') {
          const p = pend[`${seg.id}:${t.i}`];
          const sel = ed.sel && !ed.sel.editId && ed.sel.segId === seg.id && t.i >= ed.sel.start && t.i <= ed.sel.end;
          return `<span class="w ${sel ? 'sel' : ''} ${p ? 'pending ' + p.kind : ''}" data-action="word" data-seg="${seg.id}" data-i="${t.i}" ${p ? `data-sugg="${p.id}" title="${esc(p.title)}"` : ''}>${esc(t.text)}</span>`;
        }
        const orig = seg.words.slice(t.from, t.to + 1).map(w => w.w).join(' ');
        if (t.type === 'del') return `<span class="del" data-action="token" data-seg="${seg.id}" data-edit="${t.edit.id}" title="Removed — click to revert">${esc(orig)}</span>`;
        return `<span class="gen ${ed.busy.has(t.edit.id) ? 'busy' : ''}" data-action="token" data-seg="${seg.id}" data-edit="${t.edit.id}" title="Generated in your voice · was “${esc(orig)}”"><span class="gen-text">${esc(t.text)}</span></span>`;
      }).join(' ');
    }
    const selBar = ed.sel && ed.sel.segId === seg.id ? selectionBar(seg) : '';
    return `
      <div class="seg ${ed.playSeg === seg.id ? 'playing' : ''}" data-seg="${seg.id}">
        <div class="seg-time">${time}</div>
        <div class="seg-body">${body}</div>
        <div class="seg-tools">
          <button class="btn ghost sm icon" data-action="seg-play" data-seg="${seg.id}" title="Play this thought">${ic('play')}</button>
          <button class="btn ghost sm icon" data-action="seg-remove" data-seg="${seg.id}" title="Remove this thought">${ic('undo')}</button>
        </div>
        ${selBar}
      </div>`;
  }).join('');

  // group alternatives
  let lastGroup = null;
  const suggHtml = sugg.map((s) => {
    const or = s.group && s.group === lastGroup ? '<div class="sugg-or">— OR —</div>' : '';
    lastGroup = s.group || null;
    const kindLabel = { filler: 'Filler words', grammar: 'Grammar', correction: 'Self-correction', replace: 'Speech replacement ✦' }[s.kind];
    return `${or}
      <div class="sugg ${ed.focus === s.id ? 'focus' : ''}" data-sugg-card="${s.id}">
        <div class="sugg-kind ${s.kind}">${kindLabel}</div>
        <div class="sugg-title">${esc(s.title)}</div>
        <div class="sugg-detail">${esc(s.detail)}</div>
        <div class="sugg-actions">
          <button class="btn sm ${s.edits.some(e => e.text) ? 'grad' : 'primary'}" data-action="sugg-accept" data-id="${s.id}">${ic('check')}${s.edits.some(e => e.text) ? 'Regenerate' : 'Apply'}</button>
          <button class="btn sm ghost" data-action="sugg-dismiss" data-id="${s.id}">Dismiss</button>
        </div>
      </div>`;
  }).join('');

  const toneSegs = m.segments.filter(s => !s.undone && s.words.length);
  const tonePreview = ed.toneDraft !== 'original'
    ? toneSegs.map(s => MockAI.toneRewrite(tokens(s, m.edits).filter(t => t.type !== 'del').map(t => t.text).join(' '), ed.toneDraft)).join(' ')
    : '';

  return `
    <div class="editor-head">
      <button class="btn icon" data-action="nav" data-route="library" title="Back">${ic('back')}</button>
      <div class="grow">
        <input class="title-input" id="titleInput" value="${esc(m.title)}" />
        <div class="small muted">${m.type === 'tts' ? 'Typed → spoken in your voice' : 'Voice message'} · ${dayOf(m.createdAt)}, ${timeOf(m.createdAt)} · ${fmt(dur)}
          ${undoneCount(m) ? ` · <span style="color:var(--red)">${undoneCount(m)} thought${undoneCount(m) > 1 ? 's' : ''} undone</span>` : ''}</div>
      </div>
      <button class="btn ghost sm icon" data-action="ed-undo" title="Undo edit (Ctrl+Z)" ${ed.history.length ? '' : 'disabled'}>${ic('undo')}</button>
      <button class="btn ghost sm icon" data-action="ed-redo" title="Redo (Ctrl+Y)" ${ed.future.length ? '' : 'disabled'}>${ic('redo')}</button>
    </div>

    <section class="timeline glass">
      <div class="ab">
        <button class="btn sm ${playing === 'original' ? 'playing' : ''}" data-action="play-original" ${hasAudio ? '' : 'disabled'}>${ic(playing === 'original' ? 'stop' : 'play')}Original</button>
        <button class="btn sm ${playing === 'edited' ? 'playing primary' : 'primary'}" data-action="play-edited" ${ed.loaded ? '' : 'disabled'}>${ic(playing === 'edited' ? 'stop' : 'play')}Edited version</button>
        <span class="play-time" id="playTime">${playing ? fmt(ed.playTime) + ' / ' : ''}${fmt(dur)}</span>
        <span class="grow"></span>
        <span class="small faint">${hasAudio ? 'Click the waveform to scrub the original' : m.type === 'tts' ? 'Fully generated message' : ''}</span>
      </div>
      <canvas id="wf"></canvas>
      <div class="timeline-legend">
        <span><span class="legend-sw" style="background:var(--text);opacity:.65"></span>Your recording</span>
        <span><span class="legend-sw" style="background:var(--red);opacity:.5"></span>Undone</span>
        <span><span class="legend-sw" style="background:var(--faint)"></span>Cut</span>
        <span><span class="legend-sw" style="background:var(--accent)"></span>Generated in your voice</span>
      </div>
    </section>

    <div class="editor-grid">
      <section class="transcript glass">
        ${segRows || '<div class="empty">Nothing was recorded.</div>'}
        <p class="small faint" style="padding:10px 12px 4px">Tip: click a word (shift-click to extend) to cut it or rewrite it in your voice. ${keycaps('Ctrl+Z', 'inline')} undoes edits.</p>
      </section>

      <aside>
        <div class="panel glass">
          <div class="panel-title"><span><span class="spark">✦</span>Suggestions</span>
            ${sugg.length > 1 ? `<button class="btn sm ghost" data-action="sugg-all">Apply all</button>` : ''}</div>
          ${m.tone ? `<p class="small muted">Tone “${MockAI.TONES[m.tone.name].label}” is applied, so the suggestions are already folded in.</p>`
            : suggHtml || `<p class="small muted">${m.segments.some(s => s.words.length) ? 'Looks clean. Nothing to fix.' : 'Suggestions need a transcript (enable demo mode in Settings).'}</p>`}
        </div>

        <div class="panel glass">
          <div class="panel-title"><span>Tone</span>${m.tone ? `<span class="tag accent">${MockAI.TONES[m.tone.name].label} applied</span>` : ''}</div>
          <div class="tone-grid">${toneChips(ed.toneDraft, 'tone-draft')}</div>
          ${tonePreview ? `<div class="tone-preview"><b>${esc(tonePreview)}</b></div>` : ''}
          <div class="row" style="margin-top:12px">
            ${ed.toneDraft !== 'original' && m.tone?.name !== ed.toneDraft ? `<button class="btn sm grad" data-action="tone-apply">${ic('wand')}Apply ${MockAI.TONES[ed.toneDraft].label.toLowerCase()} tone</button>` : ''}
            ${m.tone ? `<button class="btn sm ghost" data-action="tone-clear">Back to my words</button>` : ''}
          </div>
        </div>

        <div class="panel glass">
          <div class="panel-title"><span>Voice match</span><span class="status-ok">Your voice</span></div>
          <div class="kv"><span>Speaker similarity</span><b>96%</b></div><div class="meter"><div style="width:96%"></div></div>
          <div class="kv"><span>Prosody continuity</span><b>92%</b></div><div class="meter"><div style="width:92%"></div></div>
          <div class="kv"><span>Seam smoothness</span><b>${m.edits.length || m.tone ? '89%' : '—'}</b></div><div class="meter"><div style="width:${m.edits.length || m.tone ? 89 : 0}%"></div></div>
          <p class="small faint" style="margin-top:10px">Preview uses a system voice for generated parts until the voice-clone backend is connected.</p>
        </div>
      </aside>
    </div>

    <section class="send-bar glass">
      <span style="font-weight:700">${ed.sending ? 'Sending…' : m.sentTo ? `<span class="status-ok">✓ Sent to ${esc(m.sentTo)}</span>` : 'Send'}</span>
      <button class="btn sm app-btn" data-action="send" data-app="Discord" ${ed.sending || !ed.loaded ? 'disabled' : ''}><span class="app-dot" style="background:#5865F2">D</span>Discord</button>
      <button class="btn sm app-btn" data-action="send" data-app="WhatsApp" ${ed.sending || !ed.loaded ? 'disabled' : ''}><span class="app-dot" style="background:#25D366">W</span>WhatsApp</button>
      <button class="btn sm app-btn" data-action="send" data-app="Telegram" ${ed.sending || !ed.loaded ? 'disabled' : ''}><span class="app-dot" style="background:#2AABEE">T</span>Telegram</button>
      <span class="grow"></span>
      <button class="btn sm ghost" data-action="copy-text">${ic('copy')}Copy text</button>
      <button class="btn sm" data-action="export" ${ed.loaded && !ed.sending ? '' : 'disabled'}>${ic('download')}Save audio</button>
      <button class="btn sm ghost danger" data-action="delete-msg" data-id="${m.id}">${ic('trash')}</button>
    </section>
  `;
};

function selectionBar(seg) {
  const ed = S.ed;
  if (ed.sel.editId) {
    const e = ed.msg.edits.find(x => x.id === ed.sel.editId);
    if (!e) return '';
    const orig = seg.words.slice(e.start, e.end + 1).map(w => w.w).join(' ');
    return `
      <div class="sel-bar">
        <span class="small muted">Original: <b style="color:var(--text)">“${esc(orig)}”</b></span>
        <input type="text" id="replInput" value="${esc(e.text ?? orig)}" />
        <button class="btn sm grad" data-action="sel-generate">${ic('spark')}Regenerate</button>
        <button class="btn sm" data-action="sel-revert">${ic('restore')}Revert</button>
        <button class="btn sm ghost icon" data-action="sel-clear">${ic('x')}</button>
      </div>`;
  }
  const words = seg.words.slice(ed.sel.start, ed.sel.end + 1).map(w => w.w);
  return `
    <div class="sel-bar">
      <button class="btn sm" data-action="sel-delete">${ic('trash')}Cut</button>
      <input type="text" id="replInput" value="${esc(MockAI.guessReplacement(words))}" placeholder="Say this instead…" />
      <button class="btn sm grad" data-action="sel-generate">${ic('spark')}Say it in my voice</button>
      <button class="btn sm ghost icon" data-action="sel-clear">${ic('x')}</button>
    </div>`;
}

AFTER.editor = () => {
  drawWaveform();
  const t = document.getElementById('titleInput');
  t?.addEventListener('change', () => { mutate(() => { S.ed.msg.title = t.value.trim() || 'Voice message'; }, false); });
  const r = document.getElementById('replInput');
  if (r) { r.focus(); r.select(); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions['sel-generate'](); if (e.key === 'Escape') actions['sel-clear'](); }); }
  const wf = document.getElementById('wf');
  wf?.addEventListener('click', (e) => {
    if (!player.buffer) return;
    const rect = wf.getBoundingClientRect();
    playOriginal(((e.clientX - rect.left) / rect.width) * player.duration);
  });
};

function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function drawWaveform() {
  const c = document.getElementById('wf');
  if (!c || !S.ed) return;
  const m = S.ed.msg;
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = c.clientHeight;
  c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bw = 3, gap = 2, n = Math.floor(W / (bw + gap));
  const dur = player.buffer ? player.duration : msgDuration(m) || 1;
  let peaks = player.peaks(n);
  if (!peaks) { // generated message: synthetic envelope
    let seed = [...m.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    peaks = Array.from({ length: n }, (_, i) => { seed = (seed * 9301 + 49297) % 233280; return 0.25 + 0.6 * (seed / 233280) * (0.6 + 0.4 * Math.sin(i / 7)); });
  }
  const text = cssVar('--text'), red = cssVar('--red'), faint = cssVar('--faint');
  const grad = cssVar('--accent');

  // classify each time slice
  const ranges = [];
  m.segments.forEach((seg) => {
    if (seg.start == null) return;
    const end = seg.end ?? seg.start + 1;
    if (seg.undone) return ranges.push({ from: seg.start, to: end, kind: 'undone' });
    if (m.tone?.texts?.[seg.id]) return ranges.push({ from: seg.start, to: end, kind: 'gen' });
    tokens(seg, m.edits).forEach((t) => {
      if (t.type === 'w') return;
      const from = seg.words[t.from].t;
      const to = t.to + 1 < seg.words.length ? seg.words[t.to + 1].t : end;
      ranges.push({ from, to, kind: t.type === 'del' ? 'del' : 'gen' });
    });
  });
  const kindAt = (time) => (ranges.find(r => time >= r.from && time < r.to) || {}).kind;

  for (let i = 0; i < n; i++) {
    const time = (i / n) * dur;
    const k = player.buffer ? kindAt(time) : 'gen';
    const v = Math.max(0.04, peaks[i]);
    const h = v * (H - 8);
    ctx.globalAlpha = k === 'undone' ? 0.45 : k === 'del' ? 0.35 : k === 'gen' ? 1 : 0.62;
    ctx.fillStyle = k === 'undone' ? red : k === 'del' ? faint : k === 'gen' ? grad : text;
    ctx.beginPath();
    ctx.roundRect(i * (bw + gap), (H - h) / 2, bw, h, 1.5);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (S.ed.playMode === 'original' && player.buffer) {
    const x = (S.ed.playTime / dur) * W;
    ctx.fillStyle = cssVar('--accent');
    ctx.fillRect(x - 1, 0, 2, H);
  }
}

// ---------- editor mutations ----------
function snapshot() {
  const m = S.ed.msg;
  return JSON.stringify({ segments: m.segments, edits: m.edits, tone: m.tone, sugg: m.sugg, title: m.title });
}
function mutate(fn, record = true) {
  if (record) { S.ed.history.push(snapshot()); S.ed.future = []; if (S.ed.history.length > 100) S.ed.history.shift(); }
  fn();
  persist();
  render();
}
let saveTimer = 0;
function persist() {
  const m = clone(S.ed.msg);
  const idx = S.messages.findIndex(x => x.id === m.id);
  if (idx >= 0) S.messages[idx] = m;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.invoke('messages:save', m), 250);
}
function restoreSnap(snap) { Object.assign(S.ed.msg, JSON.parse(snap)); persist(); render(); }
let editSeq = 0;
function addEdits(edits, kind) {
  const m = S.ed.msg;
  const added = edits.map(e => ({ ...e, kind, id: `e${Date.now().toString(36)}${editSeq++}` }));
  m.edits = m.edits.filter(x => !added.some(a => overlaps(a, x))).concat(added);
  if (m.tone) { m.tone = null; S.ed.toneDraft = 'original'; toast('Tone reset. Re-apply it after editing'); }
  const gen = added.filter(a => a.text != null);
  if (gen.length) shimmer(gen.map(g => g.id));
  return added;
}
function shimmer(ids) {
  ids.forEach(id => S.ed.busy.add(id));
  setTimeout(() => { if (!S.ed) return; ids.forEach(id => S.ed.busy.delete(id)); render(); }, 1100);
}

// ---------- playback ----------
function buildPlaylist(msg, hasAudio = !!player.buffer) {
  const items = [];
  msg.segments.filter(s => !s.undone).forEach((seg) => {
    const toneText = msg.tone?.texts?.[seg.id];
    if (toneText) items.push({ type: 'tts', text: toneText, segId: seg.id });
    else if (!seg.words.length) { if (hasAudio) items.push({ type: 'audio', from: seg.start, to: seg.end, segId: seg.id }); }
    else if (!hasAudio) items.push({ type: 'tts', text: segEditedText(msg, seg), segId: seg.id });
    else {
      tokens(seg, msg.edits).forEach((t) => {
        if (t.type === 'del') return;
        if (t.type === 'gen') return items.push({ type: 'tts', text: t.text, segId: seg.id });
        const from = Math.max(0, seg.words[t.i].t - 0.06);
        const to = t.i + 1 < seg.words.length ? seg.words[t.i + 1].t : (seg.end ?? seg.words[t.i].t + 0.4);
        const last = items[items.length - 1];
        if (last && last.type === 'audio' && last.segId === seg.id && Math.abs(last.to - from) < 0.15) last.to = to;
        else items.push({ type: 'audio', from, to, segId: seg.id });
      });
    }
    items.push({ type: 'gap', ms: 160, segId: seg.id });
  });
  return items;
}

function setPlaying(mode) {
  S.ed.playMode = mode;
  if (!mode) { S.ed.playSeg = null; }
  render();
}
function highlightSeg(segId) {
  if (!S.ed || S.ed.playSeg === segId) return;
  S.ed.playSeg = segId;
  document.querySelectorAll('.seg').forEach(el => el.classList.toggle('playing', el.dataset.seg === segId));
}
function playOriginal(from = 0) {
  if (!player.buffer) return;
  setPlaying('original');
  player.play([{ type: 'audio', from, to: player.duration }], {
    onTime: (t) => {
      if (!S.ed) return;
      S.ed.playTime = t;
      const seg = S.ed.msg.segments.find(s => s.start != null && t >= s.start && t < (s.end ?? Infinity));
      highlightSeg(seg?.id ?? null);
      const pt = document.getElementById('playTime');
      if (pt) pt.textContent = `${fmt(t)} / ${fmt(player.duration)}`;
      drawWaveform();
    },
    onEnd: () => S.ed && setPlaying(null),
  });
}
function playEdited(onlySeg) {
  const msg = S.ed.msg;
  let items = buildPlaylist(msg);
  if (onlySeg) items = items.filter(i => i.segId === onlySeg);
  if (!items.length) return toast('Nothing to play');
  setPlaying('edited');
  let t0 = performance.now();
  player.play(items, {
    voiceName: S.settings.ttsVoice,
    onItem: (_i, it) => highlightSeg(it.segId),
    onTime: () => {
      const pt = document.getElementById('playTime');
      if (pt && S.ed) { S.ed.playTime = (performance.now() - t0) / 1000; pt.textContent = `${fmt(S.ed.playTime)} / ${fmt(player.duration || msgDuration(msg))}`; }
    },
    onEnd: () => S.ed && setPlaying(null),
  });
}

// ---------- voice ----------
PAGES.voice = () => {
  const v = S.voice;
  const done = v.done.filter(Boolean).length;
  return `
    <h1 class="h-page">My voice</h1>
    <p class="sub">Ctrl+Voice regenerates edited words in your own voice, so fixes blend into what you actually said.</p>

    <section class="voice-hero glass">
      <div class="voice-avatar"><canvas id="voiceAvatar" width="160" height="100"></canvas></div>
      <div class="grow">
        <div class="row"><span style="font-size:20px;font-weight:600">Your voice clone</span><span class="status-ok">● Ready</span></div>
        <p class="muted small" style="margin:4px 0 12px">Trained on 4 min 12 s of your speech · improves every time you send a message</p>
        <div class="row wrap" style="gap:24px">
          <div><div class="big-num">96%</div><div class="big-label">Speaker similarity</div></div>
          <div><div class="big-num">91%</div><div class="big-label">Prosody match</div></div>
          <div><div class="big-num">4.4</div><div class="big-label">Naturalness (MOS)</div></div>
        </div>
      </div>
      <div class="row" style="flex-direction:column;align-items:stretch">
        <button class="btn primary" data-action="voice-sample">${ic('play')}Hear my clone</button>
        <button class="btn" data-action="voice-retrain">${ic('restore')}Re-train</button>
      </div>
    </section>

    <div class="two-col" style="margin-top:16px">
      <section class="panel glass">
        <div class="panel-title"><span>Improve your clone</span><span class="tag accent">${done}/${v.samples.length}</span></div>
        <div class="meter" style="margin-bottom:14px"><div style="width:${(done / v.samples.length) * 100}%"></div></div>
        <div class="list">
          ${v.samples.map((s, i) => `
            <div class="sample ${v.done[i] ? 'done' : ''}">
              <span class="check">${v.done[i] ? '✓' : i + 1}</span>
              <span class="grow small">${esc(s)}</span>
              <button class="btn sm ${v.busy === i ? 'grad' : 'ghost'}" data-action="voice-record" data-i="${i}">${v.busy === i ? 'Listening…' : v.done[i] ? 'Redo' : ic('mic') + 'Record'}</button>
            </div>`).join('')}
        </div>
      </section>

      <div>
        <section class="panel glass">
          <div class="panel-title">Delivery style</div>
          ${[['expressive', 'Expressiveness'], ['pace', 'Match my pace'], ['breath', 'Breaths & pauses'], ['warmth', 'Warmth']].map(([k, l]) => `
            <div class="kv"><span>${l}</span><b id="sv-${k}">${v.style[k]}%</b></div>
            <input type="range" min="0" max="100" value="${v.style[k]}" data-style="${k}" />`).join('')}
        </section>
        <section class="panel glass">
          <div class="panel-title"><span>${ic('shield').replace('<i>', '<i style="width:16px;height:16px;display:inline-flex;margin-right:6px;vertical-align:-3px">')}Consent &amp; safety</span></div>
          <div class="setting" style="padding:10px 0"><div class="setting-text"><div class="setting-title small">Watermark generated audio</div><div class="setting-desc">Inaudible marker on every regenerated word</div></div><button class="switch ${v.watermark ? 'on' : ''}" data-action="voice-toggle" data-key="watermark"></button></div>
          <div class="setting" style="padding:10px 0"><div class="setting-text"><div class="setting-title small">Only edit my own recordings</div><div class="setting-desc">Your clone can't be used for other people's messages</div></div><button class="switch ${v.ownOnly ? 'on' : ''}" data-action="voice-toggle" data-key="ownOnly"></button></div>
        </section>
      </div>
    </div>
  `;
};
let avatarRaf = 0;
AFTER.voice = () => {
  document.querySelectorAll('[data-style]').forEach((r) => r.addEventListener('input', () => {
    S.voice.style[r.dataset.style] = +r.value;
    document.getElementById(`sv-${r.dataset.style}`).textContent = `${r.value}%`;
  }));
  cancelAnimationFrame(avatarRaf);
  const c = document.getElementById('voiceAvatar');
  if (!c) return;
  const ctx = c.getContext('2d');
  const draw = (t) => {
    if (!document.body.contains(c)) return;
    ctx.clearRect(0, 0, 160, 100);
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    for (let i = 0; i < 9; i++) {
      const h = 18 + Math.abs(Math.sin(t / 380 + i * 0.8)) * 60 * (1 - Math.abs(i - 4) / 6);
      ctx.beginPath(); ctx.roundRect(14 + i * 15, 50 - h / 2, 8, h, 4); ctx.fill();
    }
    avatarRaf = requestAnimationFrame(draw);
  };
  avatarRaf = requestAnimationFrame(draw);
};

// ---------- shortcuts ----------
const SHORTCUT_INFO = [
  ['toggle', 'Start / finish & send', 'Works in any app, even when Ctrl+Voice is in the tray. Finishing sends the message to the chat you recorded in.', true],
  ['undo', 'Semantic undo', 'Removes the last spoken thought. Only active while recording, so normal Ctrl+Z keeps working elsewhere.', false],
  ['review', 'Finish & review', 'Stops recording and opens the editor instead of sending. Only active while recording.', false],
  ['cancel', 'Discard recording', 'Throws the whole message away. Only active while recording.', false],
  ['open', 'Open Ctrl+Voice', 'Brings this window to the front.', true],
];
PAGES.shortcuts = () => {
  const sc = S.settings.shortcuts;
  return `
    <h1 class="h-page">Shortcuts</h1>
    <p class="sub">Click a shortcut to change it, then press the new key combination.</p>
    <section class="settings-group glass">
      ${SHORTCUT_INFO.map(([k, title, desc, global]) => {
        const st = S.shortcutStatus[k];
        const status = st === false ? '<span class="status-bad">In use by another app</span>' : global ? '<span class="status-ok">Active</span>' : '<span class="faint small">While recording</span>';
        return `
        <div class="setting">
          <div class="setting-text"><div class="setting-title">${title}</div><div class="setting-desc">${desc}</div></div>
          ${status}
          <button class="shortcut-btn ${S.capturing === k ? 'capturing' : ''}" data-action="capture" data-key="${k}">
            ${S.capturing === k ? 'Press keys… (Esc to cancel)' : keycaps(sc[k])}
          </button>
        </div>`;
      }).join('')}
    </section>
    <h2 class="h-sec">In the editor</h2>
    <section class="settings-group glass">
      ${[['Ctrl+Z', 'Undo last edit'], ['Ctrl+Y', 'Redo'], ['Space', 'Play / stop the edited version'], ['O', 'Play / stop the original'], ['Shift+Click', 'Extend word selection']].map(([k, l]) => `
        <div class="setting"><div class="setting-text"><div class="setting-title">${l}</div></div>${keycaps(k)}</div>`).join('')}
    </section>
    <div class="row" style="margin-top:16px"><button class="btn ghost sm" data-action="reset-shortcuts">Reset to defaults</button></div>
  `;
};

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
  if (!key) return null; // modifier only
  return [...parts, key].join('+');
}

// ---------- settings ----------
PAGES.settings = () => {
  const s = S.settings;
  const sw = (k) => `<button class="switch ${s[k] ? 'on' : ''}" data-action="toggle-setting" data-key="${k}"></button>`;
  return `
    <h1 class="h-page">Settings</h1>
    <h2 class="h-sec">General</h2>
    <section class="settings-group glass">
      <div class="setting"><div class="setting-text"><div class="setting-title">Launch at startup</div><div class="setting-desc">Start Ctrl+Voice when you sign in to Windows</div></div>${sw('launchAtStartup')}</div>
      <div class="setting"><div class="setting-text"><div class="setting-title">Start in the background</div><div class="setting-desc">Open straight to the tray, without showing this window</div></div>${sw('startHidden')}</div>
      <div class="setting"><div class="setting-text"><div class="setting-title">Show floating bar when idle</div><div class="setting-desc">A small glass handle at the bottom of the screen. Hover it to record.</div></div>${sw('showIdleBar')}</div>
    </section>

    <h2 class="h-sec">Sending</h2>
    <section class="settings-group glass">
      <div class="setting"><div class="setting-text"><div class="setting-title">When you finish recording</div><div class="setting-desc">Sending pastes the audio into the message box of the app you recorded in: Discord, WhatsApp, Telegram, Slack or a browser. Anywhere else, the editor opens.</div></div>
        <div class="segmented">
          <button class="${s.finishAction === 'send' ? 'active' : ''}" data-action="finish-action" data-value="send">Send to the chat</button>
          <button class="${s.finishAction === 'review' ? 'active' : ''}" data-action="finish-action" data-value="review">Open the editor</button>
        </div></div>
      <div class="setting"><div class="setting-text"><div class="setting-title">Press Enter for me</div><div class="setting-desc">Send right away. Turn off to check the attachment in Discord first.</div></div>${sw('autoSend')}</div>
      <div class="setting"><div class="setting-text"><div class="setting-title">Cut filler words when sending</div><div class="setting-desc">Removes “um”, “uh”, “like”… from the audio on the quick path. Grammar and tone fixes need the editor.</div></div>${sw('cutFillers')}</div>
    </section>

    <h2 class="h-sec">Recording</h2>
    <section class="settings-group glass">
      <div class="setting"><div class="setting-text"><div class="setting-title">Microphone</div></div>
        <select data-setting="micId" style="width:280px">
          <option value="default">System default</option>
          ${S.mics.map(d => `<option value="${esc(d.deviceId)}" ${s.micId === d.deviceId ? 'selected' : ''}>${esc(d.label || 'Microphone')}</option>`).join('')}
        </select></div>
      <div class="setting"><div class="setting-text"><div class="setting-title">Demo transcript</div><div class="setting-desc">No speech model is connected yet. When this is on, a scripted transcript streams while you talk. When it's off, thoughts are split by your pauses.</div></div>${sw('demoMode')}</div>
    </section>

    <h2 class="h-sec">Personal</h2>
    <section class="settings-group glass">
      <div class="setting"><div class="setting-text"><div class="setting-title">Your name</div><div class="setting-desc">Used for the greeting on Home</div></div>
        <input type="text" data-setting="userName" value="${esc(s.userName || '')}" placeholder="Optional" style="width:220px" /></div>
      <div class="setting"><div class="setting-text"><div class="setting-title">Preview voice</div><div class="setting-desc">System voice used to preview generated words until the clone backend is connected</div></div>
        <select data-setting="ttsVoice" style="width:280px">
          ${S.voices.map(v => `<option value="${esc(v.name)}" ${s.ttsVoice === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('') || '<option>Default</option>'}
        </select></div>
    </section>

    <h2 class="h-sec">About</h2>
    <section class="settings-group glass">
      <div class="setting"><div class="setting-text"><div class="setting-title">Ctrl+Voice 0.1.0 · frontend prototype</div><div class="setting-desc">Voice messages you can edit like text, in your own voice.</div></div>
        <button class="btn danger sm" data-action="quit">Quit Ctrl+Voice</button></div>
    </section>
  `;
};
AFTER.settings = () => {
  document.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener('change', () => setSetting({ [el.dataset.setting]: el.value })));
};

async function setSetting(patch) {
  const r = await api.invoke('settings:set', patch);
  applySettingsPayload(r);
}
function applySettingsPayload({ settings, shortcutStatus, defaults }) {
  S.settings = settings;
  S.shortcutStatus = shortcutStatus || {};
  if (defaults) S.defaults = defaults;
}

// ---------- actions ----------
const actions = {
  'win-min': () => api.send('win:minimize'),
  'win-max': () => api.send('win:maximize'),
  'win-close': () => api.send('win:close'),
  'toggle-sidebar': () => {
    const on = document.body.classList.toggle('collapsed');
    try { localStorage.setItem('sidebarCollapsed', on ? '1' : ''); } catch {}
  },
  quit: () => api.send('app:quit'),
  nav: (el) => go(el.dataset.route),
  go: (el) => go(el.dataset.to),
  open: (el) => go(`editor:${el.dataset.id}`),

  'rec-toggle': () => api.send('rec:toggle'),
  'rec-undo': () => api.send('rec:undo'),
  'rec-cancel': () => api.send('rec:cancel'),

  'compose-tab': (el) => { S.composeTab = el.dataset.tab; render(); },
  'tts-tone': (el) => { S.tts.tone = el.dataset.tone; render(); },
  'tts-preview': () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(MockAI.toneRewrite(S.tts.text.trim(), S.tts.tone));
    u.voice = speechSynthesis.getVoices().find(v => v.name === S.settings.ttsVoice) || null;
    speechSynthesis.speak(u);
  },
  'tts-generate': () => {
    const text = MockAI.toneRewrite(S.tts.text.trim(), S.tts.tone);
    if (!text) return;
    S.tts.busy = true; render();
    setTimeout(async () => {
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      const meta = {
        id: `m${Date.now().toString(36)}`,
        type: 'tts',
        title: text.split(/\s+/).slice(0, 6).join(' ').replace(/[.,!?]+$/, '') + (text.split(/\s+/).length > 6 ? '…' : ''),
        createdAt: Date.now(),
        duration: 0,
        segments: sentences.map((s, i) => ({ id: `s${i + 1}`, start: null, end: null, undone: false, complete: true, words: s.split(/\s+/).map(w => ({ w })) })),
        edits: [], sugg: {}, tone: null, undoCount: 0,
      };
      await api.invoke('messages:create', meta);
      S.tts = { text: '', tone: 'original', busy: false };
      go(`editor:${meta.id}`);
      toast('Generated in your voice');
    }, 1300);
  },

  'lib-filter': (el) => { S.library.filter = el.dataset.filter; render(); },
  'delete-msg': async (el, e) => {
    e.stopPropagation();
    if (!confirm('Delete this message and its original recording?')) return;
    await api.invoke('messages:delete', el.dataset.id);
    S.messages = S.messages.filter(m => m.id !== el.dataset.id);
    if (S.route.startsWith('editor')) go('library'); else render();
    toast('Message deleted', 'trash');
  },

  // editor
  word: (el, e) => {
    const segId = el.dataset.seg, i = +el.dataset.i;
    const sel = S.ed.sel;
    if (el.dataset.sugg && !e.shiftKey) { S.ed.focus = el.dataset.sugg; }
    if (e.shiftKey && sel && !sel.editId && sel.segId === segId) {
      S.ed.sel = { segId, start: Math.min(sel.start, i), end: Math.max(sel.end, i) };
    } else if (sel && !sel.editId && sel.segId === segId && sel.start === i && sel.end === i) {
      S.ed.sel = null;
    } else {
      S.ed.sel = { segId, start: i, end: i };
    }
    render();
  },
  token: (el) => { S.ed.sel = { segId: el.dataset.seg, editId: el.dataset.edit }; render(); },
  'sel-clear': () => { S.ed.sel = null; render(); },
  'sel-delete': () => {
    const { segId, start, end } = S.ed.sel;
    mutate(() => { addEdits([{ segId, start, end, text: null }], 'manual'); S.ed.sel = null; });
  },
  'sel-generate': () => {
    const val = document.getElementById('replInput')?.value.trim();
    const sel = S.ed.sel;
    if (!sel || !val) return;
    mutate(() => {
      if (sel.editId) {
        const e = S.ed.msg.edits.find(x => x.id === sel.editId);
        if (e) { e.text = val; shimmer([e.id]); }
      } else {
        addEdits([{ segId: sel.segId, start: sel.start, end: sel.end, text: val }], 'manual');
      }
      S.ed.sel = null;
    });
    toast('Regenerated in your voice');
  },
  'sel-revert': () => {
    const id = S.ed.sel.editId;
    mutate(() => { S.ed.msg.edits = S.ed.msg.edits.filter(e => e.id !== id); S.ed.sel = null; });
  },
  'seg-remove': (el) => mutate(() => {
    const seg = S.ed.msg.segments.find(s => s.id === el.dataset.seg);
    seg.undone = true; seg.removedInEditor = true;
  }),
  'seg-restore': (el) => mutate(() => {
    const seg = S.ed.msg.segments.find(s => s.id === el.dataset.seg);
    seg.undone = false; delete seg.removedInEditor;
    if (S.ed.msg.tone) S.ed.msg.tone.texts[seg.id] = MockAI.toneRewrite(segEditedText({ ...S.ed.msg, tone: null }, seg), S.ed.msg.tone.name);
  }),
  'seg-play': (el) => playEdited(el.dataset.seg),
  'sugg-accept': (el) => {
    const s = activeSuggestions(S.ed.msg).find(x => x.id === el.dataset.id);
    if (!s) return;
    mutate(() => {
      addEdits(s.edits, s.kind);
      S.ed.msg.sugg[s.id] = 'accepted';
      if (s.group) MockAI.suggest(S.ed.msg).filter(o => o.group === s.group && o.id !== s.id).forEach(o => { S.ed.msg.sugg[o.id] = 'dismissed'; });
      S.ed.focus = null;
    });
    if (s.edits.some(e => e.text)) toast('Regenerated in your voice');
  },
  'sugg-dismiss': (el) => mutate(() => { S.ed.msg.sugg[el.dataset.id] = 'dismissed'; }),
  'sugg-all': () => mutate(() => {
    const seenGroups = new Set();
    activeSuggestions(S.ed.msg).forEach((s) => {
      if (s.group) { if (seenGroups.has(s.group)) { S.ed.msg.sugg[s.id] = 'dismissed'; return; } seenGroups.add(s.group); }
      addEdits(s.edits.filter(e => !S.ed.msg.edits.some(x => overlaps(x, e))), s.kind);
      S.ed.msg.sugg[s.id] = 'accepted';
    });
  }),
  'tone-draft': (el) => { S.ed.toneDraft = el.dataset.tone; render(); },
  'tone-apply': () => mutate(() => {
    const m = S.ed.msg;
    const name = S.ed.toneDraft;
    const texts = {};
    m.segments.filter(s => !s.undone && s.words.length).forEach((s) => {
      texts[s.id] = MockAI.toneRewrite(tokens(s, m.edits).filter(t => t.type !== 'del').map(t => t.text).join(' '), name);
    });
    m.tone = { name, texts };
    shimmer(['tone']);
    toast(`${MockAI.TONES[name].label} tone, regenerated in your voice`);
  }),
  'tone-clear': () => mutate(() => { S.ed.msg.tone = null; S.ed.toneDraft = 'original'; }),
  'ed-undo': () => { if (S.ed?.history.length) { S.ed.future.push(snapshot()); restoreSnap(S.ed.history.pop()); } },
  'ed-redo': () => { if (S.ed?.future.length) { S.ed.history.push(snapshot()); restoreSnap(S.ed.future.pop()); } },
  'play-original': () => { if (S.ed.playMode === 'original') { player.stop(); setPlaying(null); } else playOriginal(0); },
  'play-edited': () => { if (S.ed.playMode === 'edited') { player.stop(); setPlaying(null); } else playEdited(); },
  send: async (el) => {
    const appName = el.dataset.app;
    const ed = S.ed;
    ed.sending = true; render();
    try {
      const r = await renderEdited(ed.msg);
      const res = await api.invoke('send:to-app', { app: appName, wav: r.wav, name: ed.msg.title, id: ed.msg.id });
      toast(res.message, res.ok ? 'check' : 'copy');
    } catch (err) {
      toast(`Couldn't send: ${esc(err.message)}`, 'x');
    } finally {
      if (S.ed === ed) { ed.sending = false; render(); }
    }
  },
  'copy-text': () => { navigator.clipboard.writeText(editedText(S.ed.msg)); toast('Transcript copied', 'copy'); },
  export: async () => {
    const r = await renderEdited(S.ed.msg);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([r.wav], { type: 'audio/wav' }));
    a.download = `${S.ed.msg.title.replace(/[^\w\s-]/g, '').trim() || 'voice-message'}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
  'finish-action': (el) => setSetting({ finishAction: el.dataset.value }).then(render),

  // voice
  'voice-sample': () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Hey! This is my Ctrl+Voice voice. Edited words will sound just like this.");
    u.voice = speechSynthesis.getVoices().find(v => v.name === S.settings.ttsVoice) || null;
    speechSynthesis.speak(u);
    toast('Playing with the preview voice. Clone audio needs the backend');
  },
  'voice-retrain': () => toast('Re-training queued. Runs on the backend'),
  'voice-record': (el) => {
    const i = +el.dataset.i;
    S.voice.busy = i; render();
    setTimeout(() => { S.voice.done[i] = true; S.voice.busy = -1; if (S.route === 'voice') render(); }, 2200);
  },
  'voice-toggle': (el) => { S.voice[el.dataset.key] = !S.voice[el.dataset.key]; render(); },

  // settings
  'toggle-setting': (el) => setSetting({ [el.dataset.key]: !S.settings[el.dataset.key] }).then(render),
  capture: async (el) => {
    if (S.capturing) return;
    S.capturing = el.dataset.key;
    await api.invoke('shortcuts:suspend', true);
    render();
  },
  'reset-shortcuts': () => setSetting({ shortcuts: { ...S.defaults.shortcuts } }).then(render),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});

document.addEventListener('keydown', async (e) => {
  // shortcut capture
  if (S.capturing) {
    e.preventDefault();
    const key = S.capturing;
    const accel = accelFromEvent(e);
    const bare = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    if (e.key === 'Escape' && bare && key !== 'cancel') { // Esc aborts, unless Esc is what you're binding
      S.capturing = null; await api.invoke('shortcuts:suspend', false); render(); return;
    }
    if (!accel) return; // waiting for a non-modifier key
    S.capturing = null;
    await setSetting({ shortcuts: { [key]: accel } });
    await api.invoke('shortcuts:suspend', false);
    const r = await api.invoke('settings:get');
    applySettingsPayload(r);
    render();
    return;
  }
  // editor shortcuts
  if (!S.route.startsWith('editor') || !S.ed) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 'z' && !e.shiftKey) { e.preventDefault(); actions['ed-undo'](); }
  else if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); actions['ed-redo'](); }
  else if (k === ' ') { e.preventDefault(); actions['play-edited'](); }
  else if (k === 'o') actions['play-original']();
  else if (k === 'escape' && S.ed.sel) actions['sel-clear']();
});

// ---------- rendering for send / export ----------
async function renderEdited(msg) {
  const bytes = msg.hasAudio ? await api.invoke('messages:audio', msg.id) : null;
  return Exporter.renderMessage(msg, bytes);
}

// Main asks for a render when a recording is sent straight to a chat.
api.on('export:render', async ({ reqId, id, cutFillers }) => {
  try {
    const list = await api.invoke('messages:list');
    const m = { edits: [], sugg: {}, tone: null, ...list.find(x => x.id === id) };
    if (!m.segments) throw new Error('Message not found');
    if (cutFillers) {
      const f = MockAI.suggest(m).find(x => x.kind === 'filler');
      if (f) {
        m.edits = m.edits.concat(f.edits.map((e, i) => ({ ...e, kind: 'filler', id: `auto${Date.now().toString(36)}${i}` })));
        m.sugg[f.id] = 'accepted';
      }
    }
    const r = await renderEdited(m);
    await api.invoke('messages:save', m);
    S.messages = [m, ...S.messages.filter(x => x.id !== m.id)].sort((a, b) => b.createdAt - a.createdAt);
    api.send('export:rendered', { reqId, wav: r.wav, duration: r.duration });
  } catch (err) {
    api.send('export:rendered', { reqId, error: String(err?.message || err) });
  }
});

// ---------- events from main ----------
api.on('rec:state', (st) => {
  const prev = S.rec.status;
  S.rec = st;
  if (prev !== st.status && (S.route === 'compose' || S.route === 'home')) render();
  updateLive();
});
api.on('message:new', (m) => {
  S.messages = [m, ...S.messages.filter(x => x.id !== m.id)];
  if (S.route === 'home' || S.route === 'library') render();
});
api.on('nav:go', (route) => go(route));
api.on('settings:changed', (p) => { applySettingsPayload(p); if (['settings', 'shortcuts', 'home', 'compose'].includes(S.route)) render(); });
api.on('win:state', ({ maximized }) => { document.getElementById('maxBtn').innerHTML = maximized ? '&#xE923;' : '&#xE922;'; });
window.addEventListener('resize', () => { if (S.route.startsWith('editor')) drawWaveform(); });

// ---------- boot ----------
(async function boot() {
  try { if (localStorage.getItem('sidebarCollapsed')) document.body.classList.add('collapsed'); } catch {}
  hydrateIcons();
  applySettingsPayload(await api.invoke('settings:get'));
  S.messages = await api.invoke('messages:list');
  const loadVoices = () => { S.voices = speechSynthesis.getVoices(); };
  loadVoices();
  speechSynthesis.onvoiceschanged = () => { loadVoices(); if (S.route === 'settings') render(); };
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    S.mics = devices.filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
  } catch {}
  render();
})();
