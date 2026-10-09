# Almanakk — conventions, reconsidered for the native iPhone app

Written 09.10.2026 on Alan's word: "please rethink all other conventions". Every
convention the almanac reads out of plain text is listed here, with what the native app
should do with it. **Decided** means Alan has said yes. Everything else is a proposal
waiting for his word.

The rule behind every proposal: Google Calendar stays the single source of truth, and
anything stored there must read sensibly in every other client (Apple Calendar, Google,
colleagues who subscribe). The app may offer a nicer way to write a mark. It must never
invent a mark that only the app understands.

| # | Convention today | Native app | State |
|---|---|---|---|
| 1 | Pencilled: a lone `P` first in the notes, plus `?` in the title by habit | One mark, the `?` ending the title. A Blyant switch in the app; confirming is one tap that removes the `?`. Old P notes are listed and converted only on Alan's yes. | **Decided 09.10**; built in web bygg 20261009f |
| 2 | `tbc` / `HOLD` in a title = tentative | `tbc` and `HOLD` are the tour robot's words: read, never written by the app. Alan's own tentative things use the `?` (1), including his own moves. | Proposal |
| 3 | A move is an event titled `-Roma` / `→ Roma`, `tbc` when planned, an optional clock time to order it after a flight | Keep the event: it is how a subscriber sees the move. The app writes it from a "Reise til…" picker (place, date, time, Blyant), so nobody types the arrow syntax. | Proposal |
| 4 | Flights found by parsing titles (dash legs, IATA codes, booking references, "fly/flight") | Port the parser with its test tables, unchanged. Long term, the parked Gmail importer writes flights in one fixed format to its own calendar, and the parser shrinks to reading that format. | Proposal |
| 5 | Mail-scraped flights (`fromGmail`) never move the city | Keep. | Keep |
| 6 | Shows found by keywords (show, prem…, performance…, visning…) | Tour shows come from the robot's day word `Performance N`, which is exact. The keywords stay for Alan's own titles. | Proposal |
| 7 | Show count | Already read today: a robot day word `Performance 15` writes a red **15** in the month's tour column and `Antigone 15` in the week. The robot should keep writing `Performance N` with the running count. If it writes `Antigone 15` instead, the reader is a one-line change. | Answer to Alan, 09.10 |
| 8 | Compact titles: a flight reads as its route, a show as production + number | Keep. Full title always in the day sheet. | Keep |
| 9 | Quick add: `8-12 tekst` makes a span, `13:00 tekst` a timed event | Keep the line for speed, but show what it understood under the field before saving ("8.–12. okt · heldag"). Plain date and time pickers in the full form. | Proposal |
| 10 | Kalendere ticks tag calendars as "tour" overlays | Drop. wg \| TOURING is the tour calendar. wg \| Schedule shows only in week and day. These are built into the app, not settings. | Proposal |
| 11 | Event colour = Google colorId, drawn in the app's own palette | Keep, with the eight distinct dusty hues (red, orange, yellow, green, petrol, blue, violet, pink) in Google's matching slots. | **Decided 09.10** |
| 12 | Links in notes, Apple Mail links as `message://` | Keep. The note shows "✉ Åpne e-posten" and the app hands the link to Mail. | Keep |
| 13 | New events go to the calendar picked in Kalendere | Default wg \| ALAN, chosen per event in the form. No standing "goes to" line. | Proposal |
| 14 | Week numbers, weekday letters and holidays are computed, never stored | Keep. | Keep |
| 15 | The city column: flights, moves, tour legs; unknown places added by hand to a list | Keep. The places list stays in the app's code. | Keep |
| 16 | Tour events carry Oslo times | Still parked: show times in the event's own time zone when it has one. | Parked |

## Order for the native build

The month view comes first: rows, tour column, day line, colours, pencil grey. It is
followed by the day sheet with editing, the week view, and the year. Each convention
above lands with the view that first needs it.
