# Recording the pitch video on the laptop

The video is you presenting the HTML deck (`demo/pitch/`) and then a short live part in Discord and the app. The script, slide by slide, is in `demo/PITCH.md` and in the deck's speaker notes.

## Set up once (about 15 minutes)

1. Install **Git**, **Node.js 20 LTS or newer**, **OBS Studio**, **Discord** and **Chrome** (or use Edge).
2. Get the code. The repo is private, so sign in to GitHub as Antony-X when Git asks.
   ```
   git clone https://github.com/Antony-X/ctrl-voice.git
   cd ctrl-voice\desktop
   npm install
   ```
   The first `npm install` downloads Electron, about 110 MB.
3. Start Ctrl+Voice once with `npm start`, and open **Settings**:
   - **Engine → Check** should go green. If it doesn't, the GPU server is off.
   - **Microphone**: the one you'll talk into.
   - If the microphone doesn't work, go to Windows **Settings → Privacy & security → Microphone** and turn on **Let desktop apps access your microphone**.
4. In Discord, make a private server with one channel for the demo. Turn on Discord's Do Not Disturb and Windows' Do not disturb.
5. In OBS, set 1920×1080 at 60 fps. Record desktop audio (the example clips) and your mic (your voice). **Wear headphones**, so the clips don't leak into your mic.

## Getting updates

Run `git pull` in the `ctrl-voice` folder. Then quit Ctrl+Voice from the tray icon and start it again.

## Part 1: the deck

- **Open:** double-click `demo\pitch\index.html`. It opens in Chrome or Edge and needs no internet.
- **Keys:**
  - **→**, **Space** or a clicker: next step. A slide's example audio plays by itself.
  - **←**: back. **P**: pause or resume the clip. **R**: replay it.
- **S** opens the speaker notes in their own window: your script, a timer and what's next.
- **One screen:**
  - Leave the deck as a normal window; don't press F.
  - In OBS, use **Window Capture** on the deck window. It still records the deck when the notes window sits on top.
- **Two screens:** press **F** for fullscreen on one screen, keep the notes on the other, and use **Display Capture**.
- **Backup with no narration:** `index.html?auto` plays the whole deck on its own.

## Part 2: live in Discord, then the app

1. **Before recording**, start Ctrl+Voice with the prerecorded take as its microphone:
   ```
   cd ctrl-voice\desktop
   npm start -- --demo-mic=..\demo\pitch\examples\clean\live_take.wav
   ```
   Settings → Microphone says **Demo mic on**. Each recording now plays that take out loud and transcribes it live. Everything after that is the real app: the captions, "scratch that", the fixes and the send.
2. Settings for this part:
   - When you finish: **Send it**
   - Press Enter after pasting: **on**
   - Your sound: all **Off**
   - Native accent: **off**
3. **In the recording:**
   1. Click in the demo channel and press **Alt+\`**. The take plays and the caption follows it; "scratch that" strikes the line out.
   2. When the take ends, press **Alt+\`** again.
   3. The clean message lands in the channel. Click play on it.
   4. Open Ctrl+Voice on that message:
      - play **Original**, then **Fixed**;
      - point at what it removed (Filler, Self-correction, Scratched) and what it re-said (Misspoken: *specific*, *moot*);
      - click **Confident** and play it.
4. **The wait:** fixing takes about 4–15 s, longer when it re-says words. Keep recording through it. Afterwards I cut the wait and add a small **"processing sped up"** tag, so the video is fast and honest.

To go back to your real mic, quit Ctrl+Voice from the tray and run `npm start` without `--demo-mic`.

## Before each take

- Do one warm-up run. The first call after a quiet spell is slower.
- Keep Do Not Disturb on.
- Have the headphones on.

## After recording

Put the OBS recordings in one folder (Google Drive is fine) and share it. I'll do the cut and the tag.
