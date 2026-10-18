# ReSpeak — agent guide

Hackathon project ("Make It Better" track: reinvent an app millions use with an AI-native interaction). ReSpeak makes recorded voice messages (WhatsApp / Telegram / Discord style, not live calls) editable like text while keeping the sender's real voice.

Read these first:
- `docs/PROJECT.md` — the idea, features, pitch, demo script, what to claim to judges
- `docs/HANDOFF.md` — architecture, code map, infrastructure, how to run and rebuild, decisions, known issues, next steps
- `docs/RESULTS.md` — every measurement from the three rounds of experiments
- `reports/` — two long research reports (round 1 product/model landscape, round 2 grammar/pronunciation/accent); sources in `research_notes/`
- `docs/architecture.html` and `docs/listening_page.html` — open in a browser (diagram; all test audio)

## Core design rule
The original recording is never modified. Every edit is a time range in an edit list (`cut` or `insert`) that `app/render.py` renders on play/send. Cuts keep 100% real voice; only replaced words are AI-generated, regenerated from the surrounding audio, spliced back, and verified by re-transcription.

## Code map
- `app/app.py` FastAPI server (port 7860): WebSocket live loop + undo, upload/sample, `/clean`, `/tighten`, `/grammar`, `/replace` (also `same=true` = re-say clearly), `/pron` (pronunciation coach), `/intent` (did-you-mean), `/tone` (AI restyle), `/natural` (pitch & pace), `/render`
- `app/brain.py` LLM prompts + deterministic validators (OpenAI-compatible API, default vLLM Qwen3.6-35B-A3B-FP8 on :8011)
- `app/render.py` edit list → audio; `lab/align.py` CTC forced aligner (imported by the app via `/workspace/lab`)
- `app/pron.py` + `app/pron_model.pkl` pronunciation scorer; `app/prosody.py` natural tone presets
- `app/editor_service.py` voice-model microservices (`playdiff` :8101, `f5` :8103, `auk` :8102, `dots` :8104); `app/stepx_service.py` Step-Audio-EditX (:8105, optional)
- `app/static/index.html` the entire UI
- `lab/` experiments and evaluation scripts; `scripts/` install/start scripts

## Conventions
- Code style: compact, few comments, match the surrounding code.
- Paths assume the GPU box layout `/workspace/{app,lab,repos,envs,hf,app_data,logs}` (see HANDOFF).
- Write shell scripts with LF line endings (`.gitattributes` enforces LF); a CRLF shebang breaks them on Linux.
- Be honest about results: several features are experimental; RESULTS.md says which. Do not inflate numbers in demo copy.

## Running state (as of 2026-10-18)
- RunPod pod `xjdypx6zst9jkd` ("respeak-lab-migration", A100 80 GB, community, $1.39/hr) runs the full stack; engine URL `https://xjdypx6zst9jkd-7860.proxy.runpod.net`. It replaced `zaa3ajj8o85hhq` (see `docs/HANDOFF.md`). It bills while running — check its state (RunPod console or MCP) before assuming the URL works. Stop it when idle.
- SSH from a new machine: add your public key in RunPod settings, restart the pod or use the web terminal; the direct SSH host/port changes on every restart.
