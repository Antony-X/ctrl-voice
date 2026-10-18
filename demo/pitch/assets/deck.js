/* Ctrl+Voice pitch deck: navigation, steps, audio players, speaker notes, auto mode. Works from file:// (no fetch). */
'use strict';
(function () {
  const W = 1920, H = 1080;
  const stage = document.getElementById('stage');
  const slides = Array.from(document.querySelectorAll('#stage > .slide'));
  const params = new URLSearchParams(location.search);
  const AUTO = params.has('auto');
  const REAL = window.EXAMPLES || {};
  const PH = params.has('real') ? {} : (window.PLACEHOLDER_EXAMPLES || {});
  const PEAKS = window.CV_PEAKS || {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mmss = (t) => { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  if (AUTO) document.body.classList.add('auto');

  // ------------------------------------------------------------------ stage scaling (letterboxed 16:9)
  function fit() { stage.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`; }
  addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------------ examples and clips
  function exampleFor(id) {
    if (REAL[id]) return { ex: REAL[id], base: `examples/${id}/`, placeholder: false };
    if (PH[id]) return { ex: PH[id], base: `placeholders/${id}/`, placeholder: true };
    return null;
  }
  function resolveSrc(base, src) {
    if (!src) return null;
    if (/^(https?:|file:|data:|blob:)/.test(src)) return src;
    if (src.startsWith('./')) return base + src.slice(2);
    return src.includes('/') ? src : base + src;
  }
  const TAGS = {
    filler: 'filler', um: 'filler', scratched: 'scratched', scratch: 'scratched', command: 'scratched', 'taken back': 'scratched',
    cut: 'scratched', correction: 'correction', 'self-correction': 'correction', repetition: 'correction', repeat: 'correction',
    mispronounced: 'misspoken', misspoken: 'misspoken', grammar: 'misspoken', wrong: 'misspoken',
    regenerated: 'regenerated', generated: 'regenerated', ai: 'regenerated', replaced: 'regenerated', new: 'regenerated',
  };
  const CUTLIKE = new Set(['filler', 'scratched', 'correction', 'misspoken']);
  function normWords(ws) {
    return (ws || []).map((x) => {
      const w = typeof x === 'string' ? { w: x } : x;
      const s = Number.isFinite(+w.s) && w.s !== null && w.s !== '' ? +w.s : null;
      const e = Number.isFinite(+w.e) && w.e !== null && w.e !== '' ? +w.e : null;
      return { w: String(w.w ?? w.word ?? w.text ?? ''), s, e, tag: TAGS[String(w.tag || '').toLowerCase()] || null };
    }).filter((w) => w.w.trim());
  }
  const clips = {};
  function getClip(key) {
    if (key in clips) return clips[key];
    const [id, side] = key.split('.');
    const found = exampleFor(id);
    const data = found && found.ex[side];
    if (!data || !data.src) return (clips[key] = null);
    const words = normWords(data.words);
    const timed = words.length > 0 && words.every((w) => w.s !== null && w.e !== null);
    const clip = {
      key, id, side, ex: found.ex, data, base: found.base, placeholder: found.placeholder,
      src: resolveSrc(found.base, data.src), words, timed, ok: null, levels: null,
      dur: +data.dur || (timed ? words[words.length - 1].e + 0.3 : 0) || 5,
    };
    const pk = PEAKS[clip.src];
    if (pk && (!data.dur || Math.abs(pk.dur - data.dur) < 0.25)) clip.peaks = pk;
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('loadedmetadata', () => {
      clip.ok = true;
      if (clip.peaks && Math.abs(clip.peaks.dur - a.duration) > 0.25) { clip.peaks = null; rerender(clip.key); }
    });
    a.addEventListener('error', () => { clip.ok = false; console.warn('audio failed to load:', clip.src); toast(`Audio missing: ${clip.src}`); });
    a.addEventListener('ended', () => onEnded(clip));
    a.src = clip.src;
    clip.audio = a;
    if (!clip.peaks && location.protocol.startsWith('http')) decodePeaks(clip);
    return (clips[key] = clip);
  }
  function decodePeaks(clip) {           // only over http(s): file:// blocks fetch, so peaks.js covers that case
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    fetch(clip.src).then((r) => r.arrayBuffer()).then((buf) => new AC().decodeAudioData(buf)).then((ab) => {
      const x = ab.getChannelData(0), rate = 50, hop = Math.floor(ab.sampleRate / rate), n = Math.floor(x.length / hop);
      const db = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = i * hop; j < (i + 1) * hop; j++) s += x[j] * x[j];
        db[i] = 20 * Math.log10(Math.sqrt(s / hop) + 1e-6);
      }
      const hi = Array.from(db).sort((a, b) => a - b)[Math.floor(n * 0.98)], lo = hi - 42;
      clip.peaks = { dur: ab.duration, rate, p: Array.from(db, (d) => Math.pow(clamp((d - lo) / (hi - lo), 0, 1), 1.25)) };
      rerender(clip.key);
    }).catch(() => {});
  }
  function level(clip, t0, t1) {
    if (clip.peaks) {
      const p = clip.peaks.p, r = clip.peaks.rate;
      let m = 0;
      for (let i = Math.floor(t0 * r); i <= Math.min(p.length - 1, Math.floor(t1 * r)); i++) m = Math.max(m, p[i] || 0);
      return m;
    }
    const mid = (t0 + t1) / 2;                       // no peaks: a stand-in shape from the word timings
    const inWord = clip.timed && clip.words.some((w) => mid >= w.s && mid <= w.e);
    const k = Math.floor(mid * 37) % 7;
    return inWord ? 0.45 + 0.08 * k : (clip.timed ? 0.03 : 0.25 + 0.05 * k);
  }
  function voiceLabel(clip, el) {
    const sp = clip.ex.speaker || {};
    const own = el && (clip.side === 'after' ? el.dataset.labelAfter || (el.dataset.swap ? '' : el.dataset.label) : el.dataset.label);
    return clip.data.label || own || sp.label || (clip.ex.synthetic ? 'AI-generated demo voice' : '');
  }

  // ------------------------------------------------------------------ player (waveform + karaoke transcript)
  const players = [];
  class Player {
    constructor(el) {
      this.el = el;
      this.slide = el.closest('.slide');
      this.keys = [el.dataset.clip, el.dataset.swap].filter(Boolean);
      this.shown = null;
      this.state = 'idle';
      el.classList.add('player', 'idle');
      if (el.classList.contains('after')) el.classList.add('gen');
      el.innerHTML = '<div class="p-head"><span class="p-chip"></span><span class="p-voice"></span><span class="p-time"></span></div>' +
        '<div class="p-wave"></div><div class="p-text"></div>';
      this.chip = $('.p-chip', el); this.voice = $('.p-voice', el); this.time = $('.p-time', el);
      this.wave = $('.p-wave', el); this.text = $('.p-text', el);
    }
    name(side) { return side === 'after' ? (this.el.dataset.nameAfter || this.el.dataset.name || 'After') : (this.el.dataset.name || 'Before'); }
    show(key, pps) {
      const clip = getClip(key);
      const side = key.split('.')[1];
      this.shown = key;
      this.pps = pps || this.pps || 100;
      this.el.classList.toggle('gen', side === 'after');
      this.chip.textContent = this.name(side);
      $$('.ring', this.el).forEach((r) => r.remove());
      if (!clip) {
        this.voice.textContent = '';
        this.time.textContent = '';
        this.wave.outerHTML = '<div class="p-empty">Example not added yet</div>';
        this.wave = $('.p-empty', this.el);
        this.text.innerHTML = '';
        return;
      }
      if (!this.wave.classList.contains('p-wave')) {
        this.wave.outerHTML = '<div class="p-wave"></div>';
        this.wave = $('.p-wave', this.el);
      }
      this.voice.textContent = voiceLabel(clip, this.el);
      this.time.textContent = `${clip.dur.toFixed(1)} s`;
      this.drawWave(clip);
      this.drawText(clip);
      this.setState('idle');
    }
    focusSpan(clip) {
      const f = clip.ex.focus;
      const t0 = f && (clip.side === 'after' ? f.afterT0 : f.beforeT0), t1 = f && (clip.side === 'after' ? f.afterT1 : f.beforeT1);
      const tagged = clip.words.findIndex((w) => w.tag === (clip.side === 'after' ? 'regenerated' : 'misspoken'));
      let k = tagged;
      if (k < 0 && Number.isFinite(t0)) k = clip.words.findIndex((w) => w.s !== null && (w.s + w.e) / 2 >= t0 && (w.s + w.e) / 2 <= t1);
      const band = Number.isFinite(t0) && Number.isFinite(t1) ? [t0, t1] : (k >= 0 && clip.timed ? [clip.words[k].s, clip.words[k].e] : null);
      return { k, band };
    }
    drawWave(clip) {
      const h = this.wave.clientHeight || 104, pitch = 8, bw = 4, pps = this.pps;
      const w = Math.max(48, clip.dur * pps), n = Math.max(6, Math.floor(w / pitch));
      const spans = clip.timed ? clip.words.filter((x) => x.tag) : [];
      const isFocus = this.el.dataset.swap !== undefined;
      const band = isFocus ? this.focusSpan(clip).band : null;
      let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
      if (band) svg += `<rect class="band" x="${band[0] * pps - 6}" y="-10" width="${(band[1] - band[0]) * pps + 12}" height="${h + 20}" rx="12"/>`;
      this.bars = [];
      for (let i = 0; i < n; i++) {
        const t0 = (i * pitch) / pps, t1 = ((i + 1) * pitch) / pps, mid = (t0 + t1) / 2;
        const bh = Math.max(5, level(clip, t0, t1) * h);
        const tag = spans.find((x) => mid >= x.s - 0.02 && mid <= x.e + 0.02);
        const cls = tag ? (tag.tag === 'regenerated' ? ' gen' : (CUTLIKE.has(tag.tag) ? ' cut' : '')) : '';
        svg += `<rect class="b${cls}" x="${i * pitch + (pitch - bw) / 2}" y="${(h - bh) / 2}" width="${bw}" height="${bh}" rx="2"/>`;
        this.bars.push(mid);
      }
      svg += `<line class="head" x1="0" x2="0" y1="-10" y2="${h + 10}"/></svg>`;
      this.wave.innerHTML = svg;
      this.rects = $$('rect.b', this.wave);
      this.head = $('.head', this.wave);
      this.played = 0;
    }
    drawText(clip) {
      this.text.style.fontSize = '';
      if (!clip.words.length) { this.text.innerHTML = `<span class="p-plain">${esc(clip.data.text || '')}</span>`; return; }
      if (!clip.timed) { this.text.innerHTML = `<span class="p-plain">${esc(clip.words.map((w) => w.w).join(' '))}</span>`; this.spans = []; return; }
      this.text.innerHTML = clip.words.map((w, i) => `<span class="w${w.tag ? ' ' + w.tag : ''}" data-i="${i}">${esc(w.w)}</span>`).join(' ');
      this.spans = $$('.w', this.text);
      this.said = 0;
      this.fitText();
      if (this.el.dataset.swap !== undefined) this.ring(clip);
    }
    fitText() {
      const max = parseFloat(getComputedStyle(this.text).maxHeight) || 9999;
      let size = parseFloat(getComputedStyle(this.text).fontSize);
      while (this.text.scrollHeight > max + 1 && size > 22) { size -= 2; this.text.style.fontSize = `${size}px`; }
    }
    ring(clip) {
      const { k } = this.focusSpan(clip);
      if (k < 0 || !this.spans[k]) return;
      const sp = this.spans[k];
      // An ellipse only clears a box's corners when its semi-axes are about 1.2x the box's half-sizes,
      // so size it from the word box and push the neighbouring words out by the same amount.
      const w0 = sp.offsetWidth, h0 = sp.offsetHeight;
      const rx = (w0 / 2) * 1.2 + 8, ry = (h0 / 2) * 1.16 + 4;
      sp.classList.add('focusw');
      sp.style.margin = `0 ${Math.round(rx - w0 / 2)}px`;
      const cx = sp.offsetLeft + w0 / 2, cy = sp.offsetTop + h0 / 2, m = 6;
      const len = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry))) * 1.04;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', `ring${clip.side === 'after' ? ' gen' : ''}`);
      svg.setAttribute('width', 2 * (rx + m)); svg.setAttribute('height', 2 * (ry + m));
      svg.style.left = `${cx - rx - m}px`; svg.style.top = `${cy - ry - m}px`;
      svg.style.setProperty('--len', `${len}px`);
      svg.innerHTML = `<ellipse cx="${rx + m}" cy="${ry + m}" rx="${rx}" ry="${ry}" transform="rotate(-2 ${rx + m} ${ry + m})" stroke-dasharray="${len}" />`;
      this.text.appendChild(svg);
      requestAnimationFrame(() => svg.classList.add('draw'));
    }
    setState(st) {
      this.state = st;
      this.el.classList.remove('idle', 'playing', 'paused', 'done');
      this.el.classList.add(st);
      if (st === 'idle' || st === 'done') this.reset(st === 'done');
    }
    reset(all) {
      (this.spans || []).forEach((sp) => { sp.classList.toggle('said', !!all); sp.classList.remove('now'); });
      (this.rects || []).forEach((r) => r.classList.toggle('played', !!all));
      this.said = all ? (this.spans || []).length : 0;
      this.played = all ? (this.rects || []).length : 0;
    }
    update(t) {
      const clip = getClip(this.shown);
      if (!clip || !this.rects) return;
      if (this.played > 0 && this.bars[this.played - 1] > t + 0.05) { this.reset(false); }
      while (this.played < this.bars.length && this.bars[this.played] <= t) this.rects[this.played++].classList.add('played');
      if (this.head) { const x = t * this.pps; this.head.setAttribute('x1', x); this.head.setAttribute('x2', x); }
      if (!clip.timed) return;
      const ws = clip.words;
      while (this.said < ws.length && ws[this.said].s <= t) this.spans[this.said++].classList.add('said');
      this.spans.forEach((s, i) => s.classList.toggle('now', ws[i].s <= t && t < ws[i].e));
    }
  }
  $$('.player[data-clip]').forEach((el) => players.push(new Player(el)));
  function playersFor(key) { return players.filter((p) => p.shown === key); }
  function rerender(key) {
    players.filter((p) => p.shown === key).forEach((p) => {
      const st = p.state;
      p.show(key, p.pps);
      p.setState(st);
    });
  }
  function layoutSlide(s) {
    const ps = players.filter((p) => p.slide === s);
    if (!ps.length) return;
    let maxDur = 0;
    ps.forEach((p) => p.keys.forEach((k) => { const c = getClip(k); if (c) maxDur = Math.max(maxDur, c.dur); }));
    const width = Math.min(...ps.map((p) => p.el.clientWidth || 1696));
    const pps = maxDur ? width / maxDur : 100;
    ps.forEach((p) => p.show(p.keys[0], pps));
    $$('.foot[data-ex]', s).forEach((f) => {
      f.innerHTML = footFor(f.dataset.ex);
      f.style.fontSize = '';
      let size = parseFloat(getComputedStyle(f).fontSize);   // long dataset credits: shrink to fit two lines
      while (f.offsetHeight > 2.9 * size && size > 16) { size -= 1; f.style.fontSize = `${size}px`; }
    });
    $$('.ex-caption[data-ex]', s).forEach((c) => { const f = exampleFor(c.dataset.ex); c.textContent = (f && f.ex.caption) || ''; });
  }
  function footFor(id) {
    const found = exampleFor(id);
    if (!found) return '';
    const sp = found.ex.speaker || {};
    if (found.ex.synthetic && !sp.dataset) return '';
    // the attribution line usually names the licence already; only add the licence when it does not
    const lic = sp.license && !(sp.attribution || '').includes(sp.license) ? sp.license : '';
    const bits = [sp.dataset, lic, sp.attribution].filter(Boolean).map(esc);
    return sp.label || bits.length ? `<b>${esc(sp.label || 'Speaker')}</b>${bits.length ? ' · ' + bits.join(' · ') : ''}` : '';
  }

  // ------------------------------------------------------------------ audio control
  let current = null, lastKey = null, delayT = null, rafId = null;
  function play(key, delay) {
    stopAudio();
    lastKey = key;
    const clip = getClip(key);
    players.filter((p) => p.keys.includes(key) && p.shown !== key).forEach((p) => p.show(key, p.pps));
    if (!clip) { scheduleAuto(3); renderNotes(); return; }
    const start = () => {
      current = clip;
      clip.audio.currentTime = 0;
      playersFor(key).forEach((p) => p.setState('playing'));
      const pr = clip.audio.play();
      if (pr && pr.catch) pr.catch((err) => {
        if (current !== clip) return;
        playersFor(key).forEach((p) => p.setState('idle'));
        current = null;
        toast(err && err.name === 'NotAllowedError' ? 'The browser blocked audio: press R to play' : `Can't play ${clip.src}`);
        scheduleAuto(3);
      });
      tick();
    };
    if (delay > 0) delayT = setTimeout(start, delay * 1000); else start();
  }
  function stopAudio() {
    clearTimeout(delayT);
    if (!current) return;
    const c = current;
    current = null;
    c.audio.pause();
    playersFor(c.key).forEach((p) => p.setState(c.audio.currentTime > 0.05 ? 'done' : 'idle'));
  }
  function onEnded(clip) {
    if (current !== clip) return;
    playersFor(clip.key).forEach((p) => p.setState('done'));
    current = null;
    renderNotes();
    scheduleAuto(1);
  }
  function tick() {
    cancelAnimationFrame(rafId);
    const loop = () => {
      if (!current) return;
      playersFor(current.key).forEach((p) => p.update(current.audio.currentTime));
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }
  function pauseResume() {
    if (!current) return;
    if (current.audio.paused) { current.audio.play(); playersFor(current.key).forEach((p) => p.setState('playing')); tick(); }
    else { current.audio.pause(); playersFor(current.key).forEach((p) => p.setState('paused')); }
    renderNotes();
  }
  function replay() {
    const s = slides[cur];
    const a = $(`[data-step="${step}"][data-audio]`, s);
    const key = a ? a.dataset.audio : lastKey;
    if (key) play(key, 0);
  }

  // ------------------------------------------------------------------ slide-specific moments
  let timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const ENTER = {
    hook(s) {
      const typed = $('.typed', s), caret = $('.caret', s), ok = $('.okmark', s);
      const text = typed.dataset.text, wrong = typed.dataset.wrong, right = typed.dataset.right;
      const i = text.indexOf(wrong), pre = text.slice(0, i), post = text.slice(i + wrong.length);
      typed.innerHTML = `<span class="pre"></span><span class="word"><span class="wt"></span><span class="squiggle"></span>` +
        `<span class="suggest">${esc(right)}</span></span><span class="post"></span>`;
      const [P, wt, Q] = [$('.pre', typed), $('.wt', typed), $('.post', typed)];
      const word = $('.word', typed), sq = $('.squiggle', typed), sg = $('.suggest', typed);
      caret.classList.remove('off'); ok.classList.remove('show');
      const T0 = 500, dt = 48;
      for (let c = 0; c <= text.length; c++) {
        at(T0 + c * dt, () => {
          P.textContent = pre.slice(0, c);
          wt.textContent = wrong.slice(0, Math.max(0, c - pre.length));
          Q.textContent = post.slice(0, Math.max(0, c - pre.length - wrong.length));
        });
      }
      const T1 = T0 + text.length * dt;
      at(T1 + 350, () => sq.classList.add('drawn'));
      at(T1 + 900, () => sg.classList.add('show'));
      at(T1 + 1700, () => sg.classList.add('press'));
      at(T1 + 1850, () => { wt.textContent = right; word.classList.add('fixed'); sq.classList.add('gone'); sg.classList.add('hide'); });
      at(T1 + 2300, () => { ok.classList.add('show'); caret.classList.add('off'); });
      at(T1 + 3300, () => word.classList.add('settled'));
    },
    wave(s) {
      const box = $('.hookwave', s);
      if (!box.childElementCount) {
        const bars = window.HOOK_BARS || [];
        let html = '', k = 0;
        while (k < bars.length) {
          const cut = bars[k][1];
          let j = k;
          let inner = '';
          while (j < bars.length && bars[j][1] === cut) { inner += `<i class="bar" style="height:${Math.max(6, bars[j][0] * 150).toFixed(1)}px"></i>`; j++; }
          html += `<div class="seg${cut ? ' cut' : ''}" style="max-width:${(j - k) * 8}px">${inner}${cut ? '<span class="squiggle"></span>' : ''}</div>`;
          k = j;
        }
        box.innerHTML = html;
      }
      box.classList.remove('in', 'fixed');
      $$('.squiggle', box).forEach((q) => q.classList.remove('drawn'));
      void box.offsetWidth;
      at(80, () => box.classList.add('in'));
      at(1000, () => $$('.squiggle', box).forEach((q) => q.classList.add('drawn')));
    },
  };
  const STEP = {
    wave(s, k) { $('.hookwave', s).classList.toggle('fixed', k >= 1); },
    tone(s, k) { const t = $('.tone', s); t.classList.toggle('set', k >= 1); $('.val', t).textContent = k >= 1 ? 'Strong' : 'Off'; },
  };

  // ------------------------------------------------------------------ navigation
  let cur = -1, step = 0, slideT0 = 0, talkT0 = null;
  const nSteps = (i) => {
    const s = slides[i];
    let m = 0;
    $$('[data-step]', s).forEach((e) => { m = Math.max(m, +e.dataset.step); });
    return Math.max(m + 1, +(s.dataset.steps || 1));
  };
  function enter(i) {
    const s = slides[i];
    s.classList.add('active');
    s.classList.remove('entered');
    void s.offsetWidth;
    s.classList.add('entered');
    layoutSlide(s);
    slideT0 = performance.now();
    if (ENTER[s.dataset.id]) ENTER[s.dataset.id](s);
  }
  function leave(i) {
    if (i < 0) return;
    const s = slides[i];
    timers.forEach(clearTimeout);
    timers = [];
    s.classList.remove('active', 'entered');
    players.filter((p) => p.slide === s).forEach((p) => { p.el.classList.remove('dim'); p.setState('idle'); });
  }
  function go(i, k) {
    i = clamp(i, 0, slides.length - 1);
    k = clamp(k, 0, nSteps(i) - 1);
    if (i === cur && k === step) return;
    clearTimeout(autoT);
    if (i !== cur) { stopAudio(); lastKey = null; leave(cur); cur = i; enter(i); }
    step = k;
    const s = slides[i];
    $$('[data-step]', s).forEach((e) => e.classList.toggle('on', +e.dataset.step <= k));
    s.dataset.now = k;
    if (STEP[s.dataset.id]) STEP[s.dataset.id](s, k);
    const a = $(`[data-step="${k}"][data-audio]`, s);
    players.filter((p) => p.slide === s).forEach((p) => {
      const mine = +p.el.dataset.step === k || (a && p.keys.includes(a.dataset.audio));
      p.el.classList.toggle('dim', !mine && +p.el.dataset.step < k && p.el.dataset.swap === undefined);
    });
    if (a) play(a.dataset.audio, +(a.dataset.audioDelay || 0));
    else scheduleAuto();
    try { history.replaceState(null, '', `${location.pathname}${location.search}#${i + 1}.${k}`); } catch (e) { /* file:// quirks */ }
    renderNotes();
  }
  function next() {
    if (talkT0 === null) talkT0 = performance.now();
    if (step < nSteps(cur) - 1) go(cur, step + 1);
    else if (cur < slides.length - 1) go(cur + 1, 0);
  }
  function prev() {
    if (step > 0) go(cur, step - 1);
    else if (cur > 0) go(cur - 1, nSteps(cur - 1) - 1);
  }

  // ------------------------------------------------------------------ auto mode (?auto): timed playback, no narrator
  let autoT = null, autoOn = false;
  function stepSecs(i) {
    const s = slides[i], n = nSteps(i);
    let audioSecs = 0, audioSteps = 0;
    for (let k = 0; k < n; k++) {
      const a = $(`[data-step="${k}"][data-audio]`, s);
      if (!a) continue;
      const c = getClip(a.dataset.audio);
      audioSecs += (c ? c.dur : 3) + 1 + (+(a.dataset.audioDelay || 0));
      audioSteps++;
    }
    const rest = Math.max(0, (+s.dataset.target || 8) - audioSecs);
    return n > audioSteps ? Math.max(2.5, rest / (n - audioSteps)) : 0;
  }
  function scheduleAuto(secs) {
    clearTimeout(autoT);
    if (!AUTO || !autoOn) return;
    if (cur === slides.length - 1 && step === nSteps(cur) - 1) {
      autoT = setTimeout(() => { autoOn = false; document.body.classList.add('auto-done'); renderNotes(); }, (secs ?? stepSecs(cur)) * 1000);
      return;
    }
    autoT = setTimeout(next, (secs ?? stepSecs(cur)) * 1000);
  }

  // ------------------------------------------------------------------ speaker notes (popup window, or overlay on N)
  let notesWin = null, overlayOn = false;
  const NOTES_DOC = `<!doctype html><html><head><meta charset="utf-8"><title>Ctrl+Voice: speaker notes</title><style>
    :root{color-scheme:dark} body{margin:0;background:#171716;color:#F3F2EE;font:400 20px/1.4 "Segoe UI",system-ui,sans-serif}
    .top{display:flex;gap:28px;align-items:baseline;padding:18px 28px;background:#201F1E;border-bottom:1px solid #34322F;flex-wrap:wrap}
    .top b{font-size:26px} .muted{color:#A8A49C} .over{color:#F0A73A;font-weight:600} .clip{color:#4CC89B}
    #script{padding:26px 28px;font:400 36px/1.45 "Segoe UI",system-ui,sans-serif} #script em{color:#A8A49C}
    #script p{margin:0 0 .6em} .next{padding:14px 28px;border-top:1px solid #34322F;color:#A8A49C}
    .keys{padding:10px 28px 18px;color:#75716A;font-size:16px}</style></head><body>
    <div class="top"><b id="slide"></b><span id="step" class="muted"></span><span id="clock"></span><span id="sclock"></span><span id="clip" class="clip"></span></div>
    <div id="script"></div><div class="next" id="next"></div>
    <div class="keys">→ / Space / PageDown / click: next · ← / PageUp: back · P pause · R replay · F fullscreen (deck window) · T reset clock · N notes on stage</div>
    </body></html>`;
  function notesInfo() {
    const s = slides[cur];
    if (!s) return null;
    const n = nSteps(cur), now = performance.now();
    const target = +s.dataset.target || 0, el = (now - slideT0) / 1000;
    const total = talkT0 === null ? 0 : (now - talkT0) / 1000;
    let clipTxt = '—';
    if (current) {
      const a = current.audio, left = Math.max(0, (a.duration || current.dur) - a.currentTime);
      clipTxt = `${a.paused ? 'Paused' : 'Playing'}: ${current.id} ${current.side}${current.placeholder ? ' (placeholder)' : ''} · ${left.toFixed(1)} s left`;
    } else if (delayT && lastKey) clipTxt = `Starting: ${lastKey}`;
    const nextS = s.dataset.next || (slides[cur + 1] ? `Next slide: ${slides[cur + 1].dataset.title}` : 'Last slide');
    const ex = s.dataset.ex && exampleFor(s.dataset.ex);
    const exTxt = s.dataset.ex ? (ex ? (ex.placeholder ? ' · example: PLACEHOLDER' : '') : ' · example: NOT ADDED YET') : '';
    return {
      slide: `${cur + 1}/${slides.length} · ${s.dataset.title}`,
      step: `step ${step + 1}/${n}${exTxt}`,
      clock: talkT0 === null ? 'talk clock starts on your first click' : `total ${mmss(total)} / 3:00`,
      over: el > target && target > 0, overTotal: total > 180,
      sclock: `this slide ${mmss(el)} / ${target}s (${s.dataset.time || ''})`,
      clip: clipTxt, script: ($('.notes', s) || {}).innerHTML || '', next: nextS,
    };
  }
  function renderNotes() {
    const info = notesInfo();
    if (!info) return;
    if (notesWin && !notesWin.closed) {
      const d = notesWin.document;
      const set = (id, v, html) => { const e = d.getElementById(id); if (e && (html ? e.innerHTML : e.textContent) !== v) html ? (e.innerHTML = v) : (e.textContent = v); };
      set('slide', info.slide); set('step', info.step); set('clock', info.clock); set('sclock', info.sclock);
      set('clip', info.clip); set('script', info.script, true); set('next', info.next);
      const sc = d.getElementById('sclock'), tc = d.getElementById('clock');
      if (sc) sc.className = info.over ? 'over' : 'muted';
      if (tc) tc.className = info.overTotal ? 'over' : 'muted';
    }
    if (overlayOn) {
      const o = $('#notes-overlay');
      const html = `<div class="meta">${esc(info.slide)} · ${esc(info.step)} · ${esc(info.clock)} · ` +
        `<span class="${info.over ? 'over' : ''}">${esc(info.sclock)}</span> · ${esc(info.clip)} · ${esc(info.next)}</div>${info.script}`;
      if (o.innerHTML !== html) o.innerHTML = html;
    }
  }
  function openNotes() {
    if (notesWin && !notesWin.closed) { notesWin.focus(); return; }
    let w = null;
    try { w = window.open('about:blank', 'cvnotes', 'popup=yes,width=1100,height=820'); } catch (e) { w = null; }
    if (!w) { overlayOn = true; $('#notes-overlay').classList.add('show'); toast('Pop-up blocked: notes are on the stage (N hides them)'); renderNotes(); return; }
    notesWin = w;
    w.document.open();
    w.document.write(NOTES_DOC);
    w.document.close();
    w.addEventListener('keydown', onKey);
    renderNotes();
  }
  setInterval(renderNotes, 250);

  // ------------------------------------------------------------------ input
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function startAuto() {
    if (autoOn) return;
    $('#start').classList.remove('show');
    autoOn = true;
    talkT0 = performance.now();
    const i = cur, k = step;                        // re-enter the slide so its moment and clip run with this gesture
    leave(cur);
    cur = -1;
    go(i, k);
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (AUTO && !autoOn) { e.preventDefault(); startAuto(); return; }
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Spacebar', 'Enter'].includes(k)) { e.preventDefault(); next(); return; }
    if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); return; }
    if (k === 'Home') { e.preventDefault(); go(0, 0); return; }
    if (k === 'End') { e.preventDefault(); go(slides.length - 1, nSteps(slides.length - 1) - 1); return; }
    switch (k.toLowerCase()) {
      case 'f':
        if (e.view !== window) { toast('Press F in the deck window for fullscreen'); break; }
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
        break;
      case 's': openNotes(); break;
      case 'n': overlayOn = !overlayOn; $('#notes-overlay').classList.toggle('show', overlayOn); renderNotes(); break;
      case 'p': pauseResume(); break;
      case 'r': replay(); break;
      case 't': talkT0 = performance.now(); slideT0 = talkT0; toast('Clock reset'); break;
      case '?': case 'h': $('#help').classList.toggle('show'); break;
      case 'escape': $('#help').classList.remove('show'); break;
      default: return;
    }
    renderNotes();
  }
  addEventListener('keydown', onKey);
  let focusedAt = 0;
  addEventListener('focus', () => { focusedAt = performance.now(); });
  stage.addEventListener('click', (e) => {
    if (performance.now() - focusedAt < 400) return;   // the click that brings the window back from Discord
    if (AUTO && !autoOn) { startAuto(); return; }
    if (e.button === 0) next();
  });
  $('#start').addEventListener('click', (e) => { e.stopPropagation(); startAuto(); });   // the start click must not also advance
  stage.addEventListener('contextmenu', (e) => { e.preventDefault(); prev(); });

  // ------------------------------------------------------------------ start
  $$('[data-audio]').forEach((a) => getClip(a.dataset.audio));     // start buffering every clip now
  const m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash);
  const startSlide = m ? clamp(+m[1] - 1, 0, slides.length - 1) : 0;
  const startStep = m && m[2] ? +m[2] : 0;
  if (AUTO) {
    $('#start').classList.add('show');
    cur = startSlide; step = startStep;
    enter(cur);
    $$('[data-step]', slides[cur]).forEach((e) => e.classList.toggle('on', +e.dataset.step <= step));
    if (STEP[slides[cur].dataset.id]) STEP[slides[cur].dataset.id](slides[cur], step);
  } else {
    go(startSlide, startStep);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (slides[cur]) layoutSlide(slides[cur]); });

  window.CV = {
    go, next, prev, slides, players, clips, getClip, nSteps,
    state: () => ({ slide: cur + 1, step, steps: nSteps(cur), clip: current ? { key: current.key, t: current.audio.currentTime, paused: current.audio.paused } : null, autoOn }),
    notesWindow: () => notesWin, startAuto,
  };
})();
