# Word-level mispronunciation detection and diagnosis (MDD) and correcting the word in the speaker's own voice, for ReSpeak (as of 2026-10-17)

Scope: these notes cover detecting which words a speaker mispronounced in free speech, with no reference script but with an ASR transcript of the intended words. They also cover how accurate the methods are, the pitfalls, how to regenerate the word correctly in the same voice, and which datasets can be used. Speech-editing model details such as dots.tts.edit, VoiceCraft and F5-TTS edit are covered in the sibling notes at `C:/Users/ingor/respeak/research_notes/ReSpeak voice editing feasibility/speech_editing_models.md`. This file only covers their pronunciation-control side.

## Q1. Methods (GOP, wav2vec2/HuBERT GOP, alignment-free GOP, CTC phone recognition + G2P, GOPT/transformers, LLM-based) and which have usable weights/code today

### Takeaway
The approach that is practical today and has open weights is: (a) a CTC phoneme model (facebook `wav2vec2-xlsr-53-espeak-cv-ft` / `wav2vec2-lv-60-espeak-cv-ft`, Apache-2.0; or the newer POWSM), (b) canonical phones from G2P for the ASR-transcribed words, and (c) either a CTC-based GOP score per phone (logit-based or alignment-free GOP) or recognized-vs-canonical phone alignment. Phone scores are then aggregated to word flags. GOPT (BSD-3) and the 2026 IF-MDD code exist, but GOPT needs Kaldi GOP features. Fine-tuned audio LLMs are competitive at word and sentence level but weak at phone level, and I found no released weights for the strongest ones.

