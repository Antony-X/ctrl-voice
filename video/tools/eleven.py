"""Minimal ElevenLabs client for the film's sound design.

The API key is read from the deck folder at runtime and is never printed,
logged or written anywhere. Every generation is appended to
assets_src/elevenlabs_log.json (prompt, parameters, output file, time) so
ASSETS.md can list the source of each sound.

  python tools/eleven.py tier
  python tools/eleven.py sfx  <out.mp3> "<prompt>" [duration_s] [prompt_influence]
  python tools/eleven.py music <out.mp3> "<prompt>" <length_ms>
"""
import datetime
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY_FILE = ROOT.parent / "deck" / ".elevenlabs_key"
LOG = ROOT / "assets_src" / "elevenlabs_log.json"
API = "https://api.elevenlabs.io"


def key():
    return KEY_FILE.read_text(encoding="utf-8").strip()


def call(method, path, body=None, timeout=300):
    req = urllib.request.Request(API + path, method=method)
    req.add_header("xi-api-key", key())
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
            return r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        # The error body never contains the key; show it so failures are debuggable.
        raise SystemExit(f"HTTP {e.code}: {e.read()[:400].decode('utf-8', 'replace')}")


def log(entry):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    items = json.loads(LOG.read_text(encoding="utf-8")) if LOG.exists() else []
    items.append({**entry, "at": datetime.datetime.now().isoformat(timespec="seconds")})
    LOG.write_text(json.dumps(items, indent=1), encoding="utf-8")
    print(f"generation #{len(items)} logged")


def main():
    cmd = sys.argv[1]
    if cmd == "tier":
        raw, _ = call("GET", "/v1/user/subscription")
        sub = json.loads(raw)
        print({k: sub.get(k) for k in ("tier", "status", "character_count", "character_limit")})
    elif cmd == "sfx":
        out, prompt = Path(sys.argv[2]), sys.argv[3]
        body = {"text": prompt, "model_id": "eleven_text_to_sound_v2"}
        if len(sys.argv) > 4:
            body["duration_seconds"] = float(sys.argv[4])
        if len(sys.argv) > 5:
            body["prompt_influence"] = float(sys.argv[5])
        audio, ctype = call("POST", "/v1/sound-generation?output_format=mp3_44100_128", body)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(audio)
        log({"kind": "sound-generation", "file": out.name, "body": body, "content_type": ctype})
        print(out, len(audio), "bytes")
    elif cmd == "music":
        out, prompt, length = Path(sys.argv[2]), sys.argv[3], int(sys.argv[4])
        body = {"prompt": prompt, "music_length_ms": length, "force_instrumental": True}
        audio, ctype = call("POST", "/v1/music?output_format=mp3_44100_128", body, timeout=600)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(audio)
        log({"kind": "music", "file": out.name, "body": body, "content_type": ctype})
        print(out, len(audio), "bytes")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
