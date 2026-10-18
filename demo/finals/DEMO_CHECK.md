# Live-engine check of the demo message (2026-10-18, 17:24–17:26 GST)

**Verdict: Message C as written is a NO-GO.** Two of the four bingo squares fail or are unreliable:
1. **Wrong word: the fix lands on the wrong "is".** The grammar check returned `is -> are` at word 5. That is the "is" in "the final **is** on Saturday", not the one in "The judges **is**". The engine re-said "final is" as "final are" (verified=true, engine playdiff). The output says "**the final are on Sunday**", and "The judges is" is left as it was. The engine's own ASR of the final take confirms this. The editor's green word would read "final are", not "judges are".
2. **"Scratch that": only the live strike cuts it.** The final pass flags the command cut as a suggestion only (`kind: command, auto: false`), so autoFix leaves "I didn't rehearse at all. Scratch that." in the sent audio. It is removed only when the live strike fires during recording, and that was unreliable (next section).

Working as promised: "Um," cut, "Saturday. No, wait," cut, Replace friendly -> generous (verified), Confident (rising ending -> falling).

## How it was run (the app's own path, nothing in the app changed)
- Input: ElevenLabs premade voice **Chris** (iP95p4xoKVk53GoZ742B, eleven_multilingual_v2), a synthetic American voice and **not the speaker's accent**. Made in two parts with exactly 1.0 s of digital silence after "Scratch that.", 24 kHz mono, 8.64 s: `demo_check\msgC.wav`.
- Recording path: the overlay's `session.js` protocol, driven from a file. WebSocket `/ws/<sid>?key=…`, 2400-sample Int16 frames sent in real time (100 ms each), then `{type:'stop'}` -> `final`.
- Finish path: `main.js finishRecording -> autoFix` with the runbook's settings (cleanup, grammar and misspoken on; **re-say unclear words off**), then `render`. Then the editor's Replace (`kind: 'replace'`), a render, and Confident Medium (`natural`, `mix {confident: 1}`, which is what one click on the character gives). Then one upload of the final take for the engine's ASR.
- Difference from the app: the 3 checks ran one after another (1 request in flight), where the app runs them in parallel.
- Script: `scratchpad\demo_check\run.js`. Logs: `demo_check\C.log` (run 1) and `demo_check\C2.log` (run 2). Data: `demo_check\C\run.json`.
- Engine use: 11 requests (run 1 failed, so run 2 had to repeat the chain), which is over the ~8 budget. No settings were changed and nothing was restarted.

## Live "scratch that" strike (streaming path, same audio twice)
| Run | Strike fired? | Final arrived? |
|---|---|---|
| 1 | Yes. `undone` arrived 7.53 s after the socket opened (about 1.6 s after "that." ended, so after the next sentence had started), and it removed "I didn't rehearse at all. Scratch that." | **No final within 30 s.** In the app this means "The server didn't finish in time. Saved locally", then a re-upload and the fixes: about 30 s plus about 12 s. That breaks the 2:55 gate. |
| 2 | **No.** The live transcript updated only at 1.4 s, 4.7 s and 9.2 s, so the engine never looked at the audio during the 1 s pause. | Yes, 0.45 s after stop. |

So with a 1 s pause the strike is roughly a coin flip, and the one strike we got was followed by a hung final. That is two observations, not a rate, but it is the biggest live risk.

## Run 2 results (complete chain)
- Live/final transcript: "Hey, team. Um, the final is on Saturday. No, wait, Sunday. I didn't rehearse at all. Scratch that. The judges is really friendly, and I think we're ready."
- clean: filler "Um," (auto), correction "Saturday. No, wait," (auto), command "I didn't rehearse at all. Scratch that." (**suggestion only, auto: false**)
- grammar: `is -> are` at [5-5], which is **the wrong "is"**. intent (misspoken): nothing.
- Auto-fixed text (the Discord message): "Hey, team. the final are on Sunday. I didn't rehearse at all. Scratch that. The judges is really friendly, and I think we're ready." Length 8.70 s -> 8.25 s; the AI audio is at 1.31–2.61 s.
- Editor Replace: "really friendly," -> "really generous", **verified=true** (engine f5; it re-says the word before too). Text and ASR both show "really generous".
- Confident Medium: 8.17 s -> 6.89 s. Pitch of the last word (pyin): before **+56% rise** (95 -> 148 Hz); after Confident **−12% fall** (95 -> 84 Hz). This works. Note that Whisper writes the original as "ready." (a period), even though the ending rises.
- Engine ASR of the final take: "Hey, team. The final are on Sunday. I didn't rehearse at all. Scratch that. The judges is really generous, and I think we're ready."

