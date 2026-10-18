# Mispronounced-word example: search and results

**Pick:** **speechocean762 speaker 2937 (Mandarin L1, adult), "Police have yet to charge anyone in *boomings*." → "…in *bombings*."** It is real human speech. Only that word is regenerated, and every other sample is bit-identical to the original.

**Bottom line on the pron step ("Re-say unclear words"):** on real L2 mispronunciations it rarely produces a correct fix.
- It flags **19%** of expert-labelled mispronounced words (12/64).
- Its re-say says the *intended* word only when the recognizer wrote the intended word. That held for 5 of the 11 labelled words it re-said.
- Only **2 of 82 clips** came out as a clean single-word fix of the labelled error through this step.
- The text-level checks (grammar / misspoken) produced the best example. They fire when the recognizer writes the mispronounced form ("boomings", "trail").

## 1. What was searched

| Source | Status |
|---|---|
| **speechocean762** (`mispeech/speechocean762` on HF; original at OpenSLR 101) | **Used.** Licence: **CC BY 4.0**, per OpenSLR 101. The HF card says apache-2.0; I went with the original. Expert word accuracy 0–10 and phone-level mispronunciation labels; Mandarin-L1 speakers. |
| L2-ARCTIC | Not used. The official release is behind a request form. HF mirrors are ungated: `boldvoice/l2_arctic` (450 utterances, phones but no canonical-vs-pronounced labels), `NathanRoll/l2-arctic-dataset`, `vuihocrnd/l2-arctic-cleaned`. They are CC BY-NC 4.0, which is a poor fit for a commercial pitch. Not pursued in the timebox. |
| ElevenLabs synthetic fallback | Not needed. A real human clip worked, so no key use. |

**Split.** I used the **test split only**. The engine's pron model (`/workspace/app/pron_model.pkl`, `lab/train_pron.py`) is trained on the speechocean762 **train** split, so the test split is held out.

**Candidate filter (`scripts/select.py`), applied to 1,220 adult test utterances:**
- age ≥ 18 (1,280 of 2,500 are children and were excluded);
- 1–2 words with expert accuracy ≤ 6, each a content word (not a function word, ≥ 3 letters), each with an annotated phone error;
- every other word at accuracy ≥ 8;
- length 2.5–8 s.

That left 126 clips, run in priority order: single bad word first, lowest accuracy first. **82 clips were run before the timebox** (39 speakers, ages 19–37). They contain 82 labelled words: 53 at accuracy 2–3 and 29 at accuracy 5. Ids are in `/workspace/examples/mispron/manifest.json`, and per-clip results are in `/workspace/examples/mispron/out/*.json` and `summary.json`.

**Pipeline.** `scripts/survey.js` runs `autoFix` from `src/main/main.js` step for step, with the app's own `engine.js` and `shared/edits.js` against the live engine and the default settings (all four fixes on, no tone or accent):
1. upload;
2. clean, grammar, intent and pron (sent two at a time instead of four, which gives the same answers because they only read the transcript);
3. cuts;
4. misspoken replacements, then grammar replacements, then pron re-says (`same: true`), each limited to `MAX_AUTO_REPLACE = 3` and to words that are still free;
5. keep-only-if-clearer: `verified && (after == null || after > acc)`;
6. `render(Edits.forRender(ops))`.

When an edit was kept, the rendered file was uploaded again and scored with `/pron`, the same as a fresh recording. That gives the "after" transcript and the "after" score in full-file context.

## 2. Detection (pron step) against the expert labels

| | Count |
|---|---|
| Labelled mispronounced words (acc ≤ 6) mapped to an ASR word | 74 |
| …that /pron considers at all (content word, ≥ 3 letters, not a name) | 64 |
| **…flagged by /pron** | **12 / 64 = 19%** (12/74 = 16%) |
| …flagged, when the ASR wrote the intended word | 5 / 32 |
| …flagged, when the ASR wrote some other word | 7 / 42 |
| Well-pronounced words (acc ≥ 8) /pron considers | 212 |
| **…falsely flagged** | **13 / 212 = 6%** |
| All flags | 30 (12 on labelled words, so precision 40%) |
| Clips with ≥ 1 hit / with ≥ 1 false flag | 12 / 82 · 15 / 82 |
| AUC, pron score vs label, over the words /pron considers | 0.69 |

**Why detection misses.** The scorer measures the audio against the phones of *whatever word the ASR wrote*. That causes two failures.
1. **The ASR writes the intended word** (32/82). The pron score usually stays high. Examples: "proof" (UW→OW) 9.9, "death" (TH→T) 10, "very" 10.
2. **The ASR writes what was said** (42/82), as a real or invented word: "leaf" for *life*, "hands" for *heads*, "boomings" for *bombings*, "trail" for *trial*. The audio then fits that written word, so the pron score is high again.

## 3. The fix (pron re-say with the keep-only-if-clearer rule)

