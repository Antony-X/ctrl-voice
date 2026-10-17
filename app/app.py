# ReSpeak demo server: live transcript + semantic undo while recording, cut-only cleanup, AI word replacement, tone takes.
import asyncio, json, os, re, sys, time, uuid
import numpy as np, soundfile as sf, librosa, torch, httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
sys.path.insert(0, "/workspace/app"); sys.path.insert(0, "/workspace/lab")
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
from brain import clean, last_thought, spoken_command, grammar, tighten, intent, norm
from render import render, gap_edges, quiet
from align import align, emissions
from prosody import restyle, PRESETS
import pickle
from pron import score as pscore, features as pfeat, phones as g2p, levenshtein
PRON = pickle.load(open("/workspace/app/pron_model.pkl", "rb"))  # trained on speechocean762 expert word-accuracy labels
FUNC = set("a an the of to in on at is it i you he she we they and or but be am are was were do does did my your his her its our their this that for with as by from not so if me us".split())

SR = 24000; DATA = "/workspace/app_data"; os.makedirs(DATA, exist_ok=True)
ENGINES = {k: int(v) for k, v in (e.split(":") for e in os.environ.get("ENGINES", "playdiff:8101,f5:8103,auk:8102,dots:8104").split(","))}
FAST = [e for e in os.environ.get("FAST_ENGINES", "playdiff,f5").split(",") if e in ENGINES]
PROMPT = "Umm, so, uh, I was like, you know, thinking... Hmm, okay, I mean, no wait, actually."
asr = WhisperModel(os.environ.get("ASR", "large-v3-turbo"), device="cuda", compute_type="float16")
spk = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb", savedir="/workspace/hf/ecapa", run_opts={"device": "cuda"})
GPU = asyncio.Lock()
app = FastAPI()


def transcribe(x, beam=1):
    x16 = librosa.resample(x, orig_sr=SR, target_sr=16000) if len(x) else x
    if len(x16) < 8000: return []
    segs, _ = asr.transcribe(x16, language="en", word_timestamps=True, initial_prompt=PROMPT, beam_size=beam, condition_on_previous_text=False)
    ws = [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3), p=round(w.probability, 2)) for s in segs for w in s.words if w.word.strip()]
    al = align(x16, [w["w"] for w in ws]) if ws else []  # CTC forced alignment: whisper's own word times are off by 0.1-0.4 s
    return [dict(w, s=round(a[0], 3), e=round(a[1], 3)) if a else w for w, a in zip(ws, al)]


def pron_pred(x, sr, words):
    """Predicted expert word-accuracy (0-10) per word + phone diagnosis."""
    x16 = librosa.resample(x, orig_sr=sr, target_sr=16000) if sr != 16000 else x
    sc = pscore(x16, [w["w"] for w in words])
    return [None if o is None else float(PRON["reg"].predict([pfeat(o, PRON["stats"])])[0]) for o in sc], sc


def embed(x, sr):
    x16 = librosa.resample(x, orig_sr=sr, target_sr=16000)
    return torch.nn.functional.normalize(spk.encode_batch(torch.tensor(x16)[None].float().cuda())[0, 0], dim=0)


class Session:
    def __init__(self, sid):
        self.sid, self.dir = sid, f"{DATA}/{sid}"; os.makedirs(self.dir, exist_ok=True)
        self.chunks, self.x, self.words, self.removed, self.redo = [], np.zeros(0, np.float32), [], [], []
        self.inserts, self.n_asr = {}, 0
    def audio(self):
        if self.chunks: self.x = np.concatenate([self.x] + self.chunks); self.chunks = []
        return self.x
    def flags(self):
        """per word: removal kind (time-based, so it survives re-transcription) or None."""
        out = []
        for w in self.words:
            m = (w["s"] + w["e"]) / 2; out.append(next((r["kind"] for r in self.removed if r["t0"] <= m <= r["t1"]), None))
        return out
    def active(self):
        return [w for w, f in zip(self.words, self.flags()) if f is None]
    def state(self, typ="words"):
        return dict(type=typ, words=[dict(w, x=f) for w, f in zip(self.words, self.flags())], removed=self.removed, dur=len(self.x) / SR)
    def save(self): sf.write(f"{self.dir}/orig.wav", self.audio(), SR)


