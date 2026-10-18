# Scan EdAcc validation parquet metadata (range reads only), list candidate segments.
import json, re, sys
import pyarrow.parquet as pq
from huggingface_hub import HfFileSystem

fs = HfFileSystem()
files = sorted(fs.glob("datasets/edinburghcstr/edacc/data/validation-*.parquet"))
rows = []
for fi, f in enumerate(files):
    pf = pq.ParquetFile(fs.open(f, block_size=1 << 20))
    for rg in range(pf.num_row_groups):
        t = pf.read_row_group(rg, columns=["speaker", "text", "accent", "raw_accent", "gender", "l1"]).to_pylist()
        for i, r in enumerate(t):
            r.update(file=f, rg=rg, idx=i)
            rows.append(r)
    print(f, pf.num_row_groups, len(rows), file=sys.stderr)
json.dump(rows, open("/workspace/accent/edacc_val_meta.json", "w"))
want = lambda r: r["l1"] in ("Russian", "Indian English", "Mainstream US English", "Southern British English")
for r in rows:
    nw = len(r["text"].split())
    if want(r) and 25 <= nw <= 60:
        print(r["l1"], "|", r["accent"], "|", r["speaker"], r["gender"], fi, r["rg"], r["idx"], nw, "|", r["text"][:120])
