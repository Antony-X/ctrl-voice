# Pick speechocean762 TEST utterances (adult speakers) with one or two low-accuracy content words and the rest well pronounced.
import io, json, re, sys, numpy as np, soundfile as sf, pyarrow.parquet as pq
FUNC = set("a an the of to in on at is it i you he she we they and or but be am are was were do does did my your his her its our their this that for with as by from not so if me us".split())
norm = lambda w: re.sub(r"[^a-z0-9\x27]", "", w.lower())
t = pq.read_table("/workspace/examples/mispron/data/so762_test.parquet")
rows = t.to_pylist()
ages = [r["age"] for r in rows]; print("rows", len(rows), "age<18", sum(a < 18 for a in ages), "adult", sum(a >= 18 for a in ages))
out = []
for k, r in enumerate(rows):
    if r["age"] < 18: continue
    x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); dur = len(x) / sr
    W = r["words"]; content = [i for i, w in enumerate(W) if norm(w["text"]) not in FUNC and len(norm(w["text"])) >= 3]
    bad = [i for i, w in enumerate(W) if w["accuracy"] <= 6]
    good = [i for i, w in enumerate(W) if w["accuracy"] >= 8]
    if not (1 <= len(bad) <= 2): continue
    if len(good) != len(W) - len(bad): continue          # everything else clearly well pronounced (>= 8)
    if not all(i in content for i in bad): continue      # the pron step only looks at content words
    if not any(W[i]["mispronunciations"] for i in bad): continue  # a phone-level error is annotated
    out.append(dict(row=k, speaker=r["speaker"], age=r["age"], gender=r["gender"], text=r["text"], dur=round(dur, 2), sr=sr,
                    utt_acc=r["accuracy"], utt_total=r["total"], fluency=r["fluency"], n_words=len(W),
                    bad=[dict(i=i, w=W[i]["text"], acc=W[i]["accuracy"], mis=W[i]["mispronunciations"], phones=W[i]["phones"]) for i in bad],
                    words=[dict(w=w["text"], acc=w["accuracy"]) for w in W]))
print("candidates", len(out))
print("dur 2.5-8s", sum(2.5 <= o["dur"] <= 8 for o in out), "single bad", sum(len(o["bad"]) == 1 for o in out))
json.dump(out, open("/workspace/examples/mispron/cands.json", "w"), indent=1)
for o in sorted(out, key=lambda o: (len(o["bad"]), min(b["acc"] for b in o["bad"])))[:80]:
    print(o["row"], o["speaker"], o["age"], o["dur"], o["utt_acc"], "|", o["text"], "|", [(b["w"], b["acc"], [(m["canonical-phone"], m["pronounced-phone"]) for m in b["mis"]]) for b in o["bad"]])
