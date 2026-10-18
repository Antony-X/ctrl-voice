# Streams tonight's C' recording to a test engine in real time (100 ms Int16 frames, as session.js does), sends stop,
# waits for the final, then runs the finish clean-up and prints what the sent message would say.
# usage: python e2e_client.py <port>
import asyncio, json, sys, time, urllib.request
import numpy as np, soundfile as sf, websockets
port = int(sys.argv[1]); sid = "e2e" + str(int(time.time()))[-6:]
x, sr = sf.read("/workspace/app_data/v3fvy4dk/orig.wav", dtype="float32")
assert sr == 24000, sr
pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)


async def main():
    t0 = time.time(); final = None
    async with websockets.connect(f"ws://127.0.0.1:{port}/ws/{sid}", max_size=2 ** 24) as ws:
        async def reader():
            nonlocal final
            async for m in ws:
                d = json.loads(m)
                if d["type"] == "undone": print(f"{time.time() - t0:5.2f}s UNDONE {d['r']['text']!r}")
                elif d["type"] == "final": final = d; print(f"{time.time() - t0:5.2f}s FINAL arrived ({len(d['words'])} words, {len(d['removed'])} removed)"); return
        rd = asyncio.create_task(reader())
        for k in range(0, len(pcm), 2400):
            await ws.send(pcm[k:k + 2400].tobytes()); await asyncio.sleep(0.1)
        ts = time.time(); await ws.send(json.dumps({"type": "stop"})); print(f"{ts - t0:5.2f}s stop sent")
        try: await asyncio.wait_for(rd, 10)
        except asyncio.TimeoutError: print("NO FINAL within 10 s")
    if not final: return
    print(f"stop -> final {time.time() - ts:.2f}s (incl. close)")
    req = urllib.request.Request(f"http://127.0.0.1:{port}/api/s/{sid}/clean", method="POST")
    items = json.load(urllib.request.urlopen(req, timeout=60))["items"]
    for c in items: print("  ", "CUT    " if c["auto"] else "SUGGEST", c["kind"], repr(c["text"]))
    words = final["words"]; live_cut = {k for k, w in enumerate(words) if w.get("x")}
    fin_cut = {k for c in items if c["auto"] for k in range(c["i"], c["j"] + 1)}
    print("SENT TEXT:", " ".join(w["w"] for k, w in enumerate(words) if k not in live_cut | fin_cut))
asyncio.run(main())
