/* Google Calendar integration (Google Identity Services + Calendar REST API). */
'use strict';

(function () {
  const SEL_KEY = 'almanakk-selected-cals';
  const TARGET_KEY = 'almanakk-target-cal';
  let accessToken = null;
  let tokenClient = null;
  let calendars = []; // {id, name, color, writable}

  // Google's per-event colour palette (event.colorId 1-11); an event's own
  // colour, set in any Google Calendar app, wins over the calendar colour.
  const EVENT_COLORS = {
    1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26',
    6: '#f4511e', 7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000',
  };
  let loadedYears = new Set();
  let rawEvents = []; // internal events from Google, all loaded years
  // Ticking a calendar throws the cache away and reloads. Without this counter a
  // second tick while the first fetch was still running left TWO loops appending
  // to rawEvents, so every event landed twice — exactly what Alan saw when he
  // toggled the boxes quickly. A load reads the counter when it starts and only
  // commits if nobody has reset the cache underneath it since. Loads of two
  // different years may still run together and both commit, which is what
  // happens when you page through years quickly.
  let cacheGen = 0;
  function resetCache() { loadedYears = new Set(); rawEvents = []; cacheGen++; }

  const TOKEN_KEY = 'almanakk-token';

  // Safari (and every browser on iOS, which is Safari underneath) blocks the
  // cross-site storage the silent token path needs, so Google falls back to
  // opening a window — which the browser then flags as a BLOCKED POPUP on load.
  // A visible warning is worse than the stale token it was meant to avoid, so
  // there we skip the silent path entirely and let the sign-in button do it.
  const ua = navigator.userAgent;
  const CAN_SILENT = !(/iPad|iPhone|iPod/.test(ua)
    || (/^((?!chrome|android).)*safari/i.test(ua)));

  // index.html calls gcalReady from the GIS script's onload, but that can lose
  // the race with this file (nothing would ever call it) or never fire at all
  // (blocked, offline). Poll, then say so plainly instead of showing a dead app.
  // Last synced events live in localStorage, so the calendar still reads even
  // with no token and no network. Returns true if anything was shown.
  function showCached(msg) {
    const cached = JSON.parse(localStorage.getItem('almanakk-events') || 'null');
    const b = document.querySelector('#banner');
    if (cached && cached.length) { state.events = cached; render(); }
    b.hidden = false;
    b.textContent = msg;
    return !!(cached && cached.length);
  }

  let gisWaited = 0;
  const gisPoll = setInterval(() => {
    if (window.google && window.google.accounts) return window.gcalReady();
    if ((gisWaited += 400) < 8000) return;
    clearInterval(gisPoll);
    if (!ALMANAKK_CONFIG.clientId) return;
    // no Google sign-in available at all: show what we last synced and say why
    showCached('Fikk ikke lastet Google-innlogging — viser sist synkroniserte '
      + 'data. Sjekk nettet og last siden på nytt.');
  }, 400);

  window.gcalReady = function () {
    if (!ALMANAKK_CONFIG.clientId) return; // demo mode
    if (tokenClient) return;               // the onload attribute and the poll below both call this
    clearInterval(gisPoll);
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: ALMANAKK_CONFIG.clientId,
      scope: 'https://www.googleapis.com/auth/calendar',
      callback: onToken,
      error_callback: onTokenError,
    });
    const btn = document.querySelector('#signin');
    btn.hidden = false;
    btn.addEventListener('click', () => tokenClient.requestAccessToken());
    // Reuse a still-valid token so a refresh doesn't sign you out (tokens last ~1h).
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (saved && saved.exp > Date.now()) {
      accessToken = saved.t;
      scheduleRefresh(saved.exp);
      bootGoogle();
      return;
    }
    // Otherwise: show last-synced events right away (works offline too).
    showCached('Viser sist synkroniserte data — logg inn for å oppdatere og skrive.');
    // Signed in before: renew silently where the browser allows it. On Safari
    // the sign-in button is the only way, and it is already showing.
    if (saved && CAN_SILENT) silentToken().catch(() => {});
  };

  // One silent renewal at a time; concurrent callers share the same promise.
  // ALWAYS time-bounded: on iOS the silent path can be swallowed without ever
  // calling back, and a promise that never settles would freeze the boot.
  let pendingToken = null;
  function silentToken() {
    if (pendingToken) return pendingToken.promise;
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pendingToken = { promise, resolve, reject };
    pendingToken.timer = setTimeout(() => settleToken(new Error('silent_timeout')), 8000);
    try { tokenClient.requestAccessToken({ prompt: '' }); }
    catch (e) { settleToken(e); }
    return promise;
  }
  // settle the pending silent request exactly once; err = null means success
  function settleToken(err) {
    if (!pendingToken) return false;
    const p = pendingToken;
    pendingToken = null;
    clearTimeout(p.timer);
    if (err) p.reject(err); else p.resolve();
    return true;
  }

  let refreshTimer = null;
  // Renew ~5 min before the token dies, while the app is open.
  function scheduleRefresh(expMs) {
    clearTimeout(refreshTimer);
    if (!CAN_SILENT) return; // would surface as a blocked popup mid-session
    refreshTimer = setTimeout(() => silentToken().catch(() => {}),
      Math.max(expMs - Date.now() - 5 * 60e3, 60e3));
  }

  async function onToken(resp) {
    if (resp.error) {
      if (!settleToken(new Error(resp.error))) toastErr('Innlogging feilet: ' + resp.error);
      return;
    }
    accessToken = resp.access_token;
    const exp = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ t: resp.access_token, exp }));
    scheduleRefresh(exp);
    const silent = settleToken(null);
    // a silent renewal mid-session only swaps the token; everything is loaded
    if (!silent || state.mode !== 'google') bootGoogle();
  }

  function onTokenError(err) {
    settleToken(new Error((err && err.type) || 'token_error'));
  }

  async function bootGoogle() {
    state.mode = 'google';
    document.querySelector('#signin').hidden = true;
    document.querySelector('#banner').hidden = true;
    try {
      await loadCalendars();
      resetCache();
      await window.gcalEnsureYear(state.year);
    } catch (e) {
      // never end up with no data AND no way to sign in
      document.querySelector('#signin').hidden = false;
      const cached = JSON.parse(localStorage.getItem('almanakk-events') || 'null');
      if (cached && cached.length && !state.events.length) { state.events = cached; render(); }
      toastErr(e.message);
    }
  }

  async function api(path, params, opts = {}) {
    const url = new URL('https://www.googleapis.com/calendar/v3/' + path);
    for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, v);
    const r = await fetch(url, {
      ...opts,
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    });
    if (r.status === 401) {
      // token died mid-session: renew silently and retry once
      if (!opts._retried && CAN_SILENT) {
        try { await silentToken(); }
        catch (e) {
          accessToken = null;
          document.querySelector('#signin').hidden = false;
          throw new Error('Innlogging utløpt — logg inn igjen.');
        }
        return api(path, params, { ...opts, _retried: true });
      }
      accessToken = null;
      document.querySelector('#signin').hidden = false;
      throw new Error('Innlogging utløpt — logg inn igjen.');
    }
    if (!r.ok) {
      let msg = 'Google API-feil ' + r.status;
      try {
        const body = await r.json();
        if (body.error && body.error.message) msg = body.error.message;
        if (/gmail/i.test(msg)) msg = 'Denne hendelsen er laget automatisk fra Gmail — Google tillater ikke å endre tittelen. Slett den og legg inn din egen i stedet.';
      } catch (e) { /* keep the generic message */ }
      throw new Error(msg);
    }
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
      </div>`).join('') +
      `<div class="cal-build">bygg ${BUILD}</div>`;
    document.querySelector('#cal-list').onchange = async e => {
      if (e.target.classList.contains('tourtag')) {
        const ids = [...document.querySelectorAll('#cal-list .tourtag:checked')].map(i => i.dataset.id);
        localStorage.setItem('almanakk-tourcals', JSON.stringify(ids));
        if (window.updateChips) updateChips();
      } else if (e.target.classList.contains('showcal')) {
        const ids = [...document.querySelectorAll('#cal-list .showcal:checked')].map(i => i.dataset.id);
        localStorage.setItem(SEL_KEY, JSON.stringify(ids));
        resetCache();
        await window.gcalEnsureYear(state.year);
      } else if (e.target.type === 'radio') {
        localStorage.setItem(TARGET_KEY, e.target.dataset.id);
      }
    };
  }

  window.gcalEnsureYear = async function (year) {
    if (state.mode !== 'google' || loadedYears.has(year)) return;
    loadedYears.add(year);
    const gen = cacheGen;
    const mine = []; // collected here, never in the shared array, until we know we are still current
    const stale = () => gen !== cacheGen;
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
            // read the event's own wall-clock (Google sends dateTime in the
            // event's time zone) — a 10:00 Kobe rehearsal shows as 10:00
            start = end = ev.start.dateTime.slice(0, 10);
            time = ev.start.dateTime.slice(11, 16);
          }
          // eventType 'fromGmail' = auto-scraped from an email; may well be
          // someone else's flight (cc'd itinerary), so it never moves the city pin
          mine.push({ id: id + '/' + ev.id, gid: ev.id, calId: id, title: ev.summary || '(uten tittel)', start, end, time, color: EVENT_COLORS[ev.colorId] || byId[id].color, fromGmail: ev.eventType === 'fromGmail' });
        }
        pageToken = data.nextPageToken || '';
        if (stale()) return; // a newer tick superseded us mid-fetch: drop everything
      } while (pageToken);
      if (stale()) return;
    }
    if (stale()) return;
    // Belt and braces. The id is calendar + event id, so it is unique per event:
    // dropping repeats here means no future slip can put the same event on the
    // day twice, and a cache that already holds duplicates heals on next load.
    const seen = new Set();
    rawEvents = rawEvents.concat(mine).filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
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
    resetCache();
    await window.gcalEnsureYear(state.year);
  };

  // which calendar a new event will land in, so the day panel can say so
  window.gcalTarget = () => {
    const c = calendars.find(x => x.id === targetId());
    return c ? { name: c.name, color: c.color } : null;
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
    resetCache();
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
    resetCache();
    await window.gcalEnsureYear(state.year);
  };

  window.gcalUpdateEvent = async function (ev, title) {
    await api('calendars/' + encodeURIComponent(ev.calId) + '/events/' + encodeURIComponent(ev.gid), {}, {
      method: 'PATCH', body: JSON.stringify({ summary: title }),
    });
    resetCache();
    await window.gcalEnsureYear(state.year);
  };

  window.gcalDeleteEvent = async function (ev) {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(ev.calId) + '/events/' + encodeURIComponent(ev.gid));
    const r = await fetch(url, { method: 'DELETE', headers: { Authorization: 'Bearer ' + accessToken } });
    if (!r.ok && r.status !== 410) throw new Error('Kunne ikke slette (' + r.status + ')');
    resetCache();
    await window.gcalEnsureYear(state.year);
  };

  function toastErr(msg) {
    const t = document.querySelector('#toast');
    t.textContent = msg;
    t.hidden = false;
    setTimeout(() => { t.hidden = true; }, 4000);
  }
})();
