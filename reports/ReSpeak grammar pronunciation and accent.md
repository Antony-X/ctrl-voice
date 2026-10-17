# Fix the words, keep the accent

ReSpeak can already correct grammar and pronunciation inside a real recording in the speaker's own voice. It can also shift tone safely. It cannot remove an English accent with any model that exists today.

On real non-native conversation from EdAcc, the prototype rendered **8 of 8 LLM-proposed grammar fixes** in the speaker's voice, in **2.3–6.2 s each**, and every fix was confirmed by re-transcription. Examples include "for the advices" → "advice", "go to mountains" → "the mountains" and "didn't got" → "didn't get". The word-level mispronunciation detector was trained in an afternoon on speechocean762. It reaches **AUC 0.88 and a Pearson correlation of 0.53** with expert word scores, which matches the published GOPT model. Regenerating a flagged word lifted its detector score from **4.6–6.1 to 9.0–9.95**.

The measurements also show where things break:

- **Pronunciation on free speech.** Whisper usually turns a badly mispronounced word into a *different real word* ("end of the road" → "end of the load"), so the detector never sees the error. An LLM "did you mean?" pass to recover the intended word was net-neutral (mean WER **0.133 → 0.133**).
- **Neural tone restyling.** It moved real voices too far: speaker similarity fell to **0.72** for "calm".
- **Accent.** Tencent's AuK "de-accent" kept the words and the voice but did not move an accent classifier at all (native probability **0.23 → 0.24**).

The recommendation:

- Ship grammar and pronunciation as suggest–preview–accept edits spliced into the original.
- Ship tone as pitch-and-timing presets that cannot change words or identity, with neural restyling as an optional take.
- Present English de-accenting as a measured negative result, not a feature.

The defensible novelty claim is narrow. **No published system was found that speaks a grammar correction back in the learner's own voice inside the original recording.** All spoken grammar-correction research outputs text.

## Two of four features already work on real L2 speech

Every measurement below comes from one rented A100-80GB pod ($1.39/hr). It ran the ReSpeak app:

- Whisper large-v3-turbo with a wav2vec2 CTC forced aligner;
- Qwen3.6-35B-A3B on vLLM;
- PlayDiffusion and F5-TTS editors;
- AuK-Flash for tone takes.

All test audio was real human speech:

- **speechocean762**: Mandarin-L1 learners reading English, with expert word and phone scores.
- **EdAcc**: Zoom conversations across many first languages, with human transcripts.

L2-ARCTIC was not used, because its download is gated behind a licence form ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)). These are small engineering samples of 8–40 utterances per test, not benchmarks. The scorecard below grades each feature by what the prototype measured, not by what papers claim.

| Feature | Verdict | Strongest real-speech evidence (measured) | Main failure mode | Demo role |
|---|---|---|---|---|
| Grammar fix in own voice | **Works as a suggestion** | 8/8 fixes ASR-verified on EdAcc L2 speakers, 2.3–6.2 s each | The LLM sometimes proposes a wrong fix ("like as child"); false-correction rate on native speech not yet measured | Main act |
| Mispronounced-word detection | **Works on scripted speech, weak on free speech** | AUC 0.88, PCC 0.53 vs experts (speechocean762 test, 15,967 words) | Whisper rewrites the mispronounced word into another real word | Second act |
| Mispronounced-word fix | **Works once a word is flagged** | 4 regenerated words: 4.6–6.1 → 9.0–9.95 detector score, 2.6–4.9 s | The detector is a biased judge of synthetic audio; no listening test yet | Second act |
| "Did you mean…?" recovery | **Experimental** | Mean WER 0.133 → 0.133 (3 better, 3 worse) on 40 utterances | Ambiguous context; guesses wrong words | Confirm-only |
| Tone, pitch/timing presets | **Works mechanically, not yet validated by listeners** | 0.1 s on CPU; words and voice untouched by construction | Effect may be subtle; "warm" has weak grounding | Third act |
| Tone, neural restyle (AuK) | **Experimental** | Speaker similarity 0.72 (calm), 0.86 (confident) on 9 real speakers | Voice drift on real recordings | Optional alternate take |
| English de-accent | **Does not work** | Accent-ID native probability 0.23 → 0.24 | No released model is trained for English de-accenting | Negative-result slide |

*(Source for all rows: [hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>).)*

Every feature that works shares one design: generate only the changed words, splice them into the untouched original, and verify by re-transcription. Earlier tests in the same project explain why the splice matters. PlayDiffusion re-vocodes the whole clip, and its raw output drifted to a speaker similarity of **0.733**. Splicing only the new phrase into the original raised whole-clip similarity to **0.976**. Replacing Whisper's word timestamps with forced alignment fixed most garbled or clipped edits ([round-1 hands-on notes](<C:/Users/ingor/respeak/research_notes/ReSpeak voice editing feasibility/hands_on_experiments.md>)). The two features that fail are the ones that must change the *whole* signal: neural tone restyling and accent conversion. Splicing cannot protect identity there.

