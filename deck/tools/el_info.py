"""Read-only ElevenLabs queries: subscription, models, premade voices. Never prints the key."""
import json, pathlib, urllib.request
KEY = pathlib.Path(__file__).resolve().parents[1].joinpath(".elevenlabs_key").read_text().strip()
def get(path):
    req = urllib.request.Request("https://api.elevenlabs.io" + path, headers={"xi-api-key": KEY})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)
sub = get("/v1/user/subscription")
print("tier", sub.get("tier"), "chars", sub.get("character_count"), "/", sub.get("character_limit"),
      "ivc", sub.get("can_use_instant_voice_cloning"), "voice_limit", sub.get("voice_limit"))
for m in get("/v1/models"):
    print("model", m["model_id"], "| tts", m.get("can_do_text_to_speech"), "| max_chars", m.get("maximum_text_length_per_request"),
          "| free_ok", m.get("can_be_finetuned"), m.get("requires_alpha_access"))
v = get("/v2/voices?page_size=100&category=premade")
for x in v.get("voices", []):
    l = x.get("labels", {})
    print("voice", x["voice_id"], x["name"], "|", l.get("gender"), l.get("age"), l.get("accent"), l.get("descriptive") or l.get("description"), l.get("use_case"))
