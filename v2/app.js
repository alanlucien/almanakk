/* Almanakk — Norwegian wall-calendar view. Rendering + calendar math. */
'use strict';

const $ = s => document.querySelector(s);

// Which build is actually running — read from this script's own ?v=, so there
// is one source of truth (index.html) and no doubt about what a phone is on.
// Shown at the bottom of the Kalendere panel.
// v2: the renderer forks here; sign-in, loading, parsing come from ../gcal.js etc.
const BUILD = (() => {
  try { return new URL(document.currentScript.src).searchParams.get('v') || 'dev'; }
  catch (e) { return 'dev'; }
})();

const LANGS = {
  no: {
    months: ['JANUAR','FEBRUAR','MARS','APRIL','MAI','JUNI','JULI','AUGUST','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'],
    wd: ['M','Ti','O','To','F','L','S'], // Monday-first
    wdLong: ['MANDAG','TIRSDAG','ONSDAG','TORSDAG','FREDAG','LØRDAG','SØNDAG'],
    week: 'uke',
    year: 'År', month: 'Måned', detail: 'Detaljer', print: 'Skriv ut',
    signin: 'Logg inn med Google', cals: 'Kalendere',
    added: 'Lagt til (demo — lagres ikke)', saved: 'Lagret i Google Kalender', savedIn: 'Lagret i', goesTo: 'Ny hendelse →',
    cityHint: 'Trykk for å planlegge en reise', cityAsk: 'Skriv bynavnet — lagres som «→ By»',
    cityPlanAsk: 'Planlagt reise — lagres som «→ By tbc» til en flybillett dukker opp', cityPh: 'By',
    planCleared: 'Planlagt reise fjernet, flyet er booket:',
    cityFromFlight: 'Denne byen kommer fra et fly. Endre flyet selv.', signinFirst: 'Logg inn med Google først.',
    deleted: 'Slettet', undo: 'Angre', restored: 'Gjenopprettet', edit: 'Endre', updated: 'Endret', replaced: 'erstattet av fly',
    tourHint: 'Huk av «Tour» på turnékalenderne under Kalendere først.',
    newPh: 'Ny · «8-12 tekst» = flere dager · «13:00» = tid', add: 'Legg til', del: 'Slett',
    printHead: 'Skriv ut %Y — A4 liggende', per3: '3 mnd/side', per6: '6 mnd/side', per12: 'Hele året på én side',
  },
  en: {
    months: ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],
    wd: ['Mo','Tu','We','Th','Fr','Sa','Su'],
    wdLong: ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'],
    week: 'wk',
    year: 'Year', month: 'Month', detail: 'Details', print: 'Print',
    signin: 'Sign in with Google', cals: 'Calendars',
    added: 'Added (demo — not saved)', saved: 'Saved to Google Calendar', savedIn: 'Saved to', goesTo: 'New event →',
    cityHint: 'Tap to plan a move', cityAsk: 'Type the city — saved as "→ City"',
    cityPlanAsk: 'Planned move — saved as "→ City tbc" until a booking turns up', cityPh: 'City',
    planCleared: 'Planned move removed, the flight is booked:',
    cityFromFlight: 'This city comes from a flight. Edit the flight itself.', signinFirst: 'Sign in with Google first.',
    deleted: 'Deleted', undo: 'Undo', restored: 'Restored', edit: 'Edit', updated: 'Updated', replaced: 'replaced by flight',
    tourHint: 'Tick "Tour" on the touring calendars under Calendars first.',
    newPh: 'New · "8-12 text" = several days · "13:00" = timed', add: 'Add', del: 'Delete',
    printHead: 'Print %Y — A4 landscape', per3: '3 months/page', per6: '6 months/page', per12: 'Whole year on one page',
  },
};
const L = () => LANGS[state.lang] || LANGS.no;

const state = {
  view: window.innerWidth < 700 ? 'month' : 'year',
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-based, for month view
  events: [],      // {id, title, start, end (inclusive 'YYYY-MM-DD'), color, time?, gid?, calId?, src?}
  mode: 'demo',    // 'demo' | 'google'
  wg: localStorage.getItem('almanakk2-wg') === '1', // overlay the tour-tagged calendars
  cities: true, // always shown; the button switches how they read
  cityCodes: false, // names always: Alan dropped the Byer button 02.09.2026 —
                    // his flight titles are already codes (OSL-LGW), so "codes"
                    // mode only repeated the title back
  lang: localStorage.getItem('almanakk2-lang') || 'no',
  detailed: false, // month view with every event on its own row
};

function allCalendars() {
  return (state.mode === 'google' && window.gcalCalendars) ? window.gcalCalendars() : DEMO_CALENDARS;
}
function tourCalIds() {
  const all = allCalendars();
  const stored = JSON.parse(localStorage.getItem('almanakk-tourcals') || 'null');
  if (stored) return stored.filter(id => all.some(c => c.id === id));
  return all.filter(c => /tour|turné|turne/i.test(c.name)).map(c => c.id);
}
// Tour-tagged calendars are never part of the normal view — they are an
// overlay (the wg button), like the Cities column.
function visibleEvents() {
  const t = new Set(tourCalIds());
  return state.events.filter(e => !t.has(e.calId));
}
function overlayEvents() {
  if (!state.wg) return [];
  const t = new Set(tourCalIds());
  // Alan's decision (B, 2026-08-23): bands mean "tour period" — multi-day
  // spans only; every single-day wg item goes on the day line instead
  return state.events.filter(e => t.has(e.calId) && !e.time && e.end > e.start);
}
// wg single-day items (all-day and timed) join the detail line AFTER Alan's
// own events; the one-line clip shows them when there is room and drops them
// first on busy days.
function wgDetailEvents() {
  if (!state.wg) return [];
  const t = new Set(tourCalIds());
  return state.events
    .filter(e => t.has(e.calId) && e.end === e.start)
    .sort(detOrder);
}

/* ---------- date helpers (string keys, no timezone traps) ---------- */

function fmt(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function weekdayIdx(d) { return (d.getDay() + 6) % 7; } // 0=Mon … 6=Sun

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3); // nearest Thursday
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((t - jan4) / (7 * 864e5));
}

function easterDate(y) { // anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100,
    d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}

// Map 'YYYY-MM-DD' -> {name, red}. red = official public holiday.
function holidays(y) {
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
  const advent4 = off(dec24, -dec24.getDay()); // Sunday on/before Dec 24
  for (let n = 1; n <= 4; n++) put(off(advent4, (n - 4) * 7), n + '. advent');
  put(dec24, 'Julaften');
  put(new Date(y, 11, 25), '1. Juledag', true);
  put(new Date(y, 11, 26), '2. Juledag', true);
  put(new Date(y, 11, 31), 'Nyttårsaften');
  return map;
}

/* ---------- event layout ----------
   Multi-day events ("spans": projects, tours) get their own vertical lane on
   the left; single-day events stack in one detail column on the right.     */

const MAX_LANES = 4;
function packLanes(spans, cap, base) {
  const laneEnds = [];
  for (const ev of spans) {
    let lane = laneEnds.findIndex(end => end < ev.start);
    if (lane === -1) lane = laneEnds.length;
    ev._lane = base + Math.min(lane, cap - 1);
    const li = Math.min(lane, cap - 1);
    laneEnds[li] = ev.end > (laneEnds[li] || '') ? ev.end : laneEnds[li];
  }
  return Math.min(cap, laneEnds.length);
}
const byStart = (a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (b.end < a.end ? -1 : 1));

function monthLayout(y, m, events, overlays) {
  const first = fmt(new Date(y, m, 1));
  const last = fmt(new Date(y, m, daysInMonth(y, m)));
  const overlapping = events.filter(ev => ev.start <= last && ev.end >= first);
  // Work first, then everything else. All-day events from the calendar you are
  // signed in as take the leftmost lanes; the private gmail calendar and any
  // shared-in calendar sit to their right (Alan, 02.09.2026).
  const all = overlapping.filter(ev => ev.end > ev.start).sort(byStart);
  const work = all.filter(ev => ev.home), guest = all.filter(ev => !ev.home);
  // When there is private all-day to show, work may claim at most all-but-one
  // lane, so a holiday can never be crowded out by a busy month of projects.
  // Work spans beyond that stack in their own last lane, as they always have.
  const nWork = packLanes(work, guest.length ? MAX_LANES - 1 : MAX_LANES, 0);
  const nGuest = guest.length ? packLanes(guest, MAX_LANES - nWork, nWork) : 0;
  const spans = work.concat(guest);
  const n = Math.max(1, nWork + nGuest);
  // overlay (wg) events get their own lanes to the right of the normal ones
  const ovl = (overlays || []).filter(ev => ev.start <= last && ev.end >= first).sort(byStart);
  ovl.forEach(ev => { ev._wg = true; });
  const nOvl = packLanes(ovl, 2, n);
  const details = overlapping
    .filter(ev => ev.end === ev.start)
    .sort(detOrder);
  return { spans: spans.concat(ovl), details, nOwn: n, nOvl };
}

// A flight that leaves in the small hours belongs to the night before: nobody
// thinks "I fly on the 28th" about a 01:55 departure — they leave on the 27th,
// late. Past 03:30 it flips and reads as an early morning (Alan, 02.09.2026).
// Does a band label actually fit its lane? Measured, not guessed: "Jury duty"
// is short and should stay whole, while a genuinely long title still gets
// written down the band a word per row. Lane width and font are read from the
// live row after a render, so this follows the viewport and the print sizes.
let laneBox = { w: 0, font: '' };
let measured = false;
function measureLane() {
  const el = document.querySelector('.day .band');
  if (!el) return;
  const cs = getComputedStyle(el);
  const probe = el.querySelector('i');
  laneBox = {
    font: probe ? getComputedStyle(probe).font : cs.font,
    px: parseFloat(cs.fontSize) || 12,
  };
  // the first paint has nothing to measure yet, so draw once more now that we do
  if (!measured && laneBox.px > 0) { measured = true; render(); }
}
let measureCtx = null;
// Width of a band label in em, so a lane can be sized to what it must hold and
// the same number still works at print sizes. 0 before the first paint.
function emWidth(text) {
  if (!laneBox.font || !laneBox.px) return 0;
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = laneBox.font;
  return measureCtx.measureText(text).width / laneBox.px;
}

