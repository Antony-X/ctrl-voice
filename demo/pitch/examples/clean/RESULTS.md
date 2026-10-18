# Slide 4 example ("clean"): results

## The pick

- **Slide 4 (`before/after.*`, `example.js`)**: the synthetic take `live_casual_jessica`.
  - Voice: the ElevenLabs stock voice "Jessica" with the `[casual]` tag, eleven_v3, stability 0.5.
  - It is labelled "AI-generated demo voice" (`synthetic: true`).
  - The take is 20.64 s before and 10.67 s after.
  - The app made all five fixes in one pass: **Filler** "um,", **Self-correction** "Monday? No, wait,", **Scratched** "Also, I still sleep with a teddy bear. Scratch that." and **Misspoken** twice ("pacific" to "specific", "mute" to "moot").
  - Both replacements are engine-verified.
- **`alt/`**: a real human clip from the AMI meeting corpus (IS1009c, speaker FIE088, headset H00, CC BY 4.0).
  - It has three fillers cut and two Grammar fixes ("conclude" to "will conclude", "come" to "will come").
  - It is weaker; its flaws are listed below.
- **`live_take.wav`**: the same take, 48 kHz, 16-bit, mono, voice "Jessica".
  - Lead silence is 0.50 s and tail silence is 1.50 s.
  - There is 1.70 s of quiet after "Scratch that." and 1.54 s before "Also".
  - I shortened the pause after "Scratch that." by 1.84 s of room tone. The reason is explained below.

Why this pick:
- No real clip showed more than two fix types.
- Every real clip still had disfluencies in its "after" audio that the ASR never transcribed. The engine cannot cut what it did not hear.
- The synthetic take shows all four fix kinds the narration names.
- It reproduces exactly: the re-transcribed output equals the app's final text.
- It has the best insert match of the 16 synthetic runs that used this script.

## Exactly what was run

- **Harness:** `clean_work/scripts/autofix.js`. It replicates `importVoiceNote` and `autoFix` from `src/main/main.js`, using the app's own `src/main/engine.js` and `src/shared/edits.js`. Settings are the defaults: all fixes on, tone 0, accent off.
  1. Upload. The "before" audio is the engine's `/api/s/{sid}/file/orig.wav`.
  2. Run the four checks: clean, grammar, intent, pron.
  3. `Edits.fromCuts`.
  4. Misspoken replacements, at most 3, filtered by `free()`.
  5. Grammar replacements, at most 3.
  6. Pronunciation re-says, kept only if verified and better.
  7. `render(Edits.forRender(ops))`, then download.
- **One deviation:** the four checks run two at a time instead of four at once, to keep engine load moderate.
  - The checks only read the session transcript.
  - Their results are applied afterwards in the app's order.
  - So the ops are the same as the app would build.
- **"After" files:** `after.wav` is the engine's render download, byte-identical (md5-checked copy). After word timings come from uploading `after.wav` to `/api/upload` in a separate session.
- **MP3s:** both made with the same `ffmpeg -i X.wav -af loudnorm=I=-16:TP=-1.5 -ar 48000 -ac 1 -b:a 160k X.mp3`.
  - Single-pass loudnorm does not land exactly on -16 LUFS.
  - Measured with ebur128: before is -16.9 LUFS and after is -17.4 LUFS, true peak -1.9 dBFS.
  - For alt: -19.3 and -18.7 LUFS, peak -2.2 and -1.9 dBFS.
- **Render check.**
  - `clean_work/scripts/seams.py` re-implements the engine's `render.py`: snap to the quietest 10 ms within ±40 ms, a 12 ms cos/sin crossfade, and a 0.45 s cap on gaps left by cuts. It uses the engine's own insert `.npy` arrays.
  - It reproduces `after.wav` to within 1.38 LSB, so every join position is known exactly.
  - The 9.46 s of `after.wav` outside crossfades and inserts is 100.000% within 1 LSB of the original samples.
  - So "same voice" is literal: only the two inserted words, 1.13 s in total, are generated.
