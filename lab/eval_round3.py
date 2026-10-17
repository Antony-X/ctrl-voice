# Round 3 evals on REAL speakers. tone: Step-Audio-EditX styles via the app API (EdAcc + speechocean762 clips).
# pron: absolute vs accent-tolerant flagging on speechocean762, each speaker's utterances pooled like one message.
import glob, json, os, re, sys, time, io, requests, numpy as np, soundfile as sf, pyarrow.parquet as pq
B = "http://localhost:7860"; mode = sys.argv[1]
if mode == "tone":
    R = []
    for f in sorted(glob.glob("/workspace/out/accent/*__orig.wav")):
        name = os.path.basename(f)[:-10]; u = requests.post(f"{B}/api/upload", files={"f": open(f, "rb")}).json(); sid = u["sid"]; d0 = sf.info(f).duration
        for st in ["confident", "professional", "warm", "calm"]:
            t = time.time(); o = requests.post(f"{B}/api/s/{sid}/tone", json=dict(style=st)).json()
            if "url" not in o: print(name, st, o); continue
            open(f"/workspace/out/accent/{name}__stepx_{st}.wav", "wb").write(requests.get(B + o["url"]).content)
            R.append(dict(name=name, style=st, words_kept=o["words_kept"], voice_sim=o["voice_sim"], dur_ratio=round(o["dur"] / d0, 2), sec=round(time.time() - t, 1)))
            print(R[-1], flush=True)
    for st in ["confident", "professional", "warm", "calm"]:
        v = [x for x in R if x["style"] == st]
        print(f"{st:12s} words kept {np.mean([x['words_kept'] for x in v]):.2f} | voice sim {np.mean([x['voice_sim'] for x in v]):.3f} | length x{np.mean([x['dur_ratio'] for x in v]):.2f} | {np.mean([x['sec'] for x in v]):.1f} s")
    json.dump(R, open("/workspace/out/accent/stepx_results.json", "w"), indent=1)
if mode == "pron":
    sys.path.insert(0, "/workspace/app"); import pickle
    from pron import score, features
    from brain import norm
    M = pickle.load(open("/workspace/app/pron_model.pkl", "rb")); st = M["stats"]
    FUNC = set("a an the of to in on at is it i you he she we they and or but be am are was were do does did my your his her its our their this that for with as by from not so if me us".split())
    spk = {}
    for r in pq.read_table("/workspace/data/so762_test.parquet").to_pylist():
        x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); x = x.mean(1) if x.ndim > 1 else x
        for w, o in zip(r["words"], score(x, [w["text"] for w in r["words"]])):
            if o is None or norm(w["text"]) in FUNC or len(norm(w["text"])) < 3: continue
            p = float(M["reg"].predict([features(o, st)])[0])
            spk.setdefault(r["speaker"], []).append(dict(p=p, acc=w["accuracy"], o=o, word=w["text"]))
    res = {"absolute": [], "tolerant": [], "accent-excl only": []}; nwords = 0; accent_tips = 0; nag = 0
    for s, ws in spk.items():
        nwords += len(ws); per = {}
        for w in ws:
            for g, ph in zip(w["o"]["gops"], w["o"]["phones"]): mu, sd = st.get(ph, (0, 1)); per.setdefault(ph, []).append((g - mu) / sd)
        accent = {ph for ph, v in per.items() if len(v) >= 3 and np.mean(v) <= -1.0}; accent_tips += len(accent)
        med = float(np.median([w["p"] for w in ws]))
        for w in ws:
            worst = w["o"]["phones"][w["o"]["worst"]]
            if w["p"] <= 6.8:
                res["absolute"].append(w); nag += worst in accent
                if not (worst in accent and w["p"] > med - 3.0): res["accent-excl only"].append(w)
            bad = w["p"] <= 6.8 and w["p"] <= med - 1.5
            if bad and worst in accent and w["p"] > med - 3.0: bad = False
            if bad: res["tolerant"].append(w)
    print(f"speakers {len(spk)}, content words {nwords}, accent sounds found per speaker {accent_tips/len(spk):.1f}")
    print(f"absolute flags whose weakest sound is the speaker's habitual accent sound: {nag}/{len(res['absolute'])} = {nag/len(res['absolute']):.2f}")
    for k, v in res.items():
        a = np.array([w["acc"] for w in v])
        print(f"{k:9s} flags {len(v):4d} ({100*len(v)/nwords:.1f} per 100 words) | expert-bad (<=5) precision {np.mean(a<=5):.2f} | (<=3) {np.mean(a<=3):.2f} | expert-fine (>=8) false alarms {np.mean(a>=8):.2f}")
    allbad = sum(1 for ws in spk.values() for w in ws if w["acc"] <= 5)
    for k, v in res.items(): print(f"{k:9s} recall of expert-bad words {sum(1 for w in v if w['acc']<=5)/allbad:.2f}")
