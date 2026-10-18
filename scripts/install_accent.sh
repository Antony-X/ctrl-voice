set -x
export UV_CACHE_DIR=/root/.cache/uv
cd /workspace/envs/accent
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python torch==2.14.1 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130
uv pip install --python .venv/bin/python "transformers>=4.46,<4.50" librosa munch einops soundfile pyyaml hydra-core "huggingface_hub<1.0" scipy fastapi uvicorn faster-whisper f5-tts==1.1.22 pydub jiwer
uv pip install --python .venv/bin/python torch==2.14.1 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130
.venv/bin/python -c "import torch, torchaudio, transformers, f5_tts, faster_whisper; print(torch.__version__, torchaudio.__version__, transformers.__version__, torch.cuda.is_available())"
echo DONE
