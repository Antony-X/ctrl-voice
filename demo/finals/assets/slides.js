/* The deck's own slides: title, stat, architecture map, demo bingo, close, backup. The chat slide lives in chat.js.
   window.HOOKS[data-id] = { init(slide), enter(slide, {back}), step(slide, k, {back}), leave(slide), key(slide, n) }. */
(function () {
  const Sk = window.Sketch, { C, el, P } = Sk;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const H = window.HOOKS = window.HOOKS || {};
  const sfx = (name, ...a) => window.Sfx?.[name]?.(...a);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mark = $('#mark').innerHTML;

  /** Count a number up from 0 with an ease-out; fmt turns the value into text. */
  function countUp(node, to, ms, fmt) {
    cancelAnimationFrame(node._raf);
    if (reduced()) { node.textContent = fmt(to); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const e = Math.min(1, (now - t0) / ms), k = 1 - Math.pow(1 - e, 4);
      node.textContent = fmt(to * k);
      if (e < 1) node._raf = requestAnimationFrame(tick);
    };
    node._raf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------------ title: the logo's bars move like a level meter
  H.title = {
    init(s) {
      const host = $('#title-mark', s); host.innerHTML = mark;
      this.lines = $$('line', host).map((l) => ({ l, y1: +l.getAttribute('y1'), y2: +l.getAttribute('y2') }));
    },
    enter() {
      const t0 = performance.now();
      const tick = (now) => {
        const t = (now - t0) / 1000;
        this.lines.forEach(({ l, y1, y2 }, i) => {
          const mid = (y1 + y2) / 2, half = (y2 - y1) / 2;
          const a = 0.62 + 0.38 * Math.abs(Math.sin(t * 2.1 + i * 1.3) * Math.sin(t * 0.9 + i * 0.7));
          l.setAttribute('y1', (mid - half * a).toFixed(2)); l.setAttribute('y2', (mid + half * a).toFixed(2));
        });
        this.raf = requestAnimationFrame(tick);
      };
      if (!reduced()) this.raf = requestAnimationFrame(tick);
    },
    leave() { cancelAnimationFrame(this.raf); },
  };

  // ------------------------------------------------------------------ stat: 7 billion; a text gets edited, a voice note can't be
  H.stat = {
    init(s) {
      // a small voice note, drawn from Sarah's real waveform
      const vn = $('#st-vn', s), pk = window.DATA.clips['clean.before'].peaks;
      vn.innerHTML = `<i class="pl"></i><span class="bars">${Array.from({ length: 34 }, (_, i) => `<i style="height:${10 + 88 * pk[Math.floor(i / 34 * pk.length)]}%"></i>`).join('')}</span><span class="d">0:14</span><i class="st-strike"></i>`;
      const gok = el('g', {}, $('#st-ok', s)), gno = el('g', {}, $('#st-no', s));
      P(gok).circle(60, 60, 96, { color: C.made, sw: 4, rough: 1.2 }); P(gok).poly([[36, 62], [54, 80], [86, 42]], { color: C.made, sw: 6 });
      P(gno).circle(60, 60, 96, { color: C.cut, sw: 4, rough: 1.2 }); P(gno).line(38, 38, 82, 82, { color: C.cut, sw: 6 }); P(gno).line(82, 38, 38, 82, { color: C.cut, sw: 6 });
      this.marks = [Sk.animator([{ g: gok, seq: 0 }], { dur: 420 }), Sk.animator([{ g: gno, seq: 0 }], { dur: 420 })];
      this.num = $('#st-count', s);
      this.pair = $('.st-pair', s);
      [this.txt, this.voice] = $$('.st-col', s);
    },
    // phase 0: nothing; 1: the 7 is struck; 2: the 8 is in, "edited", ✓; 3: a strike tries the voice note; 4: it shakes it off, ✗
    phase(n) {
      this.txt.classList.toggle('struck', n >= 1); this.txt.classList.toggle('fixed', n >= 2);
      this.voice.classList.toggle('tried', n === 3); this.voice.classList.toggle('denied', n >= 4);
    },
    clear() { (this.ts || []).forEach(clearTimeout); this.ts = []; },
    step(s, k, { back }) {
      this.clear();
      const fmt = (v) => Math.round(v).toLocaleString('en-US');
      if (k === 0) {
        this.phase(0); this.marks.forEach((m) => m.reset());
        if (back) { this.num.textContent = fmt(7e9); return; }
        sfx('whoom'); countUp(this.num, 7e9, 1900, fmt);
        return;
      }
      cancelAnimationFrame(this.num._raf); this.num.textContent = fmt(7e9);   // stop a count-up that is still running
      if (back) { this.phase(2); this.marks.forEach((m) => m.show()); return; }   // finished state, without replaying the shake
      const at = (ms, f) => this.ts.push(setTimeout(f, ms));
      at(450, () => this.phase(1));
      at(800, () => { this.phase(2); sfx('pop'); this.marks[0].play(); });
      at(1700, () => this.phase(3));
      at(2050, () => { this.phase(4); sfx('tick'); this.marks[1].play(); });
    },
    leave() { this.clear(); cancelAnimationFrame(this.num._raf); },
  };

  // ------------------------------------------------------------------ architecture map: overview, nine regions, overview
  H.arch = {
    init(s) {
      const ind = $('#ar-stage', s); ind.innerHTML = mark;
      this.bars = $$('line', ind);
      const light = (k) => {
        ind.classList.toggle('on', k >= 0);
        const st = k >= 0 ? ARCH.meta[k].stage : -1;
        this.bars.forEach((b, i) => b.classList.toggle('lit', i === st));
      };
      this.light = light;
      this.map = ARCH.mount($('#arch-host', s), { onLand: (k) => { if (k >= 0) sfx('tick'); } });
    },
    step(s, k, { back }) {
      const region = k >= 1 && k <= 9 ? k - 1 : -1;
      this.light(region);
      if (k === 0 && !back) { sfx('whoom'); this.map.build(); return; }
      if (back && k === 10) { this.map.goTo(-1, { instant: true }); return; }
      this.map.goTo(region);
    },
    leave() { this.map.halt(); },
  };

  // ------------------------------------------------------------------ demo: mistake bingo, keys 1-4 stamp a square
  // Each square is one example from Sarah's note, the mistake in red. A stamp strikes it out (or swaps "have" for "has").
  H.demo = {
    init(s) {
      const card = $('#dm-card', s);
      const examples = [
        '<div><s>Um,</s> quick update</div>',
        '<div><s>Thursday. No,</s> Friday</div>',
        '<div><s>Shrek all week.</s></div><div><s>Scratch that.</s></div>',
        '<div>Dan <s class="swap">have</s><ins>has</ins> the tickets</div>',
      ];
      const W = 1240, Hh = 560, cw = W / 2, ch = Hh / 2;
      const box = { width: W + 40, height: Hh + 40, viewBox: `-20 -20 ${W + 40} ${Hh + 40}` };
      const svg = el('svg', box, card), pen = P(svg);
      pen.rect(0, 0, W, Hh, { color: C.ink3, sw: 2.5, r: 22, rough: 0.7, fill: C.sheet });
      pen.line(cw, 18, cw, Hh - 18, { color: C.line, sw: 2.5 }); pen.line(18, ch, W - 18, ch, { color: C.line, sw: 2.5 });
      const cells = document.createElement('div'); cells.className = 'dm-cells'; card.appendChild(cells);
      const top = el('svg', { ...box, class: 'top' }, card);         // stamps and the banner sit above the text
      this.cells = examples.map((html, i) => {
        const cell = document.createElement('div'); cell.className = 'dm-cell'; cell.innerHTML = html; cells.appendChild(cell);
        const sx = i % 2 ? W - 70 : 70, sy = i < 2 ? 66 : Hh - 66;   // stamps sit in the card's outer corners, clear of the banner
        const st = el('g', { class: 'dm-stamp', style: `transform-origin:${sx}px ${sy}px` }, top), sp = P(st);
        sp.circle(sx, sy, 96, { color: C.made, sw: 5, fill: Sk.alpha(C.made, 0.22), fillStyle: 'hachure', gap: 9, rough: 1.4, seed: 70 + i });
        sp.poly([[sx - 26, sy + 2], [sx - 7, sy + 23], [sx + 28, sy - 21]], { color: C.made, sw: 8, seed: 80 + i });
        return { cell, st, on: false };
      });
      this.bingo = el('g', { class: 'dm-bingo' }, top);
      const bp = P(this.bingo);
      bp.rect(W / 2 - 230, Hh / 2 - 70, 460, 140, { color: C.made, fill: C.sheet, sw: 4, r: 70, rough: 1, seed: 91 });
      Sk.text(this.bingo, W / 2, Hh / 2 + 4, 'Bingo!', { fs: 76, font: 'serif', weight: 600, color: C.made, italic: true });
    },
    paint() {
      this.cells.forEach((c) => { c.st.classList.toggle('on', c.on); c.cell.classList.toggle('on', c.on); });
      this.bingo.classList.toggle('on', this.cells.every((c) => c.on));
    },
    enter() { this.cells.forEach((c) => { c.on = false; }); this.paint(); },
    key(s, n) {
      const c = this.cells[n - 1]; if (!c) return;
      c.on = !c.on; this.paint();
      if (c.on) { sfx('pop'); if (this.cells.every((x) => x.on)) setTimeout(() => sfx('sparkle'), 380); }
    },
  };

  // ------------------------------------------------------------------ close
  H.close = {
    // a hand-drawn underline under each number, drawn on as it counts up
    underline(s) {
      if (this.uls) return this.uls;
      const colors = [C.model, C.check, C.made];
      this.uls = $$('.cl-n', s).map((n, i) => {
        const w = n.querySelector('b').offsetWidth + 12;
        const svg = el('svg', { class: 'ul', width: w, height: 40, viewBox: `0 0 ${w} 40` }, n), g = el('g', {}, svg);
        P(g).path(`M4 22 Q ${w * 0.4} 12 ${w * 0.62} 20 T ${w - 4} 16`, { color: colors[i], sw: 6, rough: 1.1, seed: 40 + i });
        return Sk.animator([{ g, seq: 0 }], { dur: 600 });
      });
      return this.uls;
    },
    step(s, k, { back }) {
      this.underline(s).forEach((u, i) => { if (back) u.show(); else { u.reset(); setTimeout(() => u.play(), 500 + i * 220); } });
      $$('[data-count]', s).forEach((b, i) => {
        const to = +b.dataset.count, dec = +(b.dataset.dec || 0), fmt = (v) => v.toFixed(dec);
        if (back) { b.textContent = fmt(to); return; }
        b.textContent = fmt(0); setTimeout(() => countUp(b, to, 1300, fmt), 150 + i * 220);
      });
      if (!back) sfx('whoom');
    },
  };

  // ------------------------------------------------------------------ backup: three clips from an earlier run
  H.backup = {
    init(s) {
      this.vids = () => [...s.querySelectorAll('video')];
      // a screen recording of a real rehearsal, if one has been saved as media/video/live_backup.mp4, plays first
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        this.vids().forEach((v) => { v.dataset.v = +v.dataset.v + 1; });
        const v = document.createElement('video');
        Object.assign(v, { src: 'media/video/live_backup.mp4', preload: 'auto', playsInline: true });
        v.dataset.v = 0;
        s.insertBefore(v, s.querySelector('video'));
        s.dataset.steps = this.vids().length - 1;
      };
      probe.src = 'media/video/live_backup.mp4';
    },
    step(s, k) {
      this.vids().forEach((v) => {
        const cur = +v.dataset.v === k;
        v.classList.toggle('cur', cur);
        if (cur) { v.currentTime = 0; v.play().catch(() => Deck.toast('Video blocked: press P')); } else v.pause();
      });
    },
    leave() { this.vids().forEach((v) => v.pause()); },
  };
})();
