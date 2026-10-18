# Re-cut Speech Accent Archive clips to a longer, still message-like span:
#   "Please call Stella. Ask her to bring these things with her from the store. Six spoons of fresh snow peas,
#    five thick slabs of blue cheese, and maybe a snack for her brother Bob."  -> end at "bob" if <= 12.3 s, else "cheese", else "peas".
# Word times: the engine's own /api/upload of the full file (whisper + CTC alignment). Then CPU before-metrics.
import sys, os, json, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, librosa
from lib import *

BASE = "http://127.0.0.1:7860"; C = f"{ROOT}/cands"; SRC = f"{ROOT}/src/saa"
FULL = ("Please call Stella. Ask her to bring these things with her from the store. Six spoons of fresh snow peas, "
        "five thick slabs of blue cheese, and maybe a snack for her brother Bob.")
ENDS = [("bob", FULL), ("cheese", FULL.split(", and maybe")[0] + "."), ("peas", FULL.split(", five")[0] + ".")]
names = sys.argv[1].split(",")
osf = json.load(open(f"{SRC}/osf_files.json"))
outp = f"{ROOT}/cands_saa3.json"
out = json.load(open(outp)) if os.path.exists(outp) else []
done = {c["id"] for c in out}
for nm in names:
    cid = f"saa3_{nm}"
    if cid in done: continue
    x, sr = sf.read(f"{SRC}/{nm}.flac", dtype="float32", always_2d=True); x = x.mean(1)
    tmp = f"{ROOT}/tmp_{nm}.wav"; sf.write(tmp, x, sr)
    up = requests.post(f"{BASE}/api/upload", files={"f": (f"{nm}.wav", open(tmp, "rb"), "audio/wav")}, timeout=120).json()
    os.remove(tmp)
    ws = up["words"]; t0 = max(0.0, ws[0]["s"] - 0.3)
    pick = None
    for end, txt in ENDS:
        k = next((i for i, w in enumerate(ws) if norm(w["w"]) == end), None)
        if k is None: continue
        nxt = ws[k + 1]["s"] if k + 1 < len(ws) else len(x) / sr
        a, b = ws[k]["e"], max(nxt, ws[k]["e"] + 0.06)
        x16 = librosa.resample(x, orig_sr=sr, target_sr=16000)
        fr = np.arange(int(a * 100), int(b * 100) + 1)
        rms = [np.sqrt(np.mean(x16[int(t * 160):int(t * 160) + 320] ** 2) + 1e-12) for t in fr]
        t1 = min(fr[int(np.argmin(rms))] / 100 + 0.01, ws[k]["e"] + 0.35)
        if t1 - t0 <= 12.3:
            pick = (end, txt, t1); break
    if pick is None:
        print(nm, "too slow / not found"); continue
    end, txt, t1 = pick
    seg = x[int(t0 * sr):int(t1 * sr)]; sf.write(f"{C}/{cid}.wav", seg, sr)
    held = x[int(t1 * sr):] if len(x) / sr - t1 > 6 else np.concatenate([x[:int(t0 * sr)], x[int(t1 * sr):]])
    sf.write(f"{C}/held/{cid}.wav", held, sr)
    lang = "".join(ch for ch in nm if not ch.isdigit())
    c = dict(id=cid, source="Speech Accent Archive", speaker=nm, gender=None, l1=lang.capitalize(), text_ref=txt, end=end,
             seg=[round(t0, 3), round(float(t1), 3)], fillers=0, held=[f"{C}/held/{cid}.wav"], osf=osf[f"{nm}.flac"]["url"])
    x16 = load16(f"{C}/{cid}.wav")
    c["dur"] = round(len(x16) / 16000, 2); c["acc_before"] = accent(x16); c["quality"] = quality(x16)
    c["asr_before"] = " ".join(w["w"] for w in ws if t0 <= w["s"] < t1); c["wer_before"] = wer(txt, c["asr_before"])
    he = emb(load16(c["held"][0])); he /= np.linalg.norm(he); np.save(f"{C}/held/{cid}_emb.npy", he)
    c["ceiling_sim"] = round(float(emb(x16) @ he), 3)
    out.append(c); json.dump(out, open(outp, "w"), indent=1)
    print(cid, end, c["dur"], c["acc_before"]["top"], c["acc_before"]["p_native"], c["ceiling_sim"], c["quality"], c["wer_before"], flush=True)