S = {}
def get(sid):
    if sid not in S:
        if not os.path.exists(f"{DATA}/{sid}/orig.wav"): raise HTTPException(404)
        s = Session(sid); s.x, _ = librosa.load(f"{DATA}/{sid}/orig.wav", sr=SR); s.words = json.load(open(f"{DATA}/{sid}/words.json")); S[sid] = s
    return S[sid]


async def refresh(s, beam=1):
    async with GPU: s.words = await asyncio.to_thread(transcribe, s.audio().copy(), beam)


def cut_range(words, k, end):
    L = (words[k - 1]["e"] + words[k]["s"]) / 2 if k > 0 else max(0.0, words[k]["s"] - 0.05)
    return L, end


async def do_undo(s, kind="undo"):
    act = s.active()
    if not act: return None
    k = await asyncio.to_thread(last_thought, act)
    t0, t1 = cut_range(act, k, len(s.audio()) / SR)  # up to the moment UNDO was pressed; speech after it is kept
    r = dict(t0=round(t0, 3), t1=round(t1, 3), kind=kind, text=" ".join(w["w"] for w in act[k:]))
    s.removed.append(r); s.redo = []; return r


@app.websocket("/ws/{sid}")
async def ws(sock: WebSocket, sid: str):
    await sock.accept(); s = S[sid] = Session(sid); busy = False; last_cmd = 0

    async def live():
        nonlocal busy, last_cmd
        while True:
            await asyncio.sleep(0.7)
            if busy or (not s.chunks): continue
            busy = True
            try:
                await refresh(s)
                act = s.active()  # spoken "scratch that": apply once the speaker paused after it
                if act and act[-1]["e"] > last_cmd and len(s.x) / SR - act[-1]["e"] > 0.5:
                    hit = await asyncio.to_thread(spoken_command, act)
                    if hit:
                        k, _ = hit; t0, t1 = cut_range(act, k, act[-1]["e"] + 0.15); last_cmd = act[-1]["e"]
                        r = dict(t0=round(t0, 3), t1=round(t1, 3), kind="command", text=" ".join(w["w"] for w in act[k:]))
                        s.removed.append(r); await sock.send_json(dict(type="undone", r=r))
                await sock.send_json(s.state())
            finally: busy = False

    task = asyncio.create_task(live())
    try:
        while True:
            m = await sock.receive()
            if m.get("bytes") is not None:
                s.chunks.append(np.frombuffer(m["bytes"], np.int16).astype(np.float32) / 32768)
            elif m.get("text"):
                cmd = json.loads(m["text"]); t = time.time()
                if cmd["type"] == "undo":
                    while busy: await asyncio.sleep(0.02)
                    busy = True
                    try: await refresh(s); r = await do_undo(s)
                    finally: busy = False
                    await sock.send_json(dict(type="undone", r=r, ms=int((time.time() - t) * 1000))); await sock.send_json(s.state())
                elif cmd["type"] == "redo" and s.removed:
                    s.redo.append(s.removed.pop()); await sock.send_json(s.state())
                elif cmd["type"] == "stop":
                    task.cancel()
                    while busy: await asyncio.sleep(0.02)
                    await refresh(s, beam=5); s.save(); json.dump(s.words, open(f"{s.dir}/words.json", "w"))
                    await sock.send_json(s.state("final")); break
            elif m.get("type") == "websocket.disconnect": break
    except WebSocketDisconnect: pass
    finally: task.cancel()


@app.post("/api/sample")
async def sample():
    sid = uuid.uuid4().hex[:8]; s = S[sid] = Session(sid); s.x, _ = librosa.load(os.environ.get("SAMPLE", "/workspace/data/demo_msg.wav"), sr=SR); s.save()
    await refresh(s, beam=5); json.dump(s.words, open(f"{s.dir}/words.json", "w")); return dict(sid=sid, **s.state("final"))


