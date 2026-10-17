# One speech-editing backend per process (each model lives in its own venv). Usage: python editor_service.py <playdiff|auk|f5|dots> <port>
import sys, os, time, uuid, re, torch, soundfile as sf, numpy as np
from fastapi import FastAPI
import uvicorn
NAME, PORT = sys.argv[1], int(sys.argv[2]); GEN = "/workspace/app_data/gen"; os.makedirs(GEN, exist_ok=True)
app = FastAPI()
if NAME == "playdiff":
    from playdiffusion import PlayDiffusion, InpaintInput
    pd = PlayDiffusion()
    def edit(r):
        ws = [w["w"] for w in r["words"]]
        if r.get("same"):  # re-say the same words: mark them as changed so the diff-based inpainter regenerates them
            ws[r["i"]:r["j"] + 1] = ["zzz"] * (r["j"] - r["i"] + 1)
        wt = [dict(word=x, start=w["s"], end=w["e"]) for x, w in zip(ws, r["words"])]
        sr, a = pd.inpaint(InpaintInput(input_text=" ".join(ws), output_text=r["new_text"], input_word_times=wt, audio=r["path"]))
        return a.astype(np.float32) / 32768 if a.dtype == np.int16 else a, sr
elif NAME == "auk":
    sys.path.insert(0, "/workspace/repos/AuK/src"); os.chdir("/workspace/repos/AuK")
    from auk.infer.infer_auk import AukInfer
    eng = AukInfer("ckpts/AuK-Flash/config.yaml", "ckpts/AuK-Flash/auk_flash.safetensors")
    def run(instr, path, gen=None, seed=0):
        a, sr = eng.generate([{"role": "user", "content": [{"type": "text", "text": instr}, {"type": "audio", "audio": path}]}], gen_seconds=gen, seed=seed)
        return a.squeeze().numpy(), sr
    def edit(r):
        dur = sf.info(r["path"]).duration; old_d = r["words"][r["j"]]["e"] - r["words"][r["i"]]["s"]
        return run(f"Replace '{r['old']}' with '{r['new']}'.", r["path"], dur + r["new_dur"] - old_d, r.get("seed", 0))
    @app.post("/instruct")
    def instruct(r: dict):
        t = time.time(); a, sr = run(r["instruction"], r["path"], r.get("gen_seconds"), r.get("seed", 0))
        p = f"{GEN}/{uuid.uuid4().hex[:10]}.wav"; sf.write(p, a, sr); return dict(path=p, sr=sr, sec=time.time() - t)
elif NAME == "f5":
    sys.path.insert(0, "/workspace/lab"); from run_f5 import edit as f5edit, SR as F5SR
    def edit(r):
        w = r["words"]; s, e = w[r["i"]]["s"] - 0.02, w[r["j"]]["e"] + 0.02
        return f5edit(r["path"], r["new_text"], [[s, e]], [r["new_dur"] + 0.04], seed=r.get("seed", 0)).squeeze().numpy(), F5SR
elif NAME == "dots":
    from dots_tts.edit_runtime import DotsTtsEditRuntime
    from dots_tts.utils.util import seed_everything
    rt = DotsTtsEditRuntime.from_pretrained("dots-studio/dots.tts.edit", precision="bfloat16")
    def edit(r):
        ws = [w["w"] for w in r["words"]]; old = ws[r["i"]:r["j"] + 1]
        tail = re.sub(r"^.*?([.,!?;:]*)$", r"\1", old[-1]); old[-1] = old[-1][:len(old[-1]) - len(tail)] if tail else old[-1]
        instr = " ".join(ws[:r["i"]] + [f'<sub targ="{r["new"]}">{" ".join(old)}</sub>{tail}'] + ws[r["j"] + 1:])
        seed_everything(r.get("seed", 0)); o = rt.generate_edit(source_audio_path=r["path"], instruction=instr)
        return o["audio"].detach().cpu().squeeze().float().numpy(), o["sample_rate"]
@app.post("/edit")
def do_edit(r: dict):
    t = time.time(); a, sr = edit(r); torch.cuda.synchronize()
    p = f"{GEN}/{NAME}_{uuid.uuid4().hex[:10]}.wav"; sf.write(p, a, sr)
    return dict(path=p, sr=sr, sec=time.time() - t, model=NAME)
@app.get("/health")
def health(): return dict(ok=True, model=NAME)
if __name__ == "__main__": uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
