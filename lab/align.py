# CTC forced alignment (wav2vec2 char model): precise word boundaries for cutting/splicing.
import re, numpy as np, torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
M = "facebook/wav2vec2-large-960h-lv60-self"
proc = Wav2Vec2Processor.from_pretrained(M); net = Wav2Vec2ForCTC.from_pretrained(M).cuda().eval().half()
V = proc.tokenizer.get_vocab(); BLANK = V["<pad>"]
ONES = "zero one two three four five six seven eight nine".split()
def spell(w):
    w = re.sub(r"\d", lambda m: " " + ONES[int(m.group())] + " ", w.upper().replace("%", " PERCENT"))
    return re.sub(r"[^A-Z']", "", w.upper())
def emissions(x16):
    with torch.inference_mode():
        return torch.log_softmax(net(torch.tensor(x16, dtype=torch.half)[None].cuda()).logits[0].float(), -1).cpu().numpy()
def align(x16, words, em=None):
    """words: list of display strings -> list of (start, end) seconds (None for unalignable words)."""
    em = emissions(x16) if em is None else em; T = em.shape[0]; fs = len(x16) / 16000 / T
    toks, wid = [], []
    for k, w in enumerate(words):
        for ch in spell(w): toks.append(V[ch]); wid.append(k)
        toks.append(V["|"]); wid.append(-1)
    toks, wid = np.array(toks[:-1]), np.array(wid[:-1]); N = len(toks)
    if N == 0 or N > T: return [None] * len(words)
    tr = np.full((T + 1, N + 1), -np.inf); tr[0, 0] = 0; tr[1:, 0] = np.cumsum(em[:, BLANK])
    for t in range(T):
        tr[t + 1, 1:] = np.maximum(tr[t, 1:] + em[t, BLANK], tr[t, :-1] + em[t, toks])
    j, t = N, int(np.argmax(tr[:, N])); seg = {}
    while j > 0 and t > 0:
        ch = tr[t - 1, j - 1] + em[t - 1, toks[j - 1]] > tr[t - 1, j] + em[t - 1, BLANK]
        seg.setdefault(j - 1, [t - 1, t - 1])[0] = t - 1
        if ch: j -= 1
        t -= 1
    out = [None] * len(words)
    for ti, (a, b) in seg.items():
        k = wid[ti]
        if k < 0: continue
        s, e = a * fs, (b + 1) * fs
        out[k] = (min(out[k][0], s), max(out[k][1], e)) if out[k] else (s, e)
    return out
def realign(x16, ws):
    """Replace whisper DTW word times with CTC-aligned times (keeps whisper times where alignment fails)."""
    al = align(x16, [w["w"] for w in ws])
    return [dict(w, s=round(a[0], 3), e=round(a[1], 3)) if a else dict(w) for w, a in zip(ws, al)]
