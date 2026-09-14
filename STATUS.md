# STATUS — where Almanakk stands

Updated 17.09.2026. Updated in place — one file, never a dated copy. **Read this first.** `CLAUDE.md` and the notes in `Front/` are working notes, not the state.

A Norwegian wall-calendar view on Google Calendar. **Live** at https://alanlucien.github.io/almanakk/, installed as a PWA. v2 is live at https://almanakk-v2.pages.dev/, build `20260917r`.

## ⚠️ It writes to the live calendar with no confirmation step

Verified 12.09: quick-add `POST`s the moment you press enter (`gcal.js:353`), and the day panel's Slett `DELETE`s immediately (`gcal.js:420`). There is no `confirm()` anywhere in `app.js` — the only net is the undo toast, which `PATCH`es the event back to `confirmed` (`gcal.js:384`).

## v2 — started 12.09.2026, local only

`v2/` is a working copy at `…/almanakk/v2/`. It has its **own** `app.js`, `style.css`,
`manifest.webmanifest` and `sw.js` (cache `almanakk2-`, own storage prefix), and loads the
**shared** engine from the parent by reference — `../gcal.js`, `../airports.js`,
`../config.js`. So sign-in, loading and flight parsing are one codebase; only the
renderer forks. Same origin, so no OAuth change and one sign-in serves both.
Verified booting beside v1 with no console errors. **Not pushed.** v1 is untouched.
Next in v2: the dynamic-space row (Block 1 of the 02.09 plan), and a Cloudflare Worker
holding the refresh token so the phone stops asking for Google — Alan's decision 12.09.
**Precondition checked 12.09:** Google Cloud project ALMANAKK (`almanakk-506414`), Google Auth
Platform → Audience → User type = **Internal**. So refresh tokens do not expire after 7 days
(that limit applies only to External apps in testing). The Worker plan is viable. Do not click
"Make external".

## Cloudflare sign-in for v2 — LIVE AND CONNECTED 12.09

`functions/api/[[path]].js` is a Pages Function that holds Google's refresh token in KV,
mints access tokens, and proxies `/api/gcal/*` to the Calendar API. The browser never
holds a Google token; there is no sign-in button in the Cloudflare build. Identity comes
from Cloudflare Access's header, same trust as the boards, tightened to `ALLOWED_EMAILS`.
`publiser.py` builds `dist/` (v2 + engine only — never `Front/` or `inventory/`) and
deploys to Pages project **almanakk-v2**. The shared `gcal.js` has a proxy branch that
only runs when `window.ALMANAKK_PROXY` is set, which the build does; v1 is unaffected.
Tested: 12 Function paths in Node against a fake Google; proxy mode and v1 in a browser.

**Live at https://almanakk-v2.pages.dev/** (12.09). Pages project `almanakk-v2`; KV
`ALMANAKK_STATE` = `8935882923314b36a43688fa05509f30`; secrets `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` set; Access app `77ec3450…` (policy `319d36d1…`,
alan@winterguests.com only, session 730h, covers `*.almanakk-v2.pages.dev`). Redirect URI
added on OAuth client *Almanakk web*; a NEW client secret was created for it because Google
masks existing ones — **delete the old starred secret once step 6 is confirmed working**.
Verified from outside: `/`, `/v2/` and `/api/gcal/*` all 302 to
`divine-rain-c685.cloudflareaccess.com`. Alan connected Google 12.09 ~18:00; `/v2/` loads his real calendar with no sign-in button.
KV holds `google:refresh` and `google:access`. The old client secret is deleted; one remains.
**Gotcha for whoever checks KV:** `wrangler kv key list/get` reads a LOCAL emulation by
default and shows nothing — pass `--remote`. Half an hour was lost to this.
Still live in parallel: github.io/almanakk/v2/ (Google sign-in in the browser) — retire or
redirect once the Cloudflare address has proven itself for a week.

## NEXT: the row rewrite, in v2, on the preview lane (handed over 12.09)

