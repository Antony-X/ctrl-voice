"""Headless check of the deck from file:// in the system Chrome (muted: nothing plays aloud).

  python test_deck.py [--auto] [--real] [--sizes 1920x1080,1366x768]

For every slide and step (driven by real key presses): screenshot, layout check (text outside the stage, text boxes
overlapping, clipped text), and for audio steps that the clip is actually playing (currentTime moves).
Also: console errors, every clip loads with the right duration, the notes window opens and follows the deck.
--auto runs ?auto end to end in real time (about 3 minutes) and logs when each step started.
"""
import argparse
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

PITCH = Path(__file__).resolve().parent.parent
URL = PITCH.joinpath("index.html").as_uri()
SHOTS = PITCH / "tools" / "shots"

LAYOUT_JS = r"""
() => {
  const stage = document.getElementById('stage');
  const sr = stage.getBoundingClientRect(), k = sr.width / 1920;
  const slide = document.querySelector('.slide.active');
  const out = [];
  const vis = (el) => { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const shown = (el) => { for (let e = el; e && e !== stage; e = e.parentElement) if (!vis(e)) return false; return true; };
  const leaves = [];
  slide.querySelectorAll('*').forEach((el) => {
    if (el.closest('.notes') || !shown(el)) return;
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) return;
    const range = document.createRange(); range.selectNodeContents(el);
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const box = { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
      leaves.push({ el, text: el.textContent.trim().slice(0, 30), box });
      if (box.x < -1 || box.y < -1 || box.x + box.w > 1921 || box.y + box.h > 1081) out.push(`off-stage: "${el.textContent.trim().slice(0, 30)}"`);
    }
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') out.push(`clipped horizontally: "${el.textContent.trim().slice(0, 30)}"`);
    if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY === 'hidden') out.push(`clipped vertically: "${el.textContent.trim().slice(0, 30)}"`);
  });
  slide.querySelectorAll('.p-text').forEach((el) => { if (shown(el) && el.scrollHeight > el.clientHeight + 2) out.push(`transcript clipped: ${el.scrollHeight}>${el.clientHeight}`); });
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const a = leaves[i], b = leaves[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - Math.max(a.box.x, b.box.x);
    const oy = Math.min(a.box.y + a.box.h, b.box.y + b.box.h) - Math.max(a.box.y, b.box.y);
    if (ox > 3 && oy > 6) out.push(`overlap: "${a.text}" / "${b.text}" (${ox.toFixed(0)}x${oy.toFixed(0)})`);
  }
  return out;
}
"""

WAIT = {1: 5.6, 2: 2.4}            # slide -> seconds to let its moment finish before the screenshot


