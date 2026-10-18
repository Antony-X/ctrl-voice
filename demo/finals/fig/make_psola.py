"""TD-PSOLA figure data: a few steady pitch periods of the tone example's voice with Praat's pitch marks, cut into
two-period Hann grains and overlap-added at 1.12x the spacing (f0 / 1.12, about 2 semitones lower, same duration).
python make_psola.py <examples dir> <out json>   (run with the Praat venv)"""
import json, sys, numpy as np, parselmouth
from parselmouth.praat import call
EX, OUTF = sys.argv[1:3]
ex = lambda name: (lambda t: json.loads(t[t.index("= {") + 2:].rstrip().rstrip(";")))(open(f"{EX}/{name}/example.js", encoding="utf8").read())
out = {}
snd = parselmouth.Sound(f"{EX}/tone/before.wav")
pitch = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=600)
pp = call([snd, pitch], "To PointProcess (cc)")
marks = np.array([call(pp, "Get time from index", i + 1) for i in range(call(pp, "Get number of points"))])
tw = ex("tone")["before"]["words"]; w = next(w for w in tw if w["w"].lower().startswith("ready"))
inw = marks[(marks > w["s"] + 0.03) & (marks < w["e"] - 0.03)]
per = np.diff(inw); best = int(np.argmin([np.std(per[i:i + 6]) for i in range(len(per) - 6)]))  # the steadiest 6 periods
m = inw[best:best + 7]; P = float(np.mean(np.diff(m)))
xs, sr = snd.values[0], int(snd.sampling_frequency)
a0, a1 = m[0] - 0.4 * P, m[-1] + 0.4 * P
grains = []
for i in range(1, len(m) - 1):                                  # a grain spans one period either side of its mark
    s, e = int(m[i - 1] * sr), int(m[i + 1] * sr); g = xs[s:e] * np.hanning(e - s)
    grains.append(dict(mark=round(float(m[i] - a0), 5), s=round(float(m[i - 1] - a0), 5), y=[round(float(v), 4) for v in g[::2]]))
k = 1.12                                                        # output marks 1.12x further apart: f0 / 1.12, about -2 semitones
n_out = int((m[-2] - m[1]) / (P * k)) + 1; L = int((a1 - a0) * sr) + 1; y = np.zeros(L)   # same duration, fewer grains
newmarks = []
for j in range(n_out):
    tm = m[1] + j * P * k; src = int(np.argmin(np.abs(m[1:-1] - tm)))   # the input grain nearest in time
    g = grains[src]; gy = np.repeat(np.array(g["y"]), 2)
    c = int((tm - a0) * sr) - int((g["mark"] - g["s"]) * sr)
    seg = gy[:max(0, min(len(gy), L - c))]; y[c:c + len(seg)] += seg; newmarks.append(dict(t=round(float(tm - a0), 5), src=src))
out["psola"] = dict(sr=sr // 2, P=round(P, 5), f0=round(1 / P, 1), k=k, dur=round(float(a1 - a0), 5),
    x=[round(float(v), 4) for v in xs[int(a0 * sr):int(a1 * sr):2]], marks=[round(float(t - a0), 5) for t in m], grains=grains,
    out=[round(float(v), 4) for v in y[::2]], outmarks=newmarks)
print("psola f0", round(1 / P, 1), "Hz, marks", len(m), "out marks", len(newmarks), [g["src"] for g in newmarks])
json.dump(out["psola"], open(OUTF, "w"))
