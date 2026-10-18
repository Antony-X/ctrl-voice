# Native accent example for slide 7: results

**Pick:** Speech Accent Archive speaker `polish3` (Polish L1). **Runner-up (`alt/`):** SAA `mandarin1` (Mandarin L1, a different language family).
Both say a real voice-note-like message: *"Please call Stella. Ask her to bring these things with her from the store. Six spoons of fresh snow peas, five thick slabs of blue cheese."*

**I did not listen to any audio.** Every judgement below comes from a proxy, and the proxies for "how strong is the accent" turned out weak (see "Where it fails"). Please listen to `before.mp3` / `after.mp3`, and to the `shortlist/` pairs, before you lock the slide.

## Headline numbers

| | **polish3 (pick)** | **mandarin1 (alt)** | old best: EdAcc C24A (Russian) |
|---|---|---|---|
| before → after duration | 11.75 s → 7.86 s | 12.07 s → 7.86 s | 14.80 s → 13.20 s |
| engine `voice_sim` (after vs the clip it was given) | **0.803** | 0.784 | 0.597 |
| held-out speaker similarity (after vs the rest of the same recording) | **0.805** | 0.753 | 0.635 |
| same-speaker ceiling (before vs held-out) | 0.917 | 0.841 | 0.900 |
| share of ceiling | 88 % | 90 % | 71 % |
| engine `words_kept` | 1.0 | 1.0 | n/a |
| independent WER of the after clip vs the true text | 0.0 | 0.0 | 0.04 |
| ASR confidence, mean Whisper word prob (before → after) | 0.972 → 0.984 | 0.970 → 0.978 | n/a |
| speech rate, words/s (before → after) | 2.39 → 3.55 | 2.28 → 3.55 | n/a |
| accent-ID top-3 before | us .988, philippines .010, australia .001 | us .987, bermuda .009, england .003 | england .66 (P native .95) |
| accent-ID top-3 after | us 1.000 | us .997, singapore .001 | us |
| noise floor, dB re speech (more negative = cleaner) | -24.9 → -30.6 | -29.0 → -29.7 | n/a |

The C24A column comes from the earlier lab run (`mono/lab/accent/results.md`) plus the accent-ID I re-ran on it. It is outside 6–12 s, so it was not re-run through the engine.

## How the example was made (exactly like the app)
1. `POST /api/upload` with `before.wav`. This is the exact file uploaded: a trim of the SAA FLAC, 44.1 kHz mono, cut at the quietest 20 ms frame after "cheese".
2. `POST /api/s/{sid}/render` with `{ops: []}`. This is the unedited message.
3. `POST /api/s/{sid}/accent` with `{style:'native', text: keptText(words, []), file: <render file>}`, which is what `makeTake(meta,'accent','native')` sends for an unedited message (`main.js` l.337-345).
4. `GET` the returned url and save it as `after.wav` (24 kHz, byte-for-byte engine output, no edits).
5. I got the After word timings by uploading `after.wav` to `/api/upload`. The Before timings come from the step-1 upload.
6. Both mp3s were made with `ffmpeg -af loudnorm=I=-16:TP=-1.5 -ar 48000 -ac 1 -b:a 160k`.

## Search (what was tried)
I made 71 engine accent requests (22 L2-ARCTIC, 27 SAA short, 22 SAA re-cut), one at a time, with no errors or retries.
- **L2-ARCTIC suitcase corpus**, spontaneous speech, 22 speakers: one 6–11.5 s segment each, cut at pauses of 0.25 s or more using the manual word tier, preferring segments with fewest fillers. Engine `voice_sim` ranged 0.53–0.85, median 0.76 (studio audio helps a lot compared with EdAcc Zoom audio). I did **not** pick from it:
  - The content is a picture-story retelling ("…they picked up the wrong suitcase…"), and most segments start or end mid-sentence. It doesn't sound like a message.
  - 4 of 22 outputs are under 6 s.
  - `hqtv_0` shows the ASR-error failure: the accented "suitcase" was heard as "preschool", and the native voice then said "preschool".
  - Best by sim:
    - hqtv 0.845 (word error)
    - lxc 0.826 (4.95 s)
    - hkk 0.824
    - njs 0.82 (kept 0.94)
    - ybaa 0.815
    - hjk 0.814
