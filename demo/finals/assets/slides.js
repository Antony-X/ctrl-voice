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

  /** Jump a slide to its finished look: transitions and animations are off until the next frame. */
  function still(s, apply) {
    s.classList.add('still'); apply(); s.getBoundingClientRect();
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove('still')));
  }

  // ------------------------------------------------------------------ idea: edit the words, the audio follows
  // Each word is tied to its own piece of the recording (Sarah's real audio for that word, from the chat slide).
  // Step 0: the tape is "recorded", the words land above it, the mistakes turn red.
  // Step 1: the red words are struck, their sound drops out, the rest closes up, and only "have" -> "has" is new.
  H.idea = {
    SPEC: [['Um,', 'um', 'cut'], ['Thursday.', 'thursday', 'cut'], ['No,', 'no', 'cut'], ['Friday.', 'friday'],
      ['Dan', 'dan'], ['have', 'have', 'swap'], ['the', 'the'], ['tickets.', 'tickets']],
    FS: 76, WY: 455, TY: 680, TH: 150, GAP: 36, BW: 6, PITCH: 11, TAGY: 860,
    init(s) {
      this.s = s;
      Promise.all(['500 76px Newsreader', '600 28px "Instrument Sans"'].map((f) => document.fonts.load(f)))
        .then(() => this.build(), () => this.build());
    },
    build() {
      if (this.cols) return;
      const svg = $('#id-svg', this.s), { FS, WY, TY, TH, GAP, BW, PITCH, TAGY } = this;
      const before = window.DATA.clips['clean.before'], after = window.DATA.clips['clean.after'];
      const norm = (w) => w.toLowerCase().replace(/[^a-z']/g, '');
      const seek = (clip, key, from) => { const i = clip.words.findIndex((x, j) => j >= from && norm(x.w) === key); return i; };
      const width = (str) => { const t = Sk.text(svg, 0, 0, str, { fs: FS, font: 'serif', weight: 500 }); const w = t.getComputedTextLength(); t.remove(); return w; };
      // bars shaped by the word's real loudness (interpolated, with a little texture so long words don't look blocky)
      const bars = (g, clip, s0, e0, w, cls) => {
        const n = Math.max(3, Math.floor((w - BW) / PITCH) + 1), x0 = (w - ((n - 1) * PITCH + BW)) / 2, pk = clip.peaks;
        for (let i = 0; i < n; i++) {
          const f = (s0 + (i + 0.5) / n * (e0 - s0)) / clip.dur * (pk.length - 1), a = Math.floor(f), b = Math.min(pk.length - 1, a + 1);
          const v = (pk[a] + (pk[b] - pk[a]) * (f - a)) * (0.72 + 0.28 * Math.abs(Math.sin(i * 2.17 + s0 * 7)));
          const h = 14 + (TH - 14) * Math.min(1, v * 1.15);
          const r = el('rect', { class: cls, x: (x0 + i * PITCH).toFixed(1), y: (TY - h / 2).toFixed(1), width: BW, height: h.toFixed(1), rx: BW / 2 }, g);
          r.style.setProperty('--i', i / n);
        }
      };
      let from = 0;
      const items = this.SPEC.map(([text, key, kind]) => {
        const i = seek(before, key, from); from = i + 1;
        const src = before.words[i];
        return { text, kind, src, w: width(text) };
      });
      const swap = items.find((c) => c.kind === 'swap'), has = after.words[seek(after, 'has', 0)];
      items.forEach((c) => { c.wn = c.kind === 'swap' ? width('has') : c.w; });
      // x0: as spoken; x1: the cuts closed up; x2: "have" -> the narrower "has", re-centred
      const layout = (list, k) => { const tot = list.reduce((a, c) => a + c[k], 0) + GAP * (list.length - 1); let x = 960 - tot / 2; return list.map((c) => { const at = x; x += c[k] + GAP; return at; }); };
      const x0 = layout(items, 'w'), kept = items.filter((c) => c.kind !== 'cut'), x1 = layout(kept, 'w'), x2 = layout(kept, 'wn');
      const span = x0[x0.length - 1] + items[items.length - 1].w - x0[0];
      this.strikes = [];
      this.cols = items.map((c, i) => {
        const g = el('g', { class: `id-col${c.kind ? ' ' + c.kind : ''}` }, svg), w = c.w;
        c.g = g; c.x0 = x0[i]; c.x1 = c.kind === 'cut' ? x0[i] : x1[kept.indexOf(c)]; c.x2 = c.kind === 'cut' ? x0[i] : x2[kept.indexOf(c)];
        g.style.setProperty('--d', `${Math.round((x0[i] - x0[0]) / span * 1250)}ms`);
        g.style.setProperty('--rot', `${[-9, 6, -5][i % 3]}deg`);
        const drop = el('g', { class: 'id-drop' }, g);
        el('line', { class: 'id-mid', x1: -GAP / 2, x2: w + GAP / 2, y1: TY, y2: TY }, drop);
        const old = el('g', { class: 'id-old' }, drop);
        bars(el('g', {}, old), before, c.src.s, c.src.e, w, 'id-bar');
        const said = el('g', { class: 'id-said' }, old);
        P(said).line(w / 2, WY + 50, w / 2, TY - TH / 2 - 14, { color: C.ink3, sw: 1.8, dash: [5, 8], rough: 0.3, seed: 300 + i });
        Sk.text(said, w / 2, WY, c.text, { fs: this.FS, font: 'serif', weight: 500, color: C.ink }).classList.add('id-word');
        if (c.kind) {
          const sg = el('g', { class: 'id-strike' }, said);
          P(sg).line(-8, WY + 6, w + 8, WY + 1, { color: C.cut, sw: 5.5, rough: 1.1, seed: 320 + i, single: true });
          this.strikes.push({ g: sg, seq: this.strikes.length });
        }
        if (c.kind === 'swap') {
          const nw = el('g', { class: 'id-new' }, g), wn = c.wn;
          bars(el('g', {}, nw), after, has.s, has.e, wn, 'id-bar');
          Sk.text(nw, wn / 2, WY, 'has', { fs: this.FS, font: 'serif', weight: 500, color: C.made }).classList.add('id-word');
          const tag = el('g', { class: 'id-tag' }, nw), tp = P(tag);
          tp.line(wn / 2, TY + TH / 2 + 12, wn / 2, TAGY - 36, { color: C.made, sw: 2.4, rough: 0.4, seed: 340 });
          tp.rect(wn / 2 - 68, TAGY - 34, 136, 68, { color: C.made, fill: Sk.alpha(C.made, 0.16), r: 34, sw: 3, rough: 0.8, seed: 341 });
          Sk.text(tag, wn / 2, TAGY + 1, 'AI', { fs: 38, font: 'sans', weight: 600, color: C.made });
        }
        return c;
      });
      this.strike = Sk.animator(this.strikes, { dur: 260, per: 120 });
      this.line = $('.id-line', this.s);
    },
    /** 0: nothing yet; 1: recorded, words up, mistakes red; 2: finished edit. */
    set(n) {
      this.s.classList.toggle('rec', false);
      this.cols.forEach((c) => {
        c.g.classList.toggle('grown', n >= 1); c.g.classList.toggle('red', n >= 1 && !!c.kind);
        c.g.classList.toggle('gone', n >= 2 && c.kind === 'cut'); c.g.classList.toggle('swapped', n >= 2 && c.kind === 'swap');
        c.g.style.transform = `translate(${n >= 2 ? c.x2 : c.x0}px, 0px)`;
      });
      if (n >= 2) this.strike.show(); else this.strike.reset();
      this.line.classList.toggle('on', n >= 2);
    },
    clear() { (this.ts || []).forEach(clearTimeout); this.ts = []; },
    step(s, k, { back }) {
      this.build(); this.clear();
      const at = (ms, f) => this.ts.push(setTimeout(f, ms));
      if (back || reduced()) { still(s, () => this.set(k === 0 ? 1 : 2)); return; }
      if (k === 0) {
        still(s, () => this.set(0));
        at(60, () => { s.classList.add('rec'); this.cols.forEach((c) => c.g.classList.add('grown')); });
        at(1900, () => { s.classList.remove('rec'); this.cols.forEach((c) => c.g.classList.toggle('red', !!c.kind)); });
        return;
      }
      still(s, () => this.set(1));
      at(80, () => this.strike.play());
      at(700, () => { sfx('swoosh', false); this.cols.forEach((c) => c.g.classList.toggle('gone', c.kind === 'cut')); });
      at(1050, () => this.cols.forEach((c) => { c.g.style.transform = `translate(${c.x1}px, 0px)`; }));
      at(1750, () => { sfx('sparkle'); this.cols.forEach((c) => { c.g.classList.toggle('swapped', c.kind === 'swap'); c.g.style.transform = `translate(${c.x2}px, 0px)`; }); });
      at(2150, () => this.line.classList.add('on'));
    },
    leave() { this.clear(); },
  };

  // ------------------------------------------------------------------ uses: one key, anywhere you talk
  // The keycap is the app's own logo. Step 0: it is pressed and six chat apps burst out around it.
  // Step 1: beyond chat, a video and a speech come in (recordings can be imported and fixed the same way).
  H.uses = {
    APPS: ['Discord', 'WhatsApp', 'Telegram', 'Slack', 'Signal', 'Teams'],
    CX: 960, CY: 600, RX: 500, RY: 285, K: 250,
    init(s) {
      this.s = s;
      document.fonts.load('600 34px "Instrument Sans"').then(() => this.build(), () => this.build());
    },
    build() {
      if (this.apps) return;
      const svg = $('#us-svg', this.s), { CX, CY, RX, RY, K } = this;
      // the keycap: a side (pressed into) and a top that carries the logo's five bars
      const key = el('g', { class: 'us-key' }, svg), kx = CX - K / 2, ky = CY - K / 2;
      P(key).rect(kx, ky + 18, K, K, { color: C.ink3, fill: C.panel, r: 54, sw: 3, rough: 0.9, seed: 400 });
      const top = el('g', { class: 'us-top' }, key), tp = P(top);
      tp.rect(kx, ky, K, K, { color: C.ink, fill: C.sheet, r: 54, sw: 4.5, rough: 0.9, seed: 401 });
      [[22.6, 40.5, 59.5], [36.1, 30, 70], [50, 18.5, 81.5], [63.9, 31, 69], [77.4, 41, 59]].forEach(([x, a, b], i) => {
        const X = kx + x / 100 * K, f = (v) => ky + (v / 100) * K;
        tp.line(X, f(a), X, f(b), { color: C.ink, sw: 11, rough: 0.6, seed: 410 + i, single: true });
      });
      this.keyAnim = Sk.animator([{ g: key, seq: 0 }], { dur: 480 });
      // six apps in speech bubbles on a ring, their tails pointing at the key
      this.apps = this.APPS.map((name, i) => {
        const ang = (-90 + i * 60) * Math.PI / 180, bx = CX + RX * Math.cos(ang), by = CY + RY * Math.sin(ang);
        const g = el('g', { class: 'us-app' }, svg);
        const t = Sk.text(g, bx, by + 1, name, { fs: 36, font: 'sans', weight: 600, color: C.ink });
        const w = t.getComputedTextLength() + 64, h = 78, x = bx - w / 2, y = by - h / 2, r = 26;
        const up = by > CY + 1, side = Math.abs(bx - CX) < 2 ? 0 : Math.sign(CX - bx);   // tail on the edge facing the key
        const tx = bx + side * (w / 2 - 46), ty = up ? y : y + h, tip = [tx + side * 6 - (side ? 0 : 0), up ? y - 26 : y + h + 26];
        const d = up
          ? `M${x + r} ${y} H${tx - 14} L${tip[0]} ${tip[1]} L${tx + 14} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`
          : `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${tx + 14} L${tip[0]} ${tip[1]} L${tx - 14} ${ty} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
        const shape = P(g).path(d, { color: C.ink2, fill: C.sheet, sw: 2.6, rough: 0.8, seed: 420 + i });
        g.insertBefore(shape, t);
        g.style.setProperty('--dx', `${CX - bx}px`); g.style.setProperty('--dy', `${CY - by}px`);
        g.style.transitionDelay = `${i * 85}ms`;
        return g;
      });
      // beyond chat: a video and a speech, each brought in to the key
      const more = el('g', { class: 'us-more' }, svg), mp = P(more), items = [];
      const vid = el('g', {}, more), vp = P(vid), vx = 215, vy = 592;
      vp.rect(vx - 118, vy - 76, 236, 152, { color: C.ink2, fill: C.sheet, r: 16, sw: 3, rough: 0.9, seed: 450 });
      vp.poly([[vx - 22, vy - 32], [vx + 30, vy], [vx - 22, vy + 32]], { color: C.ink, fill: Sk.alpha(C.ink, 0.12), closed: true, sw: 3.5, rough: 0.7, seed: 451 });
      Sk.text(vid, vx, vy + 128, 'video', { fs: 40, font: 'hand', color: C.ink2 });
      const mic = el('g', {}, more), cp = P(mic), mx = 1705, my = 592;
      cp.rect(mx - 32, my - 86, 64, 108, { color: C.ink, fill: Sk.alpha(C.ink, 0.12), r: 32, sw: 3.5, rough: 0.8, seed: 460 });
      cp.path(`M${mx - 54} ${my - 14} Q${mx - 54} ${my + 54} ${mx} ${my + 54} Q${mx + 54} ${my + 54} ${mx + 54} ${my - 14}`, { color: C.ink2, sw: 3, rough: 0.6, seed: 461 });
      cp.line(mx, my + 54, mx, my + 78, { color: C.ink2, sw: 3, rough: 0.4, seed: 462 });
      cp.line(mx - 40, my + 80, mx + 40, my + 80, { color: C.ink2, sw: 3.5, rough: 0.5, seed: 463 });
      Sk.text(mic, mx, vy + 128, 'speech', { fs: 40, font: 'hand', color: C.ink2 });
      const a1 = mp.arrow([[vx + 140, vy], [520, vy - 14], [CX - K / 2 - 22, CY]], { curve: true, color: C.ink3, sw: 2.6, hl: 18, seed: 470 });
      const a2 = mp.arrow([[mx - 78, vy], [1400, vy - 14], [CX + K / 2 + 22, CY]], { curve: true, color: C.ink3, sw: 2.6, hl: 18, seed: 471 });
      items.push({ g: vid, seq: 0 }, { g: mic, seq: 0 }, { g: a1, seq: 1 }, { g: a2, seq: 1 });
      this.more = Sk.animator(items, { dur: 520, per: 260 });
      this.line = $('.us-line', this.s);
    },
    /** 0: nothing; 1: key and apps; 2: plus video and speech. */
    set(n) {
      if (n >= 1) this.keyAnim.show(); else this.keyAnim.reset();
      this.apps.forEach((g) => g.classList.toggle('on', n >= 1));
      this.line.classList.toggle('on', n >= 1);
      if (n >= 2) this.more.show(); else this.more.reset();
    },
    clear() { (this.ts || []).forEach(clearTimeout); this.ts = []; this.s.classList.remove('pressed'); },
    step(s, k, { back }) {
      this.build(); this.clear();
      const at = (ms, f) => this.ts.push(setTimeout(f, ms));
      if (back || reduced()) { still(s, () => this.set(k + 1)); return; }
      if (k === 0) {
        still(s, () => this.set(0));
        at(40, () => this.keyAnim.play());
        at(620, () => { s.classList.add('pressed'); sfx('tick'); });
        at(760, () => s.classList.remove('pressed'));
        at(800, () => this.apps.forEach((g) => g.classList.add('on')));
        this.APPS.forEach((_, i) => at(860 + i * 85, () => sfx('pop')));
        at(1500, () => this.line.classList.add('on'));
        return;
      }
      still(s, () => this.set(1));
      at(60, () => { sfx('swoosh', true); this.more.play(); });
    },
    leave() { this.clear(); },
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