const NIGHT_UNTIL = 3 * 60 + 30;
window.nightFlight = function (title, time) {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return false;
  if (Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) >= NIGHT_UNTIL) return false;
  return !!flightDest(title);
};

/* ---------- shows ping red ---------- */

const SHOW_RE = /\b(show\w*|prem\w*|première|performance\w*|forest\w*|visning\w*|vorstellung\w*|matin[ée]\w*)\b/i;
function isShow(ev) {
  // "show call" (also show-call/showcall) is the meeting time, not a performance
  const t = ev.title.replace(/show[\s-]*call/gi, '');
  return SHOW_RE.test(t);
}
// an event's time for ordering: the real clock time, or one written in the title
function effTime(e) {
  if (e.time) return e.time;
  const m = e.title.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return m ? m[1].padStart(2, '0') + ':' + m[2] : null;
}
// day-line order: all-day headline first, then red shows, then the rest by time
function detOrder(a, b) {
  const k = e => { const t = effTime(e); return t ? (isShow(e) ? '1' : '2') + t : '0'; };
  const ka = k(a), kb = k(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
// A performance reads as its production and which one it is:
// "Antigone performance 2" / "second show Antigone" -> "Antigone 2".
const SHOW_WORDS = /\b(?:shows?|performances?|forestilling\w*|visning\w*|vorstellung\w*|prem[\wèéêë]*|matin[ée]\w*|forest\w*)\b/gi;
const ORDINALS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  første: 1, andre: 2, tredje: 3, fjerde: 4, femte: 5, sjette: 6, sjuende: 7, syvende: 7, åttende: 8, niende: 9, tiende: 10,
};
function showLabel(title) {
  if (!isShow({ title })) return null;
  // a clock in the title is never the performance number: "19:00 Forestilling"
  // was reading 19 as the count and rendering "00 19" (found 12.09)
  let t = title.replace(/\b([01]?\d|2[0-3])[:.][0-5]\d\b/g, ' '), num = null;
  const digit = t.match(/(?:^|[^\d])(\d{1,2})(?!\d)/); // 1–2 digits: a count, not a year
  if (digit) { num = digit[1]; t = t.replace(digit[0], digit[0].replace(digit[1], ' ')); }
  else {
    t = t.replace(/\b([a-zæøåA-ZÆØÅ]+)\b/g, w => {
      const n = ORDINALS[w.toLowerCase()];
      if (n && num === null) { num = String(n); return ' '; }
      return w;
    });
  }
  const name = t.replace(SHOW_WORDS, ' ').replace(/[-–—:·,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return null; // nothing but the word "Performance" — keep the original
  return num ? name + ' ' + num : name;
}
// Year and month views show the GIST; Detaljer and the day panel keep the full title.
function compactTitle(e) {
  const mark = cityMarker(e.title);
  if (mark) return '→ ' + mark;
  const route = flightRoute(e.title);
  if (route) return route;
  // one-legged flights ("19:35 Flight to Copenhagen (SK 2869)") read as a move
  if (hasFlightWord(e.title)) {
    const named = placesIn(e.title);
    if (named.length === 1) return '→ ' + cityLabel(named[0]);
  }
  return showLabel(e.title) || e.title;
}
function evInk(e) { return isShow(e) ? 'var(--red)' : inkColor(e.color); }
const isTbc = ev => /\btbc\b/i.test(ev.title);

/* ---------- cities (derived from flight-looking events) ---------- */

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
  let best = [], run = [];
  // "BGO-OSL tbc" is the same route as "BGO-OSL", just not booked yet
  const bare = title.replace(/\btbc\b/gi, ' ').trim();
  for (const part of bare.split(/\s*(?:[-–—]+|[>→]+)\s*/)) {
    const place = legPlace(part);
    if (place) { run.push(place); if (run.length > best.length) best = run.slice(); }
    else run = [];
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
  const m = title.match(/^\s*(?:\d{1,2}[:.]\d{2}\s+)?(?:-+\s*>?|→|=>)\s*([^,(]+?)\s*(?:\btbc\b.*)?$/i);
  if (!m || !m[1] || /^\d/.test(m[1])) return null;   // "-8 Antigone" is a span, not a move
  const name = m[1].replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ').replace(/\s+/g, ' ').trim();
  return name || null;
}
// Compact views read a flight as its route: "OSL-PAR-HKG" -> "Oslo → Hong Kong".
// A journey with a stop reads as one trip: "Bergen →•→ Pisa", a dot per stop.
// Alan: "i start the day in bergen end in pisa" — the legs are the airline's
// business. Detaljer and the day panel always keep them whole.
function journeyLabel(legs) {
  const stops = '\u2022'.repeat(Math.max(0, legs.length - 2));
  return cityLabel(legs[0]) + ' \u2192' + stops + '\u2192 ' + cityLabel(legs[legs.length - 1]);
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
    if (dest) flights.push({ date: ev.start, time: ev.time || '99', dest, tbc: isTbc(ev), marker: !!marker, evId: ev.id });
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

/* ---------- rendering ---------- */

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Google calendar colours can be very pale; darken until readable as text on the paper background.
function inkColor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  let [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  while (0.299 * r + 0.587 * g + 0.114 * b > 110) {
    r = Math.round(r * 0.85); g = Math.round(g * 0.85); b = Math.round(b * 0.85);
  }
  return `rgb(${r},${g},${b})`;
}

// A band's hairline should fall BETWEEN letters, never through one.
// Alan, 12.09: "if there had been a line in the middle of the word VILDANDEN,
// why do you have to nudge the whole event title to the right? You could've
// just moved the individual word." Exactly right — the first attempt shifted
// the entire line, so a row's text no longer started where its neighbours'
// did, and that wandering left edge is far more visible than a hairline over
// a letter. So: the line's left edge NEVER moves. Only the one word the line
// actually crosses is pushed right, and whatever follows flows after it.
// Only a band's left border is a line. Where a tint merely stops there is
// nothing to dodge, and treating that as a line moved rows with nothing
// crossing them at all — which is what he caught.
// On by default since 12.09, the day Alan approved it. ?kveld=0 turns the
// time columns off and gives the plain left-aligned day line back.
const KVELD = !/[?&]kveld=0\b/.test(location.search);
// ?band=column gives every band its own column, the way v1 had it; the default
// is the overlapping staircase. A switch, not a decision — Alan judges both on
// his real calendar before either is thrown away (12.09).
const BANDS = /[?&]band=column\b/.test(location.search) ? 'column' : 'stair';
const SAT_GREY = /[?&]sat=1\b/.test(location.search);   // tint Saturdays too
const EVENING_FROM = 18;                            // an "evening" starts here
const NUDGE_RIGHT = 6;   // px a word may be pushed right; past this it reads as a gap
const NUDGE_LEFT = 2.5;  // px it may be pulled left — only tightens one space

// The long "Oslo → Bergen" form reaches left across an empty day line. Empty
// means empty: on a day whose band carries a label, that space is taken, and
// the long form printed straight over it. Measured after layout, because
// whether it fits depends on the label's own width — Alan, 12.09.
// A flushed-right line must not land on a band label that spills right into
// the same space. Measured after layout; it simply goes back to the left.
// A show is pinned to the front of the line so clipping can never hide it.
// On a line with room to spare there IS no clipping, and the pin then puts a
// 19:00 show in front of a 09:00 rehearsal — which reads backwards, and reads
// worse the moment the line says anything about time at all (Alan, 12.09, on
// the 17th). So: running order whenever it fits, pinned only when it must be.
function orderByTime() {
  document.querySelectorAll('.day .detail').forEach(det => {
    const evts = [...det.querySelectorAll(':scope > .evt')];
    if (evts.length < 2) return;
    const pad = 11;  // the detail's own 7px + 4px
    const r = document.createRange(); r.selectNodeContents(det);
    if (r.getBoundingClientRect().width > det.clientWidth - pad) return;  // it clips: keep the pin
    const key = b => (b.dataset.wg === '1' ? '9' : b.dataset.t ? '1' : '0') + (b.dataset.t || '');
    const sorted = [...evts].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
    if (sorted.every((b, i) => b === evts[i])) return;
    sorted.forEach(b => det.appendChild(b));
  });
}

function fitEvenings() {
  document.querySelectorAll('.day .detail.kveld').forEach(det => {
    const cv = det.closest('.canvas'); if (!cv) return;
    let taken = cv.getBoundingClientRect().left;
    cv.querySelectorAll('.band b').forEach(b => {
      if (b.textContent.trim()) taken = Math.max(taken, b.getBoundingClientRect().right);
    });
    const r = document.createRange(); r.selectNodeContents(det);
    if (r.getBoundingClientRect().left < taken + 4) det.classList.remove('kveld');
  });
}

function fitJourneys() {
  document.querySelectorAll('.day .info .cty.journey.wide').forEach(j => {
    const row = j.closest('.day'); const cv = row && row.querySelector('.canvas');
    if (!cv) return;
    // WHERE THE WORDS END, not where their box ends. The day line's box runs
    // to the far right of the canvas whatever it holds, so measuring the box
    // made every day with any event at all look full, and the long reading was
    // dropped on days with most of the row empty (Alan's 18th, 12.09).
    let taken = cv.getBoundingClientRect().left;
    cv.querySelectorAll('.band b, .detail').forEach(el => {
      if (!el.textContent.trim()) return;
      const r = document.createRange(); r.selectNodeContents(el);
      taken = Math.max(taken, r.getBoundingClientRect().right);
    });
    if (j.getBoundingClientRect().left < taken + 4 && j.dataset.short) {
      j.innerHTML = j.dataset.short;
      j.classList.remove('wide');
    }
    // still too wide for the column it now sits in: say it in codes rather
    // than clip the week number off the end (Alan's phone, 12.09)
    const cell = j.parentElement;
    if (!j.classList.contains('wide') && j.scrollWidth > cell.clientWidth - 6 && j.dataset.tiny) {
      j.innerHTML = j.dataset.tiny;
    }
  });
}

// Alan, 12.09, with a green line drawn down his February: the late events
// should share ONE left edge, not each start wherever its own length happens
// to put it. So the month gets a single evening column, as far right as it
// can be while the longest late title that month still fits whole. A title
// too long even for that keeps its right edge and simply starts earlier —
// the column is where evenings BEGIN, not a box they are trapped in.
// The column is placed for the ordinary late title, not the longest one: one
// very long evening title used to drag the whole column left, which on a phone
// wasted most of the row (Alan, 12.09 — "they could have been further to the
// right"). A title half again longer than the next one down is an outlier; it
// keeps its own right edge rather than move the column for everyone. Measured
// against its neighbours, not against the canvas, so it behaves the same on a
// phone as on a wall.
const SLOT_OUTLIER = 1.5;        // how much longer than the next one down
const SLOT_COL_MIN = 0.42;      // the evening column never left of this
const AFTERNOON_FROM = 12;      // when the afternoon column starts counting
const SLOT_GAP = 10;            // clear air between one slot and the next
// Alan, 12.09: "why is there not a right nudge for afternoon events?" Because
// the first answer to his time-axis idea was that the day line has no fixed
// origin — it starts after the last band, so a position measured from it means
// a different hour on every row. Anchoring to the CANVAS fixed that, and once
// the evening column proved it, a second column costs nothing new. So: morning
// keeps the left edge, afternoon meets one column, evening meets another. Two
// fixed places, not a sliding scale — a word is five hours wide at this size,
// so a continuous axis would still be a lie.
// A TOUR'S OWN DAY EVENTS BELONG TO THAT TOUR (Alan, 12.09). They begin
// HALFWAY into the tour's banner rather than waiting for it to end — the same
// argument as the staircase, that a thing which belongs inside another may
// overlap it while both stay readable. Halfway, not fully: the banner has to
// go on reading as a banner. And on EVERY row the banner runs, not only the
// row it is labelled on, so the tour's items make a column of their own down
// the tour (Alan: "if that is the wg event it belongs in the wg row
// alignment"). They never move left into Alan's own events.
// WHOLE TITLES, THEN A COUNT (Alan, 12.09: "definitely fix cacophony"). The
// day line is a flex row, so when it overflowed every item shrank a share and
// every one of them ellipsed: "Mø… · Befaring DN… · Fanny og Alexande…". Three
// stubs say less than one title and cost more, because each still takes a slot
// and a colour. v1 read better for exactly this reason — it filled with whole
// titles and cut once at the end. Items no longer shrink; what does not fit is
// dropped, and the row says how many, so a missed thing is visible rather than
// silently gone.
function clipLine() {
  document.querySelectorAll('.day .detail').forEach(det => {
    det.querySelectorAll(':scope > .more').forEach(m => m.remove());
    det.querySelectorAll(':scope > .evt').forEach(e => { e.hidden = false; });
    if (state.detailed) return;
    const evts = [...det.querySelectorAll(':scope > .evt')];
    if (evts.length < 2) return;
    const pad = parseFloat(getComputedStyle(det).paddingRight) || 0;
    const edge = () => det.getBoundingClientRect().right - pad;
    const overflows = () => {
      const vis = evts.filter(e => !e.hidden);
      return vis.length && vis[vis.length - 1].getBoundingClientRect().right > edge() + 0.5;
    };
    let dropped = 0;
    for (let i = evts.length - 1; i > 0 && overflows(); i--) { evts[i].hidden = true; dropped++; }
    if (!dropped) return;
    const more = document.createElement('b');
    more.className = 'more';
    more.textContent = '+' + dropped;
    det.appendChild(more);
    // the count has to fit too, so give up one more item if it does not
    while (dropped < evts.length - 1 && more.getBoundingClientRect().right > edge() + 0.5) {
      const last = evts.filter(e => !e.hidden).pop();
      if (!last) break;
      last.hidden = true; dropped++;
      more.textContent = '+' + dropped;
    }
  });
}

function alignTourItems() {
  document.querySelectorAll('.day .detail').forEach(det => {
    const items = [...det.querySelectorAll(':scope > .evt[data-wg="1"]')];
    if (!items.length) return;
    const cv = det.closest('.canvas');
    const band = cv && cv.querySelector('.band.wg');
    if (!band) return;
    const b = band.getBoundingClientRect(), c = cv.getBoundingClientRect();
    const half = b.left + b.width / 2;
    const span = (from, to) => {
      const r = document.createRange();
      r.setStartBefore(from); r.setEndAfter(to);
      return r.getBoundingClientRect();
    };
    if (half + span(items[0], items[items.length - 1]).width > c.right - 4) return;
    // THE TOUR'S COLUMN COMES FIRST (Alan, 12.09: "the wg events should align
    // so the 10 should push kino to the right"). A tour item used to be pinned
    // to the end of the line whatever else was there, so on a day that also
    // held one of Alan's evening events it landed past it and the tour's
    // column broke. Now the column wins: anything of Alan's that would sit at
    // or right of it steps aside, and picks up again after the tour's items.
    const own = [...det.children].filter(e => e.classList && e.classList.contains('evt') && e.dataset.wg !== '1');
    const after = own.filter(e => e.getBoundingClientRect().left >= half - 1);
    const wasAt = after.length ? after[0].getBoundingClientRect().left : 0;
    if (after.length) {
      // a tour item must not tread on the banner's own label, so never left of it
      if (half < b.left) return;
      items.forEach(it => det.insertBefore(it, after[0]));
      after.forEach(e => { e.style.marginLeft = ''; e.classList.remove('tcol'); });
    }
    const at = items[0].getBoundingClientRect().left;
    const shift = half - at;
    if (shift > 1) {
      items[0].classList.add('tcol');
      items[0].style.marginLeft = shift.toFixed(1) + 'px';
    }
    if (after.length) {
      const end = span(items[0], items[items.length - 1]).right;
      const want = Math.max(wasAt, end + SLOT_GAP);
      const now = after[0].getBoundingClientRect().left;
      if (want - now > 1) {
        after[0].classList.add('tcol');
        after[0].style.marginLeft = (want - now).toFixed(1) + 'px';
      }
    }
  });
}

function alignByTime() {
  if (!KVELD) return;
  const hour = b => b.dataset.t ? Number(b.dataset.t.slice(0, 2)) : -1;
  // widest, ignoring one that is half again longer than the next down
  const ordinary = ws => {
    const w = ws.slice().sort((x, y) => y - x);
    if (!w.length) return 0;
    const keep = Math.max(1, Math.ceil(w.length * 2 / 3));
    while (w.length > keep && w[0] > w[1] * SLOT_OUTLIER) w.shift();
    return w[0];
  };
  document.querySelectorAll('.month').forEach(mon => {
    const cands = [];
    mon.querySelectorAll('.day .detail').forEach(det => {
      const all = [...det.querySelectorAll(':scope > .evt')];
      if (!all.length) return;
      // A TOUR'S ITEMS ARE PINNED LAST WHATEVER THE CLOCK SAYS, so they are no
      // part of the time reading. While they counted, a 15:00 tour item at the
      // end of a row made the trailing run a non-evening one, and Alan's 21:00
      // was swept into the afternoon block with it (his 10th, 12.09).
      let last = all.length;
      while (last > 0 && all[last - 1].dataset.wg === '1') last--;
      const evts = all.slice(0, last);
      if (!evts.length) return;
      let iA = evts.length, iE = evts.length;
      for (let k = evts.length - 1; k >= 0; k--) {
        const h = hour(evts[k]);
        if (h >= EVENING_FROM && iA === evts.length) iE = k;
        else if (h >= AFTERNOON_FROM) iA = k;
        else break;
      }
      if (iA > iE) iA = iE;
      if (iA === evts.length) return;                       // nothing after noon
      // a clipped line keeps its pinned order, and runs cut from an unsorted
      // line would put the wrong thing in a column
      for (let k = 0; k < iA; k++) if (hour(evts[k]) >= AFTERNOON_FROM) return;
      const cv = det.closest('.canvas').getBoundingClientRect();
      const lone = det.classList.contains('kveld');
      det.classList.remove('kveld');
      // WIDTHS, NEVER POSITIONS: a row already flushed right reports the place
      // it is trying to leave, and the two browsers disagree about when that
      // reading goes stale. Text widths and the box's own left do not move.
      const box = det.getBoundingClientRect();
      const padL = parseFloat(getComputedStyle(det).paddingLeft) || 0;
      const span = (from, to) => {
        if (from > to) return 0;
        const r = document.createRange();
        r.setStartBefore(evts[from]); r.setEndAfter(evts[to]);
        return r.getBoundingClientRect().width;
      };
      cands.push({ det, evts, iA, iE, lone, cvW: cv.width,
        base: box.left + padL - cv.left,
        headW: span(0, iA - 1), aW: span(iA, iE - 1), eW: span(iE, evts.length - 1) });
    });
    if (!cands.length) return;
    // the narrowest canvas in the month is the ordinary one; a row that has
    // borrowed the city cell must not drag the columns right for everyone
    const cvW = Math.min(...cands.map(c => c.cvW));
    const wE = ordinary(cands.filter(c => c.eW > 0).map(c => c.eW));
    const wA = ordinary(cands.filter(c => c.aW > 0).map(c => c.aW));
    // The evening column is placed by what it must hold. The afternoon one is
    // placed at MIDDAY — halfway to it — and not derived from it: deriving it
    // put the afternoon's last letters right up against the evening column on
    // a wide screen, and pushed it off the row entirely on a narrow one
    // (Alan, 12.09). Midday is the same fraction of the row at every size.
    const E = wE ? Math.max(cvW * SLOT_COL_MIN, cvW - 7 - wE) : 0;
    let A = wA ? (E ? E / 2 : cvW - 7 - wA) : 0;
    if (A < cvW * SLOT_COL_MIN / 2) A = 0;                  // too near the left to read as midday
    cands.forEach(c => {
      let pos = c.base + c.headW;
      const clear = c.headW ? SLOT_GAP : 0;
      // room to the right is the evening column only on a day that HAS an
      // evening item; otherwise the afternoon may run on to the end of the row
      if (c.aW && A && A >= pos + clear && A + c.aW <= (c.eW ? E - SLOT_GAP : c.cvW - 4)) {
        c.evts[c.iA].classList.add('tcol');
        c.evts[c.iA].style.marginLeft = (A - pos).toFixed(1) + 'px';
        pos = A;
      }
      pos += c.aW;
      const clearE = pos > c.base ? SLOT_GAP : 0;
      if (c.eW && E && E >= pos + clearE && E + c.eW <= c.cvW - 4) {
        c.evts[c.iE].classList.add('tcol');
        c.evts[c.iE].style.marginLeft = (E - pos).toFixed(1) + 'px';
      } else if (c.lone) {
        c.det.classList.add('kveld');                       // too long: keep the right edge
      }
    });
  });
}

function alignLinesToBands() {
  document.querySelectorAll('.day .canvas').forEach(cv => {
    const det = cv.querySelector('.detail');
    if (!det) return;
    det.querySelectorAll('.nudge').forEach(sp => { sp.replaceWith(...sp.childNodes); });
    det.normalize();
    if (!det.textContent.trim()) return;
    const box = det.getBoundingClientRect();
    const lines = [...cv.querySelectorAll('.band')]
      .map(b => b.getBoundingClientRect().left)
      .filter(x => x > box.left + 2 && x < box.right - 2)
      .sort((a, b) => a - b);
    // A row pushed out to the evening column can already reach the right edge.
    // Nudging a word right there costs the last letters, so the nudge only
    // spends room the row actually has (Alan's 17th, 12.09).
    const cs = getComputedStyle(det);
    const room = det.clientWidth - (parseFloat(cs.paddingLeft) || 0)
      - (parseFloat(cs.paddingRight) || 0) - contentWidth(det);
    for (const x of lines) nudgeWordAt(det, x, Math.max(0, Math.min(NUDGE_RIGHT, room)));
  });
}

// Push the single word that `lineX` runs through far enough right that the
// line lands in the gap before it — or, if that costs more than NUDGE_MAX,
// on the nearest gap between two of its letters. Measured from the real
// rendered glyphs with a Range, so italics and bold are accounted for.
function contentWidth(det) {
  const r = document.createRange(); r.selectNodeContents(det);
  return r.getBoundingClientRect().width;
}

function nudgeWordAt(det, lineX, maxRight) {
  const walk = document.createTreeWalker(det, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let node;
  while ((node = walk.nextNode())) {
    const t = node.nodeValue;
    let i = 0;
    while (i < t.length) {
      if (/\s/.test(t[i])) { i++; continue; }
      let j = i; while (j < t.length && !/\s/.test(t[j])) j++;
      r.setStart(node, i); r.setEnd(node, j);
      const w = r.getBoundingClientRect();
      // strictly INSIDE the word: a line in the space beside it is already fine
      if (w.width && lineX > w.left + 0.5 && lineX < w.right - 0.5) {
        // every gap this word offers: before it, then between each letter pair
        let shift = 0;
        for (let k = i; k <= j; k++) {
          let gap;
          if (k === i) { gap = w.left; }
          else { r.setStart(node, i); r.setEnd(node, k); gap = r.getBoundingClientRect().right; }
          const d = lineX - gap;
          if (d < -NUDGE_LEFT || d > maxRight) continue;
          if (!shift || Math.abs(d) < Math.abs(shift)) shift = d;
        }
        if (Math.abs(shift) < 0.4) return;
        r.setStart(node, i); r.setEnd(node, j);
        const sp = document.createElement('span');
        sp.className = 'nudge';
        sp.style.marginLeft = shift.toFixed(1) + 'px';
        r.surroundContents(sp);
        return;                                       // one word per line
      }
      i = j;
    }
  }
}

function renderMonthEl(y, m) {
  const { spans, details, nOwn, nOvl } = monthLayout(y, m, visibleEvents(), overlayEvents());
  const wgDet = wgDetailEvents();
  const hol = holidays(y);
  const todayStr = fmt(new Date());
  const n = daysInMonth(y, m);
  const flights = state.cities ? buildFlightIndex() : null;
  let prevCity = null;
  let cityShown = false; // did the city actually stand on yesterday's row?
  // A LANE IS A STRIPE YOU FOLLOW DOWN THE MONTH, not a box sized to its
  // longest label. It used to be the latter, and "Fanny og Alexander" made it
  // 134px on all 28 rows to serve four label rows; two projects then filled a
  // phone row completely and a third lane fell off the edge of any row that
  // also had a city — the Festivaluke tint Alan saw go missing on 23 Feb.
  // Now that a label can reach LEFT as well as right, it no longer needs its
  // lane to be wide enough to hold it, and the lane can be what it is for.
  // BANDS OVERLAP, STAGGERED BY A STRIP (Alan's two mockups, 12.09). Each band
  // is as wide as its OWN title and starts one strip further right than the one
  // before, so the later band paints over the earlier one and every band still
  // shows a strip of its own colour down the month. That costs one strip per
  // project instead of a full title width per project, and the label can stay
  // where it belongs — at its own band's left edge, never packed onto a row.
  const LANE_STRIPE = 4, LABEL_MAX = 11, LANE_PAD = 1.4, LANE_GAP = 0, WG_GAP = 4;
  // one width per span for the whole month, so a band never changes width
  // between rows; a title too long to fit takes its widest WORD, because that
  // is what gets written down the band one word per row
  const bandEm = {};
  for (const ev of spans) {
    const full = emWidth(ev.title) + LANE_PAD;
    const words = ev.title.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
    const widest = (words.length ? Math.max(...words.map(emWidth)) : 0) + LANE_PAD;
    bandEm[ev.id] = laneBox.px
      ? Math.max(LANE_STRIPE, Math.min(full <= LABEL_MAX ? full : widest, LABEL_MAX))
      : 5.5;
  }
  const natW = [];                       // what each lane would need on its own
  for (let i = 0; i < nOwn + nOvl; i++) {
    let w = LANE_STRIPE;
    for (const ev of spans) if (ev._lane === i) w = Math.max(w, bandEm[ev.id]);
    natW[i] = w;
  }
  // TWO MODELS, SO ALAN CAN JUDGE THEM ON HIS OWN CALENDAR (12.09). STAIR is
  // today's: bands overlap, each starting a strip right of the last, which buys
  // width and costs the clean edge you follow a tour down by. COLUMN is v1's:
  // every band has its own column and nothing is painted over, which reads
  // better and costs width. Labels reach left and right in both.
  const laneEm = [], laneW = [];
  let reach = 0;
  for (let i = 0; i < nOwn + nOvl; i++) {
    const gap = (nOvl && nOwn && i === nOwn - 1 ? WG_GAP : 0);
    if (BANDS === 'column') {
      laneEm[i] = natW[i] + LANE_GAP + gap;
      laneW[i] = natW[i];
    } else {
      laneEm[i] = (laneBox.px ? LANE_STRIPE : 3.5) + LANE_GAP + gap;
      const left = laneEm.slice(0, i).reduce((a, b) => a + b, 0);
      let w = natW[i];
      // every band must end a strip right of its neighbour, or a later one
      // painting over an earlier one would swallow it whole
      if (i && left + w < reach + LANE_STRIPE) w = reach + LANE_STRIPE - left;
      laneW[i] = w;
      reach = left + w;
    }
  }
  const laneLeft = i => laneEm.slice(0, i).reduce((a, b) => a + b, 0);

  // WHICH DAY A LABEL LANDS ON (Alan, 12.09). A band that begins this month has
  // to say its name on the day it begins — that is the one label that cannot
  // move. A repeat is only a beat, and the beat means nothing to a reader, so
  // when a later band would paint over it the repeat moves UP: to the nearest
  // earlier day of its own run where nothing covers it. That is what keeps
  // "Fanny og Alexander" whole on the Sunday instead of cut to "Fanny" on the
  // Monday that Kongen av Bastøy starts.
  const mp = `${y}-${String(m + 1).padStart(2, '0')}-`;
  const dayStr = d => mp + String(d).padStart(2, '0');
  const activeOn = (ev, d) => ev.start <= dayStr(d) && ev.end >= dayStr(d);
  const coveredOn = (ev, d) => spans.some(o => o !== ev && o._lane > ev._lane
    && activeOn(o, d) && laneLeft(o._lane) < laneLeft(ev._lane) + (bandEm[ev.id] || 0));
  const labelDays = {};
  for (const ev of spans) {
    const set = new Set();
    for (let d = 1; d <= n; d++) {
      if (!activeOn(ev, d)) continue;
      const off = Math.round((parseDate(dayStr(d)) - parseDate(ev.start)) / 864e5);
      const untilNextBeat = (14 - (off % 14)) % 14;
      if (!(off % 14 === 0 || (d === 1 && off > 0 && untilNextBeat > 7))) continue;
      if (off === 0 || !coveredOn(ev, d)) { set.add(d); continue; }
      let moved = null;
      for (let k = d - 1; k >= 1 && activeOn(ev, k); k--) {
        if (!coveredOn(ev, k) && !set.has(k)) { moved = k; break; }
      }
      set.add(moved === null ? d : moved);
    }
    labelDays[ev.id] = set;
  }
  // a title too long for its lane is written DOWN the band, one word per row
  const wrapPlan = {}; // event id -> { from: day, words: [...] }
  let rows = '';
  for (let day = 1; day <= n; day++) {
    const d = new Date(y, m, day);
    const ds = fmt(d);
    const wi = weekdayIdx(d);
    const h = hol[ds];
    const red = wi === 6 || (h && h.red);
    // GREY ON SUNDAYS AND HOLIDAYS ONLY (Alan, 12.09: "my cardboard one is
    // only grayscale Sundays"). ?sat=1 tints Saturdays as well, to compare.
    const free = wi === 6 || !!h || (SAT_GREY && wi === 5);
    // Cities live in the info column on the right (Alan, 2026-08-25): on the
    // day you move, on the 1st so every month block states it, and repeated
    // every week on the row BELOW the week number (Tuesday) — so the week
    // number keeps Monday to itself and you always know where you are.
    let cityTxt = '', cityTbc = false;
    if (flights) {
      const move = cityOn(ds, flights);
      const city = move && move.dest;
      // Monday belongs to the week number — never a city there (Alan, 2026-08-25).
      // Otherwise: on the day you move, and repeated weekly on Tuesday.
      // ALAN, 12.09: the Tuesday repeat exists so you always know where you
      // are. A week that already has a travel day does not need it — the
      // flight's own row says the city, and a city under the same city reads
      // as a mistake. Only Tue/Wed/Thu count: a flight late in the week would
      // leave the first four days blank. A MONDAY flight cannot say it in this
      // column at all (Monday is the week number's), so Tuesday still speaks.
      const flownThisWeek = wi === 1 && [-1, 0, 1, 2].some(k => {
        const x = new Date(d); x.setDate(x.getDate() + k);
        return flights.some(f => f.date === fmt(x));
      });
      const repeat = wi === 1 && !cityShown && !flownThisWeek;
      if (city && wi !== 0 && (city !== prevCity || repeat)) {
        cityTxt = cityLabel(city);
        cityTbc = !!move.tbc; // planned, not booked: reads italic
      }
      prevCity = city;
      cityShown = !!cityTxt && !h; // a holiday keeps the cell, so nothing showed
    }
    const todays = details.filter(e => e.start === ds);
    const wgTodays = wgDet.filter(e => e.start === ds);
    const lineEmpty = !todays.length && !wgTodays.length;
    // bands grouped left: Alan's solid lanes, then wg's dashed lanes
    const ownEvs = [], wgEvs = [];
    for (let l = 0; l < nOwn; l++) ownEvs[l] = spans.find(e => !e._wg && e._lane === l && e.start <= ds && e.end >= ds);
    for (let g = 0; g < nOvl; g++) wgEvs[g] = spans.find(e => e._wg && e._lane === nOwn + g && e.start <= ds && e.end >= ds);
    const hasOwn = ownEvs.some(Boolean);
    const hasWgBand = wgEvs.some(Boolean);

    // THE ROW IS ONE SPACE, NOT COLUMNS (Alan, 02.09.2026).
    // Bands are backgrounds positioned by lane; the day line is drawn OVER
    // them and begins at the first lane carrying no LABEL today — because a
    // band away from its label is only a tint, and text may lie on a tint.
    // Everything inside the canvas is absolutely positioned, so a crowded day
    // can never grow taller than one line. That is the rhythm the almanakk
    // cannot lose, and the old grid could not guarantee it.
    const laneEvs = ownEvs.concat(wgEvs);
    const labelledAt = ev => !!ev && !!labelDays[ev.id] && labelDays[ev.id].has(day);
    // A band draws text today if it is a label row OR a continuation row of a
    // title being written one word per row. BOTH must push the line right, or
    // the line lands on top of them — the collision the first build had.
    const drawsText = ev => {
      if (!ev) return false;
      if (labelledAt(ev)) return true;
      const plan = wrapPlan[ev.id];
      if (!plan) return false;
      const step = day - plan.from;
      return step > 0 && step < plan.words.length;
    };
    // Past the bands SHOWING A LABEL only: a band away from its label is just a
    // tint, and the line may lie on it. Clearing every band cost too much room
    // (Alan, 12.09); what made it read badly was a 2px edge cutting the words,
    // so the edge is now hairline and the tint carries the identity.

    // A LABEL MAY REACH LEFT AS WELL AS RIGHT (Alan, 12.09). A lane is as wide
    // as the longest label it carries all month — "Fanny og Alexander" makes it
    // 134px — and it holds that width on all 28 rows to serve four label rows.
    // On a phone two projects then ate 258 of 357px, and a label in the third
    // lane could not start until 342. So a label now begins at the first
    // position free on ITS OWN ROW, not at its lane's x, and packs against the
    // label before it. It carries its own tint with it: they overlap only
    // partly, so each band's colour still shows on the row (Alan: "we still
    // see each band's color").
    let bands = '';
    let lineStartEm = 0;
    laneEvs.forEach((ev, i) => {
      if (!ev) return;
      const showLabel = labelledAt(ev);
      const endInMonth = ev.end.slice(0, 7) === ds.slice(0, 7) ? Number(ev.end.slice(8, 10)) : n;
      const words = ev.title.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
      // still one word per row when the title genuinely will not fit its band
      if (showLabel) {
        if (words.length > 1 && endInMonth > day && emWidth(ev.title) > LABEL_MAX - 0.4) {
          wrapPlan[ev.id] = { from: day, words: words.slice(0, Math.min(3, endInMonth - day + 1)) };
        } else {
          delete wrapPlan[ev.id];
        }
      }
      const plan = wrapPlan[ev.id];
      const step = plan ? day - plan.from : -1;
      let txt = '';
      if (showLabel) txt = plan ? plan.words[0] : ev.title;
      else if (plan && step > 0 && step < plan.words.length) txt = plan.words[step];
      const laneX = laneLeft(i);
      const w = laneW[i] || laneEm[i];   // the lane's width, so a band is a straight column
      // the line begins after the last band that actually says something here
      if (txt) lineStartEm = Math.max(lineStartEm, laneX + w);
      bands += `<i class="band ${ev._wg ? 'wg' : ''} ${isShow(ev) ? 'showband' : ''}`
        + ` ${ev.start === ds ? 'bstart' : ''} ${isTbc(ev) ? 'tbc' : ''}"`
        + ` data-eid="${ev.id}" style="left:${laneX}em;width:${w.toFixed(2)}em;`
        + `--w:${w.toFixed(2)}em;--c:${ev.color};--ci:${inkColor(ev.color)}">`
        + (txt ? `<b>${esc(txt)}</b>` : '') + '</i>';
    });
    // ONE wide shared day line: Alan's headline first, shows (any calendar)
    // pinned next, then Alan's items, then wg's dimmed items
    const lineItems = todays.map(e => ({ e, wg: false }))
      .concat(wgTodays.map(e => ({ e, wg: true })))
      .sort((a, b) => {
        const k = x => {
          const t = effTime(x.e) || '';
          // Detaljer view: pure running order (pinning exists only where clipping exists)
          if (state.detailed) return t ? '1' + t : '0';
          if (!t && !x.wg && !isShow(x.e)) return '0';
          if (isShow(x.e)) return '1' + t;
          return (x.wg ? '3' : '2') + t;
        };
        const ka = k(a), kb = k(b);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
    // compact views show WHAT (no clock prefix); Detaljer view and the day box show WHEN
    const evtHtml = (it) => {
      const e = it.e, wg = it.wg;
      const txt = state.detailed ? (e.time ? e.time + ' ' : '') + e.title
        : (it._legs && it._legs.length > 2 ? journeyLabel(it._legs) : compactTitle(e));
      return `<b class="evt ${wg ? 'wgd' : ''} ${isTbc(e) ? 'tbc' : ''} ${isShow(e) ? 'showevt' : ''}" data-eid="${e.id}" data-t="${effTime(e) || ''}" data-wg="${wg ? 1 : 0}" style="color:${evInk(e)}">`
        + esc(txt) + '</b>';
    };
    // starts where the labels stop — far left on a day with no band label at all
    let movedToInfo = null;
    const lineFinal = collapseJourneys(lineItems);
    // A TRAVEL DAY BELONGS IN THE CITY COLUMN (Alan, 12.09). That column answers
    // "where am I"; on the day you move it should answer "where am I going".
    // Codes only — the column is narrow — and the journey then leaves the day
    // line, which is where the crowding was. A holiday still wins the cell.
    let journeyTxt = '', journeyAlone = false, journeyShort = '', journeyTiny = '';
    // A MONDAY FLIGHT SHARES THE CELL (Alan, 12.09): the journey goes where
    // every other journey goes, and the week keeps its NUMBER, losing only the
    // word "uke" — "Oslo → Bangkok 9". Monday still never gives its week away;
    // it just stops needing a whole cell to say it.
    if (!h) {
      const own = lineFinal.filter(it => !it.wg && it._legs && it._legs.length >= 2);
      if (own.length === 1) {
        const legs = own[0]._legs;
        movedToInfo = own[0];
        // With the day to itself it says the whole thing and reaches left into
        // the empty line; sharing the day, just the arrow and where you land —
        // and the arrow grows, so it still reads as a move (Alan, 12.09).
        const wk = wi === 0 ? ' <span class="wknum">' + isoWeek(d) + '</span>' : '';
        // narrowest reading of all, for a phone: the code, never the week
        journeyTiny = '<span class="arw big">\u2192</span> ' + esc(cityCode(legs[legs.length - 1])) + wk;
        journeyShort = '<span class="arw big">\u2192</span> ' + esc(cityLabel(legs[legs.length - 1])) + wk;
        // ONE RULE FOR THE TWO READINGS (Alan lost track of it, 12.09, fairly):
        // it says the whole trip whenever the whole trip fits, and drops to the
        // arrow and where you land when it does not. Nothing else decides it.
        journeyTxt = esc(cityLabel(legs[0])) + ' <span class="arw">\u2192</span> '
          + esc(cityLabel(legs[legs.length - 1])) + wk;
        journeyAlone = true;
      }
    }
    // One cell, one line, one thing in it: a holiday, else the week number on
    // Monday, else the city. Long names step down a size rather than clip.
    const info = h
      ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"><span class="${h.red ? 'red' : ''} ${h.name.length > 11 ? 'long' : ''} ${h.name.length > 15 ? 'xlong' : ''}">${esc(h.name)}</span></span>`
      : journeyTxt
        ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"><span class="cty journey ${journeyAlone ? 'wide' : ''}" data-short="${esc(journeyShort)}" data-tiny="${esc(journeyTiny)}">${journeyTxt}</span></span>`
      : cityTxt
        ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"><span class="cty ${cityTxt.length > 8 ? 'long' : ''} ${cityTbc ? 'tbc' : ''}">${esc(cityTxt)}</span></span>`
        : (wi === 0 ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}">${L().week} ${isoWeek(d)}</span>`
                    : `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"></span>`);
    // EVENING VARIANT (preview, ?kveld=1 — Alan, 12.09). His idea was a time
    // axis down the day line: morning left, midday middle, evening right. A
    // real axis cannot work here, because the line starts after the last band
    // and so has no fixed origin — "midday" would sit in a different place on
    // every row. Two states can: the RIGHT edge never moves, so a lone evening
    // event flushed right tells the truth that a middle position would not.
    // Only on a day with ONE thing on the line, so the rhythm is untouched.
    const shown = lineFinal.filter(it => it !== movedToInfo);
    const only = shown.length === 1 ? effTime(shown[0].e) : null;
    const kveld = KVELD && only && Number(only.slice(0, 2)) >= EVENING_FROM;
    const detail = `<span class="detail ${kveld ? 'kveld' : ''}" style="left:${lineStartEm}em">`
      + shown.map(evtHtml).join('')
      + '</span>';
    const showDay = todays.some(isShow) || wgTodays.some(isShow)
      || ownEvs.some(e => e && isShow(e)) || wgEvs.some(e => e && isShow(e));
    // NOTHING IN THE CITY CELL, SO LEND IT TO THE LINE (Alan, 12.09: "there is
    // air to the right of it and no city, so that would be okay"). The two
    // overlap in the grid rather than the column being given up, so the cell
    // stays where it is and still takes the tap that plans a move.
    const airRight = !h && !journeyTxt && !cityTxt && wi !== 0;
    rows += `<div class="day ${red ? 'red' : ''} ${free ? 'free' : ''} ${wi === 6 ? 'sun' : ''} ${ds === todayStr ? 'today' : ''} ${showDay ? 'showday' : ''} ${airRight ? 'airright' : ''}" data-date="${ds}">`
      + `<span class="num">${day}</span><span class="wd">${L().wd[wi]}</span>`
      + `<span class="canvas">` + bands + detail + '</span>'
      + info + `</div>`;
  }
  return `<section class="month ${state.cities ? 'cities' : ''} ${nOvl ? 'haswg' : ''}" style="--lanes:${nOwn};--wg:${nOvl}">`
    + `<h2>${L().months[m]} <small>${y}</small></h2>${rows}</section>`;
}

// THE WEEK IS THE DETAIL SURFACE (Alan, 12.09). Not a day page — he will not
// fill a day with fifty things — and not an hour grid, because most of what he
// keeps has no clock on it. It is the diary spread he sent: seven days, each
// given as many lines as it has events, every event whole on its own line and
// plainly under its day. The month says the shape of the month; this says what
// is actually in it.
function mondayOf(ds) {
  const d = parseDate(ds);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function renderWeekEl(ds) {
  const mon = mondayOf(ds);
  const hol = holidays(mon.getFullYear());
  const holNext = holidays(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6).getFullYear());
  const tour = new Set(tourCalIds());
  const todayStr = fmt(new Date());
  let days = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    const key = fmt(d);
    const h = hol[key] || holNext[key];
    const red = i === 6 || (h && h.red);
    const free = i === 6 || !!h || (SAT_GREY && i === 5);
    // A RUNNING PROJECT IS NOT NEWS SEVEN TIMES (12.09). What spans the week
    // is said once at the top of it; a day's own lines are the day's own
    // events, which is what you came to the week to read.
    const evs = state.events
      .filter(e => e.start <= key && e.end >= key && e.end === e.start)
      .sort((a, b) => {
        const k = e => (effTime(e) ? '2' + effTime(e) : '1');
        return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
      });
    const lines = evs.map(e => {
      const span = e.end > e.start;
      const when = e.time ? e.time : (span ? '' : '');
      return `<p class="wev ${tour.has(e.calId) ? 'wg' : ''} ${isTbc(e) ? 'tbc' : ''} ${isShow(e) ? 'show' : ''}"`
        + ` data-eid="${e.id}" data-date="${key}">`
        + `<span class="wt">${esc(when)}</span>`
        + `<span class="wn" style="color:${evInk(e)}">${esc(e.title)}</span>`
        + (span ? `<span class="wr">${esc(e.start)} – ${esc(e.end)}</span>` : '')
        + '</p>';
    }).join('');
    // the diary keeps ruled lines whether or not the day is used
    const blanks = Math.max(0, 2 - evs.length);
    days += `<section class="wday ${free ? 'free' : ''} ${red ? 'red' : ''} ${key === todayStr ? 'today' : ''}`
      + `${key === state.weekDay ? ' picked' : ''}" data-date="${key}">`
      + `<h3><span class="wnum">${d.getDate()}</span> <span class="wname">${L().wdLong[i]}</span>`
      + (h ? `<span class="whol">${esc(h.name)}</span>` : '') + '</h3>'
      + lines + '<p class="wblank"></p>'.repeat(blanks)
      + '</section>';
  }
  const end = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const lastKey = fmt(end), firstKey = fmt(mon);
  const dm = ds2 => Number(ds2.slice(8, 10)) + '.' + Number(ds2.slice(5, 7)) + '.';
  // WHERE IN THE WEEK IT RUNS, NOT JUST THAT IT DOES (Alan, 12.09: "what if
  // there are events running two or three days inside the week?"). Seven cells
  // in the week's own order, filled for the days it covers, in the event's own
  // colour. A tour that runs Tue to Thu says so at a glance; one that runs the
  // whole week fills the ruler. Italics could only have said "not all of it".
  const keyOf = i => fmt(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
  const ruler = e => {
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const k = keyOf(i);
      const on = e.start <= k && e.end >= k;
      cells += `<i class="${on ? 'on' : ''}"></i>`;
    }
    return `<span class="wbar" style="--c:${e.color}">${cells}</span>`;
  };
  const runs = state.events
    .filter(e => e.end > e.start && e.start <= lastKey && e.end >= firstKey)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .map(e => `<p class="wrun ${tour.has(e.calId) ? 'wg' : ''} ${isTbc(e) ? 'tbc' : ''}"`
      + ` data-eid="${e.id}" data-date="${firstKey}">`
      + `<span class="wn" style="color:${evInk(e)}">${esc(e.title)}</span>`
      + ruler(e)
      + `<span class="wr">${dm(e.start)} – ${dm(e.end)}</span></p>`).join('');
  const span = mon.getMonth() === end.getMonth()
    ? L().months[mon.getMonth()]
    : L().months[mon.getMonth()] + ' / ' + L().months[end.getMonth()];
  return `<section class="week"><h2>${span} <small>${end.getFullYear()}</small>`
    + `<span class="wkno">${L().week} ${isoWeek(mon)}</span></h2>`
    + (runs ? `<div class="wruns"><p class="wrunhead"><span class="wn"></span>`
        + `<span class="wbar">${L().wd.map(w => `<i>${w}</i>`).join('')}</span>`
        + `<span class="wr"></span></p>${runs}</div>` : '')
    + `${days}</section>`;
}

function render(group) {
  closePanel(true);
  const app = $('#app');
  if (state.view === 'year') {
    const g = group || 3;
    let html = '';
    for (let start = 0; start < 12; start += g) {
      html += `<div class="quarter g${g}">`;
      for (let m = start; m < Math.min(start + g, 12); m++) html += renderMonthEl(state.year, m);
      html += '</div>';
    }
    app.className = 'year';
    app.innerHTML = html;
    $('#period-label').textContent = state.year;
  } else if (state.view === 'week') {
    const ws = state.weekOf || fmt(new Date());
    app.className = 'weekview';
    app.innerHTML = renderWeekEl(ws);
    const m = mondayOf(ws);
    $('#period-label').textContent = L().week + ' ' + isoWeek(m) + ' · ' + m.getFullYear();
  } else {
    app.className = 'strip';
    app.innerHTML = renderMonthEl(state.year, state.month);
    $('#period-label').textContent = L().months[state.month].charAt(0) + L().months[state.month].slice(1).toLowerCase() + ' ' + state.year;
  }
  $('#view-year').classList.toggle('active', state.view === 'year');
  $('#view-month').classList.toggle('active', state.view === 'month');
  $('#view-detail').classList.toggle('active', state.view === 'week');
  measureLane();
  fitJourneys();
  orderByTime();
  fitEvenings();
  alignByTime();
  alignTourItems();
  clipLine();
  alignLinesToBands();
  updateChips();
}

function applyLang() {
  // the three views are glyphs, not words: at 375px the words wrapped the header
  // onto a second line, and a row that mixes words with symbols reads as a mistake
  for (const [sel, label] of [['#view-year', L().year], ['#view-month', L().month], ['#view-detail', L().detail]]) {
    const b = $(sel); b.title = label; b.setAttribute('aria-label', label);
  }
  $('#print').textContent = L().print;
  $('#signin').textContent = L().signin;
  $('#cal-picker summary').textContent = L().cals;
}

// "8-12 Antigone" on a day in March -> span March 8–12.
// "25-1 Antigone" (second number smaller) rolls into the next month.
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

// "-Oslo" is shorthand for typing. What gets SAVED should read as a move in
// Google Calendar too, where Ornella and anyone subscribed sees it — so the
// stored title becomes "→ Oslo". Any leading/trailing time and "tbc" survive,
// and the parser already reads the arrow form, so nothing downstream changes.
function arrowForm(text) {
  if (!cityMarker(text)) return text;
  // Capitalise a word only when it is entirely lower case. Anything already
  // carrying a capital is left exactly as typed — which is what keeps airport
  // codes resolving ("-BGO" must not become "Bgo") and spares names that are
  // capitalised in the middle. A trailing time or "tbc" is never a word here.
  const nice = c => c.replace(/\S+/g, w => /^[a-z\u00e0-\u00f6\u00f8-\u00ff]+$/.test(w) ? w[0].toUpperCase() + w.slice(1) : w);
  return text.replace(
    /^(\s*(?:\d{1,2}[:.]\d{2}\s+)?)(?:-+\s*>?|=>|\u2192)\s*([^,(]+?)\s*((?:\btbc\b.*)?)$/i,
    (_, lead, city, tail) => lead + '\u2192 ' + nice(city) + (tail ? ' ' + tail : ''));
}

async function addEvent(date, text) {
  text = arrowForm(text);
  const range = parseRange(date, text);
  if (state.mode === 'google') {
    await window.gcalCreateEvent(range ? range.start : date, range ? range.end : date, range ? range.title : text);
    const t = window.gcalTarget && window.gcalTarget();
    toast(t ? `${L().savedIn} ${t.name}` : L().saved);
  } else if (ALMANAKK_CONFIG.clientId) {
    throw new Error('Logg inn med Google først for å legge til.');
  } else {
    DEMO_EVENTS.push(range ? { c: 'alan', t: range.title, s: range.start, e: range.end } : { c: 'alan', t: text, s: date });
    loadDemo();
    toast(L().added);
  }
}

/* ---------- plan a move: tap the city corner of any day ---------- */

// Alan's design (02.09.2026): the right-hand corner of a day is where the city
// lives, so that is where you plan one. Name a city and you get a PLANNED move
// — "→ Roma tbc" — which reads italic everywhere. It is a way of saying "I mean
// to be in Roma from here", which is how he works out when to book flights.
// A booking on the same day wins and clears the plan (see cleanSupersededPlans).
async function openCityEdit(cell) {
  closePanel(true);
  const ds = cell.dataset.day;
  if (!ds) return;
  if (state.mode !== 'google') return toast(L().signinFirst);
  const idx = buildFlightIndex();
  // a booked flight that day already owns the city; a plan against it would be
  // silently overruled, so say so rather than accept an edit that does nothing
  if (idx.some(f => f.date === ds && !f.tbc)) return toast(L().cityFromFlight);
  const own = idx.find(f => f.date === ds && f.marker);
  const ev = own && state.events.find(e => String(e.id) === String(own.evId));
  const current = own ? own.dest : '';
  const tgt = !ev && window.gcalTarget && window.gcalTarget();

  const pop = document.createElement('div');
  pop.id = 'popover';
  pop.innerHTML = `<p class="dim"><b>${ds}</b></p>`
    + `<form class="qa"><input type="text" value="${esc(current)}" placeholder="${esc(L().cityPh)}" autocomplete="off"><button type="submit" class="add">OK</button></form>`
    + `<p class="qa-target">${esc(ev ? L().cityAsk : L().cityPlanAsk)}</p>`
    + (tgt ? `<p class="qa-target"><span class="dot" style="--c:${tgt.color}"></span>${L().goesTo} ${esc(tgt.name)}</p>` : '');
  document.body.appendChild(pop);
  const r = cell.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = (r.bottom + 4 + pop.offsetHeight > window.innerHeight
    ? Math.max(8, r.top - pop.offsetHeight - 4) : r.bottom + 4) + 'px';

  const form = pop.querySelector('form'), input = pop.querySelector('input');
  input.focus(); input.select();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.dataset.busy) return;
    const typed = input.value.trim().replace(/^\s*(?:-+\s*>?|=>|\u2192)\s*/, '');
    if (!typed || typed === current) return closePanel(true);
    form.dataset.busy = '1';
    form.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    try {
      if (ev) {
        // renaming an existing marker keeps whatever it already was
        const keepTbc = isTbc(ev) && !/\btbc\b/i.test(typed) ? ' tbc' : '';
        await window.gcalUpdateEvent(ev, arrowForm('-' + typed) + keepTbc);
        toast(L().updated);
      } else {
        // a new one is always a PLAN until a booking replaces it
        const tbc = /\btbc\b/i.test(typed) ? '' : ' tbc';
        await addEvent(ds, arrowForm('-' + typed) + tbc);
      }
      closePanel(true);
    } catch (err) {
      toast(err.message);
      delete form.dataset.busy;
      form.querySelectorAll('input, button').forEach(el => { el.disabled = false; });
    }
  });
}

// A planned move is a guess about a day you have not booked yet. The moment a
// real flight lands on that same day the guess is answered, so it is removed
// rather than left sitting under the booking saying something vaguer.
// Only ever a tbc marker you typed, only on the exact day a booking appears.
let cleaning = false;
window.almanakkAfterLoad = async function () {
  if (cleaning || state.mode !== 'google') return;
  const idx = buildFlightIndex();
  const booked = new Set(idx.filter(f => !f.tbc).map(f => f.date));
  const doomed = idx
    .filter(f => f.tbc && f.marker && booked.has(f.date))
    .map(f => state.events.find(e => String(e.id) === String(f.evId)))
    .filter(Boolean);
  if (!doomed.length) return;
  cleaning = true;
  try {
    for (const ev of doomed) await window.gcalDeleteEvent(ev);
    toast(`${L().planCleared} ${doomed.map(e => e.title).join(' · ')}`);
  } catch (err) {
    // leave it alone: the day panel still says the booking replaced it
  } finally { cleaning = false; }
};

/* ---------- day panel: tap a day -> full list + add field ---------- */

function openDayPanel(row) {
  closePanel(true);
  const date = row.dataset.date;
  // the day panel always shows EVERYTHING on this day, incl. the full wg schedule
  const tour = new Set(tourCalIds());
  const evs = state.events
    .filter(e => e.start <= date && e.end >= date)
    .sort((a, b) => {
      const k = e => (e.end > e.start ? '0' : (effTime(e) ? '2' + effTime(e) : '1'));
      const ka = k(a), kb = k(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  const pop = document.createElement('div');
  pop.id = 'popover';
  const tgt = window.gcalTarget && window.gcalTarget();
  const idx = buildFlightIndex();
  const move = cityOn(date, idx); // the panel always spells it out in full
  const city = move && cityName(move.dest);
  // a planned move ("-Roma tbc") that a real booking has taken over that day:
  // say so here, where the delete button already is, rather than let it go quiet
  const booked = idx.some(f => f.date === date && !f.tbc);
  const superseded = e => booked && isTbc(e) && cityMarker(e.title);
  pop.innerHTML = `<p class="dim"><b>${date}</b>${city ? `<span class="city-tag ${move.tbc ? 'tbc' : ''}">${esc(city)}</span>` : ''}</p>`
    + evs.map(e =>
      `<p class="${tour.has(e.calId) ? 'wgrow' : ''} ${isTbc(e) ? 'tbc' : ''}">${tour.has(e.calId) ? '<span class="wg-mark">wg</span> ' : ''}`
      + `<b style="color:${evInk(e)}">${esc((e.time ? e.time + ' ' : '') + e.title)}</b>`
      + (superseded(e) ? ` <span class="dim">· ${L().replaced}</span>` : '')
      + (e.start !== e.end ? ` <span class="dim">${e.start} – ${e.end}</span>` : '')
      + ` <button class="x" data-edit="${e.id}">${L().edit}</button>`
      + ` <button class="x" data-del="${e.id}">${L().del}</button></p>`).join('')
    + `<form class="qa"><input type="text" placeholder="${L().newPh}" autocomplete="off"><button type="submit" class="add">${L().add}</button></form>`
    + (tgt ? `<p class="qa-target"><span class="dot" style="--c:${tgt.color}"></span>${L().goesTo} ${esc(tgt.name)}</p>` : '');
  document.body.appendChild(pop);
  const r = row.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = (r.bottom + 4 + pop.offsetHeight > window.innerHeight ? Math.max(8, r.top - pop.offsetHeight - 4) : r.bottom + 4) + 'px';
  const qa = pop.querySelector('.qa');
  qa.addEventListener('submit', async e => {
    e.preventDefault();
    // saving posts to Google and then reloads the year, which takes seconds on a
    // phone; without this the field stays live and a second Enter books it twice
    if (qa.dataset.busy) return;
    const text = pop.querySelector('input').value.trim();
    if (!text) return closePanel();
    qa.dataset.busy = '1';
    qa.querySelectorAll('input, button').forEach(el => { el.disabled = true; });
    try {
      await addEvent(date, text);
      closePanel(true);
    } catch (err) {
      toast(err.message);
      delete qa.dataset.busy;
      qa.querySelectorAll('input, button').forEach(el => { el.disabled = false; });
    }
  });
  pop.addEventListener('click', async e => {
    const editId = e.target.dataset.edit;
    if (editId) {
      const ev = state.events.find(x => String(x.id) === editId);
      if (!ev) return;
      const p = e.target.closest('p');
      p.innerHTML = `<form class="qa"><input type="text" value="${esc(ev.title)}"><button type="submit" class="add">OK</button></form>`;
      const input = p.querySelector('input');
      input.focus();
      input.select();
      p.querySelector('form').addEventListener('submit', async se => {
        se.preventDefault();
        const t = input.value.trim();
        if (!t || t === ev.title) return closePanel(true);
        try {
          await updateEventTitle(ev, t);
          closePanel(true);
          toast(L().updated);
        } catch (err) { toast(err.message); }
      });
      return;
    }
    const id = e.target.dataset.del;
    if (!id) return;
    const ev = state.events.find(x => String(x.id) === id);
    if (!ev) return;
    try {
      await deleteEvent(ev);
      closePanel();
      toast(L().deleted, { label: L().undo, fn: () => undoDelete(ev) });
    } catch (err) { toast(err.message); }
  });
}
// Don't close the panel if the add-field holds unsaved text.
function closePanel(force) {
  const p = $('#popover');
  if (!p) return;
  const input = p.querySelector('.qa input');
  if (!force && input && input.value.trim()) return;
  p.remove();
}

async function undoDelete(ev) {
  if (state.mode === 'google') {
    await window.gcalRestoreEvent(ev);
  } else {
    DEMO_EVENTS.push(ev.src);
    loadDemo();
  }
  toast(L().restored);
}

async function updateEventTitle(ev, title) {
  if (state.mode === 'google') {
    await window.gcalUpdateEvent(ev, title);
  } else if (ALMANAKK_CONFIG.clientId) {
    throw new Error('Logg inn med Google først.');
  } else {
    ev.src.t = title;
    loadDemo();
  }
}

async function deleteEvent(ev) {
  if (state.mode === 'google') {
    await window.gcalDeleteEvent(ev);
  } else if (ALMANAKK_CONFIG.clientId) {
    throw new Error('Logg inn med Google først for å slette.');
  } else {
    const i = DEMO_EVENTS.indexOf(ev.src);
    if (i > -1) DEMO_EVENTS.splice(i, 1);
    loadDemo();
  }
}

/* ---------- demo mode ---------- */

function loadDemo() {
  const colors = Object.fromEntries(DEMO_CALENDARS.map(c => [c.id, c.color]));
  state.events = DEMO_EVENTS.map((ev, i) => ({
    id: i, title: ev.t, start: ev.s, end: ev.e || ev.s, color: colors[ev.c] || '#26241f', calId: ev.c, src: ev,
  }));
  render();
}

/* ---------- ui chrome ---------- */

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

function step(dir) {
  if (state.view === 'week') {
    const d = mondayOf(state.weekOf || fmt(new Date()));
    d.setDate(d.getDate() + dir * 7);
    state.weekOf = fmt(d);
    if (state.mode === 'google') window.gcalEnsureYear(d.getFullYear());
    render();
    return;
  }
  if (state.view === 'year') {
    state.year += dir;
  } else {
    state.month += dir;
    if (state.month < 0) { state.month = 11; state.year--; }
    if (state.month > 11) { state.month = 0; state.year++; }
  }
  if (state.mode === 'google') window.gcalEnsureYear(state.year);
  render();
}

// wg chip: overlay the tour-tagged calendars' all-day events. Cities chip: derived location column.
function updateChips() {
  const tc = $('#tour-chip');
  tc.hidden = false;
  tc.classList.toggle('active', state.wg && tourCalIds().length > 0);
}
$('#tour-chip').addEventListener('click', async () => {
  if (!tourCalIds().length) {
    const picker = $('#cal-picker');
    if (!picker.hidden) picker.open = true;
    toast(L().tourHint);
    return;
  }
  state.wg = !state.wg;
  localStorage.setItem('almanakk2-wg', state.wg ? '1' : '0');
  if (state.wg && state.mode === 'google' && window.gcalEnsureSelected) {
    try { await window.gcalEnsureSelected(tourCalIds()); } catch (e) { toast(e.message); }
  }
  render();
  updateChips();
});

// the ⋯ menu shuts as soon as you pick something, and when you tap away —
// a menu left hanging over the month is worse than the button it replaced
const moreMenu = $('#more');
moreMenu.addEventListener('click', e => { if (e.target.closest('button')) moreMenu.open = false; });
document.addEventListener('click', e => { if (!e.target.closest('#more')) moreMenu.open = false; });

$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
$('#view-year').addEventListener('click', () => { state.view = 'year'; render(); });
$('#view-month').addEventListener('click', () => { state.view = 'month'; state.detailed = false; render(); });
$('#view-detail').addEventListener('click', () => {
  state.view = 'week'; state.detailed = false;
  state.weekOf = state.weekOf || fmt(new Date());
  render();
});
$('#lang-chip').addEventListener('click', () => {
  state.lang = state.lang === 'no' ? 'en' : 'no';
  localStorage.setItem('almanakk2-lang', state.lang);
  applyLang();
  render();
});
// Print: choose 3, 6 or 12 months per A4 landscape page.
let printGroup = 3;
$('#print').addEventListener('click', e => {
  e.stopPropagation(); // keep the document click-handler from instantly closing the menu
  closePanel(true);
  const pop = document.createElement('div');
  pop.id = 'popover';
  pop.style.cssText = 'top:60px;left:50%;transform:translateX(-50%)';
  pop.innerHTML = `<p class="dim"><b>${L().printHead.replace('%Y', state.year)}</b></p>
    <div class="actions">
      <button data-g="3">${L().per3}</button>
      <button data-g="6">${L().per6}</button>
      <button data-g="12">${L().per12}</button>
    </div>`;
  document.body.appendChild(pop);
  pop.addEventListener('click', e => {
    const g = e.target.dataset.g;
    if (!g) return;
    printGroup = Number(g);
    pop.remove();
    window.print();
  });
});

// Printing always outputs the year view, in the chosen grouping.
let viewBeforePrint = null;
window.addEventListener('beforeprint', () => {
  viewBeforePrint = state.view;
  document.body.classList.add('print-' + printGroup);
  state.view = 'year';
  render(printGroup);
});
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-3', 'print-6', 'print-12');
  if (viewBeforePrint) { state.view = viewBeforePrint; viewBeforePrint = null; }
  render();
});

// Tap a day -> panel with the day's full list + add field.
// If a panel is already open, any tap outside it just dismisses it
// (unless the add-field holds unsaved text — then it stays).
$('#app').addEventListener('click', e => {
  if (e.target.closest('#popover')) return;
  const cell = e.target.closest('.info.plan');
  if (cell) { e.stopPropagation(); return openCityEdit(cell); }
  if ($('#popover')) { closePanel(); return; }
  const row = e.target.closest('.day');
  // THE WEEK'S TITLE TAKES YOU BACK UP (Alan, 12.09: "if i click the square at
  // the top of the week again, it collapses back to month view"). The same
  // place you came from, so the gesture reverses itself.
  if (state.view === 'week' && e.target.closest('.week > h2')) {
    const m = mondayOf(state.weekOf || fmt(new Date()));
    const anchor = parseDate(state.weekDay || fmt(m));
    state.year = anchor.getFullYear(); state.month = anchor.getMonth();
    state.view = 'month'; render(); return;
  }
  // TOUCHING A DAY OPENS ITS WEEK (Alan, 12.09). The month says the shape of
  // the month; the week is where the day's own lines are.
  if (row && state.view === 'month' && !e.target.closest('.info')) {
    state.weekOf = state.weekDay = row.dataset.date; state.view = 'week'; render(); return;
  }
  if (row) openDayPanel(row);
});
document.addEventListener('click', e => {
  if (!e.target.closest('#popover') && !e.target.closest('.day')) closePanel();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') return closePanel(true);
  if (e.target.tagName === 'INPUT') return; // don't navigate while typing
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

// Swipe between months in strip view.
let touchX = null;
$('#app').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
$('#app').addEventListener('touchend', e => {
  if (touchX === null || (state.view !== 'month' && state.view !== 'week')) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  touchX = null;
}, { passive: true });

// ?demo=1 forces sample data and lands on the month that has it, so the app
// can be looked at on a phone or a tablet without signing anything in.
if (/[?&]demo\b/.test(location.search)) {
  ALMANAKK_CONFIG.clientId = '';
  window.ALMANAKK_PROXY = null;
  state.year = DEMO_YEAR; state.month = DEMO_MONTH;
  // the tour calendar is tagged as an overlay so the demo shows a wg band;
  // tour tagging is a per-calendar setting and otherwise unreachable here
  try { localStorage.setItem('almanakk-tourcals', '["turne"]'); } catch (e) {}
  state.wg = true;
}
if (!ALMANAKK_CONFIG.clientId) {
  const b = $('#banner');
  b.hidden = false;
  b.textContent = 'Demo — viser eksempeldata fra arket. Legg inn Google clientId i config.js for å koble til Google Kalender.';
}
applyLang();
loadDemo();
