import sys, json, os, glob, re, numpy as np, torch, librosa, soundfile as sf, jiwer
sys.path.insert(0, "/workspace/lab"); from jobs import jobs; from splice import splice, norm; from align import align
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
asr = WhisperModel("large-v3", device="cuda", compute_type="float16")
spk = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb", savedir="/workspace/hf/ecapa", run_opts={"device": "cuda"})
mos = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).cuda()
def words(x16):
    segs, _ = asr.transcribe(x16, language="en", word_timestamps=True, beam_size=5)
    return [dict(w=w.word.strip(), s=w.start, e=w.end) for s in segs for w in s.words]
tn = lambda s: " ".join(norm(w) for w in s.split() if norm(w))
emb = lambda x16: torch.nn.functional.normalize(spk.encode_batch(torch.tensor(x16)[None].float().cuda())[0, 0], dim=0)
utmos = lambda x16: mos(torch.tensor(x16)[None].float().cuda(), 16000).item()
def score(x16, j, e0):
    ws = words(x16); txt = " ".join(w["w"] for w in ws)
    hit = tn(j["new"]) in tn(txt) and tn(j["old"]) not in tn(txt)
    return dict(wer=jiwer.wer(tn(j["new_text"]), tn(txt)), ok=hit, sim=float(emb(x16) @ e0), mos=utmos(x16), txt=txt), ws
models = sys.argv[1:]; RF = os.environ.get("RES", "/workspace/out/results.json"); R = json.load(open(RF)) if os.path.exists(RF) else {}
for j in jobs():
    o, sr = librosa.load(j["path"], sr=None); o16 = librosa.resample(o, orig_sr=sr, target_sr=16000); e0 = emb(o16)
    R.setdefault("orig", {})[j["id"]] = dict(mos=utmos(o16))
    for m in models:
        f = f"/workspace/out/{m}/{j['id']}.wav"
        if not os.path.exists(f): continue
        g, gsr = librosa.load(f, sr=None); g16 = librosa.resample(g, orig_sr=gsr, target_sr=16000)
        s, gw = score(g16, j, e0); s["sec"] = json.load(open(f"/workspace/out/{m}/log.json"))[j["id"]]["sec"]
        R.setdefault(m, {})[j["id"]] = s
        tw = [dict(w=x, s=0, e=0) for x in j["new_text"].split()]; al = align(g16, [w["w"] for w in tw])
        tw = [dict(w, s=a[0], e=a[1]) for w, a in zip(tw, al) if a] if all(al) else gw  # locate new phrase by forced alignment to the target text
        sp = splice(o, sr, j["words"], j["i"], j["j"], g, gsr, tw, j["new"])
        if sp is not None:
            os.makedirs(f"/workspace/out/{m}+splice", exist_ok=True); sf.write(f"/workspace/out/{m}+splice/{j['id']}.wav", sp, sr)
            s2, _ = score(librosa.resample(sp, orig_sr=sr, target_sr=16000), j, e0); s2["sec"] = s["sec"]
        else: s2 = dict(wer=1.0, ok=False, sim=float("nan"), mos=float("nan"), txt="<phrase not found>", sec=s["sec"])
        R.setdefault(m + "+splice", {})[j["id"]] = s2
        print(f"{m:12s} {j['id'][:38]:38s} ok={s['ok']!s:5} wer={s['wer']:.2f} sim={s['sim']:.3f} mos={s['mos']:.2f} | splice ok={s2['ok']!s:5} sim={s2['sim']:.3f} mos={s2['mos']:.2f}", flush=True)
json.dump(R, open(RF, "w"), indent=1)
print("\nSUMMARY  model | edit-success | WER | speaker-sim | UTMOS | sec/edit")
print(f"{'original':20s} {'':>5} {'':>5} {'':>6} {np.mean([v['mos'] for v in R['orig'].values()]):.2f}")
for m, d in R.items():
    if m == "orig": continue
    v = list(d.values()); f = lambda k: np.nanmean([x[k] for x in v])
    print(f"{m:20s} {sum(x['ok'] for x in v)}/{len(v)}  {f('wer'):.3f} {f('sim'):.3f} {f('mos'):.2f} {f('sec'):.2f}")
