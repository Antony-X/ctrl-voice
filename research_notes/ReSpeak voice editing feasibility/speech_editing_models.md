# Open speech-editing / speech-inpainting models usable today (2026-10-17) for ReSpeak

Evidence tags used on every fact:
- **[repo]** read directly from the official GitHub README or Hugging Face model card.
- **[paper]** the authors' own paper. Benchmark numbers tagged this way are self-reported.
- **[indep]** a benchmark run by a *different* group, e.g. a competitor's paper that evaluates this model as a baseline. It is still not neutral, because competitors have an incentive to make baselines look weak.
- **[3rd-party]** blogs, wikis, aggregators or vendor marketing. Weakest evidence.
- **[inferred]** my own arithmetic or reasoning. Not a sourced fact.

## Q1. Catalogue: which speech editors have released weights and runnable inference code, and what does an engineer need to know about each?

### Takeaway
Ten-plus systems have downloadable weights and inference code. The most relevant for ReSpeak are the 2026 entrants:
- **dots.tts.edit** (Xiaohongshu, Aug 2026, Apache-2.0).
- **AuK / AuK-Flash** (Tencent Hunyuan, Sep 2026). Weights are MIT, but they require the research-only Qwen2.5-Omni-3B.
- **EditVoice** (Sep 2026, Apache-2.0).
- **CosyEdit** (Jan 2026, Apache-2.0).

The established, well-documented options are F5-TTS `speech_edit.py`, VoiceCraft, VoiceCraft-X, SSR-Speech, PlayDiffusion, Ming-UniAudio-Edit and Step-Audio-EditX.

Status of the other names on the candidate list:
- **No released weights:** AnyEdit (real paper, Oct 11 2026, but no code or weights), Voicebox/Audiobox (never released) and MaskGCT editing (no editing code).
- **Not found:** "FluentEditor2" could not be found and may be a mix-up with FluentEditor+, which has no code link.

Almost every model **regenerates the whole utterance**. Bit-exact preservation of unedited audio only happens if you splice the result back into the original yourself.

### Cited Findings

