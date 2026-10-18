# Build the candidate pool (CPU only): L2-ARCTIC suitcase segments, Speech Accent Archive "Stella" first two sentences,
# and the prior EdAcc candidates. Writes wavs + cands.json with "before" metrics.
import sys, os, re, json, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, soundfile as sf, librosa, requests
from lib import *

C = f"{ROOT}/cands"; os.makedirs(C, exist_ok=True); os.makedirs(f"{C}/held", exist_ok=True)
cands = []

# ---------- A. L2-ARCTIC suitcase corpus (spontaneous, 44.1 kHz, manual word tier) ----------
L2 = f"{ROOT}/src/l2arctic/suitcase_corpus"
L2SPK = {"aba": ("M", "Arabic"), "ska": ("F", "Arabic"), "ybaa": ("M", "Arabic"), "zhaa": ("F", "Arabic"),
         "bwc": ("M", "Mandarin"), "lxc": ("F", "Mandarin"), "ncc": ("F", "Mandarin"), "txhc": ("M", "Mandarin"),
         "asi": ("M", "Hindi"), "rrbi": ("M", "Hindi"), "svbi": ("F", "Hindi"), "tni": ("F", "Hindi"),
         "hjk": ("F", "Korean"), "hkk": ("M", "Korean"), "ydck": ("F", "Korean"), "ykwk": ("M", "Korean"),
         "ebvs": ("M", "Spanish"), "erms": ("M", "Spanish"), "mbmps": ("F", "Spanish"), "njs": ("F", "Spanish"),
         "hqtv": ("M", "Vietnamese"), "pnv": ("F", "Vietnamese"), "thv": ("F", "Vietnamese"), "tlv": ("M", "Vietnamese")}


def words_tier(path):
    t = open(path, encoding="utf-8", errors="ignore").read()
    t = t.split('name = "phones"')[0]
    iv = re.findall(r"xmin = ([\d.]+)\s*\n\s*xmax = ([\d.]+)\s*\n\s*text = \"(.*?)\"", t)
    return [(float(a), float(b), w.strip().lower()) for a, b, w in iv]


def is_pause(w): return w in ("", "sil", "sp", "spn") or w.startswith("<")


for s, (g, l1) in L2SPK.items():
    tg = f"{L2}/annotation/{s}.TextGrid"
    if not os.path.exists(tg): continue
    x, sr = sf.read(f"{L2}/wav/{s}.wav", dtype="float32", always_2d=True); x = x.mean(1)
    iv = words_tier(tg)
    W = [(a, b, w) for a, b, w in iv if not is_pause(w)]
    # boundaries: indices k such that the gap between W[k-1].e and W[k].s >= 0.25 s
    gaps = [k for k in range(1, len(W)) if W[k][0] - W[k - 1][1] >= 0.25] + [len(W)]
    starts = [0] + gaps[:-1]
    segs = []
    for i in starts:
        for j in gaps:
            if j <= i: continue
            d = W[j - 1][1] - W[i][0]
            if d > 11.5: break
            if d < 6.0: continue
            ws = [w for _, _, w in W[i:j]]
            nfill = sum(w in FILL for w in ws)
            rep = sum(ws[k] == ws[k - 1] for k in range(1, len(ws)))
            segs.append((nfill * 3 + rep * 2 - 0.02 * len(ws), i, j, d, ws))
    segs.sort()
    used, picked = [], []
    for sc, i, j, d, ws in segs:
        if any(not (j <= a or i >= b) for a, b in used): continue
        used.append((i, j)); picked.append((sc, i, j, d, ws))
        if len(picked) == 2: break
    for n, (sc, i, j, d, ws) in enumerate(picked):
        pre = W[i - 1][1] if i > 0 else 0.0; post = W[j][0] if j < len(W) else len(x) / sr
        t0 = max(pre, W[i][0] - 0.2); t1 = min(post, W[j - 1][1] + 0.25)
        cid = f"l2arctic_{s}_{n}"
        seg = x[int(t0 * sr):int(t1 * sr)]; sf.write(f"{C}/{cid}.wav", seg, sr)
        held = np.concatenate([x[:int(t0 * sr)], x[int(t1 * sr):]]); sf.write(f"{C}/held/{cid}.wav", held, sr)
        cands.append(dict(id=cid, source="L2-ARCTIC suitcase", speaker=s.upper(), gender=g, l1=l1, text_ref=" ".join(ws),
                          seg=[round(t0, 3), round(t1, 3)], fillers=sum(w in FILL for w in ws), held=[f"{C}/held/{cid}.wav"]))
print("l2arctic", len(cands), flush=True)

L2ONLY = os.environ.get("L2ONLY") == "1"
if L2ONLY: cands = [c for c in cands if c["id"].endswith("_0")]
# ---------- B. Speech Accent Archive FLAC (OSF e2j5y), first two sentences of "Please call Stella" ----------
SAA_TEXT = "Please call Stella. Ask her to bring these things with her from the store."
LANGS = ["arabic", "mandarin", "spanish", "russian", "korean", "vietnamese", "hindi", "japanese", "french", "portuguese",
         "turkish", "farsi", "german", "italian", "polish", "cantonese", "thai", "bengali"]
