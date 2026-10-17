# Tone / speaking-style editing of existing recorded speech for ReSpeak (as of 2026-10-17)

Scope: the user selects a message, or part of one, and asks for it to be more "confident", "professional", "warm/friendly", "calm", "enthusiastic" or "apologetic". The words and the speaker's identity must stay the same. These notes cover released models that restyle existing audio, re-synthesis in a cloned voice, region editing, evaluation, a prosody-only baseline, and test datasets.

Labels used below: [repo] = model card or README (self-reported); [paper] = authors' own paper; [indep] = third-party benchmark; [3rd-party] = blog or aggregator; [inferred] = my reasoning, not stated by a source. Content-editing details (word replacement, VRAM, licences) are already in `C:/Users/ingor/respeak/research_notes/ReSpeak voice editing feasibility/speech_editing_models.md` and are only repeated here when they matter for style.

---

## Q1. Instruction/style editing models with released weights: style vocabularies, success rates, GPU needs

### Takeaway
Only three released models edit the emotion or style of an existing recording on instruction:
- **Step-Audio-EditX** has the richest fixed vocabulary: 14 emotions, 32 styles, iterative.
- **dots.tts.edit** accepts free-text emotion descriptions over a span.
- **Tencent AuK** supports 8 emotions plus whisper, timbre and nonverbal edits.

None of them lists "confident", "professional" or "apologetic" as a native label. Independent benchmarks show low joint success: the target style is reached **and** content is preserved for emotion in only ~3–10% of cases on SpeechEditBench, and ~50% for style with Step-Audio-EditX. Self-reported numbers on synthetic audio are much higher (Step-Audio-EditX 74% emotion, 66% style after 3 iterations).

### Cited Findings

