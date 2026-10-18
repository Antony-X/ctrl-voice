# Step-1 figure data, computed with the engine's own code (lost_fillers/transcribe copied from app.py via ast) on CPU,
# so it doesn't touch the GPU the live engine is using.
import ast, sys, json, re, difflib, numpy as np, torch, librosa
torch.set_num_threads(16)               # the pod has 32 vCPUs; leave half for the live engine
sys.path.insert(0, "/workspace/app"); sys.path.insert(0, "/workspace/lab")
torch.nn.Module.cuda = lambda self, *a, **k: self      # align.py moves its model to the GPU at import: keep it on CPU
torch.nn.Module.half = lambda self, *a, **k: self
import align as A
def emissions(x16):
    with torch.inference_mode():
        return torch.log_softmax(A.net(torch.tensor(x16, dtype=torch.float32)[None]).logits[0].float(), -1).numpy()
from faster_whisper import WhisperModel
src = open("/workspace/app/app.py").read(); tree = ast.parse(src)
ns = dict(re=re, difflib=difflib, np=np, librosa=librosa, spell=A.spell, CTC_V=A.V, CTC_BLANK=A.BLANK, align=A.align, emissions=emissions, SR=24000)
for node in tree.body:
    if isinstance(node, ast.Assign) and any(getattr(t, "id", "") in ("CTC_FILL", "CTC_INV", "PROMPT") for t in node.targets):
        exec(compile(ast.Module([node], []), "app.py", "exec"), ns)
    if isinstance(node, ast.FunctionDef) and node.name in ("lost_fillers", "transcribe"):
        exec(compile(ast.Module([node], []), "app.py", "exec"), ns)
ns["asr"] = WhisperModel("large-v3-turbo", device="cpu", compute_type="float32", cpu_threads=16)
out = {}
for name in sys.argv[1:]:
    x, _ = librosa.load(name, sr=24000); x16 = librosa.resample(x, orig_sr=24000, target_sr=16000)
    segs, _ = ns["asr"].transcribe(x16, language="en", word_timestamps=True, initial_prompt=ns["PROMPT"], beam_size=5, condition_on_previous_text=False)
    raw = [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 2)) for s in segs for w in s.words if w.word.strip()]
    em = emissions(x16); fs = len(x16) / 16000 / em.shape[0]
    lost = ns["lost_fillers"](em, raw, fs)
    final = ns["transcribe"](x, 5, True)
    inv = {v: k for k, v in A.V.items()}; path, prev = [], None   # greedy CTC path: one entry per emitted character
    for t, c in enumerate(em.argmax(-1)):
        if c != prev and c != A.BLANK: path.append([inv[c], round(t * fs, 3)])
        prev = c
    out[name] = dict(raw=raw, lost=[dict(k=k, spelled=t, s=s, e=e) for k, t, s, e in lost], final=final, path=path, fs=fs, dur=len(x) / 24000,
                     em=np.round(em, 2).tolist(), vocab=[inv[i] for i in range(em.shape[1])], blank=A.BLANK)   # log-posteriors per 20 ms frame, for the trellis figure
    print(name, "| whisper:", " ".join(w["w"] for w in raw)); print("  lost:", lost); print("  ctc:", "".join(p[0] for p in path).replace("|", " "))
json.dump(out, open("/tmp/deckfig/step1.json", "w"))
