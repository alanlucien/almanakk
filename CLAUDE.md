# Almanakk — Norwegian wall-calendar view on Google Calendar

## What this is

A single-page web app that renders Google Calendar in the style of a classic
Norwegian cardboard wall calendar (almanakk): months as vertical blocks of
rows, one row per day. Google Calendar is the single source of truth; this app
is a view and input surface on top of it. Other people subscribe to the
underlying Google Calendars normally.

Built for Alan (alan@winterguests.com), replacing a hand-maintained Google
Sheet: https://docs.google.com/spreadsheets/d/10xgq0RwBS0h8ZCl8EaCe_eRTX5yX3gUSU4jUq5JgeG4
The sheet is the layout reference and the initial data to import.

## Architecture (Option A — decided)

- Static single-page app, no backend server. Plain HTML/CSS/JS unless a real
  need for a framework appears.
- Hosted as static files (GitHub Pages / Cloudflare Pages).
- Google sign-in via Google Identity Services (token client); read/write
  events with the Google Calendar REST API directly from the browser.
- OAuth credentials from a personal Google Cloud project; app stays in
  "testing" with named test users — no verification process needed.
- PWA (manifest + service worker) so the phone strip view installs to the
  iPhone home screen.

## The three views (same data, same DOM where possible)

1. **Year/wall view** — 3+ months side by side, like the sheet. Per day-row:
   day number | weekday letter | event columns | uke/holiday column.
2. **Phone strip** — one month, days as rows top to bottom, sized to fit one
   iPhone screen. Swipe/arrow to adjacent months.
3. **Print view** — `@media print` stylesheet producing clean A4 (year or
   quarter per page). Printing is a first-class feature, not an afterthought.

## Domain conventions (Norwegian)

- Weekday letters: M, Ti, O, To, F, L, S (Monday-first weeks).
- Week numbers: ISO 8601 ("uke 41"), shown on MONDAYS in the right column —
  the week starts Monday in a Scandinavian calendar, so the number belongs
  on the Monday (Alan, 2026-08-25; an earlier "Sundays" note here was wrong).
- Sundays and Norwegian public holidays render red. Holiday names in
  Norwegian (Skjærtorsdag, 1. Juledag, 17. mai, advent Sundays...).
- Week numbers, weekday letters, and holidays are computed/derived — never
  stored as events.

## Event model

- Sheet-style entries map to all-day events; multi-day runs (e.g. a show
  season) are single spanning events.
- Layout is by kind, not fixed columns: multi-day spans (projects/tours) get
  vertical lanes on the left, single-day events share ONE detail line on the
  right (joined with " · ", clipped with …), and colour = which Google
  calendar the event lives in. One day = one line, always — the fixed rhythm
  is the point; a dense day looks full but never grows fat.
- Tap a day → panel with the day's full event list (delete per event) and the
  quick-add field: type text, enter → event created. "8-12 tekst" makes a
  span (day 8–12 of that month); a time in the text ("13:00") makes a timed
  event.
- People subscribe per Google calendar (e.g. wg | Alan, private, wg touring).

### Layout rules (each one is an explicit decision by Alan — don't "simplify")

- Day line order: all-day headline first, then shows (red), then timed items.
- Shows ping red: titles matching show/prem*/première/performance*/forest*/
  visning/vorstellung render red (line, panel, band labels), are pinned right
  after the headline so clipping never hides them, and the day number gets a
  red dot when the day holds a show anywhere.
- Band labels repeat on a 14-day beat from the span start (plus the 1st of a
  month when no beat lands in its first week) — not on Mondays.
- Labels prefer sideways: they spill across consecutive empty cells to the
  right, carrying their band tint with them; they wrap word-by-word down the
  band only when boxed in, onto at most half the band's remaining days (max
  3 lines); otherwise clip with ….
- Tour-tagged calendars (user-picked in the Kalendere panel) are an overlay,
  not normal calendars: the wg button shows their multi-day spans as dashed
  bands and their single-day items dimmed at the end of the day line.
- Days with no bands start the detail line at the far left (full width).

## Deployment status (live since 2026-08-23)

