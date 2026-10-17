import json, soundfile as sf
from f5_tts.api import F5TTS
meta = json.load(open("/workspace/data/clips/meta.json")); ref = "libri_1320-122617-0000"
f5 = F5TTS()
for name, txt in [("A", "Hey, it's me. I'm leaving the office now. The meeting was honestly a total disaster and my boss is an idiot."),
                  ("B", "Anyway, I'll pick up dinner on the way home. Do you want Thai or pizza?")]:
    wav, sr, _ = f5.infer(ref_file=f"/workspace/data/clips/{ref}.wav", ref_text=meta[ref]["text"], gen_text=txt, seed=3)
    sf.write(f"/workspace/data/live_{name}.wav", wav, sr); print(name, len(wav) / sr)
