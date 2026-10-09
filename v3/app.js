/* Almanakk v3 — the sheet rewritten from Front/REDESIGN — 06.10.md.
   The month sees the tour; the week sees the schedule; the line is his alone.
   Sign-in, loading and writing come from ../gcal.js, shared with v2. */
'use strict';

const $ = s => document.querySelector(s);

// which build this device is running — read from this script's own ?v=
const BUILD = (() => {
  try { return new URL(document.currentScript.src).searchParams.get('v') || 'dev'; }
  catch (e) { return 'dev'; }
})();

const LANGS = {
  no: {
    months: ['JANUAR', 'FEBRUAR', 'MARS', 'APRIL', 'MAI', 'JUNI', 'JULI', 'AUGUST', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'],
    wd: ['M', 'Ti', 'O', 'To', 'F', 'L', 'S'],
    wdLong: ['MANDAG', 'TIRSDAG', 'ONSDAG', 'TORSDAG', 'FREDAG', 'LØRDAG', 'SØNDAG'],
    week: 'uke', today: 'I dag', print: 'Skriv ut', lang: 'English', cals: 'Kalendere',
    tour: 'wg | turné', signin: 'Logg inn med Google',
    newPh: 'Ny · «8-12 tekst» = flere dager · «13:00» = tid', add: 'Legg til', del: 'Slett',
    deleted: 'Slettet', undo: 'Angre', restored: 'Gjenopprettet',
    added: 'Lagt til (demo — lagres ikke)', saved: 'Lagret i Google Kalender', savedIn: 'Lagret i', goesTo: 'Ny hendelse →',
    planCleared: 'Planlagt reise fjernet, flyet er booket:', signinFirst: 'Logg inn med Google først.',
    hold: 'Hold', month: 'Måned', weekName: 'Uke', year: 'År',
    fTitle: 'Tittel', fAllDay: 'Heldags', fFromClock: 'Fra kl.', fToClock: 'Til kl.', fFrom: 'Fra', fTo: 'Til',
    fWhere: 'Sted', fNotes: 'Notat', fCal: 'Kalender', onMap: 'Kart', pencil: 'Blyant', trip: 'Reise',
    save: 'Lagre', closeEdit: 'Lukk', more: 'Skjema', needTitle: 'Skriv en tittel først.',
    saving: 'Lagrer…', updated: 'Endret', movedTo: 'Flyttet til', undone: 'Angret',
    fColour: 'Farge', calColour: 'Kalenderens', fRepeat: 'Gjentas', fRemind: 'Varsel', fTz: 'Tidssone', fGuests: 'Gjester',
    rep: ['Aldri', 'Hver dag', 'Hver uke', 'Hver 2. uke', 'Hver måned', 'Hvert år'], repUntil: 'til',
    rem: ['Ingen', 'Standard', 'Ved start', '10 min før', '30 min før', '1 time før', '1 dag før'],
    series: 'serie', fWhen: 'Når', edit: 'Endre', openMail: 'Åpne e-posten', newLine: 'Ny hendelse …', today: 'I dag',
  },
  en: {
    months: ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'],
    wd: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    wdLong: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
    week: 'wk', today: 'Today', print: 'Print', lang: 'Norsk', cals: 'Calendars',
    tour: 'wg | touring', signin: 'Sign in with Google',
    newPh: 'New · "8-12 text" = several days · "13:00" = timed', add: 'Add', del: 'Delete',
    deleted: 'Deleted', undo: 'Undo', restored: 'Restored',
    added: 'Added (demo — not saved)', saved: 'Saved to Google Calendar', savedIn: 'Saved to', goesTo: 'New event →',
    planCleared: 'Planned move removed, the flight is booked:', signinFirst: 'Sign in with Google first.',
    hold: 'Hold', month: 'Month', weekName: 'Week', year: 'Year',
    fTitle: 'Title', fAllDay: 'All day', fFromClock: 'From', fToClock: 'To', fFrom: 'From', fTo: 'To',
    fWhere: 'Location', fNotes: 'Notes', fCal: 'Calendar', onMap: 'Map', pencil: 'Pencilled', trip: 'Trip',
    save: 'Save', closeEdit: 'Close', more: 'Form', needTitle: 'Give it a title first.',
    saving: 'Saving…', updated: 'Updated', movedTo: 'Moved to', undone: 'Undone',
    fColour: 'Colour', calColour: 'Calendar\u2019s', fRepeat: 'Repeats', fRemind: 'Reminder', fTz: 'Time zone', fGuests: 'Guests',
    rep: ['Never', 'Daily', 'Weekly', 'Every 2 weeks', 'Monthly', 'Yearly'], repUntil: 'until',
    rem: ['None', 'Default', 'At start', '10 min before', '30 min before', '1 hour before', '1 day before'],
    series: 'series', fWhen: 'When', edit: 'Edit', openMail: 'Open the mail', newLine: 'New event …', today: 'Today',
  },
};
const L = () => LANGS[state.lang] || LANGS.no;

const MONTH_ARG = (location.search.match(/[?&]month=(\d{1,2})\b/) || [])[1];
const YEAR_ARG = (location.search.match(/[?&]year=(\d{4})\b/) || [])[1];

const state = {
  view: 'month',
  year: YEAR_ARG ? +YEAR_ARG : new Date().getFullYear(),
  month: MONTH_ARG ? Math.min(11, Math.max(0, +MONTH_ARG - 1)) : new Date().getMonth(),
  events: [],
  mode: 'demo',                                       // 'demo' | 'google'
  wg: localStorage.getItem('almanakk3-wg') !== '0',   // the tour column; on unless switched off
  lang: localStorage.getItem('almanakk2-lang') || 'no',
  cityCodes: false, detailed: false,                  // read by the shared city code
  open: null,                                         // the day sheet, 'YYYY-MM-DD'
  weekOf: null,                                       // the week view's Monday
  editing: null,                                      // an event id, or 'new', open in the day sheet
};

/* ---------- calendars: which is whose ---------- */

function allCalendars() {
  return (state.mode === 'google' && window.gcalCalendars) ? window.gcalCalendars() : DEMO_CALENDARS;
}
// THE ROBOT'S CALENDAR IS THE TOUR (05.10). wg | TOURING whenever it exists,
// never its "(test)" twin; without it, the Kalendere ticks decide.
const ROBOT_CAL = /\btouring\b/i, TEST_CAL = /\(test\)/i, SCHED_CAL = /\bschedule\b/i;
function robotCalIds(cals) {
  return cals.filter(c => ROBOT_CAL.test(c.name) && !TEST_CAL.test(c.name)).map(c => c.id);
}
function tourCalIds() {
  const all = allCalendars();
  const robot = robotCalIds(all);
  if (robot.length) return robot;
  const stored = JSON.parse(localStorage.getItem('almanakk-tourcals') || 'null');
  if (stored) return stored.filter(id => all.some(c => c.id === id));
  return all.filter(c => /tour|turné|turne/i.test(c.name)).map(c => c.id);
}
// THE SCHEDULE IS THE WEEK'S (D1). Call sheets never reach the month.
function scheduleCalIds() {
  return allCalendars().filter(c => SCHED_CAL.test(c.name)).map(c => c.id);
}
// once, when the robot's calendar is first seen: the old tour-tagged calendars
// are untagged and hidden, the test twin with them (same key as v2, so it
// never runs twice on a device that already did it there)
window.adoptTouringCalendar = function (cals) {
  const robot = robotCalIds(cals);
  if (!robot.length) return;
  const doneKey = 'almanakk2-touring:' + robot.join(',');
  if (localStorage.getItem(doneKey)) return;
  const tagged = JSON.parse(localStorage.getItem('almanakk-tourcals') || '[]');
  const drop = new Set(tagged.filter(id => !robot.includes(id)));
  cals.filter(c => TEST_CAL.test(c.name)).forEach(c => drop.add(c.id));
  const sel = JSON.parse(localStorage.getItem('almanakk-selected-cals') || 'null') || cals.map(c => c.id);
  const keep = sel.filter(id => !drop.has(id)).concat(robot.filter(id => !sel.includes(id)));
  localStorage.setItem('almanakk-selected-cals', JSON.stringify(keep));
  localStorage.setItem('almanakk-tourcals', JSON.stringify(robot));
  localStorage.setItem(doneKey, '1');
  const names = cals.filter(c => drop.has(c.id) && sel.includes(c.id)).map(c => c.name);
  if (names.length) toast((state.lang === 'en'
    ? 'Tours now come from wg | TOURING. Hidden: ' : 'Turné leses nå fra wg | TOURING. Skjult: ')
    + names.join(', '));
};

// his own: everything that is neither the tour's nor the schedule's
function ownEvents() {
  const out = new Set([...tourCalIds(), ...scheduleCalIds()]);
  return state.events.filter(e => !out.has(e.calId));
}
function tourEvents() {
  if (!state.wg) return [];
  const t = new Set(tourCalIds());
  return state.events.filter(e => t.has(e.calId) && !e.time);
}

/* ---------- dates ---------- */

function fmt(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function weekdayIdx(d) { return (d.getDay() + 6) % 7; } // 0=Mon … 6=Sun
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((t - jan4) / (7 * 864e5));
}
function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100,
    d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
// 'YYYY-MM-DD' -> {name, red}; red = official public holiday
const holCache = {};
function holidays(y) {
  if (holCache[y]) return holCache[y];
  const map = {};
  const put = (d, name, red) => { map[fmt(d)] = { name, red: !!red }; };
  const off = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
  const E = easterDate(y);
  put(new Date(y, 0, 1), '1. Nyttårsdag', true);
  put(off(E, -7), 'Palmesøndag', true);
  put(off(E, -3), 'Skjærtorsdag', true);
  put(off(E, -2), 'Langfredag', true);
  put(off(E, -1), 'Påskeaften');
  put(E, '1. Påskedag', true);
  put(off(E, 1), '2. Påskedag', true);
  put(new Date(y, 4, 1), '1. mai', true);
  put(new Date(y, 4, 17), '17. mai', true);
  put(off(E, 39), 'Kr. himmelfart', true);
  put(off(E, 49), '1. Pinsedag', true);
  put(off(E, 50), '2. Pinsedag', true);
  put(new Date(y, 5, 23), 'St.Hansaften');
  const dec24 = new Date(y, 11, 24);
  const advent4 = off(dec24, -dec24.getDay());
  for (let n = 1; n <= 4; n++) put(off(advent4, (n - 4) * 7), n + '. advent');
  put(dec24, 'Julaften');
  put(new Date(y, 11, 25), '1. Juledag', true);
  put(new Date(y, 11, 26), '2. Juledag', true);
  put(new Date(y, 11, 31), 'Nyttårsaften');
  return (holCache[y] = map);
}

/* ---------- what a title means ---------- */

const SHOW_RE = /\b(show\w*|prem\w*|première|performance\w*|forest\w*|visning\w*|vorstellung\w*|matin[ée]\w*)\b/i;
function isShow(ev) { return SHOW_RE.test(ev.title.replace(/show[\s-]*call/gi, '')); }
function effTime(e) {
  if (e.time) return e.time;
  const m = e.title.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return m ? m[1].padStart(2, '0') + ':' + m[2] : null;
}
const isTbc = ev => /\btbc\b/i.test(ev.title) || /^HOLD\b/.test(ev.title);
const isHold = ev => /^HOLD\b/.test(ev.title);
// PENCILLED = A "?" ENDING THE TITLE (Alan, 09.10: "perfect re pencil"). The 03.09 mark,
// a lone P first in the notes, was a code only this app read: a stray letter in every
// other client, and it ate the P of a note beginning "Paris…". The "?" is the mark he already typed by
// habit, seen by everyone in every client, set and cleared anywhere. Old P notes still
// read as pencilled until they are converted (listed for his yes, never automatically).
const PENCIL_Q = /\s*\?\s*$/;
const isPencil = ev => PENCIL_Q.test(ev.title || '') || /^P[ \t]*(\r?\n|$)/.test(ev.notes || '');
// only a P alone on its line goes (and the blank line under it): a note beginning "Paris…"
// lost its P to the old pattern, and Endre would have saved it without (Alan, 09.10)
const withoutPencil = n => (n || '').replace(/^P[ \t]*(?:\r?\n(?:[ \t]*\r?\n)?|$)/, '');
const hasNote = ev => !!withoutPencil(ev.notes).trim();

// a flight leaving between midnight and 03:30 belongs to the evening before
const NIGHT_UNTIL = 3 * 60 + 30;
window.nightFlight = function (title, time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return false;
  if (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) >= NIGHT_UNTIL) return false;
  return !!flightDest(title);
};

