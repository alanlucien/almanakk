/* SWEEP — the almanakk checking itself, on Alan's own calendar.
 *
 * Loaded only for ?sweep=1. Walks every month of two years in every view, runs
 * the checks below, and prints the findings ON THE PAGE as plain text.
 *
 * WHY IT PRINTS TO THE SCREEN. The checks have always existed, but they ran in a
 * browser here against data I invented, and my invented February is not as dense
 * as his. So the numbers came up green and he opened the app and found a fault in
 * ten seconds. This runs against HIS calendar, on HIS device, behind his own
 * sign-in, and reports where I can read it — a screenshot of the simulator. It is
 * the difference between "the harness is clean" and "the sheet is right".
 *
 * Nothing here writes, fetches, or leaves the page.
 */
(function () {
  // FRESH ASSETS, OR THE REPORT IS ABOUT A BUILD THAT IS NO LONGER THERE. The
  // service worker caches the app by version, and Safari kept handing the sweep
  // the previous build's app.js after a deploy — so a run would carry the new
  // build's name in its header and the old build's behaviour in its numbers,
  // which is worse than no measurement at all. The sweep page drops the worker
  // and its caches, once, and reloads into the real thing.
  if (!sessionStorage.getItem('sweep-fresh')) {
    sessionStorage.setItem('sweep-fresh', '1');
    Promise.resolve()
      .then(() => navigator.serviceWorker
        ? navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister())))
        : null)
      .then(() => (window.caches ? caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))) : null))
      .catch(() => {})
      .then(() => location.reload());
    return;
  }
  const $ = s => document.querySelector(s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const num = n => String(n).padStart(3, ' ');

  // ---- measuring helpers ----------------------------------------------------
  // A label box is full width and its text is left-aligned, so the element's rect
  // says where the BAND ends, not where the WORD does. Every check asks for ink.
  // ...and CLIPPED to the box that holds it. A Range measures the text as if it
  // were laid out freely and knows nothing about overflow:hidden, so a name cut
  // to 34px reported 53px of ink — and namesTouch called a perfectly good seam a
  // collision. What is drawn is the intersection of the two.
  function ink(el) {
    const box = el.getBoundingClientRect();
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    if (!b.width) return box;
    const left = Math.max(b.left, box.left), right = Math.min(b.right, box.right);
    return { left, right, width: Math.max(0, right - left) };
  }
  const vis = els => [...els].filter(e => !e.hidden);

  // ---- the checks -----------------------------------------------------------
  // Each returns a short string when the day is at fault, else nothing. Keep the
  // strings tiny: the whole report has to be legible in one screenshot.
  const CHECKS = {
    // THE ONE ALAN FOUND BY EYE AND THE HARNESS NEVER COULD: a day that meant to
    // write N things, wrote fewer, and did not say so. 1, 4 and 12 May in the
    // year view. Silent loss is the worst fault this app can have.
    dropped(d, cv) {
      const meant = +(cv.dataset.line || 0);
      if (!meant) return;
      const det = d.querySelector('.detail');
      if (!det) return meant ? 'meant ' + meant + ' wrote 0' : undefined;
      const wrote = vis(det.querySelectorAll(':scope > .evt')).length;
      const more = det.querySelector('.more');
      const counted = more ? Math.abs(parseInt(more.textContent, 10) || 0) : 0;
      if (wrote + counted < meant) return 'meant ' + meant + ' wrote ' + wrote + ' +' + counted;
    },
    // two of his entries written over each other
    collide(d) {
      const ev = vis(d.querySelectorAll('.detail > *'));
      for (let i = 1; i < ev.length; i++) {
        if (ev[i - 1].getBoundingClientRect().right > ev[i].getBoundingClientRect().left + 1) return 'x' + i;
      }
    },
    // his writing over a run's name
    overName(d) {
      const ev = vis(d.querySelectorAll('.detail > *'));
      const labs = [...d.querySelectorAll('.band b')].filter(b => b.textContent.trim());
      for (const v of ev) {
        const vr = v.getBoundingClientRect();
        for (const l of labs) {
          const li = ink(l);
          if (vr.left < li.right - 1 && vr.right > li.left + 1) return '"' + l.textContent.slice(0, 10) + '"';
        }
      }
    },
    // two runs painted into each other
    bandsOverlap(d) {
      const b = [...d.querySelectorAll('.band')];
      for (let i = 1; i < b.length; i++) {
        if (b[i - 1].getBoundingClientRect().right > b[i].getBoundingClientRect().left + 1) return 'x' + i;
      }
    },
    // two productions printed as one title
    namesTouch(d) {
      const bands = [...d.querySelectorAll('.band')];
      for (const b of bands) {
        const lab = b.querySelector('b');
        if (!lab || !lab.textContent.trim()) continue;
        const right = ink(lab).right, bl = b.getBoundingClientRect().left;
        for (const o of bands) {
          if (o === b) continue;
          const or = o.getBoundingClientRect();
          if (or.left < bl + 1) continue;
          if (right > or.left - 5) return '"' + lab.textContent.slice(0, 8) + '"';
        }
      }
    },
    // drawn outside its own sheet, so text-overflow never fires and the cut
    // carries no ellipsis — the reader is not told anything is missing
    offSheet(d, cv) {
      const right = cv.getBoundingClientRect().right;
      for (const x of vis(d.querySelectorAll('.detail > *'))) {
        if (x.getBoundingClientRect().right > right + 1) return '"' + x.textContent.trim().slice(0, 10) + '"';
      }
    },
    // ALAN'S CORRECTION, 17.09: the red arrows on the right of his side-by-side
    // are not a collision. His events run so far right that the city and the week
    // number have nothing left to print in. The clipping costs him the info cell.
    infoLost(d) {
      const inf = d.querySelector('.info');
      if (!inf || !inf.textContent.trim()) return;
      if (inf.scrollWidth > inf.clientWidth + 1) return '"' + inf.textContent.trim().slice(0, 10) + '"';
    },
    // a run's name cut when it could have been broken or given room
    nameCut(d) {
      for (const l of d.querySelectorAll('.band b')) {
        if (l.scrollWidth <= l.clientWidth + 1) continue;
        if (l.dataset.tail) continue;                       // deliberate ellipsis
        if (!l.textContent.trim().includes(' ')) continue;  // one word, nothing to break
        return '"' + l.textContent.slice(0, 12) + '"';
      }
    },
    // whole stops of paper standing empty to the left of his first entry
    wasted(d, cv) {
      const det = d.querySelector('.detail');
      if (!det) return;
      const ev = vis(det.children).filter(x => !x.classList.contains('more'));
      if (!ev.length) return;
      const cr = cv.getBoundingClientRect();
      let wordRight = 0;
      d.querySelectorAll('.band b').forEach(b => {
        if (b.textContent.trim()) wordRight = Math.max(wordRight, ink(b).right - cr.left);
      });
      const stop = (laneBox.cw || cr.width) / (laneBox.stops || 3);
      const free = (ev[0].getBoundingClientRect().left - cr.left) - Math.max(0, wordRight);
      const n = free >= stop - 2 ? Math.floor(free / stop) : 0;
      if (n) return n + ' stop' + (n > 1 ? 's' : '');
    },
  };

  // ---- the walk -------------------------------------------------------------
  // A MEASUREMENT THAT DISAGREES WITH ITSELF IS NOT A MEASUREMENT. The same build
  // reported 28 findings and then 99 (17.09). Two causes, both about not waiting:
  // the web font had not finished loading, so every width in the app was measured
  // against a fallback face; and Alan's calendars arrive one HTTP response at a
  // time, so an early run swept a half-empty year. Both are settled before the
  // first scan, and each sheet is given two frames and a beat to lay out.
  // ...raced against a timer, because requestAnimationFrame never fires in a
  // hidden tab and the walk simply stopped at January when the pane was not on
  // screen. A frame if there is one, a beat if there is not.
  const frame = () => Promise.race([
    new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    wait(80),
  ]);
  // AND THE SHEET IS ONLY READY WHEN IT STOPS CHANGING. Alan's calendars are
  // fetched for the range in view, so moving to a new month starts new requests
  // and the first paint of that month can be of a half-empty sheet — which is why
  // one run said 28 and the next 99. Rather than guess a delay, render until two
  // consecutive paints produce the same markup, then scan.
  async function paint(n) {
    let prev = '';
    for (let i = 0; i < Math.max(n || 2, 14); i++) {
      render();
      await frame();
      await wait(110);
      const app = $('#app');
      const now = app ? app.innerHTML.length + ':' + (state.events || []).length : '';
      if (i >= (n || 2) - 1 && now === prev) return;
      prev = now;
    }
  }
  async function settled() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    let last = -1, still = 0;
    for (let i = 0; i < 150; i++) {           // up to 30s
      const n = (state.events || []).length;
      still = (n === last && n > 0) ? still + 1 : 0;
      if (still >= 5) return n;               // unchanged for a second
      last = n;
      await wait(200);
    }
    return last;
  }

  // One finding per (fault, day, sheet width). A quarter shows the same month in
  // three renders and the sweep looks at all three columns, so the raw list has
  // every fault three times over — and the WIDTH is the thing worth keeping,
  // because a fault that only appears in the narrow column is the interesting one.
  function scan(root, view, tally, rows, seen) {
    root.querySelectorAll('.day[data-date]').forEach(d => {
      const cv = d.querySelector('.canvas');
      if (!cv) return;
      const label = view + Math.round(cv.getBoundingClientRect().width);
      for (const [name, fn] of Object.entries(CHECKS)) {
        let why;
        try { why = fn(d, cv); } catch (e) { why = 'ERR'; }
        if (!why) continue;
        const key = name + d.dataset.date + label + why;
        if (seen.has(key)) continue;
        seen.add(key);
        tally[name] = (tally[name] || 0) + 1;
        rows.push([name, d.dataset.date, label, why]);
      }
    });
  }

  // ---- the probe -------------------------------------------------------------
  // ?sweep=1&probe=2026-10-08 — one day, every measurement, in both views. The
  // sweep says WHICH day is wrong; on live data, where there is no console to
  // reach, this is the only way to find out WHY. Same reason the report prints to
  // the page: the answer has to survive a screenshot.
  async function probe(ds) {
    const y = +ds.slice(0, 4), m = +ds.slice(5, 7) - 1;
    const out = [];
    for (const view of ['month', 'year']) {
      state.view = view; state.year = y; state.month = m;
      await paint(3);
      // AND WAIT FOR THAT DAY'S OWN DATA. Alan's calendars are fetched for the
      // range in view, so the first paint of a month can be of an empty sheet —
      // and an empty sheet settles instantly, so "two identical paints" is
      // satisfied by a day that has not arrived yet. The probe then reports no
      // bands and no entries, which reads exactly like a day with none. Wait for
      // the events themselves, then paint again.
      for (let k = 0; k < 20; k++) {
        const has = (state.events || []).some(e => e.start <= ds && e.end >= ds);
        if (has) break;
        await wait(300);
      }
      await paint(3);
      document.querySelectorAll(`.day[data-date="${ds}"]`).forEach(d => {
        const cv = d.querySelector('.canvas');
        if (!cv) return;
        const cr = cv.getBoundingClientRect();
        const at = r => Math.round(r.left - cr.left) + '\u2192' + Math.round(r.right - cr.left);
        out.push(view.toUpperCase() + '  canvas ' + Math.round(cr.width) +
          '   stops ' + (laneBox.stops || '?') + ' x ' + Math.round((laneBox.cw || 0) / (laneBox.stops || 3)) +
          '   cw ' + Math.round(laneBox.cw || 0) + '/' + Math.round(laneBox.cwMax || 0) +
          '   meant ' + (cv.dataset.line || 0));
        const det = d.querySelector('.detail');
        out.push('    detail  [' + (det ? det.className : '-') + ']  ' + (det ? det.getAttribute('style') || '' : ''));
        const L = window.__lanes;
        if (L) {
          out.push('    lanes   model=' + L.model + '  room=' + L.roomEm + '  MIN_LINE=' + L.MIN_LINE +
            '  own=' + L.nOwn + ' ovl=' + L.nOvl);
          L.lanes.forEach(l => out.push('      #' + l.i + ' left ' + l.left + '  em ' + l.em +
            '  w ' + l.w + '  nat ' + l.nat + '  full ' + l.full));
        }
        d.querySelectorAll('.band').forEach((b, i) => {
          const lab = b.querySelector('b');
          const why = (window.__bandWhy || {})[ds + '#' + i];
          out.push('    band  ' + at(b.getBoundingClientRect()) +
            (lab && lab.textContent.trim() ? '  "' + lab.textContent + '" ink ' + at(ink(lab)) : '  (silent)') +
            (why ? '   ' + why : ''));
        });
        (det ? [...det.children] : []).forEach(x => {
          out.push('    ' + (x.hidden ? 'HID ' : '') + x.className.trim() + '  ' + at(x.getBoundingClientRect()) +
            '  "' + x.textContent.trim().slice(0, 22) + '"  ' + (x.getAttribute('style') || ''));
        });
      });
    }
    document.body.innerHTML = '<pre style="font:13px/1.45 ui-monospace,Menlo,monospace;padding:14px;' +
      'white-space:pre;color:#111;background:#fff;margin:0">' +
      ('PROBE ' + ds + '   build ' + (typeof BUILD !== 'undefined' ? BUILD : '?') +
        '   ' + (state.mode === 'google' ? 'LIVE' : 'DEMO') +
        '   ' + (state.events || []).length + ' events   ' +
        (state.events || []).filter(e => e.start <= ds && e.end >= ds).length + ' on this day' +
        '\n\n' + out.join('\n'))
        .replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</pre>';
  }

  async function run() {
    await settled();
    // measureLane samples the type off a real band, so it has to be re-taken once
    // the real font is in — otherwise every em in the app is a fallback's em
    render(); await frame(); measureLane(); await paint(2);
    const one = (location.search.match(/[?&]probe=(\d{4}-\d{2}-\d{2})/) || [])[1];
    if (one) return probe(one);
    const tally = {}, rows = [], seen = new Set();
    const y0 = state.year;
    const years = [y0, y0 + 1];
    for (const y of years) {
      for (let m = 0; m < 12; m++) {
        state.view = 'month'; state.year = y; state.month = m;
        await paint();
        // EVERY sheet on the page, not one. In a quarter the columns are different
        // widths and the narrow one is the sheet Alan reads on his desk; sampling
        // a third of them is how two collisions survived twelve months of sweeping.
        const sheets = [...document.querySelectorAll('.qmonth')];
        (sheets.length ? sheets : [$('#app')]).forEach(sh => scan(sh, 'M', tally, rows, seen));
      }
      state.view = 'year'; state.year = y;
      await paint(3);
      scan($('#app'), 'Y', tally, rows, seen);
    }
    state.view = 'month'; state.year = y0; state.month = new Date().getMonth();
    // counted at the END: the app fetches as it goes, so the number at the start
    // is the number it happened to have then
    window.__sweepEvents = (state.events || []).length;
    report(tally, rows, years);
  }

  // ---- the report -----------------------------------------------------------
  // Read off a screenshot, so: monospace, big enough, worst first, and paginated
  // rather than scrolled — a screenshot only ever shows the top of a page.
  function report(tally, rows, years) {
    const page = +((location.search.match(/[?&]page=(\d+)/) || [])[1] || 1);
    const PER = 26;
    const order = Object.keys(CHECKS);
    rows.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]) || a[1].localeCompare(b[1]));
    const total = rows.length;
    const head = [
      'SWEEP  build ' + (typeof BUILD !== 'undefined' ? BUILD : '?') +
        '   ' + years.join('+') + '   ' + innerWidth + 'x' + innerHeight +
        '   ' + (window.__sweepEvents || '?') + ' events' +
        ((location.search.match(/[?&]stops=(\d+)/) || [])[1] ? '   stops=' + RegExp.$1 : '') + '   ' +
        // WHICH DATA DID IT SWEEP? When the Google fetch fails the app falls back
        // to the sample sheet without saying so, and two runs of the same build
        // then disagree because one saw 25 demo events and the other saw a live
        // year. A measurement that cannot name its input is not one.
        (state.mode === 'google' ? 'LIVE' : '*** DEMO DATA, NOT LIVE ***'),
      '',
    ];
    // split by view: a fault only in the year is a different job from one in the
    // month, and the summary is the only part of the report that always fits
    const byView = {};
    rows.forEach(r => {
      const v = r[2][0];
      (byView[r[0]] = byView[r[0]] || {})[v] = (byView[r[0]][v] || 0) + 1;
    });
    for (const k of order) {
      const b = byView[k] || {};
      const split = (b.M || b.Y) ? '   month ' + num(b.M || 0) + '   year ' + num(b.Y || 0) : '';
      head.push('  ' + num(tally[k] || 0) + '  ' + k.padEnd(14) + split);
    }
    head.push('', '  ' + num(total) + '  TOTAL' + (total ? '' : '   — clean'), '');
    const slice = rows.slice((page - 1) * PER, page * PER);
    const body = slice.map(r => '  ' + r[1] + ' ' + r[2].padEnd(5) + r[0].padEnd(13) + r[3]);
    const pages = Math.max(1, Math.ceil(total / PER));
    body.push('', '  page ' + page + '/' + pages + (page < pages ? '   —  &page=' + (page + 1) : ''));
    document.body.innerHTML =
      '<pre style="font:13px/1.45 ui-monospace,Menlo,monospace;padding:14px;' +
      'white-space:pre;color:#111;background:#fff;margin:0">' +
      (head.concat(body).join('\n').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))) +
      '</pre>';
  }

  run();
})();
