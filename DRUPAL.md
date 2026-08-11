# Drupal integration

What has to exist on trlibrary.com for the 29 quizzes to be live, and the exact
values to put in each field.

---

## 1. The listing page — `/quiz`

Remove the existing quiz view block. In its place, one **Custom Block** using the
**Full HTML** text format:

```html
<div data-trpl-quiz-gallery></div>
<script src="https://quiz.labs.trlibrary.com/assets/js/gallery.js" async></script>
```

Per the house rules: its own block, **Medium** top and bottom spacing on the
Style tab, page head section above it (Title field block + Breadcrumbs, themed
White/Black, Medium top spacing).

The widget renders its own search and filters and needs no surrounding markup.
It has no background or border of its own, so the section it sits in supplies
the frame.

---

## 2. One Quiz node per quiz — `/quiz/<slug>`

29 nodes, content type **Quiz**, URL alias `/quiz/<id>` where `<id>` is exactly
the quiz id below. Body (Full HTML):

```html
<div data-trpl-quiz="<id>"></div>
<script src="https://quiz.labs.trlibrary.com/assets/js/embed.js" async></script>
```

The `<script>` line is identical on every node and only needs to appear once per
page. The `data-trpl-quiz` value is the only thing that changes.

Create as **Draft** for review unless told otherwise.

### The 29

| Slug (`/quiz/…`) | Title | Difficulty | Questions |
|---|---|---|---|
| `badlands` | T.R. in the Badlands | Standard | 15 |
| `early-life` | The Making of a Boy | Introductory | 15 |
| `new-york-politics` | The Youngest Man in the Assembly | Challenging | 15 |
| `rise-to-power` | Fifteen Years to the White House | Standard | 15 |
| `rough-riders` | The Rough Riders | Standard | 15 |
| `presidency` | The Square Deal | Introductory | 15 |
| `conservation` | Two Hundred and Thirty Million Acres | Standard | 15 |
| `post-presidency` | After the White House | Standard | 15 |
| `people` | The People Around Him | Challenging | 15 |
| `family` | Life at Sagamore Hill | Introductory | 15 |
| `strenuous-life` | The Strenuous Life | Standard | 15 |
| `naturalist` | The Naturalist | Standard | 15 |
| `homes-and-places` | Where History Happened | Standard | 15 |
| `books-and-writings` | The Author President | Challenging | 15 |
| `myths` | Fact or Fiction | Introductory | 15 |
| `legacy` | The Measure of the Man | Standard | 15 |
| `teddy-bear` | The Teddy Bear | Introductory | 12 |
| `pets` | The White House Menagerie | Introductory | 12 |
| `birthday` | The Twenty-Seventh of October | Introductory | 10 |
| `christmas` | Christmas at the Roosevelts' | Introductory | 10 |
| `new-year` | Eight Thousand Handshakes | Standard | 10 |
| `fourth-of-july` | The Dickinson Oration | Challenging | 11 |
| `roosevelts-at-war` | The Roosevelts at War | Standard | 13 |
| `fathers-day` | Greatheart | Standard | 14 |
| `panama-canal` | The Path Between the Seas | Challenging | 15 |
| `river-of-doubt` | The River of Doubt | Standard | 15 |
| `great-white-fleet` | Sixteen Battleships | Challenging | 14 |
| `health` | The Body He Made | Standard | 13 |
| `nobel-peace-prize` | The Peacemaker | Challenging | 14 |

Titles, meta descriptions and social images for every node are generated into
`build/drupal-nodes.csv` by `tools/drupal.py`.

---

## 3. Redirects from the retired quizzes

18 old nodes. Each redirects to its nearest successor; the two with no
successor go to the listing page. All **301**.

