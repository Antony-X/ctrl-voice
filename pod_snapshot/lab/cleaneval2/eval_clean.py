# Cleanup A/B: which words /clean cuts, on hand-written voice-message transcripts.
# Variants: the deployed cleanup (local Qwen, v1 prompt) against the v2 prompt, on the local model and on Gemini.
# Each case lists every acceptable result (deletions only); None = the message must stay untouched.
# Usage (on the pod, from this folder): python eval_clean.py qwen_v1 qwen_v2 gem_v1 gem_v2 ...
import difflib, json, sys, time
sys.path.insert(0, ".")
import brain, brain_v1, brain_v2mark, brain_gem
from brain import norm

def W(s):  # fake word timings; '|' marks a 0.8 s pause
    t, out = 0.0, []
    for tok in s.split():
        if tok == "|": t += 0.8; continue
        out.append(dict(w=tok, s=t, e=t + 0.28)); t += 0.32
    return out

# The original 28 (lab/test_brain.py), alternatives added only where a second reading is equally clean.
OLD = [
 ("I'll meet you on Monday, no wait, Wednesday at five.", ["I'll meet you on Wednesday at five."]),
 ("Can you grab the red, I mean the blue folder from my desk?", ["Can you grab the blue folder from my desk?"]),
 ("The meeting is at three, sorry, four thirty tomorrow.", ["The meeting is at four thirty tomorrow."]),
 ("Tell Sarah, actually, tell Mike that the report is done.", ["tell Mike that the report is done."]),
 ("We need like ten, no, twelve chairs for the party.", ["We need like twelve chairs for the party.", "We need twelve chairs for the party."]),
 ("I booked a table for seven people, or rather eight people, at the Italian place.", ["I booked a table for eight people, at the Italian place."]),
 ("Turn left on Main Street, uh, no, on Oak Street, and then it's the second house.", ["Turn left on Oak Street, and then it's the second house."]),
 ("My flight lands at nine, wait, no, ten fifteen.", ["My flight lands at ten fifteen."]),
 ("I was, we were thinking about going to the beach this weekend.", ["we were thinking about going to the beach this weekend."]),
 ("Did you, have you finished the slides yet?", ["have you finished the slides yet?"]),
 ("I I think we should we should leave early.", ["I think we should leave early."]),
 ("And, and the the problem is the budget.", ["And the problem is the budget.", "the problem is the budget."]),
 ("Um, so, uh, I just wanted to say thanks for, um, yesterday.", ["so, I just wanted to say thanks for, yesterday.", "I just wanted to say thanks for yesterday."]),
 ("Hey, I'm running late. The traffic is horrible and I hate this city. | Scratch that. | I'll be there in ten minutes.", ["Hey, I'm running late. I'll be there in ten minutes."]),
 ("So, uh, the party is on Saturday, no, Sunday, and, um, bring the the cake.", ["So, the party is on Sunday, and, bring the cake.", "the party is on Sunday, and, bring the cake."]),
 ("I need you to send, uh, forward me the email from John, I mean from Jim, before lunch.", ["I need you to forward me the email from Jim, before lunch."]),
 ("The password is, no, | I'll text it to you instead.", ["I'll text it to you instead."]),
 ("I'll be there by six. No wait, seven, because of the traffic.", ["I'll be there by seven, because of the traffic."]),
 ("Bring the charger, the black one, not the white one.", None),
 ("No, I can't come tonight, I'm sorry.", None),
 ("I actually really liked the movie.", None),
 ("I mean it, you did a great job.", None),
 ("It's not Monday, it's Tuesday today.", None),
 ("We never said that, we said we'd think about it.", None),
 ("Call me at five five five, two one two three.", None),
 ("Wait for me at the entrance, I'll be there soon.", None),
 ("Sorry I missed your call, I was driving.", None),
 ("Never mind the mess, the kitchen is being renovated.", None),
]

