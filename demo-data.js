// Neutral sample data, only shown when config.js has no clientId (demo mode).
// Real data comes from Google Calendar after sign-in and never lives in this repo.
window.DEMO_CALENDARS = [
  { id: 'arbeid', name: 'Arbeid', color: '#1e40af' },
  { id: 'privat', name: 'Privat', color: '#15803d' },
  { id: 'turne', name: 'Turné', color: '#b45309' },
];

// t = title, s = start, e = end (inclusive; omitted = one day), c = calendar id
window.DEMO_EVENTS = [
  { c: 'arbeid', t: 'Prosjekt A', s: '2026-02-02', e: '2026-02-27' },
  { c: 'arbeid', t: 'Prosjekt B', s: '2026-02-16', e: '2026-03-06' },
  { c: 'turne', t: 'Turné', s: '2026-02-09', e: '2026-02-14' },
  { c: 'arbeid', t: '14:00 Kostymeprøve', s: '2026-02-18' },
  { c: 'privat', t: '07:05 OSL–BGO', s: '2026-02-18' },
  { c: 'privat', t: 'Middag hos mor', s: '2026-02-20' },
];
