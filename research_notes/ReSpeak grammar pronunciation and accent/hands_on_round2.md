# Hands-on round 2: grammar, pronunciation, tone, accent on REAL human voices (2026-10-17/18)

Same pod as round 1 (`zaa3ajj8o85hhq`, A100 80 GB, $1.39/hr). All test audio in this round is real human speech:
- **speechocean762** (HF `mispeech/speechocean762`, Apache-2.0 on HF / CC BY 4.0 on OpenSLR; Mandarin-L1 learners reading English; expert word and phone accuracy labels). Downloaded directly, no gating.
- **EdAcc** (HF `edinburghcstr/edacc`, CC BY-SA 4.0; Zoom conversations, many L1s and accents, human verbatim transcripts). Downloaded directly.
- L2-ARCTIC is gated (needs the user to accept terms or fill a form), so it was not used.
Code: `C:\Users\ingor\respeak\app` (`pron.py`, `prosody.py`, `brain.py` intent/grammar, `app.py` endpoints `/pron`, `/intent`, `/replace` with `same`, `/tone` with region, `/natural`) and `C:\Users\ingor\respeak\lab` (`eval_pron.py`, `train_pron.py`, `eval_intent.py`, `real_tests.py`, `accent_gen.py`, `accent_eval.py`).

## 1. Mispronunciation detection (word level)
Pipeline: Whisper transcript gives the intended words → espeak G2P (phonemizer) canonical phones → `facebook/wav2vec2-lv-60-espeak-cv-ft` phoneme CTC posteriors → CTC forced alignment of the canonical phones → per-phone scores: (a) peak posterior, (b) an alignment-free GOP computed in one batched `ctc_loss` call (log-likelihood of the canonical phones minus the best single-phone substitution or deletion) → per-word features (min/mean of per-phone z-scores normalised with statistics from expert-rated-good training words, raw scores, edit distance between canonical and greedily decoded phones, phone count, frames per phone) → small gradient-boosting regressor trained on speechocean762 TRAIN (15,849 words) to predict expert word accuracy (0-10). Evaluated on speechocean762 TEST (15,967 words, 7.6 % rated <= 5).

| Detector | PCC with expert word accuracy | AUC (word acc <= 5) | AUC (word acc <= 7) | AUC (any annotated mispronunciation) |
|---|---|---|---|---|
| Training-free alignment-free GOP (min over phones), 300 utts | 0.18 | 0.73 | 0.68 | 0.76 |
| Training-free CTC peak posterior, 300 utts | 0.22 | 0.77 | 0.74 | 0.76 |
| Per-phone z-normalised GOP | 0.32 | 0.80 | - | 0.83 |
| **Trained detector (features above + GBT)** | **0.53** | **0.88** | **0.87** | **0.91** |

For comparison (published, from the research notes): GOPT 0.53, 3MH 0.68, HMamba ~0.71, Azure 0.62 word-accuracy PCC. Operating points of the trained detector: flag the lowest 2 % of words → 69 % precision (acc <= 5), 18 % recall; lowest 5 % → 56 % precision, 36 % recall; lowest 10 % → 42 % / 54 %. Speed ~60 ms per utterance on A100. In the app: threshold 6.8 predicted accuracy, skipping function words, words under 3 letters, mid-sentence capitalised names, and words already cut.

**Key real-speech finding:** on free speech, Whisper usually transcribes a badly mispronounced word as a DIFFERENT real word (speechocean762 examples: "the ball is in their court" → "The bear is in there counter", "end of the road" → "End of the load", "a united front" → "United from", "better games" → "battle games", "my heart" → "may hurt", "streets were relatively calm" → "stress will relatively climb"). The acoustic detector then compares against the wrong word and does not flag it. So pronunciation repair on free speech needs a second, context-based pass (below).

## 2. Fixing a mispronounced word in the speaker's own voice
Method: regenerate the SAME word with the in-context editors (F5-TTS mel infill; PlayDiffusion with the target word replaced by a dummy token in the input text so its diff-based inpainter regenerates it), splice only the word back into the original, re-score with the detector and re-transcribe; keep the best candidate; retry with new seeds (up to 3 rounds) if the recognizer does not hear the word.
Real speechocean762 results (12 adult utterances with expert-flagged words): the detector flagged 6 words; fixes took 2.6-4.9 s each and all were verified by ASR. Detector score before → after: "relatively" (expert 3/10) 6.1 → 9.75; "love" (expert 3/10) 5.7 → 9.8; "morning" (expert 5/10) 4.6 → 9.95; "will" 5.8 → 9.0. Two flags were false alarms (expert 10/10: "much", "Thanks"). Caveat: the detector scoring regenerated speech is a biased judge (it likes clean synthetic phones); a human listening test is still needed.

