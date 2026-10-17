# F5-TTS mel infilling (same logic as f5_tts/infer/speech_edit.py, wrapped for batch jobs)
import sys, time, json, os, torch, torchaudio, torch.nn.functional as F
sys.path.insert(0, "/workspace/lab"); from jobs import jobs
from importlib.resources import files
from cached_path import cached_path
from hydra.utils import get_class
from omegaconf import OmegaConf
from f5_tts.infer.utils_infer import load_checkpoint, load_vocoder
from f5_tts.model import CFM
from f5_tts.model.utils import get_tokenizer
dev = "cuda"; exp = "F5TTS_v1_Base"
cfg = OmegaConf.load(str(files("f5_tts").joinpath(f"configs/{exp}.yaml"))); mc = cfg.model.mel_spec
voc = load_vocoder(vocoder_name=mc.mel_spec_type)
vmap, vsize = get_tokenizer(cfg.datasets.name, cfg.model.tokenizer)
model = CFM(transformer=get_class(f"f5_tts.model.{cfg.model.backbone}")(**cfg.model.arch, text_num_embeds=vsize, mel_dim=mc.n_mel_channels),
            mel_spec_kwargs=dict(n_fft=mc.n_fft, hop_length=mc.hop_length, win_length=mc.win_length, n_mel_channels=mc.n_mel_channels,
                                 target_sample_rate=mc.target_sample_rate, mel_spec_type=mc.mel_spec_type),
            odeint_kwargs=dict(method="euler"), vocab_char_map=vmap).to(dev)
model = load_checkpoint(model, str(cached_path(f"hf://SWivid/F5-TTS/{exp}/model_1250000.safetensors")), dev, use_ema=True)
SR, HOP = mc.target_sample_rate, mc.hop_length
def edit(path, text, parts, durs, nfe=32, seed=0):
    a, sr = torchaudio.load(path); a = a.mean(0, keepdim=True)
    rms = a.square().mean().sqrt(); a = a * (0.1 / rms) if rms < 0.1 else a
    a = torchaudio.functional.resample(a, sr, SR).to(dev)
    with torch.inference_mode():
        mel = model.mel_spec(a).permute(0, 2, 1)
        cond, mask, off = mel[:, :0], torch.zeros(1, 0, dtype=torch.bool, device=dev), 0
        for (s, e), d in zip(parts, durs):
            sf_, ef, df = round(s * SR / HOP), round(e * SR / HOP), round(d * SR / HOP)
            cond = torch.cat([cond, mel[:, off:sf_], torch.zeros(1, df, mel.shape[2], device=dev)], 1)
            mask = torch.cat([mask, torch.ones(1, sf_ - off, dtype=torch.bool, device=dev), torch.zeros(1, df, dtype=torch.bool, device=dev)], -1)
            off = ef
        cond = torch.cat([cond, mel[:, off:]], 1); mask = F.pad(mask, (0, cond.shape[1] - mask.shape[1]), value=True)
        gen, _ = model.sample(cond=cond, text=[text], duration=cond.shape[1], steps=nfe, cfg_strength=2.0, sway_sampling_coef=-1.0, seed=seed, edit_mask=mask)
        w = voc.decode(gen.float().permute(0, 2, 1)).cpu()
    return w * (rms / 0.1) if rms < 0.1 else w
if __name__ == "__main__":
    out = "/workspace/out/f5"; os.makedirs(out, exist_ok=True); log = {}
    for j in jobs():
        torch.cuda.synchronize(); t = time.time()
        w = edit(j["path"], j["new_text"], [[j["t0"] - 0.03, j["t1"] + 0.03]], [j["new_dur"] + 0.06])
        torch.cuda.synchronize(); dt = time.time() - t
        torchaudio.save(f"{out}/{j['id']}.wav", w, SR); log[j["id"]] = dict(sec=dt, sr=SR); print(j["id"], f"{dt:.2f}s", flush=True)
    print("peak GB", torch.cuda.max_memory_allocated() / 1e9)
    json.dump(log, open(f"{out}/log.json", "w"))
