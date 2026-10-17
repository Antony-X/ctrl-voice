# Train a tiny word-level mispronunciation detector on speechocean762 TRAIN (expert labels), test on TEST.
import io, sys, json, pickle, numpy as np, soundfile as sf, pyarrow.parquet as pq
from scipy.stats import pearsonr, rankdata
from sklearn.ensemble import HistGradientBoostingRegressor
sys.path.insert(0, "/workspace/app"); from pron import score, features
def run(f, n):
    out = []
    for r in pq.read_table(f).to_pylist()[:n]:
        x, sr = sf.read(io.BytesIO(r["audio"]["bytes"]), dtype="float32"); x = x.mean(1) if x.ndim > 1 else x
        for w, o in zip(r["words"], score(x, [w["text"] for w in r["words"]])):
            if o: out.append((o, w["accuracy"], len(w["mispronunciations"]) > 0, w["text"], r["text"]))
    return out
tr = run("/workspace/data/so762_train.parquet", 2500); te = run("/workspace/data/so762_test.parquet", 2500)
acc = {}
for o, a, m, *_ in tr:  # per-phone normalisation stats from training words that experts rated as well pronounced
    if a >= 9:
        for g, pk, p in zip(o["gops"], o["peaks"], o["phones"]): acc.setdefault(p, []).append(g); acc.setdefault("pk_" + p, []).append(pk)
stats = {p: (float(np.mean(v)), float(np.std(v) + 1e-3)) for p, v in acc.items() if len(v) >= 5}
Xtr = np.array([features(o, stats) for o, *_ in tr]); ytr = np.array([a for _, a, *_ in tr])
Xte = np.array([features(o, stats) for o, *_ in te]); yte = np.array([a for _, a, *_ in te]); mte = np.array([m for *_, m, _, _ in te])
reg = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, max_leaf_nodes=15).fit(Xtr, ytr); pr = reg.predict(Xte)
def auc(s, y): r = rankdata(s); y = np.array(y); return (r[y].sum() - y.sum() * (y.sum() + 1) / 2) / (y.sum() * (~y).sum())
print(f"train words {len(ytr)}, test words {len(yte)}, test bad(acc<=5) {np.mean(yte<=5):.3f}")
print(f"raw min-z GOP   PCC {pearsonr(Xte[:,0], yte)[0]:.3f}  AUC(acc<=5) {auc(-Xte[:,0], yte<=5):.3f}  AUC(mispron) {auc(-Xte[:,0], mte):.3f}")
print(f"trained detector PCC {pearsonr(pr, yte)[0]:.3f}  AUC(acc<=5) {auc(-pr, yte<=5):.3f}  AUC(acc<=7) {auc(-pr, yte<=7):.3f}  AUC(mispron) {auc(-pr, mte):.3f}")
for q in [0.02, 0.05, 0.10]:
    thr = np.quantile(pr, q); f = pr <= thr
    print(f"flag lowest {q:.0%}: thr {thr:.2f}, precision acc<=5 {np.mean(yte[f]<=5):.2f} / acc<=7 {np.mean(yte[f]<=7):.2f}, recall acc<=5 {(f&(yte<=5)).sum()/max(1,(yte<=5).sum()):.2f}")
pickle.dump(dict(reg=reg, stats=stats), open("/workspace/app/pron_model.pkl", "wb"))
worst = sorted(zip(pr, te), key=lambda z: z[0])[:15]
for p, (o, a, m, w, t) in worst: print(f"  pred {p:.1f} expert {a} | {w:12s} canon {''.join(o['phones'])} heard {''.join(o['heard'])} | {t[:50]}")
