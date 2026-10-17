import sys, time, json, os, soundfile as sf, torch
sys.path.insert(0, "/workspace/lab"); from jobs import jobs
from playdiffusion import PlayDiffusion, InpaintInput
pd = PlayDiffusion(); out = "/workspace/out/playdiff"; os.makedirs(out, exist_ok=True); log = {}
for j in jobs():
    wt = [dict(word=w["w"], start=w["s"], end=w["e"]) for w in j["words"]]
    torch.cuda.synchronize(); t = time.time()
    sr, a = pd.inpaint(InpaintInput(input_text=j["text"], output_text=j["new_text"], input_word_times=wt, audio=j["path"]))
    torch.cuda.synchronize(); dt = time.time() - t
    sf.write(f"{out}/{j['id']}.wav", a, sr); log[j["id"]] = dict(sec=dt, sr=sr); print(j["id"], f"{dt:.2f}s", sr, flush=True)
print("peak GB", torch.cuda.max_memory_allocated() / 1e9)
json.dump(log, open(f"{out}/log.json", "w"))
