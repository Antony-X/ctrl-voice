# Finals presentation

Open `index.html` in Chrome. It works straight from the file, with no server and no internet. Press **F** for fullscreen and **S** for the speaker notes window. The talk script and the live-demo runbook are in `SCRIPT.md`. `PITCH.md` is a one-page practice sheet with only the spoken lines (Georgian, with the English meaning), and `NOTES_KA.md` has the full Georgian notes.

**Before the talk:** on the start screen, click **Sound check** (or press **A** at any time). You should hear three rising notes from the room speakers. If they come from the laptop instead, fix the Windows output device before you start.

| Key | What it does |
| --- | --- |
| → / Space / click, ← / right-click | Next / previous step |
| A | Sound check (three notes) |
| F | Fullscreen |
| S | Speaker notes in a second window, with a timer |
| N | Speaker notes over the slide |
| 1–4 | Stamp a square on the "Mistake bingo" demo slide |
| B | Jump to the backup videos |
| X | Skip this slide (remembered in this browser) |
| P | Pause or play the current clip or video |
| R | Replay this step |
| T | Reset the timer |
| . | Black screen |

The slides are:
1. title;
2. two voice notes in a chat, played and fixed (real engine output);
3. 7 billion;
4. the architecture map (each click flies to the next region);
5. mistake bingo (the live demo);
6. thank you.

The backup videos are reached only with B.

To put a recording of a real rehearsal first on the backup slide, save it as `media/video/live_backup.mp4`.

Files:
- `fig/` holds the scripts that compute the figure data in `media/` from the example audio and the engine output.
- `assets/arch/*.js` holds one file per region of the architecture map.
- `arch_preview.html?r=<region>` previews a single region.

The example voices are ElevenLabs voices (Sarah, Eric). The long pauses the TTS left in the inputs were shortened before they went through the engine; speech was never touched. Every "after" clip is the engine's real output.
