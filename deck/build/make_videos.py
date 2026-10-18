"""Renders the deck's demo clips from the real app UI (Electron harness, offscreen, muted).

  pill.mp4    the recording bar over a chat window: live caption in sync with messy audio,
              "scratch that" struck and removed, then Cleaning up -> Sent, file lands in the chat
  editor.mp4  the editor: Original/Fixed, select a word, Replace, the engine's word turns green,
              then the engine's real audio for that phrase
  tone.mp4    the tone panel: the three characters light up as their sliders rise

Every page animation runs in virtual time (Web Animations paused and seeked per frame), so the
clips are frame-exact at 30 fps no matter how slow capture is. Inputs: media/deck_data.json
(run prep_data.py first), media/*.wav, build/config.json. Output: media/clips/*.mp4 + posters.

Usage: python make_videos.py [pill] [editor] [tone]     (default: all)
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prep_data import meter  # noqa: E402

BUILD = Path(__file__).resolve().parent
DECK = BUILD.parent
MEDIA = DECK / "media"
CLIPS = MEDIA / "clips"
WORK = BUILD / "work"
ELECTRON = "C:/Users/Antony/Desktop/ctrl+voice/node_modules/electron/dist/electron.exe"
HARNESS = DECK.parent / "harness" / "main.js"
OVERLAY_STUB = DECK.parent / "harness" / "verify" / "ctrlvoice-stub.js"
APP_PAGE = "C:/Users/Antony/Desktop/ctrl+voice/src/app/index.html"
OVERLAY_PAGE = "C:/Users/Antony/Desktop/ctrl+voice/src/overlay/overlay.html"
FPS = 30
STAGE = (0x17, 0x17, 0x16)

# Pause and seek every page animation to virtual time vt (seconds).
VT_JS = ("window.__vtSync = function (vt) { for (const a of document.getAnimations()) {"
         " if (a.__v0 === undefined) a.__v0 = vt; a.pause(); a.currentTime = Math.max(0, (vt - a.__v0) * 1000); } };")
MUTE_JS = "HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };"


def ease(u):
    u = min(1.0, max(0.0, u))
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def run_harness(plan, name, timeout=1500):
    WORK.mkdir(parents=True, exist_ok=True)
    p = WORK / f"{name}.plan.json"
    plan.setdefault("timeout", timeout * 1000 - 5000)
    p.write_text(json.dumps(plan), encoding="utf-8")
    r = subprocess.run([ELECTRON, str(HARNESS), "--plan", str(p)], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    log = r.stdout + r.stderr
    (WORK / f"{name}.log").write_text(log, encoding="utf-8")
    errs = [l for l in log.splitlines() if "ERROR" in l or "error:" in l.lower() or "WARNING" in l]
    if r.returncode != 0:
        raise SystemExit(f"harness {name} exit {r.returncode}; see {WORK / (name + '.log')}\n" + "\n".join(log.splitlines()[-15:]))
    if errs:
        print(f"  [{name}] harness reported:", *errs[:8], sep="\n    ")
    return log


def frames_dir(name):
    d = WORK / f"frames_{name}"
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    return d


def ffmpeg_writer(out, size, audio=None, audio_filter=None):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}",
           "-r", str(FPS), "-i", "-"]
    if audio:
        cmd += ["-i", str(audio), "-filter_complex", f"[1:a]{audio_filter or 'anull'},apad[a]", "-map", "0:v", "-map", "[a]",
                "-c:a", "aac", "-b:a", "160k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high",
            "-movflags", "+faststart", str(out)]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def fmt_dur(sec):
    return f"{int(sec // 60)}:{int(round(sec % 60)):02d}"


# ---------------------------------------------------------------- recording bar clip
def pill_clip(data, cfg):
    print("pill clip")
    x, sr = sf.read(MEDIA / "messy.wav", dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    live = data["live_strike"]
    ins = live and live.get("pause_insert")
    if ins:
        k = int(ins["at"] * sr)
        x = np.concatenate([x[:k], np.zeros(int(ins["sec"] * sr), np.float32), x[k:]])
    sh = (lambda t: t + ins["sec"] if t > ins["at"] else t) if ins else (lambda t: t)
    WORK.mkdir(parents=True, exist_ok=True)
    sf.write(WORK / "pill_audio.wav", x, sr)
    levels = meter(x, sr)
    words = [{"w": w["w"], "s": round(sh(w["s"]), 3), "e": round(sh(w["e"]), 3)} for w in data["words"]]

    A0, T_REC, T_LIVE = 1.3, 0.7, 1.25                 # audio starts 0.6 s after the bar opens
    a_end = A0 + len(x) / sr
    lag, cadence = 0.45, 0.9                            # measured live: updates every ~0.9 s, ~0.45 s behind
    count = lambda tu: sum(1 for w in words if w["e"] <= tu - A0 - lag + 1e-6)
    ev = [{"t": T_REC, "type": "rec"}, {"t": T_LIVE, "type": "live"}]
    t_det = None
    if live:
        t_det = A0 + words[live["j"]]["e"] + 1.1        # live run: removal arrived ~1.1 s after "that" ended
    tu, ups = A0 + 1.35, []
    while tu < a_end + lag + cadence:
        ups.append(tu)
        tu += cadence
    if t_det:
        ups = sorted(set(round(u, 3) for u in ups + [t_det]))
    for u in ups:
        ev.append({"t": u, "type": "update", "n": count(u)})
    if t_det:
        ev += [{"t": t_det + 1e-4, "type": "strike"}, {"t": t_det + 1.4, "type": "unstrike"},
               {"t": t_det + 3.5, "type": "restoreOff"}]
    t_last = max(ups)
    t_done = max(a_end + 0.5, t_last + 0.2)
    target = cfg.get("send_target", "Discord")
    t_ok = t_done + 0.1 + 0.9 + 0.5
    t_idle = t_ok + 1.8                                  # the app returns to idle 1.8 s after "Sent"
    t_end = t_idle + 0.9
    ev += [{"t": t_done, "type": "flash"}, {"t": t_done + 0.1, "type": "proc", "text": "Cleaning up…"},
           {"t": t_done + 1.0, "type": "status", "text": f"Sending to {target}…"},
           {"t": t_ok, "type": "ok", "text": f"Sent to {target}"}, {"t": t_idle, "type": "idle"}]
    ev.sort(key=lambda e: e["t"])
    TL = {"A0": A0, "T_REC": T_REC, "target": f"To {target}", "words": words, "levels": levels, "events": ev,
          "si": live["i"] if live else -1, "sj": live["j"] if live else -1, "tdet": t_det or 1e9,
          "c0": sh(live["t0"]) if live else 0, "c1": sh(live["t1"]) if live else 0}
    setup = VT_JS + """
