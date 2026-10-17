#!/bin/bash
export HF_HOME=/workspace/hf PYTHONUNBUFFERED=1 LLM_URL=${LLM_URL:-http://localhost:8011/v1}
cd /workspace/app && setsid nohup /workspace/envs/core/.venv/bin/uvicorn app:app --host 0.0.0.0 --port 7860 --ws-max-size 16777216 > /workspace/logs/app.log 2>&1 < /dev/null &
