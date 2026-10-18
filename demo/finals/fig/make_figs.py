"""Figure data for the finals deck, all computed from the real example audio and engine output.
python make_figs.py <examples dir> <step1.json> <out media dir>"""
import json, sys, numpy as np, librosa, soundfile as sf
from PIL import Image
import matplotlib.cm as cm

EX, STEP1, OUT = sys.argv[1:4]

def example(name):
    t = open(f"{EX}/{name}/example.js", encoding="utf8").read()
    return json.loads(t[t.index("= {") + 2:].rstrip().rstrip(";"))

def voiced_end(x, sr, s, e, frac=0.1):
    """End of the voiced part of a word: aligned word ends run on into the following pause."""
    hop = int(0.01 * sr); seg = x[int(s * sr):int(e * sr)]
    rms = np.array([np.sqrt(np.mean(seg[i:i + hop] ** 2)) for i in range(0, len(seg) - hop, hop)])
    return s + (np.nonzero(rms > frac * rms.max())[0][-1] + 1) * 0.01

def peaks(x, sr, t0, t1, n):
    seg = x[int(t0 * sr):int(t1 * sr)]; k = len(seg) // n
    return [round(float(np.abs(seg[i * k:(i + 1) * k]).max()), 4) for i in range(n)]

out = {}
# ---- Step 1: mel spectrogram of "can you be more pacific about game night", Whisper vs CTC word times, CTC letters
T0, T1 = 1.86, 4.80
x, sr = librosa.load(f"{EX}/clean/before.wav", sr=16000)
seg = x[int(T0 * sr):int(T1 * sr)]
M = librosa.power_to_db(librosa.feature.melspectrogram(y=seg, sr=sr, n_fft=1024, hop_length=80, n_mels=96, fmax=7600), ref=np.max)
M = np.clip((M + 75) / 75, 0, 1)[::-1]
img = (cm.magma(M)[..., :3] * 255).astype(np.uint8)
Image.fromarray(img).resize((1600, 380), Image.BICUBIC).save(f"{OUT}/step1_mel.png")
d = json.load(open(STEP1))["before.wav"]
inwin = lambda w: w["s"] >= T0 - 0.05 and w["e"] <= T1 + 0.9
out["step1"] = dict(t0=T0, t1=T1,
    whisper=[dict(w=r["w"], s=r["s"], e=r["e"]) for r in d["raw"] if inwin(r)],
    ctc=[dict(w=f["w"], s=f["s"], e=min(f["e"], T1)) for f in d["final"] if inwin(f)],
    letters=[[c, t] for c, t in d["path"] if T0 <= t <= T1])

# ---- Step 3: "more pacific" -> "more specific" (engine output, F5-TTS, CTC margin from the engine run)
cl = example("clean"); rep = next(e for e in cl["edits"] if e.get("old") == "more pacific")
xb, sb = librosa.load(f"{EX}/clean/before.wav", sr=24000); xa, sa = librosa.load(f"{EX}/clean/after.wav", sr=24000)
aw = cl["after"]["words"]; ia = next(k for k, w in enumerate(aw) if w["w"].startswith("specific"))
bw = cl["before"]["words"]; nb = next(w for w in bw if w["w"].startswith("night")); na = next(w for w in aw[ia:] if w["w"].startswith("night"))
B0, B1 = 1.90, voiced_end(xb, sb, nb["s"], nb["e"]) + 0.12          # "can you be more pacific about game night", both rows end on "night"
A0 = next(w["s"] for w in aw if w["w"] == "can") - 0.08; A1 = voiced_end(xa, sa, na["s"], na["e"]) + 0.12
out["step3"] = dict(before=dict(t0=B0, t1=B1, peaks=peaks(xb, sb, B0, B1, 420), region=[rep["t0"], rep["t1"]],
                                words=[w for w in cl["before"]["words"] if B0 <= w["s"] <= B1]),
                    after=dict(t0=A0, t1=A1, peaks=peaks(xa, sa, A0, A1, 420), region=rep["out"],
                               words=[w for w in aw if A0 <= w["s"] <= A1]),
                    engine=rep["engine"], margin=cl["metrics"]["ctc_margin_specific"], heard=cl["metrics"]["retranscribed_after"],
                    dur=[cl["metrics"]["dur_before"], cl["metrics"]["dur_after"]])
print("step3 before window", B0, B1, "after window", A0, A1, [w["w"] for w in out["step3"]["after"]["words"]])
json.dump(out, open(f"{OUT}/figs_a.json", "w"))
