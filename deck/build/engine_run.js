// Runs media/messy.wav through the current engine with the app's own client, the way the app
// does when a message is sent: upload -> clean -> render. Then replaces "cafe" with "park"
// (the editor clip) and renders that too. Writes into build/engine_out/; copy to media/ after a look.
// Usage: node engine_run.js [backend]
const path = require('path');
const fs = require('fs');
const ROOT = 'C:/Users/Antony/Desktop/ctrl+voice';
const { Engine } = require(path.join(ROOT, 'src/main/engine.js'));
const Edits = require(path.join(ROOT, 'src/shared/edits.js'));
const BASE = process.argv[2] || 'https://xjdypx6zst9jkd-7860.proxy.runpod.net';
const MEDIA = path.join(__dirname, '..', 'media');
const OUT = path.join(__dirname, 'engine_out');
const e = new Engine(() => BASE);
const timed = async (label, fn) => {
  const t = Date.now();
  const r = await fn();
  console.log(`${label}: ${Date.now() - t} ms`);
  return { r, ms: Date.now() - t };
};
(async () => {
  console.log('health', JSON.stringify(await e.health()));
  const orig = fs.readFileSync(path.join(MEDIA, 'messy.wav'));
  const { r: up } = await timed('upload', () => e.upload(orig, 'message.wav'));
  const sid = up.sid;
  console.log('words', up.words.map((w, k) => `${k}:${w.w}`).join(' '));
  const ops = Edits.fromRemoved(up.removed);
  const { r: cl, ms: cleanMs } = await timed('clean', () => e.clean(sid));
  ops.push(...Edits.fromCuts(cl.items, ops));
  console.log('clean', cl.items.map(c => `${c.kind}[${c.i}-${c.j}] ${c.text} auto=${c.auto}`).join(' | '));
  console.log('kept', Edits.keptText(up.words, ops));
  const { r: rn } = await timed('render', () => e.render(sid, Edits.forRender(ops)));
  fs.writeFileSync(path.join(OUT, 'fixed.wav'), await e.download(rn.url));
  fs.writeFileSync(path.join(OUT, 'sample.json'), JSON.stringify({ sid, backend: BASE, at: new Date().toISOString(), clean_ms: cleanMs,
    words: up.words, removed: up.removed, dur: up.dur, clean: cl.items, render: rn, ops }, null, 2));
  const k = up.words.findIndex(w => /^caf/i.test(w.w));
  if (k >= 0) {
    const { r: rp, ms } = await timed(`replace "${up.words[k].w}" -> park`, () => e.replace(sid, { i: k, j: k, new: 'park' }));
    console.log('replace', JSON.stringify({ op: rp.op, sec: rp.sec, cands: (rp.cands || []).map(c => ({ e: c.engine, ok: c.ok, sim: c.sim, heard: c.heard })) }));
    const ops2 = [...ops, Edits.fromOp(rp.op, rp.op.verified)];
    const { r: rn2 } = await timed('render with replacement', () => e.render(sid, Edits.forRender(ops2)));
    fs.writeFileSync(path.join(OUT, 'replace.wav'), await e.download(rn2.url));
    fs.writeFileSync(path.join(OUT, 'replace.json'), JSON.stringify({ ...rp, wall_ms: ms, render: rn2 }, null, 1));
  }
  console.log('done', OUT);
})().catch(err => { console.error('FAILED', err.status || '', err.message); process.exit(1); });
