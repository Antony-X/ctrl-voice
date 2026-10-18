/* Region 9, "tone": the pitch line bends from rising to falling; the grains slide.
   Top (focal): Eric's real pitch contour (DATA.tone_f0) over his words. The Confident version (green) is drawn on the
   same words: the after contour is time-aligned word by word to the before one (in reality it is 9.7% shorter).
   The old contour stays as a faint ghost, its rising ending in amber.
   Bottom left: real TD-PSOLA grains from his "ready" (DATA.figs.psola), re-placed further apart = lower pitch.
   Bottom right: the optional AI accent path, Seed-VC (13 DiT blocks with U-ViT skips). */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  const ease = (e) => (e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, e) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * e)).join(',')})`; };
  const runsPath = (runs) => runs.map((r) => r.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')).join('');

  let running = null;                                                // stop function of the arrival in progress

  ARCH.regions['tone'] = {
    draw(g, ctx) {
      const D = ctx.D, items = [];
      const group = (seq) => { const a = el('g', {}, g); items.push({ g: a, seq }); return a; };

      // ============================================================ the pitch line (focal)
      const B = D.tone_f0.before, A = D.tone_f0.after;
      const T0 = 0.05, T1 = 4.95, PX0 = 140, PX1 = 1540;
      const tx = (t) => PX0 + (t - T0) / (T1 - T0) * (PX1 - PX0);
      const YT = 250, YB = 560, FMIN = 80, FMAX = 225;
      const fy = (hz) => YB - Math.log(hz / FMIN) / Math.log(FMAX / FMIN) * (YB - YT);
      const endW = B.words[B.words.length - 1];                      // "tomorrow?"
      const tailFrom = endW.s - 0.03;

      // after-time -> before-time, piecewise linear through the word boundaries (same 14 words)
      const knotsA = [0], knotsB = [0];
      A.words.forEach((w, i) => { knotsA.push(w.s, w.e); knotsB.push(B.words[i].s, B.words[i].e); });
      knotsA.push(A.dur); knotsB.push(B.dur);
      const warp = (t) => {
        let i = 1; while (i < knotsA.length - 1 && t > knotsA[i]) i++;
        const a0 = knotsA[i - 1], a1 = knotsA[i], b0 = knotsB[i - 1], b1 = knotsB[i];
        return a1 > a0 ? b0 + (t - a0) / (a1 - a0) * (b1 - b0) : b0;
      };
      /** Voiced frames as [{t, hz}] runs, dropping runs shorter than 3 frames (isolated Praat blips). */
      const runsOf = (ts, hz) => {
        const out = []; let cur = null;
        hz.forEach((h, i) => { if (h > 0) { if (!cur) out.push(cur = []); cur.push({ t: ts[i], hz: h }); } else cur = null; });
        return out.filter((r) => r.length >= 3);
      };
      const runsB = runsOf(B.t, B.hz);
      const runsA = runsOf(A.t.map(warp), A.hz);
      const split = (runs, tail) => runs.map((r) => r.filter((p) => (tail ? p.t >= tailFrom : p.t < tailFrom + 0.01))).filter((r) => r.length > 1);
      const toXY = (runs) => runs.map((r) => r.map((p) => [tx(p.t), fy(p.hz)]));

      // the morph pairs: every before frame with an after value at the same (word-aligned) moment
      const afterAt = (t) => {
        for (const r of runsA) {
          if (t < r[0].t - 0.012 || t > r[r.length - 1].t + 0.012) continue;
          let k = 0; while (k < r.length - 2 && r[k + 1].t < t) k++;
          const p = r[k], q = r[k + 1], u = clamp01((t - p.t) / Math.max(1e-6, q.t - p.t));
          return Math.exp(Math.log(p.hz) + u * (Math.log(q.hz) - Math.log(p.hz)));
        }
        return 0;
      };
      const pairs = runsB.map((r) => r.map((p) => ({ t: p.t, hb: p.hz, ha: afterAt(p.t) })));
      const morphRuns = [];
      for (const r of pairs) { let cur = null; for (const p of r) { if (p.ha > 0) { if (!cur) morphRuns.push(cur = []); cur.push(p); } else cur = null; } }
      const morphBody = morphRuns.map((r) => r.filter((p) => p.t < tailFrom + 0.01)).filter((r) => r.length > 1);
      const morphTail = morphRuns.map((r) => r.filter((p) => p.t >= tailFrom)).filter((r) => r.length > 1);

      // static: ghost of the old line (thin, dotted), its rising ending amber
      const gLine = group(0);
      el('line', { x1: PX0 - 10, x2: PX1 + 20, y1: YB + 22, y2: YB + 22, stroke: alpha(C.ink3, 0.6), 'stroke-width': 1.5 }, gLine);
      P(gLine).arrow([[112, YB + 8], [112, YT + 4]], { color: C.ink3, sw: 2, hl: 12, rough: 0.4 });
      text(gLine, 128, YT - 6, 'pitch', { fs: 26, anchor: 'start', color: C.ink3 });
      const ghostBody = el('path', { d: runsPath(toXY(split(runsB, false))), fill: 'none', stroke: C.ink2, 'stroke-width': 3.2, 'stroke-dasharray': '1 8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.8 }, gLine);
      const ghostTail = el('path', { d: runsPath(toXY(split(runsB, true))), fill: 'none', stroke: C.check, 'stroke-width': 5.5, 'stroke-dasharray': '5 10', 'stroke-linecap': 'round' }, gLine);

      // static: the Confident line
      const gNew = group(1);
      const newBody = el('path', { d: runsPath(toXY(split(runsA, false))), fill: 'none', stroke: C.made, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gNew);
      const newTail = el('path', { d: runsPath(toXY(split(runsA, true))), fill: 'none', stroke: C.made, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gNew);

      // the words, at their real times (nudged apart where they would touch)
      const gWords = group(2);
      const WY = YB + 56, FS = 27;
      const wd = B.words.map((w) => ({ w, x: tx((w.s + w.e) / 2), half: (w.w.length * FS * 0.43 + 4) / 2 }));
      for (let it = 0; it < 60; it++) for (let i = 1; i < wd.length; i++) {
        const gap = wd[i].x - wd[i].half - (wd[i - 1].x + wd[i - 1].half) - 12;
        if (gap < 0) { wd[i].x -= gap / 2; wd[i - 1].x += gap / 2; }
      }
      let lastWord = null, readyX = 0;
      wd.forEach((d) => {
        const last = d.w === endW, ready = /^ready/i.test(d.w.w);
        const t = text(gWords, d.x, WY, last ? 'tomorrow.' : d.w.w, { fs: FS, font: 'serif', color: last ? C.made : ready ? C.model : C.ink2 });
        if (last) lastWord = t;
        if (ready) readyX = d.x;
      });

      // the callout: rise (old ending) bends into fall (new ending)
      const gCall = group(3), pc = P(gCall);
      const riseEnd = toXY(split(runsB, true)).flat().pop(), fallEnd = toXY(split(runsA, true)).flat().pop();
      text(gCall, 1592, riseEnd[1] - 6, 'rise', { fs: 62, anchor: 'start', color: C.check });
      const bend = pc.arrow([[1668, riseEnd[1] + 40], [1736, riseEnd[1] + 116], [1716, fallEnd[1] - 80], [1660, fallEnd[1] - 40]],
        { color: C.made, sw: 5, hl: 24, curve: true, rough: 0.6 });
      const fallT = text(gCall, 1592, fallEnd[1] + 10, 'fall', { fs: 62, anchor: 'start', color: C.made });

      // ============================================================ PSOLA grains (real samples from "ready")
      const S = D.figs.psola;
      const GX0 = 160, PXMS = 27;                                     // px per millisecond
      const gx = (t) => GX0 + (t - 0.0015) * 1000 * PXMS;
      const LA = 846, LB = 926, AMP = 118, MY = 766;
      const gGr = group(4), pg = P(gGr);
      pg.rect(118, 690, 1052, 300, { color: alpha(C.model, 0.75), sw: 2, r: 16, rough: 0.6 });
      pg.line(readyX, WY + 22, readyX, 690, { color: alpha(C.model, 0.8), sw: 2, dash: [8, 8], rough: 0.4 });
      text(gGr, 146, 722, 'pitch periods', { fs: 28, anchor: 'start', color: C.ink });
      // where the marks were (ghost ticks) and where they are now (amber dots)
      for (const t of S.marks.slice(1, 5)) el('line', { x1: gx(t), x2: gx(t), y1: MY - 16, y2: LB + 30, stroke: C.ink3, 'stroke-width': 1.6, 'stroke-dasharray': '4 7' }, gGr);
      const hannD = (t0, yc, h) => Array.from({ length: 41 }, (_, i) => { const u = i / 40; return `${i ? 'L' : 'M'}${gx(t0 + u * 2 * S.P).toFixed(1)} ${(yc - h * 0.5 * (1 - Math.cos(2 * Math.PI * u))).toFixed(1)}`; }).join('');
      const grains = S.outmarks.map((om, j) => {
        const gr = S.grains[om.src], col = j % 2 ? C.ffn : C.attn, yc = j % 2 ? LB : LA, dt = om.t - gr.mark;
        const sub = el('g', {}, gGr);
        el('path', { d: hannD(gr.s + dt, yc, 52), fill: alpha(col, 0.1), stroke: col, 'stroke-width': 1.8, 'stroke-dasharray': '6 6', opacity: 0.8 }, sub);
        el('path', { d: gr.y.map((v, i) => `${i ? 'L' : 'M'}${gx(gr.s + dt + i / S.sr).toFixed(1)} ${(yc - v * AMP).toFixed(1)}`).join(''), fill: 'none', stroke: col, 'stroke-width': 3.2, 'stroke-linejoin': 'round' }, sub);
        el('line', { x1: gx(om.t), x2: gx(om.t), y1: MY, y2: yc - 46, stroke: alpha(C.check, 0.7), 'stroke-width': 1.6 }, sub);
        el('circle', { cx: gx(om.t), cy: MY, r: 8, fill: C.check }, sub);
        return { sub, dx: -dt * 1000 * PXMS };
      });
      // the gaps between marks, now wider (plain lines, so the arrival can stretch them)
      const gaps = el('g', {}, gGr);
      const gapEls = S.outmarks.slice(1).map(() => {
        const ln = el('line', { y1: MY, y2: MY, stroke: C.check, 'stroke-width': 3, 'stroke-linecap': 'round' }, gaps);
        const c1 = el('line', { stroke: C.check, 'stroke-width': 3, 'stroke-linecap': 'round' }, gaps);
        const c2 = el('line', { stroke: C.check, 'stroke-width': 3, 'stroke-linecap': 'round' }, gaps);
        return [ln, c1, c2];
      });
      const setGaps = (e) => gapEls.forEach(([ln, c1, c2], j) => {
        const xa = gx(S.outmarks[j].t) + grains[j].dx * (1 - e) + 16, xb = gx(S.outmarks[j + 1].t) + grains[j + 1].dx * (1 - e) - 16;
        ln.setAttribute('x1', xa); ln.setAttribute('x2', xb);
        for (const [c, x] of [[c1, xa], [c2, xb]]) { c.setAttribute('x1', x); c.setAttribute('x2', x); c.setAttribute('y1', MY - 9); c.setAttribute('y2', MY + 9); }
      });
      setGaps(1);
      text(gGr, 1142, 722, 'wider gaps, lower pitch', { fs: 26, anchor: 'end', color: C.check });

      // ============================================================ the AI accent path: Seed-VC
      const gVC = group(5), pv = P(gVC);
      pv.rect(1210, 690, 592, 300, { color: C.ink3, sw: 2, r: 16, dash: [11, 9], rough: 0.6 });
      text(gVC, 1238, 726, 'accent', { fs: 30, anchor: 'start', color: C.ink });
      pv.block(1350, 706, 62, 40, 'AI', C.made, { fs: 24, fa: 0.3, font: 'sans', weight: 600 });
      // schematic waves in and out (illustrative shapes, no data)
      const squiggle = (x, yc, w, amp, seed) => {
        const n = 46, d = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n, env = Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(u * 9 + seed));
          d.push(`${i ? 'L' : 'M'}${(x + u * w).toFixed(1)} ${(yc + (i % 2 ? -1 : 1) * amp * env).toFixed(1)}`);
        }
        return d.join('');
      };
      el('path', { d: squiggle(1236, 890, 92, 34, 1), fill: 'none', stroke: C.extra, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, gVC);
      const NB = 13, DW = 16, DG = 6, DX0 = 1384, DTOP = 836, DBOT = 948;
      const bx = (i) => DX0 + i * (DW + DG), DR = bx(NB - 1) + DW;
      pv.arrow([[1334, 890], [DX0 - 8, 890]], { color: C.ink2, sw: 2.4, hl: 12 });
      for (let i = 0; i < NB; i++) pv.rect(bx(i), DTOP, DW, DBOT - DTOP, { color: C.attn, fill: alpha(C.attn, i === 6 ? 0.4 : 0.2), sw: 1.6, r: 4, rough: 0.6 });
      for (let i = 0; i < 6; i++) {                                    // U-ViT long skips: block i joins block 12 - i
        const a = bx(i) + DW / 2, b = bx(NB - 1 - i) + DW / 2, h = 12 + (6 - i) * 7, y = DTOP - 3;
        pv.path(`M${a} ${y}C${a} ${y - h} ${b} ${y - h} ${b} ${y}`, { color: alpha(C.ink2, 0.9), sw: 1.8, rough: 0.35 });
      }
      text(gVC, (DX0 + DR) / 2, 774, 'Seed-VC', { fs: 28, color: C.model });
      text(gVC, (DX0 + DR) / 2, 972, '× 13', { fs: 26, color: C.attn, font: 'sans', weight: 600 });
      pv.arrow([[DR + 8, 890], [DR + 40, 890]], { color: C.ink2, sw: 2.4, hl: 12 });
      el('path', { d: squiggle(DR + 46, 890, 92, 34, 4), fill: 'none', stroke: C.made, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, gVC);

      // ============================================================ arrival: the ending bends, the grains spread
      return {
        items,
        arrive() {
          running?.();
          let raf = 0, alive = true;
          const t0 = performance.now();
          const ov = el('g', {}, gNew);                                // animation-only paths
          const mBody = el('path', { fill: 'none', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ov);
          const mTail = el('path', { fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ov);
          const before = el('path', { d: runsPath(toXY(split(runsB, false))), fill: 'none', stroke: C.ink2, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ov);
          const beforeTail = el('path', { d: runsPath(toXY(split(runsB, true))), fill: 'none', stroke: C.check, 'stroke-width': 8, 'stroke-linecap': 'round' }, ov);
          const fade = [ghostBody, ghostTail, newBody, newTail, bend, fallT];
          const BL = [...bend.querySelectorAll('path')].map((p) => [p, p.getTotalLength()]);
          const restore = () => {
            ov.remove();
            fade.forEach((n) => { n.style.opacity = ''; });
            BL.forEach(([p]) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
            grains.forEach((q) => q.sub.removeAttribute('transform')); setGaps(1);
            lastWord.firstChild.textContent = 'tomorrow.'; lastWord.setAttribute('fill', C.made);
          };
          const M0 = 350, M1 = 2150, END = 3000;
          const frame = (now) => {
            if (!alive) return;
            const t = now - t0, e = ease(clamp01((t - M0) / (M1 - M0)));
            const lerpPath = (runs) => runsPath(runs.map((r) => r.map((p) => [tx(p.t), fy(Math.exp(Math.log(p.hb) + e * (Math.log(p.ha) - Math.log(p.hb))))])));
            mBody.setAttribute('d', lerpPath(morphBody)); mBody.setAttribute('stroke', mix(C.ink2, C.made, e));
            mTail.setAttribute('d', lerpPath(morphTail)); mTail.setAttribute('stroke', mix(C.check, C.made, e));
            const out = clamp01((t - M0) / 500), inn = clamp01((t - M1 + 250) / 450);
            before.style.opacity = String(1 - out); beforeTail.style.opacity = String(1 - out);
            newBody.style.opacity = newTail.style.opacity = String(inn);
            mBody.style.opacity = mTail.style.opacity = String(t < M1 + 200 ? 1 : 0);
            ghostBody.style.opacity = ghostTail.style.opacity = String(clamp01((t - M1) / 500));
            const swap = t >= (M0 + M1) / 2;
            lastWord.firstChild.textContent = swap ? 'tomorrow.' : 'tomorrow?';
            lastWord.setAttribute('fill', swap ? C.made : C.check);
            const eb = clamp01((t - M1 + 300) / 600);
            BL.forEach(([p, L]) => { p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = String(L * (1 - eb)); });
            fallT.style.opacity = String(clamp01((t - M1 - 150) / 350));
            grains.forEach((q) => q.sub.setAttribute('transform', `translate(${(q.dx * (1 - e)).toFixed(1)} 0)`));
            setGaps(e);
            if (t < END) raf = requestAnimationFrame(frame); else stop();
          };
          const stop = () => { alive = false; cancelAnimationFrame(raf); restore(); if (running === stop) running = null; };
          running = stop;
          frame(t0);
          return stop;
        },
      };
    },
  };
})();
