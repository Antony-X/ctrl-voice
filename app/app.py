# ReSpeak demo server: live transcript + semantic undo while recording, cut-only cleanup, AI word replacement, tone takes.
import asyncio, gzip, json, os, re, sys, time, uuid
import numpy as np, soundfile as sf, librosa, torch, httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
sys.path.insert(0, "/workspace/app"); sys.path.insert(0, "/workspace/lab")
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
from brain import clean, last_thought, spoken_command, grammar, tighten, intent, norm, FILLERS
from render import render, gap_edges, quiet
from align import align, emissions, spell, V as CTC_V, BLANK as CTC_BLANK
from prosody import restyle, blend, PRESETS
import pickle
from pron import score as pscore, features as pfeat, phones as g2p, levenshtein, fit as afit
PRON = pickle.load(open("/workspace/app/pron_model.pkl", "rb"))  # trained on speechocean762 expert word-accuracy labels
FUNC = set("a an the of to in on at is it i you he she we they and or but be am are was were do does did my your his her its our their this that for with as by from not so if me us".split())

SR = 24000; DATA = "/workspace/app_data"; os.makedirs(DATA, exist_ok=True)
ENGINES = {k: int(v) for k, v in (e.split(":") for e in os.environ.get("ENGINES", "playdiff:8101,f5:8103,auk:8102,dots:8104").split(","))}
FAST = [e for e in os.environ.get("FAST_ENGINES", "playdiff,f5").split(",") if e in ENGINES]
PROMPT = "Um, so, uh, um, I was, uh, like, um, thinking, uh. Um. Uh. Hmm, um, okay, uh, I mean, um."  # filler-dense: whisper writes the ums it hears
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
    rows = [k for k, o in enumerate(sc) if o is not None]; pred = [None] * len(sc)
    if rows:  # one predict for all words: a call per word costs ~4 ms of thread start-up each (same results)
        for k, p in zip(rows, PRON["reg"].predict([pfeat(sc[k], PRON["stats"]) for k in rows])): pred[k] = float(p)
    return pred, sc


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
        """per word: removal kind (time-based, so it survives re-transcription) or None.
        A word is placed at its start + half its length capped at 0.4 s: whisper stretches the end of a
        word through the pause after it, which would push its midpoint out of the cut that removed it."""
        out = []
        for w in self.words:
            m = w["s"] + min(w["e"] - w["s"], 0.4) / 2; out.append(next((r["kind"] for r in self.removed if r["t0"] <= m <= r["t1"]), None))
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
    # Re-say the word together with the one before it: alone, the new word often keeps the old onset
    # ("specific" spliced after "more" still sounded like "pacific"; "more specific" did not).
    if (not same and r.get("widen", True) and i > 0 and s.flags()[i - 1] is None and norm(W[i - 1]["w"]) not in FILLERS
            and not re.search(r"[.,!?;:]$", W[i - 1]["w"]) and W[i]["s"] - W[i - 1]["e"] < 0.3):
        i -= 1; new = re.sub(r"[.,!?;:]+$", "", W[i]["w"]) + " " + new
    a, b, L, R = window(W, i, j, dur)
    win = x[int(L * SR):int(R * SR)]; wp = f"{s.dir}/win_{uuid.uuid4().hex[:6]}.wav"; sf.write(wp, win, SR)
    ww = [dict(w=w["w"], s=round(w["s"] - L, 3), e=round(w["e"] - L, 3)) for w in W[a:b + 1]]; wi, wj = i - a, j - a
    tail = re.sub(r"^.*?([.,!?;:]*)$", r"\1", W[j]["w"]); nw = new.split(); nw[-1] += tail
    tw = [dict(w=w["w"]) for w in ww[:wi]] + [dict(w=x_) for x_ in nw] + [dict(w=w["w"]) for w in ww[wj + 1:]]
    # chars/sec of this speaker. An aligned word runs on into the pause after it, so only count words followed straight by another word
    inner = [w for w, w2 in zip(W, W[1:]) if not re.search(r"[.,!?;:]$", w["w"]) and w2["s"] - w["e"] < 0.15]
    ws = inner if len(inner) >= 4 else W
    rate = sum(len(norm(w["w"])) for w in ws) / max(1e-3, sum(w["e"] - w["s"] for w in ws))
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
            ht, nt = [norm(x) for x in heard.split() if norm(x)], [norm(x) for x in new.split() if norm(x)]
            ok = any(ht[k:k + len(nt)] == nt for k in range(len(ht) - len(nt) + 1))
            margin = None
            if not same:  # the recognizer also guesses from context; the sounds alone must favour the new words over the old
                em = await asyncio.to_thread(emissions, librosa.resample(test, orig_sr=SR, target_sr=16000))
                olds = [w["w"] for w in tw[:wi]] + [w["w"] for w in W[i:j + 1]] + [w["w"] for w in tw[wj + 1:]]
                margin = round(ctc_logp(em, [w["w"] for w in tw]) - ctc_logp(em, olds), 2); ok = ok and margin > 0
            sim = float(embed(seg, SR) @ e0) if len(seg) > 0.3 * SR else 0.5
            if same:  # pronunciation fix: re-score the regenerated word(s) with the mispronunciation detector
                tws = [dict(w=w["w"]) for w in tw]; al = align(librosa.resample(test, orig_sr=SR, target_sr=16000), [w["w"] for w in tws])
                pa, _ = await asyncio.to_thread(pron_pred, test, SR, [dict(w=w["w"]) for w in tws]) if all(al) else ([None] * len(tws), None)
                after = min([p for p in pa[wi:wj + 1] if p is not None], default=0.0); sim = after / 10 + (0.5 if ok else 0)
            iid = uuid.uuid4().hex[:8]; np.save(f"{s.dir}/ins_{iid}.npy", seg); s.inserts[iid] = seg
            cands.append(dict(engine=e, ok=ok, sim=round(sim, 3), heard=heard, id=iid, sec=round(o["sec"], 2), margin=margin, **({"after": round(after, 2)} if same else {})))


