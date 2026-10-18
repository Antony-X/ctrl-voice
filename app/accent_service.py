# Accent conversion that keeps the speaker's voice.
#   accented wav --faster-whisper--> text --F5-TTS (native LibriSpeech ref)--> native speech
#   --Seed-VC (target = original clip)--> native pronunciation in the speaker's timbre.
# Run: HF_HOME=/workspace/hf /workspace/envs/accent/.venv/bin/python /workspace/app/accent_service.py 8106
import os, sys, time, json

os.environ.setdefault("HF_HOME", "/workspace/hf")
SEEDVC_DIR = "/workspace/envs/accent/seed-vc"
REF_DIR = "/workspace/accent/refs"
sys.path.insert(0, SEEDVC_DIR)

# Seed-VC only needs dac.nn.quantize/layers; bypass dac/__init__.py and dac/nn/__init__.py (they import audiotools).
import types
for _name, _sub in (("dac", "dac"), ("dac.nn", "dac/nn")):
    _m = types.ModuleType(_name); _m.__path__ = [os.path.join(SEEDVC_DIR, _sub)]; sys.modules[_name] = _m

import numpy as np
import soundfile as sf
import librosa
import torch
import torchaudio
import yaml
from huggingface_hub import hf_hub_download

# Native-English F5 references (LibriSpeech test-clean, CC BY 4.0), gender-matched to the target by median F0.
NATIVE_REFS = {
    "male": ("ls_4077-13754-0009.wav", "At the inception of plural marriage among the latter day saints there was no law national or state against its practise."),
    "female": ("ls_5683-32879-0000.wav", "It was not very much past eleven that morning when the pony carriage from Brandon drew up before the little garden wicket of Redman's farm."),
}
# Pool of LibriSpeech refs for "nearest native voice" selection (ref_mode="nearest"; measured: no gain, so default is "gender"): the native TTS voice closest to the
# target speaker (CAMPPlus cosine) gives Seed-VC an easier timbre gap.
def load_ref_pool():
    meta = json.load(open(os.path.join(REF_DIR, "ls_refs.json")))
    return [(f"ls_{m['id']}.wav", m["text"].lower().capitalize() + ".") for m in meta.values()]


def median_f0(wav, sr):
    f0 = librosa.yin(wav.astype(np.float32), fmin=60, fmax=400, sr=sr)
    return float(np.median(f0))