- **Engine use:** one chain at a time. At most two requests were in flight, during the paired checks. No pod files were written. The pod was only read over ssh (`app.py`, `brain.py`, `render.py`, `/workspace/lab/align.py`). No GPU and no models were used locally.

## Real clips: 12 tried, none good enough as the headline

Sources:
- DisfluencySpeech: apache-2.0 per its HF card.
- EdAcc: CC BY-SA 4.0.
- AMI IHM: CC BY 4.0.

Only small parquet range reads were made. No gated datasets were used and no accounts were created.

**Main finding:** Whisper large-v3-turbo, as the engine runs it, wrote only **22 of the 54** reference um/uh fillers in these clips. Four clips got zero cuts. The engine cannot cut what it never transcribed, so real "after" audio still contains audible disfluencies.

| clip | ref fillers | Whisper wrote | cuts applied | notes |
|---|---|---|---|---|
| dsp_4264 (DisfluencySpeech) | 6 | 5 | 6 (filler, restart) | partial words "she-" and "lem-" remain |
| dsp_3818 | 6 | 4 | 3 (filler) | |
| dsp_3116 | 3 | 3 | 3 (filler) | the re-transcribed output still has "um" |
| dsp_781 | 3 | 0 | 0 | nothing to show |
| dsp_4345 | 4 | 0 | 0 | nothing to show |
| edacc_8607 (Spanish L1) | 5 | 2 | 3 (filler, restart) | voiced leftovers remain: "for FOR" 440 ms, "that UM" 560 ms, "do UH" 350 ms |
| edacc_4990 | 5 | 0 | 0 | |
| edacc_1195 | 5 | 3 | 3 (filler) | |
| ami_21829 | 4 | 1 | 1 | |
| **ami_22136** (alt) | 4 | 3 | 3 + 2 Grammar | best real clip; flaws below |
| ami_2310 | 3 | 1 | 1 | |
| ami_10858 | 6 | 0 | 0 | |

## Synthetic runs: 16 engine runs of the demo script

All use the same script with "pacific", "mute", "Monday, no wait, Wednesday", the teddy-bear line plus "Scratch that.", and "um".

| run (voice, style) | result | labels shown in app | inserts (F0 vs original word, level) |
|---|---|---|---|
| **live_casual_jessica** (pick) | 5/5 | Misspoken ×2 | specific -0.2 st, +1.4 dB; moot +0.55 st, +0.6 dB; both f5 |
| live_casual_jessica_p1 (same take, pause shortened) | 5/5 | Misspoken ×2 | "specific" came from the other engine (playdiff): 0.95 s, no pitch track. Worse. |
| live1p_jessica_a (new take, one pause) | 5/5 | Misspoken + Grammar | um-cut join lands in speech (-21 dB, F0 jump 9.5 st, HF burst +15.8 dB); "moot" +4.7 dB. Worse. |
| grumpy_jessica (old candidate) | 5/5 | Misspoken ×2 | +1.6 st, +0.9 st; um-cut pause only 0.08 s |
| casual_jessica | 5/5 | Grammar ×2 | creaky "moot" insert, 76 Hz (-13.5 st) |
| normal_jessica | 5/5 | Misspoken ×2 | specific +4.3 dB, -1.65 st |
| grumpy_alice | 5/5 | Misspoken ×2 | specific +6.3 st |
| normal_chris | 5/5 | Misspoken ×2 | "specific" unvoiced (no pitch track) |
| casual_roger, roger_r2 | 5/5 | Misspoken ×2 | "specific" unvoiced in both |
| casual_chris | **fail** | Misspoken + Grammar | Whisper heard "specific", so there was no fix to show; odd grammar edit "game night" to "the game night" |
| casual_will | **fail** | Misspoken + Grammar | output re-heard as "pacific" |
| tight_grumpy_jessica | 5/5 | Misspoken + Grammar | creaky "moot", 69 Hz |
| tight_casual_jessica r1, r2, r3 | 1/3 | Misspoken + Grammar | in r2 and r3, "moot" was not verified, so "mute" stayed |

