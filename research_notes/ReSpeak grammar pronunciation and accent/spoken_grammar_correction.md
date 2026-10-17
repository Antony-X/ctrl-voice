# Spoken grammatical error correction rendered back into the speaker's own recording (state as of 2026-10-17)

Scope: (a) deciding WHAT to correct in spontaneous speech (spoken GEC research, minimal-edit LLM GEC, avoiding over-correction of casual speech), and (b) HOW to render the corrected words back into the same recording (multi-edit speech editing: substitutions, insertions, deletions, reorderings). The general speech-editing model catalogue (licences, VRAM, install, RealEdit/doteBench headline numbers) is in `../ReSpeak voice editing feasibility/speech_editing_models.md`. Splicing, crossfades, margins, listening-test design and the measured A100 shoot-out are in `seamless_splicing_eval.md` and `hands_on_experiments.md` in the same folder. They are referenced here, not repeated.

Evidence tags: **[paper]** = authors' own paper (self-reported numbers); **[repo]** = README/model card/code; **[indep]** = a different group evaluating the system; **[search-summary]** = only seen in a search-engine summary, not read in the primary source (weaker); **[inferred]** = my reasoning, not a sourced fact.

## Q1. What does spoken GEC research say: Speak & Improve Challenge 2025, Cambridge cascaded vs end-to-end systems, numbers, and how disfluencies and ASR errors interact with GEC?

### Takeaway
Spoken GEC is a young field, and almost all of it comes from the Cambridge ALTA group. The Speak & Improve (S&I) Challenge 2025 was the first shared task on it. Only one team entered the SGEC/SGECF tracks. The best open-track system reached a corrected-transcript WER of 14.44 (baseline 17.77) and an ERRANT feedback F0.5 of 0.374 (baseline 0.221).

The Cambridge end-to-end Whisper system gives the best published numbers, but feedback F0.5 is still only about 0.42–0.47 on S&I. That is far below written GEC, where tuned LLMs reach about 0.78 on BEA-2019.

The dominant failure mode is spurious "grammar" edits caused by ASR errors and disfluencies. The remedies are:
- a fluent (disfluency-removed) transcript first, then GEC;
- aligning references to the system's own fluent transcript;
- filtering edits by confidence.

All three are high-precision, low-recall design choices, and ReSpeak should copy them.

### Cited Findings

