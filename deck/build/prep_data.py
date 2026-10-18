"""Turns one engine run (the message JSON + messy/fixed audio) into media/deck_data.json.

deck_data.json drives every slide and clip that shows the voice note: transcript, which
words were cut and why, waveform bars, durations, the live-caption timeline for the
recording-bar clip, and the word replacement for the editor clip.

Input, in media/ (see SWAP.md):
  message.json   a Ctrl+Voice message (%APPDATA%/Ctrl+Voice/messages/<id>.json), or
  sample.json    the scratchpad engine run (sample/make.js); used when message.json is absent
  messy.wav      the recording as spoken
  fixed.wav      what Ctrl+Voice sent (engine render of the cuts)
  replace.json   optional: an engine /replace result {op: {i, j, old, new, engine, verified, t0, t1}, sec}
  replace.wav    optional: the engine render with that replacement

Usage: python prep_data.py [media_dir]
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

MEDIA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "media"
BAR_SEC = 0.075          # one waveform bar per 75 ms of audio (slides)
LEVEL_SEC = 0.05         # one level per 50 ms (the recording bar's own meter rate)

KIND_LABEL = {
    "filler": "filler",
    "correction": "correction",
    "repetition": "repeat",
    "repeat": "repeat",
    "restart": "false start",
    "false_start": "false start",
    "command": "taken back",
    "undo": "taken back",
}
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())


def load_audio(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    return x.mean(axis=1), sr


def rms_db(x, sr, hop_sec):
    hop = int(sr * hop_sec)
    n = int(np.ceil(len(x) / hop))
    rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    return 20 * np.log10(rms + 1e-9)


def bars(x, sr):
    db = rms_db(x, sr, BAR_SEC)
    lo, hi = np.percentile(db, 8), np.percentile(db, 99)
    return (np.clip((db - lo) / max(hi - lo, 1e-6), 0, 1) ** 1.3).round(3).tolist()


def meter(x, sr):
    """Level per 50 ms scaled like the bar's meter (session.js: dB over a noise floor, 0..1)."""
    db = rms_db(x, sr, LEVEL_SEC)
    floor = np.percentile(db, 5)
    return np.clip((db - floor - 6) / 36, 0, 1).round(3).tolist()


def word_range(op, words):
    """Words a cut covers, by word midpoint (like Edits.rangeOf)."""
    ks = [k for k, w in enumerate(words) if op["t0"] <= (w["s"] + w["e"]) / 2 <= op["t1"]]
    return (ks[0], ks[-1]) if ks else None


def title_for(words, cuts):
    """The app's titleFor: first 7 kept words, trailing punctuation off."""
    kept = [w["w"] for k, w in enumerate(words) if not any(c["i"] <= k <= c["j"] for c in cuts)]
    return re.sub(r"[,;:.!?]+$", "", " ".join(" ".join(kept).split()[:7])) or "Voice message"


def export_name(title):
    """The app's writeExport file name for a title."""
    return (re.sub(r"[^\w\s.,'-]+", "", title).strip()[:60] or "voice message") + ".wav"


