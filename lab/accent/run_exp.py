# Run the accent pipeline on the chosen EdAcc segments; save original / native_tts / converted wavs + timings.
import sys, os, json, time, shutil
sys.path.insert(0, "/workspace/app")
import numpy as np, soundfile as sf, torch
from accent_service import AccentConverter

PICK = {"russian_C24A": "russian_EDACC-C24-A_3_89", "indian_C09B": "indian_EDACC-C09-B_4_40", "native_C07A": "native_EDACC-C07-A_3_69"}
OUT = os.environ.get("OUT", "/workspace/accent/out"); os.makedirs(OUT, exist_ok=True)
t0 = time.time()
conv = AccentConverter(vc_steps=int(os.environ.get("VC_STEPS", 25)), ref_mode=os.environ.get("REF_MODE", "nearest"))
load_s = time.time() - t0
print("load s", load_s, "alloc MB", torch.cuda.memory_allocated() / 2**20, flush=True)
# warm-up (cudnn / caches)
conv.convert("/workspace/accent/cands/" + PICK["native_C07A"] + ".wav", text="Warm up run.")
torch.cuda.reset_peak_memory_stats()
log = dict(load_s=load_s)
for name, cand in PICK.items():
    src = f"/workspace/accent/cands/{cand}.wav"
    shutil.copy(src, f"{OUT}/{name}_original.wav")
    r = conv.convert(src, out_path=f"{OUT}/{name}_converted.wav", seed=0)
    sf.write(f"{OUT}/{name}_native_tts.wav", r["tts_wav"], r["tts_sr"])
    log[name] = dict(cand=cand, text=r["text"], gender=r["gender"], native_ref=r["native_ref"], ref_sim=r["ref_sim"], dur=r["dur"],
                     times={k: round(v, 3) for k, v in r["times"].items()})
    print(name, log[name], flush=True)
log["peak_alloc_mb"] = torch.cuda.max_memory_allocated() / 2**20
log["peak_reserved_mb"] = torch.cuda.max_memory_reserved() / 2**20
print("peak MB", log["peak_alloc_mb"], log["peak_reserved_mb"])
os.system("nvidia-smi --query-compute-apps=pid,used_memory --format=csv | grep %d" % os.getpid())
json.dump(log, open(f"{OUT}/run_log.json", "w"), indent=1)
