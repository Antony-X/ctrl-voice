# ReSpeak

Voice messages you can edit like text: undo the last thought while recording, remove "Monday, no wait, Wednesday" automatically, fix grammar and mispronounced words in your own voice, and change tone. The original recording is never modified; every edit is a time range in an edit list that is rendered when you play or send.

- **Architecture (visual)**: `docs/architecture.html` (open in a browser) · hosted copy: https://claude.ai/artifact/BHqCXAa4bTqss5iu8fhPqf
- **Listening page with all test audio**: `docs/listening_page.html` · hosted copy: https://claude.ai/artifact/Vw2FXXNXYrhobJrQSNtQg2
- **Research reports**: `reports/ReSpeak voice editing feasibility.md` (round 1) and `reports/ReSpeak grammar pronunciation and accent.md` (round 2); sources in `research_notes/`

## Status (measured, see reports for details)

| Feature | Status | Evidence |
|---|---|---|
| Semantic undo while recording, "scratch that" | Works | ~350 ms live; 6/6 on undo tests |
| Clean up (fillers, self-corrections, repeats) | Works | 24/28 exact, 0/10 meaning-changing edits |
| Replace a word in your own voice | Works | dots.tts.edit+splice 10/10, PlayDiffusion+splice 9/10 on real recordings; app uses PlayDiffusion + F5 in parallel with ASR verification, 3-6 s |
| Grammar fix in your own voice | Works (suggestions) | 8/8 fixes rendered and verified on real L2 speakers (EdAcc) |
| Mispronunciation detection | Works on read speech | AUC 0.88, corr. with experts 0.53 (speechocean762) |
| Re-say a word clearly | Works | detector score 4.6-6.1 → 9.0-9.95 |
| "Did you mean...?" (mis-heard words) | Experimental | no net gain yet |
| Tone: natural (pitch & pace) | Works, not listener-validated | 0.1 s, voice untouched |
| Tone: AI restyle | Experimental | voice similarity drops (0.72 for calm with AuK) |
| English accent removal | Does not work (dropped) | no measurable change with AuK |

## Repo layout

| Path | What |
|---|---|
| `app/static/index.html` | The whole UI (recorder, live transcript, undo, suggestions, waveforms, Discord-style chat preview) |
| `app/app.py` | FastAPI server: WebSocket live loop, sessions, all endpoints, verification and retries |
| `app/brain.py` | LLM prompts + validators: undo, clean up, tighten, grammar, did-you-mean |
| `app/render.py` | Edit list → audio: quiet-point cuts, 12 ms crossfades, pause capping, inserts |
| `app/pron.py`, `app/pron_model.pkl` | Pronunciation scorer (wav2vec2 phoneme CTC + GOP features) and the detector trained on speechocean762 |
| `app/prosody.py` | Natural tone presets (Praat PSOLA) |
| `app/editor_service.py` | One small server per voice model: `playdiff`, `f5`, `auk`, `dots` |
| `lab/` | Benchmarks and experiments; `lab/align.py` (forced aligner) is imported by the app |
| `scripts/` | Install / start scripts used on the RunPod pod |
| `docs/` | Architecture and listening pages (self-contained HTML) |

## Running it on a GPU machine

The code assumes this layout on the GPU box (RunPod pod, Ubuntu, CUDA 12.8+, one 80 GB GPU; 48 GB works without the LLM or AuK):

```
/workspace/app      <- app/            /workspace/lab   <- lab/
/workspace/repos    <- model repos     /workspace/envs  <- core + vllm venvs
/workspace/hf       <- HF cache        /workspace/logs, /workspace/app_data
```

1. System packages: `apt-get install -y ffmpeg sox libsndfile1 espeak-ng` and install `uv`.
2. Clone the model repos into `/workspace/repos`: `playht/PlayDiffusion`, `SWivid/F5-TTS`, `Tencent-Hunyuan/AuK`, optionally `studio-dots-ai/dots.tts`.
3. Run `scripts/install_all.sh` (creates the AuK, PlayDiffusion, F5 and core venvs and downloads AuK weights). Then:
   - core venv extras: `uv pip install pyarrow pandas datasets httpx websockets phonemizer scikit-learn`
   - PlayDiffusion venv fixes: `uv pip install "setuptools<81" "pyarrow<15" fastapi uvicorn`
   - every model venv: `uv pip install fastapi uvicorn`
   - vLLM: `uv venv /workspace/envs/vllm/.venv --python 3.12 && uv pip install vllm ninja`
   - dots.tts (optional): `uv pip install -e . -c <constraints without the gradio pin>`
4. Start: `scripts/start_llm.sh` (Qwen3.6-35B-A3B-FP8 on port 8011, needs `--max-num-seqs 16`), then `app/start_services.sh playdiff f5 auk`, then `app/start_app.sh` (port 7860).
5. Open `https://<pod-id>-7860.proxy.runpod.net` in Chrome. Use "Try a sample message" if there is no mic.

Any OpenAI-compatible LLM works: set `LLM_URL`, `LLM_KEY`, `LLM_MODEL` before `start_app.sh`.

Gotchas: start background services over SSH with `ssh -f`; never put a process name literally inside a `pkill` in the same SSH command that relaunches it (use `pkill -f "[u]vicorn app:app"`).

## Licences to check before shipping anything

Fine for a hackathon demo; check before a product: F5-TTS weights CC-BY-NC, PlayDiffusion repo archived, AuK depends on Qwen2.5-Omni-3B (research licence), dots.tts Apache-2.0, speechocean762 CC BY 4.0 / Apache-2.0, EdAcc CC BY-SA 4.0, DisfluencySpeech Apache-2.0, AMI CC BY 4.0.
