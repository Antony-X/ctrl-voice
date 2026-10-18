import time, brain_gem as b
for s in ["um so I wanted to buy apples no no I meant oranges", "can you call me at two uh sorry three", "hey sam um can you be more specific"]:
    for m in ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"]:
        b.GEMINI_MODEL = m; t = time.time()
        try: r = b.gemini(b.MEANT_SYS, s); print(m, round(time.time()-t, 2), r)
        except Exception as e: print(m, round(time.time()-t, 2), "ERR", repr(e)[:400])
