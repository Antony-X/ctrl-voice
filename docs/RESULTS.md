# ReSpeak — measured results

All numbers were measured on one A100 80 GB. Small samples; treat them as engineering measurements, not paper results. Details and raw notes: `research_notes/*/hands_on_*.md`.

## Round 1 — editing engines and the self-correction brain
**Word/phrase replacement, 10 real recordings** (LibriSpeech, AMI, DisfluencySpeech). "+ splice" = only the regenerated words are spliced into the untouched original. Original clips UTMOS 3.75.

| Engine | Correct | WER | Voice sim | UTMOS | s/edit |
|---|---|---|---|---|---|
| dots.tts.edit + splice | 10/10 | 0.045 | 0.975 | 3.63 | 12.7 |
| PlayDiffusion + splice | 9/10 | 0.046 | 0.976 | 3.70 | 1.5 |
| F5-TTS + splice | 7/10 | 0.053 | 0.982 | 3.62 | 1.0 |
| AuK-Flash + splice | 7/10 | 0.066 | 0.987 | 3.68 | 0.5 |
| PlayDiffusion raw (no splice) | 10/10 | 0.046 | 0.733 | 3.70 | 1.5 |

**Self-correction cleanup** (28 hand-written messages incl. 10 trick sentences) and **undo** (6 partial messages):

| Setup | Exact cleanup | Wrong deletions on tricks | Undo | Latency |
|---|---|---|---|---|
| Qwen3-8B, word indices | 9/28 | 2/10 | 4/6 | 0.37 s |
| Qwen3.6-35B-A3B, inline markup | 15/28 | 0/10 | 6/6 | 0.23 s |
| + repair post-processor | 24/28 | 0/10 | 6/6 | 0.23 s |

**End to end:** live undo 351 ms (395 ms through the public HTTPS proxy); 14.7 s test message cleaned to 8.0 s in 0.7 s (4 cuts); "cafe" → "park" in 3.1-4.2 s, ASR-verified.

## Round 2 — real voices: grammar, pronunciation, tone, accent
**Mispronunciation detector** on speechocean762 test (15,967 words, 7.6% expert-rated <= 5):

| Detector | Corr. with experts | AUC (acc <= 5) | AUC (any mispronunciation) |
|---|---|---|---|
| Training-free GOP / peak posterior | 0.18 / 0.22 | 0.73 / 0.77 | 0.76 |
| Trained detector (ours) | 0.53 | 0.88 | 0.91 |
| Published GOPT / 3MH / Azure | 0.53 / 0.68 / 0.62 | | |

Flagging the lowest 2% / 5% / 10% of words: precision (acc <= 5) 0.69 / 0.56 / 0.42, recall 0.18 / 0.36 / 0.54.

**Re-say a flagged word** (real learners): detector score 4.6-6.1 → 9.0-9.95, 2.6-4.9 s, all ASR-verified ("relatively", "love", "morning", "will"); 2 of 6 flags were false alarms. The detector judging regenerated speech is a biased judge; needs a listening test.

**Grammar in the speaker's own voice**, 8 EdAcc non-native speakers: 8/8 fixes rendered and heard correctly, 2.3-6.2 s each ("didn't got" → "didn't get", "the advices" → "advice", "go to mountains" → "the mountains", "interested about" → "interested in"; one wrong fix "like as child"). Caveat: utterances were pre-selected by the same prompt, so this measures rendering, not detection.

**Tone on 9 real speakers:** AuK calm: words kept (WER 0.24 vs 0.21 original), voice sim 0.72; AuK confident: WER 0.23, sim 0.86. Natural presets: 0.1 s, voice untouched (pitch/pace only).

**Accent removal** (AuK de-accent, same 9 speakers): words kept (WER 0.22), voice kept (sim 0.93), accent classifier "native" probability 0.23 → 0.24: no measurable change. Dropped.

## Round 3 — accent tolerance, sound-ranked did-you-mean, Step-Audio-EditX
**Accent-tolerant flagging** (speechocean762, 125 speakers, 8,878 content words, each speaker's utterances pooled):

| Rule | Flags / 100 words | Precision vs experts (acc <= 5) | Recall | Expert-fine (>= 8) flagged |
|---|---|---|---|---|
| Absolute threshold | 6.7 | 0.58 | 0.36 | 0.40 |
| Accent-sound exclusion only | 5.2 | 0.56 | 0.27 | 0.43 |
| Accent-tolerant (exclusion + relative to speaker) | 4.9 | 0.54 | 0.25 | 0.44 |

45% of absolute flags had the speaker's habitual accent sound as their weakest sound. speechocean762 experts score accent sounds as errors too, so this benchmark cannot reward tolerance; the tolerant rule is a deliberate UX choice (fewer nags about accent), with a measured recall cost.

**Did-you-mean** (40 moderate learner utterances, intended text known, edited audio re-transcribed):

| Version | Mean WER vs intended | Better / worse |
|---|---|---|
| Original transcript | 0.133 | |
| v1 single guess | 0.129 | 2 / 2 |
| v2 + low-confidence marks (prompt contained 2 test examples: inflated) | 0.133 | 3 / 3 |
| v3 n-best + acoustic ranking, clean prompt | 0.147 | 0 / 4 |

v3 mostly proposed word-form nitpicks ("upward → upwards"); a filter for those was added afterwards (not re-measured). Conclusion: context guessing is not reliable enough to auto-apply.

**Step-Audio-EditX tone vs AuK** (same 9 real speakers, whole message):

| Engine · style | Words kept | Voice sim | Length | Time |
|---|---|---|---|---|
| Step-X confident (authority) | 1.00 | 0.60 | x0.89 | 5.1 s |
| Step-X professional (news) | 1.00 | 0.52 | x0.80 | 5.4 s |
| Step-X warm | 1.00 | 0.56 | x0.87 | 5.4 s |
| Step-X calm (gentle) | 1.00 | 0.54 | x0.84 | 5.3 s |
| AuK confident / calm (round 2) | WER 0.23 / 0.24 | 0.86 / 0.72 | x1.00 | ~1 s |

More styles but a much bigger voice change, so AuK stays the default AI tone engine; the natural presets are the recommended tone feature.