| Old path | New path | Why |
|---|---|---|
| `/quiz/tr-and-animals-quiz` | `/quiz/pets` | Same subject |
| `/quiz/white-house-pets-quiz` | `/quiz/pets` | Same subject |
| `/quiz/early-life-quiz` | `/quiz/early-life` | Same subject |
| `/quiz/conservation-quiz` | `/quiz/conservation` | Same subject |
| `/quiz/outdoors-quiz` | `/quiz/conservation` | Nearest |
| `/quiz/rough-rider-quiz` | `/quiz/rough-riders` | Same subject |
| `/quiz/veterans-quiz` | `/quiz/roosevelts-at-war` | Nearest |
| `/quiz/presidential-quiz` | `/quiz/presidency` | Same subject |
| `/quiz/progressive-reforms-quiz` | `/quiz/presidency` | The Square Deal |
| `/quiz/diplomacy-quiz` | `/quiz/nobel-peace-prize` | Portsmouth |
| `/quiz/trs-adventures-quiz` | `/quiz/river-of-doubt` | Nearest |
| `/quiz/trs-travels-quiz` | `/quiz/post-presidency` | Africa and the Amazon |
| `/quiz/political-impact-quiz` | `/quiz/legacy` | Nearest |
| `/quiz/campaigns-and-elections-quiz` | `/quiz/rise-to-power` | Nearest |
| `/quiz/women-in-trs-life-quiz` | `/quiz/people` | Edith, Alice, Bamie |
| `/quiz/adversity-quiz` | `/quiz/health` | Asthma, the bullet, the fevers |
| `/quiz/quotes-quiz` | `/quiz` | Deliberately not rebuilt |
| `/quiz/leadership-quiz` | `/quiz` | No successor |

Two subjects lost a quiz and did not get one back: **Quotes** (skipped on
purpose — a quiz that scores people on verbatim recall of quotations is exactly
where a presidential library gets a quotation wrong) and **Leadership**. If
either matters, they are worth building rather than redirecting.

The old nodes have to come down **before** the redirects go in, not after — see
the sequencing note at the end. A published node still holding
`/quiz/rough-rider-quiz` wins over any redirect pointing at that path.

---

## 4. Sitemap

The entire `/tr` section and all of `/visit` are missing from `sitemap.xml`
(491 URLs, ~438 of them video playlist pages). `robots.txt` is clean, so this is
an XML Sitemap configuration problem in Drupal. The new quiz nodes should be
checked into the sitemap once created — and while someone is in there, `/tr`
and `/visit` want fixing, because those are the pages the quizzes link to.

---

## 5. Checks after go-live

- A quiz plays inside a real node, not just the preview gallery
- The badge downloads from a `trlibrary.com` page (canvas is cross-origin here)
- The listing widget's daily order actually changes overnight
- Every one of the 18 old URLs resolves, none 404
- `/quiz/<slug>` alias does not collide with the old `<slug>-quiz` aliases

---

## What the Quiz content type actually has

Confirmed by building `/quiz/badlands` (node 659) end to end on 11 August.

Three fields, all required:

| Field | Notes |
|---|---|
| **Title** | Plain text |
| **Image** | Media reference, **required**, picked from the media library. Used for the teaser and social card only — the gallery widget uses its own images from GitHub Pages |
| **Quiz embed code** | Textarea, takes the `<div>` + `<script>` pair |

Sidebar: Meta tags, URL redirects, XML Sitemap, URL alias, Authoring information.

### Two things that will bite

**Pathauto overrides the alias.** "Generate automatic URL alias" is on by
default and turns *T.R. in the Badlands* into `/quiz/tr-badlands`, not
`/quiz/badlands`. It is a styled toggle, not a plain checkbox — it has to be
clicked directly, and setting the alias text without turning the toggle off is
silently discarded on save. Turn the toggle **off first**, then type the alias.

**The Image field is the slow part.** Every node needs a media item chosen by
hand: open the library, search, select, confirm. There is no URL field and no
default. The library does have usable images — searching `badlands` returns
about ten — but this is roughly half the clicks per node.

### Per-node cost

One node took about ten browser interactions: title, embed code, open media
library, search, select, confirm, open sidebar, expand URL alias, toggle
Pathauto off, set alias, save. Twenty-nine nodes is therefore ~290, plus 18
redirects. Worth weighing against a one-off import of `build/drupal-nodes.csv`
by someone with database or Drush access, which would take minutes.

### The old nodes are Typeform embeds

The retiring quizzes are `<iframe>` embeds pointing at `form.typeform.com`.
Nothing is lost by retiring them and no Typeform account needs to stay live for
the new ones.

### Sequencing — this order matters

1. Create the 29 new nodes (Draft)
2. Publish them
3. **Delete or unpublish the 18 old nodes** — an old node still holding
   `/quiz/rough-rider-quiz` wins over any redirect, because Drupal routes to the
   alias before the redirect module gets a look
4. Add the 18 redirects
5. Swap the block on `/quiz`

Doing step 4 before step 3 produces redirects that silently never fire.
