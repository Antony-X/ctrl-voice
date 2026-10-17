# Text-level tests for the cut planner: self-repair cleanup + distractors + semantic undo.
import re, sys, time
sys.path.insert(0, "/workspace/app"); from brain import clean, last_thought, spoken_command, norm
def W(s):  # fake word timings; '|' marks a 0.8 s pause
    t, out = 0.0, []
    for tok in s.split():
        if tok == "|": t += 0.8; continue
        out.append(dict(w=tok, s=t, e=t + 0.28)); t += 0.32
    return out
apply = lambda ws, cuts: " ".join(w["w"] for k, w in enumerate(ws) if not any(c["i"] <= k <= c["j"] for c in cuts if c["auto"]))
txt = lambda s: " ".join(norm(x) for x in s.split() if norm(x))
CLEAN = [
 ("I'll meet you on Monday, no wait, Wednesday at five.", "I'll meet you on Wednesday at five."),
 ("Can you grab the red, I mean the blue folder from my desk?", "Can you grab the blue folder from my desk?"),
 ("The meeting is at three, sorry, four thirty tomorrow.", "The meeting is at four thirty tomorrow."),
 ("Tell Sarah, actually, tell Mike that the report is done.", "tell Mike that the report is done."),
 ("We need like ten, no, twelve chairs for the party.", "We need like twelve chairs for the party."),
 ("I booked a table for seven people, or rather eight people, at the Italian place.", "I booked a table for eight people, at the Italian place."),
 ("Turn left on Main Street, uh, no, on Oak Street, and then it's the second house.", "Turn left on Oak Street, and then it's the second house."),
 ("My flight lands at nine, wait, no, ten fifteen.", "My flight lands at ten fifteen."),
 ("I was, we were thinking about going to the beach this weekend.", "we were thinking about going to the beach this weekend."),
 ("Did you, have you finished the slides yet?", "have you finished the slides yet?"),
 ("I I think we should we should leave early.", "I think we should leave early."),
 ("And, and the the problem is the budget.", "And the problem is the budget."),
 ("Um, so, uh, I just wanted to say thanks for, um, yesterday.", "so, I just wanted to say thanks for, yesterday."),
 ("Hey, I'm running late. The traffic is horrible and I hate this city. | Scratch that. | I'll be there in ten minutes.", "Hey, I'm running late. I'll be there in ten minutes."),
 ("So, uh, the party is on Saturday, no, Sunday, and, um, bring the the cake.", "So, the party is on Sunday, and, bring the cake."),
 ("I need you to send, uh, forward me the email from John, I mean from Jim, before lunch.", "I need you to forward me the email from Jim, before lunch."),
 ("The password is, no, | I'll text it to you instead.", "I'll text it to you instead."),
 ("I'll be there by six. No wait, seven, because of the traffic.", "I'll be there by seven, because of the traffic."),
 # distractors: must stay unchanged
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
UNDO = [
 ("Hey, I'm at the store. Do you want me to get milk? Also the guy here was super rude to me and", ["Also"]),
 ("Thanks for the gift. I really love it. It's way too expensive though", ["It's"]),
 ("Can you call mom? She's been trying to reach you all day. Tell her I said hi", ["Tell"]),
 ("So about tomorrow, I think we should leave at seven | and take your car because mine is", ["and"]),
 ("Okay so the plan is | we meet at the station at noon. | Then we go to grandma's, she's cooking, and honestly I", ["and", "Then"]),
 ("I'm so sorry about last night, I was a total idiot, | I don't even know why I said that stuff about your sister", ["I"]),
]
ok = fp = 0; t = time.time()
for s, exp in CLEAN:
    ws = W(s); cuts = clean(ws); got = apply(ws, cuts)
    good = txt(got) == txt(exp if exp else s); ok += good; fp += (exp is None and not good)
    print(("PASS" if good else "FAIL"), "|", s.replace("| ", ""), "\n      ->", got, [(c["kind"], c["text"], c["auto"]) for c in cuts])
print(f"\nCLEAN {ok}/{len(CLEAN)} exact; distractor false-edits {fp}/{sum(e is None for _, e in CLEAN)}; {(time.time()-t)/len(CLEAN):.2f}s/call")
u = 0
for s, starts in UNDO:
    ws = W(s); k = last_thought(ws); hit = ws[k]["w"] in starts if k is not None else False; u += hit
    print(("PASS" if hit else "FAIL"), "| removes:", " ".join(w["w"] for w in ws[k:]))
print(f"UNDO {u}/{len(UNDO)}")
print("CMD", spoken_command(W("Hey, I'm running late. The traffic is horrible and I hate this city. | Scratch that.")))
