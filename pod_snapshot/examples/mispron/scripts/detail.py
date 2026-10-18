# Frame-level view of one splice: F0 and level in the original vs the fixed file, around the regenerated word.
# Usage: python -I detail.py <outDir> <id> <L_s> <Ra_s> <Rb_s>
import sys
import numpy as np, soundfile as sf, librosa

out, cid, L, Ra, Rb = sys.argv[1], sys.argv[2], *map(float, sys.argv[3:6])
b, sr = sf.read(f"{out}/{cid}_before.wav", dtype="float32"); a, _ = sf.read(f"{out}/{cid}_after.wav", dtype="float32")
H = int(0.01 * sr)
def track(y):
    f0, vf, _ = librosa.pyin(y, fmin=60, fmax=450, sr=sr, frame_length=1024, hop_length=H)
    rms = librosa.feature.rms(y=y, frame_length=480, hop_length=H)[0]
    return np.where(vf, f0, np.nan), 20 * np.log10(rms + 1e-9)
fb, rb = track(b); fa, ra = track(a)
print(f"{cid}: splice before {L:.3f}-{Rb:.3f}  after {L:.3f}-{Ra:.3f}")
print(" t_before  F0_b   dB_b | t_after   F0_a   dB_a   region")
t = L - 0.30
while t < Rb + 0.30:
    ib = int(t / 0.01)
    ta = t if t < L else (t - Rb + Ra if t >= Rb else None)
    line = f" {t:7.2f} {fb[ib] if ib < len(fb) else np.nan:6.1f} {rb[ib] if ib < len(rb) else np.nan:6.1f} |"
    if ta is not None:
        ia = int(ta / 0.01); line += f" {ta:7.2f} {fa[ia]:6.1f} {ra[ia]:6.1f}   {'pre' if t < L else 'post'}"
    else:
        line += "    (original word, replaced)"
    print(line)
    t += 0.02
print(" inserted word in the after file:")
t = L
while t < Ra:
    ia = int(t / 0.01); print(f"   {t:7.2f} {fa[ia]:6.1f} {ra[ia]:6.1f}"); t += 0.02