// A WALL CALENDAR IS WRITTEN SHORT: a production the day is already inside
// is not named again, and a year is the calendar's job. Never returns nothing.
function wallTitle(title, covers) {
  const original = String(title).replace(/\s+/g, ' ').trim();
  let t = ' ' + original + ' ';
  const noYear = t.replace(/\b(19|20)\d\d\b/g, ' ');
  if (noYear.trim()) t = noYear;
  for (const c of covers) {
    const words = String(c).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    for (let k = words.length; k >= 1; k--) {
      const name = words.slice(0, k).join(' ');
      if (name.length < 4) continue;
      const re = new RegExp('\\s' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'i');
      if (!re.test(t)) continue;
      const cut = t.replace(re, ' ');
      if (!cut.trim()) break;
      t = cut; break;
    }
  }
  t = t.replace(/^[\s\-–—,:·+]+|[\s\-–—,:·]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!/[\p{L}]{2}/u.test(t)) return original;
  return t || original;
}
// brackets are for the day, not for the wall (23.09)
function stripParens(t) {
  const out = String(t).replace(/\s*\([^)]*\)/g, ' ').replace(/\s*\[[^\]]*\]/g, ' ')
    .replace(/^[\s\-–—:·,]+|[\s\-–—:·,]+$/g, '').replace(/\s+/g, ' ').trim();
  return /[\p{L}\d]/u.test(out) ? out : String(t);
}
function stripClock(t) {
  const out = String(t).replace(/\b([01]?\d|2[0-3])[:.][0-5]\d\b/g, ' ')
    .replace(/^[\s\-–—:·]+/, '').replace(/\s+/g, ' ').trim();
  return out || t;
}
// what an entry says on the line: a move as its arrow, a flight as its route,
// everything else as its wall title
function lineTitle(e, covers) {
  const mark = cityMarker(e.title);
  if (mark) return '→ ' + mark;
  const route = flightRoute(e.title);
  if (route) return route;
  if (hasFlightWord(e.title)) {
    const named = placesIn(e.title);
    if (named.length === 1) return '→ ' + cityLabel(named[0]);
  }
  return stripParens(wallTitle(stripClock(deco(e.title)), covers));
}

/* ---------- cities: copied verbatim from v2/app.js (keep them identical) ---------- */