def run_size(p, w, h, real, log):
    b = p.chromium.launch(channel="chrome", headless=True,
                          args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
    page = ctx.new_page()
    msgs = []
    page.on("console", lambda m: msgs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: msgs.append(f"pageerror: {e}"))
    page.on("requestfailed", lambda r: msgs.append(f"requestfailed: {r.url.rsplit('/pitch/', 1)[-1]} {r.failure}"))
    page.goto(URL + ("?real" if real else ""))
    page.wait_for_timeout(800)
    tag = f"{w}x{h}{'_real' if real else ''}"
    out = SHOTS / tag
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.png"):
        f.unlink()
    report = {"size": tag, "steps": [], "console": msgs}
    n_slides = page.evaluate("CV.slides.length")
    first = True
    for s in range(1, n_slides + 1):
        steps = page.evaluate(f"CV.nSteps({s - 1})")
        for k in range(steps):
            if not first:
                page.keyboard.press("ArrowRight")
            first = False
            st = page.evaluate("CV.state()")
            assert (st["slide"], st["step"]) == (s, k), (st, s, k)
            page.wait_for_timeout(int(1000 * WAIT.get(s, 1.4)) if k == 0 else 1400)
            st = page.evaluate("CV.state()")
            rec = {"slide": s, "step": k, "clip": st["clip"], "layout": page.evaluate(LAYOUT_JS)}
            if st["clip"]:
                t0 = st["clip"]["t"]
                page.wait_for_timeout(500)
                st2 = page.evaluate("CV.state()")
                rec["playing"] = bool(st2["clip"] and st2["clip"]["t"] > t0)
            page.screenshot(path=str(out / f"s{s}_{k}.png"))
            report["steps"].append(rec)
            log(f"  {tag} slide {s} step {k}: clip={st['clip'] and st['clip']['key']} playing={rec.get('playing')} "
                f"layout={rec['layout'] or 'ok'}")
    clips = page.evaluate("""() => Object.values(CV.clips).filter(Boolean).map(c => ({key: c.key, src: c.src, ok: c.ok,
        ready: c.audio.readyState, dur: c.audio.duration, data: c.data.dur, peaks: !!c.peaks, placeholder: c.placeholder,
        timed: c.timed}))""")
    report["clips"] = clips
    ctx.close()
    b.close()
    return report


def notes_test(p, log):
    b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio"])
    ctx = b.new_context(viewport={"width": 1920, "height": 1080})
    page = ctx.new_page()
    page.goto(URL)
    page.wait_for_timeout(500)
    with ctx.expect_page() as pop:
        page.keyboard.press("s")
    notes = pop.value
    notes.wait_for_timeout(600)
    a = {"title": notes.title(), "slide": notes.inner_text("#slide"), "script": notes.inner_text("#script")[:80],
         "next": notes.inner_text("#next"), "clock": notes.inner_text("#clock")}
    for _ in range(4):
        page.keyboard.press("ArrowRight")
    page.wait_for_timeout(1500)
    bb = {"slide": notes.inner_text("#slide"), "step": notes.inner_text("#step"), "clip": notes.inner_text("#clip"),
          "script": notes.inner_text("#script")[:80], "clock": notes.inner_text("#clock"), "sclock": notes.inner_text("#sclock")}
    notes.keyboard.press("ArrowRight")                 # keys typed in the notes window drive the deck too
    page.wait_for_timeout(800)
    c = {"deck": page.evaluate("CV.state()"), "notes_slide": notes.inner_text("#slide"), "clip": notes.inner_text("#clip")}
    notes.screenshot(path=str(SHOTS / "notes_window.png"))
    # pop-up blocked fallback: N overlay
    page.keyboard.press("n")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "notes_overlay.png"))
    ov = page.evaluate("document.getElementById('notes-overlay').classList.contains('show')")
    log(f"  notes before: {a}\n  notes after 4 steps: {bb}\n  key from notes window: {c}\n  overlay shown: {ov}")
    ctx.close()
    b.close()
    return {"before": a, "after": bb, "from_notes": c, "overlay": ov}


def auto_test(p, log):
    b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio"])
    ctx = b.new_context(viewport={"width": 1920, "height": 1080})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL + "?auto")
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "auto_start.png"))
    page.mouse.click(960, 540)                          # the start gesture
    t0 = time.time()
    seen, last = [], None
    while time.time() - t0 < 300:
        st = page.evaluate("CV.state()")
        key = (st["slide"], st["step"])
        if key != last:
            seen.append({"t": round(time.time() - t0, 1), "slide": st["slide"], "step": st["step"],
                         "clip": st["clip"] and st["clip"]["key"]})
            log(f"  auto {seen[-1]}")
            last = key
        if not st["autoOn"] and len(seen) > 1:
            break
        page.wait_for_timeout(200)
    total = round(time.time() - t0, 1)
    log(f"  auto finished in {total} s, errors {errs}")
    ctx.close()
    b.close()
    return {"timeline": seen, "total": total, "errors": errs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--real", action="store_true", help="ignore the placeholder examples (shows the empty states)")
    ap.add_argument("--sizes", default="1920x1080,1366x768")
    ap.add_argument("--skip-notes", action="store_true")
    a = ap.parse_args()
    SHOTS.mkdir(parents=True, exist_ok=True)
    res = {}
    with sync_playwright() as p:
        for size in a.sizes.split(","):
            w, h = map(int, size.split("x"))
            res[size] = run_size(p, w, h, a.real, print)
        if not a.skip_notes:
            res["notes"] = notes_test(p, print)
        if a.auto:
            res["auto"] = auto_test(p, print)
    (SHOTS / "report.json").write_text(json.dumps(res, indent=1), "utf-8")
    for size in a.sizes.split(","):
        r = res[size]
        print(size, "console:", *r["console"], sep="\n  ")
        print(size, "clips:", *[json.dumps(c) for c in r["clips"]], sep="\n  ")


if __name__ == "__main__":
    main()