- Live at https://alanlucien.github.io/almanakk/ (GitHub Pages, repo
  alanlucien/almanakk, public — never commit personal schedule data).
- OAuth client "Almanakk web" in Google Cloud project ALMANAKK
  (winterguests.com org); consent screen audience: Internal. Authorized
  origins: http://localhost:8123 and https://alanlucien.github.io.
- Local dev: `python3 -m http.server 8123` (see .claude/launch.json).
- DONE: old sheet imported (import.html, tag sheet-2026-2027); ANTIGONE
  2027 PDF imported (?set=antigone); private gmail calendar shared in.
- PARKED (Alan aborted after previews — revisit fresh, with pictures):
  1) June left-space: Alan's line items should flow left into empty lane
     columns; wg items must NEVER move left, anchored right against their
     band. A two-sided-line preview existed and was aborted 2026-08-24;
     discuss again before building anything.
  2) Timezone auto-translate: wg events created from Norway carry Oslo
     times; idea is to display them in the tour city's local time using
     the Cities column knowledge. Editorial workaround: set the event's
     time zone in Google when creating tour events.
- Remaining roadmap: English winter guests version (colleagues' URL);
  automatic flight feed (Flighty/TripIt) + "where is Alan" page for family;
  custom domain (almanakk.winterguests.com); iPhone widget (needs native
  wrapper).

## Feedback backlog (2026-08-24 — Alan: "for later", tackle one by one)

Bugs (fixed 2026-08-24 while Alan slept; B1/B3 need a device re-test):
- B1 DONE, three rounds. (a) the flight index scans all loaded events
  (tour-tagged calendars included); (b) "Fly til Bergen" / "Fly fra Oslo til
  Bergen" parse right; (c) 2026-08-25, from Alan's September screenshot: his
  real titles are "Osl - Beijing" — mixed case, city name, no fly keyword —
  and were invisible, so the pin sat on LONDON all month. flightDest now reads
  dash-separated legs where BOTH sides resolve to a place (3-letter IATA code
  in any case, or a known city name), so "Osl - Beijing", "Beijing - Paris",
  "SK 4103 Oslo - Bergen" all work while "Meet Ellen - afternoon", "Prosjekt
  A - B", "Jury duty" stay non-flights. 20-case test table in the commit.
  Still open: January is blank until the year's first flight (needs prior-year
  loading, do only if it bites); city names outside IATA_CITIES are unknown —
  add codes/names as Alan hits them.
- B2 REGRESSION then fixed (2026-08-25). Alan's live app came up EMPTY with no
  sign-in and no Kalendere button. Two boot paths could dead-end: (1) the
  silent renewal promise never settled if GIS swallowed the request (iOS/ITP),
  freezing bootGoogle with the sign-in button already hidden; (2) if the GIS
  script never loaded, index.html's `window.gcalReady && gcalReady()` guard
  meant NOTHING ever ran — no button, no explanation (this pre-dated B2 and is
  the likelier cause of Alan's screenshot, since his wg/Byer toggles were also
  off, i.e. localStorage had been cleared). Now: silentToken is 8s-bounded and
  settles exactly once; a failed boot always re-shows the sign-in button; a
  poll calls gcalReady whenever GIS turns up (also fixing the script-order
  race) and after 8s falls back to cached events plus a plain-language banner.
  Four boot paths tested in a browser, incl. "GIS accepts the request and never
  calls back". LESSON: never hide the only way in behind an unbounded promise.
- B2 DONE: silent token renewal (prompt:'') on load when the saved token is
  stale, ~5 min before expiry, and once on any 401 before giving up; the
  sign-in button remains the fallback. Verified with a stubbed GIS+API flow
  (expired token -> silent T1 -> 401 -> silent T2 -> retried OK). iOS PWA may
  still refuse the silent path (ITP) — then it degrades to today's behaviour.
