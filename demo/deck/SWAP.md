# Swapping in your own recording

The demo slides (3, 4, 5, 7) are built from whatever is in `media/`. For now that's the
engine run `sid 5eef2781` ("Hey Maya…"). **Its voice is synthetic**: F5-TTS cloning a
DisfluencySpeech voice (respeak `docs/HANDOFF.md`). Don't present it as a recording of anyone.
While `placeholder_audio` is `true` in `build/config.json`, every affected slide says so in its
speaker notes.

Every demo number on those slides is computed from the files, not typed in. That covers the
transcript, the cuts and their labels, the waveforms, "14.7 s → 8.0 s", "6.7 s shorter",
"4 cuts", the caption timing and the replaced word. Swap the files, rebuild, and the deck follows.

## What you need

- Windows with PowerPoint. The build drives PowerPoint over COM, without a window.
- Python with `pywin32`, `numpy`, `soundfile` and `Pillow`.
- `ffmpeg` on PATH.
- The Electron in `C:\Users\Antony\Desktop\ctrl+voice\node_modules` (the clips are rendered
  from the real app UI).

## 1. Your voice note (slides 3, 4, 5, 7)

1. In Ctrl+Voice, record a message with a filler or two, one correction ("Monday, no wait,
   Wednesday") and one "scratch that". Let it clean up.
2. Open `%APPDATA%\Ctrl+Voice\messages\` and take the newest `<id>` (one `.json` per message).
3. Copy the files into `deck\media\`:

   | From `messages\` | To `deck\media\` |
   |---|---|
   | `<id>.json` | `message.json` (used instead of `sample.json` when present) |
   | `<id>.wav` (or `<id>.webm`) | `messy.wav` (for webm: `ffmpeg -i <id>.webm -ac 1 -ar 24000 messy.wav`) |
   | `<id>.edit.wav` (the cleaned render, before you change anything in the editor) | `fixed.wav` |

4. The word replacement for slide 7 comes from `media/replace.json` and `media/replace.wav`, an
   engine `/replace` result for this same message. `prep_data.py` now checks that the replaced
   word really sits at that position in the new message. If it doesn't (an old file from another
   recording), it prints a warning and leaves the replacement out of the editor clip. To keep a
   replacement, save a new engine `/replace` result for your message under those two names. Set
   `replace.phrase` in `config.json` to the seconds of `replace.wav` you want played.
5. In `build/config.json`:
   - `"placeholder_audio": false`
   - `"clean_seconds"`: your cleanup time, or `null` to hide "cleaned in … s". The current 0.7
     comes from RESULTS.md for the sample message only.
   - `"contact"` and `"incoming_message"`: the chat shown in the slide 3 clip.

**Not tested yet:** `prep_data.py` reads the app's message format (`words` with `w/s/e`, plus
cut `ops`). No cleaned message exists on this machine yet, though: every saved message has empty
`ops`. If a real message shows no cuts, the app didn't save its cleanup. Send the audio through
the engine as `sample/make.js` does, then use that `sample.json` instead.

## 2. The real screen recording (slide 9)

Slide 9 is an amber **PLACEHOLDER** until `media/screen.mp4` exists. To fill it:

1. Record the screen (Win+Alt+R, or OBS) with the real app in Discord/Vesktop. In one take:
   press Alt+\`, talk, say "scratch that", press Alt+\` again, and the message arrives. Then open
   it in the editor.
2. Trim it to about 14 s, 16:9, H.264 MP4. Then save it as `deck\media\screen.mp4`.

If you don't have the recording, right-click slide 9 and choose **Hide Slide**. Then give its
14 s to "How it works".

## 3. Team names (slide 14)

Fill the three `"[Name]"` entries in `build/config.json → team`. They show in amber until you do.

## 4. Rebuild

```
cd deck\build
python prep_data.py          # media/*.json + wavs -> media/deck_data.json
python make_videos.py        # the three app clips (pill, editor, tone) -> media/clips/
python build_deck.py         # -> Downloads\Ctrl+Voice — Hackathon Pitch (final).pptx + render\slide-XX.png
python build_deck.py --video # same, plus render\deck_preview.mp4 (the talk on a 3:00 timer)
```

`build_deck.py` overwrites the final `.pptx` in Downloads, so close it in PowerPoint first. It
never touches the original `Ctrl+Voice — Hackathon Pitch.pptx.pptx`.

## Checks after a swap

- Read each slide's notes once more. The SAY lines for slides 4 and 5 are generated from the
  data ("15 seconds down to 8"). Slide 7 quotes RESULTS.md ("three to four seconds a word").
- Slide 3 strikes only the "scratch that" sentence live. That matches the app: fillers and
  corrections are cut when you finish. The clip adds a short pause after "scratch that" (see
  the notes), because the live detector needs one.
