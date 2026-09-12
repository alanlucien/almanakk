# Almanakk — changelog

One entry per change that reached a real address. Newest first. The build number is
what the app shows at the foot of Kalendere ("bygg …"); the commit is what to redeploy
to get exactly that version back (`git checkout <commit>` then `python3 publiser.py`).
Cloudflare also keeps every deployment of v2 with a one-click **Rollback** in the dashboard.

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
