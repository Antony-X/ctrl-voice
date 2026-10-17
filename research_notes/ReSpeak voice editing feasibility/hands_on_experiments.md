# Hands-on experiments: what actually worked on a rented GPU (2026-10-17)

All numbers below were measured in this session on one RunPod pod (`respeak-lab`, id `zaa3ajj8o85hhq`, NVIDIA A100-SXM4-80GB, community cloud, $1.39/hr). They are small-sample engineering measurements (10 edit jobs, 28 + 6 text cases), not a benchmark paper. Source code: `C:\Users\ingor\respeak\lab` (experiments) and `C:\Users\ingor\respeak\app` (working demo app). On the pod: `/workspace/lab`, `/workspace/app`.

## 1. Speech-editing model shoot-out (word/phrase replacement in real recordings)

**Setup.** 10 replacement jobs on real human speech: 4 LibriSpeech test-clean (read audiobook speech), 3 AMI meeting headset recordings (spontaneous, laptop-mic quality), 3 DisfluencySpeech clips (spontaneous, single speaker). Edits: one word ("Hawkeye→Michael", "fishes→children", "brilliant→peaceful", "irrelevant→important", "integrate→remove") and short phrases ("rudely and insolently→politely and kindly", "doing stuff→the design", "not good→really good", "whole thing→whole point", "always thought→never thought").

**Metrics.** edit success = Whisper-large-v3 transcript of the output contains the new phrase and not the old one; WER vs target text; speaker similarity = ECAPA (speechbrain spkrec-ecapa-voxceleb) cosine vs the original clip; naturalness = UTMOS22-strong (original clips average 3.75); time = seconds per edit on the A100 (AuK figures include a one-off 17 s warm-up on the first job).

**"+splice"** = our post-processing: forced-align the model output to the target text, cut out only the regenerated phrase, level-match it, and splice it into the untouched original with 12 ms equal-power crossfades at the quietest frame near each word gap. Everything outside the edit is the original recording, bit-exact.

| Model (released weights) | Edit success | WER | Speaker sim | UTMOS | s/edit |
|---|---|---|---|---|---|
| dots.tts.edit (Xiaohongshu, Aug 2026, 2B) raw | 10/10 | 0.057 | 0.855 | 3.54 | 12.7 |
| **dots.tts.edit + splice** | **10/10** | 0.045 | 0.975 | 3.63 | 12.7 |
| PlayDiffusion (PlayHT, 2025) raw | 10/10 | 0.046 | **0.733** | 3.70 | 1.5 |
| **PlayDiffusion + splice** | **9/10** | 0.046 | 0.976 | 3.70 | **1.5** |
| F5-TTS speech_edit (mel infilling) + splice | 7/10 | 0.053 | 0.982 | 3.62 | 1.0 |
| AuK-Flash (Tencent, Sep 2026) + splice | 7/10 | 0.066 | 0.987 | 3.68 | ~0.5 warm |
| AuK base + splice | 5/10 | 0.073 | 0.986 | 3.67 | ~3 |

Findings:
- **Splicing back into the original is essential.** PlayDiffusion's raw output re-vocodes the whole clip and drifts the voice (speaker sim 0.73); after splicing only the new phrase, similarity is 0.976 and UTMOS equals the original. dots.tts.edit also regenerates everything (0.855 → 0.975 after splice).
- **Word timestamps were the #1 quality bug.** Whisper's own word timestamps were off by 0.1-0.4 s (e.g. "Hawkeye" whisper 2.42-2.98 s vs forced-aligned 2.58-3.41 s). With Whisper times, F5 produced garbled words ("chiljes", "pelion", "imprelevant") and splices clipped words (first-run splice success: PlayDiffusion 7/10, AuK 4/10, F5 4/10). Adding a wav2vec2 CTC forced aligner (facebook/wav2vec2-large-960h-lv60-self, ~63 ms per clip) fixed most of it. Use forced alignment, never raw Whisper word times, for cut points.
- **AuK (instruction "Replace 'X' with 'Y'.") often silently ignores the instruction** and returns the original words (4 of 10 for both AuK variants on the first run). Fast (0.5 s with Flash) but unreliable for content edits; it is good for whole-message delivery changes (below).
- **dots.tts.edit is the most reliable but slowest** (8-21 s per edit unoptimized on A100; autoregressive). Good as a "high quality / retry" engine.
- **Practical recipe used in the demo app:** run PlayDiffusion and F5 in parallel on a ~8 s window around the edit, splice each candidate, verify each by re-transcribing (new words must be heard), pick the verified candidate with the best speaker similarity. Measured in the app: 3.1-4.2 s per replacement end-to-end, "verified by ASR". dots.tts.edit is available as an opt-in engine.
- Memory (peak, measured): PlayDiffusion 8.5 GB, F5 2.1 GB, dots.tts.edit 6.0 GB, AuK-Flash 18.9 GB, AuK base 19.2 GB.

## 2. Self-correction cleanup and semantic undo (LLM layer)

**Test set (text-level, hand-written):** 18 messages with corrections/restarts/repetitions/fillers/spoken commands (e.g. "I'll meet you on Monday, no wait, Wednesday at five.") with exact expected outputs, plus 10 distractors that must not change ("It's not Monday, it's Tuesday today.", "No, I can't come tonight", "I mean it, you did a great job", "Never mind the mess...", phone numbers). Undo: 6 partial messages with the expected start of the last thought.

