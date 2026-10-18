<!-- Slide number: 1 -->
LOVABLE HACKATHON
Ctrl+Voice
Edit what you said.
In your own voice.

### Notes:
1

<!-- Slide number: 2 -->
You can’t edit speech.

WHAT YOU SAY
“I’m free on Thursday… no no no, on Wednesday.”
A typo takes one keystroke to fix. A spoken slip means re-recording, or sending it as it is.

### Notes:
2

<!-- Slide number: 3 -->

<!-- Slide number: 4 -->
Speech in. Speech out.

Ctrl+F
Ctrl+X
Ctrl+V
Find
Cut
Voice
Locate the error in your recording.
Remove only that moment of audio.
Generate the fix in your voice, matched to the audio around it.
Text is only used to find the edit. What you get back is audio.

### Notes:
3

<!-- Slide number: 5 -->
How it works
—
[speech-to-text model]
[small LLM]
—
[speech infill model]
[Voice2Voice model]

### Notes:
Record the audio. Speech-to-text gives word timestamps (text is only a map). A small LLM decides what to fix. Cut that span. A speech model regenerates it, conditioned on the surrounding voice. Voice2Voice adjusts tone. Pronunciation path: one model finds mispronounced words, a speech-to-speech model re-speaks them.
4

<!-- Slide number: 6 -->
What it does

Grammar
Word order
Tone
“he go home” ? “he goes home”
“love I you” ? “I love you”
Calmer or more formal, same message

Semantic undo
Replacement
Pronunciation
“Thursday, no no no, Wednesday” ? “Wednesday”
Predicts what you meant and speaks it
Re-speaks only the mispronounced words

### Notes:
Every fix is generated in the speaker’s own voice.
5

<!-- Slide number: 7 -->
Live demo

BEFORE
AFTER
“I am free on Thursday, no no no, on Wednesday.”
“I am free on Wednesday.”
Same voice. Same recording. Only the mistake changed.

### Notes:
6

<!-- Slide number: 8 -->
Benchmarks
STEP
MODELS TESTED
METRIC
BEST

Timestamps
[model A, B, C]
Word timing error
[result]

Text correction
[LLM A, B, C]
Fix accuracy
[result]

Voice infill
[model A, B, C]
Voice similarity
[result]

Voice2Voice
[model A, B, C]
Listening test
[result]

Pronunciation
[model A, B, C]
Word error rate
[result]

Full pipeline
[chosen stack]
Latency per clip
[result]
Why we picked the models we picked. Fill in your measured numbers.

### Notes:
7

<!-- Slide number: 9 -->
The team

Antony
Nikoloz
[Name]
[Name]
[Name]
ML Engineer
ML Engineer
Data Analyst
MLOps / API Engineer
Software Engineer
Ctrl+Voice. Say it once.

### Notes:
8
