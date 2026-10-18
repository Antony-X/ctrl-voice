# LLM layer: decides WHICH words to cut or fix. The model copies the transcript with inline markup
# (more reliable than asking for indices); code maps markup back to word indices and validates it.
import json, os, re, difflib
from openai import OpenAI
LLM = OpenAI(base_url=os.environ.get("LLM_URL", "http://localhost:8011/v1"), api_key=os.environ.get("LLM_KEY", "x"))
MODEL = os.environ.get("LLM_MODEL", "llm")
# Cleanup has to read the whole message to see what is redundant or taken back, which a hosted model
# (Gemini Flash) does better than the local one. Its key is a file kept out of git; without the file,
# or when a call fails or is slow, cleanup falls back to the local model.
GEMINI_KEY = os.environ.get("GEMINI_KEY_FILE", "/workspace/app/.gemini_key")
GEMINI = (OpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=open(GEMINI_KEY).read().strip(),
                 timeout=float(os.environ.get("GEMINI_TIMEOUT", "8")), max_retries=0) if os.path.exists(GEMINI_KEY) else None)
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
GEMINI_EFFORT = os.environ.get("GEMINI_EFFORT", "low")
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
FILLERS = {"um", "uh", "er", "ah", "hmm", "mm", "erm", "uhm", "umm", "uhh"}
CATS = [("neg", r"not|never|no|nothing|nobody|none|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|shouldn't|wouldn't|couldn't"),
        ("num", r"\d.*|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|half|noon|midnight"),
        ("day", r"monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|yesterday|morning|evening|afternoon")]
cat = lambda w: next((c for c, p in CATS if re.fullmatch(p, norm(w))), None)


def chat(system, user, max_tokens=800, hosted=False, think=False):
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    if hosted and GEMINI:
        try:
            r = GEMINI.chat.completions.create(model=GEMINI_MODEL, temperature=0, reasoning_effort=GEMINI_EFFORT, messages=msgs)
            out = (r.choices[0].message.content or "").strip()
            if out: return out
            print("gemini: empty answer, using the local model")
        except Exception as e: print("gemini error, using the local model:", e)
    r = LLM.chat.completions.create(model=MODEL, temperature=0, max_tokens=max_tokens + (THINK_TOKENS if think else 0),
        messages=msgs,
        extra_body={"chat_template_kwargs": {"enable_thinking": think}})
    out = r.choices[0].message.content or ""
    return out.split("</think>")[-1].strip()  # the reasoning (if any) ends at </think>; the template may omit the opening tag
THINK_TOKENS = int(os.environ.get("THINK_TOKENS", "2500"))


def map_tokens(words, toks):
    """toks: [(word, tag)] from the model's marked copy -> tag per ORIGINAL word index (None = keep)."""
    a, b = [norm(w["w"]) for w in words], [norm(t) for t, _ in toks]
    tags = [None] * len(words)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size): tags[blk.a + k] = toks[blk.b + k][1]
    return tags


def spans(words, tags):
    out, k = [], 0
    while k < len(words):
        if tags[k] is None: k += 1; continue
        j = k
        while j + 1 < len(words) and tags[j + 1] == tags[k]: j += 1
        out.append(dict(i=k, j=j, kind=tags[k], text=" ".join(w["w"] for w in words[k:j + 1]))); k = j + 1
    return out


MARK = re.compile(r"\[(\w+):\s*(.*?)\]", re.S)
def parse(text):
    toks, pos = [], 0
    for m in MARK.finditer(text):
        toks += [(t, None) for t in text[pos:m.start()].split()]
        toks += [(t, m.group(1).lower()) for t in m.group(2).split()]; pos = m.end()
    return toks + [(t, None) for t in text[pos:].split()]