@app.post("/api/upload")
async def upload(f: UploadFile = File(...)):
    sid = uuid.uuid4().hex[:8]; s = S[sid] = Session(sid); p = f"{s.dir}/upload_{f.filename}"
    open(p, "wb").write(await f.read()); s.x, _ = librosa.load(p, sr=SR, mono=True); s.save()
    await refresh(s, beam=5); json.dump(s.words, open(f"{s.dir}/words.json", "w")); return dict(sid=sid, **s.state("final"))


def word_cuts(words, items):
    out = []
    for c in items:
        L, R = gap_edges(words, c["i"], c["j"], words[-1]["e"] + 1)
        out.append(dict(c, t0=round(L, 3), t1=round(R, 3)))
    return out


@app.post("/api/s/{sid}/clean")
async def api_clean(sid: str):
    s = get(sid); idx = [k for k, f in enumerate(s.flags()) if f is None]; act = [s.words[k] for k in idx]
    res = await asyncio.to_thread(clean, act)
    for c in res: c["i"], c["j"] = idx[c["i"]], idx[c["j"]]
    return dict(items=word_cuts(s.words, res))


@app.post("/api/s/{sid}/tighten")
async def api_tighten(sid: str):
    s = get(sid); idx = [k for k, f in enumerate(s.flags()) if f is None]; act = [s.words[k] for k in idx]
    res = await asyncio.to_thread(tighten, act)
    for c in res: c["i"], c["j"] = idx[c["i"]], idx[c["j"]]
    return dict(items=word_cuts(s.words, res))


@app.post("/api/s/{sid}/grammar")
async def api_grammar(sid: str):
    s = get(sid); idx = [k for k, f in enumerate(s.flags()) if f is None]; act = [s.words[k] for k in idx]
    res = await asyncio.to_thread(grammar, act)
    for c in res: c["i"], c["j"] = idx[c["i"]], idx[c["j"]]
    return dict(items=res)


def window(words, i, j, dur, ctx=4.0):
    a, b = i, j
    while a > 0 and words[i]["s"] - words[a - 1]["s"] < ctx: a -= 1
    while b + 1 < len(words) and words[b + 1]["e"] - words[j]["e"] < ctx: b += 1
    L = (words[a - 1]["e"] + words[a]["s"]) / 2 if a > 0 else 0.0
    R = (words[b]["e"] + words[b + 1]["s"]) / 2 if b + 1 < len(words) else dur
    return a, b, L, R


def extract(g16, gsr_audio, gsr, tw, ni, nj):
    """Locate the regenerated phrase (words ni..nj of target window text tw) in a model output by forced alignment."""
    al = align(g16, [w["w"] for w in tw])
    if not all(al[ni:nj + 1]): return None
    t = [dict(w=w["w"], s=a[0], e=a[1]) if a else None for w, a in zip(tw, al)]
    L = (t[ni - 1]["e"] + t[ni]["s"]) / 2 if ni > 0 and t[ni - 1] else max(0, t[ni]["s"] - 0.04)
    R = (t[nj]["e"] + t[nj + 1]["s"]) / 2 if nj + 1 < len(t) and t[nj + 1] else min(len(g16) / 16000, t[nj]["e"] + 0.04)
    L, R = quiet(gsr_audio, gsr, L), quiet(gsr_audio, gsr, R)
    return gsr_audio[int(L * gsr):int(R * gsr)]


