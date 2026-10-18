/* Hand-drawn diagrams and charts in the Excalidraw style: rough.js strokes + Excalifont, drawn on in order.
   A diagram is a plain spec (nodes, edges, texts, zones); sketch(svg, spec) renders it and returns
   { play(), reset() } so a slide can draw it on when it opens. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#ffffff';

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function seedOf(s) {           // stable seed per element, so a redraw looks the same
    let h = 7;
    for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
    return h || 1;
  }

  function text(parent, x, y, str, o = {}) {
    const fs = o.fs || 24, lines = String(str).split('\n'), lh = o.lh || fs * 1.22;
    const t = el('text', {
      x, y: y - ((lines.length - 1) * lh) / 2, 'font-size': fs, 'text-anchor': o.anchor || 'middle',
      'dominant-baseline': 'central', fill: o.color || INK,
    }, parent);
    if (o.sans) t.setAttribute('class', 'sans');
    if (o.weight) t.setAttribute('font-weight', o.weight);
    lines.forEach((ln, k) => {
      const s = el('tspan', { x, dy: k ? lh : 0 }, t);
      s.textContent = ln;
    });
    return t;
  }

  function port(n, p) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    if (Array.isArray(p)) return [n.x + n.w * p[0], n.y + n.h * p[1]];
    return { l: [n.x, cy], r: [n.x + n.w, cy], t: [cx, n.y], b: [cx, n.y + n.h], c: [cx, cy] }[p || 'r'];
  }

  function arrowHead(rc, g, a, b, o) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 16, s = 0.45;
    for (const d of [-s, s]) {
      g.appendChild(rc.line(b[0], b[1], b[0] - L * Math.cos(ang + d), b[1] - L * Math.sin(ang + d),
        { stroke: o.stroke, strokeWidth: o.strokeWidth, roughness: 0.6, seed: o.seed + 3 }));
    }
  }

  /** spec: { nodes:[{id,x,y,w,h,t,shape,color,fs,dash,fill,tcolor}], edges:[{from,to,fp,tp,via,label,lx,ly,dash,color,curve,seq}],
   *          texts:[{x,y,t,fs,color,anchor,seq,sans}], zones:[{x,y,w,h,label}] } */
  function sketch(svg, spec, opts = {}) {
    const rc = rough.svg(svg);
    const byId = {};
    const items = [];
    const R = opts.roughness ?? 1.1;
    (spec.nodes || []).forEach((n, i) => { byId[n.id] = n; n._seq = n.seq ?? i * 2; });

    for (const z of spec.zones || []) {
      const g = el('g', {}, svg);
      g.appendChild(rc.rectangle(z.x, z.y, z.w, z.h, { stroke: z.color || '#6b6b6b', strokeWidth: 1.6, roughness: 1.3, strokeLineDash: [10, 9], seed: seedOf(z.label) }));
      if (z.label) text(g, z.x + 22, z.y + 30, z.label, { fs: z.fs || 24, anchor: 'start', color: z.tcolor || '#9a9a9a' });
      items.push({ g, seq: -1 });
    }

    for (const n of spec.nodes || []) {
      const g = el('g', {}, svg);
      const o = { stroke: n.color || INK, strokeWidth: n.sw || 2.2, roughness: R, bowing: 0.8, seed: seedOf(n.id) };
      if (n.dash) o.strokeLineDash = [9, 8];
      if (n.fill) Object.assign(o, { fill: n.fill, fillStyle: n.fillStyle || 'hachure', hachureGap: 9, fillWeight: 1.4, hachureAngle: -41 });
      const shape = n.shape || 'rect';
      if (shape === 'rect') g.appendChild(rc.rectangle(n.x, n.y, n.w, n.h, o));
      else if (shape === 'diamond') g.appendChild(rc.polygon([[n.x + n.w / 2, n.y], [n.x + n.w, n.y + n.h / 2], [n.x + n.w / 2, n.y + n.h], [n.x, n.y + n.h / 2]], o));
      else if (shape === 'ellipse') g.appendChild(rc.ellipse(n.x + n.w / 2, n.y + n.h / 2, n.w, n.h, o));
      if (n.t) text(g, n.x + n.w / 2, n.y + n.h / 2, n.t, { fs: n.fs || 24, color: n.tcolor || INK, sans: n.sans });
      items.push({ g, seq: n._seq });
    }

    for (const e of spec.edges || []) {
      const A = byId[e.from], B = byId[e.to];
      const a = e.a || port(A, e.fp || 'r'), b = e.b || port(B, e.tp || 'l');
      const pts = [a, ...(e.via || []), b];
      const g = el('g', {}, svg);
      const o = { stroke: e.color || INK, strokeWidth: e.sw || 2, roughness: 0.9, bowing: 0.6, seed: seedOf(e.from + e.to + (e.label || '')) };
      if (e.dash) o.strokeLineDash = [9, 8];
      g.appendChild(e.curve ? rc.curve(pts, o) : rc.linearPath(pts, o));
      if (e.head !== false) arrowHead(rc, g, pts[pts.length - 2], b, o);
      if (e.label) {
        const mid = e.lx != null ? [e.lx, e.ly] : [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2 - 20];
        text(g, mid[0], mid[1], e.label, { fs: e.fs || 21, color: e.tcolor || '#cfcfcf', anchor: e.anchor });
      }
      const sa = A ? A._seq : 0, sb = B ? B._seq : 0;
      items.push({ g, seq: e.seq ?? (sb > sa ? sb - 1 : Math.max(sa, sb) + 1) });
    }

    for (const t of spec.texts || []) {
      const g = el('g', {}, svg);
      text(g, t.x, t.y, t.t, t);
      items.push({ g, seq: t.seq ?? 0 });
    }

    items.sort((p, q) => p.seq - q.seq);
    return animator(items, opts);
  }

  /** Draw-on animation: every stroked path is dashed to its own length and swept in; text fades in. */
  function animator(items, opts = {}) {
    const per = opts.per ?? 150;          // ms between consecutive items
    const dur = opts.dur ?? 520;          // ms to draw one item
    let timers = [];
    function prep() {
      for (const it of items) {
        it.g.style.opacity = '0';
        for (const p of it.g.querySelectorAll('path')) {
          const L = p.getTotalLength();
          p.style.transition = 'none';
          p.style.strokeDasharray = `${L} ${L}`;
          p.style.strokeDashoffset = `${L}`;
        }
        for (const t of it.g.querySelectorAll('text')) { t.style.transition = 'none'; t.style.opacity = '0'; }
      }
    }
    function reset() { timers.forEach(clearTimeout); timers = []; prep(); }
    function show() {                      // final state, no animation (reduced motion, or going back)
      timers.forEach(clearTimeout); timers = [];
      for (const it of items) {
        it.g.style.opacity = '1';
        for (const p of it.g.querySelectorAll('path')) { p.style.transition = 'none'; p.style.strokeDashoffset = '0'; }
        for (const t of it.g.querySelectorAll('text')) { t.style.transition = 'none'; t.style.opacity = '1'; }
      }
    }
    function play() {
      reset();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return show();
      const seqs = [...new Set(items.map((i) => i.seq))].sort((a, b) => a - b);
      items.forEach((it) => {
        const k = seqs.indexOf(it.seq);
        timers.push(setTimeout(() => {
          it.g.style.opacity = '1';
          for (const p of it.g.querySelectorAll('path')) {
            p.getBoundingClientRect();
            p.style.transition = `stroke-dashoffset ${dur}ms ease-out`;
            p.style.strokeDashoffset = '0';
          }
          for (const t of it.g.querySelectorAll('text')) { t.style.transition = `opacity ${dur}ms ease`; t.style.opacity = '1'; }
        }, (opts.delay || 0) + k * per));
      });
    }
    prep();
    return { play, reset, show, items };
  }

  // ------------------------------------------------------------------ charts (rough bars, exact numbers)
  /** Horizontal bars. o: { x, y, w, rowH, max, bars:[{label, value, text, color}], labelW } */
  function hbars(svg, o) {
    const rc = rough.svg(svg), items = [];
    const lw = o.labelW ?? 300, bw = o.w - lw - 110;
    o.bars.forEach((b, i) => {
      const g = el('g', {}, svg), y = o.y + i * o.rowH, h = o.rowH * 0.56;
      text(g, o.x + lw - 18, y + h / 2, b.label, { fs: o.fs || 23, anchor: 'end', color: b.lcolor || '#d9d9d9', sans: true });
      const w = Math.max(6, (b.value / o.max) * bw);
      g.appendChild(rc.rectangle(o.x + lw, y, w, h, { stroke: b.color || INK, strokeWidth: 2, roughness: 1, fill: b.color || INK, fillStyle: 'hachure', hachureGap: 8, fillWeight: 1.5, seed: seedOf(b.label) }));
      text(g, o.x + lw + w + 16, y + h / 2, b.text ?? String(b.value), { fs: o.vfs || 30, anchor: 'start', color: b.color || INK, sans: true, weight: 600 });
      items.push({ g, seq: i });
    });
    if (o.title) { const g = el('g', {}, svg); text(g, o.x, o.y - 40, o.title, { fs: o.tfs || 25, anchor: 'start', color: '#a3a3a3', sans: true }); items.push({ g, seq: -1 }); }
    return items;
  }

  /** Vertical bars. o: { x, y, w, h, max, bars:[{label, value, text, color}] } */
  function vbars(svg, o) {
    const rc = rough.svg(svg), items = [], n = o.bars.length, slot = o.w / n, bw = slot * (o.fillRatio || 0.52);
    const base = o.y + o.h;
    const ag = el('g', {}, svg);
    ag.appendChild(rc.line(o.x - 10, base, o.x + o.w + 10, base, { stroke: '#8a8a8a', strokeWidth: 1.6, roughness: 0.8, seed: 11 }));
    items.push({ g: ag, seq: -1 });
    o.bars.forEach((b, i) => {
      const g = el('g', {}, svg), h = Math.max(4, (b.value / o.max) * o.h), x = o.x + i * slot + (slot - bw) / 2;
      g.appendChild(rc.rectangle(x, base - h, bw, h, { stroke: b.color || INK, strokeWidth: 2, roughness: 1, fill: b.color || INK, fillStyle: 'hachure', hachureGap: 8, fillWeight: 1.5, seed: seedOf(b.label + i) }));
      text(g, x + bw / 2, base - h - 26, b.text ?? String(b.value), { fs: o.vfs || 32, color: b.color || INK, sans: true, weight: 600 });
      text(g, x + bw / 2, base + 22 + (o.lfs || 20) * 0.6 * (String(b.label).split('\n').length - 1), b.label, { fs: o.lfs || 20, color: '#bdbdbd', sans: true, lh: (o.lfs || 20) * 1.25 });
      items.push({ g, seq: i });
    });
    if (o.title) { const g = el('g', {}, svg); text(g, o.x - 10, o.y - 46, o.title, { fs: o.tfs || 25, anchor: 'start', color: '#a3a3a3', sans: true }); items.push({ g, seq: -2 }); }
    return items;
  }

  window.Sketch = { sketch, animator, hbars, vbars, text, el, seedOf, NS };
})();
