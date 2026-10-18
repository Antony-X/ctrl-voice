// Replicates Ctrl+Voice autoFix (src/main/main.js) against the live engine, then the Your sound tone (confident Strong).
// Usage: node run.js <in.wav> <tag> [screen]
//   screen: only the parallel checks + replace every intent item (no render/tone), to see which words are caught.
const fs = require('fs'), path = require('path');
const APP = String.raw`C:\Users\Antony\Desktop\ctrl+voice`;
const { Engine } = require(path.join(APP, 'src/main/engine.js'));
const Edits = require(path.join(APP, 'src/shared/edits.js'));
const BASE = 'https://xjdypx6zst9jkd-7860.proxy.runpod.net';
const e = new Engine(() => BASE);
const MAX_AUTO_REPLACE = 3;
const [inp, tag, mode] = process.argv.slice(2);
const OUT = path.join(__dirname, 'out');
const T = () => Date.now();

(async () => {
  const R = { tag, input: inp, timing: {} };
  const t0 = T();
  const up = await e.upload(fs.readFileSync(inp), path.basename(inp));
  R.timing.upload = T() - t0;
  const meta = { sid: up.sid, words: up.words.map(({ w, s, e, p }) => ({ w, s, e, p })), dur: up.dur, ops: [] };
  R.sid = up.sid; R.words = meta.words; R.dur = up.dur;
  R.transcript = meta.words.map(w => w.w).join(' ');
  console.log(`[${tag}] heard: ${R.transcript}`);
  const t1 = T();
  const [cleaned, gram, meant, pr] = await Promise.all([e.clean(meta.sid), e.grammar(meta.sid), e.intent(meta.sid), e.pron(meta.sid)]);
  R.timing.checks = T() - t1;
  R.clean = cleaned.items; R.grammar = gram.items; R.intent = meant.items; R.pron = { items: pr.items, median: pr.median, accent: pr.accent };
  console.log(`  cuts: ${cleaned.items.map(c => `${c.kind}${c.auto === false ? '(suggest)' : ''}:"${c.text}"`).join(' | ')}`);
  console.log(`  grammar: ${gram.items.map(g => `${g.old}->${g.new}`).join(' | ')}`);
  console.log(`  intent: ${meant.items.map(m => `${m.old}->${m.new} (fit ${m.fit}, dist ${m.dist})`).join(' | ')}`);
  console.log(`  pron: ${pr.items.map(p => `${p.word}(${p.acc})`).join(' | ')}  median ${pr.median}`);
  R.replaced = [];
  const wordsCut = (i, j) => meta.words.slice(i, j + 1).some(w => Edits.cutFor(w, meta.ops));
  const free = (i, j) => !wordsCut(i, j) && !meta.ops.some(o => o.on && !Edits.isCut(o) && o.i <= j && i <= o.j);
  const rep = async (body, kind, item) => {
    const t = T(); const r = await e.replace(meta.sid, body);
    const rec = { kind, old: r.op.old, new: r.op.new, verified: r.op.verified, engine: r.op.engine, after: r.op.after, ms: T() - t, t0: r.op.t0, t1: r.op.t1,
      cands: (r.cands || []).map(c => ({ engine: c.engine, ok: c.ok, sim: c.sim, heard: c.heard, err: c.err })) };
    R.replaced.push(rec);
    console.log(`  replace[${kind}] "${rec.old}" -> "${rec.new}" verified=${rec.verified} engine=${rec.engine} ${rec.ms}ms`);
    return r;
  };
  if (mode === 'screen') {
    for (const m of meant.items) await rep({ i: m.i, j: m.j, new: m.new, kind: 'misspoken' }, 'misspoken', m);
    fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(R, null, 1));
    return;
  }
  const tFix = T();
  meta.ops.push(...Edits.fromCuts(cleaned.items, meta.ops));
  for (const g of gram.items.filter(g => free(g.i, g.j)).slice(0, MAX_AUTO_REPLACE)) {
    const r = await rep({ i: g.i, j: g.j, new: g.new, kind: 'grammar' }, 'grammar'); meta.ops.push(Edits.fromOp(r.op, r.op.verified));
  }
  for (const m of meant.items.filter(m => free(m.i, m.j)).slice(0, MAX_AUTO_REPLACE)) {
    const r = await rep({ i: m.i, j: m.j, new: m.new, kind: 'misspoken' }, 'misspoken'); meta.ops.push(Edits.fromOp(r.op, r.op.verified));
  }
  for (const p of pr.items.filter(p => free(p.i, p.i)).slice(0, MAX_AUTO_REPLACE)) {
    const r = await rep({ i: p.i, j: p.i, same: true }, 'pronunciation');
    const better = r.op.verified && (r.op.after == null || r.op.after > p.acc);
    meta.ops.push(Edits.fromOp(r.op, better));
  }
  R.timing.replacements = T() - tFix;
  const tR = T();
  const ops = Edits.forRender(meta.ops);
  const rr = await e.render(meta.sid, ops);
  fs.writeFileSync(path.join(OUT, `${tag}_after.wav`), await e.download(rr.url));
  R.timing.render = T() - tR;
  R.render = { dur: rr.dur, ai: rr.ai, file: rr.url.split('/').pop() };
  R.ops = meta.ops; R.renderOps = ops.map(o => ({ t0: o.t0, t1: o.t1, insert: o.insert || null }));
  R.finalText = Edits.keptText(meta.words, meta.ops);
  R.timing.autofix_total = T() - t1; // checks + replacements + render (what runs after the recording is uploaded)
  console.log(`  final text: ${R.finalText}`);
  const tN = T();
  const nr = await e.natural(meta.sid, { style: 'confident', mix: { confident: 1.5 }, file: R.render.file });
  fs.writeFileSync(path.join(OUT, `${tag}_confident.wav`), await e.download(nr.url));
  R.timing.tone = T() - tN; R.natural = { dur: nr.dur, sec: nr.sec };
  R.timing.end_to_end = T() - t1;
  console.log(`  timing ms: ${JSON.stringify(R.timing)}  render dur ${rr.dur}s confident dur ${nr.dur}s`);
  fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(R, null, 1));
})().catch(err => { console.error('FAILED', err.message, err.status); process.exit(1); });
