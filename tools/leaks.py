#!/usr/bin/env python3
"""
Find quizzes that give away another quiz's answer.

    python3 tools/leaks.py                    # check everything
    python3 tools/leaks.py quizzes/new.json   # check one file against the rest

WHY THIS EXISTS

At seventy-seven quizzes, four capable authors can each write a good quiz
without reading the other seventy-three, and the platform is now big enough
that this stops working. An audit of one nine-quiz batch found twenty-one
places where a new explanation stated an existing quiz's scored answer as a
matter of course:

    conservation-expert q7 explains an amendment and mentions, in passing,
    that Roosevelt proclaimed sixteen million acres before signing it — which
    is the entire scored answer to conservation q14.

Nobody did anything wrong. The fact belongs in both places. But a visitor who
plays them in the wrong order gets one of them free, and the gallery shuffles
daily, so there is no right order.

WHAT IT CATCHES, AND WHAT IT DOES NOT

It compares the CORRECT OPTION of every question against the prompts and
explanations of every OTHER quiz. Not against other options — a distractor
resembling another quiz's answer is fine and often unavoidable.

Matching is on distinctive words, not on the whole string, because the leak is
almost never verbatim. "He created new reserves before signing the bill" leaks
through "proclaiming sixteen million acres of them in the days before he signed
it" — no shared phrase, same fact.

So: reduce an answer to its significant words, and flag another question that
contains all of them. That is a blunt instrument. It will miss a leak that
shares no vocabulary with its answer, and it will occasionally flag two
questions that merely live in the same paragraph of history. It is meant to
produce a short list a person reads, not a verdict.

The honest measure: run against the batch the audit examined, it surfaces much
of what the audit found by hand, in about a second, and a human still has to
decide which ones matter. It is not a substitute for someone reading the batch.
On the very batch that prompted it, a human auditor found leaks this tool ranked
below its threshold, and found the motivating example above before the tool
could (see the note on suffix stripping). Run it, then still read the quizzes.
"""
import json, os, re, sys, glob

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Words too common to identify anything. Deliberately generous — a leak that
# only shares "Roosevelt" and "president" is not a leak.
STOP = set("""
a an the and or but if when while after before because that this these those
he she it they we you his her its their our your him them us i me my
was were is are be been being had has have did does do will would shall should
can could may might must said says told wrote called named asked
in on at by to from with without within into onto of off up down over under
not no yes both each every all some any none one two three four five six seven
eight nine ten first second third last next only just then than now later once
again still even also almost nearly more most less least very much many few
what which who whom whose where why how there here about after against along
among around as back between during for out through under until upon
roosevelt theodore president presidents american america united states country
national federal government year years time day days made make made take took
new old great big small long short good bad best better
quiz question answer answers history story
""".split())

WORD = re.compile(r"[A-Za-z][A-Za-z'-]+")
MIN_SIG = 3          # an answer needs at least this many distinctive words
MIN_LEN = 4          # a word shorter than this is not distinctive

# Report threshold, chosen by looking at what each band actually contains.
# Across 77 quizzes the three-word band holds 173 of 210 matches and is almost
# entirely names and offices that recur because the man only had one life:
# "Henry Cabot Lodge", "William Howard Taft", "Assistant Secretary of the Navy".
# Nothing to fix there. Four words and up is 37 matches and reads as a genuine
# list. So four is the default and --all shows the rest, rather than picking a
# number that makes the output look clean.
REPORT = 4


# Crude suffix stripping, and it has to be here. The first version of this tool
# compared whole words and therefore MISSED the conservation-expert / conservation
# pair quoted at the top of this file — its own motivating example — because the
# answer says "created" and the explanation says "create". A leak checker that
# cannot match create/created is not a leak checker. This is not real stemming
# and does not need to be: it only has to stop a suffix from hiding a match.
# Order matters, longest first.
SUFFIX = ("ies", "ing", "ed", "es", "s", "'s")


def stem(w):
    for s in SUFFIX:
        if w.endswith(s) and len(w) - len(s) >= MIN_LEN:
            return w[:-len(s)]
    return w


# The stoplist is written in plain English above, so it has to be stemmed too —
# otherwise "years" stems to "year", misses the listed "years", and comes back
# as a distinctive word.
STOP |= {stem(w) for w in STOP}


