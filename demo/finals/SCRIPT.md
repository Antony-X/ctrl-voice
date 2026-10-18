# Ctrl+Voice finals: script and live-demo runbook (English master)

5:00 in total. The talk is given in Georgian; the Georgian lines are in `NOTES_KA.md`, which uses the same structure and step keys.
How to read this file:
- `→` means press Right arrow, Space or Enter in the deck. **Keys, not clicks**: the first click after switching back to the browser is ignored.
- *Italics* are actions. "Quoted text" is what you say aloud.
- Timestamps are cumulative and start at your first word.
- The chat-slide timings were checked against `chat.js`'s timers and clip lengths: the step 1 prompt appears at about 0:32 and Confident ends at about 0:51, within about 1 s of the table. Confirm them at the first full rehearsal.

| Clock | Slide | Clicks | What happens |
|---|---|---|---|
| before | title | | logo, sound check (A) |
| 0:00–0:50 | chat | hook, then → ×5 | Sarah's messy note gets fixed, guess the AI words, Eric gets confident |
| 0:50–1:00 | stat | → ×2 | 7 billion a day; you can't edit your voice |
| 1:00–2:10 | arch | → ×11 | map draws itself, the camera visits 9 regions, flies back out |
| 2:10–4:40 | demo | → ×1, then the app | mistake bingo, live |
| 4:40–5:00 | close | → ×1 | three numbers, QR, thank you |

---

## 1. Run of show

### title (before 0:00)
*The logo is on screen while people settle. Do the sound check before this (section 4). When the room is quiet, give the hook, then press →.*

### chat, 0:00–0:50 (the clips play by themselves; keep the lines between them short)
| Clock | Key | On screen / audio | Say |
|---|---|---|---|
| 0:00 | | title | **Hook:** "We've all recorded a voice message… listened back… and hit delete." |
| 0:03 | → step 0 | Sarah's note pops in and plays (14.4 s). Mistakes turn red as they are said: um, changed her mind, took it back, wrong word. | *Nothing. Let it play. Smile at the "Shrek" line.* |
| 0:18 | | clip ends | "Normally, she'd delete that. Watch." |
| 0:20 | → step 1 | rewind, the red parts collapse, 0:14 becomes 0:09, the fixed note plays (9.2 s) | *Nothing.* |
| 0:31 | | prompt "2 words here are AI. Which?" | "Five seconds shorter. Two of those words are AI. Which two?" *Wait for one or two guesses, at most 2 s.* |
| 0:36 | → step 2 | "Dan has" and "a bit" glow green | "'Dan has.' 'A bit.' One second of AI, in her own voice." |
| 0:39 | → step 3 | swipe to Eric; his note plays (5.3 s); the pitch line rises on "tomorrow?" | *Nothing.* |
| 0:45 | → step 4 | the Confident slider rises; the fixed note plays (4.7 s); the ending falls | Say it as the slider moves, before the audio starts: "Confident." |
| 0:50 | → | | |

- Alternative hook, if you want the room involved: "Hands up if you've ever re-recorded a voice message." *(beat)* "Keep it up if it took three tries." It costs about 4 s, so drop the 0:18 line to pay for it.
- If you are late, the 0:18 line can go: press → as soon as Sarah's clip ends. Never cut the "Which two?" question; it is the best moment of the opening.
- If someone asks what was AI in the first note: the two green phrases. "In this message" about 1.0 s of the 9.2 s was generated. Everything else is her recording.

### stat, 0:50–1:00
| Clock | Key | On screen | Say |
|---|---|---|---|
| 0:50 | (entered) | 7,000,000,000 counts up | "Seven billion voice messages. Every day. On WhatsApp alone." |
| 0:55 | → step 1 | text bubble with "edited" and a green ✓; voice note with a red ✗ | "You can edit a text." *(beat)* "You can't edit your voice." *(beat)* "Until now." |
| 1:00 | → | | |

