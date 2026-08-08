# TRPL Quizzes

A reusable, JSON-driven quiz platform for the Theodore Roosevelt Presidential Library.
Static HTML/CSS/JS — no build step, no dependencies. Push to `main` and GitHub Pages serves it.

**Live at:** https://quiz.labs.trlibrary.com

---

## How it works

```
index.html              Landing page — reads quizzes/index.json, renders a card per quiz
quiz.html?q=<id>        The engine — reads quizzes/<id>.json and runs it
assets/css/trpl.css     Brand stylesheet (colors, type, section themes)
assets/js/quiz.js       Engine: question flow, feedback, scoring, results
assets/js/badge.js      Canvas badge generator (1200×1200 PNG)
assets/img/<quiz>/      Imagery for that quiz + credits.json (DAM ids and rights)
quizzes/index.json      The list that populates the landing page
quizzes/<id>.json       One file per quiz — this is the only file you edit to add content
```

A visitor answers a question, immediately sees right/wrong plus the correct answer,
a short piece of history, and a link out to trlibrary.com in a new tab. At the end
they get a score, an achievement tier, a downloadable badge, and share buttons.

---

## Adding a new quiz

1. Copy `quizzes/badlands.json` to `quizzes/<your-id>.json`.
2. Replace the content. Every quiz needs **15 questions with exactly 4 options each**.
3. Drop imagery in `assets/img/<your-id>/`.
4. Add an entry to `quizzes/index.json`.

That's it — no code changes.

### Question schema

```json
{
  "prompt": "The question.",
  "options": ["A", "B", "C", "D"],
  "answer": 0,
  "explanation": "Two to four sentences of history. This is the payoff — make it worth reading.",
  "image": "assets/img/badlands/example.jpg",
  "imageAlt": "Plain-language description for screen readers.",
  "credit": "Caption and source line shown under the image.",
  "link": { "url": "https://www.trlibrary.com/tr/badlands", "label": "T.R. in the Badlands" }
}
```

`answer` is the **zero-based index** into `options` — `0` is the first option.
All `link` URLs open in a new tab with `rel="noopener noreferrer"`.

### Quiz-level fields

`title`, `subtitle`, `intro`, `heroImage`, `heroAlt`, `learnMore`, `badge`, `tiers`.

`tiers` is a descending ladder of achievement bands. Each is `{ min, name, line }`;
the engine picks the highest tier whose `min` the score meets. `badge.shareText`
supports the tokens `{score}`, `{total}`, and `{tier}`.

---

## Editorial standards this repo follows

- **T.R.'s words are verbatim or not at all.** Never paraphrase inside quotation marks.
  Keep period spelling as printed.
- **Two independent sources** for every dated factual claim — one book in the TRPL corpus
  and one external authority (LOC, NPS, Theodore Roosevelt Center, Dakota Datebook).
- **"Buttes," never "mesa."** Present tense — the Library is open.
- Where a famous image is a re-creation rather than documentary, say so in the `credit`.
  The staged boat-thieves photograph in the Badlands quiz is labeled as such.

---

## Imagery

All historical images come from the Library's Acquia DAM (Widen), which sources them
from the Library of Congress and the Houghton Library at Harvard. They are downloaded
once, resized to 1400px wide, and committed — no hotlinking, no runtime auth, no CORS.

`assets/img/badlands/credits.json` records the DAM asset id, original filename,
catalog description, and rights statement for every file. Keep it current.

To pull more assets:

```bash
python3 /Users/mbriney/TRPL/otd-social/scripts/dam.py search "elkhorn ranch"
python3 /Users/mbriney/TRPL/otd-social/scripts/dam.py download <asset-id> out.jpg
```

**Open every image before you use it.** DAM and LOC titles are sometimes wrong, and
several famous Badlands photographs are posed re-creations.

---

## Deployment

GitHub Pages, served from `main`. `CNAME` and `.nojekyll` are already committed.

**DNS — one record to create:**

| Type  | Host                   | Value                    |
|-------|------------------------|--------------------------|
| CNAME | `quiz.labs`            | `<org>.github.io`        |

Then in **Settings → Pages**: source `main` / root, custom domain
`quiz.labs.trlibrary.com`, and tick **Enforce HTTPS** once the certificate issues
(usually a few minutes).

### Local preview

```bash
cd /path/to/Quizes
python3 -m http.server 8000
# then open http://localhost:8000
```

Use a server, not `file://` — the engine loads quiz content with `fetch()`.

---

## Open items

- **Fonts.** Dharma Gothic E, Clearface, and Frutiger are loaded by `@font-face` from
  `trlibrary.com`, with an Oswald / Source Serif 4 / Inter fallback ladder if the
  cross-origin request is refused. Confirm the foundry web-embedding license, then
  self-host the four `.woff2` files in `assets/fonts/` and repoint the `src` URLs
  in `trpl.css`.
- **Logo.** The header uses the black horizontal wordmark on white. Drop the official
  **white** wordmark SVG into `assets/img/brand/` if you want the Dark Gray header
  bar the brand standards specify — do not recolor the black file with CSS filters.
- **Analytics.** No tracking is installed. If you want GA4 events on quiz starts,
  completions, scores, and shares, that's a small addition to `quiz.js`.
- **Fact-check.** The Badlands content is drafted from the TRPL knowledge base but has
  **not yet completed** the independent two-source verification pass. Run that before
  this goes public. 
