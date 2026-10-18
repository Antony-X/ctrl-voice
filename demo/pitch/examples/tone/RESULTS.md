# Slide 6 tone example: results

**Recommendation: use natural Confident at Strong** (own voice, Praat). Use it on a tired take whose last phrase **trails up**, as in "…present it on Monday?". The shipped example is the synthetic voice "Will", labelled **AI-generated demo voice**.

**Do not use AI confident.** On these clips it is not the stronger option:
- On every clip, it left duration, pitch and the ending as they were.
- It changed the timbre, and on real 16 kHz recordings it changed the voice a lot and got a word wrong.

**Natural Strong on its own is subtle on every candidate** (about 10% quicker and 1.0–1.7 st lower). It is clearly audible only when the source ends on a rising, question-like intonation. That is the case on 5 of the 5 synthetic clips that end rising, and on 0 of the 9 real recordings, none of which ended rising. In all 5 synthetic clips, the engine replaced that final rise with a fall. Most of the audible "sure of itself" comes from that fall; the speed and pitch changes add a little.

I could not listen to any audio. Every judgement below comes from measured proxies (see "How to read the proxies"). **Listen to `before.mp3` and `after.mp3` back to back before the pitch.**

## The shipped example (`before.*`, `after.*`, `example.js`)

- **Source:** ElevenLabs `eleven_v3`, stock voice Will. Prompt: `[exhausted] [unsure] Hey, it's me. I'll have the report done by Friday, and I can present it on Monday?` (stability 0.5).
- **Before** = the engine's render with `{ops: []}`. It is byte-identical to the uploaded source (same MD5).
- **After** = the engine's `/natural` output, byte-copied.
- **MP3s:** both made with `ffmpeg -af loudnorm=I=-16:TP=-1.5 -ar 48000 -ac 1 -b:a 160k`. They measure −15.9 and −16.4 LUFS.
- **After word timings** come from uploading `after.wav` to `/api/upload`.

