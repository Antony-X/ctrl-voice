// Generated from engine output (so762_478_0765); see RESULTS.md. Timings are from the WAVs (the MP3 encoder adds ~25 ms of leading padding).
(window.EXAMPLES = window.EXAMPLES || {})["mispron_alt_trial"] = {
 "id": "mispron_alt_trial",
 "title": "Fixing a mispronounced word",
 "synthetic": false,
 "speaker": {
  "label": "speechocean762 speaker 0765 (Mandarin L1)",
  "dataset": "speechocean762, test split, speaker 0765, utterance row 478: \"I SHALL BE AT HAND FOR THE TRIAL\"",
  "license": "CC BY 4.0",
  "attribution": "speechocean762 by Speechocean and Xiaomi (Zhang et al., Interspeech 2021), CC BY 4.0. Audio processed by Ctrl+Voice.",
  "url": "https://www.openslr.org/101/"
 },
 "before": {
  "src": "examples/mispron/alt/trial/before.mp3",
  "dur": 4.335,
  "words": [
   {
    "w": "I",
    "s": 0.662,
    "e": 0.903
   },
   {
    "w": "shall",
    "s": 0.943,
    "e": 1.305
   },
   {
    "w": "be",
    "s": 1.345,
    "e": 1.646
   },
   {
    "w": "at",
    "s": 1.706,
    "e": 1.846
   },
   {
    "w": "hand",
    "s": 1.887,
    "e": 2.308
   },
   {
    "w": "for",
    "s": 2.348,
    "e": 2.589
   },
   {
    "w": "the",
    "s": 2.609,
    "e": 3.151
   },
   {
    "w": "trail.",
    "s": 3.211,
    "e": 3.512,
    "tag": "mispronounced"
   }
  ]
 },
 "after": {
  "src": "examples/mispron/alt/trial/after.mp3",
  "dur": 4.5,
  "words": [
   {
    "w": "I",
    "s": 0.643,
    "e": 0.904
   },
   {
    "w": "shall",
    "s": 0.945,
    "e": 1.306
   },
   {
    "w": "be",
    "s": 1.346,
    "e": 1.648
   },
   {
    "w": "at",
    "s": 1.708,
    "e": 1.849
   },
   {
    "w": "hand",
    "s": 1.889,
    "e": 2.311
   },
   {
    "w": "for",
    "s": 2.351,
    "e": 2.592
   },
   {
    "w": "the",
    "s": 2.633,
    "e": 3.195
   },
   {
    "w": "trial.",
    "s": 3.236,
    "e": 3.698,
    "tag": "regenerated"
   }
  ]
 },
 "edits": [
  {
   "type": "replace",
   "kind": "misspoken",
   "appKind": "misspoken",
   "old": "trail",
   "new": "trial",
   "t0": 3.181,
   "t1": 3.552
  }
 ],
 "focus": {
  "word": "trial",
  "beforeT0": 3.211,
  "beforeT1": 3.512,
  "afterT0": 3.236,
  "afterT1": 3.698,
  "spliceBeforeT0": 3.204,
  "spliceBeforeT1": 3.599,
  "spliceAfterT0": 3.204,
  "spliceAfterT1": 3.765
 },
 "metrics": {
  "expert_label": {
   "word": "trial",
   "accuracy": 5,
   "scale": "0-10 (speechocean762 expert word accuracy)",
   "phone_errors": [
    "AY->IH",
    "AH-><DEL>"
   ]
  },
  "detection": {
   "step": "misspoken",
   "asr_wrote": "trail.",
   "pron_flagged": false,
   "pron_score": 9.9,
   "note": "the recognizer wrote the mispronounced form, so the text check found it; the pron step scores the audio against that form and passed it"
  },
  "fix": {
   "kind": "misspoken",
   "engine": "f5",
   "verified": true,
   "kept": true,
   "score_after_in_window": null,
   "score_after_full_file": null,
   "flagged_after": null,
   "candidates": [
    {
     "engine": "playdiff",
     "heard_word": true,
     "score": null
    },
    {
     "engine": "f5",
     "heard_word": true,
     "score": null
    }
   ]
  },
  "asr": {
   "before": "I shall be at hand for the trail.",
   "after": "I shall be at hand for the trial.",
   "word_before": "trail.",
   "word_after": "trial."
  },
  "voice_similarity": 0.433,
  "voice_similarity_note": "engine ECAPA cosine, inserted word vs the speech around it (0.5 = placeholder for inserts under 0.3 s)",
  "untouched": {
   "regenerated_before_s": [
    3.204,
    3.599
   ],
   "regenerated_after_s": [
    3.204,
    3.765
   ],
   "share_of_file_untouched": 0.909,
   "bit_exact_share_of_untouched": 1,
   "max_diff_lsb": 1
  },
  "seam": {
   "click_ratio": [
    0.46,
    0.06
   ],
   "join_level_db": [
    -28.2,
    -43.6
   ],
   "mel_jump_at_join": [
    0.78,
    1.79
   ],
   "mel_jump_same_transition_in_original": [
    0.98,
    0.57
   ],
   "f0_jump_at_join_st": [
    null,
    -0.43
   ],
   "word_level_db": {
    "regenerated": -23.2,
    "original": -20.6,
    "context": -24
   },
   "word_f0_hz": {
    "regenerated": 146.9,
    "original": 133.1,
    "context": 160.2
   },
   "energy_above_7k5_db": {
    "regenerated": -23.2,
    "original": -35.3,
    "context": -25.9
   }
  }
 },
 "caption": "\"trail\" becomes \"trial\": only that word is re-said, in the speaker's own voice."
};
