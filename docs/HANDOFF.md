# ReSpeak — technical handoff

Everything needed to continue the work on another machine or with another agent. Written 2026-10-18.

## 1. What exists
- A working web app (FastAPI + one HTML file) running on a RunPod GPU pod, covering: live transcript while recording, semantic undo and "scratch that", clean up, tighten, word replacement in the speaker's voice, grammar fixes, pronunciation coach (detect + re-say), did-you-mean, natural and AI tone, send to a mock chat.
- Benchmarks on real human speech for each feature (`docs/RESULTS.md`), two research reports (`reports/`), a listening page with all audio (`docs/listening_page.html`), an architecture diagram (`docs/architecture.html`).
- GitHub: https://github.com/Antony-X/respeak (private).

## 2. Architecture (one paragraph per stage)
See `docs/architecture.html` for the diagrams.
1. **Recording.** The browser captures 24 kHz mono through an AudioWorklet and streams PCM16 chunks (~100 ms) over a WebSocket (`/ws/{sid}`). The server keeps an append-only buffer per session.
2. **Live transcript.** Every 0.7 s the server re-transcribes the whole buffer with faster-whisper `large-v3-turbo` (prompted with fillers to keep "um/uh") and then re-times every word with a wav2vec2 CTC forced aligner (`lab/align.py`, `facebook/wav2vec2-large-960h-lv60-self`), because Whisper's own word times were off by 0.1-0.4 s. Words keep Whisper's confidence `p`.
3. **Undo.** Candidate boundaries = sentence ends, pauses >= 0.45 s, ", and/but/so/also/then/because/actually/anyway". The LLM picks one of <= 5 options (`brain.last_thought`); the server stores a removed time range (never deletes audio). "Scratch that" (regex on the last words, after a 0.5 s pause) removes the command plus the thought before it.
4. **After stop.** Careful transcription (beam 5) + alignment, saved as `orig.wav` + `words.json` under `/workspace/app_data/<sid>/`.
5. **Cut path** (clean up, tighten, delete). The LLM copies the transcript with inline markup (`[correction: Monday, no wait,]`); `difflib` maps markup back to word indices; validators in `brain.py` enforce delete-only, protect negations/numbers/dates/times unless a correction replaces them with the same type, and reshape corrections with a Shriberg "rough copy" rule (find the editing phrase, then the earlier word that the repair copies). Uncertain spans become unticked suggestions.
6. **Regenerate path** (replace, grammar, did-you-mean, re-say). A window of up to ~4 s each side (cut at word gaps) is sent to PlayDiffusion and F5-TTS in parallel (`editor_service.py`). Each output is forced-aligned to the target text, only the new words are cut out (quiet-point snapping), level-matched, spliced into the window and re-transcribed; a candidate passes if the new words appear as whole tokens. Up to 3 rounds with new seeds. Best passing candidate by speaker similarity (ECAPA), or by pronunciation score for re-say.
7. **Restyle path.** Natural presets (`prosody.py`, Praat PSOLA): confident = 7% faster, -1 semitone, rising phrase endings turned into a fall; calm = slower, narrower range; warm = higher, livelier. AI restyle: AuK-Flash instructions (calm/happy/excited/confident) on the whole message or a selection (selection: crop with context, restyle, locate the selected words by alignment, splice). Results report words kept and voice similarity.
8. **Render.** `render.py` applies cuts/inserts in time order with 12 ms equal-power crossfades at the quietest frame near each cut and caps leftover pauses at 0.45 s. AI regions are returned so the UI can colour them.

