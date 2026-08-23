/* Almanakk — Norwegian wall-calendar view. Rendering + calendar math. */
'use strict';

const $ = s => document.querySelector(s);
const MONTHS = ['JANUAR','FEBRUAR','MARS','APRIL','MAI','JUNI','JULI','AUGUST','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
const WD = ['M','Ti','O','To','F','L','S']; // Monday-first

const state = {
  view: window.innerWidth < 700 ? 'month' : 'year',
  year: new Date().getFullYear(),
  month: new Date().getMonth(), // 0-based, for month view
  events: [],      // {id, title, start, end (inclusive 'YYYY-MM-DD'), color, time?, gid?, calId?, src?}
  mode: 'demo',    // 'demo' | 'google'
};

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
function monthLayout(y, m, events) {
  const first = fmt(new Date(y, m, 1));
  const last = fmt(new Date(y, m, daysInMonth(y, m)));
  const overlapping = events.filter(ev => ev.start <= last && ev.end >= first);
  const spans = overlapping
    .filter(ev => ev.end > ev.start)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (b.end < a.end ? -1 : 1)));
  const laneEnds = [];
  for (const ev of spans) {
    let lane = laneEnds.findIndex(end => end < ev.start);
    if (lane === -1) lane = laneEnds.length;
    ev._lane = Math.min(lane, MAX_LANES - 1);
    laneEnds[ev._lane] = ev.end > (laneEnds[ev._lane] || '') ? ev.end : laneEnds[ev._lane];
  }
  const details = overlapping
    .filter(ev => ev.end === ev.start)
    .sort((a, b) => ((a.time || '99') < (b.time || '99') ? -1 : 1));
  // at least 1: repeat(0, …) is invalid CSS and would collapse the grid
  return { spans, details, nLanes: Math.min(MAX_LANES, Math.max(1, laneEnds.length)) };
}

/* ---------- rendering ---------- */

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMonthEl(y, m) {
  const { spans, details, nLanes } = monthLayout(y, m, state.events);
  const hol = holidays(y);
  const todayStr = fmt(new Date());
  const n = daysInMonth(y, m);
  let rows = '';
  for (let day = 1; day <= n; day++) {
    const d = new Date(y, m, day);
    const ds = fmt(d);
    const wi = weekdayIdx(d);
    const h = hol[ds];
    const red = wi === 6 || (h && h.red);
    // lane cells (projects/tours)
    let laneCells = '';
    for (let lane = 0; lane < nLanes; lane++) {
      const ev = spans.find(e => e._lane === lane && e.start <= ds && e.end >= ds);
      if (!ev) { laneCells += '<span class="lane"></span>'; continue; }
      // repeat the label at span start, month start and on Mondays
      const showLabel = ev.start === ds || day === 1 || wi === 0;
      laneCells += `<span class="lane on" data-eid="${ev.id}" style="--c:${ev.color}">`
        + (showLabel ? `<i>${esc(ev.title)}</i>` : '') + '</span>';
    }
    // detail cell (single-day events, stacked)
    const todays = details.filter(e => e.start === ds);
    const detail = '<span class="detail">' + todays.map(e =>
      `<b class="evt" data-eid="${e.id}" style="color:${e.color}">${esc((e.time ? e.time + ' ' : '') + e.title)}</b>`
    ).join('') + '</span>';
    const info = h
      ? `<span class="info ${h.red ? 'red' : ''}">${esc(h.name)}</span>`
      : (wi === 0 ? `<span class="info">uke ${isoWeek(d)}</span>` : '<span class="info"></span>');
    rows += `<div class="day ${red ? 'red' : ''} ${ds === todayStr ? 'today' : ''}" data-date="${ds}">`
      + `<span class="num">${day}</span><span class="wd">${WD[wi]}</span>`
      + laneCells + detail + info + `</div>`;
  }
  return `<section class="month" style="--lanes:${nLanes}"><h2>${MONTHS[m]} <small>${y}</small></h2>${rows}</section>`;
}

function render() {
  closePopover();
  const app = $('#app');
  if (state.view === 'year') {
    let html = '';
    for (let q = 0; q < 4; q++) {
      html += '<div class="quarter">';
      for (let m = q * 3; m < q * 3 + 3; m++) html += renderMonthEl(state.year, m);
      html += '</div>';
    }
    app.className = 'year';
    app.innerHTML = html;
    $('#period-label').textContent = state.year;
  } else {
    app.className = 'strip';
    app.innerHTML = renderMonthEl(state.year, state.month);
    $('#period-label').textContent = MONTHS[state.month].charAt(0) + MONTHS[state.month].slice(1).toLowerCase() + ' ' + state.year;
  }
  $('#view-year').classList.toggle('active', state.view === 'year');
  $('#view-month').classList.toggle('active', state.view === 'month');
}

