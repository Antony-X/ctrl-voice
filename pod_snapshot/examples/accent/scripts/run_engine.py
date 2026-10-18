# Send candidates through the engine exactly as the app does for an unedited message:
#   POST /api/upload (field f) -> POST /api/s/{sid}/render {ops: []} -> POST /api/s/{sid}/accent
#   {style: 'native', text: keptText(words, []) = words joined by ' ', file: <render file>} -> GET url.
# One request at a time. Connection errors / 502 / 503: wait 120 s and retry (planned engine restart).
import sys, os, json, time, requests

ROOT = "/workspace/examples/accent"; BASE = "http://127.0.0.1:7860"
OUT = f"{ROOT}/engine"; os.makedirs(OUT, exist_ok=True)
ids = sys.argv[1].split(",")
res_path = f"{ROOT}/engine_results.json"
res = json.load(open(res_path)) if os.path.exists(res_path) else {}


def call(fn, tries=4):
    for k in range(tries):
        try:
            r = fn()
            if r.status_code in (502, 503, 504):
                raise requests.ConnectionError(f"HTTP {r.status_code}: {r.text[:200]}")
            r.raise_for_status()
            return r
        except requests.ConnectionError as e:
            print("  retry in 120 s:", e, flush=True); time.sleep(120)
    raise RuntimeError("engine unavailable")


def run(cid, wav, tag=""):
    t = time.time()
    up = call(lambda: requests.post(f"{BASE}/api/upload", files={"f": (os.path.basename(wav), open(wav, "rb"), "audio/wav")}, timeout=120)).json()
    sid = up["sid"]
    rd = call(lambda: requests.post(f"{BASE}/api/s/{sid}/render", json={"ops": []}, timeout=120)).json()
    text = " ".join(w["w"] for w in up["words"])
    body = {"style": "native", "text": text, "file": rd["url"].split("/")[-1]}
    ac = call(lambda: requests.post(f"{BASE}/api/s/{sid}/accent", json=body, timeout=300)).json()
    audio = call(lambda: requests.get(f"{BASE}{ac['url']}", timeout=120)).content
    out = f"{OUT}/{cid}{tag}_after.wav"; open(out, "wb").write(audio)
    return dict(sid=sid, upload_words=up["words"], upload_dur=up["dur"], render=rd, accent_body=body, accent=ac, after=out,
                wall_s=round(time.time() - t, 1))


for cid in ids:
    if cid in res: print("skip", cid); continue
    wav = f"{ROOT}/cands/{cid}.wav"
    try:
        r = run(cid, wav)
    except Exception as e:
        print(cid, "FAILED", e, flush=True); continue
    res[cid] = r
    json.dump(res, open(res_path, "w"), indent=1)
    a = r["accent"]
    print(cid, "dur", a["dur"], "kept", a["words_kept"], "sim", a["voice_sim"], "sec", a["sec"], "|", r["accent_body"]["text"][:90], flush=True)
