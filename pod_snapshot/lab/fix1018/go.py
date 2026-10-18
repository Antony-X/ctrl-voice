import json, re, httpx, shutil
API = "http://127.0.0.1:7860"; cl = httpx.Client(timeout=600); norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
def up(p): return cl.post(f"{API}/api/upload", files={"f": (p, open(p, "rb"), "audio/wav")}).json()
# slide 4
u = up("clean_before.wav"); sid, W = u["sid"], u["words"]; k = lambda w: next(n for n, x in enumerate(W) if norm(x["w"]) == w)
ops = [dict(t0=1.061, t1=1.992), dict(t0=5.846, t1=7.147), dict(t0=9.269, t1=15.885)]; rep = {}
for old, new in (("pacific", "specific"), ("mute", "moot")):
    best = None
    for seed in (0, 7, 14):
        r = cl.post(f"{API}/api/s/{sid}/replace", json=dict(i=k(old), j=k(old), new=new, kind="misspoken", seed=seed, rounds=1)).json()
        for c in r.get("cands", []):
            if c.get("ok") and (best is None or c["margin"] > best[0]["margin"]): best = (c, r["op"])
        print(old, seed, [(c["engine"], c.get("ok"), c.get("margin")) for c in r.get("cands", [])], flush=True)
        if best and best[0]["margin"] > 5: break
    rep[old] = best; ops.append(dict(t0=best[1]["t0"], t1=best[1]["t1"], insert=best[0]["id"]))
out = cl.post(f"{API}/api/s/{sid}/render", json=dict(ops=ops)).json(); p = f"/workspace/app_data/{sid}/" + out["url"].rsplit("/", 1)[1]
shutil.copy(p, "clean_after.wav"); aw = up("clean_after.wav")["words"]
json.dump(dict(sid=sid, ops=ops, render=out, words=[dict(w=w["w"], s=w["s"], e=w["e"]) for w in aw], rep={k_: dict(c=v[0], op=v[1]) for k_, v in rep.items()}), open("clean.json", "w"), indent=1)
print("CLEAN after:", " ".join(w["w"] for w in aw), out["ai"], out["dur"], flush=True)
# slide 6
u = up("tone_before.wav"); sid = u["sid"]; f = cl.post(f"{API}/api/s/{sid}/render", json=dict(ops=[])).json()["url"].rsplit("/", 1)[1]
n = cl.post(f"{API}/api/s/{sid}/natural", json=dict(style="confident", mix={"confident": 1.5}, file=f)).json(); print("natural:", n, flush=True)
shutil.copy(f"/workspace/app_data/{sid}/" + n["url"].rsplit("/", 1)[1], "tone_after.wav"); aw = up("tone_after.wav")["words"]
json.dump(dict(sid=sid, natural=n, words=[dict(w=w["w"], s=w["s"], e=w["e"]) for w in aw]), open("tone.json", "w"), indent=1)
print("TONE after:", " ".join(w["w"] for w in aw), n.get("dur"), flush=True)