@app.post("/api/s/{sid}/replace")
async def api_replace(sid: str, r: dict):
    s = get(sid); W = s.words; i, j = r["i"], r["j"]; x = s.audio(); dur = len(x) / SR; t = time.time(); same = bool(r.get("same"))
    new = " ".join(re.sub(r"[.,!?;:]+$", "", w["w"]) for w in W[i:j + 1]) if same else r["new"].strip()
    a, b, L, R = window(W, i, j, dur)
    win = x[int(L * SR):int(R * SR)]; wp = f"{s.dir}/win_{uuid.uuid4().hex[:6]}.wav"; sf.write(wp, win, SR)
    ww = [dict(w=w["w"], s=round(w["s"] - L, 3), e=round(w["e"] - L, 3)) for w in W[a:b + 1]]; wi, wj = i - a, j - a
    tail = re.sub(r"^.*?([.,!?;:]*)$", r"\1", W[j]["w"]); nw = new.split(); nw[-1] += tail
    tw = [dict(w=w["w"]) for w in ww[:wi]] + [dict(w=x_) for x_ in nw] + [dict(w=w["w"]) for w in ww[wj + 1:]]
    rate = sum(len(norm(w["w"])) for w in W) / max(1e-3, sum(w["e"] - w["s"] for w in W))  # chars/sec of this speaker
    req = dict(path=wp, words=ww, i=wi, j=wj, old=" ".join(w["w"] for w in ww[wi:wj + 1]).strip(".,!?;:"), new=new,
               text=" ".join(w["w"] for w in ww), new_text=" ".join(w["w"] for w in tw), new_dur=max(0.25, len(norm(new.replace(" ", ""))) / rate + 0.08 * (len(nw) - 1)), same=same)
    if same: req["new_dur"] = W[j]["e"] - W[i]["s"]
    engines = [r["engine"]] if r.get("engine") in ENGINES else FAST
    ctx = np.concatenate([x[max(0, int((L - 2) * SR)):int(W[i]["s"] * SR)], x[int(W[j]["e"] * SR):int((R + 2) * SR)]])
    e0 = embed(ctx, SR); cands = []
    for rnd in range(int(r.get("rounds", 3))):  # retry with new seeds until the recognizer hears the new words
        if any(c.get("ok") for c in cands): break
        async with httpx.AsyncClient(timeout=120) as cl:
            outs = await asyncio.gather(*[cl.post(f"http://127.0.0.1:{ENGINES[e]}/edit", json=dict(req, seed=r.get("seed", 0) + rnd)) for e in engines], return_exceptions=True)
        await score_cands(s, engines, outs, cands, tw, wi, nw, win, W, i, j, L, dur, new, e0, same, ctx)
    good = sorted([c for c in cands if c.get("ok")], key=lambda c: -c["sim"]) or sorted([c for c in cands if c.get("id")], key=lambda c: -c["sim"])
    if not good: raise HTTPException(500, f"all engines failed: {cands}")
    oL, oR = gap_edges(W, i, j, dur)
    return dict(op=dict(t0=round(oL, 3), t1=round(oR, 3), insert=good[0]["id"], i=i, j=j, old=" ".join(w["w"] for w in W[i:j + 1]), new=new,
                        engine=good[0]["engine"], verified=good[0]["ok"], kind="pronunciation" if same else r.get("kind", "replace"), after=good[0].get("after")), cands=cands, sec=round(time.time() - t, 2))