CLEAN_SYS = """You clean up transcripts of casual voice messages. Read the WHOLE message first: some words only turn out to be wrong or redundant later on.
Copy the transcript EXACTLY, word for word, but wrap the words that should be deleted in [kind: ...].
Kinds:
- [filler: ...] um, uh, er, hmm.
- [correction: ...] the speaker said something wrong and corrected it, in the same sentence or a later one. Wrap the WRONG words plus the editing phrase (no wait, I mean, sorry, actually, or rather). Keep the corrected words unwrapped.
- [restart: ...] an abandoned start that the speaker begins again, or a cut-off word.
- [repetition: ...] an accidentally repeated word or phrase (wrap the first copy).
- [redundant: ...] the speaker says the same thing again in other words and one copy adds nothing. Wrap the copy that adds less; keep the clearer, more complete one.
- [aside: ...] words not meant for the listener: thinking out loud ("let me think", "how do I put this", "what was I saying, oh yeah", "what's it called"), talking to someone else in the room, stalling ("so, yeah, anyway").
- [command: ...] spoken edit commands ("scratch that", "forget that", "ignore that last part", "never mind, let me start over") TOGETHER WITH the sentence(s) they cancel.
Rules: never add or change words. Never wrap meaningful words (negations, numbers, times, names) unless they are the wrong part of a correction or the message says the same thing elsewhere.
If unsure, leave the words unwrapped: an untouched message is better than a wrong cut.
Do NOT wrap: deliberate contrasts ("it's not Monday, it's Tuesday", "the black one, not the white one"), deliberate reminders ("again, Friday at eight"), emphasis ("really, really", "thank you, thank you"), quoted speech, discourse markers (well, you know, like, I mean it), polite "sorry", greetings and sign-offs, sentences that just contain "no", "wait", "actually" or "never mind" normally.
Examples:
IN: I'll meet you on Monday, no wait, Wednesday at five.
OUT: I'll meet you on [correction: Monday, no wait,] Wednesday at five.
IN: Um, so I was, we were thinking we could, uh, go go to the beach.
OUT: [filler: Um,] so [restart: I was,] we were thinking we could, [filler: uh,] [repetition: go] go to the beach.
IN: Dinner is at eight. The place is kind of overrated though. Scratch that. See you there!
OUT: Dinner is at eight. [command: The place is kind of overrated though. Scratch that.] See you there!
IN: The package came. It got here this morning, it's on your desk.
OUT: [redundant: The package came.] It got here this morning, it's on your desk.
IN: Hi, it's me. Hang on, the dog's barking. Okay. I left the keys at your place.
OUT: Hi, it's me. [aside: Hang on, the dog's barking. Okay.] I left the keys at your place.
IN: No, I can't make it, it's not my day off, it's Sunday.
OUT: No, I can't make it, it's not my day off, it's Sunday.
Output only the marked transcript."""


INTER1 = {"no", "wait", "sorry", "actually", "nope", "um", "uh", "er", "oops", "rather", "mean", "i", "or", "like"}
INTER2 = {("i", "mean"), ("or", "rather"), ("no", "wait"), ("wait", "no"), ("i", "meant")}
CMDW = {"scratch", "that", "delete", "undo", "strike", "never", "mind", "start", "over", "let", "me", "forget", "ignore", "last", "part", "what", "i", "just", "said"}


def inter_run(words, i, j):
    """last run of editing-phrase words (no wait / I mean / sorry / actually ...) inside words[i..j]."""
    n = [norm(w["w"]) for w in words]; flag = [False] * len(words)
    for k in range(i, j + 1):
        if (k + 1 <= j and (n[k], n[k + 1]) in INTER2): flag[k] = flag[k + 1] = True
        elif n[k] in INTER1 - {"i", "or", "mean", "rather", "like"}: flag[k] = True
    q = max((k for k in range(i, j + 1) if flag[k]), default=None)
    if q is None: return None
    p = q
    while p - 1 >= i and flag[p - 1]: p -= 1
    return p, q


