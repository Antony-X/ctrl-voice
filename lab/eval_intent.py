# speechocean762 (real L2 learners, known intended text): does "fix what you meant" make the message more intelligible to a recognizer?
import io, json, os, re, sys, requests, jiwer, soundfile as sf, pyarrow.parquet as pq
B = "http://localhost:7860"; OUT = "/workspace/out/intent"; os.makedirs(OUT, exist_ok=True)
n = lambda s: " ".join(re.sub(r"[^a-z' ]", " ", s.lower()).split())
rows = [r for r in pq.read_table("/workspace/data/so762_test.parquet").to_pylist() if r["age"] >= 16 and len(r["words"]) >= 5]
rows = [r for r in rows if 5 <= r["accuracy"] <= 7][:int(sys.argv[1]) if len(sys.argv) > 1 else 40]
res = []
for k, r in enumerate(rows):
    x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); p = f"{OUT}/u{k}__orig.wav"; sf.write(p, x, sr)
    u = requests.post(f"{B}/api/upload", files={"f": open(p, "rb")}).json(); sid = u["sid"]; asr0 = " ".join(w["w"] for w in u["words"])
    it = requests.post(f"{B}/api/s/{sid}/intent").json()["items"]; ops = []
    for c in it:
        o = requests.post(f"{B}/api/s/{sid}/replace", json=dict(i=c["i"], j=c["j"], new=c["new"])).json()
        if "op" in o: ops.append(dict(t0=o["op"]["t0"], t1=o["op"]["t1"], insert=o["op"]["insert"]))
    if ops:
        y = requests.post(f"{B}/api/s/{sid}/render", json=dict(ops=ops)).json(); q = f"{OUT}/u{k}__fixed.wav"
        open(q, "wb").write(requests.get(B + y["url"]).content)
        asr1 = " ".join(w["w"] for w in requests.post(f"{B}/api/upload", files={"f": open(q, "rb")}).json()["words"])
    else: asr1 = asr0
    w0, w1 = jiwer.wer(n(r["text"]), n(asr0)), jiwer.wer(n(r["text"]), n(asr1))
    res.append(dict(k=k, truth=r["text"].lower(), asr0=asr0, asr1=asr1, wer0=w0, wer1=w1, fixes=[(c["old"], c["new"], c["dist"]) for c in it], expert=r["accuracy"]))
    print(f"u{k} expert={r['accuracy']} WER {w0:.2f}->{w1:.2f} | truth: {r['text'].lower()} | heard: {asr0} | fixes: {[(c['old'], c['new']) for c in it]}", flush=True)
json.dump(res, open(f"{OUT}/results.json", "w"), indent=1)
W0 = sum(x["wer0"] for x in res) / len(res); W1 = sum(x["wer1"] for x in res) / len(res)
clean = [x for x in res if x["wer0"] == 0]; touched = [x for x in res if x["fixes"]]
print(f"\nutts {len(res)} | mean WER vs intended text: original {W0:.3f} -> after ReSpeak {W1:.3f} | improved {sum(x['wer1']<x['wer0'] for x in res)} worse {sum(x['wer1']>x['wer0'] for x in res)}")
print(f"utts already recognized perfectly: {len(clean)}, of which wrongly edited: {sum(1 for x in clean if x['fixes'])}")
