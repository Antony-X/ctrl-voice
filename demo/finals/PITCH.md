# Ctrl+Voice pitch: practice sheet

Five minutes; about half of it is the live demo. Each line gives the cue (the clock or the key), then the Georgian to say, then [the English meaning].
- The full runbook with Plan B and the checklist: [SCRIPT.md](SCRIPT.md) (English) and [NOTES_KA.md](NOTES_KA.md) (Georgian).
- To quiz the speaker afterwards, the 10 likely judge questions with answers are in SCRIPT.md section 6 and at the end of NOTES_KA.md.

**Running the deck:** open `index.html` in Chrome. Double-clicking it works: no server, no internet.
- **→** or **Space** goes forward and **←** goes back. Use the keyboard, not the mouse.
- **F** fullscreen, **A** sound check, **T** restarts the talk clock, **S** opens the notes in a second window.

---

## 1. Title (before 0:00)
When the room is quiet, give the hook, then press **→**.
> „ხმოვანი მესიჯი ჩაგიწერიათ… მოგისმენიათ… და მერე წაგიშლიათ?“ *(pause)* „ყველას გვიქნია.“ *(pause)* „ეს არის Ctrl+Voice.“

[Ever recorded a voice message, listened back, and deleted it? We all have. This is Ctrl+Voice.]

