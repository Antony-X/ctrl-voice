# Fetch a few LibriSpeech test-clean utterances (CC BY 4.0) as native-English F5 references; estimate gender via median F0.
import io, json, urllib.request
import numpy as np, soundfile as sf, librosa

out = {}
for off in range(0, 2600, 250):
    url = f"https://datasets-server.huggingface.co/rows?dataset=openslr/librispeech_asr&config=clean&split=test&offset={off}&length=60"
    d = json.load(urllib.request.urlopen(url))
    for r in d["rows"]:
        r = r["row"]
        nw = len(r["text"].split())
        if r["speaker_id"] in out or not (16 <= nw <= 26):
            continue
        x, sr = sf.read(io.BytesIO(urllib.request.urlopen(r["audio"][0]["src"]).read()))
        dur = len(x) / sr
        if not (5.5 <= dur <= 10.5):
            continue
        f0 = librosa.yin(x.astype(np.float32), fmin=60, fmax=400, sr=sr)
        f0med = float(np.median(f0))
        sf.write(f"/workspace/accent/refs/ls_{r['id']}.wav", x, sr)
        out[r["speaker_id"]] = dict(id=r["id"], text=r["text"], dur=round(dur, 2), f0=round(f0med, 1))
        print(r["speaker_id"], out[r["speaker_id"]])
        break
json.dump(out, open("/workspace/accent/refs/ls_refs.json", "w"), indent=1)
