// TEMPORARY placeholder example (built by tools/make_placeholders.py). The real one goes in examples/mispron/example.js.
(window.PLACEHOLDER_EXAMPLES = window.PLACEHOLDER_EXAMPLES || {})['mispron'] = {
 "title": "One word, close up",
 "synthetic": true,
 "placeholder": true,
 "speaker": {
  "label": "AI-generated demo voice",
  "dataset": "",
  "license": "",
  "attribution": "ElevenLabs stock voice 'Jessica' (synthetic test take, not a recording of a person)",
  "url": ""
 },
 "before": {
  "src": "before.mp3",
  "dur": 3.674,
  "words": [
   {
    "w": "Can",
    "s": 0.025,
    "e": 0.185
   },
   {
    "w": "you",
    "s": 0.225,
    "e": 0.386
   },
   {
    "w": "be",
    "s": 0.426,
    "e": 0.626
   },
   {
    "w": "more",
    "s": 0.666,
    "e": 1.287
   },
   {
    "w": "pacific",
    "s": 1.347,
    "e": 2.248,
    "tag": "misspoken"
   },
   {
    "w": "about",
    "s": 2.308,
    "e": 2.568
   },
   {
    "w": "game",
    "s": 2.628,
    "e": 2.828
   },
   {
    "w": "night?",
    "s": 2.869,
    "e": 3.669
   }
  ]
 },
 "after": {
  "src": "after.mp3",
  "dur": 3.514,
  "words": [
   {
    "w": "Can",
    "s": 0.0,
    "e": 0.14
   },
   {
    "w": "you",
    "s": 0.14,
    "e": 0.3
   },
   {
    "w": "be",
    "s": 0.3,
    "e": 0.48
   },
   {
    "w": "more",
    "s": 0.48,
    "e": 0.92
   },
   {
    "w": "specific",
    "s": 0.92,
    "e": 1.72,
    "tag": "regenerated"
   },
   {
    "w": "about",
    "s": 1.72,
    "e": 2.32,
    "tag": "regenerated"
   },
   {
    "w": "game",
    "s": 2.32,
    "e": 2.6
   },
   {
    "w": "night?",
    "s": 2.6,
    "e": 3.06
   }
  ]
 },
 "edits": [
  {
   "type": "replace",
   "old": "pacific",
   "new": "specific"
  }
 ],
 "focus": {
  "word": "specific",
  "beforeT0": 1.347,
  "beforeT1": 2.248,
  "afterT0": 1.296,
  "afterT1": 2.096
 },
 "caption": "Only 'specific' is regenerated; every other sample is the original take.",
 "source": "demoscript/out/scriptAnormal_jessica.json"
};
