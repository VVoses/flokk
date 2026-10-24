/* Flokk - journal.js
   A quiet field journal of firsts, kept across flights: the first elk at the forest edge, the first
   fieldfare flock, the aurora. Nothing is shown in play but one soft line when something new is seen.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const seenAnimal = k => () => ANIMALS.find(a => a.k === k && !a.hide && !a.dying && inView(a.x, a.y, -150));
const seenWild = sp => () => WILD.flocks.find(F => F.sp === sp && inView(F.x, F.y, -40));
const seenHawk = kind => () => hawks.find(h => h.kind === kind && inView(h.x, h.y, -150));

/* [key, name, what it is, seen-test] */
const JOURNAL = [
  ['elk', 'Elk', 'Elg. It stands at the forest edge at dusk and takes no notice of sparrows.', seenAnimal('moose')],
  [
    'deer',
    'Roe deer',
    'Rådyr. Light on its feet, it freezes in the field before it bolts for cover.',
    seenAnimal('deer')
  ],
  [
    'fox',
    'Fox',
    'Rev. Hunts the field edges and will take a sparrow that sits too long on the ground.',
    seenAnimal('fox')
  ],
  ['hare', 'Hare', 'Hare. Grey in summer, white in winter, and still as a stone until it runs.', seenAnimal('hare')],
  ['heron', 'Heron', 'Gråhegre. Waits on one leg by the shore; it has no interest in you.', seenAnimal('heron')],
  ['goose', 'Geese', 'Gjess. Pass over in long lines, calling, on their way somewhere else.', seenAnimal('goose')],
  ['gull', 'Gulls', 'Måker. Follow the plough and the fishing boats, loud and fearless.', seenAnimal('gull')],
  [
    'tractor',
    'Tractor',
    'Traktor. Turns the earth in spring and brings the crows and gulls in behind.',
    seenAnimal('tractor')
  ],
  [
    'starling',
    'Starlings',
    'Stær. Wheel over a field in hundreds, then drop to feed all at once.',
    seenWild('starling')
  ],
  [
    'linnet',
    'Linnets',
    'Tornirisk. Small and pink-breasted, they feed on seed heads in loose flocks.',
    seenWild('linnet')
  ],
  [
    'fieldfare',
    'Fieldfares',
    'Gråtrost. Winter thrushes from the north, loud over the stubble and the rowan.',
    seenWild('fieldfare')
  ],
  [
    'bunting',
    'Snow buntings',
    'Snøspurv. White flurries over the snow; they arrive when the real winter does.',
    seenWild('bunting')
  ],
  ['hawk', 'Hawk', 'Hauk. Hunts by day, and the whole field goes quiet before it strikes.', seenHawk('hawk')],
  ['owl', 'Owl', 'Ugle. Hunts by ear as much as by eye; a still bird in the dark is not safe.', seenHawk('owl')],
  ['eagle', 'White-tailed eagle', 'Havørn. Rare and enormous. Everything on the ground goes still.', seenHawk('eagle')],
  [
    'train',
    'Train',
    'Tog. The line runs through the parish; it honks at the crossing and does not slow.',
    () => TRAIN && TRAIN.cars.find(c => inView(c.x, c.y, -150))
  ],
  [
    'aurora',
    'Northern lights',
    'Nordlys. Green curtains on long dark nights, a gift to anyone still awake.',
    () => LIGHT.aurora > 0.5 && { sky: true }
  ],
  [
    'snow',
    'First snow',
    'Første snø. The land goes quiet and every bird shows against the white.',
    () => LIGHT.snow > 0.3
  ],
  ['fog', 'Fog', 'Tåke. Closes the view around the flock; the hawk sees no further than you do.', () => seeK() < 0.55],
  [
    'storm',
    'Winter storm',
    'Snøstorm. Driven snow and a cold that cuts through; only cover saves the flock.',
    () => WEATHER.storm > 0.6
  ],
  [
    'squall',
    'Summer thunderstorm',
    'Tordenbyge. A heavy shower with a hard wind in front; the open is no place to be.',
    () => WEATHER.squall > 0.5
  ]
];
const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
let JOURNAL_SEEN = {};
try {
  JOURNAL_SEEN = JSON.parse(localStorage.getItem('flokk-journal') || '{}');
} catch (e) {
  JOURNAL_SEEN = {};
}
let journalT = 0,
  journalShot = null;
const JOURNAL_PICS = {};
/* a snapshot of the moment, taken right after the frame that first showed it: the real game, cropped round
   the animal (or the middle of the view for weather), so the journal is the player's own photographs */
