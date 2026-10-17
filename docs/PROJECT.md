# ReSpeak — project overview

## The problem
Voice messages are fast and personal, but they are write-once: a slip ("Monday, no wait, Wednesday"), a rambling detour, a filler-heavy start or one wrong word means re-recording or sending something messy. Recipients pay too: a 2025 UK survey (Sky Mobile, 2,000 people) found the average voice note is 3 minutes while people want 2, 44% listen at double speed and 38% often replay notes because the sender doesn't get to the point (see `research_notes/ReSpeak voice editing feasibility/prior_art_products.md`).

## The idea
Rebuild voice messaging as if AI existed from day one: a voice message you can edit like text, while it still sounds like you.

## Features (status from `docs/RESULTS.md`)
| Feature | What the user does | Status |
|---|---|---|
| Semantic undo | Press Undo/Backspace, or say "scratch that", while still recording; the last thought disappears and recording continues | Works (~350 ms) |
| Clean up | One tap removes fillers, self-corrections ("Monday, no wait,"), repeats, scratched sentences; only cuts, 100% real voice | Works (24/28 exact, 0/10 meaning-changing edits) |
| Tighten | Shortens rambling using only cuts | Works (light testing) |
| Replace a word | Click a word, type the new one; regenerated in your voice and spliced in | Works (3-6 s, ASR-verified) |
| Grammar | LLM proposes minimal fixes (agreement, tense, articles, prepositions, plurals, word order); each rendered in your voice | Works on real L2 speakers (8/8 rendered and verified) |
| Pronunciation coach | Flags words that are mispronounced for this speaker, explains which sound; "Re-say it clearly" regenerates the word; habitual accent sounds become tips, not errors | Detector works (AUC 0.88); fix works; accent tolerance is a UX choice |
| Did you mean? | Catches words the recognizer turned into other words (e.g. "road" heard as "load") | Experimental, suggestion only, often wrong |
| Tone | Natural presets (confident, calm, warm: pitch & pace only, voice untouched); AI restyle (AuK) for whole message or selection | Natural works; AI restyle experimental (voice drifts) |
| Accent removal | Dropped | No released model works for English |
| Send | Rendered message appears in a Discord-style chat with an "edited with ReSpeak" badge; AI-generated words are marked | Works (mock chat) |

## What is new (be careful with claims)
- Every building block exists somewhere: Descript regenerates words in your voice; Wispr Flow / Gboard remove "no wait" corrections but output text; Telegram/WhatsApp only offer manual trim.
- No messaging app that we found edits voice-note audio before sending, and no published system speaks a grammar correction back in the learner's own voice inside the original recording (language-learning apps were not searched). Say "to our knowledge".
- The defensible product angle is "cut first": the real recording stays the message; AI-generated words are few, verified and labelled.

## Demo script (60-90 s)
1. Record: "Hey Maya, about this weekend, um, I'll meet you on Monday, no wait, Wednesday at five at the cafe. ... my boss is an idiot" → press Backspace → keep talking.
2. Say "... honestly Jake is being annoying. Scratch that." → it disappears by itself.
3. Stop → ✨ Clean up → fillers and "Monday, no wait," struck through; play: still 100% your voice.
4. Click "cafe" → type "park" → regenerated in your voice (purple).
5. Aa Grammar on a sentence with a real error ("I didn't got it") → fixed in your voice.
6. 🗣 Pronunciation coach on a hard word → "Re-say it clearly".
7. Tone → Natural · Confident → play original vs edited → ➤ Send → chat bubble with the badge.
Fallback: "Try a sample message" (replace the synthetic sample with a real recording of yourself before the event).

## Claims to make / avoid
- Make: "Your recording is never changed; most edits are pure cuts of your real voice." "Replaced words are regenerated from your own surrounding audio and checked by re-transcription." Numbers from RESULTS.md with their test sets.
- Avoid: "removes your accent", "fixes any mispronunciation", "first ever" without "to our knowledge", any number not in RESULTS.md.
- Safety story: AI words are marked for the listener; voice is only cloned from the sender's own message; EU AI Act Art. 50 disclosure applies since Aug 2026 (AudioSeal watermarking is a cheap next step).