### arch, 1:00–2:10 (one or two sentences per region; start talking when the camera lands, about 1 s after the key)
| Clock | Key | Region | Say |
|---|---|---|---|
| 1:00 | (entered, step 0) | whole map draws itself | "Here's what runs behind that. Nine models, working together." |
| 1:05 | → 1 | Hear: Whisper | "Whisper listens while you talk, and re-hears everything every 0.7 seconds. We prompt it with ums, so it writes yours down instead of politely hiding them." |
| 1:12 | → 2 | Align: wav2vec2 CTC | "But Whisper's word times drift by up to 0.4 seconds. So a second model, which spells letter by letter with no language model, pins every word to where it really is." |
| 1:19 | → 3 | Decide: Qwen | "Then an LLM decides what to cut: 35 billion parameters, only 3 billion active per token. It never touches the audio. It only tags the transcript." |
| 1:26 | → 4 | Rules | "And it doesn't get the last word. Hard rules: deletions only, and a 'not', a number, a date or a time can only go if you replaced it yourself." |
| 1:33 | → 5 | PlayDiffusion | "For a wrong word, PlayDiffusion re-says it in your voice by filling in masked speech tokens from the audio around it. Nine out of ten right." |
| 1:40 | → 6 | F5-TTS | "At the same time, a second voice model, F5-TTS, makes its own take, in about a second." |
| 1:47 | → 7 | Verify | "Then we check both, twice: Whisper must hear the new word, and the letter model must prefer it to the old one. The closest voice wins, and only the new word is spliced in." |
| 1:54 | → 8 | Pronunciation | "We also catch words that came out unclear: a phoneme model scores every sound. AUC 0.88 against expert listeners." |
| 2:01 | → 9 | Tone | "And Confident isn't AI at all. It reshapes the pitch of your own recording, and turns a nervous question mark into a full stop." |
| 2:07 | → 10 | flies back to the whole map | "That's the stack. Now let's try it live." |
| 2:10 | → | demo slide | |

- If you are behind at 1:40, shorten regions 6 and 8 to their first clause ("A second voice model, in parallel." / "And we catch unclear words.").
- "Nine models", if asked: Whisper large-v3-turbo, the wav2vec2 letter aligner, Qwen3.6-35B-A3B, PlayDiffusion, F5-TTS, the ECAPA speaker model, the wav2vec2 phoneme model, the gradient-boosting pronunciation scorer, and Seed-VC (accent).
- The PSOLA grains and the "three"/"tree" lattice are illustrations (see section 7).

### demo, 2:10–4:40
The whole runbook is in section 2. The short version:

| Clock | Beat |
|---|---|
| 2:10 | bingo card, then switch to Discord |
| 2:20 | record the rehearsed message; "scratch that" strikes out live |
| 2:35 | finish; it cleans up and sends into Discord |
| 2:45 | play it in Discord: "Which word is AI?" |
| 3:03 | editor: the green word, Original vs Fixed |
| 3:26 | replace a word the room picks |
| 3:55 | Confident |
| (4:05) | juror sentence, only if you are ahead |
| 4:25 | back to the deck: 1 2 3 4, Bingo |
| 4:40 | → close |

### close, 4:40–5:00
| Clock | Key | On screen | Say |
|---|---|---|---|
| 4:40 | → | 9 / ≈1 s / 0.98 count up; QR; credit line | "Nine models. About a second to cut the ums and the take-backs. And 0.98 voice similarity when we re-say a word." |
| 4:50 | | | "Say it messy. Send it clean. It's all on GitHub, so scan the code and try it. Thank you." |
| 5:00 | | | *Stop. Smile. Wait for questions.* |

- Don't read the credit line aloud. It is there for honesty: ElevenLabs voices Sarah and Eric, and speechocean762.

---

## 2. Live-demo runbook (2:10–4:40)

