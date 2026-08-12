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
    "never would have been President": "Verdict unchanged, but the hunt is now "
              "finished: NOT in the Autobiography, and NOT in Hagedorn's "
              "'Roosevelt in the Bad Lands' (1921), which entered the corpus in "
              "2026 and was the last plausible eyewitness source. It survives only "
              "in secondary works, in at least two wordings ('here in North "
              "Dakota' and without), and Dalton traces it no further back than "
              "Elwyn Robinson's 'History of North Dakota' (1966); Collins hedges "
              "it as something Roosevelt 'speculated'. Report it as recollection; "
              "do not present it as a verbatim quote. If you need a sourceable "
              "line to the same effect, use Roosevelt at Sioux Falls, September 3, "
              "1910: his Dakota years were 'the most important educational asset "
              "of all my life.'",
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


# Two files in the corpus are the SAME BOOK under different names, and one of
# them is misattributed outright. Left alone, this tool reports a quotation
# found in both as two independent hits, and a writer counting sources sees
# corroboration that is not there. That happened: a whole batch of Badlands
# questions was built believing Hagedorn had been confirmed by a 2011 author.
#
# `Roger L. Di Silvestro - Theodore Roosevelt in the Badlands (2011).md` is a
# clean transcription of Hermann Hagedorn, "Roosevelt in the Bad Lands" (1921)
# — same Roosevelt Memorial Association title page, same transcriber's note,
# and the string "Di Silvestro" appears in it exactly zero times. The file
# named for Hagedorn is a poorer OCR of the identical text.
#
# Rather than rename files in a corpus this tool only reads, collapse them here
# and say so in the output. The clean transcription is worth keeping — it
# carries the investment appendix the OCR lost, and it greps without the
# line-break hyphenation that breaks long quotations in the scan.
CORPUS_ALIASES = {
    "Roger L. Di Silvestro - Theodore Roosevelt in the Badlands (2011).md":
        "Hagedorn, Roosevelt in the Bad Lands (1921) [MISFILED as Di Silvestro]",
    "Hermann Hagedorn - Roosevelt in the Bad Lands (1921).md":
        "Hagedorn, Roosevelt in the Bad Lands (1921)",
}
# Anything mapping to the same value is one book, however many files it is in.
_ALIAS_KEY = {k: v.split(" [")[0] for k, v in CORPUS_ALIASES.items()}


# ---------------------------------------------------------------------------
# The corpus contains NOVELS. Their invented dialogue greps exactly like a real
# quotation, so a writer searching for a line and finding it "in the corpus"
# can be looking at something an author made up in 2019. Nobody catches that by
# eye at thirty-five quizzes, let alone a hundred.
#
# The sharpest example is Helen Topping Miller's "Christmas at Sagamore Hill"
# (1960), whose own jacket calls it a series of "fictional Christmas vignettes."
# It is the single most greppable book in the corpus for holiday material — the
# exact subject we keep writing quizzes about — and it reads as a warm domestic
# account of a real family at a real house in a real year (1898). Nothing about
# the prose announces itself as invented.
#
# So: a quotation found ONLY in these is not verified, it is a red flag. Every
# title below was confirmed by opening the file, not by guessing from the name.
FICTION = {
    "Helen Topping Miller - Christmas at Sagamore Hill (1960).md":
        "fiction — jacket copy calls it 'fictional Christmas vignettes'",
    "Jeff Shaara - The Old Lion (2023).md":
        "fiction — the author's note says 'This is a novel'",
    "Jerome Charyn - The Perilous Adventures of the Cowboy King (2019).md":
        "fiction — title page reads 'A NOVEL'",
    "Gilbert Morris - The Rough Rider (2012).md":
        "fiction — Bethany House historical novel",
    "Burt Solomon - The Attempted Murder of Teddy Roosevelt (2019).md":
        "fiction — Tor/Forge mystery novel",
    "Dorothy Clarke Wilson - Alice and Edith - the two wives of Teddy "
    "Roosevelt - a biographical novel (2011).md":
        "fiction — 'a biographical novel', and it says so in the title",
    "Stephanie Marie Thornton - American Princess (2019).md":
        "fiction — novel about Alice Roosevelt Longworth",
    "Mary Calvi - If a Poem Could Live and Breathe (2023).md":
        "fiction — 'A Novel of Teddy Roosevelt's First Love'",
    "James Ross - Hunting Teddy Roosevelt (2019).md":
        "fiction — Regal House novel",
    "Mark Paul Jacobs - How Teddy Roosevelt Slew the Last Mighty T-Rex "
    "(2013).md":
        "fiction — the copyright page says 'is a work of fiction'",
}

