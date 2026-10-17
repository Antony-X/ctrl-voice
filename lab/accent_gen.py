# Real accented speakers (EdAcc conversational + speechocean762 read L2) -> AuK de-accent / style instructions via the running AuK service.
import io, json, os, random, requests, numpy as np, soundfile as sf, pyarrow.parquet as pq
random.seed(1); OUT = "/workspace/out/accent"; os.makedirs(OUT, exist_ok=True); meta = {}
t = pq.read_table("/workspace/data/edacc_test0.parquet").to_pylist()
native = ("English", "Scottish", "Irish", "American", "Canadian", "Australian")
cand = [r for r in t if not any(n in (r["l1"] or "") for n in native) and len(r["text"].split()) >= 10 and "IGNORE" not in r["text"]]
seen, picked = set(), []
for r in cand:
    x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); d = len(x) / sr
    if r["speaker"] in seen or not 3 < d < 12: continue
    seen.add(r["speaker"]); picked.append((f"edacc_{len(picked)}", x, sr, r["text"].lower(), r["accent"], r["l1"]))
    if len(picked) == 6: break
so = pq.read_table("/workspace/data/so762_test.parquet").to_pylist(); so = [r for r in so if r["age"] >= 18 and r["accuracy"] <= 7 and len(r["text"].split()) >= 6]
for r in so[:4]:
    x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); picked.append((f"so762_{r['speaker']}", x, sr, r["text"].lower(), "Mandarin L1 (speechocean762)", "Mandarin"))
INSTR = {"deaccent": "Remove the regional accent while preserving the speaker's voice and content.",
         "native_us": "Make the speaker sound like a native American English speaker, keep the same voice, words and timing.",
         "confident": "Change the speaking style to confident and assertive, keep the same voice and words.",
         "calm": "Change the emotion to calm."}
for name, x, sr, text, acc, l1 in picked:
    p = f"{OUT}/{name}__orig.wav"; sf.write(p, x, sr); meta[name] = dict(text=text, accent=acc, l1=l1, dur=len(x) / sr)
    for k, ins in INSTR.items():
        o = requests.post("http://127.0.0.1:8102/instruct", json=dict(path=p, instruction=ins), timeout=300).json()
        os.replace(o["path"], f"{OUT}/{name}__{k}.wav"); print(name, acc, k, round(o["sec"], 2), flush=True)
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