## 2. Chat (0:00–0:53): the clips play by themselves, so stay quiet while they do
- **→** Sarah's voice note plays (14 s). *Say nothing.*
- **When it ends:** „ჩვეულებრივ, ამას წაშლიდა. ნახეთ.“
  [Normally she'd delete that. Watch.]
- **→** The red parts collapse and the fixed note plays (9 s). *Say nothing.*
- **When "Which 2 words are AI?" appears:** „ხუთი წამით მოკლეა. აქ ორი სიტყვა AI-მ თქვა. რომელი ორი?“ *(wait 1–2 s for guesses)*
  [Five seconds shorter. Two of these words are AI. Which two?]
- **→** Two words turn green: „„Dan has“ და „a bit“. სულ ერთი წამია AI, თანაც მისივე ხმით.“
  ['Dan has' and 'a bit'. One second of AI, in her own voice.]
- **→** Eric's note plays (5 s) and his ending goes up. *Say nothing.*
- **→** The Confident slider moves. Say it before the audio starts: „Confident.“
- **When his audio ends, →.**

If you are running late, drop the "Normally she'd delete that" line. Never drop "Which two?".

## 3. Stat (0:53–1:03)
- **The number counts up:** „შვიდი მილიარდი ხმოვანი მესიჯი. ყოველდღე. მარტო WhatsApp-ზე.“
  [Seven billion voice messages. Every day. On WhatsApp alone.]
- **→** „ტექსტის შესწორება შეგიძლია.“ *(pause)* „ხმის — ვერა.“ *(pause)* „აქამდე.“
  [You can edit a text. Not your voice. Until now.]
- **→**

## 4. The idea (1:03–1:16): the recording draws itself, words land on their sound
- **Mistakes turn red:** „როგორ? შენი ხმა სიტყვებად იქცევა, და თითოეული სიტყვა თავის ბგერაზე რჩება მიბმული.“
  [How? Your voice becomes words, and every word stays tied to its own sound.]
- **→** The red words drop out, "have" becomes a green "has": „ჩვენ სიტყვებს ვასწორებთ, როგორც ტექსტს, და აუდიო მათ მიჰყვება. ახალია მხოლოდ შეცვლილი სიტყვა, შენივე ხმით. დანარჩენი შენი ნამდვილი ჩანაწერია.“
  [We edit the words, like a text, and the audio follows. Only the changed word is new, in your own voice. The rest is your real recording.]
- **→**

## 5. Anywhere (1:16–1:28): one key, six apps
- **The key is pressed, the apps burst out:** „და ის იქ მუშაობს, სადაც უკვე ლაპარაკობ: ერთი ღილაკით Discord-ში, WhatsApp-ში, Telegram-ში, Slack-ში, Signal-სა და Teams-ში. ინტეგრაცია არ სჭირდება.“
  [It works where you already talk: one hotkey, in Discord, WhatsApp, Telegram, Slack, Signal and Teams. No integration needed.]
- **→** A video and a microphone appear: „და არა მხოლოდ ჩატში: ჩაწერილი ვიდეო ან გამოსვლა აპში ატვირთე და ზუსტად ისე გაასწორე.“
  [And not just chat: import a recorded video or a speech into the app and fix it the same way.]
- **→**

## 6. Architecture map (1:28–2:20): one short sentence per model; start talking when the camera lands
- **The map draws itself:** „ამის უკან ცხრა მოდელი დგას, ერთად.“ [Behind it: nine models, working together.]
- **→ Hear:** „Whisper ყველა სიტყვას ისმენს, სანამ ლაპარაკობ, „um“-ებიანად.“ [Whisper hears every word as you talk, ums included.]
- **→ Align:** „wav2vec2 ყველა სიტყვას აუდიოში ზუსტად თავის ადგილზე სვამს.“ [wav2vec2 pins every word to its exact place in the audio.]
- **→ Decide:** „Qwen წყვეტს, რა ამოიჭრას. აუდიოს არ ეხება.“ [Qwen decides what to cut. It never touches the audio.]
- **→ Guard:** „წესები: მხოლოდ წაშლა. „არა“, რიცხვი ან თარიღი რჩება, თუ თვითონ არ შეცვალე.“ [Deletions only; a "not", a number or a date stays unless you replaced it.]
- **→ Re-say:** „არასწორ სიტყვას PlayDiffusion შენი ხმით ამბობს თავიდან. ათიდან ცხრა სწორია.“ [PlayDiffusion re-says the wrong word in your voice. Nine of ten right.]
- **→ Re-say, in parallel:** „მეორე ხმის მოდელი, პარალელურად.“ [A second voice model, in parallel.]
- **→ Verify:** „ორივეს ორჯერ ვამოწმებთ და ვსვამთ მხოლოდ ყველაზე მსგავს ხმას.“ [Both are checked twice; only the closest voice is spliced in.]
- **→ Pronunciation:** „და გაუგებარ სიტყვებსაც ვიჭერთ.“ [And we catch unclear words too.] *(AUC 0.88 stays on the map; say it only if asked.)*
- **→ Tone:** „Confident კი AI არ არის: შენსავე ჩანაწერს ტონს უცვლის.“ [Confident isn't AI: it reshapes the pitch of your own recording.]
- **→ The camera flies back out:** „ეს არის მთელი სისტემა. ახლა ლაივში.“ [That's the whole system. Now, live.]
- **→** to the demo slide.

One sentence per model, no more. If you are behind, press → on "Re-say, in parallel" and "Pronunciation" without a word.

## 7. Live demo (2:20–4:40)
**The message.** Say it in English, exactly like this:
> "Hey team. Um, the final is on Saturday, no wait, Sunday. I didn't rehearse at all. Scratch that. *(one full second of silence)* The judges is really friendly, and I think we're ready?"

**Three rules:**
1. Click into the Discord message box before you press Alt+`.
2. While it records, say nothing but the message.
3. After "Scratch that", stay silent for one full second.

**Step by step:**
- **2:20, bingo card on screen:** „შეცდომების ბინგო: ოთხივე შეცდომა, ერთ მესიჯში. ინგლისურად: მოდელები ჯერ ინგლისურზეა მორგებული.“
  [Mistake bingo: all four mistakes, in one message. In English: the models are tuned for English for now.]
- **2:26:** *Alt+Tab to Discord and click in the message box.* „აი, Discord.“ [Here's Discord.]
- **2:28:** *Alt+`, wait half a second, then say the message. After "Scratch that", pause and point at the bar.*
- **2:43:** *Alt+` again.* While it works: „„scratch that“ ხომ ნახეთ? ლაპარაკისას გაქრა. ახლა Whisper მესიჯს თავიდან ისმენს, LLM წყვეტს, რა ამოიჭრას, წესები ამოწმებს, ჩემს არასწორ სიტყვას კი ორი ხმის მოდელი ერთდროულად ამბობს, ჩემივე ხმით.“
  [Did you see "scratch that"? Gone while I talked. Now the models re-hear it, pick the cuts, check them, and re-say my wrong word in my voice.]
- **~2:53, before ▶ in Discord:** „ერთი სიტყვა აქ AI-მ თქვა. მოუსმინეთ: რომელი?“ [One word here was made by AI. Listen: which one?]
- **3:04:** „რომელი?“ *(take one or two guesses)* „ვნახოთ.“ [Which one? Let's look.]
- **3:09:** *Alt+Shift+`, click the top message.* „აი ისიც, მწვანით: „judges are“. გადახაზული ამოჭრილია. დანარჩენი ყველაფერი ჩემი ნამდვილი ხმაა, ხელუხლებელი.“
  [There it is, in green. Struck through means cut. Everything else is my real voice.]
- **3:19:** *Original, Space, about 5 s, Space.* „ორიგინალი…“ „…გასწორებული კი უკვე მოისმინეთ. ორიგინალი ფაილი არასდროს იცვლება.“
  [The original… and you already heard the fixed one. The original file never changes.]
- **3:31, Replace:** „ახლა თქვენ აირჩიეთ: ჟიური „friendly“ იყოს… თუ „generous“?“ *Click the word, then Replace…, type it, press Enter.* While it waits: „ამ სიტყვას ახლა ორი მოდელი ამბობს ჩემი ხმით, და შედის მხოლოდ ის, რომელიც ორივე შემოწმებას გაივლის.“ *Space to play.* „ეს სიტყვა მე არასდროს მითქვამს.“ *(hold 2 s of silence)*
  [You choose the word. Two models say it in my voice; only the one that passes both checks gets in. I never said that word.]
- **3:58, Confident:** *Tone, then click Confident once.* „ბოლოს, Confident. აქ AI საერთოდ არ არის: ეს ჩემივე ჩანაწერია, შეცვლილი ტონით და ტემპით.“ After it plays: „„ready?“ გახდა „ready.“ იგივე ხმა, იგივე სიტყვები.“
  [No AI here: my own recording, reshaped. "Ready?" became "ready." Same voice, same words.]
- **4:25:** *Alt+Tab to the deck, then press 1, 2, 3, 4.* „„Um“. აზრის შეცვლა. „Scratch that“. არასწორი სიტყვა.“ *(fourth stamp)* „ბინგო.“
  [Um. Change of mind. Scratch that. Wrong word. Bingo.] Stamp only what really happened; if one square failed, say „დღეს ოთხიდან სამი.“ [three out of four tonight].
- **→** to the close.

**Time gates:**
- 3:03, nothing in Discord yet: go to the backup clips (B).
- 3:35, Replace not started: skip it.
- 4:12, Confident not played: go back to the deck.
- 4:30: back to the deck, whatever is happening.

## 8. Close (4:40–5:00)
- **→** „ცხრა მოდელი. დაახლოებით ერთი წამი „um“-ებისა და უკან წაღებული სიტყვების ამოსაჭრელად. და 0.98: ხმის მსგავსება, როცა სიტყვას თავიდან ვამბობთ.“
  [Nine models. About a second to cut the ums and the take-backs. And 0.98 voice similarity when we re-say a word.]
- „ყველაფერი GitHub-ზეა: დაასკანერეთ QR კოდი და სცადეთ.“ *(პაუზა)* „Ctrl+Voice. თქვი არეულად… გაგზავნე სუფთად.“ *(1 წმ)* „მადლობა.“
  [It's all on GitHub: scan the QR code and try it. *(beat)* Ctrl+Voice. Say it messy… send it clean. *(1 s)* Thank you.]
- *Stop, smile, and wait for questions.*
- If a judge asks about the voices: „ეს ElevenLabs-ის ხმებია, ჩვენს ტექსტს კითხულობენ. გასწორებული აუდიო ძრავის ნამდვილი შედეგია.“ [They are ElevenLabs voices reading our script; the fixed audio is real engine output.]

---

## Practising without the app
- Press **T** on the title to start the clock. Targets: chat done by about 0:53, idea and uses done by 1:28, map done by 2:20, back on the deck by 4:25. No juror sentence tonight.
- On the demo slide, say the demo lines anyway and press **1 2 3 4** to stamp the card.
- **B** shows backup clips from an earlier run. Never call them "live".