- B3 DONE (2026-08-25, second round after Alan's screenshot): the strip month
  is sized to fill the viewport exactly, so the last row sat flush against the
  screen edge — Safari's floating toolbar overlays it, and .day:last-child has
  no bottom border, so a tour band running through the last days bled into the
  edge and read as broken. Now: padding-bottom is
  calc(env(safe-area-inset-bottom) + 12px) (covers the PWA home indicator AND
  Safari's toolbar) and .strip .day:last-child gets a closing rule, so the
  month visibly ends. Verified 30- and 31-day months at 375px and 393px: last
  day fully visible with a 13px gap, nothing scrolls.

- B6 DONE (2026-08-25), the slicing Alan still saw after B5: a band label that
  WRAPS (long title, no room to spill sideways) built a 2-3 line box ~34px tall
  inside a ~21px row. The overflow hangs into the next day, where that day's
  band background can paint over it — Chromium happens to paint the label on
  top, iOS Safari does not, which is why it looked broken on his phone and
  never on mine. Every label now carries max-height:100% (and spill labels are
  centred in the row), so no label can be taller than its own row on any
  browser. A boxed-in long title clips with … instead of wrapping. If Alan
  wants real wrapping back, it must be built so the box aligns to whole rows.
- B5 DONE (2026-08-25): band labels were sliced through the middle of their
  letters on the phone ("PARIS" on Alan's 29 Sept). Cause: the 3px paper seam
  at a band start was a border-top, which pushed the absolutely-positioned
  label DOWN, and with the label's own 1px padding the box outgrew a ~21px
  phone row — so it was clipped by the lane or covered by the next row's band
  background. The seam is now an inset box-shadow (no layout cost) and labels
  use padding 0 3px / line-height 1.3. Measured at 5 viewport sizes: no label
  overflows its row anywhere. Affected ALL short rows, not just month ends.
- B4 DONE (2026-08-25): the Kalendere dropdown ran off the LEFT edge on the
  phone. #cal-list was anchored right:0 to the button, and the wrapped header
  puts that button at the far left. On <=720px the panel now spans the screen
  (left/right 8px, anchored to the header), scrolls at 65vh, and clips long
  calendar names. Verified 375px / 393px / desktop. Pre-existing, not from the
  cities work.

Quick wins (small, want Alan's one-line answers first):
- Q1 Green weekends: classic almanakk. Which: green Saturday numbers, a green
  rule between weeks (under Sunday), or both? Show samples.
- Q2 Undo (Angre) after edit, same as after delete.
- Q3 Day panel: separate all-day events from timed ones (one box, grouped).
- Q4 Flights render as "LON-BGO 17:50" in year/month views (flight-looking
  events keep their time even in compact views).

One design piece — per-event edit sheet (tap an event row in the day panel →
row expands; no more Endre/Slett buttons on every row). Hosts: title edit,
- E1 declutter buttons; E2 change event colour (Google colorId 1–11, palette
  already in gcal.js); E3 move event to another calendar (events.move API);
- E4 extend/convert to multiday or timed↔all-day (PATCH start/end; gotcha:
  must explicitly null dateTime when converting). Delete moves in here too.

Cities cluster:
- C1 FINAL (Alan, 2026-08-25, after seeing it live): Monday is the week
  number's alone — NEVER a city there, even when the city changes that day (it
  then appears on the Tuesday repeat). Cities show on Tuesday and on any
  non-Monday day the city changes. No combined "PARIS 42" form any more. The
  info column narrowed 8.2em -> 6.4em; long city names and long holiday names
  step down a font size instead of clipping or widening; "K. himmelfartsdag"
  -> "Kr. himmelfart" and "n. Søn. i advent" -> "n. advent" (standard almanakk
  abbreviations) so nothing clips in month/year/print-3. print-6 and print-12
  still clip the longest holiday names — PRE-EXISTING at 5pt/3.8pt type.
- Compact titles (Alan, 2026-08-25) — year and month views show the GIST;
  Detaljer and the day panel always keep the full title:
  * a flight reads as its route, "OSL-PAR-HKG" -> "Oslo → Hong Kong" (only
    when 2+ legs resolve to places, so "Fly til Bergen" keeps its title).
    Alan picked NAMES as default (2026-08-25). The Byer button is no longer an
    on/off for the cities column (they are always on now) — it switches the
    reading between names and airport codes ("Marseille → Frankfurt" /
    "MRS → FRA"), in the day line AND the info column, persisted. The day panel
    always spells the city out in full. A city with no known code keeps its
    name in codes mode.
  * a performance reads as production + number: "Antigone performance 2" and
    "second show Antigone" both -> "Antigone 2" (English + Norwegian ordinals);
    if nothing but the keyword remains ("Performance 2") the title is kept.
    13-case test table in the commit.
- C1 DONE (2026-08-25, Alan picked "D+" from previews): the left 6em cities
  column is gone; the city rides in the right info column in tiny caps. It
  shows when it CHANGES, on the 1st of a month, and repeats EVERY WEEK on the
  row below the week number (Tuesday — Alan, 2026-08-25), so the week number
  keeps Monday to itself and you always know where you are; the Tuesday repeat
  is skipped when the city already stood on yesterday's row, so a Monday
  landing never doubles. On a Monday it shares the cell with the
  week number as "PARIS 42" — the word "uke" is dropped when they share, and
  the info column widens (5.2em -> 8.2em) so nothing clips. A holiday keeps the
  cell (the flight itself is on the day line that day). Verified: no clipped
  info cells in month, year, or print-3. Long holiday names still clip in
  print-6/12 — PRE-EXISTING, worse with cities off, unrelated to this.
  Open, only if Alan wants it: drop the word "uke" on ordinary Mondays too
  (currently "uke 43" alone, "PARIS 42" when shared).
- C2 DONE (2026-08-25) and NO new calendar was needed. A manual move is just
  an ordinary event titled "-Roma" (also "->Roma", "→ Roma"), in ANY calendar;
  the day line renders it "→ Roma". The text after the arrow is taken as-is, so
  towns with no airport code work. Add "tbc" ("-Roma tbc") and the move is
  tentative: the city renders ITALIC in the info column and the day panel,
  which is how a planned trip is told apart from a booked flight until a real
  flight feed exists. Override semantics unchanged: pure date order, the latest
  move on/before a day wins whatever the booking order. Guards verified:
  "-8 Antigone" is not a marker (that is the span syntax) and a bare "-" isn't.
- Flight titles that name a country plus a city (Alan's "11:15 Flight Oslo →
  Germany (Wuppertal trip)"): when the dash/arrow legs don't both resolve, the
  parser falls back to any places named ANYWHERE in the title, including inside
  brackets — but ONLY when the title says fly/flight, so "Middag med
  Oslo-venner" still moves nothing. Reads "Oslo → Wuppertal".
- EXTRA_PLACES in app.js lists towns with no airport code (Wuppertal, Mainz,
  Lillehammer...). Add to it as Alan hits places the calendar doesn't know.
- airports.js (2026-08-25) holds the FULL IATA table — 7743 codes -> city, from
  the open mwgg/Airports dataset, ~140KB (gzips to ~45KB), cached by the service
  worker. It is a FALLBACK only: the curated IATA_CITIES in app.js always wins,
  so Norwegian spellings survive (Tromsø not Tromso, Ålesund not Alesund). It
  matches CODES ONLY and only when written in capitals, so a three-letter word
  in an ordinary title can never become a destination. ALIASES maps English
  spellings to the calendar's ("Copenhagen" -> "København"), because airline
  mail and Alan's own titles disagree. EXONYM_EN (2026-08-25) makes the DISPLAY
  follow the language button: Roma/Rome, København/Copenhagen, Venezia/Venice,
  Wien/Vienna, München/Munich... Ålesund and Tromsø are deliberately NOT in it
  — they are the same word in both languages (Alan). Either spelling always
  resolves in a title, whichever language is showing. Regenerate: curl the dataset, keep
  entries with a 3-letter IATA and a city, strip "(...)" suffixes.
- A one-legged flight also reads as a move: "19:35 Flight to Copenhagen
  (SK 2869)" -> "→ København" in month/year views (full title in Detaljer and
  the day panel, as always).
- C3 Flight email ingestion, Alan's flights only. Options: (1) Google's own
  Gmail→Calendar events (maybe already on; zero new parts); (2) TripIt —
  forward bookings to plans@tripit.com, subscribe to its iCal feed as a
  calendar; (3) Flighty calendar feed (paid, best data); (4) DIY Apps Script.
  Option 1 REJECTED by Alan (2026-08-25) and the reason is decisive: he books
  flights for the company and is cc'd on itineraries, so Gmail scrapes OTHER
  people's flights into his calendar — the city pin would lie. Since May 2024
  the Calendar API marks these with eventType 'fromGmail', so the app now
  stores that flag and buildFlightIndex skips them (verified: a cc'd "Flight
  to Berlin" no longer moves the city). They still render as events; they just
  never move the pin.
  TripIt/Flighty REJECTED too (Alan, 2026-08-25) and the reason is again
  decisive: both are curated, i.e. they need him to forward or add the flight,
  and "I don't always read the mails before travelling" — so the flight would
  be missing exactly when it matters. An automatic source is therefore the only
  one that fits how he works.

  PARKED, ready to build: a GOOGLE APPS SCRIPT flight importer.
  - Runs on Google's servers inside Alan's own account (script.google.com), on
    a time trigger (~every 15 min). Nothing installed, nothing on his devices.
  - Two Gmail accounts: Apps Script runs as ONE account, so either run a copy
    in each (both writing to the same calendar, shared with "make changes"), or
    auto-forward airline mail from the second account to the first.
  - Writes to its own "Flights" calendar, so it stays separable in Kalendere
    and can be told apart from Alan's own typed events.
  - THE HARD PART is "mine only": Alan books for the company and is cc'd on
    itineraries, so his name appearing is NOT sufficient. Rules: his name must
    be in the passenger block; skip where he is only in cc; skip multi-passenger
    itineraries that don't list him; when unsure, do nothing rather than guess.
  - MUST be idempotent: label each processed Gmail message (or record the PNR
    on the event) and never reprocess. That is what makes a deleted event stay
    deleted — a naive script would resurrect it on the next run.
  - Deleted by mistake: Google Calendar keeps a per-calendar Trash for ~30 days,
    so it can be restored there; worst case re-run against the original mail.
  - Weekly digest mail of what it added, because when an airline changes its
    template the script goes quiet rather than erroring.
  - BUILD IN TWO STAGES: first a DRY RUN that writes nothing and just mails
    "here is what I would have created", run for a week or two against real
    mail, so the name rule is measured before anything is written.
  - Still needed from Alan: the two Gmail addresses, and a yes to the calendar
    name.
  Parser must match the feed's title format.

Layout conversations (previews first, Alan decides from pictures):
- L1 Dynamic day line: start the detail line right after the last occupied
  band lane that day (May 1 screenshot: clipped item beside empty lanes).
  Same territory as PARKED item 1 — Alan's items may flow left, wg items
  NEVER. Variants to preview: always dynamic / only when clipping / as-is.
- L2 Reading-glasses toggle (A/A+): bump calendar font ~12→14px, persisted.
  Show before building.
- L3 Header congestion (iPhone 13 mini): fold Skriv ut/språk/Kalendere/A+
  into one ⋯ menu; keep ‹›, view switch, wg, Cities direct. Sketch options.
- L4 wg single-day items INSIDE their band: on a day covered by a wg tour
  band from the same calendar, that day's wg items render in the band cell
  (tiny wg style, clipped, full text in day panel) instead of at the end of
  the day line — they are details OF the tour, and the day line frees up for
  Alan's events from the left. Open: what happens on 14-day-beat label days
  (label wins, item clips after? item falls back to day line?); do wg shows
  stay pinned red on the day line or move in-band (red dot stays either way);
  fall back to current end-of-line placement when no covering band. Preview
  together with L1 — same real-estate conversation.

## Constraints

- Alan is not a professional developer: explain setup steps (Google Cloud,
  DNS, deploys) concretely, one at a time, and prefer choices that minimise
  ops burden.
- No secrets in the repo. OAuth client ID is public by design; there must be
  no client secret in a pure browser flow.
- Keep it printable, glanceable, fast. The sheet's virtue is that a whole
  season is visible at once — never bury data behind clicks that the sheet
  showed at a glance.

---

## Working principles

1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