### 2.0 What must already be true at 2:10 (set it up in section 4)
- Ctrl+Voice is running and unlocked. Settings → Engine → Check shows "Connected".
- Discord is open on a clean demo channel. Everything else is closed or muted.
- Settings → Automatic fixes:
  - **On**: Cut filler words and false starts, Fix grammar.
  - Fix misspoken words: on, unless rehearsal shows it changing your correct words.
  - **Re-say unclear words: off** for the talk. With an accent, it can re-say extra words: each one adds about 3 s and an extra green word, which spoils "which word is AI?". It is a real feature, shown on the map; it is just not in the live run.
- Settings → Your sound: every slider at 0. Native accent: off. Otherwise the Discord message is already toned and Confident has nothing to show.
- Settings → When you finish: **Send it**. Press Enter after pasting: **on**.
- Display mode is **Duplicate** (Win+P). The recording bar always appears on the *primary* display (`positionOverlay` uses the primary display), so in Extend mode it can land on the screen the judges can't see.

### 2.1 The guaranteed run: the rehearsed message
**Rules that come from the code (rehearse them):**
1. **Click into the Discord message box before you press Alt+`.** The app sends to whichever window had focus when recording started, and the browser counts as a target. Started from the deck, it would paste into the deck and press Enter, which advances a slide.
2. **While the bar is recording, everything you say goes into the message.** Point, don't talk. No Georgian asides until you've pressed Alt+` again.
3. **"Scratch that" must be the last thing you say, followed by a full one-second pause.** The live strike-out only fires once you have been silent for more than 0.5 s after it. Count "one-Mississippi" in your head and point at the bar: the cancelled sentence turns struck-through for about 1.4 s, then disappears, and the bar says "Scratched that".
   - Phrases that strike live: "scratch that", "delete that", "undo that", "strike that", "never mind that", "start over", "let me start over".
   - Plain "never mind" does **not** strike live with today's engine.
4. **Put the cancelled thought in its own sentence, right before "scratch that".** The engine removes the last thought: it chooses between sentence ends, pauses of 0.45 s or more, and ", and / but / so…".
5. **For the wrong word, use a grammar slip** (subject-verb agreement). The grammar check catches it reliably, and Whisper writes it down as you said it. A sound-alike slip like "beat" for "bit" depends on your accent: Whisper may hear the right word, and then there is nothing to fix.
6. **End on an unsure, rising "…?"** That gives Confident something to fix later: a rising ending of more than 12% is bent into a fall, like Eric's.

**Message C (recommended; plays to the room):**
> "Hey team. Um, the final is on Saturday, no wait, Sunday. I didn't rehearse at all. Scratch that. *(1 s pause)* The judges is really friendly, and I think we're ready?"

- um: "Um,"
- change of mind: Saturday → Sunday. Days are a protected type, and a same-type repair lets the old one go. Tonight, Sunday 18 October, it is even true.
- scratch that: "I didn't rehearse at all." (gets a laugh)
- wrong word: "The judges is" → "judges are". The engine re-says the word together with the word before it.
- replace target for 2.3: "friendly" → the room picks "generous".
- Confident target: "…we're ready?"

