// Neutral sample data, only shown when config.js has no clientId (demo mode).
// Real data comes from Google Calendar after sign-in and never lives in this repo.
window.DEMO_CALENDARS = [
  { id: 'arbeid', name: 'Arbeid', color: '#1e40af' },
  { id: 'privat', name: 'Privat', color: '#15803d' },
  { id: 'turne', name: 'Turné', color: '#b45309' },
  { id: 'festival', name: 'Festival', color: '#0f766e' },
  // the call sheets: the week's and the day's, never the month's (v3)
  { id: 'schedule', name: 'wg | Schedule', color: '#b45309' },
];

// The month the sample data lives in — ?demo=1 opens here (0 = January).
window.DEMO_YEAR = 2026;
window.DEMO_MONTH = 1;

// t = title, s = start, e = end (inclusive; omitted = one day), c = calendar id
window.DEMO_EVENTS = [
  { c: 'arbeid', t: 'Fanny og Alexander', s: '2026-02-02', e: '2026-02-27' },
  { c: 'arbeid', t: 'Kongen av Bastøy', s: '2026-02-16', e: '2026-03-06' },
  { c: 'turne', t: 'ANTIGONE Paris', s: '2026-02-09', e: '2026-02-14', l: 'Paris' },
  // ...and its days, one word each, the way the touring robot writes them
  { c: 'turne', t: 'Travel', s: '2026-02-09' },
  { c: 'turne', t: 'Get in', s: '2026-02-10' },
  { c: 'turne', t: 'Work day', s: '2026-02-11' },
  { c: 'turne', t: 'Performance 1', s: '2026-02-12' },
  { c: 'turne', t: 'Performance 2', s: '2026-02-13' },
  { c: 'turne', t: 'Travel', s: '2026-02-14' },
  { c: 'turne', t: 'HOLD Available · ANTIGONE', s: '2026-02-23', e: '2026-02-26' },
  { c: 'schedule', t: 'Soundcheck', s: '2026-02-12', tm: '16:00' },
  { c: 'schedule', t: 'Call', s: '2026-02-12', tm: '18:00' },
  { c: 'schedule', t: 'Get out', s: '2026-02-13', tm: '22:30' },
  { c: 'arbeid', t: '14:00 Kostymeprøve', s: '2026-02-18' },
  { c: 'privat', t: '07:05 OSL–BGO', s: '2026-02-18' },
  { c: 'privat', t: 'Middag hos mor', s: '2026-02-20' },
  // a week of rows whose text runs under a band edge — the case the day line
  // is measured against (see alignLinesToBands in app.js)
  { c: 'festival', t: 'Festivaluke', s: '2026-02-23', e: '2026-02-28' },
  { c: 'privat', t: '09:15 OSL - CPH - BKK', s: '2026-02-23' },
  { c: 'arbeid', t: '14:00 Kostymeprøve', s: '2026-02-25' },
  { c: 'arbeid', t: '10:00 Produksjonsmøte Vildanden', s: '2026-02-26' },
  { c: 'privat', t: 'Middag hos mor', s: '2026-02-27' },
  // lone evenings, for the ?kveld=1 variant; and one day that has an evening
  // event but not alone, which must stay left
  { c: 'arbeid', t: '19:00 Forestilling', s: '2026-02-05' },
  { c: 'privat', t: '21:00 Kino', s: '2026-02-10' },
  { c: 'arbeid', t: '09:00 Morgenmøte', s: '2026-02-12' },
  { c: 'arbeid', t: '09:00 Prøve', s: '2026-02-17' },
  { c: 'arbeid', t: '19:00 Forestilling', s: '2026-02-17' },
  { c: 'privat', t: '20:30 Konsert', s: '2026-02-19' },
  { c: 'arbeid', t: '18:30 Middag med produsent', s: '2026-02-24' },
  // a tour day event, for the wg banner overlap
  { c: 'turne', t: '11:00 Modellmøte', s: '2026-02-11' },
  { c: 'turne', t: '10:00 Teknisk gjennomgang', s: '2026-02-09' },
  // filling the tour week up, to see what a crowded row does to a lone
  // evening event on the row below the banner (Alan, 12.09)
  { c: 'arbeid', t: '09:00 Befaring DNK', s: '2026-02-10' },
  { c: 'privat', t: '13:00 Tannlege', s: '2026-02-10' },
  { c: 'turne', t: '15:00 Innspilling', s: '2026-02-10' },
  { c: 'arbeid', t: 'Deadline søknad', s: '2026-02-12' },
  { c: 'turne', t: '09:30 Teknisk prøve', s: '2026-02-13' },
];
