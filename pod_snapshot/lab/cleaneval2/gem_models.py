# Lists the Gemini models this key can call (names only), and times one tiny call per flash model.
import json, sys, time, urllib.request
key = open("/workspace/app/.gemini_key").read().strip()
req = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", headers={"x-goog-api-key": key})
models = json.load(urllib.request.urlopen(req, timeout=20))["models"]
flash = [m["name"].split("/")[1] for m in models if "flash" in m["name"] and "generateContent" in m.get("supportedGenerationMethods", [])]
print("flash models:", ", ".join(flash))
from openai import OpenAI
c = OpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=key, timeout=20, max_retries=0)
for m in [x for x in flash if not any(s in x for s in ("tts", "image", "live", "audio", "embedding"))][:12]:
    for eff in ("none", "minimal", "low"):
        t = time.time()
        try:
            r = c.chat.completions.create(model=m, temperature=0, reasoning_effort=eff, messages=[{"role": "user", "content": "Reply with the word ok."}])
            print(f"{m:40s} {eff:8s} {time.time() - t:5.2f}s {r.choices[0].message.content!r:.30}")
        except Exception as e: print(f"{m:40s} {eff:8s} error {str(e)[:90]}")
