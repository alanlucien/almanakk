# Almanakk — changelog

One entry per change that reached a real address. Newest first. The build number is
what the app shows at the foot of Kalendere ("bygg …"); the commit is what to redeploy
to get exactly that version back (`git checkout <commit>` then `python3 publiser.py`).
Cloudflare also keeps every deployment of v2 with a one-click **Rollback** in the dashboard.


## 09.10.2026 — LIVE: bygg 20261009f
- Pencilled is a "?" ending the title; the Blyant tick writes and clears it, and saving
  drops an old P line from the notes. Old P notes still read as pencilled.
- Eight event colours that stand apart: red, orange, yellow, green, petrol, blue,
  violet, pink, each in Google's slot of that hue.
- TO UNDO: Cloudflare → almanakk-v2 → Deployments → Rollback to aac3849e (20261009e).

## 09.10.2026 — LIVE: bygg 20261009e
- A note beginning with a capital P keeps it ("Paris…" showed as "aris…", and
  Endre would have saved it without): only a P alone on its line is the pencil mark.
- A tap on the day sheet's top (the handle and the date line) closes it.
- TO UNDO: Cloudflare → almanakk-v2 → Deployments → Rollback to 093a0fdf (20261009d).

## 09.10.2026 — LIVE: bygg 20261009d
- The phone's year is twelve small months again: tours tinted, shows marked, today
  framed; a tap on a day opens its month with that day.
- A vertical drag steps the year in the month and the year; sideways swipes are the
  app's, not the browser's.
- Writing in the day sheet takes the whole sheet and holds it still above the keyboard.
- Mail links in notes read only "✉ Åpne e-posten", including Gmail and HTML links.
- TO UNDO: Cloudflare → almanakk-v2 → Deployments → Rollback to 0a0b8b3f (20261009a).

## 09.10.2026 — LIVE: bygg 20261009a, and TestFlight build 4
- The day sheet rises above the iPhone keyboard. A tap on an event opens it to read
  (from–to, place, notes, repeat, guests, calendar); Endre opens the form. Links in
  notes are live, Apple Mail's own as "✉ Åpne e-posten". In the week, a span that
  starts mid-week is dotted from its name to its first day, solid only on its own days.
- TestFlight build 4 (iPhone and Mac): the week widget in 12/14pt.
- TO UNDO: Cloudflare → almanakk-v2 → Deployments → Rollback to 67397cd0 (20261008h).

## 08.10.2026 — LIVE: bygg 20261008h
- Production takes the day's preview work: one-stroke month rules, the first entry
  always standing, the widget-like header and day sheet, I DAG, the title as the
  month/week toggle (⇄), the day sheet that pulls up to full height and follows the
  finger down, Skjema working, the week's rules hanging from their names, the year's
  peek opening its day, no edge taps on the phone.
- TO UNDO: Cloudflare dashboard → almanakk-v2 → Deployments → Rollback to 2bc9d4b6
  (20261008c).

## 08.10.2026 — Alan's phone list (bygg 20261008d, PREVIEW lane)
- The month's rules are one stroke, from the middle of the first day to the middle of
  the last; a day's first entry always stands; the header names the month like the widget.
- The day's number opens its week; I DAG in the header; edge taps gone on the phone.
- The day sheet takes half the screen, written like the Dag widget, in full ink, with a
  visible blank line to write on; swipe down from its top to close.
- The week's rules hang from their names; the year's peek opens its day.
- TO SEE: https://preview.almanakk-v2.pages.dev/v3/ in Safari. Production unchanged.

## 08.10.2026 — LIVE: v3 is production (bygg 20261008c)
- https://almanakk-v2.pages.dev/ and /v2/ now open v3: the redesigned month, the year
  poster and six over six, the week, the day sheet with editing, the widgets' snapshot,
  the quiet phone look, his eight wg colours.
