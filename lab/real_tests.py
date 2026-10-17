# Real human voices through the app API: (A) pronunciation detect+fix on speechocean762, (B) grammar fix on EdAcc L2 conversation.
import io, json, os, sys, time, re, random, requests, numpy as np, soundfile as sf, pyarrow.parquet as pq
sys.path.insert(0, "/workspace/app"); from brain import grammar
B = "http://localhost:7860"; OUT = "/workspace/out/real"; os.makedirs(OUT, exist_ok=True); random.seed(0); R = {"pron": [], "gram": []}
def up(x, sr, name):
    p = f"{OUT}/{name}.wav"; sf.write(p, x, sr); return requests.post(f"{B}/api/upload", files={"f": open(p, "rb")}).json()
def fetch(sid, url, name): open(f"{OUT}/{name}.wav", "wb").write(requests.get(B + url).content)
mode = sys.argv[1]
if mode in ("pron", "all"):
    rows = [r for r in pq.read_table("/workspace/data/so762_test.parquet").to_pylist() if r["age"] >= 16 and any(w["accuracy"] <= 4 for w in r["words"]) and len(r["words"]) >= 5]
    for r in rows[:12]:
        x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); name = f"so_{r['speaker']}_{len(R['pron'])}"
        u = up(x, sr, name + "__orig"); sid = u["sid"]; W = u["words"]
        pr = requests.post(f"{B}/api/s/{sid}/pron").json(); bad = {w["text"].lower(): w["accuracy"] for w in r["words"]}
        hits = [(it["word"], it["acc"], bad.get(re.sub(r"[^a-z']", "", it["word"].lower()))) for it in pr["items"]]
        rec = dict(name=name, text=r["text"], asr=" ".join(w["w"] for w in W), expert_bad=[w["text"] for w in r["words"] if w["accuracy"] <= 4], flagged=hits, fixes=[])
        for it in pr["items"][:2]:
            t = time.time(); o = requests.post(f"{B}/api/s/{sid}/replace", json=dict(i=it["i"], j=it["i"], same=True)).json()
            if "op" not in o: rec["fixes"].append(dict(word=it["word"], err=str(o)[:200])); continue
            y = requests.post(f"{B}/api/s/{sid}/render", json=dict(ops=[dict(t0=o["op"]["t0"], t1=o["op"]["t1"], insert=o["op"]["insert"])])).json()
            fetch(sid, y["url"], f"{name}__fix_{it['i']}")
            rec["fixes"].append(dict(word=it["word"], before=it["acc"], after=o["op"].get("after"), engine=o["op"]["engine"], verified=o["op"]["verified"], sec=o["sec"], file=f"{name}__fix_{it['i']}.wav",
                                     cands=[(c["engine"], c.get("after"), c.get("ok")) for c in o["cands"]]))
        R["pron"].append(rec); print(json.dumps(rec)[:600], flush=True)
if mode in ("gram", "all"):
    rows = pq.read_table("/workspace/data/edacc_test0.parquet").to_pylist()
    native = ("English", "Scottish", "Irish", "American", "Canadian", "Australian")
    cand = [r for r in rows if r["l1"] and not any(n in r["l1"] for n in native) and "IGNORE" not in r["text"] and 8 <= len(r["text"].split()) <= 30]
    random.shuffle(cand); found = 0
    for r in cand:
        if found >= 10: break
        x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); d = len(x) / sr
        if not 2.5 < d < 14: continue
        ws = [dict(w=w, s=0, e=0) for w in r["text"].lower().split()]
        if not grammar(ws): continue  # cheap text-level prefilter on the human transcript
        name = f"edacc_{found}"; u = up(x, sr, name + "__orig"); sid = u["sid"]; W = u["words"]
        g = requests.post(f"{B}/api/s/{sid}/grammar").json()["items"]
        if not g: continue
        found += 1; ops, fixes = [], []
        for f in g:
            o = requests.post(f"{B}/api/s/{sid}/replace", json=dict(i=f["i"], j=f["j"], new=f["new"])).json()
            if "op" in o: ops.append(dict(t0=o["op"]["t0"], t1=o["op"]["t1"], insert=o["op"]["insert"])); fixes.append(dict(old=f["old"], new=f["new"], engine=o["op"]["engine"], verified=o["op"]["verified"], sec=o["sec"]))
            else: fixes.append(dict(old=f["old"], new=f["new"], err=str(o)[:200]))
        y = requests.post(f"{B}/api/s/{sid}/render", json=dict(ops=ops)).json(); fetch(sid, y["url"], f"{name}__fixed")
        rec = dict(name=name, accent=r["accent"], l1=r["l1"], human=r["text"].lower(), asr=" ".join(w["w"] for w in W), fixes=fixes, file=f"{name}__fixed.wav")
        R["gram"].append(rec); print(json.dumps(rec)[:700], flush=True)
json.dump(R, open(f"{OUT}/real_{mode}.json", "w"), indent=1)