FOLDER = "https://api.osf.io/v2/nodes/e2j5y/files/osfstorage/6a0f9d2e3c8c30eec4229a58/"
SRC = f"{ROOT}/src/saa"; os.makedirs(SRC, exist_ok=True)
saa_meta = {}
for lang in ([] if L2ONLY else LANGS + ["english"]):
    try:
        r = requests.get(FOLDER, params={"filter[name]": lang, "page[size]": 100}, timeout=60).json()
    except Exception as e:
        print("osf fail", lang, e); continue
    want = {f"{lang}{k}.flac" for k in ((1, 2, 3) if lang != "english" else (1, 2, 3))}
    for f in r.get("data", []):
        nm = f["attributes"]["name"]
        if nm in want:
            p = f"{SRC}/{nm}"
            if not os.path.exists(p):
                open(p, "wb").write(requests.get(f["links"]["download"], timeout=120).content)
            saa_meta[nm] = dict(url=f["links"]["download"], size=f["attributes"]["size"])
print("saa files", len(saa_meta), flush=True)
if not L2ONLY: json.dump(saa_meta, open(f"{SRC}/osf_files.json", "w"), indent=1)

for nm in sorted(saa_meta):
    x, sr = sf.read(f"{SRC}/{nm}", dtype="float32", always_2d=True); x = x.mean(1)
    x16 = librosa.resample(x, orig_sr=sr, target_sr=16000)
    text, ws = transcribe(x16[: 16000 * 13], words=True)
    k = next((i for i, w in enumerate(ws) if norm(w["w"]) == "store"), None)
    if k is None or k + 1 >= len(ws):
        print("no 'store'", nm, text[:80]); continue
    # cut at the quietest 20 ms frame between "store" and the next word
    a, b = ws[k]["e"] - 0.05, max(ws[k + 1]["s"] + 0.05, ws[k]["e"] + 0.1)
    fr = np.arange(int(a * 100), int(b * 100)); rms = [np.sqrt(np.mean(x16[int(t * 160):int(t * 160) + 320] ** 2) + 1e-12) for t in fr]
    t1 = fr[int(np.argmin(rms))] / 100 + 0.01
    t0 = max(0.0, ws[0]["s"] - 0.3)
    cid = f"saa_{nm[:-5]}"
    lang = re.sub(r"\d+$", "", nm[:-5])
    seg = x[int(t0 * sr):int(t1 * sr)]; sf.write(f"{C}/{cid}.wav", seg, sr)
    held = x[int(t1 * sr):]; sf.write(f"{C}/held/{cid}.wav", held, sr)
    cands.append(dict(id=cid, source="Speech Accent Archive", speaker=nm[:-5], gender=None, l1=lang.capitalize(), text_ref=SAA_TEXT,
                      seg=[round(t0, 3), round(float(t1), 3)], fillers=0, held=[f"{C}/held/{cid}.wav"], osf=saa_meta[nm]["url"],
                      control=lang == "english"))
print("with saa", len(cands), flush=True)

# ---------- C. prior EdAcc candidates (6-12.5 s) ----------
prior = json.load(open("/workspace/accent/cands.json"))
for c in ([] if L2ONLY else prior):
    if c["group"] == "native" or not (6.0 <= c["dur"] <= 12.5): continue
    cid = f"edacc_{c['name']}"
    shutil.copy(f"/workspace/accent/cands/{c['name']}.wav", f"{C}/{cid}.wav")
    held = [f"/workspace/accent/cands/{h['name']}.wav" for h in prior if h["speaker"] == c["speaker"] and h["name"] != c["name"]][:3]
    cands.append(dict(id=cid, source="EdAcc", speaker=c["speaker"], gender=c["gender"], l1=c["l1"], text_ref=c["text"],
                      seg=c.get("path"), fillers=sum(w in FILL for w in c["text"].lower().split()), held=held))
print("with edacc", len(cands), flush=True)

# ---------- before metrics ----------
for c in cands:
    x16 = load16(f"{C}/{c['id']}.wav")
    c["dur"] = round(len(x16) / 16000, 2)
    c["acc_before"] = accent(x16)
    c["quality"] = quality(x16)
    c["asr_before"] = transcribe(x16)
    c["wer_before"] = wer(c["text_ref"], c["asr_before"])
    e = emb(x16)
    he = np.mean([emb(load16(h)) for h in c["held"]], 0); he /= np.linalg.norm(he)
    np.save(f"{C}/held/{c['id']}_emb.npy", he)
    c["ceiling_sim"] = round(float(e @ he), 3)
    print(c["id"], c["dur"], c["acc_before"]["top"], c["acc_before"]["p_native"], c["quality"], c["ceiling_sim"], c["wer_before"], flush=True)
json.dump(cands, open(f"{ROOT}/cands.json", "w"), indent=1)
