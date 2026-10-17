import json, librosa, sys, time
sys.path.insert(0, "/workspace/lab"); from align import realign
W = json.load(open("/workspace/data/clips/asr_words.json")); out = {}; t = time.time()
for k, ws in W.items():
    x, _ = librosa.load(f"/workspace/data/clips/{k}.wav", sr=16000); out[k] = realign(x, ws)
print(f"{(time.time()-t)/len(W)*1000:.0f} ms/clip")
for k in ["libri_1320-122617-0000", "ami_FEO072_1"]:
    for a, b in zip(W[k], out[k]): print(f"{a['w']:15s} whisper {a['s']:.2f}-{a['e']:.2f}  ctc {b['s']:.2f}-{b['e']:.2f}")
json.dump(out, open("/workspace/data/clips/asr_words_aligned.json", "w"))
