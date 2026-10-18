# Finalists: engine pronunciation score (GOP-based /pron) before vs after, and After word timings via /api/upload of after.wav.
import sys, os, json, requests, numpy as np

ROOT = "/workspace/examples/accent"; BASE = "http://127.0.0.1:7860"
ids = sys.argv[1].split(",")
eng = json.load(open(f"{ROOT}/engine_results.json"))
fp = f"{ROOT}/finalists.json"
F = json.load(open(fp)) if os.path.exists(fp) else {}


def pron(sid):
    p = requests.post(f"{BASE}/api/s/{sid}/pron", timeout=180).json()
    sc = [s for s in p["scores"] if s is not None]
    return dict(median=p["median"], mean=round(float(np.mean(sc)), 2) if sc else None, n_scored=len(sc), flagged=[i["word"] for i in p["items"]],
                accent_phones=p["accent"])


for cid in ids:
    if cid in F: continue
    r = eng[cid]
    pb = pron(r["sid"])
    up = requests.post(f"{BASE}/api/upload", files={"f": ("after.wav", open(r["after"], "rb"), "audio/wav")}, timeout=120).json()
    pa = pron(up["sid"])
    F[cid] = dict(pron_before=pb, pron_after=pa, after_upload=dict(sid=up["sid"], dur=up["dur"], words=up["words"]))
    json.dump(F, open(fp, "w"), indent=1)
    print(cid, "pron median", pb["median"], "->", pa["median"], "mean", pb["mean"], "->", pa["mean"],
          "accent phones", [a["phone"] for a in pb["accent_phones"]], "->", [a["phone"] for a in pa["accent_phones"]], flush=True)