def ctc_logp(em, words):
    """log P(words | audio) under the character CTC model, which has no language model to fill in from context."""
    toks = []
    for w in words:
        if spell(w): toks += [CTC_V[c] for c in spell(w)] + [CTC_V["|"]]
    lp = torch.from_numpy(em)
    return -torch.nn.functional.ctc_loss(lp[:, None], torch.tensor([toks[:-1]]), [lp.shape[0]], [len(toks) - 1], blank=CTC_BLANK,
                                         reduction="sum", zero_infinity=True).item()


@app.post("/api/s/{sid}/intent")
async def api_intent(sid: str, margin: float = 1.0):
    """Words the recognizer probably mis-heard because of pronunciation. The LLM proposes up to 3 intended sentences;
    each candidate word is scored by how well ITS phonemes explain the recorded sounds, relative to the word Whisper wrote."""
    s = get(sid); idx = [k for k, f in enumerate(s.flags()) if f is None]; act = [s.words[k] for k in idx]
    groups = await asyncio.to_thread(intent, act); out = []
    if not groups: return dict(items=out)  # nothing to score: don't queue for the GPU lock behind /pron
    x16 = librosa.resample(s.audio(), orig_sr=SR, target_sr=16000)
    async with GPU:
        for g in groups:
            i, j = idx[g["i"]], idx[g["j"]]
            seg = x16[int(max(0, s.words[i]["s"] - 0.05) * 16000):int((s.words[j]["e"] + 0.05) * 16000)]
            heard = sum((g2p(w) for w in g["old"].split()), []); base = await asyncio.to_thread(afit, seg, g["old"])
            best = None
            for c in g["cands"]:
                o_, n_ = norm(g["old"].replace(" ", "")), norm(c["new"].replace(" ", ""))
                if o_ in n_ or n_ in o_: continue  # "upward"->"upwards", "day"->"today": word-form nitpicks, not mispronunciations
                ph = sum((g2p(w) for w in c["new"].split()), []); d = levenshtein(heard, ph) / max(1, len(ph))
                if d > 0.6: continue  # must sound alike
                c.update(fit=round(await asyncio.to_thread(afit, seg, c["new"]) - base, 2), dist=round(d, 2), intended="".join(ph))
                if c["fit"] >= -margin and (best is None or c["fit"] - 0.3 * c["rank"] > best["fit"] - 0.3 * best["rank"]): best = c
            if best:
                out.append(dict(i=i, j=j, old=g["old"], new=best["new"], heard="".join(heard), intended=best["intended"], fit=best["fit"], dist=best["dist"],
                                alts=[c["new"] for c in g["cands"] if c is not best]))
    return dict(items=out)