**Step-Audio-EditX (StepFun; tech report Nov 2025, new SFT/DPO/GRPO weights 2026-01-29)**
- **Emotions (14):** happy, angry, sad, fear, surprised, confusion, empathy, embarrass, excited, depressed, admiration, coldness, disgusted, humour — [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Speaking styles (32):** serious, arrogant, child, older, girl, pure, sister, sweet, exaggerated, ethereal, whisper, generous, recite, act_coy, warm, shy, comfort, authority, chat, radio, soulful, gentle, story, vivid, program, news, advertising, roar, murmur, shout, deeply, loudly — [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX). The prior notes said "about 35 styles"; the README table lists 32.
- **Other controls:**
  - Paralinguistic tags: sigh, inhale, laugh, chuckle, exhale, clears throat, snort, giggle, cough, breath, uhm, plus Chinese-style interjection tags such as Surprise-oh and Question-ei.
  - Speed edits: "faster / slower / more faster / more slower".
  - Source: [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Keyword check against the README:**
  - Absent: "confident", "professional", "calm", "apologetic". "Enthusiasm" appears only inside the description of "excited".
  - Present: "authority" (described as authoritative), "serious", "warm" (described as friendly), "gentle".
  - Source: [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Usage:** `--edit-type "emotion" --edit-info "fear"` and `--edit-type "style" --edit-info "whisper"`.
  - Each iteration writes a file (`_edited_iter1.wav`, `_edited_iter2.wav`, …). For whisper, "the edit iteration num should be set bigger than 1".
  - CLI and web app only, with no documented API.
  - Keep audio "under 30 seconds per inference".
  - Source: [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX).
- **GPU:**
  - 3B params, 12 GB "GPU Optimal Memory" at batch 1; "16GB GPU memory should be safer".
  - Memory-efficient mode ~6–8 GB, AWQ-4bit ~8–10 GB.
  - Tested on L40S, Python ≥3.12, PyTorch ≥2.9.1.
  - Code is Apache-2.0; the weights licence is not stated.
  - Source: [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Self-reported accuracy, 2026-01-29 release, Iter0→Iter1→Iter2→Iter3:**
  - Emotion EN: 51.0 → 63.1 → 65.5 → 67.0. Emotion average: 55.6 → 74.3.
  - Style EN: 43.3 → 60.4 → 66.5 → 69.6. Style ZH peaks at Iter1 (70.0), then falls to 62.4 at Iter3. Style average: 47.2 → 66.0.
  - Source: [GitHub README](https://github.com/stepfun-ai/Step-Audio-EditX).
- **Step-Audio-Edit-Benchmark** (the self-reported benchmark):
  - 8 speakers (2M/2F per language for ZH and EN), from WenetSpeech4TTS, GLOBE_V2 and Libri-Light.
  - Emotion set: 2,000 samples over Happy, Sad, Angry, Surprised, Fearful.
  - Style set: 2,800 samples over Child, Exaggerated, Recite, Generous, Act Coy, Older, Whisper.
  - Judge: **Gemini-2.5-Pro**, forced-choice label classification.
  - None of ReSpeak's target styles is in the benchmark's style set.
  - Source: [Step-Audio-Edit-Benchmark](https://github.com/stepfun-ai/Step-Audio-Edit-Benchmark).
- **Editing other systems' output (Gemini-judged, Iter0→Iter3):**
  - Emotion: ElevenLabs-v2 55.7 → 72.2; GPT-4o-mini-TTS 59.7 → 73.5; MiniMax-2.6-hd 63.3 → 74.9.
  - Style: ElevenLabs-v2 47.4 → 67.4; GPT-4o-mini-TTS 49.1 → 66.6.
  - The paper says one editing iteration on cloned audio beat the vendors' native emotion control.
  - Source: [Step-Audio-EditX tech report](https://arxiv.org/html/2511.03601).
- **Caveats stated or implied in the report:**
  - "All evaluation audio is generated via zero-shot voice cloning". **No results on real human recordings.**
  - No speaker-similarity or WER numbers for emotion or style edits.
  - The authors call the method "conditional regeneration or transfer" rather than traditional editing.
  - The tokenizer has "suboptimal disentanglement".
  - Source: [Step-Audio-EditX tech report](https://arxiv.org/html/2511.03601).

**dots.tts.edit (Xiaohongshu dots studio; arXiv 2608.02673, Aug 2026)**
- **Span tag syntax:** `<emo desc="a happy and excited tone">starts after lunch</emo>`. **The `desc` is free-form natural language**, so "a confident, assured tone" can be expressed. Whether the model follows it is untested.
  - Other tags: `<pause act="ins" level="2"/>` (insert, lengthen or shorten), pitch in semitones, and rate (evaluated as a ≥10% duration change).
  - The exact `<rate>` and `<pitch>` syntax is not shown in the paper or on the HF card.
  - Sources: [dots.tts.edit paper](https://arxiv.org/html/2608.02673); [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
- **Scope:** "Emotion operations modify affective expression globally or over a span." The HF card lists "Localized emotion control" — [paper](https://arxiv.org/html/2608.02673); [HF card](https://huggingface.co/dots-studio/dots.tts.edit).
- **Emotion accuracy, Table 3 (one-take; judge Qwen3-Omni-30B-A3B-Instruct; Neutral / Intense shards)** — [paper](https://arxiv.org/html/2608.02673):

  | System | Emotion acc. N / I (%) | WER N / I (%) | SpkSim N / I |
  |---|---|---|---|
  | Identity (unedited source) | 20.43 / 3.50 | — | — |
  | dots.tts.edit | **33.17 / 7.50** | 2.75 / 1.00 | 0.649 / 0.703 |
  | Step-Audio-EditX | 23.08 / 4.00 | 2.46 / 0.63 | 0.701 / 0.780 |
  | AuK + Qwen3-FA | 21.63 / 4.00 | 5.60 / 1.43 | 0.894 / 0.928 |
  | Ming-UniAudio | 25.72 / 4.00 | 6.82 / 0.94 | 0.325 / 0.375 |
  | MiMo-Audio-Instruct | 23.08 / 4.25 | 4.59 / 3.43 | 0.644 / 0.740 |
  | FireRedTTS3-Instruct | 20.43 / 3.25 | 3.70 / 0.68 | 0.906 / 0.918 |

- **dots.tts.edit prosody (one-take):**
  - Duration L1 0.073 s, pitch L1 2.90 st (best in Table 4).
  - Speaker similarity 0.869 for prosody edits, against 0.649 for emotion edits.
  - Source: [paper](https://arxiv.org/html/2608.02673).
- **Authors' own limits:**
  - "Intense emotion remains difficult for all evaluated systems."
  - Emotion is "the hardest component at 21.74%" in compositional edits.
  - "Performance also remains unstable when multiple regions within a short utterance are edited."
  - Source: [paper](https://arxiv.org/html/2608.02673).
- **Size, licence, VRAM:** 2B params, 48 kHz output, EN and ZH. The README says Apache-2.0, but the HF card says "other". Base TTS uses 5.65–10.5 GB VRAM — prior notes, citing [GitHub](https://github.com/studio-dots-ai/dots.tts) and the [HF card](https://huggingface.co/dots-studio/dots.tts.edit).

**Tencent AuK / AuK-Flash (arXiv 2609.08936; open-sourced 2026-09-09)**
- **Emotion categories (8):** "angry, happy, sad, fearful, surprised, disgusted, calm, and excited" — [AuK paper](https://arxiv.org/html/2609.08936).
- **Paralinguistic edits:** emotion, timbre, de-accent, nonverbal sounds and whisper, all via natural-language instruction — [HF AuK](https://huggingface.co/tencent/AuK).
  - Nonverbal editing covers 39 event types.
  - Whisper data is parallel Mandarin normal/whisper pairs.
  - Timbre editing is built from a SeedVC-derived corpus.
  - Source: [paper](https://arxiv.org/html/2609.08936).
- **Free-form instructions:** a **Prompt Enhancer** rewrites free-form requests into "a model-oriented instruction". The paper says "invalid or unsupported requests are rejected before acoustic inference".
  - Section 7.4, "Limits of Native Free-Form Instruction Following", says the agent-built free-form data "did not produce sufficiently robust generalization to arbitrary user requests". Reaching the capability ceiling "still requires the Prompt Enhancer to identify the intended task".
  - **"Confident" or "professional" requests are not discussed.** They are likely to be mapped onto the 8 labels or rejected [inferred].
  - Source: [paper](https://arxiv.org/html/2609.08936).
- **How emotion training data was made:** Qwen3-TTS-CustomVoice synthesised an expressive reference, and IndexTTS2 re-rendered the original speaker with that emotion and the same transcript — [paper](https://arxiv.org/html/2609.08936). The editor is therefore distilled from the re-synthesis route described in Q2 [inferred].
- **Results:**
  - SpeechEditBench Emotion (joint): AuK 9.94, AuK-Flash 6.29, Step-Audio-EditX 7.71, Ming-UniAudio 3.43, as reported in the AuK paper.
  - No emotion-specific speaker-similarity number is reported.
  - The emotion pipeline pairs whole utterances; no masking is mentioned, unlike content, lyric and nonverbal edits.
  - Source: [paper](https://arxiv.org/html/2609.08936).
- **VRAM and licence:** ~25 GiB in bf16, or ~17 GiB with CPU offload. Weights are MIT, but AuK depends on the research-only Qwen2.5-Omni-3B — prior notes, citing [GitHub](https://github.com/Tencent-Hunyuan/AuK).

**SpeechEditBench (independent; CityU HK + Huawei; arXiv 2606.01804 v3, Sep 2026)**
- **Emotion targets:** angry, fearful, happy, sad, surprise, excited, frustrated, playfulness.
- **Style targets:** public-broadcast, intimate, dramatic, restrained-flat, storytelling, conversational. "Public-broadcast" is the nearest to "professional"; "restrained-flat" is the nearest to "calm" [inferred].
- **Scoring:**
  - Judge: Gemini. Emotion needs a label match; style needs a judge score ≥3.
  - Preservation: WER/CER ≤10%.
  - Joint success = target success × preservation.
  - Source: [SpeechEditBench](https://arxiv.org/html/2606.01804).
- **Joint success (target-only in parentheses)** — [SpeechEditBench](https://arxiv.org/html/2606.01804):

  | Model | Emotion | Style |
  |---|---|---|
  | Step-Audio-EditX | 7.71 (9.29) | **49.67** (54.00) |
  | Ming-UniAudio | 3.43 (5.29) | 22.17 (32.50) |
  | Qwen3-Omni | 1.64 (15.29) | 24.17 (63.50) |
  | Kimi-Audio | 2.36 (22.43) | 24.50 (63.33) |
  | MiMo-Audio-Base | 0.21 (8.79) | 5.83 (42.17) |
  | MiMo-Audio-Instruct | 0.86 (42.36) | 0.50 (77.50) |
  | VoxCPM2 ("specialized system") | 3.57 (4.14) | 32.67 (36.67) |
  | Gemini-Live (closed) | 27.79 (34.43) | 63.67 (84.00) |
  | GPT-Realtime (closed) | 14.57 (21.00) | 68.67 (82.33) |

- **Preservation rates:** Step-Audio-EditX 90.00 (emotion) and 88.67 (style); Ming-UniAudio 66.64 and 66.33.
- **Conclusion:** "target-only evaluation can overestimate speech editing ability".
- **Repo:** https://github.com/daxintan-cuhk/SpeechEditBench
- Source: [SpeechEditBench](https://arxiv.org/html/2606.01804).

**Other candidates**
- **Ming-UniAudio-16B-A3B-Edit:**
  - Its edit types are insert, delete and substitute, dialect, speed, pitch, volume and denoise. **Emotion and style are not among its listed operations.**
  - Prior notes, citing the [HF card](https://huggingface.co/inclusionAI/Ming-UniAudio-16B-A3B-Edit). Its weak emotion and style scores are in the tables above.
- **MiMo-Audio-Instruct, Kimi-Audio, Qwen3-Omni:** these general audio LLMs reach high *target* style rates (63–78%) but lose content. MiMo-Instruct's style joint success is 0.50 — [SpeechEditBench](https://arxiv.org/html/2606.01804).
- **SEmoEdit (late Sep 2026):** a training-free emotion-editing method for flow-based TTS. It offers emotion replacement, erasure and continuous interpolation. **Paper only; no weights found** — [chatpaper listing, secondary](https://chatpaper.com/paper/351677).
- **AnyEdit (NeurIPS 2026):** no code or weights released — prior notes, citing [arXiv 2610.15665](https://arxiv.org/abs/2610.15665).

### Inferences
- **Mapping ReSpeak's six targets onto native vocabularies** (from the lists above; "—" means no close native label):

  | ReSpeak target | Step-Audio-EditX | AuK | SpeechEditBench | dots.tts.edit |
  |---|---|---|---|---|
  | confident | authority / serious (style) | — | public-broadcast | free-text `desc` |
  | professional | news / program / radio / serious | — | public-broadcast | free-text |
  | warm / friendly | warm / gentle / chat / comfort | — | conversational / intimate | free-text |
  | calm | gentle (style); no "calm" | calm | restrained-flat | free-text |
  | enthusiastic | excited (emotion) | excited | excited | free-text |
  | apologetic | empathy / embarrass / shy (approximate) | — | — | free-text |

- **Practical first choice:** Step-Audio-EditX. It has the most matching labels, fits in 12–16 GB, has the best independent style joint score, and is iterative. ReSpeak should keep a small mapping layer from user words to its labels. For example, "confident" → style `authority`, or `serious` at 1 iteration.
- **Free-text fallback:** dots.tts.edit, for terms that fit no label (e.g. "apologetic") and for span-level edits. Its emotion success is low in absolute terms: 33% against a 20% no-op baseline.
- **Use AuK** only for "calm", whisper or nonverbal edits, and only in a research or demo setting, because of the Qwen2.5-Omni licence.
- **Expect ~50% failure on real phone recordings.** All self-reported style numbers come from synthetic, cloned evaluation audio. The independent joint style success for the best open model is ~50%. A ReSpeak UI should generate 2–4 candidates (iterations or seeds) and auto-rank them (Q4), not trust one shot.
- **Where Step-Audio-EditX goes wrong:** its 90% content preservation on SpeechEditBench conflicts with the "Content 16.50" figure in the prior notes. That figure was a *content-editing* task score, not preservation during a style edit. For style edits, the bigger risk is speaker drift, which no source measures for Step-Audio-EditX on emotion or style.

### Gaps
- No source measures speaker similarity for Step-Audio-EditX or AuK *emotion or style* edits on real human recordings.
- No source tests "confident", "professional" or "apologetic" as instructions on any editor. Whether AuK's Prompt Enhancer rejects them or maps them was not documented.
- The exact `<rate>` and `<pitch>` tag syntax and the emotion label set used by dots' Qwen3-Omni judge were not found.
- The weights licence of Step-Audio-EditX is not stated on the card.
- No newer (Oct 2026) released style editor was found beyond those above. SEmoEdit's release status could not be verified from a primary source.

---

## Q2. Alternative route: re-synthesise the region in the user's cloned voice with an instruction/emotion-controllable TTS

### Takeaway
Several Apache-2.0 TTS models accept a cloned voice plus a style instruction:
- **VoxCPM2:** parenthesised style text plus reference audio.
- **Fun-CosyVoice3:** `inference_instruct2` with a prompt wav.
- **IndexTTS2/2.5:** a speaker prompt plus an emotion text or vector. Its licence is restrictive.

**Qwen3-TTS does not combine instruct with cloning.** Fish S2 Pro has free-form tags such as `[professional broadcast tone]` but a non-commercial licence. Re-synthesis gives stronger and freer style control than editing. The trade-offs are speaker drift, loss of the user's own micro-prosody and recording channel, and the need to splice.

### Cited Findings
- **VoxCPM2 (Apache-2.0, ~8 GB VRAM):** "controllable cloning" puts a style instruction in parentheses at the start of the text together with `reference_wav_path`. Example: `"(slightly faster, cheerful tone)This is a cloned voice with style control."`
  - Controllable attributes: gender, age, tone, emotion, pace.
  - InstructTTSEval EN: APS 84.2, DSD 83.2, RP 71.4.
  - Whether style text can be combined with prompt continuation (`prompt_wav_path` + `prompt_text`) is not documented.
  - Source: [VoxCPM GitHub](https://github.com/OpenBMB/VoxCPM).
- **Fun-CosyVoice3-0.5B (Apache-2.0):** `inference_instruct2(text, instruct_text, './asset/zero_shot_prompt.wav')` passes the cloned speaker's prompt audio together with an instruction.
  - Example instruction: `'You are a helpful assistant. 请用尽可能快地语速说一句话。<|endofprompt|>'` ("speak as fast as possible").
  - Highlights claim support for "languages, dialects, emotions, speed, volume, etc."
  - No instruct benchmark is published.
  - Sources: [CosyVoice example.py](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/example.py); [CosyVoice GitHub](https://github.com/FunAudioLLM/CosyVoice).
- **Qwen3-TTS (Apache-2.0):** instruction control exists on the 1.7B **VoiceDesign** and **CustomVoice** (preset speakers) models. **Base (cloning) models take no instruct parameter.**
  - The only documented workaround is to design a voice and then clone from it. That does not help restyle *the user's* voice.
  - InstructTTSEval EN for 1.7B-VD: 82.9 / 82.4 / 68.4.
  - Source: [Qwen3-TTS GitHub](https://github.com/QwenLM/Qwen3-TTS).
- **IndexTTS2 / 2.5 (bilibili licence; commercial use needs contact):**
  - Speaker prompt plus emotion control by any of: an emotion reference audio (`emo_alpha` 0–1); an 8-float vector [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]; or text-derived emotion (`use_emo_text`).
  - Prior notes, citing [index-tts GitHub](https://github.com/index-tts/index-tts).
- **Fish Audio S2 Pro (~5B):**
  - Free-form inline word-level tags, e.g. `[whisper in small voice]`, `[professional broadcast tone]`, `[excited]`, `[sigh]`; "15,000+ unique tags".
  - **Fish Audio Research License:** "Commercial use requires a separate license".
  - The card does not say whether tags combine with reference-audio cloning.
  - Source: [HF fishaudio/s2-pro](https://huggingface.co/fishaudio/s2-pro).
- **VoxCPM2 as a style "editor" on SpeechEditBench:** joint 3.57 for emotion and 32.67 for style. Target success is also low (4.14 / 36.67), so the instruction was often not realised — [SpeechEditBench](https://arxiv.org/html/2606.01804). How VoxCPM2 was prompted there was not checked.
- **Distillation evidence:** AuK built its emotion-editing data this way (Qwen3-TTS-CustomVoice reference → IndexTTS2 re-render in the original speaker) — [AuK paper](https://arxiv.org/html/2609.08936). Step-Audio-EditX reports that editing beats vendors' *native* emotion control (MiniMax and Doubao clones at ~49–50 before editing, ~70.5–70.9 after one edit) — [Step-Audio-EditX report](https://arxiv.org/html/2511.03601).

### Inferences
- **Trade-offs: re-synthesis vs. editing.**
  - *For re-synthesis:* free-text instructions, so "confident", "apologetic" and "professional" can be said directly in VoxCPM2 or CosyVoice3. It is controllable per sentence, and the wording is guaranteed because the TTS reads the transcript.
  - *Against re-synthesis:*
    - The clone loses the user's own timing idiosyncrasies and room or mic colouration, so a splice can sound "different person / different room".
    - Speaker similarity of zero-shot clones (~0.7–0.8 SIM on Seed-TTS-eval in the prior notes) is below what editors keep in non-edited regions.
    - Instruction-following on *cloned* voices is weaker than on preset or designed voices, judging from VoxCPM2's low SpeechEditBench target rates.
  - *Editing* keeps more of the original acoustics but has fixed vocabularies and low success rates.
- **Hybrid worth testing:** re-synthesise with VoxCPM2 or CosyVoice3 (instruction plus a clean reference from the same message), then run a speaker-similarity gate and splice. Fall back to Step-Audio-EditX label edits when SIM drops below a threshold.
- **Licence ranking for a commercial product:** VoxCPM2 and CosyVoice3 (Apache-2.0) > IndexTTS2 (needs contact) > Fish S2 (research licence) > AuK (research-only dependency).

### Gaps
- No benchmark measures instruction-following *while cloning a specific real speaker* for VoxCPM2 or CosyVoice3. InstructTTSEval covers voice design, not clone plus instruct.
- CosyVoice3's full instruction list and its handling of English emotion instructions (e.g. "speak confidently") are not documented. Only Chinese dialect and speed examples are shown.
- Whether Fish S2 tags work with reference-audio cloning was not confirmed from the card.

---

## Q3. Region-level editing: restyling only a selected sentence and splicing it back

### Takeaway
Only **dots.tts.edit** natively supports span-scoped emotion (an `<emo desc>` wrapper). Step-Audio-EditX regenerates the whole input (keep it under 30 s), and AuK's emotion editing is trained on whole utterances. The practical recipe is:
1. Cut the selected sentence plus a short context margin at pause boundaries.
2. Restyle it with any method.
3. Splice it back with crossfades at silences.

Sentence or phrase boundaries are also where a natural speaker would change tone.

### Cited Findings
- dots.tts.edit: "Emotion operations modify affective expression globally or over a span".
  - Training builds span targets by splicing a target-emotion rendering into the source and repairing the join with F5-TTS.
  - The authors warn of instability "when multiple regions within a short utterance are edited".
  - Source: [dots.tts.edit paper](https://arxiv.org/html/2608.02673).
- Step-Audio-EditX:
  - Input is the original audio plus a command; the output is the full re-generated token sequence ("conditional regeneration").
  - A mask-based approach for partial changes is mentioned but not detailed.
  - Keep inputs under 30 s.
  - Sources: [tech report](https://arxiv.org/html/2511.03601); [README](https://github.com/stepfun-ai/Step-Audio-EditX).
- AuK: the emotion training pipeline pairs full utterances, with no masking. Content, lyric and nonverbal edits do mask the target intervals — [AuK paper](https://arxiv.org/html/2609.08936).
- No released editor outputs untouched regions bit-exact; all of them re-vocode. The recommended practice is to splice only the edited span using word timestamps (WhisperX or ctc-forced-aligner) and crossfades, as the CosyEdit authors did — prior notes, `C:/Users/ingor/respeak/research_notes/ReSpeak voice editing feasibility/speech_editing_models.md`, citing the [CosyEdit paper](https://arxiv.org/html/2601.05329v1). Splicing and seam metrics are detailed in `.../seamless_splicing_eval.md` in the same folder.

### Inferences
- **Sentence granularity is the natural unit for tone.** Cut at inter-sentence pauses of ≥150–250 ms, where the energy is near silence. Feed the editor the sentence plus ~0.5–1 s of the preceding sentence as context for Step-Audio-EditX or a TTS prompt. Keep only the target span and use a 10–30 ms equal-power crossfade inside the silence.
- **Loudness and F0 matching at the seams:**
  - Restyled audio (especially "confident" or "enthusiastic") will be louder and differently pitched. That is intended, but the jump at the boundary should be plausible.
  - Normalise the span's loudness relative to the neighbours, e.g. allow +1–3 dB for "confident" rather than whatever the model outputs. These numbers are design suggestions, not sourced.
  - Check the F0 at the last voiced frame before the cut against the first voiced frame after it.
- **Avoid sub-sentence restyles** (one word "confident") except for prosody-only edits (Q5). Neural editors are least stable on short, multiple regions.

### Gaps
- No source evaluates seam quality specifically for *style* splices, where prosody discontinuity is intentional, as opposed to content splices.
- dots.tts.edit's span-emotion speaker similarity (0.649 neutral shard) is low. Whether the drift is confined to the span or affects the whole output was not reported.

---

## Q4. Evaluation: did the style actually change, and were words and voice preserved?

### Takeaway
Use three layers:
1. **Pairwise audio-LLM judging** of original vs. edited. Gemini-2.5-Pro is the de-facto judge in both style-editing benchmarks and agrees with humans at roughly inter-human levels on speaking-style judgments.
2. **Classifiers.** emotion2vec+ covers basic emotions; audEERING's arousal/dominance/valence regressor gives dominance as a proxy for confidence (research-only licence).
3. **Interpretable prosodic deltas** grounded in the confidence literature: faster rate, lower mean F0, falling terminal intonation, louder, fewer pauses.

Gate everything on WER and speaker similarity (joint success). Audio LLMs lean on the words, and ReSpeak keeps the words constant, so single-clip absolute judgments are unreliable. Use relative A/B comparisons.

### Cited Findings
**Judges and classifiers**
- Both Step-Audio-Edit-Benchmark and SpeechEditBench use **Gemini-2.5-Pro / Gemini** as judge (forced-choice labels, or a ≥3 style score) — [Step-Audio-Edit-Benchmark](https://github.com/stepfun-ai/Step-Audio-Edit-Benchmark); [SpeechEditBench](https://arxiv.org/html/2606.01804). dots.tts.edit uses **Qwen3-Omni-30B-A3B-Instruct** — [dots paper](https://arxiv.org/html/2608.02673).
- Chiang et al., "Audio-Aware LLMs as Judges for Speaking Styles" (Findings of EMNLP 2025):
  - Judges tested: GPT-4o-audio and Gemini-2.5-pro, on emotion, volume, pace, emphasis, pitch and non-verbal style-following.
  - "Gemini's agreement with humans is in the same range as agreement between human evaluators."
  - Exact kappa values not retrieved.
  - Sources: [arXiv 2506.05984](https://arxiv.org/html/2506.05984v1); [ACL Anthology](https://preview.aclanthology.org/dashboard/2025.findings-emnlp.25).
- Chen et al., "Do Audio LLMs Really LISTEN, or Just Transcribe?" (arXiv 2510.10444, Oct 2025), on six large audio LMs:
  - When words are neutral, models default to "neutral".
  - When lexical and acoustic cues conflict, they fail.
  - Paralinguistic-only performance is "close to chance".
  - Source: [arXiv 2510.10444](https://arxiv.org/abs/2510.10444).
- **Identity baseline:** in dots' benchmark, unedited source audio already scores 20.43% "emotion accuracy" under the Qwen3-Omni judge — [dots paper](https://arxiv.org/html/2608.02673). Report the gain over the identity baseline, not the raw accuracy.
- **emotion2vec+ large:**
  - ~300M params; base ~90M; seed variant also available.
  - 9 classes: angry, disgusted, fearful, happy, neutral, other, sad, surprised, unknown.
  - Trained on ~42.5k h of pseudo-labelled data.
  - Runs via FunASR `AutoModel(model="iic/emotion2vec_plus_large")` at 16 kHz, with utterance or 50 Hz frame granularity and embeddings available.
  - Licence listed as "model-license", unspecified.
  - Source: [HF emotion2vec_plus_large](https://huggingface.co/emotion2vec/emotion2vec_plus_large).
- **audEERING `wav2vec2-large-robust-12-ft-emotion-msp-dim`:**
  - Outputs **arousal, dominance, valence** (~0–1), fine-tuned on MSP-Podcast v1.7.
  - Licence CC-BY-NC-SA-4.0, "for research purpose only"; a commercial model is available from audEERING.
  - Source: [HF card](https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim).
- **SpeechBrain `emotion-recognition-wav2vec2-IEMOCAP`:** Apache-2.0, trained on IEMOCAP, test accuracy "78.7 (Avg: 75.3)". The class list is not on the card; it is the IEMOCAP 4-class setup [inferred, not confirmed on the card] — [HF card](https://huggingface.co/speechbrain/emotion-recognition-wav2vec2-IEMOCAP).
- **Joint metric template:** target success × preservation, with preservation defined as WER/CER ≤10%. SpeechEditBench's speaker check used cosine-similarity threshold 0.50 (for the speaker-edit task) — [SpeechEditBench](https://arxiv.org/html/2606.01804).

**What perceived confidence sounds like (Guyer et al. 2021 review, *J. Nonverbal Behavior*)** — [PMC8553728](https://pmc.ncbi.nlm.nih.gov/articles/PMC8553728)
- **Rate:** speakers asked to sound confident "naturally spoke louder, faster, and with fewer pauses" (Scherer et al. 1973). Brown et al. (1985) found confidence ratings rose linearly from slow to normal to fast. Replicated by Jiang & Pell (2015, 2017), Guyer et al. (2018a), Monetta et al. (2008) and Van Zant & Berger (2020). Very fast speech reduces argument processing (Moore et al. 1986).
- **Pitch level:** higher pitch is associated with *lower* confidence. In Guyer et al. (2018a), digitally lowered pitch "elicited significantly higher ratings of speaker confidence than high pitch".
- **Intonation:** rising intonation is used about twice as often for incorrect answers (Brennan & Williams 1995), and listeners rate falling intonation as more confident.
- **Loudness:** confident speakers are objectively louder (Jiang & Pell 2017; Kimble & Seidel 1991; Scherer et al. 1973), and louder speakers are rated more confident.
- **Fillers and hedges:** the review does not discuss filled pauses or hedges as confidence cues beyond "fewer pauses".
- A newer paper title states "Falling vocal intonation signals speaker confidence and conditionally boosts persuasion" (Vaughan-Johnston, Guyer, Fabrigar, Lamprinakos & Briñol). Its year is listed inconsistently (2024 vs. 2026) — [Cardiff ORCA](https://orca.cardiff.ac.uk/169463); [Durham repository](https://durham-repository.worktribe.com/output/1222274/paralinguistic-features-communicated-through-voice-can-affect-appraisals-of-confidence-and-evaluative-judgments).
- Ponsot et al. (PNAS 2018) used reverse correlation on "bonjour":
  - **Dominance** = "a gradual pitch decrease on both syllables", plus lower mean pitch.
  - **Trustworthiness** = "a rapid pitch increase on the second syllable only", plus a moderate mean-pitch rise.
  - Effects held across listener and speaker sex.
  - Source: [PMC5899438](https://pmc.ncbi.nlm.nih.gov/articles/PMC5899438).
  - Knight et al. criticised generalisation beyond the single word — [UCL letter](https://discovery-pp.ucl.ac.uk/id/eprint/10065040/1/PNAS%20Letter_submitted.pdf).

### Inferences
**Recommended ReSpeak "did it work" check, per restyled span**
1. **Preservation gates (hard):**
   - ASR WER versus the original transcript ≤ ~5–10%.
   - Speaker cosine similarity to the original speaker (ECAPA or WavLM-SV) above a per-user threshold.
   - Measure the gates on the restyled span against the unedited neighbours.
2. **Relative prosodic deltas (cheap, interpretable).** Compute on original vs. edited, using word timestamps:
   - speaking rate (syllables/s, excluding pauses);
   - mean F0 in semitones relative to the speaker's median;
   - F0 range (p90–p10 st);
   - terminal F0 slope over the last ~300–400 ms of each phrase (rise = uptalk);
   - pause count and total pause time;
   - RMS/LUFS energy;
   - filled-pause count ("um/uh", via a disfluency-aware ASR).
   - **"Confident" should show** faster rate, lower or equal mean F0, falling terminals, slightly louder, fewer pauses.
   - **"Calm" should show** slower rate, narrower F0 range, lower energy.
   - **"Enthusiastic" should show** wider F0 range, higher energy, faster.
   - **"Warm/friendly"** is underspecified in the sources here; the trustworthiness prototype (a final rise) is a weak hint.
3. **Pairwise audio-LLM judge:** ask "Which of A/B sounds more <style>? Both say the same words." Randomise the order and require agreement across both orders. This neutralises the lexical bias reported by Chen et al., because the words are identical.
4. **Classifier deltas:** emotion2vec+ for "enthusiastic" (happy/surprised probability up) and "calm" (neutral up, angry down). audEERING dominance up for "confident" in research or demo use only, given its licence.

- **Rank candidates on a combined score.** Generate N candidates (seeds or iterations) and rank them by judge win-rate × preservation gates. This turns the low single-shot success rates in Q1 into an acceptable user experience [inferred].

### Gaps
- Primary full text of Jiang & Pell (2017, *Speech Communication* 88:106–126) was not retrieved. A secondary search summary claimed confident production showed "reduced loudness, flatter intonation". This contradicts the PMC review's statement that Jiang & Pell (2017) found confident speakers louder. I could not resolve which is correct, so I trust the peer-reviewed review.
- No published validation was found of any automatic metric or judge for *confident*, *professional*, *warm* or *apologetic* specifically. Existing judges were validated on emotions and basic style attributes.
- Exact human-agreement statistics from Chiang et al. (2025) were not retrieved.
- No source covers the prosodic correlates of "apologetic" or "professional" speech.

---

## Q5. Prosody-only manipulation (no neural regeneration) as a cheap "more confident" baseline

### Takeaway
There is good experimental evidence that DSP-only changes shift listeners' social judgments while sounding natural:
- Phase-vocoder or PSOLA pitch-contour reshaping (CLEESE, DAVID).
- Digital pitch lowering.
- Speech-rate changes.

So a deterministic "confidence" filter is a defensible baseline that cannot change words or speaker identity:
- flatten or invert terminal rises (remove uptalk) to a falling contour;
- lower mean F0 slightly;
- speed up ~5–10%;
- shorten long pauses;
- add +1–2 dB of gain.

Its ceiling is modest. It cannot add the voice-quality changes that neural restyling can.

### Cited Findings
- Guyer et al. (2018a) **digitally manipulated pitch**. Lower pitch raised perceived confidence and persuasion. Chebat et al. (2007) manipulated intonation, rate and intensity one at a time, and the confident-sounding versions produced more favourable attitudes. Vaughan-Johnston et al. (2020) and Guyer et al. (2020) digitally manipulated pitch and rate together — [Guyer et al. 2021 review, PMC8553728](https://pmc.ncbi.nlm.nih.gov/articles/PMC8553728).
- Brown et al. (1985) varied speech rate (slow, normal, fast), and confidence ratings rose linearly — [PMC8553728](https://pmc.ncbi.nlm.nih.gov/articles/PMC8553728).
- **Ponsot et al. 2018 (CLEESE, IRCAM, open-source phase-vocoder):**
  - The method is described as "fully parametric and realistic", producing "natural-sounding variants". The main text has no formal naturalness test.
  - Applying the dominance prototype (falling contour) to new utterances "significantly increased perceived dominance", and the inverted pattern decreased it (P < 0.001). Flattening to the mean pitch also raised dominance, but less. Effects were weaker for novel words (ηp² = 0.34 for the interaction).
  - The trustworthiness prototype generalised poorly.
  - Loudness and rate were *not* manipulated.
  - Source: [PMC5899438](https://pmc.ncbi.nlm.nih.gov/articles/PMC5899438).
- **DAVID (Rachman et al., *Behavior Research Methods* 2018, open-source):**
  - Real-time (<20 ms) pitch shift, inflection, vibrato and filtering on running speech.
  - Transformed happy, sad and afraid emotions were recognised above chance in French, English, Swedish and Japanese, "with a naturalness comparable to natural speech".
  - A preprint reports that most participants hearing their own voice transformed did not detect the manipulation.
  - Sources: [PMC5809549](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5809549/); [bioRxiv preprint](https://www.biorxiv.org/content/10.1101/038133.full.pdf).
- dots.tts.edit already shows that neural pause, rate and pitch edits keep speaker similarity high (0.869) compared with emotion edits (0.649) — [dots paper](https://arxiv.org/html/2608.02673). Prosody-level changes are inherently safer for identity.

### Inferences
**Concrete baseline ("Make it confident: Lite")**
- Tools: Praat via `parselmouth` (PSOLA manipulation), or WORLD (`pyworld`) analysis/resynthesis on the selected span.
- Steps:
  - (a) Detect phrase-final rises with the terminal-slope metric from Q4, and replace them with a falling or level contour.
  - (b) Shift mean F0 down ~0.5–1.5 semitones.
  - (c) Compress duration ~5–10% and cap internal pauses at ~300 ms.
  - (d) Apply +1–2 dB gain.
  - (e) Optionally delete filled pauses using ASR timestamps.
- The specific magnitudes are my design suggestions, not values from the sources. Calibrate them with the Q4 judge.
- **Inverse presets for other styles:**
  - "Calm": slow ~5–10%, narrow the F0 range, −1–2 dB.
  - "Enthusiastic": widen the F0 range ~20–40%, raise energy.
- **Why ship it first:** zero hallucination risk, identity preserved by construction, CPU-only, and fully local to the selected span. It also serves as a control condition: a neural restyle should beat it on the pairwise judge to justify its cost and risk.
- **Limits:** large PSOLA/WORLD shifts (>~3–4 st, or >~20% tempo) produce audible artefacts [inferred from general DSP practice; no source retrieved]. DSP cannot convincingly create "warm", "apologetic" or "professional", which involve voice quality and articulation.

### Gaps
- No study was found that directly tests "remove uptalk / add falling terminal" on recorded messages and measures perceived *confidence* (as opposed to dominance) with naturalness ratings.
- No published comparison of DSP-only vs. neural restyling for perceived confidence was found.

---

## Q6. Real human emotional/expressive speech for testing, with licences

### Takeaway
For realistic tests of *editing real recordings*, Expresso (CC BY-NC 4.0, 48 kHz, read plus improvised styles including calm, enunciated, sympathetic, projected) is the closest match to ReSpeak's styles. Note how the licences differ:
- **CREMA-D:** ODbL, the most permissive.
- **RAVDESS:** CC BY-NC-SA 4.0.
- **ESD:** research-only, by request form.
- **MSP-Podcast:** free academic licence, signed by an institution.

None contains "confident" or "professional" labels. Those need ReSpeak's own A/B listening tests.

### Cited Findings
- **Expresso (Meta):**
  - Licence: "The Expresso dataset is distributed under the CC BY-NC 4.0 license."
  - 4 speakers (2M/2F); ~40 h by the abstract, 45.9 h by the statistics table; 48 kHz, 24-bit.
  - Read styles: confused, default, enunciated, happy, laughing, narration, sad, whisper.
  - Improvised styles: angry, animal, animal_directed, awe, bored, calm, child, child_directed, confused, default, desire, disgusted, enunciated, fast, fearful, happy, laughing, narration, non_verbal, projected, sad, sarcastic, singing, sleepy, sympathetic, whisper.
  - Download via facebookresearch/textlesslib.
  - Source: [Expresso page](https://speechbot.github.io/expresso/).
- **ESD:**
  - 20 speakers (10 Mandarin, 10 English); 5 emotions (neutral, happy, angry, sad, surprise); 350 parallel utterances.
  - "This database can only be used for research purpose." Access requires a licence form emailed to zhoukun@u.nus.edu.
  - The repo sidebar also shows "MIT license"; this is unreconciled.
  - Source: [ESD GitHub](https://github.com/HLTSingapore/Emotional-Speech-Data).
- **MSP-Podcast:** offered "under an academic license at no cost", and the institution must sign — [UTD MSP Lab](https://ecs.utdallas.edu/research/researchlabs/msp-lab/MSP-Podcast.html); [VoxKitchen catalog](https://voxkitchen.readthedocs.io/en/latest/datasets/msp_podcast/). It has dimensional arousal/dominance/valence labels; the audEERING model above was trained on v1.7 — [HF card](https://huggingface.co/audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim).
- **CREMA-D:** ODbL v1.0 (attribution, share-alike for derived databases). **RAVDESS:** CC BY-NC-SA 4.0. Both are reported via secondary benchmark papers, not the primary licence pages — [arXiv 2510.10444](https://arxiv.org/pdf/2510.10444) (dataset table, as surfaced by search).
- **ParaSpeechCaps (Diwan et al., EMNLP 2025):** 59 style tags, intrinsic (speaker) and situational (utterance) — [arXiv 2503.04713](https://arxiv.org/html/2503.04713v2).
  - Human-labelled PSC-Base is reported as 342 h in v1 and 282 h in v2; the auto-labelled PSC-Scaled is 2,427 h.
  - Whether "confident" or "authoritative" are among the 59 tags was not verified.

### Inferences
- **Test-set recipe:**
  - (a) Expresso "default" and "narration" read clips as *sources* to restyle. Expresso "calm", "projected", "sympathetic" and "fast" clips from the *same speaker* serve as natural reference targets for pairwise judging.
  - (b) ESD's parallel utterances (same text, 5 emotions, same speaker) are ideal for measuring classifier and judge sensitivity when the words are held constant.
  - (c) 20–50 of ReSpeak's own phone-recorded messages, because all published style-editing numbers are on synthetic or studio audio.
- **Licences:** all except CREMA-D are non-commercial or research-only. Use them for internal evaluation, never for training a shipped model, unless separately licensed.

### Gaps
- Primary licence pages for CREMA-D and RAVDESS were not fetched. Treat them as reported, not confirmed.
- No public dataset with human "confident / professional / apologetic" delivery labels on the *same speaker and same text* was found.
- MSP-Podcast's current release version and exact request steps were not retrieved.