def repair(words, s):
    """Reshape a span into Shriberg form: [reparandum + editing phrase], keeping the repair. Returns (i, j, confident)."""
    i, j, k = s["i"], s["j"], s["kind"]; n = lambda m: norm(words[m]["w"])
    if k == "correction":
        run = inter_run(words, i, min(j + 1, len(words) - 1)) or inter_run(words, i, j)
        if not run or run[1] + 1 >= len(words): return i, j, False
        p, q = run; r = q + 1
        for m in range(p - 1, max(-1, p - 9), -1):  # reparandum onset = earlier word that the repair onset "copies" (same word or same type)
            if n(m) == n(r) or (cat(words[m]["w"]) and cat(words[m]["w"]) == cat(words[r]["w"])): return m, q, True
        return min(i, p), q, False
    if k == "repetition":
        L = j - i + 1
        if [n(m) for m in range(i, j + 1)] == [n(m) for m in range(j + 1, min(len(words), j + 1 + L))]: return i, j, True
        if L % 2 == 0 and [n(m) for m in range(i, i + L // 2)] == [n(m) for m in range(i + L // 2, j + 1)]: return i, i + L // 2 - 1, True
        return i, j, False
    if k == "command" and all(n(m) in CMDW for m in range(i, j + 1)) and i > 0:
        return candidates(words[:i])[0], j, True  # the command cancels the thought right before it
    return i, j, True


KINDS = ("filler", "correction", "restart", "repetition", "redundant", "aside", "command")


def kept_alike(words, s, c, w):
    """a meaning-bearing word in a redundant span is safe to cut only if the rest of the message still says it."""
    rest = [x["w"] for m, x in enumerate(words) if not s["i"] <= m <= s["j"]]
    return any(norm(x) == norm(w) for x in rest) if c == "num" else any(cat(x) == c for x in rest)


def clean(words, kinds=KINDS, hosted=True, reshape=True, sys_prompt=None):
    if not words: return []
    try: tags = map_tokens(words, parse(chat(sys_prompt or CLEAN_SYS, " ".join(w["w"] for w in words), hosted=hosted)))
    except Exception as e: print("llm error", e); return []
    out = []
    for s in spans(words, tags):
        if s["kind"] not in kinds: continue
        s["i"], s["j"], sure = repair(words, s) if reshape else (s["i"], s["j"], True)
        s["text"] = " ".join(w["w"] for w in words[s["i"]:s["j"] + 1])
        risky = not sure
        if s["kind"] == "correction" and sure:  # reparandum replaced by a same-type repair -> meaning-bearing words may go
            out.append(dict(s, auto=True)); continue
        for w in words[s["i"]:s["j"] + 1]:  # deleting a meaning-bearing word is only auto-applied if a same-type replacement follows
            c = cat(w["w"])
            if c and not (s["kind"] == "correction" and any(cat(x["w"]) == c for x in words[s["j"] + 1:s["j"] + 7]))                   and not (s["kind"] == "redundant" and kept_alike(words, s, c, w["w"])): risky = True
        if s["kind"] == "filler" and not all(norm(w["w"]) in FILLERS for w in words[s["i"]:s["j"] + 1]): risky = True
        out.append(dict(s, auto=not risky))
    # A word said again across a filler ("bring the, uh, the board game") is a repetition the model
    # usually misses, since the copies aren't adjacent; cut the first copy.
    if "repetition" in kinds:
        cut = {k for s in out if s["auto"] for k in range(s["i"], s["j"] + 1)}
        for s in [s for s in out if s["kind"] == "filler" and s["auto"]]:
            a, b = s["i"] - 1, s["j"] + 1
            if a >= 0 and b < len(words) and a not in cut and b not in cut and norm(words[a]["w"]) and norm(words[a]["w"]) == norm(words[b]["w"]):
                out.append(dict(kind="repetition", i=a, j=a, text=words[a]["w"], auto=True)); cut.add(a)
        out.sort(key=lambda s: s["i"])
    return out


MEANT_SYS = """You get the transcript of a casual voice message. Write the message the speaker MEANT to send.
Read the WHOLE message first: some words only turn out to be wrong, taken back or redundant later on.
You may only DELETE words: never add, change or reorder any. Delete:
- filler: um, uh, er, hmm.
- correction: whatever the speaker got wrong and then corrected, in the same sentence or a later one ("no wait", "no no, I meant", "sorry, it's", "actually, no"). Delete the wrong part and the correcting phrase; keep only the final version.
- restart: a start the speaker abandons and begins again, a cut-off word.
- repetition: words repeated by accident.
- redundant: the same point said again in other words when the repeat adds nothing; keep the clearer, more complete version.
- aside: words not meant for the listener: thinking out loud ("let me think", "what's it called", "what was I saying, oh yeah"), talking to someone else in the room, stalling ("so, yeah, anyway").
- command: spoken edit commands ("scratch that", "forget that", "ignore that", "never mind, let me start over") together with what they take back.
Keep everything else word for word: deliberate contrasts ("it's not Monday, it's Tuesday"), reminders ("again, Friday at eight"), emphasis ("really, really"), "no" as an answer, polite "sorry", greetings and sign-offs. If unsure, keep the words.
Answer as JSON: {"removed": [{"text": "exact deleted words", "kind": "filler|correction|restart|repetition|redundant|aside|command"}], "message": "the message with those words deleted"}
Examples:
IN: Um, can you buy apples, no no, I meant oranges, for the party?
OUT: {"removed": [{"text": "Um,", "kind": "filler"}, {"text": "apples, no no, I meant", "kind": "correction"}], "message": "can you buy oranges, for the party?"}
IN: Pick me up at the, uh, the station at six. Sorry, at seven, my train is late. Thanks!
OUT: {"removed": [{"text": "the,", "kind": "repetition"}, {"text": "uh,", "kind": "filler"}, {"text": "six. Sorry, at", "kind": "correction"}], "message": "Pick me up at the station at seven, my train is late. Thanks!"}
IN: Hi, it's me. I left the keys with Tom, so Tom has the keys. Hang on, the dog's barking. Okay. Call me when you're home.
OUT: {"removed": [{"text": "so Tom has the keys.", "kind": "redundant"}, {"text": "Hang on, the dog's barking. Okay.", "kind": "aside"}], "message": "Hi, it's me. I left the keys with Tom, Call me when you're home."}
IN: The movie starts at nine. The popcorn there is awful by the way. Scratch that. See you there!
OUT: {"removed": [{"text": "The popcorn there is awful by the way. Scratch that.", "kind": "command"}], "message": "The movie starts at nine. See you there!"}
IN: No, I can't make it, it's not my day off, it's Sunday.
OUT: {"removed": [], "message": "No, I can't make it, it's not my day off, it's Sunday."}"""
EDIT_MARK = re.compile(r"\b(no|wait|sorry|actually|i mean|i meant|or rather|scratch that|forget that|ignore that|never mind|start over)\b", re.I)


def dropped(words, message):
    """Which words a deletion-only rewrite drops (True = cut). Words the model changed or added are ignored: we can only cut."""
    a, b = [norm(w["w"]) for w in words], [norm(x) for x in message.split() if norm(x)]
    keep = [blk for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks() if blk.size]
    b = [a[blk.a + k] for blk in keep for k in range(blk.size)]  # the kept words, in order
    idx = [k for k in range(len(a)) if a[k]]; n, m = len(idx), len(b)
    # Re-place the kept words: fewest separate cuts (fewest audio seams), then keep the LATER copy of a repeated
    # word ("I I think" cuts the first "I"): the later copy is the fluent repair.
    INF = (10 ** 9, 0); f = {(0, 0, False): (0, 0)}
    for i in range(n):
        for j in range(min(i, m) + 1):
            for last in (False, True):
                v = f.get((i, j, last))
                if v is None: continue
                cand = [((i + 1, j, True), (v[0] + (not last), v[1]))]
                if j < m and a[idx[i]] == b[j]: cand.append(((i + 1, j + 1, False), (v[0], v[1] - i)))
                for key, val in cand:
                    if val < f.get(key, INF): f[key] = val; f[key + ("from",)] = (i, j, last)
    end = min((f[(n, m, last)], (n, m, last)) for last in (False, True) if (n, m, last) in f)[1]
    cut, st = [False] * len(words), end
    while st[0] > 0:
        prev = f[st + ("from",)]
        if prev[1] == st[1]: cut[idx[prev[0]]] = True
        st = prev
    for k in range(1, len(words)):
        if not a[k]: cut[k] = cut[k - 1]  # punctuation-only tokens follow their neighbour
    return cut


def clean_meant(words, kinds=KINDS, hosted=True, think=False):
    """The model writes the message the speaker meant (deletions only); the dropped words become cuts."""
    if not words: return []
    try:
        out = chat(MEANT_SYS, " ".join(w["w"] for w in words), 1200, hosted=hosted, think=think)
        js = json.loads(re.search(r"\{.*\}", out, re.S).group(0)); message = str(js.get("message", ""))
    except Exception as e: print("llm error", e); return []
    if not message.strip(): return []
    cut, a = dropped(words, message), [norm(w["w"]) for w in words]
    tag = [None] * len(words)
    for r in js.get("removed") or []:  # label the cut words with the kind the model gave
        t = [norm(x) for x in str(r.get("text", "")).split() if norm(x)]; kind = str(r.get("kind", "")).lower()
        if not t or kind not in KINDS: continue
        for k in range(len(words) - len(t) + 1):
            if a[k:k + len(t)] == t and all(cut[k:k + len(t)]) and not any(tag[k:k + len(t)]):
                tag[k:k + len(t)] = [kind] * len(t); break
    for k in range(len(words)):  # cut words the model didn't list: take a neighbour's label, else guess
        if cut[k] and not tag[k]:
            tag[k] = (tag[k - 1] if k and cut[k - 1] and tag[k - 1] else
                      "filler" if a[k] in FILLERS else "command" if a[k] in {"scratch", "forget", "ignore"} else "restart")
    for k in range(len(words) - 1, 0, -1):
        if cut[k] and cut[k - 1] and tag[k - 1] == "restart" and tag[k] != "restart": tag[k - 1] = tag[k]
    out, kept = [], [w["w"] for w, c in zip(words, cut) if not c]
    for s in spans(words, [t if c else None for t, c in zip(tag, cut)]):
        if s["kind"] not in kinds: continue
        explicit = bool(EDIT_MARK.search(s["text"]))
        risky = False
        for w in words[s["i"]:s["j"] + 1]:  # dropping a number, day or negation needs a reason in the words themselves
            c = cat(w["w"])
            if not c or explicit: continue
            if c == "num" and any(norm(x) == norm(w["w"]) for x in kept): continue
            if c in ("num", "day") and any(cat(x) == c for x in kept) and s["kind"] in ("correction", "redundant"): continue
            risky = True
        if s["kind"] == "filler" and not all(a[k] in FILLERS for k in range(s["i"], s["j"] + 1)): s["kind"] = "aside"
        out.append(dict(s, auto=not risky))
    if sum(cut) == len(words): return [dict(s, auto=False) for s in out]  # never auto-delete the whole message
    return out


UNDO_SYS = """Someone is recording a voice message and pressed UNDO to take back the most recent thing they said.
You get the transcript and lettered options; each option removes the quoted text from the END of the message.
Pick the option that removes exactly the most recent thought: the last sentence, or the last clause if it was added after a pause as a separate idea. An unfinished sentence counts as a thought.
Answer with the option letter only."""


def candidates(words, gap=0.45):
    c = []
    for k in range(len(words) - 1, 0, -1):
        prev, w = words[k - 1], words[k]
        if re.search(r"[.!?]$", prev["w"]) or w["s"] - prev["e"] >= gap or (re.search(r",$", prev["w"]) and norm(w["w"]) in {"and", "but", "so", "also", "then", "because", "actually", "anyway"}):
            c.append(k)
        if len(c) == 4: break
    return c + [0]


def last_thought(words):
    if not words: return None
    c = candidates(words)
    if len(c) == 1: return c[0]
    opts = "\n".join(f"{'ABCDE'[n]}) remove: \"{' '.join(w['w'] for w in words[k:])}\"" for n, k in enumerate(c))
    try:
        a = chat(UNDO_SYS, f"Transcript: {' '.join(w['w'] for w in words)}\n\nOptions:\n{opts}", 5).strip().upper()[:1]
        return c["ABCDE".index(a)]
    except Exception as e: print("llm error", e); return c[0]


CMD = re.compile(r"\b(scratch that|delete that|undo that|strike that|never mind that|let me start over|start over)\W*$", re.I)
def spoken_command(words):
    """'... scratch that' at the end -> (first, last) word index to remove: the command + the thought before it."""
    tail = " ".join(w["w"] for w in words[-5:]); m = CMD.search(tail)
    if not m: return None
    n = len(m.group(1).split()); head = words[:-n]
    return (last_thought(head) if head else 0, len(words) - 1)


GRAMMAR_SYS = """You proofread transcripts of casual voice messages from people who may be non-native English speakers.
Copy the transcript EXACTLY, but mark clear grammar errors as [fix: wrong words => corrected words].
Only fix these error types: subject-verb agreement, verb form/tense, articles (a/an/the), prepositions, noun number (singular/plural), pronoun case, and word order.
Rules: minimal edits; every fix must include at least one original word (for a missing word, include its neighbour: [fix: go store => go to the store]);
a wrong word order is one fix over the whole span ([fix: love I => I love]); never change meaning, style, slang, names, numbers or fillers;
casual forms that natives use are fine (gonna, wanna, "me and him went", "there's two"), do not touch them; if unsure, do not fix.
Examples:
IN: She don't know where the files is. OUT: She [fix: don't => doesn't] know where the files [fix: is => are].
IN: Yesterday I go to store and buy two apple. OUT: Yesterday I [fix: go to store => went to the store] and [fix: buy two apple => bought two apples].
IN: love I this song so much. OUT: [fix: love I => I love] this song so much.
Output only the marked transcript."""
FIX = re.compile(r"\[fix:\s*(.*?)\s*=>\s*(.*?)\]", re.S)


def grammar(words):
    try: out = chat(GRAMMAR_SYS, " ".join(w["w"] for w in words))
    except Exception as e: print("llm error", e); return []
    res = []
    for m in FIX.finditer(out):
        old = [norm(x) for x in m.group(1).split()]
        if old == [norm(x) for x in m.group(2).split()]: continue  # punctuation-only "fix": nothing to re-say
        for k in range(len(words) - len(old) + 1):
            if [norm(w["w"]) for w in words[k:k + len(old)]] == old:
                res.append(dict(i=k, j=k + len(old) - 1, old=" ".join(w["w"] for w in words[k:k + len(old)]), new=m.group(2).strip())); break
    res.sort(key=lambda f: f["i"]); out = []
    for f in res:  # merge fixes that are <= 1 word apart into one span: regenerating them together keeps prosody coherent
        if out and f["i"] - out[-1]["j"] <= 2:
            g = out[-1]; mid = " ".join(w["w"] for w in words[g["j"] + 1:f["i"]])
            g.update(j=f["j"], old=" ".join(w["w"] for w in words[g["i"]:f["j"] + 1]), new=" ".join(x for x in [g["new"], mid, f["new"]] if x))
        else: out.append(dict(f))
    return out


TIGHT_SYS = """You shorten rambling voice messages using ONLY deletions, so the speaker's real voice is kept. Copy the transcript EXACTLY and wrap removable parts in [cut: ...].
Remove digressions, repeated points, filler phrases and preamble; keep every fact, request, time, place, name, and the greeting/sign-off. Aim to cut 30-50%. Cut whole phrases or clauses, never single words in the middle of a phrase.
Output only the marked transcript."""


def tighten(words):
    base = [c for c in clean(words) if c["auto"]]  # self-repairs first, so shortening never half-cuts a correction
    try: tags = map_tokens(words, parse(chat(TIGHT_SYS, " ".join(w["w"] for w in words), 1500)))
    except Exception as e: print("llm error", e); return base
    out = list(base)
    for s in spans(words, tags):
        if s["kind"] != "cut" or any(s["i"] <= b["j"] and b["i"] <= s["j"] for b in base): continue
        out.append(dict(s, auto=not any(cat(w["w"]) for w in words[s["i"]:s["j"] + 1])))  # dates/numbers/negations: suggest only
    return sorted(out, key=lambda c: c["i"])


INTENT_SYS = """You get the speech-recognition transcript of a voice message, often from a non-native English speaker.
Mispronounced words get recognized as DIFFERENT real words that sound similar: r/l ("lice" for "rice"), th/s ("sink" for "think"), short/long vowels ("sheep" for "ship"),
dropped endings ("walk" for "walked"). Words marked (?) were recognized with LOW confidence and are the most likely to be wrong.
Write up to 3 different sentences the speaker most likely INTENDED, most likely first. Keep every word that already makes sense; only change words that are wrong in context.
If the transcript already makes sense, return it unchanged as the only option.
Answer as JSON: {"intended": ["sentence 1", "sentence 2"]}"""


def intent(words):
    """N-best guesses of what the speaker meant -> candidate word substitutions per span (caller ranks them by the actual sounds)."""
    try:
        out = chat(INTENT_SYS, " ".join(w["w"] + ("(?)" if w.get("p", 1) < 0.6 else "") for w in words), 500)
        m = re.search(r"\{.*\}", out, re.S); sents = json.loads(m.group(0))["intended"] if m else [out]
    except Exception as e: print("llm error", e); return []
    a, groups = [norm(w["w"]) for w in words], {}
    for rank, sent in enumerate(sents[:3]):
        b = re.sub(r"\(\?\)", "", str(sent)).split()
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, [norm(x) for x in b], autojunk=False).get_opcodes():
            if op != "replace" or i2 - i1 > 3 or j2 - j1 > 3: continue  # word substitutions only
            new = " ".join(re.sub(r"[.,!?;:]+$", "", x) for x in b[j1:j2])
            if norm(new.replace(" ", "")) == "".join(a[i1:i2]): continue
            g = groups.setdefault((i1, i2 - 1), dict(i=i1, j=i2 - 1, old=" ".join(w["w"] for w in words[i1:i2]), cands=[]))
            if new.lower() not in [c["new"].lower() for c in g["cands"]]: g["cands"].append(dict(new=new, rank=rank))
    return list(groups.values())
