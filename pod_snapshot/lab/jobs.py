# Edit jobs: replace a phrase (by words in the ASR transcript) with new text.
import json, re
import os
W = json.load(open(os.environ.get("WORDS", "/workspace/data/clips/asr_words_aligned.json")))
JOBS = [
    ("libri_1320-122617-0000", "Hawkeye", "Michael"),
    ("libri_260-123440-0010", "fishes", "children"),
    ("libri_5639-40744-0002", "rudely and insolently", "politely and kindly"),
    ("libri_6930-75918-0004", "brilliant", "peaceful"),
    ("ami_FEO070_0", "doing stuff", "the design"),
    ("ami_MEE073_3", "irrelevant", "important"),
    ("ami_FEO072_1", "integrate", "remove"),
    ("disfl_015", "not good", "really good"),
    ("disfl_011", "whole thing", "whole point"),
    ("disfl_016", "always thought", "never thought"),
]
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
def build(clip, old, new):
    ws = W[clip]; ow = [norm(x) for x in old.split()]
    toks = [norm(w["w"]) for w in ws]
    for i in range(len(toks)):
        if toks[i:i + len(ow)] == ow: break
    else: raise ValueError(f"{old} not in {clip}")
    j = i + len(ow) - 1
    text = " ".join(w["w"] for w in ws)
    pre, post = ws[:i], ws[j + 1:]
    # keep trailing punctuation of the last replaced word
    tail = re.sub(r"^.*?([.,!?;:]*)$", r"\1", ws[j]["w"])
    new_words = new.split(); new_words[-1] += tail
    new_text = " ".join([w["w"] for w in pre] + new_words + [w["w"] for w in post])
    return dict(id=f"{clip}__{norm(new.replace(' ', '_'))}", clip=clip, path=f"/workspace/data/clips/{clip}.wav",
                words=ws, i=i, j=j, old=old, new=new, text=text, new_text=new_text,
                t0=ws[i]["s"], t1=ws[j]["e"], new_dur=(ws[j]["e"] - ws[i]["s"]) * max(len(new), 3) / max(len(old), 3))
def jobs(): return [build(*j) for j in JOBS]
if __name__ == "__main__":
    for j in jobs(): print(j["id"], j["t0"], j["t1"], round(j["new_dur"], 2), "|", j["new_text"])
