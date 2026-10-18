# Speaker similarity on CPU with the engine's own ECAPA checkpoint (same embed() as app.py, but device=cpu; the GPU is not touched).
# Usage (on the pod): CUDA_VISIBLE_DEVICES= python ecapa_cpu.py <dir> <pairs.json> <out.json>
import os, sys, json
os.environ["CUDA_VISIBLE_DEVICES"] = ""
import torch, librosa, soundfile as sf
torch.set_num_threads(4)
from speechbrain.inference.speaker import EncoderClassifier
d, pairs_p, out_p = sys.argv[1:4]
spk = EncoderClassifier.from_hparams(source="/workspace/hf/ecapa", savedir=os.path.join(d, "ecapa_cpu"), run_opts={"device": "cpu"})
def embed(p):
    x, sr = sf.read(p, dtype="float32"); x = x.mean(1) if x.ndim > 1 else x
    x16 = librosa.resample(x, orig_sr=sr, target_sr=16000)
    with torch.no_grad(): return torch.nn.functional.normalize(spk.encode_batch(torch.tensor(x16)[None].float())[0, 0], dim=0)
cache = {}
E = lambda f: cache.setdefault(f, embed(os.path.join(d, f)))
res = {f"{a}|{b}": round(float(E(a) @ E(b)), 3) for a, b in json.load(open(pairs_p))}
json.dump(res, open(out_p, "w"), indent=1); print(json.dumps(res, indent=1))
