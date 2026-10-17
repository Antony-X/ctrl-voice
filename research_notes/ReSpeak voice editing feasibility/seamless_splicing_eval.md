# Seamless splicing and evaluation for ReSpeak (cut-only edits, generated inserts, evaluation, provenance) — state as of 2026-10-17

Verification summary for claims flagged "claimed" in the brief. All four were found and confirmed from primary pages:
- **AnyEdit**: arXiv 2610.15665. v2 is stamped 14 Oct 2026. — [arXiv abs](https://arxiv.org/abs/2610.15665)
- **Descript research post**: "The research behind Descript's seamless video edits", dated June 22, 2026. — [Descript blog](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)
- **SpeechEditBench**: arXiv 2606.01804. v3 is dated 01 Sep 2026. — [arXiv](https://arxiv.org/html/2606.01804v3)
- **ICASSP 2027 Audio Editing Challenge**: GC-4 in the SP Grand Challenges. — [challenge site](https://audio-editing-challenge.github.io/); [ICASSP 2027 SPGC page](https://2027.ieeeicassp.org/sp-grand-challenges/)

---

## Q1. Cut-only edits: cut points, crossfades, pauses, room tone, loudness, and how pro tools handle it

### Takeaway
No standard exists for cut-only seams. Practitioners combine three things: (a) cut in low-energy gaps found by forced alignment, snapped to a zero crossing; (b) a very short fade. Descript uses roughly 5-sample microfades; blogs recommend equal-power crossfades of 20 ms or less (rule of thumb). (c) Fill the gap with real room tone, not digital silence. Most residual seams come from mismatched pitch, emphasis or noise floor across the join, and a crossfade cannot hide those. Fixing them needs pitch smoothing (PSOLA) or regenerating the boundary.

### Cited Findings
**Cut points and clicks**
- Audacity's "At Zero Crossings" (key Z) moves selection edges to a rising zero crossing so the joined waveforms match in height and cuts are "less likely to click". The manual warns that in stereo each channel can cross zero at a different point, so a click can remain in one channel. — [Audacity manual](https://manual.audacityteam.org/man/select_menu_at_zero_crossings.html)
- Users report that zero-crossing edits do not always remove clicks. A steep fall on one side joined to a steep rise on the other still clicks, and the usual forum fix is a short crossfade. — [Audacity forum: zero crossing not working](https://forum.audacityteam.org/t/zero-crossing-not-working/63178); [Audacity forum: tiny click on edit points](https://forum.audacityteam.org/t/tiny-click-on-edit-points/48545); [Audacity Crossfade Clips manual](https://manual.audacityteam.org/man/crossfade_clips.html)
- By default, REAPER adds a very short fade-in and fade-out when it splits an item, to avoid clicks at splits that are not on a zero crossing. ALT+Z splits at a zero crossing a few samples before the cursor. The blog gives no default length in ms. The often-quoted "10 ms" default was not verified. — [reaper.blog](https://reaper.blog/2012/06/editing-audio-items-in-reaper/)
- Descript applies automatic microfades "about five samples in length" between clips at every cut "to ensure that there is no popping noise during playback". They are "not included in timeline exports". — [Descript help: Automatic microfades](https://help.descript.com/hc/en-us/articles/10249332124301)
- Descript's manual crossfades only work at a clip edit boundary. They can fail if no media exists beyond the visible boundary (no handles). — [Descript help: Adding crossfades and fades](https://help.descript.com/hc/en-us/articles/14192664009357)

**Crossfade shape and length**
- Equal-gain (linear) crossfades suit correlated or identical material: for identical content the original is reconstructed exactly. Equal-power (sin/cos, about −3 dB at the midpoint) suits uncorrelated material. With uncorrelated signals, an equal-gain fade produces a ~3 dB dip at the midpoint. — [Pro Tools Expert](https://www.pro-tools-expert.com/home-page/2019/01/04/crossfades-equal-power-or-equal-gain); [Q-SYS crossfader docs](https://help.qsys.com/Content/Schematic_Library/crossfader.htm)
- Fink, Holters and Zölzer (2016) call the equal-gain/equal-power rules of thumb "practically motivated and not perfectly accurate". They propose fade curves derived from the measured correlation of the two signals ("signal-matched power-complementary cross-fading"). — [Fink/Holters/Zölzer 2016 PDF](https://www.hsu-hh.de/ant/wp-content/uploads/sites/699/2017/10/Fink-Holters-Zölzer-2016-Signal-matched-power-complementary-cross-fading-and-dry-wet-mixing.pdf)
- Most real audio has some coherency, so the choice is often a judgment call. — [VI-Control forum](https://vi-control.net/community/threads/equal-power-crossfade-mathv700.38416/)
- Recommended lengths come from practitioner blogs and conflict with each other (rules of thumb, not standards):
  - A post-audio tips newsletter recommends "short equal power crossfades… under 20 msec" for dialogue patching. — [Post Audio Tips](https://postaudiotips.beehiiv.com/p/dx-fill)
  - A creator guide says fades over ~50 ms become a perceptible "blur" on dialogue, and that linear is "typically fine" for dialogue. — [Hollyland](https://store.hollyland.com/blogs/creator-hub/make-perfect-transition-audio)
  - A Resolve guide says to start with the smallest fade that removes the audible problem, and to judge dialogue edits by whether "the consonant, breath, or noise floor changes unnaturally". — [DaVinci Resolve Club](https://davinciresolveclub.com/fade-audio-davinci-resolve.md)
- Forum consensus for syllable-level dialogue edits: the joined syllables must already share "the same pitch, the same tonality, the same emphasis", or no crossfade will hide the join. — [IndieTalk forum](https://indietalk.com/threads/what-am-i-doing-wrong-in-crossfading.35548)

**Room tone and noise floor**
- Descript notes that if an edit point falls in dead air, "variations in room tone or background noise" can make the transition sound disjointed. — [Descript blog: crossfade audio](https://descript.com/blog/article/crossfade-audio-what-crossfade-is-and-how-to-edit-it)
- When no clean room tone exists, dialogue editors stitch together short natural gaps (breaths, small rustles) into fill. — [Post Audio Tips](https://postaudiotips.beehiiv.com/p/dx-fill)
- iZotope RX Ambience Match:
  - It learns ambience from a selection; the selection may include some speech, and a threshold suppresses speech and transients.
  - It then generates matching fill. The older "Static" mode loops ambience and can sound unnatural. "Complex" mode, added in RX 9, regenerates in more detail.
  - Reviewers note it needs clean audio and can sound "static and lifeless".
  - iZotope's Dialogue Match has an Ambience module that analyses the noise profile and re-creates room tone. It is aimed at making ADR match location audio.
  — [MusicTech RX 9 review](https://musictech.com/reviews/izotope-rx-9-review/); [Videomaker on Dialogue Match](https://www.videomaker.com/news/izotope-dialogue-match-saves-hours-in-audio-post-production/); [Gearspace thread](https://gearspace.com/threads/dialog-gating.1062117/)

**Pause-length normalisation (perception data)**
- Ruder & Jensen (1970) had listeners adjust silent gaps. They report a detection threshold (6 or 23 ms; the two abstracts disagree), an optimal fluent pause of ~186 ms, and a minimal hesitation pause of ~505 ms. For pauses within a phrase, silent-interval duration alone was an "insufficient perceptual cue" to tell fluent from hesitation pauses. — [Sonicfield library summary](https://sonicfield.org/library/silent-interval-duration-as-a-perceptual-cue-of-speech-pauses)
- A 2011 thesis found that samples with 250 ms and 450 ms hesitations were rated more dysfluent than samples with 350 ms hesitations, suggesting a possible threshold effect. — [Missouri State thesis](https://bearworks.missouristate.edu/theses/2021)
- In request–response sequences, perceived willingness fell as the pause grew, especially beyond a ~600 ms "tolerance threshold". — [SDU / Interspeech 2017](https://portal.findresearcher.sdu.dk/en/publications/how-long-is-too-long-how-pause-features-after-requests-affect-the/)
- Long pauses containing breath noise are detected more easily than hesitation pauses. — [Trouvain & Werner 2021](https://www.coli.uni-saarland.de/~trouvain/docs/Trouvain_Werner_2021.pdf)

**Loudness (LUFS)**
- BS.1770/EBU integrated loudness is built from 400 ms blocks with 75% overlap. It uses an absolute gate at −70 LUFS and a relative gate 10 LU below the absolute-gated level. An incomplete final block is discarded, so a clip shorter than 400 ms has no defined integrated loudness. — [EBU Tech 3341](https://tech.ebu.ch/docs/tech/tech3341.pdf); [lupy glossary](https://lupy-nocarryr.readthedocs.io/en/stable/glossary.html)

**Locating word boundaries (forced alignment)**
- On TIMIT, word-boundary accuracy (percent of boundaries within the tolerance):

  | Aligner | ≤10 ms | ≤25 ms | ≤50 ms | ≤100 ms |
  |---|---|---|---|---|
  | MFA | 41.6 | 72.8 | 89.4 | 97.4 |
  | WhisperX | 22.4 | 52.7 | 82.4 | 94.2 |
  | MMS | 18.6 | 43.5 | 75.7 | 94.7 |

  — [Rousso et al. 2024, arXiv 2406.19363](https://arxiv.org/html/2406.19363v1)
- On conversational Buckeye, MFA reached 69.9% within 25 ms, against 43.1% for WhisperX and 52.7% for MMS. — [same](https://arxiv.org/html/2406.19363v1)
- Word-level F1 within 20 ms on TIMIT: MFA 65.7, WhisperX 43.5, MMS 35.4. — [same](https://arxiv.org/html/2406.19363v1)
- Generative editors pad aligned word spans to cover co-articulation:
  - SSR-Speech uses WhisperX word alignment plus a margin of α = 0.12 s on each side "to model co-articulation". — [SSR-Speech](https://arxiv.org/html/2409.07556v2)
  - VoiceCraft sweeps its margin ε from 0.05 to 0.14 s. — [VoiceCraft](https://arxiv.org/html/2403.16973v1)

**Automatic seam smoothing research (concatenative TTS "join cost" literature)**
- Kraft (Eurospeech 1993) studied how detectable jumps in energy, F0 and spectrum are at concatenation points. — [ISCA archive](https://www.isca-archive.org/eurospeech_1993/kraft93_eurospeech.html)
- Several groups found that standard spectral distance measures correlate inconsistently with perceived join discontinuity:
  - Vepa, King and Taylor say an ideal join cost would track perceived discontinuity. — [Vepa et al. TTS 2002](https://www.cstr.ed.ac.uk/downloads/publications/2002/vepa_tts02.pdf)
  - Kirkpatrick et al. explored phase-spectrum and wavelet features as alternatives. — [Kirkpatrick et al. Interspeech 2006](https://www.isca-archive.org/interspeech_2006/kirkpatrick06_interspeech.pdf)
  - Bjørkan et al. compared spectral distances with the F0 difference as predictors of perceived discontinuity. — [Bjørkan et al. Interspeech 2005](https://www.isca-archive.org/interspeech_2005/bjrkan05_interspeech.html)
- Legát & Matoušek found that fine pitch contours near the join were enough to classify continuous versus discontinuous joins with high accuracy. — [WCECS 2011](https://www.iaeng.org/publication/WCECS2011/WCECS2011_pp525-529.pdf)
- Vepa & King note that local parameter smoothing is usually needed to mask residual discontinuities. — [Vepa & King IEEE 2005](https://www.cstr.ed.ac.uk/downloads/publications/2005/vepa_king_ieee2005.pdf)

**PSOLA tooling**
- Parselmouth has no native Manipulation class. You call Praat through `parselmouth.praat.call(sound, "To Manipulation", 0.01, 75, 600)`, then "Extract pitch tier", edit it (e.g. "Multiply frequencies" over a time range), "Replace pitch tier", and "Get resynthesis (overlap-add)". — [Parselmouth pitch manipulation example](https://parselmouth.readthedocs.io/en/stable/examples/pitch_manipulation.html)
- The `psola` PyPI package wraps Praat's TD-PSOLA. It takes a numpy array of target pitch values (`psola.vocode`). — [PyPI psola](https://pypi.org/project/psola)

### Inferences
These are rules of thumb synthesised from the findings above. Parameters not stated in a source are labelled as such.

1. **Cut-point recipe (recommended for the demo).**
   - Run MFA. Fall back to WhisperX if MFA struggles with spontaneous voice notes; MFA's boundaries are clearly tighter.
   - For a deleted span [w_i … w_j], search the gap before w_i and the gap after w_j. Put each cut in the lowest-energy 10 ms frame (unsourced value), then snap to the nearest zero crossing.
   - Never cut inside a word or inside a breath. Either keep the whole breath, attached to the following phrase, or remove it entirely and fill with room tone. Half a breath is the classic giveaway.
   - Ending the cut inside the next word's onset consonant (e.g. a leftover /s/ or plosive burst) causes "double phoneme" artifacts. Pad by roughly the margins generative editors use (0.05–0.12 s) and check that the padded region is low-energy.
2. **Crossfade.**
   - Apply a 5–20 ms equal-power (sin/cos) crossfade by default. Across a deletion, the two sides are different material and therefore uncorrelated.
   - Use linear only when crossfading near-identical material, e.g. room tone into the same room tone.
   - Fades much over ~50 ms over speech will smear consonants (rule of thumb from the sources above).
3. **Pause normalisation.**
   - Do not leave the sum of the two flanking pauses. Replace it with a single pause sized to the context:
     - inside a phrase, roughly the speaker's own median inter-word gap;
     - at a phrase or sentence boundary, roughly the speaker's own median sentence pause.
   - Clamp to roughly 150–600 ms. This range is inferred from the perception figures above (186 ms optimal fluent pause, ~500 ms hesitation, 600 ms tolerance); it is not a validated spec.
4. **Room tone.**
   - Fill every new or shortened gap with real room tone, not zeros. Harvest it from the quietest ≥300 ms stretches of the same message (an unsourced value).
   - Tile it with randomised offsets and equal-gain crossfades between tiles, since tone-to-tone material is correlated. Match its RMS to the measured noise floor around the cut.
5. **Loudness.**
   - For short inserts or bridges (under 400 ms) integrated LUFS is undefined. Match the RMS of 100–300 ms windows on each side instead (unsourced window size).
   - Run LUFS normalisation only on the whole final message.
6. **Pitch-jump fix.**
   - If the F0 jump across a join is large compared with natural word boundaries in the same recording (see Q4 scripts), apply PSOLA over roughly the last 50–100 ms before the join and the first 50–100 ms after it. Interpolate the pitch tier linearly between the medians on each side. The window size is unsourced; tune it by ear.
   - An F0 jump usually happens when a cut joins a rising (non-final) contour to a different contour. Prefer cut points at prosodic phrase boundaries.

### Gaps
- No primary, authoritative standard for dialogue crossfade length was found. The 20 ms and 50 ms figures come from blogs.
- REAPER's default split fade length is unverified.
- Descript's handling of cut-only gaps (room-tone fill, pause shortening) is not documented in sources found here. Only the ~5-sample microfade is confirmed.
- No paper was found that specifically evaluates PSOLA, WSOLA or neural-vocoder resynthesis of boundary regions for text-based speech *editing*. The evidence is the older concatenative TTS join-cost literature plus the generative editors under Q2.
- No numeric JND for F0 jumps at joins was retrieved. Kraft 1993 studies this, but the numbers were not extracted.
- WSOLA libraries (audiotsm, pyrubberband) were not checked this session.

---

## Q2. Generated inserts: infilling vs TTS+splice, regenerating larger regions, F0/rate/energy/stress matching, noise/reverb/bandwidth matching

### Takeaway
The 2024–2026 state of the art avoids "TTS + splice". Instead a masked span is infilled by a model conditioned on audio on both sides of the edit. Examples:
- Descript's flow-matching "Audio Regenerate", conditioned on about 5 s of neighbouring audio;
- VoiceCraft and SSR-Speech (codec language models);
- F5-TTS `speech_edit.py`, AST and AnyEdit (flow matching).

These models carry over voice, prosody and room tone implicitly. Explicit environment matching (noise, reverb, background) is a recent frontier (AnyEdit, Oct 2026). For a hackathon:
- infill the edited words plus a ~0.1 s margin with ~5 s of context on each side;
- generate several candidates and auto-rank them;
- splice only the regenerated region back into the original waveform with short crossfades in low-energy frames;
- or denoise the whole message first so clean TTS and clean original match.

### Cited Findings
**Descript (production system, June 22, 2026)**
- For each edit Descript regenerates only the changed region, "conditioned on the untouched audio… around it". The goal is "no audible splice". — [Descript research post](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)
- The codec:
  - encodes audio into continuous latents at "a few dozen vectors per second", with ~4× higher temporal compression than DAC;
  - aligns latents to a pretrained semantic space;
  - separates loudness ("power") into its own channels "so generated audio matches the surrounding level".
  — [same](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)
- The generator:
  - is a flow-matching transformer that masks the span, fills it with noise and denoises it in "a handful of steps", in parallel rather than left to right;
  - is conditioned on the surrounding latents (voice identity, prosody, room tone) and on the target transcript;
  - is zero-shot, needing about five seconds of adjacent audio;
  - replaced an earlier, slower and less expressive autoregressive approach.
  — [same](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)
- The post gives no crossfade or millisecond details. — [same](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)
- Descript's how-to blog says regeneration "can smooth out harsh cuts", and you can "regenerate the audio until it's as seamless as you want". — [Descript blog](https://www.descript.com/blog/article/how-to-use-descript)

**VoiceCraft (ACL 2024)**
- Causal masking moves masked spans to the end of the token sequence, so autoregressive generation can see both past and future context. Edits are spliced back at the token level and the *whole utterance* is decoded by Encodec. — [VoiceCraft](https://arxiv.org/html/2403.16973v1)
- Known failure: excessively long silences or drawn-out sounds when tokens fall into a loop. The mitigation is to generate about 10 candidates, drop the 4 longest and pick from the remaining 6. — [same](https://arxiv.org/html/2403.16973v1)
- RealEdit MOS:

  | System | Naturalness | Intelligibility |
  |---|---|---|
  | Original | 4.17 | 4.22 |
  | VoiceCraft | 4.03 | 4.11 |
  | FluentSpeech | 3.81 | 3.97 |

  Longer edit spans got slightly lower naturalness. — [same](https://arxiv.org/html/2403.16973v1)
- **Conflict:** the Figure 1 caption says listeners preferred VoiceCraft over the original 48% of the time. Table 5 gives 40.3% preferred, 16.2% tie and 43.6% original. — [same](https://arxiv.org/html/2403.16973v1)

**SSR-Speech (2024)**
- Built on WhisperX alignment with a 0.12 s co-articulation margin. — [SSR-Speech](https://arxiv.org/html/2409.07556v2)
- For decoding, the edited segments of the original waveform are replaced with silence. A masked encoder extracts multi-scale features from this masked original, which are fused UNet-style into a watermark-Encodec decoder. The unedited audio is therefore reconstructed using the original waveform rather than from codec tokens alone. — [same](https://arxiv.org/html/2409.07556v2)
- Inference-only classifier-free guidance uses stride β = 5 and scale γ = 1.5. The paper notes CFG can speed up speech. — [same](https://arxiv.org/html/2409.07556v2)
- Code: [github.com/WangHelin1997/SSR-Speech](https://github.com/WangHelin1997/SSR-Speech)

**F5-TTS speech editing script (open source, easy to run)**
- `src/f5_tts/infer/speech_edit.py` takes `parts_to_edit` (start and end seconds) and `fix_duration` (new length per span; `None` keeps the original length). It zero-fills those spans in the conditioning audio and builds a mel-frame `edit_mask`. — [F5-TTS speech_edit.py (HF mirror)](https://huggingface.co/spaces/John6666/E2-F5-TTS-rc/blob/main/src/f5_tts/infer/speech_edit.py)
- It then calls `model.sample(cond, text, duration, steps=32, cfg_strength=2.0, sway_sampling_coef=-1.0, edit_mask=...)`. Comments point to `ctc-forced-aligner` for timestamps. — [same](https://huggingface.co/spaces/John6666/E2-F5-TTS-rc/blob/main/src/f5_tts/infer/speech_edit.py)
- Input quieter than RMS 0.1 is boosted to 0.1 and scaled back afterwards. — [same](https://huggingface.co/spaces/John6666/E2-F5-TTS-rc/blob/main/src/f5_tts/infer/speech_edit.py)
- **The output is the entire re-vocoded mel, not a splice into the original waveform.** — [same](https://huggingface.co/spaces/John6666/E2-F5-TTS-rc/blob/main/src/f5_tts/infer/speech_edit.py)
- These are mirrors and may lag the upstream repo. — [same](https://huggingface.co/spaces/John6666/E2-F5-TTS-rc/blob/main/src/f5_tts/infer/speech_edit.py)

**AST (training-free, 2026)**
- Builds on IndexTTS-2 (an AR semantic model plus a DiT flow-matching decoder). It inverts the source mel to latents with an inverse ODE. Words unchanged between source and target (found by LCS) reuse the inverted latents; edited words start from noise. — [AST, arXiv 2604.16056](https://arxiv.org/html/2604.16056)
- "Adaptive Weak Fact Guidance" blends the velocity field toward the recomposed mel with frame-wise weight γ = λ(1 − e^(−d_k)), with λ = 0.8. This is not a crossfade. — [same](https://arxiv.org/html/2604.16056)

**Semantic-space editing ("Edit Content, Preserve Acoustics", Jan 2026)**
- Argues that acoustic-token editors entangle content and style, which "often compromises robustness, leading to hallucinations and boundary artifacts". — [arXiv 2602.00560](https://arxiv.org/html/2602.00560v1)
- Infills *semantic* tokens instead, with prefix–suffix–middle formatting, and leaves acoustics to a flow-matching decoder. GRPO fine-tuning uses a "self-consistency" reward from a frozen CosyVoice3, plus an ASR reward gated on WER and duration error ≤ 0.2. — [same](https://arxiv.org/html/2602.00560v1)

**Context-conditioned vocoding (UniCATS, AAAI 2024)**
- CTX-txt2vec generates semantic tokens. CTX-vec2wav vocodes them while conditioning on the surrounding acoustic context. Editing differs from continuation only by adding the following context segment. — [UniCATS arXiv](https://arxiv.org/abs/2306.07547); [AAAI](https://ojs.aaai.org/index.php/AAAI/article/view/29747)

**Environment matching (noise, reverb, background)**
- AnyEdit is "separation-free". An AR editor predicts clean prosody and content tokens, then a flow-matching model renders mel conditioned on the source recording's mel prompt, so the edit "inherits surrounding noise, reverberation, and background sound". — [AnyEdit](https://arxiv.org/html/2610.15665)
- AnyEdit's "Mixed-Condition Training": the target mel is clean in 50% of batches and noisy in the rest, while conditioning tokens are always clean. This forces the model to copy the environment from the prompt. Training noise comes from DNS Challenge, WHAM! and AudioSet at −5 to 20 dB SNR, with RT60 up to 1.5 s. — [same](https://arxiv.org/html/2610.15665)
- AnyEdit has no separate boundary-blending mechanism in the visible text. Unchanged spans longer than 4 tokens (by LCS) get loss weight λ = 5.0 to reduce prosody drift. — [same](https://arxiv.org/html/2610.15665)
- DeepFilterNet:
  - full-band 48 kHz noise suppression;
  - `pip install deepfilternet`, CLI `deepFilter file.wav`, Python `init_df()` / `enhance(model, df_state, audio)`;
  - MIT/Apache-2.0;
  - the `deep-filter` binary accepts only 48 kHz WAV.
  — [DeepFilterNet GitHub](https://github.com/Rikorose/DeepFilterNet)
- Resemble Enhance:
  - a denoiser plus an enhancer that "extend[s] the audio bandwidth";
  - trained on 44.1 kHz speech;
  - `pip install resemble-enhance`, `resemble-enhance in_dir out_dir [--denoise_only]`;
  - MIT;
  - no published BWE benchmarks on the page.
  — [Resemble Enhance GitHub](https://github.com/resemble-ai/resemble-enhance)
- DeepFilterNet appears as a specialised baseline for the "acoustic" editing dimension in SpeechEditBench. — [SpeechEditBench](https://arxiv.org/html/2606.01804v3)

**Stress / contrastive emphasis**
- CosyVoice-300M-Instruct supports inline `<strong></strong>`, `<laughter></laughter>`, `[laughter]` and `[breath]`. — [CosyVoice model card mirror](https://huggingface.co/gpustack/CosyVoice-300M-SFT)
- CosyVoice2-0.5B advertises "more granular emotional controls" and points to `tokenizer.py` for the supported tags, but its full tag list was not confirmed. — [CosyVoice2 card](https://huggingface.co/FunAudioLLM/CosyVoice2-0.5B)
- SpeechEditBench operationalises prosody edits as a duration ratio, a median F0 shift of at least 0.3 semitones, and a "prominence gain" for stress. — [SpeechEditBench](https://arxiv.org/html/2606.01804v3)

### Inferences
1. **Infill, don't splice TTS.**
   - Every system that reports near-original naturalness (Descript, VoiceCraft, SSR-Speech, AST, AnyEdit) conditions on audio on *both* sides of the edit.
   - A separate TTS clip spliced in has none of that: speaker-adaptive TTS conditioned on the speaker still lacks the local F0 trajectory, speaking rate and room.
   - Use TTS + splice only as a fallback.
2. **Regenerate a slightly larger region.**
   - Mask the edited words plus margins of ~0.05–0.12 s, the values VoiceCraft and SSR-Speech use. If the edit changes sentence focus, mask the whole prosodic phrase or clause.
   - Supply about 5 s of context on each side; Descript's figure is for its own model, so take it as a guide.
   - Bigger masks give the model room to re-plan intonation, at the cost of rewriting more real audio.
3. **Splice the generated region back into the original waveform.** F5-TTS and VoiceCraft re-decode or re-vocode the whole utterance, which slightly degrades untouched audio and can shift timing. A cheap fix:
   - take the model output only inside the masked region plus margin;
   - align it to the original time base (the unmasked frames should line up because the mask preserves them);
   - crossfade back into the original at the lowest-energy frames inside each margin, using 10–20 ms equal-power fades (rule of thumb).
   SSR-Speech's design (reconstructing unedited parts from the original waveform) is the research version of the same idea.
4. **Candidate generation plus auto-ranking (cheap and effective).**
   - Generate N = 5–10 candidates with different seeds; this follows VoiceCraft's 10-candidate trick.
   - Score each on:
     - ASR WER of the edited words;
     - speaker cosine similarity of the edited span against the rest of the message;
     - boundary F0 jump and energy jump (see the Q4 script);
     - duration plausibility (reject long silences or loops).
   - Pick the best candidate.
5. **Environment strategy, in order of effort.**
   - **(A) Denoise everything first.** Run DeepFilterNet or Resemble Enhance on the whole message, then edit. Both sides are clean, so mismatch disappears; the trade-off is that the "real recording" character is lost.
   - **(B) Infill with an in-context model.** VoiceCraft, F5 and SSR-Speech condition on noisy context. Whether they reproduce noise well is not quantified except in AnyEdit's tables, where SSR-Speech, Step-EditX and similar systems scored lower on background similarity than AnyEdit.
   - **(C) Clean insert plus re-added room tone.** Mix harvested room tone (Q1) under the insert at the measured noise floor. Optionally convolve with a short reverb tail estimated by ear. Blind RIR estimation was not researched here.
6. **Bandwidth matching** (rule of thumb, not sourced).
   - Phone or Opus voice notes are often band-limited (e.g. 16 kHz sampling means content stops at ≤8 kHz), while TTS outputs 24–48 kHz full-band.
   - Measure the source's effective bandwidth (where the long-term spectrum falls to the noise floor), then low-pass the insert to match before splicing.
   - Alternatively, upsample and enhance the whole message (Resemble Enhance) so both sides are wideband.
   - Never leave a wideband insert inside a narrowband recording: the sudden "air" is a seam.
7. **Contrastive stress.** When correcting a word, as in "Tuesday → *Wednesday*", natural speech often stresses the corrected word. Options:
   - an emphasis tag (CosyVoice `<strong>`), if using a TTS that supports it;
   - post-hoc PSOLA to raise F0 by a few semitones and lengthen the word by ~10–20%. These values are unsourced; SpeechEditBench uses ≥0.3 semitones only as a *detectability* threshold.
   - For seamlessness, the default should be *no* added emphasis unless the user marks it.

### Gaps
- No public, quantitative study was found comparing "infill" with "TTS + splice + crossfade" on the same data.
- Whether Descript Regenerate matches room tone beyond its latent conditioning is not stated in its post. Third-party claims about "room ambience matching" are uncorroborated.
- Blind RIR estimation and convolution for inserts was not researched or verified, so no sourced recipe is given.
- No sourced evaluation of bandwidth mismatch as a seam cue was found.
- Whether F5-TTS's unmasked frames reproduce the input exactly depends on `model.sample`, which was not inspected.
- AnyEdit code availability: no repository link appeared in the visible paper text. The demo and benchmark are public.

---

## Q3. Papers: what they do and what they report

### Takeaway
Most text-based editing papers since 2023 target boundary and prosody consistency through *training objectives* (FluentEditor/2) or *bidirectional-context generation* (VoiceCraft, SSR-Speech, UniCATS, AST, Descript). AnyEdit (Oct 2026) is the first found that explicitly targets real-world environment continuity (noise, reverb, background) and measures it (SIM-bg, RT60Err, SNRErr). Reported numbers are all on read-speech benchmarks (VCTK, LibriTTS, LibriSpeech, RealEdit), not on phone voice notes.

### Cited Findings
**FluentEditor (2023)**
- Text-based speech editing with acoustic and prosody consistency losses, evaluated on VCTK. — [arXiv 2309.11725](https://arxiv.org/abs/2309.11725)

**FluentEditor2 (Sep/Dec 2024; Liu, Xi, Jiang, Li)**
- Adds a "hierarchical local acoustic smoothness constraint" at frame, phoneme and word level. It is an MSE between predicted and ground-truth feature *differences* across the left and right boundaries, used with word-level masking. — [arXiv 2410.03719](https://arxiv.org/html/2410.03719v2)
- Adds a "contrastive global prosody consistency constraint": a GST prosody embedding of the masked region is pulled toward the whole utterance and pushed away from other utterances. — [same](https://arxiv.org/html/2410.03719v2)
- Objective results:

  | Model | VCTK MCD | VCTK STOI | VCTK PESQ | LibriTTS MCD |
  |---|---|---|---|---|
  | FluentEditor2 | 5.836 | 0.815 | 1.977 | 4.537 |
  | FluentEditor | 5.896 | 0.805 | 1.969 | 4.574 |
  | FluentSpeech | 5.902 | 0.801 | 1.953 | 4.573 |

  On LibriTTS, STOI and PESQ were marginally below FluentEditor. — [same](https://arxiv.org/html/2410.03719v2)
- Fluency MOS on VCTK (insertion / replacement / deletion):

  | System | Insertion | Replacement | Deletion |
  |---|---|---|---|
  | Ground truth | 4.428 | 4.422 | 4.424 |
  | FluentEditor2 | 4.314 | 4.286 | 4.177 |
  | FluentEditor | 4.073 | 4.114 | 3.991 |

  — [same](https://arxiv.org/html/2410.03719v2)
- Demos: [github.com/Ai-S2-Lab/FluentEditor2](https://github.com/Ai-S2-Lab/FluentEditor2)

**AnyEdit (arXiv 2610.15665, v2 14 Oct 2026; CUHK-Shenzhen, Huawei, City Univ. Macau, Amphion)**
- Edits both speech and singing. A noise-robust prosody tokenizer improved token match on degraded input from 0.6081 to 0.7037. — [AnyEdit](https://arxiv.org/html/2610.15665)
- Training data: ~3,000 h per language of same-speaker speech pairs built from Emilia. — [same](https://arxiv.org/html/2610.15665)
- English speech, real-world subset (Table 2):

  | Metric | AnyEdit | Best baseline |
  |---|---|---|
  | WER | 0.0616 | 0.0778 (Vevo2) |
  | SIM-spk | 0.9675 | 0.9652 (SSR-Speech) |
  | SIM-bg (CLAP) | 0.7705 | 0.6418 (Step-Audio-EditX) |

  — [same](https://arxiv.org/html/2610.15665)
- Subjective speech results:

  | Metric | AnyEdit | Vevo2 |
  |---|---|---|
  | N-MOS | 4.48 | 4.15 |
  | S-MOS | 4.45 | 4.02 |
  | Fooling rate | 46.5% | 31.5% |

  — [same](https://arxiv.org/html/2610.15665)
- Not uniformly best:
  - Chinese simulated-subset CER was 0.1184 against 0.0875 for Step-EditX.
  - At 0 dB SNR, WER was 0.386 against 0.196 for Vevo2, although SNR error was far lower (3.368 against 13.321).
  — [same](https://arxiv.org/html/2610.15665)
- AnyEditBench has 600 items: 12 subsets of 50, covering speech and singing × EN and ZH × clean, simulated and real-world. — [HF dataset](https://huggingface.co/datasets/Ririiiii/anyeditbench); [demo](https://any-edit.github.io/)

**Descript research post (June 22, 2026; Xingzhe He et al.)**
- Described under Q2. It gives no quantitative results, crossfade details or ms timings. — [Descript](https://www.descript.com/blog/article/the-research-behind-descripts-seamless-video-edits)

**VoiceCraft (ACL 2024)**
- Causal masking plus delayed stacking. — [VoiceCraft](https://arxiv.org/html/2403.16973v1)
- RealEdit results: MOS as in Q2; WER (Whisper medium.en) was 6.1 against 5.4 for the original and 4.5 for FluentSpeech. The paper notes FluentSpeech's lower WER conflicts with its lower human intelligibility rating. — [same](https://arxiv.org/html/2403.16973v1)
- The "48% preferred over original" figure (caption) conflicts with Table 5's 40.3%; treat it as unverified. — [same](https://arxiv.org/html/2403.16973v1)

**SSR-Speech (2024)**
- RealEdit:

  | System | WER | SpkSIM | MOS | MOSNet |
  |---|---|---|---|---|
  | Ground truth | 0.047 | — | 4.139 | 3.700 |
  | SSR-Speech | 0.048 | 0.929 | 4.121 | 3.707 |
  | VoiceCraft (single run) | 0.069 | 0.903 | 3.973 | 3.460 |
  | VoiceCraft⋆ (10 margin runs) | 0.054 | 0.914 | — | 3.655 |

  Confidence intervals overlap. — [SSR-Speech](https://arxiv.org/html/2409.07556v2)
- Its watermark detector reports 99.9% binary accuracy. — [same](https://arxiv.org/html/2409.07556v2)

**AST (arXiv 2604.16056, v2 Aug 2026; Zhejiang University)**
- Training-free method built on IndexTTS-2. LibriSpeech-Edit test-clean results:

  | Metric | AST | SSR-Speech |
  |---|---|---|
  | MOS | 4.044 | 3.986 |
  | WER | 0.0359 | 0.0508 |
  | SpkSim | 0.9806 | 0.9732 |
  | WDTW | 0.2162 | 0.2189 |

  — [AST](https://arxiv.org/html/2604.16056)
- Removing its guidance raised WER to 0.0563. No code link was visible. — [same](https://arxiv.org/html/2604.16056)

**Edit Content, Preserve Acoustics (arXiv 2602.00560, Jan 2026; CASIA/Tsinghua)**
- Substitution, against VoiceCraft:

  | System | WER | SIM | DNSMOS | MOS |
  |---|---|---|---|---|
  | This paper (with GRPO) | 4.13 | 0.78 | 3.15 | 4.05 |
  | VoiceCraft | 11.98 | 0.58 | 3.01 | 3.60 |

  — [arXiv 2602.00560](https://arxiv.org/html/2602.00560v1)
- **Internal inconsistency:** the text claims deletion WER of 0.47% / 0.82%, but Table I shows 6.91 / 6.88. — [same](https://arxiv.org/html/2602.00560v1)

**UniCATS (AAAI 2024)**
- Claims state-of-the-art for continuation and editing. CTX-vec2wav beat HiFiGAN and AudioLM at resynthesising from semantic tokens. Specific numbers were not retrieved. — [arXiv 2306.07547](https://arxiv.org/abs/2306.07547); [AAAI](https://ojs.aaai.org/index.php/AAAI/article/view/29747)

**EdiTTS (Interspeech 2022)**
- Training-free, score-based (Grad-TTS) editing of content and pitch. It perturbs the Gaussian prior, with masks and "softening kernels" to keep changes local. — [arXiv 2110.02584](https://arxiv.org/abs/2110.02584v2); [ISCA](https://www.isca-archive.org/interspeech_2022/tae22_interspeech.html)
- Code: [GitHub](https://github.com/MaxMax2016/editts)
- The authors report beating baselines in listening tests and back-transcription. Numbers were not verified.

**Survey**
- "Speech Editing — a Summary" (Kässmann, Liu, Liu; July 2024) reviews text-based editing. Only the abstract was read. — [arXiv 2407.17172](https://arxiv.org/abs/2407.17172)

### Inferences
- **Most practical for a hackathon** (code available, English, runs on one GPU): F5-TTS `speech_edit.py`, SSR-Speech, then VoiceCraft. AST and AnyEdit are the most relevant research ideas, but no code link was confirmed.
- **The best idea to borrow cheaply from AnyEdit:** condition on *noisy* context so environment carries over, and measure background continuity with CLAP similarity (SIM-bg) plus RT60/SNR error.
- **The best idea to borrow from FluentEditor2:** its boundary-smoothness criterion is in effect a metric. Compare feature differences across the seam with those at natural boundaries. That is directly reusable for evaluation (Q4).

### Gaps
- FluentEditor (v1) standalone numbers come only via FluentEditor2's comparison table; its own paper was not opened.
- UniCATS and EdiTTS quantitative results were not verified.
- AnyEdit's last ~30% of text (appendix) was not read.
- AnyEdit and AST code availability is unconfirmed.
- CosyEdit ([arXiv 2601.05329](https://arxiv.org/pdf/2601.05329)) and Step-Audio-EditX appeared in results but were not examined.

---

## Q4. Evaluation: benchmarks, challenges, metrics, listening tests, and scripts

### Takeaway
New 2026 benchmarks score *whether the edit was done and the rest preserved*, not *whether the seam is audible*:
- SpeechEditBench uses ASR, speaker-similarity and LLM-judge thresholds;
- the ICASSP 2027 Audio Editing Challenge uses Qwen3-Omni rubric judging.

For seamlessness, the strongest published signals are:
- AnyEdit's human "Fooling Rate", SIM-bg, RT60Err and SNRErr;
- AST's WDTW;
- MOS / fluency MOS (FluentEditor2).

A demo team should combine automatic metrics (WER on the edited region, speaker similarity, DNSMOS, boundary F0 and energy jumps against a natural-boundary baseline) with a small "find the edit" listening test.

### Cited Findings
**SpeechEditBench (arXiv 2606.01804, v3 Sep 1, 2026; CityU HK and Huawei)**
- Covers 7 atomic tasks (content, speaker, emotion, style, prosody, paralinguistic, acoustic) plus compositional tasks. It has 4,700 pairs (2,400 EN, 2,300 ZH). — [SpeechEditBench](https://arxiv.org/html/2606.01804v3)
- Anchor-based scoring: joint = target × preservation. — [same](https://arxiv.org/html/2606.01804v3)
  - Preservation passes when ASR WER/CER ≤ 10%.
  - Speaker edits pass when speaker cosine similarity ≥ 0.50.
  - Prosody edits pass on F0 shift ≥ 0.3 semitones, a duration ratio, or prominence gain.
  - Acoustic edits pass on DNSMOS gain, RT60 within 0.8–1.2× target, or a PANNs scene match.
- Content-editing joint success:

  | Model | Joint success |
  |---|---|
  | GPT-Realtime | 96.67% |
  | Gemini-Live | 93.17% |
  | VoiceCraft-X | 84.00% EN / 47.00% ZH |
  | Ming-UniAudio | 76.46% |
  | Step-Audio-EditX | 16.50% |

  "No single model performs well across all editing dimensions". — [same](https://arxiv.org/html/2606.01804v3)
- Code (Apache-2.0): [GitHub](https://github.com/daxintan-cuhk/SpeechEditBench)

**ICASSP 2027 Audio Editing Challenge (GC-4)**
- Instruction-based editing across speech, music, sound and mixtures, in two tracks:
  - Track 1, Single Model: one end-to-end model.
  - Track 2, Agent: may orchestrate open-source models and DSP tools whose weights were public before Nov 1, 2026.
  — [challenge site](https://audio-editing-challenge.github.io/)
- Metrics: Instruction Following Rate, Consistency Rate and Exact Match Rate. Rubrics are scored by a frozen Qwen3-Omni judge (3 shuffled runs, majority vote), and ranking is by EMR. No subjective metrics are listed. — [same](https://audio-editing-challenge.github.io/)
- The public MMAE test set has 2,000 examples and 17,741 rubrics. Each track is evaluated on 500 hidden examples. — [same](https://audio-editing-challenge.github.io/)
- Baselines: AuK for Track 1. Track 2 uses DeepSeek-V4-Flash as router, DSP tools, SAM-Audio-Large and AuK. — [same](https://audio-editing-challenge.github.io/); [baseline repo](https://github.com/Audio-Editing-Challenge/Audio-Editing-Challenge-Baseline)
- Dates:
  - challenge start: Oct 1, 2026;
  - test set and leaderboard: Nov 10, 2026;
  - final submission: Nov 25, 2026;
  - rankings: Dec 8, 2026;
  - 2-page papers: Jan 7, 2027.
  — [same](https://audio-editing-challenge.github.io/); [ICASSP SPGC](https://2027.ieeeicassp.org/sp-grand-challenges/)
- Prizes: USD 7,000 total, sponsored by Tencent. — [same](https://audio-editing-challenge.github.io/)

**Metrics used in editing papers**
- **AnyEdit:**
  - WER/CER with Whisper-large-v3;
  - SIM-spk with WavLM;
  - F0 correlation;
  - SIM-bg (CLAP similarity of background);
  - RT60Err and SNRErr;
  - N-MOS and S-MOS;
  - "Fooling Rate", the share of listeners fooled.
  — [AnyEdit](https://arxiv.org/html/2610.15665)
- **AST:** MOS (10 listeners × 50 clips), WER (Qwen3-ASR), DNSMOS, WavLM speaker similarity, and word-level DTW (WDTW) for temporal fidelity, with alignment by Qwen3-ForcedAligner-0.6B. — [AST](https://arxiv.org/html/2604.16056)
- **SSR-Speech:** WER, SpkSIM, MOS, MOSNet. — [SSR-Speech](https://arxiv.org/html/2409.07556v2)
- **FluentEditor2:** MCD, STOI, PESQ, plus MOS, fluency MOS (FMOS) and intelligibility MOS (IMOS). — [FluentEditor2](https://arxiv.org/html/2410.03719v2)
- **"Edit Content, Preserve Acoustics":** WER, WavLM SIM, DNSMOS, MOS. — [arXiv 2602.00560](https://arxiv.org/html/2602.00560v1)
- **ZipVoice eval:** `sim.py` computes speaker similarity with a WavLM-based ECAPA-TDNN verifier (cosine). This is a reusable reference implementation. — [ZipVoice sim.py](https://huggingface.co/spaces/Luigi/ZipVoice-DEMO/blob/main/zipvoice/eval/speaker_similarity/sim.py)
- **Join-cost literature:** spectral distances correlate inconsistently with perceived join discontinuity, so human tests remain necessary. — [Kirkpatrick et al. 2006](https://www.isca-archive.org/interspeech_2006/kirkpatrick06_interspeech.pdf); [Vepa & King 2005](https://www.cstr.ed.ac.uk/downloads/publications/2005/vepa_king_ieee2005.pdf)

**Listening-test tooling**
- webMUSHRA (Fraunhofer IIS / AudioLabs Erlangen, JORS 2018) is a browser MUSHRA framework. It complies with ITU-R BS.1534, uses the Web Audio API, and also supports BS.1116 and forced-choice procedures. — [AudioLabs webMUSHRA](https://audiolabs-erlangen.com/resources/webMUSHRA); [JORS paper](https://reference-global.com/article/10.5334/jors.187)
- BeaqleJS is a browser framework supporting ABX and MUSHRA. — [BeaqleJS GitHub](https://github.com/jfsantos/beaqlejs)

**Automatic edit detection (possible "machine find-the-edit" judge)**
- A 2026 paper unifies speech-editing detection with localisation of the edited content using audio LLMs. It was not examined. — [arXiv 2601.21463](https://arxiv.org/html/2601.21463v3)

### Inferences
**Recommended demo evaluation protocol**
1. **Content.** Run ASR (Whisper) on the full edited message and compute WER against the intended transcript. Also report WER restricted to the edited words via alignment.
2. **Identity.** Compute speaker cosine similarity between the edited region (plus margin) and the untouched rest of the same message, using ECAPA (SpeechBrain) or WavLM-based ECAPA (ZipVoice `sim.py`).
3. **Quality.** Run DNSMOS (SIG/BAK/OVRL) on the whole message, before and after the edit. A drop in BAK in particular signals noise-floor discontinuity.
4. **Seam metrics, calibrated against the same recording.** At each seam, compute:
   - the F0 jump in semitones (median F0 over 60 ms each side);
   - the RMS jump in dB (50 ms each side);
   - the log-mel spectral distance between 30 ms windows on each side.

   Compute the same three numbers at every *natural* word boundary of the unedited original. Report each seam's percentile within that natural distribution: below the 90th percentile means "statistically indistinguishable", an operational definition inferred from the join-cost literature. This is cheap, explainable on a slide and needs no ground truth.
5. **Environment.** Estimate the noise floor (lowest-energy frame percentiles) in a ±1 s window on each side of every seam, and compare. Optionally compute CLAP similarity of the background, as in AnyEdit's SIM-bg.
6. **Humans.**
   - Run a 2AFC/ABX test (BeaqleJS): "which of these two clips was edited?" Chance is 50%. A fooling rate near 50% means the edit is undetectable; AnyEdit reports 46.5%, but its exact protocol was not read.
   - Run a "click where the edit is" test. Report detection rate and localisation error.
   - Even 10 listeners × 10 clips is a convincing hackathon slide; this is an inference, not a powered study.

**Minimal scripts** (untested sketches). APIs for parselmouth, AudioSeal and DeepFilterNet match their docs, which are cited. The `pyloudnorm` and `speechbrain` calls come from general knowledge and were not re-verified this session.

```python
import numpy as np, soundfile as sf, parselmouth

def best_cut(w, sr, lo, hi, frame_ms=10):
    # lowest-energy frame inside [lo,hi] s, snapped to nearest zero crossing
    f = int(sr*frame_ms/1000); a = int(lo*sr); seg = w[a:int(hi*sr)]
    e = [np.mean(seg[i:i+f]**2) for i in range(0, max(1, len(seg)-f), f//2)]
    c = a + int(np.argmin(e))*(f//2) + f//2
    zc = np.where(np.diff(np.signbit(w[c-f:c+f])))[0]
    return c - f + zc[np.argmin(np.abs(zc-f))] if len(zc) else c

def xfade(a, b, sr, ms=10, power=True):
    n = int(sr*ms/1000); t = np.linspace(0, 1, n)
    ga, gb = (np.cos(t*np.pi/2), np.sin(t*np.pi/2)) if power else (1-t, t)
    return np.concatenate([a[:-n], a[-n:]*ga + b[:n]*gb, b[n:]])

def seam_stats(w, sr, t, f0win=0.06, ewin=0.05):
    p = parselmouth.Sound(w, sr).to_pitch(time_step=0.005, pitch_floor=75, pitch_ceiling=500)
    ts, f0 = p.xs(), p.selected_array['frequency']
    L, R = f0[(ts>t-f0win)&(ts<t)&(f0>0)], f0[(ts>t)&(ts<t+f0win)&(f0>0)]
    st = 12*np.log2(np.median(R)/np.median(L)) if len(L) and len(R) else np.nan
    rms = lambda x: np.sqrt(np.mean(x**2)) + 1e-9
    db = 20*np.log10(rms(w[int(t*sr):int((t+ewin)*sr)]) / rms(w[int((t-ewin)*sr):int(t*sr)]))
    return st, db   # compare against the same stats at natural word boundaries

def psola_bridge(w, sr, t, half=0.08):
    # linearly interpolate F0 across [t-half, t+half] via Praat overlap-add
    from parselmouth.praat import call
    s = parselmouth.Sound(w, sr); m = call(s, "To Manipulation", 0.01, 75, 600)
    pt = call(m, "Extract pitch tier")
    # read median F0 just outside the window, then remove points inside and add 2 anchors
    p = s.to_pitch(); f = lambda a,b: np.median([v for x,v in zip(p.xs(), p.selected_array['frequency']) if a<x<b and v>0])
    f_l, f_r = f(t-half-0.05, t-half), f(t+half, t+half+0.05)
    call(pt, "Remove points between", t-half, t+half)
    call(pt, "Add point", t-half, f_l); call(pt, "Add point", t+half, f_r)
    call([pt, m], "Replace pitch tier")
    return call(m, "Get resynthesis (overlap-add)").values[0]
```

**Room-tone fill sketch (inference).** Take the 20th-percentile-energy 50 ms frames from inter-word gaps (by alignment). Concatenate runs of at least 300 ms. Then fill each gap by tiling those runs with random start offsets and 20–30 ms *linear* crossfades between tiles (tone-to-tone material is correlated), scaled to the local noise RMS.

### Gaps
- No standard seam-specific metric exists in the 2026 benchmarks; SpeechEditBench and MMAE judge instruction-following and preservation. The percentile-against-natural-boundaries metric above is this researcher's proposal, not a published one.
- UTMOS / UTMOSv2 usage, and the DNSMOS repo location, were not verified from primary pages this session. Both are widely used (DNSMOS P.835 SIG/BAK/OVRL appeared in search snippets).
- AnyEdit's exact "Fooling Rate" protocol and listener count were not read.
- Whether webMUSHRA itself supports ABX was not confirmed; BeaqleJS does.

---

## Q5. Watermarking and provenance of generated segments

### Takeaway
It is cheap enough for the demo. AudioSeal:
- installs with `pip install audioseal` (MIT code and weights);
- embeds a 16-bit message additively;
- has a detector that outputs *per-sample* (1/16,000 s) watermark probability, so a UI can highlight exactly which spans are AI-generated.

SSR-Speech shows the same idea built into an editor: frame-level watermarks on edited regions, with 99.9% reported detection accuracy.

### Cited Findings
- AudioSeal (Meta, ICML 2024) jointly trains a generator and detector with a localisation loss, giving detection "up to the sample level". Detection is single-pass and "up to two orders of magnitude faster" than existing models. — [AudioSeal arXiv](https://arxiv.org/abs/2401.17264)
- Installation and models:
  - `pip install audioseal`;
  - models `audioseal_wm_16bits` / `audioseal_detector_16bits`;
  - 16-bit payload (65,536 values, e.g. a model or version ID); the message is optional and does not affect detection.
  — [AudioSeal GitHub](https://github.com/facebookresearch/audioseal)
- Usage:
  - `wm = model.get_watermark(wav)`; `out = wav + wm`;
  - `detector.detect_watermark(out)` returns a probability and the message;
  - the low-level `detector(out)` returns shape batch × 2 × frames, where `result[:,1,:] > 0.5` marks watermarked samples.
  — [same](https://github.com/facebookresearch/audioseal)
- Works well at 16 and 24 kHz and for most speech at 48 kHz. — [same](https://github.com/facebookresearch/audioseal)
- Licensing: MIT for code, and MIT for weights since 2024-04-02, so commercial use is allowed. — [same](https://github.com/facebookresearch/audioseal)
- v0.2 (2024-12-12) adds streaming models. — [same](https://github.com/facebookresearch/audioseal)
- SSR-Speech's watermark Encodec embeds frame-level labels (1 for edited frames, 0 otherwise) into the decoder. A predictor with an Encodec-encoder backbone plus a binary classifier detects them at 99.9% accuracy. No false-positive rates are reported. — [SSR-Speech](https://arxiv.org/html/2409.07556v2)

### Inferences
- **Demo recipe.** After the insert's final processing (loudness match, room tone, low-pass), watermark *only the generated span* with AudioSeal, then splice. Run the detector on the final message and draw the per-sample probability under the waveform. That gives a "provenance strip" showing which words are AI-generated, which is a strong trust story for ReSpeak.
- Apply the watermark after any processing that might weaken it. Robustness to specific operations was not checked here: the paper claims robustness, but per-operation numbers were not extracted.
- Watermarking only the insert means crossfade regions are partially marked. Expect the detector's span edges to be soft; mark the region plus margin if a crisp UI band is wanted.
- **Cost:** a single small model forward pass for embedding and one for detection. Exact timings were not retrieved.

### Gaps
- AudioSeal's robustness numbers (to MP3/Opus compression, resampling, crossfading) and false-positive rates were not extracted. This matters because voice messages are usually Opus-compressed.
- C2PA or other metadata-based provenance for audio messages was not researched.
- No evaluation was found of whether watermarking a short inserted span is itself audible at a seam.
