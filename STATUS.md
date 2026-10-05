# STATUS — where Almanakk stands

Updated 05.10.2026. Updated in place — one file, never a dated copy. **Read this first.** `CLAUDE.md` and the notes in `Front/` are working notes, not the state.

A Norwegian wall-calendar view on Google Calendar. **Live** at https://alanlucien.github.io/almanakk/, installed as a PWA. v2 is live at https://almanakk-v2.pages.dev/, build `20260922b` (Alan read the build line 23.09).

## ⚠️ It writes to the live calendar with no confirmation step

Verified 12.09: quick-add `POST`s the moment you press enter (`gcal.js:353`), and the day panel's Slett `DELETE`s immediately (`gcal.js:420`). There is no `confirm()` anywhere in `app.js` — the only net is the undo toast, which `PATCH`es the event back to `confirmed` (`gcal.js:384`).

## 05.10.2026 — ONE TOURING CALENDAR, and the first native build

Alan, 05.10: *"It is time to make this into an iPhone app and a Mac desktop app. wg tours
now will be read from one calendar, and it will not include schedule (schedule is in a
separate Google calendar), so in month view we only have the tour banner, with travel /
get in inside the band. Much less noise."*

### The touring calendar (v2, bygg `20261005a`, on the PREVIEW lane — not production)

The company robot now writes **`wg | TOURING`** (spec: `…/winter guests/Calendar entry
app/SPEC — touring calendar app 04.10.md`): one all-day span per leg (`ANTIGONE Rome`,
` tbc` until confirmed), one all-day word per day from a list of eight (Travel · Get in ·
Work day · Performance n · Day off · Travel day Tech · Travel day Performers · Get in –
tech only), city in Location, and `HOLD Available · ANTIGONE` / `HOLD Festival · <name>`
spans for dates held. Read-only for everyone. The call sheets go to `wg | Schedule`
(the renamed Still Life calendar); `wg | ANTIGONE` retires.

What the almanac does with it (`v2/app.js`, `gcal.js`, `v2/style.css`, `demo-data.js`):
- **The calendar named TOURING is the tour calendar whenever it exists**, whatever was
  ticked in Kalendere; the robot's `wg | TOURING (test)` twin never is. Without it the
  ticks decide, as before. `tourCalIds`, `app.js:212`.
- **Once, when it is first seen** (`adoptTouringCalendar`, called from `gcal.js` after
  the calendar list arrives and before any event is fetched): the calendars that used
  to be tagged as tours are untagged **and hidden**, the test twin with them, the wg
  button is switched on, and a toast names what was hidden. Each is one tick away in
  Kalendere. Keyed per robot calendar id in localStorage, so it never runs twice.
- **Every word of the tour's day is written inside the leg's band** — performances
  red (`Antigone 3`, the run lending its name as before), everything else italic in
  the band's own ink (`.bshow.bword`). Nothing of the tour's stands on his line any
  more. A flight in a tour calendar is still a move and still stands on the line (the
  14.09 Helsinki rule).
- The word is matched to **its own run** first (innermost span of the same calendar,
  `runOf`), then to any band of the same calendar — two legs can share a Travel day.
- **On a row where the band writes its own name** (the first day, the 14-day beat, the
  1st of a month) an ordinary word is let go: the name is on the row, and the week and
  day views still say Travel. A performance on such a row keeps the day line, red, as
  before — a show is never dropped. Decision mine, 05.10; say if the word should be
  written after the name instead.
- **A HOLD reads as tentative**: dashed band, italic name, like a `tbc` tour
  (`isTbc`). A hold is never "the run" a performance borrows its name from.
- Week and day views are untouched.

Verified in the browser on demo data shaped like the robot's leg (February: Travel,
Get in, Work day, Performance 1-2, Travel, plus a HOLD): the words sit in the band, the
line is clear of them. Not yet seen on Alan's real calendar: the Cloudflare lane needs
his login. **Pre-existing, seen while checking:** at phone width a two-word name on a
MONDAY label row is cut ("ANTIGONE Pa…") because the band is narrowed for "uke 7" on
that row only; the continuation rows are full width. Not from this change.

### The native app — `native/`, stage A of "Three surfaces", BUILT 05.10

`native/Almanakk.xcodeproj` (hand-written pbxproj, like Wallet Pass; no xcodegen on
this Mac): ONE target, `SUPPORTED_PLATFORMS = iphoneos iphonesimulator macosx`, so the
same code is the iPhone app and the Mac app — no Catalyst. Bundle id
`com.winterguests.almanakk`, team `BAV75G9G6M` (the OU on his Apple Development
certificate; the same team Wallet Pass signs with), iOS 17 / macOS 14 and up. Two
Swift files: the window, and a `WKWebView` on `https://almanakk-v2.pages.dev/v2/` with a
Safari user-agent (Google refuses sign-in from anything it recognises as an embedded
view), outside links handed to the real browser, and a retry card when there is no
connection. Mac: sandboxed with network, opens at 1280×860 (the year wants ~1180), ⌘R
reloads. Icon rendered from `icon.svg` (QuickLook; ImageMagick's own SVG pass drew a
flat square) — full bleed for iOS, Apple's 824-on-1024 rounded grid for the Mac.

