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
        ("num", r"\d.*|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|half|noon|midnight|"
                r"first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|twentieth|thirtieth"),
        ("day", r"monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|yesterday|morning|evening|afternoon")]
cat = lambda w: next((c for c, p in CATS if re.fullmatch(p, norm(w))), None)


THINK = os.environ.get("CLEAN_THINK", "never")  # never | auto (only messages with a retraction phrase) | always
PARTS = os.environ.get("CLEAN_PARTS", "1") == "1"  # the parallel sentence-level restatement/aside pass
from concurrent.futures import ThreadPoolExecutor
POOL = ThreadPoolExecutor(4)


HOSTED = "generativelanguage.googleapis.com" in str(LLM.base_url)  # Gemini's OpenAI-compatible endpoint (eval only)
if os.environ.get("LLM_KEY_FILE"): LLM.api_key = open(os.path.expanduser(os.environ["LLM_KEY_FILE"])).read().strip()


def chat(system, user, max_tokens=800, think=False):
    if HOSTED:
        effort = os.environ.get("GEMINI_THINK_EFFORT", "medium") if think else os.environ.get("GEMINI_EFFORT", "low")
        r = LLM.chat.completions.create(model=MODEL, temperature=0, reasoning_effort=effort,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
        return (r.choices[0].message.content or "").strip()
    r = LLM.chat.completions.create(model=MODEL, temperature=0, max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        extra_body={"chat_template_kwargs": {"enable_thinking": bool(think)}})
    m = r.choices[0].message; out = m.content or ""
    return re.sub(r"^.*?</think>", "", re.sub(r"<think>.*?</think>", "", out, flags=re.S), flags=re.S).strip()


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


CLEAN_SYS = """You clean up transcripts of casual voice messages so they say what the speaker finally MEANT, using deletions only.
Read the WHOLE message first. Then copy the transcript EXACTLY, word for word, and wrap every part that should be deleted in [kind: ...].
Kinds:
- [filler: ...] um, uh, er, hmm.
- [correction: ...] the speaker said something wrong and corrected it. Wrap the WRONG words plus the editing phrase (no, no wait, sorry, I mean, actually, or rather, make that, correction, well more like). Keep the corrected words unwrapped. The correction can come a sentence later ("It's on Monday. Actually no, it's on Friday.").
- [restart: ...] an abandoned start that the speaker begins again, or a cut-off word.
- [repetition: ...] a word or phrase said twice by accident ("the the", "I I think"): wrap the first copy.
- [command: ...] the speaker takes back part of THIS message: "scratch that", "strike that", "delete that", "delete the last sentence", "forget that", "forget I said that", "ignore that", "ignore what I just said", "never mind", "cancel that", "take that back", "don't listen to that", "let me start over", "let me rephrase", "let me say that again". Wrap the retraction phrase TOGETHER WITH what it cancels: usually the sentence or clause right before it, or the part it names ("the last sentence", "what I said about the car"). Keep what comes after.
- [redundant: ...] the speaker says the same point again in other words: wrap the EARLIER version and keep the later one, unless the earlier one has a detail the later one lacks.
- [aside: ...] thinking out loud or talking to someone else ("what's it called", "hold on", "how do I say this", "Max, stop it"), not meant for the listener.
Never delete: names, numbers, times, places, reasons or requests that the final message needs; deliberate emphasis ("really, really", "no, no, it's fine"), reminders ("again, Friday at eight"), contrasts ("it's not Monday, it's Tuesday"), lists; discourse markers (well, you know, like, I mean it); polite "sorry".
These are NOT retractions of the message: reported or quoted speech ("she said never mind"), instructions about other things ("delete the last slide", "ignore the first email", "forget about the money", "don't forget", "never mind the mess" meaning don't worry about it), "I take back what I said yesterday".
Never add or change words. If unsure, leave the words unwrapped.
Examples:
IN: Can you get the blue, uh, I mean the green paint for the fence?
OUT: Can you get [correction: the blue, uh, I mean] the green paint for the fence?
IN: Um, so we were, we're planning to, uh, to drive up on Friday.
OUT: [filler: Um,] so [restart: we were,] we're planning [repetition: to,] [filler: uh,] to drive up on Friday.
IN: The train leaves at ten. The weather here is awful, by the way. Never mind, scratch that. See you at the station.
OUT: The train leaves at ten. [command: The weather here is awful, by the way. Never mind, scratch that.] See you at the station.
IN: My address is twelve Elm Road. Forget I said that, I'll send it later. Bye!
OUT: [command: My address is twelve Elm Road. Forget I said that,] I'll send it later. Bye!
IN: Call me at six, make that six thirty. I need the car on Sunday. Like, I need the car Sunday afternoon, if that's okay.
OUT: Call me at [correction: six, make that] six thirty. [redundant: I need the car on Sunday. Like,] I need the car Sunday afternoon, if that's okay.
IN: Can you, hang on, the doorbell, sorry, can you check the oven?
OUT: [restart: Can you,] [aside: hang on, the doorbell, sorry,] can you check the oven?
IN: She said never mind, so I didn't send it. Ignore the noise, I'm on the bus. It's not Tuesday, it's Thursday.
OUT: She said never mind, so I didn't send it. Ignore the noise, I'm on the bus. It's not Tuesday, it's Thursday.
Output only the marked transcript."""
KINDS = ("filler", "correction", "restart", "repetition", "command", "redundant", "aside")
# Phrases that take back part of THIS message (matched on normalized words).
RETRACT = re.compile(r"\b((?:delete|remove|forget|ignore|cancel|erase|strike|disregard|scratch|scrap|skip|undo) (?:that last \w+|the last (?:(?:two|three|few|couple(?: of)?) )?\w+|"
                     r"that (?:bit|part|one)|everything (?:that )?i (?:just )?said|everything|all of that|all that|what i (?:just )?said|i (?:said|mentioned) (?:that|it|this)|that|this|it)|"
                     r"i take (?:that|it) back|take that back|(?:take|leave) (?:that|this|it) out|don't (?:write|put) (?:that last \w+|that|this|it) (?:down|in)|"
                     r"pretend i (?:didn't|did not|never) (?:say|said) (?:that|this|it)|"
                     r"never ?mind (?:that last \w+|the last (?:(?:two|three|few|couple(?: of)?) )?\w+|what i (?:just )?said|all (?:of )?that)|never ?mind|start over|start again|"
                     r"don't listen to (?:that last \w+|what i (?:just )?said|that|this|me)|let me (?:start over|start again|rephrase(?: that)?|say that again|try (?:that )?again|redo that))\b")
FUZZ = re.compile(r"\b((?:scratch(?:ed|es)?|scratchy|crash|strike[sd]?|striked|struck|delete[sd]?|undid|undue|undo|forgot|forget|erase[sd]?) "
                  r"(?:that|dat|dad|at|tat|thats|that's|than|the|this|it|those)|undo|never ?(?:mind|mine|mined)(?: (?:that|dat|at|it))?|"
                  r"(?:start|started|star|starts) (?:over|overs|again))\b")  # how the recognizer mishears the command phrases
# A comment on the sentence before a retraction ("that came out wrong, forget it") belongs to the retraction.
META = re.compile(r"(that|this|it) (came out|sounded|sounds|was|is) (wrong|harsh|bad|mean|rude|weird|awful|terrible)|that's not what i meant|that's not what i mean|"
                  r"that's wrong|i shouldn't have said that|just kidding|i'm kidding|my bad|sorry about that")
REPORT = {"said", "says", "say", "told", "tells", "asked", "asks", "goes", "went", "yelled", "shouted", "wrote", "texted", "replied", "added"}
# "Ignore the plants": a retraction only when the plants were just mentioned.
TOPIC = re.compile(r"\b(ignore|forget|forget about|skip|scratch|delete|remove|cancel|drop|disregard|leave off|leave out|cross off|take off) (the|my|that|those|about the|about my|about)"
                   r"(?: (?:bit|part|stuff|thing|line) (?:about|with|on)(?: the| my)?)? (?P<t>[a-z']+)")  # "forget the bit about the launch date"
RESAY = re.compile(r"\blet me (say that again|rephrase|try (that )?again|redo that|start over|start again)\b")
PART = re.compile(r"\b(last|that|this) (bit|part|item|thing|bits)\b")  # "never mind that last bit": the last clause / list item, not the whole sentence
ABOUT = re.compile(r"^about (the |my |that )?([a-z']+)")
UNLIMITED = re.compile(r"\b(everything|all that|all of that|all of it|start over|start again|whole thing)\b")
TWO = re.compile(r"\b(two|both|couple)\b")
DISMISS = re.compile(r"(it's |that's |it is |that is )?(not important|doesn't matter|it doesn't matter|not relevant|irrelevant|whatever|forget it|ignore it|"
                     r"my bad|sorry|wrong|that was wrong|i was wrong|they're fine|it's fine|that's fine|never ?mind|oops|actually)( sorry| anyway| actually)?")
# Editing phrases of a self-correction, longest first.
EDITS = {tuple(e.split()) for e in ["what i mean is", "what i meant is", "what i meant was", "i mean", "i meant", "or rather", "make that", "more like",
         "no no", "no wait", "oh no", "oh wait", "no", "nope", "wait", "sorry", "actually", "rather", "correction", "well", "oops", "not", "oh", "ugh", "hmm"]}
INTERJ = {"actually", "sorry", "oh", "okay", "ok", "wait", "no", "ugh", "so", "and", "but", "well", "oops", "yeah", "hmm", "hm", "right", "alright", "hey", "anyway",
          "god", "gosh", "jeez", "geez"}
CLAUSE = {"i", "i'll", "i'm", "i've", "i'd", "we", "we'll", "we're", "you", "you'll", "it", "it's", "let", "let's", "so", "and", "but", "anyway", "actually",
          "just", "okay", "ok", "sorry", "please", "what", "that's", "he", "she", "they", "there", "there's", "see", "call", "bring", "meet", "can", "could", "bye", "thanks"}
CONJ = {"and", "but", "so", "or", "then", "also", "oh", "because", "plus"}
DET = {"the", "a", "an", "my", "our", "your", "his", "her", "their", "some", "those", "these"}
LEAD = {"it's", "its", "it", "is", "that's", "it'll", "be", "make", "was"}  # "No, sorry, it's 4471": the repair re-says the frame before the number
EMPH = {"really", "very", "so", "wait", "no", "yes", "yeah", "sorry", "please", "thanks", "thank", "never", "always", "go", "hurry", "come", "okay", "ok", "much", "too"}
GAPW = {"okay", "ok", "sorry", "so", "well", "like", "oh"}  # may sit between the two copies of a repeat ("the plan is, okay, the plan is")
CUE = re.compile(r"^(again|once again|so again|seriously|really|remember|like i said|as i said|just to remind|i repeat|honestly|to be clear|just so you know|one more time)\b")
STOPW = set("""a an the and or but so to of in on at for from with by about as is are was were be been being am do does did have has had i you he she it we they
me him her us them my your his its our their this that these those there here what which who whom whose when where why how not no yes just like really very
can could will would should shall may might must gonna wanna gotta i'm i'll i've i'd you're you'll it's that's we're we'll they're there's let let's
okay ok well oh um uh also too then than if because basically actually kind sort thing things get got go going""".split())


def ntext(words, i, j): return " ".join(norm(w["w"]) for w in words[i:j + 1] if norm(w["w"]))
def gap(words, k): return words[k + 1]["s"] - words[k]["e"] if k + 1 < len(words) else 9.0  # pause after word k
ABBR = re.compile(r"(mr|mrs|ms|dr|st|jr|sr|prof|mt|vs)\.")
def boundary(words, k):  # a sentence ends after word k (not after "Mr." / "Dr.")
    w = words[k]["w"]
    return (bool(re.search(r"[.!?]$", w)) and not ABBR.fullmatch(w.lower())) or gap(words, k) >= 0.6
def stem(w): return re.sub(r"('s|s|ing|ed)$", "", w) if len(w) > 4 else w


def sent_start(words, k):
    while k > 0 and not boundary(words, k - 1): k -= 1
    return k


def matches(rx, words, i, j):
    """(first, last) word index of every match of rx inside words[i..j], on normalized words."""
    idx = [k for k in range(i, j + 1) if norm(words[k]["w"])]; s = " ".join(norm(words[k]["w"]) for k in idx)
    return [(idx[s[:m.start()].count(" ")], idx[s[:m.end() - 1].count(" ")], m) for m in rx.finditer(s)]


def edit_run(words, i, j):
    """Last run of editing-phrase words (and fillers) inside words[i..j]: the interregnum of a self-correction."""
    n = [norm(w["w"]) for w in words]; flag = [False] * len(words); k = i
    while k <= j:
        for L in (4, 3, 2, 1):
            if k + L - 1 <= j and tuple(n[k:k + L]) in EDITS:
                for m in range(k, k + L): flag[m] = True
                k += L; break
        else:
            flag[k] = filler(n[k]); k += 1
    q = max((k for k in range(i, j + 1) if flag[k]), default=None)
    if q is None: return None
    p = q
    while p - 1 >= i and flag[p - 1]: p -= 1
    if all(n[m] == "not" for m in range(p, q + 1)) and not (q + 1 < len(words) and n[q + 1] and n[q + 1] not in STOPW and n[q + 1] in n[max(0, p - 3):p]):
        return None  # "it's not Monday, it's Tuesday" is a contrast; "on Thursday, not Thursday, Friday" is a correction
    return p, q


def reshape(words, s):
    """Self-correction -> (i, j, sure): cut the wrong words and the editing phrase, keep the repair."""
    i, j = s["i"], s["j"]; N = len(words); n = lambda m: norm(words[m]["w"])
    run = edit_run(words, i, min(j + 1, N - 1))
    if not run or run[1] + 1 >= N or run[0] == 0: return i, j, False
    p, q = run
    if n(q) == "not":  # "twenty, sorry, not twenty, thirty": "not" + the wrong word again belongs to the editing phrase
        prev = {stem(n(m)) for m in range(max(0, p - 4), p)}  # "Jenny's, um, no, not Jenny, it's Jessica's"
        while q + 2 < N and stem(n(q + 1)) in prev: q += 1
    only_fill = all(filler(words[m]["w"]) for m in range(p, q + 1)); lo = max(sent_start(words, p - 1), p - 10)
    # 1) the repair starts again from a word said just before the wrong part: "on Fifth Street. Oh wait, sorry, it's the one on Seventh"
    best = None
    for b in range(q + 1, min(N, q + 6)):
        mid = range(q + 1, b)  # repair words before that word are cut too: at most 3, none meaning-bearing
        if len(mid) > 3 or any((cat(words[m]["w"]) or (words[m]["w"][:1].isupper() and n(m) not in STOPW)) and not (n(m) == "one" and n(m - 1) in ("the", "this", "that", "a"))
                               for m in mid) or (b > q + 1 and boundary(words, b - 1)): break
        for a in range(p - 1, lo - 1, -1):
            if n(a) and n(a) == n(b) and (a < p - 1 or b == q + 1):
                rank = (n(a) not in STOPW, all(n(m) in STOPW or n(m) == "one" for m in mid), a)  # skip over the new "red binder" only if no other anchor  # "the drawer in the hallway, or rather, the drawer in the kitchen": anchor on "drawer", not "the"
                if best is None or rank > best[2]: best = (a, b, rank)
                break
    if best: return best[0] + 1, best[1], True
    # 2) a number or day replaced by another one: "Monday, no wait, Wednesday", "The code is 4417. No, sorry, it's 4471"
    r = q + 1; c = cat(words[r]["w"]); lead = 0
    while c not in ("num", "day") and lead < 2 and r + lead + 1 < N and n(r + lead) in LEAD:
        lead += 1; c = cat(words[r + lead]["w"])
    if c not in ("num", "day"): lead, c = 0, cat(words[r]["w"])
    for m in range(p - 1, max(lo, p - 8) - 1, -1):
        if (not lead and n(m) == n(r)) or (c in ("num", "day") and cat(words[m]["w"]) == c): return m, q + lead, True
    # 3) the model marked a short wrong part itself: "Kate, uh, Katie"
    if p > i and p - i <= 4 and not any(boundary(words, m) for m in range(i, p - 1)) and (p - i <= 2 or not boundary(words, p - 1)): return i, q, True  # "Rachel? I mean", not "I forgot that. Sorry,"
    # 4) one or two words replaced by as many: "Turn right, no, left, at the gas station"
    if p == i and not only_fill:
        L = 1
        while r + L - 1 < N - 1 and not re.search(r"[,.!?;:]$", words[r + L - 1]["w"]) and L <= 3: L += 1
        if L <= 2 and p - L >= 0 and not any(boundary(words, m) for m in range(p - L, p - 1)): return p - L, q, True
    return i, q, False


def guarded(words, c0, c1):
    """A retraction phrase stands on its own (not "she said never mind", "scratch that idea", "never mind the weather")."""
    N = len(words); prev = norm(words[c0 - 1]["w"]) if c0 > 0 else ""
    before = c0 > 0 and (re.search(r"[,.!?;:]$", words[c0 - 1]["w"]) or gap(words, c0 - 1) >= 0.3 or prev in INTERJ or filler(prev))
    after = c1 == N - 1 or re.search(r"[,.!?;:]$", words[c1]["w"]) or gap(words, c1) >= 0.3 or norm(words[c1 + 1]["w"]) in CLAUSE | {"about"}
    p2 = norm(words[c0 - 2]["w"]) if c0 > 1 else ""  # reported speech: "and then he said, scratch that", "she told me, never mind"
    quoted = prev in REPORT or (prev in ("me", "him", "her", "us", "them") and p2 in REPORT)
    return bool(before and after and not quoted)


def back(words, e):
    """Step back from word e over interjections, fillers, "hang on", and a comment on what was said ("that came out wrong")."""
    n = lambda k: norm(words[k]["w"])
    while e >= 0:
        if not n(e) or n(e) in INTERJ or filler(words[e]["w"]): e -= 1; continue
        if e >= 1 and ((n(e) == "on" and n(e - 1) in ("hang", "hold")) or (n(e) in ("sec", "second") and n(e - 1) == "one")): e -= 2; continue
        cs = e
        while cs > 0 and not re.search(r"[,.!?;:]$", words[cs - 1]["w"]) and gap(words, cs - 1) < 0.3: cs -= 1
        if META.fullmatch(ntext(words, cs, e)): e = cs - 1; continue
        break
    return e


def chain(words, i, j):
    """The last retraction in words[i..j] (several phrases in a row count as one): (first, last, topic word or None) or None."""
    found = []
    for a, b, m in matches(RETRACT, words, i, j):
        if guarded(words, a, b): found.append((a, b, None))
    for a, b, m in matches(FUZZ, words, i, j):  # a near-miss: only on its own, then a pause or the end of speech
        if any(x[0] <= b and a <= x[1] for x in found): continue
        alone = re.search(r"[,.!?;:]$", words[b]["w"]) or b == len(words) - 1
        if guarded(words, a, b) and alone and (b == len(words) - 1 or gap(words, b) >= 0.4): found.append((a, b, None))
    for a, b, m in matches(TOPIC, words, i, j):
        seen = {stem(norm(w["w"])) for w in words[max(0, a - 30):a]}; ts = [stem(m.group("t"))]
        for _ in range(2):  # the topic may be a two-word name: "the dinner part", "the launch date"
            if b + 1 >= len(words) or re.search(r"[,.!?;:]$", words[b]["w"]) or gap(words, b) >= 0.3 or norm(words[b + 1]["w"]) in CLAUSE | STOPW: break
            b += 1; ts.append(stem(norm(words[b]["w"])))
        t = next((x for x in ts if x not in STOPW and x in seen), None)
        if t and guarded(words, a, b) and not any(x[0] <= a <= x[1] for x in found): found.append((a, b, t))
    if not found: return None
    found.sort(); a, b, t = found[-1]
    for x in reversed(found[:-1]):  # "never mind, let me start over", "scratch that, scratch that"
        if x[1] < a and all(norm(w["w"]) in INTERJ or filler(w["w"]) or not norm(w["w"]) for w in words[x[1] + 1:a]): a, t = x[0], t or x[2]
        else: break
    if t is None:
        m = ABOUT.match(ntext(words, b + 1, min(len(words) - 1, b + 3)))
        if m: t = stem(m.group(2)); b = next(k for k in range(b + 1, len(words)) if stem(norm(words[k]["w"])) == t)
    return a, b, t


def scope_command(words, i, j):
    """Spoken retraction -> [(i, j, sure)]: the phrase plus what it cancels (the sentence before it, or the clause the model chose,
    two sentences for "the last two", everything for "start over", the sentence that mentions X for "about X")."""
    ch = chain(words, i, j)
    if not ch: return [(i, j, False)]
    c0, c1, topic = ch; N = len(words)
    e = back(words, c0 - 1)
    if e < 0: return [(i, j, False)]  # nothing before it to cancel
    s1 = sent_start(words, e); text = ntext(words, c0, c1)
    lo = 0 if UNLIMITED.search(text) else (sent_start(words, s1 - 1) if TWO.search(text) and s1 > 0 else s1)
    clause = lambda k, s: next((m + 1 for m in range(k - 1, s - 1, -1) if re.search(r"[,;:]$", words[m]["w"])), s)  # start of the clause holding word k
    lead = lambda a, b: all(norm(w["w"]) in INTERJ | CONJ or filler(w["w"]) for w in words[a:b])  # only "Oh, and" before the clause
    r = c1 + 1  # "two tickets. Strike that, four tickets": a same-type replacement right after the phrase makes it a correction
    if not topic and lo == s1 and r < N and cat(words[r]["w"]) in ("num", "day"):
        m = next((m for m in range(e, s1 - 1, -1) if cat(words[m]["w"]) == cat(words[r]["w"])), None)
        if m is not None and (r == N - 1 or re.search(r"[,.!?;:]$", words[r]["w"]) or (m + 1 <= e and norm(words[m + 1]["w"]) == norm(words[r + 1]["w"]))):
            return [(m, c1, True)]
    if i > e:  # the model marked only the phrase: cancel the sentence before it, or the clause if the phrase is mid-sentence
        i0 = min(s1 if boundary(words, e) else clause(e, s1), lo)
    else:
        i0 = max(i, lo)
        # the model started mid-clause ("Monday. Ugh, scratch that"): from the start of that clause
        if i0 > s1 and boundary(words, e) and not re.search(r"[,;:]$", words[i0 - 1]["w"]) and norm(words[i0]["w"]) not in CONJ: i0 = clause(i0, s1)
    if PART.search(text) and lo == s1:  # "..., and two pounds of beef. Never mind that last bit": the last clause / list item
        i0 = max(clause(e, s1), next((m for m in range(e, s1, -1) if norm(words[m]["w"]) in ("and", "but", "or", "then")), s1))
        if lead(s1, i0): i0 = s1  # "Oh, and the rent is going up"
    if RESAY.search(text): i0 = min(i0, s1)  # "let me say that again": the whole sentence is said again
    if i0 == 0 and e > 1 and norm(words[0]["w"]) in ("hey", "hi", "hello"):  # "Hey Sam, ignore everything I just said": the greeting stays
        i0 = 1 if re.search(r"[,.!]$", words[0]["w"]) else (2 if words[1]["w"][:1].isupper() and re.search(r"[,.!]$", words[1]["w"]) else 0)
    out = [(i0, None)]
    if topic:  # "ignore what I said about the vase": the latest sentence that mentions the vase (or its own "and ..." clause)
        k = next((k for k in range(e, max(-1, e - 40), -1) if stem(norm(words[k]["w"])) == topic), None)
        if k is not None:
            ts = sent_start(words, k); cs = clause(k, ts); te = k; n = lambda m: norm(words[m]["w"])
            while te < e and not boundary(words, te): te += 1
            d = k
            while d > ts and n(d - 1) in DET: d -= 1
            if k + 2 <= te and n(k + 1) in ("and", "or") and not re.search(r"[,;:]$", words[k]["w"]):  # "the Garcias and the Lins": that item
                out = [(d, k + 1), (e + 1, None)]
            elif cs > ts and re.search(r",$", words[cs - 1]["w"]) and words[k]["w"].endswith(",") and k - cs <= 3:  # "napkins, candles, oh wait"
                out = [(cs, None)] if k >= e else [(cs, k), (e + 1, None)]
            else:
                if cs > ts and norm(words[cs]["w"]) in CONJ and not lead(ts, cs): ts = cs  # "The client approved the logo, and they want the launch moved"
                else:  # "The faucet is dripping and the window won't close", "coffee and eggs, and, uh, we need paper towels"
                    m = next((m for m in range(k - 1, ts + 2, -1) if n(m) in ("and", "but", "plus") and (words[m - 1]["w"].endswith(",") or words[m]["w"].endswith(",")
                              or n(m + 1) in DET | {"i", "we", "you", "he", "she", "they", "it"} or filler(words[m + 1]["w"]))), None)
                    if m is not None: ts = m
                out = [(ts, None)] if te >= e else [(ts, te), (e + 1, None)]
    end = c1  # a short dismissal after the phrase goes too: "forget that, not important."
    t = c1 + 1
    while t < N - 1 and t - c1 <= 4 and not boundary(words, t): t += 1
    if t < N and t - c1 <= 4 and DISMISS.fullmatch(ntext(words, c1 + 1, t)): end = t
    return [(a, b if b is not None else end, True) for a, b in out]


GRAMD = {"that", "had", "is", "was", "do", "in", "on", "out", "up", "off"}  # "she had had enough", "I think that that was fair", "log in in the morning"
SAFE1 = {"the", "a", "an", "i", "to", "and", "we", "my", "of", "for", "but", "if"}  # one-word repeats safe to cut anywhere ("the the", "I, I")


def repeats(words, i, j, strict=False):
    """Accidental repeats touching words[i..j] -> [(a, b)]: the first copy (and editing words between the copies) to cut.
    "the the", "I don't think we, I don't think we", "the plan is, okay, the plan is". Emphasis and numbers are never repeats.
    strict: the whole message, unprompted by the model -- only function-word repeats within a sentence ("for the, | for the")."""
    n = [norm(w["w"]) for w in words]; N = len(words); out = []; k = max(0, i - 4)
    while k <= min(j + 1, N - 2):
        hit = None
        for L in (4, 3, 2, 1):
            unit = n[k:k + L]
            if len(unit) < L or not all(unit) or set(unit) <= EMPH or (set(unit) & EMPH and set(unit) <= EMPH | CONJ) or any(cat(words[m]["w"]) == "num" for m in range(k, k + L)): continue  # "no, no, and no"
            if strict and (any(re.search(r"[.!?]$", words[m]["w"]) for m in range(k, k + L)) or not (set(unit) <= SAFE1 if L == 1 else set(unit) <= STOPW)): continue
            for g in (0, 1, 2):
                if k + 2 * L + g > N or (g and not all(filler(n[m]) or n[m] in GAPW for m in range(k + L, k + L + g))): continue
                if L == 1 and unit[0] in GRAMD and not g and not re.search(r"[,;:]$", words[k]["w"]) and gap(words, k) < 0.3: continue
                if n[k + L + g:k + 2 * L + g] == unit and k + 2 * L + g - 1 >= i and k <= j: hit = (k, k + L + g - 1); break
            if hit: break
        if hit: out.append(hit); k = hit[1] + 1
        else: k += 1
    return out


def content(ws): return {stem(x) for x in (norm(w["w"]) for w in ws) if x and x not in STOPW and len(x) > 2}


def safe(words, s, kept):
    """Can this deletion be applied without asking? Meaning-bearing words (numbers, days, negations) may only go when the
    speaker replaced them (a same-type word is kept after the span) or said them again (kept elsewhere)."""
    i, j, kind = s["i"], s["j"], s["kind"]
    after = [norm(words[k]["w"]) for k in kept if k > j][:12]; kept_all = {norm(words[k]["w"]) for k in kept}
    if kind == "filler": return all(filler(w["w"]) for w in words[i:j + 1])
    if not kept: return False  # never delete the whole message without asking
    if kind in ("command", "repetition"): return True  # built and checked by scope_command / repeats
    skip = set()
    if kind == "correction":
        run = edit_run(words, i, j)
        if not run: return False
        skip = set(range(run[0], run[1] + 1))
    if kind == "redundant":
        if CUE.match(ntext(words, i, j)): return False  # "Again, Friday at eight": a reminder, on purpose
        later = [words[k] for k in kept if k > j][:30]; earlier = [words[k] for k in kept if k < i][-30:]; c = content(words[i:j + 1])
        fwd = bool(later) and (not c or len(c & content(later)) >= 0.5 * len(c))  # the later version says it again
        back = bool(c) and len(c & content(earlier)) >= 0.75 * len(c)  # or it repeats what was said before
        if not (fwd or back): return False
    for k in range(i, j + 1):
        c = cat(words[k]["w"]); w = norm(words[k]["w"])
        if not c or k in skip: continue
        if w in kept_all and kind != "correction": continue  # said again and kept
        if c in ("num", "day") and any(cat(x) == c for x in after) and kind in ("correction", "redundant", "restart"): continue
        if c == "neg" and kind in ("redundant", "restart") and any(cat(x) == "neg" for x in after): continue
        return False
    return True


PRIO = {"command": 0, "correction": 1, "repetition": 2, "restart": 3, "redundant": 4, "aside": 5, "filler": 6}

# Second, sentence-level pass (runs in parallel with the main call): restatements and asides are whole thoughts, and the
# model judges them better on numbered parts than by wrapping spans inline.
PARTS_SYS = """A voice message is split into numbered parts. Find two things.
1. "restated": a part that only says again, in other words, what another part already says, and adds nothing the other part lacks.
   Give [part to delete, the part that says it]. Delete the part with fewer details; if both say the same, delete the EARLIER one.
2. "aside": a part not meant for the listener: talking to someone else in the room (a child, a pet, a waiter), or thinking out loud ("how do I put this").
NOT restated: a reminder ("again, Friday at eight"), deliberate emphasis, a question and its answer, a request and its reason, two different details about the same thing, a correction.
Answer with JSON only, e.g. {"restated": [[2, 3]], "aside": [5]}. Use empty lists when there is nothing.
Example:
1: Hey, I'm stuck in traffic.
2: Sam, stop kicking the seat!
3: I'm gonna be late.
4: I'm running about twenty minutes behind.
5: Again, start without me.
{"restated": [[3, 4]], "aside": [2]}"""
CONN = re.compile(r"^((like|basically|so|yeah|well|okay|ok|oh|essentially|i mean|what i mean is|what i'm saying is|what i'm trying to say is|in other words) )+")  # links a restatement to the earlier one
GREET = {"hey", "hi", "hello", "sorry"}


def parts(words):
    """Sentences, also split at a comma that starts a new clause ("We're out of coffee, there's no coffee left"); each part >= 3 words."""
    N = len(words); out = []; s = 0
    for k in range(N):
        if k == N - 1 or boundary(words, k): out.append((s, k)); s = k + 1; continue
        if re.search(r"[,;:]$", words[k]["w"]) and k - s >= 2 and norm(words[k + 1]["w"]) in CLAUSE | {"there", "there's"}:
            nb = next((m for m in range(k + 1, N) if boundary(words, m)), N - 1)
            if nb - k >= 3: out.append((s, k)); s = k + 1
    return out


MORE_SYS = """Two parts of a voice message say roughly the same thing. Which one carries MORE information (more details, names, numbers, conditions)?
Answer with one letter: A, B, or S if they carry the same information."""
NOT_RESTATE = re.compile(r"^(but|though|although|except|unless|because|however|yet|still|i mean it|i meant it|i mean that|i meant that|i'm serious|"
                         r"i'm not joking|no joke|i promise|for real|trust me|no really)\b")
NOT_VOC = INTERJ | GREET | STOPW | {"honestly", "seriously", "basically", "look", "listen", "please", "thanks", "yes", "guys", "mate", "dude", "babe", "hun", "love"}


def part_call(words, us):
    """The part-level answer, plus for each restated pair which side carries more information (asked separately: the
    combined question often deletes the more detailed version; the pairwise one is consistent under swapping)."""
    text = "\n".join(f"{n + 1}: " + " ".join(w["w"] for w in words[i:j + 1]) for n, (i, j) in enumerate(us))
    m = re.search(r"\{.*\}", chat(PARTS_SYS, text, 120), re.S)
    res = json.loads(m.group(0)) if m else {}
    res["more"] = []
    for pair in (res.get("restated") or [])[:3]:
        try:
            (i, j), (pi, pj) = us[int(pair[0]) - 1], us[int(pair[1]) - 1]
            a = chat(MORE_SYS, "A: " + " ".join(w["w"] for w in words[i:j + 1]) + "\nB: " + " ".join(w["w"] for w in words[pi:pj + 1]), 3)
            res["more"].append(a.strip()[:1].upper())
        except Exception: res["more"].append("?")
    return res


def part_spans(words, us, res):
    """Validate the part-level answer -> candidate spans. The less informative version of a restatement goes; it may go
    only if its numbers, days, negations and names are also in the version that stays. An aside is a whole sentence of its
    own (no numbers or days)."""
    out = []; n = lambda k: norm(words[k]["w"]); key = lambda k: stem(n(k))
    for pair, more in zip(res.get("restated") or [], res.get("more") or []):
        try: d, p = int(pair[0]) - 1, int(pair[1]) - 1
        except Exception: continue
        if not (0 <= d < len(us) and 0 <= p < len(us)) or d == p or abs(d - p) > 2 or more not in "ABS": continue
        if more == "A": d, p = p, d  # the part marked for deletion is the more detailed one: delete the other instead
        starts = lambda u: us[u][0] == sent_start(words, us[u][0])
        if more == "S" and not starts(d) and starts(p): d, p = p, d  # same information: drop the whole sentence, not a clause of another one
        (i, j), (pi, pj) = us[d], us[p]
        t = ntext(words, i, j); t2 = re.sub(r"^(and|so|oh|yeah) ", "", t)
        if CUE.match(t) or NOT_RESTATE.match(t) or NOT_RESTATE.match(t2): continue  # a reminder, a contrast, emphasis ("and I meant it")
        have = {key(k) for k in range(pi, pj + 1)}; neg = any(cat(words[k]["w"]) == "neg" for k in range(pi, pj + 1))
        bad = False
        for k in range(i, j + 1):
            c = cat(words[k]["w"]); name = k > i and words[k]["w"][:1].isupper() and n(k) not in ("i", "i'm", "i'll", "i've", "i'd")
            if (c in ("num", "day") or name) and key(k) not in have: bad = True
            if c == "neg" and not neg: bad = True
        if bad: continue
        sure = more != "S" or bool(content(words[i:j + 1]) & content(words[pi:pj + 1]))  # same information: also needs a shared word
        while i < j and n(i) in GREET: i += 1  # "Hey, I'm gonna be late": the greeting stays
        out.append(dict(kind="redundant", i=i, j=j, sure=sure, checked=True, partner=(pi, pj)))
        if p == d + 1 and sure:  # the restatement's "Like, ..." / "Basically, ..." goes with the part it links back to
            m = CONN.match(ntext(words, pi, pj) + " ")
            if m:
                L = len(m.group(0).split()); idx = [k for k in range(pi, pj + 1) if n(k)][:L]
                if idx and idx[-1] < pj: out.append(dict(kind="redundant", i=pi, j=idx[-1], sure=True, checked=True))
    for a in res.get("aside") or []:
        try: d = int(a) - 1
        except Exception: continue
        if not 0 <= d < len(us): continue
        i, j = us[d]
        own = (i == 0 or boundary(words, i - 1)) and (re.search(r"[.!?]$", words[j]["w"]) or (gap(words, j) >= 0.6 and j + 1 < len(words) and words[j + 1]["w"][:1].isupper()))
        # said to someone else: set off by a pause, or it calls someone by name ("Leo, put that back", "can you, Max, stop it")
        paused = (i > 0 and gap(words, i - 1) >= 0.45) or gap(words, j) >= 0.45
        voc = any(re.fullmatch(r"[A-Z][a-z]+[,!]", words[k]["w"]) and n(k) not in NOT_VOC and not cat(words[k]["w"]) for k in range(i, j + 1))
        if not own or not (paused or voc) or any(cat(words[k]["w"]) in ("num", "day") for k in range(i, j + 1)): continue
        out.append(dict(kind="aside", i=i, j=j, sure=True, checked=True))
    return out


def clean(words, kinds=KINDS, think=None):
    """LLM marks what to delete; code reshapes and validates each span. auto = apply without asking, else only suggest."""
    if not words: return []
    text = " ".join(w["w"] for w in words); N = len(words)
    if think is None: think = THINK == "always" or (THINK == "auto" and bool(RETRACT.search(ntext(words, 0, N - 1))))
    us = parts(words) if PARTS else []
    fut = POOL.submit(part_call, words, us) if len(us) >= 2 and ("redundant" in kinds or "aside" in kinds) else None
    try: tags = map_tokens(words, parse(chat(CLEAN_SYS, text, 3000 if think else 800, think=think)))
    except Exception as e: print("llm error", e); tags = [None] * N
    cand = []
    if fut is not None:
        try: cand += part_spans(words, us, fut.result(timeout=8))
        except Exception as e: print("parts error", e)
    for s in spans(words, tags):
        kind, i, j = (s["kind"] if s["kind"] in KINDS else "restart"), s["i"], s["j"]
        if kind not in ("filler", "command") and chain(words, i, j): kind = "command"  # a span holding a retraction phrase is one
        if kind == "command":
            if not chain(words, i, j):  # no retraction phrase in it: maybe a self-correction ("bananas. No, wait, not bananas, apples")
                i2, j2, ok = reshape(words, dict(i=i, j=j))
                if ok: cand.append(dict(kind="correction", i=i2, j=j2, sure=True)); continue
            cand += [dict(kind="command", i=a, j=b, sure=ok) for a, b, ok in scope_command(words, i, j)]; continue
        if kind == "filler" and not all(filler(w["w"]) for w in words[i:j + 1]): kind = "aside"; cand.append(dict(kind=kind, i=i, j=j, sure=False)); continue
        sure = True
        if kind == "correction": i, j, sure = reshape(words, dict(i=i, j=j))
        if kind == "repetition" or (kind in ("restart", "correction") and not sure):
            reps = repeats(words, i, j)
            if reps: cand += [dict(kind="repetition", i=a, j=b, sure=True) for a, b in reps]; continue
            if kind == "repetition":  # not a literal repeat: maybe a self-correction ("Thursday, not Thursday, Friday")
                i2, j2, sure = reshape(words, dict(i=i, j=j))
                if sure: kind, i, j = "correction", i2, j2
        if kind == "restart":
            # A restart ends at an interruption point (comma, cut-off, pause, filler); "Did you, [have you] fed the cat" does not.
            if not (re.search(r"[,.!?;:\-—]$", words[j]["w"]) or gap(words, j) >= 0.3 or (j + 1 < N and filler(words[j + 1]["w"]))): sure = False
            s0 = sent_start(words, i)  # an abandoned sentence goes whole: "We could take the... Let's just take the train"
            if s0 < i <= s0 + 3 and (boundary(words, j) or words[j]["w"].endswith(("...", "-", "—"))) and all(norm(w["w"]) in STOPW for w in words[s0:i]):
                i = s0
        if kind == "aside":  # set off from the message: "can you, hang on, the doorbell, sorry, can you" (not "um, what's it called, the hummus with")
            delim = lambda k: k < 0 or k >= N - 1 or bool(re.search(r"[,.!?;:]$", words[k]["w"])) or gap(words, k) >= 0.3 or filler(words[k]["w"])
            sure = delim(i - 1) and delim(j)
        cand.append(dict(kind=kind, i=i, j=j, sure=sure))
    # A retraction phrase the model did not mark ("okay, let me start again", "hang on, strike that") is still one.
    k = N - 1
    while k >= 0:
        ch = chain(words, 0, k)
        if not ch: break
        if not any(c["kind"] == "command" and c["i"] <= ch[1] and ch[0] <= c["j"] for c in cand):
            cand += [dict(kind="command", i=a, j=b, sure=ok) for a, b, ok in scope_command(words, ch[0], ch[1])]
        k = ch[0] - 1
    # A part-level restatement/aside that overlaps a sure edit from the main pass yields to it (no half-cut leftovers).
    edits = [c for c in cand if not c.get("checked") and c["sure"] and c["kind"] in ("command", "correction", "repetition", "restart")]
    cand = [c for c in cand if not c.get("checked") or not any(m["i"] <= c["j"] and c["i"] <= m["j"] for m in edits)]
    gone = edits + [c for c in cand if c.get("checked") and c["sure"] and "partner" in c]  # the version a restatement defers to must itself stay
    lost = lambda c: sum(any(m is not c and m["i"] <= k <= m["j"] for m in gone) for k in range(c["partner"][0], c["partner"][1] + 1))
    cand = [c for c in cand if "partner" not in c or 2 * lost(c) < c["partner"][1] - c["partner"][0] + 1]
    # Every filler goes, also those the model skipped; a word said again across a filler or aside is a repeat ("the, um, what's it called, the").
    cand += [dict(kind="filler", i=k, j=k, sure=True) for k, w in enumerate(words) if filler(w["w"])]
    cand += [dict(kind="repetition", i=a, j=b, sure=True) for a, b in repeats(words, 0, N - 1, strict=True)]  # "for the, | for the" the model skipped
    pause = sorted((s for s in cand if s["kind"] in ("filler", "aside")), key=lambda s: s["i"])
    for s in pause:
        a, b = s["i"] - 1, s["j"] + 1
        while b < N and any(x is not s and x["kind"] in ("filler", "aside") and x["i"] <= b <= x["j"] for x in pause): b += 1
        if a < 0 or b >= N or re.search(r"[.!?]$", words[a]["w"]): continue
        for L in (5, 4, 3, 2, 1):
            if a - L + 1 < 0 or b + L > N: continue
            u, v = [norm(w["w"]) for w in words[a - L + 1:a + 1]], [norm(w["w"]) for w in words[b:b + L]]
            if u == v and all(u) and not set(u) <= EMPH and not any(cat(words[k]["w"]) == "num" for k in range(a - L + 1, a + 1)):
                cand.append(dict(kind="repetition", i=a - L + 1, j=a, sure=True)); break
    # Overlaps: higher-priority spans claim their words first; the rest keeps what is left (split into pieces if needed).
    claimed = [None] * N; out = []
    for s in sorted(cand, key=lambda s: (s["kind"] == "filler", not s["sure"], PRIO[s["kind"]], s["i"])):
        free = [k for k in range(s["i"], s["j"] + 1) if claimed[k] is None]
        pieces = [[free[0]]] if free else []
        for k in free[1:]:
            if k == pieces[-1][-1] + 1: pieces[-1].append(k)
            else: pieces.append([k])
        for pc in pieces:
            t = dict(s, i=pc[0], j=pc[-1]); out.append(t)
            for k in pc: claimed[k] = t
    out.sort(key=lambda s: s["i"])
    cut = {k for s in out if s["sure"] for k in range(s["i"], s["j"] + 1)}; kept = [k for k in range(N) if k not in cut]  # suggestions do not count
    res = []
    for s in out:
        s["text"] = " ".join(w["w"] for w in words[s["i"]:s["j"] + 1])
        big = s["kind"] == "aside" and len(content(words[s["i"]:s["j"] + 1])) >= len(content([words[k] for k in kept]))
        auto = s.pop("sure") and (s.pop("checked", False) or safe(words, s, kept)) and bool(kept) and not big
        s.pop("checked", None); s.pop("partner", None)
        if s["kind"] in kinds: res.append(dict(s, auto=auto))
        if not auto and s["kind"] != "filler" and "filler" in kinds:  # a suggestion still loses its ums
            res += [dict(kind="filler", i=k, j=k, text=words[k]["w"], auto=True) for k in range(s["i"], s["j"] + 1) if filler(words[k]["w"])]
    return sorted(res, key=lambda s: (s["i"], s["j"]))


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


def spoken_command(words):
    """'... scratch that' / 'forget I said that' / 'ignore that last part' at the end of what was said so far ->
    (first, last) word index to remove: the retraction + the thought before it. Not "she said never mind" (see guarded)."""
    if not words: return None
    N = len(words); ch = chain(words, max(0, N - 10), N - 1)
    if not ch: return None
    c0, c1, _ = ch
    rest = ntext(words, c1 + 1, N - 1)
    if rest and not DISMISS.fullmatch(rest) and not all(x in INTERJ or filler(x) for x in rest.split()): return None  # it must end the message so far
    e = back(words, c0 - 1) + 1  # interjections before the phrase go with it ("Ugh, scratch that", "that came out wrong, forget it")
    head = words[:e]
    return (last_thought(head) if head else 0, N - 1)


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
