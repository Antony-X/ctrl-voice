/* Region 8, "pron": catch the word that came out wrong.
   Story: the word "three" as big phoneme boxes /θ ɹ iː/ (espeak). A phoneme lattice of alternatives under them.
   The expected path lights green along the top; the path the phoneme model actually heard lights red, splitting off at
   the wrong phoneme (θ heard as t). The gap between how well each explains the audio is the score (GOP): a bar fills
   between them. Gradient boosting (trained on speechocean762 expert scores) turns it into a flag on the word.
   Left: the phoneme CTC model (wav2vec2 lv-60 espeak: CNN, 24 transformer layers, 392 IPA phones).
   ILLUSTRATION: the "three" said as "tree" lattice, its paths, and the gap height carry no measured values.
   Real numbers: × 24 layers, 392 phones, AUC 0.73 (GOP, no training) and 0.88 (with gradient boosting). */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  // IPA phones: Cambria Math has θ ɹ ː ɪ ∅; drawn upright rather than math italic.
  const ipa = (parent, x, y, s, o = {}) => {
    const t = text(parent, x, y, s, { font: 'math', ...o });
    t.style.fontStyle = 'normal';
    return t;
  };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  ARCH.regions.pron = {
    draw(g) {
      const items = [];
      const grp = (seq) => { const a = el('g', {}, g); items.push({ g: a, seq }); return a; };

      // ------------------------------------------------------------ geometry
      const ROW = 450;                                   // the expected row
      const BW = 132, BH = 112;                          // big phoneme boxes
      const cw = 104, ch = 84;                           // candidate boxes
      const SX = [650, 885, 1120];                       // slot centres
      const START = [482, ROW];
      const cand = [                                     // the lattice: expected phone first, then alternatives
        [['θ', ROW], ['t', 578], ['s', 688], ['f', 798], ['∅', 908]],
        [['ɹ', ROW], ['l', 578], ['w', 688], ['∅', 798]],
        [['iː', ROW], ['ɪ', 578], ['eɪ', 688], ['∅', 798]],
      ];
      const MX = 1342, YR = 318, YG = 590;               // the score meter: heard (red) above expected (green)
      const box = (k, j) => { const [, y] = cand[k][j], w = j ? cw : BW, h = j ? ch : BH; return { x: SX[k] - w / 2, y: y - h / 2, w, h, cx: SX[k], cy: y }; };

      // ------------------------------------------------------------ 0: the phoneme model (left)
      const LX = 262;
      {
        const a = grp(0), p = P(a);
        const r = rng(8), n = 240, ys = [];
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const burst = u > 0.14 && u < 0.22 ? 0.5 * Math.sin(Math.PI * (u - 0.14) / 0.08) : 0;
          const voiced = u > 0.28 && u < 0.92 ? Math.pow(Math.sin(Math.PI * (u - 0.28) / 0.64), 0.7) : 0;
          ys.push(burst * (r() * 2 - 1) + voiced * Math.sin(i * 1.9) * (0.55 + 0.45 * r()) + 0.02 * (r() * 2 - 1));
        }
        p.wave(112, 292, 300, 78, ys, { color: C.ink2, sw: 1.8, max: 1 });
        p.arrow([[LX, 384], [LX, 420]], { color: C.ink3, hl: 12 });
        for (let i = 0; i < 7; i++) p.block(122 + i * 41, 430, 34, 56, null, C.conv, { r: 6, sw: 1.8 });   // CNN: 7 conv blocks
        p.arrow([[LX, 498], [LX, 534]], { color: C.ink3, hl: 12 });
        p.stack(124, 562, 226, 96, 'wav2vec2', C.attn, 24, { fs: 30, nfs: 30 });
        p.arrow([[LX, 670], [LX, 706]], { color: C.ink3, hl: 12 });
        p.block(122, 716, 282, 76, '392 phones', C.out, { fs: 30 });
        p.arrow([[404, 752], [450, 724], [470, 540], [START[0] - 6, START[1] + 16]], { color: C.out, curve: true, hl: 13, sw: 2.2 });
      }
      // ------------------------------------------------------------ 1: the word → espeak → expected phones
      {
        const a = grp(1), p = P(a);
        text(a, 662, 290, '“three”', { fs: 54, font: 'serif' });
        p.arrow([[748, 290], [800, 290]], { color: C.ink2, hl: 12 });
        p.block(806, 262, 158, 58, 'espeak', C.extra, { fs: 28 });
        p.arrow([[885, 324], [885, 372]], { color: C.ink2, hl: 12 });
        const bx0 = SX[0] - BW / 2, bx1 = SX[2] + BW / 2, by = 384;
        p.path(`M${bx0} ${by + 8} Q${bx0} ${by} ${bx0 + 14} ${by} L${885 - 14} ${by} Q885 ${by} 885 ${by - 8} Q885 ${by} ${885 + 14} ${by} L${bx1 - 14} ${by} Q${bx1} ${by} ${bx1} ${by + 8}`, { color: C.made, sw: 2.2, rough: 0.4 });
        text(a, 662, 336, 'illustration', { fs: 20, color: C.ink3 });
      }
      // ------------------------------------------------------------ 2: the lattice of alternatives (faint)
      {
        const a = grp(2), p = P(a);
        const edge = (x1, y1, x2, y2) => el('line', { x1, y1, x2, y2, stroke: C.ink3, 'stroke-width': 1.4, opacity: 0.45 }, a);
        cand[0].forEach((_, j) => { const b = box(0, j); edge(START[0], START[1], b.x, b.cy); });
        for (let k = 0; k < 2; k++) cand[k].forEach((_, i) => cand[k + 1].forEach((__, j) => { const A = box(k, i), B = box(k + 1, j); edge(A.x + A.w, A.cy, B.x, B.cy); }));
        cand.forEach((col, k) => col.forEach(([ph], j) => {
          if (!j) return;
          const b = box(k, j), red = k === 0 && j === 1;
          p.rect(b.x, b.y, b.w, b.h, { color: red ? C.cut : C.ink3, fill: alpha(red ? C.cut : C.ink3, red ? 0.2 : 0.1), sw: red ? 2.8 : 1.6, r: 10 });
          ipa(a, b.cx, b.cy + 1, ph, { fs: red ? 46 : 38, color: red ? C.ink : C.ink2 });
        }));
        p.circle(START[0], START[1], 24, { color: C.ink2, fill: C.ink2, sw: 1.6, rough: 0.4 });
      }
      // ------------------------------------------------------------ 3: the expected phones, big
      const flashes = [];                                 // overlay rects that pulse during the arrival
      {
        const a = grp(3), p = P(a);
        cand.forEach((col, k) => {
          const b = box(k, 0);
          p.rect(b.x, b.y, b.w, b.h, { color: C.made, fill: alpha(C.made, 0.16), sw: 3, r: 12 });
          ipa(a, b.cx, b.cy + 2, col[0][0], { fs: 64 });
        });
      }
      const flash = (k, j, col) => {
        const b = box(k, j), r = el('rect', { x: b.x + 3, y: b.y + 3, width: b.w - 6, height: b.h - 6, rx: 10, fill: col, opacity: 0 }, g);
        r.style.pointerEvents = 'none'; flashes.push(r); return r;
      };
      // ------------------------------------------------------------ 4, 5: the two paths, segment by segment
      const green = [], red = [];
      const strand = (parent, list, col, pts) => { const s = el('g', {}, parent); P(s).curve(pts, { color: col, sw: 5.5, rough: 0.5, single: true }); list.push(s); };
      const b0 = box(0, 0), b1 = box(1, 0), b2 = box(2, 0), bt = box(0, 1);
      {
        const a = grp(4), y = ROW + 8;
        strand(a, green, C.made, [[START[0] + 12, ROW], [b0.x, y]]);
        strand(a, green, C.made, [[b0.x + b0.w, y], [b1.x, y]]);
        strand(a, green, C.made, [[b1.x + b1.w, y], [b2.x, y]]);
        strand(a, green, C.made, [[b2.x + b2.w, y], [1240, y + 14], [MX - 4, YG]]);
      }
      {
        const a = grp(5), y = ROW - 24;
        strand(a, red, C.cut, [[START[0] + 8, ROW + 10], [540, 520], [bt.x, bt.cy]]);
        strand(a, red, C.cut, [[bt.x + bt.w, bt.cy], [780, 540], [b1.x, ROW + 34]]);
        strand(a, red, C.cut, [[b1.x + b1.w, y], [b2.x, y]]);
        strand(a, red, C.cut, [[b2.x + b2.w, y], [1240, y - 20], [MX - 4, YR]]);
      }
      const fl = { g: [flash(0, 0, C.made), flash(1, 0, C.made), flash(2, 0, C.made)], r: [flash(0, 1, C.cut)] };
      // ------------------------------------------------------------ 6: the gap between them is the score
      let bar, gopLabel, endR, endG;
      {
        const a = grp(6), p = P(a);
        bar = el('g', {}, a);
        P(bar).rect(MX - 26, YR, 52, YG - YR, { color: C.check, fill: alpha(C.check, 0.6), fillStyle: 'hachure', gap: 7, sw: 2.6, r: 6 });
        endR = el('g', {}, a); endG = el('g', {}, a);
        P(endR).circle(MX, YR, 26, { color: C.cut, fill: C.cut, sw: 2, rough: 0.4 });
        P(endG).circle(MX, YG, 26, { color: C.made, fill: C.made, sw: 2, rough: 0.4 });
        text(endR, MX + 34, YR, 'heard', { fs: 30, color: C.cut, anchor: 'start' });
        text(endG, MX + 34, YG, 'expected', { fs: 30, color: C.made, anchor: 'start' });
        gopLabel = el('g', {}, a);
        text(gopLabel, MX + 40, (YR + YG) / 2, 'GOP', { fs: 46, color: C.check, font: 'sans', weight: 600, anchor: 'start' });
      }
      // ------------------------------------------------------------ 7: gradient boosting
      {
        const a = grp(7), p = P(a);
        p.arrow([[1496, (YR + YG) / 2 - 8], [1530, 420], [1560, 404]], { color: C.check, curve: true, hl: 12 });
        const tree = (cx, y0) => {
          const kids = [cx - 30, cx + 30], leaves = [cx - 45, cx - 15, cx + 15, cx + 45];
          kids.forEach((kx) => p.line(cx, y0 + 9, kx, y0 + 36, { color: C.ink3, sw: 1.8, rough: 0.4 }));
          leaves.forEach((lx, i) => p.line(kids[i >> 1], y0 + 44, lx, y0 + 72, { color: C.ink3, sw: 1.8, rough: 0.4 }));
          p.circle(cx, y0, 20, { color: C.out, fill: alpha(C.out, 0.3), sw: 1.8, rough: 0.4 });
          kids.forEach((kx) => p.circle(kx, y0 + 42, 18, { color: C.out, fill: alpha(C.out, 0.3), sw: 1.8, rough: 0.4 }));
          leaves.forEach((lx) => p.rect(lx - 9, y0 + 72, 18, 18, { color: C.out, fill: alpha(C.out, 0.6), sw: 1.6, r: 3, rough: 0.4 }));
        };
        tree(1610, 318); p.op(1683, 364, '+', { color: C.out }); tree(1756, 318);
        text(a, 1683, 448, 'gradient boosting', { fs: 28 });
        text(a, 1683, 482, 'speechocean762', { fs: 24, color: C.ink2 });
      }
      // ------------------------------------------------------------ 8: the word is flagged
      let underline, flagG;
      {
        const a = grp(8), p = P(a);
        p.arrow([[1683, 506], [1683, 560]], { color: C.ink3, hl: 12 });
        text(a, 1650, 626, '“three”', { fs: 58, font: 'serif' });
        let d = '';
        for (let i = 0; i <= 48; i++) { const x = 1562 + i * 3.7, y = 670 + 6 * Math.sin(i / 48 * Math.PI * 6); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
        underline = el('path', { d, fill: 'none', stroke: C.cut, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, a);
        flagG = el('g', {}, a);
        const fp = P(flagG);
        fp.line(1776, 674, 1776, 584, { color: C.ink2, sw: 3, rough: 0.4 });
        fp.path('M1778 586 L1816 601 L1778 618 Z', { color: C.cut, fill: C.cut, sw: 2, rough: 0.5 });
      }
      // ------------------------------------------------------------ 9: the result
      {
        const a = grp(9), p = P(a);
        text(a, 1588, 838, '0.73', { fs: 42, color: C.ink2, font: 'sans', weight: 500, anchor: 'end' });
        p.arrow([[1600, 838], [1640, 838]], { color: C.ink2, sw: 2.6, hl: 13 });
        text(a, 1650, 838, '0.88', { fs: 72, color: C.model, font: 'sans', weight: 700, anchor: 'start' });
        text(a, 1660, 908, 'AUC vs experts', { fs: 30, color: C.ink });
      }

      // ------------------------------------------------------------ arrival: green path, red path, the gap fills, the flag
      let timers = [], raf = 0;
      const later = (ms, f) => timers.push(setTimeout(f, ms));
      const hide = (segs) => segs.forEach((s) => s.querySelectorAll('path').forEach((pth) => {
        const L = pth.getTotalLength(); pth.style.transition = 'none'; pth.style.strokeDasharray = `${L} ${L}`; pth.style.strokeDashoffset = `${L}`;
      }));
      const sweep = (pths, ms) => pths.forEach((pth) => { pth.getBoundingClientRect(); pth.style.transition = `stroke-dashoffset ${ms}ms linear`; pth.style.strokeDashoffset = '0'; });
      const pulse = (r) => { r.style.transition = 'opacity 160ms ease-out'; r.style.opacity = '0.55'; later(320, () => { r.style.transition = 'opacity 700ms ease'; r.style.opacity = '0'; }); };
      const setBar = (k) => bar.setAttribute('transform', k >= 1 ? '' : `translate(0 ${YG}) scale(1 ${Math.max(0.001, k)}) translate(0 ${-YG})`);
      const pop = (k) => flagG.setAttribute('transform', k >= 1 ? '' : `translate(1776 674) scale(${Math.max(0.001, k)}) translate(-1776 -674)`);
      const ULEN = underline.getTotalLength ? underline.getTotalLength() || 600 : 600;
      function finish() {
        timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
        for (const s of green.concat(red)) s.querySelectorAll('path').forEach((pth) => { pth.style.transition = 'none'; pth.style.strokeDashoffset = '0'; });
        flashes.forEach((r) => { r.style.transition = 'none'; r.style.opacity = '0'; });
        setBar(1); pop(1);
        for (const e of [gopLabel, endR, endG]) { e.style.transition = 'none'; e.style.opacity = ''; }
        underline.style.transition = 'none'; underline.style.strokeDasharray = ''; underline.style.strokeDashoffset = '';
      }
      function tween(ms, f) {
        const t0 = performance.now();
        const step = (now) => { const e = Math.min(1, (now - t0) / ms); f(1 - Math.pow(1 - e, 3)); if (e < 1) raf = requestAnimationFrame(step); };
        raf = requestAnimationFrame(step);
      }
      return {
        items,
        arrive() {
          finish();
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) return finish;
          hide(green); hide(red);
          setBar(0); pop(0);
          for (const e of [gopLabel, endR, endG]) e.style.opacity = '0';
          const show = (e) => { e.style.transition = 'opacity 250ms ease-out'; e.style.opacity = '1'; };
          underline.style.strokeDasharray = `${ULEN} ${ULEN}`; underline.style.strokeDashoffset = `${ULEN}`;
          const per = 240;
          green.forEach((s, i) => later(100 + i * per, () => { sweep([...s.querySelectorAll('path')], per); if (i < 3) later(per - 40, () => pulse(fl.g[i])); }));
          later(100 + green.length * per - 30, () => show(endG));
          red.forEach((s, i) => later(1250 + i * per, () => { sweep([...s.querySelectorAll('path')], per); if (i === 0) later(per - 40, () => pulse(fl.r[0])); }));
          later(1250 + red.length * per - 30, () => show(endR));
          later(2350, () => tween(750, setBar));
          later(2700, () => { gopLabel.style.transition = 'opacity 400ms ease'; gopLabel.style.opacity = '1'; });
          later(3150, () => { underline.getBoundingClientRect(); underline.style.transition = 'stroke-dashoffset 500ms ease-out'; underline.style.strokeDashoffset = '0'; tween(450, pop); });
          return finish;
        },
      };
    },
  };
})();
