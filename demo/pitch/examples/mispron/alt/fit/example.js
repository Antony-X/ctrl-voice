// Generated from engine output (so762_442_0736); see RESULTS.md. Timings are from the WAVs (the MP3 encoder adds ~25 ms of leading padding).
(window.EXAMPLES = window.EXAMPLES || {})["mispron_alt_fit"] = {
 "id": "mispron_alt_fit",
 "title": "Re-saying a mispronounced word",
 "synthetic": false,
 "speaker": {
  "label": "speechocean762 speaker 0736 (Mandarin L1)",
  "dataset": "speechocean762, test split, speaker 0736, utterance row 442: \"I THOUGHT IT WOULD FIT RIGHT IN\"",
  "license": "CC BY 4.0",
  "attribution": "speechocean762 by Speechocean and Xiaomi (Zhang et al., Interspeech 2021), CC BY 4.0. Audio processed by Ctrl+Voice.",
  "url": "https://www.openslr.org/101/"
 },
 "before": {
  "src": "examples/mispron/alt/fit/before.mp3",
  "dur": 3.7,
  "words": [
   {
    "w": "I",
    "s": 0.664,
    "e": 0.824
   },
   {
    "w": "thought",
    "s": 0.865,
    "e": 1.186
   },
   {
    "w": "it",
    "s": 1.267,
    "e": 1.79
   },
   {
    "w": "would",
    "s": 1.81,
    "e": 2.011
   },
   {
    "w": "fit",
    "s": 2.252,
    "e": 2.473,
    "tag": "mispronounced"
   },
   {
    "w": "right",
    "s": 2.493,
    "e": 2.795
   },
   {
    "w": "in.",
    "s": 2.896,
    "e": 3.036
   }
  ]
 },
 "after": {
  "src": "examples/mispron/alt/fit/after.mp3",
  "dur": 3.68,
  "words": [
   {
    "w": "I",
    "s": 0.663,
    "e": 0.824
   },
   {
    "w": "thought",
    "s": 0.864,
    "e": 1.186
   },
   {
    "w": "it",
    "s": 1.266,
    "e": 1.788
   },
   {
    "w": "would",
    "s": 1.809,
    "e": 2.21
   },
   {
    "w": "fit",
    "s": 2.231,
    "e": 2.452,
    "tag": "regenerated"
   },
   {
    "w": "right",
    "s": 2.492,
    "e": 2.773
   },
   {
    "w": "in.",
    "s": 2.833,
    "e": 2.994
   }
  ]
 },
 "edits": [
  {
   "type": "replace",
   "kind": "pronunciation",
   "appKind": "pronunciation",
   "old": "fit",
   "new": "fit",
   "t0": 2.131,
   "t1": 2.483
  }
 ],
 "focus": {
  "word": "fit",
  "beforeT0": 2.252,
  "beforeT1": 2.473,
  "afterT0": 2.231,
  "afterT1": 2.452,
  "spliceBeforeT0": 2.154,
  "spliceBeforeT1": 2.46,
  "spliceAfterT0": 2.154,
  "spliceAfterT1": 2.437
 },
 "metrics": {
  "expert_label": {
   "word": "fit",
   "accuracy": 3,
   "scale": "0-10 (speechocean762 expert word accuracy)",
   "phone_errors": [
    "IH->EH"
   ]
  },
  "detection": {
   "step": "pron",
   "flagged": true,
   "score_before": 5.8,
   "threshold": 6.8,
   "speaker_median": 10
  },
  "fix": {
   "kind": "pronunciation",
   "engine": "f5",
   "verified": true,
   "kept": true,
   "score_after_in_window": 9.53,
   "score_after_full_file": 9.4,
   "flagged_after": false,
   "candidates": [
    {
     "engine": "playdiff",
     "heard_word": true,
     "score": 8.97
    },
    {
     "engine": "f5",
     "heard_word": true,
     "score": 9.53
    }
   ]
  },
  "asr": {
   "before": "I thought it would fit right in.",
   "after": "I thought it would fit right in.",
   "word_before": "fit",
   "word_after": "fit"
  },
  "voice_similarity": null,
  "voice_similarity_note": "not reported: for re-says the engine replaces its ECAPA similarity with the pron score (and ECAPA is not measured on inserts under 0.3 s)",
  "untouched": {
   "regenerated_before_s": [
    2.154,
    2.46
   ],
   "regenerated_after_s": [
    2.154,
    2.437
   ],
   "share_of_file_untouched": 0.917,
   "bit_exact_share_of_untouched": 1,
   "max_diff_lsb": 1
  },
  "seam": {
   "click_ratio": [
    0.28,
    0.41
   ],
   "join_level_db": [
    -24.7,
    -23.9
   ],
   "mel_jump_at_join": [
    1.87,
    1.94
   ],
   "mel_jump_same_transition_in_original": [
    1.79,
    0.86
   ],
   "f0_jump_at_join_st": [
    -0.13,
    -1.03
   ],
   "word_level_db": {
    "regenerated": -22.4,
    "original": -23.7,
    "context": -21.7
   },
   "word_f0_hz": {
    "regenerated": 264.8,
    "original": 227.8,
    "context": 221.4
   },
   "energy_above_7k5_db": {
    "regenerated": -47.1,
    "original": -46.4,
    "context": -51.4
   }
  }
 },
 "caption": "\"fet\" becomes \"fit\": only that word is re-said, in the speaker's own voice."
};