@app.post("/api/s/{sid}/pron")
async def api_pron(sid: str, thr: float = 6.8, rel: float = 1.5):
    """Flag words that are mispronounced FOR THIS SPEAKER. A sound the speaker always says differently is their accent:
    it becomes a coach tip, not an error flag. Skips function words, names and cut words."""
    s = get(sid); W = s.words; fl = s.flags()
    async with GPU: pred, sc = await asyncio.to_thread(pron_pred, s.audio(), SR, W)
    st = PRON["stats"]; per_phone = {}
    content = [k for k, (w, p) in enumerate(zip(W, pred)) if p is not None and not fl[k] and norm(w["w"]) not in FUNC and len(norm(w["w"])) >= 3]
    for k in content:
        for g, ph in zip(sc[k]["gops"], sc[k]["phones"]):
            mu, sd = st.get(ph, (0, 1)); per_phone.setdefault(ph, []).append((g - mu) / sd)
    accent = {ph: float(np.mean(v)) for ph, v in per_phone.items() if len(v) >= 3 and np.mean(v) <= -1.0}  # consistently different = accent
    med = float(np.median([pred[k] for k in content])) if len(content) >= 6 else 10.0
    items = []
    for k in content:
        w, p, o = W[k], pred[k], sc[k]
        if w["w"][:1].isupper() and k > 0 and not re.search(r"[.!?]$", W[k - 1]["w"]): continue  # probably a name
        worst = o["phones"][o["worst"]]
        bad = (p <= thr and p <= med - rel) if len(content) >= 6 else p <= thr  # worse than THIS speaker's usual, not just non-native
        if bad and worst in accent and p > med - 2 * rel: bad = False  # only the speaker's habitual accent sound is off
        if bad: items.append(dict(i=k, word=w["w"], acc=round(p, 1), canon="".join(o["phones"]), heard="".join(o["heard"]), sub=o["sub"], phone=worst))
    tips = [dict(phone=ph, n=len(per_phone[ph]), z=round(z, 2)) for ph, z in sorted(accent.items(), key=lambda kv: kv[1])][:3]
    return dict(items=items, accent=tips, median=round(med, 1), scores=[None if p is None else round(p, 1) for p in pred])


def load_insert(s, iid):
    if iid not in s.inserts: s.inserts[iid] = np.load(f"{s.dir}/ins_{iid}.npy")
    return s.inserts[iid]


@app.post("/api/s/{sid}/render")
async def api_render(sid: str, r: dict):
    s = get(sid); ops = [dict(t0=o["t0"], t1=o["t1"], insert=load_insert(s, o["insert"]) if o.get("insert") else None) for o in r.get("ops", [])]
    y, ai = render(s.audio(), SR, ops); name = f"out_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", y, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(y) / SR, 2), ai=[[round(a, 2), round(b, 2)] for a, b in ai])


STYLES = {  # Step-Audio-EditX edit types (32 speaking styles, 14 emotions); AuK instructions are the fallback
    "confident": ("style", "authority"), "professional": ("style", "news"), "warm": ("style", "warm"), "calm": ("style", "gentle"),
    "serious": ("style", "serious"), "friendly": ("emotion", "happy"), "excited": ("emotion", "excited"), "apologetic": ("emotion", "empathy")}
AUK = {"calm": "Change the emotion to calm.", "friendly": "Change the emotion to happy.", "excited": "Change the emotion to excited.",
       "confident": "Change the speaking style to confident and assertive, keep the same voice and words."}


async def restyle_ai(src, text, style):
    async with httpx.AsyncClient(timeout=300) as cl:
        if "stepx" in ENGINES:
            et, ei = STYLES[style]
            o = (await cl.post(f"http://127.0.0.1:{ENGINES['stepx']}/instruct", json=dict(path=src, text=text, edit_type=et, edit_info=ei))).json(); o["engine"] = "Step-Audio-EditX"
        elif "auk" in ENGINES and style in AUK:
            o = (await cl.post(f"http://127.0.0.1:{ENGINES['auk']}/instruct", json=dict(path=src, instruction=AUK[style]))).json(); o["engine"] = "AuK"
        else: raise HTTPException(400, f"no tone engine for {style}")
    y, gsr = sf.read(o["path"], dtype="float32"); y = y.mean(1) if y.ndim > 1 else y
    return librosa.resample(y, orig_sr=gsr, target_sr=SR), o


