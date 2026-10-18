# Does adding the command phrases to Whisper's prompt make it invent them? CPU-only, faster-whisper large-v3-turbo (int8).
# Audio: recent engine sessions (no command phrases in most), each also with 1.5 s of silence appended and cut in the
# middle of a pause, the way the live loop sees it. Counts command phrases per prompt.
import glob, json, os, re, sys, time
import numpy as np, librosa
from faster_whisper import WhisperModel
BASE = "Um, so, uh, um, I was, uh, like, um, thinking, uh. Um. Uh. Hmm, um, okay, uh, I mean, um."
PROMPTS = {"base": BASE, "bias": BASE + " Scratch that. Never mind that."}
CMD = re.compile(r"scratch|never ?mind|strike that|delete that|undo|forget (that|it)|start over", re.I)
m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8", cpu_threads=8)
dirs = sorted(glob.glob("/workspace/app_data/*/orig.wav"), key=os.path.getmtime)[-int(sys.argv[1]):]
clips = []
for f in dirs:
    x, _ = librosa.load(f, sr=16000)
    if len(x) < 16000 * 2: continue
    clips.append((f.split("/")[-2], x)); clips.append((f.split("/")[-2] + "+sil", np.concatenate([x, np.zeros(24000, np.float32)])))
    clips.append((f.split("/")[-2] + "@60%", np.concatenate([x[:int(len(x) * 0.6)], np.zeros(12000, np.float32)])))
out = {k: [] for k in PROMPTS}; t = time.time()
for name, x in clips:
    for k, p in PROMPTS.items():
        segs, _ = m.transcribe(x, language="en", initial_prompt=p, beam_size=1, condition_on_previous_text=False)
        out[k].append((name, " ".join(s.text.strip() for s in segs)))
for (name, a), (_, b) in zip(out["base"], out["bias"]):
    ca, cb = len(CMD.findall(a)), len(CMD.findall(b))
    flag = "  <-- differs" if ca != cb else ""
    print(f"{name:18s} cmd base={ca} bias={cb}{flag}")
    if ca != cb or ca: print("   base:", a[:200]); print("   bias:", b[:200])
same = sum(a == b for (_, a), (_, b) in zip(out["base"], out["bias"]))
print(f"{len(clips)} clips, identical transcripts {same}/{len(clips)}, {time.time() - t:.0f}s")
json.dump(out, open("/workspace/v2test/bias_out.json", "w"), indent=1)
