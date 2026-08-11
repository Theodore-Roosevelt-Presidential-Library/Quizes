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

### Challenge a friend

After finishing, a player can open **Challenge a friend**, enter a name, and get a
link. The friend opens it and plays the **identical run** — same questions, same
order, same answer positions — then sees a head-to-head result and can challenge back.

Everything travels in the URL. Nothing is stored on a server, so there is no user
data to hold, breach, or purge.

```
https://www.trlibrary.com/tr/badlands?trplq=<token>#trpl-quiz-badlands
```

The token is base64url over `version~quizId~score~total~deck~name~checksum`. The deck
is two base36 characters per question — the source question index and an index into
the 24 orderings of four options — so a fifteen-question challenge costs 30 characters
and the whole link lands around 140.

The trailing fragment points at the mount div, which is given the id
`trpl-quiz-<quizId>` automatically. A challenged friend arriving on a long page is
scrolled straight to the quiz instead of having to hunt for it.

**The checksum is not security.** It stops someone editing a friend's score in the
address bar; anyone who reads this file can forge a link. Nothing of value rides on
it, and a tampered link simply falls back to a normal solo quiz.

If a challenge names a quiz that isn't on the page, it's ignored — so a page can carry
several embeds safely. If a question referenced in a link no longer exists because the
quiz was edited, the run falls back to a normal shuffle rather than breaking.

### Names

Collected client-side only, never stored. Capped at 24 characters, whole HTML tags
removed, stray markup characters stripped, URLs removed, and checked against a
profanity list. Apostrophes and hyphens are kept — O'Keefe and Anne-Marie are names,
not attacks; everything downstream sets text nodes and attributes, never `innerHTML`.

The block list in `embed.js` is deliberately short and English-only. It stops the
casual case, not a determined one. Names appear in shared trlibrary.com links, so if
this gets real traffic it's worth revisiting.

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

### Shuffling

Every run deals a fresh order: the questions are shuffled, the four options within
each question are shuffled, and the correct index is remapped to follow its option.
A retry re-deals. So "question 7 is B" is worth nothing to anyone.

```json
"shuffle": { "questions": true, "options": true }
```

Both default to `true` if the block is absent. Set `"questions": false` for a quiz
built as a narrative where the order carries meaning — the Badlands questions run
chronologically in the source file, and shuffling does trade that arc for the
cheat-proofing.

Because the order changes, **never write an explanation that refers to another
question** ("as we saw above"). Each one has to stand alone.

### Quiz-level fields

`title`, `subtitle`, `intro`, `heroImage`, `heroAlt`, `learnMore`, `shuffle`,
`badge`, `tiers`.

`tiers` is a descending ladder of achievement bands. Each is `{ min, name, line }`;
the engine picks the highest tier whose `min` the score meets. `badge.shareText`
supports the tokens `{score}`, `{total}`, and `{tier}`.

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

## Live head-to-head

Two people race the same fifteen questions at the same time, twenty seconds each.

One player picks **Play head-to-head**, enters a name, and gets a game code and a
link. The other opens the link, enters a name, and both count down and start
together. Each side sees the opponent's live score and which question they're on.
At the end both get the same head-to-head result.

```
https://www.trlibrary.com/tr/badlands?trpllive=badlands.YFEUGP#trpl-quiz-badlands
```

### How it connects

GitHub Pages is static file hosting — there is nothing on it that can introduce two
browsers to each other, and GitHub offers no service that does. The game runs
**peer-to-peer over WebRTC**, using PeerJS's free public broker purely to swap
connection details. No account, no cost, and no game data passes through it.

PeerJS is ~100KB and is **loaded only when someone actually starts a live game**, so
it never lands on a trlibrary.com page that nobody plays on.

The host deals the deck and sends it over the data channel, so both players get the
identical run — the same encoding the challenge links use.

### What happens when it fails

Two things will fail in the wild, and both are handled rather than left spinning:

- **The public broker is rate-limited and occasionally down.** Failure to reach it,
  a code that isn't open, or a network blocking direct peer connections all land on
  a plain explanation with a "Play on your own" button that drops straight into a
  normal solo run.
- **An opponent disconnects mid-game.** The remaining player is not thrown out —
  the progress bar notes they left and the run finishes, scored against whatever the
  opponent had reached.

### Waiting

The two sides wait for very different things, so they get very different timeouts.

The **host** is waiting on a human — copy a link, send it, hope they notice. That's
**ten minutes**, and the lobby says how long the room stays open so they know whether
they can put the phone down. Override per quiz with `"waitMinutes"` in the `live`
block.

