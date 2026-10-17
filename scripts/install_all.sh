export HF_HOME=/workspace/hf UV_CACHE_DIR=/workspace/uvcache PATH=$HOME/.local/bin:$PATH HF_HUB_ENABLE_HF_TRANSFER=1
R=/workspace/repos
( cd $R/AuK && uv venv -q --python 3.10 && . .venv/bin/activate && uv pip install -q -e ".[gradio]" hf_transfer "huggingface_hub[cli]" \
  && hf download tencent/AuK --local-dir ckpts/AuK && hf download tencent/AuK-Flash --local-dir ckpts/AuK-Flash \
  && hf download Qwen/Qwen2.5-Omni-3B --local-dir ckpts/Qwen2.5-Omni-3B && echo AUK_DONE ) > /workspace/logs/auk.log 2>&1 &
( cd $R/PlayDiffusion && uv venv -q --python 3.11 && . .venv/bin/activate && uv pip install -q -e ".[demo]" hf_transfer && echo PD_DONE ) > /workspace/logs/pd.log 2>&1 &
( cd $R/F5-TTS && uv venv -q --python 3.11 && . .venv/bin/activate && uv pip install -q -e . hf_transfer && echo F5_DONE ) > /workspace/logs/f5.log 2>&1 &
( mkdir -p /workspace/envs/core && cd /workspace/envs/core && uv venv -q --python 3.11 && . .venv/bin/activate && uv pip install -q torch torchaudio faster-whisper transformers accelerate speechbrain librosa soundfile pyloudnorm silero-vad jiwer fastapi "uvicorn[standard]" python-multipart numpy scipy hf_transfer openai anthropic praat-parselmouth && echo CORE_DONE ) > /workspace/logs/core.log 2>&1 &
wait
