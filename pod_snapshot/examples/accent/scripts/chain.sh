cd /workspace/examples/accent
export HF_HOME=/workspace/examples/accent/hf HF_HUB_OFFLINE=1
L=bengali2,bengali3,cantonese1,farsi1,german3,hindi2,italian3,japanese3,mandarin1,mandarin2,mandarin3,polish2,polish3,portuguese1,portuguese2,portuguese3,russian1,russian2,russian3,spanish1,thai3,turkish1,turkish2,turkish3,vietnamese1,vietnamese2,vietnamese3
venv/bin/python scripts/recut_saa.py $L > recut.log 2>&1
IDS=$(python3 -c "import json;print(\",\".join(c[\"id\"] for c in json.load(open(\"cands_saa3.json\"))))")
venv/bin/python scripts/run_engine.py $IDS > engine_saa3.log 2>&1
echo CHAIN_DONE >> engine_saa3.log
