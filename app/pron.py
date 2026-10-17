# Word-level mispronunciation detection with a phoneme CTC model (wav2vec2 espeak IPA).
# Two scores per word: CTC peak posterior of each canonical phone, and an alignment-free GOP
# (log-likelihood of the canonical phones minus the best single-phone substitution/deletion).
import re, numpy as np, torch, torch.nn.functional as F
from transformers import AutoProcessor, Wav2Vec2ForCTC
M = "facebook/wav2vec2-lv-60-espeak-cv-ft"
tok = AutoProcessor.from_pretrained(M).tokenizer
net = Wav2Vec2ForCTC.from_pretrained(M).cuda().eval().half()
V = tok.get_vocab(); IV = {i: p for p, i in V.items()}; BLANK = tok.pad_token_id
_ph = {}
EN = None  # English phone inventory (ids), filled lazily from what the G2P produces


def phones(word):
    w = re.sub(r"[^a-z']", "", word.lower())
    if not w: return []
    if w not in _ph: _ph[w] = [p for p in tok.phonemize(w).split() if p in V]
    return _ph[w]


def emissions(x16):
    with torch.inference_mode():
        return torch.log_softmax(net(torch.tensor(x16, dtype=torch.half)[None].cuda()).logits[0].float(), -1)


def force_align(em, toks):
    """CTC Viterbi over canonical phones -> (start, end) frame per phone."""
    e = em.cpu().numpy(); T, N = e.shape[0], len(toks)
    tr = np.full((T + 1, N + 1), -np.inf); tr[0, 0] = 0; tr[1:, 0] = np.cumsum(e[:, BLANK])
    for t in range(T): tr[t + 1, 1:] = np.maximum(tr[t, 1:] + e[t, BLANK], tr[t, :-1] + e[t, toks])
    j, t, seg = N, int(np.argmax(tr[:, N])), {}
    while j > 0 and t > 0:
        ch = tr[t - 1, j - 1] + e[t - 1, toks[j - 1]] > tr[t - 1, j] + e[t - 1, BLANK]
        seg.setdefault(j - 1, [t - 1, t - 1])[0] = t - 1
        if ch: j -= 1
        t -= 1
    return [tuple(seg.get(i, (0, 0))) for i in range(N)]


def gop_af(E, c, inv):
    """Alignment-free GOP per phone: LL(canonical) - max LL(one phone substituted or deleted)."""
    L = len(c); alts = [c]
    for i in range(L):
        alts += [c[:i] + [q] + c[i + 1:] for q in inv if q != c[i]] + ([c[:i] + c[i + 1:]] if L > 1 else [])
    T = E.shape[0]; n = len(alts); maxl = max(len(a) for a in alts)
    tgt = torch.zeros(n, maxl, dtype=torch.long)
    for k, a in enumerate(alts): tgt[k, :len(a)] = torch.tensor(a)
    ll = -F.ctc_loss(E[:, None, :].expand(T, n, E.shape[1]), tgt.cuda(), torch.full((n,), T, dtype=torch.long), torch.tensor([len(a) for a in alts]),
                     blank=BLANK, reduction="none", zero_infinity=True)
    ll0, out, k = ll[0].item(), [], 1
    for i in range(L):
        m = len([q for q in inv if q != c[i]]) + (1 if L > 1 else 0); seg = ll[k:k + m]; b = int(torch.argmax(seg)); k += m
        cand = [q for q in inv if q != c[i]] + ([None] if L > 1 else [])
        out.append((ll0 - seg[b].item(), IV[cand[b]] if cand[b] is not None else "∅"))
    return out


def score(x16, words, pad=3):
    """words: display strings -> per word dict(peak, gop, phones, worst, heard)."""
    global EN
    em = emissions(x16); toks, wid = [], []
    for k, w in enumerate(words):
        ps = phones(w); toks += [V[p] for p in ps]; wid += [k] * len(ps)
    if EN is None: EN = sorted({V[p] for w in "the quick brown fox jumps over a lazy dog she thinks they measure vision azure church judge yes zoo hat ring look boot foot about bird father caught boy cow pay go see sit bet cat cut far her".split() for p in phones(w)})
    out = [None] * len(words)
    if not toks: return out
    segs = force_align(em, toks); wid = np.array(wid)
    for k in range(len(words)):
        idx = np.where(wid == k)[0]
        if not len(idx): continue
        a, b = segs[idx[0]][0], segs[idx[-1]][1]
        peaks = [float(em[s:e + 1, toks[i]].max()) for i, (s, e) in ((i, segs[i]) for i in idx)]
        E = em[max(0, a - pad):b + pad + 1]
        g = gop_af(E, [toks[i] for i in idx], EN)
        heard = [IV[int(i)] for i in torch.unique_consecutive(E.argmax(1)).tolist() if int(i) != BLANK]
        wi = int(np.argmin([x[0] for x in g]))
        out[k] = dict(peak=min(peaks), gop=min(x[0] for x in g), phones=[IV[toks[i]] for i in idx], worst=wi, sub=g[wi][1], heard=heard,
                      t=(a * 0.02, (b + 1) * 0.02), gops=[x[0] for x in g], peaks=peaks, subs=[x[1] for x in g], frames=b - a + 1)
    return out


def features(o, stats):
    """Per-word feature vector; stats = per-phone (mean, std) of GOP and peak over many words."""
    zg = [(g - stats.get(p, (0, 1))[0]) / stats.get(p, (0, 1))[1] for g, p in zip(o["gops"], o["phones"])]
    zp = [(g - stats.get("pk_" + p, (0, 1))[0]) / stats.get("pk_" + p, (0, 1))[1] for g, p in zip(o["peaks"], o["phones"])]
    ed = levenshtein(o["phones"], o["heard"]) / max(1, len(o["phones"]))
    return [min(zg), float(np.mean(zg)), min(zp), float(np.mean(zp)), o["gop"], o["peak"], ed, len(o["phones"]), o["frames"] / max(1, len(o["phones"]))]


def levenshtein(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, y in enumerate(b, 1): prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (x != y))
    return d[-1]


def fit(x16, text):
    """How well do the canonical phones of `text` explain this audio? (CTC log-likelihood per phone; higher = closer to what was said)."""
    ids = [V[p] for w in text.split() for p in phones(w)]
    if not ids or len(x16) < 1600: return -1e9
    em = emissions(x16)
    if em.shape[0] < len(ids): return -1e9
    ll = -F.ctc_loss(em[:, None, :], torch.tensor([ids]).cuda(), torch.tensor([em.shape[0]]), torch.tensor([len(ids)]), blank=BLANK, reduction="sum", zero_infinity=True)
    return ll.item() / len(ids)