/* ---------- quick add ---------- */

function openQuickAdd(row) {
  closeQuickAdd();
  const date = row.dataset.date;
  const form = document.createElement('form');
  form.className = 'quick-add';
  form.innerHTML = `<input type="text" placeholder="${date} · «8-12 tekst» = flere dager · «13:00» = tidspunkt" autocomplete="off">`;
  row.appendChild(form);
  const input = form.querySelector('input');
  input.focus();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return closeQuickAdd();
    try {
      await addEvent(date, text);
      closeQuickAdd();
    } catch (err) {
      toast(err.message);
    }
  });
  input.addEventListener('blur', () => setTimeout(closeQuickAdd, 150));
}
function closeQuickAdd() {
  document.querySelectorAll('.quick-add').forEach(f => f.remove());
}

// "8-12 Antigone" on a day in March -> span March 8–12.
function parseRange(date, text) {
  const m = text.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(.+)$/);
  if (!m) return null;
  const [y, mo] = date.split('-').map(Number);
  const a = Number(m[1]), b = Number(m[2]), last = daysInMonth(y, mo - 1);
  if (a < 1 || b < a || b > last) return null;
  const pad = x => String(x).padStart(2, '0');
  return { start: `${y}-${pad(mo)}-${pad(a)}`, end: `${y}-${pad(mo)}-${pad(b)}`, title: m[3] };
}

async function addEvent(date, text) {
  const range = parseRange(date, text);
  if (state.mode === 'google') {
    await window.gcalCreateEvent(range ? range.start : date, range ? range.end : date, range ? range.title : text);
    toast('Lagret i Google Kalender');
  } else if (ALMANAKK_CONFIG.clientId) {
    throw new Error('Logg inn med Google først for å legge til.');
  } else {
    DEMO_EVENTS.push(range ? { c: 'alan', t: range.title, s: range.start, e: range.end } : { c: 'alan', t: text, s: date });
    loadDemo();
    toast('Lagt til (demo — lagres ikke)');
  }
}

/* ---------- event popover (view / delete) ---------- */

function openPopover(target, ev) {
  closePopover();
  closeQuickAdd();
  const pop = document.createElement('div');
  pop.id = 'popover';
  const range = ev.start === ev.end ? ev.start : ev.start + ' – ' + ev.end;
  pop.innerHTML = `
    <p><b style="color:${ev.color}">${esc((ev.time ? ev.time + ' ' : '') + ev.title)}</b></p>
    <p class="dim">${range}</p>
    <div class="actions"><button data-act="delete">Slett</button><button data-act="close">Lukk</button></div>`;
  document.body.appendChild(pop);
  const r = target.getBoundingClientRect();
  pop.style.left = Math.min(r.left, window.innerWidth - pop.offsetWidth - 8) + 'px';
  pop.style.top = (r.bottom + 4 + pop.offsetHeight > window.innerHeight ? r.top - pop.offsetHeight - 4 : r.bottom + 4) + 'px';
  pop.addEventListener('click', async e => {
    const act = e.target.dataset.act;
    if (act === 'close') closePopover();
    if (act === 'delete') {
      try {
        await deleteEvent(ev);
        closePopover();
        toast('Slettet');
      } catch (err) { toast(err.message); }
    }
  });
}
function closePopover() {
  const p = $('#popover');
  if (p) p.remove();
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
    id: i, title: ev.t, start: ev.s, end: ev.e || ev.s, color: colors[ev.c] || '#26241f', src: ev,
  }));
  render();
}

/* ---------- ui chrome ---------- */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.hidden = true; }, 2500);
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

$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
$('#view-year').addEventListener('click', () => { state.view = 'year'; render(); });
$('#view-month').addEventListener('click', () => { state.view = 'month'; render(); });
$('#print').addEventListener('click', () => window.print());

// Printing always outputs the year view.
let viewBeforePrint = null;
window.addEventListener('beforeprint', () => {
  if (state.view !== 'year') { viewBeforePrint = state.view; state.view = 'year'; render(); }
});
window.addEventListener('afterprint', () => {
  if (viewBeforePrint) { state.view = viewBeforePrint; viewBeforePrint = null; render(); }
});

// Tap an event -> popover; tap empty day space -> quick-add.
$('#app').addEventListener('click', e => {
  if (e.target.closest('.quick-add') || e.target.closest('#popover')) return;
  const evEl = e.target.closest('[data-eid]');
  if (evEl) {
    const ev = state.events.find(x => String(x.id) === evEl.dataset.eid);
    if (ev) return openPopover(evEl, ev);
  }
  const row = e.target.closest('.day');
  if (row) openQuickAdd(row);
});
document.addEventListener('click', e => {
  if (!e.target.closest('#popover') && !e.target.closest('[data-eid]')) closePopover();
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
loadDemo();
