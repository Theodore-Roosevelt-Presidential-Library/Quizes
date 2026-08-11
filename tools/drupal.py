#!/usr/bin/env python3
"""
Generate the Drupal build packet: one row per Quiz node, plus the redirect map.

    python3 tools/drupal.py

Writes build/drupal-nodes.csv and build/drupal-redirects.csv.

These are the exact values to type (or import) into Drupal — title, URL alias,
body embed code, meta description, social image. Generated rather than
hand-typed because 29 nodes is enough that a transcription error is close to
certain, and a wrong `data-trpl-quiz` value renders a silent empty div.
"""
import csv, json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "build")
ASSETS = "https://quiz.labs.trlibrary.com"
SITE = "https://www.trlibrary.com"

EMBED = ('<div data-trpl-quiz="{id}"></div>\n'
         '<script src="' + ASSETS + '/assets/js/embed.js" async></script>')

# Old path -> new path. Everything without a successor goes to the listing.
REDIRECTS = [
    ("/quiz/tr-and-animals-quiz",        "/quiz/pets",              "Same subject"),
    ("/quiz/white-house-pets-quiz",      "/quiz/pets",              "Same subject"),
    ("/quiz/early-life-quiz",            "/quiz/early-life",        "Same subject"),
    ("/quiz/conservation-quiz",          "/quiz/conservation",      "Same subject"),
    ("/quiz/outdoors-quiz",              "/quiz/conservation",      "Nearest"),
    ("/quiz/rough-rider-quiz",           "/quiz/rough-riders",      "Same subject"),
    ("/quiz/veterans-quiz",              "/quiz/roosevelts-at-war", "Nearest"),
    ("/quiz/presidential-quiz",          "/quiz/presidency",        "Same subject"),
    ("/quiz/progressive-reforms-quiz",   "/quiz/presidency",        "The Square Deal"),
    ("/quiz/diplomacy-quiz",             "/quiz/nobel-peace-prize", "Portsmouth"),
    ("/quiz/trs-adventures-quiz",        "/quiz/river-of-doubt",    "Nearest"),
    ("/quiz/trs-travels-quiz",           "/quiz/post-presidency",   "Africa and the Amazon"),
    ("/quiz/political-impact-quiz",      "/quiz/legacy",            "Nearest"),
    ("/quiz/campaigns-and-elections-quiz", "/quiz/rise-to-power",   "Nearest"),
    ("/quiz/women-in-trs-life-quiz",     "/quiz/people",            "Edith, Alice, Bamie"),
    ("/quiz/adversity-quiz",             "/quiz/health",            "Asthma, the bullet, the fevers"),
    ("/quiz/quotes-quiz",                "/quiz",                   "Deliberately not rebuilt"),
    ("/quiz/leadership-quiz",            "/quiz",                   "No successor"),
]


def meta_description(entry):
    """<=160 chars, no mid-word truncation, no dangling punctuation."""
    text = entry.get("blurb", "").strip()
    if len(text) <= 160:
        return text
    cut = text[:160]
    # Prefer a sentence boundary, fall back to a word boundary.
    for stop in (". ", "? ", "! "):
        i = cut.rfind(stop)
        if i > 90:
            return cut[:i + 1].strip()
    i = cut.rfind(" ")
    return cut[:i].rstrip(" ,;:—-") + "…"


def main():
    os.makedirs(OUT, exist_ok=True)
    idx = json.load(open(os.path.join(BASE, "quizzes", "index.json"),
                         encoding="utf-8"))

    nodes = os.path.join(OUT, "drupal-nodes.csv")
    with open(nodes, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["title", "url_alias", "body_full_html", "meta_description",
                    "social_image_url", "social_image_alt", "difficulty",
                    "topics", "questions", "status"])
        for q in idx["quizzes"]:
            w.writerow([
                q["title"],
                "/quiz/" + q["id"],
                EMBED.format(id=q["id"]),
                meta_description(q),
                ASSETS + "/" + q["image"].lstrip("/"),
                q.get("imageAlt", ""),
                q.get("difficulty", ""),
                "; ".join(q.get("topics", [])),
                q.get("questions", ""),
                "Draft",
            ])

    reds = os.path.join(OUT, "drupal-redirects.csv")
    with open(reds, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["from_path", "to_path", "status_code", "note"])
        for old, new, why in REDIRECTS:
            w.writerow([old, new, 301, why])

    # A redirect pointing at a node that does not exist is worse than no
    # redirect, so check before anyone imports this.
    have = {"/quiz/" + q["id"] for q in idx["quizzes"]} | {"/quiz"}
    bad = [(o, n) for o, n, _ in REDIRECTS if n not in have]
    for o, n in bad:
        print("! %s redirects to %s, which is not a quiz" % (o, n))

    # And an old path must never equal a new one, or the redirect loops.
    loops = [o for o, _, _ in REDIRECTS if o in have]
    for o in loops:
        print("! %s is both an old path and a new path — would loop" % o)

    print("wrote %s (%d nodes)" % (nodes, len(idx["quizzes"])))
    print("wrote %s (%d redirects)" % (reds, len(REDIRECTS)))
    return 1 if (bad or loops) else 0


if __name__ == "__main__":
    raise SystemExit(main())