// A leg is stripped of times, flight numbers, brackets and a leading "Fly".
function cleanLeg(s) {
  return s.replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ')
    .replace(/\b[A-Z]{2}\s?\d{1,4}\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/^(?:fly|flight|reise|tog|train)\s+/i, '').trim();
}
// A leg only counts as a place if we recognise it: a 3-letter airport code
// (any case) or a city name we know. Everything else — "Meet Ellen",
// "afternoon" — is deliberately NOT a place, so ordinary titles with a dash
// are never mistaken for flights.
function placeOf(s) {
  if (!s) return null;
  if (/^[A-Za-zÆØÅæøå]{3}$/.test(s) && IATA_CITIES[s.toUpperCase()]) return s.toUpperCase();
  // the full airport table only matches a code written as a code, in capitals,
  // so an ordinary three-letter word can never become a destination
  if (/^[A-Z]{3}$/.test(s) && window.AIRPORTS && AIRPORTS[s]) return s;
  return CITY_BY_NAME[s.toLowerCase()] || null;
}
// The longest run of consecutive legs that ALL resolve to places:
// "SK 4103 Oslo - Bergen" -> ['Oslo','Bergen'], "Meet Ellen - afternoon" -> [].
// A leg, allowing for a booking reference glued to the city name:
// "YLHNAI Oslo - Bergen". Only tried when the leg does not resolve as it
// stands, so "PARIS" and other real names are never mistaken for a reference.
function legPlace(part) {
  const s = cleanLeg(part);
  const direct = placeOf(s);
  if (direct) return direct;
  const m = s.match(/^[A-Z][A-Z0-9]{4,7}\s+(.+)$/);
  return m ? placeOf(m[1]) : null;
}
function flightLegs(title) {
  let best = [];
  // "BGO-OSL tbc" is the same route as "BGO-OSL", just not booked yet
  const bare = title.replace(/\btbc\b/gi, ' ').trim();
  // A COMMA ENDS A ROUTE (10.10): "Flight AAA-BBB, Airline XX 123" read its last
  // leg as "CAI, Transavia", which is no place, so the flight to Cairo moved nothing.
  // Each comma-separated piece is read on its own; the longest route wins.
  for (const piece of bare.split(/[,;]/)) {
    let run = [];
    for (const part of piece.split(/\s*(?:[-–—]+|[>→]+)\s*/)) {
      const place = legPlace(part);
      if (place) { run.push(place); if (run.length > best.length) best = run.slice(); }
      else run = [];
    }
  }
  return best.length >= 2 ? best : [];
}
// Every place named anywhere in the title, in order — "Flight Oslo → Germany
// (Wuppertal trip)" -> ['Oslo','Wuppertal']. Two-word names are tried first.
function placesIn(title) {
  const words = title.replace(/[()[\],.;:]/g, ' ').split(/\s+/).filter(Boolean);
  const found = [];
  for (let i = 0; i < words.length; i++) {
    const two = placeOf(words[i] + ' ' + (words[i + 1] || ''));
    if (two) { found.push(two); i++; continue; }
    const one = placeOf(words[i]);
    if (one) found.push(one);
  }
  return found;
}
const hasFlightWord = t => /\b(?:fly|flight)\b/i.test(t);
// A manual move: "-Roma", "->Roma", "→ Roma" — for trains, drives and trips
// planned before anything is booked. The text after the arrow is taken as-is,
// so a small town with no airport code works exactly the same.
function cityMarker(title) {
  // an optional clock time may lead or trail: "14:00 -Voss" / "-Voss 14:00",
  // which is how you say a move happened AFTER a flight the same day
  // A DASH TOUCHES ITS CITY ("-Roma"); "- A. Name" is a list item, not a move (10.10:
  // a 2023 cast list put "A. NAME" in his city column). Arrows may take a space.
  const m = title.match(/^\s*(?:\d{1,2}[:.]\d{2}\s+)?(?:-+>\s*|-+(?=\S)|→\s*|=>\s*)([^,(]+?)\s*(?:\btbc\b.*)?$/i);
  if (!m || !m[1] || /^\d/.test(m[1])) return null;   // "-8 Antigone" is a span, not a move
  const name = m[1].replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
  return name || null;
}
// Compact views read a flight as its route: "OSL-PAR-HKG" -> "Oslo → Hong Kong".
// A journey with a stop reads as one trip: "Bergen →•→ Pisa", a dot per stop.
// Alan: "i start the day in bergen end in pisa" — the legs are the airline's
// business. Detaljer and the day panel always keep them whole.
function journeyLabel(legs) {
  // the dots counted the stops in between — "Oslo \u2192\u2022\u2192 Bangkok" — and Alan read
  // them as breakage, not as information (14.09). Where he changes planes is
  // not something he acts on from a month away; where he ends up is.
  return cityLabel(legs[0]) + ' \u2192 ' + cityLabel(legs[legs.length - 1]);
}

// Two events that meet — "BGO-OSL" then "OSL-PSA" — are one journey, and eat
// twice the room they need. Merge them where the first one lands is where the
// next one leaves. Never across a tour calendar, and never in Detaljer.
function collapseJourneys(items) {
  if (state.detailed) return items;
  const out = [];
  for (const it of items) {
    const legs = it.wg ? [] : flightLegs(it.e.title);
    const prev = out[out.length - 1];
    if (legs.length >= 2 && prev && !prev.wg && prev._legs && prev._legs.length >= 2
        && prev._legs[prev._legs.length - 1] === legs[0]) {
      prev._legs = prev._legs.concat(legs.slice(1));
      continue;
    }
    out.push(Object.assign({}, it, { _legs: legs.length >= 2 ? legs : null }));
  }
  return out;
}

function flightRoute(title) {
  let legs = flightLegs(title);
  // "Flight Oslo → Germany (Wuppertal trip)": the legs don't both resolve, but
  // the title names places — only trusted when it actually says fly/flight.
  if (legs.length < 2 && hasFlightWord(title)) legs = placesIn(title);
  if (legs.length < 2) return null;
  return cityLabel(legs[0]) + ' → ' + cityLabel(legs[legs.length - 1]);
}
// "OSL–LHR 14:55" / "Osl - Beijing" / "BKK-PAR-MRS" -> last leg;
// "Fly til Bergen" / "Flight to Helsinki (AY 62)" -> the name after til/to.
function flightDest(title) {
  const legs = flightLegs(title);
  if (legs.length) return legs[legs.length - 1];
  // a flight title naming several places: the LAST one is where you end up
  if (hasFlightWord(title)) {
    const named = placesIn(title);
    if (named.length >= 2) return named[named.length - 1];
  }
  // "Fly til Bergen" / "Fly fra Oslo til Bergen": the word after til/to wins
  // resolve through the place tables so the column and the day line agree
  // ("Copenhagen" and "København" are the same city)
  const via = title.match(/\b(?:fly|flight)\b[^.,;]*?\b(?:til|to)\s+([A-ZÆØÅa-zæøå][A-Za-zæøåÆØÅ]{2,})/i);
  if (via) return placeOf(via[1]) || via[1];
  const plain = title.match(/\b(?:fly|flight)\s+([A-ZÆØÅa-zæøå][A-Za-zæøåÆØÅ]{2,})/i);
  if (plain && !/^(?:til|to|fra|from)$/i.test(plain[1])) return placeOf(plain[1]) || plain[1];
  return null;
}
function buildFlightIndex() {
  // flights count wherever they live — incl. tour-tagged calendars, which
  // visibleEvents() hides from the normal view
  const flights = [];
  for (const ev of state.events) {
    // Gmail-scraped events are skipped: a cc'd itinerary is often someone
    // else's flight, and a wrong city is worse than no city
    if (ev.fromGmail) continue;
    const marker = cityMarker(ev.title);
    const dest = marker || flightDest(ev.title);
    // evId/marker let a tap on the city find the event that put it there
    // PENCILLED IS TENTATIVE, and a flight is where that matters most (Alan,
    // 14.09). "tbc" in the title has said this since August; a P in the notes
    // says the same thing about any event, so it counts the same here.
    if (dest) flights.push({ date: ev.start, time: ev.time || '99', dest, tbc: isTbc(ev) || isPencil(ev), marker: !!marker, evId: ev.id });
  }
  // Date first. Within a day a BOOKING outranks a PLAN — "-Roma tbc" is a guess
  // and a real flight that day replaces it — then by time, so the last leg of a
  // travel day wins. cityOn takes the last match, so the winner sorts last.
  flights.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : a.tbc !== b.tbc ? (a.tbc ? -1 : 1)
        : (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return flights;
}
// the latest move on or before this day — {dest, tbc} — or null
function cityOn(ds, flights) {
  let hit = null;
  for (const f of flights) {
    if (f.date <= ds) hit = f; else break;
  }
  return hit;
}

// Airport/metro codes -> city names (codes Alan actually flies, plus majors).
const IATA_CITIES = {
  OSL: 'Oslo', BGO: 'Bergen', TRD: 'Trondheim', SVG: 'Stavanger', KRS: 'Kristiansand', TOS: 'Tromsø', AES: 'Ålesund', BOO: 'Bodø',
  CPH: 'København', ARN: 'Stockholm', STO: 'Stockholm', GOT: 'Göteborg', HEL: 'Helsinki', KEF: 'Reykjavík',
  LHR: 'London', LGW: 'London', STN: 'London', LCY: 'London', LTN: 'London', LON: 'London',
  CDG: 'Paris', ORY: 'Paris', PAR: 'Paris', AMS: 'Amsterdam', BRU: 'Brussel',
  FRA: 'Frankfurt', MUC: 'München', DUS: 'Düsseldorf', BER: 'Berlin', TXL: 'Berlin', HAM: 'Hamburg', CGN: 'Köln', STR: 'Stuttgart',
  ZRH: 'Zürich', GVA: 'Genève', VIE: 'Wien', PRG: 'Praha', WAW: 'Warszawa', BUD: 'Budapest', KRK: 'Kraków',
  MXP: 'Milano', LIN: 'Milano', MIL: 'Milano', FCO: 'Roma', CIA: 'Roma', ROM: 'Roma', VCE: 'Venezia', NAP: 'Napoli', BLQ: 'Bologna', FLR: 'Firenze', TRN: 'Torino', PSA: 'Pisa',
  ATH: 'Athen', SKG: 'Thessaloniki', IST: 'Istanbul', MAD: 'Madrid', BCN: 'Barcelona', LIS: 'Lisboa', OPO: 'Porto',
  DUB: 'Dublin', EDI: 'Edinburgh', MAN: 'Manchester', MRS: 'Marseille', NCE: 'Nice', LYS: 'Lyon', TLS: 'Toulouse',
  JFK: 'New York', EWR: 'New York', LGA: 'New York', NYC: 'New York', BOS: 'Boston', IAD: 'Washington', DCA: 'Washington',
  ORD: 'Chicago', LAX: 'Los Angeles', SFO: 'San Francisco', MIA: 'Miami', YYZ: 'Toronto', YUL: 'Montreal',
  EZE: 'Buenos Aires', AEP: 'Buenos Aires', GRU: 'São Paulo', GIG: 'Rio de Janeiro', SCL: 'Santiago', BOG: 'Bogotá', MEX: 'Mexico City', LIM: 'Lima',
  NRT: 'Tokyo', HND: 'Tokyo', TYO: 'Tokyo', KIX: 'Osaka', ITM: 'Osaka', OSA: 'Osaka', NGO: 'Nagoya', FUK: 'Fukuoka', CTS: 'Sapporo', OKA: 'Okinawa',
  ICN: 'Seoul', GMP: 'Seoul', PEK: 'Beijing', PKX: 'Beijing', PVG: 'Shanghai', SHA: 'Shanghai',
  HKG: 'Hong Kong', HGK: 'Hong Kong', TPE: 'Taipei', BKK: 'Bangkok', DMK: 'Bangkok', USM: 'Koh Samui', HKT: 'Phuket',
  SIN: 'Singapore', KUL: 'Kuala Lumpur', CGK: 'Jakarta', DPS: 'Bali', HAN: 'Hanoi', SGN: 'Ho Chi Minh',
  DEL: 'Delhi', BOM: 'Mumbai', DXB: 'Dubai', DOH: 'Doha', AUH: 'Abu Dhabi', TLV: 'Tel Aviv', CAI: 'Kairo',
  JNB: 'Johannesburg', CPT: 'Cape Town', SYD: 'Sydney', MEL: 'Melbourne', BNE: 'Brisbane', PER: 'Perth', AKL: 'Auckland',
};
// name (lowercase) -> proper name, so "beijing" / "Oslo" resolve like codes do
const CITY_BY_NAME = {};
for (const n of Object.values(IATA_CITIES)) CITY_BY_NAME[n.toLowerCase()] = n;

// Places with no airport code of their own — tour towns and drives. Add to
// this list as Alan hits ones the calendar doesn't know.
const EXTRA_PLACES = [
  'Wuppertal', 'Mainz', 'Essen', 'Bochum', 'Dortmund', 'Leipzig', 'Dresden', 'Hannover',
  'Nürnberg', 'Bremen', 'Freiburg', 'Karlsruhe', 'Mannheim', 'Wiesbaden', 'Bonn', 'Münster',
  'Kassel', 'Heidelberg', 'Darmstadt', 'Aachen', 'Augsburg', 'Weimar', 'Halle', 'Bochum',
  'Avignon', 'Aix-en-Provence', 'Montpellier', 'Grenoble', 'Nantes', 'Rennes', 'Strasbourg',
  'Lausanne', 'Bern', 'Basel', 'Luzern', 'Salzburg', 'Graz', 'Linz', 'Innsbruck',
  'Bergamo', 'Brescia', 'Modena', 'Parma', 'Ferrara', 'Ravenna', 'Perugia', 'Siena',
  'Lillehammer', 'Hamar', 'Tønsberg', 'Sandefjord', 'Fredrikstad', 'Drammen', 'Larvik',
  'Skien', 'Arendal', 'Molde', 'Røros', 'Voss', 'Geilo', 'Hemsedal', 'Lofoten',
  'Gent', 'Antwerpen', 'Brugge', 'Rotterdam', 'Utrecht', 'Groningen', 'Maastricht',
  'Aarhus', 'Odense', 'Malmö', 'Uppsala', 'Tampere', 'Turku', 'Tallinn', 'Riga', 'Vilnius',
];
function cityName(code) {
  const no = IATA_CITIES[code] || (window.AIRPORTS && AIRPORTS[code]) || code;
  return state.lang === 'en' ? (EXONYM_EN[no] || no) : no;
}
// name -> code, so the Byer button can read either way. Multi-airport cities
// prefer their metro code (London -> LON, not LHR).
const METRO = { London: 'LON', Paris: 'PAR', Milano: 'MIL', Roma: 'ROM', Stockholm: 'STO',
  'New York': 'NYC', Tokyo: 'TYO', Osaka: 'OSA', Berlin: 'BER', Washington: 'IAD' };
const CODE_BY_NAME = {};
for (const [code, name] of Object.entries(IATA_CITIES)) {
  if (!CODE_BY_NAME[name]) CODE_BY_NAME[name] = code;
}
for (const n of EXTRA_PLACES) CITY_BY_NAME[n.toLowerCase()] = n;
// Cities whose NAME differs by language — Roma/Rome, København/Copenhagen.
// Ålesund and Tromsø are not here: they are the same word in both, just spelt
// properly. Both spellings always resolve; only the display follows the flag.
const EXONYM_EN = {
  'København': 'Copenhagen', 'Göteborg': 'Gothenburg', 'Wien': 'Vienna', 'Praha': 'Prague',
  'Warszawa': 'Warsaw', 'München': 'Munich', 'Köln': 'Cologne', 'Roma': 'Rome',
  'Milano': 'Milan', 'Napoli': 'Naples', 'Firenze': 'Florence', 'Venezia': 'Venice',
  'Torino': 'Turin', 'Lisboa': 'Lisbon', 'Athen': 'Athens', 'Moskva': 'Moscow',
  'Genève': 'Geneva', 'Zürich': 'Zurich', 'Brussel': 'Brussels', 'Kairo': 'Cairo',
  'Kraków': 'Krakow', 'Praia': 'Praia',
};
for (const [no, en] of Object.entries(EXONYM_EN)) {
  CITY_BY_NAME[en.toLowerCase()] = no;   // "Venice" in a title finds Venezia
  CITY_BY_NAME[no.toLowerCase()] = no;
}
Object.assign(CODE_BY_NAME, METRO);
function cityCode(place) {
  if (IATA_CITIES[place]) return place;          // already a code
  return CODE_BY_NAME[place] || place;           // no code known: the name stands
}
// How a place reads right now — full name, or airport code (the Byer button).
function cityLabel(place) {
  return state.cityCodes ? cityCode(place) : cityName(place);
}


// NO EMOJI ON THE WALL (Alan, 10.10: "I do NOT like the theatre mask"): titles and notes are
// shown in plain words whatever another client wrote into them
function deco(s) {
  const t = String(s).replace(/&(amp|lt|gt|quot|#0?39|apos|nbsp);/g, (m, e) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'", apos: "'", nbsp: ' ',
  })[e] || m);
  const plain = t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
  return plain || t;
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- colour: his own, per event (Alan, 07.10) ---------- */

// Stored as Google's colorId, so it survives in Google; DRAWN in his own palette.
// 09.10 (Alan: "too similar … colors that stand apart: red, yellow, green, blue, pink,
// orange"): eight hues round the wheel, still dusty, each in the Google slot whose own
// colour is that hue (Tomato, Tangerine, Banana, Basil, Peacock, Blueberry, Grape,
// Flamingo), so Google's web view agrees. Text on white: 4.4:1 (yellow) to 6.8:1.
// Slots 1, 2 and 8 are not offered; an event carrying one draws in its calendar's colour.
const DUSTY = {
  11: '#A8423A',  // Rød
  6: '#B35A22',   // Oransje
  5: '#94740F',   // Gul
  10: '#467A38',  // Grønn
  7: '#23716F',   // Petrol
  9: '#2F5E9E',   // Blå
  3: '#6A4A9C',   // Lilla
  4: '#B0407A',   // Rosa
};
// the order the swatches stand in (an object's number keys would sort themselves)
const DUSTY_ORDER = ['11', '6', '5', '10', '7', '9', '3', '4'];
// the calendar's own colour, never Google's bright per-event one
const calColor = e => (allCalendars().find(c => c.id === e.calId) || {}).color || e.color || '#26241f';
// the colour an event is drawn in: its own, else its calendar's
const evColor = e => (e.colorId && DUSTY[e.colorId]) || calColor(e);
// and the ink its words take on the line: only a colour he chose himself speaks
const evInk = e => isShow(e) ? 'var(--red)' : ((e.colorId && DUSTY[e.colorId]) || '');

/* ---------- the tour: the robot's words ---------- */

// the eight words, and how they are written in a column 64px wide
const SHORT = {
  'travel': 'Travel', 'get in': 'Get in', 'work day': 'Work', 'day off': 'Off',
  'travel day tech': 'Travel tech', 'travel day performers': 'Travel perf',
  'get in – tech only': 'Get in tech', 'get in - tech only': 'Get in tech',
};
const perfNo = t => (String(t).match(/^Performance\s+(\d+)/i) || [])[1] || null;
function tourWordHtml(ev) {
  const n = perfNo(ev.title);
  if (n) return `<b class="perf">${n}</b>`;
  const w = deco(ev.title).replace(/\s+/g, ' ').trim();
  return `<span class="tw">${esc(SHORT[w.toLowerCase()] || w)}</span>`;
}
// the leg's city: the Location field, else the words after the shouted name
function legCity(leg) {
  const loc = String(leg.location || '').split(/\n|,/)[0].trim();
  if (loc) return loc;
  const words = legWords(leg);
  const caps = capsCount(words);
  return caps && caps < words.length ? words.slice(caps).join(' ') : '';
}
function legWords(leg) {
  return deco(leg.title).replace(/\btbc\b/gi, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}
function capsCount(words) {
  const shout = w => w.length > 1 && w === w.toLocaleUpperCase('no') && /[A-ZÆØÅ]/.test(w);
  let n = 0; while (n < words.length && shout(words[n])) n++;
  return n;
}
// the production: the shouted words, or the title minus its city
function legName(leg) {
  if (isHold(leg)) return L().hold;
  const words = legWords(leg);
  const caps = capsCount(words);
  if (caps) return words.slice(0, caps).join(' ');
  const city = legCity(leg);
  const t = words.join(' ');
  return (city && t.endsWith(city) && t.length > city.length) ? t.slice(0, -city.length).trim() : t;
}

/* ---------- where he is ---------- */

// HIS CITY FOLLOWS ONLY HIS OWN TRAVEL (Alan, 10.10): the last flight or move on or
// before the day. A tour leg no longer moves him — a tour to Roma he does not join put
// ROMA in his column. The tour's city belongs to the tour.
function whereOn(ds, flights, legs) {
  let last = null;
  for (const f of flights) { if (f.date <= ds) last = f; else break; }
  return last ? { name: cityName(last.dest), tbc: last.tbc } : null;
}

/* ---------- the month ---------- */

const MAX_LANES = 4;
// his spans, each given a lane for the month — the thin rules in the gutter
function laneSpans(y, m) {
  const first = fmt(new Date(y, m, 1)), last = fmt(new Date(y, m, daysInMonth(y, m)));
  const spans = ownEvents().filter(e => e.end > e.start && e.start <= last && e.end >= first)
    .sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : (a.end > b.end ? -1 : 1));
  const laneEnd = [];
  for (const s of spans) {
    let l = 0;
    while (l < MAX_LANES && laneEnd[l] && laneEnd[l] >= s.start) l++;
    if (l >= MAX_LANES) { s._lane = -1; continue; }
    laneEnd[l] = s.end; s._lane = l;
  }
  return { spans, n: Math.min(MAX_LANES, laneEnd.length) };
}

// ONE SET OF ROWS, TWO READERS: the month on the screen and the widget's snapshot
// are drawn from the same data, so the widget can never disagree with the sheet.
function monthData(y, m) {
  const n = daysInMonth(y, m);
  const hol = holidays(y);
  const todayStr = fmt(new Date());
  const { spans, n: nLanes } = laneSpans(y, m);
  const first = fmt(new Date(y, m, 1)), last = fmt(new Date(y, m, n));
  const own = ownEvents().filter(e => e.end === e.start && e.start >= first && e.start <= last);
  const tour = tourEvents();
  const legs = tour.filter(e => e.end > e.start).sort((a, b) => (a.start < b.start ? 1 : -1)); // innermost first
  const words = tour.filter(e => e.end === e.start);
  const flights = buildFlightIndex();
  const rows = [];
  let shownCity = null, ukeOn = null;
  for (let d = 1; d <= n; d++) {
    const date = new Date(y, m, d), ds = fmt(date), wi = weekdayIdx(date);
    const h = hol[ds];
    const leg = legs.find(l => l.start <= ds && l.end >= ds) || null;
    const covering = spans.filter(sp => sp.start <= ds && sp.end >= ds);
    const dayOwn = own.filter(e => e.start === ds);
    const word = leg ? words.find(w => w.start === ds) : null;
    const perf = word ? perfNo(word.title) : null;
    const names = covering.map(sp => sp.title);
    const lanes = [];
    for (let l = 0; l < nLanes; l++) {
      const sp = covering.find(x => x._lane === l);
      lanes.push(sp ? { color: evColor(sp), a: sp.start === ds, z: sp.end === ds } : null);
    }
    const parts = [];
    for (const sp of spans) if (sp._lane >= 0 && (sp.start === ds || (d === 1 && sp.start < ds && sp.end >= ds)))
      parts.push({ id: sp.id, kind: 'span', text: stripParens(deco(sp.title)), pencil: isPencil(sp), ink: evInk(sp) });
    const allday = dayOwn.filter(e => !effTime(e)), timed = dayOwn.filter(e => effTime(e)).sort((a, b) => effTime(a) < effTime(b) ? -1 : 1);
    for (const e of allday) parts.push({ id: e.id, kind: 'allday', text: lineTitle(e, names), show: isShow(e), pencil: isPencil(e) || isTbc(e), ink: evInk(e), color: evColor(e) });
    for (const e of timed) parts.push({ id: e.id, kind: 'timed', time: effTime(e), text: lineTitle(e, names), show: isShow(e), pencil: isPencil(e) || isTbc(e), ink: evInk(e), color: evColor(e) });
    const opens = !!leg && (leg.start === ds || d === 1);
    const here = whereOn(ds, flights, legs);
    const city = here ? here.name : null;
    let info = null;
    if (h) info = { kind: 'hn', text: h.name, long: h.name.length > 9 };
    else if (wi === 0 || (ukeOn === null && wi === 1 && hol[fmt(new Date(y, m, d - 1))])) { info = { kind: 'uke', text: `${L().week} ${isoWeek(date)}` }; ukeOn = ds; }
    else if (city && (city !== shownCity || wi === 1 || d === 1)) { info = { kind: 'cty', text: city, tbc: !!here.tbc, long: city.length > 6 }; shownCity = city; }
    rows.push({ ds, d, wi, wd: L().wdLong[wi], week: isoWeek(date), hol: h ? h.name : '', red: wi === 6 || !!(h && h.red), sun: wi === 6,
      today: ds === todayStr, lanes, parts, info, city: city || '', tbc: !!(here && here.tbc),
      tour: leg ? { id: leg.id, name: legName(leg), word: perf ? '' : (word ? (SHORT[deco(word.title).trim().toLowerCase()] || deco(word.title)) : ''), perf: perf || '', city: legCity(leg), tbc: isTbc(leg), open: opens } : null,
      show: dayOwn.some(isShow) || !!perf });
  }
  return { rows, nLanes, n };
}

function renderMonth(y, m) {
  const { rows, nLanes, n } = monthData(y, m);
  let html = `<section class="month" data-y="${y}" data-m="${m}" style="--lanes:${Math.max(1, nLanes)}">`
    + `<h2>${L().months[m]} <span>${y}</span></h2>`;
  for (const r of rows) {
    const gut = r.lanes.map(l => l ? `<i style="background:${l.color}" class="${l.a ? 'a' : ''} ${l.z ? 'z' : ''}"></i>` : '<i></i>').join('');
    const parts = r.parts.map(p => {
      const cls = `${p.kind === 'span' ? 'sp' : ''} ${p.show ? 'show' : ''} ${p.pencil ? 'pencil' : ''}`;
      const ink = p.ink ? ` style="color:${p.ink}"` : '';
      return `<span class="${cls}" data-eid="${p.id}"${ink}>${p.kind === 'timed' ? `<i class="tm">${p.time}</i>` : ''}${esc(p.text)}</span>`;
    }).join('');
    let col = '';
    if (r.tour) {
      col = `<div class="tour ${r.tour.tbc ? 'tbc' : ''} ${r.tour.open ? 'open' : ''}" data-eid="${r.tour.id}">`
        + (r.tour.open ? `<span class="nm">${esc(r.tour.name)}</span>` : (r.tour.perf ? `<b class="perf">${r.tour.perf}</b>` : (r.tour.word ? `<span class="tw">${esc(r.tour.word)}</span>` : '')))
        + '</div>';
    }
    const info = r.info ? `<span class="info ${r.info.kind}${r.info.tbc ? ' tbc' : ''}${r.info.long ? ' long' : ''}">${esc(r.info.text)}</span>` : '<span class="info"></span>';
    html += `<div class="day ${r.red ? 'red' : ''} ${r.sun ? 'sun' : ''} ${r.hol ? 'hol' : ''} ${r.tour ? '' : 'notour'} ${r.today ? 'today' : ''}" data-date="${r.ds}">`
      + `<span class="n">${r.d}</span><span class="w">${L().wd[r.wi]}</span>`
      + `<span class="gut">${gut}</span><span class="line">${parts}</span>${col}${info}</div>`;
  }
  for (let d = n + 1; d <= 31; d++) html += '<div class="day pad"></div>';
  return html + '</section>';
}

// WHOLE ENTRIES, THEN +n — the one pass that measures the page
function clipLines() {
  document.querySelectorAll('.line').forEach(line => {
    const kids = [...line.children];
    if (kids.length < 2) return;
    const w = line.clientWidth - 2;
    let used = 0, hidden = 0;
    kids.forEach((k, i) => {
      const room = i < kids.length - 1 ? 26 : 0;    // keep space for the +n
      used += k.offsetWidth + (i ? 8 : 0);
      // THE FIRST ENTRY ALWAYS STANDS (Alan's October, 08.10: a day reading only
      // "+2"). If it is wider than the line it is cut with an ellipsis instead.
      if (i > 0 && (hidden || used > w - room)) { k.hidden = true; hidden++; }
    });
    if (hidden) {
      const b = document.createElement('span');
      b.className = 'more'; b.textContent = '+' + hidden;
      line.appendChild(b);
    }
    if (kids.filter(k => !k.hidden).length === 1) kids.find(k => !k.hidden).classList.add('lone');
    if (hidden && kids[0].offsetWidth + 34 > w) kids[0].classList.add('lone');
  });
}


/* ---------- the moon: copied verbatim from v2/app.js ---------- */

const MOON = [
  { g: '\u25cf', no: 'Nymåne', en: 'New moon' },
  { g: '\u25d0', no: 'Første kvarter', en: 'First quarter' },
  { g: '\u25cb', no: 'Fullmåne', en: 'Full moon' },
  { g: '\u25d1', no: 'Siste kvarter', en: 'Last quarter' },
];
const RAD = Math.PI / 180;
const sin = a => Math.sin(a * RAD), cos = a => Math.cos(a * RAD);

// Julian Ephemeris Day of the phase `q` (0 new, 1 first, 2 full, 3 last) for
// lunation k, counted from the new moon of 6 January 2000.
function phaseJDE(k, q) {
  k += q / 4;
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;          // sun
  const M1 = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;  // moon
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;
  if (q === 0 || q === 2) {
    const a = q === 0 ? -0.4072 : -0.40614, b = q === 0 ? 0.17241 : 0.17302,
          c = q === 0 ? 0.01608 : 0.01614, d = q === 0 ? 0.01039 : 0.01043,
          e = q === 0 ? 0.00739 : 0.00734;
    jde += a * sin(M1) + b * E * sin(M) + c * sin(2 * M1) + d * sin(2 * F)
      + e * E * sin(M1 - M) - 0.00514 * E * sin(M1 + M) + 0.00208 * E * E * sin(2 * M)
      - 0.00111 * sin(M1 - 2 * F) - 0.00057 * sin(M1 + 2 * F) + 0.00056 * E * sin(2 * M1 + M)
      - 0.00042 * sin(3 * M1) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F)
      - 0.00024 * E * sin(2 * M1 - M) - 0.00017 * sin(O) - 0.00007 * sin(M1 + 2 * M);
  } else {
    jde += -0.62801 * sin(M1) + 0.17172 * E * sin(M) - 0.01183 * E * sin(M1 + M)
      + 0.00862 * sin(2 * M1) + 0.00804 * sin(2 * F) + 0.00454 * E * sin(M1 - M)
      + 0.00204 * E * E * sin(2 * M) - 0.0018 * sin(M1 - 2 * F) - 0.0007 * sin(M1 + 2 * F)
      - 0.0004 * sin(3 * M1) - 0.00034 * E * sin(2 * M1 - M) + 0.00032 * E * sin(M + 2 * F)
      + 0.00032 * E * sin(M - 2 * F) - 0.00028 * E * E * sin(M1 + 2 * M) + 0.00027 * E * sin(2 * M1 + M)
      - 0.00017 * sin(O);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(M1)
      - 0.00002 * cos(M1 - M) + 0.00002 * cos(M1 + M) + 0.00002 * cos(2 * F);
    jde += q === 1 ? W : -W;
  }
  return jde;
}

// every turn in a year, as { 'YYYY-MM-DD': MOON[q] }, worked out once
const moonCache = {};
function moonYear(y) {
  if (moonCache[y]) return moonCache[y];
  const map = {};
  const k0 = Math.floor((y - 2000) * 12.3685) - 1;
  for (let k = k0; k < k0 + 15; k++) {
    for (let q = 0; q < 4; q++) {
      // JDE is dynamical time; ΔT is about a minute this century, far inside a
      // date. JD 2440587.5 is the Unix epoch.
      const ms = (phaseJDE(k, q) - 2440587.5) * 86400000;
      const key = fmt(new Date(ms));            // his own local date, as everywhere else
      if (key.slice(0, 4) === String(y)) map[key] = MOON[q];
    }
  }
  moonCache[y] = map;
  return map;
}
function moonTurn(ds) { return moonYear(Number(ds.slice(0, 4)))[ds] || null; }

/* ---------- the year ---------- */

function mondayOf(ds) { const d = parseDate(ds); d.setDate(d.getDate() - weekdayIdx(d)); return d; }

// THE PHONE'S YEAR IS TWELVE SMALL MONTHS AGAIN (Alan, 09.10: "prefer the old year
// view on phone with months"; the poster was beautiful and unreadable without a tap).
// Each month a small grid, Monday first: Sundays and holidays red, a tour's days on
// the tour's tint, a show day with a red mark under its figure, today framed. A tap on
// a month's name opens the month; a tap on a day opens the month with that day.
function renderMiniYear(y) {
  const hol = holidays(y);
  const todayStr = fmt(new Date());
  const tour = tourEvents();
  const legs = tour.filter(e => e.end > e.start);
  const shows = new Set(ownEvents().filter(e => e.end === e.start && isShow(e)).map(e => e.start));
  tour.filter(e => e.end === e.start && perfNo(e.title)).forEach(e => shows.add(e.start));
  let html = '<section class="miniyear">';
  for (let m = 0; m < 12; m++) {
    html += `<div class="mini" data-m="${m}"><h3 data-m="${m}">${L().months[m]}</h3><div class="mg">`;
    html += L().wd.map((w, i) => `<i class="wl${i === 6 ? ' red' : ''}">${w.slice(0, 1)}</i>`).join('');
    const first = weekdayIdx(new Date(y, m, 1));
    for (let k = 0; k < first; k++) html += '<i></i>';
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const ds = key3(y, m, d), wi = (first + d - 1) % 7, h = hol[ds];
      const leg = legs.find(l => l.start <= ds && l.end >= ds);
      html += `<b data-date="${ds}" class="${wi === 6 || (h && h.red) ? 'red' : ''} ${leg ? (isTbc(leg) ? 'tour tbc' : 'tour') : ''} ${shows.has(ds) ? 'show' : ''} ${ds === todayStr ? 'today' : ''}">${d}</b>`;
    }
    html += '</div></div>';
  }
  return html + '</section>';
}
const key3 = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// THE WEEK'S RULES HANG FROM THEIR NAMES (Alan, 08.10: "the line from the multi day
// should connect to the multi day at the top"). One rule per span, measured after the
// page is drawn: it starts at its name in the head of the page with a short tick into
// it, and runs down to the day the span ends (or off the foot of the week).
function drawWeekRules() {
  const wk = document.querySelector('.week');
  if (!wk) return;
  wk.querySelectorAll('.wrule').forEach(x => x.remove());
  const box = wk.getBoundingClientRect();
  const days = [...wk.querySelectorAll('.wd[data-date]')];
  if (!days.length) return;
  [...wk.querySelectorAll('.spans > div[data-start]')].forEach((row, i) => {
    const x = 10 + i * 5;
    const r = row.getBoundingClientRect();
    const top = r.top + r.height / 2 - box.top;
    const end = days.filter(d => d.dataset.date <= row.dataset.end).pop();
    if (!end) return;
    // A SPAN IS SOLID ONLY ON ITS OWN DAYS (Alan, 08.10: "a span looks like it runs
    // the whole week when in fact it is Wed–Sun"). From its name down to the day it
    // begins it is a faint dotted lead; solid from that day's head to its last day.
    const startDay = days.find(d => d.dataset.date >= row.dataset.start);
    const startsLater = startDay && startDay !== days[0] && row.dataset.start > days[0].dataset.date;
    const endsHere = row.dataset.end <= days[days.length - 1].dataset.date;
    const er = end.getBoundingClientRect();
    const bottom = (endsHere ? er.top + 22 : er.bottom) - box.top;
    const c = row.dataset.color;
    const solidTop = startsLater ? startDay.getBoundingClientRect().top + 14 - box.top : top;
    if (startsLater) {
      const lead = document.createElement('i');
      lead.className = 'wrule lead';
      lead.style.cssText = `left:${x}px;top:${top}px;height:${Math.max(0, solidTop - top)}px;border-left:1.5px dotted ${c}`;
      wk.append(lead);
    }
    const v = document.createElement('i');
    v.className = 'wrule'; v.style.cssText = `left:${x}px;top:${solidTop}px;width:1.5px;height:${Math.max(0, bottom - solidTop)}px;background:${c}`;
    const t = document.createElement('i');
    t.className = 'wrule'; t.style.cssText = `left:${x}px;top:${top - 0.75}px;width:${22 - x}px;height:1.5px;background:${c}`;
    wk.append(v, t);
  });
}

