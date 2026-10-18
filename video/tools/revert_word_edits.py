"""Rebuild the auto-fix render (cuts only) from a later render that also has word edits.

Why this exists: the e2e run that produced the placeholder message first auto-fixed it
(4 cuts, 18.36 s -> 10.643 s), then exercised the editor: Replace "Wednesday" -> "Thursday",
Say clearly "cafe", and a confident tone on "see you then!". Only the final render
(<id>.edit.wav) was kept on disk, so it says "Thursday". The film is about the auto-fix,
so this tool puts the original audio back into the three engine-made slots.

How: outside its engine-made slots (message.output.ai), the render is the original
recording copied sample-for-sample at a constant offset per stretch. For each slot we
find the offsets of the stretches on both sides, fill the slot with the original audio
between them minus any on-cut inside, and join with short fades. The join silence at
a cut inside a slot is chosen so the result is as long as the measured auto-fix render.

Only for preparing the placeholder. A fresh recording that is only auto-fixed does not
need it: its edit.wav already is the cuts-only render.

  python tools/revert_word_edits.py <message.json> <original.wav> <edit.wav> <out.wav> [target_sec]
"""
import json
import sys

import numpy as np
import soundfile as sf

WIN, HOP = 0.03, 0.01           # alignment window and hop, seconds
PURE = 0.999                    # normalized correlation that counts as an exact copy
FADE = 0.008                    # seconds, fades at joins inside a slot


def ncc_at(y, x, k, shift, w):
    """Correlation of y[k:k+w] with x[k+shift : k+shift+w]."""
    j = k + shift
    if j < 0 or j + w > len(x):
        return -1.0
    a, b = y[k:k + w], x[j:j + w]
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na < 1e-4 or nb < 1e-4:
        return None  # too quiet to tell
    return float(a @ b / (na * nb))


def candidate_shifts(x, y, sr):
    """Offsets (orig - out, in samples) found by brute-force matching of loud windows."""
    from scipy.signal import correlate
    w = int(0.04 * sr)
    cs = np.concatenate([[0], np.cumsum(x ** 2)])
    shifts = set()
    for k in range(0, len(y) - w, int(0.1 * sr)):
        seg = y[k:k + w]
        if np.linalg.norm(seg) < 0.2:
            continue
        c = correlate(x, seg, mode="valid", method="fft")
        n = c / (np.sqrt(cs[w:] - cs[:-w] + 1e-12) * np.linalg.norm(seg) + 1e-12)
        j = int(np.argmax(n))
        if n[j] > PURE:
            shifts.add(j - k)
    return sorted(shifts)


def label_windows(x, y, sr, shifts):
    """Per hop: (time, shift) of an exact copy, 'quiet', or None (engine-made audio)."""
    w, h = int(WIN * sr), int(HOP * sr)
    out = []
    for k in range(0, len(y) - w, h):
        best, quiet = None, False
        for s in shifts:
            v = ncc_at(y, x, k, s, w)
            if v is None:
                quiet = True
            elif v > PURE:
                best = s
                break
        out.append((k, best if best is not None else ("quiet" if quiet else None)))
    return out, w


def main():
    msg_path, orig_path, edit_path, out_path = sys.argv[1:5]
    target = float(sys.argv[5]) if len(sys.argv) > 5 else None
    msg = json.load(open(msg_path, encoding="utf-8"))
    x, sr = sf.read(orig_path, dtype="float64")
    y, sr2 = sf.read(edit_path, dtype="float64")
    assert sr == sr2
    shifts = candidate_shifts(x, y, sr)
    print("offsets found (s):", [round(s / sr, 3) for s in shifts])
    labels, w = label_windows(x, y, sr, shifts)

    cuts = [o for o in msg["ops"] if o.get("type") == "cut" and o.get("on")]
    slots = msg.get("output", {}).get("ai") or []
    pieces, pos = [], 0          # output pieces in order; pos = read position in y (samples)
    fills = []
    pure = [(k, s) for k, s in labels if isinstance(s, (int, np.integer))]
    slack = int(0.04 * sr)          # message.output.ai times are approximate
    for s0, s1 in slots:
        k0, k1 = int(s0 * sr), int(s1 * sr)
        ka, sb = [p for p in pure if p[0] + w <= k0 + slack][-1]   # last exact copy before the slot
        kb, sa = [p for p in pure if p[0] >= k1 - slack][0]        # first exact copy after it
        a = ka + w                                  # y is an exact copy up to here
        b = kb                                      # y is an exact copy from here on
        oa, ob = a + sb, b + sa                     # the same instants in the original
        keep = [(oa, ob)]
        inner = []
        for c in cuts:
            c0, c1 = int(c["t0"] * sr), int(c["t1"] * sr)
            if oa < c1 and c0 < ob:
                inner.append(c)
                nxt = []
                for p, q in keep:
                    if c0 > p:
                        nxt.append((p, min(q, c0)))
                    if c1 < q:
                        nxt.append((max(p, c1), q))
                keep = nxt
        r3 = lambda v: round(float(v), 3)
        fills.append({"slot": [s0, s1], "out": [r3(a / sr), r3(b / sr)], "orig": [r3(oa / sr), r3(ob / sr)],
                      "shift_before": r3(sb / sr), "shift_after": r3(sa / sr),
                      "keep": [(r3(p / sr), r3(q / sr)) for p, q in keep], "cuts_inside": [c["kind"] for c in inner]})
        pieces.append(y[pos:a])
        parts = [x[p:q].copy() for p, q in keep]
        f = int(FADE * sr)
        for i, part in enumerate(parts):
            if i > 0:
                part[:f] *= np.linspace(0, 1, f)
            if i < len(parts) - 1:
                part[-f:] *= np.linspace(1, 0, f)
        pieces.append(("fill", parts))
        pos = b
    pieces.append(y[pos:])

    # Join silence at cuts inside slots: as the engine does, a short gap; sized to hit target.
    n_joins = sum(len(p[1]) - 1 for p in pieces if isinstance(p, tuple))
    base = sum(len(p) if not isinstance(p, tuple) else sum(len(q) for q in p[1]) for p in pieces)
    gap = 0
    if target and n_joins:
        gap = max(0, int(round((target * sr - base) / n_joins)))
    out = []
    for p in pieces:
        if isinstance(p, tuple):
            for i, part in enumerate(p[1]):
                if i > 0:
                    out.append(np.zeros(gap))
                out.append(part)
        else:
            out.append(p)
    z = np.concatenate(out)
    sf.write(out_path, z.astype(np.float32), sr, subtype="PCM_16")
    for f in fills:
        print(json.dumps(f, default=float))
    print(f"join gap {gap / sr:.3f} s x {n_joins}; edit {len(y) / sr:.3f} s -> rebuilt {len(z) / sr:.3f} s"
          + (f" (target {target:.3f})" if target else ""))


if __name__ == "__main__":
    main()
