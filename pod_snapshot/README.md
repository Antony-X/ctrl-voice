# Pod snapshot (2026-10-18)

Code and results that existed only on the engine pod `xjdypx6zst9jkd` (`/workspace`), saved before the pod was stopped. Paths mirror `/workspace`. Nothing here is imported by the live app; the live engine code is `app/` and was identical to the pod's `/workspace/app` at the time of the snapshot.

| Folder | What |
|---|---|
| `app_dev/` | **Engine v2, not deployed.** Only `app.py` and `brain.py` differ from `app/`: a "say what the speaker finally meant" clean-up prompt (more retraction phrases such as "delete that", "forget I said that"; `redundant` and `aside` kinds; ordinals protected as numbers), optional thinking and a parallel sentence-level pass (`CLEAN_THINK`, `CLEAN_PARTS`), an optional Gemini endpoint for evaluation (`LLM_KEY_FILE`), a recognizer bias for "scratch that" (`CMD_BIAS=1`), and a stop-recording fix (no interleaved WebSocket frames, the final transcript is always sent). `switch_to_v2.sh` swaps the engine on :7860 to `/workspace/app_dev`, `rollback.sh` swaps back. |
| `v2test/` | End-to-end and mock tests for v2's "scratch that" handling, with their logs. |
| `lab/cleaneval*/` | Clean-up prompt evaluations (Qwen v1, v2, "meant", thinking; Gemini Flash and Lite) and their results. |
| `lab/wordfix/`, `lab/fix1018/`, `lab/tonefix/` | Word re-render sweeps and fixes from 2026-10-18. |
| `lab/*.py` | Pod versions of `accent_eval.py`, `eval_round3.py`, `jobs.py`, `tone_eval.py` (differ from the copies in `/lab`). |
| `examples/` | Scripts and result tables that built the demo examples (accent, mispronunciation, tone). Audio is not included. |
| `accent/` | Accent prototype scripts and metrics. |
| `out/` | Round 1-3 benchmark logs and result tables. |

Not saved here (too big for git; it stays on the pod's `/workspace` volume, which survives a stop): audio in `data/` (1.7 GB), `examples/` (3 GB, mostly audio and venvs), `app_data/` (1.3 GB of recorded sessions), and model weights and venvs (`hf/`, `models/`, `envs/`, `repos/`), which the README install steps rebuild. Secrets (`app/.access_key`, `app/.gemini_key`) were left out on purpose. L2-ARCTIC transcripts were left out (dataset licence).
