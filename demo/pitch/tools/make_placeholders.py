"""Temporary stand-in examples for the deck, built from real engine output already in the scratchpad.

They live in pitch/placeholders/<id>/ (never in pitch/examples/, which the example agents own). The deck uses
examples/<id>/example.js when it exists and falls back to these.

  clean   : demoscript/cand/TEST_SYNTH_scriptA_grumpy_chris.wav -> demoscript/out/scriptA_chris_after.wav
            (engine run demoscript/out/scriptA_chris.json; before-word timings and tags are the engine's own)
  mispron : deck/media/misspoken_before.wav / _after.wav (cut from the engine's run scriptAnormal_jessica)
  tone    : deck/media/your_sound_before.wav (fix render) / _after.wav (Your sound: Confident at Strong)
  accent  : mono/demo/accent/russian_C24A_original.wav / _converted.wav, first sentence (spans from deck/media/accent.json)

After-word timings (and tone/accent words) come from local Whisper (tools/asr_placeholders.json, deck/build/fill/asr_accent.json).
Usage: python make_placeholders.py
"""
import json
import subprocess
from pathlib import Path

PITCH = Path(__file__).resolve().parent.parent
SCRATCH = PITCH.parent
OUT = PITCH / "placeholders"
ASR = json.loads((PITCH / "tools" / "asr_placeholders.json").read_text("utf-8"))
ASR_ACCENT = json.loads((SCRATCH / "deck" / "build" / "fill" / "asr_accent.json").read_text("utf-8"))
SYNTH = {"label": "AI-generated demo voice", "dataset": "", "license": "",
         "attribution": "ElevenLabs stock voice (synthetic test take, not a recording of a person)", "url": ""}


def mp3(src, dst, t0=None, t1=None):
    cmd = ["ffmpeg", "-v", "error", "-y"]
    if t0 is not None:
        cmd += ["-ss", f"{t0:.3f}", "-to", f"{t1:.3f}"]
    cmd += ["-i", str(src), "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", str(dst)]
    subprocess.run(cmd, check=True)
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(dst)],
                       capture_output=True, text=True, check=True)
    return round(float(p.stdout.strip()), 3)


def words(ws, tags=None, t0=0.0, t1=1e9):
    tags = tags or {}
    out = []
    for k, w in enumerate(ws):
        if w["s"] < t0 - 1e-6 or w["e"] > t1 + 0.05:
            continue
        d = {"w": w["w"], "s": round(w["s"] - t0, 3), "e": round(min(w["e"], t1) - t0, 3)}
        if k in tags:
            d["tag"] = tags[k]
        out.append(d)
    return out


def write(eid, ex):
    d = OUT / eid
    d.mkdir(parents=True, exist_ok=True)
    js = ("// TEMPORARY placeholder example (built by tools/make_placeholders.py). The real one goes in examples/"
          f"{eid}/example.js.\n(window.PLACEHOLDER_EXAMPLES = window.PLACEHOLDER_EXAMPLES || {{}})['{eid}'] = "
          + json.dumps(ex, indent=1, ensure_ascii=False) + ";\n")
    (d / "example.js").write_text(js, "utf-8")
    print(eid, ex["before"]["dur"], ex["after"]["dur"])


def clean():
    run = json.loads((SCRATCH / "demoscript" / "out" / "scriptA_chris.json").read_text("utf-8"))
    tags = {}
    for c in run["clean"]:
        kind = {"filler": "filler", "correction": "correction", "command": "scratched"}[c["kind"]]
        for k in range(c["i"], c["j"] + 1):
            tags[k] = kind
    for g in run["grammar"]:
        tags[g["i"]] = "misspoken"
    d = OUT / "clean"
    d.mkdir(parents=True, exist_ok=True)
    bdur = mp3(SCRATCH / "demoscript" / run["input"], d / "before.mp3")
    adur = mp3(SCRATCH / "demoscript" / "out" / "scriptA_chris_after.wav", d / "after.mp3")
    ai = run["render"]["ai"]
    aw = []
    for w in ASR["scriptA_chris_after.wav"]["words"]:
        mid = (w["s"] + w["e"]) / 2
        x = dict(w)
        if any(a0 - 0.05 <= mid <= a1 + 0.05 for a0, a1 in ai):
            x["tag"] = "regenerated"
        aw.append(x)
    edits = [{"type": "cut", "kind": c["kind"], "text": c["text"]} for c in run["clean"]]
    edits += [{"type": "replace", "old": r["old"], "new": r["new"]} for r in run["replaced"]]
    write("clean", {
        "title": "Before / After", "synthetic": True, "placeholder": True, "speaker": SYNTH,
        "before": {"src": "before.mp3", "dur": bdur, "words": words(run["words"], tags)},
        "after": {"src": "after.mp3", "dur": adur, "words": aw},
        "edits": edits,
        "caption": "The um, the self-correction and the scratched sentence are cut; 'pacific' and 'mute' are re-said as "
                   "'specific' and 'moot' in the same voice.",
        "source": "demoscript/out/scriptA_chris.json (real engine run)"})