def main():
    src = MEDIA / "message.json"
    if not src.exists():
        src = MEDIA / "sample.json"
    msg = json.loads(src.read_text(encoding="utf-8"))
    words = [{"w": w["w"], "s": float(w["s"]), "e": float(w["e"])} for w in msg["words"]]

    cut_ops = [o for o in msg.get("ops", []) if o.get("type") == "cut" and o.get("on")]
    if not cut_ops:  # older sample files: the /clean items
        cut_ops = [dict(c, type="cut", on=True) for c in msg.get("clean", []) if c.get("auto", True)]
    cuts = []
    for o in sorted(cut_ops, key=lambda o: o["t0"]):
        r = word_range(o, words)
        if not r:
            continue
        cuts.append({"i": r[0], "j": r[1], "kind": o.get("kind", "cut"), "label": KIND_LABEL.get(o.get("kind"), "cut"),
                     "text": " ".join(w["w"] for w in words[r[0]:r[1] + 1]), "t0": o["t0"], "t1": o["t1"]})
    cut_of = {k: c for c in cuts for k in range(c["i"], c["j"] + 1)}

    x, sr = load_audio(MEDIA / "messy.wav")
    fx, fsr = load_audio(MEDIA / "fixed.wav")
    dur, fixed_dur = len(x) / sr, len(fx) / fsr
    bar_lv = bars(x, sr)
    bar_list = [{"lv": lv, "cut": any(c["t0"] <= (b + 0.5) * BAR_SEC <= c["t1"] for c in cuts)}
                for b, lv in enumerate(bar_lv)]

    # Live strike for the recording-bar clip. A real live removal (undo key / spoken "scratch that")
    # is in msg["removed"]. Without one, a "command" cut that ends in "scratch that" stands in for it:
    # the live detector needs ~0.5 s of silence after the phrase, so the clip adds a pause if the
    # recording has none (documented on the slide notes).
    live = None
    removed = msg.get("removed") or []
    if removed:
        r = removed[-1]
        rng = word_range(r, words)
        if rng:
            live = {"i": rng[0], "j": rng[1], "t0": r["t0"], "t1": r["t1"], "kind": r.get("kind", "undo"),
                    "source": "live removal recorded by the app", "pause_insert": None}
    if live is None:
        for c in cuts:
            tail = [norm(w["w"]) for w in words[max(c["i"], c["j"] - 1):c["j"] + 1]]
            if c["kind"] == "command" and tail == ["scratch", "that"]:
                end = words[c["j"]]["e"]
                nxt = words[c["j"] + 1]["s"] if c["j"] + 1 < len(words) else dur
                gap = nxt - end
                ins = None if gap >= 0.6 else {"at": round(end + gap / 2, 3), "sec": round(1.0 - gap, 3)}
                live = {"i": c["i"], "j": c["j"], "t0": c["t0"], "t1": c["t1"], "kind": "command",
                        "source": "clean pass 'command' cut, replayed as a live scratch-that", "pause_insert": ins}
                break

    replace = None
    rj, rw = MEDIA / "replace.json", MEDIA / "replace.wav"
    if rj.exists() and rw.exists():
        rep = json.loads(rj.read_text(encoding="utf-8"))
        op = rep["op"]
        replace = {"i": op["i"], "j": op["j"], "old": op["old"], "new": op["new"], "engine": op.get("engine"),
                   "verified": bool(op.get("verified")), "t0": op["t0"], "t1": op["t1"], "sec": rep.get("sec"),
                   "insert": op.get("insert")}
        said = " ".join(w["w"] for w in words[op["i"]:op["j"] + 1]) if op["j"] < len(words) else None
        if said != op["old"]:
            print(f"WARNING: media/replace.json replaces {op['old']!r} but words {op['i']}..{op['j']} of this message are "
                  f"{said!r}; it belongs to another recording, so the editor clip will have no replacement.")
            replace = None

    data = {
        "source_file": src.name,
        "sid": msg.get("sid"),
        "duration": round(dur, 2),
        "fixed_duration": round(fixed_dur, 2),
        "bar_sec": BAR_SEC,
        "level_sec": LEVEL_SEC,
        "words": [{**w, "cut": k in cut_of, "kind": cut_of[k]["kind"] if k in cut_of else None}
                  for k, w in enumerate(words)],
        "cuts": cuts,
        "bars": bar_list,
        "levels": meter(x, sr),
        "live_strike": live,
        "replace": replace,
        "title": title_for(words, cuts),                 # the app re-titles after the fix
        "export_name": export_name(title_for(words, cuts)),
        "kept_text": " ".join(w["w"] for k, w in enumerate(words) if k not in cut_of),
    }
    out = MEDIA / "deck_data.json"
    out.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{out} from {src.name}: {dur:.2f}s -> {fixed_dur:.2f}s, {len(bar_list)} bars, {len(cuts)} cuts")
    print("cuts:", "; ".join(f"{c['label']}: {c['text']}" for c in cuts))
    print("kept:", data["kept_text"])
    print("live strike:", live and f"{live['kind']} words {live['i']}-{live['j']}, pause insert {live['pause_insert']}")
    print("replace:", replace and f"{replace['old']} -> {replace['new']} ({replace['engine']}, verified={replace['verified']})")
    print("export name:", data["export_name"])


if __name__ == "__main__":
    main()
