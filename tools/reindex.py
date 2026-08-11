#!/usr/bin/env python3
"""
Rebuild the search keywords in quizzes/index.json.

The gallery widget searches title + blurb + facets, which is fine for "pets"
and useless for "Rondon", "Gorgas", "Sagamore" or "1912" — the names people
actually type. Those live inside the questions, and the widget cannot load 29
quiz files to find them.

So this bakes them in: it reads every quiz, pulls the distinctive proper nouns
and years out of the questions, and writes them to a `keywords` array on each
index entry. Run it after adding or editing a quiz:

    python3 tools/reindex.py            # rewrite
    python3 tools/reindex.py --check    # exit 1 if stale, for CI

The hard part is sentence-initial capitals. "Roosevelt was born" and "Born in
New York" both start with a capital, but only one of them is a name. The rule
below keeps a capitalised token only if it EVER appears mid-sentence, which
sorts real names from accidents of punctuation without a dictionary.
"""
import json, os, re, sys, glob

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_KEYWORDS = 50
YEAR_SLOTS = 8          # reserved, or names crowd every year out of the list

# Capitalised words that are almost never what someone is searching for.
STOP = set("""
A An The And But Or Nor For So Yet If When While After Before Because
He She It They We You I His Her Its Their Our Your My Him Them Us
That This These Those There Here What Which Who Whom Whose Where Why How
In On At By To From With Without Within Into Onto Of Off Up Down Over Under
Not No Yes Both Each Every All Some Any None One Two Three Four Five Six
Seven Eight Nine Ten Eleven Twelve Fifteen Twenty Thirty Forty Fifty Sixty
Hundred Thousand Million Billion First Second Third Last Next Only Just
Was Were Is Are Be Been Being Had Has Have Did Does Do Will Would Shall
Should Can Could May Might Must Said Says Told Wrote Called Named Asked
Then Than Now Later Once Again Still Even Also Almost Nearly More Most Less
Nobody Nothing Neither Either Whether Although Though However Instead
Mr Mrs Dr Sir Lady Note Yes True False Perfect Very Good Well Take Give
""".split())

WORD = re.compile(r"\b[A-Z][A-Za-z'’À-ɏ.-]{2,}\b")
YEAR = re.compile(r"(?<!\d)(1[6-9]\d\d|20\d\d)(?!\d)")
# A capital that opens a sentence, a quotation, or a list item.
SENTENCE_START = re.compile(r"(?:^|[.!?—:;]\s+|[\"“‘(]\s*)$")


def harvest(quiz):
    """Distinctive terms a visitor might plausibly type."""
    blobs = []
    for k in ("title", "subtitle", "intro"):
        if quiz.get(k):
            blobs.append(quiz[k])
    for q in quiz.get("questions", []):
        blobs.append(q.get("prompt", ""))
        blobs.append(q.get("explanation", ""))
        blobs.extend(q.get("options", []))

    seen, midsentence = {}, set()
    for text in blobs:
        for m in WORD.finditer(text):
            w = m.group(0).strip(".")
            if w in STOP or len(w) < 3:
                continue
            seen[w] = seen.get(w, 0) + 1
            if not SENTENCE_START.search(text[:m.start()]):
                midsentence.add(w)

    # A real name shows up mid-sentence at least once. Anything that only ever
    # appears at the start of a sentence is almost certainly a common word that
    # got capitalised by punctuation.
    words = [w for w, n in seen.items() if w in midsentence]
    words.sort(key=lambda w: (-seen[w], w))

    # Years get their own reserved slots. Sorting names by frequency and then
    # appending years put every year past the cap, so "1912" — one of the most
    # likely things anyone types — matched nothing at all.
    counted = {}
    for text in blobs:
        for m in YEAR.finditer(text):
            counted[m.group(0)] = counted.get(m.group(0), 0) + 1
    years = sorted(counted, key=lambda y: (-counted[y], y))[:YEAR_SLOTS]

    out, lowered = [], set()
    for w in years + words:
        key = w.lower()
        if key in lowered:
            continue
        lowered.add(key)
        out.append(w)
        if len(out) >= MAX_KEYWORDS:
            break
    return out


def build():
    idx_path = os.path.join(BASE, "quizzes", "index.json")
    idx = json.load(open(idx_path, encoding="utf-8"))
    missing = []
    for entry in idx["quizzes"]:
        path = os.path.join(BASE, "quizzes", entry["id"] + ".json")
        if not os.path.exists(path):
            missing.append(entry["id"])
            continue
        entry["keywords"] = harvest(json.load(open(path, encoding="utf-8")))
    return idx_path, idx, missing


if __name__ == "__main__":
    path, idx, missing = build()
    for m in missing:
        print("! no quiz file for index entry '%s'" % m)

    text = json.dumps(idx, indent=2, ensure_ascii=False) + "\n"

    if "--check" in sys.argv:
        current = open(path, encoding="utf-8").read()
        if current != text:
            print("index.json keywords are stale — run: python3 tools/reindex.py")
            sys.exit(1)
        print("index.json keywords are current.")
        sys.exit(0)

    open(path, "w", encoding="utf-8").write(text)
    n = sum(len(q.get("keywords", [])) for q in idx["quizzes"])
    print("wrote %d keywords across %d quizzes" % (n, len(idx["quizzes"])))
    for q in idx["quizzes"][:3]:
        print("  %-20s %s" % (q["id"], ", ".join(q.get("keywords", [])[:12])))
    sys.exit(1 if missing else 0)
