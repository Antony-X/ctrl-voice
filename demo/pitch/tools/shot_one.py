"""Screenshot given deck positions quickly: python shot_one.py 1920x1080 5.0 5.1 ... (muted, file://)."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
PITCH = Path(__file__).resolve().parent.parent
w, h = map(int, sys.argv[1].split("x"))
out = PITCH / "tools" / "shots" / "one"; out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=["--mute-audio", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": w, "height": h})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(PITCH.joinpath("index.html").as_uri())
    pg.wait_for_timeout(600)
    for pos in sys.argv[2:]:
        s, k = map(int, pos.split("."))
        pg.evaluate(f"CV.go({s - 1}, {k})")
        pg.wait_for_timeout(1600)
        pg.screenshot(path=str(out / f"{w}_s{s}_{k}.png"))
    print("errors:", errs)
    b.close()
