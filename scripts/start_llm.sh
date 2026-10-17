#!/bin/bash
cd /workspace/envs/vllm && . .venv/bin/activate
export HF_HOME=/workspace/hf HF_HUB_ENABLE_HF_TRANSFER=1
M=${1:-Qwen/Qwen3.6-35B-A3B-FP8}
hf download $M > /workspace/logs/dl_llm.log 2>&1
exec vllm serve $M --port 8011 --gpu-memory-utilization ${2:-0.5} --max-model-len 8192 --served-model-name llm --max-num-seqs 16 --limit-mm-per-prompt '{"image":0,"video":0}'
