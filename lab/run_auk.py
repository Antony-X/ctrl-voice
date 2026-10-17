import sys, time, json, os, soundfile as sf, torch
sys.path.insert(0, "/workspace/lab"); from jobs import jobs
from auk.infer.infer_auk import AukInfer, save_audio
variant = sys.argv[1]  # base | flash
ck = dict(base=("ckpts/AuK/config.yaml", "ckpts/AuK/auk_base.safetensors"), flash=("ckpts/AuK-Flash/config.yaml", "ckpts/AuK-Flash/auk_flash.safetensors"))[variant]
os.chdir("/workspace/repos/AuK"); eng = AukInfer(*ck)
out = f"/workspace/out/auk_{variant}"; os.makedirs(out, exist_ok=True); log = {}
for j in jobs():
    dur = sf.info(j["path"]).duration; gen = dur + j["new_dur"] - (j["t1"] - j["t0"])
    msg = [{"role": "user", "content": [{"type": "text", "text": f"Replace '{j['old']}' with '{j['new']}'."}, {"type": "audio", "audio": j["path"]}]}]
    torch.cuda.synchronize(); t = time.time()
    a, sr = eng.generate(msg, gen_seconds=gen, seed=0)
    torch.cuda.synchronize(); dt = time.time() - t
    save_audio(a, sr, f"{out}/{j['id']}.wav"); log[j["id"]] = dict(sec=dt, sr=sr, gen=gen)
    print(j["id"], f"{dt:.2f}s", sr, flush=True)
print("peak GB", torch.cuda.max_memory_allocated() / 1e9)
json.dump(log, open(f"{out}/log.json", "w"))
