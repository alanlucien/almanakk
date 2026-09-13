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
    fTitle: 'Tittel', fTime: 'Klokkeslett', fFrom: 'Fra', fTo: 'Til',
    fFromClock: 'Fra kl.', fToClock: 'Til kl.',
    fWhere: 'Sted', fNotes: 'Notat', save: 'Lagre', closeEdit: 'Lukk', atTime: 'Klokken', onMap: 'Kart',
    year: 'År', month: 'Måned', detail: 'Detaljer', print: 'Skriv ut',
    signin: 'Logg inn med Google', cals: 'Kalendere',
    needTitle: 'Skriv en tittel først.', movedTo: 'Flyttet til',
    saving: 'Lagrer…', deleting: 'Sletter…', pencil: 'Blyant',
    morning: 'Morgen', afternoon: 'Ettermiddag', evening: 'Kveld',
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
    fTitle: 'Title', fTime: 'Time', fFrom: 'From', fTo: 'To',
    fFromClock: 'From', fToClock: 'To',
    fWhere: 'Location', fNotes: 'Notes', save: 'Save', closeEdit: 'Close', atTime: 'By the clock', onMap: 'Map',
    year: 'Year', month: 'Month', detail: 'Details', print: 'Print',
    signin: 'Sign in with Google', cals: 'Calendars',
    needTitle: 'Give it a title first.', movedTo: 'Moved to',
    saving: 'Saving…', deleting: 'Deleting…', pencil: 'Pencilled',
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
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
// WHAT A VIEW SHOWS. The wg button means "not now", and it has to mean that in
// every view (Alan, 14.09) — the week and the day were reading every event
// straight off state and ignoring the button entirely, so unchecking wg muted
// the month and silently did nothing to the other two. It hides the tour's
// timed calls as well as its runs: everything of theirs, or nothing.
function shownEvents() {
  if (state.wg) return state.events;
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

// THE MOON, the way a paper almanac has always carried it (Alan, 14.09). Only
// the four turns are marked — a glyph on every one of 365 days is decoration,
// not information. The black is the DARK part of the disc, which is the old
// drawing: a new moon is filled, a full moon is open, and a quarter is halved
// on the side the light is not.
//
// A mean synodic month was the obvious way and it was not good enough: it put
// February 2026's full moon on the 2nd (it is the 1st, 22:09) and March's new
// moon on the 18th (it is the 19th). Half a day of error is a wrong DATE about
// a third of the time, which in a calendar is simply wrong. This is Meeus
// chapter 49 with its principal periodic terms — minutes of error, so the date
// is right. Phases are computed once per year and looked up by date.
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
// PENCILLED (decided 03.09): a line holding nothing but P, first in the notes.
// Not a colour — that was tried and rejected, because his other clients throw
// event colours away and show the calendar's instead. Not a local flag either:
// the mark has to travel to his phone and his laptop, so it lives in the event.
const isPencil = ev => /^P[ \t]*(\n|$)/.test(ev.notes || '');
const withoutPencil = n => (n || '').replace(/^P[ \t]*\r?\n?/, '').replace(/^\r?\n/, '');
const withPencil = n => 'P' + (String(n || '').trim() ? '\n\n' + String(n).trim() : '');
// a note worth opening says so, quietly — the almanac's own footnote mark
const hasNote = ev => !!withoutPencil(ev.notes).trim();

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

/* ---------- rendering ---------- */

// SOME TITLES ARRIVE WITH ENTITIES ALREADY IN THEM — "León &amp;amp; Lightfoot"
// came from Google that way, written by whatever created the event. We escape
// correctly, so the reader sees the entity. Decoded for DISPLAY only: the edit
// field still shows what is really stored, because that is what gets saved.
function deco(s) {
  return String(s).replace(/&(amp|lt|gt|quot|#0?39|apos|nbsp);/g, (m, e) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'", apos: "'", nbsp: ' ',
  })[e] || m);
}

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

// The week's bands are drawn after layout, because a day is as tall as the
// number of things in it — there is no grid to hang them on.
function wireDayView() {
  const sec = document.querySelector('.dayview');
  if (!sec) return;
  sec.addEventListener('click', async e => {
    const del = e.target.dataset.del;
    if (del) {
      const ev = state.events.find(x => String(x.id) === String(del));
      if (!ev) return;
      // SAY SOMETHING THE MOMENT HE PRESSES (Alan, 14.09: "it just freezes then
      // suddenly it's gone"). Deleting is a round trip to Google and then a
      // reload of the year; for a second or two nothing moved and the only
      // honest reading was that the tap had missed.
      const undo = working(e.target, L().deleting);
      try { await deleteEvent(ev); state.openEvent = null; state.draft = null; toast(L().deleted); }
      catch (err) { undo(); toast(err.message); }
      return;
    }
    if (e.target.dataset.close) { state.openEvent = null; state.draft = null; render(); return; }
    const cal = e.target.closest('.dcal');
    if (cal) {
      const list = cal.parentElement.querySelector('.callist');
      list.hidden = !list.hidden;
      return;
    }
    const pick = e.target.closest('.calopt');
    if (pick) {
      const meta = pick.closest('.dmeta');
      const btn = meta.querySelector('.dcal');
      btn.dataset.calid = pick.dataset.pick;
      btn.innerHTML = `<span class="dot" style="--c:${pick.dataset.color}"></span>` + pick.textContent;
      meta.querySelectorAll('.calopt').forEach(x => x.classList.toggle('on', x === pick));
      meta.querySelector('.callist').hidden = true;
      return;
    }
    const sw = e.target.closest('.sw');
    if (sw) {
      const box = sw.closest('.swatches');
      box.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === sw));
      box.dataset.cid = sw.dataset.cid;
    }
  });
  sec.addEventListener('input', e => {
    if (e.target.name !== 'location') return;
    const a = e.target.closest('.wherebar').querySelector('.maplink');
    const v = e.target.value.trim();
    a.hidden = !v;
    a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v);
  });
  sec.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target.closest('.dedit');
    if (!form || form.dataset.busy) return;
    const v = n => (form.querySelector(`[name="${n}"]`) || {}).value || '';
    if (form.dataset.eid === 'new') {          // a draft: create it
      const box = form.querySelector('.swatches');
      form.dataset.busy = '1';
      const undo = working(form.querySelector('button[type="submit"]'), L().saving);
      try {
        await createEvent({
          title: v('title').trim(), time: v('time').trim(), endTime: v('endtime').trim(),
          start: v('start'), end: v('end'), location: v('location').trim(),
          notes: pencilled(form, v('notes')), colorId: box ? (box.dataset.cid || '') : '',
          calId: form.querySelector('.dcal')?.dataset.calid || '',
        });
        state.draft = null;
      } catch (err) { undo(); toast(err.message); delete form.dataset.busy; }
      return;
    }
    const ev = state.events.find(x => String(x.id) === String(form.dataset.eid));
    if (!ev) return;
    form.dataset.busy = '1';
    const undo = working(form.querySelector('button[type="submit"]'), L().saving);
    try {
      const box = form.querySelector('.swatches');
      // NEVER WRITE A DATE HE DID NOT TOUCH. The read path shifts a small-hours
      // flight onto the evening before so it renders on the day he travels, and
      // a multi-day timed event is read as single-day — so echoing the form's
      // dates back on every save walked real bookings backwards and collapsed
      // workshops onto their first day. The schedule is now sent only when it
      // differs from what was loaded (13.09, found in review).
      const moved = v('start') !== ev.start || v('end') !== ev.end
        || v('time') !== (ev.time || '') || v('endtime') !== (ev.endTime || '');
      await saveEvent(ev, {
        colorId: box ? (box.dataset.cid !== undefined ? box.dataset.cid : (ev.colorId || '')) : '',
        title: v('title').trim(), time: v('time').trim(), endTime: v('endtime').trim(),
        start: v('start'), end: v('end'), moved,
        location: v('location').trim(),
        notes: pencilled(form, v('notes')),
      });
      // the move comes after the patch, so the fields are written to the event
      // where it still is; Google keeps its id, so the move finds it either way
      const into = form.querySelector('.dcal')?.dataset.calid;
      const moving = into && into !== ev.calId;
      if (moving && state.mode === 'google') await window.gcalMoveEvent(ev, into);
      state.openEvent = null;
      toast(moving ? `${L().movedTo} ${calName(into)}` : L().updated);
    } catch (err) {
      undo();
      toast(err.message);
      delete form.dataset.busy;
    }
  });
}

