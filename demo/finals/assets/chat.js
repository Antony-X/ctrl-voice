/* Opening slide ("chat"): a phone chat in which two people's bad voice notes get fixed, with the real audio.
   Left: a messenger on a phone. Right: a "lens" that magnifies the note being played (waveform, then pitch).
   Every visual comes from window.DATA (real peaks, word times, edit list, f0 contours, metrics).

   Steps (deck.js calls step(k) for k = 0..4; with back: true a step's finished state is shown silently)
     0  Sarah's messy note arrives and plays; mistakes turn red in the transcript and on the lens.
     1  Rewind into the input bar, Ctrl+Voice fixes it (the cuts collapse on the real time map), re-sent, the fixed note plays.
     2  Reveal: the regenerated words glow green; green bands on the lens.
     3  Swipe to Eric's DM; his unsure note plays with its live pitch contour; the ending rises.
     4  The Confident slider rises; the fixed note plays; the new contour falls at the end. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const Ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    back: (p) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  };
  const SPRING = 'cubic-bezier(.3, 1.45, .5, 1)';
  const fmt = (s) => `0:${String(Math.round(s)).padStart(2, '0')}`;
  const sfx = (name, ...a) => { try { window.Sfx?.[name]?.(...a); } catch (e) { /* sounds are optional */ } };

  function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function sv(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs || {}) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const show = (el, on) => el.classList.toggle('cv-hide', !on);

  // ------------------------------------------------------------------ timing that leave() and every new step can cancel
  let epoch = 0;
  const timers = new Set(), frames = new Set(), anims = new Set();
  function cancelAll() {
    epoch++;
    timers.forEach(clearTimeout); timers.clear();
    frames.forEach(cancelAnimationFrame); frames.clear();
    anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); anims.clear();
    run = null;
  }
  function later(ms, fn) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  const wait = (ms) => new Promise((res) => later(ms, res));
  function frame(fn) { const id = requestAnimationFrame((t) => { frames.delete(id); fn(t); }); frames.add(id); }
  /** rAF tween; fn(eased p). Resolves at the end; never resolves if cancelled. */
  function tween(ms, fn, ease = Ease.out) {
    return new Promise((res) => {
      if (RM || ms <= 0) { fn(1); res(); return; }
      const t0 = performance.now();
      const loop = (now) => { const p = clamp((now - t0) / ms); fn(ease(p)); if (p < 1) frame(loop); else res(); };
      fn(0); frame(loop);
    });
  }
  /** A Web Animation that plays INTO the element's current (base) style; cancelled with the step. */
  function fx(el, kf, o) {
    if (RM || !el || !el.animate) return null;
    const a = el.animate(kf, { fill: 'backwards', easing: 'ease-out', ...o });
    anims.add(a); a.finished.then(() => anims.delete(a), () => anims.delete(a));
    return a;
  }
  const popIn = (el, o = {}) => fx(el, [{ opacity: 0, transform: `translate(${o.dx || 0}px, ${o.dy ?? 18}px) scale(${o.s ?? 0.6})` }, { opacity: 1, transform: 'none' }],
    { duration: o.ms || 420, easing: SPRING, delay: o.delay || 0 });
  function drawOn(g, ms = 450, delay = 0) {
    g.querySelectorAll('path').forEach((p) => {
      const L = p.getTotalLength(); if (!L) return;
      p.style.strokeDasharray = `${L} ${L}`;
      fx(p, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: ms, delay, easing: 'ease-out' });
    });
  }

  // ------------------------------------------------------------------ clips: audio time drives the visuals; a wall clock takes over if audio doesn't advance
  let run = null;
  function playClip(key, onT) {
    return new Promise((res) => {
      const clip = window.DATA.clips[key];
      const audio = window.Deck?.play(key, 0, null, 0);
      const r = run = { key, audio, onT, dur: clip.dur, wall: null, wallFrom: 0, lastT: -1, lastMove: performance.now(), moved: false };
      r.finish = () => { if (run !== r) return; run = null; onT(clip.dur); res(); };
      r.feed = (t) => {                              // from Deck.onAudio: the element's own currentTime
        if (r.wall != null) return;
        if (t > r.lastT + 1e-4) { r.lastT = t; r.lastMove = performance.now(); if (t > 0.02) r.moved = true; }
        onT(t);
        if (audio.ended || t >= clip.dur - 0.03) r.finish();
      };
      const watch = (now) => {
        if (run !== r) return;
        if (r.wall == null) {
          const paused = audio && audio.paused && !audio.ended;
          const stuck = now - r.lastMove > 1500;
          // never started (blocked, failed), or stalled while playing; a presenter pause (P) after it played is left alone
          if (!audio || (stuck && (!r.moved || !paused))) {
            r.wall = now; r.wallFrom = Math.max(0, r.lastT);
            window.Deck?.stopAudio();
          }
        }
        if (r.wall != null) {
          const t = r.wallFrom + (now - r.wall) / 1000;
          onT(Math.min(t, clip.dur));
          if (t >= clip.dur) { r.finish(); return; }
        }
        frame(watch);
      };
      frame(watch);
    });
  }

  // ------------------------------------------------------------------ data
  let M = null;   // everything derived from DATA, computed once
  function peakAt(clip, t0, t1) {
    const n = clip.peaks.length;
    const a = clamp(Math.floor(t0 / clip.dur * n), 0, n - 1), b = clamp(Math.ceil(t1 / clip.dur * n), a + 1, n);
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, clip.peaks[i]);
    return m;
  }
  function meanAt(clip, t0, t1) {
    const n = clip.peaks.length;
    const a = clamp(Math.floor(t0 / clip.dur * n), 0, n - 1), b = clamp(Math.ceil(t1 / clip.dur * n), a + 1, n);
    let m = 0;
    for (let i = a; i < b; i++) m += clip.peaks[i];
    return m / (b - a);
  }
  function prep() {
    const D = window.DATA;
    const cb = D.clips['clean.before'], ca = D.clips['clean.after'];
    const edits = D.clean.edits.slice().sort((a, b) => a.t0 - b.t0);
    const durB = D.clean.metrics.dur_before, durA = D.clean.metrics.dur_after;
    // the real piecewise-linear time map, before-time -> after-time
    const A = [[0, 0]];
    edits.forEach((e) => {
      const o0 = e.type === 'cut' ? e.out_at : e.out[0], o1 = e.type === 'cut' ? e.out_at : e.out[1];
      e.o0 = o0; e.o1 = o1; A.push([e.t0, o0], [e.t1, o1]);
    });
    A.push([durB, durA]);
    const fwd = (t) => {
      for (let i = 0; i < A.length - 1; i++) if (t <= A[i + 1][0] || i === A.length - 2) {
        const [t0, u0] = A[i], [t1, u1] = A[i + 1];
        return t1 > t0 ? u0 + (u1 - u0) * (t - t0) / (t1 - t0) : u0;
      }
      return durA;
    };
    const segOfU = (u) => {
      for (let i = 0; i < A.length - 1; i++) {
        const [t0, u0] = A[i], [t1, u1] = A[i + 1];
        if (u1 > u0 && u >= u0 && u <= u1) return { t: t0 + (t1 - t0) * (u - u0) / (u1 - u0), edit: i % 2 ? edits[(i - 1) / 2] : null };
      }
      return { t: durB, edit: null };
    };
    M = { D, cb, ca, edits, durB, durA, A, fwd, segOfU };
  }

  const LABEL = { filler: 'um', correction: 'changed mind', command: 'took back', misspoken: 'wrong word', grammar: 'wrong word' };

  // ------------------------------------------------------------------ icons and art
  const IC = {
    chev: '<svg viewBox="0 0 24 24" width="32" height="32"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    video: '<svg viewBox="0 0 24 24" width="34" height="34"><rect x="2.5" y="6.2" width="13" height="11.6" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.5 10.6 21 7.6v8.8l-5.5-3z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    call: '<svg viewBox="0 0 24 24" width="29" height="29"><path d="M6.6 3.5h-2a1.6 1.6 0 0 0-1.6 1.8C3.9 13.5 10.5 20.1 18.7 21a1.6 1.6 0 0 0 1.8-1.6v-2.1a1.5 1.5 0 0 0-1.1-1.4l-3-.9a1.5 1.5 0 0 0-1.5.4l-1.3 1.3a12 12 0 0 1-5.3-5.3l1.3-1.3a1.5 1.5 0 0 0 .4-1.5l-.9-3a1.5 1.5 0 0 0-1.5-1.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="8.3" y="2.5" width="7.4" height="12.5" rx="3.7" fill="currentColor"/><path d="M5.2 11.3a6.8 6.8 0 0 0 13.6 0M12 18.2v3.3" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M3.5 11.2 20.2 3.8a.6.6 0 0 1 .8.8L13.6 21.3a.6.6 0 0 1-1.1-.1l-1.9-7-7-1.9a.6.6 0 0 1-.1-1.1z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.6v14.8a.8.8 0 0 0 1.2.7l11.6-7.4a.8.8 0 0 0 0-1.4L8.2 3.9A.8.8 0 0 0 7 4.6z" fill="currentColor"/></svg>',
    rewind: '<svg viewBox="0 0 48 48"><path d="M23 12v24L5 24zM43 12v24L25 24z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    ticks: '<svg viewBox="0 0 19 12" width="22" height="14"><path d="M1.2 6.6 4.6 10 11.8 2.2M8 9.3l.7.7L16.6 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    signal: '<svg width="25" height="16" viewBox="0 0 25 16" fill="currentColor"><rect x="0" y="11" width="4.4" height="5" rx="1.2"/><rect x="6.8" y="7.6" width="4.4" height="8.4" rx="1.2"/><rect x="13.6" y="4" width="4.4" height="12" rx="1.2"/><rect x="20.4" y="0" width="4.4" height="16" rx="1.2"/></svg>',
    wifi: '<svg width="23" height="17" viewBox="0 0 24 17" fill="currentColor"><path d="M12 16.6 8.2 12.4a5.6 5.6 0 0 1 7.6 0z"/><path d="M4 8.2a11.4 11.4 0 0 1 16 0l-2.2 2.4a8.2 8.2 0 0 0-11.6 0z"/><path d="M0 4.3a17.2 17.2 0 0 1 24 0l-2.1 2.3a14 14 0 0 0-19.8 0z"/></svg>',
    battery: '<svg width="36" height="18" viewBox="0 0 36 18"><rect x="1" y="1" width="30" height="16" rx="5" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.6"/><rect x="3.4" y="3.4" width="21" height="11.2" rx="3" fill="currentColor"/><path d="M33.4 6.4v5.2a2.8 2.8 0 0 0 0-5.2z" fill="currentColor" opacity=".45"/></svg>',
    trip: '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="17" r="7" fill="#ffe4b5"/><path d="M5 26.5q3.75-3 7.5 0t7.5 0 7.5 0 7.5 0M5 32q3.75-3 7.5 0t7.5 0 7.5 0 7.5 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    arrow: '<svg viewBox="0 0 40 16" width="40" height="16"><path d="M2 8h33M28 2.5 35.5 8 28 13.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    up: '<svg viewBox="0 0 16 22" width="15" height="21"><path d="M8 20V3M2.5 8.5 8 2.5l5.5 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 16 22" width="15" height="21"><path d="M8 2v17M2.5 13.5 8 19.5l5.5-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  // the app logo (index.html #mark), copied so this slide works on its own
  const MARK = '<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="3.5" y="3.5" width="93" height="93" rx="20" fill="none" stroke="currentColor" stroke-width="7"/><g stroke="currentColor" stroke-width="7" stroke-linecap="round"><line x1="22.6" y1="40.5" x2="22.6" y2="59.5"/><line x1="36.1" y1="30" x2="36.1" y2="70"/><line x1="50" y1="18.5" x2="50" y2="81.5"/><line x1="63.9" y1="31" x2="63.9" y2="69"/><line x1="77.4" y1="41" x2="77.4" y2="59"/></g></svg>';
  // the app's Confident character (src/app/characters.js), 96 x 96
  const HERO = `<ellipse class="c-shadow" cx="48" cy="89" rx="19" ry="3"/>
    <g class="c-rays"><path d="M48 5v7M24 12l4 6M72 12l-4 6M10 33l7 3M86 33l-7 3"/></g>
    <g class="c-fig"><g class="c-cape"><path class="c-flap c-2" d="M37 46h22l10 37q-21 6-42 0z"/></g>
      <path class="c-1d" d="M38 73h8v12a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3zM50 73h8v12a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z"/>
      <path class="c-arm" d="M38 52l-7.5 8.5 6.5 6.5M58 52l7.5 8.5-6.5 6.5"/>
      <rect class="c-1" x="35" y="45" width="26" height="31" rx="11"/>
      <rect class="c-3" x="36.5" y="67" width="23" height="3.5"/>
      <g class="c-badge"><circle class="c-3" cx="48" cy="57" r="7"/><path class="c-1d" d="M49.6 51.6 44.8 58h3.1l-1.5 5.4 4.9-6.5h-3.2z"/></g>
      <circle class="c-face" cx="48" cy="32" r="12"/>
      <path class="c-hair" d="M36 31.5a12 12 0 0 1 24-1.5c-3.5-3-8.5-3.8-12.5-2.2-3.6 1.4-7.6 1.6-11.5 3.7z"/>
      <rect class="c-2" x="37.5" y="29.5" width="21" height="6.5" rx="3.25"/>
      <circle class="c-eye" cx="43.5" cy="32.7" r="1.5"/><circle class="c-eye" cx="52.5" cy="32.7" r="1.5"/>
      <path class="c-line" d="M44 39.6q3.8 2.6 8.4-.9"/></g>`;
  const hero = (head) => `<svg class="char" viewBox="${head ? '28 12 40 40' : '0 0 96 96'}" aria-hidden="true">${HERO}</svg>`;

  const WHO = {
    sarah: { letter: 'S', a1: '#f27aa0', a2: '#b44f78' },
    eric: { letter: 'E', a1: '#8a9cff', a2: '#4a5bd0' },
    trip: { html: IC.trip, a1: '#f0a73a', a2: '#e0685a' },
  };
  function avatar(who, cls) {
    const a = h('div', `cv-ava ${cls}`, who.html || who.letter);
    a.style.setProperty('--a1', who.a1); a.style.setProperty('--a2', who.a2);
    return a;
  }

  // ------------------------------------------------------------------ the phone
  function chatPane(o) {
    const pane = h('div', `cv-pane ${o.cls}`);
    const head = h('div', 'cv-head');
    head.appendChild(h('div', 'cv-back', IC.chev));
    head.appendChild(avatar(o.who, 'hd'));
    head.appendChild(h('div', 'cv-title', `<b>${o.title}</b><span>${o.sub}</span>`));
    head.appendChild(h('div', 'cv-acts', IC.video + IC.call));
    const thread = h('div', 'cv-thread');
    thread.appendChild(h('div', 'cv-day', 'Today'));
    const out = h('div', 'cv-msg out');
    out.appendChild(h('div', 'cv-bub cv-text', `<span>${o.mine}</span><span class="cv-meta">${o.mineTime}<span class="cv-ticks">${IC.ticks}</span></span>`));
    thread.appendChild(out);
    const input = h('div', 'cv-input');
    input.innerHTML = `<div class="cv-plus">${IC.plus}</div>
      <div class="cv-field"><span class="cv-ph">Message</span>
        <div class="cv-draft"><div class="cv-pill"><span class="cv-mark">${MARK}</span>Ctrl+Voice</div><div class="cv-dwave"></div><span class="cv-ddur">0:14</span></div></div>
      <div class="cv-mic"><span class="i-mic">${IC.mic}</span><span class="i-send">${IC.send}</span></div>`;
    input.querySelectorAll('.cv-mic > span').forEach((s) => { const svg = s.firstElementChild; s.replaceWith(svg); svg.classList.add(s.className); });
    pane.append(head, thread, input);
    return { pane, thread, input };
  }

  /** A voice-note bubble. Bars and transcript come from a clip; progress and karaoke are set from time t. */
  function voiceNote(o) {
    const wrap = h('div', `cv-msg in ${o.group ? 'grp' : 'dm'}`);
    if (o.group) wrap.appendChild(avatar(o.who, 'sm'));
    const bub = h('div', 'cv-bub cv-voice');
    if (o.group) bub.appendChild(h('div', 'cv-name', o.name));
    const row = h('div', 'cv-vrow');
    const big = avatar(o.who, 'lg'); big.appendChild(h('i', 'cv-micb', IC.mic));
    const play = h('div', 'cv-play', IC.play);
    const wave = h('div', 'cv-wave');
    row.append(big, play, wave);
    const meta = h('div', 'cv-vmeta', `<span class="cv-dur"></span><span class="cv-chipslot"></span><span class="cv-time">${o.time}</span>`);
    const tr = h('div', 'cv-tr');
    bub.append(row, meta, tr);
    wrap.appendChild(bub);

    const NB = 44, bars = [];
    for (let i = 0; i < NB; i++) { const b = document.createElement('i'); wave.appendChild(b); bars.push(b); }
    const dot = h('b', 'cv-dot'); wave.appendChild(dot);
    const api = { el: wrap, bub, row, wave, tr, meta, play, words: [], clip: null, key: null };
    api.setClip = (key, words) => {
      const c = window.DATA.clips[key];
      api.clip = c; api.key = key;
      bars.forEach((b, i) => { b.style.height = `${Math.round(5 + 37 * Math.pow(peakAt(c, i / NB * c.dur, (i + 1) / NB * c.dur), 0.85))}px`; });
      meta.querySelector('.cv-dur').textContent = fmt(c.dur);
      tr.innerHTML = '';
      api.words = (words || c.words).map((w) => {
        const s = h('span', 'w'); s.textContent = w.w;
        tr.appendChild(s); tr.appendChild(document.createTextNode(' '));
        return { w, s };
      });
      api.progress(-1); api.say(-1);
    };
    api.progress = (t) => {
      const f = api.clip ? clamp(t / api.clip.dur) : 0;
      bars.forEach((b, i) => b.classList.toggle('past', t >= 0 && (i + 0.5) / NB <= f));
      dot.style.left = `${f * 100}%`;
    };
    api.say = (t) => api.words.forEach(({ w, s }) => s.classList.toggle('said', t >= w.s));
    api.setDur = (s) => { meta.querySelector('.cv-dur').textContent = s; };
    return api;
  }

  // ------------------------------------------------------------------ the lens: clean view (waveform with edits)
  const LC = { x0: 62, w: 886, mid: 470, half: 178, pitch: 6.4, bw: 4.2 };
  function buildClean(view) {
    const { cb, ca, edits, durB, durA, fwd, segOfU } = M;
    LC.pps = LC.w / durB;
    const svg = sv('svg', { width: 1010, height: 872, viewBox: '0 0 1010 872' }, view);
    sv('line', { x1: LC.x0 - 10, x2: LC.x0 + LC.w + 10, y1: LC.mid, y2: LC.mid, class: 'axis' }, svg);
    const gBands = sv('g', {}, svg), gGen = sv('g', {}, svg), gBars = sv('g', {}, svg), gInk = sv('g', {}, svg);
    // bars: the after-clip's own bars (kept + regenerated), plus the before-clip's bars inside each edit
    const dt = LC.pitch / LC.pps, nA = Math.round(durA / dt), dtA = durA / nA, bars = [];
    for (let j = 0; j < nA; j++) {
      const u = (j + 0.5) * dtA, sg = segOfU(u), ha = meanAt(ca, u - dtA / 2, u + dtA / 2);
      if (!sg.edit) bars.push({ k: 'keep', tb: sg.t, ua: u, hb: meanAt(cb, sg.t - dt / 2, sg.t + dt / 2), ha });
      else bars.push({ k: 'new', edit: sg.edit, tb: sg.t, ua: u, hb: 0, ha });
    }
    edits.forEach((e) => {
      const n = Math.max(1, Math.round((e.t1 - e.t0) / dt));
      for (let i = 0; i < n; i++) {
        const t = e.t0 + (i + 0.5) * (e.t1 - e.t0) / n;
        bars.push({ k: 'old', edit: e, tb: t, ua: fwd(t), hb: meanAt(cb, t - dt / 2, t + dt / 2), ha: 0 });
      }
    });
    bars.forEach((b) => { b.el = sv('rect', { class: 'bar', rx: LC.bw / 2 }, gBars); });
    // the edits: red bands on the before waveform; green bands on the regenerated spans of the after waveform
    const bands = edits.map((e) => ({ e, el: sv('rect', { class: 'band', rx: 8, y: LC.mid - LC.half - 12, height: 2 * LC.half + 24 }, gBands) }));
    const gens = edits.filter((e) => e.type === 'replace').map((e) => sv('rect', {
      class: 'gband', rx: 8, x: LC.x0 + e.o0 * LC.pps, width: (e.o1 - e.o0) * LC.pps, y: LC.mid - LC.half - 16, height: 2 * LC.half + 32 }, gGen));
    const ph = sv('g', {}, svg);
    sv('line', { class: 'phead', x1: 0, x2: 0, y1: LC.mid - LC.half - 22, y2: LC.mid + LC.half + 22, 'stroke-linecap': 'round' }, ph);
    sv('circle', { class: 'phead-k', cx: 0, cy: LC.mid - LC.half - 22, r: 8 }, ph);

    // red label chips, above the waveform; a chip that would overlap its neighbour goes below
    const chips = [], groups = [];
    edits.forEach((e) => {
      const label = LABEL[e.kind] || e.label, g = groups[groups.length - 1];
      if (g && g.label === label) g.es.push(e); else groups.push({ label, es: [e] });
    });
    let lastRight = -1e9;
    groups.forEach(({ label, es }) => {
      const e = es[0], t1 = es[es.length - 1].t1;
      const cx = LC.x0 + (e.t0 + t1) / 2 * LC.pps, w = 30 + label.length * 12.4;
      const below = cx - w / 2 < lastRight + 12;
      const c = h('div', `cv-chip${below ? ' below' : ''}`, label);
      c.style.left = `${cx}px`; c.style.top = `${below ? LC.mid + LC.half + 22 : LC.mid - LC.half - 22}px`;
      if (!below) lastRight = cx + w / 2;
      view.appendChild(c); chips.push({ e, el: c });
    });

    // after the fix: the length that went away, as a hand-drawn ghost bracket
    const pen = window.Sketch?.P(gInk);
    const ghost = sv('g', {}, gInk);
    const gx0 = LC.x0 + durA * LC.pps, gx1 = LC.x0 + durB * LC.pps, gy = LC.mid + LC.half + 40;
    if (pen) {
      const gp = window.Sketch.P(ghost);
      gp.line(gx0 + 6, LC.mid, gx1, LC.mid, { color: 'rgba(243,242,238,.28)', sw: 2, dash: [6, 9], seed: 11 });
    }

    // reveal: one green label, with hand-drawn leaders to both regenerated spans
    const reg = M.D.figs.closeup.regenerated;
    const rep = edits.filter((e) => e.type === 'replace');
    const gcx = LC.x0 + (rep[0].o0 + rep[rep.length - 1].o1) / 2 * LC.pps + 60, gcy = LC.mid + LC.half + 92;
    const gchip = h('div', 'cv-chip g below', `${reg.toFixed(1)} s AI`);
    gchip.style.left = `${gcx}px`; gchip.style.top = `${gcy}px`;
    view.appendChild(gchip);
    const leaders = sv('g', {}, gInk);
    if (pen) {
      const lp = window.Sketch.P(leaders);
      rep.forEach((e, i) => {
        const bx = LC.x0 + (e.o0 + e.o1) / 2 * LC.pps;
        lp.arrow([[gcx + (i ? 40 : -60), gcy - 4], [bx + (i ? 6 : -4), LC.mid + LC.half + 24]], { color: '#4cc89b', sw: 2.4, seed: 21 + i, hl: 12, curve: false });
      });
    }

    const prompt = h('div', 'cv-prompt', 'Which 2 words are AI?');
    view.appendChild(prompt);

    // header
    const head = h('div', 'cv-lhead');
    head.appendChild(avatar(WHO.sarah, ''));
    head.appendChild(h('div', '', '<b>Sarah</b>'));
    const count = h('div', 'cv-count', `<span class="was">${fmt(durB)}</span><span class="now">${fmt(durB)}</span>`);
    head.appendChild(count);
    view.appendChild(head);

    const H = (p) => 6 + (2 * LC.half - 6) * Math.pow(clamp(p * 1.08), 1.25);
    const S = { m: 0, mode: 'B', t: -1, reached: -1, ai: false };
    function paint() {
      const { m, mode, t, reached, ai } = S;
      for (const b of bars) {
        let x = LC.x0 + lerp(b.tb, b.ua, m) * LC.pps, hh, w = LC.bw;
        if (b.k === 'keep') hh = H(lerp(b.hb, b.ha, m));
        else if (b.k === 'old') { const q = clamp(m * 1.7); hh = H(b.hb) * (1 - q); w *= 1 - q; }
        else { const q = clamp((m - 0.45) / 0.55); hh = H(b.ha) * q; }
        const vis = hh > 0.6 && w > 0.3;
        b.el.style.display = vis ? '' : 'none';
        if (!vis) continue;
        b.el.setAttribute('x', (x - w / 2).toFixed(2)); b.el.setAttribute('width', w.toFixed(2));
        b.el.setAttribute('y', (LC.mid - hh / 2).toFixed(2)); b.el.setAttribute('height', hh.toFixed(2));
        const lit = mode === 'B' ? b.tb <= t : b.ua <= t;
        const bad = b.k === 'old' && b.tb <= reached;
        b.el.setAttribute('class', `bar${bad ? ' bad' : ai && b.k === 'new' ? ' ai' : lit ? ' lit' : ''}`);
      }
      for (const { e, el } of bands) {
        const x0 = lerp(e.t0, e.o0, m), full = lerp(e.t1, e.o1, m);
        const x1 = m > 0 ? full : Math.min(full, Math.max(e.t0, reached));
        const vis = reached >= e.t0 && m < 1;
        el.style.display = vis ? '' : 'none';
        el.setAttribute('x', LC.x0 + x0 * LC.pps - 6); el.setAttribute('width', Math.max(0, (x1 - x0) * LC.pps + 12));
        el.style.opacity = String(1 - clamp(m * 1.25));
      }
      const pt = mode === 'B' ? lerp(Math.max(0, t), M.fwd(Math.max(0, t)), m) : clamp(t, 0, durA);
      ph.setAttribute('transform', `translate(${(LC.x0 + clamp(pt, 0, durB) * LC.pps).toFixed(2)},0)`);
    }
    return { svg, bars, bands, gens, chips, ph, ghost, gchip, leaders, prompt, count, head, S, paint };
  }

  // ------------------------------------------------------------------ the lens: tone view (pitch contour)
  const LT = { x0: 70, x1: 880, top: 190, bot: 740, hz0: 82, hz1: 235 };
  function buildTone(view) {
    const F = M.D.tone_f0, tmax = Math.max(F.before.dur, F.after.dur);
    const X = (t) => LT.x0 + t / tmax * (LT.x1 - LT.x0);
    const Y = (hz) => LT.bot - Math.log2(hz / LT.hz0) / Math.log2(LT.hz1 / LT.hz0) * (LT.bot - LT.top);
    LT.X = X; LT.Y = Y;
    const svg = sv('svg', { width: 1010, height: 872, viewBox: '0 0 1010 872' }, view);
    const defs = sv('defs', {}, svg);
    [100, 150, 200].forEach((hz) => sv('line', { class: 'grid', x1: LT.x0, x2: LT.x1 + 60, y1: Y(hz), y2: Y(hz) }, svg));

    /** Display contour from the real f0 (10 ms frames). Voiced runs split at gaps and octave-size jumps;
        runs under 60 ms are dropped and 2 edge frames trimmed (unreliable onsets/offsets); runs closer than
        160 ms are bridged into one phrase; each phrase is smoothed with Gaussian-weighted local-linear
        regression (sigma 45 ms) in semitones, which keeps rises and falls at the ends intact. */
    const smoothCache = new Map();
    function smoothRuns(f) {
      if (smoothCache.has(f)) return smoothCache.get(f);
      const st = (hz) => 12 * Math.log2(hz);
      const raw = []; let cur = [];
      const flush = () => { if (cur.length >= 6) raw.push(cur.slice(2, -2)); cur = []; };
      for (let i = 0; i < f.t.length; i++) {
        const t = f.t[i], hz = f.hz[i];
        if (hz <= 0) { flush(); continue; }
        if (cur.length) {
          const [pt, ps] = cur[cur.length - 1];
          if (t - pt > 0.025 || Math.abs(st(hz) - ps) > 3) flush();
        }
        cur.push([t, st(hz)]);
      }
      flush();
      const phrases = [];
      for (const r of raw.filter((r) => r.length >= 2)) {
        const ph = phrases[phrases.length - 1], last = ph && ph[ph.length - 1];
        if (last && r[0][0] - last[0] < 0.16 && Math.abs(r[0][1] - last[1]) < 5) {
          const n = Math.round((r[0][0] - last[0]) / 0.01);
          for (let j = 1; j < n; j++) ph.push([last[0] + (j / n) * (r[0][0] - last[0]), lerp(last[1], r[0][1], j / n)]);
          ph.push(...r);
        } else phrases.push([...r]);
      }
      const SIG = 0.045;
      const loess = (ph) => ph.map(([t0]) => {
        let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (const [t, y] of ph) {
          const d = t - t0; if (Math.abs(d) > 3 * SIG) continue;
          const w = Math.exp(-0.5 * (d / SIG) ** 2);
          sw += w; sx += w * d; sy += w * y; sxx += w * d * d; sxy += w * d * y;
        }
        const den = sw * sxx - sx * sx;
        const y0 = Math.abs(den) > 1e-9 ? (sy * sxx - sx * sxy) / den : sy / sw;   // value of the local line at t0
        return [t0, Math.pow(2, y0 / 12)];
      });
      const res = phrases.map(loess);
      smoothCache.set(f, res);
      return res;
    }
    function runs(f, from = 0, to = 1e9) {
      return smoothRuns(f).map((r) => r.filter(([t]) => t >= from && t <= to)).filter((r) => r.length >= 2)
        .map((r) => r.map(([t, hz], i) => `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(hz).toFixed(1)}`).join(''));
    }
    const wB = F.before.words, wA = F.after.words;
    const riseT = wB[wB.length - 1].s, fallT = wA[wA.length - 1].s;
    function contour(f, cls, clipId, from, to) {
      const g = sv('g', { 'clip-path': `url(#${clipId})` }, svg);
      runs(f, from, to).forEach((d) => sv('path', { d, class: `f0 ${cls}` }, g));
      return g;
    }
    const clip = (id) => sv('rect', { x: LT.x0 - 10, y: 0, width: 0, height: 872 }, sv('clipPath', { id }, defs));
    const clipB = clip('cvchat-clip-b'), clipA = clip('cvchat-clip-a');
    const gB = contour(F.before, 'b', 'cvchat-clip-b');
    const gRise = contour(F.before, 'rise', 'cvchat-clip-b', riseT - 0.02);
    const gA = contour(F.after, 'a', 'cvchat-clip-a');
    const gFall = contour(F.after, 'a fall', 'cvchat-clip-a', fallT - 0.02);
    const dotB = sv('circle', { r: 9, fill: '#f3f2ee', class: 'f0dot' }, svg);
    const dotA = sv('circle', { r: 9, fill: '#4cc89b', class: 'f0dot' }, svg);
    const ph = sv('line', { class: 'phead', x1: 0, x2: 0, y1: LT.top - 30, y2: LT.bot + 20, opacity: 0.3 }, svg);

    // words along the time axis (two rows where they would collide)
    function wordRow(words, cls) {
      const g = sv('g', {}, svg); let r0 = -1e9, r1 = -1e9;
      const items = words.slice(-1).map((w) => {
        const i = words.length - 1;
        const cx = X((w.s + w.e) / 2), wd = w.w.length * 11.2 + 6;
        let row = 0;
        if (cx - wd / 2 < r0 + 8) { row = 1; if (cx - wd / 2 < r1 + 8) row = 0; }
        if (row) r1 = cx + wd / 2; else r0 = cx + wd / 2;
        const last = i === words.length - 1;
        const t = sv('text', { class: `wlab${last ? ` ${cls}` : ''}`, x: cx, y: LT.bot + 40 + row * 32, 'text-anchor': 'middle' }, g);
        t.textContent = w.w;
        return { w, el: t };
      });
      return { g, items, say: (tt) => items.forEach(({ w, el }) => el.classList.toggle('said', tt >= w.s)) };
    }
    const rowB = wordRow(wB, 'rise'), rowA = wordRow(wA, 'fall');

    // annotations: a hand-drawn up arrow and "?" at the rise; a down arrow and "." at the fall
    const ink = sv('g', {}, svg), pen = window.Sketch?.P;
    const ends = (g) => { const ps = [...g.querySelectorAll('path')], d = ps[ps.length - 1].getAttribute('d').match(/-?[\d.]+/g).map(Number);
      const ys = d.filter((_, i) => i % 2); return { x: d[d.length - 2], y: d[d.length - 1], top: Math.min(...ys), bot: Math.max(...ys) }; };
    const eB = ends(gRise), eA = ends(gFall);
    const upG = sv('g', {}, ink), dnG = sv('g', {}, ink);
    if (pen) pen(upG).arrow([[eB.x + 40, eB.top + 120], [eB.x + 44, eB.top + 4]], { color: '#f0a73a', sw: 4, seed: 41, hl: 20 });
    const q = h('div', 'cv-q', '?'); q.style.left = `${eB.x + 100}px`; q.style.top = `${eB.top + 34}px`; view.appendChild(q);
    if (pen) pen(dnG).arrow([[eA.x + 34, eA.bot - 40], [eA.x + 38, eA.bot + 46]], { color: '#4cc89b', sw: 4, seed: 43, hl: 20 });
    const dotq = h('div', 'cv-q g', '.'); dotq.style.left = `${eA.x + 86}px`; dotq.style.top = `${eA.bot + 12}px`; view.appendChild(dotq);


    const head = h('div', 'cv-lhead');
    head.appendChild(avatar(WHO.eric, ''));
    head.appendChild(h('div', '', '<b>Eric</b>'));
    view.appendChild(head);

    function hzAt(f, t) {          // the dot rides the displayed (smoothed) contour
      for (const r of smoothRuns(f)) if (t >= r[0][0] && t <= r[r.length - 1][0]) {
        const i = r.findIndex(([pt]) => pt >= t); return r[Math.max(0, i)][1];
      }
      return 0;
    }
    function setDot(dot, f, t, on) {
      const hz = hzAt(f, t);
      dot.style.opacity = on && hz > 0 ? '1' : '0';
      if (hz > 0) { dot.setAttribute('cx', X(t)); dot.setAttribute('cy', Y(hz)); }
    }
    const api = {
      svg, gB, gRise, gA, gFall, upG, dnG, q, dotq, rowB, rowA, ph, F, riseT, fallT,
      before(t) {           // reveal the before contour up to t (t < 0: nothing; t >= dur: all)
        clipB.setAttribute('width', Math.max(0, X(Math.max(0, t)) - LT.x0 + 12));
        setDot(dotB, F.before, t, t >= 0 && t < F.before.dur);
        rowB.say(t);
        ph.setAttribute('x1', X(clamp(t, 0, tmax))); ph.setAttribute('x2', X(clamp(t, 0, tmax)));
        ph.style.opacity = t > 0 && t < F.before.dur ? '' : '0';
      },
      after(t) {
        clipA.setAttribute('width', Math.max(0, X(Math.max(0, t)) - LT.x0 + 12));
        setDot(dotA, F.after, t, t >= 0 && t < F.after.dur);
        rowA.say(t);
        ph.setAttribute('x1', X(clamp(t, 0, tmax))); ph.setAttribute('x2', X(clamp(t, 0, tmax)));
        ph.style.opacity = t > 0 && t < F.after.dur ? '' : '0';
      },
    };
    return api;
  }

  // ------------------------------------------------------------------ build
  let R = null;   // the built slide
  function build(root) {
    prep();
    root.innerHTML = '';
    root.appendChild(h('div', 'cv-glow'));
    const beam = sv('svg', { class: 'cv-beam', viewBox: '0 0 1920 1080' }, root);
    const bd = sv('defs', {}, beam);
    const lg = sv('linearGradient', { id: 'cvchat-beam', x1: 0, x2: 1, y1: 0, y2: 0 }, bd);
    sv('stop', { offset: 0, 'stop-color': '#f3f2ee', 'stop-opacity': 0.11 }, lg);
    sv('stop', { offset: 1, 'stop-color': '#f3f2ee', 'stop-opacity': 0.025 }, lg);
    const beamP = sv('path', { fill: 'url(#cvchat-beam)' }, beam);
    const beamE = sv('path', { fill: 'none', stroke: 'rgba(243,242,238,.12)', 'stroke-width': 1.5 }, beam);

    const phone = h('div', 'cv-phone'), screen = h('div', 'cv-screen');
    phone.appendChild(screen);
    screen.appendChild(h('div', 'cv-status', `<span>18:43</span><span class="cv-island"></span><span class="cv-sys">${IC.signal}${IC.wifi}${IC.battery}</span>`));
    const panes = h('div', 'cv-panes');
    const trip = chatPane({ cls: 'cv-trip', who: WHO.trip, title: 'Weekend trip', sub: 'Sarah, Dan, you', mine: 'so when are we leaving?', mineTime: '18:41' });
    const eric = chatPane({ cls: 'cv-eric', who: WHO.eric, title: 'Eric', sub: 'online', mine: 'is the demo ready?', mineTime: '18:40' });
    panes.append(trip.pane, eric.pane);
    screen.appendChild(panes);
    screen.appendChild(h('div', 'cv-home'));
    root.appendChild(phone);

    const A = voiceNote({ group: true, who: WHO.sarah, name: 'Sarah', time: '18:42' });
    const B = voiceNote({ group: true, who: WHO.sarah, name: 'Sarah', time: '18:42' });
    const Ev = voiceNote({ group: false, who: WHO.eric, time: '18:43' });
    trip.thread.append(A.el, B.el);
    eric.thread.append(Ev.el);
    A.setClip('clean.before');
    B.setClip('clean.after');
    // tags: mistakes in the before transcript; regenerated words in the after transcript (the changed word gets the strong glow)
    A.words.forEach(({ w, s }) => { if (w.tag) s.classList.add('bad'); });
    const newWords = new Set(M.edits.filter((e) => e.type === 'replace').map((e) => e.new.split(' ').filter((x, i) => x !== e.old.split(' ')[i])).flat());
    B.words.forEach(({ w, s }) => { if (w.tag === 'regenerated') { s.classList.add('gen'); if (newWords.has(w.w.replace(/[^\w']/g, ''))) s.classList.add('new'); } });

    // the draft in Sarah's input bar (step 1)
    const dwave = trip.input.querySelector('.cv-dwave'), dbars = [];
    for (let i = 0; i < 46; i++) { const b = document.createElement('i'); dwave.appendChild(b); dbars.push(b); }
    const setDraft = (key) => {
      const c = window.DATA.clips[key], n = Math.round(46 * c.dur / M.durB);
      dbars.forEach((b, i) => {
        b.style.height = `${Math.round(4 + 26 * Math.pow(peakAt(c, i / n * c.dur, (i + 1) / n * c.dur), 0.85))}px`;
        b.style.display = i < n ? '' : 'none';
      });
      trip.input.querySelector('.cv-ddur').textContent = fmt(c.dur);
    };

    // the tone sheet over Eric's input bar (step 4)
    const sheet = h('div', 'cv-sheet');
    sheet.innerHTML = `<div class="sh-head"><span class="cv-mark">${MARK}</span>Tone</div>
      <div class="cv-tc"><div class="tc-art">${hero(false)}</div><div class="tc-body">
        <div class="tc-name"><span>Confident</span><span class="lvl">Off</span></div>
        <div class="tc-range"><div class="tc-track"><div class="tc-fill"></div></div><div class="tc-thumb"></div></div></div></div>`;
    eric.pane.appendChild(sheet);
    const tc = sheet.querySelector('.cv-tc');
    const levelName = (v) => (v <= 0 ? 'Off' : v < 0.4 ? 'Light' : v < 0.8 ? 'Medium' : 'Strong');
    const setLevel = (v) => { tc.style.setProperty('--a', v.toFixed(3)); tc.classList.toggle('on', v > 0); tc.querySelector('.lvl').textContent = levelName(v); };
    const tchip = h('span', 'cv-tchip', `${hero(true)}Confident`);
    tchip.style.setProperty('--c1', '#7088ff'); tchip.style.setProperty('--c1d', '#4f63d8'); tchip.style.setProperty('--c2', '#e0483e'); tchip.style.setProperty('--c3', '#f4b62d');
    Ev.meta.querySelector('.cv-chipslot').appendChild(tchip);

    const lens = h('div', 'cv-lens');
    const vClean = h('div', 'cv-view'), vTone = h('div', 'cv-view');
    lens.append(vClean, vTone);
    root.appendChild(lens);
    const fxLayer = h('div', '');
    fxLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:8';
    root.appendChild(fxLayer);
    const rw = h('div', '', IC.rewind);
    rw.style.cssText = 'position:absolute;width:120px;height:120px;border-radius:50%;display:grid;place-items:center;background:rgba(32,31,30,.92);color:#f3f2ee;box-shadow:0 0 0 2px rgba(243,242,238,.15),0 20px 50px rgba(0,0,0,.5);opacity:0;z-index:9';
    rw.firstElementChild.style.cssText = 'width:62px;height:62px';
    root.appendChild(rw);

    R = { lensY0: LC.mid - LC.half - 40, lensY1: LC.mid + LC.half + 40, root, beam, beamP, beamE, phone, screen, trip, eric, A, B, Ev, setDraft, sheet, setLevel, tchip, lens, vClean, vTone, fxLayer, rw, beamTarget: null, beamOn: 0 };
    R.C = buildClean(vClean);
    R.T = buildTone(vTone);
  }

  // ------------------------------------------------------------------ the beam from the note to the lens
  let beamRaf = 0;
  function beamLoop() {
    cancelAnimationFrame(beamRaf);
    const tick = () => {
      const rr = R.root.getBoundingClientRect(), sc = rr.width / 1920 || 1;
      const tg = R.beamTarget;
      let vis = 0;
      if (tg && tg.isConnected && tg.offsetParent !== null) {
        const r = tg.getBoundingClientRect();
        if (r.height > 0) {
          const y0 = (r.top - rr.top) / sc, y1 = (r.bottom - rr.top) / sc, xl = 700, xr = 800;
          const lt = 104 + R.lensY0, lb = 104 + R.lensY1;
          const d = `M${xl} ${y0}C${xl + 50} ${y0} ${xr - 40} ${lt} ${xr} ${lt}L${xr} ${lb}C${xr - 40} ${lb} ${xl + 50} ${y1} ${xl} ${y1}Z`;
          R.beamP.setAttribute('d', d);
          R.beamE.setAttribute('d', `M${xl} ${y0}C${xl + 50} ${y0} ${xr - 40} ${lt} ${xr} ${lt}M${xl} ${y1}C${xl + 50} ${y1} ${xr - 40} ${lb} ${xr} ${lb}`);
          vis = 1;
        }
      }
      R.beamOn += ((vis ? 1 : 0) - R.beamOn) * (RM ? 1 : 0.18);
      R.beam.style.opacity = R.beamOn.toFixed(3);
      beamRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  // ------------------------------------------------------------------ states: render(k) shows the finished state of step k instantly (k = -1: before anything)
  function render(k) {
    const { trip, eric, A, B, Ev, C, T } = R;
    R.fxLayer.innerHTML = '';
    R.rw.style.opacity = '0';
    // panes
    trip.pane.style.transform = k >= 3 ? 'translateX(-32%)' : '';
    trip.pane.style.filter = k >= 3 ? 'brightness(.6)' : '';
    trip.pane.style.visibility = k >= 3 ? 'hidden' : '';
    eric.pane.style.transform = k >= 3 ? '' : 'translateX(100%)';
    eric.pane.style.visibility = k >= 3 ? '' : 'hidden';
    // Sarah: A (the messy note) in step 0, B (fixed) from step 1
    A.el.style.display = k === 0 ? '' : 'none';
    A.progress(k === 0 ? 1e9 : -1); A.say(k === 0 ? 1e9 : -1);
    B.el.style.display = k >= 1 ? '' : 'none';
    B.progress(k >= 1 ? 1e9 : -1); B.say(k >= 1 ? 1e9 : -1);
    B.tr.classList.toggle('reveal', k >= 2);
    trip.input.classList.remove('draft');
    trip.input.querySelector('.cv-pill').classList.remove('off');
    trip.input.querySelector('.cv-mark').classList.remove('busy');
    // Eric
    Ev.el.style.display = k >= 3 ? '' : 'none';
    if (k >= 4) setEricAfter(); else setEricBefore();
    Ev.progress(k >= 3 ? 1e9 : -1); Ev.say(k >= 3 ? 1e9 : -1);
    show(R.tchip, k >= 4);
    R.sheet.style.display = k >= 4 ? '' : 'none';
    R.setLevel(k >= 4 ? 1 : 0);
    // lens
    R.lens.style.opacity = k >= 0 ? '' : '0';
    R.vClean.style.display = k <= 2 ? '' : 'none';
    R.vTone.style.display = k >= 3 ? '' : 'none';
    Object.assign(C.S, k <= 0 ? { m: 0, mode: 'B', t: k === 0 ? 1e9 : -1, reached: k === 0 ? 1e9 : -1, ai: false } : { m: 1, mode: 'A', t: 1e9, reached: 1e9, ai: k >= 2 });
    C.paint();
    C.chips.forEach(({ el }) => { show(el, k === 0); el.classList.remove('struck'); });
    C.count.querySelector('.now').textContent = fmt(k >= 1 ? M.durA : M.durB);
    C.count.querySelector('.was').classList.toggle('on', k >= 1);
    show(C.ghost, k >= 1);
    C.gens.forEach((g) => show(g, k >= 2));
    show(C.gchip, k >= 2); show(C.leaders, k >= 2);
    show(C.prompt, k === 1);
    show(C.ph, k >= 0);
    // tone lens
    T.before(k >= 3 ? 1e9 : -1);
    T.after(k >= 4 ? 1e9 : -1);
    T.gB.querySelectorAll('path').forEach((p) => p.classList.toggle('dim', k >= 4));
    T.gRise.style.opacity = k >= 4 ? '.3' : '';
    show(T.rowB.g, k <= 3); show(T.rowA.g, k >= 4);
    show(T.upG, k >= 3); show(T.q, k >= 3);
    T.upG.style.opacity = T.q.style.opacity = k >= 4 ? '.3' : '';
    show(T.dnG, k >= 4); show(T.dotq, k >= 4);
    setLensSpan(k >= 3);
    R.beamTarget = k === 0 ? A.row : k === 1 || k === 2 ? B.row : k >= 3 ? Ev.row : null;
  }
  function setLensSpan(tone) {
    R.lensY0 = tone ? LT.top - 40 : LC.mid - LC.half - 40;
    R.lensY1 = tone ? LT.bot + 40 : LC.mid + LC.half + 40;
  }
  function setEricBefore() {
    if (R.Ev.key === 'tone.before') return;
    R.Ev.setClip('tone.before');
    R.Ev.words[R.Ev.words.length - 1].s.classList.add('rise');
  }
  function setEricAfter() {
    if (R.Ev.key === 'tone.after') return;
    R.Ev.setClip('tone.after');
    R.Ev.words[R.Ev.words.length - 1].s.classList.add('fall');
  }

  // ------------------------------------------------------------------ the five steps (each starts from render(k - 1) and ends at render(k))
  const live = (ep) => ep === epoch;

  async function step0(ep) {
    const { A, C } = R;
    render(-1);
    await wait(600); if (!live(ep)) return;
    sfx('pop');
    A.el.style.display = '';
    A.el.style.transformOrigin = '0 100%';
    popIn(A.el, { s: 0.55, dy: 30, ms: 460 });
    R.lens.style.opacity = '';
    fx(R.lens, [{ opacity: 0, transform: 'translateX(-40px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)', delay: 80 });
    show(C.ph, true);
    R.beamTarget = A.row;
    await wait(450); if (!live(ep)) return;           // the pop ends ~0.13 s after it starts; the clip starts 0.45 s later
    const shown = new Set();
    await playClip('clean.before', (t) => {
      A.progress(t); A.say(t);
      C.S.t = t; C.S.reached = Math.max(C.S.reached, t); C.paint();
      for (const c of C.chips) if (!shown.has(c) && t >= c.e.t0) { shown.add(c); show(c.el, true); popIn(c.el, { s: 0.5, dy: c.el.classList.contains('below') ? -14 : 14, ms: 420 }); }
    });
    if (!live(ep)) return;
    render(0);
  }

  async function step1(ep) {
    const { A, B, C, trip } = R;
    render(0);
    // rewind: the note un-plays, fast
    sfx('rewind');
    const rr = A.bub.getBoundingClientRect(), root = R.root.getBoundingClientRect(), sc = root.width / 1920 || 1;
    R.rw.style.left = `${(rr.left - root.left) / sc + rr.width / sc / 2 - 60}px`; R.rw.style.top = `${(rr.top - root.top) / sc + 40}px`;
    R.rw.style.opacity = '1';
    fx(R.rw, [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1.08)', offset: 0.35 }, { opacity: 1, transform: 'none', offset: 0.8 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 900, easing: 'ease-out' });
    later(900, () => { R.rw.style.opacity = '0'; });
    C.chips.forEach(({ el }) => el.classList.add('struck'));
    await tween(520, (p) => {
      const t = M.durB * (1 - p);
      A.progress(t); A.say(t);
      C.S.t = t; C.paint();
    }, Ease.inOut);
    if (!live(ep)) return;
    // into the input bar
    const field = trip.input.querySelector('.cv-field').getBoundingClientRect();
    const a = A.bub.getBoundingClientRect();
    const dx = (field.left + field.width / 2 - (a.left + a.width / 2)) / sc, dy = (field.top + field.height / 2 - (a.top + a.height / 2)) / sc;
    const fly = fx(A.el, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.18, .1)`, opacity: 0 }], { duration: 380, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    R.beamTarget = trip.input.querySelector('.cv-field');
    await wait(RM ? 0 : 360); if (!live(ep)) return;
    fly?.cancel();
    A.el.style.display = 'none';
    R.setDraft('clean.before');
    trip.input.classList.add('draft');
    trip.input.querySelector('.cv-mark').classList.add('busy');
    fx(trip.input.querySelector('.cv-draft'), [{ transform: 'scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: SPRING });
    fx(trip.input.querySelector('.cv-pill'), [{ transform: 'translateX(-30px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: SPRING, delay: 90 });
    // the fix: chips go, the cut spans collapse along the real time map, the message gets shorter
    later(120, () => C.chips.forEach(({ el }, i) => fx(el, [{ opacity: 1, transform: getComputedStyle(el).transform }, { opacity: 0, transform: `${getComputedStyle(el).transform} translateY(${el.classList.contains('below') ? 16 : -16}px) scale(.8)` }], { duration: 260, delay: i * 40, fill: 'forwards' })));
    await wait(380); if (!live(ep)) return;
    C.chips.forEach(({ el }) => show(el, false));
    let lastSec = Math.round(M.durB);
    const nowEl = C.count.querySelector('.now'), ddur = trip.input.querySelector('.cv-ddur');
    await tween(1250, (p) => {
      C.S.m = p; C.paint();
      const sec = Math.round(lerp(M.durB, M.durA, p));
      if (sec !== lastSec) { lastSec = sec; nowEl.textContent = fmt(sec); ddur.textContent = fmt(sec); sfx('tick'); fx(nowEl, [{ transform: 'translateY(-6px)', color: '#4cc89b' }, { transform: 'none', color: '#f3f2ee' }], { duration: 220 }); }
    }, Ease.inOut);
    if (!live(ep)) return;
    Object.assign(C.S, { m: 1, mode: 'A', t: -1 }); C.paint();
    R.setDraft('clean.after');
    C.count.querySelector('.was').classList.add('on');
    show(C.ghost, true); drawOn(C.ghost, 420);
    trip.input.querySelector('.cv-mark').classList.remove('busy');
    await wait(520); if (!live(ep)) return;
    // re-send
    sfx('swoosh', true);
    trip.input.classList.remove('draft');
    B.el.style.display = ''; B.progress(-1); B.say(-1);
    const b = B.bub.getBoundingClientRect();
    const bx = (field.left + field.width / 2 - (b.left + b.width / 2)) / sc, by = (field.top + field.height / 2 - (b.top + b.height / 2)) / sc;
    fx(B.el, [{ transform: `translate(${bx}px, ${by}px) scale(.2, .12)`, opacity: 0 }, { transform: 'translate(0, -10px) scale(1.02)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' });
    R.beamTarget = B.row;
    await wait(470); if (!live(ep)) return;
    sfx('sparkle');
    burst(B.bub, '#4cc89b');
    await wait(850); if (!live(ep)) return;            // sparkle ~0.5 s, then 0.35 s of quiet before the voice
    await playClip('clean.after', (t) => {
      B.progress(t); B.say(t);
      C.S.t = t; C.paint();
    });
    if (!live(ep)) return;
    await wait(450); if (!live(ep)) return;
    sfx('pop');
    show(C.prompt, true);
    popIn(C.prompt, { s: 0.85, dy: 16, ms: 480 });
  }

  async function step2(ep) {
    const { B, C } = R;
    render(1);
    sfx('sparkle');
    fx(C.prompt, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(12px)' }], { duration: 260, fill: 'forwards' });
    later(260, () => show(C.prompt, false));
    B.tr.classList.add('reveal');
    B.words.filter(({ s }) => s.classList.contains('gen')).forEach(({ s }, i) => fx(s, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 520, delay: i * 90, easing: 'ease-out' }));
    B.words.filter(({ s }) => s.classList.contains('gen')).forEach(({ s }) => { s.style.display = 'inline-block'; });
    later(800, () => B.words.forEach(({ s }) => { s.style.display = ''; }));
    C.S.ai = true; C.paint();
    C.gens.forEach((g, i) => { show(g, true); g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center'; fx(g, [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 460, delay: i * 120, easing: SPRING }); });
    burst(B.bub, '#4cc89b', 8);
    await wait(380); if (!live(ep)) return;
    show(C.leaders, true); drawOn(C.leaders, 380);
    show(C.gchip, true); popIn(C.gchip, { s: 0.6, dy: 14, ms: 460, delay: 120 });
  }

  async function step3(ep) {
    const { trip, eric, Ev, T } = R;
    render(2);
    sfx('swoosh', true);
    R.beamTarget = null;
    eric.pane.style.visibility = '';
    Ev.el.style.display = 'none';
    fx(R.vClean, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-30px)' }], { duration: 260, fill: 'forwards' });
    await tween(460, (p) => {
      trip.pane.style.transform = `translateX(${-32 * p}%)`; trip.pane.style.filter = `brightness(${1 - 0.4 * p})`;
      eric.pane.style.transform = `translateX(${100 * (1 - p)}%)`;
    }, Ease.out);
    if (!live(ep)) return;
    trip.pane.style.visibility = 'hidden';
    R.vClean.style.display = 'none';
    R.vTone.style.display = '';
    setLensSpan(true);
    show(T.upG, false); show(T.q, false);
    fx(R.vTone, [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
    await wait(260); if (!live(ep)) return;
    sfx('pop');
    Ev.el.style.display = ''; Ev.progress(-1); Ev.say(-1); T.before(-1);
    Ev.el.style.transformOrigin = '0 100%';
    popIn(Ev.el, { s: 0.55, dy: 30, ms: 460 });
    R.beamTarget = Ev.row;
    await wait(500); if (!live(ep)) return;
    let rose = false;
    await playClip('tone.before', (t) => {
      Ev.progress(t); Ev.say(t); T.before(t);
      if (!rose && t >= T.riseT + 0.24) { rose = true; show(T.upG, true); drawOn(T.upG, 380); show(T.q, true); popIn(T.q, { s: 0.3, dy: 20, ms: 520, delay: 160 }); }
    });
    if (!live(ep)) return;
    render(3);
  }

  async function step4(ep) {
    const { Ev, T, sheet } = R;
    render(3);
    sfx('pop');
    sheet.style.display = '';
    R.setLevel(0);
    fx(sheet, [{ opacity: 0, transform: 'translateY(40px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: SPRING });
    await wait(520); if (!live(ep)) return;
    let notch = 0;
    await tween(1250, (p) => {
      R.setLevel(p);
      const n = Math.floor(p * 10 + 1e-6);
      if (n > notch) { notch = n; sfx('tick'); }
    }, Ease.inOut);
    if (!live(ep)) return;
    R.setLevel(1);
    await wait(140); if (!live(ep)) return;
    sfx('sparkle');
    show(R.tchip, true); popIn(R.tchip, { s: 0.4, dy: 0, ms: 460 });
    setEricAfter(); Ev.progress(-1); Ev.say(-1);
    burst(Ev.bub, '#7088ff', 8);
    T.gB.querySelectorAll('path').forEach((p) => p.classList.add('dim'));
    T.gRise.style.opacity = '.3'; T.upG.style.opacity = '.3'; T.q.style.opacity = '.3';
    T.after(-1);
    show(T.rowB.g, false); show(T.rowA.g, true);
    await wait(850); if (!live(ep)) return;
    let fell = false;
    await playClip('tone.after', (t) => {
      Ev.progress(t); Ev.say(t); T.after(t);
      if (!fell && t >= T.fallT + 0.3) { fell = true; show(T.dnG, true); drawOn(T.dnG, 380); show(T.dotq, true); popIn(T.dotq, { s: 0.3, dy: -10, ms: 480, delay: 160 }); }
    });
    if (!live(ep)) return;
    render(4);
  }
  const STEPS = [step0, step1, step2, step3, step4];

  /** A small burst of four-point stars around an element (the "fixed" moment). */
  function burst(el, color, n = 12) {
    if (RM) return;
    const rr = R.root.getBoundingClientRect(), sc = rr.width / 1920 || 1, r = el.getBoundingClientRect();
    const cx = (r.left - rr.left) / sc + r.width / sc / 2, cy = (r.top - rr.top) / sc + r.height / sc / 2;
    const w = r.width / sc, hh = r.height / sc;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, s = 14 + Math.random() * 16;
      const sx = cx + Math.cos(a) * w * 0.42, sy = cy + Math.sin(a) * hh * 0.42;
      const st = h('div', '', `<svg viewBox="-10 -10 20 20" width="${s}" height="${s}"><path d="M0-10L2.6-2.6 10 0 2.6 2.6 0 10-2.6 2.6-10 0-2.6-2.6Z" fill="${color}"/></svg>`);
      st.style.cssText = `position:absolute;left:${sx - s / 2}px;top:${sy - s / 2}px;opacity:0`;
      R.fxLayer.appendChild(st);
      const ox = Math.cos(a) * (60 + Math.random() * 50), oy = Math.sin(a) * (40 + Math.random() * 40);
      const an = fx(st, [{ opacity: 0, transform: 'scale(.2) rotate(0deg)' }, { opacity: 1, transform: `translate(${ox * 0.5}px, ${oy * 0.5}px) scale(1.1) rotate(40deg)`, offset: 0.35 },
        { opacity: 0, transform: `translate(${ox}px, ${oy}px) scale(.4) rotate(90deg)` }], { duration: 760 + Math.random() * 240, delay: Math.random() * 120, easing: 'ease-out', fill: 'forwards' });
      an?.finished.then(() => st.remove(), () => st.remove());
    }
  }

  // ------------------------------------------------------------------ deck hooks
  let built = false;
  function ensure(slide) {
    if (built) return;
    const root = slide.querySelector('#chat-root') || slide;
    build(root);
    built = true;
    Deck_sub();
  }
  let subbed = false;
  function Deck_sub() {
    if (subbed || !window.Deck?.onAudio) return;
    subbed = true;
    window.Deck.onAudio((key, t, audio) => { if (run && run.audio === audio && run.key === key) run.feed(t); });
  }

  window.HOOKS = window.HOOKS || {};
  window.HOOKS.chat = {
    init(slide) { ensure(slide); render(-1); },
    enter(slide) { ensure(slide); cancelAll(); render(-1); beamLoop(); },
    step(slide, k, o = {}) {
      ensure(slide); cancelAll();
      k = clamp(k | 0, 0, 4);
      if (o.back) { render(k); return; }
      STEPS[k](epoch);
    },
    leave() { cancelAll(); cancelAnimationFrame(beamRaf); },
  };
})();
