# ReSpeak supporting model stack: zero-shot voice-cloning TTS, voice conversion, ASR with word timestamps, VAD and forced alignment (state as of 2026-10-17)

Method note: these notes rest on primary sources where possible (GitHub READMEs, Hugging Face model cards, arXiv abstracts and papers), fetched 2026-10-17. Some numbers come only from aggregator blogs (pinggy.io, openvoxai.com) or vendor self-reports; they are labelled. Benchmark numbers in comparison tables come from one model's README, so the comparisons are vendor-run unless stated otherwise. Seed-TTS-eval notation: test-en WER% / SIM (x100), test-zh CER% / SIM, test-hard CER% / SIM. Lower WER/CER is better; higher SIM is better.

## Q1. Zero-shot voice-cloning TTS (3–30 s reference): which models exist, licences, benchmarks, duration/emotion control, VRAM, RTF, prompt-continuation

### Takeaway
All of the claimed models exist and have released weights: IndexTTS-2.5 (2026-08-10), Qwen3-TTS (2026-01-22), VoxCPM2 (2026-04), Fun-CosyVoice3 (2025-12), Chatterbox Multilingual V3 / Turbo, Fish Audio S2 Pro (2026-03), Step-Audio-EditX, Pocket TTS, Zonos, F5-TTS, Spark-TTS, MegaTTS3, Higgs Audio v2/v3, NeuTTS Air. For a commercial product, the strongest permissively licensed (Apache-2.0 / MIT) cloners are **VoxCPM2** (Apache-2.0, ~8 GB VRAM, continuation cloning with transcript, natural-language style control), **Qwen3-TTS-1.7B-Base** (Apache-2.0, best open EN WER on Seed-TTS-eval, ref_text-based cloning) and **Fun-CosyVoice3-0.5B-2512** (Apache-2.0, instruct control incl. speed/emotion, vLLM/TRT-LLM). **IndexTTS-2.5** is the only mainstream AR cloner with an explicit duration/speed knob plus disentangled emotion control, but it is under a bilibili licence that needs contact for commercial use. Exact-duration "fit into a slot" is natively supported only by NAR models (F5-TTS `fix_duration`, CC-BY-NC weights) and by IndexTTS2's token-count mode, which the public IndexTTS2 release did not enable. A new class of in-place **speech editing** models (Tencent **AuK**, MIT, 2026-09-09; Step-Audio-EditX, Apache-2.0) fits ReSpeak's "edit like text" use case more directly than whole-phrase regeneration.

### Cited Findings

