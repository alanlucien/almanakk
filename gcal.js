/* Google Calendar integration (Google Identity Services + Calendar REST API). */
'use strict';

(function () {
  const SEL_KEY = 'almanakk-selected-cals';
  const TARGET_KEY = 'almanakk-target-cal';
  let accessToken = null;
  let tokenClient = null;
  let calendars = []; // {id, name, color, writable}
  let loadedYears = new Set();
  let rawEvents = []; // internal events from Google, all loaded years

  const TOKEN_KEY = 'almanakk-token';

  window.gcalReady = function () {
    if (!ALMANAKK_CONFIG.clientId) return; // demo mode
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: ALMANAKK_CONFIG.clientId,
      scope: 'https://www.googleapis.com/auth/calendar',
      callback: onToken,
    });
    const btn = document.querySelector('#signin');
    btn.hidden = false;
    btn.addEventListener('click', () => tokenClient.requestAccessToken());
    // Reuse a still-valid token so a refresh doesn't sign you out (tokens last ~1h).
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (saved && saved.exp > Date.now()) {
      accessToken = saved.t;
      bootGoogle();
      return;
    }
    // Otherwise: show last-synced events right away (works offline too).
    const cached = JSON.parse(localStorage.getItem('almanakk-events') || 'null');
    if (cached && cached.length) {
      state.events = cached;
      render();
      const b = document.querySelector('#banner');
      b.hidden = false;
      b.textContent = 'Viser sist synkroniserte data — logg inn for å oppdatere og skrive.';
    }
  };

  async function onToken(resp) {
    if (resp.error) { toastErr('Innlogging feilet: ' + resp.error); return; }
    accessToken = resp.access_token;
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      t: resp.access_token,
      exp: Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000,
    }));
    bootGoogle();
  }

  async function bootGoogle() {
    state.mode = 'google';
    document.querySelector('#signin').hidden = true;
    document.querySelector('#banner').hidden = true;
    try {
      await loadCalendars();
      loadedYears = new Set();
      rawEvents = [];
      await window.gcalEnsureYear(state.year);
    } catch (e) { toastErr(e.message); }
  }

  async function api(path, params, opts = {}) {
    const url = new URL('https://www.googleapis.com/calendar/v3/' + path);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
    const r = await fetch(url, {
      ...opts,
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    });
    if (r.status === 401) {
      accessToken = null;
      document.querySelector('#signin').hidden = false;
      throw new Error('Innlogging utløpt — logg inn igjen.');
    }
    if (!r.ok) throw new Error('Google API-feil ' + r.status);
    return r.json();
  }

  async function loadCalendars() {
    const data = await api('users/me/calendarList');
    calendars = (data.items || []).map(c => ({
      id: c.id,
      name: c.summaryOverride || c.summary,
      color: c.backgroundColor || '#26241f',
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
    }));
    renderCalPicker();
  }

  function selectedIds() {
    const stored = JSON.parse(localStorage.getItem(SEL_KEY) || 'null');
    if (stored) return stored.filter(id => calendars.some(c => c.id === id));
    return calendars.map(c => c.id);
  }
  function targetId() {
    const stored = localStorage.getItem(TARGET_KEY);
    if (stored && calendars.some(c => c.id === stored && c.writable)) return stored;
    const primary = calendars.find(c => c.id.includes('@') && c.writable);
    return (primary || calendars.find(c => c.writable) || {}).id;
  }

  function renderCalPicker() {
    const picker = document.querySelector('#cal-picker');
    picker.hidden = false;
    const sel = new Set(selectedIds());
    const tgt = targetId();
    const tour = new Set(window.tourCalIds ? tourCalIds() : []);
    document.querySelector('#cal-list').innerHTML = `
      <div class="cal-row cal-head"><span>Vis</span><span>Ny→</span><span>Tour</span><span></span><span></span></div>` +
      calendars.map(c => `
      <div class="cal-row" style="--c:${c.color}">
        <input type="checkbox" class="showcal" data-id="${c.id}" ${sel.has(c.id) ? 'checked' : ''} title="Vis i almanakken">
        <input type="radio" name="target" data-id="${c.id}" title="Nye hendelser skrives hit"
          ${c.writable ? '' : 'disabled'} ${c.id === tgt ? 'checked' : ''}>
        <input type="checkbox" class="tourtag" data-id="${c.id}" ${tour.has(c.id) ? 'checked' : ''} title="Telles som turné (Tour-knappen)">
        <span class="dot"></span><span class="nm">${c.name}</span>
      </div>`).join('');
    document.querySelector('#cal-list').onchange = async e => {
      if (e.target.classList.contains('tourtag')) {
        const ids = [...document.querySelectorAll('#cal-list .tourtag:checked')].map(i => i.dataset.id);
        localStorage.setItem('almanakk-tourcals', JSON.stringify(ids));
        if (window.updateChips) updateChips();
      } else if (e.target.classList.contains('showcal')) {
        const ids = [...document.querySelectorAll('#cal-list .showcal:checked')].map(i => i.dataset.id);
        localStorage.setItem(SEL_KEY, JSON.stringify(ids));
        loadedYears = new Set();
        rawEvents = [];
        await window.gcalEnsureYear(state.year);
      } else if (e.target.type === 'radio') {
        localStorage.setItem(TARGET_KEY, e.target.dataset.id);
      }
    };
  }

  window.gcalEnsureYear = async function (year) {
    if (state.mode !== 'google' || loadedYears.has(year)) return;
    loadedYears.add(year);
    const timeMin = year + '-01-01T00:00:00Z';
    const timeMax = (year + 1) + '-01-10T00:00:00Z';
    const byId = Object.fromEntries(calendars.map(c => [c.id, c]));
    for (const id of selectedIds()) {
      let pageToken = '';
      do {
        const data = await api('calendars/' + encodeURIComponent(id) + '/events', {
          timeMin, timeMax, singleEvents: 'true', maxResults: '2500', orderBy: 'startTime',
          ...(pageToken ? { pageToken } : {}),
        });
        for (const ev of data.items || []) {
          if (ev.status === 'cancelled' || !ev.start) continue;
          let start, end, time;
          if (ev.start.date) {
            start = ev.start.date;
            const e = parseDate(ev.end.date); e.setDate(e.getDate() - 1); // exclusive -> inclusive
            end = fmt(e);
          } else {
            const dt = new Date(ev.start.dateTime);
            start = end = fmt(dt);
            time = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
          }
          rawEvents.push({ id: id + '/' + ev.id, gid: ev.id, calId: id, title: ev.summary || '(uten tittel)', start, end, time, color: byId[id].color });
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
    }
    state.events = rawEvents;
    try { localStorage.setItem('almanakk-events', JSON.stringify(rawEvents)); } catch (e) { /* storage full: skip */ }
    render();
  };

  window.gcalCreateEvent = async function (startDate, endDate, text) {
    const target = targetId();
    if (!target) throw new Error('Ingen skrivbar kalender valgt.');
    const timeMatch = startDate === endDate && text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    let body;
    if (timeMatch) {
      const hh = String(timeMatch[1]).padStart(2, '0');
      const startDt = startDate + 'T' + hh + ':' + timeMatch[2] + ':00';
      const endD = new Date(startDt);
      endD.setHours(endD.getHours() + 1);
      const endDt = fmt(endD) + 'T' + String(endD.getHours()).padStart(2, '0') + ':' + String(endD.getMinutes()).padStart(2, '0') + ':00';
      body = {
        summary: text,
        start: { dateTime: startDt, timeZone: 'Europe/Oslo' },
        end: { dateTime: endDt, timeZone: 'Europe/Oslo' },
      };
    } else {
      const next = parseDate(endDate); next.setDate(next.getDate() + 1);
      body = { summary: text, start: { date: startDate }, end: { date: fmt(next) } }; // end exclusive
    }
    await api('calendars/' + encodeURIComponent(target) + '/events', {}, {
      method: 'POST', body: JSON.stringify(body),
    });
    loadedYears = new Set();
    rawEvents = [];
    await window.gcalEnsureYear(state.year);
  };

  window.gcalCalendars = () => calendars;

  // Make sure the given calendars are in the selected set and loaded
  // (used by the Tour chip so switching it on always has data to show).
  window.gcalEnsureSelected = async function (ids) {
    const sel = new Set(selectedIds());
    const missing = ids.filter(id => !sel.has(id));
    if (!missing.length) return;
    missing.forEach(id => sel.add(id));
    localStorage.setItem(SEL_KEY, JSON.stringify([...sel]));
    loadedYears = new Set();
    rawEvents = [];
    renderCalPicker();
    await window.gcalEnsureYear(state.year);
  };

  // Undo a delete: Google keeps the event with status 'cancelled'; flip it back.
  window.gcalRestoreEvent = async function (ev) {
    try {
      await api('calendars/' + encodeURIComponent(ev.calId) + '/events/' + encodeURIComponent(ev.gid), {}, {
        method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }),
      });
    } catch (e) {
      // fall back: recreate from what the almanakk knows
      let body;
      if (ev.time) {
        const startDt = ev.start + 'T' + ev.time + ':00';
        const endD = new Date(startDt);
        endD.setHours(endD.getHours() + 1);
        const p = n => String(n).padStart(2, '0');
        body = {
          summary: ev.title,
          start: { dateTime: startDt, timeZone: 'Europe/Oslo' },
          end: { dateTime: fmt(endD) + 'T' + p(endD.getHours()) + ':' + p(endD.getMinutes()) + ':00', timeZone: 'Europe/Oslo' },
        };
      } else {
        const next = parseDate(ev.end);
        next.setDate(next.getDate() + 1);
        body = { summary: ev.title, start: { date: ev.start }, end: { date: fmt(next) } };
      }
      await api('calendars/' + encodeURIComponent(ev.calId) + '/events', {}, { method: 'POST', body: JSON.stringify(body) });
    }
    loadedYears = new Set();
    rawEvents = [];
    await window.gcalEnsureYear(state.year);
  };

  window.gcalUpdateEvent = async function (ev, title) {
    await api('calendars/' + encodeURIComponent(ev.calId) + '/events/' + encodeURIComponent(ev.gid), {}, {
      method: 'PATCH', body: JSON.stringify({ summary: title }),
    });
    loadedYears = new Set();
    rawEvents = [];
    await window.gcalEnsureYear(state.year);
  };

  window.gcalDeleteEvent = async function (ev) {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(ev.calId) + '/events/' + encodeURIComponent(ev.gid));
    const r = await fetch(url, { method: 'DELETE', headers: { Authorization: 'Bearer ' + accessToken } });
    if (!r.ok && r.status !== 410) throw new Error('Kunne ikke slette (' + r.status + ')');
    loadedYears = new Set();
    rawEvents = [];
    await window.gcalEnsureYear(state.year);
  };

  function toastErr(msg) {
    const t = document.querySelector('#toast');
    t.textContent = msg;
    t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 4000);
  }
})();
