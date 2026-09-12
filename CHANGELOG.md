# Almanakk — changelog

One entry per change that reached a real address. Newest first. The build number is
what the app shows at the foot of Kalendere ("bygg …"); the commit is what to redeploy
to get exactly that version back (`git checkout <commit>` then `python3 publiser.py`).
Cloudflare also keeps every deployment of v2 with a one-click **Rollback** in the dashboard.

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