def significant(text):
    """The words in a string that could identify it, reduced to stems."""
    return {stem(w.lower()) for w in WORD.findall(text or "")
            if len(w) >= MIN_LEN and stem(w.lower()) not in STOP}


def load(paths=None):
    out = {}
    for p in sorted(glob.glob(os.path.join(BASE, "quizzes", "*.json"))):
        if p.endswith("index.json"):
            continue
        try:
            out[os.path.basename(p)[:-5]] = json.load(open(p, encoding="utf-8"))
        except Exception:
            pass
    return out


def index_text():
    """Gallery card blurbs, keyed by quiz id.

    These matter more than their length suggests. The blurb is rendered on the
    card the visitor clicks, and again as the node's meta description, so a
    blurb that states an answer gives it away before the quiz has even opened.
    The first version of this tool did not look at them, and missed
    other-roosevelts' card announcing its own first answer in the opening
    sentence.
    """
    try:
        idx = json.load(open(os.path.join(BASE, "quizzes", "index.json"),
                             encoding="utf-8"))
    except Exception:
        return {}
    # The TITLE counts too, and is the easiest of all to overlook. The quiz
    # titled "Sixteen Battleships" hands over presidency q11, whose answer is
    # "Sixteen battleships sent around the world"; the quiz titled "A Book a
    # Day" handed over books-and-writings' reading-speed question until that
    # question was replaced. A title is the largest text on the card.
    return {e["id"]: (e.get("title", "") + " " + e.get("blurb", ""))
            for e in idx.get("quizzes", []) if isinstance(e, dict) and "id" in e}


def scan(only=None):
    quizzes = load()
    blurbs = index_text()
    # Every question's haystack: what a player READS besides the options.
    hay = {}
    for qid, q in quizzes.items():
        for i, x in enumerate(q.get("questions", []), 1):
            hay[(qid, i)] = significant(
                (x.get("prompt", "") + " " + x.get("explanation", "")))
        # The intro and the gallery blurb are read before any question, so
        # they leak into EVERY question of their own quiz as well as others.
        # Keyed with 0 so the report can name them.
        hay[(qid, 0)] = significant(
            (q.get("intro", "") + " " + blurbs.get(qid, "")))

    findings = []
    for qid, q in quizzes.items():
        if only and qid not in only:
            continue
        for i, x in enumerate(q.get("questions", []), 1):
            opts, a = x.get("options", []), x.get("answer")
            if not isinstance(a, int) or not (0 <= a < len(opts)):
                continue
            sig = significant(opts[a])
            if len(sig) < MIN_SIG:
                continue
            for (oid, oi), words in hay.items():
                # A quiz may repeat itself between questions — that is the
                # author's business. But its own intro and blurb sit ABOVE the
                # questions and on the card the visitor clicked, so a quiz
                # giving away its own answer there is a real leak and the one
                # nobody thinks to look for.
                if oid == qid and oi != 0:
                    continue
                if oid == qid and i == 0:
                    continue
                if sig <= words:
                    findings.append((qid, i, opts[a], oid, oi, len(sig)))
    # Strongest signal first: the more distinctive words matched, the likelier
    # this is a real leak rather than two questions about the same afternoon.
    findings.sort(key=lambda f: -f[5])
    return findings


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    only = {os.path.basename(a).replace(".json", "") for a in args} or None
    floor = MIN_SIG if "--all" in sys.argv else REPORT

    findings = [f for f in scan(only) if f[5] >= floor]
    if not findings:
        print("No quiz states another quiz's scored answer.")
        sys.exit(0)

    print("%d possible answer leak(s). Each is a question whose scored answer\n"
          "is spelled out in another quiz's prompt or explanation.\n" % len(findings))
    for qid, i, ans, oid, oi, n in findings:
        where = ("%s's own intro/blurb" % oid) if oi == 0 else "%s q%d" % (oid, oi)
        print("  %s q%d  — answer %r" % (qid, i, ans[:64]))
        print("      is given away by %s  (%d distinctive words shared)\n"
              % (where, n))
    print("Read them before deciding. Two questions about the same event will\n"
          "share vocabulary honestly; what matters is whether a player who\n"
          "reads one can score the other without knowing anything.")
    if floor > MIN_SIG:
        print("\n(--all also shows weaker %d-word matches, which are mostly\n"
              "recurring names and offices and rarely worth acting on.)" % MIN_SIG)
    sys.exit(1)
