"""Figure data for the finals deck, all computed from the real example audio and engine output.
python make_figs.py <examples dir> <step1.json> <out media dir>

step1    : Whisper's word times vs the CTC forced alignment on "Um, quick update on the trip. We're leaving Thursday",
           with the CTC model's per-frame non-blank probability (the spike strip) and a mel spectrogram
trellis  : the aligner's own trellis (align.py: stay = emit blank, step = emit the next letter) for "Thursday"
closeup  : waveforms around the two re-said phrases ("Dan have" -> "Dan has", "a beat" -> "a bit")
(the PSOLA grains come from make_psola.py, which needs Praat)"""
import json, sys, numpy as np, librosa
from PIL import Image
import matplotlib.cm as cm

EX, STEP1, OUT = sys.argv[1:4]
ex = lambda name: (lambda t: json.loads(t[t.index("= {") + 2:].rstrip().rstrip(";")))(open(f"{EX}/{name}/example.js", encoding="utf8").read())

def voiced(x, sr, s, e, frac=0.1):
    """The voiced part of a word: aligned word ends run on into the following pause."""
    hop = int(0.01 * sr); seg = x[int(s * sr):int(e * sr)]
    rms = np.array([np.sqrt(np.mean(seg[i:i + hop] ** 2)) for i in range(0, len(seg) - hop, hop)])
    on = np.nonzero(rms > frac * rms.max())[0]
    return s + on[0] * 0.01, s + (on[-1] + 1) * 0.01

def peaks(x, sr, t0, t1, n):
    seg = x[int(t0 * sr):int(t1 * sr)]; k = len(seg) // n
    return [round(float(np.abs(seg[i * k:(i + 1) * k]).max()), 4) for i in range(n)]

out = {}
cl = ex("clean")

# ---------------------------------------------------------------- step 1: timing + spike strip
d = json.load(open(STEP1))["clean2_before.wav"]
em = np.array(d["em"]); V = d["vocab"]; BL = d["blank"]; fs = d["fs"]
T0, T1 = 0.74, 4.02
x16, _ = librosa.load(f"{EX}/clean/before.wav", sr=16000)
seg = x16[int(T0 * 16000):int(T1 * 16000)]
M = librosa.power_to_db(librosa.feature.melspectrogram(y=seg, sr=16000, n_fft=1024, hop_length=80, n_mels=96, fmax=7600), ref=np.max)
M = np.clip((M + 72) / 72, 0, 1)[::-1]
# the app's dark sheet colour at silence, rising through the model blue to the ink colour
lut = np.array([[0x20, 0x1f, 0x1e], [0x2e, 0x33, 0x5c], [0x70, 0x88, 0xff], [0xc9, 0xd2, 0xff], [0xf3, 0xf2, 0xee]], float)
pos = np.linspace(0, 1, len(lut)); img = np.stack([np.interp(M ** 1.15, pos, lut[:, c]) for c in range(3)], -1).astype(np.uint8)
Image.fromarray(img).resize((1600, 360), Image.BICUBIC).save(f"{OUT}/step1_mel.png")
inwin = lambda w: w["s"] >= T0 - 0.12 and w["s"] <= T1 - 0.15
f0, f1 = int(T0 / fs), int(T1 / fs) + 1
pnb = 1 - np.exp(em[:, BL])                                     # probability that the frame emits a letter (not blank)
out["step1"] = dict(t0=T0, t1=T1, fs=fs,
    whisper=[dict(w=r["w"], s=r["s"], e=r["e"]) for r in d["raw"] if inwin(r)],
    ctc=[dict(w=f["w"], s=f["s"], e=f["e"]) for f in d["final"] if inwin(f)],
    spikes=[[round(t * fs, 3), round(float(pnb[t]), 3)] for t in range(f0, f1)])
print("step1 words", [w["w"] for w in out["step1"]["ctc"]], "frames", f1 - f0)

# ---------------------------------------------------------------- trellis: re-run align.py's recursion on the whole message
idx = {c: i for i, c in enumerate(V)}
words = [w["w"] for w in d["final"]]
spell = lambda w: [c for c in w.upper() if c in idx and c != "|"]
toks, wid = [], []
for k, w in enumerate(words):
    for ch in spell(w): toks.append(idx[ch]); wid.append(k)
    toks.append(idx["|"]); wid.append(-1)