**Built and run 05.10:** `xcodebuild` succeeds for the iPhone 17 Pro simulator and for
macOS; the simulator shows the Cloudflare Access login inside the app (screenshot
taken); the Mac app launches and stays up (its window could not be captured — the
terminal has no screen-recording permission). Nobody has signed in through it yet:
that is Alan's email code, which only he can enter. Steps for him in `native/README.md`.

**Not done, in order:** TestFlight (so the phone build does not lapse after 7 days);
stage B (bundled assets, native sign-in, Keychain, App Group); the widget; the native
day view. Nothing of stage A is thrown away by B except the `WKWebView` itself.

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

## 22.09.2026 — LIVE as `20260922b`: six things, none of them the alignment

Built on top of `20260917m2`, not on the rolled-back alignment work.

**`46595fb` — five he asked for.** In the year, one tap opens the month and two open the
WEEK under the thumb, both read off the same touched date. The app opens on the year with
today in view — one scroll, once, and only when today is off the glass. A day remembers
the sheet that opened it and returns there instead of climbing one fixed level. The
vertical swipe only steps the year where there is nothing left to scroll (90px now, and
twice as vertical as sideways), so a dense week scrolls. And **Lagre under the keyboard,
fixed at the root on the third attempt**: `scrollIntoView` aligns to the LAYOUT viewport,
which iOS does not shrink for the keyboard, so the browser hid the row and called it
visible; the paper below the form was a fixed 96px, so with the form at the foot of the
sheet there was nowhere to scroll TO. The band now grows by the keyboard's own height and
the scroll is measured against `visualViewport`.

**`fcda383` — the first paint is his calendar, not empty paper.** Alan, 22.09: *"perhaps
page can buffer in browser for offline, so it does not seem to take so long to load."* The
files were never the wait — the service worker has cached those since August. The wait is
Google. The last sync was already in localStorage and every event carries its colour, so
the whole sheet is drawn from it in the frame the page appears and replaced when Google
answers. No banner on that path; `showCached`'s banner stays for the real failure case, or
it cries wolf. **And the sample February stops flashing past:** `loadDemo()` ran on every
load whatever the mode, drawing fictional shows and flights into a signed-in almanac until
Google answered — and its own side effect ("state.events is empty" was never true) is what
hid the first attempt at the cached paint.

**Not pushed to GitHub.** `main` is 2 commits ahead of `origin/main`. Production is
Cloudflare and unaffected, but GitHub has no copy of either commit, and
github.io/almanakk/v2/ is a build behind.

## NEXT: the row rewrite, in v2, on the preview lane (handed over 12.09)

Alan uses production v2 daily. Build in `v2/app.js` + `v2/style.css` only; deploy with
`python3 publiser.py --preview` → https://preview.almanakk-v2.pages.dev/v2/ (same login).
Show pictures of month, year, print and phone strip before any production deploy.
Spec: `Front/NOTES-calendar.md` → "The day row is one dynamic space" and the preview result
below it; branch `preview-flow-line` shows why a CSS grid cannot do it. Keep it short in chat.

## The year view — BUILT 17.09.2026, live; the alignment pass beside it was ROLLED BACK

**Read this before the spec below.** `20260917r` was live for part of 17.09 and is not
live now. Alan: *"go back to my build from this morning so that's something for me to work
on, while you keep going in the background."* r's faults were things COLLIDING, which he
cannot work with; the morning's were "doesn't use the space it could", which he can. So
`v2/app.js` and `v2/style.css` went back to `c58be5e` — the six-over-six year, and the
alignment as it stood before "a word is a wall" — shipped as **`20260917m2`** (`6d1067f`),
keeping only the `?month=`/`?year=` test parameters. **The whole alignment pass is on the
branch `alignment-work`**, to be re-applied ONE RULE AT A TIME against a sweep that runs on
HIS data rather than on invented fixtures. Everything from here to the end of the spec is
therefore a BRIEF, not a description of what is on his phone.

The six-over-six year view itself survived the rollback and is live.

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

## THREE SURFACES, ONE ALMANAC — decided 23.09.2026

Alan joined the Apple Developer Program and asked for **"web app and ios app / mac app."**
Nothing is built. This section is the shape of it, written so the first decision can be
made before any Xcode project exists.

