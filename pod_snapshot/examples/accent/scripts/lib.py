# Shared CPU-only measurement helpers for the accent example search (never touches the GPU).
import os, re, glob
os.environ["CUDA_VISIBLE_DEVICES"] = ""
import numpy as np, soundfile as sf, librosa, torch, jiwer

torch.set_num_threads(20)
ROOT = "/workspace/examples/accent"
MODELS = f"{ROOT}/models"
FILL = {"uh", "um", "mm", "hmm", "ah", "er", "erm", "uhm", "eh"}
NATIVE = ["us", "england", "canada", "australia", "newzealand", "ireland", "scotland", "wales"]
AAM_SCALE = 30.0  # CommonAccent recipe trains with AdditiveAngularMargin(scale=30); softmax(30*cos) ~ the model's posterior


def norm(s):
    s = re.sub(r"<[^>]*>", " ", s.lower()).replace("-", " ")
    s = re.sub(r"[^a-z' ]", " ", s)
    return " ".join(w for w in s.split() if w not in FILL)


def load16(p):
    x, sr = sf.read(p, dtype="float32", always_2d=True)
    return librosa.resample(x.mean(1), orig_sr=sr, target_sr=16000)


_asr = _spk = _acc = None


def asr():
    global _asr
    if _asr is None:
        from faster_whisper import WhisperModel
        snap = glob.glob("/workspace/hf/hub/models--mobiuslabsgmbh--faster-whisper-large-v3-turbo/snapshots/*")[0]
        _asr = WhisperModel(snap, device="cpu", compute_type="int8", cpu_threads=20)
    return _asr


def transcribe(x16, words=False, beam=1):
    segs, _ = asr().transcribe(x16, language="en", beam_size=beam, word_timestamps=words, condition_on_previous_text=False)
    segs = list(segs)
    text = " ".join(s.text.strip() for s in segs).strip()
    if not words:
        return text
    ws = [dict(w=w.word.strip(), s=float(w.start), e=float(w.end), p=float(w.probability)) for s in segs for w in s.words if w.word.strip()]
    return text, ws


def spk():
    global _spk
    if _spk is None:
        from speechbrain.inference.speaker import EncoderClassifier
        _spk = EncoderClassifier.from_hparams(f"{MODELS}/sb_ecapa", savedir=f"{MODELS}/sb_ecapa", run_opts={"device": "cpu"})
    return _spk


@torch.no_grad()
def emb(x16):
    e = spk().encode_batch(torch.tensor(x16)[None]).squeeze()
    return torch.nn.functional.normalize(e, dim=0).numpy()


def acc_model():
    global _acc
    if _acc is None:
        from speechbrain.inference.classifiers import EncoderClassifier
        _acc = EncoderClassifier.from_hparams(f"{MODELS}/sb_accent", savedir=f"{MODELS}/sb_accent", run_opts={"device": "cpu"})
    return _acc


@torch.no_grad()
def accent(x16):
    m = acc_model()
    out, _, _, lab = m.classify_batch(torch.tensor(x16)[None])
    cos = out.squeeze().float().numpy()
    labels = [m.hparams.label_encoder.decode_ndim(i) for i in range(len(cos))]
    p = np.exp(AAM_SCALE * (cos - cos.max())); p /= p.sum()
    P = dict(zip(labels, p.round(4).tolist()))
    top3 = sorted(P.items(), key=lambda kv: -kv[1])[:3]
    return dict(top=lab[0], p_native=round(float(sum(P[k] for k in NATIVE if k in P)), 4),
                p_us=P.get("us"), p_england=P.get("england"), top3=top3, P=P,
                cos={k: round(float(c), 3) for k, c in zip(labels, cos)})


def quality(x16):
    """Noise-floor proxy: 10th-percentile 20 ms frame level relative to the 95th (dB, more negative = cleaner); clipping share."""
    f = librosa.util.frame(np.pad(x16, (0, 320)), frame_length=320, hop_length=320)
    db = 20 * np.log10(np.sqrt((f ** 2).mean(0)) + 1e-9)
    return dict(floor_db=round(float(np.percentile(db, 10) - np.percentile(db, 95)), 1),
                clip=round(float((np.abs(x16) > 0.99).mean()), 5))


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    return round(float(jiwer.wer(r, h)), 3) if r else None