- The iPhone and Mac app (TestFlight build 3) open production instead of the preview lane.
- TO UNDO: Cloudflare dashboard → almanakk-v2 → Deployments → Rollback to 20260923c,
  or in `publiser.py` set `_redirects` back to `/  /v2/  302` and run `python3 publiser.py`.

## 07.10.2026 — v3, step 1: the month and the quarter (bygg 20261007a, PREVIEW lane, /v3/)
- bygg 20261008b/c (08.10, PREVIEW): the quiet phone look — sheets inset on the desk,
  lighter type, the month's show dots gone, the day sheet without an add line at rest
  (tap its head or the day again to write, swipe down to close); the new web icon; his
  eight wg colours for events. TestFlight build 2: icon E and the grey top.
- bygg 20261008a (08.10): the page now actually sends the widgets their snapshot;
  the code had not been deployed, so the TestFlight widgets were blank.
- A new renderer in `v3/`, built from `Front/REDESIGN — 06.10.md`: his line flush
  left, whole entries then +n; his spans as thin gutter rules; the tour as a column
  on the right with the robot's words; text in ink and red only.
- wg | Schedule never reaches the month. Tap a day for the sheet: full list, delete
  with undo, quick-add. No editing yet (step 3).
- Same day, step 2: the year as the planner poster on the phone and six over six on
  the desk; the week as the schedule page (tour word and city per day, the schedule's
  calls with a dot, the moon's turns); tap "uke N" to open a week, the title to climb.
- bygg 20261007b: on the phone the week's seven days share the screen like a diary
  page; a quiet week no longer leaves the bottom blank.
- bygg 20261007c, step 3: tap a line in the day sheet and it opens as the form —
  title, clocks or Heldags, dates, place with a map link, notes, Blyant, Reise, the
  calendar; Lagre with Angre, Slett with Angre; Skjema opens the form for a new event.
- bygg 20261007d: the sheet opens quiet (+ Ny unfolds the add line); the form gains
  Gjentas, Varsel, Tidssone, Gjester and eleven event colours drawn in the almanac's
  dusty palette; a tap on the poster peeks at the day; swipe in the sheet steps a day;
  the year figure opens the year. gcal.js carries repeat, reminders and guests.
- 08.10: three widgets — Dag, Uke, Måned — each drawn as the sheet; the iPhone app
  uploaded to TestFlight (build 1.0 (1)) under the App Store Connect record Alan made.
- The widget (native, `native/Widget/`): small, medium and lock-screen, fed by a
  snapshot the page posts to the app after every sync; the wrapper now opens /v3/
  on the preview lane. Built for the iPhone simulator and the Mac. Not deployed
  anywhere: it reaches his phone through Xcode.
- bygg 20261007e: 3px of paper between parallel gutter rules, so two projects from
  the same calendar no longer fuse into one stroke (Alan asked; I agreed).
- https://preview.almanakk-v2.pages.dev/v3/ (same login). v2 and production untouched.
  TO UNDO on preview: `git checkout 69ed6ab` then `python3 publiser.py --preview`.

## 05.10.2026 — one touring calendar (bygg 20261005a, PREVIEW lane only)
- Tours are read from the robot's `wg | TOURING` calendar whenever it exists; the
  calendars that used to be tagged as tours are untagged and hidden once, with a toast,
  and are one tick away in Kalendere.
- Every word of the tour's day — Travel, Get in, Work day, Performance 3 — is written
  INSIDE the leg's band, performances red, the rest in the band's ink. Nothing of the
  tour's stands on the day line. A word on a row where the band writes its own name is
  let go; a performance on such a row keeps the line.
- A `HOLD …` span reads dashed and italic, like a tbc tour.
- Not in production. To see it: https://preview.almanakk-v2.pages.dev/v2/ (same login).
  TO UNDO on preview: `git checkout ec44786` then `python3 publiser.py --preview`.
- Beside it, not a web change: `native/` holds the first iPhone + Mac build (stage A).

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