#### Verification status of the requested names
- **IndexTTS-2.5: VERIFIED.** The official changelog lists "2026/08/10: IndexTTS-2.5 released" with Chinese, English, Japanese, Spanish and Arabic, faster than IndexTTS-2, `duration_factor` speed control and vLLM deployment — [index-tts GitHub](https://github.com/index-tts/index-tts). Technical report: arXiv 2601.03888, which reports a 2.28x RTF improvement with comparable WER/SIM. Its January-2026 arXiv ID predates the August weight release — [IndexTTS 2.5 Technical Report](https://arxiv.org/pdf/2601.03888); [ComfyUI wiki news 2026-08-10](https://comfyui-wiki.com/en/news/2026-08-10-indextts-2-5). The size "0.8B parameters" and GRPO RL post-training come from a secondary Medium article only — [Medium](https://ai-engineering-trend.medium.com/bilibili-open-sources-indextts-2-5-0-8b-parameters-with-cross-language-emotion-transfer-7576f88af673).
- **Qwen3-TTS: VERIFIED.** README news is dated 2026.1.22: "We have released Qwen3-TTS series (0.6B/1.7B) based on Qwen3-TTS-Tokenizer-12Hz". The blog ID is qwen3tts-0115 and the paper is arXiv 2601.15621 — [QwenLM/Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS); [Qwen blog](https://qwen.ai/blog?id=qwen3tts-0115); [Qwen3-TTS Technical Report](https://arxiv.org/pdf/2601.15621). The 25Hz variants appear in benchmark tables but are "to be released" — [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS).
- **VoxCPM / VoxCPM2: VERIFIED.** VoxCPM-0.5B (2025.09), VoxCPM1.5 (2025.12) and VoxCPM2 (2026.04, 2B, 48 kHz) are all released — [OpenBMB/VoxCPM GitHub](https://github.com/OpenBMB/VoxCPM). The VoxCPM2 technical report was submitted 5 June 2026 — [arXiv 2606.06928](https://arxiv.org/abs/2606.06928).
- **Fun-CosyVoice3: VERIFIED.** "2025/12: Fun-CosyVoice3-0.5B-2512 base model, RL model, and training/inference scripts released". The roadmap lists no 2026 releases — [FunAudioLLM/CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice).
- **Chatterbox: VERIFIED.** Variants are Chatterbox (500M, EN), Chatterbox Multilingual V3 (500M, 23+ languages, "latest general-purpose multilingual"), Chatterbox-Turbo (350M, EN) and Chatterbox-Nano (110M, EN, CPU) — [resemble-ai/chatterbox GitHub](https://github.com/resemble-ai/chatterbox). Dates come from an aggregator only: May 2025 (EN), Sept 2025 (multilingual), June 2026 (v3) — [pinggy.io, updated 2026-08-26](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).
- **Fish-Speech / OpenAudio → Fish Audio S2 / S2 Pro: VERIFIED (successor).** S2 Pro is 4B Slow AR + 400M Fast AR, released March 9, 2026 (per aggregator) — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/). Fish Audio says S2 is "open weights" rather than OSI open source — [fish.audio blog](https://fish.audio/pt/blog/what-we-mean-by-open-source-for-s2/).
- **Higgs Audio v2: VERIFIED.** 3B. Its successor **Higgs Audio v3 TTS** (4B) was released June 4, 2026 per aggregator — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/); [Higgs Audio README](https://cdn.jsdelivr.net/gh/boson-ai/higgs-audio@main/README.md).
- **Spark-TTS, MegaTTS3, Zonos, F5-TTS: VERIFIED** (all 2025 releases). Detail below.
- **Kyutai Pocket TTS: VERIFIED.** 100M parameters, tech report blog dated 2026-01-13, training code released August 2026 — [kyutai-labs/pocket-tts GitHub](https://github.com/kyutai-labs/pocket-tts).
- **NeuTTS (Air): PARTIALLY VERIFIED.** Only mirrors and aggregators were found: a 0.5B Qwen backbone with NeuCodec, GGML format, cloning from ~3 s — [replicate](https://replicate.com/lucataco/neutts-air); [agentisx mirror](https://github.com/agentisx/neutts-air). The repo was imported to a Gitee mirror on Oct 15, 2025 — [gitee](https://gitee.com/youjiarui/neutts-air).
- **Step-Audio-EditX: VERIFIED.** Inference code and weights were released Nov 12, 2025, with later updates adding Japanese/Korean and polyphone control — [Step-Audio-EditX GitHub](https://github.com/stepfun-ai/Step-Audio-EditX); [arXiv 2511.03601](https://arxiv.org/html/2511.03601v2).
- **Newer 2026 releases found:**
  - **Voxtral TTS** (Mistral, Mar 23, 2026, ~4B, CC BY-NC 4.0) — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/); [Slator](https://slator.com/mistral-text-to-speech-model/).
  - **dots.tts** (RedNote, 2B, Apache-2.0, June 2026) — [dots.tts-base HF card](https://huggingface.co/dots-studio/dots.tts-base); [arXiv 2606.07080](https://papers.cool/arxiv/2606.07080).
  - **LongCat-AudioDiT** (Meituan, 1B/3.5B, arXiv 2603.29339, weights released) — [arXiv 2603.29339](https://arxiv.org/abs/2603.29339).
  - **Breeze TTS 2** (3B, weights Aug 25, 2026, non-commercial weights; aggregator only) — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).
  - **GLM-TTS** (Zhipu, Dec 2025) — [arXiv 2512.14291](https://arxiv.org/pdf/2512.14291).
  - **Tencent AuK** (speech generation **and editing**, 2026-09-09) — [tencent/AuK HF card](https://huggingface.co/tencent/AuK).

#### Seed-TTS-eval zero-shot cloning (numbers as published in the VoxCPM README; vendor-compiled)
| Model | Params | test-EN WER / SIM | test-ZH CER / SIM | test-Hard CER / SIM |
|---|---|---|---|---|
| VoxCPM2 | 2B | 1.84 / 75.3 | 0.97 / 79.5 | 8.13 / 75.3 |
| VoxCPM1.5 | 0.8B | 2.12 / 71.4 | 1.18 / 77.0 | 7.74 / 73.1 |
| IndexTTS2 | 1.5B | 2.23 / 70.6 | 1.03 / 76.5 | 7.12 / 75.5 |
| CosyVoice3 | 0.5B | 2.02 / 71.8 | 1.16 / 78.0 | 6.08 / 75.8 |
| CosyVoice3 | 1.5B | 2.22 / 72.0 | 1.12 / 78.1 | 5.83 / 75.8 |
| Qwen3-TTS | 1.7B | 1.23 / 71.7 | 1.22 / 77.0 | 6.76 / 74.8 |
| F5-TTS | 0.3B | 2.00 / 67.0 | 1.53 / 76.0 | 8.67 / 71.3 |
| Spark-TTS | 0.5B | 3.14 / 57.3 | 1.54 / 66.0 | – |
| MegaTTS3 | 0.5B | 2.79 / 77.1 | 1.52 / 79.0 | – |
| LongCat-Audio-DiT | 3.5B | 1.50 / 78.6 | 1.09 / 81.8 | 6.04 / 79.7 |
| FishAudio S2 | 4B | 0.99 (EN) / 0.54 (ZH) / 5.99 (hard); SIM not listed | | |
Source: [OpenBMB/VoxCPM GitHub](https://github.com/OpenBMB/VoxCPM).

- The CosyVoice README's table gives slightly different values for some models: Fun-CosyVoice3-0.5B-2512 is zh 1.21/78.0, en 2.24/71.8, hard 6.71/75.8, and the **RL** variant is zh 0.81/77.4, en 1.68/69.5, hard 5.44/75.0. HiggsAudio-v2 (3B) is zh 1.50/74.0, en 2.44/67.7. GLM-TTS RL is zh 0.89/76.4. Human reference is zh 1.26/75.5, en 2.14/73.4 — [FunAudioLLM/CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice).
- **Conflict:** Spark-TTS is EN WER 1.98 in the CosyVoice table but 3.14 in the VoxCPM table. F5-TTS EN SIM is 64.7 in CosyVoice vs 67.0 in VoxCPM — [CosyVoice](https://github.com/FunAudioLLM/CosyVoice) vs [VoxCPM](https://github.com/OpenBMB/VoxCPM).
- Qwen3-TTS official table, WER only: 12Hz-1.7B-Base 0.77 (zh) / 1.24 (en); 12Hz-0.6B-Base 0.92 / 1.32; CosyVoice 3 0.71 / 1.45. The multilingual table gives English SIM 0.829 (0.6B) / 0.775 (1.7B) and Chinese SIM 0.811 / 0.799. Column alignment was inferred from a flattened table — [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS). Some blogs (e.g., 2.58% EN WER) do not match the official numbers — [DEV.to guide](https://dev.to/czmilo/qwen3-tts-the-complete-2026-guide-to-open-source-voice-cloning-and-ai-speech-generation-1in6).
- Fish Audio S2 vendor numbers: 0.54% WER (zh) and 0.99% (en), "best overall". These have not been independently re-run — [fish.audio blog](https://fish.audio/ja/blog/fish-audio-open-sources-s2/). An independent June 2026 paper (Raon-OpenTTS) reports Qwen3-TTS as best WER among the models it evaluated — [Raon-OpenTTS arXiv 2605.20830](https://arxiv.org/pdf/2605.20830).
- CV3-eval multilingual (VoxCPM README), selected EN/ja/de/es columns:
  - VoxCPM2: en 5.00, ja 5.96, de 4.77, es 3.80
  - CosyVoice3-1.5B: en 4.99, ja 7.57, de 6.43, es 4.47
  - Fish Audio S2: en 2.43, ja 3.96, de 2.22, es 2.00

  Source: [VoxCPM GitHub](https://github.com/OpenBMB/VoxCPM).
- IndexTTS-2.5 CV3-eval (own README): avg WER 6.75 / SS 73.18 (RL variant 6.00 / 73.63); en 5.12 / 68.06; cross-lingual avg 6.22 / 68.62 — [index-tts GitHub](https://github.com/index-tts/index-tts).
- Artificial Analysis Speech Arena Elo (aggregator, as of Aug 2026):
  - Fish Audio S2 Pro 1,125
  - Step Audio EditX 1,102
  - Voxtral TTS 1,082, and #1 open-weights in the controlled-voice (cloning) arena at 1,010
  - Higgs Audio V3 1,042
  - Chatterbox 1,020
  - Zonos 1,000
  - OpenVoice v2 954

  Qwen3-TTS, VoxCPM2 and IndexTTS are "not on arena" — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).

#### Per-model details (licence, control, VRAM, RTF, install)
- **IndexTTS2 / 2.5 (bilibili)**
  - Licence: the "bilibili Model Use License Agreement"; commercial use requires contacting indexspeech@bilibili.com. The README names no separate code licence.
  - Emotion control: an emotion reference audio (`emo_audio_prompt`, `emo_alpha` 0–1), an 8-float emotion vector (happy, angry, sad, afraid, disgusted, melancholic, surprised, calm), or text-derived emotion (`use_emo_text`; on 2.5 this needs `use_qwen_emo=True`).
  - Duration control on 2.5: `duration_factor` 0.5–2.0 (>1 slows speech). This is a speed ratio, not a token count.
  - RTF on RTX 4090 with kv_cache: IndexTTS-2 fp16 0.3257; IndexTTS-2.5 bf16 0.2065.
  - Install: `uv sync --all-extras`, CUDA 12.8+ recommended, then `hf download IndexTeam/IndexTTS-2.5`.
  - No VRAM figure is given.

  Source: [index-tts GitHub](https://github.com/index-tts/index-tts).
- **IndexTTS2 duration control:** the paper describes two modes. One sets the number of generated speech tokens for precise duration (intended for video dubbing); the other is free generation that "keeps the input prompt's prosody" — [IndexTTS2 arXiv 2506.21619](https://arxiv.org/html/2506.21619v2); [AAAI](https://ojs.aaai.org/index.php/AAAI/article/view/40820). The README says IndexTTS2's precise duration control "is not yet enabled in this release" — [index-tts GitHub](https://github.com/index-tts/index-tts).
- **Qwen3-TTS**
  - Licence: Apache-2.0.
  - Languages: zh, en, ja, ko, de, fr, ru, pt, es, it, plus dialects.
  - Cloning: Base models do "3-second rapid voice clone". `ref_text` is required by default; `x_vector_only_mode=True` drops it, but "cloning quality may be reduced".
  - Instruction control (timbre, emotion, prosody, speaking rate) is on the VoiceDesign/CustomVoice variants. No duration control is documented.
  - Latency: "end-to-end synthesis latency as low as 97ms".
  - vLLM-Omni has day-0 support, offline only.
  - Install: `pip install -U qwen-tts` (Python 3.12) plus flash-attn.
  - No VRAM figures. The 1.7B download is 4.54 GB per [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).

  Source: [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS).
- **VoxCPM2**
  - Licence: Apache-2.0 for code and weights, "free for commercial use".
  - Languages: 30 plus 9 Chinese dialects; 48 kHz output.
  - Cloning modes:
    - "Isolated Reference & Continuation": reference cloning needs only `reference_wav_path`, no transcript.
    - "Controllable cloning": a parenthetical style prefix, e.g. `"(slightly faster, cheerful tone)..."`.
    - "Ultimate Cloning": continuation that requires the reference audio **and its exact transcript** (`prompt_text`).
  - VoxCPM1.5/0.5B support continuation only.
  - No explicit duration parameter; speed is set only via natural language, and "results can vary between runs".
  - Streaming: `generate_streaming()`.
  - VRAM and RTF on RTX 4090: VoxCPM2 ~8 GB, RTF ~0.30 (PyTorch) / ~0.13 (Nano-vLLM). VoxCPM1.5 ~6 GB, RTF ~0.15 / 0.08.

  Source: [VoxCPM GitHub](https://github.com/OpenBMB/VoxCPM).
- **Fun-CosyVoice3-0.5B-2512**
  - Licence: Apache-2.0.
  - Languages: 9 (zh, en, ja, ko, de, es, fr, it, ru) plus 18+ dialects. Multi-/cross-lingual zero-shot cloning.
  - Instructions: "languages, dialects, emotions, speed, volume". No duration control is mentioned.
  - Latency: bi-streaming "as low as 150ms".
  - Serving: vLLM 0.11.x+ (V1 engine); TensorRT-LLM gives "4x acceleration" for the CosyVoice2 LLM.
  - No VRAM figure.
  - The repo also shipped a CosyVoice-300M voice-conversion mode in 2024/09.

  Source: [CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice).
- **Chatterbox family (Resemble AI)**
  - Licence: MIT.
  - Controls: `exaggeration` (default 0.5) and `cfg_weight` (default 0.5). For expressive speech, use cfg ~0.3 and exaggeration ≥0.7. Lowering cfg to ~0.3 helps with fast-speaking references.
  - Paralinguistic tags (`[cough]`, `[laugh]`, `[chuckle]`) are native in Turbo/Nano. Turbo distils the speech-token-to-mel decoder from 10 steps to 1.
  - **Every output carries the PerTh neural watermark** ("survive MP3 compression").
  - VC via `example_vc.py` / `gradio_vc_app.py`.
  - Install: `pip install chatterbox-tts`, tested on Python 3.11.
  - No VRAM figures; "sub 200ms" refers to Resemble's hosted service.

  Source: [chatterbox GitHub](https://github.com/resemble-ai/chatterbox).
- **Fish Audio S2 Pro**
  - Licence: Fish Audio Research License. Non-commercial is free; commercial needs a separate licence (business@fish.audio) — [fish.audio blog](https://fish.audio/pt/blog/what-we-mean-by-open-source-for-s2/).
  - Speed (aggregator): ~100 ms TTFA, RTF 0.195 on one H200. VRAM is not published — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).
- **Higgs Audio**
  - v3 weights are under the "Boson Higgs Audio v3 Research and Non-Commercial License": "Production / hosted / revenue-generating use requires a separate commercial license". Serve with `sgl-omni serve --model-path bosonai/higgs-audio-v3-tts-4b` — [Higgs Audio README](https://cdn.jsdelivr.net/gh/boson-ai/higgs-audio@main/README.md).
  - v2 weights licence: sources conflict (research/non-commercial vs Apache-2.0, which likely covers only the code) — [freeapihub](https://freeapihub.com/ai-models/higgs-audio); [localclaw](https://localclaw.io/tts/higgs-audio-v2).
- **F5-TTS**
  - Licence: code MIT; "The pre-trained models are licensed under the CC-BY-NC license" (Emilia data).
  - Latest model: v1 base, 2025/03/12. No 2026 news.
  - RTF on an L20 GPU: 0.1467 (PyTorch, bs1), 0.0402 (TRT-LLM).

  Source: [F5-TTS GitHub](https://github.com/SWivid/F5-TTS).
- **F5-TTS reference handling and editing:**
  - Reference audio is clipped to ~12 s ("Use reference audio <12s and leave proper silence space (e.g. 1s) at the end").
  - The total length is limited to 30 s including prompt "(same logic if `fix_duration`)".
  - A `speech_edit.py` script exists for speech editing.
  - Empty `ref_text` triggers ASR transcription.

  Source: [F5-TTS infer README](https://github.com/SWivid/F5-TTS/tree/main/src/f5_tts/infer).
- **MegaTTS3 (ByteDance)**
  - Licence: Apache-2.0. Languages: zh/en.
  - **The WaveVAE encoder is withheld**: "For security issues, we do not upload the parameters of WaveVAE encoder". Users "can only use the pre-extracted latents". New voices require submitting a <24 s wav for ByteDance to process after a safety check.
  - Accent intensity control via p_w/t_w.
  - The README calls it "primarily intended for academic purposes".

  Source: [MegaTTS3 GitHub](https://github.com/bytedance/MegaTTS3).
- **Spark-TTS:** code Apache-2.0, weights CC BY-NC-SA 4.0 (secondary source) — [tts.ai](https://tts.ai/voices/spark/?lang=zh).
- **Zonos-v0.1 (Zyphra)**
  - Licence: Apache-2.0. Languages: en, ja, zh, fr, de.
  - Conditioning: "fine-grained control" of speaking rate, pitch, maximum frequency, audio quality and emotions (happiness, anger, sadness, fear).
  - Cloning from a 10–30 s speaker sample.
  - Hardware: 6 GB+ VRAM; the hybrid model needs an RTX 3000-series or newer. "real-time factor of ~2x on an RTX 4090". Requires espeak-ng.

  Source: [Zonos GitHub](https://github.com/Zyphra/Zonos).
- **Kyutai Pocket TTS**
  - Size: 100M.
  - Licence: code MIT; the weights licence is not stated in the README, and there is a separate voice-licence page. tts.ai lists MIT (third party).
  - Languages: en, fr, de, pt, it, es, nl.
  - Cloning: pass a wav as `--voice`; "audio quality of the sample is also reproduced".
  - Speed: ~6x real-time on a MacBook Air M4 CPU using 2 cores; ~200 ms to the first chunk. GPU is not officially supported.
  - No WER/SIM benchmarks in the README.

  Source: [pocket-tts GitHub](https://github.com/kyutai-labs/pocket-tts); [tts.ai](https://tts.ai/voices/pocket-tts/).
- **NeuTTS Air:** the licence is contested (Apache-2.0 per one aggregator; "NeuTTS Open License 1.0" for NeuTTS-Nano). Output is watermarked with Perth — [voiceaispace](https://www.voiceaispace.com/knowledge/repo/57090f14-a2f1-417b-a9a2-989a7576879b); [sourcepulse](https://www.sourcepulse.org/projects/16111448).
- **Step-Audio-EditX (StepFun)**
  - Size: 3B audio LLM. Licence: apache-2.0 on the HF card.
  - Iterative editing of existing audio:
    - emotion tags: Angry, Happy, Sad, Excited, Fearful, Surprised, Disgusted
    - style tags: Whisper, Older, Child, Serious, Exaggerated, …
    - 10 paralinguistic types, including Breathing, Laughter, Sigh and **Uhm**
  - "emotion editing significantly improves the emotion-controlled outputs of all three compared models after just one iteration".
  - Hardware: ~32 GB GPU memory; tested on one L40S.

  Source: [Step-Audio-EditX HF README](https://huggingface.co/stepfun-ai/Step-Audio-EditX/blob/main/README.md); [arXiv 2511.03601](https://arxiv.org/html/2511.03601v2). An aggregator says it is "designed for clips under 30s" and supports Mandarin, English, Sichuanese, Cantonese, Japanese and Korean — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).
- **Voxtral TTS (Mistral)**
  - Licence: CC BY-NC 4.0 weights. Commercial use is via the API at USD 0.016 per 1,000 characters.
  - Hardware: 16 GB+ VRAM.
  - **Conflict:** most sources claim ~3 s cloning, but Slator reports that the HF open weights are limited to fixed voices and that customisation is platform-only.

  Source: [Slator](https://slator.com/mistral-text-to-speech-model/); [datanorth](https://datanorth.ai/news/mistral-releases-voxtral-tts-open-weight-text-to-speech-model).
- **Tencent AuK (2026-09-09)**
  - Size: "1.5B foundation model for speech generation and editing". Licence: "released under the MIT License".
  - Tasks: zero-shot/instruct TTS; content editing ("replace, insert, or remove text"); acoustic editing (pitch, speed, volume — "output length scales with the speed factor"); paralinguistic editing (emotion, timbre, nonverbal sounds, whisper); enhancement and separation.
  - AuK-Flash is distilled for 4-step inference.
  - Needs the Qwen2.5-Omni-3B encoder downloaded separately. Serving via sglang_omni.
  - No numeric benchmarks, VRAM or language list in the card.

  Source: [tencent/AuK HF card](https://huggingface.co/tencent/AuK).
- **dots.tts:** 2B; training/inference code and pretrained, post-trained and MeanFlow-distilled checkpoints released under Apache-2.0 — [dots.tts-base HF card](https://huggingface.co/dots-studio/dots.tts-base); [papers.cool](https://papers.cool/arxiv/2606.07080).

### Inferences
- **Licence triage for a commercial ReSpeak:**
  - Usable (permissive): VoxCPM2, Qwen3-TTS, Fun-CosyVoice3, Chatterbox (MIT, but forced PerTh watermark), Zonos, dots.tts, AuK (MIT; verify that it covers the weights), Step-Audio-EditX (Apache-2.0 on HF card), Pocket TTS (code MIT; weights unclear).
  - Research-only without a separate deal: IndexTTS-2/2.5 (bilibili licence, contact required), F5-TTS weights (CC-BY-NC), Fish S2 Pro, Higgs v2/v3, Voxtral TTS, Spark-TTS weights, Breeze TTS 2.
  - Practically unusable for arbitrary users' voices: MegaTTS3 (encoder withheld).
- **"Fit into a slot" duration control:** no permissive AR model exposes an exact-duration parameter.
  - Practical options:
    - (a) IndexTTS-2.5 `duration_factor`: generate once, measure, then regenerate with factor = slot/natural (licence caveat).
    - (b) A NAR flow-matching model with explicit total length (F5-TTS `fix_duration`; non-commercial weights).
    - (c) A permissive cloner (VoxCPM2/Qwen3/CosyVoice3) plus speed instructions and a final small time-stretch.
    - (d) An editing model such as AuK, which regenerates in context.
  - These are inferences from the documented parameters, not tested results.
- **Prompt continuation from the same recording:** VoxCPM2 "Ultimate Cloning" (audio + exact transcript), Qwen3-TTS Base (ref_text default mode), CosyVoice (prompt text + wav) and F5-TTS (ref_text infilling) all condition on the transcript of the reference. ReSpeak already has the transcript from ASR, so the continuation-style modes are the natural fit. The preceding words of the same message work as the prompt, which should match room acoustics and mic character better than a separate clip. This is inference; no source benchmarks same-recording continuation for splice quality.
- For 3–30 s references, F5-TTS clips at ~12 s and Seed-VC/Zonos accept 10–30 s. Longer prompts slow AR models (KV cache length). Picking the 5–12 s of the same message nearest the edit is a reasonable default (inference).

### Gaps
- No VRAM figures were found for Qwen3-TTS, Fun-CosyVoice3, IndexTTS-2.5, Chatterbox V3/Turbo, Fish S2 Pro or AuK in primary sources. Only VoxCPM (~8 GB), Zonos (6 GB+), Step-Audio-EditX (~32 GB), Voxtral (16 GB+, aggregator) and Breeze TTS 2 (12 GB, aggregator) are documented.
- No independent (non-vendor) Seed-TTS-eval rerun covering IndexTTS-2.5, VoxCPM2, Qwen3-TTS and Fish S2 side by side was found. All tables are compiled by one model's authors.
- No SIM numbers for Fish S2 on Seed-TTS-eval.
- No benchmark for splice naturalness (regenerating a phrase inside an existing recording) was found for any whole-utterance TTS model.
- Release dates for Chatterbox Turbo/V3 rest on an aggregator only. The NeuTTS Air licence, the Pocket TTS weights licence, the LongCat-AudioDiT licence and Breeze TTS 2 details are unverified against primary repos.
- Names seen only in search-result titles and not investigated: Raon-OpenTTS (arXiv 2605.20830), GEPARD (arXiv 2609.04222), Qwen-Audio-3.0-Gen-Preview (arXiv 2607.27011), PlayDiffusion (inpainting; third-party listing only), and the multi-codec diffusion speech inpainting paper (arXiv 2608.06424).
- Whether Step-Audio-EditX's quantised variant is Int4 or Int8 is inconsistent across mirror pages.

## Q2. Voice conversion: can Seed-VC, OpenVoice v2, Vevo/Vevo2, Chatterbox VC or RVC turn a generic TTS phrase into the user's voice convincingly?

### Takeaway
Seed-VC is the best-documented zero-shot VC. It beats OpenVoice and CosyVoice-VC on speaker similarity and WER in its own eval (SECS 0.868 vs 0.844 vs 0.755), works from 1–30 s references, and its v2 model can also convert accent/emotion. But it is GPL-3.0 and the repo has been archived (read-only) since Nov 21, 2025. OpenVoice v2 is MIT but clearly lower fidelity. Vevo2 (2026-03-25) adds style-preserving VC, but its licence is unconfirmed (Vevo1 is CC-BY-NC). Chatterbox VC (MIT) has no published benchmarks. RVC needs per-speaker training. For ReSpeak, VC is a secondary fallback: direct zero-shot cloning TTS with in-context continuation is the primary path.

### Cited Findings
- **Seed-VC**
  - Licence: GPL-3.0. "clone a voice given a reference speech of 1~30 seconds".
  - Variants:
    - v1.0 seed-uvit-tat-xlsr-tiny (25M, real-time)
    - seed-uvit-whisper-small-wavenet (98M, offline)
    - seed-uvit-whisper-base (200M, 44.1 kHz singing)
    - v2.0 hubert-bsqvae-small (67M CFM + 90M AR, "Voice & Accent Conversion", "Best in suppressing source speaker traits")
  - The v2 CLI flag uses the AR model "for accent & emotion conversion"; with it off, conversion is timbre-only.
  - Real-time latency: 430 ms total and 150 ms per chunk on an RTX 3060 Laptop GPU (10 diffusion steps).
  - Fine-tuning: "minimum 1 utterance per speaker", 100 steps, about 2 min on a T4.
  - "The repository is archived... read-only as of Nov 21, 2025."

  Source: [Seed-VC GitHub](https://github.com/Plachtaa/seed-vc).
- **Seed-VC zero-shot eval** (LibriTTS test-clean, 100 sources, 12 references):
  - Seed-VC: SECS 0.8676, WER 11.99, CER 2.92
  - CosyVoice: SECS 0.8440, WER 18.98
  - OpenVoice: SECS 0.7547, WER 15.46
  - Ground-truth WER: 8.02
  - Audio quality: OpenVoice had the best DNSMOS-style OVRL (3.27 vs Seed-VC 3.11)
  - Singing VC: RVCv2 (trained per character) had better F0 and DNSMOS, but lower SECS (0.7264 vs 0.7405) and higher CER (28.46 vs 19.70)

  Source: [Seed-VC EVAL.md](https://github.com/Plachtaa/seed-vc/blob/main/EVAL.md).
- **OpenVoice v2:** MIT (V1 and V2) — [OpenVoice mirror](https://portrait.gitee.com/mirrors/openvoice). Artificial Analysis Elo 957.03 — [Artificial Analysis](https://artificialanalysis.ai/text-to-speech/models/openvoice-v2). A third-party review calls it lower in expressiveness and fidelity than larger transformer models — [via search summary of a resemble.ai list](https://www.resemble.ai/resources/best-open-source-text-to-speech-models).
- **Vevo2 (Amphion):** released 2026/03/25 (arXiv 2508.16332; weights at RMSnow/Vevo2). It supports zero-shot TTS, text-to-singing, SVS and "style-preserved Voice/Singing Voice Conversion". The licence was not found; the earlier amphion/Vevo is cc-by-nc-4.0 — [Vevo2 HF](https://huggingface.co/RMSnow/Vevo2); [Amphion README](https://raw.githubusercontent.com/open-mmlab/Amphion/main/README.md); [Vevo HF](https://huggingface.co/amphion/Vevo).
- **Chatterbox VC:** shipped in the MIT repo (`example_vc.py`, `gradio_vc_app.py`) but undocumented in the README — [chatterbox GitHub](https://github.com/resemble-ai/chatterbox). Third-party docs say 24 kHz output — [mintlify docs](https://www.mintlify.com/yocxy2/chatterboxyocxy/models/voice-conversion). One forum commenter claims other models have better zero-shot VC than Chatterbox; this is opinion, not measured — [news.hada.io](https://news.hada.io/topic?id=21414).
- **RVC:** needs a per-target model; Seed-VC's eval used "RVCv2-f0-48k" models trained per character — [Seed-VC EVAL.md](https://github.com/Plachtaa/seed-vc/blob/main/EVAL.md).
- **Alternatives built into TTS/editing stacks:** CosyVoice-300M VC (2024/09) — [CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice); AuK timbre editing — [tencent/AuK](https://huggingface.co/tencent/AuK).

### Inferences
- A TTS→VC chain (generic high-quality TTS, then Seed-VC into the user's voice) is viable as a fallback when the cloning TTS fails on a language or style. Seed-VC's WER (11.99 vs ground-truth 8.02) suggests VC slightly hurts intelligibility. VC also keeps the *source* prosody, which is useful for driving emotion or timing from a controllable TTS whose duration is already fitted.
- The Seed-VC GPL-3.0 licence matters only if the code is distributed; server-side use is generally a different case (legal check needed). The archived status means no fixes.
- RVC is unsuitable for instant per-user onboarding because it needs training. Seed-VC fine-tuning (about 2 min on a T4 from one utterance) is an option if zero-shot similarity is insufficient.

### Gaps
- No head-to-head benchmark of Seed-VC vs Vevo2 vs Chatterbox VC vs OpenVoice v2 from a neutral party was found.
- Vevo2 licence, VRAM and latency were not found.
- The RVC licence and current maintenance status were not checked.
- No source tested "TTS phrase → VC → splice into the original recording" for seam audibility.

## Q3. ASR with word timestamps: verbatim fillers ("um", "uh"), false starts, timestamp accuracy, streaming, latency; plus VAD

### Takeaway
For disfluency removal, ReSpeak needs a verbatim recogniser. Standard Whisper and Canary largely drop fillers: event F1 is only 12.0% (Whisper) and 19.9% (Canary-1B) on English. **CrisperWhisper 2.0** (nyra labs, July 2026) is the strongest open option for verbatim plus timing: 87.8 disfluency F1 averaged over 10 languages and a 29.6 ms mean word-boundary error on TIMIT. But its weights are **non-commercial**. Among commercial APIs that keep fillers on request: AssemblyAI (`disfluencies=true`, EN event F1 85.8), ElevenLabs Scribe v2 (verbatim by default; disfluency F1 79.2; word timestamps; ~150 ms realtime) and Deepgram (`filler_words=true` for 7 filler types; F1 only 37.8 in nyra's benchmark). Parakeet-TDT-0.6B-v3 (CC-BY-4.0, 25 languages, word timestamps, very fast) is the best permissive, fast, accurate ASR, but nothing documents filler retention. Kyutai STT (CC-BY-4.0) is the best open true-streaming ASR with word timestamps.

### Cited Findings
- **CrisperWhisper 2.0**
  - Paper: "Transcription Policy as a Latent Variable: Activating Controllable Verbatim ASR with Word-Level Timing", arXiv 2607.18934, 21 Jul 2026, nyra labs (Austria) — [arXiv HTML](https://arxiv.org/html/2607.18934).
  - Licence: inference code MIT; "The model weights are not MIT" — the Nyra Health Non-Commercial Research License. Pro models are commercial-licence only.
  - Modes: Verbatim mode keeps "every filler, repetition, stutter", false starts and events, e.g. [um], [uh], [laughter]. Intended mode gives a cleaned, formatted version.
  - Mean word-boundary error on TIMIT: CrisperWhisper 2.0 29.6 ms; xAI Grok STT 37.1; ElevenLabs Scribe v2 51.3; Deepgram Nova-3 63.3; WhisperX 64.8; Canary 85.5. Conversational speech: 41 ms.
  - Disfluency F1 averaged over 10 languages: CW2 Pro 93.5; CW2 87.8; Scribe v2 79.2; Microsoft MAI-Transcribe-1.5 77.5; CW1 64.8 (EN/DE only); Deepgram Nova-3 37.8.
  - Runtime: CTranslate2, with speculative decoding giving "1.3 to 1.4x faster". Sizes: large, turbo, medium, small.
  - Install: `pip install "crisperwhisper[ct2]"`.

  Source: [CrisperWhisper GitHub](https://github.com/nyrahealth/CrisperWhisper).
- **Paper tables (arXiv 2607.18934):**
  - English event F1: Whisper 12.0; Canary-1B 19.9; Reverb 86.3; AssemblyAI 85.8; CrisperWhisper (v1) 73.2; new model 90.7.
  - Word timing MAE in ms on TIMIT / FluencyBank (disfluent):
    - Base Whisper 203 / 568
    - MFA 19 / 142
    - WhisperX 66 / 200
    - CrisperWhisper 59 / 162 (with "+s" refinement 47 / 122)
    - Canary-1B 78 / 166
    - new model 36 / 102
  - Whisper "may omit, inconsistently transcribe, or hallucinate disfluencies depending on acoustic context".

  Source: [arXiv 2607.18934](https://arxiv.org/html/2607.18934).
- **NVIDIA Parakeet-TDT-0.6B-v3**
  - Released on HF 08/14/2025. Licence: CC-BY-4.0, "ready for commercial/non-commercial use". 25 European languages with automatic language ID.
  - Word and segment timestamps via `transcribe(..., timestamps=True)`.
  - Audio length: up to 24 min with full attention on an A100 80GB, or 3 h with local attention.
  - Output includes punctuation and capitalisation.
  - Streaming via a NeMo chunked script (chunk 2 s, left context 10 s, right context 2 s).
  - Speed and accuracy: RTFx 3,332.74; Open ASR average WER 6.34%; LibriSpeech 1.93 / 3.59.
  - "At least 2GB RAM for model to load".
  - Disfluency handling is **not documented**.

  Source: [parakeet-tdt-0.6b-v3 HF card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3). AMI WER 11.31% vs Whisper-large-v3-turbo 16.13% — [openvoxai, 2026-08-14](https://openvoxai.com/blog/best-local-stt-transcription-models-2026).
- **Whisper large-v3-turbo:** 809M, MIT, Open ASR mean WER 7.83%, RTFx 200.19 on an A100, 99 languages, no native streaming — [openvoxai](https://openvoxai.com/blog/best-local-stt-transcription-models-2026).
- **NVIDIA Nemotron 3.5 ASR Streaming 0.6B:** cache-aware streaming with 80–1120 ms chunks; 240 streams at 80 ms or 2,400 at 1120 ms on one H100. Licence: NVIDIA Open Model Development Weights License 1.1. Word timestamps are not documented — [openvoxai](https://openvoxai.com/blog/best-local-stt-transcription-models-2026) (aggregator; model card not fetched).
- **WhisperX**
  - Licence: BSD-2-Clause. Word timestamps via wav2vec2 forced alignment. Whisper's native timestamps are utterance-level and "can be off by several seconds".
  - Speed: "70x realtime with large-v2" batched; "<8GB gpu memory for large-v2 with beam_size=5".
  - Limitation: words whose characters are not in the aligner dictionary get no times (e.g., "2014.", "£13.60").
  - Diarization uses pyannote speaker-diarization-community-1 and needs an HF token.

  Source: [WhisperX GitHub](https://github.com/m-bain/whisperX).
- **Kyutai STT**
  - Models: `stt-1b-en_fr` (0.5 s delay, semantic VAD) and `stt-2.6b-en` (2.5 s delay). Both "return word level timestamps".
  - Throughput: one H100 handles 400 real-time streams; an L40S handles 64 connections at 3x real-time.
  - Licence: weights CC-BY 4.0; Python MIT; Rust Apache.
  - Install: `pip install moshi` or `cargo install --features cuda moshi-server`.

  Source: [kyutai-labs/delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling).
- **Moonshine v2 / Moonshine Voice (Feb 2026):** sliding-window streaming encoder — [arXiv 2602.12241](https://arxiv.org/abs/2602.12241). Code and streaming models are MIT — [Pete Warden blog](https://petewarden.com/2026/02/13/announcing-moonshine-voice/). Community GGUF ports state "no timestamps" — [HF GGUF port](https://huggingface.co/handy-computer/moonshine-streaming-small-gguf).
- **Deepgram:**
  - `filler_words` defaults to false; when false, "uh" and "um" are stripped.
  - When enabled it transcribes uh, um, mhmm, mm-mm, uh-uh, uh-huh, nuh-uh. This applies to pre-recorded, Nova streaming and Flux English — [Deepgram docs](https://developers.deepgram.com/docs/filler-words).
- **AssemblyAI:** fillers are removed by default; set `disfluencies: true` to keep them (pre-recorded docs) — [AssemblyAI docs](https://www.assemblyai.com/docs/pre-recorded-audio/filler-words). The changelog notes improved disfluency timestamps — [AssemblyAI changelog](https://changelog.assemblyai.com/disfluency-timestamps-improved-2).
- **ElevenLabs Scribe v2 / v2 Realtime:**
  - Both offer "Precise word-level timestamps". Items are typed `word`, `spacing` or `audio_event` (laughter etc.).
  - Realtime latency is ~150 ms; 90+ languages; diarization up to 32 speakers (batch only).
  - "When `no_verbatim` is enabled, the model removes filler words, false starts and disfluencies". The docs list the no-verbatim mode as available on Scribe v2, v2 Medical (batch) and v2 Realtime, so verbatim is the default.

  Source: [ElevenLabs STT docs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text). Interpretation of "No verbatim mode is available with…" as a feature-availability line is mine. It is supported by Scribe v2 scoring 79.2 disfluency F1 in [CrisperWhisper's benchmark](https://github.com/nyrahealth/CrisperWhisper).
- **OpenAI:** a 2026 third-party blog says only `whisper-1` returns word-level timestamps (`timestamp_granularities`); gpt-4o-transcribe does not — [convertaudiototext blog](https://convertaudiototext.com/blog/openai-whisper-api-pricing-2026). Not confirmed against official OpenAI docs.
- **Silero VAD:**
  - Speed: "One audio chunk (30+ ms) takes less than 1ms to be processed on a single CPU thread". The JIT model is ~2 MB; 8/16 kHz; trained on 6000+ languages.
  - Install: `pip install silero-vad`, with ONNX extras available.
  - The README says MIT, but a badge says CC BY-NC 4.0, which conflicts.

  Source: [silero-vad GitHub](https://github.com/snakers4/silero-vad).
- **TEN VAD:** claims better precision than Silero and lower latency (Silero "suffers from a delay of several hundred milliseconds" in agent transitions). This is a vendor claim — [TEN VAD GitHub](https://github.com/TEN-framework/ten-vad). A third-party model card reports Silero beating TEN on F1/AUC on TEN's own test set — [teensy-vad-v6](https://huggingface.co/Teensy/teensy-vad-v6).

### Inferences
- **Best open verbatim pipeline for disfluency editing:** VAD (Silero) → CrisperWhisper 2.0 turbo/large in verbatim mode for words + fillers + timings, if the non-commercial weight licence is acceptable or a Pro licence is bought.
- **Licence-clean alternative:** Parakeet-TDT-v3 for fast words and timestamps. Detect fillers separately by aligning with a CTC/phone aligner and labelling un-transcribed voiced gaps, or use AssemblyAI/ElevenLabs as a commercial verbatim source. This is design inference; Parakeet filler behaviour must be tested.
- **Live transcript:** Kyutai stt-1b-en_fr (0.5 s delay, word timestamps, semantic VAD) or Nemotron streaming can provide live text. A second, more accurate verbatim pass (CrisperWhisper or forced alignment) can then refine timings once the user stops recording. A two-pass "live draft, then final" design suits voice messages, which are short and finish before editing begins.
- Whisper-family timestamps without alignment (~200 ms MAE on read speech, 568 ms on disfluent speech) are too coarse for cutting. Use alignment-refined timings (WhisperX, CrisperWhisper, MFA).

### Gaps
- No published evidence on whether Parakeet-TDT-v3 / Canary-1B-v2 emit "um"/"uh". Only Canary-1B (v1) is measured (EN event F1 19.9).
- Kyutai STT, Moonshine v2 and Nemotron streaming have no published disfluency/filler measurements or word-timing MAE.
- AssemblyAI streaming (Universal-3 Pro Streaming) support for `disfluencies` was not confirmed. Neither was Deepgram Flux's filler behaviour beyond the docs line.
- OpenAI gpt-4o-transcribe timestamp support is unconfirmed against official docs.
- The Silero VAD current version (v5 vs v6) and the definitive licence were not confirmed from the release page.
- No VRAM figures for CrisperWhisper 2.0 or Kyutai STT.

## Q4. Forced aligners (MFA, wav2vec2/torchaudio MMS, NeMo Forced Aligner) for phoneme-level cut points

### Takeaway
MFA 3.0 is the most accurate for read speech: author-reported mean boundary error under 15 ms on four benchmarks, and 19 ms word MAE on TIMIT in nyra's independent table. It degrades on disfluent speech (142 ms on FluencyBank), where CrisperWhisper-style models do better (102–122 ms). NeMo Forced Aligner is what NVIDIA models use for timestamps. The **torchaudio `forced_align` API was deprecated in 2.8 and removed in 2.9**, so MMS/wav2vec2 CTC alignment needs a pinned torchaudio or a ported implementation.

### Cited Findings
- **MFA 3.0:** "mean boundary errors below 15 ms" with "state-of-the-art or near state-of-the-art performance across all four benchmark datasets" (English, Japanese, Korean). Submitted 16 June 2026 by the MFA authors (self-reported) — [arXiv 2606.18466](https://arxiv.org/abs/2606.18466).
- **Independent word-timing MAE** (nyra, July 2026): MFA 19 ms on TIMIT (read) but 142 ms on FluencyBank (disfluent). WhisperX 66 / 200; CrisperWhisper+s 47 / 122; new nyra model 36 / 102 — [arXiv 2607.18934](https://arxiv.org/html/2607.18934).
- **NeMo Forced Aligner (NFA):** its 2023 Interspeech paper reports the best word-alignment accuracy and speed among the aligners compared (self-reported) — [Rastorgueva et al., Interspeech 2023](https://www.isca-archive.org/interspeech_2023/rastorgueva23_interspeech.pdf). NVIDIA models use NFA for timestamps because of cross-attention limitations (as stated in a citing paper) — [CrisperWhisper arXiv 2408.16589](https://arxiv.org/pdf/2408.16589).
- **torchaudio:** the 2.9.0 CTC tutorial says forced-alignment APIs were deprecated in 2.8 and removed in 2.9. TorchAudio is now in a "maintenance phase" (issue pytorch/audio#3902). The 2.9.0 reference page still carries a "will be removed" banner, which is inconsistent — [torchaudio 2.9 tutorial](https://docs.pytorch.org/audio/2.9.0/tutorials/ctc_forced_alignment_api_tutorial.html); [torchaudio 2.9 forced_align ref](https://docs.pytorch.org/audio/2.9.0/generated/torchaudio.functional.forced_align.html).
- **Newer learned aligners:** a 2026 preprint reports beating MFA and MMS-based alignment on TIMIT and Buckeye — [emergentmind summary of arXiv 2606.10675](https://www.emergentmind.com/papers/2606.10675). BFA, a "real-time multilingual text-to-speech forced alignment", also exists — [arXiv 2509.23147](https://arxiv.org/html/2509.23147v1).
- **WhisperX's wav2vec2 aligner cannot time tokens outside its character dictionary** (numbers, currency) — [WhisperX GitHub](https://github.com/m-bain/whisperX).

### Inferences
- Suggested cut-point pipeline:
  1. Take ASR word times (CrisperWhisper/WhisperX/Parakeet).
  2. Re-align each edited region with MFA (phone tier) or a CTC aligner for phone-level boundaries.
  3. Snap cuts to the nearest low-energy point or zero crossing inside the phone/silence boundary, plus a short crossfade.

  MFA's ~15–19 ms accuracy on clean speech suits cutting. On disfluent regions, prefer verbatim-ASR timings or widen the search window. This is inference from the numbers above.
- When using MMS/wav2vec2 CTC alignment, pin `torchaudio<=2.8`, or use NeMo NFA or MFA instead.

### Gaps
- No single neutral benchmark compares MFA 3.0, NFA, MMS (torchaudio) and WhisperX at the *phone* level on conversational speech.
- MFA 3.0 per-dataset numbers and the list of aligners it was compared against were not in the abstract.
- MFA licence and install specifics (conda) were not re-verified in this session.

## Q5. Recommended stack for a single rented GPU (24–48 GB) running ASR + LLM + TTS simultaneously

### Takeaway
On a 24 GB card the documented footprints fit everything at once:
- ASR: Parakeet-v3 (CC-BY-4.0) or CrisperWhisper/WhisperX (<8 GB for large-v2)
- TTS: VoxCPM2 (~8 GB, RTF 0.13–0.30 on a 4090, Apache-2.0) or Fun-CosyVoice3 0.5B (Apache-2.0)
- VAD: Silero on CPU
- LLM: a quantised 7–8B model

A 48 GB card adds headroom for a second TTS (Qwen3-TTS-1.7B, or IndexTTS-2.5 if licensed), Seed-VC, or the editing model AuK. Step-Audio-EditX alone needs ~32 GB and is better run on demand.

### Cited Findings
- Documented GPU footprints and speeds:
  - VoxCPM2: ~8 GB, RTF ~0.30 (PyTorch) / ~0.13 (Nano-vLLM) on an RTX 4090. VoxCPM1.5: ~6 GB — [VoxCPM GitHub](https://github.com/OpenBMB/VoxCPM).
  - WhisperX large-v2: <8 GB with beam 5; int8 reduces this further — [WhisperX GitHub](https://github.com/m-bain/whisperX).
  - Parakeet v3: "At least 2GB RAM for model to load", RTFx 3,332 — [Parakeet v3 card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3).
  - Zonos: 6 GB+ — [Zonos GitHub](https://github.com/Zyphra/Zonos).
  - Step-Audio-EditX: ~32 GB, tested on an L40S — [Step-Audio-EditX HF](https://huggingface.co/stepfun-ai/Step-Audio-EditX/blob/main/README.md).
  - Voxtral TTS: 16 GB+ — [Slator](https://slator.com/mistral-text-to-speech-model/).
  - Breeze TTS 2: 12 GB minimum, 24 GB for the fast path (aggregator) — [pinggy.io](https://pinggy.io/blog/best_open_source_self_hosted_text_to_speech_models/).
  - IndexTTS-2.5: RTF 0.2065 on an RTX 4090 (bf16) — [index-tts GitHub](https://github.com/index-tts/index-tts).
- Serving stacks:
  - Qwen3-TTS: vLLM-Omni (offline) — [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS).
  - CosyVoice2/3: vLLM 0.11+ and TensorRT-LLM — [CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice).
  - Higgs v3 and AuK: SGLang-Omni — [Higgs README](https://cdn.jsdelivr.net/gh/boson-ai/higgs-audio@main/README.md); [AuK](https://huggingface.co/tencent/AuK).
  - IndexTTS-2.5: vLLM deployment — [index-tts GitHub](https://github.com/index-tts/index-tts).
- Kyutai STT gives streaming throughput at scale: 64 concurrent streams at 3x real-time on an L40S (48 GB) — [delayed-streams-modeling](https://github.com/kyutai-labs/delayed-streams-modeling).

### Inferences
- **Commercial-licence-clean 24 GB stack (inference):**
  - Silero VAD (CPU).
  - Parakeet-TDT-0.6B-v3 for transcript and word times (~2–3 GB). Or Kyutai stt-1b-en_fr for live streaming (EN/FR only).
  - WhisperX-style or MFA alignment for cut points.
  - VoxCPM2 (~8 GB) as the primary cloner: continuation with the message's own transcript, plus style instructions.
  - Fun-CosyVoice3-0.5B as a second cloner with instruct speed/emotion.
  - A 7–8B instruct LLM at 4-bit (~5–6 GB is typical; not sourced here).
  - Total is roughly 16–20 GB, leaving headroom for the KV cache.
- **48 GB (e.g. L40S/A6000) adds:**
  - Qwen3-TTS-1.7B-Base (best open EN WER on Seed-TTS-eval)
  - Seed-VC (GPL) as the VC fallback
  - AuK for in-place word replace/insert/remove (MIT; VRAM undocumented; needs Qwen2.5-Omni-3B)
  - or Step-Audio-EditX on demand (~32 GB) for emotion/style re-rendering
- **If non-commercial/research licences are acceptable (prototype phase):** CrisperWhisper 2.0 verbatim (best filler detection plus timing), IndexTTS-2.5 (emotion vectors plus `duration_factor`), F5-TTS (`fix_duration` plus `speech_edit.py`) and Fish S2 Pro (best vendor WER) are the strongest additions.
- **Latency budget:** at RTF 0.13–0.3, regenerating a 3 s phrase takes ~0.4–0.9 s of GPU time on a 4090-class card for VoxCPM2/IndexTTS-2.5. That is acceptable for an edit-then-preview loop (inference from the published RTFs).
- Running everything as separate processes (vLLM for the LLM, a TTS server, an ASR server) with explicit memory caps avoids allocator contention. The user previously capped an RTX 4090 to 18 GB on RunPod, so `gpu_memory_utilization`-style caps per process are the practical knob (inference).

### Gaps
- No primary source gives VRAM for Qwen3-TTS, CosyVoice3, IndexTTS-2.5, Chatterbox, AuK, CrisperWhisper 2.0 or Kyutai STT, so the 24 GB budget above is partly estimated.
- No published end-to-end benchmark of concurrent ASR + LLM + TTS on one 24–48 GB GPU was found.
- LLM memory footprints were not researched (outside scope); the 7–8B 4-bit figure is a common rule of thumb, not a sourced number.
