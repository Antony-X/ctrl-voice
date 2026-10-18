"""Generate the messy-note candidates with ElevenLabs premade voices.

Reads the key from deck/.elevenlabs_key (never printed or written anywhere else), reads the
text from deck/messy_note_script.txt, and writes deck/audio/messy_<voice>.mp3 plus
messy_<voice>.json (exact text, model, settings, characters billed). No cloning, no uploads.

Usage: python -I el_tts.py [voice ...]     (default: will jessica chris)
"""
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

DECK = pathlib.Path(__file__).resolve().parents[1]
KEY = (DECK / ".elevenlabs_key").read_text().strip()
API = "https://api.elevenlabs.io"
VOICES = {
    "will": ("bIHbv24MWmeRgasZH58o", "Will (premade, male, young, chill, conversational)"),
    "jessica": ("cgSgspJ2msm6clMCkdW9", "Jessica (premade, female, young, conversational)"),
    "chris": ("iP95p4xoKVk53GoZ742B", "Chris (premade, male, casual, conversational)"),
    "laura": ("FGY2WhTYpPnrIDTdsKH5", "Laura (premade, female, young, quirky)"),
}
SEED = 1207
STABILITY = 0.5            # v3 "Natural"
FORMAT = "mp3_44100_128"


def script_text():
    lines = (DECK / "messy_note_script.txt").read_text(encoding="utf-8").splitlines()
    i = next(k for k, l in enumerate(lines) if l.startswith("Text sent to the API"))
    return next(l for l in lines[i + 1:] if l.strip()).strip()


def request(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read(), dict(r.headers)


def used_chars():
    raw, _ = request("GET", "/v1/user/subscription")
    s = json.loads(raw)
    return s["character_count"], s["character_limit"]


def tts(voice_id, text, model):
    body = {"text": text, "model_id": model, "seed": SEED, "voice_settings": {"stability": STABILITY}}
    if model != "eleven_v3":
        body["voice_settings"].update(similarity_boost=0.75, style=0.3, use_speaker_boost=True)
    return request("POST", f"/v1/text-to-speech/{voice_id}?output_format={FORMAT}", body)


def main():
    names = sys.argv[1:] or ["will", "jessica", "chris"]
    text = script_text()
    before, limit = used_chars()
    print(f"characters used before: {before}/{limit}; text is {len(text)} characters")
    for name in names:
        vid, desc = VOICES[name]
        model, sent = "eleven_v3", text
        try:
            audio, hdr = tts(vid, sent, model)
        except urllib.error.HTTPError as e:
            print(f"{name}: eleven_v3 refused ({e.code}): {e.read()[:300]!r}; falling back to eleven_multilingual_v2")
            model, sent = "eleven_multilingual_v2", re.sub(r"\s*\[[^\]]+\]\s*", " ", text).replace("  ", " ")
            audio, hdr = tts(vid, sent, model)
        out = DECK / "audio" / f"messy_{name}.mp3"
        out.write_bytes(audio)
        meta = {"voice": desc, "voice_id": vid, "model_id": model, "seed": SEED, "stability": STABILITY,
                "output_format": FORMAT, "text": sent, "text_characters": len(sent),
                "billed_characters_header": hdr.get("character-cost") or hdr.get("Character-Cost"),
                "request_id": hdr.get("request-id") or hdr.get("Request-Id")}
        (DECK / "audio" / f"messy_{name}.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
        print(f"{name}: {model}, {len(audio)} bytes -> {out.name}, character-cost header {meta['billed_characters_header']}")
    after, _ = used_chars()
    print(f"characters used after: {after}/{limit} (this run: {after - before})")


if __name__ == "__main__":
    main()