### The destination, fixed by Alan 23.09: **"short term hybrid, long term full app."**
So the web view is scaffolding, not the answer. That changes two things from the first
draft of this section, and both matter more than the Xcode steps:

**1. The written rules become load-bearing.** The renderer is a year of decisions — the
stops, the bands, the alignment, the flight parsing, the typography — and almost all of
it lives in CSS and in layout measurement. As long as wrapping was the destination, the
code could stay the only place those decisions existed. It cannot now. A native renderer
has to be built from the RULES, not from the CSS, so the alignment spec Alan dictated on
17.09 stops being a brief for fixing this app and becomes the specification the Swift one
is built against. **Every layout decision from here is written down in prose as well as
in code**, and `_sweep.js`'s checks are the acceptance tests the native views must also
pass. That is the cheapest thing that can be done today to make the long path affordable.

**2. Stage B stops being a cost and becomes the first half of the native app.** Bundled
assets, native Google sign-in, the token in the Keychain, the App Group snapshot — none
of that is web scaffolding. A full SwiftUI app needs every piece of it unchanged. The
only thing eventually thrown away is the `WKWebView` itself. So B is worth reaching
quickly rather than living on A.

**The renderer then migrates ONE VIEW AT A TIME, and in this order**, because each view is
its own screen and can be native while the others are still web:
day → week → month → quarter → year. The day view carries almost no layout logic and is
the right place to learn; the quarter and the year carry all of it and go last, by which
time the rules have been written down and tested twice.

The one thing that genuinely cannot be wrapped is a **widget**. WidgetKit draws SwiftUI
and nothing else — a widget can never be a web view. That is true on iOS and on macOS.
So the widget is native, small, and fed by the app rather than sharing its renderer.

### The fork that decides everything downstream
**A — the wrapper points at the live URL.** A WKWebView on
`https://almanakk-v2.pages.dev/v2/`. Perhaps thirty lines of Swift, works on both
platforms, and he has an icon and no Safari chrome the same day.
*Costs:* the Cloudflare Access login happens inside the web view on first run and again
when the 730h session lapses; an opening with no signal shows nothing; and there is no
route to widget data without doing B anyway.

**B — the web assets ship inside the app, and sign-in is native.** `app.js`, `style.css`,
`gcal.js`, `airports.js` are bundled, so it opens instantly and offline with no Access
prompt. Google sign-in goes through `ASWebAuthenticationSession`, the refresh token
lives in the **Keychain**, and an **App Group** shares it with the widget. The Pages
Function and the plain web app at the same URL are untouched, so the desk browser
carries on exactly as now.
*Costs:* real work, and the OAuth client needs an iOS/macOS entry beside the web one.

**A first, then B, and do not linger on A.** A exists only to prove the pipeline — a
bundle id, a provisioning profile, TestFlight, the icon on his devices — which Alan has
never done before and should do once with the simplest possible app rather than while
also debugging OAuth. B is where the real work starts, and none of B is wasted: it is
the native app's foundation, built early.

### What the widget can honestly show
Not the wall calendar — a small widget has no room for the sheet, and enlarging the type
until it fits is the one thing this app has never done. Realistically: today's date, the
city, the week number, a red mark when the day holds a show, and the next two or three
entries. Which of those, and in what order, is a picture conversation like every other
layout question here. Sizes: small/medium/large on the iOS home screen, the lock-screen
accessory, and the macOS desktop widget — one WidgetKit target serves all of them.
It is fed by a small JSON snapshot the app writes to the App Group after each sync,
NOT by the widget fetching Google itself.

### What macOS specifically wants
The Mac is where the QUARTER and the YEAR live — the desk sheets. So the window has a
minimum useful width (the year is six-over-six and wants ~1180) and the app should open
on the quarter, as the browser now does. Mac Catalyst is the cheap path from one target;
a separate macOS target sharing the web-view code is the tidy one. **Printing finally
gets an honest answer here**: the system print dialog owns the paper size and the
orientation, which is the open question in the print section above.

### Ops burden, and it is real
Bundle identifiers, provisioning profiles, App Store Connect, TestFlight, review. Alan is
not a professional developer (see Constraints), so this is done ONE STEP AT A TIME, each
one explained, and nothing is begun until the step before it is working on his device.

### Waiting on Alan before anything is built
1. ~~A first, or straight to B?~~ **Answered 23.09: hybrid now, full app later.**
   So A, briefly, then B.
2. ~~A bundle identifier and an app name.~~ **Built 05.10 as `com.winterguests.almanakk`,
   "Almanakk"** — say if either should change before TestFlight.
3. **What the widget says**, from pictures, once there is a wrapper to hang it on.

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
| L1 day line / L2 A+ | None in the code. Previews first. |
| L4 wg items in-band | **DONE 05.10** for the robot's calendar: every day word is written in the band; see the 05.10 section. |
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