(() => {
  const TL = %s;
  let ev = 0;
  window.__t = 0;
  session = { elapsed: 0, undo() {}, redo() {}, cancel() {},
    levels(n) { const k = Math.floor((window.__t - TL.A0) / 0.05); const out = [];
      for (let i = k - n + 1; i <= k; i++) out.push(i >= 0 && i < TL.levels.length ? TL.levels[i] : 0); return out; } };
  function run(e) {
    switch (e.type) {
      case 'rec': words = []; recentCut = null; setState('rec'); $('capTarget').textContent = TL.target;
        $('capNote').textContent = 'Connecting…'; renderCaption(); break;
      case 'live': $('capNote').textContent = noteText(); renderCaption(); break;
      case 'update': words = TL.words.slice(0, e.n).map((w, k) => ({ w: w.w, s: w.s, e: w.e,
        x: k >= TL.si && k <= TL.sj && e.t >= TL.tdet - 1e-3 })); renderCaption(); break;
      case 'strike': recentCut = { t0: TL.c0, t1: TL.c1 }; $('capNote').textContent = 'Scratched that';
        showRestore(true); clearTimeout(restoreTimer); renderCaption(); break;
      case 'unstrike': recentCut = null; renderCaption(); break;
      case 'restoreOff': showRestore(false); clearTimeout(restoreTimer); $('capNote').textContent = noteText(); break;
      case 'flash': flash($('doneBtn')); break;
      case 'proc': setState('proc'); pill.classList.remove('ok', 'failed'); $('procText').textContent = e.text; break;
      case 'status': $('procText').textContent = e.text; break;
      case 'ok': pill.classList.add('ok'); $('procText').textContent = e.text; break;
      case 'idle': setState('idle'); break;
    }
  }
  window.__f = function (t) {
    window.__t = t;
    while (ev < TL.events.length && TL.events[ev].t <= t + 1e-6) run(TL.events[ev++]);
    if (state === 'rec') { session.elapsed = Math.max(0, t - TL.T_REC); $('time').textContent = fmt(session.elapsed); drawWave(); }
    window.__vtSync(t);
  };
})();
""" % json.dumps(TL)
    n = int(round(t_end * FPS))
    fd = frames_dir("pill")
    shots = [{"wait": 1500, "js": setup + "__f(0)", "out": str(fd / "f00000.png")}]
    shots += [{"wait": 0, "js": f"__f({k / FPS:.4f})", "out": str(fd / f"f{k:05d}.png")} for k in range(1, n)]
    run_harness({"page": OVERLAY_PAGE, "width": 680, "height": 240, "transparent": True, "stub": str(OVERLAY_STUB),
                 "colorScheme": "dark", "scale": 2, "shots": shots}, "pill")

    # chat window states: plain, with the shortcut keycap, and the sent file sliding in
    fbars = data.get("fixed_bars_small") or small_bars(MEDIA / "fixed.wav", 46)
    cd = frames_dir("chat")
    N = 11
    cs = [{"wait": 800, "js": f"setup({json.dumps({'contact': cfg.get('contact', ''), 'incoming': cfg.get('incoming_message', ''), 'file': data['export_name'], 'dur': fmt_dur(data['fixed_duration']), 'bars': fbars})})",
           "out": str(cd / "base.png")},
          {"wait": 0, "js": "document.body.style.setProperty('--k', 1)", "out": str(cd / "key.png")}]
    cs += [{"wait": 0, "js": f"document.body.style.setProperty('--k', 0); document.body.classList.add('sent'); document.body.style.setProperty('--p', {i / N:.4f})",
            "out": str(cd / f"sent{i:02d}.png")} for i in range(1, N + 1)]
    run_harness({"page": str(BUILD / "pages" / "chat.html"), "width": 1920, "height": 1080, "transparent": False,
                 "backgroundColor": "#171716", "scale": 1, "shots": cs}, "chat")

    base = Image.open(cd / "base.png").convert("RGB")
    keyed = Image.open(cd / "key.png").convert("RGB")
    sent = [Image.open(cd / f"sent{i:02d}.png").convert("RGB") for i in range(1, N + 1)]
    key_windows = [(0.35, 1.6), (t_done - 0.45, t_done + 0.55)]
    t_slide = t_ok + 0.15

    def key_alpha(t):
        a = 0.0
        for k0, k1 in key_windows:
            if k0 <= t <= k1:
                a = max(a, min(1, (t - k0) / 0.15, (k1 - t) / 0.2))
        return a

    CLIPS.mkdir(parents=True, exist_ok=True)
    out = CLIPS / "pill.mp4"
    W, H = 1920, 1080
    proc = ffmpeg_writer(out, (W, H), WORK / "pill_audio.wav", f"adelay={int(A0 * 1000)}:all=1")
    poster_t = (t_det + 0.35) if t_det else a_end * 0.6
    for k in range(n):
        t = k / FPS
        if t >= t_slide:
            bg = sent[min(N - 1, int(round(ease((t - t_slide) / 0.37) * (N - 1))))].copy()
        else:
            a = key_alpha(t)
            bg = Image.blend(base, keyed, a) if a > 0 else base.copy()
        ov = Image.open(fd / f"f{k:05d}.png").convert("RGBA")
        bg.paste(ov, (int((W - ov.width) / 2), H - 24 - ov.height - 6), ov)
        if abs(t - poster_t) < 0.5 / FPS:
            bg.save(CLIPS / "pill_poster.png")
        if k == 0:
            bg.save(CLIPS / "pill_first.png")
        proc.stdin.write(bg.tobytes())
    proc.stdin.close()
    proc.wait()
    meta = {"duration": round(n / FPS, 2), "audio_start": A0, "strike_at": t_det, "pause_inserted": ins,
            "sent_at": t_ok, "poster_t": poster_t}
    (CLIPS / "pill.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    print(f"  -> {out} ({out.stat().st_size / 1e6:.1f} MB, {n / FPS:.1f} s)")


def small_bars(path, n):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    hop = len(x) // n
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms)
    lo, hi = np.percentile(db, 10), np.percentile(db, 99)
    return np.clip((db - lo) / (hi - lo), 0.08, 1).round(2).tolist()


# ---------------------------------------------------------------- app clips (editor, tone)
CURSOR_JS = """
(() => {
  const c = document.createElement('div');
  c.id = '__cur';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
  c.innerHTML = '<svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 2 L2 22.5 L7.2 17.6 L10.6 25.6 L14.2 24.1 L10.8 16.3 L17.8 16.1 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.appendChild(c);
  const st = document.createElement('style');
  st.textContent = '.__rip{position:fixed;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%%;border:2px solid rgba(26,26,26,.45);animation:__rip .45s ease-out forwards}@keyframes __rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.25);opacity:0}}';
  document.head.appendChild(st);
  const P = %s;
  let cur = { x: P.start[0], y: P.start[1] }, ai = 0;
  const pt = (m) => {
    if (m.xy) return { x: m.xy[0], y: m.xy[1] };
    const el = document.querySelector(m.sel);
    if (!el) { console.warn('cursor target missing', m.sel); return cur; }
    const r = el.getBoundingClientRect();
    let fx = m.fx ?? 0.5;
    if (m.range) fx = (el.value - el.min) / (el.max - el.min);
    const thumb = m.range ? 9 : 0;
    return { x: r.left + thumb + (r.width - 2 * thumb) * fx + (m.dx || 0), y: r.top + r.height * (m.fy ?? 0.5) + (m.dy || 0) };
  };
  const ease = (u) => (u = Math.min(1, Math.max(0, u)), u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const ripple = () => { const r = document.createElement('div'); r.className = '__rip'; r.style.left = cur.x + 'px'; r.style.top = cur.y + 'px'; document.body.appendChild(r); };
  const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: cur.x, clientY: cur.y }));
  function act(a, t) {
    const el = a.sel ? document.querySelector(a.sel) : null;
    if (a.sel && !el) { console.warn('action target missing', a.sel); return; }
    if (a.do === 'click') { ripple(); el.click(); }
    else if (a.do === 'select') { ripple(); const b = a.sel2 ? document.querySelector(a.sel2) : el; fire(el, 'mousedown'); fire(b, 'mouseover'); fire(document, 'mouseup'); }
    else if (a.do === 'type') { el.focus(); el.value = a.text; el.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (a.do === 'slide') { /* handled per frame */ }
    else if (a.do === 'change') { el.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (a.do === 'release') document.documentElement.setAttribute('data-release-' + a.name, '');
    else if (a.do === 'js') (0, eval)(a.code);
  }
  window.__fa = function (t) {
    while (ai < P.acts.length && P.acts[ai].t <= t + 1e-6) act(P.acts[ai++], t);
    for (const s of P.slides) {                      // slider drags: value follows time
      if (t < s.t0 || t > s.t1 + 1 / 30) continue;
      const el = document.querySelector(s.sel); if (!el) continue;
      const v = Math.round(s.v0 + (s.v1 - s.v0) * ease((t - s.t0) / (s.t1 - s.t0)));
      if (String(v) !== el.value) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    for (const m of P.moves) {
      if (t < m.t0) break;
      if (t > m.t1 + 1e-6) continue;                   // finished: cur already holds its end point
      if (!m.from) m.from = { ...cur };
      const to = pt(m);                                // live target (a slider thumb moves while dragged)
      if (m.track) { cur = to; continue; }
      const u = m.t1 > m.t0 ? ease((t - m.t0) / (m.t1 - m.t0)) : 1;
      cur = { x: m.from.x + (to.x - m.from.x) * u, y: m.from.y + (to.y - m.from.y) * u };
    }
    c.style.transform = `translate(${cur.x - 2}px, ${cur.y - 2}px)`;
    window.__vtSync(t);
  };
})();
"""


def app_clip(name, plan, t_end, crop_keys, out_size, audio=None, audio_filter=None, scheme="light"):
    """crop_keys: [(t, (l, t, r, b)) in 2x px]; the crop eases between keys."""
    print(f"{name} clip")
    n = int(round(t_end * FPS))
    fd = frames_dir(name)
    setup = MUTE_JS + VT_JS + CURSOR_JS % json.dumps(plan)
    shots = [{"wait": 2200, "js": setup + "__fa(0)", "out": str(fd / "f00000.png")}]
    shots += [{"wait": 0, "js": f"__fa({k / FPS:.4f})", "out": str(fd / f"f{k:05d}.png")} for k in range(1, n)]
    run_harness({"page": APP_PAGE, "width": 1180, "height": 720, "transparent": False,
                 "backgroundColor": "#f3f2ee" if scheme == "light" else "#171716", "stub": str(BUILD / "deck-stub.js"),
                 "colorScheme": scheme, "scale": 2, "shots": shots}, name)

    def crop_at(t):
        for (ta, ra), (tb, rb) in zip(crop_keys, crop_keys[1:]):
            if ta <= t <= tb:
                if ra == rb:
                    return ra
                u = ease((t - ta) / (tb - ta)) if tb > ta else 1
                return tuple(a + (b - a) * u for a, b in zip(ra, rb))
        return crop_keys[-1][1] if t > crop_keys[-1][0] else crop_keys[0][1]

    CLIPS.mkdir(parents=True, exist_ok=True)
    out = CLIPS / f"{name}.mp4"
    proc = ffmpeg_writer(out, out_size, audio, audio_filter)
    corners = corner_mask(out_size, CORNER_PX)   # rounded corners in the slide's stage colour
    for k in range(n):
        t = k / FPS
        im = Image.open(fd / f"f{k:05d}.png").convert("RGB")
        fr = im.resize(out_size, Image.LANCZOS, box=crop_at(t))
        fr.paste(Image.new("RGB", out_size, STAGE), (0, 0), corners)
        if k == n - 1:
            fr.save(CLIPS / f"{name}_poster.png")
        if k == 0:
            fr.save(CLIPS / f"{name}_first.png")
        proc.stdin.write(fr.tobytes())
    proc.stdin.close()
    proc.wait()
    (CLIPS / f"{name}.json").write_text(json.dumps({"duration": round(n / FPS, 2)}, indent=1), encoding="utf-8")
    print(f"  -> {out} ({out.stat().st_size / 1e6:.1f} MB, {n / FPS:.1f} s)")


CORNER_PX = 30  # app clips sit on the dark slide as a light "screen" with rounded corners


def corner_mask(size, r):
    """L-mode mask, 255 outside a rounded rectangle (antialiased by 4x supersampling)."""
    from PIL import ImageDraw
    w, h = size
    big = Image.new("L", (w * 4, h * 4), 255)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), radius=r * 4, fill=0)
    return big.resize(size, Image.LANCZOS)


SHEET = (462, 62, 2360, 1426)  # the editor sheet + player bar, 2x px (aspect 1600:1150)
BARZ = (640, 360, 2143, 1440)   # zoom on the player bar (Original / Fixed)


def editor_clip(data, cfg):
    rep = data.get("replace")
    k = rep["i"] if rep else next(i for i, w in enumerate(data["words"]) if not w["cut"])
    word = f'.w[data-k="{k}"]'
    acts = [
        {"t": 1.3, "do": "click", "sel": "[data-action=view][data-view=original]"},
        {"t": 2.7, "do": "click", "sel": "[data-action=view][data-view=output]"},
        {"t": 3.8, "do": "select", "sel": word},
    ]
    moves = [
        {"t0": 0.4, "t1": 1.2, "sel": "[data-action=view][data-view=original]"},
        {"t0": 2.0, "t1": 2.6, "sel": "[data-action=view][data-view=output]"},
        {"t0": 2.9, "t1": 3.7, "sel": word, "fy": 0.6},
    ]
    t_end, audio, af = 5.6, None, None
    if rep:
        new = rep["new"]
        acts += [{"t": 4.6, "do": "click", "sel": ".pop [data-action=replace]"},
                 {"t": 4.8, "do": "type", "sel": "#popInput", "text": ""}]
        acts += [{"t": 4.95 + 0.15 * i, "do": "type", "sel": "#popInput", "text": new[:i + 1]} for i in range(len(new))]
        t_go = 4.95 + 0.15 * len(new) + 0.55
        wait = float(rep.get("sec") or 3.5)
        acts += [{"t": t_go, "do": "click", "sel": ".pop [data-action=replace-go]"},
                 {"t": t_go + wait, "do": "release", "name": "replace"}]
        moves += [{"t0": 4.0, "t1": 4.5, "sel": ".pop [data-action=replace]"},
                  {"t0": t_go - 0.5, "t1": t_go - 0.1, "sel": ".pop [data-action=replace-go]"},
                  {"t0": t_go + wait + 0.3, "t1": t_go + wait + 1.0, "sel": word, "fy": 1.0, "dy": 46, "dx": 30}]
        t_audio = t_go + wait + 0.35
        ph = cfg["replace"]["phrase"]
        WORK.mkdir(parents=True, exist_ok=True)
        y, sr = sf.read(MEDIA / "replace.wav", dtype="float32", always_2d=True)
        seg = y.mean(axis=1)[int(ph[0] * sr):int(ph[1] * sr)].copy()
        f = int(0.03 * sr)
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        sf.write(WORK / "editor_audio.wav", seg, sr)
        audio, af = WORK / "editor_audio.wav", f"adelay={int(t_audio * 1000)}:all=1"
        t_end = t_audio + (ph[1] - ph[0]) + 0.5
        meta_extra = {"replace_click": t_go, "green_at": t_go + wait, "audio_at": t_audio}
    zoom = (700, 129, 2122, 1151)
    app_clip("editor", {"start": [1000, 560], "acts": acts, "moves": moves, "slides": []}, t_end,
             [(0, SHEET), (0.35, SHEET), (1.0, BARZ), (2.9, BARZ), (3.7, zoom), (t_end, zoom)], (1600, 1150), audio, af)
    if rep:
        p = CLIPS / "editor.json"
        p.write_text(json.dumps({**json.loads(p.read_text()), **meta_extra}, indent=1), encoding="utf-8")


def tone_clip(data, cfg):
    rng = lambda tone: f".tc-range[data-tone={tone}]"
    acts = [{"t": 1.1, "do": "click", "sel": "[data-action=tone-panel]"},
            {"t": 6.4, "do": "change", "sel": rng("calm")},
            {"t": 7.0, "do": "release", "name": "restyle"}]
    slides = [{"sel": rng("confident"), "t0": 2.0, "t1": 3.2, "v0": 0, "v1": 100},
              {"sel": rng("warm"), "t0": 3.9, "t1": 5.0, "v0": 0, "v1": 100},
              {"sel": rng("calm"), "t0": 5.6, "t1": 6.3, "v0": 0, "v1": 33}]
    moves = [{"t0": 0.3, "t1": 1.0, "sel": "[data-action=tone-panel]"},
             {"t0": 1.5, "t1": 1.95, "sel": rng("confident"), "range": True},
             {"t0": 2.0, "t1": 3.25, "sel": rng("confident"), "range": True, "track": True},
             {"t0": 3.4, "t1": 3.85, "sel": rng("warm"), "range": True},
             {"t0": 3.9, "t1": 5.05, "sel": rng("warm"), "range": True, "track": True},
             {"t0": 5.15, "t1": 5.55, "sel": rng("calm"), "range": True},
             {"t0": 5.6, "t1": 6.35, "sel": rng("calm"), "range": True, "track": True},
             {"t0": 6.7, "t1": 7.3, "sel": rng("calm"), "range": True, "dy": 60}]
    tone_crop = (1112, 625, 2222, 1423)
    app_clip("tone", {"start": [900, 560], "acts": acts, "moves": moves, "slides": slides}, 8.2,
             [(0, SHEET), (1.1, SHEET), (1.8, tone_crop), (8.2, tone_crop)], (1600, 1150))


def settings_clip(data, cfg):
    """Settings > Your sound: the tone every message gets, set once."""
    rng = lambda tone: f"input[data-set-tone={tone}]"
    goto = ("document.getElementById('settingsBtn').click();"
            "const h=[...document.querySelectorAll('.section h2')].find(e=>e.textContent==='Your sound');"
            "h.closest('.section').scrollIntoView({block:'center'});")
    acts = [{"t": 0.0, "do": "js", "code": goto}]
    slides = [{"sel": rng("confident"), "t0": 1.0, "t1": 2.3, "v0": 0, "v1": 80},
              {"sel": rng("warm"), "t0": 3.1, "t1": 4.1, "v0": 0, "v1": 45}]
    moves = [{"t0": 0.2, "t1": 0.95, "sel": rng("confident"), "range": True},
             {"t0": 1.0, "t1": 2.35, "sel": rng("confident"), "range": True, "track": True},
             {"t0": 2.5, "t1": 3.05, "sel": rng("warm"), "range": True},
             {"t0": 3.1, "t1": 4.15, "sel": rng("warm"), "range": True, "track": True},
             {"t0": 4.6, "t1": 5.3, "sel": rng("warm"), "range": True, "dy": 70}]
    crop = (700, 430, 2100, 1090)
    app_clip("settings", {"start": [1500, 900], "acts": acts, "moves": moves, "slides": slides}, 6.4,
             [(0, crop), (6.4, crop)], (1600, 754))


def main():
    which = sys.argv[1:] or ["pill", "editor", "settings"]
    data = json.loads((MEDIA / "deck_data.json").read_text(encoding="utf-8"))
    cfg = json.loads((BUILD / "config.json").read_text(encoding="utf-8"))
    if "pill" in which:
        pill_clip(data, cfg)
    if "editor" in which:
        editor_clip(data, cfg)
    if "tone" in which:
        tone_clip(data, cfg)
    if "settings" in which:
        settings_clip(data, cfg)
    for d in WORK.glob("frames_*"):   # frames are only an intermediate
        shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    main()