| LLM / prompt design | Cleanup exact match (28) | False edits on 10 distractors | Undo (6) | Latency |
|---|---|---|---|---|
| Qwen3-8B, JSON word-index spans | 9/28 | 2/10 | 4/6 | 0.37 s |
| Qwen3.6-35B-A3B-FP8, inline markup `[correction: ...]` | 15/28 | 0/10 | 6/6 | 0.23 s |
| **Qwen3.6-35B-A3B-FP8 + markup + repair post-processor** | **24/28** | **0/10** | **6/6** | **0.23 s** |

- Asking the LLM to copy the transcript with inline markup (`I'll meet you on [correction: Monday, no wait,] Wednesday`) and mapping it back to word indices with difflib works far better than asking for indices (consistent with the literature finding that position outputs are much worse than inline markers).
- The biggest remaining LLM error was marking only the editing phrase ("no wait") and not the wrong word. A deterministic Shriberg-style repair post-processor fixes it: find the editing phrase (no / wait / sorry / actually / I mean / or rather), take the first word of the correction, and search backwards for the "rough copy" onset (same word, or same type: number, weekday/time, negation). It also shrinks bad repetition spans and extends a bare "scratch that" to the sentence it cancels. Anything the post-processor cannot confirm becomes a suggestion (not auto-applied). Remaining 4 misses are all safe misses (nothing wrong deleted).
- **Undo needs almost no LLM**: candidate boundaries (sentence ends, pauses >= 0.45 s, ", and/but/so/also/actually") + the LLM picking among <= 5 options = 6/6; the heuristic alone (latest candidate) also scored 5-6/6.
- Safety layer: negations/numbers/dates are only auto-deleted inside a confirmed correction that supplies a same-type replacement.

## 3. ASR notes
- faster-whisper large-v3 / large-v3-turbo with an "um, uh, like" initial prompt keeps many fillers but still silently drops repetitions and some restarts ("bam-, bamboo" → "bamboo", "what, whatever" → "whatever"). Cutting by aligned word gaps still removes them in audio, but verbatim ASR (CrisperWhisper, non-commercial) would be better for disfluency removal.
- Whisper turbo + CTC alignment on a 14.7 s message: 2.2 s including beam-5 decoding; live re-transcription of the growing buffer every 0.7 s is fast enough on an A100.

## 4. End-to-end demo app (working)
Stack on one A100 80 GB: FastAPI app (Whisper large-v3-turbo + wav2vec2 CTC aligner + ECAPA), vLLM serving Qwen3.6-35B-A3B-FP8 (40 GB), PlayDiffusion + F5 editor microservices, AuK-Flash for tone takes; dots.tts.edit optional. Total GPU use about 75 GB.

Measured:
- **Undo while recording (simulated live WebSocket stream):** pressing Undo after "...The meeting was honestly a total disaster, and my boss is an idiot." removed "and my boss is an idiot." in **351 ms**; recording continued and the next sentence was kept.
- **Spoken "scratch that"**: detected in the cleanup pass and removes the sentence before it ("Also, I talked to Jake and honestly he's being kind of annoying about the whole thing. Scratch that.").
- **Cleanup on a 14.7 s test message** ("Hey Maya! So about this weekend, um, I'll meet you on Monday, no wait, Wednesday at five at the cafe. And can you bring the, uh, the board game? Also, I talked to Jake ... Scratch that. Okay, see you then!"): 0.7 s LLM, 4 edits (2 fillers, the Monday correction, the scratched sentence), message 14.7 s → 8.0 s, 100 % original audio.
- **Word replacement "cafe" → "park"**: 3.1-4.2 s, both engines' candidates verified by ASR; AI region shown in the waveform.
- **Tone takes (AuK-Flash, whole message regenerated, ~1 s each):** calm WER 0.02 / speaker sim 0.892 / UTMOS 4.43; friendly 0.02 / 0.891 / 4.25; "studio clean" enhancement 0.00 / 0.901 / 2.77 (worse on an already-clean input). Words survive but the voice drifts more than with spliced edits (0.89 vs 0.98), so tone is offered as an alternative take, never as a silent edit.
- Browser test (Chrome): sample → Clean up → click word → "park" regenerated in 3.2 s → Send to Discord-style chat bubble with "edited with ReSpeak · 3 cuts · 1 AI-voiced phrase" badge and purple AI region; no console errors.

## 5. Caveats
- The end-to-end test message and the live-undo test audio were synthesized with F5-TTS cloning real dataset voices (DisfluencySpeech / LibriSpeech speakers), because no human was available to record; the model shoot-out used real human recordings. Must be re-tested on the team's own phone/laptop recordings.
- Small samples (10 edits); UTMOS and ECAPA on sub-second inserts are noisy.
- Licences: PlayDiffusion code archived (Jul 2026); F5-TTS weights CC-BY-NC; AuK depends on Qwen2.5-Omni-3B (research licence); dots.tts.edit Apache-2.0 per repo. Fine for a hackathon demo, check before any product.
