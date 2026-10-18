/* Region 5, "Re-say" (PlayDiffusion). One story: her audio as a row of tokens, a gap of masked [?] tokens where
   "Dan have" was; a 20-layer non-causal transformer fills the gap step by step (30-step cosine schedule, shown at
   steps 0 / 10 / 20 / 30); BigVGAN, conditioned on her voice, turns it into audio that is spliced in: "Dan has".
   Real data: every waveform (inside the tokens and at the bottom) is DATA.figs.closeup peaks;
   the number filled at each snapshot is the cosine schedule, round(6 · cos(π/2 · step/30)) still masked.
   Schematic: the token count/size (real units are far denser) and which slot fills first. */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  const STEPS = 30, SNAP = [0, 10, 20, 30], NG = 6, NL = 6, NR = 5;   // gap / left / right token counts
  const ORDER = [2, 4, 0, 5, 1, 3];                                    // which gap slot fills first (schematic)
  const nMasked = (s) => Math.round(NG * Math.cos((Math.PI / 2) * (s / STEPS)));
  const filledAt = (s) => new Set(ORDER.slice(0, NG - nMasked(s)));

  // geometry
  const X0 = 360, PITCH = 76, TW = 64, TH = 80, ROW_Y = [265, 385, 505, 625];
  const tokX = (k) => X0 + k * PITCH;                                  // k = 0 .. NL+NG+NR-1
  const GAP_X0 = tokX(NL), GAP_X1 = tokX(NL + NG - 1) + TW, GAP_CX = (GAP_X0 + GAP_X1) / 2;

  /** Waveform as vertical bars, one per peak (0..1 peaks spanning clip time [c0, c1]), over [t0, t1] drawn into x..x+w. */
  function bars(parent, clip, t0, t1, x, w, cy, hh, color, o = {}) {
    const pk = clip.peaks, n = pk.length, c0 = clip.t0, c1 = clip.t1, dt = (c1 - c0) / n;
    const i0 = Math.max(0, Math.ceil((t0 - c0) / dt - 0.5)), i1 = Math.min(n - 1, Math.floor((t1 - c0) / dt - 0.5));
    const m = Math.max(1, i1 - i0), inset = o.inset ?? 0;
    let d = '';
    for (let i = i0; i <= i1; i++) {
      const px = x + inset + ((i - i0) / m) * (w - 2 * inset), v = Math.max(0.04, pk[i]) * hh;
      d += `M${px.toFixed(1)} ${(cy - v).toFixed(1)}V${(cy + v).toFixed(1)}`;
    }
    return el('path', { d, fill: 'none', stroke: color, 'stroke-width': o.sw ?? 3, 'stroke-linecap': 'round', opacity: o.opacity }, parent);
  }

  ARCH.regions['playdiff'] = {
    draw(g, ctx) {
      const cu = ctx.D.figs.closeup, B = cu.before, A = cu.after, items = [];
      const group = (seq, attrs) => { const a = el('g', attrs || {}, g); items.push({ g: a, seq }); return [a, P(a)]; };

      // time slices: the gap is "Dan have" in her recording; the green tokens are slices of the re-said "Dan has"
      const [b0, b1] = B.regions[0], [a0, a1] = A.regions[0];
      const dB = (b1 - b0) / NG, dA = (a1 - a0) / NG;
      const sliceOf = (k) => (k < NL ? b0 - (NL - k) * dB : b1 + (k - NL - NG) * dB);   // context token start time

      const ctxToken = (parent, p, k, y) => {
        p.rect(tokX(k), y, TW, TH, { color: C.ink2, fill: alpha(C.ink2, 0.1), sw: 1.8, r: 8, rough: 0.8 });
        const t = sliceOf(k);
        bars(parent, B, t, t + dB, tokX(k) + 10, TW - 20, y + TH / 2, TH * 0.34, C.ink2, { sw: 3.2 });
      };
      const maskToken = (parent, p, i, y) => {
        p.rect(tokX(NL + i), y, TW, TH, { color: C.check, fill: alpha(C.check, 0.1), sw: 2, r: 8, rough: 0.8, dash: [7, 5] });
        text(parent, tokX(NL + i) + TW / 2, y + TH / 2 + 2, '?', { fs: 42, font: 'sans', weight: 600, color: C.check });
      };
      const greenToken = (parent, p, i, y) => {
        p.rect(tokX(NL + i), y, TW, TH, { color: C.made, fill: alpha(C.made, 0.2), sw: 2.4, r: 8, rough: 0.8 });
        const t = a0 + i * dA;
        bars(parent, A, t, t + dA, tokX(NL + i) + 10, TW - 20, y + TH / 2, TH * 0.34, C.made, { sw: 2.6 });
      };

      // ---------------------------------------------------------------- row 0: her audio, with the masked gap
      const rows = [], greens = [], marks = [], arrowsIn = [];
      {
        const [a, p] = group(0);
        text(a, (tokX(0) + tokX(NL - 1) + TW) / 2, 236, 'her audio', { fs: 28, color: C.ink2 });
        text(a, GAP_CX, 234, 'Dan have', { fs: 32, font: 'serif', color: C.cut });
        p.line(GAP_CX - 78, 240, GAP_CX + 78, 238, { color: C.cut, sw: 2.6, rough: 0.9 });
        for (let k = 0; k < NL + NG + NR; k++) if (k < NL || k >= NL + NG) ctxToken(a, p, k, ROW_Y[0]);
        for (let i = 0; i < NG; i++) maskToken(a, p, i, ROW_Y[0]);
        text(a, tokX(NL + NG + NR - 1) + TW + 24, ROW_Y[0] + TH / 2, 'step 0', { fs: 26, anchor: 'start', font: 'sans', color: C.ink2 });
        rows.push(a);
      }

      // ---------------------------------------------------------------- the denoiser: 20 non-causal layers
      {
        const [a, p] = group(1);
        const x = 116, y = 398, w = 156, h = 300;
        for (let i = 2; i > 0; i--) p.rect(x + i * 9, y - i * 9, w, h, { color: alpha(C.attn, 0.5), fill: C.sheet, sw: 1.6, r: 12, rough: 0.9 });
        p.rect(x, y, w, h, { color: C.attn, fill: C.panel, sw: 2.2, r: 12, rough: 0.8 });
        text(a, x + w / 2, y + 46, '× 20', { fs: 40, font: 'sans', weight: 600, color: C.attn });
        for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)                // full grid: every token sees both sides
          el('rect', { x: x + 30 + j * 20, y: y + 88 + i * 20, width: 16, height: 16, rx: 2.5, fill: C.attn, opacity: (0.35 + 0.5 * (((i * 7 + j * 3) % 5) / 4)).toFixed(2) }, a);
        p.block(x + 26, y + 206, w - 52, 26, null, C.ffn, { r: 6 });
        p.block(x + 26, y + 244, w - 52, 26, null, C.ffn, { r: 6 });
        p.arrow([[tokX(0) - 10, ROW_Y[0] + TH / 2], [250, ROW_Y[0] + 50], [x + w / 2 + 6, y - 26]], { color: C.ink2, sw: 2.2, curve: true, hl: 13 });
      }

      // ---------------------------------------------------------------- rows at steps 10, 20, 30
      for (let r = 1; r < SNAP.length; r++) {
        const [a, p] = group(1 + r), y = ROW_Y[r], on = filledAt(SNAP[r]);
        const dim = el('g', { opacity: 0.45 }, a), pd = P(dim);
        for (let k = 0; k < NL + NG + NR; k++) if (k < NL || k >= NL + NG) ctxToken(dim, pd, k, y);
        const gs = [], ms = [];
        for (let i = 0; i < NG; i++) {
          const m = el('g', {}, a); maskToken(m, P(m), i, y); ms.push(m);
          const gr = el('g', {}, a); greenToken(gr, P(gr), i, y); gs.push(gr);
          m.setAttribute('opacity', on.has(i) ? 0 : 1); gr.setAttribute('opacity', on.has(i) ? 1 : 0);
        }
        greens.push(gs); marks.push(ms);
        const ar = el('g', {}, a);
        P(ar).arrow([[292, y + TH / 2], [tokX(0) - 12, y + TH / 2]], { color: C.ink2, sw: 2.2, hl: 12 });
        arrowsIn.push(ar);
        text(a, tokX(NL + NG + NR - 1) + TW + 24, y + TH / 2, `step ${SNAP[r]}`, { fs: 26, anchor: 'start', font: 'sans', color: r === SNAP.length - 1 ? C.made : C.ink2, weight: r === SNAP.length - 1 ? 600 : null });
        rows.push(a);
      }

      // ---------------------------------------------------------------- BigVGAN, in her voice
      let vocoder;
      {
        const [a, p] = group(5);
        const yT = 726, yB = 786;
        p.arrow([[GAP_CX, ROW_Y[3] + TH + 4], [GAP_CX, yT - 2]], { color: C.made, sw: 2.4, hl: 11 });
        vocoder = el('g', {}, a);
        P(vocoder).poly([[GAP_CX - 120, yT], [GAP_CX + 120, yT], [GAP_CX + 190, yB], [GAP_CX - 190, yB]], { closed: true, color: C.out, fill: alpha(C.out, 0.18), sw: 2.2, rough: 0.8 });
        text(vocoder, GAP_CX, (yT + yB) / 2 + 2, 'BigVGAN', { fs: 28, color: C.ink });
        // her voice: a speaker embedding conditions the vocoder
        text(a, 690, 736, 'her voice', { fs: 28, color: C.ink2 });
        for (let i = 0; i < 8; i++) el('rect', { x: 628 + i * 16, y: 760, width: 12, height: 18, rx: 2.5, fill: C.extra, opacity: (0.4 + 0.075 * ((i * 5) % 8)).toFixed(2) }, a);
        p.arrow([[766, 769], [GAP_CX - 150, 769]], { color: C.ink2, sw: 2.2, hl: 12 });
      }

      // ---------------------------------------------------------------- the message: her recording, the green piece spliced in
      let piece, pieceLabel;
      {
        const [a, p] = group(6);
        const pxs = 514, X = GAP_CX - ((a0 + a1) / 2 - A.t0) * pxs, T1 = A.t0 + (1720 - X) / pxs, CY = 872, HH = 40;
        const tx = (t) => X + (t - A.t0) * pxs;
        bars(a, A, A.t0, a0 - 0.004, X, tx(a0 - 0.004) - X, CY, HH, C.ink2, { sw: 2.6, opacity: 0.85 });
        bars(a, A, a1 + 0.004, T1, tx(a1 + 0.004), tx(T1) - tx(a1 + 0.004), CY, HH, C.ink2, { sw: 2.6, opacity: 0.85 });
        piece = el('g', {}, a);
        P(piece).rect(tx(a0) - 8, CY - HH - 10, tx(a1) - tx(a0) + 16, 2 * HH + 20, { color: C.made, fill: alpha(C.made, 0.1), sw: 2, r: 8, rough: 0.6 });
        bars(piece, A, a0, a1, tx(a0), tx(a1) - tx(a0), CY, HH, C.made, { sw: 2.6 });
        pieceLabel = text(a, (tx(a0) + tx(a1)) / 2, 950, 'Dan has', { fs: 34, font: 'serif', color: C.made });
      }

      // ---------------------------------------------------------------- result
      {
        const [a] = group(7);
        text(a, 118, 862, '9 of 10', { fs: 54, anchor: 'start', font: 'sans', weight: 600, color: C.made });
        text(a, 120, 918, 'words right', { fs: 28, anchor: 'start', color: C.ink2 });
      }

      // ================================================================ arrival: the gap fills in, step by step, then the piece drops in
      const setStatic = () => {
        rows.forEach((r) => { r.style.transition = 'none'; r.style.opacity = ''; r.style.transform = ''; });
        for (let r = 1; r < SNAP.length; r++) {
          const on = filledAt(SNAP[r]);
          greens[r - 1].forEach((gr, i) => { gr.style.transition = 'none'; gr.style.transform = ''; gr.setAttribute('opacity', on.has(i) ? 1 : 0); });
          marks[r - 1].forEach((m, i) => m.setAttribute('opacity', on.has(i) ? 0 : 1));
          arrowsIn[r - 1].style.transition = 'none'; arrowsIn[r - 1].style.filter = ''; arrowsIn[r - 1].style.opacity = '';
        }
        piece.style.transition = 'none'; piece.style.transform = ''; piece.style.opacity = '';
        pieceLabel.style.transition = 'none'; pieceLabel.style.opacity = '';
        vocoder.style.transition = 'none'; vocoder.style.opacity = '';
      };
      let stopPrev = null;

      return {
        items,
        arrive() {
          stopPrev?.();
          const timers = [], at = (ms, f) => timers.push(setTimeout(f, ms));
          // start: fade back to step 0 only; the green piece leaves the message
          for (let r = 1; r < SNAP.length; r++) { rows[r].style.transition = 'opacity 160ms ease'; rows[r].style.opacity = '0'; }
          piece.style.transition = 'opacity 160ms ease'; piece.style.opacity = '0';
          pieceLabel.style.transition = 'opacity 160ms ease'; pieceLabel.style.opacity = '0';
          at(170, () => {
            for (let r = 1; r < SNAP.length; r++) {
              const prev = filledAt(SNAP[r - 1]);
              greens[r - 1].forEach((gr, i) => gr.setAttribute('opacity', prev.has(i) ? 1 : 0));
              marks[r - 1].forEach((m, i) => m.setAttribute('opacity', prev.has(i) ? 0 : 1));
              rows[r].style.transition = 'none'; rows[r].style.transform = `translateY(${ROW_Y[r - 1] - ROW_Y[r]}px)`;
            }
            piece.style.transition = 'none'; piece.style.transform = 'translateY(-46px)';
          });
          const T = 420, ROW = 760;
          for (let r = 1; r < SNAP.length; r++) {
            const t0 = T + (r - 1) * ROW, prev = filledAt(SNAP[r - 1]), now = [...filledAt(SNAP[r])].filter((i) => !prev.has(i));
            at(t0, () => { rows[r].style.transition = 'opacity 200ms ease, transform 300ms cubic-bezier(.2,.9,.3,1)'; rows[r].style.opacity = '1'; rows[r].style.transform = 'translateY(0)'; });
            now.forEach((i, n) => at(t0 + 340 + n * 110, () => {
              const gr = greens[r - 1][i];
              marks[r - 1][i].setAttribute('opacity', 0);
              gr.style.transition = 'none'; gr.style.transformOrigin = `${tokX(NL + i) + TW / 2}px ${ROW_Y[r] + TH / 2}px`; gr.style.transform = 'scale(1.35)';
              gr.setAttribute('opacity', 1); gr.getBoundingClientRect();
              gr.style.transition = 'transform 260ms cubic-bezier(.3,1.6,.5,1)'; gr.style.transform = 'scale(1)';
            }));
          }
          const tV = T + 3 * ROW + 120;
          at(tV, () => { vocoder.style.transition = 'opacity 120ms'; vocoder.style.opacity = '0.35'; });
          at(tV + 160, () => { vocoder.style.opacity = '1'; });
          at(tV + 260, () => {
            piece.style.transition = 'transform 420ms cubic-bezier(.3,1.4,.5,1), opacity 200ms ease'; piece.style.opacity = '1'; piece.style.transform = 'translateY(0)';
            pieceLabel.style.transition = 'opacity 300ms ease 200ms'; pieceLabel.style.opacity = '1';
            window.Sfx?.tick?.();
          });
          at(tV + 1100, setStatic);
          const stop = () => { timers.forEach(clearTimeout); setStatic(); if (stopPrev === stop) stopPrev = null; };
          stopPrev = stop;
          return stop;
        },
      };
    },
  };
})();
