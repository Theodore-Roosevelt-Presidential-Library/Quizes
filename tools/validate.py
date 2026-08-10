#!/usr/bin/env python3
"""
Schema and standards check for quiz files.

Catches the mechanical mistakes — a missing image, a bad answer index, a credit
pointing at the DAM instead of the collection that actually holds the photograph.
Cheap to run, so run it after every edit.

    python3 tools/validate.py                  # everything in quizzes/
    python3 tools/validate.py quizzes/myths.json
"""
import json, os, sys, glob

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_Q, MAX_Q = 8, 15

# The DAM is our access system, not a source. Credits name the institution that
# holds the original — a caption reading "TRPL Digital Asset Library" tells a
# researcher nothing and takes credit that belongs elsewhere.
COLLECTIONS = ("Houghton", "Library of Congress", "New York Public",
               "Smithsonian", "National Archives", "Theodore Roosevelt Center")
BANNED_CREDIT = ("Digital Asset", "DAM", "Widen")

REQUIRED_Q = ("prompt", "options", "answer", "explanation",
              "image", "imageAlt", "credit", "link")
REQUIRED_TOP = ("id", "title", "intro", "heroImage", "learnMore",
                "badge", "tiers", "questions")


def check(path):
    problems = []
    try:
        q = json.load(open(path))
    except Exception as e:
        return ["will not parse as JSON: %s" % e]

    for k in REQUIRED_TOP:
        if k not in q:
            problems.append("missing top-level '%s'" % k)

    if q.get("id") != os.path.basename(path)[:-5]:
        problems.append("id '%s' does not match the filename" % q.get("id"))

    hero = q.get("heroImage", "")
    if hero and not os.path.exists(os.path.join(BASE, hero)):
        problems.append("heroImage missing on disk: %s" % hero)

    qs = q.get("questions", [])
    n = len(qs)
    if n < MIN_Q:
        problems.append("%d questions — fewer than %d is too thin to be worth "
                        "someone's time" % (n, MIN_Q))
    elif n > MAX_Q:
        problems.append("%d questions — more than %d and people abandon" % (n, MAX_Q))

    tiers = q.get("tiers", [])
    if tiers and max(t["min"] for t in tiers) > n:
        problems.append("top tier needs %d but the quiz only has %d questions — "
                        "unreachable" % (max(t["min"] for t in tiers), n))
    if tiers and min(t["min"] for t in tiers) != 0:
        problems.append("no tier at 0 — someone scoring nothing gets no result")

    seen_prompts = set()
    for i, x in enumerate(qs, 1):
        for k in REQUIRED_Q:
            if k not in x:
                problems.append("q%d missing '%s'" % (i, k))
        opts = x.get("options", [])
        if len(opts) != 4:
            problems.append("q%d has %d options, needs 4" % (i, len(opts)))
        if len(set(opts)) != len(opts):
            problems.append("q%d has duplicate options" % i)
        a = x.get("answer")
        if not isinstance(a, int) or not (0 <= a < len(opts)):
            problems.append("q%d answer index %r is out of range" % (i, a))
        img = x.get("image", "")
        if img and not os.path.exists(os.path.join(BASE, img)):
            problems.append("q%d image missing on disk: %s" % (i, img))
        cred = x.get("credit", "")
        if any(b.lower() in cred.lower() for b in BANNED_CREDIT):
            problems.append("q%d credits the DAM rather than the holding "
                            "institution" % i)
        elif cred and not any(c in cred for c in COLLECTIONS):
            problems.append("q%d credit names no holding collection: %s"
                            % (i, cred[:60]))
        p = x.get("prompt", "")
        if p in seen_prompts:
            problems.append("q%d duplicates an earlier prompt" % i)
        seen_prompts.add(p)
        if not x.get("imageAlt"):
            problems.append("q%d has no alt text" % i)

    return problems


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    files = []
    for a in (args or [os.path.join(BASE, "quizzes", "*.json")]):
        files.extend(sorted(glob.glob(a)))
    files = [f for f in files if not f.endswith("index.json")]

    bad = 0
    for f in files:
        problems = check(f)
        print("%-30s %s" % (os.path.basename(f),
                            "OK" if not problems else "%d problem(s)" % len(problems)))
        for p in problems:
            print("   ! " + p)
        bad += bool(problems)
    print("\n%d of %d file(s) need attention." % (bad, len(files)))
    sys.exit(1 if bad else 0)