function journalCapture() {
  if (!journalShot) return;
  const { key, what } = journalShot;
  journalShot = null;
  try {
    // close on a single animal, wider for a flock, the whole view for weather
    const cw = Math.min(vw, vh * 1.6, typeof what.x !== 'number' ? 440 : what.members ? 340 : 240),
      ch = cw * 0.625;
    let sx = vw / 2,
      sy = vh / 2;
    if (what.sky) sy = ch / 2;
    else if (typeof what.x === 'number') {
      sx = vw / 2 + wdx(what.x, cam.x) * cam.z;
      sy = vh / 2 + (PY(what.y, what.z || 0) - cam.py - (what.z ? 0 : 10)) * cam.z; // figures stand up from their feet
    }
    const x0 = clamp(sx - cw / 2, 0, vw - cw),
      y0 = clamp(sy - ch / 2, 0, vh - ch),
      out = document.createElement('canvas');
    out.width = 400;
    out.height = 250;
    out.getContext('2d').drawImage(cv, x0 * dpr, y0 * dpr, cw * dpr, ch * dpr, 0, 0, 400, 250);
    const url = out.toDataURL('image/jpeg', 0.8);
    JOURNAL_PICS[key] = url;
    try {
      localStorage.setItem('flokk-journal-pic-' + key, url);
    } catch (e) {
      /* storage full or unavailable: the picture lasts for this visit only */
    }
  } catch (e) {
    /* a tainted or empty canvas: the entry just has no picture */
  }
}
function journalPic(key) {
  if (JOURNAL_PICS[key]) return JOURNAL_PICS[key];
  try {
    return (JOURNAL_PICS[key] = localStorage.getItem('flokk-journal-pic-' + key) || '');
  } catch (e) {
    return '';
  }
}
function journalTick(dt) {
  if (st.mode !== 'play' || !L) return;
  journalT -= dt;
  if (journalT > 0) return;
  journalT = 0.7;
  for (const [key, label, , test] of JOURNAL) {
    if (JOURNAL_SEEN[key] != null) continue;
    const what = test();
    if (!what) continue;
    JOURNAL_SEEN[key] = SEASON;
    journalShot = { key, what };
    try {
      localStorage.setItem('flokk-journal', JSON.stringify(JOURNAL_SEEN));
    } catch (e) {
      /* storage unavailable: it is only noted for this visit */
    }
    showHint(`in the journal: ${label.toLowerCase()}`);
    return; // one at a time
  }
}
let journalFocus = null;
function openJournal() {
  const grid = $('journalGrid'),
    { n, total } = journalText();
  grid.textContent = '';
  for (const [key, name, text] of JOURNAL) {
    const seen = JOURNAL_SEEN[key] != null,
      card = document.createElement('figure'),
      pic = document.createElement('div'),
      box = document.createElement('div'),
      url = seen && journalPic(key);
    card.className = 'journal-card' + (seen ? '' : ' unseen');
    pic.className = 'journal-pic';
    if (url) {
      pic.style.backgroundImage = `url(${url})`;
      pic.setAttribute('role', 'img');
      pic.setAttribute('aria-label', name);
    } else pic.textContent = seen ? '' : '?';
    box.innerHTML = seen
      ? `<h3>${name}<span>${SEASON_NAMES[JOURNAL_SEEN[key]]}</span></h3><p>${text}</p>`
      : '<h3>Not yet seen</h3><p>Keep flying.</p>';
    card.append(pic, box);
    grid.append(card);
  }
  $('journalCount').textContent = `${n} of ${total}`;
  journalFocus = document.activeElement;
  $('journalOv').hidden = false;
  syncMenuAccess();
  $('journalCloseBtn').focus({ preventScroll: true });
  $('journalOv').querySelector('.journal-panel').scrollTop = 0;
}
function closeJournal() {
  $('journalOv').hidden = true;
  syncMenuAccess();
  if (journalFocus?.isConnected && journalFocus.getClientRects().length) journalFocus.focus();
  else menuControls(activeMenu())[0]?.focus();
}
$('journalBtn').onclick = openJournal;
$('journalCloseBtn').onclick = closeJournal;

const poly = (g, pts, fill) => {
  g.fillStyle = fill;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
};
const oval = (g, x, y, rx, ry, fill, rot = 0) => {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fill();
};
const stroke = (g, pts, col, w) => {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
};
/* ---- the marked birds on the end cards: a stone with the day on it for each one lost, the bird on a post
   for each one that lived through ---- */
