# Real human speech datasets for testing ReSpeak features (verified 2026-10-17)

Method note: the gating flags, licences, row counts and parquet sizes below come from live Hugging Face Hub API calls (`https://huggingface.co/api/datasets/<id>`, the `gated` field) and the HF datasets-server `size` and `first-rows` endpoints, all made on 2026-10-17. Non-HF links were checked with HTTP HEAD requests on the same day: HTTP 200 plus a content-length means the direct download works. `gated=False` means anyone can download anonymously. `gated=auto` means the user must log in and click "agree" on the HF page, and approval is automatic. `gated=manual` means the owner approves each request by hand. Every dataset listed contains recordings of real people. None are synthetic. Acted or re-read material is flagged where relevant.

## Q1. Which datasets fit each ReSpeak feature, and what is in them (contents, annotations, licence, access, size)?

### Takeaway
At least one ungated, real-speech dataset can be downloaded today for every feature except grammar errors with corrected transcripts.
- **Self-corrections and disfluencies:** DisfluencySpeech, AMI, PodcastFillers and EdAcc.
- **Mispronunciation:** speechocean762, plus L2-ARCTIC through an unofficial mirror.
- **Accents with native references:** L2-ARCTIC paired with CMU ARCTIC (same prompts), EdAcc and VoxPopuli en_accented.
- **Emotion:** RAVDESS, EARS, Expresso and CREMA-D.
- **Casual, device-quality audio:** EdAcc, which is Zoom calls.

The only good grammar-error-plus-correction corpus is Speak & Improve 2025, and it needs a form and licence.

### Cited Findings