def same_words(a, b):
    from jiwer import wer
    A, B = " ".join(norm(x) for x in a.split() if norm(x)), " ".join(norm(x) for x in b.split() if norm(x))
    return 1 - min(1.0, wer(A, B)) if A else 0.0


@app.post("/api/s/{sid}/tone")
async def api_tone(sid: str, r: dict):
    """AI restyle of the whole current edit or of the selected words. Checked: words kept (re-transcribed) and voice similarity."""
    s = get(sid); t = time.time(); W, x = s.words, s.audio(); dur = len(x) / SR
    if r.get("i") is not None:
        i, j = r["i"], r["j"]; L, R = gap_edges(W, i, j, dur); a, b, cL, cR = window(W, i, j, dur, ctx=2.0)
        crop = x[int(cL * SR):int(cR * SR)]; cp = f"{s.dir}/crop_{uuid.uuid4().hex[:6]}.wav"; sf.write(cp, crop, SR)
        tw = [dict(w=w["w"]) for w in W[a:b + 1]]; y, o = await restyle_ai(cp, " ".join(w["w"] for w in tw), r["style"])
        async with GPU:
            seg = await asyncio.to_thread(extract, librosa.resample(y, orig_sr=SR, target_sr=16000), y, SR, tw, i - a, j - a)
            if seg is None: raise HTTPException(500, "restyled words not found in the output")
            heard = " ".join(w["w"] for w in await asyncio.to_thread(transcribe, seg, 1)); ref = x[int(L * SR):int(R * SR)]
            sim = float(embed(seg, SR) @ embed(ref, SR)) if len(seg) > 0.5 * SR else None
        seg = seg * min(3.0, float(np.sqrt(np.mean(ref ** 2) + 1e-12) / np.sqrt(np.mean(seg ** 2) + 1e-12)))
        iid = uuid.uuid4().hex[:8]; np.save(f"{s.dir}/ins_{iid}.npy", seg); s.inserts[iid] = seg
        kept = same_words(" ".join(w["w"] for w in W[i:j + 1]), heard)
        return dict(op=dict(t0=round(L, 3), t1=round(R, 3), insert=iid, i=i, j=j, old=" ".join(w["w"] for w in W[i:j + 1]), new=" ".join(w["w"] for w in W[i:j + 1]),
                            engine=o["engine"], verified=kept >= 0.8, kind=r["style"], sim=None if sim is None else round(sim, 3)), sec=round(time.time() - t, 2))
    src = f"{s.dir}/{r['file']}" if r.get("file") else f"{s.dir}/orig.wav"; y0, _ = librosa.load(src, sr=SR)
    async with GPU: text = " ".join(w["w"] for w in await asyncio.to_thread(transcribe, y0, 1))
    y, o = await restyle_ai(src, text, r["style"])
    async with GPU:
        heard = " ".join(w["w"] for w in await asyncio.to_thread(transcribe, y, 1)); sim = float(embed(y, SR) @ embed(y0, SR))
    name = f"tone_{r['style']}_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", y, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(y) / SR, 2), sec=round(time.time() - t, 2), engine=o["engine"],
                words_kept=round(same_words(text, heard), 2), voice_sim=round(sim, 3))


ACCENT = int(os.environ.get("ACCENT_PORT", "8106"))  # accent_service.py: ASR -> native F5 voice -> Seed-VC back to the speaker


@app.post("/api/s/{sid}/accent")
async def api_accent(sid: str, r: dict):
    """Native-accent take of the whole current edit (AI voice). Checked as /tone: words kept (re-transcribed) and voice similarity."""
    s = get(sid); t = time.time(); src = f"{s.dir}/{r['file']}" if r.get("file") else f"{s.dir}/orig.wav"; y0, _ = librosa.load(src, sr=SR)
    text = (r.get("text") or "").strip()  # the client's kept words; transcribed only when missing
    if not text:
        async with GPU: text = " ".join(w["w"] for w in await asyncio.to_thread(transcribe, y0, 1))
    raw = f"{s.dir}/accent_raw_{uuid.uuid4().hex[:6]}.wav"
    try:
        async with httpx.AsyncClient(timeout=300) as cl:
            o = await cl.post(f"http://127.0.0.1:{ACCENT}/accent", json=dict(wav=src, text=text, out=raw))
    except httpx.HTTPError: raise HTTPException(503, "the accent service is not running")
    if o.status_code != 200: raise HTTPException(502, f"accent service: {o.text[:200]}")
    y, gsr = sf.read(raw, dtype="float32"); y = librosa.resample(y.mean(1) if y.ndim > 1 else y, orig_sr=gsr, target_sr=SR)
    async with GPU:
        heard = " ".join(w["w"] for w in await asyncio.to_thread(transcribe, y, 1)); sim = float(embed(y, SR) @ embed(y0, SR))
    name = f"accent_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", y, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(y) / SR, 2), sec=round(time.time() - t, 2), engine="F5-TTS + Seed-VC",
                words_kept=round(same_words(text, heard), 2), voice_sim=round(sim, 3))