function markPicture(r) {
  const cv = document.createElement('canvas');
  cv.width = 168;
  cv.height = 200;
  const g = cv.getContext('2d'),
    m = MARKS[r.i];
  g.scale(2, 2);
  const c1 = m.c1 || '#54402C',
    c2 = m.c2 || '#7A6048',
    c3 = m.c3 || '#62574D',
    bird = (x, y, s) => {
      stroke(
        g,
        [
          [x - 2 * s, y],
          [x - 2 * s, y + 5 * s]
        ],
        '#8A6A4A',
        1.1
      );
      stroke(
        g,
        [
          [x + 2 * s, y],
          [x + 2 * s, y + 5 * s]
        ],
        '#8A6A4A',
        1.1
      );
      poly(
        g,
        [
          [x - 6 * s, y - 8 * s],
          [x - 15 * s, y - 4 * s],
          [x - 14 * s, y - 1 * s],
          [x - 5 * s, y - 4 * s]
        ],
        c1
      );
      oval(g, x, y - 6 * s, 8 * s, 5.5 * s, c2, -0.15);
      oval(g, x + 1.5 * s, y - 4 * s, 5 * s, 3 * s, '#BCA88C');
      oval(g, x - 2 * s, y - 8 * s, 6 * s, 3 * s, c1, -0.2);
      oval(g, x + 6 * s, y - 12 * s, 3.8 * s, 3.8 * s, c3);
      oval(g, x + 7.4 * s, y - 11 * s, 2 * s, 1.5 * s, '#CFC4B2');
      oval(g, x + 7.4 * s, y - 13 * s, 0.8 * s, 0.8 * s, '#111');
      poly(
        g,
        [
          [x + 9.5 * s, y - 12.5 * s],
          [x + 13 * s, y - 11.5 * s],
          [x + 9.5 * s, y - 10.5 * s]
        ],
        '#D8B25A'
      );
    };
  // dusk ground
  const sky = g.createLinearGradient(0, 0, 0, 100);
  sky.addColorStop(0, 'rgba(24,38,32,0)');
  sky.addColorStop(1, 'rgba(24,38,32,.55)');
  g.fillStyle = sky;
  g.fillRect(0, 0, 84, 100);
  if (r.fate) {
    // the stone
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.beginPath();
    g.ellipse(42, 90, 28, 5, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#8D928D';
    g.beginPath();
    g.moveTo(22, 90);
    g.lineTo(22, 52);
    g.arc(42, 52, 20, Math.PI, 0);
    g.lineTo(62, 90);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.beginPath();
    g.moveTo(22, 90);
    g.lineTo(22, 52);
    g.arc(42, 52, 20, Math.PI, Math.PI * 1.5);
    g.lineTo(42, 90);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(90,110,70,.55)';
    g.beginPath();
    g.ellipse(30, 89, 9, 3, 0, 0, TAU);
    g.ellipse(58, 89, 6, 2.4, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#4A4F4A';
    g.textAlign = 'center';
    g.font = '600 9px sans-serif';
    g.fillText('day', 42, 66);
    g.font = '600 20px sans-serif';
    g.fillText(String(r.day), 42, 84);
    stroke(
      g,
      [
        [34, 72],
        [50, 72]
      ],
      'rgba(74,79,74,.5)',
      0.8
    );
    bird(42, 36, 1.35);
    // grass
    for (let i = 0; i < 7; i++)
      stroke(
        g,
        [
          [10 + i * 11, 94],
          [8 + i * 11 + (i % 2) * 5, 88]
        ],
        '#5F7A45',
        1.2
      );
  } else {
    stroke(
      g,
      [
        [42, 94],
        [42, 58]
      ],
      '#6F5B40',
      4
    );
    stroke(
      g,
      [
        [26, 58],
        [58, 58]
      ],
      '#6F5B40',
      4
    );
    bird(42, 58, 1.35);
    for (let i = 0; i < 7; i++)
      stroke(
        g,
        [
          [10 + i * 11, 96],
          [8 + i * 11 + (i % 2) * 5, 90]
        ],
        '#5F7A45',
        1.2
      );
  }
  return cv;
}
function renderMarks(el) {
  el.textContent = '';
  for (const r of st.marks || []) {
    const fig = document.createElement('figure'),
      cap = document.createElement('figcaption');
    cap.textContent = MARKS[r.i].name;
    fig.setAttribute('aria-label', `${MARKS[r.i].name} ${r.fate ? `${r.fate}, day ${r.day}` : 'lived through'}`);
    fig.append(markPicture(r), cap);
    el.append(fig);
  }
}
function journalText() {
  const n = JOURNAL.filter(([k]) => JOURNAL_SEEN[k] != null).length;
  return { n, total: JOURNAL.length };
}
