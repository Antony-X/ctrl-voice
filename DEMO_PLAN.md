# Ctrl+Voice — the 3-minute demo video

**The problem, in one line:** voice messages are the only thing we send that can't be edited. Text has backspace; voice has re-record. About 7 billion voice messages are sent on WhatsApp every day (WhatsApp, March 2022).

**What's new:** Ctrl+Voice edits the speech itself, in your own voice, inside the chat you already use. It regenerates only the word that needs fixing, and keeps every other sample as your original recording. Dictation apps do the opposite: they turn you into text and throw the voice away.

**The device:** each segment shows one mistake people make in voice notes, then the fix, then proof that it's still you.

## Storyboard (3:00)

| Time | Segment | On screen | Wow moment | Source |
|---|---|---|---|---|
| 0:00–0:12 | Cold open | Black. A real messy voice note plays: um, "Monday, no wait, Wednesday", a jab, then "scratch that". The transcript runs karaoke-style, with the mistakes in red. Card: **Voice messages have no backspace.** | You hear the problem before anyone explains it | Your voice, recorded |
| 0:12–0:22 | Problem | "7 billion a day." Re-record, re-record, re-record. | | Motion graphics |
| 0:22–1:00 | **Live in Discord** | Real screen. Press Alt+\`, talk messy, say "scratch that". **Zoom on the pill**: the sentence strikes through and vanishes while you keep talking. Press Alt+\` again. "Cleaning up…", then the message lands in the channel. Press play: it's clean. | The live caption deleting the sentence you took back | Real screen recording, you talking live |
| 1:00–1:35 | **Misspoken word** | You say a word everyone knows, wrong (picked from validated candidates, e.g. "pacifically" for "specifically"). The editor marks it *Misspoken* and re-says it in your voice. A/B: Original, then Fixed. Then the proof: the two waveforms overlaid, identical except one word-sized slice. | "Every other sample is my original recording" | Real app, real engine |
| 1:35–2:00 | **Set it once: grumpy → confident** | Settings → Your sound: drag Confident up. A grumpy line ("ugh… fine, I'll do the slides") plays before and after. | The same words with a different attitude | Real app |
| 2:00–2:25 | **Heavy accent → native accent** | A heavily accented speaker, then the same speaker with a native accent. | Same person, new accent | *Pending the accent prototype.* The segment is cut if it doesn't hold up. |
| 2:25–2:45 | How it works | One animated line: **Find → Cut → Voice**, then "regenerate one word, not the clip". Voice similarity 0.976 vs 0.733. "Scratch that" in 351 ms. | | Motion graphics, numbers from RESULTS.md |
| 2:45–3:00 | Close | "Works in Discord, WhatsApp, Telegram, Slack." **Say it messy. Send it clean.** Team. | | |

The ≤60 s film being built now provides the cold open and the problem shots (0:00–0:22) and the How-it-works animation.

## Rules
- Every voice in the demo is a real person: you, a teammate, or a dataset speaker, labeled on screen. The only AI-made audio is the words the app regenerates, and the video says so.
- Every app shot is the real app on the real engine. No mocked UI, no hand-made "after" audio.
- We may do several takes and keep the best one. That's normal. We don't change the output.

## How it gets recorded
- **Discord segment:** real screen capture (1080p60) on the PC with Vesktop, in a private demo server with no pings. You talk live and press the keys; I run the capture and add the zooms afterwards. It sends real messages into that demo channel, so you need to OK that first.
- **App segments** (editor, Settings, before/after, waveform proof): captured from the real app window, with real engine calls, fed with your recorded lines. This doesn't touch your screen.
- **Post:** the Remotion project in `video/` adds smooth punch-ins on the pill, the transcript and the waveform, short captions, A/B audio switches and the waveform-difference proof.
- **Narration:** your voice-over, or a teammate's, recorded after the picture is locked. I write the voice-over script to the cut.

## What's needed from you
1. Record the demo lines in your own voice: about 5 short lines, about 10 minutes, quiet room. Use the script in `demoscript/DEMO_SCRIPT.md` once it's validated.
2. A private Discord server or channel for the demo, and your OK to send test messages there.
3. About 10 minutes at the PC for the live Discord take.
4. The voice-over, after picture lock.
5. The three missing team names, for the close and the deck.

## Before recording
- Pod running, and Settings → Engine → Check shows green. Do two warm-up runs.
- Discord and Windows Do Not Disturb on. The mic selected in Settings is the one you'll use.
- Pause about half a second after "scratch that".