// what goes in the notes field: what he wrote, with the pencil mark put back on
// top of it when the box is ticked
function pencilled(form, notes) {
  const on = form.querySelector('[name="pencil"]')?.checked;
  const body = withoutPencil(notes).trim();
  return on ? withPencil(body) : body;
}

// A pressed button says so until the answer comes back, and every other button
// beside it stops taking presses. Returns the way back, for when it fails.
function working(btn, label) {
  if (!btn) return () => {};
  const row = btn.closest('.dbtns') || btn.parentElement;
  const was = btn.textContent;
  btn.textContent = label;
  btn.classList.add('busy');
  const buttons = [...row.querySelectorAll('button')];
  buttons.forEach(b => { b.disabled = true; });
  return () => {
    btn.textContent = was;
    btn.classList.remove('busy');
    buttons.forEach(b => { b.disabled = false; });
  };
}

// Everything the day view can change, in one patch. A time is written into the
// title the way Alan writes it elsewhere in this app, so the two agree.
// The draft's own save. It goes through the same create as the quick line, but
// with every field the form offers rather than one sentence to be parsed.
async function createEvent(f) {
  const title = f.title.trim();
  if (!title) throw new Error(L().needTitle);
  const end = f.end && f.end >= f.start ? f.end : f.start;
  if (state.mode !== 'google') {
    if (ALMANAKK_CONFIG.clientId) throw new Error('Logg inn med Google først for å legge til.');
    DEMO_EVENTS.push({ c: 'alan', t: (f.time ? f.time + ' ' : '') + title, s: f.start, e: end });
    loadDemo();
    toast(L().added);
    return;
  }
  await window.gcalCreateEvent(f.start, end, { ...f, title, end });
  const t = window.gcalTarget && window.gcalTarget();
  toast(t ? `${L().savedIn} ${t.name}` : L().saved);
}

async function saveEvent(ev, f) {
  if (state.mode !== 'google') {
    if (ALMANAKK_CONFIG.clientId) throw new Error('Logg inn med Google først.');
    ev.src.t = (f.time ? f.time + ' ' : '') + f.title;
    ev.src.s = f.start; ev.src.e = f.end;
    if (f.colorId !== undefined) ev.src.cid = f.colorId;
    loadDemo();
    return;
  }
  const patch = {
    summary: f.title,
    location: f.location, description: f.notes,
    colorId: f.colorId || null,          // null = back to the calendar's own colour
  };
  // A CLOCK MAKES IT A TIMED EVENT, no clock makes it an all-day one. Google
  // needs one shape or the other, never both, so the fields are cleared as
  // well as set — otherwise a timed event keeps a stale date and refuses.
  const tz = ev.tz || 'Europe/Oslo';
  if (!f.moved) { /* he changed words, not when: leave the schedule alone */ }
  else if (f.start && f.time) {
    const endDay = f.end && f.end >= f.start ? f.end : f.start;
    const endClock = f.endTime || f.time;
    patch.start = { dateTime: `${f.start}T${f.time}:00`, timeZone: tz, date: null };
    patch.end = { dateTime: `${endDay}T${endClock}:00`, timeZone: tz, date: null };
  } else if (f.start && f.end) {
    const next = parseDate(f.end); next.setDate(next.getDate() + 1);
    patch.start = { date: f.start, dateTime: null, timeZone: null };
    patch.end = { date: fmt(next), dateTime: null, timeZone: null };
  }
  await window.gcalUpdateEvent(ev, patch);
}

// A tap that might be half of a double. 260ms is long enough to catch a real
// double tap and short enough not to feel like a pause.
// A PENDING TAP BELONGS TO ONE TARGET IN ONE VIEW (found in review, 13.09).
// One bare module-level timer meant a tap on the 5th followed by a tap on the
// 19th read as a double tap on the 19th; a tap followed by a title tap dragged
// you back into the week 260ms later; and an orphan firing render() wiped a
// popover that had just opened. The timer now remembers what armed it, and
// anything that navigates cancels it.
let tapTimer = null, tapKey = null;
function cancelTap() { if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; tapKey = null; } }
function tapOrDouble(single, double, key) {
  const k = (key || '') + '|' + state.view;
  if (tapTimer && tapKey === k) { cancelTap(); double(); return; }
  cancelTap();
  tapKey = k;
  tapTimer = setTimeout(() => { tapTimer = null; tapKey = null; single(); }, 260);
}

// WRITING IS A GESTURE HE MAKES, NEVER A GUESS I MAKE (Alan, 14.09). It used
// to open the line by itself whenever the day looked empty; now two taps on
// empty paper mean "write here" and one tap means "show me this day", so the
// two gestures stay apart whether or not the day already holds something.
// AN ENTRY IS AS WIDE AS ITS WORDS (Alan, 14.09: "tapping an empty part of a
// day row almost never brings me to create a new one, it opens the event
// nearest my fingers"). In the week and the day an entry is a full-width row,
// so the blank paper beside a four-letter title belonged to that title. The
// glyphs are measured, not the box — a Range over the contents, the same way
// the day line is measured against the bands — with a few millimetres of grace
// so he does not have to hit the letters exactly. The month is untouched: there
// the entries sit tight on one line and the box IS the words.
const TAP_GRACE = 12;
function onWords(row, e) {
  if (!row) return false;
  const parts = row.querySelectorAll('.wt, .wn, .wr, .wspanname');
  const boxes = (parts.length ? [...parts] : [row]).map(el => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return b.width ? b : el.getBoundingClientRect();
  });
  return boxes.some(b => b.width
    && e.clientX >= b.left - TAP_GRACE && e.clientX <= b.right + TAP_GRACE
    && e.clientY >= b.top - 2 && e.clientY <= b.bottom + 2);
}

function openDay(date, eventId, write) {
  state.dayOf = date;
  // an id of 0 is an id: `|| null` threw the first event of a set away
  state.openEvent = eventId === undefined || eventId === '' ? null : eventId;
  state.addOnOpen = !!write;
  state.view = 'day';
  render();
}

// What the quick line says, read the same way whether you press enter on it or
// open it out into the form: "8-12 tekst" is a run of days, a clock in the text
// is a time, and what is left is the title.
function draftFrom(date, text) {
  const t = arrowForm((text || '').trim());
  const range = parseRange(date, t);
  let body = range ? range.title : t;
  const hhmm = (h, m) => String(h).padStart(2, '0') + ':' + m;
  // A CLOCK HE WROTE FIRST IS THE TIME, and the form has a field for it — so it
  // comes out of the title rather than being said twice. "10-12" on the front
  // of a line is a pair of clocks, the same way he writes it by hand. A clock
  // anywhere else is left where he put it.
  let time = '', endTime = '';
  const lead = body.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*[-–]\s*([01]?\d|2[0-3])[:.]([0-5]\d))?\s+(.+)$/);
  if (!range && lead) {
    time = hhmm(lead[1], lead[2]);
    if (lead[3]) endTime = hhmm(lead[3], lead[4]);
    body = lead[5];
  } else if (!range) {
    const any = body.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (any) time = hhmm(any[1], any[2]);
  }
  return {
    date,
    title: body,
    start: range ? range.start : date,
    end: range ? range.end : date,
    time, endTime,
  };
}

function openWeekEntry(line, date) {
  if (!date) return;
  const form = document.createElement('form');
  form.className = 'wqa';
  form.innerHTML = `<input type="text" placeholder="${esc(L().newPh)}" autocomplete="off">`;
  line.textContent = '';
  line.appendChild(form);
  const input = form.querySelector('input');
  input.focus();
  // TAP THE LINE AGAIN FOR THE REST OF IT (Alan, 14.09). The line is enough for
  // "13:00 Tannlege"; when it is not, tapping it a second time turns whatever
  // stands there into the full form — end time, place, notes, colour — instead
  // of making him save a stub and open it again.
  // IT HUNG ON `click` ALONE, which a real finger on a focused field does not
  // always produce — iOS can spend the second tap on its own caret and
  // selection handling and never synthesise one (Alan, 14.09: "I lost, or never
  // got, my function"). It listens on the touch itself as well now, and on the
  // whole ruled line rather than only the text box, so the hour rule at the
  // left of it opens the form too. One gesture can raise both events, so the
  // second is ignored.
  // the gesture that OPENED this line is still in flight — its own touchend and
  // click land here next, and without this they would open the form instantly
  let lastOpen = Date.now();
  const wider = () => {
    if (Date.now() - lastOpen < 450) return;   // one gesture, not two events
    lastOpen = Date.now();
    state.draft = draftFrom(date, input.value);
    state.openEvent = null;
    if (state.view !== 'day') openDay(date, null); else render();
  };
  line.addEventListener('click', wider);
  line.addEventListener('touchend', wider);
  const give = () => { if (form.isConnected) { line.textContent = ''; } };
  input.addEventListener('keydown', e => { if (e.key === 'Escape') give(); });
  input.addEventListener('blur', () => { if (!input.value.trim()) give(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.dataset.busy) return;
    const text = input.value.trim();
    if (!text) return give();
    form.dataset.busy = '1';
    input.disabled = true;
    try {
      await addEvent(date, text);
    } catch (err) {
      toast(err.message);
      delete form.dataset.busy;
      input.disabled = false;
    }
  });
}

