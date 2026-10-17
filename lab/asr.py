# Word-timestamped ASR over clips, verbatim-ish (keeps fillers via prompt).
import json, sys, time, glob, os
from faster_whisper import WhisperModel
PROMPT = "Umm, so, uh, I was like, you know, thinking... Hmm, okay, I mean, no wait, actually."
m = WhisperModel(sys.argv[2] if len(sys.argv) > 2 else "large-v3", device="cuda", compute_type="float16")
def transcribe(path, prompt=PROMPT):
    segs, info = m.transcribe(path, language="en", word_timestamps=True, initial_prompt=prompt, vad_filter=False, beam_size=5)
    return [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 3)) for s in segs for w in s.words]
if __name__ == "__main__":
    d = sys.argv[1]; out = {}
    for f in sorted(glob.glob(f"{d}/*.wav")):
        t = time.time(); ws = transcribe(f)
        out[os.path.basename(f)[:-4]] = ws
        print(f"{os.path.basename(f)} {time.time()-t:.2f}s :: {' '.join(w['w'] for w in ws)}")
    json.dump(out, open(f"{d}/asr_words.json", "w"))