## 3. Pronunciation coach details
- Scorer (`pron.py`): espeak G2P (phonemizer) canonical phones → `facebook/wav2vec2-lv-60-espeak-cv-ft` phoneme posteriors → CTC forced alignment → per-phone peak posterior and alignment-free GOP (canonical vs best single-phone substitution/deletion, one batched `ctc_loss`) → features (per-phone z-scores vs good training words, edit distance canonical vs decoded phones, length) → `HistGradientBoostingRegressor` trained on speechocean762 train (`lab/train_pron.py`) predicting expert word accuracy 0-10.
- `/pron` flags content words with predicted accuracy <= 6.8 that are also >= 1.5 below this speaker's median; a sound the speaker gets "wrong" consistently (>= 3 occurrences, mean z <= -1) is treated as their accent: those words are not flagged and the sound is reported as a tip.
- Free-speech caveat: Whisper usually transcribes a badly mispronounced word as another real word, so `/intent` (did-you-mean) asks the LLM for up to 3 intended sentences, keeps word substitutions that sound alike (phone edit distance <= 0.6), drops word-form nitpicks (one word contains the other), and ranks by how well the candidate's phonemes fit the audio. Evaluation shows this is weak without context; keep it as a suggestion.

## 4. Infrastructure
- Pod: `xjdypx6zst9jkd` "respeak-lab-migration" (app at `https://xjdypx6zst9jkd-7860.proxy.runpod.net`), NVIDIA A100-SXM4-80GB, RunPod community cloud, $1.39/hr, image `runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404`, 200 GB persistent `/workspace`, 80 GB container disk (not persistent across restarts: apt packages and `~/.local` are lost). Ports 7860 (app), 8888 (Jupyter), 22 (SSH). It replaced `zaa3ajj8o85hhq` "respeak-lab" (2026-10-18): that pod's host had no free GPU, so it could not start, and RunPod's "migrate" made a new pod without copying `/workspace`. This one was rebuilt from scratch with the README steps and serves only the app (no benchmark data in `/workspace/data`).
- Services and ports: vLLM LLM :8011 (`scripts/start_llm.sh`, Qwen3.6-35B-A3B-FP8, `--gpu-memory-utilization 0.5 --max-num-seqs 16`), PlayDiffusion :8101, F5 :8103, AuK :8102, dots.tts.edit :8104 (off), Step-Audio-EditX :8105 (off), app :7860.
- GPU memory (approx.): LLM 40 GB, AuK 19 GB, PlayDiffusion + F5 ~11 GB, app (Whisper, two wav2vec2 models, ECAPA) ~4 GB. Step-Audio-EditX ~17 GB and dots ~6 GB do not fit alongside AuK.
- Environments (one venv each, created with uv): `/workspace/envs/core/.venv` (app), `/workspace/envs/vllm/.venv`, `/workspace/repos/{PlayDiffusion,F5-TTS,AuK,dots.tts,Step-Audio-EditX}/.venv`. Model weights in `/workspace/hf` and `/workspace/models` (Step-X).
- Start order after a pod restart: `apt-get install -y ffmpeg espeak-ng libsndfile1 sox` (container disk is wiped) → `setsid nohup /workspace/start_llm.sh > /workspace/logs/vllm_serve.log 2>&1 &` → `/workspace/app/start_services.sh playdiff f5 auk` → `/workspace/app/start_app.sh`. Logs in `/workspace/logs/`.
- Rebuild from scratch: README "Running it on a GPU machine" (about 25 min on 2026-10-18: pod created 03:31, app serving 03:54). Disk: keep the uv cache off `/workspace` (`UV_CACHE_DIR=/root/.cache/uv`); `/workspace` filled up once. The image's system pip refuses installs (PEP 668 "externally-managed-environment"), so put the `hf` CLI in its own venv (`uv venv /root/hfenv && uv pip install -p /root/hfenv "huggingface_hub[cli,hf_transfer]"`). The app wants the demo clip at `/workspace/data/demo_msg.wav` (`/api/sample`).
- Gotchas: launch background services with `ssh -f`; `pkill -f "[u]vicorn app:app"` (bracket trick, never the literal name in the same SSH command); Step-Audio-EditX spawns vLLM workers that re-import the launcher, hence `stepx_service.py` keeps everything inside `main()`; killing its parent can orphan a `VLLM::EngineCore` process that keeps ~17 GB (find it with `ps` and kill it); Qwen3.6 hybrid model needs `--max-num-seqs` <= 52 at 0.5 utilization; PlayDiffusion venv needs `setuptools<81` and `pyarrow<15`; dots.tts needs its constraints file without the gradio pin; the pod's SSH connection drops occasionally, so run long jobs detached with logs.

