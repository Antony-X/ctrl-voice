# LLM layer: decides WHICH words to cut or fix. The model copies the transcript with inline markup
# (more reliable than asking for indices); code maps markup back to word indices and validates it.
import json, os, re, difflib
from openai import OpenAI
LLM = OpenAI(base_url=os.environ.get("LLM_URL", "http://localhost:8011/v1"), api_key=os.environ.get("LLM_KEY", "x"))
MODEL = os.environ.get("LLM_MODEL", "llm")
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
FILL = re.compile(r"u+h*m*|e+r+m*|a+h+|e+h+|h+m+|m{2,}")  # um, uhm, ummm, uhh, er, erm, ah, eh, hmm, mm
filler = lambda w: bool(FILL.fullmatch(norm(w)))
CATS = [("neg", r"not|never|no|nothing|nobody|none|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|shouldn't|wouldn't|couldn't"),
        ("num", r"\d.*|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|half|noon|midnight"),
        ("day", r"monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|yesterday|morning|evening|afternoon")]
cat = lambda w: next((c for c, p in CATS if re.fullmatch(p, norm(w))), None)


def chat(system, user, max_tokens=800):
    r = LLM.chat.completions.create(model=MODEL, temperature=0, max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        extra_body={"chat_template_kwargs": {"enable_thinking": False}})
    return re.sub(r"<think>.*?</think>", "", r.choices[0].message.content, flags=re.S).strip()


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


CLEAN_SYS = """You clean up transcripts of casual voice messages. Copy the transcript EXACTLY, word for word, but wrap the words that should be deleted in [kind: ...].
Kinds:
- [filler: ...] um, uh, er, hmm.
- [correction: ...] the speaker said something wrong and corrected it. Wrap the WRONG words plus the editing phrase (no wait, I mean, sorry, actually, or rather). Keep the corrected words unwrapped.
- [restart: ...] an abandoned start that the speaker begins again, or a cut-off word.
- [repetition: ...] an accidentally repeated word or phrase (wrap the first copy).
- [command: ...] spoken edit commands ("scratch that", "never mind, let me start over") TOGETHER WITH the sentence(s) they cancel.
Rules: never add or change words. Never wrap meaningful words (negations, numbers, times, names) unless they are the wrong part of an explicit correction.
Do NOT wrap: deliberate contrasts ("it's not Monday, it's Tuesday", "the black one, not the white one"), discourse markers (well, you know, like, I mean it), polite "sorry", sentences that just contain "no", "wait", "actually" or "never mind" normally.
Examples:
IN: I'll meet you on Monday, no wait, Wednesday at five.
OUT: I'll meet you on [correction: Monday, no wait,] Wednesday at five.
IN: Um, so I was, we were thinking we could, uh, go go to the beach.
OUT: [filler: Um,] so [restart: I was,] we were thinking we could, [filler: uh,] [repetition: go] go to the beach.
IN: Dinner is at eight. The place is kind of overrated though. Scratch that. See you there!
OUT: Dinner is at eight. [command: The place is kind of overrated though. Scratch that.] See you there!
IN: No, I can't make it, it's not my day off, it's Sunday.
OUT: No, I can't make it, it's not my day off, it's Sunday.
Output only the marked transcript."""


INTER1 = {"no", "wait", "sorry", "actually", "nope", "um", "uh", "er", "oops", "rather", "mean", "i", "or", "like"}
INTER2 = {("i", "mean"), ("or", "rather"), ("no", "wait"), ("wait", "no"), ("i", "meant")}
CMDW = {"scratch", "that", "delete", "undo", "strike", "never", "mind", "start", "over", "let", "me"}


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


def clean(words, kinds=("filler", "correction", "restart", "repetition", "command")):
    if not words: return []
    try: tags = map_tokens(words, parse(chat(CLEAN_SYS, " ".join(w["w"] for w in words))))
    except Exception as e: print("llm error", e); tags = [None] * len(words)
    out = []
    for s in spans(words, tags):
        if s["kind"] not in kinds: continue
        s["i"], s["j"], sure = repair(words, s); s["text"] = " ".join(w["w"] for w in words[s["i"]:s["j"] + 1])
        risky = not sure
        if s["kind"] == "correction" and sure:  # reparandum replaced by a same-type repair -> meaning-bearing words may go
            out.append(dict(s, auto=True)); continue
        for w in words[s["i"]:s["j"] + 1]:  # deleting a meaning-bearing word is only auto-applied if a same-type replacement follows
            c = cat(w["w"])
            if c and not (s["kind"] == "correction" and any(cat(x["w"]) == c for x in words[s["j"] + 1:s["j"] + 7])): risky = True
        if s["kind"] == "filler" and not all(filler(w["w"]) for w in words[s["i"]:s["j"] + 1]): risky = True
        out.append(dict(s, auto=not risky))
    if "filler" in kinds:  # the model skips some ums; every one it left goes too
        cov = {k for s in out for k in range(s["i"], s["j"] + 1)}
        out += [dict(kind="filler", i=k, j=k, text=w["w"], auto=True) for k, w in enumerate(words) if k not in cov and filler(w["w"])]
        out.sort(key=lambda s: s["i"])
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
