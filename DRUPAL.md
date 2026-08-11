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

---

## Status — 11 August 2026

**All 29 Quiz nodes are built on trlibrary.com as Drafts.** Every one has its
title, an image from the media library, the embed code, and the correct manual
alias at `/quiz/<id>`. Each alias was read back from the address bar after save
and confirmed; Pathauto is switched off on all of them.

Nothing is public. The 18 old quizzes are still published and untouched.

### What is left, in order

1. **Publish the 29** (bulk operation on `/admin/content?type=quiz`)
2. **Take the 18 old nodes down** — they must go before step 3
3. **Add the 18 redirects** from `build/drupal-redirects.csv`
4. **Swap the block on `/quiz`** for the gallery embed
5. Re-run the sitemap

### Images to review

The Image field is a teaser and social-card image only — the gallery widget
uses its own from GitHub Pages — so these were picked quickly from the media
library and are worth a pass by someone with an eye on the collection. Two
specifically:

- **The Square Deal** got `7-TR-Square-Deal-Illustration.jpg`, which is a
  stereograph card and shows the same frame twice.
- **The People Around Him** got the Booker T. Washington portrait
  (`pe-hub_booker-t-washington_sq`). Defensible — it is the People hub image —
  but a quiz about many people leads with one face. Considered and rejected:
  `pz-hub_booker_43`, the "EQUALITY" dinner cartoon, which is a hostile
  period caricature and the wrong thing to put on a quiz card.

### One thing worth fixing in the repo

The media library has **`07_father.jpg`**, a proper portrait of Theodore
Roosevelt Sr. The repo settled for a 339×420 photograph of the framed painting
because nothing better could be found through the DAM or the LOC. This is
better and it was in Drupal all along. Worth pulling into
`assets/img/father/` to replace the undersized hero on the Greatheart quiz.

### A loose end

`/quiz/badlands` was first saved as `/quiz/tr-badlands` before the Pathauto
toggle was understood, then corrected. Drupal may be holding the old alias as
an automatic redirect. Harmless, but worth a look while the redirects are
being added.

---

## LIVE — 11 August 2026

All 29 quizzes that were deployed to GitHub Pages are **published and live**,
the 18 old URLs **301-redirect** to their successors, and `/quiz` serves the
gallery widget. Verified anonymously with cache-busted requests: 29/29 return
200, 18/18 land on the intended destination, and no Typeform markup remains
anywhere on `/quiz`.

The old nodes (142–159) are **archived, not deleted** — recoverable from the
content list, with their URL aliases removed so the redirects can own those
paths.

### Four things Drupal did that the plan did not anticipate

**Bulk "Publish content" does not work under content moderation.** It reports
"Quiz content items were skipped as they are under moderation" and publishes
nothing. Each node's moderation state has to be changed on its own edit form.

**Redirect refuses a source path that still resolves.** The first three
redirects silently failed because the old nodes still owned their aliases.
The order has to be: clear the alias, *then* create the redirect. This is a
sharper version of the sequencing note above — it is not enough to unpublish.

**An alias can only be changed on the published revision.** Trying to clear
the alias and unpublish in the same save fails with "You can only change the
URL alias for the published version of this content." Two saves: clear the
alias while published, then archive.

**Saving as Draft does not unpublish.** It creates a pending revision and
leaves the published version live. Archived is the state that takes a page
down. Worse, once a node has a pending draft, the edit form stops offering
Archived at all — it has to be set back to Published first to untangle the
revision, then archived.

### And one that cost the most time

**Anonymous responses are cached.** Five nodes appeared to still be live long
after they had been archived correctly; they were serving a stale anonymous
page cache. Any check of what the public sees must append a cache-busting
query string. Three rounds of re-archiving were spent on a problem that did
not exist.

---

## ALL 35 LIVE — 11 August 2026

The six North Dakota and national quizzes went up once the repo was pushed to
GitHub Pages. Final anonymous, cache-busted verification: **35/35 quiz pages
return 200**, **18/18 old URLs land on the intended successor**, and `/quiz`
serves the gallery with no Typeform markup remaining.

| Slug | Title | Teaser image |
|---|---|---|
| `medora` | Emperor of the Bad Lands | `bl-hub_medora_43` — the 1880s townsite with the de Morès abattoir chimney |
| `great-die-up` | The Winter That Ended the Open Range | `05_work_badlandshorse.jpg` |
| `national-park` | Seventy Thousand Acres | `day2-badlands.jpg` |
| `badlands-wildlife` | What Lives Out There | `04_wildlife_bison.jpg` |
| `election-1912` | Four Men and a Bullet | `fact5_bulletpierced_speech.jpg` — Elbert Martin holding the speech the bullet went through |
| `coal-strike` | No Coal and Winter Coming | `ft1-hub_coal-strike_sq` |

### Working the create form reliably

The node form's field references are stable across page loads, but they have to
be re-registered after every navigation before they can be set. The sequence
that works, per node:

1. Load `/node/add/quiz`, then locate Title, Quiz embed code, the Pathauto
   toggle, URL alias and **Save as** in one pass
2. Set all five directly — including **Save as → Published**, which is offered
   on the *create* form, so a node can be published on first save rather than
   created as a draft and edited afterwards
3. Only then open the media library, search, select, insert
4. Read the field values back before saving

**Do not click the sidebar by coordinate.** Turning the Pathauto toggle off
reveals the alias textbox and shifts everything below it, so a coordinate
captured a moment earlier lands on "Configure URL alias patterns." — which
navigates away and silently discards the whole form. Set the toggle and the
alias by field reference, not by pixel.

**The collapsed sidebar keeps saying "Automatic alias"** even after Pathauto is
switched off and a manual alias is typed. The summary text is stale, not the
form. Confirm by reading `path[0][pathauto]` and `path[0][alias]` off the form,
or by checking the address bar after save — every one of these six was verified
that way.

### Still open

- The sitemap: all of `/tr` and all of `/visit` are missing, and the 35 quiz
  nodes want checking into it
- The image review noted above (Square Deal's doubled stereograph frame, the
  single portrait on The People Around Him, `07_father.jpg`)