## 5. Data used (all real human speech, downloaded directly)
- LibriSpeech test-clean, AMI headset, DisfluencySpeech (round 1 editing benchmark and cleanup).
- speechocean762 (HF `mispeech/speechocean762`, Mandarin-L1 learners, expert word/phone labels): pronunciation detector training/eval, did-you-mean eval.
- EdAcc (HF `edinburghcstr/edacc`, accented Zoom conversations): grammar test, accent and tone tests.
- Not used (needs the user to accept terms or fill a form): L2-ARCTIC, Speak & Improve 2025 (the only spoken grammar-correction corpus), Common Voice.
- The demo sample message and the live-undo test audio are synthetic (F5-TTS cloning a dataset voice); replace with a real recording.

## 6. Chronology and decisions
1. Round 1 (research + build): five editors compared on 10 real edits; splicing back into the original made every engine usable; Whisper word times were the main quality bug → forced aligner; cleanup LLM moved from Qwen3-8B with index output (9/28) to Qwen3.6-35B-A3B with inline markup + repair rule (24/28, 0/10 false edits); app built and verified end to end in Chrome.
2. Round 2 (user priorities: grammar in own voice, mispronunciation, tone, real voices, accent): speechocean762-trained detector (AUC 0.88); re-say fix; grammar on EdAcc 8/8 rendered; natural tone presets; AuK de-accent showed no measurable change → dropped.
3. Round 3 (user asked for accent tolerance, sound-ranked did-you-mean, Step-Audio-EditX): accent-tolerant flags cut flags by 26% (45% of absolute flags were the speaker's habitual accent sound); did-you-mean without leaked prompt examples does not help yet; Step-Audio-EditX kept all words but changed the voice much more than AuK (0.52-0.60 vs 0.72-0.86 voice similarity), so AuK stays the default AI tone engine and Step-X remains optional. Fixed: substring verification bug, leaked test examples in the did-you-mean prompt, unverified region restyles, natural tone on selections, "serious" mapped to "sad".

## 7. Known issues
- Grammar test selection was biased (only utterances where the prompt already found an error): 8/8 measures rendering, not detection accuracy. False corrections on native speech are unmeasured.
- Did-you-mean is weak; keep it opt-in.
- AI tone changes the voice; natural presets are not listener-validated.
- Whisper drops some repetitions and restarts, which limits cleanup on very disfluent speech (CrisperWhisper would help, non-commercial licence).
- No listening (ABX) test of splice seams yet; no watermarking yet; mock chat only.
- Licences: F5 weights CC-BY-NC, AuK needs research-licensed Qwen2.5-Omni-3B, PlayDiffusion repo archived — fine for a hackathon, not for a product.

## 8. Next steps (prioritised)
1. Test with your own microphone in Chrome; record the demo script 10 times; replace the synthetic sample with a real recording.
2. Run grammar fixes in parallel and show a progress indicator; show the diff before regenerating.
3. Seam polish: room-tone fill, pitch smoothing at joins; blind "spot the edit" test with friends.
4. Real integration: Telegram or Discord bot that returns the cleaned voice note.
5. AudioSeal watermark on AI-generated words; show provenance to the listener.
6. Measure grammar false corrections on native speech (AMI/EdAcc native speakers).
7. Optional: hosted LLM (Claude API) to free 40 GB of GPU for dots.tts.edit (most reliable editor) or Step-Audio-EditX.
