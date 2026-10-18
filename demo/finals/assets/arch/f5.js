/* Region 6, f5: F5-TTS. Story: noise turns into a clean spectrogram.
   Focal element: one big mel grid. Its cells are the real mel of Sarah's message (media/step1_mel.png, 0.74-4.02 s,
   averaged into 96 x 48 cells). On arrival every cell moves along its straight flow-matching path x_t = (1 - t) x0 + t x1
   from schematic Gaussian noise to that mel, over F5's 32 Euler steps at the real sway-sampled positions (s = -1);
   then the real waveform of the same window draws under it (the vocoder). */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  // F5-TTS defaults: nfe_step 32, sway_sampling_coef -1:  t = linspace(0, 1, 33);  t' = t + s (cos(pi t / 2) - 1 + t)
  const NFE = 32, SWAY = -1;
  const TS = Array.from({ length: NFE + 1 }, (_, k) => { const t = k / NFE; return t + SWAY * (Math.cos((Math.PI / 2) * t) - 1 + t); });

  // real mel, 96 columns x 48 rows (top row = highest band), 64 levels; from step1_mel.png by f5work/melgrid.py
  const COLS = 96, ROWS = 48;
  const MEL_B64 = 'AAAAAAACFHJKIEAAAAAAAAAADGDAFHDAACDDBCHGBECDKEADGGBAAAAAAAAAAAAAAABBCJUODDEDCBADIDAAGPVJECDBAAAAAAAAAAAABCDDCBBCCBAAAAAAEOEBHNEABEGHBABCDGCELEBEFEBAAAAAAAAAAAAAAAABDHVUEDFGDBADJEBAFOYKEBDBAAABAAAAAAABBABAAAAABAAAAAAABGCBDFCABEGFBABBBDCEIEBEFFBAAAAAAAAAAAAAAAACFHQLDDEECCACEDCBIQaMICDAAAABAAAAAAADEEEEEDCDDCAAAAABBCABDGCACHDCABEEDGDEKEACDDAAAAAAABBBAAAAAAAELNSKDDDDDDAEEBBBKZlUJBBAAABBAAAAAAAEFEDDDCAABBAAAAAAAAABEGDACGAAABFDBDBEJEAABCBAABAABBBAAAAAAAADIJKJEDBBBBADCAAAJanZPAAAAAABAAAAAAAGIGFFFCAAAAAAAAABAAADDFCACFBAACEBABBEIEADIMGAACAAABBAAAAAAAADEEDFDDBAAAACBBAAHWgZXEFDAAABAAAAAAADFFEEDBAAAAAAAABDBCBDDCBADKDCCFDAADDEIECGOODAABAAABBBAAAAAACECEECBCBAABACBCCCKOSWgKHFCAABAAAAAAACEEFFECBCEDAAAACDEQIBEEBAHWKJGKFFEKHEJDBEHIBAAAAAABBAAAAAACFMMKUSFCIIBBAIEABCKORSaGECBACDAAAAAABKOOPMJGGHHFBAAABBOhMBFKDAHVQMGMMQPaSFHDBJVXEAABAABCBBAAAAADEMOMPTIFPFAAAFIDCBISMINHFCBABCAAAAAABRcceeeWIHHGCAAAABIUFBDHGAGSIHFNaULWTGLDFXdWIAADBABCDCBAAAACJXKEDGEHMDAAADQRQIMMHGKGFCAAACAAAAAAAIQTVXaWIHGEBAAAABEGBCCEFAITDDEKSGBFHNUFMVKICAABAABBCBAAAAABMbHEEFEFGCAAADOOMUWIFHKFDBAAADAAAAAAAKWddfcREBAAAAAAABDDABCDCAGMEDEKMFAEGUXGGHGGBAABAABCCBAAAAAAFQFFILEEEBABAEFEEMYHHGGGFDBAADAAAAAABXgkmnhQCAAAAAAAADDEBCEGCAFIHIGNRJDFGMUGEF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';
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const MEL = Float32Array.from(MEL_B64, (ch) => B64.indexOf(ch) / 63);

  function rng(seed) {                                    // mulberry32, so every redraw is identical
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const NOISE = (() => { const r = rng(606); return Float32Array.from({ length: COLS * ROWS }, () => Math.min(1, Math.max(0, 0.42 + 0.25 * gauss(r)))); })();

  // colour ramp for cell values 0..1: dark indigo, through the model blue, to near white
  const STOPS = [[0, [30, 29, 52]], [0.3, [58, 64, 150]], [0.62, [112, 136, 255]], [1, [236, 239, 255]]];
  const LUT = Array.from({ length: 256 }, (_, i) => {
    const v = i / 255; let k = 1; while (k < STOPS.length - 1 && v > STOPS[k][0]) k++;
    const [a0, c0] = STOPS[k - 1], [a1, c1] = STOPS[k], u = (v - a0) / (a1 - a0);
    return c0.map((c, j) => Math.round(c + (c1[j] - c) * u));
  });

  /** One frame of the flow: every cell at x_t = (1 - t) noise + t mel, as a data URL (cols x rows pixels). */
  const canvas = document.createElement('canvas');
  function frameURL(t, x0 = 0, y0 = 0, w = COLS, h = ROWS) {
    canvas.width = w; canvas.height = h;
    const c2 = canvas.getContext('2d'), img = c2.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y0 + y) * COLS + x0 + x, v = (1 - t) * NOISE[i] + t * MEL[i], col = LUT[Math.round(v * 255)], o = 4 * (y * w + x);
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }
  /** Thin gutters between cells, in the sheet colour, so the image reads as a grid of cells. */
  function gutters(parent, x, y, w, h, nx, ny) {
    let d = '';
    for (let i = 1; i < nx; i++) { const gx = (x + (i * w) / nx).toFixed(1); d += `M${gx} ${y}V${y + h}`; }
    for (let j = 1; j < ny; j++) { const gy = (y + (j * h) / ny).toFixed(1); d += `M${x} ${gy}H${x + w}`; }
    return el('path', { d, stroke: C.sheet, 'stroke-width': 1.6, fill: 'none' }, parent);
  }
  const pixImage = (parent, href, x, y, w, h) => el('image', { href, x, y, width: w, height: h, preserveAspectRatio: 'none', style: 'image-rendering:pixelated' }, parent);

  ARCH.regions['f5'] = {
    draw(g, ctx) {
      const items = [], D = ctx.D || window.DATA;
      // the big grid: 96 x 48 square cells
      const GX = 600, GY = 262, GW = 1100, CELL = GW / COLS, GH = CELL * ROWS;      // 550 tall

      // ---------------------------------------------------------------- inputs: text and your voice (seq 0)
      const a = el('g', {}, g), pa = P(a);
      const chars = ['D', 'a', 'n', ' ', 'h', 'a', 's'], tz = 34, tg = 6, TX = 296;
      chars.forEach((ch, i) => {
        const x = TX + i * (tz + tg);
        pa.rect(x, 236, tz, tz, { color: C.conv, fill: alpha(C.conv, 0.18), sw: 1.8, r: 6, rough: 0.8 });
        if (ch !== ' ') text(a, x + tz / 2, 236 + tz / 2, ch, { fs: 24 });
        else el('path', { d: `M${x + 9} 251V259H${x + tz - 9}V251`, fill: 'none', stroke: C.ink2, 'stroke-width': 2 }, a);
      });
      const VX = TX, VY = 304, VW = 7 * (tz + tg) - tg, VH = 54;                     // your voice: the real mel, the span to re-say masked
      el('image', { href: 'media/step1_mel.png', x: VX, y: VY, width: VW, height: VH, preserveAspectRatio: 'none' }, a);
      el('rect', { x: VX + 96, y: VY, width: 66, height: VH, fill: C.sheet }, a);
      pa.rect(VX + 96, VY, 66, VH, { color: C.check, sw: 2, r: 3, dash: [6, 5], rough: 0.6 });
      pa.rect(VX, VY, VW, VH, { color: C.ink3, sw: 1.6, r: 4, rough: 0.5 });
      text(a, VX - 18, VY + VH / 2, 'your voice', { fs: 26, anchor: 'end', color: C.ink2 });
      pa.arrow([[TX + VW / 2, VY + VH + 6], [TX + VW / 2, 396]], { color: C.ink2, sw: 2.4, hl: 12 });
      items.push({ g: a, seq: 0 });

      // ---------------------------------------------------------------- noise x0 -> DiT x 22 (seq 1)
      const b = el('g', {}, g), pb = P(b);
      const NC = 15, NR = 18, NX = 120, NY = 432;                                    // a 15 x 18 crop of the same starting noise
      pixImage(b, frameURL(0, 6, 14, NC, NR), NX, NY, NC * CELL, NR * CELL);
      gutters(b, NX, NY, NC * CELL, NR * CELL, NC, NR);
      pb.rect(NX, NY, NC * CELL, NR * CELL, { color: C.ink3, sw: 1.8, r: 4, rough: 0.6 });
      text(b, NX + (NC * CELL) / 2, NY + NR * CELL + 32, 'noise', { fs: 28, color: C.ink2 });
      const SX = 348, SY = 414, SW = 150, SH = 230;
      pb.arrow([[NX + NC * CELL + 8, SY + SH / 2], [SX - 8, SY + SH / 2]], { color: C.ink2, sw: 2.6, hl: 13 });
      pb.stack(SX, SY, SW, SH, null, C.attn, null);
      text(b, SX + SW / 2, SY + 40, 'DiT', { fs: 34 });
      // inside: attention, then feed-forward, each with a residual (structure only)
      const IX = SX + 22, IW = SW - 44;
      pb.block(IX, SY + 150, IW, 44, null, C.attn, { fa: 0.35, r: 7 });
      pb.block(IX, SY + 82, IW, 44, null, C.ffn, { fa: 0.35, r: 7 });
      pb.line(SX + SW / 2, SY + 214, SX + SW / 2, SY + 194, { color: C.ink2, sw: 1.8 });
      pb.line(SX + SW / 2, SY + 150, SX + SW / 2, SY + 126, { color: C.ink2, sw: 1.8 });
      pb.line(SX + SW / 2, SY + 82, SX + SW / 2, SY + 66, { color: C.ink2, sw: 1.8 });
      text(b, SX + SW / 2 + 9, SY + SH + 34, '× 22', { fs: 36, color: C.attn, font: 'sans', weight: 600 });
      const pulse = el('rect', { x: SX - 7, y: SY - 7, width: SW + 14, height: SH + 14, rx: 13, fill: 'none', stroke: C.model, 'stroke-width': 5, opacity: 0 }, b);
      items.push({ g: b, seq: 1 });

      // ---------------------------------------------------------------- the flow loop and its 32 real step positions (seq 2)
      const c = el('g', {}, g), pc = P(c);
      const LX0 = SX + SW + 26, LX1 = GX - 12, LY = GY + GH / 2;
      pc.arrow([[LX0, LY], [LX1, LY]], { color: C.model, sw: 3.4, hl: 16 });
      text(c, (LX0 + LX1) / 2, LY - 30, 'flow', { fs: 28, color: C.model });
      const RX0 = 128, RX1 = 560, RY = 790, rx = (t) => RX0 + (RX1 - RX0) * t;
      el('line', { x1: RX0, y1: RY, x2: RX1, y2: RY, stroke: C.ink3, 'stroke-width': 2 }, c);
      const ticks = TS.map((t) => el('line', { x1: rx(t), y1: RY - 13, x2: rx(t), y2: RY + 13, stroke: C.model, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, c));
      const marker = el('circle', { cx: rx(1), cy: RY, r: 9, fill: C.ink, stroke: C.sheet, 'stroke-width': 3 }, c);
      text(c, (RX0 + RX1) / 2, RY + 44, '× 32 steps', { fs: 28, color: C.ink2 });
      items.push({ g: c, seq: 2 });

      // ---------------------------------------------------------------- the big mel grid, final state (seq 3)
      const f = el('g', {}, g), pf = P(f);
      const finalURL = frameURL(1);
      const big = pixImage(f, finalURL, GX, GY, GW, GH);
      gutters(f, GX, GY, GW, GH, COLS, ROWS);
      pf.rect(GX - 4, GY - 4, GW + 8, GH + 8, { color: C.ink2, sw: 2.2, r: 6, rough: 0.6 });
      items.push({ g: f, seq: 3 });

      // ---------------------------------------------------------------- vocoder: the real waveform of the same window (seq 4)
      const v = el('g', {}, g), pv = P(v);
      const WY = GY + GH + 92, WH = 84;                                              // centre line and full height
      pv.arrow([[GX + 70, GY + GH + 10], [GX + 70, WY - WH / 2 - 4]], { color: C.out, sw: 2.6, hl: 12 });
      text(v, GX + 92, GY + GH + 34, 'Vocos', { fs: 26, anchor: 'start', color: C.out });
      const wave = el('g', {}, v), clip = el('clipPath', { id: 'f5-wave-clip' }, v);
      const clipR = el('rect', { x: GX, y: WY - WH, width: GW, height: 2 * WH }, clip);
      wave.setAttribute('clip-path', 'url(#f5-wave-clip)');
      {
        const clipD = D && D.clips && D.clips['clean.before'], t0 = D?.figs?.step1?.t0 ?? 0.74, t1 = D?.figs?.step1?.t1 ?? 4.02;
        if (clipD) {
          const n = clipD.peaks.length, i0 = Math.floor((t0 / clipD.dur) * n), i1 = Math.ceil((t1 / clipD.dur) * n);
          const pk = clipD.peaks.slice(i0, i1), mx = Math.max(...pk), m = pk.length;
          let d = '';
          pk.forEach((p, i) => {
            const x = (GX + ((i + 0.5) / m) * GW).toFixed(1), hh = (p / mx) * (WH / 2);
            if (hh > 4) d += `M${x} ${(WY - hh).toFixed(1)}V${(WY + hh).toFixed(1)}`;
          });
          el('line', { x1: GX, y1: WY, x2: GX + GW, y2: WY, stroke: C.out, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, wave);
          el('path', { d, stroke: C.out, 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }, wave);
        }
      }
      text(v, GX + GW + 22, WY, 'speech', { fs: 28, anchor: 'start', color: C.out });
      items.push({ g: v, seq: 4 });

      // ---------------------------------------------------------------- one result (seq 5)
      const h = el('g', {}, g);
      text(h, 128, 924, '1.0 s', { fs: 60, anchor: 'start', color: C.made, font: 'sans', weight: 600 });
      text(h, 262, 936, 'per edit', { fs: 28, anchor: 'start', color: C.ink2 });
      items.push({ g: h, seq: 5 });

      // ---------------------------------------------------------------- arrival: 32 Euler steps, noise to mel, then the waveform
      let frames = null, live = null;                          // the 33 frames (built on first arrival); the running animation's stop
      function setStep(k, lit = true) {
        big.setAttribute('href', frames ? frames[k] : finalURL);
        marker.setAttribute('cx', rx(TS[k]).toFixed(1));
        ticks.forEach((ln, i) => ln.setAttribute('stroke', i <= k && lit ? C.model : C.ink3));
      }
      function rest() {
        big.setAttribute('href', finalURL);
        marker.setAttribute('cx', rx(1));
        ticks.forEach((ln) => ln.setAttribute('stroke', C.model));
        pulse.setAttribute('opacity', 0);
        clipR.setAttribute('width', GW);
      }
      return {
        items,
        arrive() {
          live?.();                                            // a second call restarts cleanly
          if (!frames) frames = TS.map((t, k) => (k === NFE ? finalURL : frameURL(t)));
          const timers = [], LEAD = 260, STEP = 88, WAVE = 520;
          setStep(0); clipR.setAttribute('width', 0);
          for (let k = 1; k <= NFE; k++) {
            timers.push(setTimeout(() => { setStep(k); pulse.setAttribute('opacity', 0.9); }, LEAD + k * STEP));
            timers.push(setTimeout(() => pulse.setAttribute('opacity', 0), LEAD + k * STEP + 40));
          }
          const tw = LEAD + NFE * STEP + 60;
          let raf = 0, start = 0;
          timers.push(setTimeout(() => {
            const grow = (now) => {
              if (!start) start = now;
              const e = Math.min(1, (now - start) / WAVE);
              clipR.setAttribute('width', (GW * e).toFixed(1));
              if (e < 1) raf = requestAnimationFrame(grow); else window.Sfx?.tick?.();
            };
            raf = requestAnimationFrame(grow);
          }, tw));
          live = () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); rest(); live = null; };
          return live;
        },
      };
    },
  };
})();