#### Feature 1: Self-corrections and disfluencies in casual speech
- **DisfluencySpeech** (`amaai-lab/DisfluencySpeech`)
  - HF reports `gated=False`, licence Apache-2.0. — [HF API](https://huggingface.co/api/datasets/amaai-lab/DisfluencySpeech)
  - 5,000 rows: train 4,500, validation 250 (74.2 MB parquet), test 250 (70.9 MB). The parquet totals 1.48 GB. — [datasets-server size](https://datasets-server.huggingface.co/size?dataset=amaai-lab/DisfluencySpeech)
  - Content: one speaker in a studio re-enacts nearly 10 hours of expressive utterances from Switchboard-1 telephone transcripts. The audio is real human speech, but it is a scripted re-performance of spontaneous transcripts, not spontaneous itself. — [HF card](https://huggingface.co/datasets/amaai-lab/DisfluencySpeech); [paper arXiv 2406.08820](https://arxiv.org/abs/2406.08820)
  - Fields:
    - `transcript_annotated` uses Switchboard-style markup, for example `{F uh, }` for a filler, `{C but }` for a conjunction, `[ and, + ]` for a repair, and `<laughter>`.
    - `transcript_a` removes non-speech events.
    - `transcript_b` also removes non-sentence elements such as fillers.
    - `transcript_c` also removes false starts. It gives a clean "intended" target for evaluating self-correction cleanup.
    - Source: [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=amaai-lab/DisfluencySpeech&config=default&split=train)
- **nyralabs/disfluency_speech_english**
  - A reformat of DisfluencySpeech with paired `verbatim_transcript` (what was said) and `intended_transcript` (what was meant). It is used by the Nyra Verbatim Speech Benchmark, which breaks errors into fillers, sounds, cutoffs and repetitions.
  - Ungated, Apache-2.0. 4,957 rows, 1.06 GB parquet.
  - Source: [HF card](https://huggingface.co/datasets/nyralabs/disfluency_speech_english)
- **AMI Meeting Corpus** (`edinburghcstr/ami`)
  - `gated=False`, CC BY 4.0. About 100 h of meeting recordings with close-talking and far-field microphones. — [HF API](https://huggingface.co/api/datasets/edinburghcstr/ami); [HF card](https://huggingface.co/datasets/edinburghcstr/ami)
  - Two configs: `ihm` (individual headset) and `sdm` (single distant mic).
    - ihm test: 12,643 rows, 1.29 GB.
    - sdm test: 12,643 rows, 1.24 GB.
    - Train is about 11–12 GB per config.
    - Source: [datasets-server size](https://datasets-server.huggingface.co/size?dataset=edinburghcstr/ami)
- **JacobLinCool/ami-disfluent**
  - A CC BY 4.0 AMI-derived set: 24,393 rows, with a test split of 1,892 rows (463 MB). — [datasets-server size](https://datasets-server.huggingface.co/size?dataset=JacobLinCool/ami-disfluent)
  - Its transcripts keep fillers and self-repairs verbatim, for example "...IN A STRUCTURE IN IN A V IN A STRUCTURE VERY SIMILAR... INDIVIDUAL UM MEETINGS". — [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=JacobLinCool/ami-disfluent&config=default&split=train)
  - It has no dataset card text explaining how it was filtered. — [HF card](https://huggingface.co/datasets/JacobLinCool/ami-disfluent)
- **PodcastFillers** (Adobe Research, Interspeech 2022)
  - 199 full-length English podcast episodes, 145 h, from over 350 speakers. The audio is CC-licensed from SoundCloud.
  - 85,803 manually annotated events: about 35,000 fillers ("uh"/"um") and about 50,000 non-filler events such as breaths, music, laughter, repeated words and noise.
  - Also includes 1-second event clips and ASR transcripts.
  - Hosted on Zenodo.
  - Source: [PodcastFillers home](https://podcastfillers.github.io/)
  - Zenodo record 7121457 has access_right=open and licence "cc-nc".
    - Files: PodcastFillers.zip plus .z01–.z03 split parts (about 6.4 GB each; about 25 GB total) and a separate PodcastFillers.csv annotation file (21.7 MB).
    - Source: [Zenodo API](https://zenodo.org/api/records?q=PodcastFillers)
  - The metadata and annotations are under an Adobe non-commercial research licence. "By exercising rights under this License, you accept and agree to be bound by its terms". It prohibits deploying technology developed with the annotations in commercial applications. — [PodcastFillers licence](https://podcastfillers.github.io/license/)
  - An HF mirror, `ylacombe/podcast_fillers_by_license`, holds the audio only. It is ungated, 8.34 GB, split by CC_BY_3.0 (100 episodes), CC_BY_SA_3.0 (79) and CC_BY_ND_3.0 (20). It does not include the filler annotations. — [HF card](https://huggingface.co/datasets/ylacombe/podcast_fillers_by_license); [size](https://datasets-server.huggingface.co/size?dataset=ylacombe/podcast_fillers_by_license)
- **EdAcc**
  - The card says laughter and hesitations "are accurately documented" in its transcripts. It is spontaneous Zoom conversation; see Feature 4. — [HF card](https://huggingface.co/datasets/edinburghcstr/edacc)
- **SEP-28k + FluencyBank clips** (HF mirror `saeedzou/sep28k-fluencybank-stutter-dataset`)
  - Ungated. 31,908 clips, 2.87 GB.
  - Clip-level labels: Interjection, WordRep, SoundRep, Prolongation, Block, NaturalPause, plus quality flags.
  - It has no licence and no card text.
  - The content is stuttering-focused (for example the show "HeStutters"), not typical casual self-repair.
  - Source: [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=saeedzou/sep28k-fluencybank-stutter-dataset&config=default&split=train)
- **FluencyBank (official)**
  - "Access to the research data in FluencyBank is password protected and restricted to members of the FluencyBank consortium group".
  - To join, the user emails talkbank@cmu.edu with an affiliation and a statement of intended use. Students need their faculty advisor to join.
  - A "Teaching" section is open access.
  - The site notes it is "under review for potential modification in compliance with Administration directives".
  - Source: [FluencyBank](https://fluency.talkbank.org/)
- **Buckeye Corpus**
  - 40 speakers from Columbus, OH, conversing freely with an interviewer. Orthographically transcribed and phonetically labelled.
  - "FREE for noncommercial uses" but users must register.
  - Source: [Buckeye](https://buckeyecorpus.osu.edu/)
  - Unofficial HF copies exist, for example `alexwengg/buckeye`, `nh0znoisung/buckeye` and `bhigy/buckeye_asr`, all `gated=False`. — [HF search](https://huggingface.co/api/datasets?search=buckeye)
- **LearnerVoice** (Interspeech 2024)
  - 50.04 h from 239 one-on-one online tutoring lessons on the Ringle platform. 58 L1-Korean learners, 32 kHz.
  - Transcripts preserve filler words, self-repairs (repetitions, fragments, false starts) and ungrammatical expressions.
  - The paper says it is "available at: https://prep.ringleplus.com/research". — [arXiv 2407.04280v2](https://arxiv.org/html/2407.04280v2)
  - This conflicts with the Speak & Improve paper (Dec 2024), which says LearnerVoice is "not publicly available yet". — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
  - The Ringle page is JavaScript-rendered and returned no readable content to a non-browser fetch on 2026-10-17. — [Ringle research](https://prep.ringleplus.com/research)
- **Switchboard Reannotated**
  - A corrected re-annotation of Switchboard with disfluency labels for restarts, repetitions and repairs, described as openly available. The S&I Challenge used it as a text source for disfluency detection.
  - The audio itself is still Switchboard (LDC).
  - Source: search summary of [S&I Challenge 2025 paper](https://arxiv.org/pdf/2412.11985) (not opened directly).

#### Feature 2: Grammatical errors in spontaneous non-native speech
- **Speak & Improve Corpus 2025** (Cambridge University Press & Assessment)
  - About 315 hours (over 45,000 utterances) of open, spontaneous speaking-test responses. They come from over 7,000 test submissions by L2 learners worldwide. All are annotated with a CEFR level.
  - About 55 h are "manually transcribed, including disfluencies and correction of language errors".
  - Source: [Cambridge dataset page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)
  - The paper's v1 says about 340 h and about 60 h transcribed. Other versions say 315 h.
  - Splits:
    - Dev: 438 submissions, 5,616 utterances, 38.5 h.
    - Eval: 442 submissions, 5,642 utterances, 38.7 h.
    - Train: 6,640 submissions, 39,490 utterances, 270 h.
  - Recording: learners used laptops, tablets and phones through a browser. Audio is 16 kHz single-channel FLAC.
  - Annotation layers:
    - Word marks: backchannel, disfluency, partial, pronunciation (lexical errors only).
    - Word tags: hesitation, code-switch.
    - Phrase tags: speech-unit tags.
    - A separate grammatical-error-corrected transcript, with reference edits derived from the fluent and corrected versions.
  - CEFR range: A2–C1.
  - Source: [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
- **NICT-JLE and KISTEC**
  - Only text transcriptions are available, no audio. NICT-JLE has GEC annotations. — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
- **LearnerVoice**
  - Transcripts retain ungrammatical expressions. Grammar correction (CoEdIT) and ERRANT error counting were run only for the paper's analysis, and the paper does not say corrected transcripts are released. — [arXiv 2407.04280v2](https://arxiv.org/html/2407.04280v2)

#### Feature 3: Word-level mispronunciations with annotations
- **speechocean762** (`mispeech/speechocean762`)
  - `gated=False`, Apache-2.0. — [HF API](https://huggingface.co/api/datasets/mispeech/speechocean762)
  - 5,000 rows: train 2,500 (333 MB) and test 2,500 (312 MB). — [size](https://datasets-server.huggingface.co/size?dataset=mispeech/speechocean762)
  - Content: 5,000 read English sentences by non-native speakers whose L1 is Mandarin. Half are children and half adults. Free for commercial and non-commercial use. — [HF card](https://huggingface.co/datasets/mispeech/speechocean762)
  - Sentence-level fields: accuracy, completeness, fluency, prosodic, total, plus speaker, gender and age.
  - Word-level fields inside `words`: accuracy, stress, total, `phones`, `phones-accuracy` (0–2 per phone) and a `mispronunciations` list. — [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=mispeech/speechocean762&config=default&split=train)
  - Also downloadable directly from OpenSLR 101: `speechocean762.tar.gz`, 520.8 MB, HTTP 200 checked. — [OpenSLR 101](https://www.openslr.org/resources/101/speechocean762.tar.gz)
- **L2-ARCTIC v5.0**
  - 24 non-native speakers, 4 per L1: Hindi, Korean, Mandarin, Spanish, Arabic, Vietnamese. Each recorded about 1 hour (about 1,132 sentences) of CMU ARCTIC prompts.
  - Includes orthographic and forced-aligned phone transcriptions.
  - About 150 utterances per speaker are manually annotated for phone substitution, deletion and addition errors, with corrected word and phone boundaries.
  - v5.0 (03/2020) added the "suitcase corpus": unscripted speech plus annotations from 22 of the 24 speakers.
  - Access: "Please first review the license terms of L2-ARCTIC. If you agree to the license terms, please go to the download sec[tion]".
  - Source: [L2-ARCTIC home (TAMU PSI Lab)](https://psi.engr.tamu.edu/l2-arctic-corpus/)
  - The TAMU page later blocked our automated fetch with Cloudflare, so the exact form flow could not be re-checked.
- **L2-ARCTIC unofficial HF mirror** (`chikingsley/l2-arctic-release-v5.0`)
  - `gated=False`, labelled CC BY-NC 4.0. — [HF API search](https://huggingface.co/api/datasets?search=l2-arctic)
  - Card: 26,867 utterances, 27.1 h scripted, 3,599 manually annotated utterances, 44.1 kHz wav, TextGrids. — [HF card](https://huggingface.co/datasets/chikingsley/l2-arctic-release-v5.0)
  - Files: one zip per speaker (237–372 MB each, for example `ABA.zip` 349.5 MB and `SKA.zip` 237.1 MB), plus `suitcase_corpus.zip` (111.7 MB) and the LICENSE file. — [HF file tree](https://huggingface.co/api/datasets/chikingsley/l2-arctic-release-v5.0/tree/main?recursive=1)
- **Other L2-ARCTIC and speechocean copies**
  - `KoelLabs/L2Arctic`, `KoelLabs/SpeechOcean` and `KoelLabs/L2ArcticSpontaneousSplit` are `gated=auto`, meaning HF click-accept. — [HF API](https://huggingface.co/api/datasets/KoelLabs/L2Arctic)
  - `boldvoice/l2_arctic` and `NathanRoll/l2-arctic-dataset` are ungated. — [HF search](https://huggingface.co/api/datasets?search=l2-arctic)

#### Feature 4: Non-native accents with native references
- **EdAcc** (`edinburghcstr/edacc`)
  - `gated=False`. Card licence: CC BY-SA 4.0.
  - Content: 40 h of English dyadic conversations covering L1 and L2 varieties, with a linguistic background profile for each speaker.
  - Participants held relaxed conversations over Zoom.
  - Source: [HF card](https://huggingface.co/datasets/edinburghcstr/edacc)
  - Size: validation 9,848 rows (3.34 GB) and test 9,289 rows (3.62 GB). There is no train split. — [size](https://datasets-server.huggingface.co/size?dataset=edinburghcstr/edacc)
  - Fields: speaker, text, accent (for example "Scottish English"), raw_accent (for example "Scottish (Fife)"), gender, l1. — [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=edinburghcstr/edacc&config=default&split=test)
  - The official site describes 120 speakers who already know each other, "Virtual Calls", and no topic constraints. Contributors consented to public sharing. — [EdAcc site](https://groups.inf.ed.ac.uk/edacc/index.html)
- **VoxPopuli `en_accented`** (`facebook/voxpopuli`)
  - `gated=False`, CC0 plus "other". — [HF API](https://huggingface.co/api/datasets/facebook/voxpopuli)
  - "29 hours of transcribed speech data of non-native English" across 15 L2 accents, for example en_nl 3.52 h (45 speakers) and en_de 3.52 h (84 speakers). — [HF card](https://huggingface.co/datasets/facebook/voxpopuli)
  - `en_accented` has a test split only: 8,387 rows, 4.95 GB. The native `en` config has a test split of 1,842 rows (936 MB). — [size](https://datasets-server.huggingface.co/size?dataset=facebook/voxpopuli)
- **L2-ARCTIC + CMU ARCTIC**
  - L2-ARCTIC speakers read CMU's ARCTIC prompts, so the native CMU ARCTIC speakers form prompt-matched references. — [L2-ARCTIC home](https://psi.engr.tamu.edu/l2-arctic-corpus/)
  - Direct CMU ARCTIC download works, for example `cmu_us_bdl_arctic.tar.bz2` at 73.6 MB, HTTP 200. — [festvox](http://festvox.org/cmu_arctic/packed/cmu_us_bdl_arctic.tar.bz2)
  - HF mirror `MikhailT/cmu-arctic`: ungated, labelled MIT, 15,583 rows, 1.58 GB, configs per speaker (aew, ahw, aup, awb, axb, bdl, clb, eey…). — [size](https://datasets-server.huggingface.co/size?dataset=MikhailT/cmu-arctic)
- **Speech Accent Archive** (George Mason University)
  - Native and non-native speakers read the same paragraph, and the readings are carefully transcribed. CC BY-NC-SA 4.0.
  - The site "is currently being renovated".
  - Source: [Speech Accent Archive](https://accent.gmu.edu/)
  - Ungated HF mirrors exist: `CodecSR/speech_accent_archive_english`, `CodecSR/speech_accent_archive_other`, `HamdanXI/speech-accent-archive-v2`. — [HF search](https://huggingface.co/api/datasets?search=accent_archive)
- **GLOBE / GLOBE_V2** (`MushanW/GLOBE`, `MushanW/GLOBE_V2`)
  - `gated=False`, CC0. Derived from Common Voice: 23,519 speakers, 164 accents, 535 h at 24 kHz.
  - The audio is "rigorous[ly] filter[ed] and enhance[d]", so it is not raw device audio.
  - Source: [GLOBE card](https://huggingface.co/datasets/MushanW/GLOBE)
  - V2: 542,261 rows, 76 GB. Test split 5,046 rows (723 MB). — [size](https://datasets-server.huggingface.co/size?dataset=MushanW/GLOBE_V2)
- **westbrook/English_Accent_DataSet**
  - Ungated, no licence stated. 79 h, 23 accents, drawn from VCTK, EdAcc and VoxPopuli. Test split 1,620 rows (280 MB). — [HF card](https://huggingface.co/datasets/westbrook/English_Accent_DataSet); [size](https://datasets-server.huggingface.co/size?dataset=westbrook/English_Accent_DataSet)
- **Other native read-speech references**
  - `openslr/librispeech_asr`: ungated, CC BY 4.0. — [HF API](https://huggingface.co/api/datasets/openslr/librispeech_asr)
  - LibriSpeech dev-clean from OpenSLR 12: 337.9 MB, HTTP 200. — [OpenSLR 12](https://www.openslr.org/resources/12/dev-clean.tar.gz)
  - `CSTR-Edinburgh/vctk`: ungated, CC BY 4.0, but has no parquet tag. — [HF API](https://huggingface.co/api/datasets/CSTR-Edinburgh/vctk)
  - `ylacombe/english_dialects`: ungated, CC BY-SA 4.0. — [HF API](https://huggingface.co/api/datasets/ylacombe/english_dialects)

#### Feature 5: Emotional, expressive or tone-varied speech
- **Expresso** (Meta)
  - 4 speakers, 48 kHz, 40 h total: 11 h read speech in 8 styles and 30 h improvised dialogues in 26 styles. CC BY-NC 4.0. — [HF card](https://huggingface.co/datasets/ylacombe/expresso)
  - The HF mirror (`gated=False`) holds only the `read` config: 11,615 rows, 5.76 GB. Fields: text, speaker_id, style (for example "confused"). — [size](https://datasets-server.huggingface.co/size?dataset=ylacombe/expresso); [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=ylacombe/expresso&config=read&split=train)
  - The full original tar is a direct download: `expresso.tar`, 38.4 GB, HTTP 200. — [dl.fbaipublicfiles](https://dl.fbaipublicfiles.com/textless_nlp/expresso/data/expresso.tar)
- **EARS** (Meta / Uni Hamburg)
  - 100 h from 107 speakers, 48 kHz, anechoic.
  - Includes 7 reading styles (regular, loud, whisper, high pitch, low pitch, fast, slow), 22 emotions, and 18 minutes of freeform monologues per speaker.
  - Downloads are per-speaker zips from GitHub releases. CC BY-NC 4.0.
  - Source: [EARS README](https://github.com/facebookresearch/ears_dataset)
  - `p001.zip` is 592 MB, HTTP 200. — [GitHub release](https://github.com/facebookresearch/ears_dataset/releases/download/dataset/p001.zip)
- **RAVDESS**
  - Zenodo record 1188976, licence CC BY-NC-SA 4.0. `Audio_Speech_Actors_01-24.zip` is 208.5 MB and is a direct link. — [Zenodo API](https://zenodo.org/api/records/1188976)
  - HF `birgermoell/ravdess`: ungated, 1,440 rows, 325 MB. — [size](https://datasets-server.huggingface.co/size?dataset=birgermoell/ravdess)
- **CREMA-D**
  - 7,442 clips from 91 actors (ages 20–74, mixed ethnicities). 12 sentences in 6 emotions at 4 intensity levels. Ratings are crowd-sourced. — [HF card](https://huggingface.co/datasets/myleslinder/crema-d)
  - Licence: ODbL plus DbCL. The GitHub repo needs `git lfs clone`, because the plain zip contains only LFS pointers. — [CREMA-D GitHub](https://github.com/CheyneyComputerScience/CREMA-D)
  - Ungated HF copies: `myleslinder/crema-d` (uses a loading script) and `confit/cremad-parquet`. — [HF search](https://huggingface.co/api/datasets?search=crema)
- **ESD (Emotional Speech Dataset)**
  - 350 parallel utterances × 5 emotions (neutral, happy, angry, sad, surprise), from 10 English and 10 Mandarin speakers.
  - Licence: "Please complete a License and send it to zhoukun@u.nus.edu. This database can only be used for research purpose". The README also links a Google Drive download.
  - Source: [ESD GitHub](https://github.com/HLTSingapore/Emotional-Speech-Data)
  - Ungated HF copy `jspaulsen/esd`, labelled CC BY-NC 4.0: 35,000 rows, 3.15 GB. — [HF card](https://huggingface.co/datasets/jspaulsen/esd)
- **MSP-Podcast** (UT Dallas)
  - Naturalistic, not acted, podcast speech. v2.0 has 264,705 speaking turns (409 h).
  - Labels: categorical (anger, happiness, sadness, disgust, surprise, fear, contempt, neutral, other) plus arousal, dominance and valence.
  - Partitions: Train 169,190, Dev 34,399, Test1 46,294, Test2 14,822, Test3 3,200 (Test3 labels hidden).
  - Source: [MSP-Podcast page](https://www.lab-msp.com/MSP/MSP-Podcast.html)

#### Feature 6: Phone or laptop-quality casual, voice-message-like recordings
- **EdAcc:** relaxed Zoom conversations ("Virtual Calls"). — [HF card](https://huggingface.co/datasets/edinburghcstr/edacc); [EdAcc site](https://groups.inf.ed.ac.uk/edacc/index.html)
- **Speak & Improve 2025:** learners recorded on laptops, tablets and phones through a browser. 16 kHz FLAC. Form-gated. — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
- **LearnerVoice:** online one-on-one tutoring video sessions. — [arXiv 2407.04280v2](https://arxiv.org/html/2407.04280v2)
- **People's Speech** (`MLCommons/peoples_speech`)
  - `gated=False`. Mixed CC-BY and CC-BY-SA licences. Size category "1T<n". — [HF API](https://huggingface.co/api/datasets/MLCommons/peoples_speech)
- **Common Voice:** "Effective October 2025, Mozilla Common Voice datasets are now exclusively available through Mozilla Data Collective". The HF repo `mozilla-foundation/common_voice_17_0` now holds only a README and .gitattributes. — [HF README](https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0); [HF tree](https://huggingface.co/api/datasets/mozilla-foundation/common_voice_17_0/tree/main)
- **Mozilla Data Collective:** MDC says it has "no plans to host Mozilla community datasets through third parties", citing consent revocation. MDC now offers Scripted Speech v27 and Spontaneous Speech v5 (news dated 21 Sep 2026), plus an API and an MCP server for programmatic download. — [MDC FAQ](https://community.mozilladatacollective.com/faq-can-i-get-the-common-voice-or-other-mdc-datasets-from-other-platforms-like-github-or-hugging-face/)
- **Common Voice Spontaneous Speech ASR shared-task mirror**
  - An HF mirror is ungated and CC0. Its listed locales are ady, aln, bas, bew, bxk, cgg, el-CY, hch, kbd, kcn, koo, led, lke, lth, meh, mmc, pne, qxp, ruc, rwm, sco, tob, top, ttj, ukv, ush. There is no `en`.
  - Source: [HF card](https://huggingface.co/datasets/Peacockery/mozilla-common-voice-spontaneous-speech-asr-shared-task)
- **Third-party Common Voice mirror:** `fsicoli/common_voice_17_0` is still `gated=False` and labelled CC0. — [HF API](https://huggingface.co/api/datasets/fsicoli/common_voice_17_0)
- **PodcastFillers:** podcast episodes from SoundCloud with varied recording quality. — [PodcastFillers](https://podcastfillers.github.io/)

### Inferences
- **Best fit for self-corrections:** DisfluencySpeech, with its `[ reparandum + repair ]` markup and the clean `transcript_c`, gives the most direct test of "remove the self-correction and keep the intended words". It is acted, single-speaker studio audio, so it will flatter any system. AMI-disfluent or EdAcc show how the system behaves on truly spontaneous, multi-speaker audio.
- **Strongest non-native, device-quality, spontaneous set:** EdAcc. It is ungated and CC BY-SA, with L1 metadata and Zoom audio, and covers features 1, 4 and 6 at once.
- **Native references for L2-ARCTIC:** CMU ARCTIC is the natural choice, because the prompts are identical. The other prompt-matched option is the Speech Accent Archive, where everyone reads the same paragraph.
- **Emotion:**
  - RAVDESS (208 MB direct Zenodo zip) and EARS (one speaker zip per download) are the fastest, cleanest pulls.
  - Most emotion sets are acted. Expresso improvised dialogues and MSP-Podcast are the more naturalistic options.
- **Phone or laptop audio:** I could not verify any clean, openly licensed English set of real voice messages recorded on phones. EdAcc's Zoom audio and S&I's browser recordings are the closest.

### Gaps
- **Hours or speaker counts not verified:**
  - speechocean762: the card text was truncated before the speaker count. It is commonly cited as 250 speakers, but that was not confirmed here.
  - AMI: the share of non-native speakers was not verified.
  - People's Speech: the number of hours was not read from the card.
  - JacobLinCool/ami-disfluent: the selection criteria are undocumented.
- **Not verified in this session:**
  - MSP-Podcast access procedure: the page text was cut off before the access terms.
  - Switchboard and Fisher LDC pricing and terms: no LDC pages were fetched. Only general knowledge says they are LDC-licensed and paid for non-members.
  - TED-LIUM 3: OpenSLR 51 now returns "Resource not found", `TEDLIUM_release-3.tgz` returns HTTP 404, the LIUM page returned 404, and `LIUM/tedlium` on HF returned an access error. Its current official access route is unknown. Ungated mirrors exist, such as `sanchit-gandhi/tedlium-data` and `distil-whisper/tedlium`.
  - VCTK direct link: the Edinburgh DataShare zip URL returned only a 4,264-byte response, probably an HTML page rather than the archive. The HF `CSTR-Edinburgh/vctk` repo has no parquet files, so a working direct path was not confirmed.
  - DAPS (Device and Produced Speech, real speech re-recorded on phones and tablets): Zenodo returned 403 (rate-limited), so it is not verified.
  - LearnerVoice availability: the paper and a later citing paper conflict, and the download page could not be read.
- **Not found:**
  - No 2024–2026 audio dataset dedicated specifically to self-repairs, beyond DisfluencySpeech (2024), LearnerVoice (2024), FluencyBank Timestamped (2024, stuttering) and S&I 2025.
  - Whether MDC's Spontaneous Speech v5 includes English.

## Q2. Which datasets can an automated agent download without accepting terms, and which need the user to click-accept or fill a form?

### Takeaway
Many relevant sets are fully ungated on HF or are direct HTTP downloads. An agent can fetch them with no login or terms page. Three other groups need the user to act:
- **Click-accept on HF:** GigaSpeech and the KoelLabs L2-ARCTIC/speechocean copies (`gated=auto`).
- **Form, licence email or registration:** L2-ARCTIC official, S&I 2025, ESD official, Buckeye, FluencyBank and MSP-Podcast.
- **Account plus API key (Common Voice):** MDC.

Several form-gated corpora have ungated unofficial HF mirrors. Downloading those sidesteps the original terms, and the user should decide whether that is acceptable.

### Cited Findings
- **Tier A: no login, no click (agent can fetch now)**

  | Dataset | Route | Licence | Size for a test pull | Source |
  |---|---|---|---|---|
  | speechocean762 | HF `mispeech/speechocean762` (gated=False) or OpenSLR 101 tar | Apache-2.0 | test split 312 MB; tar 520.8 MB | [HF API](https://huggingface.co/api/datasets/mispeech/speechocean762), [OpenSLR](https://www.openslr.org/resources/101/speechocean762.tar.gz) |
  | EdAcc | HF `edinburghcstr/edacc` (gated=False) | CC BY-SA 4.0 | test 3.62 GB / val 3.34 GB (streamable) | [HF](https://huggingface.co/datasets/edinburghcstr/edacc) |
  | DisfluencySpeech | HF `amaai-lab/DisfluencySpeech` (gated=False) | Apache-2.0 | test 70.9 MB | [size](https://datasets-server.huggingface.co/size?dataset=amaai-lab/DisfluencySpeech) |
  | AMI | HF `edinburghcstr/ami` (gated=False) | CC BY 4.0 | ihm test 1.29 GB | [size](https://datasets-server.huggingface.co/size?dataset=edinburghcstr/ami) |
  | VoxPopuli | HF `facebook/voxpopuli` (gated=False) | CC0 + other | en_accented test 4.95 GB | [size](https://datasets-server.huggingface.co/size?dataset=facebook/voxpopuli) |
  | Expresso | HF `ylacombe/expresso` (read only) or full tar on dl.fbaipublicfiles.com | CC BY-NC 4.0 | HF 5.76 GB; tar 38.4 GB | [HF](https://huggingface.co/datasets/ylacombe/expresso), [tar](https://dl.fbaipublicfiles.com/textless_nlp/expresso/data/expresso.tar) |
  | EARS | GitHub release zips per speaker | CC BY-NC 4.0 | p001.zip 592 MB | [EARS](https://github.com/facebookresearch/ears_dataset) |
  | RAVDESS | Zenodo direct file | CC BY-NC-SA 4.0 | 208.5 MB audio-speech zip | [Zenodo API](https://zenodo.org/api/records/1188976) |
  | CREMA-D | GitHub + git-lfs | ODbL / DbCL | full repo (LFS) | [GitHub](https://github.com/CheyneyComputerScience/CREMA-D) |
  | CMU ARCTIC | festvox direct tarballs / HF `MikhailT/cmu-arctic` | festvox (HF mirror says MIT) | bdl 73.6 MB | [festvox](http://festvox.org/cmu_arctic/packed/cmu_us_bdl_arctic.tar.bz2) |
  | PodcastFillers | Zenodo record 7121457 (open access) | audio CC; annotations Adobe non-commercial | CSV 21.7 MB; audio about 25 GB split zip | [Zenodo API](https://zenodo.org/api/records?q=PodcastFillers) |
  | GLOBE_V2 | HF (gated=False) | CC0 | test 723 MB | [size](https://datasets-server.huggingface.co/size?dataset=MushanW/GLOBE_V2) |
  | LibriSpeech | HF / OpenSLR 12 | CC BY 4.0 | dev-clean 337.9 MB | [OpenSLR](https://www.openslr.org/resources/12/dev-clean.tar.gz) |
  | People's Speech | HF (gated=False) | CC-BY/CC-BY-SA mix | stream only | [HF API](https://huggingface.co/api/datasets/MLCommons/peoples_speech) |

- **Tier A-prime: ungated unofficial mirrors of gated or registration-only originals**
  - L2-ARCTIC (`chikingsley/l2-arctic-release-v5.0`, plus `boldvoice/l2_arctic`). — [HF search](https://huggingface.co/api/datasets?search=l2-arctic)
  - ESD (`jspaulsen/esd`). — [HF card](https://huggingface.co/datasets/jspaulsen/esd)
  - Buckeye (`alexwengg/buckeye`, etc.). — [HF search](https://huggingface.co/api/datasets?search=buckeye)
  - SEP-28k/FluencyBank (`saeedzou/...`). — [HF](https://huggingface.co/datasets/saeedzou/sep28k-fluencybank-stutter-dataset)
  - Speech Accent Archive (`CodecSR/...`). — [HF search](https://huggingface.co/api/datasets?search=accent_archive)
  - Common Voice 17 (`fsicoli/common_voice_17_0`). — [HF API](https://huggingface.co/api/datasets/fsicoli/common_voice_17_0)
  - TED-LIUM (`sanchit-gandhi/tedlium-data`). — [HF search](https://huggingface.co/api/datasets?search=tedlium)
- **Tier B: HF click-accept (`gated=auto`), which the user must do while logged in**
  - `speechcolab/gigaspeech` (Apache-2.0 label). — [HF API](https://huggingface.co/api/datasets/speechcolab/gigaspeech)
  - `KoelLabs/L2Arctic`, `KoelLabs/SpeechOcean`, `KoelLabs/L2ArcticSpontaneousSplit`. — [HF API](https://huggingface.co/api/datasets/KoelLabs/L2Arctic)
  - `hhoangphuoc/ami-disfluency`. — [HF search](https://huggingface.co/api/datasets?search=disfluen)
  - `shiprocket-ai/english-podcast_fillers_processed` is `gated=manual`. — [HF search](https://huggingface.co/api/datasets?search=podcast_fillers)
- **Tier C: form, licence or registration (user only)**
  - **S&I 2025:** form plus licence on the ELiT site. — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1); [Cambridge page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)
  - **L2-ARCTIC official:** licence review, then the download section. — [L2-ARCTIC](https://psi.engr.tamu.edu/l2-arctic-corpus/)
  - **ESD:** licence form emailed to zhoukun@u.nus.edu. — [ESD GitHub](https://github.com/HLTSingapore/Emotional-Speech-Data)
  - **Buckeye:** registration. — [Buckeye](https://buckeyecorpus.osu.edu/)
  - **FluencyBank:** consortium membership by email. — [FluencyBank](https://fluency.talkbank.org/)
  - **Common Voice:** MDC account and API credentials. — [MDC FAQ](https://community.mozilladatacollective.com/faq-can-i-get-the-common-voice-or-other-mdc-datasets-from-other-platforms-like-github-or-hugging-face/)
  - **MSP-Podcast:** access route not verified; see Gaps. — [MSP-Podcast](https://www.lab-msp.com/MSP/MSP-Podcast.html)
- **Speak & Improve 2025 restrictions:**
  - Non-commercial research and education only.
  - "Do not provide the corpus (full or partial) to others in any way… e.g. through the use of repositories on sites such as Hugging Face and GitHub".
  - "Do not release items (e.g. models, data statistics) derived from the corpus without prior approval".
  - Use it only with locally hosted LLMs, or with APIs that do not retain data for training.
  - Source: [Cambridge page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)
- **PodcastFillers licence:** the metadata licence accepts terms by use: "By exercising rights under this License, you accept and agree to be bound by its terms". Commercial deployment of technology built with the annotations is prohibited. — [PodcastFillers licence](https://podcastfillers.github.io/license/)

### Inferences
- Even "ungated" sets carry non-commercial terms: Expresso, EARS, RAVDESS, PodcastFillers annotations and the L2-ARCTIC mirror's label. These are fine for a hackathon prototype or demo, but they would block shipping a commercial ReSpeak trained on them.
- The cleanest permissive options are:
  - speechocean762 (Apache-2.0, explicitly commercial-OK)
  - DisfluencySpeech (Apache-2.0)
  - AMI (CC BY 4.0)
  - EdAcc (CC BY-SA 4.0)
  - VoxPopuli (CC0)
  - GLOBE (CC0)
  - LibriSpeech (CC BY 4.0)
- Unofficial mirrors of form-gated corpora are downloadable without clicking, but the uploader may not have had redistribution rights. The S&I licence explicitly forbids HF/GitHub redistribution, and Mozilla explicitly says mirrors conflict with consent revocation. Agents should prefer official routes, or let the user decide on mirrors.
- If the S&I corpus is used, sending its audio or transcripts to a third-party LLM API that retains data would breach the stated terms. This matters if ReSpeak's grammar feature calls a hosted LLM.

### Gaps
- Exact HF gating copy (click-accept wording) for the `gated=auto` repos was not read, only the API flag.
- The L2-ARCTIC official download flow (whether it uses a form or a plain link after the licence) could not be re-checked because of a Cloudflare block.
- The MSP-Podcast access procedure was not captured.
- Whether the ESD Google Drive link works without the emailed licence was not tested. Using it without sending the licence would contradict the README's instructions.

## Q3. Is there openly downloadable speech with naturally occurring grammatical errors and corrected transcripts?

### Takeaway
I found no speech corpus with natural grammatical errors and corrected transcripts that downloads without a form. The Speak & Improve Corpus 2025 is the only identified corpus with real L2 audio, manual transcripts and grammatical-error-corrected transcripts, and it needs a form and non-commercial licence through ELiT. Its authors call it the first of its kind.

### Cited Findings
- S&I 2025 provides:
  - learner audio
  - manual transcriptions
  - disfluency annotations
  - grammatically corrected transcripts
  - CEFR scores (A2–C)

  Its authors present it as the first to provide audio with grammatical error corrections for spoken GEC research. — [arXiv 2412.11986](https://arxiv.org/pdf/2412.11986)
- The S&I corrected transcripts are made from fluent phrase-level text, with annotators working from text only. Reference edits come from comparing the fluent and corrected transcripts. — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
- Access is by ELiT form plus licence agreement, for non-commercial academic research. — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1); [Cambridge page](https://researchdatasets.cambridge.org/datasets/speak-and-improve-corpus-2025)
- NICT-JLE has GEC annotations but only text transcriptions, no audio. KISTEC has transcriptions only. — [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
- LearnerVoice keeps ungrammatical expressions in its verbatim transcripts. Its corrected versions (CoEdIT) were used only for analysis, and the paper does not say they were released. Public availability is contested. — [arXiv 2407.04280v2](https://arxiv.org/html/2407.04280v2); [arXiv 2412.11986](https://arxiv.org/html/2412.11986v1)
- A 2025 paper proposes generating audio-text pairs with grammatical errors and disfluencies as data augmentation for spoken GEC, and uses the S&I corpus. — [arXiv 2507.19374](https://arxiv.org/pdf/2507.19374)

### Inferences
- **Workaround if the team cannot do the S&I form today:** take spontaneous L2 audio from EdAcc's L2 speakers (filter by `l1` != English), the L2-ARCTIC suitcase corpus (unscripted), or VoxPopuli en_accented. Use the verbatim transcripts, and have a human hand-write corrected versions for about 30–50 utterances that contain real errors. These datasets do not provide corrected transcripts, so this is new annotation work, but the audio and errors are real.
- **If the user fills in the S&I form**, the Dev split (438 submissions, about 38.5 h) is the right test pool. Its terms rule out sending the data to retaining LLM APIs.

### Gaps
- I did not verify how fast ELiT approves the S&I form, which matters for "today".
- I did not verify whether the L2-ARCTIC suitcase corpus annotations include anything grammar-related. They are described only as "annotations".
- I found no 2026 spoken-GEC corpus.

## Q4. What small test subset is recommended for each feature?

### Takeaway
Each feature can be tested with a pull of a few hundred MB at most, mostly from ungated HF splits read with `datasets` streaming or direct zips. The choices below are inferred from the verified sizes and fields above.

### Cited Findings
- Split sizes and fields that support the picks:
  - DisfluencySpeech test: 250 rows, 70.9 MB, with markup and clean transcripts. — [size](https://datasets-server.huggingface.co/size?dataset=amaai-lab/DisfluencySpeech); [first-rows](https://datasets-server.huggingface.co/first-rows?dataset=amaai-lab/DisfluencySpeech&config=default&split=train)
  - AMI-disfluent test: 1,892 rows, 463 MB. — [size](https://datasets-server.huggingface.co/size?dataset=JacobLinCool/ami-disfluent)
  - speechocean762 test: 2,500 rows, 312 MB, with word accuracy and `mispronunciations`. — [size](https://datasets-server.huggingface.co/size?dataset=mispeech/speechocean762)
  - L2-ARCTIC per-speaker zips: about 240–370 MB each; suitcase_corpus.zip 111.7 MB. — [HF tree](https://huggingface.co/api/datasets/chikingsley/l2-arctic-release-v5.0/tree/main?recursive=1)
  - CMU ARCTIC bdl: 73.6 MB. — [festvox](http://festvox.org/cmu_arctic/packed/cmu_us_bdl_arctic.tar.bz2)
  - EdAcc test: 9,289 rows with accent and L1. — [size](https://datasets-server.huggingface.co/size?dataset=edinburghcstr/edacc)
  - RAVDESS audio-speech zip: 208.5 MB. — [Zenodo API](https://zenodo.org/api/records/1188976)
  - EARS p001.zip: 592 MB. — [EARS](https://github.com/facebookresearch/ears_dataset/releases/download/dataset/p001.zip)
  - PodcastFillers.csv: 21.7 MB. — [Zenodo API](https://zenodo.org/api/records?q=PodcastFillers)

### Inferences
Suggested pulls (inferred):
1. **Self-corrections**
   - DisfluencySpeech `test` (250 clips). Keep the clips whose `transcript_annotated` contains `+ ]` (repairs). Ground truth is `transcript_c`.
   - Add about 50 AMI-disfluent `test` clips whose text has adjacent repeated words or fragments. Stream them; do not download all 463 MB.
   - Add about 30 EdAcc test clips from different accents.
2. **Grammar errors**
   - About 40 EdAcc test utterances from L2 speakers, plus a few L2-ARCTIC suitcase recordings (111.7 MB zip), with team-written corrections.
   - Or the S&I Dev split if the form gets approved.
3. **Mispronunciation**
   - speechocean762 `test`: choose about 100 utterances that contain a word with accuracy ≤ 5 or a non-empty `mispronunciations` list, plus about 50 perfect-score controls.
   - Optionally one or two L2-ARCTIC speaker zips, using `annotation/` TextGrids (about 150 annotated utterances per speaker).
4. **Accent vs native reference**
   - Two L2-ARCTIC speakers with different L1s (for example ABA Arabic, 349.5 MB, and HJK Korean, 267.8 MB), paired with CMU ARCTIC bdl/slt on the same arctic_a/b prompt IDs.
   - Add EdAcc test clips grouped by `accent`, and about 100 VoxPopuli `en_accented` test rows (streamed).
5. **Emotion and tone**
   - RAVDESS `Audio_Speech_Actors_01-24.zip` (208.5 MB; 8 emotions, acted).
   - Plus EARS `p001.zip` (emotions, whisper/loud, freeform monologue).
   - Plus about 100 streamed Expresso `read` rows across styles.
6. **Phone or laptop casual**
   - About 50 EdAcc test segments (Zoom calls), plus 1–2 PodcastFillers episodes from `ylacombe/podcast_fillers_by_license` (CC_BY_3.0 split). Use them as noisy, real-world, voice-message-like input.

### Gaps
- None of these subsets was actually downloaded and listened to. Audio quality and labels were checked only through metadata and first-rows previews.
- EdAcc per-clip durations and the share of L2 speakers in its test split were not computed.