Alan uses production v2 daily. Build in `v2/app.js` + `v2/style.css` only; deploy with
`python3 publiser.py --preview` → https://preview.almanakk-v2.pages.dev/v2/ (same login).
Show pictures of month, year, print and phone strip before any production deploy.
Spec: `Front/NOTES-calendar.md` → "The day row is one dynamic space" and the preview result
below it; branch `preview-flow-line` shows why a CSS grid cannot do it. Keep it short in chat.

## The year view — BUILT 17.09.2026, live as build `20260917r`

Twelve real month sheets in one row, as in Alan's mock — not thumbnails, not a 4x3 grid.
Same renderer, same click, same rules. CSS: `#app.year12`, `style.css:1559`.
**SIX OVER SIX** (Alan, 17.09: "make sure the year view stacks six months on top of six
other months and does not scroll a strip of twelve"). A strip needed a 1674px window and
scrolled sideways on every screen he owns while half the page's height went unused. Two
rows of six fit a desk in both directions and give each sheet 231px instead of 132 —
nearly twice the paper, which was most of what was being clipped. Year faults 10 -> 2.

Five separate lengths were being read against the wrong box, each one enough on its own
to stack entries on top of each other:
`--inf` declared on `#app.year12` while `.day` declares it too (so `.month.cities .day`
won at 12px and "uke 9" took 77px of a 129px row); the count set at 11px on a sheet
written at 8; `.band` at 12px while its own words were at 8, which drew every band half
again too wide; `.evt`'s `min-width: 4.5em` overruling a width already measured in px;
and `display:none` on the weekday letter, which takes it out of the day's GRID and
shifted every column after it one to the left.

The bands were also sized without asking how wide the paper is — three runs laid lanes
reaching 168px on an 88px sheet. `app.js:1963` scales them to the sheet, but only when
they miss the WIDEST row altogether; a month never trips it.

**Measured, twelve months, at 430 / 1180 / 1440:** no entries colliding, no bands
overlapping, no slivers, nothing written over a band's name. What remains is the
physics of a 132px column: nine band names cut with a clean ellipsis (all within 2-20px
of fitting), and one row — 27 September, walled by ANTIGONE Paris — with 11px of paper,
where the count is clipped.

## THE ALIGNMENT RULE — there is one, and this is it (17.09.2026)

Alan: *"I'm confused on behalf of the computer who's going to make these choices as to
when what aligns where. I don't need an explanation. I just need consistency across the
board."*

> **His line starts at the first stop clear of every word a band writes today —
> and never at the very first stop on a day a band's block stands there.
> A word is a wall. A block is not a wall, but it owns the first stop.**
>
> And a run says its name **whole** on the row it introduces itself: the name may
> reach past its lane, as far as the next lane occupied *that day*. It only writes
> itself down the band when the room is not there. **Spill before you wrap.**

**Vocabulary, fixed with Alan 17.09** — *"one stop in"* means stop 1 counted from the
LEFT EDGE, an absolute position. *"one more stop"* means one further than the build in
front of him, a relative one. He is happy for his events to sit **inside** a band; the
indent is not about room, it is what says the band is there. A line flush against the
edge reads as part of the run.

Note "a band's block **stands there**", not "a band exists somewhere on the row": on his
1 March the banner sits at 150px of a 246px row, and the coarse reading sent "Underdog
Mainz" 38px off the page to sit after a banner it could be written in front of.

That is the whole rule. Four used to stand in its place — start after his own lanes; then
past a banner if you land on one; then not past a *silent* banner; then come back left if
that leaves under 8em — each added to answer one screenshot. They agreed often enough to
look deliberate and disagreed often enough that he could not predict any of it.

They all measured the wrong thing. A **lane** is as wide as the longest name a run carries
all month; the **word** standing on today's row may be a third of that. So the line waited
for "rehearsals" on the day the band only said "DNK", and waited for the whole SweMA lane
on days it said nothing at all. `app.js:2250`.

Note *first* stop, not the stop after the last word: his 1 March has 152px of blank paper
**in front of** the banner, and "after the last word" put the entry 45px off the page.

Three companions, from the same message:
- **A run is one straight column all the way down.** The width was recomputed each day
  against whichever neighbour happened to be occupied, so the right edge stepped in and
  out — 72px of wander on ANTIGONE Paris — and the name was cut on the narrow days. Asked
  once per run now (`runCap`, `app.js:1943`).
- **A title packs as many whole words per row as fit** ("DNK rehearsals" / "NADIA", not
  three rows of one word), and the last row carries what is left and clips with an
  ellipsis rather than dropping it in silence.
- **`--w` was written on the band in the BAND's em and read by the label in the LABEL's**,
  so every label box in the app was 15% narrower than its own band. That, not the lanes,
  was what cut "«NINA» Nanterre". Same trap as the stops, the info column and `--inf`.

### The harness (`v2/_sweep.js`, gitignored)
Alan asked whether this can be machine-tested. It is. `__sweep()` walks twelve months and
`__yearSweep()` the year sheet, reporting `entriesCollide`, `overBandName`, `bandsOverlap`,
`slivers`, `countClipped`, `bandNameCut`, and — new, and the two that caught all of this —
**`wastedStep`** (whole stops of paper standing empty to the left of his first entry) and
**`raggedBand`** (a run whose right edge wanders). Fixtures reproduce his November 27-29,
September week 38 and June 10-17. A cut name is now sorted into `bandNameCut` (avoidable),
`oneWordCut` (a single word longer than its lane) and `tailCut` (the deliberate ellipsis).

Three more checks, each from something his eye caught that the harness had not:
**`flushUnderBand`** (writing flush against the edge under a band — it found 54 days on
the build he complained about), **`offSheet`** (an entry drawn outside its own canvas,
where `text-overflow` never fires so the cut carries no ellipsis), and the sweep now scans
**every column of a quarter**, not one per render — the narrow far-right column is the one
he actually reads, and it was hiding two collisions from twelve months of sweeping.

**Month view measured at 430 / 1024 / 1180 / 1280 / 1440: zero faults of every kind.**
Year: one single word 2px too long for its lane. Verified on both simulators against his
own November, June and September.

**Known rough edge:** 27 September — "Jury duty" and "ANTIGONE Paris" leave 30px of paper,
so his one event reads "Mod…". It no longer overflows or collides, but it says almost
nothing. Open question for Alan: on a row that full, is a clipped word better than "+1"?

## The line and a silent band (Alan, 17.09.2026)

"September 14-20 on iPhone, all the all-day events could have been aligned further left,
same as Møte Pekka on Tuesday the 8th, even if slightly under the grey TdO Ingrid banner
— then they wouldn't have been clipped on their right side."

The line used to step aside for every band it met. A run writes its name on a handful of
days and is a plain tint on all the rest, so rows where the banner was silent gave up the
same paper as the row where the name stands. **A name is a wall; a tint is not**
(`app.js:2201`, `drawsText` was already there and simply was not being asked). And when
clearing the walls leaves under 8em to write in, the line moves back left over the tints
until it has room — never past a band that is saying something.
Verified on the iPhone and iPad simulators against his own September: the 15th-20th now
sit on the same stop as Møte Pekka, and "Kåre Gyldendal (?!)", "Maria 50 år Bergen" and
"Prøve Vildanden" read whole where they were cut.

## THE ALIGNMENT SPEC — Alan's rules, 17.09.2026

Written from a day of his feedback, to be worked against **by machine** rather than
re-derived from screenshots. Where two of his statements pull against each other it says
so, and says which way it was resolved. **Where the code and this disagree, this is the
brief and the code is wrong** — but a rule here that has never been measured is a
hypothesis, not a fact.

### Vocabulary (fixed with Alan, 17.09 — use these words and no others)
- **stop** — one of the equal columns the writing area is divided into, the same on all 31
  rows of a sheet.
- **"one stop in"** — stop 1, counted from the **left edge**. Absolute.
- **"one more stop"** — one further right than the build in front of him. Relative.
- **band / block** — the tinted rectangle a run draws on a day.
- **name / word** — the text a run writes on a day. A run is silent on most of its days.

### A. Where his writing starts
1. His line starts at the **first stop clear of every word a band writes today**.
2. **A word is a wall. A block is not** — he is content to write inside a run's tint.
3. **But never the very first stop on a day a band's block stands there.** The indent is
   not about room; it is what says the band is there. Flush against the edge reads as
   part of the run.
4. "A band's block stands there" means **on the first stop**, not merely somewhere on the
   row. Where the run is further right, stop 0 is plain paper and flush left is correct.
5. **A day with no band at all starts flush left.** (1 May, *Møte Mari Alle er vi fulger*.)
6. **Never break the grid** (14.09, asked directly). An entry starts on a stop, always.
7. Where no stop on the row is free, the line gives up the grid and flows after the last
   word — and must still end on the sheet.

### B. Using the room that is there
8. **One event on a day: print the whole name.** Do not clip what there is room for.
9. **Two runs side by side: they share the real estate.** Neither should clip while the
   other has slack. *(UNBUILT — his week 42/43 2027: "Fanny og Alexander" breaks over two
   rows because the tour lane starts 7px too soon. The lane widths are decided once per
   month against a flat 11em reserve for the writing; on a nearly empty month that reserve
   is fiction.)*
10. **THE BLOCK IS THE TITLE** (Alan, 17.09, correcting me directly: *"I want to hear if
    you mean that the title of a multi-day band can be wider than the band. This is not
    true for me. A block is always one block and it's the width of the title. Sometimes
    the title has a line break in it so that it's not so wide."*).
    A run's block and its name are **one thing**, not a name that may reach past a block.
    The block is as wide as the title it carries; where the title has to break over rows,
    the block is correspondingly narrower. There is no such thing as a label spilling out
    of its band. *(I built exactly that in 20260917r and it was wrong.)*
11. **A run alone spreads.** *"When there are no other events on that day for that whole
    band — like a year in the future where there's only one long multi-day event — let the
    title spread full and the block fat and wide as well."* So the width a run takes is
    decided by what else needs the paper, and on an empty sheet that is nothing: the title
    goes full, the block goes with it. (Weeks 38/39 and 42/43 of 2027.)
12. A title that genuinely will not fit is written **down** the band, as many whole words
    per row as fit, and the last row carries what is left with an ellipsis. Nothing is
    dropped in silence.

### C. The banners
13. **A run is one straight column all the way down.** Its width is asked once per run, not
    per day.
14. **A tour banner never pushes his own writing**, and never appears to the left and right
    of it.
15. A run must **close visibly**. Bands must not overlap.

### D. What the year view shows about the month view (his side-by-side, 17.09)
He says he **loves the year view** and that the two should be consistent. Read off his
pencil lines and marks — each of these is a defect, and none has been verified yet:
16. **The year view drops his single-day events on days a band covers.** 1, 4 and 12 May
    carry *Meet Ellen*, *OS off (UK bank holiday)* and *indra → o…* in the month and show
    **nothing at all** in the year. His red "?" is on exactly those rows. Silent data loss.
17. **A CLIPPED EVENT MUST NOT COST HIM THE INFO COLUMN** (his correction, 17.09 — I had
    read the red arrows on the right as a collision; they are not). The city and the week
    number fail to print because his events run so far right that nothing is left for them.
    His fix is to move the events **left**, not to move the info: *"start the events on the
    13th and the 15th one step earlier, and thus we would have had more real estate after
    its clipping to show the week and the city."* And once the 8th, 13th and 15th move,
    **1, 4, 5, 8-11, 12, 14, 15, 16, 17, 18, 24 and 25 may all move one step left too, and
    then we could read the info in the info cells.** Every red arrow on that screenshot is
    pointing at this one thing.
18. **A performance written inside the tour's banner must not also stand on the day line.**
    He struck out the left-hand *Antigone 7 / 8 / 9* on 29-31 May in both views. Duplicate.
19. **A holiday and a week number must not share a cell** — *"2. Pinsedag 22"* on 25 May.
20. **Holiday names in italic.**
21. **THE TOUR BANNER'S STOP IS FLEXIBLE, decided by how much of the row is already
    spoken for.** His week 22: the *ANTIGONE Roma* block should move **one stop left**, in
    the year view AND the month view. So a tour banner is not pinned to a fixed lane; it
    takes the stop the row can spare.
22. **The 1st, 4th and 12th should move left to the previous available stop**, and it
    *"seems random why the 4th and the 11th do not start flush left like all the other
    private events"*. The complaint is the inconsistency: **wherever a day does not start
    at the far left, the reason has to be legible.** Read together with A3 ("never the
    first stop under a block") this resolves as: banded days start at stop 1, unbanded days
    flush left, and nothing else varies. *To be shown to him both ways before it is fixed
    — his words here could also mean stop 0 on those days.*
23. The two views should **line up on the same columns**. Whatever the stops are, they are
    the same idea in both.

### E. The stops themselves — the crux (Alan, 17.09)
> *"All this comes down to how many of the invisible columns — what I call stops — do we
> have, and how do the rules know when to run into them and push the next event to the next
> stop. If we had more stops, like my pencil lines indicate in the year view, we'd have more
> places to align an event and therefore potentially more real estate to the right of the
> event to print more of the event info before it's clipped."*

He is right, and this answers the objection that a grid must waste paper. A grid wastes up
to one stop per row; **make the stops finer and the waste shrinks while the columns still
line up.** Today the count is 3, 4 or 5 by sheet width (`app.js`, `STOPS`), which was chosen
so that one stop holds about thirteen characters on his phone. That reasoning was about the
*minimum readable entry*, and it ignored that a wide entry may simply span several stops.

**This is the first lever to try**, before any new placement rule: raise the stop count,
let an entry span as many stops as it needs, and measure what it does to clipping and to
the info column. It is also the cheapest thing to get wrong, so it is measured, not judged.

### F. February 2026, and the six-stop build (Alan, 17.09 — the last of the day)
He **likes six stops** ("I like six"). Three things left standing, to think about rather
than patch:

24. **THE WRITING AREA CHANGES WIDTH FROM ROW TO ROW.** His pencil line down the September
    sheet is not a clip rule, it is the edge of the info column — and the canvas *grows
    into* that column on any day it has nothing to say. Measured: **246px on a row carrying
    a week number or a city, 323px on a row carrying neither.** So 14/20/21 stop at his
    line (they hold `uke 38`, `OSLO?`, `uke 39`) and 10/11 run past it (they hold nothing).
    **This is the inconsistency underneath most of the others**: a grid cannot line up down
    the page if the paper changes width every row. It also collides with his 17.09
    correction — on the rows where the info cell DOES have content, it has already taken
    its 77px before his writing begins.
25. **ENTRIES ON NEIGHBOURING ROWS DO NOT SHARE A COLUMN.** February: *Harness tests* (21)
    sits a stop right of *Look through/Selection of…* (19) and he wants them level;
    *SweMa Dress* (10) and *Prøve Indra* (13) sit a stop LEFT of *NNB-Y* (9) and *SweMa*
    (11) and he wants those level too. His arrows point both ways, so this is not "always
    left" — it is that the column should be the same down the page, and today it follows
    whatever the band happened to say on that row.
26. **A CLOSING RULE UNDER A BLOCK THAT VISIBLY STOPS.** *"I don't like lines underneath
    blocks when they are not needed, when you can clearly see that the colour is stopping."*
    Refines the older "a run must close visibly": the rule earns its place only where the
    tint alone does not say the run has ended — at a month's last row, or where the next
    run's tint continues in the same lane.
27. **BANDS STILL FRAY ON THE RIGHT** — «NINA» Nanterre, 6 February. Already diagnosed and
    fixed on the `alignment-work` branch (`runCap`: a run's width asked once for the whole
    run instead of per day, which is what made the edge step in and out). Not yet carried
    across to this line of work.

28. **HIS OWN EVENTS INSIDE A TOUR ARE NOT THE TOUR'S** (June 2026). *Travel*, *Set up*,
    *Dress*, *Day off*, *Workshop / Chorus* sit inside the STILL LIFE run wearing the same
    small indent as *Still Life 15/16/17* — and that indent means "this belongs to the
    run". His do not. They should sit **a stop further out, before the tour band**, and
    only the tour's own performances keep the tab in. (`.v3 .day .band b.bshow` has
    `padding-left: 12px` for exactly that reason; the indent is leaking to entries it was
    never meant for.)

### Conflicts, and how they were resolved
- **8 ("one event: whole name, flush left")** against **3 ("never flush left under a
  band")**. Resolved: 3 wins where a block stands on the first stop, 8 everywhere else. The
  whole name still prints; it starts one stop in.
- **11 (a run alone spreads)** against **13 (one straight column)**. Resolved by Alan
  himself: the block and the title are one thing and the block widens WITH the title, so a
  run that spreads is still one straight column — just a wider one, for its whole length.
  What is forbidden is a name wider than its own block on a single row.
- **2 ("a block is not a wall")** against **14 ("a tour banner never pushes his writing")**.
  Not in conflict: a tour banner's *name* is a wall like any other; its *tint* is not.

### What this spec cannot decide
Taste. Whether the answer is one stop or two on a given row is Alan's call. The purpose of
the spec is that he should only ever have to answer that question about a sheet which is
already free of the defects above.

## THE LOOP — `?sweep=1`, and the baseline on Alan's own calendar (17.09.2026)

`v2/sweep.js`, loaded only for `?sweep=1`. Walks 24 months in month and year view,
runs every check, prints the findings **on the page** as plain text — read from a
simulator screenshot. It runs on his device, behind his own sign-in; nothing fetches,
writes, or leaves the page. **Preview only:** `https://preview.almanakk-v2.pages.dev/v2/?sweep=1`.

Why it exists: the checks always ran against data I invented, and my invented February is
not as dense as his. The harness came up green and he opened the app and found a fault in
ten seconds. That loop cost him hours and me nothing, which is backwards.

**⚠ The first baseline below was taken with a harness that did not wait for the web font,
did not wait for his calendars to arrive, and could not tell live data from the demo sheet.
It reported 361, then 28, then 99 for the same build. Treat it as a list of KINDS of fault,
never as a number.** What made it trustworthy (17.09, all in `sweep.js`):
`document.fonts.ready` before the first measurement; each month re-rendered until two
consecutive paints match; every frame wait raced with a timer, because
`requestAnimationFrame` never fires in a hidden tab; the service worker and its caches
dropped once at load, or the report describes a build that is no longer running; and the
header prints **LIVE** or ***DEMO DATA, NOT LIVE*** with the event count, because the app
falls back to the sample sheet in silence when the Google fetch fails.

**`?sweep=1&probe=YYYY-MM-DD`** prints one day's full geometry in both views — canvas,
stops, every band with its ink, every entry with its computed style. On live data there is
no console to reach, so it is the only way to learn WHY a day is wrong rather than THAT it is.

**THE STOP COUNT IS NOW A DIAL (17.09).** Live, 509 events, iPad 1180:

| | total | wasted | collide | offSheet |
|---|---|---|---|---|
| one stop per entry, 3/4/5 | 144 | 92 | 2 | 15 |
| entry spans what it needs, 3/4/5 | 142 | 92 | **0** | 15 |
| entry spans what it needs, `?stops=6` | **130** | 83 | 0 | 12 |

Letting an entry take as many stops as its text needs removed the collisions that
raising the count used to cause, so a finer grid is now strictly better instead of a
trade — which is exactly what Alan predicted in section E. **The default is deliberately
NOT changed:** how fine the grid should be is his eye, not a number, and it wants looking
at rather than winning on points. `?stops=N` on the preview shows any value.

**TRUSTWORTHY LIVE BASELINE — 510 events, iPad 1180, 2026+2027: 144 findings.**
`dropped` 0 · `infoLost` 0 · `overName` 0 · `bandsOverlap` 0.
Remaining: **92 wasted**, 18 `namesTouch`, 17 `nameCut`, 15 `offSheet`, 2 `collide`.
`wasted` is the alignment work and belongs to the spec above, not to bug-fixing.

**First (unreliable) baseline, build `20260917m2`, iPad 1180, 2026+2027:**

| | count | |
|---|---|---|
| `dropped` | **24** | his events written nowhere and not counted — SILENT LOSS |
| `infoLost` | 258 | the city/week cell cannot print what it holds |
| `wasted` | 44 | whole stops of empty paper left of his first entry |
| `offSheet` | 16 | drawn outside the canvas, so no ellipsis warns him |
| `namesTouch` | 9 | two productions reading as one title |
| `nameCut` | 9 | a name cut that wrapping could have saved |
| `overName` | 1 | his writing over a run's name |
| `collide` / `bandsOverlap` | 0 | |
| | **361** | |

`dropped` is the one to fix first and it is worse than the number looks: 6 July 2026 in the
year view **meant 9, wrote 1, counted none**. 10 February 2026 in the MONTH view has four
timed events, writes one, shows no count — *Kino*, *Tannlege* and *Innspilling* simply are
not there. This is the class of fault Alan found by eye in his May side-by-side; it is not
confined to the year view, and no invented fixture had ever produced it.

Order of work from here: `dropped`, then `infoLost` (his 17.09 correction — the clipped
events must move LEFT so the info cell has room), then the stop count (spec section E),
then re-apply the alignment work from the `alignment-work` branch one rule at a time.

## Waiting on Alan

| | |
|---|---|
| Flight importer | Both Gmail addresses, and yes/no to the calendar name `Flights`. Nothing can be built without them. |
| Sharing model | (a) or (b) for the colleagues'/family URLs. |
| Week separation | Two CSS samples to be shown; Alan picks. |
| Beijing | The PNR from Lee-Yuan (not code). |
| Week numbers in the year view | Drop them, to fit twelve months on a 1440 desk without scrolling? Costs the week number, buys 26px a month. |
| Short forms | The production -> abbreviation list, plus role words (costume, set...), for the wall-calendar titles. |

## Open

| sak | stand |
|---|---|
| **January blank** until the year's first flight | **Confirmed in code.** `gcal.js:263` loads from `year-01-01` only; no prior-year fetch, so the city pin has nothing to carry in. |
| **Pencilled `P` events** | Decided 03.09, **nothing built** — `gcal.js` never requests the `description` field, so no code can read the marker. Per-event colours and a separate calendar were tried and rejected; don't revisit. |
| Drop "uke" on ordinary Mondays | Open; `app.js:18` still renders `uke`. |
| L1 day line / L2 A+ / L4 wg items in-band | None in the code. Previews first. |
| L3 header menu | **DONE — shipped 02.09.2026.** The `⋯` menu is in `app.js:1074`, closing on pick and on tap-away. (Corrected 12.09.2026; the first draft of this status wrongly said it was unbuilt.) |
| Kalendere dropdown clipped on phone | Reported 02.09, unverified by reading. |
| PARKED after aborted previews | June left-space; timezone auto-translate. Discuss before building. |

## Done — don't redo

Blocked popup on Safari/iOS is **fixed**: `CAN_SILENT` is false there (`gcal.js:37`). Also done: boot dead-ends; flight-leg parsing (booking refs, country+city, one-legged, connecting journeys); `→ Roma` markers with `tbc`; cc'd `fromGmail` flights never move the pin; full IATA table; cache busting; sheet and ANTIGONE 2027 imported; the three-calendar split.

**`README.md` contradicts the code:** its "Not done yet" list says deploy to a real URL and add a PWA manifest + service worker. Both are done.

## Header, to do with the week view (Alan, 12.09.2026)

He finds the top bar cluttered. Two specific things:

- **The month name is said twice** on the phone — once in the header ("Februar
  2026") and again at the top of the month block ("FEBRUAR 2026"). The block's
  own title is the one that belongs to the paper, so the header's should go on
  narrow screens. Easy, and safe.
- **The ‹ › buttons are tiny and awkward**, and he says you do not need them
  when you can swipe. TRUE IN MONTH VIEW ONLY: the swipe handler returns early
  unless `state.view === 'month'`, so year view has no other way to change year.
  Removing them outright would strand that view. Either give year view a swipe
  first and then hide them on touch, or keep them and make them a proper size.

DO THIS WITH THE WEEK VIEW, not before. The header gains a view button when
week and day arrive, so tidying it now means tidying it twice.

