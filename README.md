# TRPL Quizzes

Embeddable quizzes for the Theodore Roosevelt Presidential Library. The quizzes are
meant to live **on trlibrary.com pages**, not on a site of their own —
`quiz.labs.trlibrary.com` is the preview gallery and asset host.

Static HTML/CSS/JS — no build step, no dependencies. Push to `main`, GitHub Pages serves it.

---

## Embedding a quiz

Paste these two lines into a **Custom Block** or any text field using the
**Full HTML** format:

```html
<div data-trpl-quiz="badlands"></div>
<script src="https://quiz.labs.trlibrary.com/assets/js/embed.js" async></script>
```

That's the whole integration. The script tag only needs to appear **once per page**
even if you place several quizzes on it.

The quiz mounts into a **shadow root**, so Drupal and Bootstrap styling cannot reach in
and the quiz's styling cannot leak out. Verified against a host page deliberately
loaded with Bootstrap plus `!important` overrides on `button`, `img`, `ul`, and
headings: the embed rendered correctly and the host page was untouched.

### Optional attributes

| Attribute | Default | What it does |
|---|---|---|
| `data-share-url` | the page's canonical URL, else its own URL | Where badge share links point |
| `data-base` | wherever `embed.js` loaded from | Override the asset origin |

### Sizing

Desktop layout is two columns — image left, question right — on a white ground,
sized so a whole question fits in view without scrolling the host page. One question
runs about 520–580px tall regardless of how long the explanation is: the explanation
scrolls inside its own panel and the primary button sits in a fixed bar beneath.

Tune the frame height per placement with an inline custom property:

```html
<div data-trpl-quiz="badlands" style="--stage-h:24rem"></div>
```

Default is `clamp(21rem, 58vh, 27rem)`. Below 46rem wide the layout stacks to one
column automatically.

Images use `object-fit: contain`, never `cover` — a cropped portrait that cuts off
Roosevelt's head is worse than a little white space. Keep that as it is.

`TRPLQuiz.scan()` re-scans the document for mount points added after load — useful if
a view or AJAX block injects the markup late.

---

## How it works

```
assets/js/embed.js       Everything: engine, badge generator, shadow-root mounting
assets/css/quiz-embed.css  Styles for the quiz, loaded inside the shadow root
assets/css/trpl.css      Styles for the gallery pages only
assets/img/<quiz>/       Imagery for that quiz + credits.json (DAM ids, collection, rights)
quizzes/index.json       The list that populates the gallery
quizzes/<id>.json        One file per quiz — the only file you edit to add content
index.html               Gallery: preview each quiz, copy its embed code
quiz.html?q=<id>         Full-page preview of a single embed, for QA
```

A visitor answers a question, immediately sees right/wrong plus the correct answer,
a short piece of history, and a link out to trlibrary.com in a new tab. At the end
they get a score, an achievement tier, and a downloadable badge.

### On sharing

There are deliberately **no X / Facebook / LinkedIn / Bluesky buttons**. Those
platforms' web intent URLs can carry text and a link but cannot attach an image, so
a "share" button there would post a bare link and quietly drop the badge the visitor
just earned. Instead the badge is a download, plus the OS share sheet on devices
where `navigator.canShare({files})` reports it can actually carry the file.

If you want the badge to appear when someone pastes a link, that is an Open Graph
image on the trlibrary.com page hosting the embed — a Drupal change, not a change
here, and it would show one generic image rather than a personal score.

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

## Imagery and credits

Historical images are pulled once from the Library's Acquia DAM (Widen), resized to
1400px wide, and committed — no hotlinking, no runtime auth.

**Credit the originating collection, never the DAM.** The DAM is our access system,
not a source. Use:

- `Theodore Roosevelt Collection, Houghton Library, Harvard University.`
- `Library of Congress, Prints and Photographs Division.`

`assets/img/<quiz>/credits.json` records, per file: the DAM asset id, original
filename, catalog description, rights statement, originating `collection`, and the
`credit_line` that appears under the image. Keep it current — it is the audit trail.

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
**Pages is not enabled yet** — that is why nothing builds and nothing resolves.
Turn it on in Settings → Pages and the first deployment will appear under Actions.

Cross-origin note: the embed fetches `quizzes/<id>.json` from this host, so the host
must send `Access-Control-Allow-Origin: *`. GitHub Pages does this for static files by
default; if you ever move these assets behind a different server, that header has to
come with them or every embed will fail to load its questions.

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
- **Logo.** `assets/img/brand/` holds the horizontal wordmark as SVG in black and
  reversed white, plus PNG rasters of each. The badge draws the white PNG; the gallery
  header uses the black SVG. The white version was produced from the supplied vector by
  setting the path fill, not by filtering a raster — keep it that way if it is ever
  regenerated.
- **Analytics.** No tracking is installed. If you want GA4 events on quiz starts,
  completions, scores, and shares, that's a small addition to `quiz.js`.
- **Fact-check.** The Badlands content is drafted from the TRPL knowledge base but has
  **not yet completed** the independent two-source verification pass. Run that before
  this goes public. 
