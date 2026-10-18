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
> „ხმოვანი მესიჯი ჩაგიწერიათ… მოგისმენიათ… და მერე წაგიშლიათ?“ *(pause)* „ყველას გვიქნია.“

[Ever recorded a voice message, listened back, and deleted it? We all have.]

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

## 4. Architecture map (1:03–2:10): each → flies to one model; start talking when the camera lands
- **The map draws itself:** „აი, რა დგას ამის უკან: ცხრა მოდელი, ერთად.“
  [Here's what runs behind that: nine models, working together.]
- **→ Hear:** „Whisper გისმენს, სანამ ლაპარაკობ, და ყოველ 0.7 წამში ყველაფერს თავიდან ისმენს. პრომპტს „um“-ებით ვავსებთ, ამიტომ შენს „um“-ებს არ მალავს.“
  [Whisper re-hears everything every 0.7 s. We fill its prompt with ums, so it doesn't hide yours.]
- **→ Align:** „მაგრამ Whisper-ის დროები 0.4 წამამდე ცდება. ამიტომ wav2vec2 ასო-ასო წერს, რასაც ისმენს, ენის მოდელის გარეშე, და CTC-ით ყველა სიტყვას თავის ზუსტ ადგილზე სვამს.“
  [Whisper's timings drift up to 0.4 s, so wav2vec2 spells it letter by letter and pins every word where it really is.]
- **→ Decide:** „მერე Qwen წყვეტს, რა ამოიჭრას: 35 მილიარდი პარამეტრი, ტოკენზე მხოლოდ 3 მილიარდი აქტიური. აუდიოს არ ეხება, მხოლოდ ტექსტზე სვამს ნიშნებს.“
  [Qwen decides what to cut: 35B parameters, 3B active per token. It only tags the text.]
- **→ Guard:** „ოღონდ ბოლო სიტყვა მას არ ეკუთვნის. წესი ასეთია: მხოლოდ წაშლა. „არა“, რიცხვი, თარიღი ან დრო მხოლოდ მაშინ ქრება, თუ თვითონ შეცვალე.“
  [It doesn't get the last word: deletions only, and a "not", a number, a date or a time only goes if you replaced it yourself.]
- **→ Re-say:** „არასწორ სიტყვას PlayDiffusion შენივე ხმით ამბობს თავიდან: MASK ტოკენებს გარშემო ხმის მიხედვით ავსებს. ათიდან ცხრა სწორია.“
  [PlayDiffusion re-says the wrong word in your voice by filling masked tokens. Nine out of ten right.]
- **→ Re-say, in parallel:** „პარალელურად მეორე ხმის მოდელი, F5-TTS, თავის ვერსიას აკეთებს, დაახლოებით ერთ წამში.“
  [In parallel, F5-TTS makes its own take, in about a second.]
- **→ Verify:** „მერე ორივეს ორჯერ ვამოწმებთ: Whisper-მა ახალი სიტყვა უნდა გაიგოს, ასოების მოდელმა კი ძველს ახალი უნდა ამჯობინოს. იგებს ყველაზე მსგავსი ხმა, და ვსვამთ მხოლოდ ახალ სიტყვას.“
  [Both are checked twice; the closest voice wins, and only the new word is spliced in.]
- **→ Pronunciation:** „ვიჭერთ იმ სიტყვასაც, რომელიც გაუგებრად გამოგივიდა: ფონემების მოდელი ყველა ბგერას აფასებს. ექსპერტებთან შედარებით AUC 0.88-ია.“
  [We catch unclear words too: a phoneme model scores every sound. AUC 0.88 against experts.]
- **→ Tone:** „Confident კი საერთოდ არ არის AI: შენსავე ჩანაწერს ტონს უცვლის და ნერვიულ კითხვის ნიშანს წერტილად აქცევს.“
  [Confident isn't AI at all: it reshapes your own recording and turns a nervous question mark into a full stop.]
- **→ The camera flies back out:** „ეს არის მთელი სისტემა. ახლა ლაივში ვცადოთ.“
  [That's the whole system. Now let's try it live.]
- **→** to the demo slide.

If you are behind at 1:40, give only the short versions for Re-say in parallel („მეორე ხმის მოდელი, პარალელურად.“) and Pronunciation („და გაუგებარ სიტყვებსაც ვიჭერთ.“).

## 5. Live demo (2:10–4:40)
**The message.** Say it in English, exactly like this:
> "Hey team. Um, the final is on Saturday, no wait, Sunday. I didn't rehearse at all. Scratch that. *(one full second of silence)* The judges is really friendly, and I think we're ready?"

**Three rules:**
1. Click into the Discord message box before you press Alt+`.
2. While it records, say nothing but the message.
3. After "Scratch that", stay silent for one full second.

**Step by step:**
- **2:10, bingo card on screen:** „შეცდომების ბინგო. ერთ მესიჯში ოთხივე შეცდომას განზრახ დავუშვებ: „um“, აზრის შეცვლა, „scratch that“ და ერთი არასწორი სიტყვა. ინგლისურად, რადგან მოდელები ჯერჯერობით ინგლისურზეა მორგებული.“
  [Mistake bingo: all four mistakes on purpose in one message. In English: the models are tuned for English for now.]
- **2:18:** *Alt+Tab to Discord and click in the message box.* „აი, Discord.“ [Here's Discord.]
- **2:20:** *Alt+`, wait half a second, then say the message. After "Scratch that", pause and point at the bar.*
- **2:35:** *Alt+` again.* While it works: „„scratch that“ ხომ ნახეთ? ლაპარაკისას გაქრა. ახლა Whisper მესიჯს თავიდან ისმენს, LLM წყვეტს, რა ამოიჭრას, წესები ამოწმებს, ჩემს არასწორ სიტყვას კი ორი ხმის მოდელი ერთდროულად ამბობს, ჩემივე ხმით.“
  [Did you see "scratch that"? Gone while I talked. Now the models re-hear it, pick the cuts, check them, and re-say my wrong word in my voice.]
- **~2:45, before ▶ in Discord:** „ერთი სიტყვა აქ AI-მ თქვა. მოუსმინეთ: რომელი?“ [One word here was made by AI. Listen: which one?]
- **2:56:** „რომელი?“ *(take one or two guesses)* „ვნახოთ.“ [Which one? Let's look.]
- **3:01:** *Alt+Shift+`, click the top message.* „აი ისიც, მწვანით: „judges are“. გადახაზული ამოჭრილია. დანარჩენი ყველაფერი ჩემი ნამდვილი ხმაა, ხელუხლებელი.“
  [There it is, in green. Struck through means cut. Everything else is my real voice.]
- **3:11:** *Original, Space, about 5 s, Space.* „ორიგინალი…“ „…გასწორებული კი უკვე მოისმინეთ. ორიგინალი ფაილი არასდროს იცვლება.“
  [The original… and you already heard the fixed one. The original file never changes.]
- **3:26, Replace:** „ახლა თქვენ აირჩიეთ: ჟიური „friendly“ იყოს… თუ „generous“?“ *Click the word, then Replace…, type it, press Enter.* While it waits: „ამ სიტყვას ახლა ორი მოდელი ამბობს ჩემი ხმით, და შედის მხოლოდ ის, რომელიც ორივე შემოწმებას გაივლის.“ *Space to play.* „ეს სიტყვა მე არასდროს მითქვამს.“
  [You choose the word. Two models say it in my voice; only the one that passes both checks gets in. I never said that word.]
- **3:55, Confident:** *Tone, then click Confident once.* „ბოლოს, Confident. აქ AI საერთოდ არ არის: ეს ჩემივე ჩანაწერია, შეცვლილი ტონით და ტემპით.“ After it plays: „„ready?“ გახდა „ready.“ იგივე ხმა, იგივე სიტყვები.“
  [No AI here: my own recording, reshaped. "Ready?" became "ready." Same voice, same words.]
- **4:25:** *Alt+Tab to the deck, then press 1, 2, 3, 4.* „„Um“. აზრის შეცვლა. „Scratch that“. არასწორი სიტყვა.“ *(fourth stamp)* „ბინგო.“
  [Um. Change of mind. Scratch that. Wrong word. Bingo.] Stamp only what really happened; if one square failed, say „დღეს ოთხიდან სამი.“ [three out of four tonight].
- **→** to the close.

**Time gates:**
- 2:55, nothing in Discord yet: go to the backup clips (B).
- 3:30, Replace not started: skip it.
- 4:10, Confident not played: go back to the deck.
- 4:30: back to the deck, whatever is happening.

## 6. Close (4:40–5:00)
- **→** „ცხრა მოდელი. დაახლოებით ერთი წამი, და „um“-ები და უკან წაღებული სიტყვები ქრება. და 0.98: ხმის მსგავსება, როცა სიტყვას თავიდან ვამბობთ.“
  [Nine models. About a second to clean it up. And 0.98 voice similarity when we re-say a word.]
- „თქვი არეულად. გაგზავნე სუფთად. ყველაფერი GitHub-ზეა: დაასკანერეთ კოდი და სცადეთ. მადლობა!“
  [Say it messy. Send it clean. It's all on GitHub: scan the code and try it. Thank you!]
- *Stop, smile, and wait for questions.*

---

## Practising without the app
- Press **T** on the title to start the clock. Targets: chat done by about 0:53, map done by 2:10, back on the deck by 4:25.
- On the demo slide, say the demo lines anyway and press **1 2 3 4** to stamp the card.
- **B** shows backup clips from an earlier run. Never call them "live".
