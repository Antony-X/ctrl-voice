# Splice only the regenerated phrase from a model output back into the untouched original.
import numpy as np, re, librosa
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
def find(words, phrase):
    p = [norm(x) for x in phrase.split()]; t = [norm(w["w"]) for w in words]
    for i in range(len(t) - len(p) + 1):
        if t[i:i + len(p)] == p: return i, i + len(p) - 1
    return None
def quiet(x, sr, t, win=0.04, hop=0.005):
    # move cut time t to the lowest-energy 10 ms frame within +-win
    a, b = int(max(0, t - win) * sr), int(min(len(x) / sr, t + win) * sr); n, h = int(0.01 * sr), int(hop * sr)
    if b - a <= n: return t
    e = [np.sum(x[k:k + n] ** 2) for k in range(a, b - n, h)]
    return (a + int(np.argmin(e)) * h + n // 2) / sr
def bounds(words, i, j, sr, x, pad=0.03):
    L = (words[i - 1]["e"] + words[i]["s"]) / 2 if i > 0 else max(0, words[i]["s"] - pad)
    R = (words[j]["e"] + words[j + 1]["s"]) / 2 if j + 1 < len(words) else min(len(x) / sr, words[j]["e"] + pad)
    return quiet(x, sr, L), quiet(x, sr, R)
def xfade(a, b, n):
    if n == 0 or len(a) < n or len(b) < n: return np.concatenate([a, b])
    t = np.linspace(0, np.pi / 2, n); return np.concatenate([a[:-n], a[-n:] * np.cos(t) + b[:n] * np.sin(t), b[n:]])
def splice(orig, sr, ow, i, j, gen, gsr, gw, new, fade=0.01):
    """orig/ow: original audio + words; [i,j]: replaced word span; gen/gw: model output + its ASR words; new: new phrase."""
    k = find(gw, new)
    if k is None: return None
    if gsr != sr: gen = librosa.resample(gen, orig_sr=gsr, target_sr=sr)
    oL, oR = bounds(ow, i, j, sr, orig); gL, gR = bounds(gw, k[0], k[1], sr, gen)
    seg = gen[int(gL * sr):int(gR * sr)]
    ctx = np.concatenate([orig[max(0, int((oL - 1) * sr)):int(oL * sr)], orig[int(oR * sr):int((oR + 1) * sr)]])
    rms = lambda v: np.sqrt(np.mean(v ** 2) + 1e-12)
    seg = seg * min(3.0, rms(ctx) / rms(seg)) if len(seg) else seg  # level match to surrounding speech
    n = int(fade * sr)
    return xfade(xfade(orig[:int(oL * sr)], seg, n), orig[int(oR * sr):], n)
