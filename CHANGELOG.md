# Almanakk — changelog

One entry per change that reached a real address. Newest first. The build number is
what the app shows at the foot of Kalendere ("bygg …"); the commit is what to redeploy
to get exactly that version back (`git checkout <commit>` then `python3 publiser.py`).
Cloudflare also keeps every deployment of v2 with a one-click **Rollback** in the dashboard.

## 23.09.2026 — the 20.09 feedback batch (bygg 20260923c)
- The desk opens on the QUARTER it is in, not the year. The phone is unchanged.
  `2b539a0`
- The week header names every city the week passed through: "Oslo / Beijing /
  Paris", where it used to read only the first and the last.
- The month stands at the size the day sheet writes ONSDAG, with a clear space
  after the week number so "UKE 39 SEPTEMBER" cannot read as "39 September".
- A performance turns the day red in the week view — figure and weekday both,
  the same treatment a Sunday takes. `53d2e9a`
- Brackets are cut from titles in the month and year views. A performance's
  bracketed number is untouched: it is read before this runs, so
  "Performance 1 (13)" still becomes "Antigone 13".
- HELDAGS: a switch that converts a timed event back to an all-day one. The
  conversion always worked; there was no way to reach it, because iOS's time
  wheel cannot be emptied.
- The same performance now reads the same way wherever it stands. On the head
  line it printed the raw title while the lines below it were compacted, so
  2 October said "Performance 2 (15)" and 3 October "Antigone 16". `214cae6`
- TO UNDO: Cloudflare dashboard → almanakk-v2 → Deployments → Rollback, or
  `git checkout fcda383` then `python3 publiser.py` for 20260922b.

## 22.09.2026 — LIVE: the sheet is drawn from the last sync (bygg 20260922b)
- The page opens on his calendar instead of empty paper. The last sync is drawn in
  the frame the page appears and replaced when Google answers; no banner, because
  that one is for the real failure. `fcda383`
- The sample February no longer flashes past on a signed-in load. `loadDemo()` ran
  on every load whatever the mode; it now runs only where sample data is the point.
- Year view: one tap opens the month, two open the week under the thumb.
- Opens on the year with today in view. A day returns to the sheet that opened it.
- The vertical swipe only steps the year where there is nothing left to scroll, so
  a dense week scrolls. `46595fb`
- Lagre stands clear of the keyboard, measured against `visualViewport`. Third
  attempt, first one at the root.
- TO UNDO: Cloudflare dashboard → almanakk-v2 → Deployments → Rollback, or
  `git checkout 6d1067f` then `python3 publiser.py` for 20260917m2.

## 17.09.2026 — LIVE: twelve month sheets, six over six (bygg 20260917m2)
- The year is twelve real month sheets in two rows of six, not thumbnails and not a
  scrolling strip. A strip needed a 1674px window; six over six gives each sheet
  231px instead of 132. `c58be5e`
- A view in the URL (`?month=`, `?year=`), so a build can be checked on both.
- ROLLED BACK THE SAME DAY: `20260917r` carried a day of alignment work — "a word is
  a wall", the spill, the run's single column — and collapsed multi-day events into
  each other on a packed February. Alan: "go back to my build from this morning."
  `app.js` and `style.css` were restored to `c58be5e` and shipped as m2 (`6d1067f`).
  The alignment pass is on the branch `alignment-work`, unmerged, to be re-applied
  one rule at a time. Do not redeploy `710c35c`.
- TO UNDO: `git checkout 1f0cadf` then `python3 publiser.py` for 13.09.

## 13.09.2026 — LIVE: black and white paper, week and day views (bygg 20260913n)
- The paper is black and white. Sundays and holidays grey, a heavy rule closing
  each week, print frames round the blocks. Brown is gone. `e3b2f4e`
- WEEK view: the diary spread, one line per event, a run's name on the day it
  starts and a line down the margin to where it ends.
- DAY view: an event opens in its day. Title, time, dates, location and notes,
  the calendar it lives in, delete beside save, and a Google Maps link.
- Header is the month centred, the year right, and one ellipsis menu.
- Gestures: one tap opens a level, two taps close it. Two taps on an event in
  the month open it for editing. Swipe steps sideways in every view.
- The phone's year view is twelve month thumbnails.
- The back button goes back a view instead of leaving the app.
- TO UNDO: Cloudflare dashboard → almanakk-v2 → Deployments → Rollback, or
  `git checkout 1f0cadf` then `python3 publiser.py` for yesterday's build.

## 12.09.2026 — LIVE: the day line reads as time, and bands overlap (bygg 20260912ad)
- Morning at the left, afternoon at a midday column, evening at a column of its own.
  On by default; `?kveld=0` gives the plain left-aligned line back. `1f0cadf`
- Bands overlap in a staircase: each is as wide as its own title, starts a strip
  further right, and must end further right, so none can be swallowed.
- A repeat band label moves up a day rather than be painted over; a start label never moves.
- A band's first day is marked by a 1px rule in its own ink, on the row's line.
- A band hairline falls between letters: only the crossed word moves, never the line.
- A day with no city lends that cell to its line.
- A Monday flight keeps the week's number: "Oslo → Bangkok 9".
- A travel day Mon–Thu silences that week's Tuesday city.
- Fixed: a clock in a show title read as the performance number ("19:00 Forestilling" → "00 19").

## 12.09.2026 — evening variant, on the preview only behind ?kveld=1
- A day with ONE event timed 18:00 or later sits flush right instead of left.
  Alan's time-axis idea, reduced to the part that can tell the truth: the right
  edge is fixed, so it says "evening" without pretending to say a clock time.
  Off by default. Compare: .../v2/ against .../v2/?kveld=1
- Fixed on the way: a clock in a show's title was read as the performance number,
  so "19:00 Forestilling" rendered as "00 19".

## 12.09.2026 — the day line holds one left edge (preview only, bygg 20260912b)
- A band's hairline now falls between letters. Only the **one word** the line runs
  through moves, up to 6px right or 2.5px left; the line's left edge never moves.
  The first attempt shifted whole rows and Alan caught it at once. `caa53ea`
- The long "Oslo → Bangkok" reading gives way to the arrow form where a band label
  already fills that space, instead of printing over it. `caa53ea`
- `?demo=1` opens the sample month with no sign-in — for the iPhone and iPad simulators.
- **Preview only**: https://preview.almanakk-v2.pages.dev/v2/ . Production is unchanged.

## 12.09.2026 — v2 lives on Cloudflare, signs in once a month
- v2 deployed to https://almanakk-v2.pages.dev/v2/ behind Cloudflare Access (Alan only).
- Google's key is held on the server; no sign-in button, no hourly Google nag. `a1fc043`
- v2 also exists at github.io/almanakk/v2/ with the old browser sign-in — to be retired.

## 12.09.2026 — v2 started beside v1
- `v2/` shares v1's engine (sign-in, loading, flight parsing); only the look forks. `14662a3`

## 02.09.2026 — a full day of fixes to v1, all live at bygg 20260912
- Header on one row; three view glyphs; Byer button removed.
- Quick-add can no longer double-book; calendar toggles can no longer duplicate events.
- Planned moves save as "→ Oslo"; tap a day's corner to plan one; a booking clears it.
- Events read in their own time zone (Japan was showing Oslo time); small-hours flights sit on the night before.
- Band labels only break when they truly don't fit; connecting flights read as one journey.
- Work all-day events left, private right; the plan calendar merged back into wg | ALAN.
