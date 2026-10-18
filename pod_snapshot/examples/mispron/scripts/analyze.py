# Survey analysis (CPU only): detection vs expert labels, fix outcome, and seam measurements on kept re-says.
# Usage: python -I analyze.py <outDir> <summary.json>
import difflib, glob, json, os, re, sys
import numpy as np, soundfile as sf, librosa
from scipy.stats import rankdata

FUNC = set("a an the of to in on at is it i you he she we they and or but be am are was were do does did my your his her its our their this that for with as by from not so if me us".split())
norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower())
SR = 24000


def eligible(words, k):
    """Would /pron consider word k at all (content word, >= 3 letters, not a mid-sentence capitalised name)?"""
    w = words[k]["w"]
    if norm(w) in FUNC or len(norm(w)) < 3: return False
    if w[:1].isupper() and k > 0 and not re.search(r"[.!?]$", words[k - 1]["w"]): return False
    return True


def map_words(a, b):
    """Index map from word list a to word list b by normalised text (difflib opcodes; 1:1 replaces kept)."""
    A, B = [norm(x) for x in a], [norm(x) for x in b]
    m = {}
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, A, B, autojunk=False).get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for d in range(i2 - i1): m[i1 + d] = j1 + d
    return m


def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2) + 1e-12))


def f0_median(x):
    if len(x) < int(0.06 * SR): return None
    f0, vf, _ = librosa.pyin(x, fmin=60, fmax=400, sr=SR, frame_length=1024, hop_length=120)
    f0 = f0[vf & ~np.isnan(f0)]
    return float(np.median(f0)) if len(f0) >= 3 else None


def f0_track(x):
    f0, vf, _ = librosa.pyin(x, fmin=60, fmax=400, sr=SR, frame_length=1024, hop_length=120)
    return np.where(vf, f0, np.nan)


def seams(before, after):
    """Left/right seam sample positions in `after` for a single splice: the longest exactly-equal prefix / suffix."""
    n = min(len(before), len(after))
    d = np.nonzero(np.abs(before[:n] - after[:n]) > 1.5 / 32768)[0]
    left = int(d[0]) if len(d) else n
    rb, ra = before[::-1], after[::-1]
    d = np.nonzero(np.abs(rb[:n] - ra[:n]) > 1.5 / 32768)[0]
    right_from_end = int(d[0]) if len(d) else n
    return left, len(after) - right_from_end, len(before) - right_from_end


