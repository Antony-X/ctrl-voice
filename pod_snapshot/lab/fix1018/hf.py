import httpx, sys; cl = httpx.Client(timeout=200); A = "http://127.0.0.1:7860"
for f in sys.argv[1:]:
    u = cl.post(A + "/api/upload", files={"f": (f, open(f, "rb"), "audio/wav")}).json(); sid, W = u["sid"], u["words"]
    print("==", f, "\nHEARD:", " ".join(w["w"] for w in W))
    c = cl.post(A + "/api/s/" + sid + "/clean").json()["items"]; cut = {k for x in c if x["auto"] for k in range(x["i"], x["j"] + 1)}
    print("CUTS:", [(x["kind"], x["text"], x["auto"]) for x in c])
    print("KEPT:", " ".join(w["w"] for k, w in enumerate(W) if k not in cut))
    it = cl.post(A + "/api/s/" + sid + "/intent").json()["items"]; print("MISSPOKEN:", [(x.get("old") or x.get("w"), x.get("new"), x.get("margin") or x.get("score")) for x in it])
    sc = next((k for k, w in enumerate(W) if w["w"].lower().startswith("scratch")), None)
    if sc is not None: print("pause after scratch that:", round(W[sc + 2]["s"] - W[sc + 1]["e"], 2), "word gap (aligner folds pauses into words)")