## Wait times (live engine, run 2)
| Step | Measured | What it means on stage |
|---|---|---|
| stop -> final | 0.45 s | |
| clean / grammar / intent | 1.05 / 0.75 / 1.42 s (one after another) | the app runs them in parallel, so about 1.5 s |
| grammar re-say ("Saying 'are'…") | **6.5 s** | |
| render | 0.43 s | |
| **Alt+` -> file in Discord** | **about 9–10 s** (11.0 s measured with the checks in series) | The runbook's 2:35 -> ~2:45 is right, provided the final arrives |
| Editor Replace + re-render | 3.1 s + 0.2 s | the runbook's "about 3 s" is right |
| Confident Medium | 0.6 s (+0.45 s debounce in the app) | the runbook's "about 1 s" is right |

## Output audio
In `C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\demo_check\C\`:
`before.wav` (the engine's original), `after.wav` (what Discord would get), `after_replace.wav` (after friendly -> generous), `confident.wav` (Confident Medium).

## Script changes needed (not made; SCRIPT.md is someone else's)
1. **Remove the earlier "is" from message C**, or switch to A or B. As far as we can tell, the grammar fix goes to the first matching word.
   - Option: "Um, the final's on Saturday, no wait, Sunday." Or "Um, we're on stage Saturday, no wait, Sunday."
   - Message A: "tickets is" comes *before* "dinner is". Message B: "We has" is the only "has". Neither should hit this.
   - **None of these was tested.** Rehearse the new wording once on the live engine and check that the green word is the right one.
2. **"Scratch that"**: a 1 s pause is not enough, because the live transcript refreshes only every 3–4.5 s. Stay silent until the strike-through *shows* (up to about 3 s). If it hasn't shown by then, press **Ctrl+Z** (global undo while recording). The Ctrl+Z path was **not tested**.
   - If the bar sits on "Finishing up…" for more than about 5 s, the final has hung (run 1). Go to Plan B "engine slow" straight away rather than at 2:55.
   - The editor line "Everything struck through is cut" holds only if the strike fired. Otherwise the scratched sentence is still in the Discord audio, and "I didn't rehearse at all" plays to the judges.
3. **Settings:** the live app currently has **Re-say unclear words ON** (`fix.pronunciation: true`). The runbook wants it OFF. Switch it off in the app before the talk (I did not touch it).
4. Timings in 2.2, 2.3 and 2.4 match the measurements, so they need no change.

## Not tested
- Messages A and B (out of request budget).
- The presenter's real mic and accent (the test used a synthetic American voice).
- The Ctrl+Z undo.
- Discord paste and send.
- Re-say unclear words ON (with an accent it may add extra green words).

---

# Round 2: reworded message C' (17:31–17:33 GST)
> "Hey team. Um, we're on stage on Saturday, no wait, Sunday. I didn't rehearse at all. Scratch that. *(1 s pause)* The judges is really friendly, and I think we're ready?"

Setup:
- Same synthetic voice (Chris, `eleven_multilingual_v2`). Exactly 1.0 s of silence after "that.", which ends at 5.84 s audio time. The next sentence starts at 6.84 s.
- Input `demo_check\msgCp.wav`, 9.31 s.
- Engine requests: 6. That is 1 live stream, plus the app's fallback chain: upload, clean, grammar, replace and render. The misspoken check (intent) was skipped to stay in budget; it found nothing for this sentence in run 2.

**Verdict: GO for C'**, with the presenter protocol below. All four squares fired in the audio the app would send.

| Check | Result |
|---|---|
| Live strike | **Fired**, 1.06 s after "that." ended (audio time 6.90 s), which is just as the next sentence starts. It removed "I didn't rehearse at all. Scratch that." |
| Final | **Did not arrive.** The server closed the socket (code 1006) about 0.5 s after `stop`, with no `final`. That makes 2 of 2 runs where the strike fired and no final came (run 1 had no close logging). |
| What the app does then (from the code) | `session.js _goOffline` resolves the final as null **immediately** on close, so there is no 30 s wait. `finishRecording` gets `sid: null` and the live `removed` span. `autoFix -> withSession -> uploadOriginal` re-uploads the local WAV, and the live cut carries over (cuts are original-audio times). I ran exactly that chain. The bar may briefly show "Connection lost. Recording locally"; ignore it. |
| clean | "Um," (auto), "Saturday. No, wait," (auto), the command (suggestion only, already cut by the live strike) |
| grammar | `is -> are` at [20-20], **the right word**. Re-said as "judges is" -> "**judges are**", verified=true. This is the word that turns green, AI audio at 2.95–4.16 s. |
| Sent text | "Hey, team. we're on stage on Sunday. The judges are really friendly, and I think we're ready." Audio 9.31 s -> 5.95 s. |
| Time, `stop` to rendered file | close +0.5 s, then upload 1.7, clean 0.65, grammar 0.61, re-say 3.2, render 0.64 = **7.4 s** (checks run in series here; the app runs them in parallel, intent included). **About 8–9 s from the second Alt+` to the file in Discord.** |

