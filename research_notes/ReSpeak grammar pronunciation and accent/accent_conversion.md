# Accent conversion / de-accenting that keeps the speaker's voice and words (for ReSpeak), as of 2026-10-17

Scope: released accent-conversion (AC) models usable on one A100 today, their quality evidence, how to measure success, ethics and product framing, and downloadable accented-English test data. Every claim below has a source. Unverified items are flagged, and anything without a source is under Gaps.

---

## 1. Released accent-conversion models and code (weights, licence, I/O, timing, quality, GPU)

### Takeaway
Only one permissively licensed, released model has a one-button "de-accent" that returns output the same length as the input: **Tencent AuK** (1.5B, MIT, released 2026-09-09). Its de-accent supervision covers only **Chinese dialects to standard Mandarin**. For English, the authors report only a qualitative observation that it "can reduce accents in English speech" (Indian- and Japanese-accented English), with no numbers. **Amphion Vevo-Style** is the best-documented open English accent/style converter, but its weights are **CC-BY-NC-4.0** (non-commercial), it needs a reference clip in the target accent, and its autoregressive stage regenerates timing. The strongest identity-preserving English AC papers (FAC-FACodec ICASSP 2026, Convert-and-Speak MM'24, Accent Normalization Interspeech 2025, PACE Sept 2026, Activation-Steering SLT 2026) have demo pages and no released weights that I could find.

### Cited Findings

**Tencent Hunyuan AuK: "De-accent" paralinguistic edit (released Sep 2026)**
- Open-sourced 2026-09-09 ("Code and model weights are publicly available"). On 2026-10-14 the distillation training pipeline for AuK-Flash was released. — [GitHub Tencent-Hunyuan/AuK](https://github.com/Tencent-Hunyuan/AuK)
- Licence: MIT. The HF model card tag also reads "License: mit". — [GitHub](https://github.com/Tencent-Hunyuan/AuK); [HF tencent/AuK](https://huggingface.co/tencent/AuK)
- Size and architecture: ~1.5B-parameter transformer backbone, 30 layers (10 dual-stream MMDiT + 20 single-stream DiT). — [AuK Technical Report, arXiv 2609.08936](https://arxiv.org/html/2609.08936)
- Requires Qwen2.5-Omni-3B as the MLLM encoder, downloaded separately (`hf download Qwen/Qwen2.5-Omni-3B`). Python 3.10. — [GitHub](https://github.com/Tencent-Hunyuan/AuK); [HF card](https://huggingface.co/tencent/AuK)
- AuK-Flash: distilled, fixed 4-step inference (NFE=4, CFG=0). HF: `tencent/AuK-Flash`. — [GitHub](https://github.com/Tencent-Hunyuan/AuK)
- VRAM, measured on one A800-80GB in bf16: AuK with a 5 s reference audio uses 25.00 GiB (16.98 GiB with `--cpu_offload`). AuK-Flash uses 24.97 GiB (16.98 GiB with offload). — [GitHub](https://github.com/Tencent-Hunyuan/AuK)
- Task list: De-accent sits under "Paralinguistic Editing" (with Emotion, Timbre, Nonverbal, Whisper Conversion), described as "Remove a regional accent while preserving the speaker's voice and content." — [GitHub](https://github.com/Tencent-Hunyuan/AuK)
- I/O (Cookbook §4.3): one source audio plus a natural-language instruction, no separate text. EN template: "Remove the regional accent while preserving the speaker's voice and content." **Output length matches the input** (no `gen_seconds` passed). The only example is a Sichuan-dialect input converted to standard Mandarin. CLI: `auk-infer --audio <in.wav> --instruction "<...>" --output out_deaccent.wav`. — [AuK COOKBOOK.md](https://github.com/Tencent-Hunyuan/AuK/blob/main/docs/COOKBOOK.md)
- ComfyUI notes: a shared **30-second budget** covers source/reference plus target audio. — [AuK COOKBOOK.md](https://github.com/Tencent-Hunyuan/AuK/blob/main/docs/COOKBOOK.md)
- Training data for de-accent: in-house corpus spanning "13 Chinese dialect and regional-accent categories". Targets were built by (1) synthesizing a same-speaker standard-Mandarin reference with CosyVoice2, using the accented utterance as speaker prompt, then (2) masking the accented source and reconstructing it with OmniVoice, conditioned on the transcript and the Mandarin reference. The target keeps the source timbre and prosody. — [arXiv 2609.08936](https://arxiv.org/html/2609.08936)
- English: the report says "our de-accenting supervision covers Chinese dialects and regional accents only", but "the model can reduce accents in English speech" (Indian- or Japanese-accented English) "while largely preserving speaker identity". This is **qualitative only, with no numbers**. — [arXiv 2609.08936 §7.4](https://arxiv.org/html/2609.08936)
- No de-accent-specific WER/SIM/accent score is reported. The only related number is the paralinguistic column of SpeechEditBench: AuK-Flash 39.25%, AuK 38.50%, Step-Audio-EditX 31.25%, Ming-UniAudio 11.25%. — [arXiv 2609.08936](https://arxiv.org/html/2609.08936)
- Independent commentary flags authenticity risk: voice-preserving content editing means a familiar voice is no longer evidence of authentic recording. — [Sonic Field](https://sonicfield.org/auk-tencent-speech-editing)

**Amphion Vevo / Vevo1.5 / Vevo2**
- Vevo (ICLR 2025): self-supervised disentanglement of timbre and style. Variants: Vevo-Timbre (keeps style, changes timbre), **Vevo-Style (keeps timbre, converts style incl. accent and emotion)**, Vevo-Voice (both), and Vevo-TTS (separate style and timbre references). — [HF amphion/Vevo](https://huggingface.co/amphion/Vevo); [ICLR proceedings](https://proceedings.iclr.cc/paper_files/paper/2025/hash/9328208f88ec69420031647e6ff97727-Abstract-Conference.html)
- Licence of the released weights: **CC-BY-NC-4.0**. Released checkpoints were trained on Emilia (~101k h, 6 languages). Components: content tokenizer vq32 (50 Hz), content-style tokenizer vq8192, Vq32ToVq8192 AR (480M), PhoneToVq8192 AR (740M), Vq8192ToMels flow-matching (330M), and a Vocos vocoder (250M). — [HF amphion/Vevo](https://huggingface.co/amphion/Vevo)
- Vevo-Style usage: `vevo_style(content_wav_path, style_wav_path, output_path)` calls `inference_ar_and_fm(src_wav_path=content, style_ref_wav_path=style, timbre_ref_wav_path=content)`. **The timbre comes from the source, and a style/accent reference recording is required.** The example reference is `arabic_male.wav`. There is no duration argument. — [infer_vevostyle.py](https://raw.githubusercontent.com/open-mmlab/Amphion/main/models/vc/vevo/infer_vevostyle.py); [Amphion vevo README](https://github.com/open-mmlab/Amphion/tree/main/models/vc/vevo)
- Timing: the AR model takes duration-reduced content tokens and generates full-length content-style tokens, so duration is regenerated, not copied. The ablation shows DDUR rising from 0.933 to 1.698 without duration reduction. — [Vevo paper arXiv 2502.07243](https://arxiv.org/html/2502.07243)
- Paper results (ACCENT set = 150 samples from an "internal emotional and accented corpus"; this is voice imitation toward the reference, not de-accenting): Ground truth WER 10.917 / S-SIM 0.762 / A-SIM 0.763. Vevo-Timbre WER 12.351, S-SIM 0.486, A-SIM 0.567, AS-MOS 3.55. Vevo-Voice WER 15.214, S-SIM 0.517, A-SIM 0.614, AS-MOS 3.90. FACodec WER 12.731, S-SIM 0.434. HierSpeech++ WER 12.921, S-SIM 0.466. — [arXiv 2502.07243](https://arxiv.org/html/2502.07243)
- Accent "style imitation" table (vs ASR-AC, VoiceShop, Convert-and-Speak, using baselines' demo samples): Vevo-Style A-ACC reported as 0.663–0.903 across rows, A-CMOS 0.13–0.60. **The table layout was ambiguous in extraction; verify before quoting.** — [arXiv 2502.07243](https://arxiv.org/html/2502.07243)
- The paper itself states training on 60K h of ASR-transcribed English audiobooks (Voicebox data), with AR 463M and FM 334M. The HF release lists Emilia and slightly different sizes, so the released checkpoints differ from the paper's. — [arXiv 2502.07243](https://arxiv.org/html/2502.07243); [HF amphion/Vevo](https://huggingface.co/amphion/Vevo)
- Vevo1.5: licence **cc-by-nc-nd-4.0**. Unified speech and singing, with a prosody tokenizer (6.25 Hz) and content-style tokenizer (12.5 Hz), AR 780M, FM 350M. **The card does not mention accent conversion.** — [HF amphion/Vevo1.5](https://huggingface.co/amphion/Vevo1.5)
- Vevo2 (arXiv 2508.16332; reported accepted to IEEE TASLP): unified speech and singing with prosody and content-style tokenizers. Checkpoint at HF `RMSnow/Vevo2`. Search results did not mention accent tasks. The arXiv *paper* is CC BY-NC-SA 4.0; I did not verify the *weights* licence. — [arXiv 2508.16332](https://arxiv.org/html/2508.16332v3); [HF RMSnow/Vevo2](https://huggingface.co/RMSnow/Vevo2)

**FAC-FACodec (UIUC, ICASSP 2026): controllable-strength zero-shot foreign AC**
- Diffusion over FACodec content latents (first residual zc1), trained only on native LJSpeech (single US speaker, ~24 h). At inference, the L2 latents are noised to `t_start` and denoised toward the native prior with a DDIM-style ODE. Prosody, acoustic-detail and timbre latents are kept fixed. **`t_start` acts as a user-controllable accent-strength knob.** Trained 360 epochs on one A40. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)
- L2-ARCTIC results (24 speakers, 6 L1s). Strength sweep, given as WER / speaker sim / P(American)%: reconstruction 0.05 / 0.98 / 70.51; t=25 0.07 / 0.97 / 72.22; t=50 0.08 / 0.94 / 80.83; t=75 0.10 / 0.91 / 89.16; t=100 0.15 / 0.88 / 89.86. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)
- Head-to-head on small demo-page subsets (competitor vs ours, not comparable across rows): vs Convert-and-Speak WER 0.09/0.09, SS 0.78/0.87, Acc 79.83/46.51; vs Nguyen 2024a (distillation) WER 0.10/0.07, SS 0.80/0.88, Acc 88.73/96.85; vs Nguyen 2024b (discrete units) WER 0.18/0.11, SS 0.83/0.86, Acc 98.38/64.84. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)
- Subjective: MUSHRA-like test, 13 listeners, violin plot only. **No code or weights. Demo only:** https://claussss.github.io/accent_control_demo/ — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)
- Timing: the paper says it changes pronunciation only and keeps the original prosody, contrasting with baselines that regenerate durations. Frame count preservation is not explicitly stated. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)

**Convert and Speak (Microsoft Research Asia, ACM MM 2024)**
- HuBERT semantic tokens are converted source-accent to target-accent by a decoder-only transformer (BART-style infilling pretraining on target-accent data, then fine-tuning on weakly parallel data). A TF-Codec AR "speaking" module then generates audio from the converted tokens plus a 3 s prompt of the source speaker. **Prosody is re-synthesized.** — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2)
- Needs only ~15 min of weakly parallel data, not constrained to the same speaker (Indian English to General American). — [arXiv 2408.10096](https://arxiv.org/pdf/2408.10096)
- L2-ARCTIC (ASI to bdl) results: MOS-Accent (% listeners choosing American) 0.5% source, 79.3% ground truth, **74.3% proposed**. SPK-sim (WavLM-TDNN) 0.641 source vs **0.438** proposed. MOS-Naturalness 4.16 source vs 3.93 proposed. ~11% of outputs were still classified Indian-English by CommonAccent. The authors suggest the speaker extractor retains accent info, which depresses SIM. — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2)
- No code or weights stated; demo page only. — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2)

**Other 2023–2026 zero-shot / discrete-unit / editing approaches (no released weights found)**
- *Accent Normalization Using Self-Supervised Discrete Tokens with Non-Parallel Data* (Bai, Inoue, Wang, …, Haizhou Li; Interspeech 2025): token conversion plus flow-matching synthesis. Proposes **two duration-preservation methods "suitable for applications such as dubbing"** and beats a frame-to-frame baseline. No numbers in the abstract; no code link. — [arXiv 2507.17735](https://arxiv.org/abs/2507.17735)
- *MacST* (Inoue et al., ICASSP 2025): LLM text transliteration plus multilingual TTS to synthesize same-speaker accented/native parallel pairs for training AC. A seq2seq AC reference model was trained on it. Demo at github.com/shinshoji01/MacST-project-page. — [arXiv 2409.09352](https://arxiv.org/abs/2409.09352)
- *PACE: Partial Accent-Control Editing in Frozen Speech Representations* (Qu, Panariello, Todisco, Evans; arXiv 2026-09-18): edits frozen WavLM features and fuses them with retrieved target-accent features. No generator training. It notes speaker similarity is entangled with accent and is traded off. No numbers in the abstract; no code. — [arXiv 2609.22031](https://arxiv.org/abs/2609.22031)
- *Activation Steering for Accent-Neutralized Zero-Shot TTS* (Yang & Hansen; SLT 2026): training-free, inference-time steering vectors from accented-minus-native activations. They neutralize accent leaking from the voice prompt in zero-shot TTS while keeping timbre. SIM is measured in an "accent-orthogonal subspace". Demo at accentsteer.github.io; no code linked. — [arXiv 2603.05977](https://arxiv.org/abs/2603.05977)
- Nguyen et al. 2024a (knowledge distillation with synthetic native-TTS ground truth) and 2024b (discrete units with parallel data from controllable accented TTS) are used as baselines. FAC-FACodec notes baseline code was unavailable. — [arXiv 2410.14997](https://arxiv.org/pdf/2410.14997); [arXiv 2410.03734](https://arxiv.org/pdf/2410.03734); [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)
- Older zero-shot AC: Voice-preserving Zero-shot Multiple AC (arXiv 2211.13282, adversarial accent disentanglement); Pseudo Siamese Disentanglement Network (arXiv 2212.05751, reference-free, British/Indian targets); VoiceShop (arXiv 2404.06674, identity-preserving zero-shot voice editing incl. accent). — [2211.13282](https://arxiv.org/pdf/2211.13282); [2212.05751](https://arxiv.org/abs/2212.05751); [2404.06674](https://arxiv.org/pdf/2404.06674)
- Open legacy code: `guanlongzhao/ppg-gmm` (PPG frame-pairing segmental AC, GMM, uses L2-ARCTIC + CMU ARCTIC) and `unilight/seq2seq-vc` (2023 foreign-AC recipe on L2-ARCTIC, ships pretrained vocoder/VC models). — [ppg-gmm](https://github.com/guanlongzhao/ppg-gmm); [seq2seq-vc](https://github.com/unilight/seq2seq-vc)

**Instruction-editing LLMs**
- Step-Audio-EditX (StepFun, 3B, Apache-2.0, Nov 2025; training code Jan 2026): emotion, speaking-style and paralinguistic editing plus zero-shot TTS. Its dialect support is Sichuanese/Cantonese voice cloning via tags. **Official docs do not list accent conversion.** Only third-party mirrors claim accent changes. — [GitHub stepfun-ai/Step-Audio-EditX](https://github.com/stepfun-ai/Step-Audio-EditX); [HF README](https://huggingface.co/stepfun-ai/Step-Audio-EditX/blob/main/README.md)
- MiMo-Audio (Xiaomi, 7B; released ~Sep 2025): pretraining on >100M h reportedly yields few-shot generalization to voice conversion, style transfer and speech editing. Weights are on GitHub under XiaomiMiMo. **No accent-specific evaluation was found.** — [arXiv 2512.23808](https://arxiv.org/html/2512.23808v1); [hyper.ai](https://hyper.ai/en/tutorials/45488)

**Summary table (from the findings above)**

| System | Weights? | Licence | Input | Timing kept? | English evidence | GPU |
|---|---|---|---|---|---|---|
| AuK / AuK-Flash De-accent | Yes (HF tencent/AuK) | MIT | source wav + text instruction | Yes (same length) | Qualitative only (trained on Chinese dialects) | ~25 GiB bf16, ~17 GiB offload |
| Vevo-Style | Yes (HF amphion/Vevo) | CC-BY-NC-4.0 | source wav + target-accent reference wav | No (AR regenerates) | Paper tables; internal set + demo samples | Not stated (~1.1B total params in pipeline) |
| Vevo1.5 / Vevo2 | Yes | NC-ND (1.5); Vevo2 weights unverified | — | — | No accent task documented | — |
| FAC-FACodec | No (demo) | — | L2 wav, strength t_start | Prosody kept (frame count unconfirmed) | L2-ARCTIC WER/SS/P(US) sweep | Trained on 1×A40 |
| Convert and Speak | No (demo) | — | L2 wav + 3 s prompt | No (re-synthesized) | L2-ARCTIC MOS-Accent 74.3% | — |
| Accent Normalization (IS'25) | No | — | L2 wav | Optional duration-preservation | Abstract only | — |
| PACE (2026) / Activation steering (SLT'26) | No | — | — | — | Abstract only | — |
| Step-Audio-EditX / MiMo-Audio | Yes | Apache-2.0 / (MiMo not checked) | instruction | — | No accent eval | — |

### Inferences
- For a ReSpeak "sound native" button, **AuK is the only drop-in candidate that is commercially usable (MIT), timing-preserving and fits on one A100** (~25 GiB peak in bf16, measured on A800-80GB, so it fits a 40 GB or 80 GB A100; ~17 GiB with CPU offload). Its English behavior is an emergent cross-lingual effect with no published numbers, so it must be benchmarked in-house on L2-ARCTIC before shipping. Same-length output matters for ReSpeak: word timestamps and text alignment from the original recording should stay valid after de-accenting.
- AuK's 30 s ComfyUI budget suggests chunking long voice messages, for example at ASR sentence or pause boundaries. Check whether the CLI has the same limit.
- Vevo-Style is useful as a **research baseline** only (non-commercial licence). It also needs a native-speaker reference clip per output, chosen by the product (e.g., a General American reference voice), and it changes timing.
- ReSpeak already re-synthesizes edited words, so a parallel route is **transcript to zero-shot TTS cloned from the user**. Zero-shot TTS copies the prompt's accent, and that is exactly what the activation-steering paper targets. Vevo-TTS's separate style/timbre references (style = native reference, timbre = user) are another way to decouple them. These would lose the user's original prosody, unlike AuK or FAC-style editing.
- FAC-FACodec's strength-knob design (partial denoising toward a native prior) is the most product-friendly behavior: a slider rather than all-or-nothing. It is reproducible in principle from the paper (LJSpeech + FACodec), but no weights are released.

### Gaps
- No quantitative English de-accent results exist for AuK. The performance figure on GitHub is an image I could not read. Whether `auk-infer` enforces the 30 s limit outside ComfyUI was not confirmed.
- **"Zero-shot accent conversion using pseudo siblings": I could not find any paper with this title or term** (two searches). The closest hits were "Pseudo Siamese Disentanglement Network" (2212.05751) and MacST's same-speaker synthetic pairs. Ask the requester for the exact citation.
- Vevo2 weights licence, and whether Vevo1.5/Vevo2 support accent conversion, were not verified. Vevo GPU memory is not documented.
- Exact Vevo-Style A-ACC/A-CMOS per-baseline numbers need manual checking against Table 4.
- FACodec (Amphion NaturalSpeech3 codec) weights licence was not checked, which matters if reimplementing FAC-FACodec.
- No 2026 English AC model with released weights other than AuK was found. Search coverage of very recent arXiv (Sept–Oct 2026) may be incomplete.

---

## 2. "Golden speaker" / foreign accent conversion literature (Texas A&M, Zhao & Gutierrez-Osuna)

### Takeaway
The Texas A&M line established that accent can be largely separated from voice identity. Using speaker-independent phonetic representations (phonetic posteriorgrams), FAC can cut perceived accentedness substantially (19% to 67% depending on system) while 73% to 80% of listeners still judge the output to be the same speaker. Identity preservation is therefore high but not perfect. Their pedagogical motivation was that learners benefit from imitating a native-sounding version of their own voice, the "golden speaker".

### Cited Findings
- Definition: FAC "generates a synthetic voice that has the voice identity of a second-language (L2) learner and the pronunciation patterns of a native (L1) speaker", referred to as a "golden-speaker" in pronunciation-training literature. — [Zhao, Ding, Gutierrez-Osuna 2021 (IEEE/ACM TASLP)](https://psi.engr.tamu.edu/wp-content/uploads/2021/08/zhao2021reference.pdf)
- Classic FAC needs a native reference utterance at synthesis time. Zhao et al. 2021 made it **reference-free** (pronunciation-correction model trained in two steps). They report a **20.5% relative WER reduction** for an American-English ASR, a **19% reduction in perceived foreign accentedness**, and **>73% of listeners** rating outputs as the same voice identity as the original L2 utterances. — [Zhao et al. 2021](https://psi.engr.tamu.edu/wp-content/uploads/2021/08/zhao2021reference.pdf)
- Quamer et al. (Interspeech 2022) did **zero-shot FAC** for unseen L2 speakers, with a translator and a synthesizer built on PPG bottleneck features. Non-native accentedness fell **67%**, versus 28.9% for a reference-free per-speaker system, and **80%** of listeners rated outputs as the same voice identity. — [Quamer et al. 2022](https://psi.engr.tamu.edu/wp-content/uploads/2023/02/quamer2022interspeech.pdf)
- Golden Speaker Builder (Ding et al., Speech Communication 2019) is an interactive pronunciation-training tool. It is motivated by evidence that L2 learners are more likely to succeed when imitating a speaker whose voice is similar to their own. Learners could choose among regional US accents. — [Ding et al. 2019](https://psi.engr.tamu.edu/wp-content/uploads/2019/11/1-s2.0-S0167639319302675-main.pdf); [CIRCL project page](https://circlcenter.org/exp-perception-and-production-in-second-language/)
- Earlier approach: Felps, Geng & Gutierrez-Osuna (2012) replaced the most accented segments of nonnative speech with alternative segments from a corpus of the same speaker's speech. — [Felps et al. 2012 TASLP](https://psi.engr.tamu.edu/wp-content/uploads/2018/01/felps2012taslp.pdf)
- L2-ARCTIC was created by this group for voice conversion, accent conversion and mispronunciation detection research. — [Zhao et al. 2018 Interspeech](https://psi.engr.tamu.edu/wp-content/uploads/2018/08/zhao2018interspeech.pdf)
- Open code from the group: PPG-based frame-pairing segmental AC. — [guanlongzhao/ppg-gmm](https://github.com/guanlongzhao/ppg-gmm)

### Inferences
- The consistent ~20–27% of listeners who judged the output a *different* speaker is the realistic ceiling to expect even from good systems. Modern papers report the same tension objectively, with SIM dropping as accent strength rises (see Section 3).
- The "golden speaker" framing (learning aid, user-chosen target, own voice) is a more defensible product framing for ReSpeak than "correction". ReSpeak could also offer it as a pronunciation-practice feature: hear yourself sounding native.

### Gaps
- I relied on abstracts and excerpts surfaced by search for the A&M papers, not full-text reads. Listener counts and test conditions are not captured here.

---

## 3. How to measure success (accent classifiers, accentedness MOS, WER, speaker similarity) and what papers report

### Takeaway
Use a three-axis scorecard measured on the same L2 inputs before and after conversion: **(a) nativeness**, as P(US) or P(target) from an accent classifier plus a human accentedness or A/B test; **(b) content**, as WER from Whisper-large-v3 against the known transcript; **(c) identity**, as speaker-embedding cosine to the original. Expect a trade-off curve, not a single winner. Speaker-verification embeddings partly encode accent, so SIM falls as accent is removed, and a "perfect" SIM means nothing changed.

### Cited Findings
**Accent classifiers**
- SpeechBrain CommonAccent ECAPA (`Jzuluaga/accent-id-commonaccent_ecapa`), MIT licence, 16 kHz mono. It has **16 classes of national varieties**: african, australia, bermuda, canada, england, hongkong, indian, ireland, malaysia, newzealand, philippines, scotland, singapore, southatlandtic, us, wales. Test accuracy is 87% (fine-tuned with augmentation). Paper: Zuluaga-Gomez et al., Interspeech 2023, arXiv 2305.18283. — [HF model card](https://huggingface.co/Jzuluaga/accent-id-commonaccent_ecapa)
- Vox-Profile (USC): aggregates 11 open datasets with self-reported English accents, >16 accents. There is a broad Whisper-based classifier (North American / British Isles / other-L1 English) and a narrow 16-label model, `tiantiaf/whisper-large-v3-narrow-accent`. That model takes 16 kHz mono input of ≤15 s, and its card warns that **TTS samples tend to be recognized as "Germanic"**. A successor dialect benchmark, Voxlect, is arXiv 2508.01691. — [Vox-Profile narrow-accent model card (mirror)](https://https-huggingface_co.proxy.bugsmash.io/tiantiaf/whisper-large-v3-narrow-accent); [Voxlect arXiv 2508.01691](https://arxiv.org/pdf/2508.01691)
- An L2-English L1-background accent-ID paper (arXiv 2609.10466, Sept 2026) exists. I did not read it. — [arXiv 2609.10466](https://arxiv.org/pdf/2609.10466)
- How papers use classifiers: FAC-FACodec reports **P(American)** from a black-box classifier as a nativeness proxy and cautions about it. It ranges from 70.51% (reconstruction) to 89.86% (full strength). — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2). Convert-and-Speak used CommonAccent: ~11% of outputs were still "Indian". — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2). Vevo reports **A-SIM** (cosine of CommonAccent embeddings to the reference) and **A-ACC**. — [arXiv 2502.07243](https://arxiv.org/html/2502.07243)

**Content preservation**
- Seed-TTS-eval standard: WER with Whisper-large-v3 (English) and Paraformer-zh (Chinese). — [seed-tts-eval](https://github.com/BytedanceSpeech/seed-tts-eval)
- Reported WERs: FAC-FACodec 0.05 (reconstruction) up to 0.15 at max strength on L2-ARCTIC. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2). Vevo's ACCENT set has GT WER 10.917 vs 12.35 (Vevo-Timbre) and 15.21 (Vevo-Voice). — [arXiv 2502.07243](https://arxiv.org/html/2502.07243). Convert-and-Speak reports LCSR (token longest-common-subsequence ratio) rather than WER: 0.545 for the source, 0.622 proposed. — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2)
- WER from native-trained ASR as an intelligibility gain: Zhao et al. 2021 report a 20.5% relative WER reduction after FAC. — [Zhao et al. 2021](https://psi.engr.tamu.edu/wp-content/uploads/2021/08/zhao2021reference.pdf)

**Speaker similarity**
- Seed-TTS-eval SIM: cosine between embeddings from WavLM-large fine-tuned for speaker verification (`wavlm_large_finetune.pth`). — [seed-tts-eval](https://github.com/BytedanceSpeech/seed-tts-eval)
- Convert-and-Speak used WavLM-TDNN cosine: 0.641 (source vs ref) dropping to 0.438 after conversion. The authors attribute part of the drop to accent information in the extractor. — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2)
- FAC-FACodec's SS goes 0.98 to 0.88 as strength rises. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)
- PACE explicitly notes that speaker similarity is entangled with accent. — [arXiv 2609.22031](https://arxiv.org/abs/2609.22031). Activation-steering computes SIM and SV acceptance in an estimated accent-orthogonal subspace for this reason. — [arXiv 2603.05977](https://arxiv.org/abs/2603.05977)

**Subjective tests**
- Accentedness rating reduction: 19% (Zhao 2021) and 67% (Quamer 2022). Same/different voice identity judgments: >73% and 80%. — [Zhao 2021](https://psi.engr.tamu.edu/wp-content/uploads/2021/08/zhao2021reference.pdf); [Quamer 2022](https://psi.engr.tamu.edu/wp-content/uploads/2023/02/quamer2022interspeech.pdf)
- MOS-Accent as an A/B % choosing American: 74.3% for Convert-and-Speak vs 79.3% for a real native reference. — [arXiv 2408.10096v2](https://arxiv.org/html/2408.10096v2)
- Vevo uses N-MOS (naturalness), SS-MOS (speaker), AS-MOS (accent similarity) and A-CMOS. — [arXiv 2502.07243](https://arxiv.org/html/2502.07243)
- FAC-FACodec ran a MUSHRA-like test with 13 listeners. — [arXiv 2510.10785v2](https://arxiv.org/html/2510.10785v2)

### Inferences
- Suggested ReSpeak acceptance protocol on L2-ARCTIC (24 speakers × held-out sentences):
  - (1) ΔP(US) from CommonAccent and/or the Vox-Profile broad model, reported as a curve. Calibrate on native CMU ARCTIC bdl/slt reading the same prompts as the ceiling.
  - (2) Whisper-large-v3 WER vs the known ARCTIC prompt text, before and after.
  - (3) WavLM-SV cosine to a *different* utterance of the same speaker. This avoids rewarding a copy, and should be compared against the same-speaker baseline (e.g., original vs another original ≈ the reconstruction ceiling).
  - (4) A small human panel for accentedness (1–9 scale or A/B "which sounds more native") and "same speaker?" (yes/no). Targets drawn from the literature: ≥70–80% same-speaker, a large accentedness drop, and WER not worse than the source.
- Watch classifier artifacts. The Vox-Profile card's TTS→"Germanic" bias, and FAC-FACodec's 70.5% P(American) on *unconverted* L2-ARCTIC reconstructions, suggest classifiers are coarse and sensitive to synthesis artifacts. Always score a *resynthesized-but-unconverted* control (codec reconstruction) so gains are attributable to accent change rather than vocoding.
- For a "sounds like themselves" claim, report SIM relative to the reconstruction control, since even passing audio through a codec or vocoder lowers SIM.

### Gaps
- I did not verify the official Vox-Profile HF page directly (only a proxy mirror) or its reported accuracy. A third-party reproduction claimed 0.963 for a WavLM+Whisper ensemble, which is unofficial.
- No standard, widely accepted "nativeness" metric exists. Each paper uses a different proxy (P(US), A-SIM, A/B %), so cross-paper comparison is unreliable.

---

## 4. Risks, ethics, and how products (Sanas, Krisp) present accent conversion

### Takeaway
Real-time accent conversion is shipping commercially. **Sanas** offers "Accent Translation" to a neutral US/UK accent at ~200 ms. **Krisp** offers a speaker-side converter from April 2025 at ~200 ms, and a **listener-side** converter from March 2026 that changes only what the listener hears. Neither is an open or researchable model; they are proprietary apps or SDKs. The products are criticized as "digital whitening" that reinforces the supremacy of standard US English. Vendors respond with "harmonization/clarity" framing and listener-side designs. For ReSpeak, the defensible design is opt-in, own-voice only, user-controlled strength, framed as clarity or pronunciation practice rather than "correction", with honest disclosure.

### Cited Findings
- **Sanas Accent Translation**: help docs describe converting regional English accents into a neutral US or UK accent in real time "while retaining the speaker's unique vocal identity". — [Sanas help docs](https://help.sanas.ai/docs/accent-translation)
- An analyst brief says Sanas models focus on phoneme replacement, retaining intonation and emotion, with ~1/5 s of added latency. — [Intellyx](https://intellyx.com/?p=46033)
- A Sanas patent describes one model that derives a linguistic representation of the speech and a second model that synthesizes it in the target accent. — [US patent 11948550](https://patents.justia.com/patent/11948550)
- Sanas claims >200K contact-center agents in deployment (company claim, in a rebuttal post against Krisp). — [Sanas vs Krisp](https://www.sanas.ai/blog/sanas-vs-krisp)
- Criticism: critics called Sanas racist, saying it makes accents sound "white". The Markkula Center's Don Heider said it "does not counteract the bias, it feeds into and reaffirms that basically everyone should speak in a particular way". — [Santa Clara University Markkula Center](https://scu.edu/ethics/media-mentions/stories/silicon-valley-startup-sparks-controversy-over-what-critics-call-racist-software.html)
- "Digital whitening" critique; the founders later called it an "accent-harmonizing" tool. Counterpoint: the co-founder's own experience of accent discrimination motivated it. — [Nearshore Americas](https://nearshoreamericas.com/accent-software-thrives-despite-being-labelled-racist/); [AI Incident Database](https://incidentdatabase.ai/reports/1963)
- **Krisp speaker-side AI Accent Conversion (Apr 2025)**: converts to American English with ~200 ms delay while keeping the voice. Runs as a virtual microphone in the Krisp desktop app (Zoom/Teams/Meet/Webex). Covers 17+ Indian dialects, with Filipino planned. Coverage noted the demo sounded somewhat robotic. — [People of Color in Tech](https://peopleofcolorintech.com/articles/krisp-announces-ai-tool-to-help-people-sound-like-americans/); [CO/AI](https://about.getcoai.com/news/krisps-ai-accent-converter-transforms-speech-to-american-english-aiding-call-center-communication)
- **Krisp listener-side / "Customer" Accent Conversion (Mar 2026)**: adapts what the *agent* hears so accented customers are easier to understand, "preserving the customer's natural voice, emotion, and context". Only the agent hears the adapted audio. — [CX Today](https://www.cxtoday.com/contact-center/krisp-customer-accent-conversion-contact-centers/)
- The press release title is "Krisp Launches Listener Side Accent Conversion for Meetings, CX and Voice AI Agents". The search snippet says it works at the phoneme level, on-device, at <200 ms, GA for meetings, with an SDK for voice-AI agents. **The page returned 403 to my fetch, so these details come from the search snippet only.** — [BusinessWire 2026-03-03](https://www.businesswire.com/news/home/20260303945269/en/Krisp-Launches-Listener-Side-Accent-Conversion-for-Meetings-CX-and-Voice-AI-Agents)
- Krisp Latin America model: five Latin-American English accents. — [CXM World](https://cxm.world/customer-experience/krisp-launches-first-real-time-ai-accent-conversion-for-latin-america/)
- No independent head-to-head of Sanas vs Krisp quality or latency exists. Both sides' claims are self-reported, and they are in a public dispute. — [Sanas vs Krisp](https://www.sanas.ai/blog/sanas-vs-krisp)
- Open-model risk: voice-preserving editing (AuK) weakens "familiar voice = authentic recording". — [Sonic Field](https://sonicfield.org/auk-tencent-speech-editing)

### Inferences
- Documentation status: Sanas and Krisp are **real and commercially available**, but only as closed products. Sanas has public help docs; Krisp has an app and an announced SDK. Neither publishes model cards, evaluation numbers, or a researchable API for offline voice messages, so they are competitors or benchmarks rather than components.
- ReSpeak design implications:
  - Opt-in per message, own voice only. Never apply it to someone else's voice; this is a consent issue that applies to any timbre-preserving editor.
  - A strength slider, like FAC-FACodec's `t_start`.
  - Avoid "fix/correct your accent" copy. Use "clearer pronunciation" or "native-like pronunciation".
  - Let the user preview and compare against the original.
  - Consider disclosure or provenance metadata, because the output is a synthetic edit of a real voice.
  - Consider a listener-side variant: the recipient chooses to hear an easier-to-follow version. This mirrors Krisp's 2026 pivot, which shifts the "assimilation" burden away from the speaker.
- Identity risk: all systems show SIM drops (0.98 to 0.88 for FAC-FACodec; 0.64 to 0.44 for Convert-and-Speak). Users may feel the result "isn't me", so a quality gate on SIM relative to the reconstruction control is advisable before offering the output.

### Gaps
- I could not access Krisp's or Sanas's current technical docs on supported accent lists, SDK pricing or on-device model size (BusinessWire returned 403).
- No peer-reviewed study was found on listener or user attitudes to *self-chosen* de-accenting in asynchronous messages. Most critique targets employer-mandated call-center use.

---

## 5. Real accented-English test data downloadable today (+ native references)

### Takeaway
For controlled testing, use **L2-ARCTIC**: 24 speakers across 6 L1s, CC BY-NC 4.0, obtained through a free web form with an emailed Google Drive link. Its prompts are the CMU ARCTIC prompts, so **native reference recordings of the same sentences exist** (CMU ARCTIC bdl/slt). Add **speechocean762** (Mandarin-L1, CC BY 4.0, direct download, with expert pronunciation scores) and **EdAcc** (40 h conversational, 25+ accents, CC-BY-SA 4.0, HF, not gated) for realistic voice-message-like speech. Common Voice now requires a Mozilla Data Collective account and forbids re-hosting.

### Cited Findings
- **L2-ARCTIC**: 24 non-native speakers (2M + 2F per L1). L1s are Arabic, Mandarin, Hindi, Korean, Spanish and Vietnamese. Each speaker contributed ~1 h of read speech (~1,132 sentences). ~150 utterances per speaker carry manual phone-error annotations. v5.0 (2020-03-12) added an unscripted "suitcase corpus" from 22 of 24 speakers. Licence CC BY-NC 4.0; contact rgutier@tamu.edu for other uses. Access: fill in name, email and affiliation, accept the licence, and receive an automated email with a Google Drive link (whitelist adas@tamu.edu). Speakers read CMU ARCTIC prompts. — [TAMU L2-ARCTIC page](https://psi.engr.tamu.edu/l2-arctic-corpus/)
- **CMU ARCTIC**: ~1,150 utterances from out-of-copyright Project Gutenberg text. Includes US English bdl (male) and slt (female), both experienced voice talent, plus other accented speakers. Copyright is held by CMU, with terms in the licence file inside each package (not retrieved). A HF mirror (`MikhailT/cmu-arctic`) labels itself MIT, which applies to the mirror only. The data is loadable via `torchaudio.datasets.CMUARCTIC`. — [pyroomacoustics docs](https://pyroomacoustics.readthedocs.io/en/stable/pyroomacoustics.datasets.cmu_arctic.html); [VoxForge copyright note](https://www.voxforge.org/home/about/legal/notice-of-copyright); [torchaudio CMUARCTIC](https://docs.pytorch.org/audio/stable/generated/torchaudio.datasets.CMUARCTIC.html); [HF mirror](https://huggingface.co/datasets/MikhailT/cmu-arctic/tree/main/data)
- **speechocean762** (OpenSLR SLR101): 5,000 English sentences from non-native, Mandarin-L1 speakers, half children and half adults. Each utterance was scored independently by 5 experts. Licence CC BY 4.0. Direct tarball (520 MB) from OpenSLR mirrors; the latest version is at github.com/jimbozhang/speechocean762. — [OpenSLR 101](https://www.openslr.org/101/)
- **EdAcc** (`edinburghcstr/edacc` on HF): ~40 h of dyadic Zoom conversations covering many L1 and L2 English accents. Linguist-standardized `accent` labels plus self-described `raw_accent` and `l1`. The viewer shows 25 accent values, 29 L1 values and 62 speakers. Validation (9.85k rows) and test (9.29k rows) splits only. Licence is listed as "Public Domain and CC-BY-SA 4.0". No gating is mentioned. Loads with `load_dataset("edinburghcstr/edacc")`. — [HF EdAcc](https://huggingface.co/datasets/edinburghcstr/edacc)
- **Speech Accent Archive** (George Mason University): every speaker reads the same "Please call Stella" paragraph. Mirrors list 2,140 samples from 177 countries and 214 native languages. The director described it in 2011 as Creative Commons, free to use if not sold, with citation requested. The site has no bulk-download page (per-sample player). — [GMU how-to](https://accent.gmu.edu/howto); [Gulf News interview](https://gulfnews.com/lifestyle/1300-ways-to-say-the-same-thing-1.639564); [Papers with Code](https://cs.paperswithcode.com/dataset/speech-accent-archive)
- **Common Voice**: since Oct 2025 it is distributed exclusively through **Mozilla Data Collective**, which requires an account and acceptance of its terms. Scripted speech is at v26.0 (2026-06). Accent is an opt-in, self-reported demographic field. Example listing: a v24 English en-AU accent subset, CC0-1.0, which forbids re-hosting and attempts to identify speakers. — [common-voice/cv-dataset](https://github.com/common-voice/cv-dataset); [Mozilla Data Collective listing](https://datacollective.mozillafoundation.org/datasets/cmko7havo02f5nw07rbwwhowe)
- **VCTK 0.92** (Edinburgh DataShare, DOI 10.7488/ds/2645): 110 speakers of varied UK and other accents, ~400 sentences each, including the accent elicitation paragraph. The licence is given as CC BY 4.0 by third-party listings; I did not confirm it on the DataShare record. — [Edinburgh DataShare](https://datashare.ed.ac.uk/handle/10283/3443); [Google Dataset Search](https://datasetsearch.research.google.com/search?query=vctk)

### Inferences
- Best test design: L2-ARCTIC utterances, with the matching CMU ARCTIC bdl/slt recordings of the *same prompt* as the native ceiling for classifier and WER calibration. This gives a parallel "what native sounds like" for each sentence. Use speechocean762 for Mandarin-L1 learners (adults and children) and EdAcc for spontaneous, voice-message-like audio across many accents.
- Licence fit: L2-ARCTIC (NC) and the Speech Accent Archive (NC-style) are fine for internal evaluation but not for training a commercial model without permission. speechocean762 (CC BY 4.0), EdAcc (CC-BY-SA 4.0) and Common Voice (CC0, but no re-hosting) are more permissive.

### Gaps
- The CMU ARCTIC original licence text was not retrieved (festvox.org refused the connection).
- The Kaggle mirror licence for the Speech Accent Archive could not be read (page content empty), and the archive's own current licence version was not confirmed.
- The VCTK licence was not confirmed on the primary DataShare page.
- I did not verify whether EdAcc's HF page has any click-through gating at download time (none was shown on the card).
