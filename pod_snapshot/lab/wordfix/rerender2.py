# Re-render slide 4's "after" in the sweep session: the same three cuts, "more pacific" -> "more specific" (the insert the
# sound-only check scored best), and "mute" -> "moot" re-checked the same way. Usage: python rerender.py <sid> <specific insert id>
import json, re, sys
import httpx, librosa, numpy as np, torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
sys.path.insert(0, "/workspace/app"); from render import render, gap_edges
torch.set_num_threads(8)
M = "facebook/wav2vec2-large-960h-lv60-self"
proc = Wav2Vec2Processor.from_pretrained(M); net = Wav2Vec2ForCTC.from_pretrained(M).eval()
V = proc.tokenizer.get_vocab(); BLANK = V["<pad>"]
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower()); spell = lambda w: re.sub(r"[^A-Z']", "", w.upper())
API, SR = "http://127.0.0.1:7860", 24000

def logits(x16):
    with torch.inference_mode(): return torch.log_softmax(net(torch.tensor(x16, dtype=torch.float32)[None]).logits[0], -1)
def logp(lp, text):
    toks = [V[c] for w in text.split() for c in spell(w) + "|"][:-1]
    return -torch.nn.functional.ctc_loss(lp[:, None], torch.tensor([toks]), [lp.shape[0]], [len(toks)], blank=BLANK, reduction="sum").item()
def greedy(lp):
    out, prev = [], None
    for k in lp.argmax(-1).tolist():
        if k != prev and k != BLANK: out.append(proc.tokenizer.convert_ids_to_tokens(k))
        prev = k
    return "".join(out).replace("|", " ").strip().lower()
def margin(y, sr, t0, t1, left, mid_new, mid_old, right):
    a, b = max(0, int((t0 - 0.9) * sr)), min(len(y), int((t1 + 0.9) * sr)); lp = logits(librosa.resample(y[a:b], orig_sr=sr, target_sr=16000))
    j = lambda m: " ".join(left + [m] + right)
    return round(logp(lp, j(mid_new)) - logp(lp, j(mid_old)), 2), greedy(lp)

sid, spec_id = sys.argv[1], sys.argv[2]
W = json.load(open(f"/workspace/app_data/{sid}/words.json")); x, _ = librosa.load(f"/workspace/app_data/{sid}/orig.wav", sr=SR); dur = len(x) / SR
k = lambda word: next(n for n, w in enumerate(W) if norm(w["w"]) == word)
kp, km = k("pacific"), k("mute"); print("words:", W[kp], W[km], flush=True)
ctxw = lambda i, j: ([w["w"] for w in W[max(0, i - 2):i]], [w["w"] for w in W[j + 1:j + 3]])
cl = httpx.Client(timeout=300)
best = dict(id=sys.argv[3], t0=float(sys.argv[4]), t1=float(sys.argv[5]))
sw = json.load(open(next(p for p in __import__("glob").glob(f"/workspace/lab/wordfix/sweep_{sid}.json"))))
spec = next(r for r in sw["rows"] if r["id"] == spec_id)
ops = [dict(t0=1.061, t1=1.992), dict(t0=5.846, t1=7.147), dict(t0=9.269, t1=15.885),
       dict(t0=spec["op"]["t0"], t1=spec["op"]["t1"], insert=spec_id), dict(t0=best["t0"], t1=best["t1"], insert=best["id"])]
out = cl.post(f"{API}/api/s/{sid}/render", json=dict(ops=ops)).json(); print("render:", json.dumps(out), flush=True)
path = f"/workspace/app_data/{sid}/" + out["url"].rsplit("/", 1)[1]
aw = cl.post(f"{API}/api/upload", files={"f": ("after_new.wav", open(path, "rb"), "audio/wav")}).json()["words"]
y, _ = librosa.load(path, sr=16000); res = dict(path=path, ops=ops, ai=out["ai"], dur=out["dur"], words=[dict(w=w["w"], s=w["s"], e=w["e"]) for w in aw],
    transcript=" ".join(w["w"] for w in aw), spec=spec, moot=best)
for word, bad in (("specific", "pacific"), ("moot", "mute")):
    q = next((n for n, w in enumerate(aw) if norm(w["w"]) == word), None)
    if q is None: res[word] = "not in transcript"; continue
    L, R = [w["w"] for w in aw[max(0, q - 2):q]], [w["w"] for w in aw[q + 1:q + 3]]
    res[word] = margin(y, 16000, aw[q]["s"], aw[q]["e"], L, word, bad, R)
json.dump(res, open(f"/workspace/lab/wordfix/rerender_{sys.argv[3]}.json", "w"), indent=1)
print("after:", res["transcript"], "| specific", res["specific"], "| moot", res["moot"], flush=True)
