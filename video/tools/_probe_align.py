import json, sys
import numpy as np, soundfile as sf
from scipy.signal import correlate
d = sys.argv[1]
msg = json.load(open(f"{d}/mvdbdp3fo7y1.json", encoding="utf-8"))
x, sr = sf.read(f"{d}/mvdbdp3fo7y1.wav", dtype="float64")
y, _ = sf.read(f"{d}/mvdbdp3fo7y1.edit.wav", dtype="float64")
print("rms orig", np.sqrt(np.mean(x**2)), "rms edit", np.sqrt(np.mean(y**2)))
cs = np.concatenate([[0], np.cumsum(y**2)])
def ncc_find(seg, y):
    c = correlate(y, seg, mode="valid", method="fft")
    L = len(seg)
    e = np.sqrt(cs[L:] - cs[:-L] + 1e-12)
    n = c / (e * np.linalg.norm(seg) + 1e-12)
    k = int(np.argmax(n))
    return k / sr, float(n[k])
for i, w in enumerate(msg["words"]):
    a, b = int(w["s"] * sr), int(w["e"] * sr)
    t, score = ncc_find(x[a:b], y)
    print(f"{i:2d} {w['w']:<10} orig {w['s']:6.3f}-{w['e']:6.3f}  -> edit {t:6.3f}  ncc {score:.3f}  shift {t - w['s']:+.3f}")