# Not fiction, but not citable either: illustrated children's books that
# compress and dramatise. Fine to read, wrong to source a claim to.
NOT_CITABLE = {
    "Leslie Kimmelman - Mind your manners, Alice Roosevelt! (2020).md":
        "children's picture book — dramatised, not a source",
    "Don Brown - Teedie - the story of young Teddy Roosevelt (2019).md":
        "children's picture book — dramatised, not a source",
}

SUSPECT = dict(FICTION, **NOT_CITABLE)


def corpus_hits(needle, limit=3):
    """Grep the corpus. Returns (real_hits, suspect_hits).

    Duplicate editions of the same book are collapsed to one entry, so the
    count of hits is a count of BOOKS rather than a count of files. Novels and
    picture books are separated out rather than dropped — a writer needs to
    SEE that the only place a line appears is a novel, because that is the
    finding, not a null result.
    """
    if not os.path.isdir(CORPUS):
        return None, []
    try:
        r = subprocess.run(["grep", "-rl", "-F", needle, CORPUS],
                           capture_output=True, text=True, timeout=120)
        files = [os.path.basename(f) for f in r.stdout.strip().split("\n") if f]
        seen, real, bad = set(), [], []
        for f in files:
            key = _ALIAS_KEY.get(f, f)
            if key in seen:
                continue
            seen.add(key)
            if f in SUSPECT:
                bad.append("%s [%s]" % (f.rsplit(" (", 1)[0], SUSPECT[f]))
            else:
                real.append(CORPUS_ALIASES.get(f, f))
        return real[:limit], bad[:limit]
    except Exception:
        return [], []


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
        # Scan each field separately. Concatenating them can leave an odd number
        # of straight quote characters across the join, which makes the
        # pair-matcher grab the prose between two unrelated quotations.
        #
        # OPTIONS ARE SCANNED TOO, and that is not an afterthought. For the
        # first thirty-five quizzes this tool read only the prompt and the
        # explanation, so a quotation sitting in a wrong-answer slot was never
        # checked by anything. An audit then found six fabricated sentences
        # inside quotation marks in the options of a quiz about two deaths —
        # invented words in a dead man's mouth, on the one subject where that
        # is least forgivable — and this tool had reported the file CLEAN.
        #
        # A distractor in quotation marks is a quotation. Screenshot it, or let
        # a search engine index it, and nothing distinguishes it from a real
        # one. So they get the same treatment as any other quoted passage: find
        # it in a real book or do not print it inside quotation marks.
        fields = [x.get("explanation", ""), x.get("prompt", "")]
        fields += [o for o in x.get("options", []) if isinstance(o, str)]
        text = " ".join(fields)

        for phrase, why in KNOWN_BAD.items():
            if phrase.lower() in text.lower():
                # A quiz may legitimately discuss these in order to debunk them,
                # which is exactly what the Myths quiz does. So this is a prompt to
                # look, not a verdict.
                reviews.append("q%d mentions a known-bad attribution (%s). "
                               "Confirm it is being corrected, not repeated. %s"
                               % (i, phrase, why))

        # Keep track of WHERE each quotation came from. A missing quotation in
        # an explanation is usually a sourcing slip; a missing quotation in a
        # wrong-answer option is usually something somebody made up, and the
        # writer needs to be told which of those they are looking at.
        n_body = 2
        found = []
        for k, f in enumerate(fields):
            for m in quotations(f):
                found.append((m, "option" if k >= n_body else "text"))
        for m, where in found:
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
            hits, fake = None, []
            for c in dict.fromkeys(candidates):
                hits, bad = corpus_hits(c)
                if hits is None:
                    break
                fake = fake or bad
                if hits:
                    break
            if hits is None:
                notes.append("corpus not reachable — quotations unchecked")
                break
            if not hits and fake:
                # The worst case, and the reason this check exists: the line is
                # in the corpus, so a plain grep "finds" it, but the only book
                # it is in is one somebody invented.
                problems.append('q%d QUOTATION APPEARS ONLY IN FICTION: "%s" '
                                '— found in %s. This is not a source. Do not '
                                'use the line unless a real one carries it.'
                                % (i, m[:70], "; ".join(fake)))
            elif not hits and where == "option":
                problems.append('q%d FABRICATED QUOTATION IN AN ANSWER OPTION: '
                                '"%s" — not in any book. A wrong answer in '
                                'quotation marks is still a quotation: '
                                'screenshotted, nothing marks it as invented. '
                                'Source it or drop the quotation marks.'
                                % (i, m[:70]))
            elif not hits:
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