Voice choice, using pitch variation as a proxy for sounding less robotic:

| take | F0 SD |
|---|---|
| Jessica casual (this take) | 9.0 st |
| Jessica casual (other take) | 8.8 st |
| the other 7 takes | 3.3–6.0 st |

The 5–95% pitch range of this take is 27.5 st. The male "specific" inserts were unvoiced in every male run, which is another reason to avoid those voices.

## Seam proxies for the pick (I cannot listen; these are measurements)

Times are in `after.wav`. Level is relative to the clip's loud frames. The pause is the run of frames below -30 dB around the join. "Click" is the largest sample step within ±3 ms divided by the clip's 99.9th-percentile step; values near 1 would be a click. The spectral jump is the frame-to-frame log-mel change at the join, as a percentile of the output's own frames. The original's own p99 is 18.3.

| join | t | level | pause | click | spectral jump | F0 step | note |
|---|---|---|---|---|---|---|---|
| um cut ("Sam, \| can") | 1.02 s | -35.5 dB | 0.26 s | 0.01 | p95 | +3.8 st | the speaker's own pauses have a median of 0.23 s; both cut points sit in quiet (-32.7 / -53.9 dB) |
| "specific" in | 2.02 s | -52.3 dB | 0.14 s | 0.00 | p59 | -1.75 st | |
| "specific" out | 2.73 s | -32.9 dB | 0.07 s | 0.01 | p99 (24.6) | -0.35 st | onset of "about" after the insert's quiet ending |
| correction cut ("Is it \| Wednesday?") | 4.63 s | -8.6 dB | 0 | 0.05 | p82 | +2.9 st | joined inside connected speech: no quiet within ±40 ms (cut points -8.4 / -15.2 dB). The most likely place to be audible. |
| scratch cut ("Wednesday? \| Anyway,") | 5.71 s | -44.2 dB | 0.50 s | 0.00 | p97 | -10.2 st | the -10 st step is the question rise into a new sentence; the engine trimmed 1.04 s of silence (0.45 s cap) |
| "moot" in ("a \| moot") | 7.92 s | -5.2 dB | 0 | 0.06 | p42 | -0.9 st | smooth in-speech crossfade |
| "moot" out | 8.34 s | -22.4 dB | 0 | 0.05 | p99 (21.2) | -1.25 st | onset of "point" |

Inserts:
- "specific": 179 Hz against 181 Hz originally, +1.4 dB.
- "moot": 169 Hz against 163 Hz, +0.6 dB.
- The pitch step into the next word is within 0.6 st of the original step for both.

Re-transcribing the "after" gives: "Hey Sam, can you be more specific about game night? Is it Wednesday? Anyway, whatever Jordan said is a moot point now. Just bring snacks." WER is 0 against the app's final text.

## live_take.wav

- **Source:** the same ElevenLabs take, `clean_work/dl/tts/TEST_SYNTH_live_casual_jessica.wav`, 24 kHz.
- **Conversion:** resampled with soxr to 48 kHz pcm_s16le mono.
- **Edges:** 0.35 s of digital silence prepended (lead to the first sample above -50 dB re peak is 0.50 s) and 1.48 s appended (tail 1.50 s).
- **End fade:** a 20 ms fade over the take's last 20 ms. The TTS file stops mid-waveform at about -36 dBFS, so zero padding alone would leave a step.
- **Pause after "Scratch that." (edited):**
  - In the raw take, the pause is 3.54 s below -30 dB.
  - I removed 1.84 s of room tone (13.00 to 14.84 s, both cut points at about -55 dBFS, 30 ms equal-power crossfade). This leaves **1.70 s**.
