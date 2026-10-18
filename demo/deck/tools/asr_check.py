"""Transcribe audio files locally (Whisper large-v3-turbo from the HF cache, offline) with word times.
Only for checking what a take actually says and where its pauses are. Usage: python asr_check.py f1 [f2 ...]"""
import os, sys
os.environ["HF_HUB_OFFLINE"] = "1"
import torch, librosa
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3-turbo", torch_dtype=torch.float16, device="cuda:0")
for f in sys.argv[1:]:
    y, sr = librosa.load(f, sr=16000, mono=True)
    r = asr({"raw": y, "sampling_rate": 16000}, return_timestamps="word", generate_kwargs={"language": "en"})
    print(f"== {os.path.basename(f)} ({len(y)/16000:.2f}s)\n{r['text'].strip()}")
    ch = r["chunks"]
    gaps = [(ch[k]["timestamp"][1], ch[k+1]["timestamp"][0], ch[k]["text"]) for k in range(len(ch)-1)
            if ch[k+1]["timestamp"][0] - ch[k]["timestamp"][1] >= 0.4]
    print("words:", " ".join(f"{c['text'].strip()}@{c['timestamp'][0]:.2f}" for c in ch))
    print("gaps>=0.4s:", ", ".join(f"after '{t.strip()}' {a:.2f}-{b:.2f}" for a, b, t in gaps))
