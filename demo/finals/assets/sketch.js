/* Hand-drawn figures in the Excalidraw manner: rough.js strokes, Excalifont labels, the app's palette.
   Every drawing call takes a parent <g>; P(parent) returns a pen bound to it, so a region's code reads like
   "pen.block(x, y, w, h, 'MLP', C.ffn)". Items collected in a list can be drawn on in order by animator(). */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const C = {
    canvas: '#171716', sheet: '#201f1e', panel: '#2a2927', line: '#3a3836',
    ink: '#f3f2ee', ink2: '#a8a49c', ink3: '#75716a',
    cut: '#ff6961', made: '#4cc89b', check: '#f0a73a', model: '#7088ff',
    attn: '#7088ff', ffn: '#a48bff', conv: '#f0a24a', norm: '#8f8a82', out: '#4cc2aa', extra: '#f27aa0',
  };

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function seedOf(s) {                      // stable seed per element, so a redraw looks the same
    let h = 7;
    for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
    return h || 1;
  }
  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

  /** Text: multi-line, centred by default. o: fs, color, anchor, font ('hand' | 'sans' | 'serif' | 'math'), weight, lh, italic */
  function text(parent, x, y, str, o = {}) {
    const fs = o.fs || 22, lines = String(str).split('\n'), lh = o.lh || fs * 1.22;
    const t = el('text', {
      x, y: y - ((lines.length - 1) * lh) / 2, 'font-size': fs, 'text-anchor': o.anchor || 'middle',
      'dominant-baseline': 'central', fill: o.color || C.ink, class: o.font || 'hand',
      'font-weight': o.weight, 'font-style': o.italic ? 'italic' : null, opacity: o.opacity,
    }, parent);
    lines.forEach((ln, k) => { const s = el('tspan', { x, dy: k ? lh : 0 }, t); s.textContent = ln; });
    return t;
  }

  const roundRect = (x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  };

  /** A pen draws into one parent group. Shapes get a stable seed from their geometry. */
  function P(parent) {
    const rc = rough.svg(parent.ownerSVGElement || parent);
    const add = (node) => { parent.appendChild(node); return node; };
    const base = (o, key) => ({
      stroke: o.stroke ?? o.color ?? C.ink, strokeWidth: o.sw ?? 2, roughness: o.rough ?? 1, bowing: o.bow ?? 0.8,
      seed: o.seed ?? seedOf(key), strokeLineDash: o.dash, disableMultiStroke: o.single,
      ...(o.fill ? { fill: o.fill, fillStyle: o.fillStyle || 'solid', hachureGap: o.gap || 8, fillWeight: o.fw || 1.2, hachureAngle: o.angle ?? -41 } : {}),
    });
    const pen = {
      g: parent, rc,
      group(attrs) { return el('g', attrs || {}, parent); },
      rect(x, y, w, h, o = {}) { return add(o.r === 0 ? rc.rectangle(x, y, w, h, base(o, `r${x},${y},${w},${h}`)) : rc.path(roundRect(x, y, w, h, o.r ?? 10), base(o, `r${x},${y},${w},${h}`))); },
      line(x1, y1, x2, y2, o = {}) { return add(rc.line(x1, y1, x2, y2, base({ rough: 0.8, ...o }, `l${x1},${y1},${x2},${y2}`))); },
      path(d, o = {}) { return add(rc.path(d, base(o, d.slice(0, 40)))); },
      poly(pts, o = {}) { const op = base({ rough: 0.8, ...o }, `p${pts.flat().join(',').slice(0, 40)}`); return add(o.closed ? rc.polygon(pts, op) : rc.linearPath(pts, op)); },
      curve(pts, o = {}) { return add(rc.curve(pts, base({ rough: 0.7, ...o }, `c${pts.flat().join(',').slice(0, 40)}`))); },
      circle(cx, cy, d, o = {}) { return add(rc.circle(cx, cy, d, base(o, `o${cx},${cy},${d}`))); },
      ellipse(cx, cy, w, h, o = {}) { return add(rc.ellipse(cx, cy, w, h, base(o, `e${cx},${cy},${w},${h}`))); },
      text(x, y, s, o) { return text(parent, x, y, s, o); },
      /** Arrow along points; o.head=false for none, o.both for two heads, o.curve for a smooth path. */
      arrow(pts, o = {}) {
        const op = base({ rough: 0.7, sw: 2, ...o }, `a${pts.flat().join(',').slice(0, 40)}`);
        const g = el('g', {}, parent);
        g.appendChild(o.curve ? rc.curve(pts, op) : rc.linearPath(pts, op));
        const head = (a, b) => {
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = o.hl ?? 13, s = 0.42;
          for (const d of [-s, s]) g.appendChild(rc.line(b[0], b[1], b[0] - L * Math.cos(ang + d), b[1] - L * Math.sin(ang + d), { ...op, strokeLineDash: undefined, seed: op.seed + 3 }));
        };
        if (o.head !== false) head(pts[pts.length - 2], pts[pts.length - 1]);
        if (o.both) head(pts[1], pts[0]);
        return g;
      },
      /** A labelled block: soft fill in its colour, ink-coloured label. */
      block(x, y, w, h, label, color = C.ink2, o = {}) {
        const g = el('g', {}, parent), p = P(g);
        p.rect(x, y, w, h, { color, fill: alpha(color, o.fa ?? 0.16), sw: o.sw ?? 2, r: o.r ?? 9, dash: o.dash, rough: o.rough, seed: o.seed });
        if (label != null) text(g, x + w / 2 + (o.dx || 0), y + h / 2 + (o.dy || 0), label, { fs: o.fs || 21, color: o.tcolor || C.ink, font: o.font || 'hand', weight: o.weight, lh: o.lh });
        return g;
      },
      /** A stack of n identical blocks drawn as a short deck of cards, with "×n" beside it. */
      stack(x, y, w, h, label, color, n, o = {}) {
        const g = el('g', {}, parent), p = P(g), k = o.cards ?? 3, d = o.off ?? 9;
        for (let i = k - 1; i > 0; i--) p.rect(x + i * d, y - i * d, w, h, { color: alpha(color, 0.55), fill: alpha(C.sheet, 0.95), sw: 1.6, r: 9, rough: 0.9 });
        p.block(x, y, w, h, label, color, o);
        if (n) text(g, x + w + (k - 1) * d + (o.nx ?? 18), y + h / 2 - (k - 1) * d / 2, `× ${n}`, { fs: o.nfs || 26, anchor: 'start', color: o.ncolor || color, font: 'sans', weight: 600 });
        return g;
      },
      /** A row of square tokens (labels optional). Returns the centres. */
      tokens(x, y, n, size, o = {}) {
        const g = el('g', {}, parent), p = P(g), gap = o.gap ?? 6, cs = [];
        for (let i = 0; i < n; i++) {
          const cx = x + i * (size + gap), col = typeof o.color === 'function' ? o.color(i) : (o.color || C.ink2);
          p.rect(cx, y, size, o.h || size, { color: col, fill: alpha(col, o.fa ?? 0.18), sw: 1.6, r: o.r ?? 5, rough: 0.8 });
          const lab = o.labels?.[i];
          if (lab != null) text(g, cx + size / 2, y + (o.h || size) / 2, lab, { fs: o.fs || 17, color: o.tcolor || C.ink, font: o.font || 'hand' });
          cs.push([cx + size / 2, y + (o.h || size) / 2]);
        }
        return cs;
      },
      /** Plus-in-a-circle (residual add), multiply-in-a-circle (gate). */
      op(cx, cy, sym = '+', o = {}) {
        const g = el('g', {}, parent);
        P(g).circle(cx, cy, o.d || 28, { color: o.color || C.ink2, sw: 1.8, rough: 0.6 });
        text(g, cx, cy + 1, sym, { fs: o.fs || 22, color: o.color || C.ink2, font: 'sans' });
        return g;
      },
      /** A waveform as a thin polyline through samples ys (−1..1) inside w × h. */
      wave(x, y, w, h, ys, o = {}) {
        const n = ys.length, mx = o.max || Math.max(1e-6, ...ys.map(Math.abs));
        const d = ys.map((v, i) => `${i ? 'L' : 'M'}${(x + i / (n - 1) * w).toFixed(1)} ${(y + h / 2 - v / mx * h / 2).toFixed(1)}`).join('');
        return el('path', { d, fill: 'none', stroke: o.color || C.ink2, 'stroke-width': o.sw || 1.6, 'stroke-linejoin': 'round', opacity: o.opacity }, parent);
      },
    };
    return pen;
  }

  /** Draw-on animation for a list of { g, seq }: strokes sweep in, text and fills fade in, ordered by seq. */
  function animator(items, opts = {}) {
    const per = opts.per ?? 150, dur = opts.dur ?? 520;
    let timers = [];
    const paths = (g) => [...g.querySelectorAll('path')];
    function prep() {
      for (const it of items) {
        it.g.style.transition = 'none'; it.g.style.opacity = '0';   // hide at once: a fade left over from play() would flash the old drawing
        for (const p of paths(it.g)) {
          // fills and dashed strokes fade in; a draw-on dash would overwrite their own dash pattern
          if (p.getAttribute('stroke-dasharray') || p.getAttribute('stroke') === 'none' || (!p.getAttribute('stroke') && p.getAttribute('fill') && p.getAttribute('fill') !== 'none')) { p.style.transition = 'none'; p.style.opacity = '0'; continue; }
          const L = p.getTotalLength(); p.style.transition = 'none'; p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = `${L}`;
        }
      }
    }
    function reset() { timers.forEach(clearTimeout); timers = []; prep(); }
    function show() {
      timers.forEach(clearTimeout); timers = [];
      for (const it of items) {
        it.g.style.transition = 'none'; it.g.style.opacity = '1';
        for (const p of paths(it.g)) { p.style.transition = 'none'; p.style.strokeDashoffset = '0'; p.style.opacity = ''; }
      }
    }
    function play() {
      reset();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return show();
      const seqs = [...new Set(items.map((i) => i.seq))].sort((a, b) => a - b);
      items.forEach((it) => {
        timers.push(setTimeout(() => {
          it.g.style.transition = `opacity ${Math.min(dur, 300)}ms ease`; it.g.style.opacity = '1';
          for (const p of paths(it.g)) {
            p.getBoundingClientRect();
            if (p.style.opacity === '0') { p.style.transition = `opacity ${dur}ms ease ${dur * 0.4}ms`; p.style.opacity = ''; continue; }
            p.style.transition = `stroke-dashoffset ${dur}ms ease-out`; p.style.strokeDashoffset = '0';
          }
        }, (opts.delay || 0) + seqs.indexOf(it.seq) * per));
      });
    }
    prep();
    return { play, reset, show, items };
  }

  // ------------------------------------------------------------------ bar charts with exact numbers
  /** Horizontal bars. o: { x, y, w, rowH, max, labelW, bars:[{label, value, text, color}] } */
  function hbars(parent, o) {
    const items = [], lw = o.labelW ?? 300, bw = o.w - lw - 110;
    o.bars.forEach((b, i) => {
      const g = el('g', {}, parent), p = P(g), y = o.y + i * o.rowH, h = o.rowH * 0.56;
      text(g, o.x + lw - 18, y + h / 2, b.label, { fs: o.fs || 22, anchor: 'end', color: b.lcolor || C.ink2, font: 'sans' });
      const w = Math.max(6, (b.value / o.max) * bw);
      p.rect(o.x + lw, y, w, h, { color: b.color || C.ink, fill: alpha(b.color || C.ink, 0.5), fillStyle: 'hachure', gap: 7, r: 0, seed: seedOf(b.label) });
      text(g, o.x + lw + w + 16, y + h / 2, b.text ?? String(b.value), { fs: o.vfs || 28, anchor: 'start', color: b.color || C.ink, font: 'sans', weight: 600 });
      items.push({ g, seq: i });
    });
    return items;
  }

  window.Sketch = { C, NS, el, text, P, animator, hbars, seedOf, alpha, roundRect };
})();