def seam_metrics(after, before, L, Ra, Rb):
    """Joins at L (both files) and Ra (after) / Rb (before). Measures around each join and over the insert."""
    out = {}
    def fluxof(y):
        logS = np.log(np.abs(librosa.stft(y, n_fft=512, hop_length=120)) + 1e-9)
        return np.sqrt(np.mean(np.diff(logS, axis=1) ** 2, axis=0))  # frame-to-frame log-spectral change
    flux, fluxb = fluxof(after), fluxof(before)
    # the same transition in the original recording (word-to-word change the speaker actually made)
    for name, pos in (("left", L), ("right", Rb)):
        f = pos // 120; out[f"{name}_flux_orig"] = round(float(fluxb[max(1, f - 2):min(len(fluxb) - 1, f + 2)].max()), 3)
    # spectral distance between the frames just before and just after each join (mean log-mel, 20 ms each side)
    def mel(y): return np.log(librosa.feature.melspectrogram(y=y, sr=SR, n_fft=512, hop_length=120, n_mels=40) + 1e-8)
    Ma, Mb = mel(after), mel(before)
    def jump(M, l, r): return float(np.sqrt(np.mean((M[:, max(0, l - 4):l].mean(1) - M[:, r:r + 4].mean(1)) ** 2)))
    out["left_mel_jump"] = round(jump(Ma, L // 120, L // 120), 2); out["left_mel_jump_orig"] = round(jump(Mb, L // 120, L // 120), 2)
    out["right_mel_jump"] = round(jump(Ma, Ra // 120, Ra // 120), 2); out["right_mel_jump_orig"] = round(jump(Mb, Rb // 120, Rb // 120), 2)
    for name, pos in (("left", L), ("right", Ra)):
        f = pos // 120
        lo, hi = max(1, f - 2), min(len(flux) - 1, f + 2)
        local = float(flux[lo:hi].max())
        ref = flux[max(0, f - 60):f - 6].tolist() + flux[f + 6:f + 60].tolist()  # +-0.3 s around, excluding the join
        out[f"{name}_flux"] = round(local, 3)
        out[f"{name}_flux_pct"] = round(float(np.mean(np.array(ref) < local) * 100), 1) if ref else None  # percentile of the join among neighbours
        seg = after[max(0, pos - 120):pos + 120]  # +-5 ms
        dd = np.abs(np.diff(seg)).max() if len(seg) > 2 else 0
        ctx = np.abs(np.diff(after[max(0, pos - 2400):pos + 2400]))
        out[f"{name}_click_ratio"] = round(float(dd / (np.percentile(ctx, 99) + 1e-9)), 2)  # >~2 = a step bigger than the speech around it
        out[f"{name}_level_db"] = round(rms_db(after[max(0, pos - 240):pos + 240]), 1)  # level at the join itself (low = it sits in a pause)
    ins = after[L:Ra]; orig = before[L:Rb]
    out["insert_s"] = round(len(ins) / SR, 3); out["orig_s"] = round(len(orig) / SR, 3)
    out["insert_rms_db"] = round(rms_db(ins), 1); out["orig_rms_db"] = round(rms_db(orig), 1)
    ctxL, ctxR = after[max(0, L - int(0.8 * SR)):L], after[Ra:Ra + int(0.8 * SR)]
    out["ctx_rms_db"] = round(rms_db(np.concatenate([ctxL, ctxR])), 1)
    fi, fo, fc = f0_median(ins), f0_median(orig), f0_median(np.concatenate([ctxL, ctxR]))
    out["f0_insert"] = fi and round(fi, 1); out["f0_orig"] = fo and round(fo, 1); out["f0_ctx"] = fc and round(fc, 1)
    if fi and fc: out["f0_insert_vs_ctx_st"] = round(12 * np.log2(fi / fc), 2)
    if fo and fc: out["f0_orig_vs_ctx_st"] = round(12 * np.log2(fo / fc), 2)
    # pitch right at the joins: last voiced F0 before / first voiced F0 after, and inside the insert
    tr = f0_track(after[max(0, L - int(0.4 * SR)):Ra + int(0.4 * SR)]); off = max(0, L - int(0.4 * SR))
    t = (np.arange(len(tr)) * 120 + off)
    def edge(a, b, last):
        v = tr[(t >= a) & (t < b)]; v = v[~np.isnan(v)]
        return None if not len(v) else float(v[-3:].mean() if last else v[:3].mean())
    pairs = {"left": (edge(L - int(0.4 * SR), L, True), edge(L, Ra, False)), "right": (edge(L, Ra, True), edge(Ra, Ra + int(0.4 * SR), False))}
    for k, (a, b) in pairs.items():
        out[f"{k}_f0_jump_st"] = round(12 * np.log2(b / a), 2) if a and b else None
    # bandwidth: share of insert energy above 7.5 kHz vs the original recording around it
    def hf(x):
        if len(x) < 512: return None
        P = np.abs(librosa.stft(x, n_fft=1024, hop_length=256)) ** 2; fr = librosa.fft_frequencies(sr=SR, n_fft=1024)
        return float(10 * np.log10(P[fr > 7500].sum() / (P.sum() + 1e-12) + 1e-12))
    out["hf_insert_db"] = hf(ins) and round(hf(ins), 1); out["hf_orig_db"] = hf(orig) and round(hf(orig), 1)
    out["hf_ctx_db"] = hf(np.concatenate([ctxL, ctxR])) and round(hf(np.concatenate([ctxL, ctxR])), 1)
    return out


def auc(score_bad, y):
    y = np.array(y, bool); r = rankdata(score_bad)
    return float((r[y].sum() - y.sum() * (y.sum() + 1) / 2) / (y.sum() * (~y).sum())) if y.any() and (~y).any() else None


def main(outDir, summaryPath):
    rows, allw = [], []
    for jf in sorted(glob.glob(f"{outDir}/*.json")):
        R = json.load(open(jf)); c = R["label"]; W = R["words"]; lab = c["words"]
        m = map_words([x["w"] for x in lab], [w["w"] for w in W])
        flagged = {p["i"]: p for p in R["pron"]["items"]}
        scores = R["pron"].get("scores") or [None] * len(W)
        for li, x in enumerate(lab):
            k = m.get(li)
            allw.append(dict(id=c["id"], word=x["w"], acc=x["acc"], mapped=k is not None, asr=W[k]["w"] if k is not None else None,
                             eligible=k is not None and eligible(W, k), flagged=k in flagged, pred=scores[k] if k is not None else None))
        badk = [m.get(b["i"]) for b in c["bad"]]
        pr_reps = [x for x in R["replaced"] if x["kind"] == "pronunciation"]
        other_reps = [x for x in R["replaced"] if x["kind"] != "pronunciation"]
        cuts = [o for o in R["ops"] if o["type"] == "cut" and o["on"]]
        row = dict(id=c["id"], speaker=c["speaker"], age=c["age"], text=c["text"], dur=c["dur"], utt_acc=c["utt_acc"],
                   bad=[dict(w=b["w"], acc=b["acc"], mis=[(q["canonical-phone"], q["pronounced-phone"]) for q in b["mis"]], k=k, asr=W[k]["w"] if k is not None else None,
                             flagged=k in flagged, pred=scores[k] if k is not None else None) for b, k in zip(c["bad"], badk)],
                   heard=" ".join(w["w"] for w in W), median=R["pron"]["median"], accent=R["pron"].get("accent"),
                   flags=[dict(i=p["i"], word=p["word"], acc=p["acc"], labelled_bad=p["i"] in badk) for p in R["pron"]["items"]],
                   pron_reps=[dict(i=x["item"]["i"], word=x["item"]["word"], before=x["item"]["acc"], after=x["op"].get("after"), verified=x["op"]["verified"],
                                   kept=x["on"], engine=x["op"]["engine"], labelled_bad=x["item"]["i"] in badk,
                                   cands=[dict(engine=q.get("engine"), ok=q.get("ok"), after=q.get("after"), heard=q.get("heard")) for q in x["cands"]]) for x in pr_reps],
                   other_reps=[dict(kind=x["kind"], old=x["op"]["old"], new=x["op"]["new"], kept=x["on"]) for x in other_reps],
                   cuts=[dict(kind=o["kind"], text=o.get("text")) for o in cuts], final=R["finalText"])
        if R.get("afterCheck"):
            A = R["afterCheck"]; am = map_words([w["w"] for w in W], [w["w"] for w in A["words"]])
            row["after_heard"] = " ".join(w["w"] for w in A["words"])
            asc = A["pron"].get("scores") or []
            for pr in row["pron_reps"]:
                k2 = am.get(pr["i"])
                pr["after_asr"] = A["words"][k2]["w"] if k2 is not None else None
                pr["after_rescore"] = asc[k2] if k2 is not None and k2 < len(asc) else None
                pr["after_flagged"] = k2 in {p["i"] for p in A["pron"]["items"]}
            row["after_flags"] = [p["word"] for p in A["pron"]["items"]]
            # seams, only for single-splice results (one kept replacement, no cuts) so the joins can be found exactly
            kept = [x for x in R["replaced"] if x["on"]]
            bw = f"{outDir}/{c['id']}_before.wav"; aw = f"{outDir}/{c['id']}_after.wav"
            if len(kept) == 1 and not cuts and os.path.exists(bw):
                b, sb = sf.read(bw, dtype="float32"); a, sa = sf.read(aw, dtype="float32")
                assert sb == sa == SR, (sb, sa)
                L, Ra, Rb = seams(b, a)
                outside = np.concatenate([b[:L], b[Rb:]]); same = np.concatenate([a[:L], a[Ra:]])
                row["untouched"] = dict(L=round(L / SR, 3), Ra=round(Ra / SR, 3), Rb=round(Rb / SR, 3),
                                        op_t0=kept[0]["op"]["t0"], op_t1=kept[0]["op"]["t1"],
                                        max_diff_lsb=round(float(np.abs(outside - same).max() * 32768), 2),
                                        exact_share=round(float(np.mean(outside == same)), 4),
                                        share_untouched=round((len(outside)) / len(b), 3))
                row["seam"] = seam_metrics(a, b, L, Ra, Rb)
        rows.append(row)
    # detection over all mapped words of all clips
    A = [w for w in allw if w["mapped"]]
    bad = [w for w in A if w["acc"] <= 6]; good = [w for w in A if w["acc"] >= 8]
    el_bad = [w for w in bad if w["eligible"]]; el_good = [w for w in good if w["eligible"]]
    preds = [w for w in A if w["eligible"] and w["pred"] is not None]
    S = dict(n_clips=len(rows), n_words=len(allw), n_mapped=len(A),
             bad_words=len(bad), bad_eligible=len(el_bad), bad_flagged=sum(w["flagged"] for w in bad),
             good_words=len(good), good_eligible=len(el_good), good_flagged=sum(w["flagged"] for w in good),
             clips_with_hit=sum(any(b["flagged"] for b in r["bad"]) for r in rows),
             clips_with_false_flag=sum(any(not f["labelled_bad"] for f in r["flags"]) for r in rows),
             auc_pred_vs_label_eligible=auc([-w["pred"] for w in preds], [w["acc"] <= 6 for w in preds]),
             unmapped_bad=[(w["id"], w["word"]) for w in allw if not w["mapped"] and w["acc"] <= 6])
    reps = [p for r in rows for p in r["pron_reps"]]
    S.update(pron_resays=len(reps), resays_on_labelled=sum(p["labelled_bad"] for p in reps), kept=sum(p["kept"] for p in reps),
             kept_on_labelled=sum(p["kept"] and p["labelled_bad"] for p in reps), verified=sum(bool(p["verified"]) for p in reps))
    json.dump(dict(summary=S, rows=rows), open(summaryPath, "w"), indent=1, default=float)
    print(json.dumps(S, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
