import sys, collections, traceback; sys.argv = ["eval_clean.py"]
import eval_clean as E, brain_gem as b
errs = collections.Counter(); ex = {}
for g, s, alts in E.CASES:
    try: b.clean_meant(E.W(s))
    except Exception as e:
        k = type(e).__name__ + ": " + str(e)[:160]; errs[k] += 1; ex.setdefault(k, (s[:90], traceback.format_exc().strip().splitlines()[-3:]))
for k, n in errs.most_common(): print(n, k, "\n   e.g.", ex[k][0], "\n  ", ex[k][1])
print("total cases", len(E.CASES), "errors", sum(errs.values()))
