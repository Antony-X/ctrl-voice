# Did AuK reduce the accent while keeping words + voice? accent-ID probs, WER, speaker sim, prosody.
import glob, json, os, re, numpy as np, torch, librosa, jiwer
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
D = "/workspace/out/accent"; meta = json.load(open(f"{D}/meta.json"))
asr = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
spk = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb", savedir="/workspace/hf/ecapa", run_opts={"device": "cpu"})
acc = EncoderClassifier.from_hparams("Jzuluaga/accent-id-commonaccent_ecapa", savedir="/workspace/hf/accentid", run_opts={"device": "cpu"})
labs = [acc.hparams.label_encoder.decode_ndim(i) for i in range(len(acc.hparams.label_encoder))]
n = lambda s: " ".join(re.sub(r"[^a-z0-9' ]", " ", s.lower()).split())
def stats(p):
    x, _ = librosa.load(p, sr=16000); t = torch.tensor(x)[None]
    pr = acc.classify_batch(t)[0][0].exp(); pr = pr / pr.sum(); top = labs[int(pr.argmax())]
    native = float(sum(pr[labs.index(l)] for l in ["us", "canada", "england"] if l in labs))
    e = torch.nn.functional.normalize(spk.encode_batch(t)[0, 0], dim=0)
    txt = " ".join(s.text for s in asr.transcribe(x, language="en", beam_size=5)[0])
    f0, vf, _ = librosa.pyin(x, fmin=60, fmax=400, sr=16000, frame_length=1024); f0 = f0[vf] if vf.any() else np.array([0.0])
    return dict(top=top, native=native, emb=e, txt=txt, f0sd=float(np.std(12 * np.log2(f0 / np.median(f0) + 1e-9))) if len(f0) > 5 else 0, rms=float(np.sqrt(np.mean(x ** 2))))
R = {}
for name, m in meta.items():
    o = stats(f"{D}/{name}__orig.wav"); R[name] = {"orig": dict(top=o["top"], native=o["native"], wer=jiwer.wer(n(m["text"]), n(o["txt"])), f0sd=o["f0sd"])}
    print(f"\n{name} [{m['accent']}] ref: {m['text'][:80]}\n  orig      top={o['top']:12s} native={o['native']:.2f} wer={R[name]['orig']['wer']:.2f} f0sd={o['f0sd']:.2f}st")
    for k in ["deaccent", "native_us", "confident", "calm"]:
        s = stats(f"{D}/{name}__{k}.wav"); w = jiwer.wer(n(m["text"]), n(s["txt"])); sim = float(s["emb"] @ o["emb"])
        R[name][k] = dict(top=s["top"], native=s["native"], wer=w, sim=sim, f0sd=s["f0sd"], txt=s["txt"])
        print(f"  {k:9s} top={s['top']:12s} native={s['native']:.2f} wer={w:.2f} sim={sim:.3f} f0sd={s['f0sd']:.2f}st | {s['txt'][:70]}")
json.dump(R, open(f"{D}/results.json", "w"), indent=1)
print("\nMEAN over speakers")
for k in ["orig", "deaccent", "native_us", "confident", "calm"]:
    v = [R[nm][k] for nm in R]; print(f"  {k:9s} native={np.mean([x['native'] for x in v]):.2f} wer={np.mean([x['wer'] for x in v]):.2f}" + (f" sim={np.mean([x['sim'] for x in v]):.3f}" if k != "orig" else ""))
