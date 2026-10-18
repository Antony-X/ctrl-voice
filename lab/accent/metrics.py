# Objective checks: ASR WER, ECAPA speaker similarity (vs held-out clips of the same speaker), accent-ID probabilities.
import json, re, sys
import numpy as np, librosa, torch, jiwer
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
from speechbrain.inference.classifiers import EncoderClassifier as AccClassifier

OUT = sys.argv[1] if len(sys.argv) > 1 else "/workspace/accent/out"
log = json.load(open(f"{OUT}/run_log.json"))
cands = {c["name"]: c for c in json.load(open("/workspace/accent/cands.json"))}
SPK = {"russian_C24A": "EDACC-C24-A", "indian_C09B": "EDACC-C09-B", "native_C07A": "EDACC-C07-A"}
FILL = {"uh", "um", "mm", "hmm", "ah", "er", "erm", "uhm"}
def norm(s):
    s = re.sub(r"<[^>]*>", " ", s.lower()).replace("-", " ")
    s = re.sub(r"[^a-z' ]", " ", s)
    return " ".join(w for w in s.split() if w not in FILL)
load16 = lambda p: librosa.load(p, sr=16000)[0]

asr = WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
transcribe = lambda x: " ".join(s.text.strip() for s in asr.transcribe(x, language="en", beam_size=5)[0])
ecapa = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb", savedir="/workspace/accent/sb_ecapa", run_opts={"device": "cuda"})
acc = AccClassifier.from_hparams("Jzuluaga/accent-id-commonaccent_ecapa", savedir="/workspace/accent/sb_accent", run_opts={"device": "cuda"})
labels = [acc.hparams.label_encoder.decode_ndim(i) for i in range(len(acc.hparams.label_encoder))]
INNER = {"us", "england", "canada", "australia", "newzealand", "ireland", "scotland", "wales"}

@torch.no_grad()
def emb(x):
    e = ecapa.encode_batch(torch.tensor(x)[None].cuda()).squeeze()
    return torch.nn.functional.normalize(e, dim=0).cpu().numpy()

@torch.no_grad()
def accent(x):
    # ECAPA accent-ID head outputs cosine scores per class (not probabilities); report top-1 and raw cosines.
    out_prob, score, idx, lab = acc.classify_batch(torch.tensor(x)[None].cuda())
    d = dict(zip(labels, out_prob.squeeze().float().cpu().numpy()))
    return dict(top=lab[0], cos_us=round(float(d["us"]), 3), cos_england=round(float(d["england"]), 3),
                cos_indian=round(float(d["indian"]), 3))

ref_tts_emb = {g: emb(load16(f"/workspace/accent/refs/{f}")) for g, f in
               {"male": "ls_4077-13754-0009.wav", "female": "ls_5683-32879-0000.wav"}.items()}
import os
ref_emb_any = lambda f: emb(load16(f"/workspace/accent/refs/{f}"))
res = {}
for name, spk in SPK.items():
    used = log[name]["cand"]
    held = [n for n, c in cands.items() if c["speaker"] == spk and n != used][:3]   # held-out clips of the same speaker
    held_emb = np.mean([emb(load16(f"/workspace/accent/cands/{h}.wav")) for h in held], 0)
    held_emb /= np.linalg.norm(held_emb)
    ref_text = norm(cands[used]["text"]); tts_text = norm(log[name]["text"])
    e_orig = emb(load16(f"{OUT}/{name}_original.wav"))
    row = dict(speaker=spk, l1=cands[used]["l1"], accent_label=cands[used]["accent"], segment=cands[used]["path"],
               held_out=[cands[h]["path"] for h in held])
    for kind in ("original", "native_tts", "converted"):
        x = load16(f"{OUT}/{name}_{kind}.wav")
        hyp = transcribe(x); e = emb(x)
        row[kind] = dict(dur=round(len(x) / 16000, 2), asr=hyp,
                         wer_vs_edacc_ref=round(jiwer.wer(ref_text, norm(hyp)), 3),
                         wer_vs_tts_text=round(jiwer.wer(tts_text, norm(hyp)), 3),
                         sim_heldout=round(float(e @ held_emb), 3), sim_original=round(float(e @ e_orig), 3),
                         sim_native_ref_voice=round(float(e @ ref_emb_any(log[name]["native_ref"])), 3), **accent(x))
        print(name, kind, {k: v for k, v in row[kind].items() if k != "asr"}, flush=True)
    res[name] = row
# impostor baseline: cross-speaker similarity of originals' held-out embeddings
json.dump(res, open(f"{OUT}/metrics.json", "w"), indent=1)
print(labels)
