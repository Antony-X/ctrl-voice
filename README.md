# Ctrl+Voice — AI-native voice messages (frontend prototype)

Voice messages you can edit like text, in your own voice. A Windows tray app with a floating recording bar that sends straight into Discord.

## Run

```
npm install
npm start            # opens the window + tray + floating bar
npm run start:hidden # tray only (background mode)
```

## Shortcuts (rebindable in the app)

| Action | Default | Scope |
|---|---|---|
| Start / finish & send | `Alt` + `` ` `` (key under Esc) | global |
| Semantic undo (drop last thought) | `Ctrl+Z` | global, **only while recording** |
| Finish & review in the editor | `Ctrl+Alt+Enter` | global, **only while recording** |
| Discard recording | `Esc` | global, **only while recording** |
| Open Ctrl+Voice | `Alt+Shift+`` ` `` | global |

The app warns at startup if the record shortcut is taken by another app.

## Sending to Discord

1. Open a Discord channel and press `` Alt+` ``. The bar shows **→ Discord**.
2. Talk. Press `Ctrl+Z` to drop the last thought, then keep going.
3. Press `` Alt+` `` again. Ctrl+Voice cuts undone thoughts and filler words, renders a WAV, pastes it into the Discord message box and presses Enter.

How: the app remembers the focused window when recording starts. On finish, it puts the rendered file on the clipboard and sends Ctrl+V (+ Enter) to *that window only*. If the window can't be focused, no keys are pressed and the file is left on the clipboard. The same works for WhatsApp Desktop, Telegram, Slack, Signal, Teams and browsers. Anywhere else, the editor opens. The editor's **Discord / WhatsApp / Telegram** buttons do the same for edited messages.

**Limitation:** the message arrives as an audio file attachment (inline player), not Discord's native voice-message bubble. Discord only lets you record voice messages on mobile, and the API flag for them (`IS_VOICE_MESSAGE`) is for bots; driving it from a user account would be self-botting, which breaks Discord's rules.

Settings → Sending: send vs. open editor, "Press Enter for me", "Cut filler words when sending".

## What's real vs mocked

- **Real:** mic capture, waveform, pause-based thought segmentation, semantic undo/restore, nondestructive editing, A/B playback, rendering the edited message to WAV (cuts with crossfades), pasting/sending into Discord, global shortcuts, tray, auto-start, on-disk library (`%APPDATA%/Ctrl+Voice`).
- **Mocked (the "model", kept for now):** transcript (demo mode streams a script while you speak) and AI suggestions/tone rewrites in `src/app/mockai.js`.
- **Stand-in:** generated speech uses a Windows SAPI voice, loudness-matched to yours, in `src/main/backend.js`.

## Plugging in the backend later

| Piece | Replace | Contract |
|---|---|---|
| Voice clone / speech editing | `synthesize()` in `src/main/backend.js` | text → WAV/OGG bytes in the user's voice |
| ASR with word timestamps | `_tickDemo` in `src/overlay/session.js` | segments `{ id, start, end, words: [{ w, t }], undone }` |
| LLM suggestions / tone | `MockAI.suggest`, `MockAI.toneRewrite` in `src/app/mockai.js` | edits `{ segId, start, end, text }` |

## Layout

```
src/main/      main process: tray, windows, shortcuts, storage, sending
               winhelper.ps1/.js  Windows helper (focus, clipboard, keystrokes, SAPI)
               backend.js         voice backend adapter
src/overlay/   floating recording bar + RecordingSession
src/app/       main window: home, compose, editor, library, voice, shortcuts, settings
               exporter.js        renders the edited message to WAV
assets/        logo, icons, fonts (Quicksand + Nunito, SIL OFL)
```
