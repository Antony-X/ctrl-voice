# "Natural" tone presets: pitch/timing changes with Praat PSOLA. No neural regeneration, so the words and voice stay the speaker's own.
# Confident: faster, slightly lower, falling (not rising) phrase endings. Calm: slower, narrower pitch range. Warm: a bit higher, livelier.
import numpy as np, parselmouth
from parselmouth.praat import call
# Confident also shortens long hesitation pauses (pause: the longest pause kept, in seconds, at amount 1) and tightens
# speech that trails off into a pause (tail: speed-up of that soft, fading stretch), the two clearest marks of a tired take.
PRESETS = {"confident": dict(shift=0.95, range=1.0, speed=1.07, fall=True, pause=0.45, tail=1.4),
           "calm": dict(shift=0.97, range=0.7, speed=0.95, fall=True),
           "warm": dict(shift=1.04, range=1.15, speed=1.0, fall=False)}
MAX_AMOUNT = 1.5  # the strongest slider setting, as a multiple of the preset


def blend(mix):
    """{style: amount} -> one setting; 1 = the preset, 0 = off. Styles multiply, so opposite ones (confident is faster, calm slower) cancel."""
    p = dict(shift=1.0, range=1.0, speed=1.0, fall=0.0, pause=None, tail=1.0)
    for k, a in mix.items():
        a = min(max(float(a), 0.0), MAX_AMOUNT); b = PRESETS[k]
        for q in ("shift", "range", "speed"): p[q] *= b[q] ** a
        if b["fall"]: p["fall"] = max(p["fall"], min(a, 1.0))
        if b.get("pause") and a > 0: p["pause"] = min(p["pause"] or 9.0, b["pause"] / a)
        if b.get("tail"): p["tail"] *= b["tail"] ** a
    return p


def timing(x, sr, p):
    """Duration factor per 10 ms frame: 1/speed, long pauses squeezed down to p["pause"] s, and soft speech that fades
    into a pause (a trailing-off "heyyy...") sped up by p["tail"]."""
    hop = int(0.01 * sr); n = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop).astype(np.float64) ** 2, 1)) + 1e-9)
    ref = float(np.median(db[db > db.max() - 40]))  # level of active speech
    sil, soft = db < ref - 30, (db >= ref - 30) & (db < ref - 8)
    runs = lambda m: zip(np.flatnonzero(np.diff(np.r_[0, m.astype(int)]) == 1), np.flatnonzero(np.diff(np.r_[m.astype(int), 0]) == -1) + 1)
    fac = np.full(n, 1 / p["speed"])
    if p["pause"]:
        for a, b in runs(sil):  # inner pauses only; keep 50 ms of each edge as it is
            if a > 0 and b < n and (b - a) * 0.01 > p["pause"]: fac[a + 5:b - 5] = (p["pause"] - 0.1) / ((b - a) * 0.01 - 0.1)
    if p["tail"] > 1:
        for a, b in runs(soft):
            if b - a >= 15 and a > 0 and b + 5 <= n and sil[b:b + 5].all(): fac[a:b] /= p["tail"]
    return fac, hop / sr


def restyle(x, sr, words, style):
    """style: a preset name, or a {style: amount} mix from the sliders."""
    p = blend(style if isinstance(style, dict) else {style: 1.0}); snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=sr); dur = snd.get_total_duration()
    manip = call(snd, "To Manipulation", 0.01, 75, 600); pt = call(manip, "Extract pitch tier")
    n = call(pt, "Get number of points")
    pts = [(call(pt, "Get time from index", k), call(pt, "Get value at index", k)) for k in range(1, n + 1)]
    if not pts: return x
    med = float(np.median([f for _, f in pts]))
    ends = [w["e"] for k, w in enumerate(words) if k + 1 == len(words) or words[k + 1]["s"] - w["e"] > 0.3]  # phrase endings
    out = []
    for t, f in pts:
        f = med * (f / med) ** p["range"] * p["shift"]  # compress/expand range around the median, then shift
        out.append([t, f])
    if p["fall"]:  # replace rising phrase endings (uptalk) by a gentle fall
        for e in ends:
            idx = [k for k, (t, _) in enumerate(out) if e - 0.35 <= t <= e + 0.05]
            if len(idx) >= 3 and out[idx[-1]][1] > out[idx[0]][1] * 1.12:
                f0 = out[idx[0]][1]
                w = p["fall"]  # a weaker setting blends toward the fall; w = 1 is the full preset
                for m, k in enumerate(idx): out[k][1] = (1 - w) * out[k][1] + w * f0 * (1 - 0.08 * m / (len(idx) - 1))
    call(pt, "Remove points between", 0, dur)
    for t, f in out: call(pt, "Add point", t, f)
    call([pt, manip], "Replace pitch tier")
    fac, step = timing(x, sr, p)
    if np.abs(fac - 1.0).max() > 1e-6:
        dt = call(manip, "Extract duration tier"); call(dt, "Add point", 0, float(fac[0]))
        for k in np.flatnonzero(np.diff(fac)) + 1:  # piecewise constant: a point just before and at each change
            call(dt, "Add point", k * step - 0.001, float(fac[k - 1])); call(dt, "Add point", k * step, float(fac[k]))
        call([manip, dt], "Replace duration tier")
    y = call(manip, "Get resynthesis (overlap-add)").values[0]
    return (y * (np.sqrt(np.mean(x ** 2)) / (np.sqrt(np.mean(y ** 2)) + 1e-9))).astype(np.float32)
