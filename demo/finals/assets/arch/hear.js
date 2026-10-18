/* Region 1, "hear": Whisper large-v3-turbo. One picture: sound flows in, words pop out one by one.
   Left: the real audio window (0.74-4.02 s of Sarah's message): its waveform and its real mel spectrogram.
   Middle: the encoder, 32 blocks drawn as a deep deck of cards; the decoder, 4 cards, reading the encoder (cross-attention).
   Right: the words Whisper actually wrote for this window (figs.step1.whisper), as big chips; a loop feeds each one back.
   Arrival: the audio streams in (wave and mel reveal left to right), a pulse runs through the 32 blocks, then the
   words pop out one at a time. */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  // an opaque colour: hex a over hex b at amount t (so stacked cards hide the ones behind)
  function mix(a, b, t) {
    const p = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
    return '#' + [0, 1, 2].map((i) => Math.round(p(b, i) + (p(a, i) - p(b, i)) * t).toString(16).padStart(2, '0')).join('');
  }

  ARCH.regions.hear = {
    draw(g, ctx) {
      const D = ctx.D, items = [];
      const grp = (seq) => { const a = el('g', {}, g); items.push({ g: a, seq }); return a; };
      const S = D.figs.step1, T0 = S.t0, T1 = S.t1;

      // ---------------------------------------------------------------- 0: microphone + the real waveform
      const AX0 = 186, AX1 = 548;                                 // audio column (wave and mel share the time axis)
      const WY = 420, WH = 74;
      const tx = (t) => AX0 + (t - T0) / (T1 - T0) * (AX1 - AX0);
      const g0 = grp(0), p0 = P(g0);
      const mx = 128, my = WY - 10;
      p0.rect(mx - 17, my - 44, 34, 62, { r: 17, color: C.ink2, fill: alpha(C.ink2, 0.16), sw: 2.2 });
      p0.path(`M${mx - 29} ${my - 6} Q${mx - 29} ${my + 34} ${mx} ${my + 34} Q${mx + 29} ${my + 34} ${mx + 29} ${my - 6}`, { color: C.ink2, sw: 2.2, rough: 0.6 });
      p0.line(mx, my + 34, mx, my + 52, { color: C.ink2, sw: 2.2 });
      p0.line(mx - 18, my + 52, mx + 18, my + 52, { color: C.ink2, sw: 2.2 });
      const clip = D.clips['clean.before'], n = clip.peaks.length, dur = clip.dur;
      const i0 = Math.floor(T0 / dur * n), i1 = Math.ceil(T1 / dur * n);
      let wd = '';
      for (let i = i0; i < i1; i++) {
        const ta = Math.max(T0, i / n * dur), tb = Math.min(T1, (i + 1) / n * dur);
        if (tb - ta < 0.01) continue;
        const x = tx(ta) + 0.8, w = Math.max(1, tx(tb) - tx(ta) - 1.6), h = Math.max(1.5, clip.peaks[i] * WH);
        wd += `M${x.toFixed(1)} ${(WY - h).toFixed(1)}h${w.toFixed(1)}v${(2 * h).toFixed(1)}h${(-w).toFixed(1)}Z`;
      }
      el('path', { d: wd, fill: C.ink3, stroke: 'none', opacity: 0.55 }, g0);                       // dim copy, under
      const streamClip = el('clipPath', { id: 'hear-stream' }, g0);
      const streamRect = el('rect', { x: AX0 - 4, y: 300, width: AX1 - AX0 + 8, height: 560 }, streamClip);
      const waveLit = el('path', { d: wd, fill: C.ink, stroke: 'none', 'clip-path': 'url(#hear-stream)' }, g0);

      // ---------------------------------------------------------------- 1: the real mel spectrogram of the same window
      const MY0 = 548, MY1 = 770;
      const g1 = grp(1), p1 = P(g1);
      p1.arrow([[(AX0 + AX1) / 2, WY + WH + 8], [(AX0 + AX1) / 2, MY0 - 8]], { color: C.ink2, sw: 2.2, hl: 12 });
      el('rect', { x: AX0, y: MY0, width: AX1 - AX0, height: MY1 - MY0, fill: '#14142a' }, g1);
      el('image', { href: 'media/step1_mel.png', x: AX0, y: MY0, width: AX1 - AX0, height: MY1 - MY0, preserveAspectRatio: 'none', 'clip-path': 'url(#hear-stream)' }, g1);
      p1.rect(AX0 - 4, MY0 - 4, AX1 - AX0 + 8, MY1 - MY0 + 8, { r: 6, color: C.ink3, sw: 1.8, rough: 0.6 });
      text(g1, (AX0 + AX1) / 2, MY1 + 40, 'mel spectrogram', { fs: 28, color: C.ink2 });
      const playhead = el('line', { x1: AX0, y1: WY - WH - 10, x2: AX0, y2: MY1 + 4, stroke: C.made, 'stroke-width': 3, opacity: 0 }, g);

      // ---------------------------------------------------------------- 2: the encoder, 32 blocks as a deep deck
      const g2 = grp(2), p2 = P(g2);
      const E = { x0: 628, step: 11, w: 124, rise: 76, top: 352, bot: 948, n: 32 };
      const cardFill = mix(C.attn, C.sheet, 0.2), cardFill2 = mix(C.attn, C.sheet, 0.3);
      const card = (x, top, bot, w, rise) => [[x, bot], [x, top], [x + w, top - rise], [x + w, bot - rise]];
      const encLit = [];
      p2.arrow([[AX1 + 14, (MY0 + MY1) / 2], [E.x0 - 6, (MY0 + MY1) / 2]], { color: C.ink2, sw: 2.6, hl: 15 });
      for (let i = 0; i < E.n; i++) {
        const x = E.x0 + i * E.step, pts = card(x, E.top, E.bot, E.w, E.rise);
        p2.poly(pts, { closed: true, color: alpha(C.attn, i === E.n - 1 ? 1 : 0.8), fill: i % 2 ? cardFill : cardFill2, sw: i === E.n - 1 ? 2.2 : 1.5, rough: 0.7, seed: 300 + i });
        encLit.push(el('path', { d: 'M' + pts.map((q) => q.join(' ')).join('L') + 'Z', fill: mix('#ffffff', C.attn, 0.35), stroke: 'none', opacity: 0 }, g2));
      }
      const EX1 = E.x0 + (E.n - 1) * E.step + E.w;                // right edge of the deck
      text(g2, E.x0 + 4, 246, 'encoder', { fs: 34, anchor: 'start' });
      text(g2, E.x0 + 160, 244, '× 32', { fs: 48, font: 'sans', weight: 600, color: C.attn, anchor: 'start' });

      // ---------------------------------------------------------------- 3: the decoder, 4 blocks, each reading the encoder
      const g3 = grp(3), p3 = P(g3);
      const Dk = { x0: 1138, step: 22, w: 100, rise: 60, top: 436, bot: 820, n: 4 };
      const decFill = mix(C.out, C.sheet, 0.22), decLit = [];
      const decTops = [];
      for (let i = 0; i < Dk.n; i++) {
        const x = Dk.x0 + i * Dk.step, pts = card(x, Dk.top, Dk.bot, Dk.w, Dk.rise);
        decTops.push([x + Dk.w * 0.45, Dk.top - Dk.rise * 0.45]);
        p3.poly(pts, { closed: true, color: alpha(C.out, i === Dk.n - 1 ? 1 : 0.8), fill: decFill, sw: i === Dk.n - 1 ? 2.2 : 1.6, rough: 0.7, seed: 400 + i });
        decLit.push(el('path', { d: 'M' + pts.map((q) => q.join(' ')).join('L') + 'Z', fill: C.out, stroke: 'none', opacity: 0 }, g3));
      }
      // cross-attention: the encoder's output fans into every decoder block
      const src = [EX1 + 4, E.top - E.rise + 110];
      decTops.forEach(([x, y], i) => p3.curve([src, [(src[0] + x) / 2 + 4 * i, src[1] - 46 - 16 * i], [x, y - 4]], { color: alpha(C.attn, 0.85), sw: 2, seed: 410 + i }));
      decTops.forEach(([x, y], i) => p3.line(x - 7, y - 16, x, y - 4, { color: alpha(C.attn, 0.85), sw: 2, seed: 420 + i }));
      decTops.forEach(([x, y], i) => p3.line(x + 7, y - 16, x, y - 4, { color: alpha(C.attn, 0.85), sw: 2, seed: 430 + i }));
      const DX1 = Dk.x0 + (Dk.n - 1) * Dk.step + Dk.w;
      text(g3, Dk.x0 + 2, 878, 'decoder', { fs: 34, anchor: 'start' });
      text(g3, Dk.x0 + 140, 880, '× 4', { fs: 44, font: 'sans', weight: 600, color: C.out, anchor: 'start' });

      // ---------------------------------------------------------------- 4: the words it writes, one at a time (real output)
      const g4 = grp(4);
      const words = S.whisper.map((w) => w.w);
      const WX0 = 1352, WMAX = 1794, CH = 64, FS = 38, GAP = 12, RG = 18;
      const chips = [], laid = [];
      let x = WX0, row = 0;
      words.forEach((w, k) => {                                   // measure, then fill rows greedily
        const cg = el('g', {}, g4);
        const t = text(cg, 0, 0, w, { fs: FS, font: 'serif' });
        const cw = t.getComputedTextLength() + 32;
        if (x > WX0 && x + cw > WMAX) { x = WX0; row++; }
        laid.push({ cg, t, x, row, cw, k }); x += cw + GAP;
      });
      const nRows = row + 1, DCY = (Dk.top + Dk.bot) / 2 - Dk.rise / 2;
      const RY0 = DCY - (nRows * CH + (nRows - 1) * RG) / 2;
      for (const c of laid) {
        const y = RY0 + c.row * (CH + RG), pc = P(c.cg);
        c.t.setAttribute('y', y + CH / 2 + 1);
        c.t.setAttribute('x', c.x + c.cw / 2);
        c.t.querySelectorAll('tspan').forEach((s) => s.setAttribute('x', c.x + c.cw / 2));
        const col = c.k === 0 ? C.check : C.ink2;                 // the um, which Whisper is prompted to keep
        pc.rect(c.x, y, c.cw, CH, { r: 12, color: col, fill: alpha(col, c.k === 0 ? 0.22 : 0.12), sw: 2.2, rough: 0.9, seed: 500 + c.k });
        c.cg.appendChild(c.t);
        c.cg.style.transformBox = 'fill-box'; c.cg.style.transformOrigin = '50% 50%';
        chips.push(c.cg);
      }
      const RYB = RY0 + nRows * CH + (nRows - 1) * RG;            // bottom of the word block
      p3.arrow([[DX1 + 6, DCY], [WX0 - 14, DCY]], { color: C.ink2, sw: 2.6, hl: 15 });
      // each new word goes back in as the next input
      const g5 = grp(5), p5 = P(g5);
            p5.arrow([[WX0 + 70, RYB + 10], [WX0 + 30, RYB + 66], [DX1 + 40, RYB + 64], [DX1 + 6, RYB + 26]], { color: C.ink3, sw: 2.4, hl: 13, curve: true });

      // ---------------------------------------------------------------- 6: live, re-run while you talk
      const g6 = grp(6), p6 = P(g6);
      const lx = 248, ly = 896, lr = 24;
      p6.path(`M${lx + lr} ${ly} A${lr} ${lr} 0 1 1 ${lx} ${ly - lr}`, { color: C.made, sw: 2.6, rough: 0.5 });
      p6.line(lx, ly - lr, lx - 12, ly - lr - 10, { color: C.made, sw: 2.6 });
      p6.line(lx, ly - lr, lx - 12, ly - lr + 10, { color: C.made, sw: 2.6 });
      text(g6, lx + 44, ly + 1, 're-run every 0.7 s', { fs: 30, font: 'sans', color: C.ink, anchor: 'start' });

      // ---------------------------------------------------------------- arrival
      let timers = [], raf = 0;
      const later = (ms, f) => timers.push(setTimeout(f, ms));
      const fade = (nd, op, ms) => { nd.style.transition = `opacity ${ms}ms ease-out`; nd.style.opacity = op; };
      function finalState() {
        timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
        streamRect.setAttribute('width', AX1 - AX0 + 8);
        playhead.style.opacity = '0';
        [...encLit, ...decLit].forEach((p) => { p.style.transition = 'none'; p.style.opacity = ''; });
        chips.forEach((c) => { c.style.transition = 'none'; c.style.opacity = ''; c.style.transform = ''; });
      }
      function arrive() {
        finalState();
        streamRect.setAttribute('width', 0);
        chips.forEach((c) => { c.style.opacity = '0'; c.style.transform = 'scale(0.5)'; });
        // 1. the audio streams in: wave and mel reveal left to right under a playhead
        const t0 = performance.now(), SW = 1100;
        const tick = (now) => {
          const e = Math.max(0, Math.min(1, (now - t0) / SW)), x = AX0 + e * (AX1 - AX0);
          streamRect.setAttribute('width', (x - AX0 + 4).toFixed(1));
          playhead.setAttribute('x1', x); playhead.setAttribute('x2', x);
          playhead.style.opacity = e < 1 ? '1' : '0';
          if (e < 1) raf = requestAnimationFrame(tick); else streamRect.setAttribute('width', AX1 - AX0 + 8);
        };
        raf = requestAnimationFrame(tick);
        // 2. a pulse runs through the 32 encoder blocks, then the decoder
        const P0 = 1050, PS = 26;
        encLit.forEach((p, i) => {
          later(P0 + i * PS, () => fade(p, i === E.n - 1 ? '0.5' : '0.9', 80));
          later(P0 + i * PS + 120, () => fade(p, '', 300));
        });
        const D0 = P0 + E.n * PS + 60;
        decLit.forEach((p, i) => {
          later(D0 + i * 50, () => fade(p, '0.7', 90));
          later(D0 + i * 50 + 160, () => fade(p, '', 360));
        });
        // 3. the words pop out one at a time; the decoder flashes for each step
        const W0 = D0 + 300, WS = 205;
        chips.forEach((c, k) => later(W0 + k * WS, () => {
          c.style.transition = 'opacity 140ms ease-out, transform 260ms cubic-bezier(.3,1.7,.5,1)';
          c.style.opacity = ''; c.style.transform = 'scale(1)';
          const f = decLit[Dk.n - 1]; fade(f, '0.55', 60); later(120, () => fade(f, '', 200));
          if (k === 0) window.Sfx?.tick?.();
        }));
        return finalState;
      }
      return { items, arrive };
    },
  };
})();
