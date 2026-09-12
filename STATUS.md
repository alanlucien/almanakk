# STATUS — where Almanakk stands

Updated 12.09.2026. Updated in place — one file, never a dated copy. **Read this first.** `CLAUDE.md` and the notes in `Front/` are working notes, not the state.

A Norwegian wall-calendar view on Google Calendar. **Live** at https://alanlucien.github.io/almanakk/, installed as a PWA, build `20260912`.

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

## Waiting on Alan

| | |
|---|---|
| Flight importer | Both Gmail addresses, and yes/no to the calendar name `Flights`. Nothing can be built without them. |
| Sharing model | (a) or (b) for the colleagues'/family URLs. |
| Week separation | Two CSS samples to be shown; Alan picks. |
| Beijing | The PNR from Lee-Yuan (not code). |

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

