# Cut the real audio, clone only the gaps

Everything ReSpeak proposes can be built today. A prototype built in this session already runs all of it on one rented A100. It removes the last thought during recording in **351 ms**. It cleans self-corrections out of a message with **24/28 exact matches and zero false edits on 10 distractors**. It replaces a word in the speaker's own voice in **3.1–4.2 s**, and checks each replacement by re-transcribing it. What does not survive scrutiny is any claim that the underlying technology is new:

- Descript ships zero-shot word regeneration from about five seconds of adjacent audio.
- Wispr Flow, Gboard Rambler and Rambleproof already strip "no wait" corrections, but they output *text*.
- Opus Pro and Gling cut retakes from creator video.
- A granted US patent covers editing a voicemail through its transcript, with edits spoken in a synthesized copy of the user's voice.

The novelty that holds up is narrower but real. We found no shipped messaging app that semantically edits the *audio* of a voice note before it is sent. ReSpeak's design keeps the sender's real recording as the deliverable: every edit is a cut, except for explicitly labelled AI phrases. The measurements give a clear engineering verdict. Build ReSpeak as a **deletion-first editor, with generation as a fallback that is verified, spliced in and labelled**.

- Splicing generated audio back into the untouched original raised whole-clip speaker similarity from **0.73 to 0.98**.
- Using forced alignment instead of Whisper's word timestamps was the biggest single quality fix.
- Tone "correction" is only safe as an optional alternative take.

The demo should open with live undo and automatic cleanup on the team's own voices, show one word replacement as the second act, and tell judges plainly which parts are new interaction design and which are assembled from public models.

## One A100 already runs all four features end to end

Figures in this section marked "(measured)" come from a single RunPod pod used in this session (`zaa3ajj8o85hhq`, A100-SXM4-80GB, community cloud, **$1.39/hr**). These are small engineering samples, not a benchmark: 10 edit jobs, 28 text cases and 6 undo cases. The raw log is in the [hands-on notes](<C:/Users/ingor/respeak/research_notes/ReSpeak voice editing feasibility/hands_on_experiments.md>), the experiment code is in `C:\Users\ingor\respeak\lab`, and the working demo app is in `C:\Users\ingor\respeak\app`.

The app runs on one GPU. A FastAPI server hosts Whisper large-v3-turbo, a wav2vec2 CTC forced aligner and an ECAPA speaker model. vLLM serves Qwen3.6-35B-A3B-FP8 (40 GB). PlayDiffusion and F5-TTS run as editing microservices, AuK-Flash makes tone takes, and dots.tts.edit is an optional extra engine. Together they use about **75 GB of GPU memory** (measured).

### Splicing into the original matters more than which editor you pick

The shoot-out ran ten word or phrase replacements on real human speech: four LibriSpeech read clips, three AMI meeting headset clips and three spontaneous DisfluencySpeech clips. The edits ranged from single words ("Hawkeye→Michael") to short phrases ("rudely and insolently→politely and kindly"). An edit counted as a success when Whisper-large-v3 heard the new phrase and not the old one. "+splice" means the model's output was forced-aligned to the target text, and only the regenerated phrase was cut out, level-matched and dropped into the bit-exact original. The seams use 12 ms equal-power crossfades placed at the quietest frame near each word gap.

| Model (released weights) | Edit success | WER | Speaker sim | UTMOS (orig. 3.75) | s/edit | Peak VRAM |
|---|---|---|---|---|---|---|
| dots.tts.edit (Aug 2026, 2B), raw | 10/10 | 0.057 | 0.855 | 3.54 | 12.7 | 6.0 GB |
| **dots.tts.edit + splice** | **10/10** | 0.045 | 0.975 | 3.63 | 12.7 | 6.0 GB |
| PlayDiffusion (2025), raw | 10/10 | 0.046 | 0.733 | 3.70 | 1.5 | 8.5 GB |
| **PlayDiffusion + splice** | **9/10** | 0.046 | 0.976 | 3.70 | **1.5** | 8.5 GB |
| F5-TTS speech_edit + splice | 7/10 | 0.053 | 0.982 | 3.62 | 1.0 | 2.1 GB |
| AuK-Flash (Sep 2026) + splice | 7/10 | 0.066 | 0.987 | 3.68 | ~0.5 warm | 18.9 GB |
| AuK base + splice | 5/10 | 0.073 | 0.986 | 3.67 | ~3 | 19.2 GB |

*(measured; AuK times exclude a one-off 17 s warm-up on the first job)*

