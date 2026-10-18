/* Region 7, verify. One story: two re-said candidates (PlayDiffusion, F5-TTS) run along a track through three check
   circles (said right = Whisper, fits = CTC margin, same voice = ECAPA). Both pass the first two; the closest voice wins
   the crown and its line runs on into the message. Below, the real before/after close-up (DATA.figs.closeup): the green
   pieces are the only new audio, 1.02 s; everything grey is the speaker's own recording. */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  /** Mirrored-envelope waveform from 0..1 peaks; bars are grouped by colour so each class can be animated on its own. */
  function wave(parent, x0, k, t0, peaks, dur, yc, amp, colorAt, sw = 2.2) {
    const n = peaks.length, dt = dur / n, segs = {};
    for (let i = 0; i < n; i++) {
      const t = t0 + (i + 0.5) * dt, x = x0 + (i + 0.5) * dt * k, h = Math.max(1, peaks[i] * amp);
      (segs[colorAt(t)] = segs[colorAt(t)] || []).push(`M${x.toFixed(1)} ${(yc - h).toFixed(1)}V${(yc + h).toFixed(1)}`);
    }
    const out = {};
    for (const col in segs) {
      const gg = el('g', {}, parent);
      el('path', { d: segs[col].join(''), stroke: col, 'stroke-width': sw, 'stroke-linecap': 'round', fill: 'none' }, gg);
      out[col] = gg;
    }
    return out;
  }

  /** A hand-drawn check mark centred at (x, y). */
  const tickPath = (p, x, y, s, color) =>
    p.path(`M${x - s * 0.55} ${y + s * 0.02} L${x - s * 0.15} ${y + s * 0.45} L${x + s * 0.62} ${y - s * 0.55}`, { color, sw: 6, rough: 0.5, single: true });

  /** A tiny schematic speaker-wave glyph (decoration, not data). */
  function audioGlyph(p, x, y, color) {
    const hs = [10, 22, 34, 18, 28, 12];
    hs.forEach((h, i) => p.line(x + i * 9, y - h / 2, x + i * 9, y + h / 2, { color, sw: 3.2, rough: 0.4 }));
  }

  ARCH.regions['verify'] = {
    draw(g, ctx) {
      const D = ctx.D, CU = D.figs.closeup, B = CU.before, A = CU.after;
      const items = [];
      const group = (seq) => { const a = el('g', {}, g); items.push({ g: a, seq }); return [a, P(a)]; };
      const pop = (node) => { node.style.transformBox = 'fill-box'; node.style.transformOrigin = '50% 50%'; return node; };

      // ================================================================ the candidates and their checks
      const rows = [{ eng: 'playdiff', name: 'PlayDiffusion', y: 352 }, { eng: 'f5', name: 'F5-TTS', y: 508 }];
      const cols = [{ label: 'said right', x: 760 }, { label: 'fits', x: 1030 }, { label: 'same voice', x: 1300 }];
      const R = 58;                                             // check circle radius
      const won = (eng) => CU.edits.every((e) => e.engine === eng);   // kept for every edit
      // checks 1 and 2 are pass/fail (cands[].ok); check 3 is a ranking, so only the kept engine gets its mark
      const passes = (eng, c) => (c < 2 ? CU.edits.every((e) => e.cands.find((k) => k.engine === eng)?.ok) : won(eng));
      const ticks = [];                                         // { g, at } in arrival order

      {
        const [a, p] = group(0);
        for (const c of cols) p.text(c.x, 250, c.label, { fs: 30, color: C.ink2 });
        for (const r of rows) {
          // track from the candidate to the last check; the winner's track carries on into the message (group 2)
          p.line(476, r.y, cols[2].x - R, r.y, { color: C.ink3, sw: 3, rough: 0.6 });
          p.block(120, r.y - 44, 356, 88, null, C.made, { fa: 0.12, sw: 2.4, r: 44 });
          audioGlyph(p, 160, r.y, C.made);
          p.text(236, r.y + 1, r.name, { fs: 34, anchor: 'start' });
        }
      }
      {
        const [a, p] = group(1);
        rows.forEach((r) => cols.forEach((c, ci) => {
          el('circle', { cx: c.x, cy: r.y, r: R - 2, fill: C.sheet }, a);           // hides the track under the circle
          p.circle(c.x, r.y, 2 * R, { color: C.ink3, sw: 2.6, rough: 0.7 });
          if (!passes(r.eng, ci)) return;
          const tg = pop(el('g', {}, a)), tp = P(tg);
          el('circle', { cx: c.x, cy: r.y, r: R - 3, fill: alpha(C.made, 0.2) }, tg);
          tp.circle(c.x, r.y, 2 * R, { color: C.made, sw: 3.4, rough: 0.8 });
          tickPath(tp, c.x, r.y + 2, 48, C.made);
          ticks.push({ g: tg, at: 350 + ci * 420 + (r.eng === 'f5' ? 90 : 0) });
        }));
      }
      // the winner: a crown and a glow, and its line runs on into the after waveform
      const win = rows.find((r) => won(r.eng));
      let crown, glow, runOn;
      {
        const [a, p] = group(2);
        glow = el('g', {}, a);
        P(glow).rect(108, win.y - 56, 380, 112, { color: C.check, sw: 3.2, r: 56, rough: 0.9 });
        crown = pop(el('g', {}, a));
        const cx = 160, cy = win.y - 64, w = 74, h = 48;
        P(crown).poly([[cx - w / 2, cy], [cx - w / 2 - 6, cy - h], [cx - w / 4, cy - h * 0.45], [cx, cy - h - 10], [cx + w / 4, cy - h * 0.45],
          [cx + w / 2 + 6, cy - h], [cx + w / 2, cy]], { closed: true, color: C.check, fill: alpha(C.check, 0.75), fillStyle: 'solid', sw: 2.6, rough: 0.8 });
        for (const [dx, dy] of [[-w / 2 - 6, -h], [0, -h - 10], [w / 2 + 6, -h]]) el('circle', { cx: cx + dx, cy: cy + dy - 4, r: 5, fill: C.check }, crown);
        runOn = p.arrow([[cols[2].x + R + 4, win.y], [1560, win.y + 6], [1676, win.y + 120], [1690, 760]], { curve: true, color: C.made, sw: 3.4, hl: 20 });
      }

      // ================================================================ before vs after, the real close-up
      const X0 = 252, X1 = 1500, k = (X1 - X0) / (A.t1 - A.t0);
      const xb = (t) => X0 + (t - B.t0) * k, xa = (t) => X0 + (t - A.t0) * k;
      const YB = 690, YA = 884, AMP = 56, BB = YB + AMP + 10, AT = YA - AMP - 10;
      const inB = (t) => B.regions.some(([s, e]) => t >= s && t <= e), inA = (t) => A.regions.some(([s, e]) => t >= s && t <= e);
      const mid = ([s, e]) => (s + e) / 2;

      {
        const [a, p] = group(3);
        p.text(100, YB, 'before', { fs: 30, anchor: 'start', color: C.ink2 });
        for (const rg of B.regions) {
          const [s, e] = rg;
          el('rect', { x: xb(s), y: YB - AMP - 10, width: xb(e) - xb(s), height: 2 * AMP + 20, rx: 8, fill: alpha(C.cut, 0.12) }, a);
          p.rect(xb(s), YB - AMP - 10, xb(e) - xb(s), 2 * AMP + 20, { color: C.cut, sw: 2.2, r: 8, dash: [8, 7], rough: 0.7 });
        }
        wave(a, X0, k, B.t0, B.peaks, B.t1 - B.t0, YB, AMP, (t) => (inB(t) ? C.cut : C.ink2));
        CU.edits.forEach((e, i) => p.text(xb(mid(B.regions[i])), YB - AMP - 36, e.old, { fs: 30, font: 'serif', color: C.cut }));
      }
      let bandsNew;
      {
        const [a] = group(4);
        const defs = el('defs', {}, a), gr = el('linearGradient', { id: 'verify-band', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        el('stop', { offset: 0, 'stop-color': C.cut, 'stop-opacity': 0.3 }, gr);
        el('stop', { offset: 1, 'stop-color': C.made, 'stop-opacity': 0.5 }, gr);
        bandsNew = el('g', {}, a);
        const bb = [B.t0, ...B.regions.flat(), B.t1], ab = [A.t0, ...A.regions.flat(), A.t1];
        for (let i = 0; i < bb.length - 1; i++) {
          if (i % 2 === 0) continue;                            // only the re-said spans get a link
          const d = `M${xb(bb[i])} ${BB}L${xb(bb[i + 1])} ${BB}L${xa(ab[i + 1])} ${AT}L${xa(ab[i])} ${AT}Z`;
          el('path', { d, fill: 'url(#verify-band)', stroke: 'none' }, bandsNew);
        }
      }
      let newAudio, newBoxes;
      {
        const [a, p] = group(5);
        p.text(100, YA, 'after', { fs: 30, anchor: 'start', color: C.ink2 });
        newBoxes = el('g', {}, a);
        for (const [s, e] of A.regions) {
          el('rect', { x: xa(s), y: YA - AMP - 10, width: xa(e) - xa(s), height: 2 * AMP + 20, rx: 8, fill: alpha(C.made, 0.16) }, newBoxes);
          P(newBoxes).rect(xa(s), YA - AMP - 10, xa(e) - xa(s), 2 * AMP + 20, { color: C.made, sw: 3, r: 8, rough: 0.7 });
        }
        const w = wave(a, X0, k, A.t0, A.peaks, A.t1 - A.t0, YA, AMP, (t) => (inA(t) ? C.made : C.ink2), 2.4);
        newAudio = pop(w[C.made]);
        CU.edits.forEach((e, i) => text(newBoxes, xa(mid(A.regions[i])), YA + AMP + 38, e.new, { fs: 30, font: 'serif', color: C.made, weight: 600 }));
      }
      let num, callout;
      {
        const [a, p] = group(6);
        callout = el('g', {}, a);
        const p2 = P(callout);
        num = p2.text(1690, 862, `${CU.regenerated.toFixed(2)} s`, { fs: 72, font: 'sans', weight: 600, color: C.made });
        p2.text(1690, 926, 'new audio', { fs: 30, color: C.ink });
      }

      // two little dots ride the tracks during arrival
      const dots = rows.map((r) => el('circle', { cx: 0, cy: r.y, r: 11, fill: C.made, opacity: 0 }, g));

      // ================================================================ arrival
      let timers = [], raf = 0;
      const final = `${CU.regenerated.toFixed(2)} s`;
      const runParts = () => [...runOn.children].map((c, i) => ({ head: i > 0, paths: [...c.querySelectorAll('path')].concat(c.tagName === 'path' ? [c] : []) }));
      function settle() {
        timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
        dots.forEach((d) => d.setAttribute('opacity', 0));
        for (const n of [...ticks.map((t) => t.g), crown, glow, newAudio, newBoxes, bandsNew, callout]) { n.style.transition = 'none'; n.style.opacity = ''; n.style.transform = ''; }
        num.textContent = final;
        for (const part of runParts()) for (const pth of part.paths) { pth.style.transition = 'none'; pth.style.strokeDashoffset = '0'; }
      }
      const show = (n, ms, tf = 'none') => { n.getBoundingClientRect(); n.style.transition = `opacity ${ms}ms ease, transform ${ms + 120}ms cubic-bezier(.3,1.5,.5,1)`; n.style.opacity = '1'; n.style.transform = tf; };
      function arrive() {
        settle();
        for (const t of ticks) { t.g.style.opacity = '0'; t.g.style.transform = 'scale(0.3)'; }
        crown.style.opacity = '0'; crown.style.transform = 'translateY(-70px) rotate(-14deg)';
        glow.style.opacity = '0';
        newAudio.style.opacity = '0'; newAudio.style.transform = 'scaleY(0.05)';
        newBoxes.style.opacity = '0'; bandsNew.style.opacity = '0'; callout.style.opacity = '0';
        num.textContent = '0.00 s';
        for (const part of runParts()) for (const pth of part.paths) { const L = pth.getTotalLength(); pth.style.strokeDasharray = `${L} ${L}`; pth.style.strokeDashoffset = `${L}`; }

        // the dots run along both tracks; the loser's stops at the last circle
        const T0 = performance.now(), RUN = 1250, xs = 476, xe = cols[2].x;
        dots.forEach((d) => d.setAttribute('opacity', 1));
        const step = (now) => {
          const e = Math.min(1, (now - T0) / RUN);
          dots.forEach((d) => d.setAttribute('cx', xs + (xe - xs) * e));
          if (e < 1) raf = requestAnimationFrame(step);
          else dots.forEach((d) => d.setAttribute('opacity', 0));
        };
        raf = requestAnimationFrame(step);

        for (const t of ticks) timers.push(setTimeout(() => show(t.g, 200), t.at));
        timers.push(setTimeout(() => { show(crown, 260); show(glow, 400); window.Sfx?.tick?.(); }, 1450));
        timers.push(setTimeout(() => {                         // the winner's line runs on towards the message
          for (const part of runParts()) for (const pth of part.paths) {
            pth.getBoundingClientRect();
            pth.style.transition = part.head ? 'stroke-dashoffset 160ms ease-out 360ms' : 'stroke-dashoffset 480ms ease-in-out';
            pth.style.strokeDashoffset = '0';
          }
        }, 1600));
        timers.push(setTimeout(() => { show(newBoxes, 300); show(bandsNew, 500); show(newAudio, 380); show(callout, 250); }, 1950));
        timers.push(setTimeout(() => {                         // count the new audio up
          const t1 = performance.now(), target = CU.regenerated;
          const count = (now) => {
            const e = Math.min(1, (now - t1) / 700);
            num.textContent = `${(target * (1 - Math.pow(1 - e, 3))).toFixed(2)} s`;
            if (e < 1) raf = requestAnimationFrame(count);
          };
          raf = requestAnimationFrame(count);
        }, 2050));
        timers.push(setTimeout(settle, 3600));
        return settle;
      }

      return { items, arrive };
    },
  };
})();
