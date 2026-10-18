# Merge before / engine / after metrics into one table, sorted for picking.
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import ROOT, wer

cands = {c["id"]: c for f in ("cands.json", "cands_saa3.json") if os.path.exists(f"{ROOT}/{f}") for c in json.load(open(f"{ROOT}/{f}"))}
eng = json.load(open(f"{ROOT}/engine_results.json"))
M = json.load(open(f"{ROOT}/metrics_after.json"))
rows = []
for cid, m in M.items():
    c, r = cands[cid], eng[cid]
    rows.append(dict(id=cid, l1=c["l1"], src=c["source"][:5], dur0=c["dur"], dur1=m["dur_after"],
                     pn0=c["acc_before"]["p_native"], top0=c["acc_before"]["top"], pn1=m["acc_after"]["p_native"], top1=m["acc_after"]["top"],
                     sim=r["accent"]["voice_sim"], held=m["sim_heldout_after"], ceil=c["ceiling_sim"], kept=r["accent"]["words_kept"],
                     asr_ok=wer(c["text_ref"], r["accent_body"]["text"]), wer1=m["wer_after_vs_ref"], floor=c["quality"]["floor_db"],
                     fill=c["fillers"]))
ok = lambda x: x["kept"] >= 0.99 and (x["wer1"] or 0) <= 0.1 and x["pn0"] < 0.5 and x["pn1"] > 0.7 and 6 <= x["dur0"] <= 12.5
rows.sort(key=lambda x: (not ok(x), -x["sim"]))
hdr = "ok id l1 dur0 dur1 pn0 top0 pn1 top1 sim held ceil kept asrWER wer1 floor fill".split()
print(" | ".join(hdr))
for x in rows:
    print(" | ".join(str(v) for v in ["Y" if ok(x) else "-", x["id"], x["l1"], x["dur0"], x["dur1"], x["pn0"], x["top0"], x["pn1"], x["top1"],
                                       x["sim"], x["held"], x["ceil"], x["kept"], x["asr_ok"], x["wer1"], x["floor"], x["fill"]]))
json.dump(rows, open(f"{ROOT}/ranked.json", "w"), indent=1)
