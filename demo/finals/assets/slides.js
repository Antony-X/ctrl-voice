/* What each slide does: hand-drawn diagrams, figures drawn from real engine output (media/data.js), and the audio for each step.
   window.HOOKS[data-id] = { init(slide), enter(slide, {back}), step(slide, k, {back}), leave(slide) }; deck.js calls them. */
(function () {
  const D = window.DATA, Sk = window.Sketch, { el, text } = Sk;
  const $ = (s, r = document) => r.querySelector(s);
  const CYAN = '#5ce1e6', CUT = '#ff5d5d', GEN = '#4cc89b', AMBER = '#f5b94a', GREY = '#8a8a8a';

  // the logo mark, shared by every slide
  const mark = $('#mark').innerHTML;
  document.querySelectorAll('.mk').forEach((e) => { e.innerHTML = mark; });

  const rc = (svg) => rough.svg(svg);
  const anim = (items, o) => Sk.animator(items, o);
  const group = (svg, list, seq = 0) => { const g = el('g', {}, svg); list?.push({ g, seq }); return g; };

  /** Build steps for one figure: groups[k] draws on at step k, earlier groups are shown, later ones hidden. */
  function stepper(groups) {
    return (k, back) => groups.forEach((g, i) => {
      if (!g) return;
      if (i < k || (i === k && back)) g.show(); else if (i === k) g.play(); else g.reset();
    });
  }
  /** A slide that is one diagram: draw it on when the slide opens (R replays it), show it finished when coming back. */
  const drawOnce = (make) => ({
    init(s) { this.a = make(s); },
    step(s, k, { back }) { back ? this.a.show() : this.a.play(); },
  });

  const H = {};

  // ------------------------------------------------------------------ 2 hook: the messy message plays by itself
  H.hook = {
    init() {
      this.v = Deck.vnote($('#hook-vnote'), 'clean.before', { bars: 54 });
      this.k = Deck.karaoke($('#hook-words'), 'clean.before', {
        tags: {
          filler: { label: 'filler' }, correction: { label: 'changed my mind' },
          scratched: { label: 'took it back' }, misspoken: { label: 'wrong word' },
        },
      });
    },
    step(s, k, { back }) {
      if (k > 0 || back) { this.k.full(); return; }
      this.v.reset(); this.k.reset();
      Deck.play('clean.before', 0, null, 0.7);
    },
  };

  // ------------------------------------------------------------------ 3 stats: 6 in 100 words
  H.stats = {
    init() {
      const g = $('#dotgrid'), bad = [7, 26, 43, 58, 71, 94];
      for (let i = 0; i < 100; i++) {
        const d = document.createElement('i');
        if (bad.includes(i)) { d.className = 'bad'; d.style.transitionDelay = `${350 + bad.indexOf(i) * 170}ms`; }
        g.appendChild(d);
      }
    },
  };

  // ------------------------------------------------------------------ 4 product: the same message, fixed
  H.product = {
    init() {
      this.v = Deck.vnote($('#prod-vnote'), 'clean.after', { bars: 80 });
      const gen = D.clean.edits.filter((e) => e.type === 'replace').map((e) => e.out);
      this.k = Deck.karaoke($('#prod-words'), 'clean.after', { gen });
    },
    step(s, k, { back }) {
      if (k === 1 && !back) { this.v.reset(); this.k.reset(); Deck.play('clean.after', 0, null, 0.5); }
      else if (k === 1) this.k.full();
      else Deck.stopAudio();
    },
  };

  // ------------------------------------------------------------------ 5 why hard: a hand-drawn frame per card, sized to the text
  H.hard = {
    build(s) {
      const svg = $('#hard-svg'), r = rc(svg), cards = [...s.querySelectorAll('.card')];
      // the bottom row starts below the tallest top card; every card in a row gets the same height
      const top = cards.filter((c) => c.offsetTop === 0), bottom = cards.filter((c) => c.offsetTop > 0);
      const h1 = Math.max(...top.map((c) => c.offsetHeight)) + 34;
      bottom.forEach((c) => { c.style.top = `${h1 + 36}px`; });
      const h2 = Math.max(...bottom.map((c) => c.offsetHeight)) + 34;
      this.set = stepper(cards.map((c, i) => {
        const items = [], g = group(svg, items);
        g.appendChild(r.rectangle(c.offsetLeft, c.offsetTop, c.offsetWidth, top.includes(c) ? h1 : h2,
          { stroke: '#cfcfcf', strokeWidth: 2, roughness: 1.5, bowing: 1, seed: Sk.seedOf('card' + i) }));
        return anim(items, { dur: 650 });
      }));
    },
    enter(s) { if (!this.set) this.build(s); },
    step(s, k, { back }) { this.set(k, back); },
  };

  // ------------------------------------------------------------------ 6 architecture overview
  const ARCH = {
    zones: [
      { x: 0, y: 0, w: 290, h: 770, label: 'Your laptop' },
      { x: 410, y: 0, w: 1350, h: 770, label: 'Engine on a GPU server' },
    ],
    nodes: [
      { id: 'mic', x: 15, y: 60, w: 260, h: 110, t: 'Microphone\n24 kHz, 100 ms chunks', fs: 22 },
      { id: 'asr', x: 440, y: 60, w: 320, h: 110, t: 'Whisper large-v3-turbo\nevery 0.7 s' },
      { id: 'bar', x: 15, y: 300, w: 260, h: 130, t: 'Floating bar\nlive words, undo' },
      { id: 'ctc', x: 810, y: 60, w: 310, h: 110, t: 'wav2vec2 CTC\nforced alignment' },
      { id: 'llm', x: 1170, y: 60, w: 550, h: 110, t: 'LLM brain: Qwen3.6-35B-A3B\n+ deterministic validators', color: CYAN },
      { id: 'cut', x: 440, y: 290, w: 320, h: 130, t: 'Cut\nfillers, false starts,\nwhat you took back', color: CUT },
      { id: 'regen', x: 810, y: 290, w: 370, h: 130, t: 'Re-say a word\nPlayDiffusion ‖ F5-TTS', color: GEN },
      { id: 'style', x: 1330, y: 290, w: 390, h: 130, t: 'Restyle\nPSOLA tone, or\nF5-TTS + Seed-VC accent' },
      { id: 'ver', x: 830, y: 455, w: 330, h: 150, t: 'verified?\nWhisper + CTC', shape: 'diamond', fs: 22 },
      { id: 'render', x: 440, y: 645, w: 1280, h: 100, t: 'Edit list → renderer\ncuts at the quietest 10 ms, 12 ms crossfades, original never modified' },
      { id: 'paste', x: 15, y: 635, w: 260, h: 120, t: 'Pastes into Discord,\nWhatsApp, Telegram,\nSlack…', fs: 21 },
    ],
    edges: [
      { from: 'mic', to: 'asr', fp: [1, 0.35], tp: [0, 0.35], label: 'WebSocket\nPCM', lx: 350, ly: 52, fs: 19 },
      { from: 'asr', to: 'bar', fp: [0, 0.75], via: [[350, 142.5], [350, 365]], tp: 'r', label: 'live words', lx: 145, ly: 236, fs: 21 },
      { from: 'asr', to: 'ctc' },
      { from: 'ctc', to: 'llm' },
      { from: 'llm', to: 'cut', a: [1525, 170], via: [[1525, 235], [600, 235]], tp: 't' },
      { from: 'llm', to: 'regen', a: [995, 235], tp: 't' },
      { from: 'llm', to: 'style', a: [1525, 235], tp: 't' },
      { from: 'regen', to: 'ver', fp: 'b', tp: 't' },
      { from: 'ver', to: 'regen', fp: 'r', via: [[1255, 530], [1255, 355]], tp: 'r', color: AMBER, dash: true, label: 'no: new seed', lx: 1268, ly: 470, anchor: 'start', tcolor: AMBER },
      { from: 'ver', to: 'render', fp: 'b', tp: [0.433, 0], label: 'yes', lx: 1018, ly: 625, anchor: 'start', tcolor: GEN },
      { from: 'cut', to: 'render', fp: 'b', tp: [0.125, 0] },
      { from: 'style', to: 'render', fp: 'b', tp: [0.847, 0] },
      { from: 'render', to: 'paste', fp: 'l', tp: 'r', label: 'audio', lx: 360, ly: 668, fs: 20 },
    ],
  };
  H.arch = drawOnce(() => Sk.sketch($('#arch-svg'), ARCH, { per: 120 }));

  // ------------------------------------------------------------------ 7 step 1: Whisper's word times vs forced alignment, on the real clip
  H.step1 = {
    init() {
      const svg = $('#step1-svg'), r = rc(svg), F = D.figs.step1, W = 1120;
      const X = (t) => (t - F.t0) / (F.t1 - F.t0) * W;
      const inView = (w) => w.s < F.t1 - 0.1;
      el('image', { href: 'media/step1_mel.png', x: 0, y: 120, width: W, height: 300, preserveAspectRatio: 'none' }, svg);
      const ax = group(svg);
      for (const t of [2, 2.5, 3, 3.5, 4, 4.5]) text(ax, X(t), 612, `${t.toFixed(1)} s`, { fs: 18, color: '#7a7a7a', sans: true });

      const boxes = (list, words, y, o) => words.filter(inView).forEach((w, i) => {
        const g = group(svg, list, i);
        const x0 = X(w.s), x1 = Math.min(W, X(w.e));
        g.appendChild(r.rectangle(x0 + 2, y, x1 - x0 - 4, 58, { stroke: o.color, strokeWidth: 2, roughness: 0.9, strokeLineDash: o.dash, seed: Sk.seedOf(o.k + i) }));
        text(g, (x0 + x1) / 2, y + 29, w.w.replace(/[?,.]/g, ''), { fs: 22, color: o.tcolor });
        const line = el('line', { x1: x0, x2: x0, y1: o.l0, y2: o.l1, stroke: o.color, 'stroke-width': 2, 'stroke-dasharray': o.dash ? '7 6' : 'none', opacity: 0.85 }, g);
        line.setAttribute('class', 'tick');
      });

      const whisper = [], ctc = [];
      text(group(svg, whisper, -1), 0, 6, 'Whisper’s word times', { fs: 21, anchor: 'start', color: '#9a9a9a', sans: true });
      boxes(whisper, F.whisper, 26, { color: '#b5b5b5', tcolor: '#d0d0d0', dash: [8, 7], k: 'w', l0: 84, l1: 420 });

      const lg = group(svg, ctc, -1);
      for (const [ch, t] of F.letters) if (ch !== '|' && t < F.t1) text(lg, X(t) + 5, 440, ch, { fs: 16, color: '#8fe9ec' }).setAttribute('class', 'mono');
      boxes(ctc, F.ctc, 462, { color: CYAN, tcolor: '#ffffff', k: 'c', l0: 120, l1: 462 });
      text(group(svg, ctc, 20), 0, 548, 'CTC forced alignment: what we cut on', { fs: 21, anchor: 'start', color: CYAN, sans: true });

      // "about": Whisper puts its start 0.4 s early, in the middle of "pacific"
      const wa = F.whisper.find((w) => w.w === 'about'), ca = F.ctc.find((w) => w.w === 'about');
      const ag = group(svg, ctc, 21);
      ag.appendChild(r.line(X(wa.s), 102, X(ca.s) - 4, 102, { stroke: AMBER, strokeWidth: 2.4, roughness: 0.7, seed: 5 }));
      ag.appendChild(r.line(X(ca.s) - 4, 102, X(ca.s) - 16, 95, { stroke: AMBER, strokeWidth: 2.4, roughness: 0.5, seed: 6 }));
      ag.appendChild(r.line(X(ca.s) - 4, 102, X(ca.s) - 16, 109, { stroke: AMBER, strokeWidth: 2.4, roughness: 0.5, seed: 7 }));
      text(ag, X(wa.s) - 12, 102, `${(ca.s - wa.s).toFixed(2)} s off`, { fs: 22, anchor: 'end', color: AMBER });   // left of the arrow, clear of the dashed lines

      this.set = stepper([anim(whisper, { per: 70 }), anim(ctc, { per: 70 })]);
    },
    step(s, k, { back }) { this.set(k, back); },
  };

  // ------------------------------------------------------------------ 8 step 2: reparandum / interregnum / repair, then the brain
  H.step2 = {
    build(s) {
      const svg = $('#step2-svg'), r = rc(svg);
      // where each phrase of the HTML sentence sits, in the SVG's own units (the stage is scaled to the window)
      const k = $('#stage').getBoundingClientRect().width / 1920, sr = svg.getBoundingClientRect();
      const box = (id) => {
        const b = $('#' + id).getBoundingClientRect();
        return { x0: (b.left - sr.left) / k, x1: (b.right - sr.left) / k, y0: (b.top - sr.top) / k, y1: (b.bottom - sr.top) / k };
      };
      const parts = [['rp', CUT, 'reparandum', 'what you take back'], ['ip', AMBER, 'interregnum', 'the “no, wait”'], ['rr', GEN, 'repair', 'what you meant']];
      const shape = [];
      parts.forEach(([id, color, name, gloss], i) => {
        const b = box(id), y = b.y1 + 10, g = group(svg, shape, i);
        g.appendChild(r.linearPath([[b.x0, y], [b.x0, y + 14], [b.x1, y + 14], [b.x1, y]], { stroke: color, strokeWidth: 2.6, roughness: 0.8, seed: 30 + i }));
        text(g, (b.x0 + b.x1) / 2, y + 44, name, { fs: 26, color });
        text(g, (b.x0 + b.x1) / 2, y + 74, gloss, { fs: 20, color: '#a3a3a3' });
      });
      const rp = box('rp'), ip = box('ip'), xI = (rp.x1 + ip.x0) / 2, ig = group(svg, shape, 3);
      ig.appendChild(r.line(xI, rp.y0 - 26, xI, rp.y1 + 4, { stroke: '#dddddd', strokeWidth: 2, roughness: 0.6, strokeLineDash: [6, 6], seed: 41 }));
      text(ig, xI, rp.y0 - 42, 'interruption point', { fs: 20, color: '#dddddd' });

      const flow = Sk.sketch(svg, {
        nodes: [
          { id: 'b1', x: 0, y: 290, w: 545, h: 150, t: 'The LLM copies the message and tags it:\nIs it [correction: Monday? No, wait,]\nWednesday?', fs: 21, color: CYAN },
          { id: 'b2', x: 605, y: 290, w: 545, h: 150, t: 'difflib maps the tags back\nonto word indices,\nthen onto timestamps', fs: 21 },
          { id: 'b3', x: 605, y: 500, w: 545, h: 180, t: 'Validators: delete-only. A negation,\nnumber, date or time stays unless a\nsame-type repair replaces it. Every span\nis reshaped to reparandum + repair.', fs: 20 },
          { id: 'b4', x: 0, y: 500, w: 545, h: 180, t: 'sure → cut\nunsure → shown as a suggestion,\nunticked', fs: 22 },
        ],
        edges: [{ from: 'b1', to: 'b2' }, { from: 'b2', to: 'b3', fp: 'b', tp: 't' }, { from: 'b3', to: 'b4', fp: 'l', tp: 'r' }],
      }, { per: 180 });

      const chart = $('#step2-chart');
      const bars = Sk.vbars(chart, {
        x: 20, y: 90, w: 520, h: 210, max: 28, vfs: 34, lfs: 19, title: 'Exact clean-ups, 28 test messages',
        bars: [
          { label: 'Qwen3-8B\nword indices', value: 9, text: '9', color: '#8a8a8a' },
          { label: 'Qwen3.6\ninline tags', value: 15, text: '15', color: '#cfcfcf' },
          { label: '+ repair rule\n(ours)', value: 24, text: '24', color: CYAN },
        ],
      });
      this.set = stepper([anim(shape, { per: 260, dur: 600 }), flow, anim(bars, { per: 220 })]);
    },
    enter(s) { if (!this.set) this.build(s); },
    step(s, k, { back }) { this.set(k, back); },
  };

  // ------------------------------------------------------------------ 9 step 3: re-say a word, verify, retry
  H.step3 = {
    init() {
      const svg = $('#step3-svg');
      const flow = Sk.sketch(svg, {
        nodes: [
          { id: 'n1', x: 0, y: 20, w: 330, h: 120, t: 'Word to fix\n“pacific” → “specific”', color: CUT },
          { id: 'n2', x: 400, y: 20, w: 340, h: 120, t: 'Widen to the word before:\n“more specific”' },
          { id: 'n3', x: 810, y: 20, w: 360, h: 120, t: 'Window ≤ 4 s, cut at word gaps;\nlength from your speaking rate', fs: 21 },
          { id: 'n4', x: 810, y: 230, w: 360, h: 120, t: 'PlayDiffusion ‖ F5-TTS\nin parallel', color: GEN },
          { id: 'n5', x: 400, y: 230, w: 340, h: 120, t: 'Force-align the output,\nkeep only the new words' },
          { id: 'n6', x: 0, y: 230, w: 330, h: 120, t: 'Cut at the quietest 10 ms,\nmatch loudness,\n12 ms crossfade', fs: 21 },
          { id: 'd', x: 20, y: 430, w: 290, h: 190, t: 'verified?', shape: 'diamond', fs: 26 },
          { id: 'n7', x: 400, y: 465, w: 340, h: 120, t: 'Best voice match\n(ECAPA similarity)' },
          { id: 'n8', x: 810, y: 465, w: 360, h: 120, t: 'Into the edit list,\nmarked as AI words', color: GEN },
        ],
        edges: [
          { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' },
          { from: 'n3', to: 'n4', fp: 'b', tp: 't' },
          { from: 'n4', to: 'n5', fp: 'l', tp: 'r' }, { from: 'n5', to: 'n6', fp: 'l', tp: 'r' },
          { from: 'n6', to: 'd', fp: 'b', tp: 't' },
          { from: 'd', to: 'n7', fp: 'r', tp: 'l', label: 'yes', lx: 355, ly: 505, tcolor: GEN },
          { from: 'n7', to: 'n8' },
          { from: 'd', to: 'n4', fp: 'b', via: [[165, 690], [1220, 690], [1220, 290]], tp: 'r', color: AMBER, dash: true,
            label: 'no: new seed, up to 3 rounds', lx: 690, ly: 716, tcolor: AMBER, seq: 13 },
        ],
      }, { per: 150 });
      const hi = [], g = group(svg, hi);
      g.appendChild(rc(svg).ellipse(165, 525, 360, 250, { stroke: CYAN, strokeWidth: 2.6, roughness: 1.6, seed: 77 }));
      this.set = stepper([flow, anim(hi, { dur: 700 })]);
    },
    step(s, k, { back }) { this.set(k, back); },
  };

  // ------------------------------------------------------------------ 10 close-up: the waveforms around the fixed word
  function waveRow(svg, f, scale, color, key) {
    const r = rc(svg), X = (t) => (t - f.t0) * scale, n = f.peaks.length, mx = Math.max(...f.peaks), bw = X(f.t1) / n;
    const items = [], reg = group(svg, items);
    reg.appendChild(r.rectangle(X(f.region[0]), 4, X(f.region[1]) - X(f.region[0]), 152,
      { stroke: color, strokeWidth: 2.4, roughness: 1.2, fill: color, fillStyle: 'hachure', hachureGap: 14, fillWeight: 0.8, seed: Sk.seedOf(key) }));
    reg.querySelectorAll('path').forEach((p) => { if (p.getAttribute('stroke-width') < 2) p.setAttribute('opacity', '0.35'); });
    const wv = el('g', {}, svg);
    f.peaks.forEach((p, i) => {
      const t = f.t0 + (i + 0.5) / n * (f.t1 - f.t0), inR = t >= f.region[0] && t <= f.region[1], h = Math.max(1.2, p / mx * 64);
      el('rect', { x: i * bw, y: 80 - h, width: Math.max(1, bw * 0.72), height: 2 * h, rx: 0.8, fill: inR ? color : '#8a8a8a' }, wv);
    });
    const lab = el('g', {}, svg), dt = (f.t1 - f.t0) / n;
    // aligned word ends run on into the following pause, so centre each label on the voiced part of its word
    function voiced(s, e) {
      const on = [];
      for (let i = Math.max(0, Math.floor((s - f.t0) / dt)); i < Math.min(n, Math.ceil((e - f.t0) / dt)); i++) if (f.peaks[i] > 0.12 * mx) on.push(i);
      return on.length ? [f.t0 + on[0] * dt, f.t0 + (on[on.length - 1] + 1) * dt] : [s, e];
    }
    f.words.filter((w) => w.s < f.t1 - 0.1).forEach((w) => {
      const [v0, v1] = voiced(Math.max(w.s, f.t0), Math.min(w.e, f.t1)), mid = (v0 + v1) / 2, inR = mid >= f.region[0] && mid <= f.region[1];
      text(lab, X(mid), 178, w.w.replace(/[?,.]/g, ''), { fs: 23, color: inR ? color : '#bdbdbd' });
    });
    const head = el('line', { x1: 0, x2: 0, y1: 0, y2: 160, stroke: '#ffffff', 'stroke-width': 2.5, opacity: 0 }, svg);
    Deck.onAudio((k, t) => {
      if (k !== key) return;
      const on = t > f.t0 && t < f.t1;
      head.setAttribute('opacity', on ? 1 : 0);
      head.setAttribute('x1', X(t)); head.setAttribute('x2', X(t));
    });
    return anim(items, { dur: 700 });
  }
  H.closeup = {
    init() {
      const F = D.figs.step3, scale = 1180 / Math.max(F.before.t1 - F.before.t0, F.after.t1 - F.after.t0);
      this.set = stepper([
        waveRow($('#cu-before'), F.before, scale, CUT, 'clean.before'),
        waveRow($('#cu-after'), F.after, scale, GEN, 'clean.after'),
      ]);
    },
    step(s, k, { back }) {
      this.set(k, back);
      if (back) return Deck.stopAudio();
      const F = D.figs.step3;
      if (k === 0) Deck.play('clean.before', F.before.t0, F.before.t1, 0.6);
      else Deck.play('clean.after', F.after.t0, F.after.t1, 0.5);
    },
  };

  // ------------------------------------------------------------------ 11 step 4: pronunciation scoring
  H.step4 = {
    init() {
      const flow = Sk.sketch($('#step4-svg'), {
        nodes: [
          { id: 'in1', x: 0, y: 10, w: 270, h: 100, t: 'The word you meant\n“bombings”' },
          { id: 'g2p', x: 330, y: 10, w: 310, h: 100, t: 'espeak: letters →\nexpected phones' },
          { id: 'in2', x: 0, y: 160, w: 270, h: 100, t: 'Your audio' },
          { id: 'ph', x: 330, y: 160, w: 310, h: 100, t: 'wav2vec2 phoneme\nmodel: posteriors', },
          { id: 'al', x: 710, y: 75, w: 450, h: 110, t: 'CTC alignment\nexpected phones ↔ audio' },
          { id: 'gop', x: 710, y: 305, w: 450, h: 130, t: 'GOP: the expected phone vs the best\nsingle substitution or deletion\n(one batched ctc_loss)', fs: 21, color: CYAN },
          { id: 'ft', x: 330, y: 305, w: 310, h: 130, t: 'z-scores vs your own\ngood words, edit\ndistance, length', fs: 22 },
          { id: 'gb', x: 0, y: 305, w: 270, h: 130, t: 'Gradient boosting\ntrained on\nspeechocean762', fs: 22 },
          { id: 'dia', x: 0, y: 490, w: 270, h: 200, t: 'score ≤ 6.8 and\n1.5 below your\nmedian?', shape: 'diamond', fs: 20 },
          { id: 'flag', x: 400, y: 540, w: 300, h: 100, t: 'Flag it and\nre-say it clearly', color: CUT },
          { id: 'acc', x: 780, y: 525, w: 380, h: 130, t: 'Same sound wrong ≥ 3 times?\nThat’s your accent:\na tip, not an error', dash: true, color: AMBER, fs: 21 },
        ],
        edges: [
          { from: 'in1', to: 'g2p' }, { from: 'in2', to: 'ph' },
          { from: 'g2p', to: 'al', tp: [0, 0.3] }, { from: 'ph', to: 'al', tp: [0, 0.75] },
          { from: 'al', to: 'gop', fp: 'b', tp: 't' },
          { from: 'gop', to: 'ft', fp: 'l', tp: 'r' }, { from: 'ft', to: 'gb', fp: 'l', tp: 'r' },
          { from: 'gb', to: 'dia', fp: 'b', tp: 't' },
          { from: 'dia', to: 'flag', fp: 'r', tp: 'l', label: 'yes', lx: 335, ly: 568, tcolor: GEN },
          { from: 'flag', to: 'acc', dash: true, color: AMBER },
        ],
      }, { per: 130 });
      const chart = Sk.hbars($('#step4-chart'), {
        x: 0, y: 92, w: 560, rowH: 66, max: 0.5, labelW: 230, fs: 21, vfs: 30, tfs: 23,
        title: 'AUC against expert labels\n(bars start at chance, 0.5)',
        bars: [
          { label: 'GOP, no training', value: 0.23, text: '0.73', color: '#8a8a8a' },
          { label: 'peak posterior', value: 0.27, text: '0.77', color: '#cfcfcf' },
          { label: 'ours, trained', value: 0.38, text: '0.88', color: CYAN },
        ],
      });
      this.set = stepper([flow, anim(chart, { per: 220 })]);
    },
    step(s, k, { back }) { this.set(k, back); },
  };

  // ------------------------------------------------------------------ 12 step 5: the pitch contour, drawn as the voice plays
  H.step5 = {
    init() {
      const svg = $('#step5-svg'), r = rc(svg), T = D.tone_f0, M = D.tone.metrics;
      const L = 90, R = 1120, X = (t) => L + t / 7 * (R - L), st = (hz) => 12 * Math.log2(hz / 100);
      for (let t = 0; t <= 7; t++) text(svg, X(t), 548, `${t} s`, { fs: 18, color: '#8a8a8a', sans: true });

      /** Pitch in semitones re 100 Hz, without the tracker's octave errors: frames an octave off the speaker's median,
       *  frames far from their neighbours, and voiced runs shorter than 50 ms are dropped. */
      function semitones(c) {
        const s = c.hz.map((h) => (h > 0 ? st(h) : null));
        const all = s.filter((v) => v != null).sort((a, b) => a - b), med = all[all.length >> 1];
        let out = s.map((v) => (v != null && Math.abs(v - med) < 12 ? v : null));
        out = out.map((v, i) => {
          if (v == null) return null;
          const nb = out.slice(Math.max(0, i - 4), i + 5).filter((x) => x != null).sort((a, b) => a - b);
          return Math.abs(v - nb[nb.length >> 1]) > 2.5 ? null : v;
        });
        for (let i = 0; i < out.length;) {
          if (out[i] == null) { i++; continue; }
          let j = i;
          while (j < out.length && out[j] != null) j++;
          if (j - i < 5) out.fill(null, i, j);
          i = j;
        }
        return out;
      }

      const panel = (c, top, h, title, color, width, key, ending, heard) => {
        const Y = (v) => top + (12 - Math.max(-8, Math.min(12, v))) / 20 * h;
        const ax = el('g', {}, svg);
        ax.appendChild(r.line(L, top - 6, L, top + h, { stroke: GREY, strokeWidth: 1.6, roughness: 0.7, seed: top }));
        ax.appendChild(r.line(L, top + h, R, top + h, { stroke: GREY, strokeWidth: 1.6, roughness: 0.7, seed: top + 1 }));
        for (const v of [-6, 0, 6, 12]) {
          text(ax, L - 14, Y(v), (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), { fs: 17, anchor: 'end', color: '#8a8a8a', sans: true });
          el('line', { x1: L, x2: R, y1: Y(v), y2: Y(v), stroke: '#262626', 'stroke-width': 1 }, ax);
        }
        text(ax, L + 16, top + 8, title, { fs: 23, anchor: 'start', color, sans: true, weight: 600 });

        const id = 'clip-' + key.replace('.', '-'), cp = el('clipPath', { id }, el('defs', {}, svg));
        const rect = el('rect', { x: 0, y: 0, width: 0, height: 600 }, cp);
        const g = el('g', { 'clip-path': `url(#${id})` }, svg);
        const v = semitones(c);
        let d = '', last = -1;
        v.forEach((x, i) => {
          if (x == null) return;
          d += (last === i - 1 ? 'L' : 'M') + X(c.t[i]).toFixed(1) + ' ' + Y(x).toFixed(1);
          last = i;
        });
        el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
        const fw = c.words[c.words.length - 1];
        const end = v.map((x, i) => (x != null && c.t[i] >= fw.s ? i : -1)).filter((i) => i >= 0);
        const peak = Math.max(...end.map((i) => v[i]));
        const fx = X((fw.s + fw.e) / 2);
        text(g, fx, Y(peak) - 26, `“${heard}”`, { fs: 23, color });
        text(g, fx, Y(peak) - 54, ending, { fs: 21, color: '#d0d0d0' });
        const show = () => rect.setAttribute('width', 1200);
        Deck.onAudio((k, t, a) => { if (k === key) a.ended ? show() : rect.setAttribute('width', X(t) + 4); });
        return { reset: () => rect.setAttribute('width', 0), show };
      };
      const fe = M.finalEndingSt, heard = M.finalWordHeard;
      this.before = panel(T.before, 24, 220, 'Original take', '#b0b0b0', 3.2, 'tone.before', `ending +${fe[0].toFixed(1)} st`, heard[0]);
      this.after = panel(T.after, 290, 220, 'Confident', CYAN, 3.6, 'tone.after', `ending −${Math.abs(fe[1]).toFixed(1)} st`, heard[1]);

      this.accent = Sk.sketch($('#step5-accent'), {
        nodes: [
          { id: 'a1', x: 0, y: 20, w: 270, h: 100, t: 'Native accent:\nWhisper gets the words', fs: 21 },
          { id: 'a2', x: 315, y: 20, w: 290, h: 100, t: 'F5-TTS says them with\na native reference voice', fs: 21 },
          { id: 'a3', x: 650, y: 20, w: 270, h: 100, t: 'Seed-VC converts it\nback to your timbre', fs: 21 },
          { id: 'a4', x: 965, y: 20, w: 185, h: 100, t: 'off by default,\nlabelled as AI', fs: 20, dash: true, color: AMBER },
        ],
        edges: [{ from: 'a1', to: 'a2' }, { from: 'a2', to: 'a3' }, { from: 'a3', to: 'a4', dash: true, color: AMBER }],
      }, { per: 140 });
    },
    step(s, k, { back }) {
      clearTimeout(this.safety);
      const T = D.tone_f0;
      [this.before, this.after].forEach((c, i) => { if (i < k || (i === k && back)) c.show(); else c.reset(); });
      if (k === 2) { back ? this.accent.show() : this.accent.play(); } else this.accent.reset();
      if (back || k > 1) return Deck.stopAudio();
      const c = k === 0 ? this.before : this.after;
      Deck.play(k === 0 ? 'tone.before' : 'tone.after', 0, null, 0.5);
      this.safety = setTimeout(() => c.show(), ((k === 0 ? T.before.dur : T.after.dur) + 2) * 1000);   // if audio is blocked
    },
    leave() { clearTimeout(this.safety); },
  };

  // ------------------------------------------------------------------ 13 results
  H.results = drawOnce(() => {
    const svg = $('#results-svg'), r = rc(svg), items = [];
    const shift = (list, by) => list.forEach((it) => items.push({ g: it.g, seq: it.seq + by }));
    const head = (x, y, t, seq) => text(group(svg, items, seq), x, y, t, { fs: 25, anchor: 'start', color: '#a3a3a3', sans: true });

    // A. re-saying a word: correct vs seconds per edit (log scale)
    head(0, 30, 'Re-saying a word: correct on 10 real recordings', 0);
    const px0 = 90, px1 = 800, py0 = 70, py1 = 280;
    const lx = (t) => px0 + (Math.log(t) - Math.log(0.3)) / (Math.log(20) - Math.log(0.3)) * (px1 - px0);
    const ly = (v) => py0 + (10.5 - v) / 4 * (py1 - py0);
    const ax = group(svg, items, 1);
    ax.appendChild(r.line(px0, py1, px1, py1, { stroke: GREY, strokeWidth: 1.6, roughness: 0.7, seed: 21 }));
    ax.appendChild(r.line(px0, py0 - 14, px0, py1, { stroke: GREY, strokeWidth: 1.6, roughness: 0.7, seed: 22 }));
    for (const t of [0.5, 1, 2, 5, 10]) text(ax, lx(t), py1 + 24, `${t} s`, { fs: 18, color: '#8a8a8a', sans: true });
    for (const v of [7, 8, 9, 10]) text(ax, px0 - 14, ly(v), `${v}`, { fs: 18, anchor: 'end', color: '#8a8a8a', sans: true });
    text(ax, (px0 + px1) / 2, py1 + 56, 'seconds per edit (log scale)', { fs: 19, color: '#8a8a8a', sans: true });
    const pts = [
      { n: 'dots.tts.edit', v: 10, t: 12.7, c: '#8a8a8a', dx: -24, dy: 0, a: 'end' },
      { n: 'PlayDiffusion', v: 9, t: 1.5, c: CYAN, dx: 24, dy: 0, a: 'start' },
      { n: 'F5-TTS', v: 7, t: 1.0, c: CYAN, dx: 24, dy: 0, a: 'start' },
      { n: 'AuK-Flash', v: 7, t: 0.5, c: '#8a8a8a', dx: 14, dy: -32, a: 'start' },
    ];
    pts.forEach((p, i) => {
      const g = group(svg, items, 2 + i);
      g.appendChild(r.circle(lx(p.t), ly(p.v), 22, { stroke: p.c, fill: p.c, fillStyle: 'solid', roughness: 0.8, seed: 60 + i }));
      text(g, lx(p.t) + p.dx, ly(p.v) + p.dy, `${p.n}  ${p.v}/10, ${p.t.toFixed(1)} s`, { fs: 21, anchor: p.a, color: p.c, sans: true });
    });
    text(group(svg, items, 6), 470, 205, 'we run these two in parallel\nand keep the one that verifies', { fs: 22, anchor: 'start', color: CYAN });

    // B. splice only the new words
    shift(Sk.hbars(svg, {
      x: 920, y: 70, w: 840, rowH: 92, max: 1, labelW: 330, fs: 22, vfs: 32, tfs: 25,
      title: 'Voice similarity to the speaker (PlayDiffusion)',
      bars: [
        { label: 'Regenerate the clip', value: 0.733, text: '0.733', color: '#8a8a8a' },
        { label: 'Splice new words only', value: 0.976, text: '0.976', color: GEN },
      ],
    }), 11);

    // C. clean-up
    shift(Sk.hbars(svg, {
      x: 0, y: 440, w: 860, rowH: 66, max: 28, labelW: 330, fs: 22, vfs: 30, tfs: 25,
      title: 'Clean-up: exact on 28 hand-written messages',
      bars: [
        { label: 'Qwen3-8B, word indices', value: 9, text: '9/28', color: '#8a8a8a' },
        { label: 'Qwen3.6, inline tags', value: 15, text: '15/28', color: '#cfcfcf' },
        { label: '+ repair rule', value: 24, text: '24/28', color: CYAN },
      ],
    }), 21);
    text(group(svg, items, 25), 0, 662, 'Meaning-changing edits on 10 trick sentences: 2 → 0 → 0', { fs: 22, anchor: 'start', color: '#bdbdbd', sans: true });

    // D. speed
    shift(Sk.hbars(svg, {
      x: 920, y: 440, w: 840, rowH: 44, max: 3.2, labelW: 330, fs: 21, vfs: 24, tfs: 25,
      title: 'Seconds per step (hosted engine, warm)',
      bars: [
        { label: 'Live words, “scratch that”', value: 0.35, text: '~0.35', color: CYAN },
        { label: 'Upload + transcribe', value: 0.4, text: '0.4', color: CYAN },
        { label: 'Clean up', value: 0.5, text: '0.5', color: CYAN },
        { label: 'Tone', value: 0.6, text: '0.6', color: CYAN },
        { label: 'Native accent', value: 2.8, text: '2.8', color: '#cfcfcf' },
        { label: 'Re-say a word', value: 3.0, text: '~3', color: '#cfcfcf' },
      ],
    }), 31);
    return anim(items, { per: 110 });
  });

  // ------------------------------------------------------------------ 14 roadmap
  H.roadmap = drawOnce(() => {
    const later = ['Real voice-note bubbles\n(Telegram bot, Discord app)', 'Seams nobody can hear\n(blind listening test)',
      'AudioSeal watermark\non every AI word', 'More languages', 'iOS and Android\nkeyboard'];
    return Sk.sketch($('#roadmap-svg'), {
      nodes: [
        { id: 'b1', x: 0, y: 370, w: 400, h: 150, t: 'On-device recognizer\n+ compact LLM:\nlive words, undo, clean-up' },
        { id: 'b2', x: 480, y: 220, w: 400, h: 150, t: 'Distilled voice editor\nfor the few words\nsaid again' },
        { id: 'b3', x: 960, y: 70, w: 400, h: 150, t: 'Hosted engine becomes\nan optional boost\n(accent, heavy extras)' },
        { id: 'out', x: 1420, y: 20, w: 340, h: 250, t: 'Messages never\nleave your phone.\nWorks offline.', shape: 'ellipse', color: CYAN, fs: 26 },
        ...later.map((t, i) => ({ id: 'l' + i, x: i * 357.5, y: 610, w: 330, h: 100, t, fs: 20, dash: true, color: '#9a9a9a', seq: 20 + i })),
      ],
      edges: [
        { from: 'b1', to: 'b2', fp: [1, 0.3], tp: [0, 0.7] },
        { from: 'b2', to: 'b3', fp: [1, 0.3], tp: [0, 0.7] },
        { from: 'b3', to: 'out', fp: 'r', tp: [0.02, 0.62] },
      ],
      texts: [
        { x: 0, y: 30, t: 'Core focus: run it all on your own device', fs: 34, anchor: 'start', sans: true, weight: 600, seq: -1 },
        { x: 0, y: 578, t: 'Then', fs: 26, anchor: 'start', sans: true, color: '#a3a3a3', seq: 19 },
      ],
    }, { per: 140 });
  });

  // ------------------------------------------------------------------ 16 backup clips (only reached with B)
  H.backup = {
    init(s) {
      this.vids = () => [...s.querySelectorAll('video')];
      // a screen recording of a real rehearsal, if one has been saved, plays first
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        this.vids().forEach((v) => { v.dataset.v = +v.dataset.v + 1; });
        const v = document.createElement('video');
        Object.assign(v, { src: 'media/video/live_backup.mp4', preload: 'auto', playsInline: true });
        v.dataset.v = 0;
        s.insertBefore(v, s.querySelector('video'));
        s.dataset.steps = this.vids().length - 1;
      };
      probe.src = 'media/video/live_backup.mp4';
    },
    step(s, k) {
      this.vids().forEach((v) => {
        const cur = +v.dataset.v === k;
        v.classList.toggle('cur', cur);
        if (cur) { v.currentTime = 0; v.play().catch(() => Deck.toast('Video blocked: press P')); } else v.pause();
      });
    },
    leave() { this.vids().forEach((v) => v.pause()); },
  };

  window.HOOKS = H;
})();
