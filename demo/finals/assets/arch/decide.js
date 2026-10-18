/* Region 3, "decide": Qwen3.6-35B-A3B reads the transcript and decides what to cut.
   Story: the transcript appears word by word, the expert grid flickers token by token (top-8 of 256 lit), and the filler,
   the self-correction and the scratched sentence each get a red strike and their tag as soon as the model has seen enough.
   Left (focal): Sarah's real words (DATA.clips['clean.before'].words, their real tags) in big serif type.
   Right: the model, a stack of 40 MoE layers; the front card is the 16 x 16 grid of 256 experts with the router's top-8 lit;
   under it the 40-layer hybrid pattern (3 Gated DeltaNet : 1 Gated Attention). Which experts light up is schematic
   (deterministic pseudo-random), not a trace of the real router. */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  const MOE = C.ffn, GDN = C.out, GA = C.attn;
  function rng(seed) { let s = ((seed + 1) * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const width = (t, guess) => { try { const w = t.getComputedTextLength(); if (w > 0) return w; } catch (e) { /* not laid out */ } return guess; };
  const LABEL = { filler: 'filler', correction: 'correction', scratched: 'scratched' };

  ARCH.regions.decide = {
    draw(g, ctx) {
      const items = [];
      const grp = (seq) => { const a = el('g', {}, g); items.push({ g: a, seq }); return a; };

      // ================================================================ 0: the transcript (focal)
      const src = ctx.D.clips['clean.before'].words;
      const last = src.findIndex((w) => /^Anyway/.test(w.w));                 // read up to "Anyway,"
      const words = src.slice(0, last + 1).map((w) => ({ w: w.w, tag: w.tag }));
      const BREAK_AFTER = new Set(['trip.', 'sorry,', 'watching']);           // line breaks, for a balanced block
      const g0 = grp(0);
      const hlG = el('g', {}, g0), wordG = el('g', {}, g0);
      const TX = 112, TY = 360, LH = 124, MAXW = 1000;
      let fs = 56;
      // lay out once, measure, shrink if the widest line is too wide
      const layout = (size) => {
        wordG.replaceChildren();
        let x = TX, line = 0, widest = 0;
        const sp = size * 0.27;
        words.forEach((w) => {
          const t = text(wordG, x, TY + line * LH, w.w, { fs: size, anchor: 'start', font: 'serif' });
          w.t = t; w.x = x; w.line = line; w.wd = width(t, w.w.length * size * 0.46);
          x += w.wd + sp; widest = Math.max(widest, x - sp - TX);
          if (BREAK_AFTER.has(w.w)) { x = TX; line++; }
        });
        const ell = text(wordG, x, TY + line * LH, '…', { fs: size, anchor: 'start', font: 'serif', color: C.ink2 });
        return { widest, ell };
      };
      let L = layout(fs);
      if (L.widest > MAXW) { fs = Math.floor(fs * MAXW / L.widest); L = layout(fs); }
      words.forEach((w) => {
        w.hl = el('rect', { x: w.x - 8, y: TY + w.line * LH - fs * 0.62, width: w.wd + 16, height: fs * 1.24, rx: 10,
          fill: alpha(C.ink, 0.12), stroke: C.ink2, 'stroke-width': 1.6, opacity: 0 }, hlG);
      });

      // the cut spans: consecutive words with the same tag
      const spans = [];
      words.forEach((w, i) => {
        if (!w.tag) return;
        const s = spans[spans.length - 1];
        if (s && s.tag === w.tag && s.j === i - 1) s.j = i; else spans.push({ tag: w.tag, i, j: i });
      });
      const g1 = grp(1), p1 = P(g1);
      spans.forEach((s) => {
        s.g = el('g', {}, g1);
        const ps = P(s.g);
        // one strike per line of the span
        const byLine = new Map();
        for (let k = s.i; k <= s.j; k++) {
          const w = words[k], seg = byLine.get(w.line) || { x0: w.x, x1: w.x + w.wd };
          seg.x1 = w.x + w.wd; byLine.set(w.line, seg);
        }
        s.strikes = [];
        for (const [line, seg] of byLine) {
          const y = TY + line * LH + fs * 0.06;
          s.strikes.push(ps.line(seg.x0 - 6, y, seg.x1 + 6, y, { color: C.cut, sw: 5, rough: 1.1, bow: 1.2 }));
        }
        // its tag, as a chip above the first word
        const w0 = words[s.i], cy = TY + w0.line * LH - fs * 0.98, lab = LABEL[s.tag] || s.tag;
        s.chip = el('g', {}, s.g);
        const ct = text(s.chip, w0.x + 16, cy, lab, { fs: 26, anchor: 'start', color: C.cut });
        const cw = width(ct, lab.length * 13);
        P(s.chip).rect(w0.x, cy - 19, cw + 32, 38, { color: C.cut, fill: alpha(C.cut, 0.14), sw: 2, r: 19, rough: 0.7 });
        s.chip.appendChild(ct);                                              // text above the pill
      });
      const tagOf = (k) => spans.find((s) => k >= s.i && k <= s.j);

      // ================================================================ 2: the model: router + 40 stacked MoE layers + 256 experts
      const g2 = grp(2), p2 = P(g2);
      const CX = 1300, CY = 330, CW = 452, CH = 452;                           // the front card
      for (let i = 5; i >= 1; i--) {
        p2.rect(CX + i * 12, CY - i * 12, CW, CH, { color: alpha(MOE, 0.32 + 0.06 * (5 - i)), fill: C.sheet, sw: 1.8, r: 14, rough: 0.7 });
      }
      p2.rect(CX, CY, CW, CH, { color: MOE, fill: alpha(MOE, 0.07), sw: 2.6, r: 14, rough: 0.7 });
      text(g2, CX + CW + 60, CY - 88, '× 40', { fs: 40, font: 'sans', weight: 600, color: MOE, anchor: 'end' });
      // router
      const RX = 1226, RY = CY + CH / 2;
      p2.circle(RX, RY, 58, { color: MOE, fill: alpha(MOE, 0.35), sw: 2.4, rough: 0.6 });
      text(g2, RX, RY + 64, 'top-8', { fs: 30, color: MOE });
      p2.arrow([[TX + MAXW + 16, RY], [RX - 38, RY]], { color: C.ink2, sw: 3.2, hl: 16 });
      const fanG = el('g', {}, g2);
      // 256 experts, 16 x 16
      const PITCH = 26, CELL = 21, GX = CX + (CW - (15 * PITCH + CELL)) / 2, GY = CY + (CH - (15 * PITCH + CELL)) / 2;
      const cells = [];
      for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) cells.push(el('rect', { x: GX + c * PITCH, y: GY + r * PITCH, width: CELL, height: CELL, rx: 4 }, g2));
      text(g2, CX + CW / 2, CY + CH + 40, '256 experts', { fs: 30, color: C.ink });

      // ================================================================ 3: the hybrid layer pattern, 10 x (3 DeltaNet + 1 attention)
      const g3 = grp(3);
      const SY = CY + CH + 84, TW = 8, TP = 11, GPX = 45.5;
      const SX0 = CX + (CW - (9 * GPX + 3 * TP + TW)) / 2;
      for (let k = 0; k < 10; k++) for (let i = 0; i < 4; i++) {
        const col = i < 3 ? GDN : GA;
        el('rect', { x: SX0 + k * GPX + i * TP, y: SY, width: TW, height: 34, rx: 2.5, fill: alpha(col, 0.75), stroke: col, 'stroke-width': 1.2 }, g3);
      }
      text(g3, SX0 - 2, SY + 66, 'DeltaNet', { fs: 26, anchor: 'start', color: GDN });
      text(g3, SX0 + 9 * GPX + 3 * TP + TW + 2, SY + 66, 'attention', { fs: 26, anchor: 'end', color: GA });

      // ================================================================ 4: the one result
      const g4 = grp(4);
      const big = text(g4, TX, 892, '24/28', { fs: 76, font: 'sans', weight: 600, color: C.model, anchor: 'start' });
      text(g4, TX + width(big, 200) + 24, 898, 'exact clean-ups', { fs: 32, anchor: 'start', color: C.ink2 });

      // ================================================================ state
      const topk = (seed) => {
        const r = rng(seed), set = new Map();
        while (set.size < 8) { const k = Math.floor(r() * 256); if (!set.has(k)) set.set(k, r()); }
        return set;
      };
      function setExperts(sel, flash) {
        cells.forEach((c, k) => {
          const w = sel.get(k);
          if (w != null) {
            c.setAttribute('fill', flash ? '#ffffff' : '#cbbcff'); c.setAttribute('fill-opacity', (0.85 + 0.15 * w).toFixed(2));
            c.setAttribute('stroke', alpha(MOE, 0.75)); c.setAttribute('stroke-width', flash ? 7 : 5);
          } else {
            c.setAttribute('fill', MOE); c.setAttribute('fill-opacity', 0.1);
            c.setAttribute('stroke', alpha(MOE, 0.4)); c.setAttribute('stroke-width', 1.1);
          }
        });
        fanG.replaceChildren();
        for (const [k, w] of sel) {
          const x2 = GX + (k % 16) * PITCH - 1, y2 = GY + Math.floor(k / 16) * PITCH + CELL / 2;
          el('line', { x1: RX + 26, y1: RY, x2, y2, stroke: MOE, 'stroke-opacity': (0.45 + 0.4 * w).toFixed(2), 'stroke-width': 2 }, fanG);
        }
      }
      const strikePaths = (s) => s.strikes.flatMap((n) => [...n.querySelectorAll('path')]);
      function showSpan(s, on, animate) {
        for (let k = s.i; k <= s.j; k++) words[k].t.setAttribute('fill', on ? C.cut : C.ink);
        s.chip.style.transition = animate ? 'opacity 260ms ease' : 'none';
        s.chip.style.opacity = on ? '1' : '0';
        for (const p of strikePaths(s)) {
          const len = p.getTotalLength();
          p.style.transition = 'none';
          p.style.strokeDasharray = `${len} ${len}`;
          p.style.strokeDashoffset = on && !animate ? '0' : `${len}`;
          if (on && animate) { p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset 300ms ease-out'; p.style.strokeDashoffset = '0'; }
        }
      }
      const STATIC_SEL = topk(words.length - 1);
      function staticState() {
        setExperts(STATIC_SEL, false);
        words.forEach((w) => { w.hl.setAttribute('opacity', 0); w.t.setAttribute('opacity', 1); });
        L.ell.setAttribute('opacity', 1);
        spans.forEach((s) => showSpan(s, true, false));
      }
      staticState();

      // ================================================================ arrival: read token by token, strike each bad span when it ends
      const STEP = 120, T0 = 150;
      return {
        items,
        arrive() {
          let timers = [];
          words.forEach((w) => { w.t.setAttribute('opacity', 0.16); w.hl.setAttribute('opacity', 0); });
          L.ell.setAttribute('opacity', 0.16);
          spans.forEach((s) => showSpan(s, false, false));
          setExperts(new Map(), false);
          words.forEach((w, k) => timers.push(setTimeout(() => {
            words.forEach((v, j) => v.hl.setAttribute('opacity', j === k ? 1 : 0));
            w.t.setAttribute('opacity', 1);
            setExperts(topk(k), true);
            timers.push(setTimeout(() => setExperts(topk(k), false), 55));
            const s = tagOf(k);
            if (s && s.j === k) showSpan(s, true, true);
          }, T0 + k * STEP)));
          timers.push(setTimeout(staticState, T0 + words.length * STEP + 280));
          return () => { timers.forEach(clearTimeout); timers = []; staticState(); };
        },
      };
    },
  };
})();
