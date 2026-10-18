#!/bin/bash
# run one mocked end-to-end variant on 127.0.0.1:8765 (CPU only), then stop the test server
V=$1; PY=/workspace/envs/core/.venv/bin/python
cd /workspace/v2test
CUDA_VISIBLE_DEVICES="" OMP_NUM_THREADS=4 LLM_URL=http://localhost:8011/v1 nice $PY e2e_mock.py 8765 $V > mock_$V.log 2>&1 &
SP=$!
for i in $(seq 1 120); do curl -s -o /dev/null -m 1 http://127.0.0.1:8765/api/auth && break; sleep 0.5; done
echo "=== variant $V (server ready after ~$((i/2)) s)"
nice $PY e2e_client.py 8765
kill $SP; wait $SP 2>/dev/null
grep -n "error\|Error\|Traceback\|final sent" mock_$V.log | head -20
