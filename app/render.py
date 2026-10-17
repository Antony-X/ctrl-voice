# Non-destructive renderer: original audio + edit list (cuts / AI inserts) -> finished message.
import numpy as np
def quiet(x, sr, t, win=0.04):
    """Snap a cut time to the quietest 10 ms frame within +-win seconds."""
    n, h = int(0.01 * sr), int(0.0025 * sr); a, b = int(max(0, t - win) * sr), int(min(len(x) / sr, t + win) * sr)
    if b - a <= n: return t
    e = np.convolve(x[a:b] ** 2, np.ones(n), "valid")[::h]
    return (a + int(np.argmin(e)) * h + n // 2) / sr
def gap_edges(words, i, j, dur, pad=0.04):
    """Cut boundaries for words i..j: halfway into the pauses on either side."""
    L = (words[i - 1]["e"] + words[i]["s"]) / 2 if i > 0 else max(0.0, words[i]["s"] - pad)
    R = (words[j]["e"] + words[j + 1]["s"]) / 2 if j + 1 < len(words) else min(dur, words[j]["e"] + pad)
    return L, R
def lead_sil(x, sr, thr):
    k = np.argmax(np.abs(x) > thr) if np.any(np.abs(x) > thr) else len(x); return k
def xfade(a, b, n):
    n = min(n, len(a), len(b))
    if n == 0: return np.concatenate([a, b])
    t = np.linspace(0, np.pi / 2, n, dtype=np.float32)
    return np.concatenate([a[:-n], a[-n:] * np.cos(t) + b[:n] * np.sin(t), b[n:]])
def render(x, sr, ops, fade=0.012, max_gap=0.45):
    """ops: [{t0,t1, insert: np.ndarray|None}] in original time. Returns audio + list of AI regions (sec) in output."""
    ops = sorted([o for o in ops if o["t1"] > o["t0"]], key=lambda o: o["t0"])
    merged = []
    for o in ops:  # merge overlapping cuts (inserts win)
        if merged and o["t0"] < merged[-1]["t1"] and o.get("insert") is None and merged[-1].get("insert") is None:
            merged[-1]["t1"] = max(merged[-1]["t1"], o["t1"])
        else: merged.append(dict(o))
    thr = max(1e-3, np.percentile(np.abs(x), 60) * 0.5); n = int(fade * sr)
    out, pos, ai = np.zeros(0, np.float32), 0.0, []
    for o in merged:
        t0, t1 = quiet(x, sr, o["t0"]), quiet(x, sr, o["t1"])
        if t0 < pos: t0 = pos
        left = x[int(pos * sr):int(t0 * sr)]
        # cap the silence that a cut leaves behind (trailing silence of left + leading silence of right)
        if o.get("insert") is None:
            tail = lead_sil(left[::-1], sr, thr); nxt = x[int(t1 * sr):int((t1 + 1.5) * sr)]; head = lead_sil(nxt, sr, thr)
            extra = (tail + head) / sr - max_gap
            if extra > 0: trim = min(int(extra * sr), tail); left = left[:len(left) - trim]; t1 += max(0, extra - trim / sr)
        out = xfade(out, left, n) if len(out) else left.copy()
        if o.get("insert") is not None:
            s0 = len(out) / sr; out = xfade(out, o["insert"].astype(np.float32), n); ai.append((s0, len(out) / sr))
        pos = t1
    out = xfade(out, x[int(pos * sr):], n) if len(out) else x.copy()
    return out.astype(np.float32), ai
