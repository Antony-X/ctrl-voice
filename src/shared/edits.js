// Edit list shared by the main process and the editor.
// The original recording is never changed: a message is its audio plus a list
// of time-range ops (cut, or replace with an engine-made insert), rendered by
// the ReSpeak engine when the message is played or sent.
//
// op = { id, type: 'cut'|'replace', t0, t1, i?, j?, kind, text?, old?, new?,
//        insert?, engine?, verified?, on, auto? }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Edits = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  let seq = 0;
  const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

  const overlaps = (a, b) => a.t0 < b.t1 && b.t0 < a.t1;
  const contains = (outer, inner) => outer.t0 <= inner.t0 + 0.02 && inner.t1 <= outer.t1 + 0.02;

  // Ranges removed while recording ("undo" key, spoken "scratch that").
  const fromRemoved = (removed = []) => removed.map(r => ({
    id: uid(), type: 'cut', t0: r.t0, t1: r.t1, kind: r.kind, text: r.text, on: true,
  }));

  // /clean and /tighten items. Items already covered by an existing cut are skipped.
  function fromCuts(items = [], existing = []) {
    const out = [];
    for (const c of items) {
      if (existing.some(o => o.type === 'cut' && contains(o, c))) continue;
      out.push({ id: uid(), type: 'cut', t0: c.t0, t1: c.t1, i: c.i, j: c.j, kind: c.kind, text: c.text, on: c.auto !== false, auto: c.auto !== false });
    }
    return out;
  }

  // An op returned by /replace, /natural or /tone on a selection.
  const fromOp = (op, on = true) => ({ id: uid(), type: 'replace', ...op, on });

  const isCut = (op) => op.type === 'cut';

  // The on-cut a word falls in (by its midpoint, like the engine does), or null.
  function cutFor(word, ops) {
    const m = (word.s + word.e) / 2;
    return ops.find(o => o.on && isCut(o) && o.t0 <= m && m <= o.t1) || null;
  }

  // The on-replacement covering word k, or null.
  const replaceFor = (k, ops) => ops.find(o => o.on && !isCut(o) && o.i <= k && k <= o.j) || null;

  // A cut the engine suggested but didn't apply (from /tighten), not yet taken.
  function suggestionFor(word, ops) {
    const m = (word.s + word.e) / 2;
    return ops.find(o => !o.on && isCut(o) && o.auto === false && o.t0 <= m && m <= o.t1) || null;
  }

  // A cut over words i..j, halfway into the pauses on either side (as the engine cuts).
  function cutRange(words, i, j, dur) {
    const t0 = i > 0 ? (words[i - 1].e + words[i].s) / 2 : Math.max(0, words[i].s - 0.04);
    const t1 = j + 1 < words.length ? (words[j].e + words[j + 1].s) / 2 : Math.min(dur, words[j].e + 0.04);
    return { id: uid(), type: 'cut', t0, t1, i, j, kind: 'cut', text: words.slice(i, j + 1).map(w => w.w).join(' '), on: true };
  }

  // The words an op covers, as {i, j}; cuts are matched by word midpoints.
  function rangeOf(op, words) {
    if (!isCut(op)) return { i: op.i, j: op.j };
    let i = -1, j = -1;
    words.forEach((w, k) => {
      const m = (w.s + w.e) / 2;
      if (op.t0 <= m && m <= op.t1) { if (i < 0) i = k; j = k; }
    });
    return i < 0 ? null : { i, j };
  }

  // What the engine's /render takes. A replacement inside a cut is dropped,
  // and of two overlapping replacements the newer one wins.
  function forRender(ops) {
    const on = ops.filter(o => o.on);
    const cuts = on.filter(isCut);
    const reps = [];
    for (const r of on.filter(o => !isCut(o)).reverse()) {
      if (cuts.some(c => contains(c, r))) continue;
      if (reps.some(o => overlaps(o, r))) continue;
      reps.push(r);
    }
    return [...cuts.map(o => ({ t0: o.t0, t1: o.t1, insert: null })), ...reps.map(o => ({ t0: o.t0, t1: o.t1, insert: o.insert }))];
  }

  // Words of the finished message, as a plain string.
  function keptText(words, ops) {
    const parts = [];
    words.forEach((w, k) => {
      if (cutFor(w, ops)) return;
      const r = replaceFor(k, ops);
      if (!r) parts.push(w.w);
      else if (k === r.i) parts.push(r.new);
    });
    return parts.join(' ');
  }

  const KIND = {
    undo: 'Undone', command: 'Scratched', cut: 'Cut', filler: 'Filler', correction: 'Self-correction', restart: 'Restart',
    repetition: 'Repeat', tighten: 'Shortened', replace: 'Replaced', grammar: 'Grammar', pronunciation: 'Pronunciation',
  };
  function label(op) {
    if (KIND[op.kind]) return KIND[op.kind];
    if (isCut(op)) return 'Cut';
    if (/^natural /.test(op.kind)) return `Tone: ${op.kind.slice(8)}`;
    return op.kind ? `Tone: ${op.kind}` : 'Edit';
  }

  return { uid, overlaps, fromRemoved, fromCuts, fromOp, cutFor, replaceFor, suggestionFor, cutRange, rangeOf, forRender, keptText, label, isCut };
});
