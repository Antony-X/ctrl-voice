# CPU metrics for engine outputs: accent-ID after, held-out speaker similarity, WER (independent re-transcription), quality.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lib import *

cands = {c["id"]: c for f in ("cands.json", "cands_saa3.json") if os.path.exists(f"{ROOT}/{f}") for c in json.load(open(f"{ROOT}/{f}"))}
eng = json.load(open(f"{ROOT}/engine_results.json"))
mp = f"{ROOT}/metrics_after.json"
M = json.load(open(mp)) if os.path.exists(mp) else {}
only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
for cid, r in eng.items():
    if cid in M or cid not in cands or (only and cid not in only): continue
    c = cands[cid]
    x0 = load16(f"{ROOT}/cands/{cid}.wav"); y = load16(r["after"])
    he = np.load(f"{ROOT}/cands/held/{cid}_emb.npy")
    e0, e1 = emb(x0), emb(y)
    hyp = transcribe(y)
    M[cid] = dict(dur_after=round(len(y) / 16000, 2), acc_after=accent(y), quality_after=quality(y), asr_after=hyp,
                  wer_after_vs_sent=wer(r["accent_body"]["text"], hyp), wer_after_vs_ref=wer(c["text_ref"], hyp),
                  sim_heldout_after=round(float(e1 @ he), 3), sim_before_after_cpu=round(float(e1 @ e0), 3),
                  engine_voice_sim=r["accent"]["voice_sim"], engine_words_kept=r["accent"]["words_kept"])
    m = M[cid]
    print(f"{cid:28s} {c['l1']:11s} dur {c['dur']:5.2f}->{m['dur_after']:5.2f}  Pnat {c['acc_before']['p_native']:.2f}->{m['acc_after']['p_native']:.2f} "
          f"top {c['acc_before']['top']}->{m['acc_after']['top']}  sim eng {m['engine_voice_sim']:.3f} held {m['sim_heldout_after']:.3f} (ceil {c['ceiling_sim']:.3f}) "
          f"kept {m['engine_words_kept']} wer {m['wer_after_vs_sent']}", flush=True)
    json.dump(M, open(mp, "w"), indent=1)
