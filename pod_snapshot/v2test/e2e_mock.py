# End-to-end test of the app_dev engine's live socket + finish clean-up, on CPU, without loading any GPU model.
# The recognizer is replaced by the real word timings of tonight's C' run (/workspace/app_data/v3fvy4dk/words.json),
# revealed as the streamed audio reaches them; everything else (socket protocol, live strike, final, /clean) is app_dev code.
# usage: python e2e_mock.py <port> <variant: strike | nostrike | dat>
import sys, types, os, json, re
port, variant = int(sys.argv[1]), sys.argv[2]
os.environ["ACCESS_FILE"] = "/nonexistent"; os.environ["CLEAN_PARTS"] = "0"  # no auth for the test; one LLM request in flight
for name in ("faster_whisper", "speechbrain", "speechbrain.inference", "speechbrain.inference.speaker", "align"):
    sys.modules[name] = types.ModuleType(name)
sys.modules["faster_whisper"].WhisperModel = lambda *a, **k: None
sys.modules["speechbrain.inference.speaker"].EncoderClassifier = types.SimpleNamespace(from_hparams=lambda *a, **k: None)
sys.modules["pron"] = P = types.ModuleType("pron"); P.score = P.features = P.phones = P.levenshtein = P.fit = lambda *a, **k: None  # loads a GPU model
A = sys.modules["align"]; A.align = A.emissions = A.spell = lambda *a, **k: None; A.V = {"A": 1}; A.BLANK = 0
sys.path.insert(0, "/workspace/app_dev")
import importlib.util
spec = importlib.util.spec_from_file_location("app", os.environ.get("APP_PY", "/workspace/app_dev/app.py")); app = importlib.util.module_from_spec(spec); spec.loader.exec_module(app)
WORDS = json.load(open("/workspace/app_data/v3fvy4dk/words.json"))
if variant == "dat": WORDS = [dict(w, w="dat.") if w["w"] == "that." and k > 0 and WORDS[k - 1]["w"] == "Scratch" else w for k, w in enumerate(WORDS)]
K = next(k for k, w in enumerate(WORDS) if WORDS[k - 1]["w"] == "Scratch")  # "that." / "dat."
def fake_transcribe(x, beam=1, fill=False):
    # the final (beam 5) alignment stretches "that." through the pause to 6.835 s; on the partial audio during the pause
    # it ended at 5.878 s (tonight's live strike: t1 = end + 0.15 = 6.028), so the streaming passes use that end
    dur = len(x) / app.SR; ws = [dict(w) for w in WORDS]
    if beam == 1: ws[K]["e"] = 5.878
    return [w for w in ws if w["e"] <= dur - 0.05]
app.transcribe = fake_transcribe
if variant == "nostrike": app.spoken_command = lambda act: None  # the live strike misses
import uvicorn
uvicorn.run(app.app, host="127.0.0.1", port=port, log_level="info", ws_max_size=16777216)
