"""Untouched-audio check (original vs rendered) and Confident-Strong tone measurements."""
import json, sys, numpy as np, soundfile as sf, librosa
from scipy.signal import fftconvolve
SR = 24000; LSB = 1 / 32768
def load(p):
    x, sr = sf.read(p, dtype="float32"); x = x.mean(1) if x.ndim > 1 else x
    return librosa.resample(x, orig_sr=sr, target_sr=SR) if sr != SR else x

def untouched(orig, out, ops, dur):
    """Kept spans of the original (outside cut/replace ranges) located in the output; sample-level comparison."""
    ops = sorted(ops, key=lambda o: o["t0"]); edges = [0.0]
    for o in ops: edges += [o["t0"], o["t1"]]
    edges.append(dur); res = []; pos = 0
    for k in range(0, len(edges), 2):
        a, b = edges[k], edges[k + 1]
        # shrink internal edges by 60 ms: cut points snap to the quietest frame within +-40 ms and get a 12 ms crossfade
        a2 = a + (0.06 if k > 0 else 0); b2 = b - (0.06 if k + 2 < len(edges) else 0)
        if b2 - a2 < 0.1: continue
        seg = orig[int(a2 * SR):int(b2 * SR)]
        probe = seg[len(seg) // 2 - min(len(seg) // 2, SR // 4): len(seg) // 2 + min(len(seg) // 2, SR // 4)]
        c = fftconvolve(out, probe[::-1], mode="valid"); off = int(np.argmax(c)) - (len(seg) // 2 - min(len(seg) // 2, SR // 4))
        lo, hi = max(0, off), min(len(out), off + len(seg))
        d = out[lo:hi] - seg[lo - off:hi - off]
        same = np.abs(d) <= LSB * 1.01
        # longest identical run (silence the renderer trims from a pause before a cut shows up as non-identical at the edge)
        best = run = 0
        for v in same: run = run + 1 if v else 0; best = max(best, run)
        res.append(dict(span=[round(a2, 2), round(b2, 2)], sec=round(len(seg) / SR, 2), out_at=round(off / SR, 2), max_abs_diff=float(np.abs(d).max()),
                        identical_frac=round(float(same.mean()), 4), longest_identical_sec=round(best / SR, 2),
                        corr=round(float(np.corrcoef(out[lo:hi], seg[lo - off:hi - off])[0, 1]), 6)))
    return res

def prosody(x):
    f0, vf, _ = librosa.pyin(x, fmin=60, fmax=450, sr=SR, frame_length=2048, hop_length=240)
    f = f0[vf & ~np.isnan(f0)]; st = 12 * np.log2(f / np.median(f))
    rms = librosa.feature.rms(y=x, frame_length=1024, hop_length=240)[0]; thr = max(1e-3, np.percentile(rms, 90) * 0.1)
    return dict(dur=round(len(x) / SR, 2), speech_sec=round(float((rms > thr).sum() * 240 / SR), 2), f0_median=round(float(np.median(f)), 1),
                f0_range_st=round(float(np.percentile(st, 95) - np.percentile(st, 5)), 2), f0_sd_st=round(float(st.std()), 2),
                rms_db=round(float(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)), 1))

out = {}
for tag, before in [a.split("=") for a in sys.argv[1:]]:
    R = json.load(open(f"out/{tag}.json", encoding="utf-8")); orig, after, conf = load(before), load(f"out/{tag}_after.wav"), load(f"out/{tag}_confident.wav")
    u = untouched(orig, after, R["renderOps"], R["dur"])
    pa, pc = prosody(after), prosody(conf)
    out[tag] = dict(untouched=u, after=pa, confident=pc,
                    f0_change_pct=round(100 * (pc["f0_median"] / pa["f0_median"] - 1), 1),
                    f0_change_st=round(12 * np.log2(pc["f0_median"] / pa["f0_median"]), 2),
                    dur_change_pct=round(100 * (pc["dur"] / pa["dur"] - 1), 1),
                    speech_change_pct=round(100 * (pc["speech_sec"] / pa["speech_sec"] - 1), 1),
                    orig_prosody=prosody(orig))
    tot = sum(s["sec"] for s in u); worst = max(s["max_abs_diff"] for s in u)
    print(f"{tag}: kept spans {len(u)} ({tot:.2f}s), max|diff| {worst:.2e} (1 LSB={LSB:.2e}), min corr {min(s['corr'] for s in u):.6f}, "
          f"identical {sum(s['identical_frac']*s['sec'] for s in u)/tot:.4f}")
    print(f"   tone: F0 {pa['f0_median']}->{pc['f0_median']} Hz ({out[tag]['f0_change_st']} st), range {pa['f0_range_st']}->{pc['f0_range_st']} st, "
          f"dur {pa['dur']}->{pc['dur']} s ({out[tag]['dur_change_pct']}%), speech {pa['speech_sec']}->{pc['speech_sec']} s, rms {pa['rms_db']}->{pc['rms_db']} dB")
json.dump(out, open("out/analysis.json", "w"), indent=1)
