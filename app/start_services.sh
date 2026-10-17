#!/bin/bash
# Starts ReSpeak backends. Usage: start_services.sh [editors...]  (default: playdiff f5 dots auk)
export HF_HOME=/workspace/hf PYTHONUNBUFFERED=1
declare -A VENV=([stepx]=/workspace/repos/Step-Audio-EditX [playdiff]=/workspace/repos/PlayDiffusion [f5]=/workspace/repos/F5-TTS [auk]=/workspace/repos/AuK [dots]=/workspace/repos/dots.tts)
declare -A PORT=([stepx]=8105 [playdiff]=8101 [f5]=8103 [auk]=8102 [dots]=8104)
for e in ${@:-playdiff f5 stepx}; do
  if [ "$e" = stepx ]; then setsid nohup ${VENV[stepx]}/.venv/bin/python /workspace/app/stepx_service.py ${PORT[stepx]} > /workspace/logs/svc_stepx.log 2>&1 < /dev/null & continue; fi
  setsid nohup ${VENV[$e]}/.venv/bin/python /workspace/app/editor_service.py $e ${PORT[$e]} > /workspace/logs/svc_$e.log 2>&1 < /dev/null &
done
