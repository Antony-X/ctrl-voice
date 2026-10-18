# Ctrl+Voice — voice messages you can fix before you send

Say it messy, send it clean. Record a voice message in any chat; Ctrl+Voice cuts the ums, false starts and things you took back, re-says words that came out wrong, and sends it in your own voice. A Windows tray app with a floating recording bar, backed by the ReSpeak engine ([Antony-X/respeak](https://github.com/Antony-X/respeak)).

## Run

```
npm install
npm start            # main window + tray + floating bar
npm run start:hidden # tray only
```

The app needs a running ReSpeak engine. Its address is in **Settings → Engine** (default: the team's RunPod pod). **Check** shows whether it answers.

## Shortcuts (rebindable in Settings)

| Action | Default | Scope |
|---|---|---|
| Record, then finish and send | `Alt` + `` ` `` (key under Esc) | global |
| Undo the last thing you said | `Ctrl+Z` | global, only while recording |
| Finish and edit first | `Ctrl+Alt+Enter` | global, only while recording |
| Discard the recording | `Esc` | global, only while recording |
| Open Ctrl+Voice | `Alt+Shift+`` ` `` | global |

The app warns at startup if the record shortcut is taken by another app.

## Recording and sending

1. Open a chat and press `` Alt+` ``. The floating bar shows the live transcript (streamed to the engine over a WebSocket).
2. Talk. Say "scratch that" or press `Ctrl+Z` to drop the last thought; it disappears while you keep talking.
3. Press `` Alt+` `` again. The engine applies the fixes switched on in **Settings → Automatic fixes** (cut filler words and false starts, fix grammar, re-say unclear words), renders the audio, and Ctrl+Voice pastes it into the chat and presses Enter.

Sending works in Discord (including Vesktop, Equibop and Legcord), WhatsApp, Telegram, Slack, Signal and Teams. Anywhere else, or with "Open the editor" chosen in Settings, the message opens in the editor instead.

How: the app remembers the focused window when recording starts. On finish it puts the file on the clipboard and sends Ctrl+V (+ Enter) to *that window only*. If the window can't be focused, no keys are pressed and the file stays on the clipboard.

**Limitation:** the message arrives as an audio file attachment (inline player), not Discord's native voice-message bubble. That flag is only for bots; driving it from a user account would be self-botting, which breaks Discord's rules.

If the engine can't be reached while recording, the bar keeps recording locally and the message opens in the editor; press **Fix it** there once the engine is back.

## The editor

- The transcript shows what changed: cut words are crossed out, words the engine made are purple, words that came out unclear are underlined in amber.
- Select words to **Replace** them (typed, then said in your voice), **Say clearly**, **Cut**, or change their **Tone**. Click a changed word to undo it or try again.
- The summary line offers **Fix it**, **Shorten it** (suggested cuts you can take one by one) and **Check for misheard words**.
- The player bar: play with waveform, **Original / Fixed**, **Tone** for the whole message (your voice: confident, calm, warm — pitch and pace only; AI voice: calm, friendly, excited, confident — sounds less like you), and **Send** with a menu for other apps or copying the audio.
- `Ctrl+Z` / `Ctrl+Y` undo and redo edits, `Space` plays, `Delete` cuts the selection.

## Layout

```
src/main/      main process: tray, windows, shortcuts, message store, sending
               engine.js          HTTP client for the ReSpeak engine
               winhelper.ps1/.js  Windows helper (focused window, clipboard, keystrokes)
src/overlay/   floating recording bar
               session.js         LiveSession: mic → engine WebSocket, live words, undo
               pcm-worklet.js     24 kHz PCM capture
src/app/       main window: message list, editor, settings
src/shared/    edits.js           the edit list (cuts, replacements) shared by main and the editor
assets/        logo and icons
```

Messages are stored in `%APPDATA%/Ctrl+Voice/messages`: the untouched original recording, the latest render and the tone take, plus a JSON file with the words and edits.

## Engine API used

`/ws/{sid}` (live 24 kHz PCM, words, undo), `/api/upload`, and per session `/api/s/{sid}/` `clean`, `tighten`, `grammar`, `pron`, `intent`, `replace`, `render`, `natural`, `tone`, `state`. HTTP calls run in the main process (the engine sends no CORS headers).
