# Ctrl+Voice — demo kit

Everything for the hackathon demo that isn't app or engine code: the pitch deck, the video project, the demo script and the test harnesses. The plan is in [DEMO_PLAN.md](DEMO_PLAN.md).

| Repo | What |
|---|---|
| [george-ckito/ctrl-voice](https://github.com/george-ckito/ctrl-voice) (public) | The Windows app (Electron) |
| [Antony-X/respeak](https://github.com/Antony-X/respeak) (private) | The engine (FastAPI on the GPU pod). Infra details in `docs/HANDOFF.md`, measurements in `docs/RESULTS.md` |
| this repo (private) | Deck, video, demo script, harnesses |

## Folders

- `deck/`: python-pptx + PowerPoint build of the pitch deck.
  - `deck/final/` holds the built `.pptx`. `deck/original/` holds the team's original deck, which the build never overwrites.
  - `deck/SWAP.md` explains how to swap in your own recording and rebuild.
  - The build needs Windows with PowerPoint, Python (`pywin32 numpy soundfile Pillow`) and ffmpeg.
- `video/`: Remotion project for the film and the demo video.
  - Run `npm install`, then `npx remotion studio` to preview and `npx remotion render` to render. Read its `_docs/` first.
- `demoscript/`: the demo lines and the scripts that check them against the real engine.
- `e2e/`: end-to-end test of the real app. It drives Electron with a fake mic and checks live words, "scratch that", the fixes, the editor and tone.
  - Run it from this folder: `<ctrl-voice>/node_modules/electron/dist/electron.exe e2e/main.js --steps=rec,editor,cancel`.
  - Edit `CV` at the top of `e2e/main.js` to point at your ctrl-voice checkout.
- `harness/`: renders real app UI into clips for the deck.
- `sample/`: the sample message, run through the engine.
- `notes/`: earlier plans.

Some scripts have absolute paths from the machine they were written on (`C:/Users/Antony/...`). Fix them for your checkout.

## Continue on another machine

1. Clone the three repos side by side. In `ctrl-voice`, run `npm install` then `npm start`.
   - The engine address is built in and also editable in Settings → Engine; **Check** should show green.
2. **Copy by hand, never through git:**
   - The pod SSH key `~/.ssh/runpod_ioai`.
   - If you'll make test voices: the ElevenLabs key, as `deck/.elevenlabs_key` (gitignored).
3. **The pod:** `xjdypx6zst9jkd`, an A100 80 GB at $1.39/hr while running. Stopping it wipes its container disk, and the services then have to be started again by hand (see respeak `docs/HANDOFF.md`).
   - Engine: `https://xjdypx6zst9jkd-7860.proxy.runpod.net`.
   - SSH: `ssh -i ~/.ssh/runpod_ioai -p 23100 root@216.249.100.66`.
   - Health check: `GET /` returns 307.
   - Restart the engine only:
     ```
     pkill -f "[u]vicorn app:app"
     ENGINES=playdiff:8101,f5:8103,auk:8102 nohup bash /workspace/app/start_app.sh </dev/null >/dev/null 2>&1 &
     ```
4. **With Claude Code:** start it in the ctrl-voice folder and point it at this README, `DEMO_PLAN.md` and respeak `docs/HANDOFF.md`.
