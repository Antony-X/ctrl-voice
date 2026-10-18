/* The architecture map: one 5760 x 1620·2 canvas of nine hand-drawn regions (3 x 3, each 1920 x 1080), toured by a camera.
   Region drawings live in assets/arch/<id>.js and register themselves:
     ARCH.regions[id] = { draw(g, ctx) -> { items: [{ g, seq }], arrive?: () => stop? } }
   g is a <g> already moved to the region's origin; draw in local coordinates (0..1920, 0..1080), content inside
   x 80..1840, y 200..1020 (the host draws the sheet, the number, the title and the subtitle above y 190).
   items are drawn on (animator) when the map first builds; arrive() runs a small animation when the camera lands and
   returns a function that stops it. */
(function () {
  const Sk = window.Sketch, { C, el, text } = Sk;
  const ARCH = window.ARCH = window.ARCH || {};
  ARCH.regions = ARCH.regions || {};

  // the tour, in order: a snake through the grid (row 1 runs right to left)
  ARCH.meta = [
    { id: 'hear', col: 0, row: 0, stage: 0, title: 'Hear', sub: 'Whisper large-v3-turbo' },
    { id: 'align', col: 1, row: 0, stage: 0, title: 'Align', sub: 'wav2vec2 CTC' },
    { id: 'decide', col: 2, row: 0, stage: 1, title: 'Decide', sub: 'Qwen3.6-35B-A3B' },
    { id: 'rules', col: 2, row: 1, stage: 1, title: 'Guard', sub: 'hard rules' },
    { id: 'playdiff', col: 1, row: 1, stage: 2, title: 'Re-say', sub: 'PlayDiffusion' },
    { id: 'f5', col: 0, row: 1, stage: 2, title: 'Re-say, in parallel', sub: 'F5-TTS' },
    { id: 'verify', col: 0, row: 2, stage: 2, title: 'Verify', sub: 'Whisper + CTC + ECAPA' },
    { id: 'pron', col: 1, row: 2, stage: 3, title: 'Pronunciation', sub: 'phoneme CTC + GOP' },
    { id: 'tone', col: 2, row: 2, stage: 4, title: 'Tone', sub: 'Praat PSOLA + Seed-VC' },
  ];
  const RW = 1920, RH = 1080;

  /** Sheet + number + title + subtitle for one region; returns the items to draw on. */
  function header(g, m, n) {
    const items = [], pen = Sk.P(g);
    const sheet = el('g', {}, g);
    Sk.P(sheet).rect(28, 28, RW - 56, RH - 56, { color: C.line, fill: C.sheet, sw: 2.5, r: 26, rough: 0.6, seed: 900 + n });
    items.push({ g: sheet, seq: -2 });
    const h = el('g', {}, g);
    Sk.P(h).circle(112, 104, 64, { color: C.ink3, sw: 2, rough: 0.6, seed: 950 + n });
    text(h, 112, 106, String(n + 1), { fs: 34, font: 'sans', weight: 600, color: C.ink2 });
    text(h, 172, 100, m.title, { fs: 76, anchor: 'start', font: 'serif', weight: 500 });
    text(h, 176, 162, m.sub, { fs: 30, anchor: 'start', font: 'sans', color: C.ink2 });
    items.push({ g: h, seq: -1 });
    return items;
  }

  /** Draw one region into parent (a <g>). Returns { items, arrive }. */
  ARCH.mountRegion = function (parent, m, n) {
    const g = el('g', { transform: `translate(${m.col * RW} ${m.row * RH})`, 'data-region': m.id }, parent);
    const items = header(g, m, n);
    const body = el('g', {}, g);
    const R = ARCH.regions[m.id];
    let out = { items: [] };
    if (R) {
      try { out = R.draw(body, { pen: Sk.P(body), Sk, C, D: window.DATA, meta: m }) || out; }
      catch (e) { console.error(`region ${m.id}:`, e); text(body, 960, 600, `region ${m.id} failed: ${e.message}`, { fs: 30, color: C.cut, font: 'sans' }); }
    } else {
      text(body, 960, 600, `(region ${m.id} not drawn yet)`, { fs: 34, color: C.ink3, font: 'sans' });
    }
    return { g, items: items.concat(out.items || []), arrive: out.arrive };
  };

  // ------------------------------------------------------------------ the map: flow arrows between regions
  /** The arrows, one <g> each, in tour order; `to` is the region an arrow leads into (it draws just before that region). */
  function links(parent) {
    const o = { color: C.ink2, sw: 7, hl: 40, rough: 0.9 }, out = [];
    const cx = (c) => c * RW + RW / 2, cy = (r) => r * RH + RH / 2;
    const E = 78;                                                            // how far an arrow reaches into each sheet
    const arrow = (to, pts, extra) => { const g = el('g', {}, parent); Sk.P(g).arrow(pts, { ...o, ...extra }); out.push({ g, to }); };
    arrow(1, [[RW - E, cy(0)], [RW + E, cy(0)]]);                           // hear → align
    arrow(2, [[2 * RW - E, cy(0)], [2 * RW + E, cy(0)]]);                   // align → decide
    arrow(3, [[cx(2), RH - E], [cx(2), RH + E]]);                           // decide → rules
    arrow(4, [[2 * RW + E, cy(1)], [2 * RW - E, cy(1)]]);                   // rules → playdiff
    arrow(5, [[2 * RW + 300, RH + 14], [RW + RW / 2, RH - 2], [RW / 2 + 420, RH + 6], [RW / 2 + 180, RH + 64]], { dash: [16, 14], curve: true });  // rules → f5, in parallel (lands right of the title)
    arrow(6, [[cx(0), 2 * RH - E], [cx(0), 2 * RH + E]]);                   // f5 → verify
    arrow(6, [[RW + 140, 2 * RH - E], [RW - 140, 2 * RH + E]]);             // playdiff → verify
    arrow(7, [[RW - E, cy(2)], [RW + E, cy(2)]]);                           // verify → pron
    arrow(8, [[2 * RW - E, cy(2)], [2 * RW + E, cy(2)]]);                   // pron → tone
    return out;
  }

  // ------------------------------------------------------------------ camera
  const OVER = { cx: 1.5 * RW, cy: 1.5 * RH, s: 1 / 3 };
  const viewOf = (m) => ({ cx: m.col * RW + RW / 2, cy: m.row * RH + RH / 2, s: 1 });
  const ease = (e) => (e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2);

  /** Build the map into host (an HTML element 1920 x 1080). Returns { build, goTo(k), show } (k = -1 overview, 0..8 regions). */
  ARCH.mount = function (host, opts = {}) {
    host.innerHTML = '';
    const cam = document.createElement('div');
    cam.className = 'arch-cam';
    cam.style.cssText = `position:absolute;left:0;top:0;width:${3 * RW}px;height:${3 * RH}px;transform-origin:0 0`;
    host.appendChild(cam);
    const svg = el('svg', { width: 3 * RW, height: 3 * RH, viewBox: `0 0 ${3 * RW} ${3 * RH}` });
    cam.appendChild(svg);
    const regions = ARCH.meta.map((m, n) => ARCH.mountRegion(svg, m, n));
    const arrows = links(svg);                                // on top of the sheets
    // The build: region 1 draws on its own (about 1 s), then the other eight cascade in fast, each with its arrow.
    const FIRST = 1100, REST = 380, GAP = 140, AFTER = 1250;  // ms: region 1's draw, each later region's draw, cascade step, cascade start
    const seqs = (r) => new Set(r.items.map((i) => i.seq)).size;
    const anims = regions.map((r, i) => Sk.animator(r.items, i === 0 ? { per: FIRST / seqs(r), dur: 520 } : { per: REST / seqs(r), dur: 300 }));
    const linkAnims = arrows.map((a) => Sk.animator([{ g: a.g, seq: 0 }], { dur: 260 }));
    const linkAnim = { show: () => linkAnims.forEach((a) => a.show()), reset: () => linkAnims.forEach((a) => a.reset()) };

    let view = { ...OVER }, raf = 0, stop = null, at = -1, timers = [];
    function apply(v) { cam.style.transform = `translate(${960 - v.s * v.cx}px, ${540 - v.s * v.cy}px) scale(${v.s})`; }
    apply(view);
    function fly(to, ms = 1100, done) {
      cancelAnimationFrame(raf);
      const from = { ...view }, t0 = performance.now();
      const dip = Math.abs(from.s - to.s) < 1e-6 ? Math.log(1.7) : Math.log(1.25);
      cam.style.willChange = 'transform';
      const tick = (now) => {
        const e = Math.min(1, (now - t0) / ms), k = ease(e);
        const ls = Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * k - dip * Math.sin(Math.PI * e);
        view = { cx: from.cx + (to.cx - from.cx) * k, cy: from.cy + (to.cy - from.cy) * k, s: Math.exp(ls) };
        apply(view);
        if (e < 1) raf = requestAnimationFrame(tick);
        else { cam.style.willChange = ''; done?.(); }
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { view = { ...to }; apply(view); cam.style.willChange = ''; done?.(); return; }
      raf = requestAnimationFrame(tick);
    }
    function halt() { stop?.(); stop = null; timers.forEach(clearTimeout); timers = []; }
    return {
      regions,
      /** Overview, everything drawing itself region by region. */
      build() {
        halt(); at = -1; cancelAnimationFrame(raf); view = { ...OVER }; apply(view);
        anims.forEach((a) => a.reset()); linkAnim.reset();    // start from an empty canvas, even if the map was shown before
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { anims.forEach((a) => a.show()); linkAnim.show(); return; }
        const at0 = (ms, fn) => timers.push(setTimeout(fn, ms));
        at0(100, () => anims[0].play());
        const scale = [0, 2, 4, 5, 7, 9, 11, 12];               // semitones: the cascade's ticks climb a major scale
        for (let i = 1; i < anims.length; i++) {
          const t = AFTER + (i - 1) * GAP;
          at0(t - 120, () => arrows.forEach((a, j) => { if (a.to === i) linkAnims[j].play(); }));
          at0(t, () => { anims[i].play(); window.Sfx?.tick?.(660 * Math.pow(2, scale[i - 1] / 12)); });
        }
        at0(AFTER + (anims.length - 2) * GAP + 420, () => window.Sfx?.sparkle?.());
      },
      show() { halt(); anims.forEach((a) => a.show()); linkAnim.show(); },
      /** k = -1: the overview; 0..8: a region (its arrival animation starts when the camera lands). */
      goTo(k, o = {}) {
        halt(); anims.forEach((a) => a.show()); linkAnim.show();
        at = k;
        const to = k < 0 ? OVER : viewOf(ARCH.meta[k]);
        const land = () => { if (at !== k || o.noLand) return; opts.onLand?.(k); if (k >= 0) stop = regions[k].arrive?.() || null; };
        if (o.instant) { cancelAnimationFrame(raf); view = { ...to }; apply(view); cam.style.willChange = ''; land(); }
        else fly(to, o.ms, land);
      },
      halt,
      get at() { return at; },
    };
  };
})();