/* ---------- the week: the schedule page ---------- */

function renderWeek(monKey) {
  const mon = parseDate(monKey);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); days.push(d); }
  const first = fmt(days[0]), last = fmt(days[6]);
  const todayStr = fmt(new Date());
  const tourIds = new Set(tourCalIds());
  const tour = tourEvents();
  const legs = tour.filter(e => e.end > e.start).sort((a, b) => (a.start < b.start ? 1 : -1));
  const words = tour.filter(e => e.end === e.start);
  const own = ownEvents();
  const spans = own.filter(e => e.end > e.start && e.start <= last && e.end >= first)
    .sort((a, b) => a.start < b.start ? -1 : 1).slice(0, 3);
  // the week's single-day things: his, and the schedule's — never the tour's words
  const singles = state.events.filter(e => e.end === e.start && e.start >= first && e.start <= last && !tourIds.has(e.calId));
  let html = '<section class="week">';
  if (spans.length) {
    html += '<div class="spans">' + spans.map(sp =>
      `<div data-eid="${sp.id}" data-start="${sp.start}" data-end="${sp.end}" data-color="${evColor(sp)}">${esc(stripParens(deco(sp.title)))} <small>${esc(shortRange(sp.start, sp.end))}</small></div>`).join('') + '</div>';
  }
  for (const d of days) {
    const ds = fmt(d), wi = weekdayIdx(d), h = holidays(d.getFullYear())[ds];
    const leg = legs.find(l => l.start <= ds && l.end >= ds) || null;
    const word = leg ? words.find(w => w.start === ds) : null;
    const perf = word ? perfNo(word.title) : null;
    const dayEv = singles.filter(e => e.start === ds);
    const allday = dayEv.filter(e => !effTime(e)), timed = dayEv.filter(e => effTime(e)).sort((a, b) => effTime(a) < effTime(b) ? -1 : 1);
    const show = !!perf || dayEv.some(isShow);
    const moon = moonTurn(ds);
    let ctx = '';
    if (leg) {
      const w = perf ? `${esc(legName(leg))} ${perf}` : (word ? esc(SHORT[deco(word.title).trim().toLowerCase()] || deco(word.title)) : esc(legName(leg)));
      ctx = `<span class="ctx ${perf ? 'perf' : ''} ${isTbc(leg) ? 'tbc' : ''}">${w}${legCity(leg) ? ' · ' + esc(legCity(leg)) : ''}</span>`;
    } else if (h) ctx = `<span class="ctx hn">${esc(h.name)}</span>`;
    html += `<div class="wd ${wi === 6 || (h && h.red) ? 'red' : ''} ${wi === 6 ? 'sun' : ''} ${show ? 'show' : ''} ${ds === todayStr ? 'today' : ''} ${dayEv.length ? '' : 'quiet'}" data-date="${ds}">`;
    html += `<div class="dh"><span class="dn"><b>${d.getDate()}</b>${L().wdLong[wi]}${moon ? `<i class="moon" title="${esc(moon[state.lang] || moon.no)}">${moon.g}</i>` : ''}</span>${ctx}</div>`;
    const names = spans.filter(sp => sp.start <= ds && sp.end >= ds).map(sp => sp.title);
    for (const e of allday) html += line(e, '', names);
    for (const e of timed) html += line(e, effTime(e), names);
    html += '</div>';
  }
  return html + '</section>';
  function line(e, tm, names) {
    return `<p class="ln ${isShow(e) ? 'show' : ''} ${isPencil(e) || isTbc(e) ? 'pencil' : ''}" data-eid="${e.id}">`
      + `<i class="tm">${tm}</i><i class="dot" style="background:${evColor(e)}"></i>`
      + `<span class="tt"${evInk(e) ? ` style="color:${evInk(e)}"` : ''}>${esc(tm ? stripClock(wallTitle(deco(e.title), names)) : lineTitle(e, names))}${hasNote(e) ? ' <u>∗</u>' : ''}</span></p>`;
  }
}