**Message A (neutral; matches the card's hints):**
> "Hey guys. Um, so, the trip. We're leaving Friday, no wait, Saturday morning. I already ate all the snacks. Scratch that. *(1 s pause)* The tickets is in my bag, and I think dinner is pizza?"

- wrong word: "The tickets is" → "tickets are".
- replace target: "pizza" → the room picks "sushi".

**Message B (numbers instead of days):**
> "Hi Nika. Um, quick one about tonight. Let's meet at seven, no wait, eight. I'm bringing my cat. Scratch that. *(1 s pause)* We has a table by the window, and you're paying, right?"

- wrong word: "We has" → "We have".
- replace target: "you're" → "I'm" ("I'm paying", which gets a laugh).

**Pick one and rehearse it at least three times against the live engine.** Note how long the finish takes; that is your wait to fill. Keep replacement words common in English (generous, sushi, Monday), never rare names: the check needs Whisper to hear the new word exactly.

**Can the message be in Georgian? No, not tonight.** The code is English-only all the way through:
- `app.py` calls Whisper with `language="en"` hard-coded.
- The aligner is `wav2vec2-large-960h-lv60-self`, with a 32-token English-letter vocabulary.
- The pronunciation model is trained on speechocean762 English.
- The rules match English words: fillers um/uh/er/hmm, "scratch that", English negations, numbers and day names.
- The desktop app has no language setting at all.

A Georgian message would come back as English-looking garbage. Say this on stage in one line: "In English: the models are tuned for English for now."

### 2.2 Minute by minute
| Clock | Do (exact keys and clicks) | Screen shows | Say |
|---|---|---|---|
| 2:10 | *(on the demo slide)* | "Mistake bingo" card, 4 squares | "Mistake bingo. In one message I'll make all four mistakes on purpose: an um, a change of mind, a 'scratch that', and one wrong word. In English: the models are tuned for English for now." |
| 2:18 | **Alt+Tab** to Discord. **Click in the message box.** | Discord demo channel | "Here's Discord." |
| 2:20 | **Alt+`** (the key under Esc). Wait for the timer to run, about 0.5 s. | the bar: red dot, timer, "To Discord", "Listening…" | *Silence from now on.* |
| 2:21 | **Say the message.** After "Scratch that." **pause one full second and point at the bar.** | your words appear live; the cancelled sentence turns struck-through, then vanishes; "Scratched that" | *(only the message)* |
| 2:35 | Finish the message, then **Alt+`** again. | "Cleaning up…", "Saying 'are'…", "Finishing…", "Sending to Discord…", "Sent to Discord" | **Filler** (see 2.6): "Did you see 'scratch that'? Gone while I was still talking. Right now Whisper is re-hearing it, the LLM is choosing what to cut, the rules are checking it, and two voice models are re-saying my wrong word in my voice." |
| ~2:45 | The audio file appears in the channel. **Click ▶ on it.** | inline audio player, about 9 s | Before you click: "One word in this was made by AI. Listen, and tell me which." |
| 2:56 | *Let the room guess, about 5 s.* | | "Which one?" *(take one or two guesses)* "Let's look." |
| 3:01 | **Alt+Shift+`** opens Ctrl+Voice. **Click the top message** (newest first). | editor: cuts struck through, the AI word in green, a summary like "3 cuts and 1 word changed, 4 seconds shorter" | "There it is, in green: 'judges are'. Everything struck through is cut. Everything else is my real voice, untouched." |
| 3:11 | **Click "Original"**, then **Space**. After about 5 s ("um… Saturday, no wait…"), press **Space** to stop. **Click "Fixed"**. | player bar | "The original…" *(stop)* "…and you already heard the fixed one. The original file is never changed: it's an edit list, built when you play or send." |
| 3:26 | **Replace** (2.3). | | |
| 3:55 | **Confident** (2.4). | | |
| 4:05 | **Juror?** Only if Confident has finished by 4:05 (2.5). Otherwise go straight on. | | |
| 4:25 | **Alt+Tab** to the deck. If it has dropped out of fullscreen, press **F**. Press **1**, **2**, **3**, **4**: one stamp per square, and the fourth plays "Bingo!" with a sparkle. | the stamps | "Um. Change of mind. Scratch that. Wrong word." *(fourth stamp)* "Bingo." |
| 4:38 | **→** | close | |

**Time gates. Stick to them; a demo that overruns looks worse than a short one.**
- **2:55**: nothing in Discord yet? Plan B "engine slow" (section 3).
- **3:30**: Replace not started? Skip it and go to Confident.
- **4:10**: Confident not played yet? Stop and go back to the deck.
- **4:30**: hard stop. Go back to the deck, whatever is happening.

**Stamp only what really happened.** If a square didn't fire, leave it empty and say "three out of four tonight". That is more credible than a fake bingo.

### 2.3 Replace a word: the room picks it (3:26–3:55)
1. Say: "Now you choose. Should the judges be 'friendly'… or 'generous'?" For message A, use "Pizza or sushi?"; for B, "Who pays: you or me?"
2. **Click the word** "friendly" in the transcript. A menu appears: Replace… / Say clearly / Cut / Tone.
3. **Click "Replace…"**. A box shows the word. **Select it, type** the room's choice (`generous`), and press **Enter**. The "Say it" button does the same.
4. The status reads "Saying 'generous'…", about 3 s. Say: "Two voice models are saying that word in my voice right now, and only the one that passes both checks gets in."
5. The word turns green. The app re-renders by itself; give it a second. Make sure **Fixed** is selected, then press **Space**. It does not play on its own.
6. After it plays: "I never said that word."
   - If a toast says "It may not sound quite right. Listen to check, or try again", the take was not verified. Say: "It isn't sure about this one, and it tells you." Then click the green word → **Try again**, or move on.
   - The guess moment for the room was the Discord playback in 2.2, where nobody could see a transcript. Here the room hears a word they chose, in your voice.

### 2.4 Confident (3:55–4:05)
1. In the player bar, **click the "Tone" button**. The tone panel opens on *Your voice*, with Confident (the superhero), Calm and Warm.
2. **Click the Confident character once.** That steps it from Off to Medium, the preset. About 0.5 s later the status reads "Making it confident…" (about 1 s), then **it plays from the start by itself**.
   - Dragging the Confident slider works too: the take is made when you let go.
   - Rehearse Medium against Strong (a second click) and pick one.
3. Say, before it plays: "Last one: Confident. No AI here. It's my own recording with the pitch and pace reshaped."
4. After it plays: "'Ready?' became 'ready.' Same voice, same words." Point at the panel note, which reads something like "Pitch x% lower, y% faster, firm endings".

### 2.5 Juror sentence (only if Confident finished by 4:05)
1. Say: "One sentence from the jury? In English. Say anything, then 'scratch that', pause, then one more thing."
   - Coach the exact words: "scratch that" or "never mind that". Plain "never mind" does not strike live today (section 8).
2. **Click in the Discord box**, press **Alt+`**, and hold the laptop about 30 cm from the juror, or have them lean in.
3. Juror speaks; the strike shows after their pause. Press **Alt+`**, wait about 3–5 s (no word replacement, so it is quicker), and click ▶ in Discord.
4. Say: "Your words, your voice, minus the part you took back."

### 2.6 What to say while the engine works
| Wait | Say |
|---|---|
| ~2 s | "It's re-hearing every word." / "No AI in this one: it's my own recording, reshaped." |
| ~3–5 s | "Two voice models are saying it in my voice at the same time, and only the one that passes both checks gets in." |
| ~6–10 s | "Right now Whisper is re-hearing the whole message, the LLM is choosing what to cut, the rules are checking it didn't cut anything that matters, and the wrong word is being re-said and checked twice. In Sarah's message, with two re-said words, the whole fix took about ten seconds." |
| over 15 s | "The GPU is a long way from this room." *(At 25 s, go to Plan B.)* |

---

## 3. Plan B, per failure
| Failure | How you notice | Do | Say |
|---|---|---|---|
| **No sound from the speakers** | Sound check silent, or the chat clip is silent. The slide keeps going by itself: captions and waveforms follow a wall clock. | Once only: **Win+Ctrl+V**, pick the room output, press **R** to replay the step. If it is still silent, don't fight it. | "The speakers are shy tonight, so read along with me: red disappears, green is AI." In the demo: "You'll have to trust your eyes. Watch the bar." Show the strike-out and the editor's green word; skip Original vs Fixed. |
| **Engine slow** | Still on "Cleaning up…" or "Saying…" after about 15 s | Keep talking (filler 2.6). At 25 s, press **Alt+Tab** to the deck and **B**. | "It's thinking, and the GPU is a long way away." At 25 s: "Let me show you the same flow from an earlier run." |
| **Engine down** | The bar says "Engine offline. Recording without live text"; "The engine isn't running"; "Can't reach the engine"; "Wrong access code" | Press **Esc** if you are still recording. **Alt+Tab** to the deck, **B**. Narrate the three clips (the *backup* lines in NOTES_KA.md). Then come back with **Home** / → to the close. | "The server picked a great moment to nap. Here's the same thing from an earlier run." Never call the backup "live". |
| **Mic not picking up** | The bar's waveform is flat, or "Listening…" with no words after 3 s | **Esc** (discards). **Alt+Shift+`** → Settings → Recording → **Microphone**: pick the right one. Retry once. If it still fails and the engine is fine: in the editor list, click "Import it" and choose your rehearsal take (pre-saved, see section 4). It is fixed live by the engine. Otherwise **B**. | "My mic is being modest. One second." If you import: "This is my rehearsal recording; everything after this is live." |
| **Juror says something that isn't fixed** | Nothing struck, or a retraction stayed in | Don't retry. Open it in the editor only if there is time. | Clean sentence: "Nothing to fix there. It knows when to leave you alone." Retraction kept: "When it isn't sure, it doesn't cut; it suggests. It never cuts your words on a guess." |
| **Wi-Fi drops** | Everything stalls: "Connection lost. Recording locally", "Can't reach the engine" | Stop the recording (**Alt+`**). It opens in the editor, with "Fix it" for later. **Alt+Tab** to the deck, **B**. If the phone hotspot is pre-paired, switch only after the talk, never on stage. | "The Wi-Fi just left the chat. The app keeps recording and fixes it when the engine is back. Meanwhile, here's an earlier run." |

- The backup clips (B) are real app UI and real engine output, but on an older sample message whose voice is synthetic. Say "from an earlier run", never "live".
- If a rehearsal recording is saved as `media/video/live_backup.mp4`, it plays first.

---

## 4. Pre-talk checklist
**T−30 min**
- [ ] Laptop on the charger. Sleep off. Windows Do-not-disturb on. Discord on DND. Slack, Teams and other mic apps closed. Phone silent.
- [ ] Projector connected. **Win+P → Duplicate** (see 2.0 for why). Resolution looks right.
- [ ] **Speakers**:
  - Settings → System → Sound → Output = HDMI or the room speakers, made the **Windows default device**. Do this *before* opening the deck.
  - Windows volume about 80%. Room amp up.
- [ ] Phone hotspot set up as a spare network (don't switch on stage).

**T−15 min**
- [ ] Deck:
  - Open `FINALS/index.html` from file:// in Chrome.
  - On the start screen, click **Sound check** or press **A**: three notes. Check from the back row.
  - Click to start. Walk once through every slide with → to check nothing is skipped (X toggles skip, and it is remembered). Press **B**, play one second of the first clip, then **Home**.
  - On the title, press **F** for fullscreen.
  - Press **S** for the notes window only in Extend mode; in Duplicate mode everyone would see it, so use printed `NOTES_KA.md` or your phone instead.
- [ ] Ctrl+Voice:
  - Running. **Access code** entered: Settings → Engine → Access code, then **Check** shows "Connected".
  - Alt+` works; there is no "shortcut is taken" notice.
  - Settings exactly as in 2.0.
- [ ] Discord:
  - A `#warmup` channel for tests and a clean `#demo` channel.
  - Play one old audio attachment, to check that Discord audio comes out of the room speakers too.
- [ ] Rehearsal take saved as a file on the desktop, for the mic Plan B import.

**T−10 min (engine warm-up: models go cold)**
- [ ] In `#warmup`: Alt+`, say your full rehearsed message, Alt+`. It should arrive in about 10 s or less. This warms the LLM and both voice models.
- [ ] Open it in the editor. Replace one word. Click Confident once. This warms the replace and tone paths.
- [ ] **Mic test**: the waveform moves and words appear live. Pick the mic in Settings → Recording → Microphone. Speak at about 30 cm.
- [ ] Switch Discord to `#demo` and click in its message box once.

**T−2 min**
- [ ] Deck on the title, fullscreen. Press **A** one more time if the room changed. Press **T** to reset the talk clock just before your first word.

---

## 5. Why there is no audience QR recording tonight
It's tempting to let the whole room record, but three things make it fragile tonight:
- **Phone mics** vary wildly, and each browser asks for mic permission differently.
- **Venue Wi-Fi** with dozens of phones uploading at once is a coin toss.
- **The engine does GPU work one job at a time** behind a single lock, and comfortably handles about two requests in flight. Thirty people pressing record together would queue for minutes, and a queued demo looks like a broken one.

The presenter-run demo shows the same pipeline with none of that risk. **Later**, it can work: the engine already serves its own web page. Put that page behind a QR code with a visible queue ("you're #3") and per-person limits, and scale out to more GPU workers. Once the on-device version exists, every phone runs it itself, and the room can play mistake bingo together.

---

## 6. Q&A cheat-sheet (facts only from our files; if unsure, say "we haven't measured that")
1. **Privacy: where does my voice go?** Today the app is a thin client. Audio streams to our hosted engine, which is protected by an access code. The LLM runs on our own GPU too: no third-party AI API by default. Messages are stored on your computer and the original is never modified. Session files are also kept on the engine server. The roadmap's core focus is on-device, so messages never leave your phone.
2. **How fast is it?**
   - Measured warm on 10–15 s messages: live transcript and "scratch that" about 350 ms behind your speech; upload and transcribe 0.4 s; clean-up 0.5 s; tone 0.6 s. The everyday path, record → clean → send, takes about a second.
   - Re-saying a word takes about 3 s: two models in parallel, plus verification. Native accent 2.8 s.
3. **Languages? Georgian?**
   - English only today. The code pins Whisper to English, the aligner only knows English letters, the pronunciation model is trained on English (speechocean762), and the rules (fillers, "scratch that", negations, numbers, days) are written for English.
   - Whisper and the LLM are multilingual, so a new language means a new aligner, a new pronunciation model and new rules. Georgian is the one we want most.
4. **What's AI and what's original?**
   - Cuts keep your real audio. Only re-said words are generated: in Sarah's message, about one second of 9.2. The editor shows AI words in green, and the original file is never changed.
   - Confident, Calm and Warm are signal processing of your own recording (Praat PSOLA), not generation. The native accent is AI: off by default and labelled.
   - The example voices, Sarah and Eric, are ElevenLabs voices reading our script, credited on the last slide. The fixed audio is real engine output.
5. **What if it cuts something important?**
   - The LLM can only delete. A negation, number, date or time can go only if a same-type repair replaces it. Anything uncertain becomes a suggestion.
   - On 10 trick sentences: 0 meaning-changing edits, down from 2 in our first version. 24 of 28 exact clean-ups.
   - A re-said word that fails both checks after 3 rounds is never applied automatically.
6. **Where does it fail?**
   - The pronunciation detector in free speech: in our free-run test it flagged 19% of the expert-labelled errors, because the recognizer often writes what you actually said, and then the text checks have to catch it.
   - Seams can still be audible sometimes. "Seams nobody can hear" is on the roadmap, with a blind listening test.
   - It reaches Discord as an audio attachment, not a native voice bubble. That needs official bots.
7. **What does it cost to run?**
   - One GPU runs everything, the LLM included. The LLM is a mixture-of-experts with only 3B parameters active per token, and the heavy steps run only when used.
   - The LLM can be swapped for any OpenAI-compatible hosted model. On-device, the server cost goes away.
   - We haven't priced it per message yet. Licences: a product needs commercial terms for some models (F5-TTS weights are CC BY-NC).
8. **On-device roadmap?**
   - First, a small on-device recognizer and a compact LLM for the live transcript, undo and clean-up, which is all most messages need.
   - Then a distilled voice editor for the few re-said words.
   - The hosted engine stays as an optional boost for heavy extras like the accent.
9. **Why not regenerate the whole message with TTS? And why two voice models?**
   - Regenerating the whole clip drops voice similarity to 0.73. Splicing only the new words keeps it at 0.98, and keeps your real recording.
   - PlayDiffusion gets 9 of 10 right in 1.5 s; F5-TTS gets 7 of 10 in 1.0 s. They run in parallel, both are verified, and the closest voice is kept. dots.tts got 10 of 10 but needs 12.7 s: too slow for a chat.
10. **Isn't this a deepfake tool?**
    - Only your own voice, only the words you meant, and every AI word shown in green.
    - Roadmap: an AudioSeal watermark on every generated word, and a "words changed" note the listener can see.
    - Supported apps: Discord, WhatsApp, Telegram, Slack, Signal and Teams, on Windows and macOS (the Mac version is newer and less tested).
    - How we measured: 10 real recordings (LibriSpeech, AMI, DisfluencySpeech), 28 hand-written messages, speechocean762. These are small samples: engineering measurements, not paper results.

---

## 7. Honesty notes (for you, not for the stage)
- The "after" audio on every slide is real engine output.
- The example voices are ElevenLabs voices (Sarah, Eric), credited once on the close slide.
  - The synthetic inputs had their long pauses tightened before the engine ran. Don't mention this on stage. If a judge asks directly whether the input was edited, say yes: "We tightened long pauses in the synthetic input; everything after that is engine output."
- The backup clips are "from an earlier run", with a synthetic voice. Never "live".
- The PSOLA drawing and the GOP "three"/"tree" lattice are illustrations. The PSOLA grains come from a real Praat run on Eric's "ready", but the picture is illustrative.
- Numbers measured on one clip are said as "in this message": 14 → 9 s, about 1 s of AI, −2 semitones, ending rise → fall, the about 10 s auto-fix.
- If you use a prerecorded take (import or demo-mic), say so: "this is a recording; everything after it is live".
- Don't quote any disfluency-rate statistic. Don't name the GPU model or its memory size.

---

## 8. Re-check after the pipeline changes land (another agent is changing `brain.py` in the pipeline-v2 worktree right now)
Rehearse against whatever is **actually deployed** tonight; the live engine must not change without your go. Then re-check:
1. **Spoken retractions.** Today, live strike-out needs the `CMD` phrases plus a pause of more than 0.5 s. In the pipeline-v2 work in progress, the *final clean-up* also learns "never mind", "forget that", "ignore that", "let me rephrase"… but the live `CMD` regex is unchanged.
   - So after it lands, a plain "never mind" may be cut when you finish, not struck live.
   - Keep coaching "scratch that" or "never mind that".
   - **Deck fix needed** (not mine to edit): the demo card's hint "…never mind" should read "…scratch that" or "…never mind that" to match what strikes live.
2. **Whisper language** is still `language="en"` in `app.py` `transcribe()`.
3. **Concurrency** is still one GPU lock, so the QR paragraph still holds.
4. **The grammar fix still catches your exact planted slip** ("The judges is"). Run the rehearsed message three times after the change, and re-time the finish wait.
5. A new optional `denoise.py` (DeepFilterNet) appeared in the worktree. If it gets switched on by default, re-listen to the Fixed audio and re-time.
6. The Settings labels and defaults used in 2.0 still exist, and MAX_AUTO_REPLACE is still 3 per fix type.
7. Chat slide: going by the `chat.js` timers, Sarah's clip ends about 15.4 s after the step 0 press, the "Which 2 words are AI?" prompt appears about 12.3 s after the step 1 press, Eric's clip takes about 6 s and the Confident step about 6.3 s. So say "Which two?" at about 0:32, not 0:31, and press → to the stat slide only after the Confident audio ends (about 0:51). If `chat.js` changes, re-check.