**Splicing is not optional.** PlayDiffusion re-vocodes the whole clip, so its raw output drifts to a speaker similarity of **0.733**. When only the new phrase is spliced in, similarity rises to **0.976** and UTMOS matches the original (measured). This agrees with the model literature. The dots.tts.edit paper states that "unedited regions are regenerated rather than spliced" ([dots.tts.edit paper](https://arxiv.org/html/2608.02673)). F5-TTS's editing script outputs a fully re-vocoded mel rather than splicing original samples back in ([F5-TTS speech_edit.py](https://github.com/SWivid/F5-TTS/blob/main/src/f5_tts/infer/speech_edit.py)). The CosyEdit authors spliced original audio back in with Whisper, MFA and a cross-fade for their own comparisons ([CosyEdit](https://arxiv.org/html/2601.05329v1)).

Read the 0.97–0.98 similarity figures skeptically. They compare the whole output clip with the original, and after a splice most of that clip *is* the original. They show how little damage the edit did, not how well the inserted word matches the voice. On sub-second inserts both ECAPA and UTMOS are noisy. The edit-success column and listening are the honest quality signals. The splice also has a cost: it lost PlayDiffusion one of its ten edits.

**Word timestamps were the most important bug.** Whisper's own word times were off by 0.1–0.4 s. In one case Whisper placed "Hawkeye" at 2.42–2.98 s, while forced alignment placed it at 2.58–3.41 s. With Whisper times, F5 produced garbled words ("chiljes", "imprelevant") and splices clipped words. First-run splice success was only 7/10 for PlayDiffusion and 4/10 for AuK and F5. Adding a wav2vec2 CTC aligner (~63 ms per clip) fixed most of these failures (measured). Published timing benchmarks show the same gap:

- Base Whisper's mean word-timing error is **203 ms** on read speech and **568 ms** on disfluent speech, against 19 ms for MFA ([CrisperWhisper 2.0 paper](https://arxiv.org/html/2607.18934)).
- On TIMIT, MFA places 72.8% of word boundaries within 25 ms, against 52.7% for WhisperX and 43.5% for MMS ([Rousso et al.](https://arxiv.org/html/2406.19363v1)).

One install trap: torchaudio deprecated its `forced_align` API in 2.8 and removed it in 2.9, so a CTC aligner needs a pinned version ([torchaudio 2.9 docs](https://docs.pytorch.org/audio/2.9.0/tutorials/ctc_forced_alignment_api_tutorial.html)).

**AuK often silently ignores content instructions.** Given "Replace 'X' with 'Y'.", both AuK variants returned the original words in 4 of 10 first-run jobs (measured). That lands between two published results that contradict each other. AuK's own report claims 87.5–91.8% content accuracy on SpeechEditBench ([AuK report](https://arxiv.org/html/2609.08936)). A competitor's benchmark measured an edit WER of 144.63 ([dots.tts.edit paper](https://arxiv.org/html/2608.02673)). AuK-Flash is fast and works well for re-rendering a whole message, but it is not reliable for word edits. dots.tts.edit was the most reliable engine, with 10/10 successes, but it was also the slowest at 8–21 s per edit unoptimized, because it is autoregressive. It fits a "high-quality retry" button.

The production recipe in the app runs **PlayDiffusion and F5 in parallel on a ~8 s window around the edit**. It splices each candidate, re-transcribes it to confirm the new words are audible, and keeps the verified candidate with the best speaker similarity. End to end this takes **3.1–4.2 s per replacement** (measured). VoiceCraft's authors use a similar defence: they generate about ten candidates and discard the longest, because token loops produce drawn-out silences ([VoiceCraft](https://arxiv.org/html/2403.16973v1)).

### Inline markup plus a repair rule reaches 24/28 with zero false edits

The cleanup test set was written by hand at the text level. It has **18 messages** with corrections, restarts, repetitions, fillers and spoken commands, such as "I'll meet you on Monday, no wait, Wednesday at five." It also has **10 distractors** that must not change, such as "It's not Monday, it's Tuesday today.", "No, I can't come tonight", "I mean it, you did a great job" and phone numbers. Six partial messages test undo.

| LLM and prompt design | Cleanup exact match (28) | False edits on 10 distractors | Undo (6) | Latency |
|---|---|---|---|---|
| Qwen3-8B, JSON word-index spans | 9/28 | 2/10 | 4/6 | 0.37 s |
| Qwen3.6-35B-A3B-FP8, inline markup `[correction: …]` | 15/28 | 0/10 | 6/6 | 0.23 s |
| **Same + Shriberg-style repair post-processor** | **24/28** | **0/10** | **6/6** | **0.23 s** |

*(measured)*

In the prompt that worked, the LLM copies the transcript and wraps the material to delete in inline tags, for example `I'll meet you on [correction: Monday, no wait,] Wednesday`. difflib then maps the tags back to word indices. Older work points the same way. In GPT-NER, inline markers scored **92.68 F1**, against **38.73** when the model had to output entity positions ([GPT-NER](https://arxiv.org/pdf/2304.10428)).

This table cannot isolate the effect of output format, because the model and the format changed together between rows one and two. The jump from 9 to 15 combines a larger model with a better format. Nor does it test DRES's recommendation of a few-shot 8B-class model ([DRES](https://arxiv.org/html/2509.20321v2)), because the 8B model was only tried with the weaker index format.

The LLM's most common remaining error was tagging only the editing phrase ("no wait") and leaving the wrong word ("Monday") in place. A deterministic post-processor based on the Shriberg repair structure fixes this:

- It finds the editing phrase: no, wait, sorry, actually, I mean, or rather.
- It takes the first word of the correction and searches backwards for a "rough copy" of the same word or the same type (number, weekday or time, negation).
- It shrinks repetition spans that are too long, and extends a bare "scratch that" to cover the sentence it cancels.

Anything the post-processor cannot confirm becomes a suggestion and is not applied automatically. All four remaining misses are safe misses, meaning nothing was wrongly deleted. Negations, numbers and dates are deleted automatically only inside a confirmed correction that supplies a replacement of the same type (measured).

**Undo needs almost no LLM.** The candidate boundaries are:

- sentence ends;
- pauses of at least 0.45 s;
- a comma followed by and, but, so, also or actually.

With these candidates, the LLM picking among at most five options scored 6/6. The heuristic alone, which simply takes the latest candidate, scored 5–6/6 (measured). This is the cheapest feature in the product and the most impressive one on stage.

The 24/28 figure measures the LLM layer on *perfect transcripts*. Real ASR errors will compound it, as the next section shows.

### End-to-end timings, and what they do not prove

| Operation | Measured result |
|---|---|
| Undo pressed during recording (simulated live WebSocket stream) | "and my boss is an idiot." removed in **351 ms**; recording continued and the next sentence was kept |
| ASR + CTC alignment on a 14.7 s message | 2.2 s with beam-5; re-transcribing the growing buffer every 0.7 s keeps up on an A100 |
| Cleanup pass on the 14.7 s test message | 0.7 s of LLM time; 4 edits (2 fillers, the Monday correction, a "scratch that" sentence); **14.7 s → 8.0 s, 100% original audio** |
| Word replacement "cafe" → "park" | 3.1–4.2 s; candidates from both engines verified by ASR; AI region drawn on the waveform |
| Tone take (AuK-Flash, whole message regenerated) | ~1 s each |
| Browser run (Chrome) | sample → clean up → click word → "park" in 3.2 s → Discord-style bubble with an "edited with ReSpeak · 3 cuts · 1 AI-voiced phrase" badge; no console errors |

*(measured)*

The biggest caveat changes how much weight these numbers can carry. **The end-to-end message and the live-undo audio were synthesized with F5-TTS cloning dataset voices**, because no human was available to record. Synthetic speech is cleaner and more fluent than a real voice note, and it is easier for ASR. Only the model shoot-out used real human recordings. Before any of these numbers is quoted to judges, the team must re-test on its own phone and laptop recordings.

Two other caveats apply. The "14.7 → 8.0 s" compression is large partly because the scripted message contains a whole scratched sentence. And the licences on several models used here do not allow a product:

- F5-TTS weights are CC-BY-NC ([F5-TTS](https://github.com/SWivid/F5-TTS)).
- AuK depends on the research-only Qwen2.5-Omni-3B ([AuK issues](https://github.com/Tencent-Hunyuan/AuK/issues)).
- PlayDiffusion's repository was archived in July 2026, although its weights remain Apache-2.0 ([PlayDiffusion](https://github.com/playht/PlayDiffusion)).

## Every primitive already ships, just not inside a voice message

**Word replacement in your own voice is a shipped product feature.** Descript Regenerate lets a user select transcript text and type new words, which are generated in an authorized custom AI speaker's voice. It is English-only and capped at 250 characters per action ([Descript Help](https://help.descript.com/hc/en-us/articles/13832955606413)). Descript's June 2026 research post describes the same infilling approach ReSpeak's word replacement uses. It "regenerate[s] only the region that changed, conditioned on the untouched signal around it", using a flow-matching transformer, zero-shot from about five seconds of adjacent audio ([Descript research](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)). Other examples:

- Crele lists "Speech Editing (Preview)": "Change the words in a recording and hear them back in the speaker's own voice" ([Crele](https://www.crele.co)).
- Podcastle Revoice ([Podcastle](https://podcastle.ai/announcements/podcastle-unveils-revoice-generative-ai-for-audio-creation)).
- Adobe's 2016 VoCo demo, which never shipped ([TechCrunch](https://techcrunch.com/2016/11/03/adobes-project-voco-lets-you-edit-speech-as-easily-as-text/amp)).
- Hackathon and GitHub projects such as VoiceKeep ([Devpost](https://devpost.com/software/voicekeep)) and Voice Replacer, which chains Whisper, transcript editing and XTTS ([GitHub](https://github.com/PrashantRMarathe/voice-replacer)).
- Most important, US8620654, "Text oriented, user-friendly editing of a voicemail message", which describes edits using "a computer-synthesized version of the user's voice" ([USPTO](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8620654)). Its claims and legal status were not checked.

**Removing self-corrections is mainstream, but only for text.** Wispr Flow's Backtrack turns "Let's do coffee at 2 actually 3" into "Let's do coffee at 3" while keeping "I actually enjoyed the movie" ([Wispr docs](https://docs.wisprflow.ai/articles/5373093536-how-do-i-use-smart-formatting-and-backtrack)). Google's Gboard Rambler, announced in May 2026, uses Gemini to handle "self-corrections, repetition, pauses, and filler words" ([9to5Google](https://9to5google.com/2026/05/12/gemini-intelligence-announcement/)). Rambleproof removes "'No wait, I mean' corrections" and checks "that no number and no 'not' changed" before typing ([Rambleproof](https://rambleproof.com/)). Dragon's "scratch that" has deleted the last pause-delimited utterance for decades ([Nuance](https://nuance.com/products/help/dragon/dragon-for-mac/enx/Content/Correction/TakeBack.htm)).

On audio, creator tools already cut self-corrections and retakes. Opus Pro's "Remove Bad Takes" detects "self-corrections" ([Opus help](https://help.opus.pro/docs/article/speech-cleanup)). Gling auto-removes bad takes for YouTubers ([Unite.ai](https://www.unite.ai/gling-ai-review)). TalkLess (UIST '25) condenses recordings by mixing cuts of the real audio with short synthesized insertions. All three creators in its exploratory study preferred it to full resynthesis: "the idea is to reuse and not regenerate" ([TalkLess](https://arxiv.org/html/2507.15202v2)).

**Messaging apps give senders only blunt tools.** WhatsApp has pause and resume, draft preview ([Meta](https://about.fb.com/news/2022/03/new-voice-message-features-on-whatsapp/)) and on-device transcripts for receivers ([TechCrunch](https://techcrunch.com/2024/11/21/whatsapp-rolls-out-voice-message-transcripts)). Telegram lets senders trim the start and end of a voice message and record more sections ([Telegram](https://telegram.org/blog/direct-to-channel-trim-voice-and-more)). WhatsApp's AI Writing Help rephrases and changes the tone of *typed* messages ([TechCrunch](https://techcrunch.com/2025/08/27/whatsapps-new-ai-feature-lets-you-rephrase-and-adjust-the-tone-of-your-messages)), and an offline voice-to-text feature that sends text was in development in September 2026 ([WABetaInfo](https://wabetainfo.com/whatsapp-is-testing-a-new-voice-to-text-feature-for-messages/)).

The gap is real, and so is the platform risk. Meta already owns on-device ASR, a tone rewriter and a dictation pipeline, so it could assemble ReSpeak quickly. The "nothing ships" finding rests on about six searches, not an exhaustive app-store sweep.

| ReSpeak feature | Closest prior art | Novelty in a voice-message recorder |
|---|---|---|
| Semantic undo of the last thought while recording | Dragon "scratch that" (text, pause-delimited); Backtrack, Rambler (text); Telegram trim (manual, ends only) | **Moderate**: no audio version inside a messaging recorder was found |
| Auto-removal of "Monday, no wait, Wednesday" from audio | Opus Pro Remove Bad Takes, Gling, Descript Underlord (creator video); text dictation tools | **Low to moderate**: exists for creators, not for chat |
| Replace a word in your own voice | Descript Regenerate, Crele preview, Podcastle Revoice, US8620654, VoiceKeep | **Low**: patented and productized; only the context is new |
| Grammar and tone correction | WhatsApp Writing Help (text); Adobe Project Clean Take ([MAX 2025 sneak](https://www.adobe.com/max/2025/sessions/project-clean-take-gs3-2.html), unshipped) | **Moderate**, but the weakest technology and the highest trust risk |
| "Tighten my note" using only real audio | TalkLess (research); Descript Underlord "tighten pacing" | **Moderate to high** as a product |
| Recipient-visible provenance of AI-voiced spans | AudioSeal localized watermarking ([AudioSeal](https://github.com/facebookresearch/audioseal)) | **Not found in messaging**, and cheap to build |

Survey data supports the pain point, mostly on the listener's side. In a Sky Mobile survey of 2,000 UK users, the average voice note runs **3 minutes** while people want them capped at **2**, and **38% often listen twice** "because the sender doesn't get to the point quickly" ([Sky Group](https://www.skygroup.sky/article/voice-no-brits-call-time-on-long-voice-notes)). In Preply's US survey, **61%** say tone is easier to convey by voice note, and **48%** say voice notes take more effort than texts ([Preply](https://preply.com/en/blog/voice-notes-on-the-rise/)). That is the argument for keeping audio, rather than converting to text the way Wispr and Rambler do. No source measures how often senders delete and re-record, so a pitch built on "everyone re-records" would rest on anecdote.

## What works: verbatim ASR, guarded deletions, spliced infill and cautious tone

### ASR, not the LLM, sets the ceiling for cleanup

A cleanup model can only cut a repair that the transcript contains. Off-the-shelf Whisper "does not transcribe disfluencies". Its WER on disfluent words is **0.71**, against 0.05 on fluent words. A text disfluency detector that scores 0.85 weighted F1 on gold transcripts falls to **0.47** on Whisper output ([Romana et al.](https://arxiv.org/html/2311.00867v1)). On English filler events, Whisper scores just **12.0 F1** ([CrisperWhisper 2.0 paper](https://arxiv.org/html/2607.18934)). The prototype hit the same problem. Prompting faster-whisper with "um, uh, like" kept many fillers but still collapsed "bam-, bamboo" to "bamboo" and "what, whatever" to "whatever" (measured).

There is a partial workaround: cut by the *gaps between kept words*, which removes untranscribed material along with the deleted words. The real fix is a verbatim recognizer. CrisperWhisper 2.0 reports **87.8 disfluency F1** across 10 languages and **29.6 ms** mean word-boundary error, but its weights are non-commercial ([CrisperWhisper](https://github.com/nyrahealth/CrisperWhisper)). Licence-clean routes include:

- AssemblyAI's `disfluencies: true` ([AssemblyAI docs](https://www.assemblyai.com/docs/pre-recorded-audio/filler-words)).
- ElevenLabs Scribe v2, which is verbatim by default ([ElevenLabs docs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text)).
- Parakeet-TDT-0.6B-v3 (CC-BY-4.0, word timestamps) paired with a separate aligner. Its filler behaviour is undocumented ([Parakeet card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)).

### Detection must be deletion-only, cue-gated and protective of meaning

Shriberg's scheme splits a repair into a **reparandum** (the material to discard), an optional **interregnum** ("no wait", "I mean") and the **repair** (what to keep). The span to cut is reparandum plus interregnum ([LARD](https://arxiv.org/pdf/2201.05041)). Accuracy depends heavily on the repair type:

- On gold Switchboard transcripts, fine-tuned text models reach **89–91 F1** on reparandum words ([Jamshid Lou & Johnson](https://arxiv.org/pdf/2004.05323)).
- Repetitions score **97.3** and corrections **88.6** ([Jamshid Lou & Johnson](https://arxiv.org/pdf/2004.05323)).
- Restarts are much harder: frame-level F1 is **0.13** on gold text and **0.00** for audio-only models ([Romana et al.](https://arxiv.org/html/2311.00867v1)).

So ReSpeak's main target, an explicit correction marked by an editing term, is the *easiest* class. Cue-less restarts should only ever be offered as suggestions.

Prompted LLMs carry a specific risk. On the DRES benchmark, prompted GPT-4o-mini sits in the mid-70s on word F1, and fine-tuning lifts it to the mid-90s. "Reasoning models systematically over-delete fluent content." Splitting the input into segments of about four sentences helps ([DRES](https://arxiv.org/html/2509.20321v2)).

Over-deletion has already reached users. In September 2026 a prominent user reported that Wispr Flow turned "never merge a change like this" into "merge a change like this" ([Theo on X](https://x.com/theo/status/2102703393043005737)). The prototype's rule matches Rambleproof's guardrail and the literature's "type parity" idea: a negation, number, date or name is auto-deleted only when the repair supplies a token of the same type. It is the right default, and the zero-false-edit result on distractors comes from it.

### Trust a ten-clip test over editor leaderboards

On RealEdit, an English single-span benchmark that two groups ran independently, the newer Apache-licensed editors lead:

| Benchmark run | Ranking by WER |
|---|---|
| CosyEdit authors | CosyEdit **4.50**, SSR-Speech 5.05, VoiceCraft 6.55 ([CosyEdit](https://arxiv.org/html/2601.05329v1)) |
| EditVoice authors | EditVoice **4.40**, SSR-Speech 4.75, VoiceCraft 5.89 ([EditVoice](https://arxiv.org/html/2609.29889)) |

Rankings on instruction-style benchmarks swing wildly with who runs them, as the two AuK results above show. The 10-job test here sided with the skeptical reading for AuK and with dots.tts.edit's own claim of reliability. It also showed that reliability on content, not speed, decides which engine to use. A team should run its own ten clips before trusting any leaderboard.

Hosted fallbacks are close to non-existent:

- PlayHT's API stopped in July 2025 after Meta acquired PlayAI ([cognitivefuture.ai](https://cognitivefuture.ai/elevenlabs-vs-playht-alternatives/)).
- Resemble no longer sells its generative voice models ([Resemble archive](https://docs.resemble.ai/voice-archive.md)).
- ElevenLabs' documented inpainting covers music only ([ElevenLabs docs](https://elevenlabs.io/docs/eleven-api/guides/how-to/music/inpainting)).

Self-hosting on a rented GPU is the only dependable path.

Two models are untested here and worth a look after the hackathon. AnyEdit (October 2026) inherits background noise and reverb from the source recording, which matters for phone voice notes, but it has no released code or weights ([AnyEdit](https://arxiv.org/abs/2610.15665)). EditVoice ships a noise-robust checkpoint, but installing it requires a CosyVoice `ttsfrd` wheel ([EditVoice repo](https://github.com/DHY02/EditVoice)).

### Tone correction is the weakest link, so offer it as a take

Open models are poor at controlled emotion editing. On SpeechEditBench's emotion task, Step-Audio-EditX reaches **7.71%** joint success, and even closed Gemini-Live reaches only **27.79%** ([SpeechEditBench](https://arxiv.org/html/2606.01804v3)). dots.tts.edit reports **7.50%** emotion accuracy on "intense" edits ([dots.tts.edit paper](https://arxiv.org/html/2608.02673)).

The prototype's AuK-Flash tone takes kept the words, but the voice moved:

| Take | WER | Speaker sim | UTMOS |
|---|---|---|---|
| Calm | 0.02 | 0.892 | 4.43 |
| Friendly | 0.02 | 0.891 | 4.25 |
| "Studio clean" enhancement | 0.00 | 0.901 | 2.77 |

*(measured)*

Speaker similarity of about 0.89 is clearly below the ~0.98 of spliced edits. The UTMOS gain for "calm" most plausibly reflects a cleaner, more TTS-like rendering rather than the same person speaking more calmly. "Studio clean" made an already-clean input worse.

Grammar correction has the same weakness one level up. Any grammar fix that adds or changes words becomes a generative replacement. The prototype did not measure it, and TalkLess participants specifically raised the worry that edits could change a speaker's meaning ([TalkLess](https://arxiv.org/html/2507.15202v2)). Both features belong in the UI as suggestions the sender accepts one at a time, never as silent rewrites.

## The architecture: an edit list over the original, with verified generative patches

The design that the measurements and the literature both support is a **non-destructive edit list over the original recording**. The raw audio and word timings never change. Cleanup and undo add *cut* operations. Word replacement adds an *insert* operation that carries the generated waveform and is flagged as AI. Playback and sending re-render from the list, so every change can be reverted. This mirrors the "Undo AI edit" escape hatch every shipping LLM dictation tool provides ([Wispr docs](https://docs.wisprflow.ai/articles/5373093536-how-do-i-use-smart-formatting-and-backtrack)).

The prototype's `render.py` already works this way:

- It snaps each cut to the quietest 10 ms frame within ±40 ms.
- It joins segments with 12 ms equal-power crossfades.
- It caps the silence left by a cut at 0.45 s.

Perception research supports those settings. Listeners place an optimal fluent pause near **186 ms** and hesitation pauses from about **505 ms** ([Ruder & Jensen summary](https://sonicfield.org/library/silent-interval-duration-as-a-perceptual-cue-of-speech-pauses)). Equal-power fades suit the uncorrelated material on either side of a deletion ([Pro Tools Expert](https://www.pro-tools-expert.com/home-page/2019/01/04/crossfades-equal-power-or-equal-gain)).

| Layer | Prototype choice (measured) | Licence-clean or better option for later |
|---|---|---|
| Live transcript | faster-whisper large-v3-turbo, re-run on the growing buffer every 0.7 s | Kyutai STT, true streaming with word timestamps, CC-BY 4.0 ([Kyutai](https://github.com/kyutai-labs/delayed-streams-modeling)); Parakeet-TDT-v3 |
| Verbatim pass | none yet (Whisper drops repetitions) | CrisperWhisper 2.0 (non-commercial) or AssemblyAI / Scribe v2 verbatim |
| Cut points | wav2vec2-large-960h-lv60-self CTC aligner, ~63 ms per clip | MFA 3.0 for tighter boundaries on clean speech ([MFA 3.0](https://arxiv.org/abs/2606.18466)) |
| Undo boundaries | sentence ends + pauses ≥ 0.45 s + clause cues; LLM picks among ≤ 5 options | SaT/wtpsplit for unpunctuated text ([SaT](https://web3.arxiv.org/pdf/2406.16678v2)) |
| Cleanup | Qwen3.6-35B-A3B-FP8 on vLLM (40 GB), inline markup, repair post-processor, protected tokens | smaller non-reasoning instruct model with the same markup (untested) |
| Word replacement | PlayDiffusion (8.5 GB) + F5 (2.1 GB) in parallel on a ~8 s window, splice, ASR check, best speaker sim | dots.tts.edit (Apache-2.0 per repo; 10/10 but ~13 s); CosyEdit or EditVoice (Apache-2.0, untested) |
| Tone takes | AuK-Flash (18.9 GB), whole message | Step-Audio-EditX ([repo](https://github.com/stepfun-ai/Step-Audio-EditX); Apache-2.0 code, weights licence stated inconsistently; weak content preservation, so re-check words by ASR) |
| Provenance | purple AI region and "N cuts · M AI-voiced phrases" badge | add AudioSeal, MIT, sample-level localization ([AudioSeal](https://arxiv.org/abs/2401.17264)) |

Two gaps in the prototype are visible in the code:

- **No room-tone fill or bandwidth matching for inserts.** Dialogue editors fill gaps with real room tone rather than digital silence ([Post Audio Tips](https://postaudiotips.beehiiv.com/p/dx-fill)). The usual fixes are to harvest the quietest stretches of the same message, or to denoise the whole message first with DeepFilterNet ([DeepFilterNet](https://github.com/Rikorose/DeepFilterNet)).
- **No watermark on generated spans.** This matters beyond the demo. EU AI Act Article 50 has applied since 2 August 2026. Providers of systems that generate synthetic audio must mark their outputs "in a machine readable format and detectable as artificially generated or manipulated", to the extent technically feasible ([Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html)).

Watermarking only the inserted span, then drawing AudioSeal's per-sample detection under the recipient's waveform, turns a compliance duty into a visible trust feature. Descript's own research post does not mention disclosure, watermarking or consent ([Descript research](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)).

Consent comes almost free from the architecture. Every edit is conditioned only on the same message's audio, with no enrollment step, so ReSpeak never holds a reusable voice clone of anyone.

On hardware, the current stack needs the 80 GB card because the LLM alone takes 40 GB. The four editors peak at about 36 GB combined (measured), so with ASR they fit on a 48 GB card if cleanup moves to a smaller model or an API. A 24 GB card would require a much smaller cleanup model. The only small-model data point is the 8B model, and it was tested with the weaker JSON format, so whether a small model with markup is good enough is unknown. At $1.39/hr, a 24-hour hackathon on the A100 costs about **$33**.

## Lead the demo with undo, end it with provenance

The demo should lead with what is both most novel and most reliable: live undo, automatic cleanup and the distractor that *doesn't* change. Word replacement is the second act, and tone is an optional encore. Every beat below can run live on the presenter's voice, and each has a pre-recorded fallback that goes through the same pipeline. The prototype's simulated-stream test path (`lab/live_test.py`) can stream a pre-recorded file through the live WebSocket if the venue microphone or network fails.

| Time | Beat | Live vs fallback | What to say |
|---|---|---|---|
| 0:00–0:20 | Hook: voice notes average 3 min, listeners want 2, 38% replay them ([Sky](https://www.skygroup.sky/article/voice-no-brits-call-time-on-long-voice-notes)) | Slide | "Voice is the best way to sound like yourself, and the worst way to say it cleanly." |
| 0:20–1:00 | Presenter records, says something they regret, presses **Undo**; the sentence vanishes in ~0.35 s and recording carries on | Live mic → pod; fallback: team clip streamed through the same socket | "Undo works on thoughts, not seconds." |
| 1:00–1:40 | Same message includes "Monday, no wait, Wednesday", two "uh"s and a spoken "scratch that"; press **Clean up**: strike-through diff, duration drops | Live; fallback: team-recorded clip | "Every second you hear is your real recording. We only cut." |
| 1:40–2:00 | Distractor: "No, I can't come tonight" stays untouched | Live | "Negations, numbers and dates are protected unless you corrected them yourself." |
| 2:00–2:40 | Click "cafe", type "park"; 3–4 s later it plays in the same voice; the purple region marks the AI phrase | Live with a pre-warmed pod; fallback: cached result | "Generated audio is the exception, and it's labelled." |
| 2:40–3:00 (optional) | "Calm" take offered beside the original | Pre-rendered is fine | "Tone is a suggestion, never a silent edit." |
| 3:00–3:30 | Send to a Discord-style chat; recipient sees the "3 cuts · 1 AI-voiced phrase" badge (and an AudioSeal strip if built) | Live | "The listener knows what changed." |

The build plan puts the de-risking work first. Effort figures are estimates for a team that already has the prototype, not measurements.

| Priority | Task | Est. effort | Why |
|---|---|---|---|
| P0 | Record 30–60 real voice notes from team members (phone and laptop), including distractors; re-run the cleanup, undo and replacement metrics | 3–4 h | Every end-to-end number so far comes from synthetic audio |
| P0 | Real browser-mic capture to the WebSocket (the current live test is simulated); measure undo latency over venue Wi-Fi | 2–3 h | The headline beat depends on it |
| P0 | Boot script that loads all models and runs one dummy edit per engine; cache outputs for the scripted demo; record a full backup video | 1–2 h | AuK's first job costs a 17 s warm-up; venues fail |
| P1 | Verbatim ASR pass (CrisperWhisper 2.0 for the hackathon) after recording stops | 2 h | Whisper drops repetitions and restarts |
| P1 | AudioSeal on inserted spans + detector strip in the recipient view; "send original" button | 2–3 h | Turns ethics into a demo moment; Art. 50 marking |
| P1 | Room-tone fill and low-pass matching for inserts | 2 h | The renderer currently has neither |
| P2 | "Tighten to 2 min" extractive mode: LLM proposes deletions only, shows "3:05 → 1:58" | 3 h | Matches the measured listener pain and needs no synthesis |
| P2 | Seam slide: F0 and RMS jump at each seam, as a percentile against natural word boundaries; a 10-listener "find the edit" test | 2 h | Turns "sounds seamless" into evidence |
| P3 | "HQ retry" button on dots.tts.edit | 1 h | 10/10 reliability when 3 s quality isn't enough |

The claims below are ones the team can defend under questioning, set against tempting claims a knowledgeable judge would take apart.

| Honest to claim | Do not claim |
|---|---|
| "We found no shipped messaging app that semantically edits voice-note audio before sending, as of October 2026." | "Nobody has ever done voice editing like text." (Descript, US8620654, VoiceKeep) |
| "Cleanup only deletes; outside the cuts you hear your original recording, bit-exact." | "Undetectable edits." |
| "Word replacement in 3–4 s on one GPU, confirmed by re-transcription; 9–10 of 10 in our small test on real speech." | "Works for any voice or language." (the editors tested are English- or English/Chinese-focused) |
| "Zero false edits on our 10 distractor sentences; risky words are protected." | "It never changes your meaning." |
| "Tone takes are optional alternatives; the voice drifts measurably." | "AI fixes your tone." |
| "Built by orchestrating open models (Whisper, Qwen, PlayDiffusion, F5, AuK, dots.tts.edit) with our own alignment, splice, verification and safety layers." | "Our model." Or presenting research-licensed weights (F5 CC-BY-NC, AuK's Qwen2.5-Omni-3B dependency) as product-ready |

## Conclusion

Generation is no longer the hard part of editing voice like text. Judgment and plumbing are. In this session, the gains that mattered came from three things: forced alignment instead of ASR timestamps, splicing generated audio back into the original, and a deterministic repair rule wrapped around the LLM. Swapping in a newer generative model did not do as much: a 1.5-second editor that is spliced and checked by ASR beat a more reliable 13-second editor on user experience. ReSpeak's durable advantage is therefore not a model. It is the trust layer: delete-only cleanup, a meaning lock on negations and numbers, and visible provenance for the few AI-voiced words. That is exactly what the market leader's research post leaves out, and what EU law now asks for.

Two risks bound the opportunity. Technically, every quality number here has to be re-earned on real, noisy, spontaneous voice notes, where ASR rather than the editor will decide whether "no wait" is even seen. Strategically, WhatsApp already owns on-device transcription, a tone rewriter and a dictation pipeline, so the gap ReSpeak fills is a window, not a moat. The honest hackathon pitch is that this layer is easy to build now, that cut-first editing makes it trustworthy, and that whoever ships it should put recipient-visible provenance in from the first day.
