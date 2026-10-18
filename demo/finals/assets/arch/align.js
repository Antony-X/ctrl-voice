/* Region 2, "align": wav2vec2 CTC forced alignment. One story: word boxes slide from Whisper's guess and snap onto the
   real sound (the CTC spikes).
   Left: the model as structure only (real waveform -> 7-block CNN funnel -> transformer x 24 -> spikes).
   Focal: the real mel of 0.74-4.02 s of Sarah's message, the real per-frame p(non-blank) spike strip (figs.step1.spikes),
   the CTC word boxes snapped under their spikes (figs.step1.ctc), and Whisper's boxes as dashed ghosts (figs.step1.whisper).
   Arrival: spikes rise left to right, then each box leaves its Whisper spot and snaps onto its spikes. */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOutBack = (k, s = 1.9) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);

  ARCH.regions['align'] = {
    draw(g, ctx) {
      const D = ctx.D, S = D.figs.step1;
      const items = [];
      const grp = (seq) => { const a = el('g', {}, g); items.push({ g: a, seq }); return a; };

      // ------------------------------------------------------------ geometry (time runs left to right)
      const X0 = 548, X1 = 1806, T0 = S.t0, T1 = S.t1;
      const X = (t) => X0 + (t - T0) / (T1 - T0) * (X1 - X0);
      const yM = 222, hM = 250;                  // mel
      const yS = 486, hS = 204, base = yS + hS;  // spike strip, baseline 690
      const yR = 702, hB = 52;                   // real (CTC) boxes, right under the spikes
      const yG = 862;                            // Whisper's guesses (dashed ghosts)
      const colCX = 286;

      // ============================================================ 0. model: real waveform -> CNN funnel
      {
        const a = grp(0), pa = P(a);
        const cl = D.clips['clean.before'], n = cl.peaks.length, dt = cl.dur / n;
        const sel = cl.peaks.map((v, i) => [(i + 0.5) * dt, v]).filter(([t]) => t >= T0 && t <= T1);
        const wx0 = 120, wx1 = 452, wy = 282, wh = 40;
        let d = '';
        sel.forEach(([, v], i) => { const x = wx0 + i / (sel.length - 1) * (wx1 - wx0), h = Math.max(1.5, v * wh); d += `M${x.toFixed(1)} ${(wy - h).toFixed(1)}V${(wy + h).toFixed(1)}`; });
        el('path', { d, stroke: C.ink2, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, a);
        pa.arrow([[colCX, 334], [colCX, 368]], { color: C.ink2, sw: 2.4 });
        const bw0 = 330, bw1 = 132, bh = 28, by0 = 380, gap = 7;
        for (let i = 0; i < 7; i++) {
          const w = bw0 + (bw1 - bw0) * i / 6, y = by0 + i * (bh + gap);
          pa.rect(colCX - w / 2, y, w, bh, { color: C.conv, fill: alpha(C.conv, 0.22), sw: 2, r: 7, rough: 0.8 });
        }
        text(a, colCX - bw1 / 2 - 26, by0 + 6 * (bh + gap) + bh / 2, 'CNN', { fs: 30, anchor: 'end', color: C.conv });
      }

      // ============================================================ 1. model: transformer x 24 -> into the spikes
      {
        const a = grp(1), pa = P(a);
        const yEnd = 380 + 7 * 35 - 7;             // 618
        pa.arrow([[colCX, yEnd + 8], [colCX, yEnd + 36]], { color: C.ink2, sw: 2.4 });
        const sy = yEnd + 48, sh = 74;               // stack centre ~ 685
        pa.stack(colCX - 146, sy, 236, sh, 'Transformer', C.attn, 24, { fs: 28, nfs: 32 });
        // out of the model, straight into the spike strip
        pa.arrow([[492, sy + sh / 2 - 9], [X0 - 8, sy + sh / 2 - 9]], { color: C.out, sw: 3, hl: 15 });
      }

      // ============================================================ 2. the real sound (mel of the same window)
      {
        const a = grp(2), pa = P(a);
        el('image', { href: 'media/step1_mel.png', x: X0, y: yM, width: X1 - X0, height: hM, preserveAspectRatio: 'none' }, a);
        pa.rect(X0 - 5, yM - 5, X1 - X0 + 10, hM + 10, { color: C.ink3, sw: 1.8, r: 8, rough: 0.6 });
      }

      // ============================================================ 3. CTC spikes: real p(non-blank) per 20 ms frame
      const spikes = [];
      let scanEl = null;
      {
        const a = grp(3);
        // a soft band behind each word's spikes
        for (const w of S.ctc) el('rect', { x: X(w.s) + 1.5, y: yS, width: X(w.e) - X(w.s) - 3, height: hS, rx: 6, fill: alpha(C.out, 0.11) }, a);
        el('line', { x1: X0, y1: base, x2: X1, y2: base, stroke: C.ink3, 'stroke-width': 1.6 }, a);
        for (const [t, p] of S.spikes) {
          if (t < T0 - 1e-6 || t + S.fs > T1 + 0.03 || p < 0.01) continue;
          const x = X(t), w = Math.max(2, X(t + S.fs) - x - 2.2), h = p * (hS - 8);
          const r = el('rect', { x: x.toFixed(1), y: (base - h).toFixed(1), width: w.toFixed(1), height: h.toFixed(1), fill: C.out, rx: 1.5 }, a);
          spikes.push({ r, h, x: x + w / 2 });
        }
        text(a, (X(2.522) + X(2.882)) / 2 + 4, yS + hS / 2 - 10, 'CTC\nspikes', { fs: 30, color: C.out, lh: 34 });
        scanEl = el('line', { x1: X0, y1: yS - 4, x2: X0, y2: base + 6, stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round', opacity: 0 }, a);
      }

      // ============================================================ 4. Whisper's guesses: dashed ghosts, a little early
      {
        const a = grp(4);
        for (const w of S.whisper) {
          el('rect', { x: X(w.s) + 2, y: yG, width: X(w.e) - X(w.s) - 4, height: hB, rx: 7, fill: alpha(C.ink2, 0.07), stroke: alpha(C.ink2, 0.8), 'stroke-width': 2.4, 'stroke-dasharray': '9 7' }, a);
        }
        text(a, X0 - 22, yG + hB / 2, 'Whisper’s guess', { fs: 28, anchor: 'end', color: C.ink2 });
      }

      // ============================================================ 5. the real boxes, snapped under their spikes
      const boxes = [];
      {
        const a = grp(5);
        S.ctc.forEach((w, i) => {
          const xf = X(w.s) + 1.5, wf = X(w.e) - X(w.s) - 3;
          const ww = S.whisper[i], xs = X(ww.s) + 2, ws = X(ww.e) - X(ww.s) - 4;
          const bg = el('g', {}, a), rg = el('g', {}, bg), tg = el('g', {}, bg);
          P(rg).rect(xf, yR, wf, hB, { color: C.out, fill: alpha(C.out, 0.2), sw: 2.4, r: 7, rough: 0.7 });
          rg.querySelectorAll('path').forEach((p) => p.setAttribute('vector-effect', 'non-scaling-stroke'));
          text(tg, xf + wf / 2, yR + hB / 2, w.w, { fs: wf < 40 ? 22 : 25, font: 'serif' });
          boxes.push({ rg, tg, xf, wf, xs, ws, x0: X(w.s), x1: X(w.e) });
        });
        text(a, X0 + 6, yR + hB / 2, 'real', { fs: 30, anchor: 'start', color: C.out });
      }

      // ============================================================ 6. the shift: ghost -> real, and the biggest one called out
      let shiftG = null;
      {
        const a = grp(6), pa = P(a);
        shiftG = a;
        S.whisper.forEach((ww, i) => {
          const cw = S.ctc[i], xa = (X(ww.s) + X(ww.e)) / 2, xb = (X(cw.s) + X(cw.e)) / 2;
          if (i === 0) return;
          pa.arrow([[xa, yG - 8], [xb, yR + hB + 10]], { color: C.ink3, sw: 2, hl: 11, rough: 0.5 });
        });
        const wu = S.whisper[0], cu = S.ctc[0];
        pa.arrow([[(X(wu.s) + X(wu.e)) / 2, yG - 8], [(X(cu.s) + X(cu.e)) / 2, yR + hB + 10]], { color: C.check, sw: 3, hl: 14, rough: 0.5 });
        // the offset of "Um," as a dimension under the ghost row
        const ya = yG + hB + 26;
        el('line', { x1: X(wu.s), y1: yG + hB + 6, x2: X(wu.s), y2: ya + 10, stroke: C.check, 'stroke-width': 2 }, a);
        el('line', { x1: X(cu.s), y1: yR + hB, x2: X(cu.s), y2: ya + 10, stroke: C.check, 'stroke-width': 2, 'stroke-dasharray': '4 5' }, a);
        pa.arrow([[X(wu.s) + 2, ya], [X(cu.s) - 2, ya]], { color: C.check, sw: 2.4, both: true, hl: 10, rough: 0.4 });
        text(a, X(cu.s) + 16, ya + 6, `${(cu.s - wu.s).toFixed(2)} s`, { fs: 44, anchor: 'start', font: 'sans', weight: 600, color: C.check });
        text(a, X(cu.s) + 150, ya + 8, 'too early', { fs: 30, anchor: 'start', color: C.check });
      }

      // ============================================================ arrival: spikes rise, then every box leaves Whisper's spot and snaps onto its spikes
      const place = (b, k, ky) => {
        const x = b.xs + (b.xf - b.xs) * k, w = b.ws + (b.wf - b.ws) * clamp01(k), y = yG + (yR - yG) * ky;
        b.rg.setAttribute('transform', `translate(${x} ${y}) scale(${(w / b.wf).toFixed(4)} 1) translate(${-b.xf} ${-yR})`);
        b.tg.setAttribute('transform', `translate(${x + w / 2 - (b.xf + b.wf / 2)} ${y - yR})`);
      };
      function setStatic() {
        for (const s of spikes) { s.r.setAttribute('y', (base - s.h).toFixed(1)); s.r.setAttribute('height', s.h.toFixed(1)); s.r.setAttribute('fill', C.out); }
        for (const b of boxes) { b.rg.removeAttribute('transform'); b.tg.removeAttribute('transform'); }
        scanEl.setAttribute('opacity', 0);
        shiftG.style.transition = 'none'; shiftG.style.opacity = '';
      }
      let current = null;
      return {
        items,
        arrive() {
          current?.();
          const RISE = 1.0, EACH = 0.28, B0 = 0.75, STEP = 0.21, MOVE = 0.62, FLASH = 0.32;
          const xa = spikes[0].x, xb = spikes[spikes.length - 1].x;
          const t0 = performance.now(), END = B0 + STEP * (boxes.length - 1) + MOVE + FLASH + 0.1;
          let raf = 0, ticked = 0;
          shiftG.style.transition = 'none'; shiftG.style.opacity = '0';
          const frame = (now) => {
            const e = (now - t0) / 1000;
            const fr = e / RISE;
            scanEl.setAttribute('x1', xa + (xb - xa) * Math.min(1, fr)); scanEl.setAttribute('x2', xa + (xb - xa) * Math.min(1, fr));
            scanEl.setAttribute('opacity', fr < 1.05 ? 0.85 : 0);
            for (const s of spikes) {
              const k = clamp01((e - (s.x - xa) / (xb - xa) * RISE) / EACH), h = s.h * easeOut(k);
              s.r.setAttribute('y', (base - h).toFixed(1)); s.r.setAttribute('height', h.toFixed(1));
            }
            boxes.forEach((b, i) => {
              const k = clamp01((e - B0 - i * STEP) / MOVE);
              place(b, k > 0 ? easeOutBack(k) : 0, k > 0 ? easeOutBack(k, 1.4) : 0);
              const land = e - B0 - i * STEP - MOVE * 0.55;                    // flash this word's spikes as it lands
              const lit = land > 0 && land < FLASH;
              for (const s of spikes) if (s.x >= b.x0 && s.x <= b.x1) s.r.setAttribute('fill', lit ? C.ink : C.out);
              if (land > 0 && ticked <= i) { ticked = i + 1; if (i === 0 || i === boxes.length - 1) window.Sfx?.tick?.(); }
            });
            if (e > END - 0.5 && shiftG.style.opacity === '0') { shiftG.style.transition = 'opacity 450ms ease'; shiftG.style.opacity = ''; }
            if (e < END) raf = requestAnimationFrame(frame);
            else setStatic();
          };
          frame(t0);
          raf = requestAnimationFrame(frame);
          current = () => { cancelAnimationFrame(raf); setStatic(); current = null; };
          return current;
        },
      };
    },
  };
})();