# New: things that only make sense to cut once you read the whole message.
CONTEXT = [
 ("The meeting is on Thursday. Actually, no, it's on Friday. Bring your laptop.",
  ["it's on Friday. Bring your laptop.", "The meeting is on Friday. Bring your laptop."]),
 ("Meet me at the Italian place on Fifth Street. Oh wait, sorry, it's the one on Seventh Street. See you at eight.",
  ["Meet me at the Italian place on Seventh Street. See you at eight.", "Meet me at the Italian place the one on Seventh Street. See you at eight."]),
 ("Hey, so I'm gonna be a bit late tonight. I'm running late, like twenty minutes. Start without me.",
  ["Hey, so I'm running late, like twenty minutes. Start without me.", "Hey, so I'm gonna be a bit late tonight, like twenty minutes. Start without me."]),
 ("Are you coming to the party tomorrow? Like, will you be there tomorrow? Let me know.",
  ["Are you coming to the party tomorrow? Let me know."]),
 ("Can you send me the, um, what's it called, the spreadsheet from yesterday?",
  ["Can you send me the spreadsheet from yesterday?"]),
 ("So I was thinking, hold on, let me, okay, so I was thinking we could do the trip in June.",
  ["So I was thinking we could do the trip in June.", "okay, so I was thinking we could do the trip in June.", "so I was thinking we could do the trip in June."]),
 ("Hey, can you, Max, stop it, put that down! Sorry. Can you pick up some milk on the way home?",
  ["Hey, can you pick up some milk on the way home?", "Can you pick up some milk on the way home?"]),
 ("Tell Anna that, wait, no, it was Maria who asked. Tell Maria the keys are under the mat.",
  ["Tell Maria the keys are under the mat."]),
 ("The total is forty dollars. No, sorry, forty five, I forgot the tip. Just send it whenever.",
  ["The total is forty five, I forgot the tip. Just send it whenever.", "The total is forty five. Just send it whenever."]),
 ("I really liked your presentation. It was really good, I really liked it. Especially the part about the budget.",
  ["I really liked your presentation. Especially the part about the budget.", "I really liked your presentation. It was really good, Especially the part about the budget."]),
 ("Okay so, um, what was I saying? Oh yeah, the flight is at noon, so we need to leave by nine.",
  ["Okay so, the flight is at noon, so we need to leave by nine.", "the flight is at noon, so we need to leave by nine."]),
 ("I'll call you after work. Actually, I'll call you during lunch instead, I have a thing after work.",
  ["I'll call you during lunch instead, I have a thing after work."]),
 ("Let me think how to say this. Um. Okay. I can't make it on Saturday, I'm really sorry.",
  ["I can't make it on Saturday, I'm really sorry.", "Okay. I can't make it on Saturday, I'm really sorry."]),
 ("We're staying at the Hilton downtown. Actually, forget that, ignore that last part. We're staying at my aunt's place.",
  ["We're staying at my aunt's place."]),
 ("The, the thing is, I don't think we, I don't think we have enough time.",
  ["the thing is, I don't think we have enough time."]),
 ("Yeah so basically, basically what happened is the car broke down.",
  ["Yeah so basically what happened is the car broke down.", "basically what happened is the car broke down.", "so basically what happened is the car broke down."]),
 ("I'm going to the store. Do you need anything? I'm heading to the store now, so let me know if you need anything.",
  ["I'm going to the store. Do you need anything?", "I'm heading to the store now, so let me know if you need anything."]),
 ("I got the tickets for Saturday, I mean, for Sunday, the Saturday ones were sold out.",
  ["I got the tickets for Sunday, the Saturday ones were sold out."]),
 ("So we, so the plan is, okay, the plan is we leave at six.",
  ["the plan is we leave at six.", "okay, the plan is we leave at six.", "So the plan is we leave at six.", "so the plan is we leave at six."]),
 ("Grab some wine, the red one is cheaper. | Never mind, scratch that, | just grab beer.",
  ["just grab beer."]),
 ("Sorry for the long message. Um, so, yeah. Anyway. The point is I need the car on Friday.",
  ["Sorry for the long message. The point is I need the car on Friday.", "Sorry for the long message. Anyway. The point is I need the car on Friday."]),
 ("I sent it to you on, um, on Tuesday? No, Wednesday. Yeah, Wednesday. Check your spam folder.",
  ["I sent it to you on Wednesday. Check your spam folder."]),
]

# New distractors: deliberate repetition and contrasts that must stay.
KEEP = [
 "I'm really, really proud of you.",
 "The dinner is on Friday at eight at Luigi's. Again, Friday at eight, don't be late.",
 "He told me no, wait for the manager, so we waited for an hour.",
 "No, no, no, that's totally fine, don't worry about it.",
 "We need red paint, blue paint and white paint for the fence.",
 "Let me think about it and I'll get back to you tomorrow.",
 "I said it's Monday, not Tuesday, so please don't come on Tuesday.",
 "Thank you so much. Seriously, thank you, it means a lot.",
 "First we go to the bank, then the post office, then we go home.",
 "Sorry, I can't talk right now, I'm in a meeting. Call you later.",
 "My sister, the one who lives in Paris, is visiting next week.",
 "It's cold, really cold, so bring a jacket.",
]
# "no no, I meant": the case the user asked about, plus the demo take (slide 4 import, and live with "scratch that" already struck).
MEANT = [
 ("Can you send it to my work email, no no, I meant my personal one, the work one is full.",
  ["Can you send it to my personal one, the work one is full."]),
 ("Um, so, I'll bring the salad. No no, wait, I meant the dessert, Kim is bringing the salad.",
  ["I'll bring the dessert, Kim is bringing the salad.", "so, I'll bring the dessert, Kim is bringing the salad."]),
 ("We land at eight, no no, I meant we land at nine, so pick us up at ten.",
  ["we land at nine, so pick us up at ten."]),
 ("Uh, the code is on the fridge, no, I meant on the door, sorry, the front door.",
  ["the code is on the front door."]),
 ("Hey, Sam, um, can you be more pacific about game night? Is it Monday? No, wait, Wednesday? Also, I still sleep with a teddy bear. Scratch that. Anyway, whatever Jordan said is a mute point now. Just bring snacks.",
  ["Hey, Sam, can you be more pacific about game night? Is it Wednesday? Anyway, whatever Jordan said is a mute point now. Just bring snacks.",
   "Hey, Sam, can you be more pacific about game night? Is it Wednesday? whatever Jordan said is a mute point now. Just bring snacks."]),
 ("Hey, Sam, um, can you be more pacific about game night? Is it Monday? No, wait, Wednesday? Anyway, whatever Jordan said is a mute point now. Just bring snacks.",
  ["Hey, Sam, can you be more pacific about game night? Is it Wednesday? Anyway, whatever Jordan said is a mute point now. Just bring snacks."]),
]
CASES = [("old", s, g) for s, g in OLD] + [("meant", s, g) for s, g in MEANT] + [("context", s, g) for s, g in CONTEXT] + [("keep", s, None) for s in KEEP]