**S&I Challenge 2025: setup**
- **Event.** "Speak & Improve Challenge 2025: Spoken Language Assessment and Feedback" (Qian, Knill, Bannò, Tang, Karanasou, Gales, Nicholls) was presented at SLaTE 2025, 22–24 Aug 2025, Nijmegen [paper] — [ISCA archive PDF](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Tasks.** Four tasks: ASR, SLA, SGEC and SGECF. Each has a closed track (e.g., GEC limited to bart-large, DD to bert-base-uncased, data limited to S&I + BEA-2019 + Switchboard Reannotated) and an open track (any public resource). "This is the first-ever challenge focusing on SLA, SGEC and SGECF" [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **SGEC task.** The goal is "to produce grammatically corrected transcriptions". It must handle "disfluencies (i.e., hesitations, repetitions, and false starts), and incomplete sentences". The example error types named are "tense usage, subject-verb agreement, and sentence structure" [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Baseline pipeline.** Cascade: Whisper-small ASR → BERT disfluency detection (DD) producing fluent text → BART GEC. Then "an alignment step is performed to align the GEC transcriptions with the fluent transcriptions to get timestamp information for each word", saved as a CTM file [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Metrics.**
  - SGEC: WER (primary) and TER against manual GEC transcripts, at submission level.
  - SGECF: ERRANT F0.5 (primary) against M2 references built from fluent manual transcriptions and manual GEC transcriptions.
  - ASR: "Speech WER" (SpWER). It scores "what the speaker said … rather than a standard written transcript", and hesitations and partial words are optionally deletable.
  - Source [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).

**S&I Challenge 2025: results** [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf)

| Task | Track | Team | Score |
|---|---|---|---|
| SGEC (WER, lower is better) | Baseline | — | 17.77 |
| SGEC | Closed | NTNU SMIL X | 19.50 |
| SGEC | Open | NTNU SMIL X | 14.44 (Sub 6.25 / Del 3.81 / Ins 4.37) |
| SGECF (F0.5 / P / R) | Baseline | — | 0.221 / 0.371 / 0.084 |
| SGECF | Closed | NTNU SMIL X | 0.257 / 0.344 / 0.127 |
| SGECF | Open | NTNU SMIL X | 0.374 / 0.396 / 0.304 |

- **Winning open system.** Whisper large-v3 ASR → baseline DD → "a fine-tuned Phi-4 model enhanced with Low-Rank Adaptation (LoRA)", with no external data [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Participation.** 8 teams overall, but "only one team submitting" in SGEC/SGECF. The organisers call this "a significant gap in current research" [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **ASR.** Best open-track ASR WER was 5.05 (NTNU SMIL V with WhisperX/large-v2, and perezoso with a fine-tuned parakeet-tdt-1.1b), against a 10.84 Whisper-small baseline [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Unverified baseline breakdown.** Per-type SGECF baseline behaviour ("preposition and determiner errors relatively detectable, verb-related errors remain difficult to categorize") was seen only in a search summary of the baseline paper [search-summary] — [arXiv 2412.11985](https://arxiv.org/abs/2412.11985).

**Cambridge end-to-end SGEC: "End-to-End Spoken Grammatical Error Correction"**
- **Paper.** Qian, Ma, Bannò, Gales, Knill. arXiv 2506.18532, v1 23 Jun 2025, v2 13 Oct 2026, accepted to *Speech Communication* [paper] — [arXiv abs](https://arxiv.org/abs/2506.18532).
- **Architectures compared, all on Whisper:**
  - cascaded: `Whisper_dsf + DD + GEC`;
  - partial-cascaded: `Whisper_flt + GEC`, where Whisper directly outputs a fluent transcript;
  - end-to-end: `Whisper_gec`, where audio goes straight to corrected text.
- **WER results, large-v2, S&I dev (Table 2):** cascaded 14.49, partial-cascaded 13.99, E2E 13.21. With small.en the E2E model is *worse* (17.76 vs 16.91 partial-cascaded) [paper] — [arXiv HTML](https://arxiv.org/html/2506.18532).
- **Pseudo-labelling.** It grew training data from 77.6 h of labelled Linguaskill data to about 2,520–2,590 h. Gains are mainly for small.en; for large-v2, V2 + labelled data gives 13.20 vs 13.21 [paper] — [arXiv HTML](https://arxiv.org/html/2506.18532).
- **Feedback F0.5, S&I dev, large-v2 (Table 5).** Partial-cascaded 43.10 (P 49.43 / R 28.51). E2E 39.75 (P 41.87 / R 33.06): the E2E model makes more edits, with lower precision. E2E prompted with the fluent transcript: 42.62 [paper] — [arXiv HTML](https://arxiv.org/html/2506.18532).
- **Precision fixes (Table 6).** "Strong" reference alignment plus average edit-confidence filtering (threshold ≈0.65–0.67) reaches F0.5 46.94 (P 58.03 / R 26.61) on S&I dev [paper] — [arXiv HTML](https://arxiv.org/html/2506.18532).
- **S&I eval (Table 8).**
  - Partial-cascaded baseline: WER 14.37, F0.5 42.24.
  - Best: WER 13.72, F0.5 45.22 (P 57.35 / R 24.50).
  - The text says this used "edit_min" but the table row says "edit_avg", an inconsistency in the source [paper] — [arXiv HTML](https://arxiv.org/html/2506.18532).
- **ASR errors become fake grammar edits.** The paper's example: an ASR substitution cat→rat produces a spurious "R: rat→cat" correction, and an ASR deletion of "the" produces a spurious "M: the". These "are not actual grammar errors but result from ASR noise".
- **Cascade error propagation.** In a case study, the misrecognition "resume"→"ration" propagates through the cascade [paper] — [arXiv HTML](https://arxiv.org/html/2506.18532).

**Other Cambridge papers**
- **"Scaling and Prompting for Improved End-to-End SGEC".** Qian et al., arXiv 2505.21137, submitted to Interspeech.
  - Pseudo-labelling "from 77 hours to approximately 2500 hours".
  - Prompting Whisper with fluent transcriptions gives "a slight" SGEC gain and larger feedback gains.
  - Pseudo-labelled data does not help the larger Whisper, but prompting does.
  - Source [paper] — [arXiv abs](https://arxiv.org/abs/2505.21137).
- **Earlier E2E work.** Bannò et al., "Towards End-to-End Spoken Grammatical Error Correction" (arXiv 2311.05550). A Whisper-based system doing disfluency detection and GEC directly from audio; reported as needing more annotated data to match the cascade [search-summary] — [arXiv](https://arxiv.org/abs/2311.05550).
- **Synthetic training data.** "Data Augmentation for Spoken Grammatical Error Correction" (Karanasou, Qian, Bannò, Gales, Knill; SLaTE 2025, arXiv 2507.19374). A "fully automated method" for generating audio-text pairs with grammatical errors *and* disfluencies, plus metrics to select augmented data. The generation technique and numbers were not on the abstract page [paper] — [arXiv abs](https://arxiv.org/abs/2507.19374).
- **Text-only follow-up.** "Listen, Correct, and Feed Back: Spoken Pedagogical Feedback Generation" (Liang, Lu, Kochmar, Koto; arXiv 2604.14177, Mar 2026; a course project).
  - Transcript-based SGEC plus teacher-style feedback on S&I data, comparing SFT vs DPO/KTO on Qwen2.5, Llama-3.1 and GLM-4.
  - "SFT provides the most consistent improvements". Correction quality and feedback quality are "only weakly coupled".
  - Output is text, not audio. Code at github.com/Skywalker-Harrison/spfg.
  - Source [paper] — [arXiv abs](https://arxiv.org/abs/2604.14177).
- **How S&I references were made.** Annotators first produced a fluent transcript by removing hesitations, partial words, false starts and repetitions. They then wrote a grammatically corrected version, working from text only. Example: "i am sti- still care about %hesitation% the the environment" → "i am still care about the environment" [paper] — [arXiv 2412.11986v1](https://arxiv.org/html/2412.11986v1).

### Inferences
- **Copy the Cambridge order of operations** [inferred]:
  1. verbatim ASR plus forced alignment;
  2. disfluency/self-repair cleanup (ReSpeak already has this layer; see `hands_on_experiments.md` §2);
  3. GEC on the *fluent* text;
  4. map each GEC edit back to word timestamps through the fluent↔verbatim alignment, as the baseline's CTM alignment step does.

  Running GEC on the disfluent transcript makes repetitions and false starts look like errors.
- **Expect spoken GEC to be far less reliable than written GEC.** Best spoken F0.5 is ≈0.37–0.47, against ≈0.78 for tuned LLMs on written BEA-2019 (Q2). The UI should therefore be "suggest, preview, accept", not silent auto-correction. Auto-apply only high-confidence edits in narrow categories (Q2).
- **ASR errors are the biggest false-positive source.** A grammar suggestion should be suppressed when the words it touches have low ASR confidence. The cat→rat example shows that GEC will otherwise "fix" words the speaker never said, and ReSpeak would then synthesise a word the speaker did not say.

### Gaps
- No final S&I leaderboard exists beyond the single SGEC/SGECF team, so there is no diversity of approaches to compare.
- Lu et al. 2022 (BEA), "On assessing and developing spoken 'grammatical error correction' systems", was found but not read — [ACL Anthology](https://aclanthology.org/2022.bea-1.9/).
- The Karanasou et al. augmentation method (TTS? voice cloning?) and its numbers were not verified. It is directly relevant because it may synthesise erroneous speech.
- No per-error-type SGEC accuracy was found in a primary source.

## Q2. How should ReSpeak decide WHAT to correct: minimal-edit LLM GEC, over-correction, the common error types in spoken L2 English, and leaving casual native speech alone?

### Takeaway
LLMs over-correct by default. A generic "fix the grammar" prompt rewrites well-formed text and drives precision below 45% on BEA-2019 dev. The proven fixes are:
- an explicit minimal-edit instruction ("Make MINIMAL, PRECISE edits … DO NOT rewrite or paraphrase");
- few-shot examples;
- restricting edits to an ERRANT error taxonomy;
- batching several sentences per request;
- edit-level majority voting across samples.

Spoken data adds a second over-correction risk. When crowdworkers "minimally corrected" spontaneous speech, they edited native speakers' transcripts almost as much as learners' (18.9% vs 23.9% edit rate). Most native "corrections" were deletions and "other" (disfluency-like) edits.

So ReSpeak should:
- correct only a whitelist of clear morphosyntactic error types: subject–verb agreement, verb form and tense, determiners, prepositions, noun number and word order;
- leave everything else to the separate disfluency layer, or leave it alone.

### Cited Findings

**Minimal-edit prompting: "Larger Context Window, Fewer Overcorrections"**
- **Paper.** Karpo & Chernodub, arXiv 2609.10810, 9 Sep 2026, EMNLP 2026 Findings [paper] — [arXiv HTML](https://arxiv.org/html/2609.10810v1).
- **Over-correction baseline.** Vanilla zero-shot prompts over-correct, with precision "often below 45.0" on BEA-2019 dev.
- **The minimal-edit constraint.** Key wording: "Make MINIMAL, PRECISE edits to fix errors. DO NOT rewrite or paraphrase." It raised F0.5 by +1.1 to +10.9 for most models but cut recall by about 6–22 points.
- **Taxonomy prompt.** Lists the 25 ERRANT categories and declares any other edit off-task. It helped only some models.
- **Results on BEA-2019 test:**
  - Gemini 3.1-Pro: vanilla F0.5 56.45 (P 53.32 / R 73.81) → optimized prompt, batch 15: 78.32 (P 82.29 / R 65.66). CoNLL-2014 at the same setting: 67.08.
  - Qwen3-8B: 56.11 → 68.84 (batch 5).
- **Batching effect.** Batching numbered sentences raised the share of sentences left unchanged from 43.8% to 80.7% for Qwen3-8B (batch 1 → 120). Fluency (Scribendi) peaks at batch 1.
- **Reference points.** Fine-tuned Gemma 2 (Staruch et al. 2025) reaches 78.70 on BEA-2019 test; zero-shot minimal-edit Claude Sonnet 4.5 (Türker & Eryiğit 2026) reaches 64.91.
- **Caveats.** Single runs only, and possible contamination of BEA/CoNLL data in commercial models.

**Other over-correction work**
- **Edit-level majority voting** (Goto, Sakai, Watanabe; BEA 2026, arXiv 2605.13624). A training-free method: sample several corrections from one LLM and keep edits by majority vote. It beats greedy and MBR decoding "in most of nine benchmarks" across 7 languages and is stable across prompts. Sample count and threshold were not read [paper] — [arXiv abs](https://arxiv.org/abs/2605.13624).
- **Fine-tuning for minimal edits.** "Adapting LLMs for Minimal-edit GEC" (arXiv 2506.13148) fine-tunes LLaMA-2 / Gemma 2 against over-correction [search-summary] — [arXiv](https://arxiv.org/pdf/2506.13148).
- **Reasoning models over-correct too.** In a 2026 Ukrainian minimal-edit study, GPT-5.x reasoning models did not beat GPT-4.1-mini on zero-shot F0.5, which the authors attribute to over-correction [search-summary] — [arXiv 2606.09334](https://arxiv.org/html/2606.09334).

**Spoken data: native speakers get "corrected" too** (Caines, Bentz, Knill, Rei, Buttery, COLING 2020, CROWDED corpus) [paper] — [ACL Anthology PDF](https://aclanthology.org/2020.coling-main.195.pdf)
- **Instruction given.** Crowdworkers were asked for minimal corrections, to make transcripts "sound like something you would expect to hear or produce yourself in English".
- **Overall edit volume.** 80% of transcriptions were edited, at 21 edits per 100 tokens.
- **Native vs learner edit rate.** 18.9% for native speakers vs 23.9% for learners. Native speakers produced 51.3 tokens per recording, learners 27.0.

ERRANT edit- and error-type shares (Table 2), CROWDED spoken transcripts vs the FCE written learner corpus:

| Type | Native (spoken) | Learners (spoken) | FCE (written) |
|---|---|---|---|
| Replacement | 44.3% | 51.0% | 64.4% |
| Missing | 12.8% | 14.8% | 21.0% |
| Unnecessary | 42.9% | 34.2% | 11.5% |
| Other (includes filled pauses, partial words, false starts) | 66.3% | 56.4% | 13.3% |
| Determiner | 2.6% | 5.2% | 10.9% |
| Preposition | 2.0% | 3.7% | 11.2% |
| Verb | 2.1% | 3.9% | 7.0% |
| Verb:tense | 0.6% | 1.7% | 6.0% |
| Verb:form | 0.4% | 0.6% | 3.6% |
| Verb:subj-verb-agr | 0.2% | 0.4% | 1.5% |
| Noun:number | 1.0% | 1.3% | 3.3% |
| Word order | 0.8% | 1.6% | 1.8% |
| Pronoun | 1.0% | 1.4% | 3.5% |

- **Why "other" dominates.** It is largest "because the ERRANT typology was designed for written language", so disfluencies land there.
- **Filled pauses.** Native speakers produced as many filled pauses as learners: 273 instances (7% of their edits) vs 256 (5.6%).
- **Corpus size.** CROWDED subset: 76 speakers (30 native, 46 learners with German L1), 383 recordings, 39,726 word tokens, 8,454 edits.

**What S&I calls its target errors.** The SGEC task description names "tense usage, subject-verb agreement, and sentence structure" [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).

### Inferences
- **Correct a whitelist, not "the grammar"** [inferred]. Default auto-suggest categories, in ERRANT terms:
  - `R:VERB:SVA` ("she don't" → "she doesn't", "the files is" → "the files are");
  - `R:VERB:FORM` and `R:VERB:TENSE`;
  - `M:DET` / `R:DET` / `U:DET`;
  - `R:PREP`;
  - `R:NOUN:NUM`;
  - `R:WO` (word order, e.g., "love I this song").

  Exclude `OTHER`, `R:ORTH`, `R:PUNCT`, contractions, style, register and lexical "improvements". Disfluencies belong to the separate cleanup layer. The CROWDED data shows these excluded categories are exactly where native casual speech gets rewritten.
- **Protect informal spoken English with an allowlist.** Examples: "gonna/wanna/kinda", "there's" + plural, "me and him", sentence fragments, dropped subjects ("Sounds good"), and "like" as a discourse marker. Offer a "formal" mode only on request. The specific forms are my suggestion; I found no spoken-GEC paper that publishes such an allowlist.
- **A concrete LLM recipe that matches the literature:**
  1. Feed the fluent transcript with a minimal-edit instruction plus the ERRANT whitelist and 5–8 spoken few-shot pairs. Include *negative* examples: casual native utterances that must stay unchanged.
  2. Ask for inline-markup output, e.g. `She {don't→doesn't} know where the files {is→are}`. The prior hands-on notes found inline markup far better than index output.
  3. Sample 3–5 times and keep only majority edits (Goto et al.).
  4. Re-derive the edits with ERRANT between the original and corrected text, so each edit has a type and the whitelist can be enforced deterministically.
  5. Drop edits that touch words with low ASR confidence (Q1).
- **Batching.** Packing a whole 10–60 s message as numbered sentences in one call fits the batching finding (more unchanged sentences, higher precision). Precision is what matters here, because every accepted edit costs an audible synthetic region.
- **Pick the correction with the smallest audio footprint.** When several corrections are grammatical, prefer the one that keeps content words and changes function words or inflections. For "the files is", change "is"→"are" and keep "files", because the plural noun is likely what the speaker meant and a verb change keeps the content noun's audio intact. Offer the alternative ("the file is") as a second option.

### Gaps
- No published allowlist or guideline for "don't correct casual spoken English" in a GEC system was found.
- The CROWDED native "errors" are not broken down into genuine errors vs. spoken-grammar norms.
- No study measures LLM minimal-edit GEC directly on *spoken* transcripts with the over-correction metrics of Karpo & Chernodub. The NTNU Phi-4-LoRA S&I system is the closest, and it is fine-tuned, not prompted.
- Error-type frequencies for the S&I corpus itself were not found: the corpus paper reports no ERRANT distribution.

## Q3. How should corrections be expressed as audio edits (substitution, insertion, deletion, reordering), how much context should be regenerated, and how are agreement errors spanning several words handled?

### Takeaway
Every GEC edit can be expressed as one contiguous word-span replacement (old span → new span) once ERRANT has aligned the original and corrected text:
- an insertion is an empty old span;
- a deletion is an empty new span;
- a reordering ("love I" → "I love") is a single replacement of the reordered span.

Published editors locate edits by text diff plus forced alignment and add a small acoustic margin: VoiceCraft sweeps 0.05–0.14, EditVoice uses 0.12 s on each side. Quality degrades with longer spans (VoiceCraft) and with multiple regions in a short utterance (dots.tts.edit). The practical rule is therefore to merge nearby edits into one span and keep isolated edits separate. No paper studies grammar-correction edits or reordering specifically.

### Cited Findings
- **VoiceCraft locates masks by text diff.** At inference it compares original and target transcripts and maps the differing words to codec spans via forced alignment.
  - Substitution and deletion: the mask is the differing words plus a margin ε.
  - Insertion: the mask spans "from the middle of the two neighboring words" plus the margin.
  - Each span gets its own mask token, and the model is trained with 1–3 spans (Poisson(1), truncated).
  - At inference ε is swept from 0.05 to 0.14 over 10 runs; the 4 longest outputs are discarded and one of the remaining 6 is picked.
  - Source [paper] — [VoiceCraft arXiv HTML](https://arxiv.org/html/2403.16973v3).
- **VoiceCraft naturalness vs span length.** Its outputs are "slightly less natural with longer edit span(s)". Its advantage over FluentSpeech is largest "for substitution edits and when the edit span length is long" [paper] — [VoiceCraft arXiv HTML](https://arxiv.org/html/2403.16973v3).
- **EditVoice cascade mode.** Uses "a text diff and word-level forced alignment (MFA)" to localize the changed region, disables edits outside it, and uses 0.12 s of context on each side. Its Edit Flows formulation has explicit token-level insertion, deletion and substitution operations, so output length varies during sampling [paper] — [EditVoice arXiv HTML](https://arxiv.org/html/2609.29889).
- **F5-TTS `speech_edit.py` takes a list of spans.** Default example: `parts_to_edit = [[1.42, 2.44], [4.04, 4.9]]` with `fix_duration = [1.2, 1]`, for "nature" → "optimist" and "mother nature" → "realist".
  - The loop builds `mel_cond` and `edit_mask` per part.
  - From the code: a zero-length span (`start == end`) with a positive duration inserts frames, and a duration of 0 deletes the span. Neither is documented in comments.
  - Source [repo] — [speech_edit.py](https://raw.githubusercontent.com/SWivid/F5-TTS/main/src/f5_tts/infer/speech_edit.py).
- **dots.tts.edit tags and limitations.**
  - README: "Supported structural tags include `<del>`, `<ins>`, `<sub targ="replacement">`, `<emo>` …". The only worked example is a single `<sub>`.
  - The paper says multiple non-overlapping operations are serialized "in source order".
  - The paper also notes "Performance also remains unstable when multiple regions within a short utterance are edited."
  - Sources [repo/paper] — [GitHub](https://github.com/studio-dots-ai/dots.tts); [arXiv v2](https://arxiv.org/html/2608.02673v2).
- **ERRANT already has a word-order type.** It appears in the Caines et al. error typology table, alongside missing / replacement / unnecessary edit operations [paper] — [Caines 2020](https://aclanthology.org/2020.coling-main.195.pdf).
- **Text-editing models can represent reordering directly.** Felix models it so that "John and Mary" → "Mary and John" doesn't need a delete plus an insert [search-summary] — [Felix arXiv 2003.10687](https://arxiv.org/pdf/2003.10687). I found no speech editor with an explicit reorder operation.

### Inferences
- **Edit representation for ReSpeak** [inferred]:
  1. Run ERRANT (or difflib on tokens) between the fluent transcript and the corrected transcript to get edits `(i, j, new_words, type)` over original word indices.
  2. Map each edit to the verbatim word timeline via the forced alignment.
  3. Build render spans:
     - **Substitution:** time range of words i..j−1 → `new_words`.
     - **Insertion:** a zero-length point at the gap between words i−1 and i. Never insert into the middle of a word.
     - **Deletion:** remove words i..j−1. This needs no synthesis if the pause structure allows a clean cut (use the existing cut-only splicing logic); otherwise regenerate the neighbouring word for coarticulation.
     - **Reordering ("love I this song" → "I love this song"):** one substitution of the span "love I" → "I love". Never move the original audio pieces around: the intonation of a cut-and-moved "I" will be wrong.
- **Merge rule for multiple edits.** "She don't know where the files is" has two agreement edits (don't→doesn't, is→are) separated by "know where the".
  - If two edits are ≤2 words or ≤~0.5 s apart, regenerate them as *one* span covering both, here "don't know where the files is" → "doesn't know where the files are". This gives one coherent prosodic phrase and avoids the multi-region instability dots reports.
  - If they are far apart, keep separate spans, each with ~0.1 s margins.
  - These thresholds are heuristics to tune, not sourced values.
- **How much to regenerate:**
  - inflection-only changes ("is"→"are", "don't"→"doesn't"): the word plus the margin;
  - insertions of function words (articles, prepositions): the inserted word plus the following word, so the onset coarticulates;
  - word-order and tense changes that shift sentence stress: the whole phrase or clause.

  Supply ≥3–5 s of untouched context on both sides, per `seamless_splicing_eval.md` Q2.
- **Duration for non-autoregressive editors (F5).** `fix_duration` must be set per span. Estimate it from the speaker's own measured rate (seconds per syllable in this message) times the syllable count of the new words. Never reuse the old span length for insertions or deletions.
- **Agreement spanning words.** Fix the agreement at the cheapest audio location (the verb) rather than the subject noun, unless the LLM is confident the noun is wrong (see Q2, "smallest audio footprint").

### Gaps
- No paper evaluates speech editing on grammar-correction edits (small inflection changes, article insertions, reorderings) as a category.
- No published threshold for when to merge adjacent edit spans.
- No speech editor or benchmark tests word reordering explicitly. RealEdit and doteBench cover only insertion, deletion and substitution.

## Q4. Which speech-editing models handle multiple edits jointly (and insertion, deletion, reordering), what are the published multi-edit and long-span results, and is there any speech-to-speech GEC in the speaker's own voice?

### Takeaway
Joint multi-span editing in one pass is supported by:
- F5-TTS `speech_edit.py` (a list of spans);
- VoiceCraft (trained on 1–3 spans);
- SSR-Speech (listed as up to 3);
- CosyEdit (end-to-end, mixed edits);
- dots.tts.edit (several tags serialized in source order).

Ming-UniAudio is single-location per instruction. PlayDiffusion and AuK document only single edits.

Published multi-edit evidence is thin:
- **dots.tts.edit** is the only system with a compositional benchmark. Over 240 cases of 2–4 operations, all operations succeeded together in only 30.00%, though text components alone succeeded 86.23%.
- **RealEdit** has just 40 two-span examples and no separate scores.

I found no paper on speech-to-speech GEC that outputs the corrected sentence in the speaker's own voice. All spoken-GEC systems output text. The closest prior art is mispronunciation correction by spectrogram inpainting in the learner's own voice. ReSpeak's grammar-in-own-voice feature therefore appears to be unpublished territory as of 2026-10-17.

### Cited Findings
- **dots.tts.edit compositional results** (doteBench, 240 cases with 2–4 operations):
  - all-operations ("all-component") success 30.00%; per-operation ("component") success 60.87%;
  - per-family component rates: Text 86.23%, Emotion 18.84%, Prosody 79.71%, Pause 58.70%;
  - sequentially chained task-specific pipelines reach 67.57% component / 34.17% all-component, but need multiple passes.

  Source [paper] — [arXiv v2](https://arxiv.org/html/2608.02673v2).
- **dots.tts.edit Text Hard (v2, Table 2):** edit WER 13.70, non-edit WER 1.51, SpkSim 0.757, UTMOS 3.13. Text Easy: edit WER 1.25.
  - The paper never defines what makes a case "Hard". There is no per-operation (ins/del/sub) breakdown and no long-span results.
  - The prior notes quote 12.95 edit WER from the latest arXiv version; the numbers differ between versions.
  - Source [paper] — [arXiv v2](https://arxiv.org/html/2608.02673v2).
- **CosyEdit and its baselines.**
  - CosyEdit's paper (Table I) lists SSR-Speech's multi-edit capability as "3" and Ming-UniAudio's as "N". Ming-UniAudio "is restricted to single-location modifications per instruction". FluentSpeech and Ming handle multi-span cases by sequential editing.
  - CosyEdit's subjective test covers insertion, deletion, substitution and "mixed-edit" (10 examples each), but only aggregate scores are reported.
  - Zero-shot in-context use "tends to favor preserving the original speech rather than performing edits" (WER 6.41 vs 4.50 one-shot).
  - After replacing unedited regions with original audio, CosyEdit's WER goes from 4.50 to 5.84.
  - Source [paper] — [CosyEdit arXiv HTML](https://arxiv.org/html/2601.05329v1).
- **RealEdit composition.** 310 examples: 270 single-span (45 insertion, 52 deletion, 173 substitution) and 40 two-span.
  - Single-span lengths: 1–2 words (63), 3–6 words (125), 7–12 words (82).
  - Sources: LibriTTS (100), YouTube/GigaSpeech (100), Spotify podcasts (110).
  - No separate numeric results by span count.
  - Source [paper] — [VoiceCraft arXiv HTML](https://arxiv.org/html/2403.16973v3).
- **EditVoice limits.** Training replaces one random span (L0 = 50 tokens), and no multi-span results are reported. It notes a training–inference mismatch: editing generated speech "is not explicitly trained" [paper] — [EditVoice arXiv HTML](https://arxiv.org/html/2609.29889).
- **PlayDiffusion.** The README describes masking "that portion of the audio" and denoising it conditioned on updated text, with a single-word example. It does not document multiple edits, insertions, deletions or length changes [repo] — [GitHub](https://github.com/playht/PlayDiffusion).
- **No speech-output GEC found.** All found spoken-GEC systems output text:
  - Cambridge E2E [paper] — [arXiv 2506.18532](https://arxiv.org/abs/2506.18532);
  - the S&I Challenge [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf);
  - SPFG feedback [paper] — [arXiv 2604.14177](https://arxiv.org/abs/2604.14177).
  - Two extended searches ("speech-to-speech grammatical error correction"; "speech-to-speech" GEC with spoken audio output, 2026) found no speech-output GEC work. This is a negative search result, not a citable fact; see Gaps.
- **Closest prior art: own-voice mispronunciation correction** (arXiv 2204.03379). It regenerates a learner's mispronounced word with the correct sound while keeping the voice (e.g., learner says "white" for "right"). It states that keeping the original voice "was found to be a critical factor in providing effective feedback" [paper/search-summary] — [arXiv 2204.03379](https://arxiv.org/pdf/2204.03379).
- **Older "self-imitation" feedback.** Earlier systems transplant native prosody onto the learner's own voice, using PSOLA and later GANs [search-summary] — [arXiv 1904.09407](https://arxiv.org/pdf/1904.09407); [Saarland dissertation](https://publikationen.sulb.uni-saarland.de/bitstream/20.500.11880/27176/1/Dissertation_UdS_RenlongAi.pdf).
- **Learners struggle to hear their own errors.** Intermediate learners identified errors in their own speech with 65% accuracy on a stimulated-correction task vs 83% on a written task, and also flagged errors where there were none. This motivates hearing the corrected version in one's own voice [search-summary] — [System (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0346251X22002159).

### Inferences
- **For ReSpeak's 1–3 short grammar edits per message** [inferred], the most predictable path is per-span infilling with splice-back. ReSpeak already does this for word replacement (PlayDiffusion + F5 in parallel, ASR-verified). Two ways to handle several spans:
  - **Jointly:** F5 with multiple `parts_to_edit`, with each span's duration set from speaking rate.
  - **Sequentially:** edit one span at a time, splicing each result into the original before the next edit.

  Because every splice keeps the rest of the recording bit-exact, sequential edits don't accumulate drift, unlike regenerating the whole utterance (dots, PlayDiffusion raw). This avoids the ~30% all-edits-succeed rate dots shows for multi-operation instructions.
- **dots.tts.edit as the "retry / high quality" engine.** For a merged span, build the instruction with a single `<sub targ="doesn't know where the files are">don't know where the files is</sub>`. That is one region, not two tags, which sidesteps the multi-region instability. Still verify any `<ins>`/`<del>` syntax on the playground, since the README gives no example.
- **Deletions** (e.g., an extra article, "U:DET") need no generative model when there is a pause or clean boundary. Use the existing cut-only splice and fall back to infilling the neighbour word if the cut sounds clipped.
- **AuK-style instruction editors.** "Replace 'X' with 'Y'" instructions are a poor fit for grammar edits, because the targets are tiny function words that occur many times in a message. AuK also ignored content-edit instructions 4/10 times in the hands-on test.
- **A product angle.** Since no own-voice spoken-GEC system is published, ReSpeak could reasonably say "to our knowledge the first" for this demo. Hedge it, because the search was not exhaustive (e.g., commercial language-learning apps were not searched).

### Gaps
- No published numeric results by number of spans or span length for VoiceCraft, CosyEdit, EditVoice or SSR-Speech.
- dots.tts.edit `<ins>`/`<del>` syntax and multi-tag behaviour are unverified in the README.
- PlayDiffusion multi-region support was not verified in the source code.
- Commercial language-learning products (e.g., Duolingo, ELSA, Speak) were not searched for own-voice grammar correction.
- The Karanasou et al. 2025 augmentation paper may synthesise erroneous speech, which would be relevant prior art for the reverse direction. Its method was not verified.

## Q5. How should a spoken correction be verified (ASR of output vs corrected text, speaker similarity, naturalness, listening test)?

### Takeaway
Verify on two levels:
1. **Was the right correction chosen?** Spoken-GEC metrics: ERRANT F0.5 against M2 references built from fluent transcripts (S&I SGECF), and WER against manually corrected transcripts (S&I SGEC).
2. **Was it rendered faithfully?** Speech-editing metrics:
   - edit-region WER separately from non-edit-region WER (dots);
   - ASR-alignment exact match for the target span (SpeechEditBench);
   - speaker similarity;
   - UTMOS/MOSNet, including the before/after-splice MAE (CosyEdit);
   - duration/F0 DTW (dots).

A cheap end-to-end check is to ASR the edited audio and run ERRANT between the original transcript and the new ASR transcript; the result should reproduce exactly the planned edit set. Listening-test design and boundary metrics are in `seamless_splicing_eval.md` Q4 and are not repeated here.

### Cited Findings
- **Spoken-GEC correction metrics.** SGEC uses WER/TER against manual GEC transcripts; SGECF uses ERRANT F0.5 against M2 references from fluent manual and GEC transcripts. ASR is scored with SpWER, which allows hesitations and partial words to be deleted [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Reference-alignment caveat.** Comparing system output with a reference built on a *different* fluent transcript creates spurious edits. Aligning the reference to the system's own fluent transcript ("Mild"/"Strong" alignment) raised S&I dev F0.5 from 42.62 to 45.96 [paper] — [arXiv HTML 2506.18532](https://arxiv.org/html/2506.18532).
- **dots.tts.edit editing metrics.** Edit-region WER/CER and non-edit WER/CER separately, WDTW-Dur and WDTW-F0 for prosody, SpkSim and UTMOS. Text Hard v2: edit 13.70 / non-edit 1.51 / WDTW-Dur 7.89% / WDTW-F0 2.47 st [paper] — [arXiv v2](https://arxiv.org/html/2608.02673v2).
- **CosyEdit metrics.** WER, SpkSIM, MAE of MOSNet and UTMOS (consistency), and subjective EMOS/SMOS. It also re-scores after replacing unedited regions with the original audio (Table III) [paper] — [CosyEdit](https://arxiv.org/html/2601.05329v1).
- **SpeechEditBench content success.** An edit counts as successful when the target span appears (or, for deletions, is absent) according to ASR alignment, reported with exact match, WER and CER [search-summary] — [SpeechEditBench](https://arxiv.org/html/2606.01804v3).
- **RealEdit subjective tests** (VoiceCraft) use human preference by edit type and span length, and require edited transcripts to be grammatical and coherent [paper] — [VoiceCraft](https://arxiv.org/html/2403.16973v3).

### Inferences
- **Per-edit acceptance test for ReSpeak** [inferred]:
  1. ASR the spliced output with a *verbatim* recogniser and force-align it.
  2. The target words must appear at the span; the edit-span WER must be 0 or within one homophone/contraction variant.
  3. Non-edit regions are bit-exact by construction (splice), so no check is needed there.
  4. `ERRANT(original_fluent, ASR(output))` must equal the planned edit set: no extra edits, no missing edits.
  5. ECAPA similarity of the span vs the rest of the message, plus boundary F0 and energy jumps, should stay within the thresholds already used in the demo.
  6. Run several seeds and pick the best passing candidate.
- **Don't trust Whisper-style ASR as the judge of grammar.** A recogniser that normalises toward standard written English could "hear" "doesn't" even when "don't" was synthesised. Use a CTC/verbatim model, or the same aligner, to check the exact token. This risk is my inference; no source quantifies Whisper's grammar normalisation.
- **Listening test for the hackathon.** Mix 20 edited clips with 20 unedited ones (or ABX: original vs corrected) and ask "which one was edited / where?" Detection near chance (50%) shows the rendering is seamless. Add a "does it still sound like the same person?" 5-point SMOS.

### Gaps
- No benchmark exists for grammar-correction speech edits specifically: tiny inflectional changes, where a one-phoneme ASR miss flips success.
- No source quantifies how often Whisper normalises learners' grammatical errors in transcripts. Hands-on notes show it drops repetitions, but grammar normalisation is untested.

## Q6. What real human speech with naturally occurring grammatical errors can be downloaded today for testing, and under what exact access conditions?

### Takeaway
The only sizeable corpus with real L2 audio *and* manual grammatical corrections is the **Speak & Improve Corpus 2025**: ~315–340 h of audio, of which ~55–60 h is transcribed and ~57 h GEC-annotated across splits. Access is free after registration, but the terms are:
- non-commercial research and education only;
- no redistribution;
- no release of derived models or data statistics without CUP&A approval;
- LLM use only with local models or no-retention APIs.

That is fine for an internal evaluation, but not for training a shipped product model without approval.

Freely licensed alternatives without GEC labels:
- **EdAcc** (CC BY-SA, 40 h of Zoom conversations, many L2 speakers);
- **AMI** (CC BY 4.0, 100 h of meetings).

Other options:
- **CROWDED** (Caines et al.): small, with audio and GEC annotations for native speakers and German-L1 learners; licence unverified.
- **ICNALE** spoken modules: redistribution prohibited; download conditions not stated on the page.
- **NICT JLE**: error tags on 167 interview transcripts, but no audio.
- **LearnerVoice**: 50 h of Korean-L1 learner speech; licence unknown.

### Cited Findings

**Speak & Improve Corpus 2025**
- **Access and licence.** CUP&A "Licence Agreement" (11 clauses).
  - Use is "non-commercial research and educational purposes only", non-exclusive and non-transferable.
  - Commercial use excludes any use in a product or service that is sold, offered, licensed, leased or rented.
  - Registration form: name, email, academic affiliation, proposed use, CAPTCHA.
  - Do not share the corpus in full or in part with anyone, including other licensees and via Hugging Face/GitHub.
  - Do not release derived items (models, data statistics) without prior CUP&A approval.
  - LLMs: use only locally hosted models, or commercial APIs that do not retain data for training.
  - Excerpts under 100 words may be published. Report publications to researchdatasets@cambridge.org.
  - Source [repo/official] — [CUP&A dataset page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025).
- **Size per the official page.** About 315 h, 45,000+ utterances, 7,000+ test submissions; about 55 h with manual transcriptions including disfluencies and corrections; CEFR level for all data [official] — [CUP&A](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025).
- **Size per the corpus paper (v1)** [paper] — [arXiv 2412.11986v1](https://arxiv.org/html/2412.11986v1):
  - ~340 h total, ~60 h transcribed;
  - Dev: 438 submissions, 38.5 h, 24.7 h transcribed, 22.5 h GEC-annotated;
  - Eval: 442 submissions, 38.7 h, 24.5 h transcribed, 22.0 h GEC-annotated;
  - Train: 6,640 submissions, 270 h, 28.4 h transcribed, 12.8 h GEC-annotated;
  - Dev CEFR is mostly B1–B2+ (B1 18.3%, B1+ 25.3%, B2 25.1%, B2+ 18.3%);
  - no speaker or L1 counts are given.

  The official page (~315 h / ~55 h) and the paper (~340 h / ~60 h) disagree, probably because they describe different releases.
- **Task parts and DOI.** The challenge release includes Parts 1 and 3–5 (short answers, 1-minute opinion monologue, diagram description, topic questions). The read-aloud Part 2 is excluded. DOI 10.17863/CAM.114333 [paper] — [qian25_slate](https://www.isca-archive.org/slate_2025/qian25_slate.pdf).
- **Contact.** Queries go to support@speakandimprove.com [paper] — [arXiv 2412.11986v1](https://arxiv.org/html/2412.11986v1).

**EdAcc (Edinburgh International Accents of English Corpus)**
- Licence "Creative Commons Attribution-ShareAlike" (CC-BY-SA), with no gating shown: `load_dataset("edinburghcstr/edacc")` [repo] — [HF dataset card](https://huggingface.co/datasets/edinburghcstr/edacc).
- About 40 h of dyadic Zoom conversations, 19.1k rows, validation and test splits only.
- Professional transcripts with `<OVERLAP>`, `<LAUGH>` and hesitation tags.
- The viewer shows 62 speaker IDs and 29 L1 values; the corpus covers "first and second-language varieties of English" [repo] — [HF dataset card](https://huggingface.co/datasets/edinburghcstr/edacc).
- DataShare DOI 10.7488/ds/7914, archive ~5.5 GB [search-summary] — [Edinburgh DataShare](https://datashare.ed.ac.uk/items/355c07b4-500d-4e80-8f12-225e646293c9); paper [arXiv 2303.18110](https://arxiv.org/abs/2303.18110).
- No grammatical error annotation is mentioned [repo] — [HF dataset card](https://huggingface.co/datasets/edinburghcstr/edacc).

**AMI Meeting Corpus**
- Signals, transcription and some annotations are under CC BY 4.0; 100 h of meeting recordings [official] — [AMI corpus page](https://groups.inf.ed.ac.uk/ami/corpus/).
- The share of non-native participants is not stated on that page.
- The prior hands-on notes used 3 AMI headset clips for edit tests.

**CROWDED Corpus** (Caines et al.)
- Crowdsourced recordings from native English speakers and German-L1 learners, with crowdworker transcription corrections and minimal GEC annotations (ERRANT-typed).
- The COLING 2020 subset: 76 speakers, 383 recordings, 39,726 tokens, 8,454 edits.
- Caines et al. call it, to their knowledge, the first freely available speech corpus with grammatical error annotations. The paper links an ORTOLANG record (ortolang-000913).
- Source [paper] — [Caines 2020](https://aclanthology.org/2020.coling-main.195.pdf).

**ICNALE (International Corpus Network of Asian Learners of English)**
- Spoken Monologues: 1,100 participants, 4,400 samples, 500k words, 60-second monologues.
- Spoken Dialogues: 425 participants, 4,250 samples, 1.6M words, 30–40 min interviews.
- Terms of Use: "It is prohibited to reproduce and/or redistribute a part or the whole of the ICNALE data" and "prohibited to analyze the interviewer speeches".
- The page does not state registration, cost, commercial-use rules, or whether audio files are included [official] — [ICNALE site](https://language.sakura.ne.jp/icnale/).

**NICT JLE (Japanese Learner English)**
- Transcripts of 1,281 ACTFL-ALC Standard Speaking Test interviews (~300 h of recordings). Error tags on 167 files [official, via search] — [NICT JLE page](https://alaginrc.nict.go.jp/nict_jle/index_E.html).
- "NICT JLE does offer error-annotated transcriptions but does not make the audio files available" [paper] — [Caines 2020](https://aclanthology.org/2020.coling-main.195.pdf).

**LearnerVoice**
- 50.04 h of fully transcribed spontaneous speech from 58 Korean-L1 learners (Ringle tutoring sessions), Interspeech 2024 [paper] — [arXiv 2407.04280](https://arxiv.org/abs/2407.04280v2).
- The release location given is prep.ringleplus.com/research. The licence was not found [search-summary] — [arXiv](https://arxiv.org/html/2407.04280v2).

### Inferences
- **For ReSpeak testing** [inferred]:
  - **S&I Corpus (Dev/Eval):** the best testbed for "find the error, then render the fix in the speaker's voice". It has real L2 audio, fluent transcripts and GEC references, so ReSpeak's suggestions can be scored with ERRANT F0.5 and the rendered audio checked. Register under academic research use, keep it on the GPU box, and use only local LLMs (e.g., the self-hosted Qwen) on it. Do not publish clips or derived statistics without CUP&A approval, and do not use it to train a commercial model.
  - **EdAcc and AMI:** usable for public demos, because of the CC licences. They have no GEC labels, so pick utterances with naturally occurring agreement or article errors by hand, or with the GEC pipeline plus manual checking.
  - **The user's own example sentences** ("She don't know where the files is", "love I this song"): record them with consenting team members to get demo audio with no licence questions.
  - **EdAcc/AMI as an over-correction test set:** run GEC over the fluent native-speaker utterances and count suggested edits. Every suggestion on a native speaker's casual speech is a candidate false positive (Q2).
- **ICNALE, NICT JLE and LearnerVoice:** treat as "research reference only". Terms or audio availability are unclear, and NICT JLE has no audio.

### Gaps
- ICNALE: the download page's exact requirements (registration, free vs paid, commercial terms) and whether spoken modules ship audio were not verified.
- CROWDED: the ORTOLANG licence and current availability were not checked.
- LearnerVoice: licence and actual availability not verified.
- AMI: the proportion of non-native speakers was not verified from a primary source.
- An L2-ARCTIC spontaneous split on Hugging Face (`KoelLabs/L2ArcticSpontaneousSplit`, gated "agree to share contact information") appeared in search but was not examined — [HF](https://huggingface.co/datasets/KoelLabs/L2ArcticSpontaneousSplit).
- The S&I Corpus has no published ERRANT error-type distribution, and its speaker and L1 counts are not reported.
