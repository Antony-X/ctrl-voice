# "Natural" tone presets: pitch/timing changes with Praat PSOLA. No neural regeneration, so the words and voice stay the speaker's own.
# Confident: faster, slightly lower, falling (not rising) phrase endings. Calm: slower, narrower pitch range. Warm: a bit higher, livelier.
import numpy as np, parselmouth
from parselmouth.praat import call
PRESETS = {"confident": dict(shift=0.95, range=1.0, speed=1.07, fall=True),
           "calm": dict(shift=0.97, range=0.7, speed=0.95, fall=True),
           "warm": dict(shift=1.04, range=1.15, speed=1.0, fall=False)}


def restyle(x, sr, words, style):
    p = PRESETS[style]; snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=sr); dur = snd.get_total_duration()
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
                for m, k in enumerate(idx): out[k][1] = f0 * (1 - 0.08 * m / (len(idx) - 1))
    call(pt, "Remove points between", 0, dur)
    for t, f in out: call(pt, "Add point", t, f)
    call([pt, manip], "Replace pitch tier")
    if p["speed"] != 1.0:
        dt = call(manip, "Extract duration tier"); call(dt, "Add point", 0, 1 / p["speed"]); call([manip, dt], "Replace duration tier")
    y = call(manip, "Get resynthesis (overlap-add)").values[0]
    return (y * (np.sqrt(np.mean(x ** 2)) / (np.sqrt(np.mean(y ** 2)) + 1e-9))).astype(np.float32)