/* ---------- the widget's snapshot ---------- */

// THE WIDGET IS FED, NEVER FETCHING (STATUS, 23.09): after every render the app
// writes a small JSON of the next weeks — a day's city, week, tour word, show,
// and its lines — and hands it to the native wrapper, which keeps it in the
// App Group for the widget. Nothing of Google's reaches the widget directly.
function snapshot() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1); from.setDate(from.getDate() - 7);
  const to = new Date(now); to.setDate(now.getDate() + 62);
  const schedIds = new Set(scheduleCalIds());
  const days = [];
  for (let y = from.getFullYear(), m = from.getMonth(); new Date(y, m, 1) <= to; m++) {
    if (m > 11) { m = 0; y++; }
    const { rows, nLanes } = monthData(y, m);
    for (const r of rows) {
      const d = parseDate(r.ds);
      if (d < from || d > to) continue;
      // the schedule's calls join the day's lines in the widget, as in the week
      const calls = state.events.filter(e => e.end === e.start && e.start === r.ds && schedIds.has(e.calId))
        .map(e => ({ kind: 'timed', time: effTime(e) || '', text: stripClock(deco(e.title)), color: evColor(e), ink: '', show: isShow(e), pencil: false }));
      // only real colours cross to the widget; a show is red by its own flag there
      const hex = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
      const parts = r.parts.map(p => ({ kind: p.kind, time: p.time || '', text: p.text, color: hex(p.color), ink: hex(p.ink), show: !!p.show, pencil: !!p.pencil }))
        .concat(calls).sort((a, b) => (a.kind === 'timed' ? 1 : 0) - (b.kind === 'timed' ? 1 : 0) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      days.push({ date: r.ds, d: r.d, wi: r.wi, wd: r.wd, wl: L().wd[r.wi], week: r.week, hol: r.hol, red: r.red, sun: r.sun,
        city: r.city, tbc: r.tbc, show: r.show, nLanes,
        lanes: r.lanes.map(l => l ? { color: l.color, a: l.a, z: l.z } : { color: '', a: false, z: false }),
        info: r.info ? { kind: r.info.kind, text: r.info.text, tbc: !!r.info.tbc } : null,
        tour: r.tour ? { name: r.tour.name, word: r.tour.word, perf: r.tour.perf, city: r.tour.city, tbc: r.tour.tbc, open: r.tour.open } : null,
        parts });
    }
  }
  return { generated: new Date().toISOString(), lang: state.lang, months: L().months, days };
}
function publishSnapshot() {
  if (state.mode !== 'google' && !/[?&]demo\b/.test(location.search)) return;
  let snap;
  try { snap = snapshot(); } catch (e) { return; }
  try { localStorage.setItem('almanakk3-snapshot', JSON.stringify(snap)); } catch (e) { /* full */ }
  try { window.webkit?.messageHandlers?.almanakk?.postMessage(JSON.stringify(snap)); } catch (e) { /* not in the app */ }
}

/* ---------- render ---------- */