async def score_cands(s, engines, outs, cands, tw, wi, nw, win, W, i, j, L, dur, new, e0, same, ctx):
    wj = wi + len(nw) - 1
    async with GPU:
        for e, o in zip(engines, outs):
            if isinstance(o, Exception) or o.status_code != 200: cands.append(dict(engine=e, ok=False, err=str(o)[:200])); continue
            o = o.json(); g, gsr = sf.read(o["path"], dtype="float32"); g = g.mean(1) if g.ndim > 1 else g
            g16 = librosa.resample(g, orig_sr=gsr, target_sr=16000)
            seg = await asyncio.to_thread(extract, g16, g, gsr, tw, wi, wi + len(nw) - 1)
            if seg is None or len(seg) < 0.1 * gsr: cands.append(dict(engine=e, ok=False, err="phrase not found")); continue
            seg = librosa.resample(seg, orig_sr=gsr, target_sr=SR)
            rms = lambda v: float(np.sqrt(np.mean(v ** 2) + 1e-12)); seg = seg * min(3.0, rms(ctx) / rms(seg))
            # verify: transcribe the spliced window and check the new words are actually there
            oL, oR = gap_edges(W, i, j, dur); test, _ = render(win, SR, [dict(t0=oL - L, t1=oR - L, insert=seg)])
            heard = " ".join(w["w"] for w in await asyncio.to_thread(transcribe, test, 1))
            ok = norm(new.replace(" ", "")) in norm(heard.replace(" ", ""))
            sim = float(embed(seg, SR) @ e0) if len(seg) > 0.3 * SR else 0.5
            if same:  # pronunciation fix: re-score the regenerated word(s) with the mispronunciation detector
                tws = [dict(w=w["w"]) for w in tw]; al = align(librosa.resample(test, orig_sr=SR, target_sr=16000), [w["w"] for w in tws])
                pa, _ = await asyncio.to_thread(pron_pred, test, SR, [dict(w=w["w"]) for w in tws]) if all(al) else ([None] * len(tws), None)
                after = min([p for p in pa[wi:wj + 1] if p is not None], default=0.0); sim = after / 10 + (0.5 if ok else 0)
            iid = uuid.uuid4().hex[:8]; np.save(f"{s.dir}/ins_{iid}.npy", seg); s.inserts[iid] = seg
            cands.append(dict(engine=e, ok=ok, sim=round(sim, 3), heard=heard, id=iid, sec=round(o["sec"], 2), **({"after": round(after, 2)} if same else {})))


@app.post("/api/s/{sid}/intent")
async def api_intent(sid: str):
    """Words the recognizer probably mis-heard because of pronunciation -> intended words (kept only if they sound alike)."""
    s = get(sid); idx = [k for k, f in enumerate(s.flags()) if f is None]; act = [s.words[k] for k in idx]
    res = await asyncio.to_thread(intent, act); out = []
    for c in res:
        a = sum((g2p(w) for w in c["old"].split()), []); b = sum((g2p(w) for w in c["new"].split()), [])
        d = levenshtein(a, b) / max(1, len(b))
        if d <= 0.6: out.append(dict(c, i=idx[c["i"]], j=idx[c["j"]], heard="".join(a), intended="".join(b), dist=round(d, 2)))
    return dict(items=out)


@app.post("/api/s/{sid}/pron")
async def api_pron(sid: str, thr: float = 6.8):
    """Flag likely mispronounced content words (skip function words, names, cut words)."""
    s = get(sid); W = s.words; fl = s.flags()
    async with GPU: pred, sc = await asyncio.to_thread(pron_pred, s.audio(), SR, W)
    items = []
    for k, (w, p, o) in enumerate(zip(W, pred, sc)):
        nw = norm(w["w"]); name = w["w"][:1].isupper() and k > 0 and not re.search(r"[.!?]$", W[k - 1]["w"])
        if p is None or fl[k] or nw in FUNC or len(nw) < 3 or name: continue
        if p <= thr: items.append(dict(i=k, word=w["w"], acc=round(p, 1), canon="".join(o["phones"]), heard="".join(o["heard"]), sub=o["sub"],
                                      phone=o["phones"][o["worst"]]))
    return dict(items=items, scores=[None if p is None else round(p, 1) for p in pred])


def load_insert(s, iid):
    if iid not in s.inserts: s.inserts[iid] = np.load(f"{s.dir}/ins_{iid}.npy")
    return s.inserts[iid]


@app.post("/api/s/{sid}/render")
async def api_render(sid: str, r: dict):
    s = get(sid); ops = [dict(t0=o["t0"], t1=o["t1"], insert=load_insert(s, o["insert"]) if o.get("insert") else None) for o in r.get("ops", [])]
    y, ai = render(s.audio(), SR, ops); name = f"out_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", y, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(y) / SR, 2), ai=[[round(a, 2), round(b, 2)] for a, b in ai])


