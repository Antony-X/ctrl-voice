# Pick candidate segments per group from saved metadata and fetch their audio (only needed row groups).
import io, json, sys, collections
import numpy as np, soundfile as sf
import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem

rows = json.load(open("/workspace/accent/edacc_val_meta.json"))
groups = {"russian": lambda r: r["l1"] == "Russian",
          "indian": lambda r: r["l1"] == "Indian English" or r["accent"] == "Indian English",
          "native": lambda r: r["l1"] == "Mainstream US English"}
for g, f in groups.items():
    c = collections.Counter((r["speaker"], r["gender"], r["accent"], r["raw_accent"]) for r in rows if f(r))
    print(g, c.most_common())
cands = []
for g, f in groups.items():
    sel = [r for r in rows if f(r) and "<" not in r["text"] and 22 <= len(r["text"].split()) <= 50]
    print(g, len(sel), "text-candidates")
    cands += [(g, r) for r in sel[:40]]
fs = HfFileSystem()
need = collections.defaultdict(list)
for g, r in cands:
    need[(r["file"], r["rg"])].append((g, r))
out = []
for (fn, rg), lst in need.items():
    pf = pq.ParquetFile(fs.open(fn, block_size=1 << 20))
    aud = pf.read_row_group(rg, columns=["audio"]).column("audio").to_pylist()
    for g, r in lst:
        a = aud[r["idx"]]
        x, sr = sf.read(io.BytesIO(a["bytes"]))
        if x.ndim > 1: x = x.mean(1)
        d = len(x) / sr
        if 8 <= d <= 20:
            name = f"{g}_{r['speaker']}_{r['rg']}_{r['idx']}"
            sf.write(f"/workspace/accent/cands/{name}.wav", x.astype(np.float32), sr)
            out.append(dict(name=name, group=g, dur=round(d, 2), sr=sr, path=a.get("path"), **{k: r[k] for k in ("speaker", "gender", "accent", "raw_accent", "l1", "text", "file", "rg", "idx")}))
            print(name, round(d, 1), sr, a.get("path"), r["text"][:90])
json.dump(out, open("/workspace/accent/cands.json", "w"), indent=1)