## 3. "Did you mean...?" — intended-word recovery (pronunciation errors that ASR turned into other words)
Method: the LLM (Qwen3.6-35B-A3B) gets the transcript with low-confidence words marked `(?)` (Whisper word probability < 0.6) and writes the sentence the speaker most likely intended; code diffs it against the transcript, keeps only word substitutions of <= 3 words, and keeps a substitution only if the phonemes of heard vs intended words are close (normalised phone edit distance <= 0.6). Accepted suggestions are regenerated in the speaker's voice.
Evaluation on 40 moderate speechocean762 learner utterances (expert sentence accuracy 5-7) against the known intended text (re-transcribing the edited audio):
- Without confidence marks: 5 suggestions; mean WER vs intended text 0.133 → 0.129 (2 better, 2 worse). "End of the **load** for summon players" → "road": utterance WER 0.29 → 0.00.
- With confidence marks: 8 suggestions; mean WER 0.133 → 0.133 (3 better, 3 worse). Wins: "battle → better" (0.14 → 0.00), "load → road" (0.29 → 0.14), "contents → contest". Misses or wrong guesses: "Grated → Grateful" (meant "Create"), "Chats → Chat" (meant "Cheers"), "from → front" (heard worse after edit). Two "wrong" edits changed odd speechocean762 prompt text that the speaker had read literally ("give you a call them" → "then", "thanks god" → "thank").
- Conclusion: works when the context makes the intended word clear; ambiguous cases need the user to confirm. Ship as suggestions, never auto-apply.

## 4. Grammar correction rendered in the speaker's own voice (real L2 conversation, EdAcc)
LLM prompt restricted to agreement, verb form/tense, articles, prepositions, noun number, pronoun case and word order; minimal edits; every fix must include an original anchor word (so insertions become substitutions); casual native forms allowed; fixes <= 1 word apart are merged into one span; each span regenerated with PlayDiffusion + F5 in parallel on an ~8 s window, spliced into the original, verified by re-transcription, retried with new seeds if not heard.
Results on 8 EdAcc utterances from non-native speakers (Mandarin, Bulgarian, Sinhalese, Spanish, Catalan, Lithuanian L1) whose own speech contained an error: 8/8 fixes verified by ASR, 2.3-6.2 s per fix:
"do you plan to stay ... for after graduate" → "graduation"; "it does not have subway" → "a subway"; "thank you very much for the advices" → "advice"; "go to mountains" → "the mountains"; "go to Maldives" → "the Maldives"; "not even interested about" → "interested in"; "at first I didn't got it" → "didn't get"; "a particular food you used to like a child" → "like as child" (a flawed fix: should be "as a child").
Not yet measured: naturalness listening test, speaker similarity of these inserts, false-correction rate on native speech.

## 5. Tone / style
- **AI restyle (AuK-Flash)** on 9 real speakers (EdAcc + speechocean762): "calm" kept words (mean WER 0.24 vs 0.21 original) but voice similarity dropped to 0.72 (much more than on the synthetic test voice, 0.89); free-form "confident and assertive" kept similarity 0.86, WER 0.23, with an inconsistent pitch effect. Region-level restyle (select words → same-length edit of a crop → splice back) works, 0.8 s.
- **Natural presets (new, `prosody.py`)**: Praat PSOLA pitch/timing only, no neural regeneration, so the words and voice remain the speaker's: Confident = 7 % faster, ~1 semitone lower, rising phrase endings replaced by a gentle fall; Calm = 5 % slower, pitch range compressed 30 %; Warm = 4 % higher, range expanded 15 %. 0.1 s per message (CPU). Example real speaker: confident 4.24 s → 3.96 s, median F0 106 → 100 Hz. Grounded in the prosody literature in the research notes (confident speech: faster, lower, falling endings); not yet validated with listeners.

## 6. Accent removal
AuK-Flash "Remove the regional accent ..." and a free-form "native American English" instruction on the same 9 real speakers: words preserved (mean WER 0.22/0.20 vs 0.21 original), voice preserved (similarity 0.93/0.90), but no measurable accent change: CommonAccent ECAPA accent-ID "native" probability 0.23 → 0.24, top label unchanged for most speakers. Consistent with the research finding that AuK's de-accent training covered Chinese dialects → Mandarin only. Conclusion: no released model gives a reliable English de-accent today; keep it out of the main demo or label it experimental.

## 7. Infrastructure notes
- GPU memory with everything loaded (vLLM 40 GB, AuK 19 GB, PlayDiffusion, F5, app with Whisper + aligner + phoneme model + ECAPA): ~75 GB of 80 GB; dots.tts.edit left off.
- The pod's SSH briefly dropped once (network); services survived.