Output: `C:\Users\Antony\AppData\Local\Temp\claude\C--Users-Antony-Desktop-ctrl-voice\5985905e-4572-4f19-a6ec-0c1ce1de5723\scratchpad\demo_check\Cp\after.wav`. Logs: `demo_check\Cp.log`, `demo_check\Cp_fallback.log`; data in `demo_check\Cp\run.json`.

Not re-run on C' (they worked on C, and the sentence is unchanged): the editor Replace friendly -> generous, Confident, and the ASR of the output.

## Ctrl+Z while recording (code only, not run)
- What it does: `overlay.js undo() -> session.undo()` flushes the partial audio chunk and sends `{type: 'undo'}` over the WebSocket. It is a **server-side** "semantic undo of the last thought", not a local edit.
- What you see: the server answers `undone`, and the bar strikes the range or says "Nothing to undo". **Offline it does nothing**, and the bar only flashes the button.
- It removes whatever the engine counts as the *last thought at the moment you press it*:
  - Pressed after you start "The judges…", it removes the judges sentence.
  - Pressed after the voice strike has already fired, it removes the sentence before it ("…Sunday").
  - Pressed in the pause with "Scratch that." as the tail, the code doesn't say whether it removes the whole "I didn't rehearse at all. Scratch that." or just "Scratch that.". **Untested.**

## Presenter protocol for "scratch that"
1. Say "…I didn't rehearse at all. Scratch that." Then **stop and stay silent, watching the bar.** Count two full seconds ("one-Mississippi, two-Mississippi"). In the runs where it fired, the strike showed 1.1 s and 1.6 s after "that.".
2. **When the strike-through appears, go straight on** with "The judges is…". Do not press Ctrl+Z after a strike: it would also remove "…Sunday".
3. **If nothing is struck after about 3 s** (it happened once in 3 runs, when the live transcript was refreshing only every ~4 s), press **Ctrl+Z once** and wait for the strike. Then continue. If the bar says "Nothing to undo", just continue.
   - Ctrl+Z is untested, so stamp the "scratch that" square only if the editor shows the sentence crossed out.
   - Without any strike, the sentence stays in the Discord audio; the finish pass only *suggests* that cut.
4. After the second Alt+`, expect **about 8–9 s**. The bar may show "Connection lost…" and then "Cleaning up… / Saying 'are'… / Finishing… / Sent". That is normal: the strike makes the engine drop the socket, and the app re-uploads the recording.