toks, wid = np.array(toks[:-1]), np.array(wid[:-1]); N, T = len(toks), em.shape[0]
tr = np.full((T + 1, N + 1), -np.inf); tr[0, 0] = 0; tr[1:, 0] = np.cumsum(em[:, BL])
for t in range(T): tr[t + 1, 1:] = np.maximum(tr[t, 1:] + em[t, BL], tr[t, :-1] + em[t, toks])
j, t = N, int(np.argmax(tr[:, N])); emit = {}
while j > 0 and t > 0:
    if tr[t - 1, j - 1] + em[t - 1, toks[j - 1]] > tr[t - 1, j] + em[t - 1, BL]: emit[j - 1] = t - 1; j -= 1
    t -= 1
k = words.index("Thursday."); rows = [i for i in range(N) if wid[i] == k]
fa, fb = emit[rows[0]] - 4, emit[rows[-1]] + 5
out["trellis"] = dict(word="THURSDAY", letters=[V[toks[i]] for i in rows], f0=fa, fs=fs,
    post=[[round(float(np.exp(em[t, toks[i]])), 3) for t in range(fa, fb + 1)] for i in rows],   # p_t(letter), row x frame
    blank=[round(float(np.exp(em[t, BL])), 3) for t in range(fa, fb + 1)],
    emit=[emit[i] - fa for i in rows])
print("trellis", out["trellis"]["letters"], "frames", fa, fb, "emit", out["trellis"]["emit"])

# ---------------------------------------------------------------- close-up of the two re-said phrases
xb, sb = librosa.load(f"{EX}/clean/before.wav", sr=24000); xa, sa = librosa.load(f"{EX}/clean/after.wav", sr=24000)
reps = [e for e in cl["edits"] if e["type"] == "replace"]
bw, aw = cl["before"]["words"], cl["after"]["words"]
wb = lambda t, ws: next(w for w in ws if w["w"].startswith(t))
B0 = wb("Anyway", bw)["s"] - 0.08; far_b = next(w for w in bw if w["w"].startswith("far")); B1 = voiced(xb, sb, far_b["s"], far_b["e"])[1] + 0.1
A0 = wb("Anyway", aw)["s"] - 0.08; far_a = next(w for w in aw if w["w"].startswith("far")); A1 = voiced(xa, sa, far_a["s"], far_a["e"])[1] + 0.1
lab = lambda x, sr, ws, a, b: [dict(w=w["w"], m=round(float(np.mean(voiced(x, sr, max(w["s"], a), min(w["e"], b)))), 3)) for w in ws if a <= w["s"] < b - 0.05]
cands = {}
for r in json.load(open(f"{EX}/../runs/sarah7b/run.json"))["replies"]:
    cands[r["op"]["new"]] = [dict(engine=c["engine"], ok=c["ok"], margin=c["margin"], sec=c["sec"]) for c in r["cands"]]
out["closeup"] = dict(
    before=dict(t0=B0, t1=B1, peaks=peaks(xb, sb, B0, B1, 440), regions=[[e["t0"], e["t1"]] for e in reps], words=lab(xb, sb, bw, B0, B1)),
    after=dict(t0=A0, t1=A1, peaks=peaks(xa, sa, A0, A1, 440), regions=[e["out"] for e in reps], words=lab(xa, sa, aw, A0, A1)),
    edits=[dict(old=e["old"], new=e["new"], kind=e["kind"], engine=e["engine"], cands=cands[e["new"]]) for e in reps],
    regenerated=round(sum(e["out"][1] - e["out"][0] for e in reps), 2), dur=[cl["metrics"]["dur_before"], cl["metrics"]["dur_after"]],
    heard=cl["metrics"]["retranscribed_after"])
print("closeup", B0, B1, A0, A1, out["closeup"]["regenerated"], out["closeup"]["edits"])

json.dump(out, open(f"{OUT}/figs_a.json", "w"))