- **Speech Accent Archive**, 18 L1s, up to 3 speakers each: 43 L2 trims plus 1 English control. 3 files had no recognisable "store" in the first 13 s.
  - With only the first two sentences, every output was about 4.2 s (too short). So I re-cut 27 speakers to end at "bob", "cheese" or "peas", whichever kept the input at 12.3 s or less; 22 of them fit.
  - SAA re-cuts with all words correct: polish3 0.803, mandarin1 0.784, german3 0.779, hindi2 0.771, turkish2 0.799 (5.77 s out), russian2 0.833 (5.77 s out).
- **EdAcc:** I did not fetch more speakers. The best EdAcc result (C24A) was 0.64 held-out at 14.8 s, and every studio-quality source beat it on similarity.
- **speechocean762** (HF, ungated, the card says Apache-2.0 rather than the CC BY 4.0 in the brief): **not used.** Its utterances are short read sentences (mostly 2–5 s) and include children, so it fails the 6–12 s message criterion. I downloaded nothing from it.

## Shortlist (all in `shortlist/`, `<id>_before.wav` / `<id>_after.wav`, raw engine output)
| id | L1 | in → out s | engine sim | held-out / ceiling | words | note |
|---|---|---|---|---|---|---|
| saa3_polish3 | Polish | 11.75 → 7.86 | 0.803 | 0.805 / 0.917 | exact | **pick** |
| saa3_mandarin1 | Mandarin | 12.07 → 7.86 | 0.784 | 0.753 / 0.841 | exact | **alt** |
| saa3_russian2 | Russian | 9.55 → 5.77 | **0.833** | 0.710 / 0.844 | exact | output a bit under 6 s. Lowest ASR confidence before (0.909), so probably the strongest accent of the finalists; accent-ID after = canada .94 |
| saa3_turkish2 | Turkish | 11.17 → 5.77 | 0.799 | 0.692 / 0.894 | exact | slowest speaker (1.99 w/s); output under 6 s |
| saa3_german3 | German | 12.04 → 10.09 | 0.779 | 0.694 / 0.914 | exact | full "…brother Bob."; fast speaker (3.0 w/s), so probably a mild accent |
| saa3_hindi2 | Hindi | 10.49 → 7.86 | 0.771 | 0.720 / 0.845 | exact | the source is noise-gated (digital silence between words) |
| saa3_farsi1 | Farsi | 11.68 → 7.52 | 0.776 | 0.701 / 0.886 | **wrong** | the ASR heard "six spoon… five **stick** slabs", so the native voice says the wrong words, yet engine `words_kept` = 1.0 |
| l2arctic_hkk_0 / bwc_0 / svbi_0 | Korean / Mandarin / Hindi | ~11 → 7.6 / 7.4 / 10.7 | 0.824 / 0.793 / 0.676 | n/a | exact | story speech; lower ASR confidence before (0.85 / 0.83 / 0.91), so likely stronger accents |

**If, on listening, polish3 does not have a clearly noticeable accent:** use russian2. It has the highest voice_sim and the clearest accent proxies, but its 5.8 s output is just under the 6 s target. Or use L2-ARCTIC hkk_0 or bwc_0, which have strong accents by proxy but are not message-like.

## Proxies and how much to trust them
- **Voice similarity** is SpeechBrain ECAPA (voxceleb) cosine. It is the same model the engine uses, and my CPU re-computation matches the engine's `voice_sim` exactly (0.803, 0.784).
  - The "held-out" version compares the output with *a different part of the same recording*, which the VC never saw. It is the fairer number.
  - The "ceiling" is how similar the speaker is to himself or herself across the two parts.
  - Roughly: above 0.7 is clearly the same speaker for ECAPA; 0.25–0.4 is the usual range for different speakers.
- **Words:** engine `words_kept` compares the output with *the text it was told to say*, so it cannot catch ASR errors on the accented input (farsi1 above). I also re-transcribed every output on CPU (faster-whisper large-v3-turbo, int8) and scored it against the **true** SAA text. Both picks score WER 0.0.
- **Accent, objective:** I used CommonAccent ECAPA (`Jzuluaga/accent-id-commonaccent_ecapa`) on CPU, in a separate venv. Its head outputs cosines; "P" is softmax(30·cos), where 30 is the AAM scale of the training recipe. That is my calibration assumption, not a model output. Raw cosines are in `data/metrics_all.json`.
- **Accent, by hand:** L1 (all adult-recorded SAA speakers), speech rate, and Whisper confidence (lower before suggests a stronger accent). These are weak correlates, and both rate and confidence also go up just because TTS speech is clean read speech.

