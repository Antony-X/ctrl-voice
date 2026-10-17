# Simulates the browser: streams audio in real time over the WebSocket, presses UNDO mid-recording, keeps talking, stops.
import asyncio, json, time, numpy as np, librosa, websockets
async def main():
    A, _ = librosa.load("/workspace/data/live_A.wav", sr=24000); B, _ = librosa.load("/workspace/data/live_B.wav", sr=24000)
    async with websockets.connect("ws://localhost:7860/ws/livetest1", max_size=None) as ws:
        async def stream(x):
            for k in range(0, len(x), 2400):  # 100 ms chunks in real time
                await ws.send((np.clip(x[k:k + 2400], -1, 1) * 32767).astype(np.int16).tobytes()); await asyncio.sleep(0.1)
        async def reader():
            async for m in ws:
                m = json.loads(m)
                if m["type"] == "undone": print(f"  UNDO -> removed: {m['r']['text']!r}  ({m.get('ms')} ms)")
                elif m["type"] == "words": print("  live:", " ".join(("~~" + w["w"] + "~~") if w["x"] else w["w"] for w in m["words"])[-150:])
                elif m["type"] == "final": print("FINAL:", " ".join(("~~" + w["w"] + "~~") if w["x"] else w["w"] for w in m["words"])); return
        rd = asyncio.create_task(reader())
        await stream(A); await stream(np.zeros(12000, np.float32)); t = time.time()
        await ws.send(json.dumps(dict(type="undo"))); await stream(np.zeros(4800, np.float32))
        await stream(B); await stream(np.zeros(12000, np.float32)); await ws.send(json.dumps(dict(type="stop"))); await rd
asyncio.run(main())