## Grammar fixes render in the speaker's voice 8 of 8 times

### Spoken grammar correction is a young field with low precision

Spoken grammatical error correction (spoken GEC) is far less mature than its written counterpart. That gap shapes how ReSpeak should present it.

The Speak & Improve Challenge 2025 was the first shared task on spoken GEC, and **only one team entered** the correction tracks. The best open-track system reached a corrected-transcript WER of **14.44**, against a baseline of 17.77. Its error-feedback F0.5 was **0.374**, against a baseline of 0.221 ([S&I Challenge 2025](https://www.isca-archive.org/slate_2025/qian25_slate.pdf)). Cambridge's end-to-end Whisper system is the strongest published result. It reaches F0.5 **45.22** on the S&I evaluation set (precision 57.35, recall 24.50), and only after filtering edits by confidence ([Qian et al. 2025](https://arxiv.org/html/2506.18532)). A tuned LLM on *written* learner English reaches **78.32** on BEA-2019 ([Karpo & Chernodub 2026](https://arxiv.org/html/2609.10810v1)).

The dominant spoken failure mode is fake edits caused by recognition errors. In Cambridge's example, an ASR substitution of "rat" for "cat" produces a spurious "rat → cat" correction, which is "not [an] actual grammar error" ([Qian et al. 2025](https://arxiv.org/html/2506.18532)). For ReSpeak this is worse than a wrong text edit. The system would synthesise, in the speaker's voice, a correction to a word they never said.

Over-correction is the second risk. Vanilla LLM prompts push precision "often below 45" on BEA-2019. An explicit "Make MINIMAL, PRECISE edits … DO NOT rewrite or paraphrase" instruction raises F0.5 by up to 10.9 points but costs 6–22 points of recall. Batching sentences lifted the share left unchanged from **43.8% to 80.7%** for Qwen3-8B ([Karpo & Chernodub 2026](https://arxiv.org/html/2609.10810v1)). Sampling several corrections and keeping only majority edits beats greedy decoding on most of nine benchmarks ([Goto et al. 2026](https://arxiv.org/abs/2605.13624)).

Spontaneous speech adds a trap specific to voice. When crowdworkers were asked to minimally correct spoken transcripts, they edited **native speakers almost as much as learners**: 18.9% vs 23.9% edit rate. Most native "corrections" fell into the catch-all "other" category, which covers disfluencies and spoken-grammar norms, rather than real morphosyntax ([Caines et al. 2020](https://aclanthology.org/2020.coling-main.195.pdf)).

### The prototype's design follows the literature

The prototype already makes the right choices on what to correct. Its prompt restricts edits to a whitelist:

- subject–verb agreement;
- verb form and tense;
- articles and prepositions;
- noun number and pronoun case;
- word order.

It allows casual native forms such as "gonna", "me and him went" and "there's two", and it tells the model "if unsure, do not fix". Every fix must include an original anchor word, so an insertion ("go store" → "go to the store") becomes a substitution over a real time span. Fixes at most one word apart merge into one span, so that "don't know where the files is" is regenerated as a single prosodic phrase ([brain.py](<C:/Users/ingor/respeak/app/brain.py>)).

Grammar runs only on words that survived the disfluency cleanup ([app.py](<C:/Users/ingor/respeak/app/app.py>)). That matches the Cambridge order of operations: verbatim ASR, then disfluency removal, then GEC on the fluent text, then mapping the edits back to word timestamps ([S&I Challenge 2025](https://www.isca-archive.org/slate_2025/qian25_slate.pdf)).

Merging nearby fixes into one span is the right call. dots.tts.edit's authors report that performance "remains unstable when multiple regions within a short utterance are edited". On their benchmark, all operations succeeded together in only **30.00%** of 2–4-operation instructions ([dots.tts.edit](https://arxiv.org/html/2608.02673v2)). ReSpeak instead edits each span separately and splices it into the bit-exact original, so errors cannot accumulate across edits.

### Measured results on EdAcc

The 8 EdAcc test utterances came from speakers with Mandarin, Bulgarian, Sinhalese, Spanish, Catalan and Lithuanian as their first language. **All 8 fixes were verified by ASR, at 2.3–6.2 s per fix** ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)):

| Speaker said | Rendered in own voice | Correct? |
|---|---|---|
| "do you plan to stay … for after graduate" | "graduation" | Yes |
| "it does not have subway" | "a subway" | Yes |
| "thank you very much for the advices" | "advice" | Yes |
| "go to mountains" | "the mountains" | Yes |
| "go to Maldives" | "the Maldives" | Yes |
| "not even interested about" | "interested in" | Yes |
| "at first I didn't got it" | "didn't get" | Yes |
| "a particular food you used to like a child" | "like as child" | **No**: should be "as a child" |

### What the 8/8 does not prove

Three properties of the test harness limit what the 8/8 means; all three are visible in the code.

First, the test script kept only EdAcc utterances where the same grammar prompt had already found an error in the human transcript ([real_tests.py](<C:/Users/ingor/respeak/lab/real_tests.py>)). The 8/8 therefore measures **rendering reliability**, not detection precision or recall. One of eight proposed fixes was linguistically wrong, and that wrong fix was rendered faithfully.

Second, the "verified" check tests whether the target string appears inside Whisper's re-transcription, after spaces are stripped ([app.py](<C:/Users/ingor/respeak/app/app.py>)). That check cannot catch a deletion-type fix that failed. "advice" is a substring of "advices", so that fix would pass even if the old word were still audible. A Whisper-class recogniser can also normalise toward standard grammar and "hear" the corrected form. The research notes flag this risk as untested ([spoken GEC notes](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/spoken_grammar_correction.md>)).

Third, nobody has yet measured the **false-correction rate on native speech**, speaker similarity of the inserts, or naturalness by ear.

None of these weakens the core finding: own-voice spoken grammar correction runs end to end in seconds on real L2 audio. They do determine what can be claimed.

### No published system speaks the correction back

On novelty, every spoken-GEC system found outputs text: the Cambridge end-to-end models, the S&I systems, and the 2026 pedagogical-feedback work ([Qian et al. 2025](https://arxiv.org/abs/2506.18532); [Liang et al. 2026](https://arxiv.org/abs/2604.14177)). The closest prior art is own-voice *mispronunciation* correction. Its authors found that keeping the learner's voice "was found to be a critical factor in providing effective feedback" ([arXiv 2204.03379](https://arxiv.org/pdf/2204.03379)). The CHI 2026 AI Twin study replayed a more fluent rephrasing in the learner's own voice. It produced higher emotional engagement than explicit correction (n=20) ([AI Twin](https://arxiv.org/abs/2601.11103)).

The novelty claim rests on two targeted searches. Commercial language-learning apps such as ELSA, Speak and Duolingo were not checked, so "to our knowledge" is the correct hedge.

## Pronunciation repair works once the word is found, but Whisper hides the worst errors

### The detector matches GOPT on scripted speech

The prototype's detector stacks open components. Phoneme posteriors come from `facebook/wav2vec2-lv-60-espeak-cv-ft`, and canonical phones from espeak G2P. Two per-phone scores are computed:

- the CTC peak posterior along the forced alignment;
- an alignment-free goodness-of-pronunciation (GOP) score from a single batched CTC-loss call.

These are z-normalised per phone against words that experts rated as good. A small gradient-boosting regressor is trained on the **15,849 words** of speechocean762 TRAIN to predict expert word accuracy. On the **15,967 test words**, 7.6% of them rated 5/10 or lower, it scored ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)):

| Detector (speechocean762 test) | PCC with expert word accuracy | AUC (acc ≤ 5) | AUC (acc ≤ 7) | AUC (any annotated error) |
|---|---|---|---|---|
| Training-free alignment-free GOP, min over phones | 0.18 | 0.73 | 0.68 | 0.76 |
| Training-free CTC peak posterior | 0.22 | 0.77 | 0.74 | 0.76 |
| Per-phone z-normalised GOP | 0.32 | 0.80 | – | 0.83 |
| **Trained detector (GOP features + GBT)** | **0.53** | **0.88** | **0.87** | **0.91** |

*(measured; the training-free rows used a 300-utterance subset)*

The trained detector's word-accuracy PCC of 0.53 equals GOPT's published **0.533** ([GOPT](https://github.com/YuanGongND/gopt)). It trails 3MH at **0.682** ([arXiv 2509.02915](https://arxiv.org/html/2509.02915v1)), and Azure Pronunciation Assessment at **0.62** and HMamba at about **0.71** ([arXiv 2509.15701](https://arxiv.org/html/2509.15701v1)). The training-free rows agree with the literature. Logit-based GOP on the same family of espeak checkpoint gives phone-level AUC of **0.715–0.763** on speechocean762 ([Parikh et al. 2025](https://arxiv.org/html/2506.12067)).

The detector has a commercial advantage over the rest of the stack. The phoneme model is Apache-2.0 and the training data is Apache-2.0 on Hugging Face and CC BY 4.0 on OpenSLR, so it is licence-clean ([HF speechocean762](https://huggingface.co/datasets/mispeech/speechocean762); [OpenSLR 101](https://www.openslr.org/101/)). The strongest open alternatives are trained on L2-ARCTIC, which is CC BY-NC ([L2-ARCTIC](https://psi.engr.tamu.edu/l2-arctic-corpus/)).

### Precision forces a conservative threshold

Precision decides the product design. Flagging the lowest **2%** of words yields **69% precision** for words experts scored ≤5, at 18% recall. The lowest 5% gives 56% / 36%, and the lowest 10% gives 42% / 54% ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)). Even at the strictest setting, roughly one flag in three lands on a word experts scored above 5/10.

The app therefore uses a conservative threshold of 6.8 predicted accuracy. It skips function words, words under three letters, capitalised mid-sentence names and words already cut ([app.py](<C:/Users/ingor/respeak/app/app.py>)). The literature supports both choices. Short function words are routinely reduced in fluent speech, and G2P is unreliable on names. Kyriakopoulos, Knill and Gales distinguish two kinds of error in spontaneous non-native speech ([Interspeech 2020](https://www.isca-archive.org/interspeech_2020/kyriakopoulos20_interspeech.html)):

- **lexical** errors, where the speaker does not know a word's pronunciation; these are worth fixing;
- systematic **accent** patterns, which are not errors.

Munro and Derwing's separation of accentedness from intelligibility underpins the "intelligibility principle" in pronunciation teaching ([Levis 2020](https://www.jbe-platform.com/content/journals/10.1075/jslp.20050.lev)).

### Measured repairs in the speaker's own voice

The repair step re-says the *same* word. The prototype masks the word and regenerates it with F5-TTS mel infilling and with PlayDiffusion, after swapping the target word for a dummy token so that PlayDiffusion's diff-based inpainter actually regenerates it. It splices the result back, re-scores it with the detector, re-transcribes it, and retries with new seeds up to three times.

The test set was 12 adult speechocean762 utterances, each with at least one word that experts scored 4/10 or lower ([real_tests.py](<C:/Users/ingor/respeak/lab/real_tests.py>)). Running on Whisper's transcript rather than the script, the app flagged 6 words. Every fix took **2.6–4.9 s** and was ASR-verified ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)):

| Word | Expert score | Detector before → after |
|---|---|---|
| "relatively" | 3/10 | 6.1 → **9.75** |
| "love" | 3/10 | 5.7 → **9.8** |
| "morning" | 5/10 | 4.6 → **9.95** |
| "will" | not reported | 5.8 → **9.0** |
| "much", "Thanks" | **10/10** (false alarms) | – |

Two caveats apply. The detector is a biased judge here, because it rewards the clean, canonical phones that synthesis produces. And the before/after scores do not show that a listener hears a natural, same-voice word.

Research supports the idea behind the feature. Masked Acoustic Unit infilling regenerated only the error region and "retains the style of the speaker" ([arXiv 2108.05517](https://arxiv.org/html/2108.05517v2)). CorrectSpeech chained recognition, alignment and regeneration ([arXiv 2204.05460](https://arxiv.org/abs/2204.05460)). Neither released code. One limitation persists into ReSpeak: no current open editor takes English phoneme or IPA input. dots.tts.edit has no phoneme tag, so a regenerated word is only as correct as the editor's text front end ([HF dots.tts.edit](https://huggingface.co/dots-studio/dots.tts.edit)).

### Whisper hides the worst errors

The most important pronunciation finding concerns ASR, not the detector. On real learners, Whisper usually transcribed a badly mispronounced word as a **different real word** ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)):

- "the ball is in their court" → "The bear is in there counter"
- "end of the road" → "End of the load"
- "better games" → "battle games"
- "my heart" → "may hurt"
- "streets were relatively calm" → "stress will relatively climb"

The detector then compares the audio against the wrong canonical word, finds a decent match, and stays silent. Azure's assessment shows the same blind spot: a learner who said "they" for "there" got a high score and no flag ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/1829233)).

This explains the gap between the two test conditions. The 0.88 AUC was measured with the *script* as reference ([eval_pron.py](<C:/Users/ingor/respeak/lab/eval_pron.py>)). In free-speech mode the 12 test utterances held at least 12 words that experts scored 4/10 or lower, and the app flagged only 2 of them ("relatively" and "love"). Low recall, on the order of one badly mispronounced word in five or six, is the fair expectation for voice messages until a second signal is added. The inspected examples suggest Whisper's substitutions are common, but their frequency has not been quantified.

### The "did you mean" pass is net-neutral

The prototype's second signal is an LLM "did you mean?" pass. Words with Whisper confidence below 0.6 are marked `(?)`, and the LLM writes the sentence the speaker most likely intended. Code keeps only substitutions of up to three words whose phonemes are close to the heard words (normalised phone edit distance ≤ 0.6). Accepted suggestions are regenerated in the speaker's voice.

On 40 moderate learner utterances, the version with confidence marks made 8 suggestions:

- 3 helped: "battle → better", "load → road" and "contents → contest".
- 3 hurt, and mean WER against the intended text stayed at **0.133 → 0.133**.
- Wrong guesses included "Grated → Grateful" (the speaker meant "Create") and "Chats → Chat" (meant "Cheers").

([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>))

The number is also optimistic. The current prompt's worked examples are "our battle(?) games → our better games", "for United from(?) → for a united front", and "load" for "road" ([brain.py](<C:/Users/ingor/respeak/app/brain.py>)). These come from the same speechocean762 pool the evaluation drew on, so two of the three wins were partly handed to the model. Even with that help the pass broke even. It belongs in the UI as a question the user answers ("Did you mean *road*?"), never as an automatic edit.

## Pitch and timing beat neural restyling on real voices

### Neural style editors fail most of the time

Tone is where published models look strongest on paper and weakest on real recordings.

No released editor lists "confident", "professional" or "apologetic" as a native label. Step-Audio-EditX comes closest, with "authority", "serious", "warm" and "gentle" among its 32 styles ([Step-Audio-EditX](https://github.com/stepfun-ai/Step-Audio-EditX)). AuK supports 8 emotions, including "calm". The AuK authors concede that native free-form instruction following "did not produce sufficiently robust generalization to arbitrary user requests" ([AuK report](https://arxiv.org/html/2609.08936)).

The independent SpeechEditBench scores *joint* success, meaning the style changed **and** the words survived. On that measure the best open model reaches **7.71% for emotion** and **49.67% for style** (Step-Audio-EditX). Closed Gemini-Live reaches 27.79% for emotion ([SpeechEditBench](https://arxiv.org/html/2606.01804)). dots.tts.edit's emotion edits score **33.17%** under its own judge, but unedited source audio already scores **20.43%** under that judge. Its speaker similarity drops to **0.649** for emotion edits, against 0.869 for pure prosody edits ([dots.tts.edit](https://arxiv.org/html/2608.02673)). Step-Audio-EditX's self-reported 66–74% figures come entirely from cloned synthetic voices: "All evaluation audio is generated via zero-shot voice cloning" ([Step-Audio-EditX report](https://arxiv.org/html/2511.03601)).

### Measured on real speakers, AuK moved the voice

The prototype confirms that the gap between synthetic and real audio matters. On 9 real speakers from EdAcc and speechocean762, AuK-Flash's "calm" kept the words: mean WER was 0.24, against 0.21 for the original. But speaker similarity fell to **0.72**. On the clean synthetic test voice used earlier, similarity had been 0.89. A free-form "confident and assertive" instruction kept similarity at **0.86** and WER at 0.23, but its effect on pitch was inconsistent ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)).

Restyling only a selected region works mechanically in 0.8 s. The app crops the selection with 1 s of context, edits the crop at the same length, and splices the selection back. However, the code marks these region restyles as `verified=True` without any WER or similarity check ([app.py](<C:/Users/ingor/respeak/app/app.py>)). The tone menu also maps "serious" to the instruction "Change the emotion to sad", which needs fixing before a demo.

### Pitch-and-timing presets change only delivery

The response to these failures is the prototype's most product-ready tone idea. The "natural" presets use Praat PSOLA to change only pitch and timing. No neural model touches the audio, so the words and the voice are the speaker's by construction ([prosody.py](<C:/Users/ingor/respeak/app/prosody.py>)):

| Preset | Pitch | Timing | Phrase endings |
|---|---|---|---|
| Confident | ~1 semitone lower | 7% faster | Rising endings replaced by a gentle fall |
| Calm | Range compressed 30% | 5% slower | Gentle fall |
| Warm | 4% higher (~0.7 semitone) | Unchanged | Range expanded 15% |

A preset runs in **0.1 s on CPU**. On one real speaker, Confident shortened a message from **4.24 s to 3.96 s** and lowered median F0 from **106 to 100 Hz** ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)).

The Confident preset rests on solid evidence. A review of vocal-confidence research reports four findings ([Guyer et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8553728)):

- Speakers asked to sound confident "naturally spoke louder, faster, and with fewer pauses".
- Digitally lowered pitch "elicited significantly higher ratings of speaker confidence than high pitch".
- Listeners rate falling intonation as more confident.
- Rising intonation is used about twice as often for incorrect answers.

Reverse-correlation work with the open CLEESE tool found that a gradual pitch fall signals dominance. Applying that contour to new utterances "significantly increased perceived dominance" ([Ponsot et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5899438)). The DAVID real-time voice transformer produced emotional transformations recognised above chance in four languages, "with a naturalness comparable to natural speech" ([Rachman et al. 2018](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5809549/)).

"Warm" is the weakest preset. The only nearby evidence is Ponsot's trustworthiness prototype: a quick pitch rise on the second syllable plus a moderate rise in mean pitch. That prototype generalised poorly. One gap against the literature is visible in the code: the presets renormalise loudness to the original, although confident speakers are reliably louder. A +1–2 dB gain for Confident is a design suggestion, not a measured value. No listener has rated any preset yet.

### Evaluation must compare A/B with identical words

Evaluating tone has a known trap. Audio LLMs used as judges lean on the words: with neutral wording they default to "neutral", and on paralinguistic cues alone they are "close to chance" ([Chen et al. 2025](https://arxiv.org/abs/2510.10444)). ReSpeak keeps the words identical, so the useful test is a pairwise one: "Which of A/B sounds more confident? Both say the same words", run in both orders. Gemini's agreement with humans on speaking-style judgments is "in the same range as agreement between human evaluators" ([Chiang et al. 2025](https://arxiv.org/html/2506.05984v1)). The judge result should be paired with interpretable deltas on the original vs the edited clip:

- speaking rate;
- median F0 in semitones;
- F0 range;
- slope at the end of each phrase;
- pause time.

## English de-accenting has no working open model today

### AuK changed nothing measurable

The prototype tested the one plausible candidate directly. AuK-Flash was given its built-in instruction ("Remove the regional accent while preserving the speaker's voice and content") and a free-form "native American English" instruction, on the same 9 real speakers. It preserved words (WER **0.22 / 0.20** vs 0.21 original) and voice (similarity **0.93 / 0.90**). It produced **no measurable accent change**. The CommonAccent ECAPA accent-ID "native" probability moved from **0.23 to 0.24**, and the top label stayed the same for most speakers ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)).

The measuring instrument is coarse. CommonAccent's 16 classes are national varieties such as "us", "england" and "indian", with no Mandarin-L1 or Bulgarian-L1 class ([CommonAccent card](https://huggingface.co/Jzuluaga/accent-id-commonaccent_ecapa)). The script summed "us", "canada" and "england" into "native" ([accent_eval.py](<C:/Users/ingor/respeak/lab/accent_eval.py>)), and no codec-reconstruction control was run. A small real effect could hide under that noise.

The null result still matches the source. AuK's paper states that "our de-accenting supervision covers Chinese dialects and regional accents only". The claim that it "can reduce accents in English speech" is qualitative, with no numbers ([AuK report](https://arxiv.org/html/2609.08936)). The high similarity is itself a warning sign. Speaker embeddings partly encode accent, and every system that genuinely changes accent shows similarity falling as nativeness rises.

### Systems that work have no released weights

The systems with real English results are all out of reach for a hackathon:

| System | English result | Identity cost | Availability |
|---|---|---|---|
| FAC-FACodec (ICASSP 2026) | P(American) **70.5% → 89.9%** as a strength knob rises; WER 0.05 → 0.15 on L2-ARCTIC | Similarity **0.98 → 0.88** | Demo page only, no weights ([arXiv 2510.10785](https://arxiv.org/html/2510.10785v2)) |
| Convert-and-Speak (MM 2024) | **74.3%** of listeners chose "American", vs 0.5% for the source | Similarity **0.641 → 0.438**; prosody re-synthesised | Demo only ([arXiv 2408.10096](https://arxiv.org/html/2408.10096v2)) |
| Vevo-Style (ICLR 2025) | Converts toward a reference accent clip | Timing regenerated | Weights CC-BY-NC-4.0; needs a target-accent reference ([HF amphion/Vevo](https://huggingface.co/amphion/Vevo)) |
| Texas A&M zero-shot FAC (2022) | Accentedness down **67%** | **80%** of listeners judged it the same voice | Paper only ([Quamer et al. 2022](https://psi.engr.tamu.edu/wp-content/uploads/2023/02/quamer2022interspeech.pdf)) |

The Texas A&M line sets the realistic ceiling. Even good accent conversion leaves **20–27% of listeners** judging the output a different person ([Zhao et al. 2021](https://psi.engr.tamu.edu/wp-content/uploads/2021/08/zhao2021reference.pdf); [Quamer et al. 2022](https://psi.engr.tamu.edu/wp-content/uploads/2023/02/quamer2022interspeech.pdf)).

### The ethical risk is real, and per-word repair is the honest substitute

Product framing carries its own risk. Sanas sells real-time conversion of accents to "neutral" US or UK English. Critics called it racist "digital whitening", and the Markkula Center's Don Heider said it "does not counteract the bias, it feeds into and reaffirms that basically everyone should speak in a particular way" ([Markkula Center](https://scu.edu/ethics/media-mentions/stories/silicon-valley-startup-sparks-controversy-over-what-critics-call-racist-software.html)). Krisp's 2026 answer moves the conversion to the listener's side, so that only the agent hears an adapted voice ([CX Today](https://www.cxtoday.com/contact-center/krisp-customer-accent-conversion-contact-centers/)).

ReSpeak already has a more defensible version of "sound clearer": the per-word pronunciation repair above. It fixes lexical errors that hurt intelligibility, leaves the accent intact, and keeps the speaker sounding like themselves. A regenerated word picks up the surrounding accent from context. That is arguably desirable, because a native-accent island inside an accented message would sound spliced in. The "golden speaker" framing, hearing one's own voice with native-like pronunciation, remains a legitimate *practice* feature for later ([Ding et al. 2019](https://psi.engr.tamu.edu/wp-content/uploads/2019/11/1-s2.0-S0167639319302675-main.pdf)). It is not something to apply silently to outgoing messages.

## Free real speech covers every feature except labelled spoken grammar

Each feature can be tested today on real human recordings. The only gap is a corpus with *naturally occurring grammatical errors and corrected transcripts* that downloads without a form. The **Speak & Improve Corpus 2025** is the only one found. It has about 315 h of L2 audio and about 55 h of manual transcripts with corrections. It requires a registration form and carries strict terms ([Cambridge dataset page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)):

- non-commercial research and education only;
- no redistribution, including on Hugging Face or GitHub;
- no release of derived models or statistics without approval;
- LLM processing only with local models or no-retention APIs.

ReSpeak's self-hosted Qwen satisfies the last condition.

| Feature | Best freely available real speech | Licence and access | What it measures |
|---|---|---|---|
| Grammar in own voice | **EdAcc** L2 speakers (filter on `l1`) | CC BY-SA 4.0, ungated on HF ([EdAcc](https://huggingface.co/datasets/edinburghcstr/edacc)) | Real errors in Zoom-quality conversation; needs hand-written corrections for 30–50 utterances |
| Grammar precision (gold) | **Speak & Improve 2025** Dev split, 438 submissions | Form; non-commercial; no redistribution ([Cambridge](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)) | ERRANT F0.5 of ReSpeak's suggestions against human corrections |
| Grammar false corrections | **EdAcc** native speakers; **AMI** meetings | CC BY-SA 4.0; CC BY 4.0, ungated ([AMI](https://huggingface.co/datasets/edinburghcstr/ami)) | Every suggestion on native casual speech is a candidate false positive |
| Mispronunciation | **speechocean762** (5,000 utterances, expert word and phone scores) | Apache-2.0 on HF, ungated; CC BY 4.0 on OpenSLR ([HF](https://huggingface.co/datasets/mispeech/speechocean762)) | Detector AUC/PCC; before/after repair |
| Mispronunciation, other L1s and unscripted | **L2-ARCTIC** v5 incl. "suitcase" spontaneous subset | CC BY-NC 4.0, licence form ([TAMU](https://psi.engr.tamu.edu/l2-arctic-corpus/)) | Transfer beyond Mandarin L1; free-speech detection |
| Accent vs native reference | **L2-ARCTIC + CMU ARCTIC** (same prompts) | Form (L2-ARCTIC); CMU ARCTIC direct download ([festvox](http://festvox.org/cmu_arctic/packed/cmu_us_bdl_arctic.tar.bz2)) | ΔP(native), WER and similarity per sentence against a native ceiling |
| Accent, broad coverage | **VoxPopuli en_accented** (29 h, 15 L2 accents); EdAcc | CC0, ungated ([HF VoxPopuli](https://huggingface.co/datasets/facebook/voxpopuli)) | Accent-ID shift across many L1s |
| Tone sources and targets | **Expresso** (calm, projected, sympathetic, enunciated; same speakers) | CC BY-NC 4.0; HF `read` config ungated ([Expresso](https://speechbot.github.io/expresso/)) | Natural same-speaker style references for pairwise judging |
| Tone, emotion range | **RAVDESS** (208.5 MB zip); **EARS** (fast/slow/low-pitch reading styles) | CC BY-NC-SA 4.0; CC BY-NC 4.0, direct download ([RAVDESS](https://zenodo.org/api/records/1188976); [EARS](https://github.com/facebookresearch/ears_dataset)) | Classifier and judge sensitivity with words held constant |

([dataset notes](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/real_speech_datasets.md>))

Two cautions apply. Ungated unofficial mirrors of L2-ARCTIC exist on Hugging Face, but their uploaders may lack redistribution rights. The user, not an agent, should decide whether to use them ([dataset notes](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/real_speech_datasets.md>)). No public dataset carries "confident", "professional" or "apologetic" delivery labels, so those styles can only be validated by ReSpeak's own A/B listening tests.

The cleanest demo audio is the team's own recordings. Consenting teammates can read the canonical error sentences ("She don't know where the files is", "love I this song") with no licence questions at all.

## Build order, demo script and claims judges can check

### Build order

The implementation plan follows the evidence. Make the two working features trustworthy, make the safe tone feature perceptible, and turn accent into an honest result. Effort figures are estimates for a team that already has the prototype, not measurements.

| Priority | Task | Est. effort | Why |
|---|---|---|---|
| P0 | Replace the substring check with an exact-token check: force-align the new ASR output and compare the target token's alignment score with the original token's (e.g. "advice" vs "advices"), or run ERRANT between the original and the re-transcribed text and require exactly the planned edit | 2 h | The current check passes failed deletion-type fixes |
| P0 | Run the grammar pass over ~50 native EdAcc/AMI utterances and count suggestions; tune toward zero | 1–2 h | False corrections on natives are the top trust risk ([Caines et al. 2020](https://aclanthology.org/2020.coling-main.195.pdf)) |
| P0 | Suppress grammar edits that touch words with Whisper probability < 0.6 | 1 h | ASR errors become fake grammar edits ([Qian et al. 2025](https://arxiv.org/html/2506.18532)) |
| P0 | Record teammates reading error sentences, plus one non-native teammate speaking freely | 1–2 h | Licence-free live demo audio |
| P1 | Majority vote over 3 grammar samples; keep only edits proposed at least twice | 1 h | Training-free precision gain ([Goto et al. 2026](https://arxiv.org/abs/2605.13624)) |
| P1 | Remove the speechocean762 examples from the intent prompt; re-run on held-out utterances | 1 h | Current result is contaminated |
| P1 | Region support for natural presets (crop, PSOLA, splice) and +1–2 dB for Confident; fix "serious → sad"; add WER and similarity gates to AuK region takes | 2 h | Presets currently apply to the whole message only |
| P1 | 10-listener ABX test (BeaqleJS): grammar and pronunciation inserts ("which clip was edited?"), plus pairwise "which sounds more confident?" for presets | 3 h | Every quality claim so far is machine-judged ([BeaqleJS](https://github.com/jfsantos/beaqlejs)) |
| P2 | Submit the Speak & Improve form; score suggestions with ERRANT F0.5 on Dev using the local LLM only | form + 3 h | The only gold-standard precision number available |
| P2 | Accent: hide the AuK "native" button or label it "experimental, no measurable effect in our tests" | 0.5 h | Avoid an unsupported claim |

### Demo script

The demo should run grammar first, because it is the most novel and the most reliable. Pronunciation follows, then tone, and accent appears only as a measured negative result.

| Time | Beat | Live vs fallback | What to say |
|---|---|---|---|
| 0:00–0:40 | Teammate records "Yesterday I go to the store, she don't know where the files is"; **Grammar** underlines two spans; accept; the clip plays with purple AI regions | Live; fallback: EdAcc "for the advices" clip (CC BY-SA, attributed) | "Only the corrected words are generated, in your voice. Everything else is your real recording." |
| 0:40–1:20 | Real learner clip from speechocean762: "relatively" flagged; **Polish word**; before/after playback; detector 6.1 → 9.75 | Pre-loaded real clip (Apache-2.0) | "We flag few words on purpose. Even then, about a third of flags hit words experts found passable, so you decide." |
| 1:20–1:40 | "End of the load" shows a "Did you mean *road*?" chip; the user taps yes | Pre-loaded clip | "When recognition hears a different word, we ask. We never guess silently." |
| 1:40–2:10 | Select the last sentence, choose **Confident**; A/B with duration and F0 shown (e.g. 4.24 → 3.96 s, 106 → 100 Hz) | Live | "Same words, same voice. We changed only pitch and timing." |
| 2:10–2:30 | Slide: de-accent on 9 real speakers; accent-ID 0.23 → 0.24 | Slide | "We tested accent removal. It doesn't work for English yet, so we don't ship it." |
| 2:30–2:45 | Send; the chat badge reads "2 AI-voiced words · 1 pitch-adjusted sentence" | Live | "The listener knows what changed." |

The pod needs about **75 GB of the A100's 80 GB** with every model loaded, so dots.tts.edit stays off. The pod's SSH dropped once during testing, so cached results for every beat are mandatory ([hands-on round 2](<C:/Users/ingor/respeak/research_notes/ReSpeak grammar pronunciation and accent/hands_on_round2.md>)).

### Claims judges can check

| Honest to claim | Do not claim |
|---|---|
| "To our knowledge, no published system speaks a grammar correction back in the learner's own voice inside the original recording; all spoken-GEC research outputs text." | "First ever" without the hedge (language-learning apps were not searched) |
| "8 of 8 proposed grammar fixes rendered and verified on real non-native conversation, in 2–6 s each." | "Corrects your grammar accurately." (One of the 8 fixes was wrong; precision and false-correction rate are unmeasured) |
| "Our pronunciation detector matches the published GOPT model on speechocean762 (PCC 0.53, AUC 0.88), trained only on commercially licensed data." | "Detects your mispronunciations." (On free speech it caught 2 of at least 12 badly mispronounced words, because ASR hears a different word) |
| "A flagged word is regenerated in your voice in 3–5 s and scores as well pronounced afterwards." | "Native pronunciation." (Scored by our own detector; no listening test yet) |
| "Confident, Calm and Warm change only pitch and timing, so your words and voice cannot change." | "AI makes you sound confident." (Not validated with listeners) |
| "We tested English accent removal on 9 real speakers and measured no effect." | "Removes your accent." |

## Conclusion

The four features split cleanly along one line: whether the edit can be confined to a few words. Grammar and pronunciation fixes touch one span, splice it into the untouched original and can be checked by re-transcription, so they inherit the reliability of the cut-and-splice architecture. Tone and accent change the whole signal, and there identity erodes or nothing changes. The cheapest tone method, ordinary PSOLA, beat the newest neural editors on the property that matters most for a voice message: still sounding like the sender.

The binding constraint has moved from generation to recognition. The speech editors render corrections well. The open questions are upstream: whether the recogniser heard what was said, whether the LLM's fix is right, and whether a native speaker's casual grammar gets "fixed". The next gains will come from a verbatim, confidence-aware ASR pass, majority-voted minimal edits, and one honest precision number on the Speak & Improve corpus, not from a better voice model. Showing judges a measured failure, such as de-accenting at 0.23 → 0.24, is cheap evidence that the other numbers are real.