- **Why 1.7 s and not about 1 s.** From the pod's `ws` loop:
  - The detector fires only when a poll's transcript ends in "scratch that" and at least 0.5 s has passed since that word's aligned end.
  - Polls run every 0.7 s plus ASR time.
  - Working this through, a poll lands inside that window for any pause of about 1.2 s or more. Below that it can miss, because once "Anyway" is transcribed, "scratch that" is no longer at the end.
  - 1.24 s would leave almost no margin; 1.7 s leaves about 0.5 s for jitter.
  - A 1.24 s version is at `clean_work/live_take_1p2s_variant.wav` if you prefer the tighter pacing.
- **Before "Also":** 1.54 s below -30 dB, unedited.
  - Note: the engine's word timings show only 0.04 s there, and 0.06 s after "that.". The CTC aligner attaches pause frames to the word before.
  - So the 0.45 s word-gap rule never sees these pauses.
  - The thought boundary before "Also" is still found, by the "?" rule and by the ", also" conjunction rule in `brain.candidates()`.
- **Not tested:** I did not run the live websocket path. This is analysis of the code, not a test.

## alt/ (ami_22136, real speaker): honest flaws

- The first "Um" starts at about 0.02 s, but the aligner placed it at 0.14 s.
  - A fragment of about 0.1 s remains.
  - The join there has the worst click proxy of all runs: ratio 1.24, with a +15.8 dB burst above 6 kHz.
- She speaks fast (natural pauses have a median of 0.09 s), so every join is inside speech.
- The "will conclude" insert is 6.9 dB louder and 2.3 st lower than the word it replaced.
- The source has 10 clipped samples.
- The re-transcribed output is clean: "So, I think we will conclude the meeting here, and we will come back in 30 minutes, according to our timetable here."
- Before is 10.71 s and after is 9.53 s.
- The Grammar fixes are tagged `misspoken` on the Before words, because the brief's tag list has no grammar tag. Their edits keep `kind: 'grammar'` and `label: 'Grammar'`.

## Caveats

- **Nothing was listened to.** "Seamless" rests on the proxies above, the sample-exact check and re-transcription.
- **The engine is not deterministic.**
  - Re-running the same take (p1) changed which engine generated "specific", and the result was worse.
  - Labels change between runs: the two word fixes come out as Misspoken or as Grammar depending on what the LLM checks return.
  - The live demo will make its own inserts.
- **The before clip is long.** It is 20.6 s and includes a 3.5 s pause after "Scratch that." (in the "after" that pause becomes 0.50 s).
  - If that is too long for the 3-minute pitch, `clean_work/ready/short_pause_variant/` is a ready-to-drop build of the p1 run: 18.3 s before, same paths and id.
  - Its "specific" insert is the weaker one from the other engine.
- **ElevenLabs licence.** The account's 10,000-credit quota matches the Free plan. The pricing page lists "Commercial License" only from Starter up. That is fine for a non-commercial pitch demo; check before any commercial use. This session used about 1,460 characters.
- **ffmpeg mp3 durations:** before 20.640 s, after 10.668 s. They match the wavs.

## Files

- `clean_work/runs/<run>/`: `run.json` (words, checks, ops, render ops, final and re-heard text, timings), `seams.json`, the insert `.npy` files and `before/after.wav`. Each run also has a `<run>.log`.
- Overview tables: `runs/seams_all.txt`, `runs/inserts_all.txt`, `runs/real_asr_table.txt`, `runs/expressiveness.txt`.
- Scripts in `clean_work/scripts/`:
  - `autofix.js`: the harness.
  - `seams.py`: render reproduction and seam proxies.
  - `inserts.py`
  - `pauses2.py`: live-take pauses.
  - `shorten_pause.py`
  - `build.py`: wav copy, mp3s, `example.js` and the sample-exact check.
