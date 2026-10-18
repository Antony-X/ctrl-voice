# Write the candidate clips as their original WAV bytes, in survey priority order.
import json, os
import pyarrow.parquet as pq

BASE = "/workspace/examples/mispron"
C = json.load(open(f"{BASE}/cands.json"))
C = [c for c in C if 2.5 <= c["dur"] <= 8]
C.sort(key=lambda c: (len(c["bad"]), min(b["acc"] for b in c["bad"]), -c["utt_acc"], c["dur"]))
rows = pq.read_table(f"{BASE}/data/so762_test.parquet").to_pylist()
os.makedirs(f"{BASE}/clips", exist_ok=True)
for c in C:
    c["id"] = "so762_{}_{}".format(c["row"], c["speaker"])
    b = rows[c["row"]]["audio"]["bytes"]
    assert b[:4] == b"RIFF", b[:4]
    open(f"{BASE}/clips/{c['id']}.wav", "wb").write(b)
json.dump(C, open(f"{BASE}/manifest.json", "w"), indent=1)
print(len(C), "clips")
