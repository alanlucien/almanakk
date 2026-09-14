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
  const $ = s => document.querySelector(s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const num = n => String(n).padStart(3, ' ');

  // ---- measuring helpers ----------------------------------------------------
  // A label box is full width and its text is left-aligned, so the element's rect
  // says where the BAND ends, not where the WORD does. Every check asks for ink.
  function ink(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const b = r.getBoundingClientRect();
    return b.width ? b : el.getBoundingClientRect();
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
  async function paint(n) { for (let i = 0; i < (n || 2); i++) { render(); await wait(90); } }

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

  async function run() {
    for (let i = 0; i < 100 && !(state.events && state.events.length); i++) await wait(200);
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
        '   ' + years.join('+') + '   ' + innerWidth + 'x' + innerHeight,
      '',
    ];
    for (const k of order) head.push('  ' + num(tally[k] || 0) + '  ' + k);
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