#### 1. dots.tts.edit (Xiaohongshu "dots studio" with SJTU X-LANCE and others), released Aug 2026. Strongest 2026 candidate for word replacement
- **Release.**
  - Released 2026.08 [repo]. Paper arXiv 2608.02673: v1 on 2 Aug 2026, v3 on 28 Sep 2026 [paper] — [arXiv](https://arxiv.org/abs/2608.02673); [GitHub](https://github.com/studio-dots-ai/dots.tts).
  - Affiliation: Xiaohongshu Inc. with SJTU X-LANCE Lab and Nanjing University [paper] — [arXiv HTML](https://arxiv.org/html/2608.02673).
- **Code:** https://github.com/studio-dots-ai/dots.tts. **Weights:** https://huggingface.co/dots-studio/dots.tts.edit [repo] — [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
- **License.**
  - The GitHub README says "dots.tts code and released checkpoints are licensed under Apache-2.0" [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts).
  - The HF card for the edit model lists license "other" and points to the repo [repo] — [HF card](https://huggingface.co/dots-studio/dots.tts.edit). This is a minor inconsistency; check the LICENSE file.
- **Size and output.** 2B params. Core weights BF16, speaker encoder and vocoder FP32. Outputs **48 kHz** audio [repo] — [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
- **Architecture.** Built on dots.tts: Qwen2.5-1.5B LM, a 24-layer semantic encoder and an 18-layer flow-matching DiT [paper] — [arXiv HTML](https://arxiv.org/html/2608.02673).
- **Languages.** English and Mandarin [repo] — [HF card](https://huggingface.co/dots-studio/dots.tts.edit). The base TTS was benchmarked on 24 languages [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts). Editing outside EN/ZH has not been verified.
- **Inputs.**
  - Required: the source audio plus an XML-tagged instruction over the transcript, for example `'Hello <sub targ="small">brave</sub> world.'`.
  - Source and target transcripts are optional; they are derived from the instruction.
  - **No timestamps are needed.**
  - Tags: `<del> <ins> <sub targ=…> <emo> <pitch> <rate> <enhance> <bg> <pause/> <spk_transfer/>`. Malformed instructions are rejected.
  - Sources: [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts); [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
- **Unedited audio.**
  - The card claims it preserves "the speaker and the acoustic context outside edited regions" [repo] — [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
  - The paper says that at inference "unedited regions are regenerated rather than spliced" [paper] — [arXiv HTML](https://arxiv.org/html/2608.02673). **Not bit-exact.**
- **Length.**
  - No hard limit is stated. Memory was measured up to an ~82 s bucket (512 latent patches of ~160 ms each) [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts).
  - The paper uses a max generation length of 500 latent steps, and training concatenates segments up to 40 s [paper] — [arXiv HTML](https://arxiv.org/html/2608.02673).
- **Memory and speed.** These numbers were measured on the base TTS, not on edit: peak VRAM 5.65 GB (<10 s) to 10.51 GB (<82 s), RTF p50 0.15–0.20 on H800 [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts). No edit-specific VRAM or RTF figure was found.
- **Install.**
  - Python 3.10–3.12. Benchmarked on torch 2.8 / CUDA 12.8.
  - `pip install -e . -c constraints/recommended.txt`.
  - CLI: `dots.tts.edit --model-name-or-path dots-studio/dots.tts.edit --source-audio … --instruction '…' --output edited.wav`.
  - Python: `DotsTtsEditRuntime.from_pretrained(..., precision="bfloat16").generate_edit(...)`.
  - Sources: [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts); [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
- **Results on doteBench Text Hard, one-take** [paper, self-reported] — [arXiv HTML](https://arxiv.org/html/2608.02673):

  | Model | Edit WER/CER | Non-edit WER | SpkSim | UTMOS |
  |---|---|---|---|---|
  | dots.tts.edit | 12.95 | 0.85 | 0.772 | 3.49 |
  | Step-Audio-EditX | 19.47 | 0.85 | 0.732 | 3.84 |
  | MiMo-Audio-Instruct | 19.56 | 9.07 | 0.640 | 3.24 |
  | Ming-UniAudio | 145.97 | 13.14 | 0.725 | 2.67 |
  | AuK + Qwen3-FA | 144.63 | 7.54 | 0.900 | 3.37 |

- **Other self-reported results** [paper] — [arXiv HTML](https://arxiv.org/html/2608.02673):
  - Prosody: duration L1 0.073 s, pitch L1 2.90 st, WER 1.95%.
  - Pause-edit direction accuracy 91.83%.
  - Emotion accuracy 33.17% (Neutral) and 7.50% (Intense).
- **Demos.** Edit playground https://dots-studio-dots-tts-edit.hf.space and demo page https://dots-studio-dots-tts-edit-demo.static.hf.space [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts).
- **Known limits** [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts):
  - A prompt text that doesn't match the reference audio degrades stability.
  - Higher WER in Arabic, Hindi, Turkish and Vietnamese.

#### 2. AuK and AuK-Flash (Tencent Hunyuan with SJTU and Shanghai Innovation Institute), released 2026-09-09. Confirmed real; instruction-only editing
- **Release.**
  - News line 2026/09/09: "AuK is now open-source." Tech report arXiv 2609.08936 (Sep 8) [repo] — [HF AuK](https://huggingface.co/tencent/AuK).
  - A third-party wiki dates it 2026-09-09; another aggregator says the card reads 2026/09/07. This is a minor date conflict [3rd-party] — [search summary of ComfyUI Wiki / OrcaRouter](https://comfyui-wiki.com/news/2026-09-13-tencent-auk).
- **Code:** https://github.com/Tencent-Hunyuan/AuK. **Weights:** `tencent/AuK` and `tencent/AuK-Flash` (the latter distilled to 4 steps, CFG=0) [repo] — [GitHub](https://github.com/Tencent-Hunyuan/AuK); [HF AuK-Flash](https://huggingface.co/tencent/auk-flash).
- **License.**
  - AuK weights are MIT [repo] — [HF AuK](https://huggingface.co/tencent/AuK).
  - **However**, AuK needs **Qwen2.5-Omni-3B** as its MLLM encoder. GitHub issue #13 asks for a variant on a permissive encoder "because the required Qwen2.5-Omni-3B is research-only" [repo issue] — [AuK issues](https://github.com/Tencent-Hunyuan/AuK/issues).
  - VentureBeat reports that Omni-3B's terms are "for research only" [3rd-party] — [VentureBeat](https://venturebeat.com/ai/qwen-swings-for-a-double-with-2-5-omni-3b-model-that-runs-on-consumer-pcs-laptops).
  - Fine for a hackathon demo, but not for a commercial product.
- **Size.** 1.5B diffusion transformer [repo] — [HF AuK](https://huggingface.co/tencent/AuK).
- **Tasks.**
  - Content editing: "replace, insert, or remove text", plus lyric editing.
  - Acoustic editing: pitch, speed, volume.
  - Paralinguistic editing: emotion, timbre, de-accent, nonverbal sounds, whisper.
  - Also enhancement and separation.
  - All through a natural-language instruction [repo] — [HF AuK](https://huggingface.co/tencent/AuK).
- **Inputs.**
  - Source audio, an instruction and `--gen_seconds`. Exact CLI from the README: `auk-infer --audio content.wav --instruction "Replace 'but accepting what we cannot have' with 'and living well with dreams unmet'." --output out.wav --gen_seconds 7.0`.
  - **No transcript or timestamps are required.** But you must pick the output duration yourself.
  - Source: [repo] — [GitHub](https://github.com/Tencent-Hunyuan/AuK).
- **Unedited audio.** Training masks only the edited intervals ("modifies only the designated region"), but no preservation metric is reported [paper] — [arXiv 2609.08936](https://arxiv.org/html/2609.08936). Inferred to be regenerated, not bit-exact.
- **Languages.** Trained on bilingual ZH/EN data [paper] — [arXiv](https://arxiv.org/html/2609.08936). Issue #17 reports a much higher WER for zero-shot Polish than for English [repo issue] — [AuK issues](https://github.com/Tencent-Hunyuan/AuK/issues).
- **Length.**
  - ComfyUI nodes limit source plus target to 30 s [repo] — [GitHub](https://github.com/Tencent-Hunyuan/AuK).
  - Training utterances run 1–35 s [paper] — [arXiv](https://arxiv.org/html/2609.08936).
- **VRAM.** Measured in bf16 on an A800: **24.78–25.00 GiB**, or **16.75–16.98 GiB with `--cpu_offload`** [repo] — [GitHub](https://github.com/Tencent-Hunyuan/AuK). This needs a 24 GB+ card, or offload on a 24 GB card.
- **Install and speed.**
  - Python 3.10, `pip install -e .` (extras `.[gradio]` and `.[comfyui]`). No CUDA or torch pin is stated. SGLang-Omni has Day-0 serving support [repo] — [GitHub](https://github.com/Tencent-Hunyuan/AuK).
  - AuK-Flash is claimed to be 4.5× faster in wall-clock time than AuK [paper] — [arXiv](https://arxiv.org/html/2609.08936). No RTF is reported.
- **Self-reported results** [paper] — [arXiv](https://arxiv.org/html/2609.08936):
  - Ming-Freeform-Audio-Edit, Basic-EN WER: AuK 3.85, AuK-Flash 4.71, Ming-UniAudio 10.16.
  - Full-EN semantic ACC: 85.25 / 82.98 / 70.98 in the same order.
  - Full-EN SIM: 0.88 / 0.89 / 0.77.
  - SpeechEditBench Content ACC: AuK 91.83, AuK-Flash 87.50, Ming 76.46, Step-Audio-EditX 16.50.
  - SpeechEditBench Emotion: AuK 9.94, Step-Audio-EditX 7.71.
- **Conflicting independent result.** On doteBench Text Hard, "AuK + Qwen3-FA" scored an edit WER of **144.63** [indep] — [dots.tts.edit paper](https://arxiv.org/html/2608.02673). See the table under dots.tts.edit.
- **Open issues** [repo issues] — [AuK issues](https://github.com/Tencent-Hunyuan/AuK/issues):
  - #23: fails to reproduce shouting or yelling dynamics.
  - #11: multi-GPU request.
- **Hosted demo.** The HF Space `tencent/AuK` shows "Running on Zero" (ZeroGPU) [repo] — [HF Space](https://huggingface.co/spaces/tencent/AuK).

#### 3. EditVoice, released Sep 2026. Confirmed real (arXiv 2609.29889, Apache-2.0)
- **Paper.** "EditVoice: Variable-Length Non-Autoregressive Zero-Shot TTS and Speech Editing with Edit Flows", by Hongyao Deng, Wenhao Guan, Xuetao Lin, Peijie Chen, Weijie Wu, Lin Li and Qingyang Hong. v1 24 Sep 2026, v2 12 Oct 2026 [paper] — [arXiv](https://arxiv.org/abs/2609.29889).
- **Code:** https://github.com/DHY02/EditVoice. **Weights:** https://huggingface.co/DOOD02/EditVoice [repo] — [HF card](https://huggingface.co/DOOD02/EditVoice).
- **License.** Apache-2.0 for EditVoice code and the CosyVoice2-derived files. MIT for the Kimi-Audio vocoder files [repo] — [GitHub](https://github.com/DHY02/EditVoice); [HF card](https://huggingface.co/DOOD02/EditVoice).
- **Size and language.** 0.4B [paper] — [arXiv HTML](https://arxiv.org/html/2609.29889). Trained on 10K h of GigaSpeech, so English [paper] — [arXiv](https://arxiv.org/abs/2609.29889).
- **Inputs.**
  - A JSONL manifest with `source_wav`, `source_text` and `target_text` for end-to-end mode.
  - Cascaded mode also needs `alignment_csv`, `original_spans`, `target_spans` and `edit_types` [repo] — [GitHub](https://github.com/DHY02/EditVoice).
- **Unedited audio.** It copies the Mel frames of retained segments: 31.5% of source frames in end-to-end mode, 76.7% in cascade mode with MFA [paper] — [arXiv HTML](https://arxiv.org/html/2609.29889). The vocoder still re-synthesizes everything, so not bit-exact [inferred].
- **Noise robustness.** `kimi-flow.pt` is fine-tuned for "speech editing in noisy environments" [repo] — [HF card](https://huggingface.co/DOOD02/EditVoice). That is relevant to phone recordings.
- **Install pain.**
  - Python 3.10.
  - Requires the **`ttsfrd` wheel (cp310, Linux x86_64)** plus resources from `FunAudioLLM/CosyVoice-ttsfrd`, which are not bundled.
  - Defaults: 56 generation steps, 8 refine steps, top-p 0.7 [repo] — [GitHub](https://github.com/DHY02/EditVoice); [HF card](https://huggingface.co/DOOD02/EditVoice).
- **RealEdit results** [paper, self-reported] — [arXiv HTML](https://arxiv.org/html/2609.29889):

  | Mode | Model | WER | SIM-o |
  |---|---|---|---|
  | Cascade | EditVoice | 4.40 | 0.981 |
  | End-to-end | EditVoice E2E | 4.67 | 0.975 |
  | Cascade | SSR-Speech | 4.75 | 0.986 |
  | Cascade | VoiceCraft | 5.89 | 0.973 |
  | End-to-end | CosyEdit | 3.94 | 0.973 |
  | End-to-end | Ming-UniAudio | 10.40 | 0.969 |

  RTF is reported only for TTS: 0.0989 on a V100.

#### 4. CosyEdit, released Jan 2026 (arXiv 2601.05329, Apache-2.0)
- **Weights:** https://huggingface.co/CJY/CosyEdit (also on ModelScope). **Code:** https://github.com/CJY1018/CosyEdit. Base model CosyVoice-300M. Tagged English [repo] — [HF card](https://huggingface.co/CJY/CosyEdit).
- **How it works.** "Just one-step" end-to-end editing with no external alignment tools. Handles multi-span insert/delete/substitute in one pass [repo] — [HF card](https://huggingface.co/CJY/CosyEdit).
- **Inputs.** Target text and original speech. The original text is optional [paper] — [arXiv HTML](https://arxiv.org/html/2601.05329v1).
- **Install.** Python 3.10, recursive clone, `pip install -r requirements.txt`, `python example.py`. The sox and libsox-dev system packages may be needed [repo] — [HF card](https://huggingface.co/CJY/CosyEdit).
- **Unedited audio.** It generates the full output. In the authors' end-to-end comparison, unedited regions were replaced with original audio using Whisper + MFA with a brief cross-fade [paper] — [arXiv HTML](https://arxiv.org/html/2601.05329v1).
- **RealEdit results** [paper, self-reported] — [arXiv HTML](https://arxiv.org/html/2601.05329v1):

  | Model | WER | SpkSIM | Edit-MOS |
  |---|---|---|---|
  | CosyEdit | 4.50 | 0.9734 | 4.15 |
  | SSR-Speech | 5.05 | 0.9831 | 4.11 |
  | VoiceCraft | 6.55 | 0.9712 | 4.04 |
  | Ming-UniAudio | 9.98 | 0.9670 | 3.79 |
  | Step-Audio-EditX | 10.76 | 0.9588 | 3.41 |
  | MiMo-Audio | 16.86 | 0.9371 | 3.55 |
  | Ground truth | 6.06 | – | – |

- **Not reported.** VRAM and speed.

#### 5. F5-TTS `speech_edit.py`, with E2-TTS available in the same repo
- **Repo:** https://github.com/SWivid/F5-TTS. Code is MIT. **Pretrained weights are CC-BY-NC** because of the Emilia training data [repo] — [GitHub](https://github.com/SWivid/F5-TTS).
- **Script inputs.** These are hardcoded at the top of the file [repo] — [speech_edit.py](https://github.com/SWivid/F5-TTS/blob/main/src/f5_tts/infer/speech_edit.py):
  - `audio_to_edit`, `origin_text` and `target_text`.
  - **`parts_to_edit` timestamps in seconds**, which you must supply. The comments recommend `ctc-forced-aligner`.
  - `fix_duration` per edit, or None to keep the original duration.
  - Model `F5TTS_v1_Base` (step 1,250,000, EMA). Settings: nfe 32, cfg 2.0, Euler.
  - Vocoder `vocos-mel-24khz` or BigVGAN, at 24 kHz.
- **Unedited audio.** Original mel frames outside the edits are kept as conditioning via `edit_mask`. But the full mel is re-vocoded and the script "does not splice original waveform samples back in", so **not bit-exact** [repo] — [speech_edit.py](https://github.com/SWivid/F5-TTS/blob/main/src/f5_tts/infer/speech_edit.py).
- **Install.**
  - Python ≥3.10.
  - Example stacks: torch 2.8.0 + CUDA 12.8, or torch 2.4.0 + CUDA 12.4. Also supports ROCm, Intel XPU and Apple Silicon.
  - Offline PyTorch RTF is 0.1467 on an L20 at 16 NFE (TTS) [repo] — [GitHub](https://github.com/SWivid/F5-TTS).
- **Checkpoints.** The README says both F5-TTS and E2 TTS base models are on HF [repo] — [GitHub](https://github.com/SWivid/F5-TTS). I did not verify that `speech_edit.py` supports switching to E2-TTS.
- **Languages.** Base checkpoints are trained on Emilia ZH/EN [repo] — [GitHub](https://github.com/SWivid/F5-TTS).
- **Evidence gaps.** No published editing WER/SIM for this script was found, and no GitHub issue about its quality turned up [3rd-party search] — [goodfirstissue index](https://www.goodfirstissue.org/SWivid/F5-TTS).

#### 6. VoiceCraft (jasonppy/VoiceCraft), 2024
- **Weights.** Giga330M and Giga830M released 03/28/2024. TTS-enhanced 330M/830M released 04/22/2024. All at https://huggingface.co/pyp1/VoiceCraft. On 03/15/2025, sampling changed from top-p=1 to top-k=40, which "massively improve[s] editing" [repo] — [GitHub](https://github.com/jasonppy/VoiceCraft).
- **License.** Code CC BY-NC-SA 4.0. **Weights under the Coqui Public Model License 1.0.0.** The phonemizer is GPL-3.0 [repo] — [GitHub](https://github.com/jasonppy/VoiceCraft).
- **Install pins (old stack).**
  - `python=3.9.16`, `torch==2.0.1`, `torchaudio==2.0.2` (CUDA 11.7), `xformers==0.0.22`, `phonemizer==3.2.1`.
  - audiocraft at a pinned commit, espeak-ng.
  - **MFA 2.2.17** with kaldi 5.5.1068 for forced alignment. A Docker route also exists [repo] — [GitHub](https://github.com/jasonppy/VoiceCraft).
- **Editing entry points.** `inference_speech_editing.ipynb` and `inference_speech_editing_scale.py`. The README also refers to `speech_editing_demo.py`, but that file does not exist (issue #168). The TTS model is capped at "prompt + generation ≤ 16 s" [repo] — [GitHub](https://github.com/jasonppy/VoiceCraft); [issues](https://github.com/jasonppy/VoiceCraft/issues).
- **Real-world problems seen in GitHub issues** [repo issues] — [issues](https://github.com/jasonppy/VoiceCraft/issues):
  - #176 "Unable to build on Runpod".
  - #162, #164, #166, #172: the Colab notebooks broke.
  - #157: CUDA memory.
  - #153: "Working in WSL but 10min+ inference".
- **Speed reports conflict.**
  - A student project reports ">90 seconds for inference on a 3 second clip" [3rd-party] — [Erdos Institute PDF](https://erdosinstitute.org/_files/ugd/d4971e_cf02b0072c9c445f854bcb1c41c35ed6.pdf).
  - Replicate says runs "typically complete within 5 seconds" on an L40S [3rd-party] — [Replicate](https://replicate.com/cjwbw/voicecraft).
- **Independent RealEdit numbers.**
  - WER 6.55, SIM 0.9712, Edit-MOS 4.04 [indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1).
  - WER 5.89, SIM 0.973 [indep] — [EditVoice paper](https://arxiv.org/html/2609.29889).
- **HF Space.** `pyp1/VoiceCraft_gradio` currently shows a **build error** [repo] — [HF Space](https://huggingface.co/spaces/pyp1/VoiceCraft_gradio).

#### 7. VoiceCraft-X (UT Austin with Amazon, EMNLP 2025). Real, weights released
- **Code:** https://github.com/zszheng147/VoiceCraft-X. **Weights:** https://huggingface.co/zhisheng01/VoiceCraft-X. Checkpoints `voicecraftx.ckpt` (multilingual), `-en` and `-zh` [repo] — [GitHub](https://github.com/zszheng147/VoiceCraft-X).
- **License.** **CC BY-NC 4.0** [repo] — [GitHub](https://github.com/zszheng147/VoiceCraft-X).
- **Languages (11).** EN, ZH, KO, JA, ES, FR, DE, NL, IT, PT, PL [repo] — [GitHub](https://github.com/zszheng147/VoiceCraft-X). It uses Qwen3 for phoneme-free text processing [3rd-party summary of paper] — [arXiv](https://arxiv.org/html/2511.12347v1).
- **Install.** Python 3.10. Editing needs **MFA 3.2.1**. Entry point `src/speech_editing.ipynb`. No torch or CUDA pin and no VRAM figure [repo] — [GitHub](https://github.com/zszheng147/VoiceCraft-X).
- **Independent result.** SpeechEditBench content joint success **EN 84.00 / ZH 47.00** [indep] — [SpeechEditBench](https://arxiv.org/html/2606.01804).

#### 8. SSR-Speech (ICASSP 2025)
- **Code license.** MIT, with GPL-3.0 for the phonemizer [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech).
- **Weights.** `westbrook/SSR-Speech-English` (GigaSpeech XL) and `westbrook/SSR-Speech-Mandarin` (25k h internal data). The English weights are **CC BY-NC-SA 4.0** [repo] — [HF card](https://huggingface.co/westbrook/SSR-Speech-English); [GitHub](https://github.com/WangHelin1997/SSR-Speech).
- **Inputs.** `--orig_audio`, `--target_transcript` and `--sub_amount`. It uses **WhisperX / faster-whisper** internally to transcribe [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech).
- **Watermark.** An optional watermark Encodec, `wmencodec.th` [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech).
- **Install.** Python 3.9.16, xformers 0.0.22, whisperx 3.1.5, gradio 3.50.2, espeak-ng [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech).
- **Known issues listed in the TODO** [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech):
  - Slow inference due to CFG.
  - "Gradio app needs fixing".
  - The Mandarin model breaks with espeak-ng 1.51.
- **HF Space:** `OpenSound/SSR-Speech` [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech). Its status was not checked.
- **Independent RealEdit numbers.**
  - WER 5.05, SIM 0.9831, Edit-MOS 4.11. It is the best cascade baseline there [indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1).
  - WER 4.75, SIM 0.986 [indep] — [EditVoice paper](https://arxiv.org/html/2609.29889).

#### 9. PlayDiffusion (PlayHT)
- **Licenses.** Code Apache-2.0 [repo] — [GitHub](https://github.com/playht/PlayDiffusion). Weights Apache-2.0 at `PlayHT/PlayDiffusion` [repo] — [HF card](https://huggingface.co/PlayHT/PlayDiffusion).
- **Repo status.** **Archived (read-only) by the owner on Jul 5, 2026** [repo] — [GitHub](https://github.com/playht/PlayDiffusion).
- **Method.**
  - MaskGCT-style masked-token diffusion with a non-causal Llama decoder.
  - BigVGAN decodes the **full** token sequence, conditioned on a speaker embedding.
  - Tokenizer: English-focused BPE with 10k tokens [repo] — [GitHub](https://github.com/playht/PlayDiffusion).
- **Inputs.** Source audio plus target text. It "requires OPENAI_API_KEY env var for ASR and word timings", though another source can be substituted [repo] — [GitHub](https://github.com/playht/PlayDiffusion).
- **Install.** Python 3.11, `pip install '.[demo]'`. No torch, CUDA or VRAM figures are given. No quantitative benchmarks are published [repo] — [GitHub](https://github.com/playht/PlayDiffusion).
- **HF Space.** **Paused** [repo] — [HF Space](https://huggingface.co/spaces/PlayHT/PlayDiffusion).
- **Independent reviews.** None found [3rd-party search] — [sourcepulse](https://www.sourcepulse.org/projects/4175364).

#### 10. Ming-UniAudio-16B-A3B-Edit (inclusionAI / Ant Group)
- **Release.** Ming-UniAudio released 2025-09-30 [repo] — [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit).
- **License conflict.** The HF card says Apache-2.0 [repo] — [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit). The GitHub sidebar says MIT [repo] — [GitHub](https://github.com/inclusionAI/Ming-UniAudio).
- **Size.** HF lists 18B params in BF16. It is a MoE model with ~3B active, per the name [repo] — [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit).
- **Inputs.** Free-form natural-language instruction; "without manual region specification" [repo] — [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit).
- **Edit types.** Insert, delete and substitute words; dialect; speed; pitch; volume; denoise [repo] — [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit).
- **Hardware.** Tested only on H800-80GB and H20-96G with CUDA 12.4. Docker image `yongjielv/ming_uniaudio:v1.1` [repo] — [GitHub](https://github.com/inclusionAI/Ming-UniAudio). I estimate at least ~36 GB VRAM just for the BF16 weights [inferred].
- **Self-reported results, EN** [repo] — [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit):
  - Substitution: WER 8.99, ACC 59.78, SIM 0.78.
  - Insertion: WER 6.63, ACC 71.43.
  - Deletion: WER 14.85, ACC 82.22.
- **Independent results.**
  - RealEdit WER 9.98–10.40 [indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1); [EditVoice paper](https://arxiv.org/html/2609.29889).
  - doteBench Text Hard edit WER 145.97 [indep] — [dots paper](https://arxiv.org/html/2608.02673).
  - SpeechEditBench Content 76.46 [indep] — [SpeechEditBench](https://arxiv.org/html/2606.01804).

#### 11. Step-Audio-EditX (StepFun)
- **Release.** Tech report on 2025-11-06, weights and code on 2025-11-12. New SFT/DPO/GRPO version on 2026-01-29 [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **License and size.** Code Apache-2.0; the weights license is not stated on the card. Described as 3B; HF metadata says 4B BF16 [repo] — [HF card](https://huggingface.co/stepfun-ai/Step-Audio-EditX).
- **Edit types.**
  - About 14 emotions, about 35 speaking styles, 10+ paralinguistic tags, speed, denoise and VAD.
  - **No word-level text inpainting.** "Filler word removal" is only planned [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Inputs.** Reference audio, its prompt text, and `--edit-type` / `--edit-info`, e.g. `emotion fear`. Edits can be iterated [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Languages.** ZH, EN, Sichuanese and Cantonese; JA and KO added 2025-11-28 [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Length limit.** Keep audio **< 30 s** per inference [repo] — [HF card](https://huggingface.co/stepfun-ai/Step-Audio-EditX).
- **VRAM.** About 12 GB minimum, 16 GB recommended. Memory-efficient mode 6–8 GB; AWQ-4bit 8–10 GB (`stepfun-ai/Step-Audio-EditX-AWQ-4bit`) [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Install.** **Python ≥ 3.12, PyTorch ≥ 2.9.1**, `uv sync`, Dockerfile, vLLM support. Tested on L40S / Linux [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Self-reported results.** Emotion accuracy 55.6 at iteration 0 rising to 74.3 at iteration 3. Style 47.2 rising to 66.0 [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Independent results.**
  - SpeechEditBench Style joint 49.67, the best open model, but **Content 16.50**. The authors note its "target gains are often offset by poor content preservation" [indep] — [SpeechEditBench](https://arxiv.org/html/2606.01804).
  - RealEdit WER 10.76, Edit-MOS 3.41 [indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1).
- **HF Space.** `stepfun-ai/Step-Audio-EditX` is **Running** [repo] — [HF Space](https://huggingface.co/spaces/stepfun-ai/Step-Audio-EditX).

#### 12. Candidates that are not usable or could not be verified
- **AnyEdit.** **Real paper, no release.**
  - arXiv 2610.15665, submitted 11 Oct 2026 (v2 14 Oct). Authors Yunjia Zhang, Junan Zhang, Jing Yang, Xueyao Zhang, Fan Fan and Zhizheng Wu. "Accepted to NeurIPS 2026".
  - Separation-free editing that preserves noise, reverb and music, using an autoregressive editor plus a flow-matching acoustic model.
  - **No code or weights are linked.** Only the AnyEditBench dataset is released, at `Ririiiii/anyeditbench` [paper] — [arXiv](https://arxiv.org/abs/2610.15665).
  - The demo page lists "Anonymous Authors" and has no GitHub or HF links [repo] — [demo](https://any-edit.github.io/).
- **MaskGCT (Amphion).** The README has **no speech-editing inference code**, only TTS. Weights at `amphion/MaskGCT`, released 2024-10-19 [repo] — [Amphion MaskGCT](https://github.com/open-mmlab/Amphion/tree/main/models/tts/maskgct). PlayDiffusion is a MaskGCT-style editor (see section 9).
- **FluentEditor.** Code repository `github.com/Ai-S2-Lab/FluentEditor` [paper] — [arXiv 2309.11725](https://arxiv.org/abs/2309.11725v2).
  - FluentEditor+ (arXiv 2410.03719) has no code link [3rd-party search] — [arXiv](https://www.arxiv.org/abs/2410.03719v1).
  - **"FluentEditor2" could not be found** and may be a hallucinated name.
  - FluentSpeech, from the same lineage, scores RealEdit WER 5.97, SIM 0.9274 and Edit-MOS 2.7, much lower naturalness [indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1).
- **UniCATS (AAAI 2024).** Official CTX-txt2vec code exists (X-LANCE), tested on Python 3.7. The vocoder is in a separate repo [3rd-party search] — [GitHub mirror](https://github.com/cantabile-kwok/UniCATS-CTX-text2vec). Editing script and weights were not verified.
- **Voicebox / Audiobox (Meta).** **Never released.** Meta withheld the model and code over misuse concerns, and the Audiobox demo is research-only [3rd-party] — [AI Business](https://aibusiness.com/companies/meta-unveils-revolutionary-audio-ai-but-won-t-release-it).
- **Resemble Fill.** A former commercial inpainting feature that needed a trained voice plus SSML Fill tags [3rd-party] — [Resemble Fill notion](https://resemble.notion.site/Resemble-Fill-df13e549bf874bd6bea60be4e12fc7da). Resemble's generative voice models "are no longer offered as commercial paid products"; the docs are "retained for historical reference" [repo] — [Resemble Voice AI Research Archive](https://docs.resemble.ai/voice-archive.md).
- **Paper-only 2026 editors, no confirmed weights:**
  - Multi Codec Discrete Diffusion (arXiv 2608.06424) [3rd-party search] — [arXiv](https://arxiv.org/pdf/2608.06424).
  - AST training-free editing (arXiv 2604.16056) [3rd-party search] — [arXiv](https://arxiv.org/pdf/2604.16056).
  - UniSAE (arXiv 2606.31128) [3rd-party search] — [arXiv](https://arxiv.org/abs/2606.31128).
  - Self-consistency reward editing (arXiv 2602.00560) [3rd-party search] — [arXiv](https://arxiv.org/abs/2602.00560v1).
- **OmniVoice (k2-fsa).** TTS / cloning / design only, **no editing**. The model is CC-BY-NC [repo] — [HF card](https://huggingface.co/k2-fsa/OmniVoice).
- **General audio LLMs evaluated as editors.**
  - Qwen3-Omni scored SpeechEditBench Content 72.00; Kimi-Audio 34.67; MiMo-Audio-Instruct 64.17, but with near-zero joint success on expressive edits [indep] — [SpeechEditBench](https://arxiv.org/html/2606.01804).
  - MiMo-Audio scored RealEdit WER 16.86 [indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1).

### Inferences
- **Bit-exact preservation.** None of the released models outputs the untouched audio bit-exact; all of them re-vocode or regenerate. ReSpeak should therefore always splice: cut only the edited word span plus some margin from the model output and cross-fade it into the original waveform. The CosyEdit authors did exactly this (Whisper + MFA + cross-fade) for their comparisons. The splice also hides any speaker or quality drift in the rest of the clip. You need word timestamps either way; WhisperX or ctc-forced-aligner give them.
- **Benchmark trust.** The RealEdit (English, single-span) numbers are fairly consistent across two independent papers: SSR-Speech ≈ CosyEdit ≈ EditVoice beat VoiceCraft, and VoiceCraft beats the general LLM editors (Ming, Step-Audio-EditX, MiMo). Rankings on instruction-style benchmarks disagree sharply. AuK is best in its own paper and catastrophic (144.63 WER) in dots' paper. The doteBench result probably reflects instruction-format or "Text Hard" mismatch. Treat every cross-model ranking as provisional until you test on your own phone recordings.
- **Practical VRAM tiers.**
  - Under 16 GB: dots.tts.edit (inferred from the base TTS figures), Step-Audio-EditX, F5-TTS, CosyEdit and EditVoice, all ≤0.5–4B.
  - About 17–25 GB: AuK and AuK-Flash.
  - 40 GB+: Ming-UniAudio-Edit (inferred).
  - A single 24 GB card (4090 / L4 / A10G) covers everything except Ming. A 48 GB card (L40S / A6000) covers everything.
- **Easiest installs.**
  - On modern pip/uv stacks: dots.tts, F5-TTS, AuK and Step-Audio-EditX (the last needs Python 3.12).
  - Painful: VoiceCraft and SSR-Speech (py3.9, torch 2.0.1, MFA, espeak) and EditVoice (the ttsfrd wheel).

### Gaps
- No edit-specific VRAM or RTF was found for dots.tts.edit, AuK content editing, EditVoice, CosyEdit, VoiceCraft-X, SSR-Speech, PlayDiffusion or VoiceCraft. VoiceCraft speed reports conflict (>90 s vs ~5 s per run).
- No independent user reports (Reddit, HF discussions) were found for dots.tts.edit, AuK editing, EditVoice, CosyEdit or PlayDiffusion. All are recent, and the evidence is the authors' own or competitor papers.
- I did not verify max edit-span length for any model. Whether F5-TTS `speech_edit.py` can load the E2-TTS checkpoint was also not verified.
- Unresolved license questions:
  - The license metadata of the dots.tts.edit card ("other") versus the repo's Apache-2.0.
  - The Step-Audio-EditX weights license.
  - The Ming-UniAudio license (Apache-2.0 vs MIT).
  - The exact Qwen2.5-Omni-3B license text. Its LICENSE file was not read directly.
- No editing evaluation was found on noisy, casual phone-mic speech for any released model. AnyEdit targets exactly this but is unreleased; EditVoice's noise-robust flow is the only released attempt.

## Q2. Which 2–3 are the best bets for (a) short word or phrase replacement in a 10–60 s casual phone or laptop voice message, and (b) instruction-based tone changes (calmer, friendlier, more confident)?

### Takeaway
**(a) Word replacement:**
1. **dots.tts.edit**: tags, no timestamps, Apache-2.0, small and modern.
2. **F5-TTS `speech_edit.py`** with WhisperX/ctc-forced-aligner timestamps and a waveform splice: the most predictable pipeline, but its weights are non-commercial.
3. **An English RealEdit leader as the quality alternative:** SSR-Speech or VoiceCraft for maturity, or CosyEdit / EditVoice for newer Apache-licensed weights.

AuK-Flash is a strong instruction-only option if you have 24 GB and accept its research-only encoder.

**(b) Tone changes:**
1. **Step-Audio-EditX**: the most mature emotion and style control, but weak content preservation.
2. **AuK**: emotion and whisper edits via instruction.
3. **dots.tts.edit `<emo>/<rate>/<pitch>/<pause/>`**: localized prosody control.

Expect low success on true emotion edits. Even the best systems score ≤ ~28% joint success on SpeechEditBench emotion.

### Cited Findings
- **Splicing needs no timestamps with dots.tts.edit.** It takes a transcript with inline `<sub targ="…">…</sub>` tags, needs no timestamps, outputs 48 kHz, and is EN/ZH [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts). That fits a "voice message editable like text" UI: the ASR transcript becomes the instruction directly.
- **dots.tts.edit leads its own text-edit benchmark.** On doteBench Text Hard its edit WER is 12.95, against 19.47 for Step-Audio-EditX and 144–146 for AuK and Ming. Its non-edit WER is 0.85 [paper / indep for the baselines] — [dots paper](https://arxiv.org/html/2608.02673).
- **F5-TTS needs explicit timestamps and durations.** It requires `parts_to_edit` timestamps and `fix_duration`, and keeps the original mel as conditioning [repo] — [speech_edit.py](https://github.com/SWivid/F5-TTS/blob/main/src/f5_tts/infer/speech_edit.py). Weights are CC-BY-NC [repo] — [GitHub](https://github.com/SWivid/F5-TTS).
- **English RealEdit leaders by WER:**
  - CosyEdit 4.50 vs SSR-Speech 5.05 vs VoiceCraft 6.55 [paper/indep] — [CosyEdit paper](https://arxiv.org/html/2601.05329v1).
  - EditVoice 4.40 vs SSR-Speech 4.75 vs VoiceCraft 5.89 [paper/indep] — [EditVoice paper](https://arxiv.org/html/2609.29889).
- **VoiceCraft-X is multilingual.** It edits in 11 languages and scored SpeechEditBench content EN 84.00 / ZH 47.00, but it is CC BY-NC 4.0 [repo/indep] — [GitHub](https://github.com/zszheng147/VoiceCraft-X); [SpeechEditBench](https://arxiv.org/html/2606.01804).
- **AuK-Flash takes plain-English instructions.** It runs 4-step and accepts instructions like "Replace 'X' with 'Y'". It needs ~25 GiB bf16, or ~17 GiB with CPU offload [repo] — [GitHub](https://github.com/Tencent-Hunyuan/AuK).
- **Step-Audio-EditX tone control.** It offers about 14 emotions and about 35 styles with iterative refinement, using 12–16 GB (AWQ 8–10 GB) for clips under 30 s [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX).
- **SpeechEditBench emotion and style results** [indep] — [SpeechEditBench](https://arxiv.org/html/2606.01804):

  | System | Emotion joint | Style joint |
  |---|---|---|
  | Step-Audio-EditX | 7.71 | 49.67 |
  | Ming-UniAudio | 3.43 | 22.17 |
  | Gemini-Live (closed) | 27.79 | 63.67 |
  | GPT-Realtime (closed) | 14.57 | 68.67 |

- **AuK reports the best emotion score.** SpeechEditBench Emotion 9.94 vs Step-Audio-EditX 7.71 [paper] — [AuK report](https://arxiv.org/html/2609.08936).
- **dots.tts.edit tone-related results.** Emotion accuracy 33.17% (Neutral) and 7.50% (Intense). Prosody duration L1 0.073 s, pitch L1 2.90 st [paper] — [dots paper](https://arxiv.org/html/2608.02673).

### Inferences
- **Recommended demo stack for (a):**
  1. Run WhisperX for transcript and word timings.
  2. When the user edits a word, build a dots.tts.edit `<sub>` instruction.
  3. Run it on a clip of about 10–20 s around the edit, or on the whole message if ≤ ~40 s, the training length.
  4. Splice only the edited span back with a 20–50 ms cross-fade.
  5. Keep F5-TTS `speech_edit.py` as a fallback. It uses the same timestamps.
- **Long messages.** For 60 s messages, cropping a local window around the edit is safer than feeding the whole clip. Training and limit evidence for most models is ≤30–40 s (Step < 30 s; AuK 1–35 s training and a 30 s ComfyUI limit; dots training ≤40 s).
- **For (b), "calmer / friendlier / more confident" is hard to do reliably on open models.** A pragmatic demo might:
  - Use Step-Audio-EditX with an emotion or style plus 1–3 iterations, or AuK with a plain instruction.
  - Rely on rate, pitch and pause edits (dots.tts.edit `<rate>`, `<pitch>`, `<pause/>`) for "calmer" and "more confident". Its prosody and pause metrics are far stronger than its emotion metrics.
  - Present results as "suggested take" variants the user can pick from.
- **Content drift after tone edits.** Because Step-Audio-EditX has weak content preservation, ReSpeak should re-run ASR on its output and reject takes whose WER against the intended transcript is too high.

### Gaps
- No model has been evaluated on casual phone or laptop-mic messages with room noise. Performance on ReSpeak-style input is unknown until tested.
- No head-to-head of dots.tts.edit vs EditVoice / CosyEdit / SSR-Speech on the same benchmark was found.
- No perceptual (MOS) data exists for "friendlier" or "more confident" style edits specifically. The style taxonomies don't map one-to-one onto these adjectives.

## Q3. Are there hosted APIs or Spaces that offer speech inpainting and could serve as a fallback?

### Takeaway
There is no reliable commercial speech-inpainting API today:
- **PlayHT** is shut down.
- **Resemble** has stopped selling its voice products.
- **Descript** Regenerate is in-app only, with no public API found.
- **ElevenLabs** has no documented speech-inpainting endpoint; its inpainting API is music-only and enterprise.
- **fal.ai** has nothing found.

Usable fallbacks are HF Spaces (Step-Audio-EditX running; AuK on ZeroGPU; the dots.tts.edit playground exists) and Replicate's `cjwbw/voicecraft`. All are rate-limited and unsuitable for a live demo dependency.

### Cited Findings
- **HF Spaces status:**
  - `stepfun-ai/Step-Audio-EditX`: **Running** [repo] — [HF Space](https://huggingface.co/spaces/stepfun-ai/Step-Audio-EditX).
  - `tencent/AuK`: "Running on Zero" (ZeroGPU) [repo] — [HF Space](https://huggingface.co/spaces/tencent/AuK).
  - `PlayHT/PlayDiffusion`: **Paused** [repo] — [HF Space](https://huggingface.co/spaces/PlayHT/PlayDiffusion).
  - `pyp1/VoiceCraft_gradio`: **Build error** [repo] — [HF Space](https://huggingface.co/spaces/pyp1/VoiceCraft_gradio).
  - The dots.tts.edit playground is at https://dots-studio-dots-tts-edit.hf.space [repo] — [GitHub](https://github.com/studio-dots-ai/dots.tts). Its live status was not determinable.
  - SSR-Speech Space at `OpenSound/SSR-Speech` [repo] — [GitHub](https://github.com/WangHelin1997/SSR-Speech). Status not checked.
- **StepFun Audio Studio** has a web edit tab at stepfun.com/studio/audio?tab=edit [repo] — [GitHub](https://github.com/stepfun-ai/Step-Audio-EditX). No API was verified.
- **Replicate `cjwbw/voicecraft`** ("Zero-Shot Speech Editing and Text-to-Speech in the Wild") runs on an L40S at ~$0.0047 per run, with runs "typically" under 5 s [3rd-party/vendor] — [Replicate](https://replicate.com/cjwbw/voicecraft). I could not confirm that the API exposes editing parameters (transcript, edit spans).
- **PlayHT shutdown.** Meta acquired PlayAI in July 2025. The public API stopped accepting requests on July 26, 2025, and the platform was terminated on Dec 31, 2025 [3rd-party, secondary] — [cognitivefuture.ai](https://cognitivefuture.ai/elevenlabs-vs-playht-alternatives/). infrabase.ai gives a conflicting December 2025 acquisition date [3rd-party] — [infrabase](https://infrabase.ai/audio/playht).
- **Resemble.** Its generative voice models "are no longer offered as commercial paid products … documentation … retained for historical reference" [repo] — [Resemble archive](https://docs.resemble.ai/voice-archive.md). Older docs had an asynchronous "Audio Edit" inpainting API in open beta [3rd-party search summary] — [Resemble Fill page](https://www.resemble.ai/fill/).
- **Descript.**
  - Overdub has been folded into "Regenerate". It requires a custom AI speaker authorized for the original speaker, supports English only, and allows ≤250 characters per regenerate action. Only the in-app UI is documented [vendor help] — [Descript help](https://help.descript.com/hc/en-us/articles/13832955606413-Use-Regenerate-to-change-what-was-said); [changelog](https://feedback.descript.com/changelog/release-version-103).
  - No public API for Regenerate was found.
- **ElevenLabs.**
  - Its documented inpainting is **music**, enterprise only ("contact sales") [vendor docs] — [ElevenLabs music inpainting](https://elevenlabs.io/docs/eleven-api/guides/how-to/music/inpainting).
  - Studio marketing says "change the text" to regenerate a line in the same voice. That is within Studio projects; no API was confirmed [vendor marketing] — [ElevenLabs Studio page](https://start.elevenlabs.io/studio-competitors/murf).
- **tts.ai "AI Audio Inpainting".** A third-party site with an inpainting API (start/end seconds plus replacement text). It gives conflicting limits and names open models (OpenVoice, CosyVoice 2), so its reliability is low [3rd-party] — [tts.ai](https://tts.ai/audio-inpainting/).

### Inferences
- **Self-hosting is the realistic path.** A single rented 24–48 GB GPU running dots.tts.edit and/or F5-TTS behind a small FastAPI endpoint is more reliable for a hackathon demo than any hosted fallback.
- **Backup only.** Keep HF Spaces (Step-Audio-EditX, AuK) as a manual backup for showing tone edits, through `gradio_client`. ZeroGPU quotas and queueing make them risky to depend on live.

### Gaps
- No API documentation was found confirming programmatic speech inpainting at ElevenLabs, Descript or fal.ai.
- Replicate's VoiceCraft input schema and editing support were not verifiable from the page fetch.
- No hosted endpoint was found for dots.tts.edit, AuK or EditVoice beyond HF Spaces.
