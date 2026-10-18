# Does the regenerated word SOUND like the intended word? Whisper's check is helped by the sentence
# ("be more ___ about" -> "specific"), so score candidates with a character CTC model that has no
# language model: margin = log P(audio | ...specific...) - log P(audio | ...pacific...). > 0 = sounds like the fix.
# Usage: python sweep.py <before.wav> <old> <new> [shipped_after.wav]
import json, re, sys, time, uuid
import httpx, librosa, numpy as np, soundfile as sf, torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
sys.path.insert(0, "/workspace/app"); from render import render, gap_edges
torch.set_num_threads(8)
M = "facebook/wav2vec2-large-960h-lv60-self"
proc = Wav2Vec2Processor.from_pretrained(M); net = Wav2Vec2ForCTC.from_pretrained(M).eval()
V = proc.tokenizer.get_vocab(); BLANK = V["<pad>"]
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
spell = lambda w: re.sub(r"[^A-Z']", "", w.upper())
API = "http://127.0.0.1:7860"; SR = 24000

def logp(x16, text):
    toks = [V[c] for w in text.split() for c in spell(w) + "|"][:-1]
    with torch.inference_mode():
        lp = torch.log_softmax(net(torch.tensor(x16, dtype=torch.float32)[None]).logits[0], -1)
    return -torch.nn.functional.ctc_loss(lp[:, None], torch.tensor([toks]), [lp.shape[0]], [len(toks)], blank=BLANK, reduction="sum").item()

def greedy(x16):
    with torch.inference_mode(): ids = net(torch.tensor(x16, dtype=torch.float32)[None]).logits[0].argmax(-1).tolist()
    out, prev = [], None
    for k in ids:
        if k != prev and k != BLANK: out.append(proc.tokenizer.convert_ids_to_tokens(k))
        prev = k
    return "".join(out).replace("|", " ").strip().lower()

def margin(y, sr, t0, t1, words_text_new, words_text_old):
    """CTC margin on a clip around [t0, t1] (seconds in y), with the local words as transcript."""
    a, b = max(0, int((t0 - 0.9) * sr)), min(len(y), int((t1 + 0.9) * sr)); x16 = librosa.resample(y[a:b], orig_sr=sr, target_sr=16000)
    return logp(x16, words_text_new) - logp(x16, words_text_old), greedy(x16)

src, OLD, NEW = sys.argv[1], sys.argv[2], sys.argv[3]
cl = httpx.Client(timeout=300)
up = cl.post(f"{API}/api/upload", files={"f": ("sweep_before.wav", open(src, "rb"), "audio/wav")}).json(); sid, W = up["sid"], up["words"]
k = next(n for n, w in enumerate(W) if norm(w["w"]) == norm(OLD)); dur = up["dur"]
x, _ = librosa.load(f"/workspace/app_data/{sid}/orig.wav", sr=SR)
ctx = lambda i, j, mid: " ".join([w["w"] for w in W[max(0, i - 2):i]] + [mid] + [w["w"] for w in W[j + 1:j + 3]])
L0, R0 = W[k]["s"], W[k]["e"]
m0, g0 = margin(x, SR, L0, R0, ctx(k, k, NEW), ctx(k, k, OLD))
print(json.dumps(dict(sid=sid, word_index=k, original_margin=round(m0, 2), original_heard=g0)), flush=True)
rows = []
for span in (1, 2, 3):
    i = k - (span - 1); j = k; old_txt = " ".join(re.sub(r"[.,!?;:]+$", "", w["w"]) for w in W[i:j + 1]); new_txt = old_txt.rsplit(" ", 1)[0] + " " + NEW if span > 1 else NEW
    for seed in range(4):
        t = time.time(); r = cl.post(f"{API}/api/s/{sid}/replace", json=dict(i=i, j=j, new=new_txt, kind="misspoken", seed=seed * 7, rounds=1)).json(); dt = time.time() - t
        for c in r.get("cands", []):
            if not c.get("id"): continue
            seg = np.load(f"/workspace/app_data/{sid}/ins_{c['id']}.npy"); oL, oR = gap_edges(W, i, j, dur)
            y, ai = render(x, SR, [dict(t0=oL, t1=oR, insert=seg)])
            m, g = margin(y, SR, ai[0][0], ai[0][1], ctx(i, j, new_txt), ctx(i, j, " ".join(new_txt.split()[:-1] + [OLD])))
            row = dict(span=span, seed=seed * 7, engine=c["engine"], id=c["id"], whisper_ok=c["ok"], sim=c["sim"], heard_whisper=c["heard"][-60:], margin=round(m, 2), heard_ctc=g, sec=round(dt, 1),
                       chosen=(r["op"]["insert"] == c["id"]), op=dict(t0=round(oL, 3), t1=round(oR, 3)))
            rows.append(row); print(json.dumps(row), flush=True)
json.dump(dict(sid=sid, k=k, original_margin=m0, rows=rows), open(f"/workspace/lab/wordfix/sweep_{sid}.json", "w"), indent=1)
if len(sys.argv) > 4:  # the shipped after: locate the new word by alignment of its own transcript
    y, sr = librosa.load(sys.argv[4], sr=16000); aw = cl.post(f"{API}/api/upload", files={"f": ("sweep_after.wav", open(sys.argv[4], "rb"), "audio/wav")}).json()["words"]
    q = next(n for n, w in enumerate(aw) if norm(w["w"]) == norm(NEW))
    m, g = margin(y, 16000, aw[q]["s"], aw[q]["e"], " ".join([w["w"] for w in aw[max(0, q - 2):q + 3]]), " ".join([w["w"] for w in aw[max(0, q - 2):q]] + [OLD] + [w["w"] for w in aw[q + 1:q + 3]]))
    print(json.dumps(dict(shipped_after_margin=round(m, 2), shipped_heard_ctc=g)), flush=True)
