/* Region 4, "rules" (host title: Guard / hard rules).
   One picture: the LLM's proposed cuts ride a conveyor through four deterministic gates (brain.py clean():
   delete-only output, and the protected word classes of CATS: negations, numbers, days/times). The three real cuts of
   Sarah's message (DATA.clean.edits, type "cut") pass, turn green and land in the edit list. Her two word
   replacements are left out on purpose: they come from a different path (grammar/intent + re-say), not these gates.
   "Thursday. No, sorry," legitimately passes the date gate: it is a self-correction with a same-type repair (Friday).
   The dangerous proposal, cutting "not" from "I'm not coming", is stopped red at the negation gate; in the app such
   a cut is demoted to a suggestion, never auto-applied. That chip illustrates the rule (it is not from Sarah's
   message). Callout: meaning-changing deletions on the 10 trick sentences, 2 -> 0 (DECK_PLAN). */
(function () {
  const { C, el, text, P, alpha } = window.Sketch;
  window.ARCH = window.ARCH || {}; ARCH.regions = ARCH.regions || {};

  // ------------------------------------------------------------------ layout
  const GX = [520, 850, 1115, 1365];        // gate centres
  const TUN = 34;                            // half-width of the scanner tunnel each gate puts over the belt
  const BADGE_Y = 382, BADGE_D = 150;
  const BELT_X0 = 150, BELT_X1 = 1440, BELT_TOP = 744;
  const CH = 84, CY = BELT_TOP - 6 - CH / 2;  // chip height, chip centre y on the belt
  const SPAWN_X = 160;                       // left edge of a chip as it drops onto the belt
  const TRAY_X = 1478, TRAY_R = 1814, TRAY_CX = 1493;
  const TRAY_Y0 = 302, TRAY_Y1 = 810;
  const ROW = [408, 556, 704];               // edit-list rows (centre y)
  const PAD = 26, FS = 30;

  // Serif 30 px widths, measured with the deck fonts loaded (fonts can still be loading when the map is built).
  const TW = { um: 54, thu: 251, shrek: 253, im: 46, not: 42, coming: 91 };
  const SP = 9;                              // a space at 30 px (SVG drops leading spaces)

  // The proposals: the three real cuts of Sarah's message (DATA.clean.edits), then the illustration.
  // ("Shrek… Scratch that." abbreviates the real cut "Also, I've been watching Shrek all week. Delete that!")
  const CHIPS = [
    { type: 'cut', words: 'Um,', w: TW.um },
    { type: 'cut', words: 'Thursday. No, sorry,', w: TW.thu },
    { type: 'cut', words: 'Shrek… Delete that!', w: TW.shrek },
    { type: 'danger' },
  ];
  const DANGER = CHIPS.length - 1;
  const chipW = (c) => c.type === 'cut' ? Math.max(118, c.w + 2 * PAD) : TW.im + TW.not + SP + TW.coming + 2 * PAD;

  /** One chip, drawn with its top-left at (0, 0). tone: 'plain' | 'ok' | 'bad'. */
  function drawChip(parent, c, tone) {
    const g = el('g', {}, parent), p = P(g), w = chipW(c), y = CH / 2;
    const col = tone === 'ok' ? C.made : tone === 'bad' ? C.cut : C.ink2;
    el('rect', { x: 2, y: 2, width: w - 4, height: CH - 4, rx: 14, fill: C.sheet }, g);   // opaque: chips pass in front of the gates
    p.rect(0, 0, w, CH, { color: col, fill: alpha(col, tone === 'plain' ? 0.08 : 0.2), sw: 2.6, r: 16, seed: 4000 + Math.round(w) });
    const strike = (x, len) => el('line', { x1: x - 3, y1: y + 1, x2: x + len + 3, y2: y + 1, stroke: C.cut, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    if (c.type === 'cut') {
      text(g, PAD, y, c.words, { fs: FS, font: 'serif', anchor: 'start' });
      strike(PAD, c.w);
    } else {
      text(g, PAD, y, 'I’m', { fs: FS, font: 'serif', anchor: 'start' });
      text(g, PAD + TW.im, y, 'not', { fs: FS, font: 'serif', anchor: 'start', color: C.cut });
      strike(PAD + TW.im, TW.not);
      text(g, PAD + TW.im + TW.not + SP, y, 'coming', { fs: FS, font: 'serif', anchor: 'start' });
    }
    return g;
  }

  // ------------------------------------------------------------------ gate icons (drawn around (cx, cy))
  const ICON = [
    function scissors(p, g, cx, cy) {
      p.line(cx - 15, cy + 10, cx + 25, cy - 36, { color: C.ink, sw: 3.6, rough: 0.5 });
      p.line(cx + 15, cy + 10, cx - 25, cy - 36, { color: C.ink, sw: 3.6, rough: 0.5 });
      p.circle(cx - 20, cy + 24, 27, { color: C.ink, sw: 3.2, rough: 0.5 });
      p.circle(cx + 20, cy + 24, 27, { color: C.ink, sw: 3.2, rough: 0.5 });
    },
    function negation(p, g, cx, cy) { text(g, cx, cy - 3, 'not', { fs: 54, font: 'serif', weight: 600 }); },
    function numbers(p, g, cx, cy) { text(g, cx, cy, '123', { fs: 48, font: 'sans', weight: 600 }); },
    function calendar(p, g, cx, cy) {
      p.rect(cx - 37, cy - 27, 74, 64, { color: C.ink, sw: 3, r: 7, rough: 0.6 });
      p.line(cx - 37, cy - 10, cx + 37, cy - 10, { color: C.ink, sw: 2.8, rough: 0.4 });
      p.line(cx - 17, cy - 37, cx - 17, cy - 19, { color: C.ink, sw: 3.4, rough: 0.3 });
      p.line(cx + 17, cy - 37, cx + 17, cy - 19, { color: C.ink, sw: 3.4, rough: 0.3 });
      for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) el('circle', { cx: cx - 19 + k * 19, cy: cy + 6 + r * 17, r: 4.2, fill: C.ink }, g);
    },
  ];
  const GATE_LABEL = ['delete only', 'negation', 'numbers', 'dates & times'];

  ARCH.regions['rules'] = {
    draw(g) {
      const items = [];

      // ================================================================ 0. the LLM hopper
      const gH = el('g', {}, g), pH = P(gH);
      pH.poly([[136, 300], [380, 300], [306, 500], [210, 500]], { closed: true, color: C.ffn, fill: alpha(C.ffn, 0.14), sw: 2.6, rough: 0.8 });
      text(gH, 258, 350, 'LLM', { fs: 40 });
      // three proposals waiting inside: level, centred, 12 px apart, each 20 px in from both funnel walls
      const HOP = { x0: 136, x1: 380, y0: 300, bx0: 210, bx1: 306, y1: 500 };
      const wallW = (y) => (HOP.x1 - HOP.x0) - ((HOP.x1 - HOP.x0) - (HOP.bx1 - HOP.bx0)) * (y - HOP.y0) / (HOP.y1 - HOP.y0);
      [396, 430, 464].forEach((cy) => {
        const w = Math.floor(wallW(cy + 11) - 40);
        pH.rect(258 - w / 2, cy - 11, w, 22, { color: C.ink2, fill: alpha(C.ink2, 0.18), sw: 1.8, r: 7, rough: 0.5 });
      });
      pH.arrow([[258, 512], [258, 580]], { color: C.ffn, sw: 2.6, hl: 14, dash: [8, 7] });
      items.push({ g: gH, seq: 0 });

      // ================================================================ 1. the conveyor
      const gB = el('g', {}, g), pB = P(gB);
      for (let x = BELT_X0 + 36; x <= BELT_X1 - 20; x += 88) pB.circle(x, BELT_TOP + 52, 34, { color: C.ink3, sw: 2, rough: 0.5 });
      pB.rect(BELT_X0, BELT_TOP, BELT_X1 - BELT_X0, 28, { color: C.ink2, fill: alpha(C.ink2, 0.16), sw: 2.4, r: 13 });
      const beltMove = el('line', { x1: BELT_X0 + 18, y1: BELT_TOP + 14, x2: BELT_X1 - 18, y2: BELT_TOP + 14, stroke: C.ink3, 'stroke-width': 3, 'stroke-dasharray': '14 22', 'stroke-linecap': 'round' }, gB);
      items.push({ g: gB, seq: 1 });
      const movers = el('g', { 'pointer-events': 'none' }, g);   // arrival: chips ride under the gate tunnels

      // ================================================================ 2. four gates: icon badge, short label, a post, a tunnel over the belt
      const rings = [];
      GX.forEach((x, k) => {
        const gg = el('g', {}, g), pg = P(gg);
        const tt = CY - CH / 2 - 18;
        pg.rect(x - 11, BADGE_Y + BADGE_D / 2 - 4, 22, tt - (BADGE_Y + BADGE_D / 2 - 4) + 4, { color: C.check, fill: alpha(C.check, 0.3), sw: 2, r: 6 });
        pg.rect(x - TUN, tt, 2 * TUN, BELT_TOP + 3 - tt, { color: C.check, fill: alpha(C.check, 0.22), sw: 2.6, r: 10 });
        pg.circle(x, BADGE_Y, BADGE_D, { color: C.check, fill: C.sheet, sw: 3, rough: 0.6 });
        el('circle', { cx: x, cy: BADGE_Y, r: BADGE_D / 2 - 3, fill: alpha(C.check, 0.12) }, gg);
        ICON[k](pg, gg, x, BADGE_Y);
        text(gg, x, 262, GATE_LABEL[k], { fs: 30 });
        rings.push(el('circle', { cx: x, cy: BADGE_Y, r: BADGE_D / 2 + 9, fill: 'none', stroke: C.made, 'stroke-width': 5, opacity: 0 }, g));
        items.push({ g: gg, seq: 2 + k });
      });

      // ================================================================ 3. the dangerous proposal, blocked at "negation"
      const danger = CHIPS[DANGER], dW = chipW(danger), dX = GX[1] - TUN - 10 - dW;
      const gD = el('g', {}, g);
      const dChip = el('g', { transform: `translate(${dX} ${CY - CH / 2})` }, gD);
      drawChip(dChip, danger, 'bad');
      const gX = el('g', {}, gD), pX = P(gX), xr = 30;
      pX.line(GX[1] - xr, CY - xr, GX[1] + xr, CY + xr, { color: C.cut, sw: 8, rough: 0.6 });
      pX.line(GX[1] + xr, CY - xr, GX[1] - xr, CY + xr, { color: C.cut, sw: 8, rough: 0.6 });
      items.push({ g: gD, seq: 6 });

      // ================================================================ 4. the edit list: the real edits, all passed
      const gT = el('g', {}, g), pT = P(gT);
      text(gT, (TRAY_X + TRAY_R) / 2, 262, 'edit list', { fs: 30 });
      pT.rect(TRAY_X, TRAY_Y0, TRAY_R - TRAY_X, TRAY_Y1 - TRAY_Y0, { color: C.made, fill: alpha(C.made, 0.05), sw: 2.4, r: 16 });
      const trayChips = CHIPS.slice(0, DANGER).map((c, i) => {
        const tg = el('g', { transform: `translate(${TRAY_CX} ${ROW[i] - CH / 2})` }, gT);
        drawChip(tg, c, 'ok');
        return tg;
      });
      items.push({ g: gT, seq: 7 });

      // ================================================================ 5. the result: 2 -> 0
      const gR = el('g', {}, g), pR = P(gR);
      const RY = 892;
      text(gR, 640, RY, '2', { fs: 128, font: 'sans', weight: 600, color: C.cut });
      pR.arrow([[712, RY + 4], [836, RY + 4]], { color: C.ink2, sw: 4.5, hl: 24 });
      text(gR, 908, RY, '0', { fs: 128, font: 'sans', weight: 600, color: C.made });
      text(gR, 1004, RY + 8, 'meaning changed', { fs: 42, anchor: 'start', color: C.ink });
      items.push({ g: gR, seq: 8 });

      // ================================================================ arrival: the proposals ride through the gates
      const V = 950, FALL = 0.22, GLIDE = 0.36, XE = 1420;
      // Each chip drops only once the one before has moved its own width (+30 px) along, so they never touch;
      // the red one comes last, after a short beat.
      let next = 0.05;
      const plan = CHIPS.map((c, i) => {
        const w = chipW(c), danger = c.type === 'danger';
        if (i > 0) next += FALL - 0.06 + (w + 30) / V + (danger ? 0.25 : 0);
        const cx0 = SPAWN_X + w / 2, cx1 = danger ? dX + w / 2 : XE;
        return { c, i, w, danger, start: next, cx0, cx1, run: (cx1 - cx0) / V };
      });
      const show = (node, v) => { node.style.opacity = v == null ? '' : String(v); };
      let raf = 0, timer = 0, state = [];

      function restore() {
        cancelAnimationFrame(raf); clearTimeout(timer); raf = 0;
        movers.textContent = ''; state = [];
        trayChips.forEach((t) => show(t));
        show(dChip); show(gX); gX.removeAttribute('transform');
        rings.forEach((r) => r.setAttribute('opacity', 0));
        beltMove.removeAttribute('stroke-dashoffset');
      }

      return {
        items,
        arrive() {
          restore();
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) return restore;
          trayChips.forEach((t) => show(t, 0)); show(dChip, 0); show(gX, 0);
          state = plan.map((pl) => {
            const m = el('g', { opacity: 0 }, movers);
            const a = el('g', {}, m), b = el('g', {}, m); b.style.opacity = '0';
            drawChip(a, pl.c, 'plain'); drawChip(b, pl.c, pl.danger ? 'bad' : 'ok');
            return { pl, m, a, b, crossed: [false, false, false, false], done: false, hit: 0 };
          });
          const pulses = GX.map(() => ({ t: -9, col: C.made }));
          const t0 = performance.now();
          const frame = (now) => {
            const t = (now - t0) / 1000;
            let busy = t < 3.2;
            beltMove.setAttribute('stroke-dashoffset', String((-(Math.min(t, 3.2) * V) % 36).toFixed(1)));
            for (const s of state) {
              const { pl, m, a, b } = s, u = t - pl.start;
              if (u < 0) { busy = true; continue; }
              let x, y, op = 1, dx = 0;
              if (u < FALL) {                                    // drop from the hopper onto the belt
                const f = u / FALL; x = pl.cx0; y = CY - 90 * (1 - f * f); op = Math.min(1, f * 2.5);
              } else if (u < FALL + pl.run) {                    // ride the belt
                x = pl.cx0 + (u - FALL) * V; y = CY;
              } else if (!pl.danger) {                           // glide into its edit-list row
                // ease-out along a curve that leaves the belt at belt speed, so the next chip never catches up
                const f = Math.min(1, (u - FALL - pl.run) / GLIDE), e = 1 - (1 - f) * (1 - f);
                const tx = TRAY_CX + pl.w / 2, ty = ROW[pl.i], qx = XE + 150;
                x = (1 - e) * (1 - e) * XE + 2 * (1 - e) * e * qx + e * e * tx; y = (1 - e) * (1 - e) * CY + 2 * (1 - e) * e * CY + e * e * ty;
                if (f >= 1 && !s.done) { s.done = true; show(trayChips[pl.i]); m.remove(); continue; }
              } else {                                           // blocked: shake, then stay
                x = pl.cx1; y = CY;
                if (!s.hit) { s.hit = t; show(gX, 1); pulses[1] = { t, col: C.cut }; a.style.opacity = '0'; b.style.opacity = '1'; window.Sfx?.tick?.(); }
                const k = t - s.hit;
                dx = k < 0.5 ? -Math.sin(k * 40) * 9 * (1 - k / 0.5) : 0;
                const sc = k < 0.25 ? 0.4 + 0.8 * (k / 0.25) : k < 0.4 ? 1.2 - 0.2 * ((k - 0.25) / 0.15) : 1;
                gX.setAttribute('transform', `translate(${GX[1]} ${CY}) scale(${sc}) translate(${-GX[1]} ${-CY})`);
                if (k >= 0.6 && !s.done) { s.done = true; show(dChip); m.remove(); continue; }
              }
              if (s.done) continue;
              busy = true;
              GX.forEach((gx, k) => {
                if (!s.crossed[k] && x + pl.w / 2 >= gx && !(pl.danger && k >= 1)) {
                  s.crossed[k] = true; pulses[k] = { t, col: C.made };
                  if (k === 3) { a.style.transition = b.style.transition = 'opacity 180ms ease'; a.style.opacity = '0'; b.style.opacity = '1'; }
                }
              });
              m.setAttribute('opacity', op);
              m.setAttribute('transform', `translate(${(x - pl.w / 2 + dx).toFixed(1)} ${(y - CH / 2).toFixed(1)})`);
            }
            pulses.forEach((p, k) => {
              const d = t - p.t, o = d >= 0 && d < 0.45 ? 0.9 * (1 - d / 0.45) : 0;
              rings[k].setAttribute('stroke', p.col); rings[k].setAttribute('opacity', o.toFixed(3));
              if (o > 0) busy = true;
            });
            if (busy) raf = requestAnimationFrame(frame);
            else timer = setTimeout(restore, 100);
          };
          raf = requestAnimationFrame(frame);
          return restore;
        },
      };
    },
  };
})();
