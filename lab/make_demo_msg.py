# Synthetic test voice message WITH deliberate mistakes (F5-TTS cloning a real DisfluencySpeech voice). For pipeline testing only.
import json, soundfile as sf
from f5_tts.api import F5TTS
meta = json.load(open("/workspace/data/clips/meta.json")); ref = "disfl_011"
f5 = F5TTS()
parts = ["Hey Maya! So about this weekend. Um, I'll meet you on Monday, no wait, Wednesday at five, at the cafe.",
         "And can you bring the, uh, the the board game?",
         "Also, I talked to Jake and honestly he's being kind of annoying about the whole thing. Scratch that.",
         "Okay. See you then!"]
wav, sr, _ = f5.infer(ref_file=f"/workspace/data/clips/{ref}.wav", ref_text=meta[ref]["text"], gen_text=" ".join(parts), seed=1)
sf.write("/workspace/data/demo_msg.wav", wav, sr); print("ok", len(wav) / sr)
