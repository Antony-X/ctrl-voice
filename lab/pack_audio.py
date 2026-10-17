# Collect audio for the listening page as small mp3 data URIs + metrics.
import json, base64, subprocess, glob, os, requests, sys
sys.path.insert(0, "/workspace/lab"); from jobs import jobs
B = "http://localhost:7860"; D = "/workspace/app_data"; out = {}
def mp3(p, br="48k"):
    b = subprocess.run(["ffmpeg", "-v", "quiet", "-i", p, "-ac", "1", "-ar", "24000", "-b:a", br, "-f", "mp3", "-"], capture_output=True).stdout
    return "data:audio/mpeg;base64," + base64.b64encode(b).decode()
st = requests.get(f"{B}/api/s/livetest1/state").json()
lv = requests.post(f"{B}/api/s/livetest1/render", json=dict(ops=[dict(t0=r["t0"], t1=r["t1"]) for r in st["removed"]])).json()
out["live_orig"] = mp3(f"{D}/livetest1/orig.wav"); out["live_edit"] = mp3(f"{D}/livetest1/{lv['url'].split('/')[-1]}")
out["live_text"] = " ".join(("~~" + w["w"] + "~~") if w["x"] else w["w"] for w in st["words"])
s = "63050833"; out["demo_orig"] = mp3(f"{D}/{s}/orig.wav"); out["demo_clean"] = mp3(f"{D}/{s}/out_0efc29.wav"); out["demo_final"] = mp3(f"{D}/{s}/out_413eb1.wav")
for t in ["calm", "friendly"]: out[f"tone_{t}"] = mp3(glob.glob(f"{D}/e13422b4/tone_{t}_*.wav")[0])
R = json.load(open("/workspace/out/results_v2.json")); M = ["dots+splice", "playdiff+splice", "f5+splice", "auk_flash+splice", "playdiff"]
rows = []
for j in jobs():
    r = dict(id=j["id"], text=j["text"], old=j["old"], new=j["new"], src=j["clip"].split("_")[0], orig=mp3(j["path"]), m={})
    for m in M:
        f = f"/workspace/out/{m}/{j['id']}.wav"
        if os.path.exists(f): r["m"][m] = dict(a=mp3(f), **{k: R[m][j["id"]][k] for k in ["ok", "sim", "mos", "wer"]})
    rows.append(r)
out["rows"] = rows; json.dump(out, open("/workspace/out/page_audio.json", "w")); print("MB", os.path.getsize("/workspace/out/page_audio.json") / 1e6)
