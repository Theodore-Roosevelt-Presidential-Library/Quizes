#!/usr/bin/env python3
"""
Verification pass for a quiz file.

This exists because of what the Badlands audit found. That quiz was written before
the corpus was open, and it shipped with four quotations that could not be sourced —
including one attributed to Roosevelt that is not in his Autobiography at all. Every
quiz written afterwards, with the corpus open, passed clean. The difference was not
care; it was whether the checking happened during the writing or after it.

So: run this before a quiz goes live, not after.

    python3 tools/verify.py quizzes/badlands.json
    python3 tools/verify.py quizzes/*.json --quiet

What it does
    Pulls every quoted passage and every hard figure out of the explanations and
    greps the TRPL full-text corpus for each one. Anything it cannot find is
    reported for a human to resolve.

What it cannot do
    It cannot tell you a claim is true — only whether these words appear somewhere
    in 359 books. A hit is a lead, not a verdict, and biographers quote each other.
    For anything load-bearing, read the passage.
"""
import json, re, os, sys, glob, subprocess

CORPUS = os.environ.get("TRPL_CORPUS",
                        "/sessions/optimistic-inspiring-mayer/mnt/TRPL/Book_Text")

# Quotations we already know cannot be sourced. Listing them here means a future
# writer who reaches for the same famous line gets stopped rather than repeating
# the research. See FACT-CHECK.md for how each one was run down.
KNOWN_BAD = {
    "banana": "The 'carve a judge out of a banana' line is not Roosevelt's. "
              "Earliest print appearance is a 1932 Holmes biography, in indirect "
              "speech, citing no manuscript.",
    "entire regiment of cowboys": "Not his words — a Bismarck newspaper speculating "
              "about what he might do. He wrote 'some companies of horse riflemen'.",
    "never would have been President": "Real in substance but NOT in the "
              "Autobiography, and secondary sources give at least two wordings. "
              "Report it as recollection; do not present it as a verbatim quote.",
}

# Figures worth a second look wherever they appear.
NUMBER_RE = re.compile(r"\b\d[\d,]{2,}\b|\$[\d,]+|\b(?:eighteen|fifty-one|"
                       r"sixteen|twenty-five|one hundred fifty)\b", re.I)
# Match balanced pairs only. Treating every quote character as interchangeable
# makes the regex pair a CLOSING quote with the next OPENING one and "find" a
# quotation that is really just the prose between two of them.
QUOTE_RES = [re.compile(r"\u201c([^\u201c\u201d]{12,240})\u201d")]   # curly pairs


def quotations(text):
    """Curly quotes are directional so a regex can pair them. Straight quotes are
    not, so pair them positionally instead - 1st with 2nd, 3rd with 4th. Matching
    straight quotes by regex grabs the prose BETWEEN two quotations, e.g. the text
    sitting between "Thee," and "Ted." in a sentence that quotes both."""
    out = QUOTE_RES[0].findall(text)
    pos = [i for i, ch in enumerate(text) if ch == chr(34)]
    for a, b in zip(pos[0::2], pos[1::2]):
        inner = text[a + 1:b]
        if 12 <= len(inner) <= 240:
            out.append(inner)
    return out


def corpus_hits(needle, limit=3):
    """Grep the corpus. Returns the titles that contain the string."""
    if not os.path.isdir(CORPUS):
        return None
    try:
        r = subprocess.run(["grep", "-rl", "-F", needle, CORPUS],
                           capture_output=True, text=True, timeout=120)
        files = [os.path.basename(f) for f in r.stdout.strip().split("\n") if f]
        return files[:limit]
    except Exception:
        return []


def check(path, quiet=False):
    q = json.load(open(path))
    name = os.path.basename(path)
    problems, notes, reviews = [], [], []

    n = len(q.get("questions", []))
    if n < 8:
        problems.append("only %d questions — the floor is 8" % n)
    if n > 15:
        problems.append("%d questions — 15 is the ceiling" % n)

    for i, x in enumerate(q.get("questions", []), 1):
        # Scan prompt and explanation separately. Concatenating them can leave an
        # odd number of straight quote characters across the join, which makes the
        # pair-matcher grab the prose between two unrelated quotations.
        fields = [x.get("explanation", ""), x.get("prompt", "")]
        text = " ".join(fields)

        for phrase, why in KNOWN_BAD.items():
            if phrase.lower() in text.lower():
                # A quiz may legitimately discuss these in order to debunk them,
                # which is exactly what the Myths quiz does. So this is a prompt to
                # look, not a verdict.
                reviews.append("q%d mentions a known-bad attribution (%s). "
                               "Confirm it is being corrected, not repeated. %s"
                               % (i, phrase, why))

        found = []
        for f in fields:
            found.extend(quotations(f))
        for m in found:
            if len(m.split()) < 3:
                continue
            # Trailing punctuation usually sits inside our quotation marks but not
            # inside the source's, so a literal grep for it fails on a quote that is
            # in fact present. Try the trimmed form before calling it missing.
            trimmed = m.strip(" ,.;:!?\u2014-")
            # Sources vary in how they mark nested quotation — we may write
            # 'maltese' where the book prints "maltese" — so a literal grep on the
            # whole passage fails on a quote that is genuinely there. Fall back to
            # the longest run of plain words, which is still a strong signal.
            fragment = max(re.split(r"[\"'\u2018\u2019\u201c\u201d]", trimmed),
                           key=len).strip() if any(c in trimmed for c in "\"'\u2018\u2019") else ""
            candidates = [m, trimmed] + ([fragment] if len(fragment.split()) >= 4 else [])
            hits = None
            for c in dict.fromkeys(candidates):
                hits = corpus_hits(c)
                if hits is None:
                    break
                if hits:
                    break
            if hits is None:
                notes.append("corpus not reachable — quotations unchecked")
                break
            if not hits:
                problems.append('q%d QUOTATION NOT FOUND: "%s"' % (i, m[:90]))
            elif not quiet:
                notes.append('q%d ok: "%s" (%s)' % (i, m[:52], hits[0][:34]))

        # cross-references break under shuffling, which is on by default
        # Bare "above" is almost always the preposition - a room above a store, an
        # officer above another. Only flag phrasings that genuinely point at
        # another question.
        if re.search(r"(as we saw|as (?:noted|mentioned|seen) (?:above|earlier)|"
                     r"(?:previous|earlier|last|next) question|see above|"
                     r"the question above)", text, re.I):
            problems.append("q%d refers to another question — questions shuffle, "
                            "so each must stand alone" % i)

    return name, problems, notes, reviews


def main(paths, quiet=False):
    total = 0
    for p in paths:
        name, problems, notes, reviews = check(p, quiet)
        status = "CLEAN" if not problems else "%d TO RESOLVE" % len(problems)
        print("\n%-30s %s" % (name, status))
        for pr in problems:
            print("   ! " + pr)
        for rv in reviews:
            print("   ? " + rv)
        if not quiet:
            for nt in notes[:6]:
                print("     " + nt)
        total += len(problems)
    print("\n%d item(s) needing a human across %d file(s)." % (total, len(paths)))
    return 1 if total else 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    quiet = "--quiet" in sys.argv
    files = []
    for a in args:
        files.extend(sorted(glob.glob(a)))
    files = [f for f in files if not f.endswith("index.json")]
    if not files:
        print(__doc__)
        sys.exit(0)
    sys.exit(main(files, quiet))
