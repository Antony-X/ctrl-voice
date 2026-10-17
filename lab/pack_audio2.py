# Real-voice examples for the listening page (round 2).
import json, base64, subprocess, os, glob
def mp3(p):
    b = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-ac", "1", "-ar", "24000", "-b:a", "48k", "-f", "mp3", "-"], capture_output=True).stdout
    return "data:audio/mpeg;base64," + base64.b64encode(b).decode()
R = "/workspace/out/real"; I = "/workspace/out/intent"; A = "/workspace/out/accent"; out = {}
g = json.load(open(f"{R}/real_gram.json"))["gram"]
out["gram"] = [dict(accent=x["accent"], l1=x["l1"], said=x["asr"], fix=[(f["old"], f["new"]) for f in x["fixes"]], a=mp3(f"{R}/{x['name']}__orig.wav"), b=mp3(f"{R}/{x['file']}")) for x in g]
out["pron"] = []
for name, k, word, before, after, expert in [("so_0306_4", 4, "relatively", 6.1, 9.75, 3), ("so_0306_8", 3, "love", 5.7, 9.8, 3), ("so_0306_4", 7, "morning", 4.6, 9.95, 5)]:
    out["pron"].append(dict(word=word, before=before, after=after, expert=expert, a=mp3(f"{R}/{name}__orig.wav"), b=mp3(f"{R}/{name}__fix_{k}.wav")))
res = {x["k"]: x for x in json.load(open(f"{I}/results.json"))}
out["meant"] = [dict(truth=res[k]["truth"], heard=res[k]["asr0"], after=res[k]["asr1"], fix=res[k]["fixes"], a=mp3(f"{I}/u{k}__orig.wav"), b=mp3(f"{I}/u{k}__fixed.wav")) for k in (1, 10)]
meta = json.load(open(f"{A}/meta.json"))
out["accent"] = [dict(name=n, accent=meta[n]["accent"], a=mp3(f"{A}/{n}__orig.wav"), b=mp3(f"{A}/{n}__deaccent.wav")) for n in ("edacc_2", "edacc_4", "so762_0024")]
out["tone"] = dict(orig=mp3(f"{A}/edacc_2__orig.wav"), n_confident=mp3(f"{A}/edacc_2__natural_confident.wav"), n_calm=mp3(f"{A}/edacc_2__natural_calm.wav"),
                   n_warm=mp3(f"{A}/edacc_2__natural_warm.wav"), ai_calm=mp3(f"{A}/edacc_2__calm.wav"), ai_confident=mp3(f"{A}/edacc_2__confident.wav"))
json.dump(out, open("/workspace/out/page_audio2.json", "w")); print("MB", os.path.getsize("/workspace/out/page_audio2.json") / 1e6)
