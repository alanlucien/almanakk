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
- Remaining roadmap: import old sheet into Google Calendar; share private
  gmail calendar into wg account; English winter guests version; "where is
  Alan" location strip from flights; custom domain.

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