const SPREAD = window.matchMedia('(min-width: 1000px)');
function render() {
  closeDay();
  const app = $('#app');
  const yr = $('#yr');
  yr.hidden = false;
  if (state.view === 'year' && SPREAD.matches) {
    // SIX OVER SIX (Alan, 17.09 and 07.10): twelve real sheets, the same row
    let html = '';
    for (let m = 0; m < 12; m++) html += renderMonth(state.year, m);
    app.className = 'year12';
    app.innerHTML = html;
    $('#title').textContent = state.year; yr.hidden = true;
  } else if (state.view === 'year') {
    app.className = 'miniwrap';
    app.innerHTML = renderMiniYear(state.year);
    $('#title').textContent = state.year; yr.hidden = true;
  } else if (state.view === 'week') {
    const mon = mondayOf(state.weekOf || fmt(new Date()));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    app.className = 'weekview';
    app.innerHTML = renderWeek(fmt(mon));
    const mn = mon.getMonth() === sun.getMonth() ? L().months[mon.getMonth()]
      : L().months[mon.getMonth()].slice(0, 3) + ' – ' + L().months[sun.getMonth()].slice(0, 3);
    // on the phone the week's number alone: the month is written on its days
    $('#title').textContent = SPREAD.matches ? `${L().week.toUpperCase()} ${isoWeek(mon)} · ${mn}` : `${L().week.toUpperCase()} ${isoWeek(mon)}`;
  } else if (SPREAD.matches) {
    // THREE MONTHS IS THE ALMANAC on a desk: a fixed third of the year
    const q = Math.floor(state.month / 3) * 3;
    app.className = 'quarter';
    app.innerHTML = renderMonth(state.year, q) + renderMonth(state.year, q + 1) + renderMonth(state.year, q + 2);
    $('#title').textContent = L().months[q] + ' – ' + L().months[q + 2];
  } else {
    app.className = 'strip';
    app.innerHTML = renderMonth(state.year, state.month);
    $('#title').textContent = L().months[state.month];
  }
  yr.textContent = state.year;
  yr.dataset.yr = String(((state.year - 2026) % 5 + 5) % 5);
  clipLines();
  drawWeekRules();
  applyLang();
  clearTimeout(render._snap); render._snap = setTimeout(publishSnapshot, 300);
  document.querySelectorAll('#more-list [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
}
SPREAD.addEventListener('change', render);
window.addEventListener('resize', () => { clearTimeout(render._r); render._r = setTimeout(render, 120); });

function applyLang() {
  $('#print').textContent = L().print;
  $('#lang-chip').textContent = L().lang;
  $('#today').textContent = L().today;
  $('#home').textContent = L().today;
  $('#title').classList.toggle('toggle', state.view !== 'year');
  const now = new Date();
  const onToday = state.view === 'year' ? state.year === now.getFullYear()
    : state.view === 'week' ? fmt(mondayOf(state.weekOf || fmt(now))) === fmt(mondayOf(fmt(now)))
    : SPREAD.matches ? state.year === now.getFullYear() && Math.floor(state.month / 3) === Math.floor(now.getMonth() / 3)
    : state.year === now.getFullYear() && state.month === now.getMonth();
  $('#home').classList.toggle('here', onToday);
  $('#tour-chip').textContent = L().tour;
  $('#tour-chip').classList.toggle('active', state.wg);
  $('#signin').textContent = L().signin;
  $('#cal-picker summary').textContent = L().cals;
  const vn = { month: L().month, week: L().weekName, year: L().year };
  document.querySelectorAll('#more-list [data-view]').forEach(b => { b.textContent = vn[b.dataset.view]; });
}
window.updateChips = () => applyLang();

/* ---------- the day sheet: tap a day; tap a line to edit it ---------- */

function calName(id) { const c = allCalendars().find(x => x.id === id); return c ? c.name : ''; }
function writableCals() {
  return state.mode === 'google' ? allCalendars().filter(c => c.writable) : DEMO_CALENDARS;
}
// a title that is nothing but a place he could fly to is offered as a trip
function barePlace(title) {
  const t = String(title || '').trim();
  if (!t || /[,(]/.test(t)) return null;
  if (cityMarker(t)) return cityMarker(t);
  if (t.split(/\s+/).length > 3) return null;
  return placeOf(t) ? t : null;
}
const mapLink = v => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v);

let openedAt = 0;
function openDay(ds) {
  openedAt = Date.now();
  const editing = state.editing, full = state.sheetFull, viewing = state.viewing;   // closeDay forgets them; a reopen must not
  closeDay(true);
  state.open = ds; state.editing = editing; state.sheetFull = full; state.viewing = viewing;
  const date = parseDate(ds), wi = weekdayIdx(date);
  const h = holidays(date.getFullYear())[ds];
  const tour = new Set(tourCalIds());
  const here = whereOn(ds, buildFlightIndex(), tourEvents().filter(e => e.end > e.start));
  const all = state.events.filter(e => e.start <= ds && e.end >= ds);
  const byTour = (a, b) => (tour.has(a.calId) ? 1 : 0) - (tour.has(b.calId) ? 1 : 0);
  const spans = all.filter(e => e.end > e.start).sort(byTour);
  const allday = all.filter(e => e.end === e.start && !effTime(e)).sort(byTour);
  const timed = all.filter(e => e.end === e.start && effTime(e)).sort((a, b) => effTime(a) < effTime(b) ? -1 : 1);
  const row = e => String(e.id) === String(state.editing) ? form(e)
    : String(e.id) === String(state.viewing) ? details(e)
    : `<p class="ev ${isShow(e) ? 'show' : ''} ${isPencil(e) || isTbc(e) ? 'pencil' : ''} ${tour.has(e.calId) ? 'wg' : ''}" data-eid="${e.id}">`
    + `<i class="tm">${esc(effTime(e) || '')}</i><i class="dot" style="background:${evColor(e)}"></i>`
    + `<b${evInk(e) ? ` style="color:${evInk(e)}"` : ''}>${esc(effTime(e) ? stripClock(deco(e.title)) : deco(e.title))}${hasNote(e) ? ' <u>∗</u>' : ''}</b>`
    + (e.end > e.start ? `<small>${esc(shortRange(e.start, e.end))}</small>` : `<small>${esc(calName(e.calId))}</small>`) + '</p>';
  const tgt = window.gcalTarget && window.gcalTarget();
  const sheet = document.createElement('div');
  sheet.id = 'daysheet';
  sheet.classList.toggle('editing', !!state.editing);
  sheet.classList.toggle('full', !!state.sheetFull);   // a day stepped to keeps its height
  const draft = state.editing === 'new' ? form({ id: 'new', title: state.draft || '', start: ds, end: ds, time: '', endTime: '', location: '', notes: '', calId: tgt ? tgt.id : '', color: tgt ? tgt.color : '' }) : '';
  sheet.innerHTML = `<i class="grab"></i><header><span class="dn"><b>${date.getDate()}</b> ${L().wdLong[wi]}</span>`
    + `<span>${here ? `<em class="cty ${here.tbc ? 'tbc' : ''}">${esc(here.name)}</em>` : ''}`
    + `${h ? `<em class="hn">${esc(h.name)}</em>` : ''}${L().week} ${isoWeek(date)}</span></header>`
    + `<div class="list">${spans.map(row).join('')}${allday.map(row).join('')}`
    + (timed.length && (spans.length || allday.length) ? '<hr>' : '') + `${timed.map(row).join('')}</div>`
    + draft
    + (state.editing === 'new' ? '' : `<form class="qa"><input type="text" placeholder="${L().newLine}" autocomplete="off" enterkeyhint="send"><button type="submit">${L().add}</button><button type="button" class="more">${L().more}</button></form>`
    + (tgt ? `<p class="target"><i class="dot" style="background:${tgt.color}"></i>${L().goesTo} ${esc(tgt.name)}</p>` : ''));
  document.body.appendChild(sheet);
  document.querySelector(`.day[data-date="${ds}"], .wd[data-date="${ds}"]`)?.classList.add('open');
  wireSheet(sheet, ds);
  const first = sheet.querySelector('.edit [name="title"]');
  if (first && state.editing === 'new') { first.focus(); first.setSelectionRange(first.value.length, first.value.length); }
  sheet.querySelector('.edit')?.scrollIntoView({ block: 'nearest' });
}

// READ FIRST, EDIT WHEN ASKED (Alan, 08.10: "weird to open to see the end time of an
// event and drop into edit mode — edit when you want, like Apple Calendar"). A tap on
// an entry opens it in place: when it runs from and to, where (with the map), the notes
// with their links live, the calendar, the repeat, the guests. Endre opens the form.
function details(e) {
  const t = effTime(e);
  const when = e.end > e.start ? shortRange(e.start, e.end) + (t ? ` · ${t}${e.endTime ? '–' + e.endTime : ''}` : '')
    : t ? `${t}${e.endTime && e.endTime !== t ? '–' + e.endTime : ''}` : L().fAllDay;
  const zone = t && e.tz && e.tz !== 'Europe/Oslo' ? ` <i>${esc(e.tz.replace(/_/g, ' '))}</i>` : '';
  const notes = withoutPencil(e.notes).trim();
  const rep = repeatOf(e).kind;
  const rows = [
    `<dt>${L().fWhen}</dt><dd>${esc(when)}${zone}</dd>`,
    e.location ? `<dt>${L().fWhere}</dt><dd>${linkify(e.location)} <a class="maplink" target="_blank" rel="noopener" href="${mapLink(e.location)}">${L().onMap}</a></dd>` : '',
    notes ? `<dt>${L().fNotes}</dt><dd class="notes">${linkify(notes)}</dd>` : '',
    rep ? `<dt>${L().fRepeat}</dt><dd>${esc(L().rep[rep])}</dd>` : '',
    (e.attendees || []).length ? `<dt>${L().fGuests}</dt><dd>${esc(e.attendees.join(', '))}</dd>` : '',
    `<dt>${L().fCal}</dt><dd>${esc(calName(e.calId))}${isPencil(e) ? ' · ' + L().pencil : ''}</dd>`,
  ].join('');
  return `<div class="evd" data-eid="${e.id}">`
    + `<p class="ev open ${isShow(e) ? 'show' : ''}" data-eid="${e.id}"><i class="tm">${esc(t || '')}</i><i class="dot" style="background:${evColor(e)}"></i>`
    + `<b${evInk(e) ? ` style="color:${evInk(e)}"` : ''}>${esc(t ? stripClock(deco(e.title)) : deco(e.title))}</b><small></small></p>`
    + `<dl>${rows}</dl>`
    + `<div class="btns"><button type="button" data-editev="${e.id}">${L().edit}</button></div></div>`;
}
// THE NOTES' LINKS ARE LINKS (Alan, 08.10: his mother's flight carries the Apple Mail
// link to its booking mail — "I wanted to open the mail"). http, mailto, tel and
// message: (Mail's own) become links; a Mail link reads as "Åpne e-posten". In the app
// the wrapper hands them to the system, so Mail opens the very message.
function linkify(raw) {
  // A NOTE MAY ARRIVE AS HTML (Google stores links that way, and so does a note pasted
  // from Mail): its links are taken by their address and their markup dropped, so the
  // reader sees words and "Åpne e-posten", never a tag or a raw address (Alan, 09.10:
  // "less technical — not the whole URL, only 'open mail'").
  raw = String(raw)
    .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, ' $1 ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  raw = deco(raw);
  const re = /(https?:\/\/[^\s<>"]+|message:\/{0,2}[^\s"]+|mailto:[^\s<>"]+|tel:[+\d][\d\s-]*\d)/gi;
  let out = '', last = 0, m;
  while ((m = re.exec(raw))) {
    out += esc(raw.slice(last, m.index)).replace(/\n/g, '<br>');
    const url = m[0].replace(/[).,;:]+$/, '');
    const mail = /^message:/i.test(url) || /^https?:\/\/(mail\.google\.com|outlook\.(live|office|office365)\.com\/mail|www\.icloud\.com\/mail)/i.test(url);
    const label = mail ? '✉ ' + L().openMail
      : /^https?:/i.test(url) ? url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/.*$/, '') + ' ↗'
      : url.replace(/^(mailto|tel):/i, '');
    out += `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
    last = m.index + url.length; re.lastIndex = last;
  }
  return out + esc(raw.slice(last)).replace(/\n/g, '<br>');
}

// WRITING TAKES THE WHOLE SHEET (Alan, 09.10: "Ny hendelse — click to add doesn't
// work, glitches when bringing up the editor"). Lifting the sheet's bottom above the
// keyboard moved it while iOS was also scrolling the page, and the line jumped out from
// under the finger. Now, the moment a field in the sheet takes focus, the sheet stands
// at full height and does not move again; the keyboard's height (from the visual
// viewport) becomes padding at its foot, and the field is scrolled into the part of the
// sheet the keyboard leaves visible. The page itself is held at the top.
(function writingMode() {
  const vv = window.visualViewport;
  const fit = () => {
    const s = document.querySelector('#daysheet');
    if (!s || !s.classList.contains('writing')) return;
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    s.style.paddingBottom = (kb + 24) + 'px';
    const f = document.activeElement;
    if (f && s.contains(f)) {
      // scroll only as far as it takes to clear the keyboard, so the day's head stays
      const sr = s.getBoundingClientRect(), fr = f.getBoundingClientRect();
      const visibleBottom = (vv ? vv.height + vv.offsetTop : window.innerHeight) - 16;
      if (fr.bottom > visibleBottom) s.scrollTop += fr.bottom - visibleBottom;
      else if (fr.top < sr.top + 8) s.scrollTop -= (sr.top + 8) - fr.top;
    }
    window.scrollTo(0, 0);
  };
  document.addEventListener('focusin', e => {
    const s = document.querySelector('#daysheet');
    if (!s || !s.contains(e.target) || !e.target.matches('input, textarea, select')) return;
    s.classList.add('writing');
    fit(); setTimeout(fit, 120); setTimeout(fit, 400);
  });
  document.addEventListener('focusout', () => setTimeout(() => {
    const s = document.querySelector('#daysheet');
    if (!s || s.contains(document.activeElement)) return;
    s.classList.remove('writing'); s.style.paddingBottom = '';
  }, 150));
  if (vv) { vv.addEventListener('resize', fit); }
})();

// THE LINE IS THE FORM (E1): tap an entry and it opens in place — no buttons on
// the rows. Title, the clock or Heldags, the dates, the place, the notes, the
// pencil, the calendar; Lagre, Slett, Lukk. No colour swatches: his clients throw
// event colours away (03.09), and v3 does not paint words by colour anyway.
function form(e) {
  const isNew = e.id === 'new';
  const cals = writableCals();
  // a clock written into the title (sample data, or a line typed as "13:00 x")
  // is the clock, and leaves the title
  if (!e.time && effTime(e)) e = { ...e, time: effTime(e), title: stripClock(e.title) };
  const rep = repeatOf(e), rem = reminderOf(e);
  const tz = e.tz || 'Europe/Oslo';
  const zones = ZONES.includes(tz) ? ZONES : [tz, ...ZONES];
  return `<form class="edit" data-eid="${e.id}">`
    + `<input name="title" type="text" placeholder="${L().fTitle}" value="${esc(e.title || '')}" autocomplete="off">`
    + `<div class="frow">`
    + `<label class="tick"><input type="checkbox" name="allday"${e.time ? '' : ' checked'}><span>${L().fAllDay}</span></label>`
    + `<label>${L().fFromClock}<input name="time" type="time" value="${esc(e.time || '')}"${e.time ? '' : ' disabled'}></label>`
    + `<label>${L().fToClock}<input name="endtime" type="time" value="${esc(e.endTime || '')}"${e.time ? '' : ' disabled'}></label>`
    + `</div><div class="frow">`
    + `<label>${L().fFrom}<input name="start" type="date" value="${esc(e.start)}"></label>`
    + `<label>${L().fTo}<input name="end" type="date" value="${esc(e.end)}"></label>`
    + `<label class="tzl"${e.time ? '' : ' hidden'}>${L().fTz}<select name="tz">${zones.map(z => `<option value="${esc(z)}"${z === tz ? ' selected' : ''}>${esc(z.replace(/_/g, ' '))}</option>`).join('')}</select></label>`
    + `</div>`
    + `<label class="where">${L().fWhere}<span><input name="location" type="text" value="${esc(e.location || '')}">`
    + `<a class="maplink" target="_blank" rel="noopener" href="${mapLink(e.location || '')}"${e.location ? '' : ' hidden'}>${L().onMap}</a></span></label>`
    + `<label>${L().fNotes}<textarea name="notes" rows="2">${esc(withoutPencil(e.notes))}</textarea></label>`
    + `<label>${L().fGuests}<input name="guests" type="text" inputmode="email" autocomplete="off" value="${esc((e.attendees || []).join(', '))}"></label>`
    + `<div class="frow">`
    + `<label>${L().fRepeat}${e.recurringEventId ? ` <small>(${L().series})</small>` : ''}<select name="repeat">${L().rep.map((w, i) => `<option value="${i}"${i === rep.kind ? ' selected' : ''}>${w}</option>`).join('')}</select></label>`
    + `<label class="untill"${rep.kind ? '' : ' hidden'}>${L().repUntil}<input name="until" type="date" value="${esc(rep.until || '')}"></label>`
    + `<label>${L().fRemind}<select name="remind">${L().rem.map((w, i) => `<option value="${i}"${i === rem ? ' selected' : ''}>${w}</option>`).join('')}</select></label>`
    + `</div>`
    + `<div class="colour"><span class="lbl">${L().fColour}</span><span class="swatches" data-cid="${esc(DUSTY[e.colorId] ? e.colorId : '')}" data-was="${esc(e.colorId || '')}">`
    + `<i class="sw ${DUSTY[e.colorId] ? '' : 'on'}" data-cid="" title="${L().calColour}" style="--c:${calColor(e)}"></i>`
    + DUSTY_ORDER.map(id => [id, DUSTY[id]]).map(([id, c]) => `<i class="sw ${String(e.colorId) === id ? 'on' : ''}" data-cid="${id}" style="--c:${c}"></i>`).join('')
    + `</span></div>`
    + `<div class="frow ticks">`
    + `<label class="tick"><input type="checkbox" name="pencil"${isPencil(e) || (cityMarker(e.title || '') && isTbc(e)) ? ' checked' : ''}><span>${L().pencil}</span></label>`
    + `<label class="tick dtrip"${barePlace(e.title) ? '' : ' hidden'}><input type="checkbox" name="trip"${(isNew ? barePlace(e.title) : cityMarker(e.title || '')) ? ' checked' : ''}><span>${L().trip}</span></label>`
    + `<label class="cal">${L().fCal}<select name="cal">${cals.map(c => `<option value="${esc(c.id)}"${c.id === e.calId ? ' selected' : ''}>${esc(c.name || c.id)}</option>`).join('')}</select></label>`
    + `</div>`
    + `<div class="btns"><button type="submit" class="save">${L().save}</button>`
    + (isNew ? '' : `<button type="button" class="del" data-del="${e.id}">${L().del}</button>`)
    + `<button type="button" class="close" data-close="1">${L().closeEdit}</button></div>`
    + '</form>';
}

// the zones he actually lands in; the event's own is always offered too
const ZONES = ['Europe/Oslo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam', 'Europe/Rome',
  'Europe/Madrid', 'Europe/Athens', 'Europe/Helsinki', 'Europe/Istanbul', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Taipei',
  'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Dubai', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney'];
// repeat: the first RRULE, read as one of the six kinds the form offers
const RRULES = ['', 'RRULE:FREQ=DAILY', 'RRULE:FREQ=WEEKLY', 'RRULE:FREQ=WEEKLY;INTERVAL=2', 'RRULE:FREQ=MONTHLY', 'RRULE:FREQ=YEARLY'];
function repeatOf(e) {
  const r = (e.recurrence || []).find(x => /^RRULE:/i.test(x)) || '';
  if (!r) return { kind: 0, until: '' };
  const m = r.match(/UNTIL=(\d{4})(\d{2})(\d{2})/);
  const until = m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  const freq = (r.match(/FREQ=(\w+)/) || [])[1], iv = Number((r.match(/INTERVAL=(\d+)/) || [])[1] || 1);
  const kind = freq === 'DAILY' ? 1 : freq === 'WEEKLY' ? (iv === 2 ? 3 : 2) : freq === 'MONTHLY' ? 4 : freq === 'YEARLY' ? 5 : 0;
  return { kind, until };
}
function rruleFor(kind, until) {
  const base = RRULES[Number(kind)] || '';
  if (!base) return [];
  return [base + (until ? ';UNTIL=' + until.replace(/-/g, '') + 'T235959Z' : '')];
}
// reminders: 0 none · 1 the calendar's default · 2.. minutes before
const REM_MIN = [null, null, 0, 10, 30, 60, 1440];
function reminderOf(e) {
  const r = e.reminders;
  if (!r) return 1;
  if (r.useDefault) return 1;
  const o = (r.overrides || [])[0];
  if (!o) return 0;
  const i = REM_MIN.indexOf(o.minutes);
  return i > 1 ? i : 2;
}
function remindersFor(i) {
  i = Number(i);
  if (i === 1) return { useDefault: true };
  if (i === 0) return { useDefault: false, overrides: [] };
  return { useDefault: false, overrides: [{ method: 'popup', minutes: REM_MIN[i] }] };
}

function wireSheet(sheet, ds) {
  const qa = sheet.querySelector('.qa');
  if (qa) {
    qa.addEventListener('submit', async e => {
      e.preventDefault();
      if (qa.dataset.busy) return;
      const text = qa.querySelector('input').value.trim();
      if (!text) return closeDay();
      qa.dataset.busy = '1';
      qa.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
      try { await addEvent(ds, text); closeDay(true); }
      catch (err) {
        toast(err.message);
        delete qa.dataset.busy;
        qa.querySelectorAll('input, button').forEach(el => { el.disabled = false; });
      }
    });
    // THE SHEET'S HEAD IS ITS WAY TO WRITE (DESIGN session, 08.10, item 4b): a tap on
    // the figure and the name unfolds the quick-add line, focused
    sheet.querySelector('header .dn').addEventListener('click', () => focusAdd());
    // SKJEMA IS TAKEN ON THE PRESS, NOT THE CLICK (Alan, 08.10: "skjema button does
    // not work"): it shows only while the line has focus, and the tap took the focus
    // away first, so it vanished before the click could land
    qa.querySelectorAll('button').forEach(btn => btn.addEventListener('pointerdown', ev => ev.preventDefault()));
    const inp = qa.querySelector('input');
    inp.addEventListener('input', () => qa.classList.toggle('typed', !!inp.value.trim()));
    qa.querySelector('.more').addEventListener('click', () => {
      state.draft = qa.querySelector('input').value.trim();
      state.editing = 'new';
      openDay(ds);
    });
  }
  sheet.addEventListener('click', async e => {
    if (e.target.closest('a')) return;
    // A TAP ON THE TOP CLOSES IT (Alan, 09.10): the handle and the date line. closeDay
    // still keeps an open form or typed words, as it does for a tap outside.
    if (e.target.closest('.grab') || e.target.closest('header') === sheet.querySelector('header')) { closeDay(); return; }
    const del = e.target.dataset.del;
    if (del) {
      const ev = state.events.find(x => String(x.id) === String(del));
      if (!ev) return;
      try {
        await deleteEvent(ev);
        state.editing = null; closeDay(true);
        toast(L().deleted, { label: L().undo, fn: () => undoDelete(ev) });
      } catch (err) { toast(err.message); }
      return;
    }
    if (e.target.dataset.close) { state.editing = null; state.draft = null; openDay(ds); return; }
    const sw = e.target.closest('.sw');
    if (sw) {
      const box = sw.closest('.swatches');
      box.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === sw));
      box.dataset.cid = sw.dataset.cid;
      box.dataset.touched = '1';
      return;
    }
    if (e.target.dataset.editev) { state.editing = e.target.dataset.editev; state.viewing = null; openDay(ds); return; }
    if (e.target.closest('.evd') && !e.target.closest('.evd .ev')) return;   // reading the details
    const line = e.target.closest('.ev[data-eid]');
    if (line) { state.viewing = String(state.viewing) === line.dataset.eid ? null : line.dataset.eid; openDay(ds); }
  });
  sheet.addEventListener('change', e => {
    const f = e.target.closest('.edit');
    if (!f) return;
    if (e.target.name === 'repeat') { f.querySelector('.untill').hidden = e.target.value === '0'; return; }
    if (e.target.name !== 'allday') return;
    f.querySelectorAll('[name="time"], [name="endtime"]').forEach(x => {
      if (e.target.checked) x.value = '';
      x.disabled = e.target.checked;
    });
    f.querySelector('.tzl').hidden = e.target.checked;
  });
  // SWIPE BETWEEN DAYS (Alan, 07.10): the sheet steps a day, the month underneath follows
  let sx = null, sy = null;
  sheet.addEventListener('touchstart', e => { if (e.touches.length === 1 && !e.target.closest('input, textarea, select')) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } else sx = null; }, { passive: true });
  let topAtStart = 0;
  let fromTop = false;
  sheet.addEventListener('touchstart', e => {
    topAtStart = sheet.scrollTop;
    fromTop = e.touches.length === 1 && e.touches[0].clientY - sheet.getBoundingClientRect().top < 64;
  }, { passive: true });
  // THE SHEET FOLLOWS THE FINGER DOWN (Alan, 08.10: "I'm still tugging at the whole
  // month when trying to pull down"). The close used to be read only when the finger
  // lifted, so meanwhile Safari scrolled and bounced the page under it. From the top of
  // the sheet a downward drag now moves the sheet itself and holds the page still;
  // released past 90px it goes, short of that it springs back.
  // AND UP TO THE FULL DAY (Alan, 08.10: "then what is full day view?"): pulled up from
  // its top, the sheet grows with the finger and settles at full height — the day's
  // own page. From there a pull down returns it to half; from half, a pull down closes.
  let dragging = false, h0 = 0;
  sheet.addEventListener('touchmove', e => {
    if (sx === null || !fromTop || sheet.querySelector('.edit') || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - sy, dx = e.touches[0].clientX - sx;
    if (!dragging && Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) { dragging = true; h0 = sheet.getBoundingClientRect().height; }
    if (!dragging) return;
    e.preventDefault();
    sheet.style.transition = 'none';
    if (dy < 0) { sheet.style.transform = ''; sheet.style.height = Math.min(window.innerHeight, h0 - dy) + 'px'; }
    else { sheet.style.height = ''; sheet.style.transform = `translateY(${dy}px)`; }
  }, { passive: false });
  sheet.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (dragging) {
      dragging = false;
      sheet.style.transition = 'transform .18s ease-out';
      sheet.style.height = '';
      if (dy < -60) { state.sheetFull = true; sheet.classList.add('full'); sheet.style.transform = ''; }
      else if (dy > 90 && state.sheetFull) { state.sheetFull = false; sheet.classList.remove('full'); sheet.style.transform = ''; }
      else if (dy > 90) { sheet.style.transform = 'translateY(100%)'; setTimeout(() => closeDay(), 170); }
      else sheet.style.transform = '';
      return;
    }
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || sheet.querySelector('.edit')) return;
    const d = parseDate(ds); d.setDate(d.getDate() + (dx < 0 ? 1 : -1));
    const nd = fmt(d);
    if (state.view === 'month' && (d.getMonth() !== state.month || d.getFullYear() !== state.year)) show('month', d);
    else if (state.view === 'week' && mondayOf(nd).getTime() !== mondayOf(ds).getTime()) show('week', d);
    openDay(nd);
  }, { passive: true });
  sheet.addEventListener('input', e => {
    const f = e.target.closest('.edit');
    if (!f) return;
    if (e.target.name === 'time' || e.target.name === 'endtime') {
      if (e.target.value) { f.querySelector('[name="allday"]').checked = false; f.querySelector('.tzl').hidden = false; }
    } else if (e.target.name === 'title') {
      const box = f.querySelector('.dtrip'), was = box.hidden;
      box.hidden = !barePlace(e.target.value);
      if (was && !box.hidden) box.querySelector('input').checked = true;
    } else if (e.target.name === 'location') {
      const a = f.querySelector('.maplink'), v = e.target.value.trim();
      a.hidden = !v; a.href = mapLink(v);
    }
  });
  sheet.addEventListener('submit', async e => {
    const f = e.target.closest('.edit');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.busy) return;
    const v = n => (f.querySelector(`[name="${n}"]`) || {}).value || '';
    const fields = {
      title: pencilTitle(f, tripTitle(f, v('title'))), time: v('time').trim(), endTime: v('endtime').trim(),
      start: v('start'), end: v('end'), location: v('location').trim(),
      notes: pencilled(f, v('notes')), calId: v('cal'),
      // a colour he did not touch stays as it was in Google, even one of the three not offered
      colorId: (sw => sw.dataset.touched ? (sw.dataset.cid || '') : (sw.dataset.was || ''))(f.querySelector('.swatches')),
      recurrence: rruleFor(v('repeat'), v('until')),
      reminders: remindersFor(v('remind')),
      attendees: v('guests').split(/[,;\s]+/).map(x => x.trim()).filter(x => /@/.test(x)),
      tz: v('tz') || '',
    };
    f.dataset.busy = '1';
    const btn = f.querySelector('.save'), was = btn.textContent;
    btn.textContent = L().saving; f.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      if (f.dataset.eid === 'new') await createEvent(fields);
      else {
        const ev = state.events.find(x => String(x.id) === String(f.dataset.eid));
        if (ev) await saveEvent(ev, fields);
      }
      state.editing = null; state.draft = null;
      openDay(ds);
    } catch (err) {
      toast(err.message);
      btn.textContent = was; f.querySelectorAll('button').forEach(b => { b.disabled = false; });
      delete f.dataset.busy;
    }
  });
}
// the quick-add line, unfolded and focused — from the sheet's head, or a second tap
// on the open day's row (DESIGN session, 08.10, item 4b)
function focusAdd() {
  const qa = document.querySelector('#daysheet .qa');
  if (!qa) return;
  qa.hidden = false;
  const input = qa.querySelector('input');
  input.focus();
  input.scrollIntoView({ block: 'nearest' });
}
function closeDay(force) {
  const s = $('#daysheet');
  if (!s) return;
  const input = s.querySelector('.qa input');
  if (!force && input && input.value.trim() && !input.disabled) return;
  if (!force && s.querySelector('.edit')) return;    // a form open is not thrown away by a tap
  s.remove();
  document.querySelectorAll('.day.open, .wd.open').forEach(d => d.classList.remove('open'));
  state.open = null; state.editing = null; state.sheetFull = false; state.viewing = null;
}

function tripTitle(form, title) {
  const t = String(title || '').trim();
  const box = form.querySelector('[name="trip"]');
  const plain = cityMarker(t) || t;
  if (!box) return t;
  if (!box.checked) return cityMarker(t) ? plain.replace(/\s*\btbc\b.*$/i, '').trim() : t;
  const tbc = form.querySelector('[name="pencil"]')?.checked ? ' tbc' : '';
  return arrowForm('-' + plain.replace(/\s*\btbc\b.*$/i, '').trim()) + tbc;
}
// the Blyant tick writes the "?" (a move keeps its own " tbc", set by tripTitle); saving
// also drops an old P line from the notes, so an edited event carries the one mark only
function pencilTitle(form, title) {
  if (form.querySelector('[name="trip"]')?.checked) return title;
  const plain = String(title).replace(PENCIL_Q, '');
  return form.querySelector('[name="pencil"]')?.checked ? plain + '?' : plain;
}
function pencilled(form, notes) {
  return withoutPencil(notes).trim();
}

async function createEvent(f) {
  const title = f.title.trim();
  if (!title) throw new Error(L().needTitle);
  const end = f.end && f.end >= f.start ? f.end : f.start;
  if (state.mode !== 'google') {
    if (ALMANAKK_CONFIG.clientId) throw new Error(L().signinFirst);
    DEMO_EVENTS.push({ c: f.calId || 'arbeid', t: title, s: f.start, e: end, tm: f.time, l: f.location, n: f.notes, cid: f.colorId, rr: f.recurrence, rem: f.reminders, at: f.attendees });
    loadDemo(); toast(L().added); return;
  }
  await window.gcalCreateEvent(f.start, end, { ...f, title, end });
  toast(`${L().savedIn} ${calName(f.calId) || (window.gcalTarget() || {}).name || ''}`);
}

// Google's shape of when an event is, so a change can be undone exactly
function whenOf(ev) {
  const tz = ev.tz || 'Europe/Oslo';
  if (ev.time) {
    return { start: { dateTime: `${ev.start}T${ev.time}:00`, timeZone: tz, date: null },
             end: { dateTime: `${ev.end}T${ev.endTime || ev.time}:00`, timeZone: tz, date: null } };
  }
  const next = parseDate(ev.end); next.setDate(next.getDate() + 1);
  return { start: { date: ev.start, dateTime: null, timeZone: null }, end: { date: fmt(next), dateTime: null, timeZone: null } };
}
const sameList = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
async function saveEvent(ev, f) {
  if (!f.title.trim()) throw new Error(L().needTitle);
  if (state.mode !== 'google') {
    if (ALMANAKK_CONFIG.clientId) throw new Error(L().signinFirst);
    Object.assign(ev.src, { t: f.title, s: f.start, e: f.end >= f.start ? f.end : f.start, tm: f.time, l: f.location, n: f.notes,
      c: f.calId || ev.src.c, cid: f.colorId, rr: f.recurrence, rem: f.reminders, at: f.attendees });
    loadDemo(); toast(L().updated); return;
  }
  const tz = (f.time && f.tz) || ev.tz || 'Europe/Oslo';
  const moved = f.start !== ev.start || f.end !== ev.end || f.time !== (ev.time || '')
    || f.endTime !== (ev.endTime || '') || (f.time && tz !== (ev.tz || 'Europe/Oslo'));
  const patch = { summary: f.title, location: f.location, description: f.notes,
    colorId: f.colorId || null, reminders: f.reminders };
  const before = { summary: ev.title, location: ev.location || '', description: ev.notes || '',
    colorId: ev.colorId || null, reminders: ev.reminders || { useDefault: true } };
  if (!sameList(f.attendees, ev.attendees)) {
    patch.attendees = f.attendees.map(email => ({ email }));
    before.attendees = (ev.attendees || []).map(email => ({ email }));
  }
  if (moved) {
    const endDay = f.end && f.end >= f.start ? f.end : f.start;
    if (f.time) {
      patch.start = { dateTime: `${f.start}T${f.time}:00`, timeZone: tz, date: null };
      patch.end = { dateTime: `${endDay}T${f.endTime || f.time}:00`, timeZone: tz, date: null };
    } else {
      const next = parseDate(endDay); next.setDate(next.getDate() + 1);
      patch.start = { date: f.start, dateTime: null, timeZone: null };
      patch.end = { date: fmt(next), dateTime: null, timeZone: null };
    }
    Object.assign(before, whenOf(ev));
  }
  // REPEAT lives on the series: an instance hands the rule to its master event
  const wasRule = (ev.recurrence || []).filter(x => /^RRULE:/i.test(x));
  if (!sameList(f.recurrence, wasRule)) {
    const other = (ev.recurrence || []).filter(x => !/^RRULE:/i.test(x));
    if (ev.recurringEventId) await window.gcalUpdateEvent({ ...ev, gid: ev.recurringEventId }, { recurrence: other.concat(f.recurrence) });
    else patch.recurrence = other.concat(f.recurrence);
  }
  await window.gcalUpdateEvent(ev, patch);
  const moving = f.calId && f.calId !== ev.calId;
  if (moving) await window.gcalMoveEvent(ev, f.calId);
  // ANGRE AFTER AN EDIT (Q2): the words, the when and the colour go back as they were
  toast(moving ? `${L().movedTo} ${calName(f.calId)}` : L().updated, { label: L().undo, fn: async () => {
    const now = moving ? { ...ev, calId: f.calId } : ev;
    if (moving) await window.gcalMoveEvent(now, ev.calId);
    await window.gcalUpdateEvent(ev, before);
    toast(L().undone);
  } });
}

function shortRange(start, end) {
  const a = parseDate(start), b = parseDate(end);
  const mon = d => L().months[d.getMonth()].slice(0, 3).toLowerCase();
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${a.getDate()}–${b.getDate()} ${mon(b)}`;
  return `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)}`;
}

/* ---------- writing ---------- */

// "8-12 Antigone" on a day in March -> span March 8–12; "25-1" rolls over
function parseRange(date, text) {
  const m = text.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(.+)$/);
  if (!m) return null;
  const [y, mo] = date.split('-').map(Number);
  const a = Number(m[1]), b = Number(m[2]);
  if (a < 1 || a > daysInMonth(y, mo - 1) || b < 1) return null;
  const pad = x => String(x).padStart(2, '0');
  const start = `${y}-${pad(mo)}-${pad(a)}`;
  let end;
  if (b >= a) {
    if (b > daysInMonth(y, mo - 1)) return null;
    end = `${y}-${pad(mo)}-${pad(b)}`;
  } else {
    const ny = mo === 12 ? y + 1 : y, nmo = mo === 12 ? 1 : mo + 1;
    if (b > daysInMonth(ny, nmo - 1)) return null;
    end = `${ny}-${pad(nmo)}-${pad(b)}`;
  }
  return { start, end, title: m[3] };
}
// "-Oslo" typed is saved as "→ Oslo", so it reads as a move in Google too
function arrowForm(text) {
  if (!cityMarker(text)) return text;
  const nice = c => c.replace(/\S+/g, w => /^[a-zà-öø-ÿ]+$/.test(w) ? w[0].toUpperCase() + w.slice(1) : w);
  return text.replace(
    /^(\s*(?:\d{1,2}[:.]\d{2}\s+)?)(?:-+\s*>?|=>|→)\s*([^,(]+?)\s*((?:\btbc\b.*)?)$/i,
    (_, lead, city, tail) => lead + '→ ' + nice(city) + (tail ? ' ' + tail : ''));
}
async function addEvent(date, text) {
  text = arrowForm(text);
  const range = parseRange(date, text);
  if (state.mode === 'google') {
    await window.gcalCreateEvent(range ? range.start : date, range ? range.end : date, range ? range.title : text);
    const t = window.gcalTarget && window.gcalTarget();
    toast(t ? `${L().savedIn} ${t.name}` : L().saved);
  } else if (ALMANAKK_CONFIG.clientId) {
    throw new Error(L().signinFirst);
  } else {
    DEMO_EVENTS.push(range ? { c: 'arbeid', t: range.title, s: range.start, e: range.end } : { c: 'arbeid', t: text, s: date });
    loadDemo();
    toast(L().added);
  }
}
async function deleteEvent(ev) {
  if (state.mode === 'google') await window.gcalDeleteEvent(ev);
  else if (ALMANAKK_CONFIG.clientId) throw new Error(L().signinFirst);
  else { const i = DEMO_EVENTS.indexOf(ev.src); if (i > -1) DEMO_EVENTS.splice(i, 1); loadDemo(); }
}
async function undoDelete(ev) {
  if (state.mode === 'google') await window.gcalRestoreEvent(ev);
  else { DEMO_EVENTS.push(ev.src); loadDemo(); }
  toast(L().restored);
}
// a planned move ("→ Roma tbc") is answered by a booking on the same day: the
// guess is removed rather than left under the flight (Alan, 02.09)
let cleaning = false;
window.almanakkAfterLoad = async function () {
  if (cleaning || state.mode !== 'google') return;
  const idx = buildFlightIndex();
  const booked = new Set(idx.filter(f => !f.tbc).map(f => f.date));
  const doomed = idx.filter(f => f.tbc && f.marker && booked.has(f.date))
    .map(f => state.events.find(e => String(e.id) === String(f.evId))).filter(Boolean);
  if (!doomed.length) return;
  cleaning = true;
  try {
    for (const ev of doomed) await window.gcalDeleteEvent(ev);
    toast(`${L().planCleared} ${doomed.map(e => e.title).join(' · ')}`);
  } catch (err) { /* the sheet still shows both */ }
  finally { cleaning = false; }
};

/* ---------- demo ---------- */

function loadDemo() {
  const colors = Object.fromEntries(DEMO_CALENDARS.map(c => [c.id, c.color]));
  state.events = DEMO_EVENTS.map((ev, i) => ({
    id: i, title: ev.t, start: ev.s, end: ev.e || ev.s, calId: ev.c, src: ev, time: ev.tm || '',
    location: ev.l || '', notes: ev.n || '', color: colors[ev.c] || '#26241f', colorId: ev.cid || '',
    recurrence: ev.rr || [], reminders: ev.rem || null, attendees: ev.at || [],
  }));
  render();
}

/* ---------- chrome ---------- */

function toast(msg, action) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', async () => {
      t.hidden = true;
      try { await action.fn(); } catch (e) { toast(e.message); }
    });
    t.appendChild(b);
  }
  t.hidden = false;
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.hidden = true; }, action ? 8000 : 2500);
}

