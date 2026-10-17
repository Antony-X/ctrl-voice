# Does a tone take keep the words and the voice? WER vs original transcript + ECAPA similarity + UTMOS.
import glob, os, sys, json, torch, librosa, jiwer, re
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
asr = WhisperModel("large-v3", device="cuda", compute_type="float16")
spk = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb", savedir="/workspace/hf/ecapa", run_opts={"device": "cuda"})
mos = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).cuda()
n = lambda s: " ".join(re.sub(r"[^a-z0-9' ]", " ", s.lower()).split())
def load(p): return librosa.load(p, sr=16000)[0]
def text(x): return " ".join(s.text for s in asr.transcribe(x, language="en", beam_size=5)[0])
emb = lambda x: torch.nn.functional.normalize(spk.encode_batch(torch.tensor(x)[None].float().cuda())[0, 0], dim=0)
d = sys.argv[1]; o = load(f"{d}/orig.wav"); ot = text(o); e0 = emb(o)
print(f"orig  utmos={mos(torch.tensor(o)[None].cuda(), 16000).item():.2f} | {ot[:90]}")
for p in sorted(glob.glob(f"{d}/tone_*.wav")):
    x = load(p); t = text(x)
    print(f"{os.path.basename(p)[5:-11]:9s} wer={jiwer.wer(n(ot), n(t)):.2f} sim={float(emb(x) @ e0):.3f} utmos={mos(torch.tensor(x)[None].cuda(), 16000).item():.2f} | {t[:90]}")