### Cited Findings
**Classic and DNN GOP**
- speechocean762 ships a Kaldi recipe for the classic GOP method for phoneme-level scoring, which serves as its baseline. — [arXiv 2104.01378 (speechocean762)](https://arxiv.org/abs/2104.01378); [ISCA PDF](https://www.isca-archive.org/interspeech_2021/zhang21x_interspeech.pdf)
- Classic GMM-HMM GOP scores only P=R=F1=0.290 for phone-level mispronunciation detection on L2-ARCTIC. In the same comparison, CTC-ATT reaches F1 0.386 and Transformer 0.411. — [Masked Acoustic Unit paper, Table 2](https://arxiv.org/html/2108.05517v2)

**wav2vec2-based MDD**
- Xu, Kang, Cao, Lin, Ma (Tencent), "Explore wav2vec 2.0 for Mispronunciation Detection", Interspeech 2021. It treats MD as binary classification, with conv and pooling layers on wav2vec2 over alignment segments of the *prompted text*. It reports F1 = 0.610 on L2-ARCTIC. — [ISCA PDF](https://www.isca-archive.org/interspeech_2021/xu21k_interspeech.pdf) (figure from search snippet of the PDF)
- Peng et al. 2021, "A Study on Fine-Tuning wav2vec2.0 Model for the Task of MDD", is the w2v2-CTC phone recognizer approach compared against canonical phones. It reports F1 60.44 on L2-ARCTIC. One table lists P 62.86 / R 58.57 ([arXiv 2604.22133, Table 3](https://arxiv.org/html/2604.22133)), another P 62.86 / R 58.20 ([arXiv 2511.20107, Table 1](https://arxiv.org/html/2511.20107)), so the two sources disagree slightly on recall. — [ISCA Interspeech 2021](https://www.isca-archive.org/interspeech_2021/peng21e_interspeech.html)

**Off-the-shelf phoneme recognizers (open weights)**
- `facebook/wav2vec2-lv-60-espeak-cv-ft`: wav2vec2-large-lv60 fine-tuned on multilingual Common Voice to output phonetic labels. Takes 16 kHz input, Apache-2.0, no PER on the card. Paper: Xu, Baevski, Auli, "Simple and Effective Zero-shot Cross-lingual Phoneme Recognition" (arXiv 2109.11680). — [HF model card](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft); [arXiv 2109.11680](https://arxiv.org/pdf/2109.11680)
- `facebook/wav2vec2-xlsr-53-espeak-cv-ft` is the checkpoint used in 2025 logit-GOP work, with CTC segmentation for forced alignment. — [arXiv 2506.12067](https://arxiv.org/html/2506.12067)
- The HF Wav2Vec2Phoneme docs say that turning phonemes into words requires a dictionary and a language model. — [HF Transformers docs](https://huggingface.co/docs/transformers/v4.57.1/model_doc/wav2vec2_phoneme)
- `mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme`: XLSR-53 fine-tuned on the annotated L2-ARCTIC subset (90/10 split), with IPA output and an Apache-2.0 card. It reports WER 0.425 and CER 0.128 on its test split, with no PER. — [HF card](https://huggingface.co/mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme)
- TIMIT phoneme models exist, e.g., `vitouphy/wav2vec2-xls-r-300m-timit-phoneme`, which has an ONNX/Transformers.js export `robg/speako-phoneme-recognizer` (39-symbol TIMIT-derived IPA, Apache-2.0). — [HF robg/speako-phoneme-recognizer](https://huggingface.co/robg/speako-phoneme-recognizer)
- Newer phone recognizers: POWSM (arXiv 2510.24992) unifies phone recognition, G2P, P2G and ASR. It has a HF page `espnet/powsm` and claims to match or beat ZIPA and Wav2Vec2Phoneme at similar size. Its data, code and models are released. ZIPA (arXiv 2505.23170) comes in transducer and CTC variants (64M/300M) trained on 17,132 h. I did not confirm ZIPA checkpoint hosting. — [POWSM arXiv](https://arxiv.org/html/2510.24992v2); [HF espnet/powsm](https://huggingface.co/espnet/powsm); [ZIPA arXiv](https://arxiv.org/html/2505.23170v1)
- A paper using an espeak-cv-ft checkpoint without fine-tuning reported zero-shot phone error rates of 70–90%. That was a different (cross-lingual) setting, not L2-ARCTIC English. — [search summary citing Gao et al. 2021](https://www.researchgate.net/publication/363646244_Simple_and_Effective_Zero-shot_Cross-lingual_Phoneme_Recognition) (secondary; treat with caution)

**CTC-based GOP variants (2024–2025)**
- Logit-based GOP (Parikh, Tejedor-Garcia, Cucchiarini, Strik, Radboud; arXiv 2506.12067, July 2025) uses `facebook/wav2vec2-xlsr-53-espeak-cv-ft` with CTC segmentation. It compares GOP_DNN (mean softmax), GOP_MaxLogit, GOP_Margin, GOP_VarLogit and a combination. On speechocean762 phone-level detection: GOP_DNN F1 0.388 (P 0.333, R 0.466, AUC 0.715); GOP_MaxLogit F1 0.354 (P 0.257, R 0.571, AUC 0.754, PCC 0.442/0.456); GOP_VarLogit AUC 0.763. Thresholds were set at the percentile that maximizes MCC. Code: https://github.com/Aditya3107/GOP_logit. — [arXiv 2506.12067](https://arxiv.org/html/2506.12067)
- The same paper's conclusions: logit-based GOP beats probability-based GOP, but the best variant depends on the dataset. GOP_Margin was best on Dutch MPC data but generalized poorly to speechocean762, and GOP_MaxLogit correlated best with human ratings. — [arXiv 2506.12067](https://arxiv.org/html/2506.12067)
- Alignment-free GOP (Cao, Fan, Svendsen, Salvi, NTNU): GOP-AF is the CTC loss of a transcription that allows any substitution/deletion/insertion at the target phone, minus the CTC loss of the canonical transcription. It sums over all alignments, and GOP-AF-Norm adds peakiness normalization. GOP-SA is self-aligned with the same CTC model. On CMU Kids real errors, AUC is 0.914 (GOP-CTC-AF-SD) vs 0.796 (DNN GOP). On speechocean762 phone-level PCC: GOP-CTC-AF-SD alone 0.450; FGOP-CTC-AF features + GOPT 0.648 vs 0.605 for TDNN features. The code is promised "upon publication", and I found no URL. — [arXiv 2507.16838](https://arxiv.org/html/2507.16838v1); original framework at [Interspeech 2024 (Cao et al.)](https://www.isca-archive.org/interspeech_2024/cao24b_interspeech.pdf)
- Parikh et al. (Interspeech 2025) note that AF-GOP is computationally expensive. Their substitution-aware PA-AF / PP-AF GOP restricts substitutions to phonologically confusable phones and reports AUC gains over forced-alignment GOP. — [ISCA Interspeech 2025](https://www.isca-archive.org/interspeech_2025/parikh25_interspeech.pdf); [arXiv 2506.02080](https://arxiv.org/html/2506.02080v2)

**Transformer multi-aspect assessment**
- GOPT (Gong et al. 2022) is released under BSD-3-Clause with code, a Colab and three pretrained models. It needs Kaldi GOP features as input (e.g., 84-dim per phone, padded to 50 phones). For new audio you must run the Kaldi GOP recipe. The inference tutorial has a known bug (issue #15). Released-model PCC on speechocean762 is phone 0.616, word total 0.552, utterance total 0.743 (paper 5-seed mean: 0.612 / 0.549 / 0.742). — [GitHub YuanGongND/gopt](https://github.com/YuanGongND/gopt)
- MultiPA (Chen, Yu, Hirschberg, Columbia) targets *open-response* scenarios. With no known target transcript, it uses another ASR's output as the substitute reference. It combines HuBERT, Whisper, RoBERTa and the Charsiu aligner, and covers sentence accuracy/fluency/prosody plus word-level accuracy. I found no code URL. — [arXiv 2308.12490](https://arxiv.org/html/2308.12490v2)

**Training-free and newest (2025–2026) MDD**
- PER-MDD (Tu et al., arXiv 2511.20107, Nov 2025) is training-free. It stores mid-frame HuBERT (`facebook/hubert-large-ls960-ft`) embeddings of phones from 500 training files and labels test frames by kNN (k=10, cosine ≥ 0.7). It then collapses the frames and aligns them to canonical phones. It reports L2-ARCTIC F1 69.60 (P 71.78, R 67.56). I found no code. — [arXiv 2511.20107](https://arxiv.org/html/2511.20107)
- CROTTC-IF (Geng, Yang, Chen, Sun, Saito, Minematsu, U-Tokyo; arXiv 2604.22133, Apr 2026) is "prompt-free", which per its title addresses acoustic sparsity and linguistic bias. It reports L2-ARCTIC F1 71.77 (P 76.94, R 67.24) and 71.70 F1 on the Iqra'Eval2 leaderboard. Code: https://github.com/Secondtonumb/IF-MDD. The page does not mention weights. — [arXiv 2604.22133](https://arxiv.org/html/2604.22133)
- LLM-based MDD from the same comparison: "Qwen2" (Xie et al. 2026) reaches F1 50.60, Qwen2-sub 55.00, and CROTTC + LLaMA/Qwen back-ends 56.87/55.19, all below CTC-style systems. — [arXiv 2604.22133](https://arxiv.org/html/2604.22133)
- A Qwen2-Audio-7B-Instruct LoRA fine-tune for pronunciation assessment (Wang et al., Microsoft, arXiv 2509.15701) does well at word and sentence level but finds that "phoneme-level assessment remains challenging". The page does not say whether weights are released. — [arXiv 2509.15701](https://arxiv.org/html/2509.15701v1)
- A LoRA-fine-tuned speech multimodal LLM (arXiv 2509.02915) reports PCC > 0.7 with human scores and finds that tuning only the LoRA layers matches tuning all audio layers. Zero-shot GPT-4o left ~41.5% of utterances unscored in that comparison. — [arXiv 2509.02915](https://arxiv.org/html/2509.02915v1) (via search summary)

**Commercial reference point**
- Azure Pronunciation Assessment has an unscripted (no reference text) mode with a content score. Microsoft staff say insertions and omissions cannot be determined without reference text, by design. A Q&A thread reports that a substituted word ("they" for "there") in reading mode received a high score with no mispronunciation flag. — [Microsoft Learn tool page](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/pronunciation-assessment-tool); [MS Q&A on insertions](https://learn.microsoft.com/en-us/answers/questions/1542610/in-pronunciation-assessment-it-looks-like-the-inse); [MS Q&A on wrong words](https://learn.microsoft.com/en-us/answers/a/1829233)

### Inferences
- The recommended ReSpeak v1 pipeline, built only from open-weight parts:
  1. Whisper-class ASR transcript with word timestamps gives the intended words.
  2. Word → canonical phones via CMUdict, with espeak-ng/phonemizer fallback for OOV words. Keep several variants per word, e.g., CMUdict alternates and reduced forms.
  3. Run a CTC phoneme model over a window around each word: `wav2vec2-xlsr-53-espeak-cv-ft` (IPA/espeak phones, so G2P must emit the same espeak inventory) or POWSM.
  4. Per-phone GOP: start with GOP_MaxLogit or GOP-DNN using CTC self-alignment (code available). Upgrade to GOP-AF / substitution-aware AF if compute allows.
  5. Word flag = min or mean phone GOP below a threshold, OR an edit-distance mismatch between the free-decoded phone string and *all* canonical variants.
  6. Calibrate thresholds on speechocean762, which has word-level accuracy scores and per-word mispronunciation lists, licensed CC BY 4.0 / Apache-2.0 and usable commercially.
- Use the 2025 "logit GOP" repo (Aditya3107/GOP_logit) as the starting codebase, since it uses exactly the facebook espeak checkpoint plus CTC segmentation and has published thresholds and metrics on speechocean762.
- GOPT gives the best word-level PCC per unit of effort among released models, but its Kaldi dependency makes it awkward for a product. A GOPT-style transformer can instead be retrained on CTC GOP-AF features, which the NTNU paper showed is better (0.648 vs 0.605 phone PCC).
- The 2026 IF-MDD code is the strongest open-code L2-ARCTIC system found. It is trained on L2-ARCTIC (CC BY-NC), so any weights trained this way are risky for a commercial ReSpeak.

### Gaps
- I found no public code or weights for alignment-free GOP (NTNU), PER-MDD, MultiPA or Xu et al. 2021.
- I did not verify whether ZIPA checkpoints are downloadable, or the licence of POWSM weights.
- I could not find any published zero-shot L2-ARCTIC PER or MDD F1 for the off-the-shelf facebook espeak checkpoints. A small in-house evaluation would be needed.
- I did not verify GLM-TTS/Kokoro-style phoneme input or other phone recognizers in detail (KoelLabs models were not found).

## Q2. Benchmarks and numbers: speechocean762 and L2-ARCTIC SOTA; what a simple wav2vec2-phoneme + G2P pipeline reaches

### Takeaway
On L2-ARCTIC phone-level MDD, the 2021 wav2vec2 baselines are about 60–61% F1, the best 2025–2026 systems about 70–72% F1, and classic GOP about 29%. On speechocean762, word-accuracy PCC runs from 0.53 (GOPT) to about 0.71 (HMamba). A simple off-the-shelf espeak-phoneme CTC + GOP pipeline gets phone-level F1 of only about 0.35–0.39 on speechocean762, where errors are rare (~3.7% of phones). Expect modest precision and plan the UX around that.

### Cited Findings
**L2-ARCTIC (phone-level MDD; 6 test speakers / 900 utterances; protocols vary)**
- Test protocol commonly used: speakers NJS, TLV, TNI, TXHC, YKWK, ZHAA; 2,429 train / 268 val / 900 test utterances; 39-phone ARPAbet-style set. — [arXiv 2604.22133](https://arxiv.org/html/2604.22133)
- F1 (%) from the 2026 comparison table: MPL-MDD 55.42; RNN-T 59.10; MV-w2v2 60.31; w2v2-CTC (Peng 2021) 60.44; PG-MDD (2024) 60.10; TG+Contrastive (Peng 2022) 61.75; Joint-align (2022) 63.04; PER-MDD (2025, training-free) 69.60; CROTTC-IF (2026) 71.77. Meta-Learn shows P 91.60 / R 46.24 / F1 61.45. — [arXiv 2604.22133, Table 3](https://arxiv.org/html/2604.22133)
- The same paper notes that its baselines' numbers were not re-run under one protocol, so the table is not strictly comparable. A search summary of the field also flags that phone inventories and splits differ between papers. — [arXiv 2604.22133](https://arxiv.org/html/2604.22133)
- Xu et al. 2021 (wav2vec2 binary MD on prompted text): F1 0.610. — [ISCA PDF](https://www.isca-archive.org/interspeech_2021/xu21k_interspeech.pdf)
- Classic GMM-HMM GOP: F1 0.290. Annotation-free Masked-AU: 0.438. Supervised AntiPhone topline in that paper: 0.550. — [arXiv 2108.05517](https://arxiv.org/html/2108.05517v2)
- Other 2025–2026 numbers: an articulatory-feature SLaTE 2025 study, and a 2026 language-specific graph method at F1 59.52%. — [SLaTE 2025 PDF](https://www.isca-archive.org/slate_2025/wei25_slate.pdf); [arXiv 2606.05569](https://arxiv.org/html/2606.05569v1)

**speechocean762 (Pearson correlation with expert scores)**
- GOPT: phone 0.612, word accuracy 0.533, word stress 0.291, word total 0.549, utterance total 0.742. — [GOPT repo](https://github.com/YuanGongND/gopt); table also in [arXiv 2509.02915](https://arxiv.org/html/2509.02915v1)
- 3MH: phone 0.693, word accuracy 0.682, word total 0.694, utterance total 0.811. — [arXiv 2509.02915 comparison table](https://arxiv.org/html/2509.02915v1) (column assignment inferred, see Inferences)
- HMamba (Chao et al. 2025): phone ≈0.74, word accuracy ≈0.71, word total ≈0.72, utterance total ≈0.83. Azure PA in the same table: word accuracy 0.62 PCC, utterance total 0.78. Qwen2-Audio-7B LoRA FT: word accuracy 0.51 (Table 1) to 0.62 (single-aspect Table 3), phone PCC ≈0.38. — [arXiv 2509.15701](https://arxiv.org/html/2509.15701v1) (two-decimal values; columns flattened in extraction)
- Alignment-free CTC GOP features + GOPT: phone PCC 0.648. The authors cite 0.693 as the prior best phone-level PCC. — [arXiv 2507.16838](https://arxiv.org/html/2507.16838v1)

**Simple pipeline (off-the-shelf espeak CTC model + GOP, no task training)**
- With `wav2vec2-xlsr-53-espeak-cv-ft` + CTC segmentation on speechocean762, phone-level mispronunciation detection reaches F1 0.388 (GOP_DNN) / 0.354 (GOP_MaxLogit), AUC 0.715–0.763, and PCC with human phone scores of at most 0.456. — [arXiv 2506.12067](https://arxiv.org/html/2506.12067)
- speechocean762 contains 3,401 mispronounced phones out of 91,044 phone realizations. — [arXiv 2506.02080](https://arxiv.org/pdf/2506.02080) (via search summary; also stated in [arXiv 2506.12067](https://arxiv.org/html/2506.12067))
- A wav2vec2-CTC phone recognizer *fine-tuned* on L2-ARCTIC/TIMIT and aligned against canonical phones (Peng et al. 2021) reaches about 60% F1 on L2-ARCTIC. — [arXiv 2604.22133](https://arxiv.org/html/2604.22133)

### Inferences
- Column mapping for the 2509.02915 table: GOPT's row "0.292 | 0.612 | 0.533 | 0.291 | 0.549 | 0.714 | 0.753 | 0.760 | 0.155 | 0.742" matches GOPT's published phone PCC 0.612, word total 0.549 and utterance total 0.742. I infer the column order is phone RMSE, phone PCC, word accuracy, word stress, word total, utterance accuracy, fluency, prosody, completeness, utterance total, and I applied the same mapping to 3MH and HMamba.
- The base rate on speechocean762 is about 3.7% (3,401 / 91,044) mispronounced phones. Even a decent AUC (~0.75) therefore gives low precision (0.26–0.33) at the phone level. Word-level precision will be somewhat better because one bad phone flags the whole word, but naive per-phone thresholds will produce many false alarms.
- Realistic expectations for ReSpeak v1 (zero task training): phone-level F1 around 0.35–0.40. Word-level flagging is probably usable only at a high-confidence operating point that flags few words, with high precision and low recall. Fine-tuning a CTC phone recognizer on L2 data (≈60% F1 class) or adopting 2025–2026 methods (≈70% F1) is the path to a better tier. The best training data (L2-ARCTIC) is non-commercial.
- Word-level PCC around 0.55–0.71 means word-level scores agree only moderately with experts. Human inter-annotator agreement is itself limited (see Q3), so the gap to a "perfect" detector is partly label noise.

### Gaps
- I found no benchmark of word-level MDD F1 in *free/spontaneous* speech with ASR-derived reference text. All numbers above are read speech with known prompts. The L2-ARCTIC v5 "suitcase" spontaneous subset could serve as a test bed.
- I found no published L2-ARCTIC F1 for the off-the-shelf facebook espeak model + G2P edit-distance pipeline.
- I did not verify the HMamba and 3MH numbers against their original papers.

## Q3. Practical pitfalls: accent vs error, G2P mismatch, function words, names, ASR auto-correction, thresholds, non-insulting presentation

### Takeaway
The biggest risks for free speech are: (1) the ASR "hears" a different real word, so the canonical reference already contains the error, or it normalizes the mispronunciation to the intended word (which is what we want); (2) systematic accent features being flagged as errors; and (3) low precision from rare errors and inconsistent human labels. Design for intelligibility-impacting, word-specific ("lexical") errors, use conservative thresholds tuned on MCC/precision, and present the fix implicitly in the user's own voice rather than as a red-ink correction.

### Cited Findings
**Free speech / no script**
- MultiPA handles open responses by using another ASR's recognition result in place of the target transcript. — [arXiv 2308.12490](https://arxiv.org/html/2308.12490v2)
- For L2 utterances, the text annotations must be the canonical phonemes the speaker *intended*, not phonemes of a target text. This is the core difficulty when there is no script. — search summary that probably refers to [arXiv 2104.05980](https://arxiv.org/html/2104.05980). Attribution unverified, so treat this as a paraphrase.
- Kyriakopoulos, Knill, Gales (Interspeech 2020), on spontaneous non-native English, distinguish *lexical* errors (the speaker doesn't know a word's pronunciation) from *accent* errors (consistent substitution/deletion/insertion patterns). They detect both, diagnose speaker-level accent tendencies, and analyze human annotator consistency, noting that it is a problem. — [ISCA Interspeech 2020](https://www.isca-archive.org/interspeech_2020/kyriakopoulos20_interspeech.html); [Cambridge repository](https://www.repository.cam.ac.uk/handle/1810/316379)
- Azure's unscripted mode cannot determine insertions or omissions without reference text. — [MS Q&A](https://learn.microsoft.com/en-us/answers/questions/1542610/in-pronunciation-assessment-it-looks-like-the-inse)

**ASR behaviour on mispronounced words**
- Ballier et al. 2023 (French learners of English): Whisper *medium* transcriptions "converge with what a native speaker understands", while Whisper *tiny* produces alternative transcriptions that are plausible candidates for learner errors. — [HAL hal-04547597](https://hal-lara.archives-ouvertes.fr/CERES/hal-04547597v1)
- Whisper and wav2vec2 show significant bias (higher error) against non-native speakers, children, the elderly and some regional dialects in Dutch. Fine-tuning cut WER by 67% relative for non-native adults. — [CLIN33 abstract](https://clin33.uantwerpen.be/abstract/everyone-deserves-their-voice-to-be-heard-towards-fair-asr-for-all-dutch-speakers); search summary of [Shekoufandeh et al. 2025](https://papers.cool/arxiv/2502.17284)
- When a learner said "they" for "there", Azure's reading-mode assessment gave a high score and no mispronunciation flag. Word substitutions that form real words slip through word-level labels. — [MS Q&A](https://learn.microsoft.com/en-us/answers/a/1829233)

**Thresholds and calibration**
- Logit-GOP work picks the threshold at the score percentile that maximizes MCC. The best GOP variant changes between datasets: GOP_Margin was best on Dutch, worst on speechocean762. — [arXiv 2506.12067](https://arxiv.org/html/2506.12067)
- Peaky CTC posteriors break averaged GOP. For example, esCTC with averaged GOP gets AUC 0.580 vs 0.884–0.896 with self-alignment or alignment-free GOP. Normalization by expected phone duration matters. — [arXiv 2507.16838](https://arxiv.org/html/2507.16838v1)
- Training-free retrieval MDD uses a cosine threshold of 0.7 and k=10 neighbours. Masked-AU detection uses an error-mask threshold H=0.4. — [arXiv 2511.20107](https://arxiv.org/html/2511.20107); [arXiv 2108.05517](https://arxiv.org/html/2108.05517v2)

**Accent vs error; what to flag; how to present**
- Munro & Derwing (1995) separated intelligibility, comprehensibility and accentedness, and showed speech can be heavily accented yet highly intelligible. Levis's "Intelligibility Principle" (vs the "Nativeness Principle") argues that teaching should target being understood. Some errors have a disproportionate effect on comprehensibility. — [Levis 2020 revisit, JSLP](https://www.jbe-platform.com/content/journals/10.1075/jslp.20050.lev); [Levis interview, Ilha do Desterro](https://periodicos.ufsc.br/index.php/desterro/article/view/102641)
- Learners often *want* to sound native-like and expect accuracy-based corrective feedback, which is in tension with intelligibility-based teaching. — [search summary of learner-preference study](https://scholarspace.manoa.hawaii.edu/bitstreams/2d0b7ec1-36da-4a38-ab5e-efcf5d90b776/download)
- AI Twin (Park, Lee, Ma, Yoon; CHI 2026; n=20 adult ESL learners, within-subject) replays a more fluent rephrasing of the learner's utterance in the learner's *own* voice as implicit feedback. Compared with explicit correction and a non-personalized rephraser, it gave higher emotional engagement and was rated more motivating. — [arXiv 2601.11103](https://arxiv.org/abs/2601.11103)
- In the same AI Twin work (per search summary), output converted to the learner's timbre could feel "too fluent" to be their own. Instant cloning kept the voice better but carried over the L2 accent, so the authors had learners record their initial sample in their L1. — [arXiv 2601.11103 PDF](https://arxiv.org/pdf/2601.11103) (search-summary level; not verified in full text)

### Inferences
- **Using the ASR transcript as "intended words" is mostly right but has two failure modes.** (a) Strong-LM ASR (Whisper medium/large) tends to output the intended word even when it is mispronounced. That is exactly the reference ReSpeak needs, and it is what makes phone-level comparison against G2P of that word meaningful. (b) When the mispronunciation lands on another real word ("there" → "they"), the ASR may output that other word, and the error becomes invisible.
  - Mitigation for (b): compare a strong LM-heavy ASR against an acoustic-only signal (a free phone decode, or a small/greedy ASR, following Ballier et al.'s large-vs-tiny observation). Treat confident disagreement as a candidate error. Also use an LLM over the transcript to flag words that are semantically implausible in context and ask "did you mean X?".
- **Accent vs error.** Flag a word only when its phone mismatch is (i) large (a substitution across phoneme categories, a deleted syllable, wrong stress), and (ii) *not* explained by the speaker's own consistent pattern. Build a per-user profile of systematic substitutions (e.g., /θ/→/s/, vowel-length merges) and treat those as accent, either not flagged or in an optional "accent coaching" mode. Prioritize "lexical" errors (Kyriakopoulos et al.), which are the ones a word-level "fix" button actually helps.
- **G2P mismatch.** Accept any of several canonical variants: CMUdict alternates, espeak output, reduced or weak forms. Map espeak IPA and CMUdict ARPAbet into one inventory before computing distance. Collapse allophonic distinctions (flapped /t/, aspiration, dark /l/, schwa reduction) to avoid false alarms.
- **Short function words** ("a", "the", "of", "to") are routinely reduced in fluent speech and have few frames. Skip them, or require much stronger evidence.
- **Names, brands and OOV words**: G2P is unreliable and the user often knows the right pronunciation better than the system. Don't flag them by default, or ask the user. Code-switched words (L1 words inside English) should be excluded.
- **Thresholds**: tune for precision (e.g., flag at most 1–2 words per message), calibrated on speechocean762 word-level labels per GOP variant, and re-validated on in-domain free speech. MCC-optimal thresholds from papers are a starting point, not a product setting.
- **Presentation**: frame the feature as "polish this word" rather than "you said this wrong". Show it only for words that affect intelligibility. Make it opt-in or a soft underline. Let the user hear the corrected word in their own voice (implicit feedback, as in AI Twin) and accept or reject it. Avoid scores or percentages for accent. Offer an "ignore this word / this is how I say it" option, which also feeds the per-user accent profile.

### Gaps
- I found no quantitative study of how often Whisper-class ASR "auto-corrects" mispronounced words in L2 speech. This needs an internal measurement, e.g., Whisper on speechocean762 words labelled mispronounced, checking whether the transcript equals the canonical word.
- I found no published functional-load-weighted MDD system with released code, and no concrete algorithm for "accent vs error" separation beyond Kyriakopoulos et al. (full text not read).
- I found no user study specifically on word-level mispronunciation flags inside a messaging product.

## Q4. Fixing: regenerating the mispronounced word with correct pronunciation in the speaker's own voice

### Takeaway
"Detect, then resynthesize in the learner's voice" has been done in research: the Golden Speaker line (accent conversion of whole utterances), Masked Acoustic Unit (2021–22, which infills only the error region in the learner's voice), and CorrectSpeech (ISCSLP 2022, ASR → align with target text → edit → regenerate). None of these has released code. The practical route in 2026 is a modern open speech editor (dots.tts.edit, VoiceCraft, F5-TTS edit) asked to re-say the *same* word over a masked span. Since none has an English IPA override, correctness relies on the editor's text front end. VoiceCraft is the one editor whose phoneme tokenizer can be fed custom phones. Every regenerated word should be re-verified with the MDD scorer.

### Cited Findings
**Golden speaker / accent conversion for CAPT**
- Felps et al. (2009) proposed that the ideal "golden speaker" for a learner is their own voice with a native accent. Golden Speaker Builder (Ding et al., Speech Communication 2019) is a web tool that lets learners build such personalized voices. — [ScienceDirect: Golden Speaker Builder](https://www.sciencedirect.com/science/article/abs/pii/S0167639319302675); [ResearchGate](https://www.researchgate.net/publication/336985400_Golden_Speaker_Builder_-_An_interactive_tool_for_pronunciation_training)
- In a GSB study, independent listeners rated learners' posttest speech as more comprehensible and fluent than at pretest. Learners reported that the golden-speaker voices helped them perceive intonation and stress differences. Prosody-transfer approaches keep segmental (phoneme) errors in the learner's voice, which is the gap accent conversion addresses. — [ResearchGate GSB](https://www.researchgate.net/publication/336985400_Golden_Speaker_Builder_-_An_interactive_tool_for_pronunciation_training) (search-summary level)
- Learners who imitated voices similar to their own (gender, pitch, speech rate) improved pronunciation more than those imitating dissimilar voices. — [ScienceDirect: Investigation of golden speakers (2010)](https://www.sciencedirect.com/science/article/abs/pii/S0167639310001494) (abstract level)
- TAMU's Gutierrez-Osuna group, which also built L2-ARCTIC, has a 2024 book-chapter preprint "Speech synthesis and pronunciation…". I could not extract its text. — [TAMU PSI preprint PDF](https://psi.engr.tamu.edu/wp-content/uploads/2024/09/book-chapter-preprint.pdf)

**Papers that detect, then correct in the learner's own voice**
- Masked Acoustic Unit for Mispronunciation Detection and Correction (Zhang, Wang, Yang, Zhejiang U.; arXiv 2108.05517 v2 May 2022). A VQ-VAE acoustic-unit model is trained on LibriSpeech plus unannotated L2-ARCTIC. Detected error regions in the learner's unit sequence are replaced with <MASK> and infilled conditioned on the target phonemes, then decoded with Parallel WaveGAN. Only the error region changes, so "the generated speech retains the style of the speaker" ("self-imitating" feedback).
  - Results: correction WER is "comparable" to baselines with the best listener preference (20 volunteers). Detection F1 is 0.438.
  - Samples: https://zju-zhan-zhang.github.io/mispronunciation-d-c/. No code.
  - Source: [arXiv 2108.05517](https://arxiv.org/html/2108.05517v2)
- CorrectSpeech (Tan, Deng, Zheng, Yeung, Jiang, Chen, Lee; ISCSLP 2022). A fully automated system: recognize speech into a time-stamped symbol sequence, align it with the target text to locate and classify edits, then generate corrected speech. Tested on perturbed VCTK and L2-ARCTIC, it "can correct mispronunciations and reduce accent". Quality depends on the recognition and alignment modules and on the granularity of edits. Demo at daxintan-cuhk.github.io/CorrectSpeech/. No code link. — [arXiv 2204.05460](https://arxiv.org/abs/2204.05460)
- Pronunciation Deviation Analysis Through Voice Cloning (Valdivia et al., arXiv 2507.10985, Jul 2025) works in the reverse direction. It clones the user's voice saying the text correctly, then treats the regions of maximal frame-level acoustic deviation between original and clone as likely mispronunciations. The abstract names no model, dataset or numbers, and there is no code. — [arXiv 2507.10985](https://arxiv.org/abs/2507.10985)
- PTeacher (2021) is a personalized CAPT system with exaggerated audio-visual corrective feedback. — [arXiv 2105.05182](https://arxiv.org/pdf/2105.05182) (title-level only)

**Evidence that hearing yourself corrected helps**
- Kusz & Pawliszko (2025, Int. J. Applied Linguistics): 21 Polish learners of English did 8 weeks of self-imitation of AI-voice-cloned (Revoicer, Speechify) utterances, 3×/week (45 min/week). They showed significant gains in fluency and comprehensibility on 7-point ratings, with pre/post/delayed tests. The abstract does not mention a control group. — [Wiley IJAL](https://onlinelibrary.wiley.com/doi/10.1111/ijal.70014?af=R)
- Self-imitation prosodic training led L2 learners to converge prosodically toward native speakers. — [Languages 9(1):33](https://doi.org/10.3390/languages9010033)
- AI Twin (CHI 2026): own-voice implicit rephrasing was more motivating than explicit correction (see Q3). — [arXiv 2601.11103](https://arxiv.org/abs/2601.11103)

**Pronunciation/phoneme control in current editors and TTS**
- dots.tts.edit (rednote / dots studio, Aug 2026) edits via inline tags `<del>`, `<ins>`, `<sub targ="…">`, `<emo>`, `<pitch>`, `<rate>`, `<enhance>`, `<bg>`, `<pause/>`, `<spk_transfer/>`. It has **no phoneme, pinyin or IPA tag**, supports English and Mandarin, and outputs 48 kHz. The card warns that edited speech "may contain pronunciation… errors". — [HF dots-studio/dots.tts.edit](https://huggingface.co/dots-studio/dots.tts.edit)
- dots.tts.edit reports the lowest edited-region WER/CER (12.95%) among learned systems on its doteBench, with non-edit WER 0.85%. — [arXiv 2608.02673](https://arxiv.org/pdf/2608.02673); details in sibling notes `speech_editing_models.md`
- Step-Audio-EditX (StepFun, 3B, Apache-2.0 code): "Polyphone pronunciation control, all you need to do is replace the polyphonic characters with pinyin", e.g., `我也想guo4guo4guo1儿…`. This is Chinese only. English phoneme control is not mentioned, and the README's feature plan still lists it as unchecked. The examples regenerate whole outputs, and span-level editing is unconfirmed. — [GitHub stepfun-ai/Step-Audio-EditX](https://github.com/stepfun-ai/Step-Audio-EditX)
- IndexTTS (v1) can correct Chinese character pronunciation using pinyin (character-pinyin hybrid modelling). I found no confirmation for IndexTTS2 or for English phones. — [HF IndexTeam/Index-TTS](https://huggingface.co/IndexTeam/Index-TTS); [IndexTTS arXiv 2502.05512](https://arxiv.org/html/2502.05512v1)
- F5-TTS conditions on reference transcript plus target text (characters). The search found no explicit phoneme or IPA interface. — [Cross-Lingual F5-TTS arXiv 2509.14579](https://arxiv.org/pdf/2509.14579) (search-summary level)
- VoiceCraft's `TextTokenizer` hard-codes phonemizer's `EspeakBackend` (default `en-us`, phones separated by `|`, words by `_`). Its `to_list()` accepts an already-phonemized string, so a caller could in principle inject a custom espeak-IPA phone sequence for the target word. This is not an officially supported path. — [VoiceCraft data/tokenizer.py](https://raw.githubusercontent.com/jasonppy/VoiceCraft/master/data/tokenizer.py)
- GLM-TTS reportedly has a "phoneme-in" hybrid text+phoneme mode with a custom replacement file (`configs/custom_replace.jsonl`). This comes from a third-party guide, not verified. — [dev.to GLM-TTS guide](https://dev.to/czmilo/glm-tts-complete-guide-2025-revolutionary-zero-shot-voice-cloning-with-reinforcement-learning-m8m)
- Counterfactual Activation Editing (Interspeech 2025) corrects prosody and mispronunciation post hoc by editing the internal activations of a pretrained TTS without retraining. It is aimed at G2P-poor settings and corrects TTS output, not learner audio. — [arXiv 2506.00832](https://arxiv.org/abs/2506.00832)
- Vox-Evaluator (arXiv 2510.20210) locates time spans with pronunciation errors in synthesized speech and regenerates those segments. It also serves as a reward model. — [arXiv 2510.20210](https://arxiv.org/pdf/2510.20210)

### Inferences
- **Simplest working "fix" for ReSpeak:**
  1. Take the ASR word span and pad it to phone-safe boundaries (see `seamless_splicing_eval.md`).
  2. Ask the editor to replace the word with *itself*, e.g., dots.tts.edit `<sub targ="word">word</sub>`, or VoiceCraft/F5-TTS edit with the same target text over the masked span.
  3. Because the original audio of that word is masked, the model has to generate the word from its text front end (canonical G2P), with voice and prosody taken from the surrounding context.
  4. Verify: re-run the MDD scorer on the new span. Accept only if GOP improves and ASR still reads the word; otherwise retry with a new seed, or fall back to a slightly longer span such as the word plus its neighbours.
- **Risk: the editor copies the accent from context.** Zero-shot cloning tends to carry over the L2 accent (AI Twin observation), so a regenerated word may be "accented-correct" rather than native-like. For a "fix the word" feature that is arguably desirable, since a native-accent island inside an accented message would sound spliced. The success criterion is phonemic correctness, not nativeness.
- **Phoneme-level control for English is the main tooling gap.** dots.tts.edit and F5-TTS take text only. VoiceCraft (espeak phones internally) is the most hackable for forcing a specific pronunciation, e.g., for heteronyms ("read", "live") or names where G2P is wrong. The context word or the user can disambiguate heteronyms; respelling ("LIV" vs "LYV") is a text-level hack worth testing with text-only editors.
- **Masked-AU and CorrectSpeech show the end-to-end loop is feasible.** Neither has code, so ReSpeak would assemble it from an open MDD scorer, an open editor and a verifier. Vox-Evaluator-style span checking is a good automatic QA step.

### Gaps
- I found no paper evaluating a modern 2025–2026 zero-shot speech editor specifically on *correcting L2 mispronunciations*, measuring post-edit GOP, speaker similarity and naturalness. ReSpeak would need its own evaluation, e.g., on speechocean762 words labelled mispronounced.
- I did not read the TAMU 2024 book chapter (PDF not extractable) or the full GSB paper, so effect sizes are not verified.
- I could not confirm an official English IPA/phoneme input for F5-TTS, IndexTTS2, CosyVoice or GLM-TTS.
- I found no code release for Masked-AU, CorrectSpeech or the voice-cloning deviation paper.

## Q5. Datasets with real human mispronunciations: availability and licences

### Takeaway
speechocean762 is the only major phone/word-annotated L2 English set that is clearly usable commercially (OpenSLR: CC BY 4.0; HF mirror: Apache-2.0). It is read speech by Mandarin L1 speakers. L2-ARCTIC (24 speakers, 6 L1s, ~3.6k phone-annotated utterances, plus a spontaneous "suitcase" subset) and EpaDB are non-commercial. Speak & Improve 2025 is large and non-commercial, and I found no phone-level pronunciation labels in it.

### Cited Findings
- **speechocean762**: 5,000 English utterances, 250 speakers, Mandarin L1, roughly half children. Five experts scored each utterance at sentence, word and phone level. Licence on OpenSLR (SLR101) is CC BY 4.0, with a ~520 MB tar.gz and the latest version at github.com/jimbozhang/speechocean762. — [OpenSLR 101](https://www.openslr.org/101/); [arXiv 2104.01378](https://arxiv.org/abs/2104.01378)
- The HF `mispeech/speechocean762` mirror is licensed **apache-2.0**, with train 2.5k / test 2.5k. It has sentence scores (accuracy, completeness, fluency, prosodic, total) and word fields (accuracy, stress, total, phones, phones-accuracy, `mispronunciations` with `canonical-phone` and `index`). The two sources state different licences, but both permit commercial use with attribution. — [HF mispeech/speechocean762](https://huggingface.co/datasets/mispeech/speechocean762)
- Other HF mirrors exist (jbpark0614/speechocean762, KoelLabs/SpeechOcean). One card notes that phonetic-level evaluation is omitted in its copy. — [HF jbpark0614/speechocean762](https://huggingface.co/datasets/jbpark0614/speechocean762)
- **L2-ARCTIC** (TAMU): 24 speakers (Hindi, Korean, Mandarin, Spanish, Arabic, Vietnamese; 2M+2F each), ~1 h each of read CMU-ARCTIC prompts (~1,132 sentences). About 150 utterances per speaker are manually annotated with phone substitutions, deletions and additions. v5.0 (2020-03-12) added the spontaneous "suitcase" corpus with annotations for 22 of 24 speakers.
  - Licence: **CC BY-NC 4.0**. Other uses require contacting Dr. Ricardo Gutierrez-Osuna (rgutier@tamu.edu).
  - Access: fill in name, email and affiliation, tick the agreement box, and get an emailed Google Drive link.
  - Source: [TAMU L2-ARCTIC page](https://psi.engr.tamu.edu/l2-arctic-corpus/)
- L2-ARCTIC has 3,599 annotated utterances and 23,268 unannotated. — [arXiv 2108.05517](https://arxiv.org/html/2108.05517v2). A gated HF mirror with the same CC BY-NC licence: [KoelLabs/L2ArcticSpontaneousSplit](https://huggingface.co/datasets/KoelLabs/L2ArcticSpontaneousSplit)
- **EpaDB** (English Pronunciation by Argentinians): 50 Argentine Spanish speakers, 64 phrases each, ~3.5 h, ~3,200 utterances, with phone-level annotations and per-phrase non-nativeness scores. The licence conflicts: HF card CC BY-NC 4.0 vs CONICET repository CC BY-NC-SA 2.5 AR. Either way it is non-commercial. — [HF hashmin/epadb](https://huggingface.co/datasets/hashmin/epadb/blob/main/README.md); [CONICET](https://ri.conicet.gov.ar/handle/11336/161618); [CACM overview](https://cacm.acm.org/latin-america-regional-special-section/automatic-pronunciation-assessment-systems-for-english-students-from-argentina); [Interspeech 2019](https://www.isca-archive.org/interspeech_2019/vidal19_interspeech.html)
- **Speak & Improve Corpus 2025** (Cambridge/ELiT): ~315–340 h of L2 English (CEFR A2–C1), ~55–60 h manually transcribed. It has transcriptions, disfluency labels, grammatical error corrections and proficiency scores. The search found **no phone-level pronunciation labels**. It is distributed for non-commercial use via ELiT; the Cambridge repository lists "All rights reserved, open access", DOI 10.17863/CAM.114333. — [arXiv 2412.11986](https://arxiv.org/pdf/2412.11986); [Cambridge repository](https://www.repository.cam.ac.uk/handle/1810/377542)
- **CMU Kids** (9.1 h, 5,180 sentences, 89 children aged 6–11) was used with real errors for GOP evaluation. It is child L1 speech, not L2. — [arXiv 2507.16838](https://arxiv.org/html/2507.16838v1)
- **Iqra'Eval 2** is an Arabic MDD leaderboard where CROTTC-IF reports 71.70 F1. — [arXiv 2604.22133](https://arxiv.org/html/2604.22133)
- My Pronunciation Coach (MPC; 3,130 utterances, 71 Dutch secondary students) was used in logit-GOP work with simulated errors. I did not find public availability. — [arXiv 2506.12067](https://arxiv.org/html/2506.12067)

### Inferences
- For a commercial ReSpeak: calibrate and evaluate on speechocean762, which is commercially usable. Use L2-ARCTIC (including the spontaneous suitcase subset, closest to ReSpeak's free speech) and EpaDB only for internal research evaluation unless a licence is negotiated with TAMU or the EpaDB authors. Models fine-tuned on L2-ARCTIC, such as `mrrubino/...l2-arctic-phoneme` (Apache-2.0 card) or IF-MDD-trained weights, carry licence ambiguity inherited from CC BY-NC training data.
- speechocean762 covers only one L1 (Mandarin) and is half children, so thresholds tuned on it may not transfer to other L1s. A small in-house annotated set of real ReSpeak voice messages, with consent, will be needed.
- Synthetic mispronunciations (phone substitution + TTS/voice cloning) are a commercially clean way to enlarge training data. The voice-cloning deviation paper's related work cites gains from such data. — [arXiv 2507.10985](https://arxiv.org/pdf/2507.10985) (secondary claim)

### Gaps
- **ISLE corpus** (German/Italian learners of English): no availability or licence information found.
- I did not check whether Speak & Improve includes any word-level pronunciation error labels in its full release (abstract-level only).
- The exact text of L2-ARCTIC's LICENSE file was not read. Commercial terms are "contact the authors".
- The MultiPA out-of-domain open-response dataset may be relevant to free speech, but I did not verify its availability.
