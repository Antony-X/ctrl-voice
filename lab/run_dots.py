import sys, time, json, os, re, soundfile as sf, torch
sys.path.insert(0, "/workspace/lab"); from jobs import jobs
from dots_tts.edit_runtime import DotsTtsEditRuntime
from dots_tts.utils.util import seed_everything
rt = DotsTtsEditRuntime.from_pretrained("dots-studio/dots.tts.edit", precision="bfloat16")
out = "/workspace/out/dots"; os.makedirs(out, exist_ok=True); log = {}
for j in jobs():
    ws = [w["w"] for w in j["words"]]; old = ws[j["i"]:j["j"] + 1]
    tail = re.sub(r"^.*?([.,!?;:]*)$", r"\1", old[-1]); old[-1] = old[-1][: len(old[-1]) - len(tail)] if tail else old[-1]
    instr = " ".join(ws[:j["i"]] + [f'<sub targ="{j["new"]}">{" ".join(old)}</sub>{tail}'] + ws[j["j"] + 1:])
    seed_everything(0); torch.cuda.synchronize(); t = time.time()
    r = rt.generate_edit(source_audio_path=j["path"], instruction=instr)
    torch.cuda.synchronize(); dt = time.time() - t
    sf.write(f"{out}/{j['id']}.wav", r["audio"].detach().cpu().squeeze().float().numpy(), r["sample_rate"])
    log[j["id"]] = dict(sec=dt, sr=r["sample_rate"], instr=instr); print(j["id"], f"{dt:.2f}s", instr, flush=True)
print("peak GB", torch.cuda.max_memory_allocated() / 1e9)
json.dump(log, open(f"{out}/log.json", "w"))
