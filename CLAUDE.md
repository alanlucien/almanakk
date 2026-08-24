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
- Week numbers: ISO 8601 ("uke 41"), shown on Sundays/right column.
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
- B1 DONE (a)+(b): the flight index now scans all loaded events (tour-tagged
  calendars included) and flightDest understands "Fly til Bergen" / "Fly fra
  Oslo til Bergen" (the word after til/to wins; bare "Fly fra Oslo" gives no
  city rather than a wrong one). Verified in-browser on demo data. Still open:
  (c) January is blank until the first flight of the year — needs prior-year
  loading, do only if it bites.
- B2 DONE: silent token renewal (prompt:'') on load when the saved token is
  stale, ~5 min before expiry, and once on any 401 before giving up; the
  sign-in button remains the fallback. Verified with a stubbed GIS+API flow
  (expired token -> silent T1 -> 401 -> silent T2 -> retried OK). iOS PWA may
  still refuse the silent path (ITP) — then it degrades to today's behaviour.
- B3 DONE (probable fix): .strip .month got padding-bottom:
  env(safe-area-inset-bottom) so day 31 clears the home indicator in the
  home-screen PWA. CSS-only; MUST be verified on the iPhone 16.

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
- C1 Move cities column far right into the info column (same tiny-caps style).
  Open: collision with "uke"/holiday on Sundays — join with " · " and clip, or
  city wins? Frees the left 6em → more room for the day line.
- C2 Tap city in day panel to set it manually; holds until next flight/manual
  change. Proposed storage: real all-day marker events ("→ Roma") in a small
  dedicated calendar (syncs, visible in Google, no hidden state). Override
  semantics: pure date order — latest marker-or-flight on/before the day wins,
  regardless of booking order. Needs Alan's yes on the marker convention.
- C3 Flight email ingestion, Alan's flights only. Options: (1) Google's own
  Gmail→Calendar events (maybe already on; zero new parts); (2) TripIt —
  forward bookings to plans@tripit.com, subscribe to its iCal feed as a
  calendar; (3) Flighty calendar feed (paid, best data); (4) DIY Apps Script.
  Recommend trying 1, then 2. Parser must match the feed's title format.

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