The **guest** is dialling a code that either exists or doesn't, so **twenty seconds**,
retried up to three times four seconds apart — the host's peer may be momentarily
reconnecting to the broker when the guest arrives.

**The broker hangs up on idle peers**, which over a ten-minute wait would silently
kill the room while the host sat there believing it was open. The client reconnects
on `disconnected` and re-checks every five seconds while the lobby is up. Verified by
holding a room open well past the old timeout and then joining it successfully.

If live play gets real use, the fix for broker flakiness is to self-host
`peerjs-server`; the client only needs a `host`/`port` option to point at it.

### Timing

Twenty seconds a question. Running out scores it wrong and moves on — otherwise one
player wandering off stalls the other indefinitely. After answering, the explanation
shows for four seconds and then auto-advances, with the button available to move on
sooner. Both are configurable per quiz:

```json
"live": { "seconds": 20, "revealSeconds": 4 }
```

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

---

## The listing widget

`/quiz` on trlibrary.com used to be a Drupal view block. It is now this:

```html
<div data-trpl-quiz-gallery></div>
<script src="https://quiz.labs.trlibrary.com/assets/js/gallery.js" async></script>
```

Every quiz, in an order that is **the same for everyone today and different
tomorrow**, with a search box and difficulty and topic filters. Cards link to
the Drupal node for each quiz at `/quiz/<id>`.

Preview it at [`/gallery.html`](gallery.html).

### Optional attributes

| Attribute | Default | What it does |
|---|---|---|
| `data-limit` | all | Show only the first N after shuffling — for a "more quizzes" block elsewhere |
| `data-topic` | none | Preset a topic filter, e.g. `data-topic="Conservation"` |
| `data-node-base` | `nodeBase` in index.json | Where cards link |
| `data-base` | wherever `gallery.js` loaded from | Override the asset origin |

### The daily order

Seeded with the visitor's **local** calendar date, so "today" turns over at
their midnight rather than at 6pm Mountain. Same seed for every visitor, so a
link someone sends you shows what they saw and a screenshot in a meeting
matches what is live. No server involved.

The PRNG is mulberry32 rather than a bare hash — successive values from a hash
correlate, and with 29 items you can see it: the same few quizzes keep landing
near the top.

### Search

Searching only titles and blurbs is useless — nobody types "Fifteen questions
on the country that made him", they type **Rondon**, **Gorgas**, **Sagamore**,
**1912**. Those words live inside the questions, and the widget cannot load 29
quiz files to find them.

So they are baked in. `tools/reindex.py` reads every quiz, pulls the
distinctive proper nouns and years out of the questions, and writes them to a
`keywords` array on each index entry:

```bash
python3 tools/reindex.py            # rewrite after adding or editing a quiz
python3 tools/reindex.py --check    # exit 1 if stale
```

The trick is telling a name from a sentence-initial capital. A word is kept
only if it appears mid-sentence at least once somewhere, which sorts "Rondon"
from "Born" without needing a dictionary.

### The filter bar

Three things the first build got wrong, for anyone tempted to undo them:

**The controls live in a band.** Fourteen loose pills straight on a white
Drupal page read as debris between the breadcrumb and the cards. A sand-wash
panel with a hairline border makes them one object.

**Labels sit inline with their rows,** not stacked above. That buys back two
lines of height, which is what stops the topic row wrapping so that "Holidays
& Occasions" sits alone on a second line looking broken.

**Card metadata is not shaped like the filter chips.** It used to be, so every
card looked like it had four buttons on it. Now only the difficulty keeps a
solid pill; topics are quiet filled labels with no border and no hover.

Below 640px the facets collapse behind a disclosure — stacked, they cost 461px
on a 390px phone, a full screen of controls before the first quiz. The search
box stays visible, because searching is what people do on a phone. The collapse
is a class honoured only inside the media query, so a rotation or a resized
window always reveals the facets and no JS watches the viewport.

The status line only appears once something is narrowed. Telling a visitor who
has done nothing that there are "29 quizzes, in a new order each day" is the
widget talking about itself.

### Facets

`difficulty` and `topics` live on each entry in `quizzes/index.json`, and the
facet lists themselves are in `index.json` under `facets` — the widget renders
chips in that order rather than alphabetically, because Introductory /
Standard / Challenging is a ladder and sorting it alphabetically puts
Challenging first, which reads as the default.

Topic filters are **OR** within the facet: picking Conservation and Family
shows both. AND would return almost nothing and read as broken.