| | Result |
|---|---|
| Re-says run | 29 (29 verified by the recognizer) |
| **Kept by the app's rule** | **28 / 29 (97%)**. The rule almost never rejects; only "join" (4.7 → 3.6) was dropped. |
| Re-says on labelled words | 11. Score 5.62 → 8.97 in the engine's window and 9.34 in the re-uploaded result. |
| …that re-say the **intended** word | **5 / 11**: fit, called, come, know, happened |
| …that clearly re-say the **wrong** word (the ASR's) | **6 / 11**: hands (heads), bored (boring), job (jewel), cards (cake), wanted (walked), here (sure) |
| Clean single-word fix of the labelled error, nothing else edited | **2 / 82 clips**: fit, called. *come* also got a grammar edit, *know* a false re-say of "will", and *happened* a false re-say of "never". |
| Still flagged after the fix (re-upload) | 2 / 25 re-scored |
| ASR on the region after the fix | Same word as before in all re-scored cases. A re-say never changes the word, by design. |
| Voice similarity | **Not reported for re-says.** For `same: true` the engine overwrites its ECAPA `sim` with `after/10 + 0.5` (app.py `score_cands`). |

**Damage cases:** these are re-says the app kept that made the clip worse.
- **"I can get her back."** A false flag on "can" was re-said and kept. The re-upload then reads "I can get her, her, back her."
- **"never"** was kept at 6.22 against 6.2 before, and re-scores at 5.4.
- **"people"** re-scores at 4.9.

**Seams of the pron path's best result ("fit"):**
- level +1.3 dB against the original word;
- the vowel's pitch is about **+2.6 st** above the original and drops 1–1.9 st at the join into "right";
- the spectral jump at the right join is 2.3× the original transition.

It may read as stress on "FIT", but it is not the most seamless clip. "called" is worse: the word is 4.7 dB quieter, and the left spectral jump is 3.5× the original transition.

## 4. Text-path fixes (grammar / misspoken) on the same clips

These come from 17 edits in total (`out/*.json`).
- **5 corrected the labelled word to the intended word:** boomings→**bombings** (grammar), blessing→**blessings** (grammar), trail→**trial** (misspoken), diffusion→**division** (misspoken), "had left"→**"have left"** (grammar, 2 words).
- **The other 12 were wrong or not needed:**
  - seed→seat (meant *side*);
  - Grated→Grateful (meant *create*);
  - "mother eat to her horse"→"mother feeds her horse" (4 words, meant *I made it to her house*);
  - do→does, is→was, better→had, need→you need, "for you"→you, "ask the"→"asked them", to→them;
  - a **no-op grammar item**: "my life was about to end." → "my life was about to end", a punctuation-only difference. It was regenerated and kept, so five words were needlessly re-synthesised. This is an engine bug worth fixing: drop grammar items whose normalised text is unchanged.

## 5. Candidates compared for the pick

Only clips where a single word was regenerated, it was the labelled word, and it was fixed to the intended word.

| Clip | Path (app label) | Expert label | ASR before → after | Score / ECAPA | Word level vs orig | Word F0 vs orig | Spectral jump at joins, after vs same transition in orig (L / R) | Notes |
|---|---|---|---|---|---|---|---|---|
| **so762_1502_2937** "Police have yet to charge anyone in bombings" (4.0 s) | grammar (shows as "Grammar") | BOMBINGS acc 5, AH→UH | **boomings → bombings** | ECAPA **0.63** (F5-TTS; PlayDiffusion 0.29) | **−16.7 vs −16.8 dB** | **159 vs 164 Hz (−0.5 st)**; the contour follows the original (175→138 vs 166→137 Hz) | **1.63/1.27 · 0.58/0.46** | **PICK.** The left join sits in the closure before /b/ (−32 dB); the right is the sentence's final "-ngs". |
| **so762_478_0765** "I shall be at hand for the trial" (4.3 s) | misspoken | TRIAL acc 5, AY→IH + AH deleted | **trail → trial** | ECAPA 0.43 | −23.2 vs −20.6 dB (context −24.0) | 147 vs 133 Hz (context 160) | 0.78/0.98 · 1.79/0.57 | **Alt 2.** The word is longer (0.56 vs 0.40 s: "trial" is two syllables). The insert has more energy above 7.5 kHz than the original word, but it matches the context. |
| **so762_442_0736** "I thought it would fit right in" (3.7 s) | **pronunciation** | FIT acc 3, IH→EH ("fet") | fit → fit | pron 5.8 → 9.53 (9.4 re-upload); ECAPA n/a | −22.4 vs −23.7 dB | **265 vs 228 Hz (+2.6 st)** | 1.87/1.79 · 1.94/0.86 | **Alt 1.** The only clean example of the actual pron step with a labelled error, but the pitch bump is the weak point. |
| so762_1440_2892 "Sending you love and blessings" (2.6 s) | grammar | BLESSINGS acc 5, EH→AH | blessing → blessings | ECAPA 0.37 | −30.8 vs −33.4 dB | n/a | 2.35/0.73 · 2.04/0.84 | Too short; both joins are about 3× the original. |
| so762_396_0461 "First place in the division" (3.0 s) | misspoken | DIVISION acc 5, V→F | diffusion → division | ECAPA 0.50 | −22.8 vs −23.4 dB | 113 vs 120 Hz | 2.53/1.10 · 2.46/0.47 | The ASR garbled the sentence start ("What's the place"). |
| so762_2296_9617 "…what I want to be called" (4.3 s) | pronunciation | CALLED acc 5, AO→OW | called → called | pron 6.3 → 8.7 | −26.8 vs −22.1 dB | 201 vs 231 Hz | 5.56/1.59 · 3.03/0.96 | Worse seams than "fit". |

## 6. Why I believe the pick is seamless (proxies; I could not listen)

**Untouched audio.** Before and after match exactly outside **2.742–3.343 s** of the original (2.742–3.356 s in the result):
- 85% of the file;
- maximum difference 0 LSB;
- found as the longest exactly equal prefix and suffix of the two engine WAVs.

**No clicks.** The largest sample step within ±5 ms of each join is 0.03× and 0.97× the 99th-percentile step in the ±100 ms of speech around it, so it is never larger than ordinary speech.

**Level.** The regenerated word is −16.7 dB RMS against −16.8 dB for the word it replaced, and −17.7 dB for the 0.8 s of speech around it. The engine scales the insert to the context's RMS.

**Pitch.**
- The new word's median F0 is 159 Hz, against 164 Hz for the original word: −0.5 st.
- Frame by frame, the contour follows the original's falling sentence-final shape (175→138 Hz against 166→137 Hz).
- F0 changes by 0.56 st across the left join. The right join is in the unvoiced "-ngs" at the end of the sentence, so pitch continuity there doesn't apply.

**Spectral continuity.** The log-mel jump across each join is 1.63 and 0.58. The same transitions in the original recording measure 1.27 and 0.46.

**Bandwidth.** Energy above 7.5 kHz in the new word is −43.4 dB. That is close to the context (−43.5) and duller than the original word (−38.9). The source is 16 kHz, so there is nothing above 8 kHz on either side.

**Words.** The ASR reads the whole result as "Police have yet to charge anyone in bombings.", identical to the original except for the fixed word. The engine's own verify step heard the same with both engines. The re-uploaded result raises no pron flags.

**Voice.** The engine's ECAPA similarity of the insert to the surrounding speech is 0.63, the best of all the candidates; the insert is 0.61 s long, so this is a real measurement. ECAPA on a sub-second word is a weak measure; please **listen**.

## 7. Caveats for the slide

- **The app labels this edit "Grammar", not "Pronunciation".** The recognizer wrote "boomings", and the text check fixed it. `example.js` uses `kind: 'misspoken'`, with `appKind: 'grammar'` recording the app's own label. If the slide must show the "Re-say unclear words" step itself, use `alt/fit` (`kind: 'pronunciation'`), and listen for the pitch bump on "fit".
- **The label is accuracy 5 out of 10 (AH→UH):** a clear but moderate error. The recognizer writing "boomings" is the evidence that it is audible.
- **The engine's "after" score for the pron step** is computed on a spliced 4-second window. The "after" transcript and score in the table come from re-uploading the result, the same as a fresh recording.

**Audio and processing.**
- `before.wav` is the engine's own copy of the upload (`/api/s/{sid}/file/orig.wav`, 24 kHz mono). `after.wav` is the `/render` output. Both are byte-for-byte as downloaded.
- The MP3s use the same `ffmpeg -af loudnorm=I=-16:TP=-1.5 -ar 48000 -ac 1 -b:a 160k` for both.
- Word timings are from the WAVs; the MP3 encoder adds about 25 ms of leading padding.
- After-word timings come from uploading `after.wav` to `/api/upload`.
- The default settings have no tone and no accent, so the render is what the app sends.

## 8. Attribution

Every clip here is from **speechocean762** (Zhang et al., *speechocean762: An Open-Source Non-native English Speech Corpus for Pronunciation Assessment*, Interspeech 2021), by Speechocean and Xiaomi, under CC BY 4.0, https://www.openslr.org/101/. Clips are from the test split; ids are `so762_<row>_<speaker>`.

| Clip | Speaker | Text |
|---|---|---|
| main | 2937, male, age 19; utterance accuracy 8/10, fluency 8/10 | "POLICE HAVE YET TO CHARGE ANYONE IN BOMBINGS" |
| `alt/trial` | 0765, male, age 20 | "I SHALL BE AT HAND FOR THE TRIAL" |
| `alt/fit` | 0736, female, age 21 | "I THOUGHT IT WOULD FIT RIGHT IN" |

The audio was modified by Ctrl+Voice: one word was regenerated.

**Files.**
- Scripts: `/workspace/examples/mispron/scripts/`. These are `select.py`, `export.py`, `survey.js` (run locally, because the pod has no Node; same engine API), `analyze.py`, `detail.py`, `build.js` and `package.js`.
- Raw outputs: `/workspace/examples/mispron/out/`.
- Summary: `/workspace/examples/mispron/summary.json`.
- Not run: the remaining 44 lower-priority candidates (mostly accuracy-5 words and clips with two bad words).
