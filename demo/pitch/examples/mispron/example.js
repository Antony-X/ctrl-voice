// Generated from engine output (so762_1502_2937); see RESULTS.md. Timings are from the WAVs (the MP3 encoder adds ~25 ms of leading padding).
(window.EXAMPLES = window.EXAMPLES || {})["mispron"] = {
 "id": "mispron",
 "title": "Fixing a mispronounced word",
 "synthetic": false,
 "speaker": {
  "label": "speechocean762 speaker 2937 (Mandarin L1)",
  "dataset": "speechocean762, test split, speaker 2937, utterance row 1502: \"POLICE HAVE YET TO CHARGE ANYONE IN BOMBINGS\"",
  "license": "CC BY 4.0",
  "attribution": "speechocean762 by Speechocean and Xiaomi (Zhang et al., Interspeech 2021), CC BY 4.0. Audio processed by Ctrl+Voice.",
  "url": "https://www.openslr.org/101/"
 },
 "before": {
  "src": "examples/mispron/before.mp3",
  "dur": 4.02,
  "words": [
   {
    "w": "Police",
    "s": 0.563,
    "e": 0.985
   },
   {
    "w": "have",
    "s": 1.005,
    "e": 1.186
   },
   {
    "w": "yet",
    "s": 1.226,
    "e": 1.467
   },
   {
    "w": "to",
    "s": 1.487,
    "e": 1.668
   },
   {
    "w": "charge",
    "s": 1.708,
    "e": 2.05
   },
   {
    "w": "anyone",
    "s": 2.11,
    "e": 2.553
   },
   {
    "w": "in",
    "s": 2.613,
    "e": 2.734
   },
   {
    "w": "boomings.",
    "s": 2.794,
    "e": 3.256,
    "tag": "mispronounced"
   }
  ]
 },
 "after": {
  "src": "examples/mispron/after.mp3",
  "dur": 4.03,
  "words": [
   {
    "w": "Police",
    "s": 0.562,
    "e": 0.963
   },
   {
    "w": "have",
    "s": 1.003,
    "e": 1.184
   },
   {
    "w": "yet",
    "s": 1.224,
    "e": 1.465
   },
   {
    "w": "to",
    "s": 1.485,
    "e": 1.666
   },
   {
    "w": "charge",
    "s": 1.706,
    "e": 2.067
   },
   {
    "w": "anyone",
    "s": 2.107,
    "e": 2.548
   },
   {
    "w": "in",
    "s": 2.609,
    "e": 2.729
   },
   {
    "w": "bombings.",
    "s": 2.769,
    "e": 3.271,
    "tag": "regenerated"
   }
  ]
 },
 "edits": [
  {
   "type": "replace",
   "kind": "misspoken",
   "appKind": "grammar",
   "old": "boomings",
   "new": "bombings",
   "t0": 2.764,
   "t1": 3.296
  }
 ],
 "focus": {
  "word": "bombings",
  "beforeT0": 2.794,
  "beforeT1": 3.256,
  "afterT0": 2.769,
  "afterT1": 3.271,
  "spliceBeforeT0": 2.742,
  "spliceBeforeT1": 3.343,
  "spliceAfterT0": 2.742,
  "spliceAfterT1": 3.356
 },
 "metrics": {
  "expert_label": {
   "word": "bombings",
   "accuracy": 5,
   "scale": "0-10 (speechocean762 expert word accuracy)",
   "phone_errors": [
    "AH->UH"
   ]
  },
  "detection": {
   "step": "grammar",
   "asr_wrote": "boomings.",
   "pron_flagged": false,
   "pron_score": 9.9,
   "note": "the recognizer wrote the mispronounced form, so the text check found it; the pron step scores the audio against that form and passed it"
  },
  "fix": {
   "kind": "grammar",
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
   "before": "Police have yet to charge anyone in boomings.",
   "after": "Police have yet to charge anyone in bombings.",
   "word_before": "boomings.",
   "word_after": "bombings."
  },
  "voice_similarity": 0.631,
  "voice_similarity_note": "engine ECAPA cosine, inserted word vs the speech around it (0.5 = placeholder for inserts under 0.3 s)",
  "untouched": {
   "regenerated_before_s": [
    2.742,
    3.343
   ],
   "regenerated_after_s": [
    2.742,
    3.356
   ],
   "share_of_file_untouched": 0.851,
   "bit_exact_share_of_untouched": 1,
   "max_diff_lsb": 0
  },
  "seam": {
   "click_ratio": [
    0.03,
    0.97
   ],
   "join_level_db": [
    -31.9,
    -23.6
   ],
   "mel_jump_at_join": [
    1.63,
    0.58
   ],
   "mel_jump_same_transition_in_original": [
    1.27,
    0.46
   ],
   "f0_jump_at_join_st": [
    0.56,
    null
   ],
   "word_level_db": {
    "regenerated": -16.7,
    "original": -16.8,
    "context": -17.7
   },
   "word_f0_hz": {
    "regenerated": 159.3,
    "original": 163.5,
    "context": 172.7
   },
   "energy_above_7k5_db": {
    "regenerated": -43.4,
    "original": -38.9,
    "context": -43.5
   }
  }
 },
 "caption": "\"boomings\" becomes \"bombings\": only that word is re-said, in the speaker's own voice."
};
