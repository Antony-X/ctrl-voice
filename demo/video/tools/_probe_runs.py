import sys
import numpy as np, soundfile as sf
from scipy.signal import correlate
d = sys.argv[1]
x, sr = sf.read(f"{d}/mvdbdp3fo7y1.wav", dtype="float64")
y, _ = sf.read(f"{d}/mvdbdp3fo7y1.edit.wav", dtype="float64")
cs = np.concatenate([[0], np.cumsum(x**2)])
W, H = int(0.04 * sr), int(0.02 * sr)
prev = None
for k in range(0, len(y) - W, H):
    seg = y[k:k + W]
    en = np.linalg.norm(seg)
    if en < 1e-3:
        tag = "silent"
        print(f"out {k/sr:6.3f}  silent"); continue
    c = correlate(x, seg, mode="valid", method="fft")
    e = np.sqrt(cs[W:] - cs[:-W] + 1e-12)
    n = c / (e * en + 1e-12)
    j = int(np.argmax(n))
    print(f"out {k/sr:6.3f}  orig {j/sr:6.3f}  shift {(j-k)/sr:+.3f}  ncc {n[j]:.3f}  rms {en/np.sqrt(W):.4f}")
