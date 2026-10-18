"""Bundle everything the deck reads into media/data.js (window.DATA), so it runs from file:// with no fetch.
python make_data.py <examples dir> <media dir>"""
import json, sys, numpy as np, librosa
EX, MEDIA = sys.argv[1:3]
def example(name):
    t = open(f"{EX}/{name}/example.js", encoding="utf8").read(); return json.loads(t[t.index("= {") + 2:].rstrip().rstrip(";"))
def peaks(path, n=360):
    x, sr = librosa.load(path, sr=16000); k = len(x) // n
    p = np.array([np.abs(x[i * k:(i + 1) * k]).max() for i in range(n)]); return [round(float(v), 3) for v in p / p.max()]
D = dict(clips={})
for ex in ("clean", "tone", "mispron", "accent"):
    e = example(ex)
    for side in ("before", "after"):
        D["clips"][f"{ex}.{side}"] = dict(src=f"media/audio/{ex}_{side}.mp3", dur=e[side]["dur"], words=e[side]["words"],
                                         peaks=peaks(f"{EX}/{ex}/{side}.wav"))
    D[ex] = dict(edits=e.get("edits"), metrics=e.get("metrics"))
D["figs"] = json.load(open(f"{MEDIA}/figs_a.json")); D["tone_f0"] = json.load(open(f"{MEDIA}/figs_tone.json"))
open(f"{MEDIA}/data.js", "w", encoding="utf8").write("window.DATA = " + json.dumps(D, ensure_ascii=False) + ";\n")
print({k: len(v["peaks"]) for k, v in D["clips"].items()})
