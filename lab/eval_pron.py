# speechocean762: does our word score track expert word-accuracy labels (real L2 speakers)?
import io, sys, time, json, numpy as np, soundfile as sf, librosa, pyarrow.parquet as pq
from scipy.stats import pearsonr, rankdata
sys.path.insert(0, "/workspace/app"); from pron import score
N = int(sys.argv[1]) if len(sys.argv) > 1 else 500
rows = pq.read_table("/workspace/data/so762_test.parquet").to_pylist()[:N]
G, P, A, MIS, t0, out = [], [], [], [], time.time(), []
for r in rows:
    x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); x = x.mean(1) if x.ndim > 1 else x
    if sr != 16000: x = librosa.resample(x, orig_sr=sr, target_sr=16000)
    ws = [w["text"] for w in r["words"]]; s = score(x, ws)
    for w, o in zip(r["words"], s):
        if o is None: continue
        G.append(o["gop"]); P.append(o["peak"]); A.append(w["accuracy"]); MIS.append(len(w["mispronunciations"]) > 0)
        out.append(dict(utt=r["speaker"], text=r["text"], word=w["text"], acc=w["accuracy"], gop=o["gop"], peak=o["peak"], sub=o["sub"], heard=o["heard"], phones=o["phones"], mis=w["mispronunciations"]))
dt = (time.time() - t0) / len(rows)
def auc(score_bad, y):  # higher score_bad = more likely bad
    r = rankdata(score_bad); y = np.array(y); return (r[y].sum() - y.sum() * (y.sum() + 1) / 2) / (y.sum() * (~y).sum())
G, P, A, MIS = map(np.array, (G, P, A, MIS))
print(f"{len(rows)} utts, {len(A)} words, {dt*1000:.0f} ms/utt; bad(acc<=5)={np.mean(A<=5):.3f} mis-annotated={MIS.mean():.3f}")
for name, s in [("gop_af", G), ("peak", P)]:
    print(f"{name:7s} PCC vs word accuracy {pearsonr(s, A)[0]:.3f} | AUC acc<=5 {auc(-s, A <= 5):.3f} | AUC acc<=7 {auc(-s, A <= 7):.3f} | AUC any-mispron {auc(-s, MIS):.3f}")
for thr in [-1, 0, 1, 2]:
    flag = G < thr; tp = (flag & (A <= 5)).sum()
    print(f"gop<{thr}: flags {flag.mean():.3f} of words, precision(acc<=5) {tp/max(1,flag.sum()):.2f}, recall {tp/max(1,(A<=5).sum()):.2f}")
json.dump(out, open("/workspace/out/pron_so762.json", "w"))