function layoutWeekBands() {
  document.querySelectorAll('.wdays').forEach(boxEl => {
    const box = boxEl;
    let box0 = null;
    const top0 = boxEl.getBoundingClientRect().top;
    boxEl.querySelectorAll('.wband').forEach(b => {
      const from = boxEl.querySelector(`.wday[data-idx="${b.dataset.from}"]`);
      const to = boxEl.querySelector(`.wday[data-idx="${b.dataset.to}"]`);
      if (!from || !to) { b.hidden = true; return; }
      // IT STARTS AT THE WORD (Alan's own hand on his wall calendar, 12.09:
      // he writes "Tunel" on the Monday and draws the line down from just
      // beside it). So the top is the NAME's line when the span begins inside
      // this week, and the top of Monday when it walked in from the week
      // before — which is where its name is written in that case too.
      // IT HANGS OFF THE WORD ITSELF (Alan, 12.09: "drop from an invisible
      // underline of the text, where the first letter of a new word would be
      // after the Y in Bastøy"). Measured from the name's own box rather than
      // computed from paddings, so it cannot drift out of step with the type.
      const name = from.querySelector(`.wspanname[data-eid="${CSS.escape(b.dataset.eid)}"]`);
      const head = name && name.closest('h3');
      const z0 = to;
      const a = (head || from).getBoundingClientRect(), z = to.getBoundingClientRect();
      b.hidden = false;
      if (name) {
        // THE GLYPHS, NOT THE BOX (Alan's "Yv Paris", 13.09). The name carries
        // a right padding that stairs it clear of the name above, and the
        // element's rect includes that padding — so the line started a whole
        // lane's worth to the right of the word it belongs to, and the deeper
        // the lane the worse it got.
        // ...but never past where the name is actually CUT. A long title is
        // clipped with an ellipsis, and the glyph box still measures the whole
        // untruncated string — so the line was placed off the right edge of the
        // sheet and vanished (Alan's "P Göteborg duett — sluttprøver", 13.09).
        const rr = document.createRange(); rr.selectNodeContents(name);
        const raw = rr.getBoundingClientRect();
        const nb = name.getBoundingClientRect();
        const padR = parseFloat(getComputedStyle(name).paddingRight) || 0;
        const n = { right: Math.min(raw.right, nb.right - padR), bottom: raw.bottom };
        const box = box0 || (box0 = boxEl.getBoundingClientRect());
        b.style.left = Math.round(n.right - box.left + 4) + 'px';   // one space after the last letter
        b.style.right = 'auto';
        b.style.marginRight = '0';
        b.style.top = (n.bottom - top0) + 'px';                     // the word's own underline
        // STOPS AT THE LAST LINE, not at the edge of the day (Alan's red line,
        // 13.09). A day's box includes its blank ruled lines and its padding,
        // so ending there put the arrowhead in the following day's territory.
        // THE LAST LINE OF THE DAY, entries or not (Alan, 13.09: it "should go
        // all the way down, almost touching the line above 13 TORSDAG"). It
        // used to take the last ENTRY, so on a day with none it stopped under
        // the header. A day's ruled lines are still its lines.
        const used = [...z0.children].pop();
        const foot = used ? used.getBoundingClientRect().bottom : z.bottom;
        // A RUN THAT CARRIES ON RUNS OFF THE PAGE (Alan, 13.09: both of these
        // continue into next week but "looks like they stop on Sunday 22").
        // Ending at the last line is what a FINISHED run does, and it has the
        // arrow to say so. One that continues goes to the sheet's own edge and
        // is cut by it, which is how a line says "more than this".
        const bottom = b.classList.contains('ends') ? foot : boxEl.getBoundingClientRect().bottom;
        b.style.height = Math.max(2, bottom - n.bottom) + 'px';
      } else {
        b.style.top = (a.top - top0) + 'px';
        b.style.height = Math.max(2, z.bottom - a.top) + 'px';
      }
    });
  });
}

