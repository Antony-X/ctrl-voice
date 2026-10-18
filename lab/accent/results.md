# Accent conversion that keeps the speaker's voice: prototype results

**Verdict:** works on the metrics for the Russian-L1 speaker. Partial for the Indian speaker: the accent is gone and the words are intact, but voice similarity is only about half of the same-speaker ceiling. I did not listen to any of the audio, so everything below comes from metrics. Someone needs to listen before the demo.

## Method (pretrained only, nothing trained)
1. **ASR**: faster-whisper `large-v3-turbo` (fp16, beam 5, language=en) transcribes the accented clip. You can pass your own transcript instead.
2. **Native TTS**: F5-TTS `F5TTS_v1_Base` (32 NFE, speed 1.0) speaks that text, zero-shot, from a native read-speech reference picked by gender (median F0 < 165 Hz means male):
   - male: LibriSpeech test-clean `4077-13754-0009`
   - female: LibriSpeech test-clean `5683-32879-0000`
3. **VC**: Seed-VC (`DiT_seed_v2_uvit_whisper_small_wavenet_bigvgan_pruned`, 22.05 kHz, no F0 conditioning, 25 diffusion steps, cfg 0.7). Its source is the native TTS and its target timbre reference is the speaker's own original clip. The output is a 22.05 kHz wav.

Seed-VC code: the GitHub repo `Plachta/seed-vc` now returns 404, so I used the code in the HF Space `Plachta/Seed-VC` (commit `84a7891`, 2025-04-18). That code is a vendored `dac` package whose `__init__` imports `audiotools`; I worked around this with a module shim instead of installing audiotools. Weights come from HF `Plachta/Seed-VC`.

## Models and data, with licenses
| part | source | license |
|---|---|---|
| ASR | mobiuslabsgmbh/faster-whisper-large-v3-turbo (Whisper large-v3-turbo) | Whisper is MIT. I did not re-check the mobiuslabs card. |
| TTS | SWivid/F5-TTS F5TTS_v1_Base + charactr/vocos-mel-24khz | **F5 weights are CC-BY-NC-4.0 (non-commercial)**; the code is MIT |
| VC | Plachta/Seed-VC weights + HF Space code | **GPL-3.0** |
| VC parts | openai/whisper-small encoder, funasr/campplus (Apache-2.0), nvidia/bigvgan_v2_22khz_80band_256x (MIT) | as listed |
| native refs | LibriSpeech test-clean (openslr/librispeech_asr) | CC BY 4.0 |
| test speakers | EdAcc (edinburghcstr/edacc), validation split | the HF card states no license; check the EdAcc homepage before public use |
| eval only | speechbrain/spkrec-ecapa-voxceleb (Apache-2.0), Jzuluaga/accent-id-commonaccent_ecapa (MIT) | |

## Test speakers (real EdAcc recordings, single segments, not concatenated)
| tag | EdAcc speaker | gender | L1 (linguist) | accent label | segment (validation) | dur |
|---|---|---|---|---|---|---|
| russian_C24A | EDACC-C24-A | male | Russian | "Don't know" | EDACC-C24-308.wav (validation-00002 parquet, rg 3, row 89) | 14.80 s |
| indian_C09B | EDACC-C09-B | female | Indian English | Indian English (self: "Indian") | EDACC-C09-6.wav (validation-00000, rg 4, row 40) | 14.86 s |
| native_C07A (control) | EDACC-C07-A | male | Mainstream US English | Mainstream US English | EDACC-C07-197.wav (validation-00000, rg 3, row 69) | 12.16 s |

- EDACC-C24-A is the only Russian-L1 speaker in EdAcc validation. The test split has no Russian speaker at all.
- Both Indian-labelled validation speakers are C09-A and C09-B. I picked C09-B.
- I chose segments with no `<overlap>`/`<laugh>`-style tags. I did not listen for crosstalk. The ASR of each original matches the EdAcc reference text closely (WER 0–0.10), so the segments are not heavily mixed.

## Metrics (final config)
- **Speaker similarity** is ECAPA cosine to the mean embedding of **3 held-out EdAcc clips of the same speaker**, i.e. different segments from the one fed to the VC:
  - Russian: C24-29/49/73
  - Indian: C09-26/60/72
  - native: C07-39/73/141
- **"Donor sim"** is the cosine to the LibriSpeech voice F5 used.
- **WER** is computed after lowercasing and removing punctuation and fillers. "Original" is scored against the EdAcc reference. TTS and converted are scored against the pipeline text (the ASR transcript of the original).
- **Accent-ID**: the CommonAccent ECAPA head outputs **cosine scores, not probabilities**. I report the top-1 class plus the raw cosines for `indian` and `us`. The model has no Russian class.

| speaker | version | dur s | WER | spk sim (held-out) | sim to fed clip | donor sim | accent top-1 | cos indian | cos us |
|---|---|---|---|---|---|---|---|---|---|
| russian | original | 14.80 | 0.100 | **0.900** (ceiling) | 1.000 | -0.117 | england | -0.010 | 0.366 |
| russian | native TTS | 13.21 | 0.020 | -0.123 | -0.181 | 0.801 | us | 0.110 | 0.630 |
| russian | **converted** | 13.20 | 0.041 | **0.635** | 0.597 | -0.072 | us | 0.161 | 0.594 |
| indian | original | 14.86 | 0.057 | **0.759** (ceiling) | 1.000 | 0.073 | **indian** | 0.701 | 0.456 |
| indian | native TTS | 9.75 | 0.029 | 0.057 | 0.092 | 0.865 | us | 0.217 | 0.653 |
| indian | **converted** | 9.74 | 0.000 | **0.331** | 0.473 | 0.180 | **us** | 0.271 | 0.725 |
| native ctrl | original | 12.16 | 0.000 | 0.775 (ceiling) | 1.000 | -0.039 | indian (!) | 0.563 | 0.359 |
| native ctrl | native TTS | 10.51 | 0.026 | -0.047 | 0.008 | 0.829 | us | 0.056 | 0.705 |
| native ctrl | converted | 10.50 | 0.077 | 0.712 | 0.827 | 0.008 | us | 0.313 | 0.592 |