def tone_mix(r):  # {"mix": {style: amount}} from the sliders, or the older {"style": name, "amount": 1}
    mix = {k: float(v) for k, v in (r.get("mix") or {r.get("style"): r.get("amount", 1.0)}).items() if float(v) > 0}
    if not mix or any(k not in PRESETS for k in mix): raise HTTPException(400, "unknown tone")
    return mix, r.get("style") if r.get("style") in mix else max(mix, key=mix.get)


@app.post("/api/s/{sid}/natural")
async def api_natural(sid: str, r: dict):
    """Pitch/timing-only restyle of the current edit (no AI voice): confident / calm / warm, or a mix of them with strengths."""
    s = get(sid); src = f"{s.dir}/{r['file']}" if r.get("file") else f"{s.dir}/orig.wav"; t = time.time(); mix, style = tone_mix(r)
    if r.get("i") is not None:  # selection: restyle just those words and splice them back
        W, x = s.words, s.audio(); L, R = gap_edges(W, r["i"], r["j"], len(x) / SR)
        sub = [dict(w, s=w["s"] - L, e=w["e"] - L) for w in W[r["i"]:r["j"] + 1]]
        seg = await asyncio.to_thread(restyle, x[int(L * SR):int(R * SR)], SR, sub, mix)
        iid = uuid.uuid4().hex[:8]; np.save(f"{s.dir}/ins_{iid}.npy", seg); s.inserts[iid] = seg; txt = " ".join(w["w"] for w in W[r["i"]:r["j"] + 1])
        return dict(op=dict(t0=round(L, 3), t1=round(R, 3), insert=iid, i=r["i"], j=r["j"], old=txt, new=txt, engine="praat", verified=True, kind="natural " + style), sec=round(time.time() - t, 2))
    y, _ = librosa.load(src, sr=SR)
    W = []  # the words only place the falling phrase endings, so a mix without a fall (warm) skips the recognizer
    if blend(mix)["fall"] > 0:
        async with GPU: W = await asyncio.to_thread(transcribe, y, 1)
    z = await asyncio.to_thread(restyle, y, SR, W, mix)
    name = f"natural_{style}_{uuid.uuid4().hex[:6]}.wav"; sf.write(f"{s.dir}/{name}", z, SR)
    return dict(url=f"/api/s/{sid}/file/{name}", dur=round(len(z) / SR, 2), sec=round(time.time() - t, 2))


@app.get("/api/s/{sid}/file/{name}")
def file(sid: str, name: str, request: Request):
    p = f"{DATA}/{sid}/{os.path.basename(name)}"
    if not os.path.exists(p): raise HTTPException(404)
    # Through the RunPod proxy a ~0.5 MB take downloads in 0.3-1.5 s; gzip (level 1, ~5 ms) makes it ~30% smaller.
    # Only for clients that accept it, never for range requests (an <audio> element asks for identity + ranges).
    if "gzip" in request.headers.get("accept-encoding", "") and "range" not in request.headers:
        with open(p, "rb") as fh: body = gzip.compress(fh.read(), 1)
        return Response(body, media_type="audio/wav", headers={"Content-Encoding": "gzip", "Vary": "Accept-Encoding"})
    return FileResponse(p, media_type="audio/wav")


@app.get("/api/s/{sid}/state")
def state(sid: str): return get(sid).state("final")


@app.get("/")
def root(): return RedirectResponse("/static/index.html")
app.mount("/static", StaticFiles(directory="/workspace/app/static"), name="static")