// AN ALL-DAY ENTRY MUST NOT RUN UNDER THE LINES (Alan, 13.09: "Middag hos mor
// is behind the lines, the app should know to push left of arrows"). The lines
// are placed from the run names, so nothing in the markup knows where they end
// up — it has to be measured after they are drawn.
function keepRidersClear() {
  document.querySelectorAll('.wdays').forEach(box => {
    const bands = [...box.querySelectorAll('.wband')].filter(b => !b.hidden);
    if (!bands.length) return;
    // A RIDER ONLY HAS TO CLEAR THE BANDS ON ITS OWN ROW (found in review,
    // 13.09). The edge used to be the leftmost band ANYWHERE in the week, so
    // one band starting far left on the Monday narrowed every other day of the
    // week, including days with no band at all.
    const boxes = bands.map(b => b.getBoundingClientRect());
    box.querySelectorAll('.dayrider').forEach(r => {
      r.style.paddingRight = '';
      const rr = r.getBoundingClientRect();
      const mine = boxes.filter(b => b.bottom > rr.top + 1 && b.top < rr.bottom - 1);
      if (!mine.length) return;
      const edge = Math.min(...mine.map(b => b.left)) - 8;
      const over = rr.right - edge;
      if (over > 0) r.style.paddingRight = Math.round(over) + 'px';
    });
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

// AN ALL-DAY ENTRY LINES UP WITH THE DAY'S NAME, not with its number (Alan,
// 14.09, drawing the line himself). The number is one digit or two, so where
// TIRSDAG begins moves with the date — the offset is measured from the heading
// each time rather than guessed at, the same way the day line is measured
// against the bands.
function alignAllDay() {
  const sec = document.querySelector('.dayview');
  if (!sec) return;
  const name = sec.querySelector(':scope > h2 .dname');
  const month = sec.querySelector(':scope > h2 small');
  const row = sec.querySelector('.dev.ad');
  if (!name || !row) return;
  const x0 = row.getBoundingClientRect().left;
  const off = Math.round(name.getBoundingClientRect().left - x0);
  if (off > 0) sec.style.setProperty('--adx', off + 'px');
  // a step further in again, against the month's own name
  if (month) {
    const off2 = Math.round(month.getBoundingClientRect().left - x0);
    if (off2 > off) sec.style.setProperty('--adx2', off2 + 'px');
  }
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
      bands += `<i class="band ${ev._wg ? 'wg' : ''} ${isShow(ev) ? 'showband' : ''} ${isPencil(ev) ? 'pencil' : ''}`
        + ` ${ev.start === ds ? 'bstart' : ''} ${isTbc(ev) ? 'tbc' : ''}"`
        + ` data-eid="${ev.id}" style="left:${laneX}em;width:${w.toFixed(2)}em;`
        + `--w:${w.toFixed(2)}em;--c:${ev.color};--ci:${inkColor(ev.color)}">`
        + (txt ? `<b>${esc(deco(txt))}</b>` : '') + '</i>';
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
      return `<b class="evt ${wg ? 'wgd' : ''} ${isTbc(e) ? 'tbc' : ''} ${isShow(e) ? 'showevt' : ''} ${isPencil(e) ? 'pencil' : ''}" data-eid="${e.id}" data-t="${effTime(e) || ''}" data-wg="${wg ? 1 : 0}" style="color:${evInk(e)}">`
        + esc(deco(txt)) + '</b>';
    };
    // starts where the labels stop — far left on a day with no band label at all
    let movedToInfo = null;
    const lineFinal = collapseJourneys(lineItems);
    // A TRAVEL DAY BELONGS IN THE CITY COLUMN (Alan, 12.09). That column answers
    // "where am I"; on the day you move it should answer "where am I going".
    // Codes only — the column is narrow — and the journey then leaves the day
    // line, which is where the crowding was. A holiday still wins the cell.
    let journeyTxt = '', journeyAlone = false, journeyShort = '', journeyTiny = '', jTbc = false;
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
        jTbc = isTbc(own[0].e) || isPencil(own[0].e);
        // narrowest reading of all, for a phone: the code, never the week
        journeyTiny = '<span class="arw big">\u2192</span> ' + esc(cityCode(legs[legs.length - 1])) + (jTbc ? '?' : '') + wk;
        journeyShort = '<span class="arw big">\u2192</span> ' + esc(cityLabel(legs[legs.length - 1])) + (jTbc ? '?' : '') + wk;
        // ONE RULE FOR THE TWO READINGS (Alan lost track of it, 12.09, fairly):
        // it says the whole trip whenever the whole trip fits, and drops to the
        // arrow and where you land when it does not. Nothing else decides it.
        journeyTxt = esc(cityLabel(legs[0])) + ' <span class="arw">\u2192</span> '
          + esc(cityLabel(legs[legs.length - 1])) + (jTbc ? '?' : '') + wk;
        journeyAlone = true;
      }
    }
    // One cell, one line, one thing in it: a holiday, else the week number on
    // Monday, else the city. Long names step down a size rather than clip.
    // A MONDAY HOLIDAY SHARES THE CELL TOO (Alan, 14.09). A flight on a Monday
    // has done this since 12.09 — it keeps the NUMBER and drops only the word
    // "uke" — but a holiday took the whole cell, so a week with a bank holiday
    // on its Monday went unnumbered. 2. Påskedag 15, and the week is never
    // given away. The name steps down a size sooner when it is sharing.
    const shareWk = wi === 0 ? ` <span class="wknum">${isoWeek(d)}</span>` : '';
    const hlen = h ? h.name.length + (shareWk ? 3 : 0) : 0;
    const info = h
      ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"><span class="${h.red ? 'red' : ''} ${hlen > 11 ? 'long' : ''} ${hlen > 15 ? 'xlong' : ''}">${esc(h.name)}${shareWk}</span></span>`
      : journeyTxt
        ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"><span class="cty journey ${journeyAlone ? 'wide' : ''} ${jTbc ? 'tbc' : ''}" data-short="${esc(journeyShort)}" data-tiny="${esc(journeyTiny)}">${journeyTxt}</span></span>`
      : cityTxt
        ? `<span class="info plan" data-day="${ds}" title="${esc(L().cityHint)}"><span class="cty ${cityTxt.length > 8 ? 'long' : ''} ${cityTbc ? 'tbc' : ''}">${esc(cityTxt)}${cityTbc ? '?' : ''}</span></span>`
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
  return `<section class="month ${state.cities ? 'cities' : ''} ${nOvl ? 'haswg' : ''}"`
    + ` data-y="${y}" data-m="${m}" style="--lanes:${nOwn};--wg:${nOvl}">`
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

// THE DAY IS WHERE AN EVENT IS EDITED (Alan, 12.09). Clicking a day shows it
// in the week's context; clicking an event shows it in the day's. Same move,
// one level down — so an event is never torn out of the day it belongs to just
// to be changed. Every field Google keeps lives here.
// A YEAR ON A PHONE IS A CONTENTS PAGE, NOT A YEAR (Alan, 12.09: "thumbnails
// for each month so you can quickly jump to the right month... no elaborate
// info"). The wide year view is 365 full rows, which is a wall chart and
// unreadable on a phone. Twelve small grids let you find a month and open it,
// which is the only thing the year is for on a small screen.
function renderYearThumbs(y) {
  const todayStr = fmt(new Date());
  const hol = holidays(y);
  let out = '';
  for (let m = 0; m < 12; m++) {
    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;          // Monday-first
    const n = daysInMonth(y, m);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<i></i>';
    for (let d = 1; d <= n; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const wi = (new Date(y, m, d).getDay() + 6) % 7;
      const h = hol[ds];
      cells += `<i class="${wi === 6 || (h && h.red) ? 'red' : ''}${ds === todayStr ? ' now' : ''}">${d}</i>`;
    }
    out += `<section class="thumb" data-y="${y}" data-m="${m}">`
      + `<h3>${L().months[m]}</h3>`
      + `<div class="wdh">${L().wd.map(w => `<i>${w}</i>`).join('')}</div>`
      + `<div class="grid">${cells}</div></section>`;
  }
  return `<div class="thumbs">${out}</div>`;
}

function renderDayEl(ds) {
  const d = parseDate(ds);
  const wi = (d.getDay() + 6) % 7;
  const h = holidays(d.getFullYear())[ds];
  const tour = new Set(tourCalIds());
  // ALL DAY ON TOP, THE CLOCK BELOW IT (Alan, 12.09). Two things, not one
  // list: what is true of the whole day, then what happens at an hour, in the
  // order it happens. A run and an all-day entry belong to the first; anything
  // with a time belongs to the second.
  const here = shownEvents().filter(e => e.start <= ds && e.end >= ds);
  // HIS FIRST, THE TOUR'S UNDERNEATH (Alan, 14.09). A tour calendar's all-day
  // entries are context rather than his own diary, so they always fall to the
  // bottom of the block — and they are set a step further in, against the
  // month's name, and in italic, so the two kinds never have to be told apart
  // by reading them.
  const wgFirst = e => (tour.has(e.calId) ? 1 : 0);
  const allDay = here.filter(e => e.end > e.start || !effTime(e))
    .sort((a, b) => wgFirst(a) - wgFirst(b)
      || (a.end > a.start ? -1 : 1) - (b.end > b.start ? -1 : 1));
  const timed = here.filter(e => e.end === e.start && effTime(e))
    .sort((a, b) => (effTime(a) < effTime(b) ? -1 : effTime(a) > effTime(b) ? 1 : 0));
  const row = (e, allday, mark) => {
    const open = e.id === 'new' || String(e.id) === String(state.openEvent);
    const span = e.end > e.start;
    if (!open) {
      return `<p class="dev ${allday ? 'ad' : ''} ${tour.has(e.calId) ? 'wg' : ''} ${isShow(e) ? 'show' : ''}`
        + `${isPencil(e) ? ' pencil' : ''}" data-eid="${e.id}">`
        + `<span class="wt">${esc(e.time || '')}</span>`
        + `<span class="wn" style="color:${evInk(e)}">${esc(deco(e.title))}`
        + (hasNote(e) ? '<i class="notemark" title="Notat">∗</i>' : '') + '</span>'
        + (span ? `<span class="wr">${esc(shortRange(e.start, e.end))}</span>` : '')
        + (mark || '') + '</p>';
    }
    return `<form class="dedit" data-eid="${e.id}">`
      + `<label>${L().fTitle}<input name="title" type="text" value="${esc(e.title)}"></label>`
      + `<div class="drow">`
      + `<label>${L().fFromClock}<input name="time" type="time" value="${esc(e.time || '')}"></label>`
      + `<label>${L().fToClock}<input name="endtime" type="time" value="${esc(e.endTime || '')}"></label>`
      + `<label>${L().fFrom}<input name="start" type="date" value="${esc(e.start)}"></label>`
      + `<label>${L().fTo}<input name="end" type="date" value="${esc(e.end)}"></label>`
      + `</div>`
      // GOOGLE MAPS, NEVER APPLE (Alan, 12.09). A plain https maps.google link
      // opens the Google Maps app when it is installed and the website when it
      // is not; a geo: or maps: link is what hands you to Apple.
      // The suggestions are places HE has used before, taken from his own
      // calendar. They cost nothing, need no key, and for a man who returns to
      // the same theatres they are better than a general gazetteer.
      + `<label>${L().fWhere}<span class="wherebar">`
      + `<input name="location" type="text" list="knownplaces" value="${esc(e.location || '')}">`
      + `<a class="maplink" target="_blank" rel="noopener"`
      + ` href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location || '')}"`
      + `${e.location ? '' : ' hidden'}>${L().onMap}</a></span></label>`
      + `<label>${L().fNotes}<textarea name="notes" rows="2">${esc(withoutPencil(e.notes))}</textarea></label>`
      // BLYANT (decided 03.09, built 14.09). A tick, not a colour: it writes a
      // lone P as the first line of the event's notes, which is the one place
      // that survives every client he opens. The notes box above never shows
      // it — he ticks the box, the marker is the app's business.
      + `<label class="dpencil"><input type="checkbox" name="pencil"${isPencil(e) ? ' checked' : ''}>`
      + `<span>${L().pencil}</span></label>`
      // A COLOUR OF ITS OWN (Alan, 13.09). It is stored on the event in Google,
      // so it follows him to his other devices. Worth knowing, and he already
      // found this out in September: his other calendar clients throw event
      // colours away and show the calendar's colour instead. Here it shows.
      // THE CALENDAR IS A CHOICE, NOT A CAPTION (Alan, 14.09: "touching it
      // should option you to select a different calendar for this one event").
      // It named where the event lives and did nothing; now it opens the list
      // of calendars he can write to, and the event moves there when he saves.
      + `<p class="dmeta"><button type="button" class="dcal" data-calid="${esc(e.calId || '')}">`
      + `<span class="dot" style="--c:${e.color}"></span>${esc(calName(e.calId))}</button>`
      + `<span class="callist" hidden>`
      + writableCals().map(c =>
          `<button type="button" class="calopt ${c.id === e.calId ? 'on' : ''}" data-pick="${esc(c.id)}"`
          + ` data-color="${esc(c.color || '')}"><span class="dot" style="--c:${c.color}"></span>${esc(c.name || c.id)}</button>`).join('')
      + `</span>`
      + `<span class="swatches">`
      + `<i class="sw ${e.colorId ? '' : 'on'}" data-cid="" title="${esc(calName(e.calId))}"`
      + ` style="--c:${e.color}"></i>`
      + Object.entries((window.gcalColors || {})).map(([id, c]) =>
          `<i class="sw ${String(e.colorId) === id ? 'on' : ''}" data-cid="${id}" style="--c:${c}"></i>`).join('')
      + `</span></p>`
      + `<div class="dbtns"><button type="submit" class="add">${L().save}</button>`
      + (e.id === 'new' ? '' : `<button type="button" class="x" data-del="${e.id}">${L().del}</button>`)
      + `<button type="button" class="x" data-close="1">${L().closeEdit}</button></div>`
      + '</form>';
  };
  // ONE MORE TAP AND THE WHOLE FORM OPENS (Alan, 14.09). The ruled line takes a
  // sentence; tapping it again turns what you have typed into the same form an
  // existing event gets — end time, place, notes, a colour. The draft is an
  // event that does not exist yet, rendered by exactly the same builder.
  if (state.draft && state.draft.date !== ds) state.draft = null;
  const draft = state.draft;
  // THE DAY HAS A SHAPE, NOT JUST A LIST (Alan, 14.09: "so that a lone event on
  // that day, say a 19:00 show, happens further down the day"). Not an hour
  // grid — his days come in bursts, so a proportional page would crush the
  // morning and give the evening half a screen of nothing, and overlapping
  // events would want the side-by-side columns he has already refused. Three
  // bands instead: one row per entry as before, but morning, afternoon and
  // evening each keep their ruled lines whether or not anything is in them. A
  // show at seven then sits under two quiet bands, which is what a diary page
  // does, and an empty day is a page you could fill rather than a stub.
  const BANDS = [
    { key: 'morning', to: '12:00' },
    { key: 'afternoon', to: '17:00' },
    { key: 'evening', to: '99:99' },
  ];
  const bandOf = e => BANDS.find(b => (effTime(e) || '00:00') < b.to) || BANDS[2];
  const timedRows = BANDS.map((b, i) => {
    const mine = timed.filter(e => bandOf(e) === b);
    const lines = mine.map(e => row(e, false)).join('');
    // THE HOLIDAY SITS UNDER THE WEEK NUMBER (Alan, 14.09), on the first band's
    // own line rather than crowding the heading — where it also has the room to
    // be read in full.
    return `<p class="dsplit ${i ? '' : 'first'}">${L()[b.key]}</p>`
      + lines
      // an empty band keeps three lines, a used one keeps one after the last
      // entry — so the page is always a page, and the evening is always down it
      + '<p class="wblank"></p>'.repeat(mine.length ? 1 : 3);
  }).join('');
  // WHAT THE DAY IS, not what is in it: the holiday and the moon's turn sit
  // immediately under the week number, at the right of the first all-day line
  // (Alan, 14.09). With nothing all-day that day they keep a thin line of their
  // own in the same place, so they never move.
  const moon = moonTurn(ds);
  const mark = (h || moon)
    ? '<span class="dmark">'
      + (h ? `<span class="whol">${esc(h.name)}</span>` : '')
      + (moon ? `<span class="dmoon" title="${esc(moon[state.lang === 'en' ? 'en' : 'no'])}">${moon.g}</span>` : '')
      + '</span>' : '';
  const allDayRows = allDay.map((e, i) => row(e, true, i === 0 ? mark : ''));
  const rows = (allDayRows.length ? allDayRows.join('') : (mark ? `<p class="dmarkline">${mark}</p>` : ''))
    + timedRows
    + (draft ? row({
        id: 'new', title: draft.title, start: draft.start, end: draft.end,
        time: draft.time, endTime: draft.endTime, location: '', notes: '',
        colorId: '', color: (window.gcalTarget && window.gcalTarget() || {}).color || 'var(--ink)',
        calId: (window.gcalTarget && window.gcalTarget() || {}).id || '',
      }, !draft.time) : '');
  // every place he has already typed, once each
  const dmove = state.cities ? cityOn(ds, buildFlightIndex()) : null;
  const dcity = dmove ? cityLabel(dmove.dest) : '';
  const places = [...new Set(state.events.map(x => (x.location || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'no'));
  return `<section class="dayview" data-date="${ds}">`
    + `<datalist id="knownplaces">${places.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>`
    + `<h2><span class="dnum ${wi === 6 || (h && h.red) ? 'red' : ''}">${d.getDate()}</span>`
    + `<span class="dname">${L().wdLong[wi]}</span>`
    + `<small>${L().months[d.getMonth()]} ${d.getFullYear()}</small>`
    + (dcity ? `<span class="wcity ${dcity.length <= 7 ? 'short' : ''}">${esc(dcity)}</span>` : '')
    + `<span class="wkno">${L().week} ${isoWeek(d)}</span></h2>`
    // A PAGE YOU CAN WRITE ON (Alan, 14.09: "when a day has no event there
    // should at least be one box to click in"). An unused day had a single
    // hairline and read as broken paper; it now keeps the diary's ruling, and
    // any line of it opens the entry.
    + rows
    + '</section>';
}

// the calendars he can actually write to, in the order the picker shows them
function writableCals() {
  // an empty list is no list: signed out, gcalCalendars() answers [], and `[]`
  // is truthy, so a plain || fell through to nothing rather than to the demo set
  const live = (window.gcalCalendars && window.gcalCalendars()) || [];
  const all = live.length ? live : (window.DEMO_CALENDARS || []);
  return all.filter(c => c.writable !== false);
}

function calName(id) {
  const all = (window.gcalCalendars && window.gcalCalendars()) || (window.DEMO_CALENDARS || []);
  const c = all.find(x => x.id === id);
  return c ? (c.name || c.id) : id;
}

function renderWeekEl(ds) {
  const mon = mondayOf(ds);
  const hol = holidays(mon.getFullYear());
  const holNext = holidays(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6).getFullYear());
  const tour = new Set(tourCalIds());
  const todayStr = fmt(new Date());
  const end = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const lastKey = fmt(end), firstKey = fmt(mon);
  const dm = ds2 => Number(ds2.slice(8, 10)) + '.' + Number(ds2.slice(5, 7)) + '.';
  // THE SAME LANGUAGE AS THE MONTH, TURNED ON ITS SIDE (Alan, 12.09: the
  // seven-cell ruler "needs coding and deciphering, and it has hope as the
  // blue dot in the year calendar for Apple"). He is right. A band is a band:
  // its name is written where it starts, and a thin line runs down beside the
  // days it covers. Nothing to decode, and it is the reading he already knows
  // from the month. A span that began before this week writes its name on the
  // Monday, because that is where it enters the page.
  const keyOf = i => fmt(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
  const runs = shownEvents()
    .filter(e => e.end > e.start && e.start <= lastKey && e.end >= firstKey)
    .map(e => {
      let from = 0, to = 6;
      for (let i = 0; i < 7; i++) if (keyOf(i) >= e.start) { from = i; break; }
      for (let i = 6; i >= 0; i--) if (keyOf(i) <= e.end) { to = i; break; }
      return { e, from, to };
    })
    .sort((a2, b2) => a2.from - b2.from || (a2.e.start < b2.e.start ? -1 : 1));
  // EVERY RUN ITS OWN COLUMN (Alan, 13.09). Packing them — reusing a column
  // once a run has ended — put Nationaltheatret and Inquiet DNOB on the same
  // line, so it read as one line with two arrowheads and no way to tell which
  // belonged to which. A week holds two or three runs, so packing saved
  // nothing and cost the one thing the line is for.
  runs.forEach((r, k) => { r.lane = k; });
  const nLanes = runs.length;
  const startsOn = i => runs.filter(r => r.from === i);

  // A BUSY WEEK STOPS BUYING AIR (Alan, 13.09: "in a big week with many events,
  // then do not give so much space — I almost cannot see the end of Sunday").
  // Blank ruled lines are what a quiet week has instead of entries; a full one
  // does not need them, and seven days of them push Sunday off the screen.
  const weekLoad = shownEvents().filter(e => e.end === e.start && e.start >= firstKey && e.start <= lastKey).length;
  const minLines = weekLoad >= 16 ? 1 : weekLoad >= 10 ? 2 : 3;
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
    const evs = shownEvents()
      .filter(e => e.start <= key && e.end >= key && e.end === e.start)
      .sort((a, b) => {
        // his own all-day entries before the tour's, the same order the day
        // view keeps (Alan, 14.09) — the tour's are context, and they were
        // landing above his. Timed entries keep the clock's order.
        const k = e => (effTime(e) ? '2' + effTime(e) : '1' + (tour.has(e.calId) ? '1' : '0'));
        return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
      });
    // ONLY THE FIRST RIDES THE DAY LINE. Two names beside a date and a weekday
    // truncated each other on a phone, which is worse than the row it saved.
    // A second run starting the same day keeps a row of its own.
    const starts = startsOn(i);
    const nameSpan = r => `<span class="wspanname ${tour.has(r.e.calId) ? 'wg' : ''} ${isTbc(r.e) ? 'tbc' : ''} ${isPencil(r.e) ? 'pencil' : ''}"`
      + ` data-eid="${r.e.id}" data-date="${key}" style="--lane:${r.lane};color:${evInk(r.e)}">`
      + `${esc(deco(r.e.title))}</span>`;
    // AN ALL-DAY ENTRY BELONGS TO THE DAY (Alan: "is Prøve Vildanden an all-day
    // event? then it should be on the same line as Sunday 20"). It rides the
    // day's own line when no run is starting there to claim it — a run's name
    // is context for the whole week and outranks one day's entry.
    const allDay = evs.filter(e => !effTime(e));
    const rider = !starts.length && allDay.length ? allDay[0] : null;
    const headNames = starts.length ? nameSpan(starts[0])
      : rider ? `<span class="wspanname dayrider ${isPencil(rider) ? 'pencil' : ''}" data-eid="${rider.id}" data-date="${key}"`
        + ` style="--lane:0;color:${evInk(rider)}">${esc(deco(rider.title))}</span>` : '';
    const lines = evs.filter(e => e !== rider).map(e => {
      const span = e.end > e.start;
      const when = e.time ? e.time : (span ? '' : '');
      return `<p class="wev ${tour.has(e.calId) ? 'wg' : ''} ${isTbc(e) ? 'tbc' : ''} ${isShow(e) ? 'show' : ''} ${isPencil(e) ? 'pencil' : ''}"`
        + ` data-eid="${e.id}" data-date="${key}">`
        + `<span class="wt">${esc(when)}</span>`
        + `<span class="wn" style="color:${evInk(e)}">${esc(deco(e.title))}</span>`
        + (span ? `<span class="wr">${esc(shortRange(e.start, e.end))}</span>` : '')
        + '</p>';
    }).join('');
    // the diary keeps ruled lines whether or not the day is used
    const blanks = Math.max(0, minLines - evs.length);
    // THE NAME SITS ON THE DAY'S OWN LINE (Alan, 13.09). It had a row to
    // itself, which cost a line and set the name adrift from the day it
    // starts on. The dates keep the row below, where they are a note rather
    // than a heading.
    // NO DATE RANGE (Alan crossed it out, 13.09). The line down the margin
    // already says where the run goes and the arrow says where it stops, so
    // "10.9. – 11.9." was the same fact in worse handwriting — and it cost a
    // row. The full dates are still in the day view, where you edit them.
    const heads = starts.slice(1).map(r =>
      `<p class="wspan own ${isPencil(r.e) ? 'pencil' : ''}" data-eid="${r.e.id}" data-date="${key}" style="--lane:${r.lane}">`
      + nameSpan(r) + '</p>').join('');
    days += `<section class="wday ${free ? 'free' : ''} ${red ? 'red' : ''} ${key === todayStr ? 'today' : ''}`
      + `${key === state.weekDay ? ' picked' : ''}" data-idx="${i}" data-date="${key}">`
      + `<h3><span class="wnum">${d.getDate()}</span> <span class="wname">${L().wdLong[i]}</span>`
      // the moon's turn and the day's name for it, together at the right
      + (() => { const mo = moonTurn(key); return mo
          ? `<span class="wmoon" title="${esc(mo[state.lang === 'en' ? 'en' : 'no'])}">${mo.g}</span>` : ''; })()
      + (h ? `<span class="whol">${esc(h.name)}</span>` : '') + headNames + '</h3>'
      + heads + lines + '<p class="wblank"></p>'.repeat(blanks)
      + '</section>';
  }
  const span = mon.getMonth() === end.getMonth()
    ? L().months[mon.getMonth()]
    : L().months[mon.getMonth()] + ' / ' + L().months[end.getMonth()];
  // WHERE YOU ARE, AT THE TOP (Alan, 12.09: "do we repeat the city on top of
  // the week... so we always know where we are"). A week you travelled in gets
  // both ends of it, the way the day line already reads a journey.
  const idx = state.cities ? buildFlightIndex() : null;
  let wcity = '';
  if (idx) {
    // where the week STARTED is where you were the night before it, so a
    // Monday flight reads as a journey rather than as the destination alone
    const before = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() - 1);
    const a = cityOn(fmt(before), idx), z = cityOn(lastKey, idx);
    const an = a && cityLabel(a.dest), zn = z && cityLabel(z.dest);
    wcity = an && zn && an !== zn ? an + ' / ' + zn : (zn || an || '');
  }
  // THE WEEK IS NUMBERED ONCE (Alan, 14.09, circling both). The header carries
  // UKE 42 in the largest type on the screen, so the sheet said it again three
  // centimetres below. The DAY view keeps its number — there the header names a
  // date, and the week it falls in is not written anywhere else.
  return `<section class="week"><h2><span class="wspanlabel">${span}</span> <small>${end.getFullYear()}</small>`
    + (wcity ? `<span class="wcity ${wcity.length <= 7 ? 'short' : ''}">${esc(wcity)}</span>` : '')
    + '</h2>'
    + `<div class="wdays" style="--wlanes:${nLanes}">${days}`
    // the arrowhead means FINISHED, so only a run that actually ends inside
    // this week gets one; one that carries on simply runs off the bottom edge
    + runs.map(r => `<i class="wband ${tour.has(r.e.calId) ? 'wg' : ''} ${r.e.end <= lastKey ? 'ends' : ''} ${isPencil(r.e) ? 'pencil' : ''}"`
        + ` data-eid="${r.e.id}" data-from="${r.from}" data-to="${r.to}"`
        + ` style="--c:${r.e.color};--lane:${r.lane}"></i>`).join('')
    + `</div></section>`;
}

// THE BACK BUTTON SHOULD GO BACK A VIEW, NOT LEAVE (Alan, 12.09). Month, week
// and day were only ever state, so the browser had nothing to return to and
// the back gesture walked out of the app. Every change of view now leaves a
// history entry, and going back restores the one before it. Recorded from
// inside render, so it cannot fall out of step with a navigation added later.
let navKey = null, navRestoring = false;
function navSnap() {
  return {
    view: state.view, year: state.year, month: state.month,
    weekOf: state.weekOf, weekDay: state.weekDay,
    dayOf: state.dayOf, openEvent: state.openEvent,
  };
}
function markHistory() {
  const snap = navSnap();
  const key = Object.values(snap).join('|');
  if (key === navKey) return;
  if (navKey === null) history.replaceState(snap, '');
  else if (!navRestoring) history.pushState(snap, '');
  navKey = key;
}
window.addEventListener('popstate', e => {
  if (!e.state) return;                 // nothing of ours: let the browser leave
  navRestoring = true;
  Object.assign(state, e.state);
  // back into a year that was never loaded showed an empty sheet (13.09)
  if (state.mode === 'google') window.gcalEnsureYear(state.year);
  render();
  navRestoring = false;
});

function render(group) {
  cancelTap();
  closePanel(true);
  const app = $('#app');
  if (state.view === 'year' && !group && window.matchMedia('(max-width: 820px)').matches) {
    app.className = 'yearthumbs';
    app.innerHTML = renderYearThumbs(state.year);
    $('#period-label').textContent = state.year; $('#period-year').textContent = '';
  } else if (state.view === 'year') {
    $('#period-label').textContent = state.year; $('#period-year').textContent = '';
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
  } else if (state.view === 'day') {
    const dsx = state.dayOf || fmt(new Date());
    app.className = 'dayviewwrap';
    app.innerHTML = renderDayEl(dsx);
    const dd = parseDate(dsx);
    $('#period-label').textContent = dd.getDate() + '. ' + L().months[dd.getMonth()].toLowerCase(); $('#period-year').textContent = dd.getFullYear();
  } else if (state.view === 'week') {
    const ws = state.weekOf || fmt(new Date());
    app.className = 'weekview';
    app.innerHTML = renderWeekEl(ws);
    const m = mondayOf(ws);
    $('#period-label').textContent = L().week + ' ' + isoWeek(m); $('#period-year').textContent = m.getFullYear();
  } else {
    app.className = 'strip';
    app.innerHTML = renderMonthEl(state.year, state.month);
    $('#period-label').textContent = L().months[state.month]; $('#period-year').textContent = state.year;
  }
  measureLane();
  fitJourneys();
  orderByTime();
  fitEvenings();
  alignByTime();
  alignTourItems();
  clipLine();
  layoutWeekBands();
  keepRidersClear();
  wireDayView();
  $('#period-label').classList.toggle('isyear', state.view === 'year');
  markHistory();
  if (state.addOnOpen) {
    state.addOnOpen = false;
    const line = document.querySelector('.dayview .wblank');
    if (line) openWeekEntry(line, state.dayOf);
  }
  // The line he was typing on has just been replaced by the form, so put the
  // cursor where he was writing — in the title. Without this the second tap
  // leaves nothing focused, and iOS reads it as a double tap on the page and
  // selects a word of the header instead (Alan, 14.09: "the word almanakk top
  // left is highlighted").
  if (state.draft && !state.draft.landed) {
    state.draft.landed = true;
    const t = document.querySelector('.dayview .dedit[data-eid="new"] [name="title"]');
    if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }
  alignAllDay();
  alignLinesToBands();
  updateChips();
}

function applyLang() {
  $('#print').textContent = L().print;
  $('#signin').textContent = L().signin;
  $('#cal-picker summary').textContent = L().cals;
}

// A RUN OF DAYS THE WAY YOU WOULD SAY IT (Alan, 14.09): "21–22 apr", not
// "2026-04-21 – 2026-04-22". The month is named once when both ends share it,
// and the year only when the run crosses one.
function shortRange(start, end) {
  const a = parseDate(start), b = parseDate(end);
  const mon = d => L().months[d.getMonth()].slice(0, 3).toLowerCase();
  // no years, even across New Year (Alan, 14.09: "i understand it"). "28 des –
  // 3 jan" can only mean the turn of the year you are standing in.
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${a.getDate()}–${b.getDate()} ${mon(b)}`;
  // the one run that would lie without a year: same month, a year apart
  const yr = a.getMonth() === b.getMonth() ? d => ' ' + d.getFullYear() : () => '';
  return `${a.getDate()} ${mon(a)}${yr(a)} – ${b.getDate()} ${mon(b)}${yr(b)}`;
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
    id: i, title: ev.t, start: ev.s, end: ev.e || ev.s, calId: ev.c, src: ev,
    // an event's own colour wins over its calendar's, the same rule the Google
    // path uses — demo mode wrote `cid` on save and then never read it back,
    // so nothing he did to a colour showed there (14.09)
    color: (window.gcalColors || {})[ev.cid] || colors[ev.c] || '#26241f',
    colorId: ev.cid || '',
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
  if (state.view === 'day') {
    const d = parseDate(state.dayOf || fmt(new Date()));
    d.setDate(d.getDate() + dir);
    state.dayOf = state.weekDay = fmt(d);
    state.year = d.getFullYear();
    state.openEvent = null;              // a new day, nothing opened in it yet
    if (state.mode === 'google') window.gcalEnsureYear(state.year);
    render();
    return;
  }
  if (state.view === 'week') {
    const d = mondayOf(state.weekOf || fmt(new Date()));
    d.setDate(d.getDate() + dir * 7);
    // the anchor and the loaded year travel with the view, or climbing out of
    // a stepped week lands in the month you started from, and an edit reloads
    // the wrong year and empties the sheet (found in review, 13.09)
    state.weekOf = state.weekDay = fmt(d);
    state.year = d.getFullYear();
    if (state.mode === 'google') window.gcalEnsureYear(state.year);
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

// THE MONTH IS NAMED ONCE (Alan, 13.09). With the header carrying the period,
// the block's own title said September a second time and cost a day's worth of
// height. The header's name takes over the job of opening the year.
// THE YEAR OPENS THE YEAR, from wherever you are (Alan, 13.09).
$('#period-year').addEventListener('click', () => {
  if (state.view === 'year') return;
  // name what the header names: the day only when a day is open (13.09)
  const anchor = parseDate((state.view === 'day' ? state.dayOf : state.weekOf) || fmt(new Date()));
  if (state.view !== 'month') state.year = anchor.getFullYear();
  state.view = 'year'; state.openEvent = null; render();
});

// ALMANAKK IS THE WAY HOME (Alan, 13.09). However deep you are — a week in
// 2028, a day in April — its own name puts you back on this month, with today
// marked. One fixed point in an app you now move around in freely.
$('h1').addEventListener('click', () => {
  const now = new Date();
  state.year = now.getFullYear(); state.month = now.getMonth();
  state.weekOf = state.weekDay = state.dayOf = fmt(now);
  state.openEvent = null;
  state.view = 'month';
  if (state.mode === 'google') window.gcalEnsureYear(state.year);
  render();
});

// THE HEADER'S OWN TITLE CLIMBS TOO (Alan, 13.09). It names the level you are
// on, so tapping it should leave that level — the same as the sheet's title,
// which is easy to miss on a phone.
// The whole middle column answers, not just the glyphs: on a tablet the word
// is a small target in a wide bar, and a tap a few millimetres off it did
// nothing at all (Alan, 14.09).
$('#period-label').closest('nav').addEventListener('click', () => {
  if (state.view === 'day') {
    state.weekOf = state.weekDay = state.dayOf; state.openEvent = null;
    state.view = 'week'; render(); return;
  }
  if (state.view === 'week') {
    const anchor = parseDate(state.weekDay || state.weekOf || fmt(new Date()));
    state.year = anchor.getFullYear(); state.month = anchor.getMonth();
    state.view = 'month'; render(); return;
  }
  if (state.view === 'month') { state.view = 'year'; render(); }
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
  $('#more').open = false;   // ...but the menu it was chosen from should still shut
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
  // A TAP OUTSIDE THE FORM SHUTS IT, AND DOES NOTHING ELSE (Alan, 14.09). Lukk
  // is still there; this is the way out that needs no aiming. It closes and
  // stops — it does not also open whatever the finger happened to land on.
  // IT IS ASKED FIRST, AND IT COVERS THE GREY (14.09, second go): scoped to the
  // sheet, it missed the obvious gesture — tapping the paper AROUND the box —
  // which fell through to "off the paper climbs a level" and jumped to the
  // week. Below the edge strips, tapping the side of the screen stepped a day
  // instead of closing. An open form outranks both.
  // The writing line is not "outside": tapping it is what OPENS the form, and
  // this rule ran on the same click afterwards and threw the draft away again.
  if ((state.openEvent !== null || state.draft) && state.view === 'day'
      && !e.target.closest('.dedit, .wqa')) {
    state.openEvent = null; state.draft = null; render(); return;
  }
  // AND THE SAME FOR THE LINE HE IS TYPING ON (Alan, 14.09). It was not an open
  // form, so nothing caught the tap and it fell through to "one tap leaves" —
  // he escaped the writing and landed in the week. Tapping off it now shuts the
  // line and stops there. Like Escape, it lets the half-written line go: enter
  // is what keeps it.
  const typing = state.view === 'day' && document.querySelector('.dayview .wqa');
  if (typing && !e.target.closest('.wqa')) { render(); return; }
  // THE EDGES ARE NAVIGATION, WHATEVER IS UNDER THEM (Alan, 14.09: "the brain
  // just thinks back, it doesn't realize it's tapped on the number 15"). A
  // thumb going to the side of the screen means back or forward, and what
  // happens to sit there — a day number, a clock, the first letters of a title
  // — does not change that. So position wins over content here, which is the
  // opposite of every other rule in the app and is the point. The middle 70%
  // is the calendar. Not while he is writing or editing: a field at the edge
  // of the form is a field.
  // The month's is even on both sides at 14% (Alan, 14.09), which is a little
  // wider than the day-number-and-letter column it covers on the left and sits
  // well inside the uke/city column on the right. 20% reached too far into the
  // calendar; the columns themselves would have made the two sides different
  // widths, which is harder to hold in the head than one number.
  const EDGE = { month: 0.14, week: 0.15, day: 0.15 }[state.view];
  if (EDGE && !e.target.closest('.dedit, .wqa, .callist')) {
    const w = window.innerWidth;
    if (e.clientX < w * EDGE) { step(-1); return; }
    if (e.clientX > w * (1 - EDGE)) { step(1); return; }
  }
  const row = e.target.closest('.day');
  // A TITLE CLIMBS, AND IT IS ASKED FIRST (Alan, 13.09). These sat below the
  // tap/double-tap blocks, which catch everything inside a view — so the day's
  // own title was being read as "a tap in the day" and did nothing.
  if (state.view === 'day' && e.target.closest('.dayview > h2')) {
    state.weekOf = state.weekDay = state.dayOf;
    state.view = 'week'; state.openEvent = null; render(); return;
  }
  // THE WEEK'S TITLE TAKES YOU BACK UP (Alan, 12.09: "if i click the square at
  // the top of the week again, it collapses back to month view"). The same
  // place you came from, so the gesture reverses itself.
  if (state.view === 'week' && e.target.closest('.week > h2')) {
    const m = mondayOf(state.weekOf || fmt(new Date()));
    const anchor = parseDate(state.weekDay || fmt(m));
    state.year = anchor.getFullYear(); state.month = anchor.getMonth();
    state.view = 'month'; render(); return;
  }
  // ONE TAP GOES DOWN A LEVEL, TWO TAPS GO DOWN TWO (Alan, 12.09).
  //   month/year  tap → the week      double → the day
  //   week        tap → the day       double → the day, with that event open
  //   an empty day, double-tapped, opens straight onto its writing line.
  // Both gestures live on the same target, so the single one waits a moment to
  // see whether a second is coming. Titles still climb back up, one level a tap.
  const hit = e.target.closest('[data-eid]');
  const inDay = e.target.closest('.dayview');
  if (!inDay && !e.target.closest('#popover')) {
    const dayEl = e.target.closest('.day, .wday');
    if (dayEl) {
      const date = dayEl.dataset.date;
      // in the week the blank stretch beside an entry is paper, not the entry
      const onIt = state.view !== 'week' || onWords(hit, e);
      const ev = hit && onIt && state.events.find(x => String(x.id) === String(hit.dataset.eid));
      // IN THE WEEK, TAPPING A DAY OPENS THAT DAY (Alan, 14.09). Nothing inside
      // the sheet closes it any more — you leave a week by tapping off the
      // paper, which is the rule for every view now. An event opens with it, so
      // one tap reaches the thing you were looking at. The double branch does
      // the same, so a second tap is absorbed here rather than landing in the
      // day view and opening something else.
      // IN THE MONTH one tap opens the week and two go straight to the day.
      // TWO TAPS ON EMPTY PAPER MEAN "WRITE HERE", in both views (Alan, 14.09).
      // On an event they open it for editing instead. What differs is the
      // single tap: in the week it opens the day you touched — the event with
      // it, if you touched one — and in the month it opens the week.
      const twice = () => ev ? openDay(date, ev.id) : openDay(date, null, true);
      tapOrDouble(
        state.view === 'week'
          ? () => openDay(date, ev ? ev.id : null)
          : () => { state.weekOf = state.weekDay = date; state.view = 'week'; render(); },
        twice,
        ev ? 'e' + ev.id : date,
      );
      return;
    }
  }
  // ONE TAP OPENS, TWO TAPS CLOSE (Alan, 13.09). One gesture down the stack,
  // one gesture back up it, the same in every view — simpler to hold in the
  // head than the shortcuts it replaces.
  //   year  tap a month  → that month
  //   month tap a day    → its week      two taps → the year
  //   week  tap a day    → that day      two taps → the month
  //   day   tap an event → edit it       two taps → its week
  if (e.target.closest('.wqa')) return;   // he is writing; the field has its own rules
  // ONE TAP DOES THE OBVIOUS THING, AND ONE TAP LEAVES (Alan, 14.09). On an
  // entry's words it opens that entry. On the blank paper of a row, or on a
  // ruled line, it starts writing. On anything else in the day — the divider,
  // the paper below the last line — it goes back to the week. No waiting for a
  // second tap that never comes.
  if (inDay && !e.target.closest('.dedit') && !e.target.closest('.wblank')) {
    const evHit = hit && onWords(hit, e) && state.events.find(x => String(x.id) === String(hit.dataset.eid));
    if (evHit) { state.openEvent = evHit.id; render(); return; }
    // beside the words of an entry is blank paper, and blank paper is a line to
    // write on — the free line below, never this entry's own
    if (hit) {
      const free = [...document.querySelectorAll('.dayview .wblank')].find(b => !b.querySelector('input'));
      if (free) { openWeekEntry(free, state.dayOf); return; }
    }
    state.weekOf = state.weekDay = state.dayOf;
    state.view = 'week'; state.openEvent = null; render();
    return;
  }
  // ONLY IN THE DAY (Alan, 12.09). Writing on a blank line was swallowing the
  // single tap in the week, so the week would not close. Under his grammar a
  // new event is reached by double-tapping an empty day, which lands in the
  // day view with the cursor already on the line — so the week has no business
  // catching that tap.
  const blank = inDay && e.target.closest('.wblank');
  if (blank && !blank.querySelector('input')) {
    // the day view's own blank lines sit in .dayview, not in a .wday
    const holder = blank.closest('.wday, .dayview');
    openWeekEntry(blank, (holder && holder.dataset.date) || state.dayOf);
    return;
  }
  // A MONTH'S NAME OPENS THAT MONTH (Alan, 12.09: "in year view click and a
  // month opens"). The same gesture at every level: the title of a thing
  // opens it, and the week's title closes back up.
  // THE MARGINS STEP, LIKE THE SWIPE (Alan, 13.09). Tapping left of the sheet
  // goes back a week, month, year or day; tapping right goes forward. The
  // middle of the margin still climbs a level, and the titles always do.
  if (!e.target.closest('.month, .week, .dayview, .thumb, #popover, header')) {
    // OFF THE PAPER, ABOVE OR BELOW IT, CLOSES (Alan, 14.09: "tapping outside
    // the square of the week should bring us back to month"). Beside the sheet
    // is still the margin you step in — but on a phone the sheet is the whole
    // width, so the empty ground under it is what the thumb actually reaches,
    // and that is the way back up.
    const sheet = document.querySelector('.week, .dayview, .month, .quarter');
    const box = sheet && sheet.getBoundingClientRect();
    const beside = box && e.clientY > box.top && e.clientY < box.bottom;
    const w = window.innerWidth;
    if (beside && e.clientX < w * 0.25) { step(-1); return; }
    if (beside && e.clientX > w * 0.75) { step(1); return; }
    const up = { day: 'week', week: 'month', month: 'year' }[state.view];
    if (up) {
      if (state.view === 'day') { state.weekOf = state.weekDay = state.dayOf; state.openEvent = null; }
      if (state.view === 'week') {
        const anchor = parseDate(state.weekDay || state.weekOf || fmt(new Date()));
        state.year = anchor.getFullYear(); state.month = anchor.getMonth();
      }
      state.view = up; render();
    }
    return;
  }
  const thumb = e.target.closest('.thumb');
  if (thumb) {
    state.year = Number(thumb.dataset.y); state.month = Number(thumb.dataset.m);
    state.view = 'month'; render(); return;
  }
  // A MONTH'S NAME OPENS THE YEAR (Alan, 13.09) — the level above it, the way
  // the week's title opens the month. In the year view the same title opens
  // that month instead, because there the year is what you are already in.
  const mhead = e.target.closest('.month > h2');
  if (mhead && state.view === 'month') { state.view = 'year'; render(); return; }
  if (mhead && state.view === 'year') {
    const sec = mhead.closest('.month');
    state.year = Number(sec.dataset.y); state.month = Number(sec.dataset.m);
    state.view = 'month'; render(); return;
  }
  // NOTHING FALLS THROUGH TO v1's DAY PANEL ANY MORE (Alan, 12.09: "single tap
  // brings up the old weird add event menu from v1 — we want it in the new day
  // view"). Adding, editing and deleting all live in the day view now, so the
  // old popover has no job left and no way in. Two dead branches removed with
  // it: an earlier copy of "a day opens its week", which the gesture grammar
  // above already handles, and the fallback that opened the panel.
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
let touchX = null, touchY = null;
$('#app').addEventListener('touchstart', e => {
  touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
}, { passive: true });
$('#app').addEventListener('touchend', e => {
  if (touchX === null) return;   // every view steps sideways, the year by a year
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  // a diagonal thumb-scroll in the year thumbnails used to step a whole year
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  touchX = touchY = null;
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
