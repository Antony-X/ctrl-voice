I fixed one demo-breaking problem and planned the 3 minutes. The full end-to-end test is still running, so the complete "what's left" list comes when it finishes.

**Correction:** "Pen Code" in your last message was "Vencord", not OpenCode. You run Vencord as the **Vesktop** app, and Ctrl+Voice only recognised the normal Discord app. So recording in Discord would have opened the editor instead of sending, and "Send to Discord" would have said Discord isn't open. I've added Vesktop (plus Equibop and Legcord) to `src/main/main.js`. The helper does find your Vesktop window. It takes effect after the app restarts, and I haven't tested an actual send into Vesktop yet.

## The 3-minute demo

**The idea:** voice messages are the one thing we write that can't be edited. Text has backspace; voice has re-record. Dictation tools (Wispr Flow, Whisper) turn your voice into clean text and throw the voice away. Ctrl+Voice keeps your voice and fixes the speech before it's sent, inside the chat you're already using.

**Tagline:** *"Say it messy. Send it clean."* (or *"Ctrl+Z for your voice."* Ctrl+Z really is the undo key while recording.)

**The story device:** slide 2 lists the four things that go wrong in voice notes. Then you say exactly those mistakes live and the judges watch each one disappear.

| Time | What happens | What you say |
|---|---|---|
| 0:00–0:20 | Play a messy voice note out loud, recorded beforehand **in your own voice**. Only its waveform is on screen. | "WhatsApp says people send 7 billion voice messages a day. Every one is write-once. Text has backspace. Voice has… re-record." |
| 0:20–0:40 | Slide 2: a messy transcript with the problems marked: filler (*um, like*), correction (*five, no wait, three*), stumble (*the, the, uh*), regret (*…scratch that*). | "Dictation apps fix this by turning you into text. We wanted to keep *you*." |
| 0:40–1:40 | **Live, in Vesktop:** press `` Alt+` `` and say: *"Hey judges! So, um, this demo is gonna take like five, no wait, three minutes. And honestly the other teams are kind of… scratch that. [pause] Okay, see you at the finals!"* The jab disappears from the live caption as you say "scratch that". Press `` Alt+` `` again; the status reads Cleaning up… Sending to Discord…. Click play in Discord. | "Every word you just heard is my real recording. Nothing was generated; it was all cuts." |
| 1:40–2:15 | `` Alt+Shift+` `` opens the editor. The cut words are crossed out. Click **Original**, then **Fixed**, for an instant before/after. Click a word, type a replacement, press **Say it**: it plays back in your voice, marked purple. Then **Send to Discord**. | "Edit your voice like a document. The one new word is regenerated from my own voice and checked by listening to it again." |
| 2:15–2:40 | Slide 4: how it works, plus the numbers below. | "Cut first, regenerate only what's needed, and verify it." |
| 2:40–3:00 | Slide 5: who it's for, then the tagline. | "For the 44% who play voice notes at double speed, for second-language speakers who re-record because of one word, and for anyone who wished they hadn't said that." |

**Slides:** 4 slides plus the live demo. No business model.
1. Title and tagline, over the messy waveform.
2. "Voice messages have no backspace": the marked-up transcript.
3. (Switch to the live app.)
4. How it works:
   - **Pipeline:** live transcript, then an AI step that only deletes words (it can't add words, and protects numbers and negations), then cuts at word boundaries.
   - **Changed words:** only those words are regenerated from your surrounding audio, spliced in, transcribed again, and kept only if they're heard right.
5. Who it's for, plus the tagline.

**Numbers you can safely claim**, all from the backend's `docs/RESULTS.md` (small test sets, engineering measurements):
- "Scratch that" undo: **351 ms**.
- A 14.7 s message cleaned to **8.0 s in 0.7 s**.
- **24 of 28** messages cleaned exactly; **0 of 10** deletions that changed the meaning on trick sentences.
- Splicing in only the new word keeps voice similarity at **0.98**, versus 0.73 when the whole clip is regenerated. This is the core technical insight.
- Grammar fixes spoken in the speaker's own voice: **8 of 8** rendered correctly for non-native speakers ("didn't got" → "didn't get").

`PROJECT.md` warns against saying "removes your accent" or "first ever". Say "to our knowledge" instead.

**Before going on stage:**
- **Keep the GPU pod running.** A restart wipes its disk, and the services have to be started again by hand (see `HANDOFF.md`).
- About 10 minutes before: Settings → Engine → Check should show green. Then do two full warm-up runs.
- Use a demo Discord server with no pings (Vesktop currently shows 87 unread). Turn on Discord's Do Not Disturb and Windows Do Not Disturb.
- Make sure Discord playback comes out of the venue speakers, and that the mic you'll use is the one selected in Settings.
- **Turn off "Re-say unclear words"** for the live run. It sometimes flags words that were fine (2 of 6 in testing), which adds a delay and gives you an AI-made word you didn't ask for.
- Pause about half a second after "scratch that".
- Rehearse the script about 10 times; the backend notes say the same.
- Screen-record one perfect run as a backup in case the Wi-Fi fails.

**Known so far for the "what's left" list:**
1. **End-to-end test:** still running, results pending.
2. **Real Vesktop send:** nobody has tried it. I need the app restarted, then one test send into your demo channel, done by you or by me when you say go.
3. **Pod:** RUNNING at $1.39/hr; leave it on until the demo is over.
4. **Code:** none of it is committed or pushed yet. Tell me if you want it on the branch for George.

If you want, I can build the 4 slides as a deck once you've settled the script.

Sources: [WhatsApp blog (7B/day)](https://blog.whatsapp.com/making-voice-messages-better), [TechCrunch](https://techcrunch.com/2022/03/30/people-are-sending-7-billion-voice-messages-on-whatsapp-every-day), [Sky Mobile poll (44% at double speed, filler words a top complaint)](https://www.skygroup.sky/article/voice-no-brits-call-time-on-long-voice-notes)