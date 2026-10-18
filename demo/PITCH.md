# Ctrl+Voice — the 3-minute pitch video

This is the source of truth for the 3-minute video. The deck (`pitch/`, an HTML presentation) is built around it.

**Format:** an HTML presentation that runs in any browser, with no PowerPoint licence needed.
- You talk. Each slide's example audio plays by itself when you click to it.
- The script below is in the speaker notes: press **S** to open them in a second window.
- The video is a screen recording of you presenting it: OBS for the slides, your mic for the voice.
- A backup that needs no live presenter is the deck's auto mode, timed playback without narration.

**Technical details are not in this video.** The close says they come in the finals.

## The narrative (the user's, 2026-10-18)

> You've probably heard of Grammarly: you write some text, and it corrects it and rewrites it. But have you ever wondered if the same thing exists for voice? Well, it exists now. Our application, Ctrl+Voice, lets you record your voice and, in your voice:
> - correct mispronounced words;
> - remove filler words such as "umm";
> - with a command ("scratch that"), remove the last thing you said, so you can optionally say it again correctly.
>
> Here's an example: two voices, one with the ums and the mistakes, and one corrected (a synthetic voice or a good dataset example).
>
> Next slide. Our product doesn't just offer this. It also changes your tone. Say you're very tired and don't have the energy to say something confidently: you use this mode, and it turns your audio into a confident tone without anyone noticing.
>
> Another feature: say you have an accent and want to lose it. The Native accent option converts your audio to a native accent.
>
> Show demos and examples. This application makes people's speech seamless, whether they're sending a voice message to a colleague, recording a YouTube video, giving a speech, or anything else.
>
> Say it's very seamless, made with ML, and no one will notice. If we're accepted, you'll see the technical details of how it's done in the finals.

The focus is on **fixing mispronounced words**, with the best real examples we can find.

## Slides and script (3:00)

Estimated: about 300 spoken words at roughly 150 wpm, plus about 60 s of example audio.

The presentation runs first. Then you switch to Discord for a live part, and you finish on the last slide.

| # | Time | On screen (minimal text, visuals) | Audio that plays | Script (speaker notes) |
|---|---|---|---|---|
| 1 | 0:00–0:10 | A sentence typed with a mistake. A red squiggle appears, and the sentence corrects itself, text-checker style (no third-party logos). | — | "You've probably heard of Grammarly. You write some text, and it corrects and rewrites it for you. But have you ever wondered if the same thing exists for your voice?" |
| 2 | 0:10–0:18 | A waveform with the same squiggle, which then corrects itself. **Ctrl+Voice**. Small text: *7 billion voice messages a day. None of them has an undo.* | — | "Well, now it does. People send about 7 billion voice messages a day on WhatsApp alone, and none of them can be edited. This is Ctrl+Voice." |
| 3 | 0:18–0:33 | Three items appear one at a time: **Fixes mispronounced words** · **Removes ums and false starts** · **"Scratch that" deletes what you just said**. Underneath: *All in your own voice.* | — | "You record your voice the way you normally talk, and Ctrl+Voice fixes it, in your own voice. It corrects words you mispronounced, removes fillers like 'umm', and if you say 'scratch that', it deletes the last thing you said, so you can say it again properly." |
| 4 | 0:33–1:00 | **Before / After.** The transcript runs karaoke-style: fillers in red, the scratched sentence struck through, wrong words underlined. Then After, with the regenerated words highlighted. | Before plays on entry. After plays on the next click. | "Here's an example. The original…" *(Before plays)* "…and what Ctrl+Voice turns it into." *(click, After plays)* "Same voice. The ums are gone, the sentence they took back is gone, and the words they got wrong are fixed." |
| 5 | 1:00–1:20 | **One word, close up.** One sentence with the mispronounced word circled. Label: *Only this word is regenerated. Everything else is the original recording.* | Before on entry, After on click. | "Let's zoom in on one word…" *(Before)* "…and after." *(After)* "Only that one word was regenerated. Every other sound is still their original recording." |
| 6 | 1:20–1:40 | **Tired → Confident**, with a slider moving to Confident. | Before on entry, After on click. | "It doesn't stop at mistakes. Say you're exhausted and don't have the energy to sound confident. Turn on Confident, and your message sounds sure of itself. Still your voice." |
| 7 | 1:40–2:00 | **Native accent**. Labels: *dataset speaker* and *AI voice*. | Before on entry, After on click. | "And if you have an accent and want to sound native, Native accent converts your message to a native accent." |
| 8 | 2:00–2:10 | Use cases as tiles: a voice message to a colleague · a YouTube video · a speech · a class or podcast recording. Then: *Let's see it live.* | — | "Whether you're messaging a colleague, recording a YouTube video or giving a speech, you say it once, messy, and it comes out right. Let's see it live." |
| — | 2:10–2:50 | **Live: Discord, then the app.** | | See "The live part" below. |
| 9 | 2:50–3:00 | *Seamless. Made with ML.* **Say it messy. Send it clean.** Small text: *How it works: in the finals.* | — | "It's all done with machine learning, and it's seamless: no one will notice. If we're accepted, we'll show you how it works in the finals. Ctrl+Voice. Say it messy, send it clean." |

## The live part (2:10–2:50)
1. **Discord.** Press **Alt+\`** in the demo channel.
   - The app plays a **prerecorded take** of the demo script as its microphone, using the app's demo-mic launch option. The rest is real: live captions, "scratch that" struck out live, the engine's fixes, and the paste into Discord.
   - The message lands. Click play on it in Discord: it's clean.
2. **The app.** Open Ctrl+Voice on that message.
   - Play **Original**, then **Fixed**.
   - Point at what it removed: *Filler*, *Self-correction*, *Scratched*. Point at what it re-said: *Misspoken* "specific" and "moot".
3. **Tone.** In the editor, click **Confident**, then play it.
4. **Speed.** Processing takes about 6–18 s today. In the recording we cut that wait and show a small **"processing sped up"** tag, so the video looks fast and says so. We are also making it faster for real.

## Added to the user's outline
- **Slide 2:** the 7-billion-a-day figure, which makes the problem concrete (source: WhatsApp, March 2022).
- **Slide 5:** a close-up of one mispronounced word, which is the focus. It also proves that only that word is regenerated.
- **The live part:** the real app in Discord and the editor, so the audience sees it working inside a chat app and not only as audio pairs.
- **Slide 3:** a line on "scratch that, then say it again".

## Honesty rules (they keep "no one will notice" true)
- Every example is real engine output from the real app pipeline. No hand-edited "after" audio.
- Every voice is labelled on screen:
  - a dataset speaker: dataset name and licence attribution;
  - a synthetic voice: *AI-generated demo voice*.
- The Native accent take is a regenerated AI voice, so its slide says *AI voice*.
- "No one will notice" refers to the edits: fixed words and cuts. We pick examples where that is true, and we check by listening.
- The Confident tone is subtle (about 10% faster and about 1 semitone lower). Use the example where the change is clearest, and don't promise a dramatic transformation.

## Files
- `pitch/index.html`: the presentation. Press S for the notes window, F for fullscreen, and → or Space for the next step.
- `pitch/examples/<feature>/`: each example's audio (before and after), its transcript with word timings, and its source and licence.