// anchor: the date the current view is standing on
function anchorDate() {
  if (state.view === 'week') { const m = mondayOf(state.weekOf || fmt(new Date())); m.setDate(m.getDate() + 3); return m; }
  return new Date(state.year, state.month, 1);
}
function setMonthFrom(d) { state.year = d.getFullYear(); state.month = d.getMonth(); }
function step(dir) {
  if (state.view === 'year') state.year += dir;
  else if (state.view === 'week') {
    const m = mondayOf(state.weekOf || fmt(new Date())); m.setDate(m.getDate() + dir * 7);
    state.weekOf = fmt(m); setMonthFrom(anchorDate());
  } else {
    const by = SPREAD.matches ? 3 : 1;
    setMonthFrom(new Date(state.year, state.month + dir * by, 1));
  }
  if (state.mode === 'google') window.gcalEnsureYear(state.year);
  render();
}
function show(view, d) {
  if (d) { setMonthFrom(d); if (view === 'week') state.weekOf = fmt(mondayOf(fmt(d))); }
  state.view = view;
  if (state.mode === 'google') window.gcalEnsureYear(state.year);
  render();
}
function goToday() {
  const now = new Date();
  state.weekOf = fmt(mondayOf(fmt(now)));
  show(state.view === 'year' ? 'month' : state.view, now);
  document.querySelector('.day.today, .wd.today, .cell.today')?.scrollIntoView({ block: 'center' });
}
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
$('#today').addEventListener('click', goToday);
$('#title').addEventListener('click', toggleMonthWeek);
$('#yr').addEventListener('click', () => { if (state.view !== 'year') show('year'); });
// HOME IS ONE TAP (Alan, 08.10: "there's no swift way to come home to today")
$('#home').addEventListener('click', goToday);
// THE TITLE IS THE MONTH/WEEK TOGGLE (Alan, 08.10, choosing it over a button: one job
// per thing in the header — the title switches month and week, I DAG goes to today,
// 2026 opens the year, ⋯ holds the settings). Month → the open day's week, else
// today's week if today is in this month, else the month's first full week.
// Week → that week's month. In the year the title goes back to the month.
function toggleMonthWeek() {
  if (state.view !== 'month') { show('month', anchorDate()); return; }
  const now = new Date();
  const inMonth = now.getFullYear() === state.year && (SPREAD.matches
    ? Math.floor(now.getMonth() / 3) === Math.floor(state.month / 3) : now.getMonth() === state.month);
  // the month's first full week: a 1st on a Saturday or Sunday belongs to the week before
  const first = new Date(state.year, state.month, 1);
  if (weekdayIdx(first) >= 5) first.setDate(first.getDate() + 7 - weekdayIdx(first));
  const d = state.open ? parseDate(state.open) : inMonth ? now : first;
  state.weekOf = fmt(mondayOf(fmt(d)));
  show('week', d);
}
document.querySelectorAll('#more-list [data-view]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;
  if (v === 'week' && !state.weekOf) state.weekOf = fmt(mondayOf(fmt(anchorDate())));
  show(v, v === 'week' ? null : anchorDate());
}));
$('#lang-chip').addEventListener('click', () => {
  state.lang = state.lang === 'no' ? 'en' : 'no';
  localStorage.setItem('almanakk2-lang', state.lang);
  render();
});
$('#tour-chip').addEventListener('click', async () => {
  state.wg = !state.wg;
  localStorage.setItem('almanakk3-wg', state.wg ? '1' : '0');
  if (state.wg && state.mode === 'google' && window.gcalEnsureSelected) {
    try { await window.gcalEnsureSelected(tourCalIds()); } catch (e) { toast(e.message); }
  }
  render();
});
$('#print').addEventListener('click', () => { closeDay(true); $('#more').open = false; window.print(); });
const moreMenu = $('#more');
moreMenu.addEventListener('click', e => { if (e.target.closest('button')) moreMenu.open = false; });
document.addEventListener('click', e => { if (!e.target.closest('#more')) moreMenu.open = false; });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return closeDay(true);
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
});

