"""Pitch contours (Praat, same settings as prosody.py) of the tone example before/after. python make_tone.py <examples dir> <out json>"""
import json, sys, numpy as np, parselmouth
EX, OUT = sys.argv[1:3]
def example(name):
    t = open(f"{EX}/{name}/example.js", encoding="utf8").read(); return json.loads(t[t.index("= {") + 2:].rstrip().rstrip(";"))
ex = example("tone"); res = {}
for side in ("before", "after"):
    snd = parselmouth.Sound(f"{EX}/tone/{side}.wav"); p = snd.to_pitch(time_step=0.01, pitch_floor=75, pitch_ceiling=600)
    f = p.selected_array["frequency"]; t = p.xs()
    res[side] = dict(dur=snd.get_total_duration(), t=[round(float(a), 3) for a in t], hz=[round(float(b), 1) for b in f],
                     words=ex[side]["words"])
res["metrics"] = ex["metrics"]
json.dump(res, open(OUT, "w")); print({k: (v["dur"], np.median([h for h in v["hz"] if h > 0])) for k, v in res.items() if k != "metrics"})