What the numbers show:
- **Timbre comes back.** VC raises held-out speaker similarity over the plain native TTS in every case: Russian -0.12 → 0.64, Indian 0.06 → 0.33, native control -0.05 → 0.71. The donor voice mostly disappears (donor sim 0.80 → -0.07 for Russian; 0.87 → 0.18 for Indian, so some donor remains there).
- **Pronunciation stays native after VC, by the accent-ID proxy.** For the Indian speaker, `cos indian` goes 0.70 → 0.27 and top-1 goes indian → us; the TTS alone gives 0.22. So VC brings back very little of the accent.
- **The words survive.** Converted WER is 0–0.08.
- **The accent-ID proxy is unreliable here.** It labels the native US control's original as "indian", and it has no Russian class, so the Russian before/after accent numbers mean little. EdAcc is Zoom conversational audio, outside this classifier's CommonVoice training domain.
- **Indian speaker is only a partial success.** 0.33 against a 0.76 ceiling. Treat it as "sounds somewhat like her", not "clearly her", until someone listens.

## Variants tried (negative results)
Converted held-out speaker similarity, Russian / Indian:
| config | russian | indian |
|---|---|---|
| **gender-matched fixed ref, 25 steps (final)** | **0.635** | **0.331** |
| nearest of 11 LibriSpeech refs by CAMPPlus similarity, 25 steps | 0.560 | 0.330 |
| nearest ref, 50 steps | 0.559 | 0.315 |

Neither variant helped. The service keeps the gender-matched config. `ref_mode="nearest"` is still in the code.

## Latency (A100 80 GB, shared with the live vLLM/TTS stack)
Service steady state on the 14.8 s Russian clip, 4 repeated calls:

| step | time |
|---|---|
| prep (load + resample + F0) | ~0.03 s |
| ASR | 0.28–0.31 s |
| F5 TTS | 0.89–1.00 s |
| Seed-VC | 0.97–1.04 s |
| **total** | **2.2–2.4 s** |

- The first requests after startup were slower: the first call took 8.2 s (ASR 3.3 s, VC 3.1 s), probably warm-up plus GPU contention from the other services.
- Model load is about 22 s.
- With the text supplied, ASR is skipped (about 1.7 s for a 5.6 s output).

## GPU memory
- The service process (PID 18913) uses **5.38–5.50 GB** per nvidia-smi. That covers torch peak allocation of 2.26 GB, the CTranslate2 Whisper, and the CUDA context, so it fits under 6 GB.
- Pod total was 71.7 GB before and about 78.1 GB with the service running.

## Service
- `http://<pod>:8106` runs `/workspace/app/accent_service.py` in `/workspace/envs/accent/.venv`, logs to `/workspace/logs/accent.log`, and loads its models once at startup.
- `POST /accent` takes JSON `{"wav": "/path/on/pod.wav", "text": "<optional transcript>", "out": "/path/out.wav", "seed": 0}`.
  - It returns `{"out", "dur", "text", "ms", "steps_ms": {"prep","asr","tts","vc"}}`.
  - A missing wav returns HTTP 400.
- `GET /health` returns `{"ok", "model", "gpu_mem_alloc_mb", "gpu_mem_peak_mb"}`.

## Caveats / what failed
- **Rhythm and intonation come from the native TTS donor, not the speaker.** Outputs are shorter: 14.9 s → 9.7 s for the Indian clip, because fillers drop out and the pace is native reading pace. It sounds like read speech, not conversation.
- **ASR errors carry through.** "Ullapool" was heard as "La Pule", so the TTS says "La Pule". Pass `text` to fix this. Fillers and false starts that Whisper keeps are spoken too ("I would actually, I would say, you know").
- Setup fixes along the way:
  - The GitHub Seed-VC repo is gone, so I used the HF Space.
  - `datasets 2.14` broke on pyarrow 26; upgraded to `datasets 4.1.1`.
  - Bypassed the `audiotools` import with a shim.
- **Licenses:** F5 weights are non-commercial and Seed-VC is GPL-3.0. That is fine for a hackathon demo, not for a product.

## Files
- Here:
  - `{russian_C24A,indian_C09B,native_C07A}_{original,native_tts,converted}.wav`
  - `metrics.json`, `run_log.json`, `variants_nearest_ref/metrics_near25.json`
  - `accent_service.py` (the service), plus `run_exp.py`, `metrics.py`, `edacc_scan.py`, `edacc_pick.py`, `ls_refs.py`
- On the pod:
  - `/workspace/accent/` holds out*, cands, refs, the scripts and sb_* eval caches
  - `/workspace/envs/accent/` holds .venv and seed-vc
  - `/workspace/app/accent_service.py`
  - `/workspace/logs/accent*.log`
