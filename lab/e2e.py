# End-to-end API test: upload -> clean -> render -> replace -> render.
import requests, time, json, sys
B = "http://localhost:7860"; f = sys.argv[1] if len(sys.argv) > 1 else "/workspace/data/demo_msg.wav"
t = time.time(); r = requests.post(f"{B}/api/upload", files={"f": open(f, "rb")}).json(); sid = r["sid"]
W = r["words"]; print(f"upload+ASR {time.time()-t:.1f}s:", " ".join(w["w"] for w in W))
t = time.time(); c = requests.post(f"{B}/api/s/{sid}/clean").json()["items"]; print(f"clean {time.time()-t:.2f}s")
for x in c: print("   ", x["kind"], x["auto"], "|", x["text"], f"[{x['t0']:.2f}-{x['t1']:.2f}]")
ops = [dict(t0=x["t0"], t1=x["t1"]) for x in c if x["auto"]]
t = time.time(); y = requests.post(f"{B}/api/s/{sid}/render", json=dict(ops=ops)).json(); print(f"render {time.time()-t:.2f}s", y)
k = next(k for k, w in enumerate(W) if w["w"].lower().startswith("cafe") or w["w"].lower().startswith("café"))
t = time.time(); rp = requests.post(f"{B}/api/s/{sid}/replace", json=dict(i=k, j=k, new="park")).json()
print(f"replace {time.time()-t:.2f}s", json.dumps(rp["op"])[:300]); [print("   ", c_) for c_ in rp["cands"]]
ops.append(dict(t0=rp["op"]["t0"], t1=rp["op"]["t1"], insert=rp["op"]["insert"]))
y = requests.post(f"{B}/api/s/{sid}/render", json=dict(ops=ops)).json(); print("final", y)
print("SID", sid)