class SeedVC:
    """Minimal non-streaming port of seed_vc_wrapper.SeedVCWrapper.convert_voice (22.05 kHz, no-F0 model)."""

    def __init__(self, device):
        from modules.commons import build_model, load_checkpoint, recursive_munch
        from modules.campplus.DTDNN import CAMPPlus
        from modules.bigvgan import bigvgan
        from modules.audio import mel_spectrogram
        from transformers import AutoFeatureExtractor, WhisperModel

        self.device = device
        ckpt = hf_hub_download("Plachta/Seed-VC", "DiT_seed_v2_uvit_whisper_small_wavenet_bigvgan_pruned.pth")
        cfg_path = hf_hub_download("Plachta/Seed-VC", "config_dit_mel_seed_uvit_whisper_small_wavenet.yml")
        config = yaml.safe_load(open(cfg_path))
        mp = recursive_munch(config["model_params"])
        self.model = build_model(mp, stage="DiT")
        self.model, _, _, _ = load_checkpoint(self.model, None, ckpt, load_only_params=True, ignore_modules=[], is_distributed=False)
        for k in self.model:
            self.model[k].eval().to(device)
        self.model.cfm.estimator.setup_caches(max_batch_size=1, max_seq_length=8192)
        sp = config["preprocess_params"]["spect_params"]
        self.sr = config["preprocess_params"]["sr"]
        self.hop = sp["hop_length"]
        mel_args = dict(n_fft=sp["n_fft"], win_size=sp["win_length"], hop_size=sp["hop_length"], num_mels=sp["n_mels"],
                        sampling_rate=self.sr, fmin=0, fmax=None, center=False)
        self.to_mel = lambda x: mel_spectrogram(x, **mel_args)
        wname = getattr(mp.speech_tokenizer, "whisper_name", "openai/whisper-small")
        self.whisper = WhisperModel.from_pretrained(wname, torch_dtype=torch.float16).to(device)
        del self.whisper.decoder
        self.wfe = AutoFeatureExtractor.from_pretrained(wname)
        camp = hf_hub_download("funasr/campplus", "campplus_cn_common.bin")
        self.campplus = CAMPPlus(feat_dim=80, embedding_size=192)
        self.campplus.load_state_dict(torch.load(camp, map_location="cpu"))
        self.campplus.eval().to(device)
        self.vocoder = bigvgan.BigVGAN.from_pretrained("nvidia/bigvgan_v2_22khz_80band_256x", use_cuda_kernel=False)
        self.vocoder.remove_weight_norm()
        self.vocoder = self.vocoder.eval().to(device)

    @torch.inference_mode()
    def style_emb(self, wav, sr):
        a16 = torch.tensor(librosa.resample(wav, orig_sr=sr, target_sr=16000)).float()[None].to(self.device)
        fb = torchaudio.compliance.kaldi.fbank(a16, num_mel_bins=80, dither=0, sample_frequency=16000)
        e = self.campplus((fb - fb.mean(0, keepdim=True))[None])[0]
        return torch.nn.functional.normalize(e, dim=0)

    def _whisper_feats(self, a16):
        # a16: (1, T) at 16 kHz; chunked like the original wrapper for > 30 s
        if a16.size(-1) <= 16000 * 30:
            chunks, keep = [a16], [None]
        else:
            chunks, keep, t, buf = [], [], 0, None
            while t < a16.size(-1):
                c = a16[:, t:t + 16000 * 30] if buf is None else torch.cat([buf, a16[:, t:t + 16000 * 25]], -1)
                chunks.append(c); keep.append(None if buf is None else 50 * 5)
                buf = c[:, -16000 * 5:]
                t += 16000 * 30 if t == 0 else c.size(-1) - 16000 * 5
        feats = []
        for c, k in zip(chunks, keep):
            inp = self.wfe([c.squeeze(0).cpu().numpy()], return_tensors="pt", return_attention_mask=True, sampling_rate=16000)
            x = self.whisper._mask_input_features(inp.input_features, attention_mask=inp.attention_mask).to(self.device)
            h = self.whisper.encoder(x.to(self.whisper.encoder.dtype), return_dict=True).last_hidden_state.float()
            h = h[:, :c.size(-1) // 320 + 1]
            feats.append(h if k is None else h[:, k:])
        return torch.cat(feats, 1)

    @torch.inference_mode()
    def convert(self, source_wav, source_sr, ref_wav, ref_sr, steps=25, cfg_rate=0.7):
        sr = self.sr
        src = torch.tensor(librosa.resample(source_wav, orig_sr=source_sr, target_sr=sr)).float()[None].to(self.device)
        ref = torch.tensor(librosa.resample(ref_wav, orig_sr=ref_sr, target_sr=sr)[: sr * 25]).float()[None].to(self.device)
        ref16 = torchaudio.functional.resample(ref, sr, 16000)
        src16 = torchaudio.functional.resample(src, sr, 16000)
        S_alt, S_ori = self._whisper_feats(src16), self._whisper_feats(ref16)
        mel, mel2 = self.to_mel(src), self.to_mel(ref)
        fb = torchaudio.compliance.kaldi.fbank(ref16, num_mel_bins=80, dither=0, sample_frequency=16000)
        style = self.campplus((fb - fb.mean(0, keepdim=True))[None])
        cond = self.model.length_regulator(S_alt, ylens=torch.LongTensor([mel.size(2)]).to(self.device), n_quantizers=3, f0=None)[0]
        prompt = self.model.length_regulator(S_ori, ylens=torch.LongTensor([mel2.size(2)]).to(self.device), n_quantizers=3, f0=None)[0]
        max_src = sr // self.hop * 30 - mel2.size(2)
        overlap, ov_wave = 16, 16 * self.hop
        out, done, prev = [], 0, None
        while done < cond.size(1):
            chunk = cond[:, done:done + max_src]
            last = done + max_src >= cond.size(1)
            cat = torch.cat([prompt, chunk], 1)
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                vc = self.model.cfm.inference(cat, torch.LongTensor([cat.size(1)]).to(self.device), mel2, style, None, steps,
                                              inference_cfg_rate=cfg_rate)[:, :, mel2.size(-1):]
            w = self.vocoder(vc.float())[0][0].cpu().numpy()
            if prev is not None:  # crossfade with previous chunk tail
                fo, fi = np.cos(np.linspace(0, np.pi / 2, ov_wave)) ** 2, np.cos(np.linspace(np.pi / 2, 0, ov_wave)) ** 2
                w[:ov_wave] = w[:ov_wave] * fi + prev * fo
            if last:
                out.append(w); break
            out.append(w[:-ov_wave]); prev = w[-ov_wave:]
            done += vc.size(2) - overlap
        return np.concatenate(out), sr


class AccentConverter:
    def __init__(self, device="cuda", vc_steps=25, ref_mode="gender"):
        from faster_whisper import WhisperModel
        from f5_tts.api import F5TTS
        self.device, self.vc_steps, self.ref_mode = device, vc_steps, ref_mode
        self.asr = WhisperModel("large-v3-turbo", device=device, compute_type="float16")
        self.tts = F5TTS(model="F5TTS_v1_Base", device=device)
        self.vc = SeedVC(device)
        self.pool = load_ref_pool()
        self.pool_emb = torch.stack([self.vc.style_emb(*sf.read(os.path.join(REF_DIR, f), dtype="float32")) for f, _ in self.pool])

    def pick_ref(self, x, sr):
        if self.ref_mode == "nearest":
            sims = self.pool_emb @ self.vc.style_emb(x, sr)
            i = int(sims.argmax())
            return self.pool[i][0], self.pool[i][1], "nearest", float(sims[i])
        gender = "male" if median_f0(x, sr) < 165 else "female"
        return NATIVE_REFS[gender][0], NATIVE_REFS[gender][1], gender, None

    def transcribe(self, wav16):
        segs, _ = self.asr.transcribe(wav16, language="en", beam_size=5, vad_filter=False)
        return " ".join(s.text.strip() for s in segs).strip()

    def convert(self, wav_path, text=None, out_path=None, seed=0):
        t = {}
        x, sr = sf.read(wav_path, dtype="float32")
        if x.ndim > 1:
            x = x.mean(1)
        t0 = time.time()
        x16 = librosa.resample(x, orig_sr=sr, target_sr=16000) if sr != 16000 else x
        ref_file, ref_text, gender, ref_sim = self.pick_ref(x16, 16000)
        t["prep"] = time.time() - t0
        t0 = time.time()
        if not text:
            text = self.transcribe(x16)
        t["asr"] = time.time() - t0
        t0 = time.time()
        tts_wav, tts_sr, _ = self.tts.infer(os.path.join(REF_DIR, ref_file), ref_text, text, show_info=lambda *a: None,
                                            progress=None, nfe_step=32, speed=1.0, seed=seed)
        torch.cuda.synchronize(); t["tts"] = time.time() - t0
        t0 = time.time()
        y, ysr = self.vc.convert(np.asarray(tts_wav, dtype=np.float32), tts_sr, x, sr, steps=self.vc_steps)
        torch.cuda.synchronize(); t["vc"] = time.time() - t0
        if out_path:
            sf.write(out_path, y, ysr)
        return dict(out=out_path, dur=len(y) / ysr, text=text, gender=gender, native_ref=ref_file, ref_sim=ref_sim,
                    tts_wav=np.asarray(tts_wav, dtype=np.float32), tts_sr=tts_sr, wav=y, sr=ysr, times=t)


def serve(port):
    import uvicorn
    from fastapi import FastAPI, HTTPException
    app = FastAPI()
    conv = AccentConverter()
    conv.convert(os.path.join(REF_DIR, NATIVE_REFS["male"][0]), text=None, out_path=None)  # warm-up (ASR + TTS + VC)
    torch.cuda.reset_peak_memory_stats()

    @app.post("/accent")
    def accent(r: dict):
        if not r.get("wav") or not os.path.exists(r["wav"]):
            raise HTTPException(400, "wav path missing or not found")
        out = r.get("out") or os.path.splitext(r["wav"])[0] + "_native.wav"
        t0 = time.time()
        res = conv.convert(r["wav"], text=r.get("text"), out_path=out, seed=int(r.get("seed", 0)))
        return dict(out=out, dur=round(res["dur"], 3), text=res["text"], ms=round(1000 * (time.time() - t0)),
                    steps_ms={k: round(1000 * v) for k, v in res["times"].items()})

    @app.get("/health")
    def health():
        return dict(ok=True, model="accent: faster-whisper large-v3-turbo + F5TTS_v1_Base + Seed-VC whisper_small_wavenet",
                    gpu_mem_alloc_mb=round(torch.cuda.memory_allocated() / 2**20),
                    gpu_mem_peak_mb=round(torch.cuda.max_memory_allocated() / 2**20))

    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    serve(int(sys.argv[1]) if len(sys.argv) > 1 else 8106)
