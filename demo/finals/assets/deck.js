/* Ctrl+Voice finals deck: navigation, build steps, audio clips with live transcripts, speaker notes.
   Works from file:// (all data comes from media/data.js). Slides add behaviour through window.HOOKS[id]. */
(function () {
  const W = 1920, H = 1080;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const stage = $('#stage');
  const slides = $$('.slide');
  const HOOKS = window.HOOKS || {};
  let cur = 0, step = 0, started = false;
  const t0 = { talk: performance.now() };

  function fit() { stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`; }
  addEventListener('resize', fit); fit();

  // ------------------------------------------------------------------ skipped slides (X), kept per browser
  const SKIP_KEY = 'cv-finals-skip';
  let skip = new Set();
  try { skip = new Set(JSON.parse(localStorage.getItem(SKIP_KEY) || '[]')); } catch (e) { /* storage blocked */ }
  function saveSkip() { try { localStorage.setItem(SKIP_KEY, JSON.stringify([...skip])); } catch (e) { /* ignore */ } }
  slides.forEach((s) => { const b = document.createElement('div'); b.className = 'skipped-badge'; b.textContent = 'Skipped in the talk (X to include)'; s.appendChild(b); });
  function paintSkip() { slides.forEach((s) => s.classList.toggle('skip', skip.has(s.dataset.id))); }
  paintSkip();
  const passable = (i) => !skip.has(slides[i].dataset.id) && !('backup' in slides[i].dataset);

  // ------------------------------------------------------------------ audio clips with transcripts and waveforms
  const Audio1 = { el: null, key: null, to: null, subs: [], raf: 0 };
  function clip(key) { return window.DATA.clips[key]; }
  function play(key, from = 0, to = null, delay = 0) {
    stopAudio();
    const c = clip(key);
    if (!c) return toast(`No clip: ${key}`);
    const a = new Audio(c.src);
    Audio1.el = a; Audio1.key = key; Audio1.to = to;
    a.currentTime = from;
    const go = () => a.play().catch(() => toast('Audio blocked: click the slide once'));
    Audio1.timer = setTimeout(go, delay * 1000);
    cancelAnimationFrame(Audio1.raf);
    const tick = () => {
      if (Audio1.el !== a) return;
      const t = a.currentTime;
      if (Audio1.to != null && t >= Audio1.to) a.pause();
      Audio1.subs.forEach((f) => f(key, t, a));
      Audio1.raf = requestAnimationFrame(tick);
    };
    Audio1.raf = requestAnimationFrame(tick);
    return a;
  }
  function stopAudio() {
    clearTimeout(Audio1.timer);
    if (Audio1.el) { Audio1.el.pause(); Audio1.el = null; }
    cancelAnimationFrame(Audio1.raf);
  }
  function onAudio(f) { Audio1.subs.push(f); }

  /** A voice-note bubble (play button, waveform, duration) bound to a clip. */
  function vnote(host, key, opts = {}) {
    const c = clip(key);
    host.innerHTML = `<div class="play"><svg width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L20 13 L2 24 Z" fill="#000"/></svg></div><div class="bars"></div><div class="dur"></div>`;
    const bars = $('.bars', host), n = opts.bars || 70;
    const peaks = c.peaks, seg = (opts.to ?? c.dur) - (opts.from ?? 0);
    for (let i = 0; i < n; i++) {
      const t = (opts.from ?? 0) + (i + 0.5) / n * seg, k = Math.min(peaks.length - 1, Math.floor(t / c.dur * peaks.length));
      const b = document.createElement('i'); b.style.height = `${8 + 92 * peaks[k]}%`; bars.appendChild(b);
    }
    const dur = $('.dur', host), fmt = (s) => `0:${String(Math.round(s)).padStart(2, '0')}`;
    dur.textContent = fmt(seg);
    const all = $$('i', bars);
    function set(t) {
      const f = (t - (opts.from ?? 0)) / seg;
      all.forEach((b, i) => b.classList.toggle('past', i / n < f));
    }
    onAudio((k, t) => { if (k === key) set(t); });
    return { reset: () => set(-1) };
  }

  /** Transcript that lights up word by word as the clip plays. tags: word tag -> {cls, label}. */
  function karaoke(host, key, opts = {}) {
    const c = clip(key), tags = opts.tags || {}, gen = opts.gen || [];
    host.innerHTML = '';
    let prevTag = null;
    const spans = c.words.map((w) => {
      const s = document.createElement('span');
      s.textContent = w.w;
      const tg = tags[w.tag];
      if (tg) {
        s.classList.add(tg.cls || 'bad');
        if (tg.label && w.tag !== prevTag) { const l = document.createElement('i'); l.className = 'lab'; l.textContent = tg.label; s.appendChild(l); }
      }
      // regenerated if most of the word lies inside a regenerated span (CTC gives short words like "a" ~20 ms)
      if (gen.some(([a, b]) => Math.min(b, w.e) - Math.max(a, w.s) > 0.5 * (w.e - w.s))) s.classList.add('gen');
      prevTag = w.tag || null;
      host.appendChild(s); host.appendChild(document.createTextNode(' '));
      return [w, s];
    });
    function set(t) { spans.forEach(([w, s]) => s.classList.toggle('said', t >= w.s)); }
    onAudio((k, t) => { if (k === key) set(t); });
    return { reset: () => set(-1), full: () => set(1e9) };
  }

  // ------------------------------------------------------------------ steps and navigation
  function stepsOf(s) { return Math.max(0, ...$$('[data-step]', s).map((e) => +e.dataset.step), +(s.dataset.steps || 0)); }
  function applySteps(s, k) { $$('[data-step]', s).forEach((e) => e.classList.toggle('on', +e.dataset.step <= k)); }

  /** A slide's hook must never break navigation: log the error and carry on. */
  function safe(f) { try { f(); } catch (e) { console.error(e); } }
  let entered = -1;                 // the slide whose enter hook last ran
  function go(i, k = 0, dir = 1) {
    const prevS = slides[cur];
    if (i !== cur) {
      stopAudio();
      safe(() => HOOKS[prevS.dataset.id]?.leave?.(prevS));
      prevS.classList.remove('active');
    }
    const enteringNew = i !== entered;
    entered = i;
    cur = i; step = k;
    const s = slides[cur];
    s.classList.add('active');
    applySteps(s, step);
    const h = HOOKS[s.dataset.id];
    if (enteringNew) safe(() => h?.enter?.(s, { back: dir < 0, step }));
    safe(() => h?.step?.(s, step, { back: dir < 0 }));
    try { history.replaceState(null, '', `#${cur + 1}`); } catch (e) { /* file:// */ }
    renderNotes();
  }
  function next() {
    if (step < stepsOf(slides[cur])) return go(cur, step + 1, 1);
    for (let i = cur + 1; i < slides.length; i++) if (passable(i)) return go(i, 0, 1);
  }
  function prev() {
    if (step > 0) return go(cur, step - 1, -1);
    for (let i = cur - 1; i >= 0; i--) if (passable(i)) return go(i, stepsOf(slides[i]), -1);
  }

  // ------------------------------------------------------------------ speaker notes
  let notesWin = null;
  function nextTitle() {
    for (let i = cur + 1; i < slides.length; i++) if (passable(i)) return `${i + 1}. ${slides[i].dataset.title}`;
    return 'end';
  }
  function notesHTML() {
    const s = slides[cur], n = $('.notes', s);
    const mins = (performance.now() - t0.talk) / 60000, mm = Math.floor(mins), ss = Math.floor((mins - mm) * 60);
    return `<div class="hd"><b>${cur + 1}/${slides.length} · ${s.dataset.title}</b> <span>step ${step}/${stepsOf(s)}</span> <span>${s.dataset.time || ''}</span> <span class="clock">${mm}:${String(ss).padStart(2, '0')}</span>${skip.has(s.dataset.id) ? ' <span class="sk">SKIPPED</span>' : ''}</div>
      <div class="body">${n ? n.innerHTML : ''}</div><div class="nx">Next: ${nextTitle()}</div>`;
  }
  // The notes are re-rendered every second (for the clock). The current step's block is highlighted, and it is
  // scrolled into view only when the step changes, so the presenter can still scroll freely.
  let notesAt = '';
  function markStep(root, moved) {
    const b = root.querySelector(`.st[data-k="${step}"]`);
    if (!b) return;
    b.classList.add('cur');
    if (moved) b.scrollIntoView({ block: 'start' });
  }
  function renderNotes() {
    const at = `${cur}:${step}`, moved = at !== notesAt;
    notesAt = at;
    if (notesWin && !notesWin.closed) { const n = $('#n', notesWin.document); n.innerHTML = notesHTML(); markStep(n, moved); }
    const ov = $('#notes-overlay');
    if (ov.style.display === 'block') { ov.innerHTML = notesHTML(); markStep(ov, moved); }
  }
  setInterval(renderNotes, 1000);
  function openNotes() {
    notesWin = open('', 'cv-notes', 'width=900,height=760');
    if (!notesWin) return toast('Pop-up blocked: allow pop-ups for the speaker notes, or press N');
    notesWin.document.title = 'Speaker notes';
    notesWin.document.body.innerHTML = `<style>body{background:#171716;color:#f3f2ee;font:23px/1.55 'Segoe UI','Noto Sans Georgian',Sylfaen,system-ui,sans-serif;margin:26px}
      .hd{display:flex;gap:22px;align-items:baseline;border-bottom:1px solid #3a3836;padding-bottom:10px;margin-bottom:14px}.hd span{color:#a8a49c}
      .clock{margin-left:auto;font-size:32px;color:#7088ff!important}.sk{color:#f0a73a!important}em{color:#a8a49c}b{color:#fff}.en{color:#75716a;font-size:18px}
      .nx{margin-top:20px;color:#a8a49c;border-top:1px solid #3a3836;padding-top:10px}p{margin:0 0 12px}.sec{color:#a8a49c;font-size:19px}.h{color:#f0a73a;font-weight:600;margin-top:18px}.say{border-left:4px solid #4cc89b;padding-left:14px}code{font-size:.9em;color:#a8a49c}.st{border-left:4px solid transparent;padding-left:12px;margin-left:-16px}.st.cur{border-left-color:#7088ff;background:#7088ff14}</style><div id="n"></div>`;
    notesWin.addEventListener('keydown', onKey);
    renderNotes();
  }

  // ------------------------------------------------------------------ input
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast.h); toast.h = setTimeout(() => { t.style.display = 'none'; }, 2600);
  }
  function onKey(e) {
    if (!started) start();
    const k = e.key;
    if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1);
    else if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
    else if (k === 's' || k === 'S') openNotes();
    else if (k === 'n' || k === 'N') { const ov = $('#notes-overlay'); ov.style.display = ov.style.display === 'block' ? 'none' : 'block'; renderNotes(); }
    else if (k === 'p' || k === 'P') { const a = Audio1.el || $('.slide.active video.cur'); if (a) a.paused ? a.play() : a.pause(); }
    else if (k === 'r' || k === 'R') go(cur, step);
    else if (k === 't' || k === 'T') { t0.talk = performance.now(); toast('Talk clock reset'); }
    else if (k === 'b' || k === 'B') { const i = slides.findIndex((s) => 'backup' in s.dataset); if (i >= 0) go(i, 0); }
    else if (k === 'x' || k === 'X') {
      const id = slides[cur].dataset.id; skip.has(id) ? skip.delete(id) : skip.add(id); saveSkip(); paintSkip(); renderNotes();
      toast(skip.has(id) ? 'This slide is skipped in the talk' : 'This slide is back in the talk');
    }
    else if (k === '.' ) { const b = $('#blank'); b.style.display = b.style.display === 'block' ? 'none' : 'block'; }
    else if (k === 'a' || k === 'A') { window.Sfx?.check(); toast('Sound check: you should hear three notes'); }
    else if (/^[1-9]$/.test(k)) { const s = slides[cur]; safe(() => HOOKS[s.dataset.id]?.key?.(s, +k)); }
    else if (k === '?' || k === 'h' || k === 'H') { const h = $('#help'); h.style.display = h.style.display === 'block' ? 'none' : 'block'; }
  }
  addEventListener('keydown', onKey);
  let focusedAt = 0;
  addEventListener('focus', () => { focusedAt = performance.now(); });
  stage.addEventListener('click', (e) => {
    if (!started) return;
    if (performance.now() - focusedAt < 400) return;     // the click that brings the window back from the demo
    if (e.target.closest('a')) return;
    next();
  });
  stage.addEventListener('contextmenu', (e) => { e.preventDefault(); prev(); });

  function start() {
    if (started) return;
    started = true; $('#start').classList.add('gone'); t0.talk = performance.now();
    window.Sfx?.unlock();
    go(cur, step);
  }
  $('#start').addEventListener('click', (e) => { e.stopPropagation(); start(); });
  $('#start .check')?.addEventListener('click', (e) => { e.stopPropagation(); window.Sfx?.check(); });

  window.Deck = { play, stopAudio, onAudio, vnote, karaoke, toast, get step() { return step; } };
  // HOOKS run their setup once the deck API exists
  for (const id in HOOKS) safe(() => HOOKS[id].init?.($(`.slide[data-id="${id}"]`)));
  const m = /^#(\d+)/.exec(location.hash);
  cur = m ? Math.min(slides.length - 1, Math.max(0, +m[1] - 1)) : 0;
  slides[cur].classList.add('active'); applySteps(slides[cur], 0);
})();