def mispron():
    m = json.loads((SCRATCH / "deck" / "media" / "misspoken.json").read_text("utf-8"))
    d = OUT / "mispron"
    d.mkdir(parents=True, exist_ok=True)
    bdur = mp3(SCRATCH / "deck" / "media" / "misspoken_before.wav", d / "before.mp3")
    adur = mp3(SCRATCH / "deck" / "media" / "misspoken_after.wav", d / "after.mp3")
    bw = words(m["words"], {m["i"]: "misspoken"})
    bw[0]["w"] = bw[0]["w"].capitalize()
    a0, a1 = m["ai"]
    aw = []
    for w in ASR["misspoken_after.wav"]["words"]:
        x = dict(w)
        if a0 - 0.05 <= (w["s"] + w["e"]) / 2 <= a1 + 0.05:
            x["tag"] = "regenerated"
        aw.append(x)
    old = m["words"][m["i"]]
    write("mispron", {
        "title": "One word, close up", "synthetic": True, "placeholder": True,
        "speaker": dict(SYNTH, attribution="ElevenLabs stock voice 'Jessica' (synthetic test take, not a recording of a person)"),
        "before": {"src": "before.mp3", "dur": bdur, "words": bw},
        "after": {"src": "after.mp3", "dur": adur, "words": aw},
        "edits": [{"type": "replace", "old": old["w"], "new": m["new"]}],
        "focus": {"word": m["new"], "beforeT0": old["s"], "beforeT1": old["e"], "afterT0": a0, "afterT1": a1},
        "caption": "Only 'specific' is regenerated; every other sample is the original take.",
        "source": m["source"]["run"]})


def tone():
    d = OUT / "tone"
    d.mkdir(parents=True, exist_ok=True)
    bdur = mp3(SCRATCH / "deck" / "media" / "your_sound_before.wav", d / "before.mp3")
    adur = mp3(SCRATCH / "deck" / "media" / "your_sound_after.wav", d / "after.mp3")
    write("tone", {
        "title": "Tired → Confident", "synthetic": True, "placeholder": True,
        "speaker": dict(SYNTH, attribution="ElevenLabs stock voice 'Chris' (synthetic test take, not a recording of a person)"),
        "before": {"src": "before.mp3", "dur": bdur, "words": ASR["your_sound_before.wav"]["words"]},
        "after": {"src": "after.mp3", "dur": adur, "words": ASR["your_sound_after.wav"]["words"]},
        "edits": [{"type": "tone", "tone": "confident", "strength": "strong"}],
        "caption": "Confident at Strong: about 10% quicker and about 1 semitone lower. Subtle, on purpose.",
        "source": "demoscript/out/scriptA_chris.json, Your sound: Confident"})


def accent():
    spans = json.loads((SCRATCH / "deck" / "media" / "accent.json").read_text("utf-8"))
    d = OUT / "accent"
    d.mkdir(parents=True, exist_ok=True)
    src = SCRATCH / "mono" / "demo" / "accent"
    o0, o1 = spans["original"]["span_s"]
    c0, c1 = spans["converted"]["span_s"]
    bdur = mp3(src / "russian_C24A_original.wav", d / "before.mp3", o0, o1)
    adur = mp3(src / "russian_C24A_converted.wav", d / "after.mp3", c0, c1)
    write("accent", {
        "title": "Native accent", "synthetic": False, "placeholder": True,
        "speaker": {"label": "EdAcc dataset speaker", "dataset": "EdAcc (Edinburgh International Accents of English Corpus)",
                    "license": "", "attribution": "speaker EDACC-C24-A, Russian first language, validation segment EDACC-C24-308",
                    "url": ""},
        "before": {"src": "before.mp3", "dur": bdur, "label": "EdAcc dataset speaker",
                   "words": words(ASR_ACCENT["russian_C24A_original.wav"]["words"], t0=o0, t1=o1)},
        "after": {"src": "after.mp3", "dur": adur, "label": "AI voice",
                  "words": words(ASR_ACCENT["russian_C24A_converted.wav"]["words"], t0=c0, t1=c1)},
        "edits": [{"type": "accent", "to": "native"}],
        "caption": "The whole message is regenerated by AI in a native accent, keeping the speaker's voice.",
        "source": "accent/results.md"})


if __name__ == "__main__":
    clean()
    mispron()
    tone()
    accent()
