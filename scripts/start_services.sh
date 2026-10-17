#!/bin/bash
# Starts ReSpeak backends. Usage: start_services.sh [editors...]  (default: playdiff f5 dots auk)
export HF_HOME=/workspace/hf PYTHONUNBUFFERED=1
declare -A VENV=([playdiff]=/workspace/repos/PlayDiffusion [f5]=/workspace/repos/F5-TTS [auk]=/workspace/repos/AuK [dots]=/workspace/repos/dots.tts)
declare -A PORT=([playdiff]=8101 [f5]=8103 [auk]=8102 [dots]=8104)
for e in ${@:-playdiff f5 dots auk}; do
  setsid nohup ${VENV[$e]}/.venv/bin/python /workspace/app/editor_service.py $e ${PORT[$e]} > /workspace/logs/svc_$e.log 2>&1 < /dev/null &
done