// A TAP ON A DAY OPENS IT; the outer 14% of a phone's width is back and forward,
// whatever sits under the thumb (Alan, 14.09)
let swipedAt = 0;
$('#app').addEventListener('click', e => {
  if (Date.now() - swipedAt < 450) return;
  // NO EDGE TAPS ANY MORE (08.10). v2's rule — the outer 14% of the phone steps back
  // and forward whatever is under the thumb — put the day numbers inside the left
  // strip, so a tap on a day's figure jumped a month (the "double tap glitch" Alan
  // saw). The figure now opens the week; a sideways swipe steps the month.
  // THE WEEK NUMBER IS THE WEEK'S HANDLE: tap "uke 7" and the week opens
  const uke = e.target.closest('.info.uke');
  if (uke) { const row = uke.closest('.day'); show('week', parseDate(row.dataset.date)); return; }
  // the year: a day opens the month with that day; anywhere else in a month opens it
  const md = e.target.closest('.mini b[data-date]');
  if (md) { show('month', parseDate(md.dataset.date)); openDay(md.dataset.date); return; }
  const pm = e.target.closest('.mini[data-m]');
  if (pm) { show('month', new Date(state.year, Number(pm.dataset.m), 1)); return; }
  const ym = e.target.closest('.year12 .month');
  if (ym) { show('month', new Date(Number(ym.dataset.y), Number(ym.dataset.m), 1)); return; }
  // THE DAY'S FIGURE OPENS ITS WEEK (Alan, 08.10: "if I want a quick touch, see the
  // week, I'm not able to"). The number and the letter are the week's handle; the rest
  // of the row opens the day.
  const fig = e.target.closest('.day[data-date] .n, .day[data-date] .w');
  if (fig) { show('week', parseDate(fig.closest('.day').dataset.date)); return; }
  // the week: a day opens its sheet
  const wd = e.target.closest('.wd[data-date]');
  if (wd) { if (state.open === wd.dataset.date) { if (Date.now() - openedAt > 500) focusAdd(); } else openDay(wd.dataset.date); return; }
  const row = e.target.closest('.day[data-date]');
  if (!row) { closeDay(); return; }
  // a double tap is one tap (Alan, 08.10: "double tapping a day glitches")
  if (state.open === row.dataset.date) { if (Date.now() - openedAt > 500) focusAdd(); return; }
  openDay(row.dataset.date);
});
document.addEventListener('click', e => {
  if (!e.target.closest('#daysheet, #app, header')) closeDay();
});

let touchX = null, touchY = null;
$('#app').addEventListener('touchstart', e => {
  if (e.touches.length > 1) { touchX = null; return; }
  touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
}, { passive: true });
$('#app').addEventListener('touchcancel', () => { touchX = null; }, { passive: true });
$('#app').addEventListener('touchend', e => {
  if (touchX === null) return;
  const vv = window.visualViewport;
  if (vv && vv.scale > 1.02) { touchX = null; return; }
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { step(dx < 0 ? 1 : -1); swipedAt = Date.now(); return; }
  // UP AND DOWN IS A YEAR (Alan, 09.10: "scrolling between years doesn't work", "in
  // month view scrolling freezes"). The month fits the screen, so a vertical drag did
  // nothing at all. Where nothing is left to scroll, a drag up is next year and a drag
  // down the year before: the same month a year away, or the next year's months.
  if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx) * 2 && (state.view === 'month' || state.view === 'year')) {
    const main = document.querySelector('main');
    const room = main.scrollHeight - main.clientHeight;
    const atEdge = room < 4 || (dy < 0 ? main.scrollTop >= room - 2 : main.scrollTop <= 2);
    if (!atEdge) return;
    const dir = dy < 0 ? 1 : -1;
    if (state.view === 'year') step(dir);
    else { state.year += dir; if (state.mode === 'google') window.gcalEnsureYear(state.year); render(); }
    swipedAt = Date.now();
  }
}, { passive: true });

/* ---------- boot ---------- */

// ?demo=1 forces sample data and lands on the month that has it
if (/[?&]demo\b/.test(location.search)) {
  ALMANAKK_CONFIG.clientId = '';
  window.ALMANAKK_PROXY = null;
  state.year = DEMO_YEAR; state.month = DEMO_MONTH;
  try { localStorage.setItem('almanakk-tourcals', '["turne"]'); } catch (e) { /* private mode */ }
  state.wg = true;
}
if (!ALMANAKK_CONFIG.clientId) {
  const b = $('#banner');
  b.hidden = false;
  b.textContent = state.lang === 'en' ? 'Sample data — not your calendar.' : 'Eksempeldata — ikke din kalender.';
}
if (!ALMANAKK_CONFIG.clientId && !window.ALMANAKK_PROXY) loadDemo(); else render();
