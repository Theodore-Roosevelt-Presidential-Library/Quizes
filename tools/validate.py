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

# The longest-option tell.
#
# Writing a quiz pulls you one way: the true answer is the one you know the most
# about, so it collects the qualifiers, and the distractors — which you are
# inventing, and have nothing to say about — come out short. Do that fifteen
# times and the quiz can be beaten without reading the questions. A repo-wide
# audit found 56% of questions had the longest option correct against 25% by
# chance, so this is not a hypothetical.
#
# GAP is per-question and catches the blatant ones. SHARE is per-file: a couple
# of long correct answers is chance, most of them is a pattern. The ceiling is
# deliberately loose — forcing it to 25% would mean padding distractors, and
# "never the longest" is just as beatable as "always the longest".
MAX_GAP = 18            # chars the correct option may exceed the next-longest by
MAX_LONGEST_SHARE = 0.45


def length_tell(qs):
    """Report questions where option length gives the answer away."""
    out, longest = [], 0
    for i, x in enumerate(qs, 1):
        opts, a = x.get("options", []), x.get("answer")
        if len(opts) < 2 or not isinstance(a, int) or not (0 <= a < len(opts)):
            continue
        lens = [len(o) for o in opts]
        others = max(l for j, l in enumerate(lens) if j != a)
        if lens[a] == max(lens):
            longest += 1
        gap = lens[a] - others
        if gap > MAX_GAP:
            out.append("q%d correct option is %d chars longer than any other — "
                       "readable without knowing the answer" % (i, gap))
    n = len(qs)
    if n and longest / n > MAX_LONGEST_SHARE:
        out.append("the correct option is the longest in %d of %d questions "
                   "(%.0f%%) — chance is 25%%, so this quiz can be played on "
                   "option length alone" % (longest, n, 100 * longest / n))
    return out


def answer_spread(qs):
    """Report a file whose answer index never moves."""
    idx = [x.get("answer") for x in qs
           if isinstance(x.get("answer"), int)]
    if len(idx) >= 8 and len(set(idx)) == 1:
        return ["every answer index is %d — options are shuffled at runtime so "
                "this is invisible in play, but it means the file has never "
                "been read in the order it is written" % idx[0]]
    return []


# A stereograph card is two nearly identical frames printed side by side on a
# publisher's mount. Cropped to one frame it is a good photograph; uncropped it
# is a picture of a piece of card with the same view on it twice, usually with
# the publisher's name down the edges and a copyright line along the bottom.
#
# Two separate audits caught these AFTER they had shipped, and the second only
# because a human opened the files. Nothing in the pipeline looked, because the
# credit line said "one frame of a stereograph card, publisher's mount removed"
# — a caption asserting the crop had happened when it had not.
#
# The shape gives it away without opening anything. Every correctly cropped
# frame in this repo sits near 0.92:1. A whole card is about 1.9:1. Nothing we
# legitimately use is that wide, so the ratio alone is a reliable tell.
STEREO_LO, STEREO_HI = 1.80, 2.10


def uncropped_stereographs(quiz):
    """Flag images shaped like a whole stereograph card."""
    try:
        from PIL import Image
    except ImportError:
        return []
    out, seen = [], set()
    paths = [quiz.get("heroImage", "")]
    paths += [x.get("image", "") for x in quiz.get("questions", [])]
    for rel in paths:
        if not rel or rel in seen:
            continue
        seen.add(rel)
        full = os.path.join(BASE, rel)
        if not os.path.exists(full):
            continue
        try:
            with Image.open(full) as im:
                w, h = im.size
        except Exception:
            continue
        if h and STEREO_LO <= w / h <= STEREO_HI:
            out.append("%s is %dx%d (%.2f:1) — that is the shape of a WHOLE "
                       "stereograph card, i.e. the same frame twice on the "
                       "publisher's mount. Open it. If it is a stereo card, "
                       "crop to the left frame and cut the mount and caption "
                       "strip off." % (rel, w, h, w / h))
    return out


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

    problems.extend(length_tell(qs))
    problems.extend(answer_spread(qs))
    problems.extend(uncropped_stereographs(q))

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