toks = lambda s: [norm(x) for x in s.split() if norm(x)]


def is_deletion(src, text):
    a, b = toks(src), toks(text)
    return sum(blk.size for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks()) == len(b)


def diff(got, gold):
    """(gold words the result lost, words the result kept that the gold cut)."""
    a, b = toks(got), toks(gold); m = sum(blk.size for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks())
    return len(b) - m, len(a) - m


VARIANTS = {
    "qwen_v1": lambda ws: brain_v1.clean(ws),                                     # deployed today
    "qwen_v2": lambda ws: brain_v2mark.clean(ws, hosted=False),
    "gem_v1": lambda ws: brain.clean(ws, sys_prompt=brain_v1.CLEAN_SYS),
    "gem_v2": lambda ws: brain.clean(ws),
    "gem_v2_raw": lambda ws: brain.clean(ws, reshape=False),                      # trust the model's spans
    "qwen_meant": lambda ws: brain.clean_meant(ws, hosted=False, check=False),    # the model writes the intended message
    "qwen_meant_think": lambda ws: brain.clean_meant(ws, hosted=False, think=True, check=False),
    "qwen_meant_check": lambda ws: brain.clean_meant(ws, hosted=False),           # ... and a second pass vets each cut
    "qwen_meant_check_think": lambda ws: brain.clean_meant(ws, hosted=False, think=True),
    "gem_meant": lambda ws: brain.clean_meant(ws),
    "gem_lite": lambda ws: brain_gem.clean(ws),                                   # deployable: Gemini Flash Lite, local fallback
    "gem_flash35": lambda ws: brain_gem.clean(ws),
    "gem_flash36": lambda ws: brain_gem.clean(ws),
}
GEM_MODELS = {"gem_flash35": "gemini-3.5-flash", "gem_flash36": "gemini-3.6-flash"}
GEM_PACE = 4.3  # free tier: 15 requests a minute per model
errors = []
brain.print = brain_v2mark.print = brain_gem.print = lambda *a: errors.append(" ".join(map(str, a)))  # fallbacks to the local model show up here


def run(name):
    if name.startswith("gem") and brain_gem.GEMINI is None: sys.exit("no Gemini key file")
    brain_gem.GEMINI_MODEL = GEM_MODELS.get(name, brain_gem.GEMINI_MODEL)
    rows, t0 = [], time.time()
    for group, s, alts in CASES:
        ws = W(s); n_err = len(errors); t = time.time(); cuts = brain_v1.clean(ws) if name == "qwen_v1" else VARIANTS[name](ws); dt = time.time() - t
        if name.startswith("gem"): time.sleep(max(0, GEM_PACE - dt))
        kept = {k for k in range(len(ws)) if not any(c["i"] <= k <= c["j"] for c in cuts if c["auto"])}
        got = " ".join(ws[k]["w"] for k in sorted(kept)); golds = alts or [s]
        over, under = min((diff(got, g) for g in golds), key=sum)
        rows.append(dict(group=group, s=s, exact=toks(got) in [toks(g) for g in golds], over=over, under=under, sec=round(dt, 2),
                         got=got, fallback=len(errors) > n_err,
                         cuts=[(c["kind"], c["text"], c["auto"]) for c in cuts]))
    out = {"variant": name, "rows": rows, "sec": round(time.time() - t0, 1), "errors": errors[:]}
    json.dump(out, open(f"res_{name}.json", "w"), indent=1)
    line = [name]
    for g in ("old", "context", "meant", "keep"):
        r = [x for x in rows if x["group"] == g]
        line.append(f"{g} {sum(x['exact'] for x in r)}/{len(r)} (lost {sum(x['over'] for x in r)}, left {sum(x['under'] for x in r)})")
    line.append(f"{sum(x['sec'] for x in rows) / len(rows):.2f}s/call, fallbacks {sum(x['fallback'] for x in rows)}")
    print(" | ".join(line), flush=True)


for _, s, alts in CASES:
    for g in alts or []: assert is_deletion(s.replace("|", ""), g), f"gold is not a deletion of the input: {g}"
for v in sys.argv[1:]: run(v)
