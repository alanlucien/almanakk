/* Almanakk — Norwegian wall-calendar view. Rendering + calendar math. */
'use strict';

const $ = s => document.querySelector(s);

// Which build is actually running — read from this script's own ?v=, so there
// is one source of truth (index.html) and no doubt about what a phone is on.
// Shown at the bottom of the Kalendere panel.
const BUILD = (() => {
  try { return new URL(document.currentScript.src).searchParams.get('v') || 'dev'; }
  catch (e) { return 'dev'; }
})();

const LANGS = {
  no: {
    months: ['JANUAR','FEBRUAR','MARS','APRIL','MAI','JUNI','JULI','AUGUST','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'],
    wd: ['M','Ti','O','To','F','L','S'], // Monday-first
    week: 'uke',
    year: 'År', month: 'Måned', detail: 'Detaljer', print: 'Skriv ut',
    signin: 'Logg inn med Google', cals: 'Kalendere',
    added: 'Lagt til (demo — lagres ikke)', saved: 'Lagret i Google Kalender', savedIn: 'Lagret i', goesTo: 'Ny hendelse →',
    deleted: 'Slettet', undo: 'Angre', restored: 'Gjenopprettet', edit: 'Endre', updated: 'Endret', replaced: 'erstattet av fly',
    tourHint: 'Huk av «Tour» på turnékalenderne under Kalendere først.',
    newPh: 'Ny · «8-12 tekst» = flere dager · «13:00» = tid', add: 'Legg til', del: 'Slett',
    printHead: 'Skriv ut %Y — A4 liggende', per3: '3 mnd/side', per6: '6 mnd/side', per12: 'Hele året på én side',
  },
  en: {
    months: ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'],
    wd: ['Mo','Tu','We','Th','Fr','Sa','Su'],
    week: 'wk',
    year: 'Year', month: 'Month', detail: 'Details', print: 'Print',
    signin: 'Sign in with Google', cals: 'Calendars',
    added: 'Added (demo — not saved)', saved: 'Saved to Google Calendar', savedIn: 'Saved to', goesTo: 'New event →',
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
  wg: localStorage.getItem('almanakk-wg') === '1', // overlay the tour-tagged calendars
  cities: true, // always shown; the button switches how they read
  cityCodes: false, // names always: Alan dropped the Byer button 02.09.2026 —
                    // his flight titles are already codes (OSL-LGW), so "codes"
                    // mode only repeated the title back
  lang: localStorage.getItem('almanakk-lang') || 'no',
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
  const spans = overlapping.filter(ev => ev.end > ev.start).sort(byStart);
  const n = Math.max(1, packLanes(spans, MAX_LANES, 0));
  // overlay (wg) events get their own lanes to the right of the normal ones
  const ovl = (overlays || []).filter(ev => ev.start <= last && ev.end >= first).sort(byStart);
  ovl.forEach(ev => { ev._wg = true; });
  const nOvl = packLanes(ovl, 2, n);
  const details = overlapping
    .filter(ev => ev.end === ev.start)
    .sort(detOrder);
  return { spans: spans.concat(ovl), details, nOwn: n, nOvl };
}

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
  let t = title, num = null;
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
    const dest = cityMarker(ev.title) || flightDest(ev.title);
    if (dest) flights.push({ date: ev.start, time: ev.time || '99', dest, tbc: isTbc(ev) });
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

function renderMonthEl(y, m) {
  const { spans, details, nOwn, nOvl } = monthLayout(y, m, visibleEvents(), overlayEvents());
  const wgDet = wgDetailEvents();
  const hol = holidays(y);
  const todayStr = fmt(new Date());
  const n = daysInMonth(y, m);
  const flights = state.cities ? buildFlightIndex() : null;
  let prevCity = null;
  let cityShown = false; // did the city actually stand on yesterday's row?
  // a title too long for its lane is written DOWN the band, one word per row
  const wrapPlan = {}; // event id -> { from: day, words: [...] }
  let rows = '';
  for (let day = 1; day <= n; day++) {
    const d = new Date(y, m, day);
    const ds = fmt(d);
    const wi = weekdayIdx(d);
    const h = hol[ds];
    const red = wi === 6 || (h && h.red);
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
      const repeat = wi === 1 && !cityShown;
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

    // one lane cell; spillK = how many lane-widths the label may write across
    const laneCell = (ev, spillK) => {
      if (!ev) return '<span class="lane"></span>';
      // label at span start, then every 14 days counted from it; the 1st of
      // a month only gets a label when no 14-day beat lands in its first week
      const offset = Math.round((parseDate(ds) - parseDate(ev.start)) / 864e5);
      const untilNextBeat = (14 - (offset % 14)) % 14;
      const showLabel = offset % 14 === 0 || (day === 1 && offset > 0 && untilNextBeat > 7);
      const canSpill = spillK > 1.05;
      const endInMonth = ev.end.slice(0, 7) === ds.slice(0, 7) ? Number(ev.end.slice(8, 10)) : n;
      // punctuation-only tokens would waste a whole row on "-" or "|"
      const words = ev.title.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
      // Boxed in with a multi-word title: write it down the band, ONE WORD PER
      // ROW. Each row then holds whole text of its own, so nothing hangs into
      // the next day where it could be clipped or painted over — the bug Alan
      // hit three times when this was one tall box instead.
      if (showLabel) {
        if (!canSpill && words.length > 1 && endInMonth > day) {
          wrapPlan[ev.id] = { from: day, words: words.slice(0, Math.min(3, endInMonth - day + 1)) };
        } else {
          delete wrapPlan[ev.id];
        }
      }
      const plan = wrapPlan[ev.id];
      const step = plan ? day - plan.from : -1;
      let txt;
      const label = (t, cls) => `<i class="${cls || ''}"><span>${esc(t)}</span></i>`;
      if (showLabel) txt = label(plan ? plan.words[0] : ev.title);
      else if (plan && step > 0 && step < plan.words.length) txt = label(plan.words[step]);
      // continuation rows carry an invisible copy of the title, so the band
      // stays text-wide wherever the row is free and snaps back where it isn't
      else txt = canSpill ? label(ev.title, 'ghost') : '';
      return `<span class="lane on ${ev._wg ? 'wg' : ''} ${canSpill ? 'spill' : ''}`
        + ` ${isShow(ev) ? 'showband' : ''} ${ev.start === ds ? 'bstart' : ''} ${isTbc(ev) ? 'tbc' : ''}"`
        + ` data-eid="${ev.id}" style="--c:${ev.color};--ci:${inkColor(ev.color)};--spillw:${Math.round(spillK * 100)}%">`
        + txt + '</span>';
    };
    const freeAfter = (arr, i) => {
      let f = 0;
      for (let j = i + 1; j < arr.length; j++) { if (!arr[j]) f++; else break; }
      return f;
    };
    // spill room: remaining own lanes, then free wg lanes (0.75 lane width
    // each), then the day line itself when it is empty
    let ownCells = '', wgCells = '';
    if (hasOwn || hasWgBand) {
      let wgFreeRun = 0;
      for (const e of wgEvs) { if (!e) wgFreeRun++; else break; }
      for (let l = 0; l < nOwn; l++) {
        const free = freeAfter(ownEvs, l);
        let k = 1 + free;
        if (free === nOwn - 1 - l) {
          k += wgFreeRun * 0.75;
          if (wgFreeRun === nOvl && lineEmpty) k += 1.75;
        }
        ownCells += laneCell(ownEvs[l], k);
      }
      for (let g = 0; g < nOvl; g++) {
        const free = freeAfter(wgEvs, g);
        let k = 1 + free * 0.75;
        if (free === nOvl - 1 - g && lineEmpty) k += 2.33; // the day line is ~2.33 wg-lane widths
        wgCells += laneCell(wgEvs[g], k);
      }
    }

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
    const evtHtml = (e, wg) => `<b class="evt ${wg ? 'wgd' : ''} ${isTbc(e) ? 'tbc' : ''} ${isShow(e) ? 'showevt' : ''}" data-eid="${e.id}" style="color:${evInk(e)}">`
      + esc(state.detailed ? (e.time ? e.time + ' ' : '') + e.title : compactTitle(e)) + '</b>';
    // a day without any band absorbs all lane columns (keeps the grid aligned)
    const detail = `<span class="detail"${(hasOwn || hasWgBand) ? '' : ` style="grid-column: span ${nOwn + nOvl + 1}"`}>`
      + lineItems.map(({ e, wg }) => evtHtml(e, wg)).join('')
      + '</span>';
    // One cell, one line, one thing in it: a holiday, else the week number on
    // Monday, else the city. Long names step down a size rather than clip.
    const info = h
      ? `<span class="info ${h.red ? 'red' : ''} ${h.name.length > 11 ? 'long' : ''} ${h.name.length > 15 ? 'xlong' : ''}">${esc(h.name)}</span>`
      : cityTxt
        ? `<span class="info"><span class="cty ${cityTxt.length > 8 ? 'long' : ''} ${cityTbc ? 'tbc' : ''}">${esc(cityTxt)}</span></span>`
        : (wi === 0 ? `<span class="info">${L().week} ${isoWeek(d)}</span>` : '<span class="info"></span>');
    const showDay = todays.some(isShow) || wgTodays.some(isShow)
      || ownEvs.some(e => e && isShow(e)) || wgEvs.some(e => e && isShow(e));
    rows += `<div class="day ${red ? 'red' : ''} ${ds === todayStr ? 'today' : ''} ${showDay ? 'showday' : ''}" data-date="${ds}">`
      + `<span class="num">${day}</span><span class="wd">${L().wd[wi]}</span>`
      + ownCells + wgCells + detail + info + `</div>`;
  }
  return `<section class="month ${state.cities ? 'cities' : ''} ${nOvl ? 'haswg' : ''}" style="--lanes:${nOwn};--wg:${nOvl}">`
    + `<h2>${L().months[m]} <small>${y}</small></h2>${rows}</section>`;
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
  } else {
    app.className = 'strip' + (state.detailed ? ' detailed' : '');
    app.innerHTML = renderMonthEl(state.year, state.month);
    $('#period-label').textContent = L().months[state.month].charAt(0) + L().months[state.month].slice(1).toLowerCase() + ' ' + state.year;
  }
  $('#view-year').classList.toggle('active', state.view === 'year');
  $('#view-month').classList.toggle('active', state.view === 'month' && !state.detailed);
  $('#view-detail').classList.toggle('active', state.view === 'month' && state.detailed);
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
  localStorage.setItem('almanakk-wg', state.wg ? '1' : '0');
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
$('#view-detail').addEventListener('click', () => { state.view = 'month'; state.detailed = true; render(); });
$('#lang-chip').addEventListener('click', () => {
  state.lang = state.lang === 'no' ? 'en' : 'no';
  localStorage.setItem('almanakk-lang', state.lang);
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
  if ($('#popover')) { closePanel(); return; }
  const row = e.target.closest('.day');
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
  if (touchX === null || state.view !== 'month') return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  touchX = null;
}, { passive: true });

if (!ALMANAKK_CONFIG.clientId) {
  const b = $('#banner');
  b.hidden = false;
  b.textContent = 'Demo — viser eksempeldata fra arket. Legg inn Google clientId i config.js for å koble til Google Kalender.';
}
applyLang();
loadDemo();
