# Automatic detection of self-repairs, disfluencies, abandoned thoughts and semantic units (for ReSpeak: semantic undo, self-correction removal, "scratch that" commands)

Research date: 2026-10-17. Scope: how to find the exact word-index spans to cut from a time-aligned ASR transcript. Every fact below has an inline source. Inferences and design recommendations are kept in the "Inferences" subsections. Claims I could not verify are listed under "Gaps".

---

## 1. Linguistic structure of repairs (Shriberg, Levelt), repair types, and how they map to cut spans

### Takeaway
The standard Shriberg (1994) scheme, used in Switchboard annotation, splits a repair into **reparandum** (the material to discard), the **interruption point** (a moment in time, not a word), an optional **interregnum** (editing terms such as "uh", "no wait", "I mean") and the **repair** (what to keep). For ReSpeak, the cut span is reparandum plus interregnum. Substitutions and repetitions have a clear reparandum. Restarts and abandoned utterances have an empty repair and are much harder to delimit. Levelt's data shows speakers tend to finish a correct word before stopping, and that editing terms differ by type of trouble, which supports using explicit editing terms as strong cues.

### Cited Findings
- In Shriberg's (1994) scheme, the reparandum is the faulty material that is replaced or ignored. It is usually short and is often a rough copy of the repair, though it can be unrelated to it. — [LARD, arXiv 2201.05041](https://arxiv.org/pdf/2201.05041); [Passali et al., "Artificial Disfluency Detection, Uh No, Disfluency Generation for the Masses", arXiv 2211.09235](https://arxiv.org/pdf/2211.09235)
- The interruption point is an unspoken moment in time, not a word. It marks where the speaker stops to correct, and it may not match the moment the speaker detected the trouble. — [arXiv 2211.09235](https://arxiv.org/pdf/2211.09235); [Grosman, UCLouvain](https://research.dial.uclouvain.be/entities/publication/22798672-7af5-413a-86eb-6fe32ed08930)
- The interregnum is optional. It sits between the interruption point and the repair and holds editing terms or discourse markers. Removing reparandum and interregnum leaves a fluent utterance. — [LARD](https://arxiv.org/pdf/2201.05041); [DISCO, arXiv 2310.16749](https://arxiv.org/pdf/2310.16749)
- Word-retrieval hesitations often have no clear reparandum, so the interruption point is hard to place for them. — [Li & Tilsen 2015](https://conf.ling.cornell.edu/~tilsen/papers/Li%20&%20Tilsen%20-%202015%20-%20phonetic%20evidence%20for%20two%20types%20of%20disfluency.pdf)
- Jamshid Lou & Johnson (ACL 2020) use Shriberg's typology to define three repair types. **Repetitions**: reparandum and repair are identical. **Corrections**: they differ, and these are "much harder to detect". **Restarts**: the speaker abandons a sentence and starts a new one, so the repair is empty. — [Jamshid Lou & Johnson 2020, arXiv 2004.05323](https://arxiv.org/pdf/2004.05323)
- Only 5.9% of Switchboard words are disfluent (EDITED). — [Jamshid Lou & Johnson 2020](https://arxiv.org/pdf/2004.05323)
- Levelt (1983) describes self-repair as three phases: monitoring and interrupting, a hesitation phase with editing terms, then the repair. In 959 spontaneous self-repairs, speakers interrupted soon after detecting the trouble, except that correct words tended to be completed. — [Levelt 1983, MPI record](https://forms.mpi.nl/node/46259)
- Levelt (1983) found that speech errors trigger different editing terms than merely inappropriate words do, and that trouble detected quickly is preferably signalled with "uh". — [Levelt 1983, MPI record](https://forms.mpi.nl/node/46259)
- Annotation schemes vary in which classes they cover. Switchboard-based work separates EDITED (reparandum) from INTJ (interjections/fillers) and PRN (parentheticals), and the Z-Scores and DRES metrics report results per class. — [Z-Scores, arXiv 2509.20319](https://arxiv.org/abs/2509.20319); [Jamshid Lou & Johnson 2020](https://arxiv.org/pdf/2004.05323)
- Romana et al.'s frame-level Switchboard labels use five classes: filled pause (FP), partial word (PW), repetition (RP), revision (RV) and restart (RS). — [Romana et al., arXiv 2311.00867](https://arxiv.org/html/2311.00867v1); [code repo](https://github.com/amritkromana/disfluency_detection_from_audio)

### Inferences
- Mapping to ReSpeak operations:
  - **Substitution or correction** ("Monday, no wait, Wednesday"): reparandum = "Monday", interregnum = "no wait". Cut = [reparandum start, interregnum end]. Keep the repair.
  - **Repetition** ("I I think"): cut the first copy. Low risk, and detection is near-solved (about 97 F1 on Switchboard dev, see section 2).
  - **Restart** ("I was going to, let's just meet at noon"): cut from the start of the abandoned fragment to the start of the new sentence. Where the fragment starts is ambiguous, and getting it wrong deletes a clause the user wanted.
  - **Abandoned utterance at the end of a message**: there is no repair, so the cut runs to the end. This is closest to "semantic undo".
  - **Fillers and interregnum only** ("uh", "you know"): optional cleanup and a separate toggle.
- The reparandum usually "rhymes" with the repair: same syntactic slot and semantic type (day replaces day, number replaces number). ReSpeak can use this as a validation check ("type parity") before deleting a meaning-bearing word.
- The interruption point is not a word, so cut boundaries should be placed in the audio gap between words, not inside a word's timestamp.

### Gaps
- I did not retrieve Shriberg's 1994 thesis itself. The definitions above come from papers that summarize it.
- The full text of Levelt (1983) was not retrieved, so the exact editing-term categories ("error" vs "appropriateness" repairs) are not verified beyond the abstract.

---

## 2. Datasets and benchmarks; state-of-the-art accuracy (text vs. audio vs. multimodal); streaming detection

### Takeaway
On gold (human) Switchboard transcripts, fine-tuned text models reach about 89 to 91 F1 for detecting EDITED (reparandum) words and about 94 to 95 F1 when fillers and parentheticals are included. Repetitions are close to solved (about 97 F1). Corrections and restarts are harder. On real ASR output, text-only detection falls sharply (weighted F1 0.85 to roughly 0.47 to 0.51 in one study), mainly because standard ASR, especially off-the-shelf Whisper, does not transcribe disfluencies. Audio-only models beat the ASR-plus-text pipeline, and audio-plus-text fusion beats both. Streaming detection works with very little look-ahead (about 0.2 tokens on average). SPACER and LARD are real and verifiable, but neither is a ready benchmark for "no wait"-style dictation corrections.

### Cited Findings

**Text-based state of the art (gold Switchboard transcripts)**
- Jamshid Lou & Johnson (ACL 2020), BERT-based self-attentive parser self-trained on silver Fisher data, Switchboard **test** EDITED word F1: single model **89.2**, ensemble of 4 **90.6** (recall 91.9 and 93.8 respectively). Prior results in the same table: Dong et al. 2019, 89.0; Zayats et al. 2016, 85.9. — [arXiv 2004.05323, Table 8](https://arxiv.org/pdf/2004.05323)
- Same paper, EDITED + INTJ + PRN word F1 on Switchboard test: **94.3** single and **94.8** ensemble, versus Bach & Huang 2019 at 92.2. — [arXiv 2004.05323, Table 9](https://arxiv.org/pdf/2004.05323)
- Per type, on a 158-structure Switchboard **dev** subset (90 repetitions, 54 corrections, 14 restarts), self-trained EDITED F1: repetition **97.3**, correction **88.6**, restart **87.8**. Baseline: 97.0 / 80.6 / 82.0. — [arXiv 2004.05323, Table 4](https://arxiv.org/pdf/2004.05323)
- In-domain conversational silver data (Fisher) helped. Out-of-domain clean text (Gigaword, WSJ, Brown) did not help significantly. — [arXiv 2004.05323](https://arxiv.org/pdf/2004.05323)
- Silver Fisher annotations from the same group are on GitHub. — [pariajm/fisher-annotations](https://github.com/pariajm/fisher-annotations)
- Google (Rocholl et al. 2021, "Disfluency Detection with Unlabeled Data and Small BERT Models") built a small on-device detector of about 1.3 MiB with only a slight drop in performance and about 8x lower latency than BERT-Base. — [arXiv 2104.10769](https://ar5iv.labs.arxiv.org/html/2104.10769)
- Google's blog reports a 3.1M-parameter small-vocabulary BERT that gets "comparable results to our baseline at 1% the size". Training used about 77,000 Switchboard examples plus 1.3M self-labeled Fisher examples. — [Google Research blog, 2022](https://research.google/blog/identifying-disfluencies-in-natural-speech/)

**Audio-based and multimodal (Romana, Koishida, Mower Provost, IEEE/ACM TASLP Oct 2024)**
- BERT-style language detector, frame-level weighted F1: **0.85** on gold transcripts, but only **0.47** on fine-tuned Whisper transcripts, **0.45** on fine-tuned WavLM ASR and **0.51** on off-the-shelf Azure ASR. — [arXiv 2311.00867v1, Table III](https://arxiv.org/html/2311.00867v1); [IEEE Xplore](https://ieeexplore.ieee.org/document/10731569)
- Per type on gold transcripts: FP 1.00, RP 0.85, RV 0.70, **RS (restart) 0.13**, PW 0.83. — [arXiv 2311.00867v1](https://arxiv.org/html/2311.00867v1)
- Audio-only (no transcript), weighted F1: WavLM **0.64**, HuBERT 0.60, wav2vec2 0.56. Restart F1 is **0.00** for all three. — [arXiv 2311.00867v1](https://arxiv.org/html/2311.00867v1)
- Multimodal (Whisper-FT transcript + WavLM, BLSTM fusion): weighted F1 **0.69**. Partial-word F1 rises from 0.17 (language) and 0.32 (acoustic) to 0.40. — [arXiv 2311.00867v1](https://arxiv.org/html/2311.00867v1)
- Off-the-shelf Whisper "does not transcribe disfluencies". Its WER on disfluent words (WER-D) is **0.71** versus 0.05 on non-disfluent words. Its disfluency marker ("*") timestamps matched Switchboard disfluencies with recall 0.21. — [arXiv 2311.00867v1, Table II](https://arxiv.org/html/2311.00867v1)
- The authors conclude that "disfluency detection performance is largely limited by the quality of transcripts and alignments". — [arXiv 2311.00867](https://arxiv.org/abs/2311.00867)
- **Conflict:** restart F1 is 0.13 on gold text in Romana et al. but 87.8 in Jamshid Lou & Johnson. The two papers use different units (frame-level vs. EDITED word), different label definitions and different subsets (only 14 restarts in the JL&J subset), so the numbers are not comparable. — [Romana](https://arxiv.org/html/2311.00867v1) vs. [JL&J](https://arxiv.org/pdf/2004.05323)

**Verbatim ASR with word timestamps (needed for cutting audio)**
- CrisperWhisper (Interspeech 2024) changes Whisper's tokenizer and uses DTW on decoder cross-attention to produce word timestamps. It is fine-tuned to transcribe verbatim, including fillers, repetitions, false starts and partial words. Reported WER on AMI: 9.72 vs. 16.82 for Whisper large-v2. — [arXiv 2408.16589](https://arxiv.org/pdf/2408.16589); [GitHub](https://github.com/nyrahealth/CrisperWhisper)
- The CrisperWhisper 2.0 model card (vendor-reported) claims about 30 ms mean word-boundary error on read speech and 41 ms on conversational speech, and disfluency F1 of 87.8 vs. 64.8 for v1. A listing gives the license as CC-BY-NC-4.0 (non-commercial). — [HF model card](https://huggingface.co/modulsx/CrisperWhisper2.0_large); [PromptLayer listing](https://www.promptlayer.com/models/crisperwhisper)

**Streaming and incremental detection**
- "Teaching BERT to Wait" (Chen et al., NAACL 2022) adds a learned "wait" head that decides when enough right-context has been seen. It matched the accuracy of fixed look-ahead baselines with lower latency and less flicker. — [arXiv 2205.00620](https://arxiv.org/pdf/2205.00620); [Google blog](https://research.google/blog/identifying-disfluencies-in-natural-speech/)
- Google's blog reports an average wait of **0.21 tokens**, with streaming F1 above 0.82 at three operating points. The model beat the 1-token look-ahead model and nearly matched the 2-token one. — [Google Research blog](https://research.google/blog/identifying-disfluencies-in-natural-speech/)
- Futami et al. (ICASSP 2023) jointly run streaming ASR and disfluency detection and report beating a BERT pipeline on both accuracy and latency, on Switchboard and a Japanese corpus. — [arXiv 2211.08726](https://arxiv.org/pdf/2211.08726)

**Datasets**
- **Switchboard (Treebank-3 disfluency annotations)**: the standard benchmark with EDITED/INTJ/PRN labels. DRES uses the Switchboard Treebank gold parse trees. — [DRES/SpeechLLM paper v2](https://arxiv.org/html/2509.20321v2); [JL&J 2020](https://arxiv.org/pdf/2004.05323)
- **Fisher**: no gold disfluency labels were found. It is used as silver self-training data (1.3M examples in Google's work). — [Google blog](https://research.google/blog/identifying-disfluencies-in-natural-speech/); [fisher-annotations](https://github.com/pariajm/fisher-annotations)
- **SPACER (verified exists)**: Upadhye, Li & Futrell, CMCL 2025 workshop, arXiv 2503.16745. It covers **single-word substitution errors** taken from Switchboard, paired with the speakers' self-repairs and with corrections from comprehenders in an offline text-editing experiment. Per the abstract summary: 1056 speaker utterances and 5808 comprehender responses. Speakers were more likely to repair errors with larger semantic and phonemic deviation. Code and data: GitHub goldengua/SPACER-CMCL. — [ACL Anthology PDF](https://aclanthology.org/2025.cmcl-1.19.pdf); [arXiv 2503.16745](https://arxiv.org/pdf/2503.16745). *Caveat: I saw only the abstract and search summaries, not the PDF. SPACER studies whether and how errors get repaired. It is not a "detect and cut" benchmark, and it covers single-word substitutions only.*
- **LARD (verified exists)**: Passali, Mavropoulos, Tsoumakas, Meditskos, Vrochidis, LREC 2022, arXiv 2201.05041. It generates synthetic **repetitions, replacements and restarts** in fluent text, giving about 96K examples built on the Schema-Guided Dialogue (SGD) corpus. It supports four tasks (detection, classification, extraction, correction), and the authors report that it helps with the class imbalance in Switchboard. — [arXiv 2201.05041](https://arxiv.org/pdf/2201.05041); [ACL Anthology](https://preview.aclanthology.org/setup/2022.lrec-1.249)
- **DisfluencySpeech** (Wang & Herremans, TENCON 2024): one speaker re-recorded about 10 hours of Switchboard-1 utterances with labeled non-lexical sounds and disfluencies. It has three transcript levels (removing non-speech events, non-sentence elements, false starts) and was built for TTS. — [arXiv 2406.08820](https://arxiv.org/html/2406.08820v1)
- **DISCO**: a human-annotated corpus for disfluency **correction** in Indo-European languages. — [arXiv 2310.16749](https://arxiv.org/pdf/2310.16749)
- **Speak & Improve Corpus 2025**: L2-English learner speech, about 55 hours manually transcribed including disfluencies. Its baseline disfluency detector is trained on Switchboard. — [Cambridge dataset page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025); [arXiv 2412.11985](https://arxiv.org/pdf/2412.11985)
- **LLM-generated disfluency augmentation**: "Boosting Disfluency Detection with Large Language Model as Disfluency Generator" (2024). — [arXiv 2403.08229](https://arxiv.org/pdf/2403.08229)

### Inferences
- For ReSpeak, the main bottleneck is the **ASR layer, not the detector**. If the ASR drops "uh, no wait", or normalizes "Mon- Monday", the text detector cannot see the repair. Use a verbatim or word-timestamped ASR (CrisperWhisper-style, or an API with filler words switched on), and cut audio by **gaps between kept words** rather than by the deleted words' own timestamps. Then untranscribed fillers inside the cut region are removed too.
- The target phenomenon ("explicit correction with an editing term" such as "no wait / actually / I mean / sorry") is the easiest repair class to detect, because the interregnum is a lexical cue. Restarts without a cue are the hardest (frame-level F1 of 0.00 to 0.13 in Romana et al.). A hackathon should auto-apply only cue-marked corrections and offer cue-less restarts as suggestions.
- No public benchmark matches dictation-style deliberate corrections ("I'll meet you Monday, no wait, Wednesday"). Switchboard repairs are mostly spontaneous conversational repairs. A small custom test set is needed (section 7).

### Gaps
- **Buckeye**: I found no source confirming it has repair or reparandum annotations usable as a benchmark. It is not verified as a disfluency-repair benchmark.
- No dataset from 2024 to 2026 was found that targets **deliberate dictation self-corrections** with audio, word timestamps and gold cut spans.
- SPACER's exact composition (e.g., the number of comprehenders) comes from a search summary of the abstract, not the paper. I did not open its full text.
- I did not retrieve the exact F1 numbers of Rocholl et al. 2021 or Chen et al. 2022 on Switchboard.

---

## 3. How well do LLMs do at zero/few-shot disfluency and self-repair removal (and with word indices)?

### Takeaway
The main 2025-26 benchmark, DRES (Teleki et al., Switchboard, deletion-only task), reports these results:
- Prompted LLMs land well below fine-tuned taggers. GPT-4o-mini scores in the mid-70s word-level F1, and fine-tuning lifts it to the mid-90s.
- Splitting input into about 4-sentence segments consistently helps.
- **Reasoning models (o4-mini, Phi-4 reasoning) systematically over-delete fluent content.**

Older and weaker evidence (STIL 2024) shows free-text rewriting by LLMs can drift far from the source. An NER study found that LLMs asked for positions or indices did very badly compared with inline markers. That study used older models, but it argues for a guarded index schema with verification. No paper evaluates LLMs on deliberate "no wait" dictation corrections.

### Cited Findings
- **DRES** (arXiv 2509.20321; v1 Sept 2025 titled "DRES: Benchmarking LLMs for Disfluency Removal"; v2 March 2026 retitled "Conversational Speech Reveals Structural Robustness Failures in SpeechLLM Backbones"). It is a controlled text-level benchmark on Switchboard Treebank transcripts that treats gold disfluency removal as a **deletion-only** task. — [arXiv abs](https://arxiv.org/abs/2509.20321); [v2 HTML](https://arxiv.org/html/2509.20321v2)
- Models evaluated: gpt-4o, gpt-4o-mini, o4-mini, Llama-3.1 8B, Llama-3.2 1B/3B, Llama-3.3 70B, MobileLLM 125M to 1B, Qwen3 0.6B to 8B, and Phi-4-mini (instruct and reasoning). In-context demonstrations k ∈ {0, 1, 3, 5}. — [v2 HTML](https://arxiv.org/html/2509.20321v2)
- Fine-tuning raised word-level F1 from the "mid-70s" to the "mid-90s" for GPT-4o-mini and from the "high-60s" to "above 90" for Llama-3B. Paired deltas: +22.05 (95% CI +9.83 to +34.10) and +23.46 respectively. MMLU, GSM8K and CoQA changed only slightly, but the abstract says fine-tuning "harms generalization". — [v2 HTML, Table 2](https://arxiv.org/html/2509.20321v2)
- "Reasoning models systematically over-delete fluent content", which reveals "a bias toward semantic abstraction". o4-mini and Phi-4 reasoning variants "systematically shift toward aggressive over-deletion". — [arXiv abs](https://arxiv.org/abs/2509.20321); [v2 HTML §4.2](https://arxiv.org/html/2509.20321v2)
- Segmenting transcripts into about 4 sentences each gave consistent gains over full transcripts and reduced variance. No numeric effect size appears in the text (the result is in Figure 4). — [v2 HTML](https://arxiv.org/html/2509.20321v2)
- DRES recommendations:
  - R1: small under-deleting models (e.g., Qwen3-1.7B) for edge or real-time intent preservation.
  - R2: segmented input.
  - R3: 8B-class models with few-shot prompting for a good latency/accuracy trade-off.
  - R4: avoid reasoning models for literal repair.
  - R5: in command interfaces, choose under-deletion models to protect fluent nouns and verbs.
  - R7: fine-tune where archival-grade precision is needed.

  — [v2 HTML, Table 3](https://arxiv.org/html/2509.20321v2)
- LLM output is mapped back to token deletions with a "deterministic alignment module" (the method is described in the companion Z-Scores paper). — [Z-Scores, arXiv 2509.20319](https://arxiv.org/abs/2509.20319)
- **Z-Scores** (same group, Sept 2025) is a span-level metric broken down by EDITED/INTJ/PRN. It shows that aggregate F1 hides LLM weaknesses on INTJ and PRN. — [arXiv 2509.20319](https://arxiv.org/abs/2509.20319)
- **STIL 2024** (Brazilian Portuguese debate transcripts from Azure ASR, annotated for hesitations, repetitions and corrections) tested GPT-4o, Gemini 1.5 Pro, Claude 3.5 Sonnet and Llama 3 72B with zero-shot, few-shot and chain-of-thought (CoT) prompts. On the most disfluent group:
  - GPT-4o few-shot removed **67.19%** of disfluencies while keeping 96.83% Levenshtein similarity.
  - GPT-4o CoT removed 68.75% at 97.85% similarity.
  - Zero-shot without context, Claude 3.5 Sonnet kept only **32.98%** Levenshtein similarity, meaning heavy rewriting. Gemini kept 97.95% but removed only 14.06%.
  - The authors judged Claude 3.5 and Llama 3 "currently unreliable for this type of task".

  — [STIL 2024 paper](https://aclanthology.org/2024.stil-1.16.pdf). *Caveat: the row-to-model mapping for the zero-shot tables comes from PDF text extraction (row order Gemini, GPT-4o, LLaMa, Claude). The study uses 2024-era models, is small, and is not in English.*
- "Mind the Pause" (Kumar, Gain, Ekbal; ACL 2026 Main; arXiv May 2026) is a two-stage method. A tagger marks disfluent tokens, and those tags guide instruction-tuning of an LLM rewriter, with a contrastive penalty for copying disfluent tokens. It covers Hindi, Bengali and Marathi. The abstract argues that detection-only deletion can break grammar and meaning. — [arXiv 2605.12242](https://arxiv.org/abs/2605.12242)
- **Index/position output from LLMs (indirect evidence, NER)**: GPT-NER (2023) compared output formats on 100 CoNLL-2003 samples with 32 shots. Inline markers (@@entity##) scored **92.68 F1**, BMES tag strings **29.75** and entity-plus-position **38.73**. The model confused character vs. word indices and could not output tag strings of the correct length on long inputs. — [GPT-NER, arXiv 2304.10428](https://arxiv.org/pdf/2304.10428)

### Inferences
- The evidence points to **deletion-only, span-based output** rather than free rewriting. Free rewriting drifts (STIL), over-deletes with reasoning models (DRES), and cannot be mapped to audio cuts without alignment.
- Raw index output is error-prone (GPT-NER). Mitigate by (a) prefixing every word with its index in the prompt, so the model copies indices instead of counting, and (b) requiring the model to also echo the **exact text** of each span. The client then rejects a span when the text does not match the tokens at those indices. GPT-NER used 2023-era models, so 2026 frontier models are likely much better at this, but the verification step is cheap insurance.
- Use segments of a few sentences (DRES R2) and a non-reasoning, under-deleting instruct model (DRES R1, R4, R5). For ReSpeak, false deletions (losing meaning) are worse than misses (leaving a "no wait" in).
- The likely best quality option is a hybrid: a fast tagger or rule layer for cue-marked repairs and fillers, plus an LLM for semantic judgment ("is this 'actually' corrective?"). This mirrors the tagger-then-LLM design in "Mind the Pause".

### Gaps
- I did not find exact zero-shot or few-shot F1 numbers for GPT-4o, Qwen3-8B and others on DRES. They are only in figures. Repo per search results: github.com/mariateleki/dres (not opened).
- No paper found evaluates Claude or GPT-5-class models from 2025-26 on disfluency removal with **word-index output**.
- No benchmark found for "intent-preserving transcript correction" of **deliberate** spoken self-corrections ("no wait, Wednesday") in dictation. A search for "LLM dictation self-repair" found only unrelated LLM self-correction papers.

---

## 4. Sentence/thought segmentation in streaming ASR: deciding the boundary of "the last thought"

### Takeaway
No off-the-shelf model answers "where did the last thought start". The tools that exist are:
1. **VAD pauses**: cheap. This is what Dragon's "scratch that" uses: one pause-delimited utterance.
2. **Punctuation and sentence segmentation models** for unpunctuated ASR text (SaT/wtpsplit, robust to missing punctuation).
3. **End-of-turn models** (LiveKit turn detector, text-based; Pipecat Smart Turn, audio-based). These predict "is the user done talking", not sentence boundaries inside a turn. Their published accuracy is mostly vendor-reported and contradictory.

Classic sentence-unit (SU) detection research shows segmentation errors increase a lot on ASR output compared with reference transcripts.

### Cited Findings
- Dragon for Mac: "Scratch that" deletes the last utterance dictated, and how much text is removed **depends on where you paused** while dictating. "Scratch word" removes only the word left of the cursor. — [Nuance Dragon for Mac, "Take it back"](https://nuance.com/products/help/dragon/dragon-for-mac/enx/Content/Correction/TakeBack.htm)
- Liu, Shriberg, Stolcke, Hillard, Ostendorf, Harper (IEEE TASLP 2006) combine textual knowledge sources with a prosodic classifier (HMM, MaxEnt, CRF) for sentence boundaries and disfluencies, reported as state of the art in NIST RT-04F. — [SRI publication page](https://www.sri.com/publication/speech-natural-language-pubs/enriching-speech-recognition-with-automatic-detection-of-sentence-boundaries-and-disfluencies/)
- The SU error rate is defined as (deleted + inserted SU boundaries) / true SU boundaries. — [Liu et al. EMNLP 2004](https://www1.icsi.berkeley.edu/ftp/pub/speech/papers/emnlp2004-maxent.pdf)
- A related Hillard et al. result: sentence-boundary error rates rose by about 50% relative on conversational telephone speech when moving from reference to automatic transcripts. — *Unverified: this comes from a search-engine summary of the SRI/ICSI paper cluster, and I could not identify or open the exact Hillard paper. Treat it as indicative only.* ([SRI publication cluster](https://www.sri.com/publication/speech-natural-language-pubs/enriching-speech-recognition-with-automatic-detection-of-sentence-boundaries-and-disfluencies/))
- **Segment any Text (SaT)** / wtpsplit (Frohmann, Minixhofer et al., 2024) is a sentence segmenter designed to be robust to missing punctuation. It covers 85 languages, offers LoRA adapters including for TED (ASR-style) transcripts, and from v2.2 has min_length/max_length controls. Usage: `SaT("sat-3l-sm").split(text)`. — [arXiv 2406.16678](https://web3.arxiv.org/pdf/2406.16678v2); [JKU record](https://research.jku.at/en/publications/segment-any-text-a-universal-approach-for-robust-efficient-and-ad/); [wtpsplit package](https://simple-repository.app.cern.ch/project/wtpsplit)
- **LiveKit turn detector**: text-based end-of-utterance model.
  - English model: SmolLM2-135M, 66 MB, about 15-45 ms per turn, TPR 98.8% / TNR 87.5%.
  - Multilingual model: Qwen2.5-0.5B, about 50-160 ms per turn, English TPR 99.3% with TNR 80.2% in the current docs vs. 87.0% in older docs (**conflict** between doc versions).
  - TNR here means correctly predicting that the user will keep speaking.

  — [LiveKit docs](https://docs.livekit.io/agents/build/turns/turn-detector); [search summary of docs](https://docs.livekit.io/agents/logic/turns/turn-detector)
- **Pipecat Smart Turn v3.x**: audio-native end-of-turn model, Whisper-Tiny-based with a linear head, about 8M parameters. Int8 CPU build about 8 MB, fp32 about 32 MB. Runs in about 10 ms on some CPUs and under 100 ms on most cloud instances. 23 languages, BSD-2, takes up to 8 s of 16 kHz audio. Meant to run after Silero VAD detects silence, on the whole turn. — [GitHub pipecat-ai/smart-turn](https://github.com/pipecat-ai/smart-turn); [Daily blog](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/)
- AssemblyAI describes LiveKit's model as semantic-only (transcript text, no audio context). — [AssemblyAI blog](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent)
- Third-party head-to-heads conflict and are all self-reported.
  - The voxturn card says Smart Turn v3 cut off 45.3% of turns vs. 16.7% for voxturn, and LiveKit 18.0% vs. 9.3%.
  - The TurnWave card, using LiveKit's eot-bench, reports false cutoffs at 300 ms of 9.9% for LiveKit v1 vs. 35.2% for SmartTurn v3.2.

  — [voxturn](https://huggingface.co/AustinXiao/voxturn); [TurnWave](https://huggingface.co/Nikhil-09/turnwave)

### Inferences
- Turn detectors answer a different question (is the user done?) than ReSpeak's semantic undo (where did the latest thought start?). A turn detector's "incomplete" signal is still useful: if the button is pressed while the current sentence is unfinished, the user most likely wants to delete **that unfinished fragment**, not the previous complete sentence.
- Practical boundary heuristic for semantic undo (design proposal, not validated):
  1. Candidate boundaries come from the union of (a) ASR punctuation (sentence-final marks), (b) SaT boundaries on the live word stream, and (c) VAD pauses of at least about 500-700 ms.
  2. On a button press at time t, delete from the latest candidate boundary before t to t, if that span has at least 3 words. Otherwise go back one more boundary.
  3. A second press within a short window deletes one more unit.
  4. Show the deletion as a struck-through preview that can be restored.
  5. Optionally ask an LLM to confirm or adjust the boundary within ±1 candidate.

  The thresholds are illustrative and should be tuned on the team's own recordings.
- Dragon's pause-based "utterance" precedent shows that a pause-only rule works well enough to ship. Dragon users, though, learn to pause between thoughts. Casual voice-message speakers will not, so text segmentation (SaT/punctuation) should be added.

### Gaps
- I did not retrieve the actual SU error rates from Liu et al. 2006.
- No independent benchmark of LiveKit vs. Smart Turn was found. All accuracy claims are vendor or self-reported.
- No published evaluation of "delete last thought" button behavior (user-intended boundary vs. predicted boundary) was found.

---

## 5. How dictation products implement "scratch that"/"undo that" and self-correction

### Takeaway
Classic dictation (Dragon, Windows) uses **explicit command phrases** that delete the **last dictated utterance or chunk**, where the chunk is set by pauses or dictation events. They do not detect semantic units. LLM-era tools (Wispr Flow "Backtrack", Typeless) detect self-corrections **implicitly** from trigger words ("actually", "scratch that", "never mind") or restatement, using the whole dictation as context, and they offer an "undo AI edit" escape hatch. A September 2026 public complaint says Wispr Flow drops negations ("never merge a change like this" became "merge a change like this").

### Cited Findings
- **Dragon (Windows, v15)**: "Scratch That", "Delete That" and "Undo That" delete the last text dictated. "Undo That" also undoes most actions and commands (e.g., formatting). If a command was transcribed as text, say "Scratch That" and repeat the command. — [Dragon 15 correction help](https://www.nuance.com/products/help/dragon15/dragon-for-pc/enx/professionalindividual/Content/Correction/correcting_your_dictation.htm); [Dragon misrecognized commands](https://www.nuance.com/products/help/dragon/dmpe43/enx/dmpe/Content/Correction/correcting_misrecognized_commands.htm)
- **Dragon for Mac**:
  - "Scratch that" deletes the last utterance, and the size depends on pauses.
  - "Undo last action" reverses the last command or removes the last paragraph of dictated text.
  - "Undo dictation" reverses whichever came last, a command or an utterance.
  - "Redo last action" restores text.

  — [Dragon for Mac "Take it back"](https://nuance.com/products/help/dragon/dragon-for-mac/enx/Content/Correction/TakeBack.htm)
- **Windows voice access** (Windows 11 22H2+; replaced Windows Speech Recognition in Sept 2024): "Delete that" deletes the selected text or the last dictated text. "Delete <text>" removes specific text. — [Microsoft Support: Edit text with voice](https://support.microsoft.com/en-us/accessibility/windows/voice-access/edit-text-with-voice)
- **Windows Speech Recognition** (legacy): "Undo that", "Scratch that" and "Undo" undo; "Delete that" deletes. — [Microsoft Support: WSR commands](https://support.microsoft.com/en-us/windows/windows-speech-recognition-commands-9d25ef36-994d-f367-a81a-a326160128c7)
- **Windows voice typing (Win+H)**: supports "delete that" and "select that". If "fluid dictation" auto-corrected the text, "Revert" or "Undo that" restores the original. Fluid dictation is disabled in password and PIN fields. — [Microsoft Support, voice typing (via search result)](https://support.microsoft.com/help/4042244/). *Caveat: taken from a search summary; I did not open the page.*
- **Wispr Flow "Backtrack"** (part of Smart Formatting): it responds to "actually", "scratch that" and "never mind", or to a simple restatement.
  - Example: "Let's do coffee at 2 actually 3" becomes "Let's do coffee at 3."
  - Flow "considers your full dictation as context". Edits are limited to obvious corrections, and "I actually enjoyed the movie" is kept.
  - It removes filler, abandoned false starts and mid-sentence corrections.
  - Desktop has "Undo AI edit" to restore the original transcript. If formatting fails, the unformatted transcript is pasted.

  — [Wispr Flow docs](https://docs.wisprflow.ai/articles/5373093536-how-do-i-use-smart-formatting-backtrack)
- Smart Formatting is on by default, and there is reportedly no toggle on Mac, Windows or Android (search summary of Wispr docs and third-party reviews). — [Wispr help mirror](https://wispr-knowledge-base.help.usepylon.com/articles/5373093536-how-do-i-use-smart-formatting-and-backtrack). *Caveat: the docs page I fetched says Android "always applies formatting". The no-toggle claim for Mac/Windows is not confirmed on the fetched page.*
- **Wispr Flow failure report**: Theo (t3.gg) posted on X on 2026-09-23 that Flow "regularly removes keywords from sentences" such as "not", "never" and "before". His example: "never merge a change like this" became "merge a change like this". No company response is recorded. — [Digg summary](https://digg.com/ai/ve5pkh0s); [original post](https://x.com/theo/status/2102703393043005737). *This is one anecdotal report.*
- **Typeless** (App Store listing) claims it recognizes self-corrections mid-sentence and keeps only the final intended message (vendor claim, not independently tested). — [App Store](https://apps.apple.com/app/id6749257650)
- **Mobius (medical dictation)**: "Scratch That" deletes the most recently dictated phrase. — [Mobius help](https://intercom.help/mobius-md/en/articles/15384458-how-to-use-voice-commands)

### Inferences
- There are two paradigms, and ReSpeak can offer both:
  1. **Explicit command** ("scratch that"): deterministic and predictable. The scope is the previous segment, defined by pause or sentence boundary.
  2. **Implicit correction** ("Monday, no wait, Wednesday"): an LLM judgment that needs a preview or undo.
- Every shipping LLM-based product has an "undo the AI edit" path (Wispr's "Undo AI edit", Windows' "Revert"). ReSpeak's non-destructive audio editing (keep the original and render cuts as an edit list) is the natural equivalent.
- "Scratch that" is also an ordinary English phrase ("scratch that itch"). Dragon avoids this by treating commands as separate utterances bounded by pauses. ReSpeak could require the command to be at least about 2-4 words long on its own, preceded by a pause, or confirmed by an LLM.

### Gaps
- Talon: I found no source confirming a "scratch that" or "clear that" command in the community command set. One guide lists "cut that" and "undo". Not verified.
- Apple Dictation / Voice Control and Google Gboard voice typing were not researched in depth (no sources retrieved).
- No published accuracy figures exist for Wispr Backtrack or Typeless self-correction.

---

## 6. Failure modes and how to make it safe

### Takeaway
The main risks are:
- **Over-deletion of meaning-bearing words**: negations, hedges, names, numbers and dates.
- **False positives on non-corrective "no", "actually", "I mean", "wait"**.
- **Wrong restart boundaries**, which delete a whole clause.
- **ASR omissions** that hide the repair structure.

Evidence: reasoning LLMs systematically over-delete (DRES), free-rewriting LLMs drift heavily (STIL), and there is a real-world report of a commercial product deleting "never" and "not". Mitigations: deletion-only spans, type-parity and protected-word checks, confidence thresholds, preview with one-tap restore, and non-destructive editing.

### Cited Findings
- Reasoning-oriented LLMs "systematically over-delete fluent content". DRES recommends under-deletion models for command interfaces "to protect fluent nouns and verbs". — [DRES v2](https://arxiv.org/html/2509.20321v2)
- A Wispr Flow user reported deletion of "not", "never" and "before", which reverses meaning. — [Digg](https://digg.com/ai/ve5pkh0s); [X post](https://x.com/theo/status/2102703393043005737)
- Wispr explicitly guards against non-corrective "actually" ("I actually enjoyed the movie" is preserved) and offers "Undo AI edit". — [Wispr docs](https://docs.wisprflow.ai/articles/5373093536-how-do-i-use-smart-formatting-backtrack)
- Wispr release notes mention fixes for course corrections that "didn't land", swapped words and ignored punctuation (search summary). — [releases.sh Wispr Flow](https://releases.sh/wispr-flow/releases)
- Free-text LLM cleanup can rewrite heavily. Claude 3.5 Sonnet zero-shot kept only 32.98% Levenshtein similarity in the STIL 2024 study. — [STIL 2024](https://aclanthology.org/2024.stil-1.16.pdf)
- Fine-tuning gives state-of-the-art removal but "harms generalization". — [DRES abs](https://arxiv.org/abs/2509.20321)
- Detection-only deletion can break grammar and meaning ("Mind the Pause" motivation). — [arXiv 2605.12242](https://arxiv.org/abs/2605.12242)
- Restarts are by far the weakest class, at 0.00 to 0.13 frame-level F1 in Romana et al. — [arXiv 2311.00867v1](https://arxiv.org/html/2311.00867v1)
- Off-the-shelf Whisper misses about 71% of disfluent words (WER-D 0.71). — [arXiv 2311.00867v1](https://arxiv.org/html/2311.00867v1)
- Windows disables fluid dictation in password and PIN fields (a precedent for switching off AI edits in sensitive contexts). — [Microsoft Support (search result)](https://support.microsoft.com/help/4042244/)

### Inferences (safety design for ReSpeak)
- **Deletion-only invariant**: the system may only remove words and never insert or reorder them. Then every edit maps exactly onto an audio cut, and hallucinated content is impossible.
- **Protected-token rule**: never auto-delete a span containing a negation (not, never, n't, no as a determiner), a number, date or time, or a proper name, *unless* the repair contains a token of the same type (e.g., "Monday" → "Wednesday", "two" → "three", "can" → "can't"). Otherwise demote the edit to a suggestion.
- **Cue gating**: auto-apply only when an explicit interregnum cue is present ("no wait", "sorry", "I mean", "actually" + parallel structure, "scratch that", "let me rephrase") **and** there is parallel structure (type parity). Cue-less restarts become suggestions only.
- **Non-corrective cue distractors** to test: "No, I don't think so" (answer "no"), "I actually liked it", "wait for me at the door", "I mean it", "scratch that itch".
- **Confidence tiers**: high goes to auto-apply with a visible strike-through and a 1-tap restore. Medium is shown as a dotted suggestion. Low is ignored.
- **Non-destructive editing**: keep the raw audio and the word list, store edits as an ordered edit list, and support undo/redo and "show original". Re-render cut audio from the edit list.
- **Audio-cut hygiene** (engineering heuristics, not from the sources): cut at the midpoint of inter-word gaps or at energy minima, apply short crossfades (about 10-30 ms), and normalize the leftover pause length so cuts do not create unnatural silences or clicks.

### Gaps
- No quantitative study was found of negation and number deletion rates for LLM transcript cleanup.
- No user study was found on acceptable false-positive rates for auto-applied voice-message edits.

---

## 7. Prompt/output-schema design, evaluation approach, and recommended hackathon implementation

### Takeaway
Use a **hybrid, deletion-only pipeline**:
1. Time-aligned, as-verbatim-as-possible ASR.
2. A deterministic rule layer for explicit commands ("scratch that / delete that / undo that / never mind") and the semantic-undo button, based on pause and sentence boundaries.
3. A non-reasoning LLM that receives **index-prefixed words** for 1-4 sentences at a time. It returns JSON spans with reparandum/interregnum/repair roles, echoed text, type and confidence.
4. A validator that checks index and text agreement, protected tokens and type parity.
5. A preview UI with one-tap restore.

Evaluate on a self-recorded set of 60-120 utterances that includes distractors, measuring span exact-match, word-level P/R/F1, and a "harmful deletion" rate. These are design recommendations built on the evidence in sections 1-6. The specific schema and thresholds are proposals, not published results.

### Cited Findings (evidence underpinning the design)
- Deletion-only framing is how DRES defines gold disfluency removal. — [DRES abs](https://arxiv.org/abs/2509.20321)
- Segmenting into about 4-sentence chunks improves LLM removal. — [DRES v2](https://arxiv.org/html/2509.20321v2)
- Few-shot k ∈ {0, 1, 3, 5} was tested, and 8B-class models with few-shot are recommended for a latency/accuracy balance. — [DRES v2](https://arxiv.org/html/2509.20321v2)
- Avoid reasoning models for literal repair. — [DRES v2](https://arxiv.org/html/2509.20321v2)
- LLMs asked for positions confuse index types and lose accuracy: 38.73 F1 vs. 92.68 for inline markers (2023-era models). — [GPT-NER](https://arxiv.org/pdf/2304.10428)
- Evaluation conventions: word-level P/R/F1 on deleted tokens (E-Scores) plus span-level per-category diagnostics (Z-Scores). — [Z-Scores](https://arxiv.org/abs/2509.20319)
- Switchboard type definitions (repetition, correction, restart) provide the category labels for a test set. — [JL&J 2020](https://arxiv.org/pdf/2004.05323)
- Word-timestamp ASR with verbatim disfluencies is available (CrisperWhisper, non-commercial license per listing). — [arXiv 2408.16589](https://arxiv.org/pdf/2408.16589); [HF card](https://huggingface.co/modulsx/CrisperWhisper2.0_large)

### Inferences: concrete prompt and schema (proposal)

**Input format** (one chunk of 1-4 sentences plus the previous sentence as read-only context):
```
CONTEXT (do not edit): "So about the meeting."
WORDS:
[0] I'll [1] meet [2] you [3] Monday, [4] no [5] wait, [6] Wednesday [7] at [8] three.
```

**System prompt core rules:**
1. You may only DELETE words. Never add, reorder or rewrite.
2. Delete a span only if the speaker clearly retracted it: a self-correction (reparandum + editing phrase), a false start that is restarted, an explicit command ("scratch that", "delete that", "never mind" used as a retraction), or a repeated word.
3. Never delete words that change meaning unless the speaker replaced them with a corrected equivalent: negations (not, never, no as an answer), numbers, dates, times, names, places.
4. "No", "actually", "wait" and "I mean" are often NOT corrections. Delete them only when followed by a replacement for something said just before.
5. When unsure, output nothing for that span (a missed correction is acceptable, a wrong deletion is not).
6. Copy indices from the [n] labels and echo the exact words.

Few-shot: 3-5 examples, including at least 2 negative distractors ("No, I can't make it" → no edit; "I actually loved it" → no edit).

**Output JSON schema:**
```json
{
  "edits": [
    {
      "kind": "self_correction | restart | repetition | command | filler",
      "delete": [3, 5],                 // inclusive word-index range to remove
      "delete_text": "Monday, no wait,",// must equal words[3..5] after normalization
      "reparandum": [3, 3],
      "interregnum": [4, 5],
      "repair": [6, 6],                 // null for restarts/commands with no repair
      "replaced_type": "date",          // date|time|number|name|negation|other|none
      "confidence": 0.95
    }
  ]
}
```
Use structured outputs / JSON mode where the API supports it.

**Client-side validator (deterministic):**
- All indices in range, spans don't overlap, and `delete_text` matches the words (case- and punctuation-insensitive), or the edit is rejected.
- `delete == reparandum ∪ interregnum` (contiguous).
- Protected-token check: if `delete` contains a negation, number, date, time or capitalized name, require a `repair` containing the same `replaced_type`. Otherwise downgrade to a suggestion.
- Confidence tiers: ≥0.85 and cue present means auto-apply. 0.5-0.85 means suggestion. Below that, drop.

**Explicit commands (rule layer, before the LLM):**
- Regex on normalized words for `(scratch|delete|undo) that|never mind|strike that|let me start over`.
- Fire only if the phrase is (a) preceded by a pause of at least about 300-500 ms or a sentence boundary, and (b) followed by a pause or the end of the recording.
- Action: delete the command words plus the previous unit (sentence or pause-delimited segment). Optionally ask the LLM to confirm when the phrase sits mid-sentence (to avoid "scratch that itch").

**Semantic undo button:** as described in section 4. The candidate boundaries are the union of ASR punctuation, SaT boundaries and pauses of at least about 600 ms. Delete back to the latest boundary. Repeated presses step back further. The preview is restorable.

**Audio rendering:**
- Map the kept word set to time intervals.
- For each deleted span, cut from the end time of the last kept word before the span to the start time of the first kept word after it. This also removes untranscribed fillers in that gap.
- Leave a natural gap (about 150-250 ms), crossfade 10-30 ms, and keep the original for undo.

**Latency plan:**
- Run the rule layer and the semantic-undo boundary logic locally in real time.
- Run LLM self-correction detection on each finalized sentence or chunk, in parallel with recording.
- Alternatively, run one pass at "stop recording" over 4-sentence windows (DRES R2).
- Model choice per DRES: a non-reasoning, under-deleting instruct model. The paper suggests 8B-class few-shot, or Qwen3-1.7B for edge. A frontier API model with non-reasoning settings is the pragmatic hackathon choice.

**Evaluation (small test set, hackathon-feasible):**
- Record 60-120 short voice messages from 2-4 speakers, each with gold word-level delete spans, covering these strata:
  - (a) cue-marked substitutions: date, time, number, name, place;
  - (b) repetitions;
  - (c) restarts with and without cues;
  - (d) abandoned final thoughts;
  - (e) explicit commands at the end and in the middle;
  - (f) **distractors** with no edit: answer "no", emphatic "actually", "wait for me", "I mean it", literal "scratch that itch", negated statements;
  - (g) negation corrections ("I can, no, I can't").
- Metrics:
  - span exact-match rate;
  - word-level P/R/F1 on deleted words (E-score style);
  - per-category breakdown (Z-score style);
  - **harmful deletion rate**: share of messages where a meaning-bearing word is deleted wrongly;
  - **distractor false-positive rate**;
  - for semantic undo, boundary accuracy (exact, ±1 word, ±1 sentence).
- Acceptance target (proposal): roughly 0 harmful deletions on distractors before turning on auto-apply. Otherwise ship as suggestions only.
- Run every model/prompt variant on the same set, keep raw outputs, and compare.

### Gaps
- No published prompt or schema for word-index disfluency spans was found to compare against. The schema above is a proposal.
- No published latency figures for LLM-based self-correction detection in streaming dictation were found.
- The thresholds (pause lengths, confidence cut-offs, crossfade lengths) are engineering heuristics that need tuning on ReSpeak's own data. They have no cited source.
