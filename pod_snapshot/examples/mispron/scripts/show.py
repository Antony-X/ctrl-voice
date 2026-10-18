# Print the clips where autoFix replaced something, with the fields used to pick the example.
import json, sys
S = json.load(open(sys.argv[1]))
keys = ["id", "text", "heard", "bad", "flags", "pron_reps", "other_reps", "cuts", "after_heard", "untouched", "seam"]
for r in S["rows"]:
    if r["pron_reps"] or r["other_reps"]:
        for p in r.get("pron_reps", []):
            for c in p.get("cands", []): c.pop("heard", None) if not c.get("ok") else None
        print(json.dumps({k: r.get(k) for k in keys}))
        print()