## Where it fails (honest)
- **The accent-ID model cannot show "accented before" on these clips.**
  - It has 16 English-variety classes and no L2 classes (no Polish, Mandarin or Russian). On SAA read speech it calls almost every L2 speaker "us" with P above 0.98, so the before → after change in P(native) is about +0.01. That is not evidence of anything.
  - Earlier it also called the native US EdAcc control "indian". On the incumbent C24A it says england, P(native) 0.95.
  - Use it on the slide only as "after: classified US English (P 1.00)", not as a before/after delta.
- **The engine's own GOP pronunciation score (`/pron`) saturates:** median 9.9 / 10 before and after for every finalist. It flags individual mispronounced words; it does not measure accent strength.
- **"Clearly noticeable accent before" is therefore unverified.**
  - Whisper finds polish3 and mandarin1 easy (confidence 0.97), which hints that their accents may be moderate, not heavy.
  - russian2, farsi1, turkish2 and the L2-ARCTIC speakers look stronger by that proxy.
  - **Listen first.**
- **Prosody is not the speaker's.**
  - Rhythm and pace come from the native F5 donor: 11.75 s becomes 7.86 s (about 1.5× faster, a native read-aloud pace).
  - It may sound "read", not "spoken".
  - Both after clips are exactly 7.86 s because F5 sets the duration from text length with the same reference.
- **ASR errors carry through** (farsi1, hqtv_0, bengali3 "wring"). In the app the user can fix the words first, because the client sends the kept text.
- **Audio quality:** SAA recordings are not studio quality (polish3's noise floor is -24.9 dB re speech). The output is cleaner (-30.6 dB), which may itself sound like a change of "voice". L2-ARCTIC is cleaner but not message-like.
- **Licences:**
  - SAA is now CC BY-NC-SA 4.0 (the site and OSF say 4.0; the brief said 2.0). The after clip is a derivative, so it is ShareAlike and non-commercial; that is fine for a pitch.
  - Pipeline: F5-TTS weights are CC BY-NC 4.0 and Seed-VC is GPL-3.0, as noted in the lab results.

## Sources, licences, attribution
- **Speech Accent Archive:** Weinberger, S. H. & Kelley, M. C., *The Speech Accent Archive*, George Mason University, https://accent.gmu.edu, CC BY-NC-SA 4.0.
  - Lossless FLAC comes from the public OSF project https://osf.io/e2j5y, linked from accent.gmu.edu/download. There was no login, form or terms prompt.
  - polish3: https://osf.io/download/6a7b64a8f9c9b68d29692d50/
  - mandarin1: see `alt/example.js` `speaker.url`.
  - I did not fetch speaker metadata (sex, age, English onset), so the labels say only the L1.
- **L2-ARCTIC v5.0:** Zhao et al., Interspeech 2018, CC BY-NC 4.0. Only `suitcase_corpus.zip` (112 MB) came from the ungated HF mirror `chikingsley/l2-arctic-release-v5.0`, with LICENSE included. The official TAMU download needs a form, so I didn't use it. It is used in the shortlist only.
- **EdAcc:** only the earlier lab results; nothing new fetched.

## Files
- **Here:**
  - `before.wav` / `after.wav` (exact upload / exact engine output), `before.mp3` / `after.mp3`, `example.js`
  - `alt/` (same files for mandarin1; key `accent_alt`)
  - `shortlist/`
  - `data/`: all scripts (`lib.py`, `build_cands.py`, `recut_saa.py`, `run_engine.py`, `metrics_after.py`, `finalize.py`, `rank.py`, `package.py`) and `metrics_all.json` (every candidate: before/after accent-ID with raw cosines, sims, WER, ASR text, engine responses, /pron).
- **Pod:** `/workspace/examples/accent/`
  - `cands/` (all trims, plus `held/`), `engine/` (all engine outputs)
  - `engine_results.json`, `metrics_after.json`, `finalists.json`, `cands_saa3.json`, `cands.json`
  - `venv/` (CPU torch 2.5.1, speechbrain 1.0.3), `models/`, `src/` (SAA FLACs, L2-ARCTIC suitcase); about 2.7 GB in all.
  - Engine sessions created by the uploads live in `/workspace/app_data/<sid>/`, as for any app upload.