| | Before | After (natural Confident, Strong) |
|---|---|---|
| Duration | 6.80 s | 6.14 s (**−9.6%**) |
| Median F0 | 102.7 Hz | 94.2 Hz (**−1.50 st**) |
| F0 range, 5–95% | 9.9 st | 7.2 st |
| F0 SD | 2.84 st | 2.10 st (pitch variation down) |
| Words per second (span of speech) | 2.62 | 2.89 |
| Final ending ("Monday"), F0 change over the last 0.35 s | **+7.2 st (rises)** | **−1.3 st (falls)** |
| How Whisper punctuates the last word | "Monday**?**" | "Monday**.**" |
| Loudness (active speech) | | ±0.0 dB (the engine matches RMS) |
| Words kept (re-transcribed, 1 − WER) | | 1.00 |
| Voice similarity (ECAPA, the engine's model, run on CPU) | | 0.947 |
| Clipped samples / HNR / jitter | 0 / 8.9 dB / 2.56% | 0 / 7.9 dB / 2.49% |

Caption in `example.js`: "Same voice, a little quicker and lower, and the ending lands instead of trailing up."

## The exact requests (from the app code)

- **Settings → Your sound:** the slider is saved as 0..1 (`app.js:1289`). `toneMix` (`main.js:322-327`) multiplies the position by `TONE_MAX = 1.5`:
  - **Strong at the top of the slider = `{confident: 1.5}`**;
  - **Medium = `{confident: 1}`**. That is the preset, and also what the editor's character click sets for Medium (2/3 × 1.5, `app.js:1402`). The Settings label says "Medium" for any position from 0.4 to 0.8, which is mix 0.6 to 1.2.
- `applyTone` → `makeTake(meta, 'natural', 'confident', {confident: 1.5}, …)` (`main.js:307-368`) sends `engine.natural(sid, {style, mix, text: undefined, file})`.
- **AI tone:** `pickAiTone('confident')` → `edit:restyle` → `makeTake(meta, 'tone', 'confident')` sends `engine.tone(sid, {style:'confident', file})`.
- The harness (`run_tone.js`) uses the app's own `Engine` class (`src/main/engine.js`) and sends, one request at a time:
  1. `POST /api/upload` (field `f`).
  2. `POST /api/s/{sid}/render {"ops":[]}`.
  3. `POST /api/s/{sid}/natural {"style":"confident","mix":{"confident":1.5},"file":"out_….wav"}` (Strong).
  4. The same with `{"confident":1}` (Medium).
  5. `POST /api/s/{sid}/tone {"style":"confident","file":"out_….wav"}` (AuK; the instruction is "Change the speaking style to confident and assertive, keep the same voice and words.").
  6. `GET /file/{name}` for each output, then `/api/upload` of every output to get an independent transcript.

**What natural Confident actually does** (`prosody.py` on the pod, at mix 1.5):
- pitch × 0.926 (−1.33 st nominal);
- pitch range × 1.0, so it is not widened;
- duration × 1/1.107;
- loudness RMS-matched to the input;
- `fall`: for each phrase ending, if the pitch over [end − 0.35 s, end + 0.05 s] rises by more than 12% (about 2 st), it is replaced by a gentle 8% fall. Phrase endings are the last word, or any word followed by a pause longer than 0.3 s.

The engine's CTC word alignment puts the pauses inside the words. For example, "me." is aligned to 1.34–3.03 s, so in practice **only the last word of the message counts as an ending**. A rise in the middle of the message ("Friday?" in the `unsure` clips) is not flattened: in sarah_unsure it went from +5.0 to +4.0 st. This is why the shipped prompt rises only at the end.

The engine restarted once during the runs (05:32 UTC, the planned update). One upload got a 502 and succeeded after the 2-minute wait. The `/natural` change in that update only skips the recognizer for mixes with no fall. Confident still transcribes and falls, so takes from before and after the restart are comparable.

## All candidates

Strong = `{confident: 1.5}`, Medium = `{confident: 1}`, AI = `/tone confident` (AuK).

| Source | Clip | Natural Strong: duration / F0 / final ending | AI confident: duration / F0 / final ending | ECAPA: Strong / Medium / AI | Notes |
|---|---|---|---|---|---|
| Synthetic, uptalk at the end | **will_endq (shipped)** | −9.6% / −1.50 st / **+7.2 → −1.3 st**, "?"→"." | 0.0% / +0.15 / +7.2 → +7.0, still "?" | 0.947 / 0.960 / 0.935 | slowest, most tired read (2.6 words/s); 0 clipped |
| | sarah_endq | −9.6% / −1.25 / **+8.1 → −2.0**, "?"→"." | 0.0% / +0.10 / +8.1 → +8.0, "?" | 0.885 / 0.895 / 0.969 | biggest overall change (mel DTW 1.06), lowest ECAPA |
| | chris_endq | −9.6% / −1.69 / **+8.2 → −1.8** | 0.0% / −0.20 / +8.2 → +8.7 | 0.917 / 0.957 / 0.930 | Whisper heard "." both times; 6 clipped samples |
| Synthetic, uptalk throughout | sarah_unsure | −9.7% / −1.50 / **+8.3 → −1.4** | 0.0% / 0.00 / +8.3 → +7.8 | 0.898 / 0.890 / 0.961 | "Friday?" rise left in; 25 clipped samples |
| | chris_unsure | −9.7% / −1.41 / +2.8 → −1.9 | 0.0% / 0.00 / +2.8 → +2.9 | 0.949 / 0.969 / 0.967 | small rise to start with; 24 clipped |
| Synthetic, flat and falling | will_flat | −9.7% / −1.20 / −4.9 → −3.5 (already falling) | 0.0% / +0.11 / unchanged | 0.940 / 0.961 / 0.938 | **subtle: quicker and lower only** |
| | chris_flat | −9.6% / −1.30 / −1.8 → −1.8 | 0.0% / −0.25 / unchanged | 0.949 / 0.967 / 0.959 | subtle |
| | sarah_flat | −9.6% / −1.30 / −1.4 → −1.3 | 0.0% / 0.00 / unchanged | 0.887 / 0.907 / 0.957 | subtle; 79 clipped samples |
| Real, Expresso sad (CC BY-NC 4.0) | ex04_sad_00203 "Well, Lisa and I were basically the same age…" | −9.6% / −1.30 / no rise | −0.1% / −0.10 / unchanged | 0.932 / 0.936 / 0.922 | best real-human runner-up; subtle |
| | ex04_sad_00044 | −9.6% / −1.30 / falling | −0.1% / −0.10 / falling | 0.925 / 0.936 / 0.907 | subtle |
| | ex01_sad_00165 | −9.7% / −1.00 / falling | −0.1% / −0.10 / falling | 0.929 / 0.931 / 0.904 | subtle |
| | ex02_sad_00272 | −9.7% / −1.05 / flat | −0.2% / +0.10 / flat | 0.878 / 0.867 / 0.899 | subtle |
| | ex03_sad_00301 | −9.7% / −1.21 / falling | −0.2% / +0.20 / falling | 0.893 / 0.929 / 0.864 | subtle |
| Real, Expresso confused | ex01_confused_00165, ex02_confused_00066 | −9.7% / −1.41, −1.10 / both already fall | 0.0% / +0.3, +0.1 | 0.917, 0.901 / – / 0.925, 0.969 | I hoped for uptalk; neither ends rising |
| Real, CREMA-D sad (DbCL) | 1034_IOM, 1012_IOM "I'm on my way to the meeting." | −9.6% / −1.28, −1.35 / falling | −0.3% / pitch tracker unreliable | 0.894, 0.848 / 0.924, 0.858 / **0.619, 0.514** | 2.3–2.7 s only. **AI changed "meeting" to "mailing" / "meaning"** (words kept 0.86) |

The full per-take table (F0 range and SD, loudness, words kept, clipping) is in `alt/all_candidates_table.md`. Raw JSON for every run is in `C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\tonework\out\`.

**How much is "a change"?** I measured the mean log-mel distance along a DTW path between each take and its before.
- Natural takes: 0.40–1.06.
- AI takes: 0.41–0.93.
- The same TTS voice reading the same sentence flat versus with uptalk, i.e. a genuinely different delivery: 1.54–2.30.

Both tones are well short of a re-performance. AI moves the timbre, not the delivery.

**ECAPA scale.**
- The same TTS voice with a different delivery scored 0.56–0.84.
- The same Expresso speaker and sentence, sad versus confused, scored 0.33.
- Different speakers scored 0.08–0.35.

So every natural and AI take on clean audio stays in "same speaker" territory. ECAPA is sensitive to pitch and style, so natural's slightly lower score on some clips (for example Sarah at 0.885) reflects the −1.3 st shift. Natural keeps the speaker's own samples, resynthesized with PSOLA; no model generates a voice. My CPU ECAPA reproduces the engine's GPU `voice_sim` exactly on every AI take (0.959, 0.967, 0.957, …), which validates the method.

## Natural vs AI: the two options for the slide

| | Natural Confident, Strong (recommended) | AI confident |
|---|---|---|
| On the shipped clip | −9.6% duration, −1.5 st, final +7.2 → −1.3 st, "?"→".", ECAPA 0.947 | 0.0% duration, +0.15 st, final +7.2 → +7.0 st, still "?", −5.7 dB quieter, ECAPA 0.935 (the engine's `voice_sim` is 0.935), words kept 1.0 |
| Across all 17 clips | always −9.6 to −9.7% and −1.0 to −1.7 st; flips any final rise to a fall | duration within 0.3%, F0 within ±0.3 st on clean audio, endings never changed |
| Voice | the speaker's own samples, pitch and time manipulated | regenerated: usually duller timbre (95% rolloff lower on 12 of 17 clips, by up to 1.8 kHz; energy above 6 kHz down by half or more on several clips), ECAPA 0.86–0.97 on clean audio, **0.51–0.62 on CREMA-D** |
| Words | 1.00 on all 17 | 1.00 on clean audio; **0.86 on CREMA-D** (a word changed) |
| Engine time | 0.3–1.2 s per take | 1.0–2.6 s per take |
| What the slide must say | "AI-generated demo voice" (because the source is synthetic) | "AI voice", and it doesn't deliver a more confident read anyway |

AuK is deterministic: two runs on the same input gave byte-identical output. Its "confident and assertive" instruction produced no measurable prosodic change on any clip. So there is no stronger AI take to fall back on, and I recommend against it for this slide.

## How to read the proxies (I could not listen)

- **Duration −9.6% and F0 −1.3 to −1.5 st.** Each is around the threshold of what listeners notice for a 6 s message heard once. In a back-to-back A/B they come across as "brisker, a bit lower", not as a different mood. In the earlier test (`demoscript/results.md`), the same TTS voices reading "confident" were *higher* in pitch than their tired reads, so lower pitch is not what an energetic confident read sounds like.
- **Final ending.** This is the F0 change, in semitones, over the last 0.35 s of voiced frames of the last word (librosa pyin, 10 ms hop). +7 st is a clear question-like rise; −1 to −2 st is a statement fall. This is a change of intonation category, which is far more audible than a 1.5 st shift of the whole message.
  - An independent check: Whisper large-v3-turbo, re-transcribing the output, punctuated the last word "Monday?" before and "Monday." after on will_endq and sarah_endq. On both of those clips the AI take kept "?".
- **Words kept.** Each output was uploaded to `/api/upload` (the engine's Whisper plus CTC alignment), and the transcript was compared with the before's: 1 − WER, ignoring case and punctuation.
- **Artifacts.**
  - Clipped samples (|x| ≥ 0.999): the engine's RMS matching can push PSOLA peaks over full scale. The shipped clip has 0; other clips have up to 79.
  - Praat HNR, jitter and shimmer, measured on 4 clips (the 3 `endq` clips and Expresso ex04_sad_00203): natural lowers HNR by up to about 1 dB and leaves jitter flat or lower, so no sign of PSOLA roughness. AI raises jitter and shimmer a little on the synthetic clips.
  - A high-frequency click detector (>4 kHz energy jumping more than 12 dB over its ±50 ms neighbours): 14 frames vs 10 on the shipped clip. That is within noise; the detector also fires on fricatives.
  - Spectral rolloff and the share of energy above 6 kHz: unchanged by natural, lower by AI.
- **Pyin octave errors** inflate the F0 *range* on some real clips (Expresso ex01 at 35.9 st, CREMA-D 1012 after natural). Treat range numbers on real clips as rough. The median shift is robust.

## What the slide can honestly claim

- "Turn on Confident, and your message sounds sure of itself. Still your voice." **This holds for the shipped example.** The same samples are a little quicker and lower, and the ending that trailed up now falls.
- Say it in the voiceover, not as a promise for every message: *if* the message trails up at the end, Confident makes it land. For a flat, falling tired read (all 9 real recordings tested), Confident is only about 10% quicker and about 1.3 st lower. That is subtle, and it does not add energy or loudness (pitch SD went down on 13 of 17 clips).
- Don't call it an "energy" or "mood" change, and don't say "AI" about the tone: natural Confident uses no neural model.
- The source voice is synthetic: label it **"AI-generated demo voice"** (`example.js` has `synthetic: true`).

## Licences and the sources I did not use

- **ElevenLabs:** this account is on the **free tier**. ElevenLabs' pricing page lists "Commercial License" as something the Starter plan adds over free. If the pitch counts as commercial use, upgrade before using the clip, or replace it.
- **Expresso:** CC BY-NC 4.0 (the HF card and https://speechbot.github.io/expresso/), via the un-gated `ylacombe/expresso`. I read the parquet over HTTP range requests (about 0.3 GB). The alt clip needs the attribution "Expresso (Nguyen et al., Interspeech 2023), Meta AI, CC BY-NC 4.0, clip ex04_sad_00203". Non-commercial only.
- **EmoV-DB (Sleepy):** not used. Its licence (https://github.com/numediart/EmoV-DB/blob/master/LICENSE.md) is a custom one covering research, teaching, scientific publication and personal experimentation only, so a public product pitch does not clearly fit. The sentences are CMU Arctic novel prose, not voice-message lines.
- **CREMA-D:** DbCL 1.0 per file, which allows commercial use, but the clips are 1.3–5 s. The two I tested are 2.3–2.7 s, too short for 5–10 s.
- **RAVDESS:** not used. It is CC BY-NC-SA, has only two sentences ("Kids are talking by the door"), and the clips are about 3 s.
- No terms were accepted and no accounts were created. ElevenLabs used 8 generations (854 characters).
- **The cleanest option for "still your voice":** the presenter records the line themselves, tired, letting the last word drift up, then runs it through Confident at Strong. The mechanism is deterministic: about −9.6% duration, about −1.3 st, and a final rise of more than 2 st turned into a fall. It should behave like the synthetic clip, but that has not been tested on the presenter's voice.

## Files

Deliverable folder: `C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\pitch\examples\tone\`
- `before.wav`, `after.wav`: engine output, byte copies. 24 kHz, 16-bit mono.
- `before.mp3`, `after.mp3`: the same ffmpeg line for both.
- `example.js`.
- `alt/`: each entry has `<name>_before.{wav,mp3}` and `<name>_after.{wav,mp3}`. `alt/alts.json` holds each entry's request, transcripts, after-word timings and metrics. The entries are:
  - `ai_confident`: the other tone option on the same clip;
  - `natural_medium`: the same clip at Medium. It is almost the same as Strong: −6.5%, −1.1 st, and the same ending fall, since the fall is at full strength from mix 1;
  - `runnerup_sarah_natural_strong` and `runnerup_sarah_ai_confident`;
  - `real_expresso_ex04_natural_strong` and `real_expresso_ex04_ai_confident`: real human, subtle, non-commercial licence;
  - `flat_will_natural_strong`: the same voice reading flat, which shows how subtle Strong is without an uptalk ending.
- `alt/all_candidates_table.md`: the full per-take table.

Scripts are in `C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\tonework\`:
- `run_tone.js`: the engine calls;
- `analyze_tone.py` and `analyze2.py`: prosody, endings, mel DTW, tilt;
- `praat_vq.py`: HNR, jitter, shimmer;
- `ecapa_cpu.py`: ECAPA, run on the pod CPU with `CUDA_VISIBLE_DEVICES=` and the engine's checkpoint;
- `expresso_scan.py`, `build.py`.

On the pod, everything is in `/workspace/examples/tone/` (wav copies, the ECAPA savedir with symlinks, the similarity JSON). Nothing else on the pod was modified.
