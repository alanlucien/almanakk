/* Almanakk — Norwegian wall-calendar view. Rendering + calendar math. */
'use strict';

const $ = s => document.querySelector(s);

const LANGS = {
  no: {
    months: ['JANUAR','FEBRUAR','MARS','APRIL','MAI','JUNI','JULI','AUGUST','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'],
    wd: ['M','Ti','O','To','F','L','S'], // Monday-first
    week: 'uke',
    year: 'År', month: 'Måned', detail: 'Detaljer', print: 'Skriv ut',
    signin: 'Logg inn med Google', cals: 'Kalendere',
    added: 'Lagt til (demo — lagres ikke)', saved: 'Lagret i Google Kalender',
    deleted: 'Slettet', undo: 'Angre', restored: 'Gjenopprettet', edit: 'Endre', updated: 'Endret', citiesBtn: 'Byer',
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
    added: 'Added (demo — not saved)', saved: 'Saved to Google Calendar',
    deleted: 'Deleted', undo: 'Undo', restored: 'Restored', edit: 'Edit', updated: 'Updated', citiesBtn: 'Cities',
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
  cities: localStorage.getItem('almanakk-cities') === '1',
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
  put(off(E, 39), 'K. himmelfartsdag', true);
  put(off(E, 49), '1. Pinsedag', true);
  put(off(E, 50), '2. Pinsedag', true);
  put(new Date(y, 5, 23), 'St.Hansaften');
  const dec24 = new Date(y, 11, 24);
  const advent4 = off(dec24, -dec24.getDay()); // Sunday on/before Dec 24
  for (let n = 1; n <= 4; n++) put(off(advent4, (n - 4) * 7), n + '. Søn. i advent');
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
function isShow(ev) { return SHOW_RE.test(ev.title); }
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
function evInk(e) { return isShow(e) ? 'var(--red)' : inkColor(e.color); }
const isTbc = ev => /\btbc\b/i.test(ev.title);

/* ---------- cities (derived from flight-looking events) ---------- */

// "OSL–LHR 14:55" / "BKK-PAR-MARSEILLE" -> last leg; "Fly Oslo" / "Flight to Helsinki (AY 62)" -> name.
function flightDest(title) {
  const chain = title.match(/\b[A-Z]{3}(?:\s*[-–—>→]+\s*[A-Z]{3})+\b/);
  if (chain) {
    const codes = chain[0].split(/[^A-Z]+/).filter(Boolean);
    return codes[codes.length - 1];
  }
  const to = title.match(/\b(?:fly|flight)\s+(?:to\s+)?([A-ZÆØÅa-zæøå][A-Za-zæøåÆØÅ]{2,})/i);
  if (to) return to[1];
  return null;
}
function buildFlightIndex() {
  const flights = [];
  for (const ev of visibleEvents()) {
    const dest = flightDest(ev.title);
    if (dest) flights.push({ date: ev.start, time: ev.time || '99', dest });
  }
  flights.sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : (a.date < b.date ? -1 : 1)));
  return flights;
}
function cityOn(ds, flights) {
  let city = null;
  for (const f of flights) {
    if (f.date <= ds) city = f.dest; else break;
  }
  return city;
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
function cityName(code) {
  return IATA_CITIES[code] || code;
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
  let rows = '';
  for (let day = 1; day <= n; day++) {
    const d = new Date(y, m, day);
    const ds = fmt(d);
    const wi = weekdayIdx(d);
    const h = hol[ds];
    const red = wi === 6 || (h && h.red);
    let cityCell = '';
    if (flights) {
      const city = cityOn(ds, flights);
      const show = city && (city !== prevCity || day === 1 || wi === 0);
      cityCell = `<span class="city">${show ? esc(cityName(city)) : ''}</span>`;
      prevCity = city;
    }
    const todays = details.filter(e => e.start === ds);
    const wgTodays = wgDet.filter(e => e.start === ds);
    const detailsFree = !todays.length && !wgTodays.length;
    // lanes: Alan's projects left of the day line, wg context to its right
    const ownEvs = [], wgEvs = [];
    for (let l = 0; l < nOwn; l++) ownEvs[l] = spans.find(e => !e._wg && e._lane === l && e.start <= ds && e.end >= ds);
    for (let k = 0; k < nOvl; k++) wgEvs[k] = spans.find(e => e._wg && e._lane === nOwn + k && e.start <= ds && e.end >= ds);
    const hasOwn = ownEvs.some(Boolean);

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
      // a label may spend at most half its band on text (and max 3 lines)
      const lines = (showLabel && !canSpill) ? Math.max(1, Math.min(3, Math.floor((endInMonth - day + 1) / 2))) : 1;
      // continuation rows carry an invisible copy of the title, so the band
      // stays text-wide wherever the row is free and snaps back where it isn't
      const txt = showLabel ? `<i>${esc(ev.title)}</i>`
        : (canSpill ? `<i class="ghost">${esc(ev.title)}</i>` : '');
      return `<span class="lane on ${ev._wg ? 'wg' : ''} ${canSpill ? 'spill' : ''} ${lines > 1 ? 'wrap' : ''}`
        + ` ${isShow(ev) ? 'showband' : ''} ${ev.start === ds ? 'bstart' : ''} ${isTbc(ev) ? 'tbc' : ''}"`
        + ` data-eid="${ev.id}" style="--c:${ev.color};--ci:${inkColor(ev.color)};--lines:${lines};--spillw:${Math.round(spillK * 100)}%">`
        + txt + '</span>';
    };
    const freeAfter = (arr, i) => {
      let f = 0;
      for (let j = i + 1; j < arr.length; j++) { if (!arr[j]) f++; else break; }
      return f;
    };
    let ownCells = '';
    if (hasOwn) {
      for (let l = 0; l < nOwn; l++) {
        const free = freeAfter(ownEvs, l);
        // the detail area (≈1.75 lane widths) counts only when the free run reaches it
        const bonus = (free === nOwn - 1 - l && detailsFree) ? 1.75 : 0;
        ownCells += laneCell(ownEvs[l], 1 + free + bonus);
      }
    }
    let wgCells = '';
    for (let k = 0; k < nOvl; k++) wgCells += laneCell(wgEvs[k], 1 + freeAfter(wgEvs, k));

    // the day line: Alan's events first, wg items after; on a day without own
    // bands it starts at the far left and uses their width too
    // two-sided day line: Alan's items flow from the left, wg's items flow
    // from the right, hugging their band; each side clips independently
    const ownLine = todays.slice().sort(detOrder);
    const wgLine = wgTodays.slice().sort((a, b) => {
      const k = e => { const t = effTime(e) || ''; return (isShow(e) ? '0' : (t ? '2' : '1')) + t; };
      const ka = k(a), kb = k(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    // with no own bands, the line always absorbs the own-lane columns
    // (otherwise the whole row would shift into the wrong grid tracks)
    const evtHtml = (e, wg) => `<b class="evt ${wg ? 'wgd' : ''} ${isTbc(e) ? 'tbc' : ''}" data-eid="${e.id}" style="color:${evInk(e)}">${esc((e.time ? e.time + ' ' : '') + e.title)}</b>`;
    const detail = `<span class="detail"${hasOwn ? '' : ` style="grid-column: span ${nOwn + 1}"`}>`
      + ownLine.map(e => evtHtml(e, false)).join('')
      + '</span>';
    // wg day-items live to the RIGHT of the wg bands (band left of its items,
    // same rule as Alan's own side), in their own slot before the uke column
    const wgDetail = nOvl ? `<span class="detail wgdet">${wgLine.map(e => evtHtml(e, true)).join('')}</span>` : '';
    const info = h
      ? `<span class="info ${h.red ? 'red' : ''}">${esc(h.name)}</span>`
      : (wi === 0 ? `<span class="info">${L().week} ${isoWeek(d)}</span>` : '<span class="info"></span>');
    const showDay = todays.some(isShow) || wgTodays.some(isShow)
      || ownEvs.some(e => e && isShow(e)) || wgEvs.some(e => e && isShow(e));
    rows += `<div class="day ${red ? 'red' : ''} ${ds === todayStr ? 'today' : ''} ${showDay ? 'showday' : ''}" data-date="${ds}">`
      + `<span class="num">${day}</span><span class="wd">${L().wd[wi]}</span>`
      + cityCell + ownCells + detail + wgCells + wgDetail + info + `</div>`;
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
  $('#view-year').textContent = L().year;
  $('#view-month').textContent = L().month;
  $('#view-detail').textContent = L().detail;
  $('#print').textContent = L().print;
  $('#signin').textContent = L().signin;
  $('#cal-picker summary').textContent = L().cals;
  $('#cities-chip').textContent = L().citiesBtn;
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

async function addEvent(date, text) {
  const range = parseRange(date, text);
  if (state.mode === 'google') {
    await window.gcalCreateEvent(range ? range.start : date, range ? range.end : date, range ? range.title : text);
    toast(L().saved);
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
  const city = cityOn(date, buildFlightIndex()); // always shown, independent of the Cities toggle
  pop.innerHTML = `<p class="dim"><b>${date}</b>${city ? `<span class="city-tag">${esc(cityName(city))}</span>` : ''}</p>`
    + evs.map(e =>
      `<p class="${tour.has(e.calId) ? 'wgrow' : ''} ${isTbc(e) ? 'tbc' : ''}">${tour.has(e.calId) ? '<span class="wg-mark">wg</span> ' : ''}`
      + `<b style="color:${evInk(e)}">${esc((e.time ? e.time + ' ' : '') + e.title)}</b>`
      + (e.start !== e.end ? ` <span class="dim">${e.start} – ${e.end}</span>` : '')
      + ` <button class="x" data-edit="${e.id}">${L().edit}</button>`
      + ` <button class="x" data-del="${e.id}">${L().del}</button></p>`).join('')
    + `<form class="qa"><input type="text" placeholder="${L().newPh}" autocomplete="off"><button type="submit" class="add">${L().add}</button></form>`;
  document.body.appendChild(pop);
  const r = row.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = (r.bottom + 4 + pop.offsetHeight > window.innerHeight ? Math.max(8, r.top - pop.offsetHeight - 4) : r.bottom + 4) + 'px';
  pop.querySelector('.qa').addEventListener('submit', async e => {
    e.preventDefault();
    const text = pop.querySelector('input').value.trim();
    if (!text) return closePanel();
    try {
      await addEvent(date, text);
      closePanel(true);
    } catch (err) { toast(err.message); }
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
  $('#cities-chip').classList.toggle('active', state.cities);
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
$('#cities-chip').addEventListener('click', () => {
  state.cities = !state.cities;
  localStorage.setItem('almanakk-cities', state.cities ? '1' : '0');
  render();
  updateChips();
});

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