TONES = {"calm": "Change the emotion to calm.", "friendly": "Change the emotion to happy.", "excited": "Change the emotion to excited.",
         "serious": "Change the emotion to sad.", "clean": "Preserve all speakers, remove noise and reverberation, and output clean speech of the same length.",
         "confident": "Change the speaking style to confident and assertive, keep the same voice and words.",
         "native": "Remove the regional accent while preserving the speaker's voice and content."}
@app.post("/api/s/{sid}/tone")
async def api_tone(sid: str, r: dict):
    s = get(sid); src = f"{s.dir}/{r['file']}" if r.get("file") else f"{s.dir}/orig.wav"
    if "auk" not in ENGINES: raise HTTPException(400, "tone engine not running")
    if r.get("i") is not None:  # restyle only the selected words: same-length edit on a crop, splice the selection back
        W, x = s.words, s.audio(); dur = len(x) / SR; L, R = gap_edges(W, r["i"], r["j"], dur); cL, cR = max(0, L - 1.0), min(dur, R + 1.0)
        cp = f"{s.dir}/crop_{uuid.uuid4().hex[:6]}.wav"; sf.write(cp, x[int(cL * SR):int(cR * SR)], SR)
        async with httpx.AsyncClient(timeout=180) as cl:
            o = (await cl.post(f"http://127.0.0.1:{ENGINES['auk']}/instruct", json=dict(path=cp, instruction=TONES[r["style"]]))).json()
        y, gsr = sf.read(o["path"], dtype="float32"); y = librosa.resample(y, orig_sr=gsr, target_sr=SR)
        seg = y[int((L - cL) * SR):int((R - cL) * SR)]; ref = x[int(L * SR):int(R * SR)]
        seg = seg * min(3.0, float(np.sqrt(np.mean(ref ** 2) + 1e-12) / np.sqrt(np.mean(seg ** 2) + 1e-12)))
        iid = uuid.uuid4().hex[:8]; np.save(f"{s.dir}/ins_{iid}.npy", seg); s.inserts[iid] = seg
        return dict(op=dict(t0=round(L, 3), t1=round(R, 3), insert=iid, i=r["i"], j=r["j"], old=" ".join(w["w"] for w in W[r["i"]:r["j"] + 1]),
                            new=" ".join(w["w"] for w in W[r["i"]:r["j"] + 1]), engine="auk", verified=True, kind=r["style"]), sec=round(o["sec"], 2))
    async with httpx.AsyncClient(timeout=180) as cl:
        o = (await cl.post(f"http://127.0.0.1:{ENGINES['auk']}/instruct", json=dict(path=src, instruction=TONES[r["style"]]))).json()
    y, gsr = sf.read(o["path"], dtype="float32"); y = librosa.resample(y, orig_sr=gsr, target_sr=SR)
    name = f"tone_{r['style']}_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", y, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(y) / SR, 2), sec=round(o["sec"], 2))


@app.post("/api/s/{sid}/natural")
async def api_natural(sid: str, r: dict):
    """Pitch/timing-only restyle of the current edit (no AI voice): confident / calm / warm."""
    s = get(sid); src = f"{s.dir}/{r['file']}" if r.get("file") else f"{s.dir}/orig.wav"; t = time.time()
    y, _ = librosa.load(src, sr=SR)
    async with GPU: W = await asyncio.to_thread(transcribe, y, 1)
    z = await asyncio.to_thread(restyle, y, SR, W, r["style"])
    name = f"natural_{r['style']}_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", z, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(z) / SR, 2), sec=round(time.time() - t, 2))


@app.get("/api/s/{sid}/file/{name}")
def file(sid: str, name: str):
    p = f"{DATA}/{sid}/{os.path.basename(name)}"
    if not os.path.exists(p): raise HTTPException(404)
    return FileResponse(p, media_type="audio/wav")


@app.get("/api/s/{sid}/state")
def state(sid: str): return get(sid).state("final")


@app.get("/")
def root(): return RedirectResponse("/static/index.html")
app.mount("/static", StaticFiles(directory="/workspace/app/static"), name="static")
