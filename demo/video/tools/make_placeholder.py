"""Builds source/placeholder/ (the film's stand-in message) from the copied e2e run.

source/message/ holds an untouched copy of the newest e2e message
(mvdbdp3fo7y1: .json, .wav original, .edit.wav final render, .take.wav tone take).
That run auto-fixed the message (4 cuts, 18.36 s -> 10.643 s, measured) and then tried
editor features on it, so its final render says "Thursday" and has a re-said "cafe" and
a tone change. The film shows the auto-fix only, so this writes:

  source/placeholder/message.json   the same message with only its 4 cut ops
  source/placeholder/original.wav   the original recording (copy)
  source/placeholder/fixed.wav      the auto-fix render, rebuilt by revert_word_edits.py
                                    and length-matched to the measured 10.643 s

  python tools/make_placeholder.py
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "source" / "message"
OUT = ROOT / "source" / "placeholder"
MID = "mvdbdp3fo7y1"
AUTOFIX_DUR = 10.643  # e2e log: "stored message ... outDur 10.64", editor "out": 10.643416666666667


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    msg = json.loads((SRC / f"{MID}.json").read_text(encoding="utf-8"))
    subprocess.run([sys.executable, str(ROOT / "tools" / "revert_word_edits.py"), str(SRC / f"{MID}.json"),
                    str(SRC / f"{MID}.wav"), str(SRC / f"{MID}.edit.wav"), str(OUT / "fixed.wav"),
                    str(AUTOFIX_DUR)], check=True)
    shutil.copyfile(SRC / f"{MID}.wav", OUT / "original.wav")
    msg["ops"] = [o for o in msg["ops"] if o.get("type") == "cut"]
    msg["output"] = {"dur": AUTOFIX_DUR, "ai": []}
    msg["title"] = "Hey, Maya! So, about this weekend, I'll"   # the app's title after the auto-fix (e2e log)
    msg.pop("take", None)
    msg["_placeholder"] = ("e2e test message (voice may be synthetic). ops filtered to the 4 auto-fix cuts; "
                           "fixed.wav rebuilt from the final render with the three word edits reverted.")
    (OUT / "message.json").write_text(json.dumps(msg, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
