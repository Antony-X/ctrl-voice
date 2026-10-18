#!/bin/bash
# Put the original engine (/workspace/app, started by its own start_app.sh) back on :7860.
set -u
PAT="uvicorn app:app --host 0.0.0.0 --port 7860"
CUR=$(pgrep -f "$PAT" | head -1)
if [ -n "$CUR" ]; then
  LU=$(tr '\0' '\n' < /proc/$CUR/environ | grep '^LLM_URL=' | cut -d= -f2-)
  echo "stopping engine pid $CUR (cwd $(readlink /proc/$CUR/cwd))"
  kill "$CUR"
  for i in $(seq 1 60); do kill -0 "$CUR" 2>/dev/null || break; sleep 0.25; done
  kill -0 "$CUR" 2>/dev/null && kill -9 "$CUR"
fi
export LLM_URL=${LU:-http://localhost:8011/v1}
[ -f /workspace/logs/app.log ] && cp /workspace/logs/app.log /workspace/logs/app.log.before_rollback_$(date +%H%M%S)  # start_app.sh overwrites it
bash /workspace/app/start_app.sh
t0=$(date +%s)
until curl -s -o /dev/null -m 2 http://127.0.0.1:7860/api/auth; do
  sleep 1
  if [ $(( $(date +%s) - t0 )) -gt 240 ]; then echo "original engine not up after 240 s; see /workspace/logs/app.log"; exit 1; fi
done
echo "original engine up on :7860 after $(( $(date +%s) - t0 )) s (pid $(pgrep -f "$PAT" | head -1), log /workspace/logs/app.log)"
