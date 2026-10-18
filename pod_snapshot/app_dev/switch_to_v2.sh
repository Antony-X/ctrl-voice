#!/bin/bash
# Switch the engine on :7860 from /workspace/app (live) to /workspace/app_dev (pipeline v2).
# Same launch as /workspace/app/start_app.sh, only the folder and the log file differ. Undo: bash /workspace/app_dev/rollback.sh
# Any recording in progress is lost; saved sessions reload from /workspace/app_data.
set -u
PAT="uvicorn app:app --host 0.0.0.0 --port 7860"
OLD=$(pgrep -f "$PAT" | head -1)
if [ -n "$OLD" ]; then
  LU=$(tr '\0' '\n' < /proc/$OLD/environ | grep '^LLM_URL=' | cut -d= -f2-)
  LM=$(tr '\0' '\n' < /proc/$OLD/environ | grep '^LLM_MODEL=' | cut -d= -f2-)
  echo "stopping engine pid $OLD (cwd $(readlink /proc/$OLD/cwd))"
  kill "$OLD"
  for i in $(seq 1 60); do kill -0 "$OLD" 2>/dev/null || break; sleep 0.25; done
  kill -0 "$OLD" 2>/dev/null && kill -9 "$OLD"
fi
export HF_HOME=/workspace/hf PYTHONUNBUFFERED=1 LLM_URL=${LU:-http://localhost:8011/v1} ENGINES=${ENGINES:-playdiff:8101,f5:8103,auk:8102,dots:8104}
[ -n "${LM:-}" ] && export LLM_MODEL="$LM"
cd /workspace/app_dev && setsid nohup /workspace/envs/core/.venv/bin/uvicorn app:app --host 0.0.0.0 --port 7860 --ws-max-size 16777216 >> /workspace/logs/app_v2.log 2>&1 < /dev/null &
t0=$(date +%s)
until curl -s -o /dev/null -m 2 http://127.0.0.1:7860/api/auth; do
  sleep 1
  if [ $(( $(date +%s) - t0 )) -gt 240 ]; then echo "v2 not up after 240 s: run  bash /workspace/app_dev/rollback.sh"; exit 1; fi
done
echo "v2 engine up on :7860 after $(( $(date +%s) - t0 )) s (pid $(pgrep -f "$PAT" | head -1), log /workspace/logs/app_v2.log)"
