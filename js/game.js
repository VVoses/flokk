/* Flokk - game.js
   Game state, energy, insects, perch assignment, input, UI overlays, particles.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- game state ---------- */
const newSeed = () => (Math.random() * 1e9) >>> 0;
const PAL = [
  ['#54402C', '#7A6048', '#62574D'],
  ['#4B3B2D', '#735A43', '#5E534A'],
  ['#5A4430', '#846A4F', '#6A5E52'],
  ['#3F3833', '#5F554C', '#4D4640']
];
function newBird(x, y) {
  const p = pickP(PAL);
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    z: FZ,
    fz: FZ,
    s: 8.5,
    state: 'fly',
    perch: null,
    heading: rr(0, TAU),
    flap: rr(0, TAU),
    flapping: true,
    fbT: rr(0, 1),
    ph: rr(0, 100),
    oa: rr(0, TAU),
    or: Math.sqrt(Math.random()),
    ospin: rr(0.15, 0.5) * (Math.random() < 0.5 ? -1 : 1),
    panic: 0,
    landCool: 0,
    delay: 0,
    idle: 1,
    peck: 0,
    hx: 0,
    hy: 0,
    c1: p[0],
    c2: p[1],
    c3: p[2]
  };
}
let birds = [],
  L = null,
  hawks = [],
  swarms = [],
  dflies = [],
  parts = [],
  tmpSpots = [];
const st = {
  mode: 'title',
  grace: 0,
  food: 0,
  eaten: 0,
  lost: 0,
  maxFlock: 0,
  day0: 0,
  play: 0,
  stamina: 1,
  dashT: 0,
  settled: false,
  stillT: 0,
  settleCool: 0,
  hawkT: 0,
  grounded: 0,
  joins: 0,
  overT: -1
};
const cam = { x: 2500, py: 1400 * TILT, z: 1 };

let T = 0;
const demo = { tx: 0, ty: 0, rest: 0 };
let V = { x0: 0, x1: 0, py0: 0, py1: 0 };

/* the world repeats every W east-west. When the flock drifts past a seam, everything that travels with it
   (birds, hawks, particles, the camera) moves back by one period; the land looks identical there, so nothing jumps. */
let WX = 0;
const PX = p => (cam.x + WX) * p - WX; // parallax offset that stays continuous across recentring
function worldShift(d) {
  for (const b of birds) {
    b.x += d;
    const p = b.perch;
    if (!p || tmpSpots.includes(p)) continue;
    let q = null;
    if (p.orig && Math.abs(p.orig.x - (p.x + d)) < 1) q = p.orig;
    else if (p.gh && p.gh !== p && Math.abs(p.gh.x - (p.x + d)) < 1) q = p.gh;
    if (q) b.perch = q;
    else launch(b);
  }
  for (const sp of tmpSpots) sp.x += d;
  for (const h of hawks) {
    h.x += d;
    h.tcx += d;
    if (h.prey) h.prey.x += d;
  }
  for (const q of parts) q.x += d;
  for (const a of ANIMALS)
    if (a.k === 'goose' || a.k === 'rook') a.x += d;
    else if (a.wild) {
      a.x += d;
      a.gx += d;
      a.tx += d;
    }
  wildShift(d);
  cam.x += d;
  WX -= d;
  demo.tx += d;
}
function resetWorld(n, x, y) {
  for (const p of perches) p.occ = null;
  tmpSpots = [];
  birds = [];
  for (let i = 0; i < n; i++) birds.push(newBird(x + rr(-40, 40), y + rr(-40, 40)));
  L = birds[0];
  hawks = [];
  parts = [];
  st.settled = false;
  st.stillT = 0;
}
// the cost of the next bird rises faster than the flock does, so a big flock keeps growing but ever more slowly
// and cannot simply outnumber every hawk
function needFor(n) {
  return 4 + Math.floor(n / 5) + Math.floor((n * n) / 400);
}
// spends banked food into a new bird, but only once the flock has some health to spare: a flock
// already running on empty doesn't have young to spare either, so banked food waits rather than
// growing the flock into more mouths it can't yet feed (a bigger flock needs proportionally more
// food per feeding, via feed()'s split below - growing on top of that only deepens the hole)
function tryGrow() {
  if (st.energy <= 0.5) return;
  let need = needFor(birds.length);
  while (st.food >= need) {
    st.food -= need;
    joinBird();
    need = needFor(birds.length);
  }
}

/* ---------- insects ---------- */
// the flock can't fly out past the shoreline (see update.js), so keep swarms where it can still reach them
const insectMaxY = x => shoreY(x) - 10;
function randomSpot() {
  for (let i = 0; i < 30; i++) {
    const u = Math.random();
    let x, y;
    if (u < 0.45) {
      const a = rr(0, TAU),
        d = lakeR(a) + rr(-60, 220);
      x = LAKE.x + Math.cos(a) * d;
      y = LAKE.y + Math.sin(a) * d;
    } else if (u < 0.8) {
      const f = pickP(FIELDS);
      x = rr(f.x, f.x + f.w);
      y = rr(f.y, f.y + f.h);
    } else {
      x = rr(100, W - 100);
      y = rr(100, H - 100);
    }
    if (x < 60 || y < 60 || x > W - 60 || y > insectMaxY(x)) continue;
    return [x, y];
  }
  const x = rr(200, W - 200);
  return [x, Math.min(rr(200, H - 200), insectMaxY(x))];
}
function inView(x, y, m) {
  if (!V) return false;
  const cx = (V.x0 + V.x1) / 2;
  return Math.abs(wdx(x, cx)) < (V.x1 - V.x0) / 2 + m && y * TILT > V.py0 - m && y * TILT < V.py1 + m;
}
// every insect is its own little flier: it keeps picking a new point near the swarm's heart and darts
// for it, so a cloud never holds still. Midges dance up and down in a loose column; the odd hoverfly
// hangs dead still, then zips somewhere else; moths reel in untidy loops around the lamp.
function mkMote(kind, r) {
  return {
    kind,
    r,
    ph: rr(0, TAU),
    ox: rr(-r, r),
    oy: rr(-r, r) * 0.7,
    oh: rr(-12, 12),
    vx: 0,
    vy: 0,
    vh: 0,
    tx: 0,
    ty: 0,
    th: 0,
    t: 0
  };
}
function spawnSwarm(allowView) {
  for (let k = 0; k < 8; k++) {
    const [x, y] = randomSpot();
    if (!allowView && inView(x, y, 80)) continue;
    // mostly midges; a few hoverflies about the flowers of spring and summer, and flies in autumn
    const fly = Math.random() < [0.15, 0.25, 0.3, 0][SEASON];
    const n = rr(5, 11) | 0,
      m = [];
    for (let i = 0; i < n; i++) m.push(mkMote(fly ? 'fly' : 'midge', fly ? rr(10, 26) : rr(4, 18)));
    swarms.push({ x, y, vx: rr(-8, 8), vy: rr(-8, 8), z: rr(1.7, 2.3), m });
    return;
  }
}
function stepMote(s, m, dt, lean) {
  m.t -= dt;
  let vmax, snap;
  if (m.kind === 'midge') {
    // short jinks, mostly up and down: the column breathes as the whole cloud rises and sinks
    if (m.t <= 0) {
      m.t = rr(0.12, 0.45);
      const a = rr(0, TAU),
        d = m.r * Math.sqrt(Math.random());
      m.tx = Math.cos(a) * d;
      m.ty = Math.sin(a) * d * 0.7;
      m.th = rr(-16, 16) + Math.sin(T * 0.7 + s.z * 9) * 6;
    }
    vmax = 55;
    snap = 9;
  } else if (m.kind === 'fly') {
    // a hoverfly: hang still (a tremble), then a sudden dart to somewhere new
    if (m.t <= 0) {
      m.dart = Math.random() < 0.55;
      m.t = m.dart ? rr(0.15, 0.3) : rr(0.5, 1.8);
      if (m.dart) {
        const a = rr(0, TAU),
          d = m.r * rr(0.4, 1);
        m.tx = Math.cos(a) * d;
        m.ty = Math.sin(a) * d * 0.7;
        m.th = rr(-14, 14);
      } else {
        m.tx = m.ox;
        m.ty = m.oy;
        m.th = m.oh;
      }
    }
    vmax = m.dart ? 190 : 6;
    snap = m.dart ? 14 : 20;
  } else {
    // a moth: wide, clumsy loops round the light, bumping back in whenever it strays
    if (m.t <= 0) {
      m.t = rr(0.2, 0.6);
      const a = Math.atan2(m.oy, m.ox) + rr(0.6, 2.2) * (m.ph > Math.PI ? 1 : -1),
        d = m.r * rr(0.5, 1.2);
      m.tx = Math.cos(a) * d;
      m.ty = Math.sin(a) * d * 0.7;
      m.th = rr(-18, 22);
    }
    vmax = 75;
    snap = 5;
  }
  const dx = m.tx + lean - m.ox,
    dy = m.ty - m.oy,
    dh = m.th - m.oh;
  const d = Math.hypot(dx, dy, dh),
    sp = Math.min(vmax, d * 6) / Math.max(d, 1e-3),
    k = Math.min(1, dt * snap);
  m.vx += (dx * sp - m.vx) * k;
  m.vy += (dy * sp - m.vy) * k;
  m.vh += (dh * sp - m.vh) * k;
  m.ox += m.vx * dt;
  m.oy += m.vy * dt;
  m.oh += m.vh * dt;
}
function stepSwarm(s, dt) {
  // the breeze streams a cloud out downwind, the flies high in the column furthest
  const lean = s.moth ? 0 : windAt(s.x, s.y) * 10 * WIND.x;
  for (const m of s.m) stepMote(s, m, dt, lean * (1 + m.oh / 30));
}
function spawnDfly() {
  const inL = Math.random() < 0.8,
    c = inL ? LAKE : POND,
    rf = inL ? lakeR : pondR;
  const a = rr(0, TAU),
    r = rf(a) + rr(-50, 30);
  const x = c.x + Math.cos(a) * r,
    y = c.y + Math.sin(a) * r;
  dflies.push({
    x,
    y,
    tx: x,
    ty: y,
    c,
    rf,
    t: 0,
    h: rr(0, TAU),
    z: rr(1.2, 1.8),
    col: Math.random() < 0.5 ? '#3E9BB0' : '#6FA23F'
  });
}
const motePos = (s, m) => [s.x + m.ox, s.y + m.oy, s.z + m.oh / HZ + Math.sin(T * 2.1 + m.ph) * 0.08];

/* ---------- perch assignment ---------- */
function validGround(x, y) {
  if (y < 30 || y > H - 30) return false;
  if (inWater(x, y, 8) || inBuild(x, y, 10) || underTree(x, y)) return false;
  for (const s of tmpSpots) if ((s.x - x) ** 2 + (s.y - y) ** 2 < 121) return false;
  return true;
}
function groundSpot(cx, cy, R0) {
  for (const Rk of [R0, R0 * 1.6]) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * TAU,
        r = Math.sqrt(Math.random()) * Rk;
      const x = cx + Math.cos(a) * r,
        y = cy + Math.sin(a) * r;
      if (validGround(x, y)) {
        const p = { x, y, h: 0, type: fieldAt(x, y) ? 'field' : 'ground', cover: false, occ: null, ang: null, key: y };
        tmpSpots.push(p);
        return p;
      }
    }
  }
  return null;
}
// wantCover: the flock is hiding in trees, so a sheltered perch is worth a longer hop than a bare one
function freePerch(b, cx, cy, R0, wantCover = false) {
  let best = null,
    bs = 1e9;
  for (const p of perchesNear(cx, cy, R0)) {
    if (p.occ || p.off) continue;
    const s =
      Math.hypot(p.x - cx, p.y - cy) + 0.35 * Math.hypot(p.x - b.x, p.y - b.y) + (wantCover && !p.cover ? 180 : 0);
    if (s < bs) {
      bs = s;
      best = p;
    }
  }
  return best;
}
function assign(b) {
  const lp = L.perch;
  if (!lp) return false;
  const gm = lp.type === 'ground' || lp.type === 'field';
  let p = null;
  const gr = 25 + 9 * Math.sqrt(tmpSpots.length + 1);
  if (gm) p = groundSpot(lp.x, lp.y, gr) || freePerch(b, lp.x, lp.y, 380);
  else p = freePerch(b, lp.x, lp.y, 380, lp.cover) || groundSpot(lp.x, lp.y, gr);
  if (p) {
    p.occ = b;
    b.perch = p;
    b.state = 'land';
    return true;
  }
  b.landCool = 1.2;
  return false;
}
function settle() {
  if (st.settleCool > 0) return;
  // the nearest free perch, but a sheltered one a little further off wins over a bare one close by
  // (in winter a leafless birch next to a spruce hides nothing)
  let best = null,
    bd = 1e9;
  for (const p of perchesNear(L.x, L.y, 150)) {
    if (p.occ || p.off) continue;
    const d = Math.hypot(p.x - L.x, p.y - L.y);
    if (d > 90 && !p.cover) continue;
    const s = d + (p.cover ? 0 : 70);
    if (s < bd) {
      bd = s;
      best = p;
    }
  }
  const lp = best || groundSpot(L.x, L.y, 50) || freePerch(L, L.x, L.y, 260);
  if (!lp) {
    st.settleCool = 1;
    return;
  }
  lp.occ = L;
  L.perch = lp;
  L.state = 'land';
  st.settled = true;
  const others = birds.filter(b => b !== L && b.state === 'fly' && b.panic <= 0).sort((a, b) => d2(a, L) - d2(b, L));
  for (const b of others) if (d2(b, L) < 520 * 520) assign(b);
  flutter(birds.length);
}
function launch(b) {
  if (b.perch && b.perch.occ === b) b.perch.occ = null;
  b.perch = null;
  b.x += b.hx;
  b.y += b.hy;
  b.hx = b.hy = 0;
  b.state = 'fly';
  const a = b.heading + rr(-0.7, 0.7);
  b.vx = Math.cos(a) * 130;
  b.vy = Math.sin(a) * 130;
  b.flapping = true;
  b.fbT = 0.6;
}
function takeoffAll() {
  st.settled = false;
  st.stillT = 0;
  let n = 0;
  for (const b of birds) {
    if (b.state === 'land' || b.state === 'perch') {
      if (b.perch && b.perch.occ === b) b.perch.occ = null;
      if (b.state === 'land') {
        b.perch = null;
        b.state = 'fly';
        continue;
      }
      b.state = 'takeoff';
      b.delay = b === L ? 0 : rr(0.02, 0.42);
      n++;
    }
  }
  tmpSpots = tmpSpots.filter(s => s.occ);
  if (n) flutter(n);
}
const coveredNow = b =>
  !!(
    b.perch &&
    b.perch.cover &&
    (b.state === 'perch' ||
      b.state === 'takeoff' ||
      (b.state === 'land' && Math.hypot(b.x - b.perch.x, b.y - b.perch.y) < 40))
  );
// a newcomer still flying in to join the flock is safe from predators until it reaches the others
const exposed = b => !coveredNow(b) && !b.joining;

/* ---------- input ---------- */
const keys = {};
const pointer = { down: false, x: 0, y: 0, id: null };
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && st.mode === 'play')
    e.preventDefault();
  keys[e.code] = true;
  if ((e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) dash();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
    if (!$('newFlightOv').hidden) closeNewFlightConfirm();
    else if (st.mode === 'play') pause();
    else if (st.mode === 'pause') resume();
  }
});
addEventListener('keyup', e => {
  keys[e.code] = false;
});
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  pointer.down = false;
});
cv.addEventListener('pointerdown', e => {
  if (st.mode !== 'play') return;
  initAudio();
  pointer.down = true;
  pointer.id = e.pointerId;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  try {
    cv.setPointerCapture(e.pointerId);
  } catch (_) {
    /* capture is a nicety */
  }
});
cv.addEventListener('pointermove', e => {
  if (pointer.id === e.pointerId || e.pointerType === 'mouse') {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }
});
// idle mouse: while playing, hide the crosshair over the canvas after a few still seconds; any
// movement or press brings it straight back. Title, pause, game-over and the HUD keep theirs.
let cursorIdleAt = performance.now();
function wakeCursor() {
  cursorIdleAt = performance.now();
  cv.classList.remove('cursor-idle');
}
window.addEventListener('pointermove', e => e.pointerType === 'mouse' && wakeCursor());
window.addEventListener('pointerdown', e => e.pointerType === 'mouse' && wakeCursor());
setInterval(() => {
  const idle = st.mode === 'play' && performance.now() - cursorIdleAt > 2500;
  cv.classList.toggle('cursor-idle', idle);
}, 250);
const up = e => {
  if (e.pointerId === pointer.id) {
    pointer.down = false;
    pointer.id = null;
  }
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('contextmenu', e => e.preventDefault());
function dash() {
  if (st.mode !== 'play') return;
  if (st.stamina >= 0.34 && st.dashT <= 0) {
    st.stamina -= 0.34;
    st.dashT = 0.6;
    flutter(birds.length * 0.6);
    // dashing while a hawk is bearing down is a real dodge, not just a burst of speed: a hard
    // sideways jink across its line of attack, the way a sparrow actually ducks a stoop
    const diver = hawks.find(h => h.state === 'dive' && h.target === L);
    if (diver) {
      const dx = L.x - diver.x,
        dy = L.y - diver.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < 180) {
        const px = -dy / d,
          py = dx / d,
          side = L.vx * px + L.vy * py >= 0 ? 1 : -1;
        L.vx += px * side * 260;
        L.vy += py * side * 260;
      }
    }
  }
}
const coarse = matchMedia('(pointer:coarse)').matches;
const dashBtn = document.getElementById('dashBtn');
if (coarse)
  document.getElementById('keysTxt').textContent = 'hold where you want to fly · lift your finger to land · › to dash';
dashBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  dash();
});
/* the pointer aims at the flock's flying altitude, so you point where you see the birds */
const screenToWorld = (sx, sy, h = FZ) => ({
  x: cam.x + (sx - vw / 2) / cam.z,
  y: (cam.py + (sy - vh / 2) / cam.z + h * HZ) / TILT
});

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const ui = { count: $('count'), foodBar: $('foodBar'), stBar: $('stBar'), enBar: $('enBar') };
/* high scores, kept on this device: the largest flock ever gathered and the most days ever lived
   through (the flock key predates the days one, so older saves keep their best) */
const BEST_KEYS = { flock: 'flokk-best', days: 'flokk-best-days' };
function getBest(k = 'flock') {
  try {
    return +(localStorage.getItem(BEST_KEYS[k]) || 0);
  } catch (e) {
    return 0;
  }
}
function setBest(k, v) {
  try {
    localStorage.setItem(BEST_KEYS[k], String(v));
  } catch (e) {
    /* storage unavailable: best score just isn't kept */
  }
}
// days this flight has lived through: a whole year per year won, else the days since take-off
function daysFlown(won) {
  return won ? YEAR_DAYS * CAL.year : CAL.day - st.day0 + 1;
}
// store any new best for this run; returns the bests as they stood before it, to compare against
function recordBest(won) {
  const run = { flock: st.maxFlock, days: daysFlown(won) },
    prev = {};
  for (const k in BEST_KEYS) {
    prev[k] = getBest(k);
    if (run[k] > prev[k]) setBest(k, run[k]);
  }
  return { run, prev };
}
/* ---------- learning by doing: a first-time-only line, taught by the world at the moment
   a mechanic first matters (a hawk's first pass, hunger, the first dark night), never up front
   and never twice. No separate tutorial: the same short lowercase banner the seasons use. */
let LEARN = {};
try {
  LEARN = JSON.parse(localStorage.getItem('flokk-learn') || '{}');
} catch (e) {
  LEARN = {};
}
function teach(key, text) {
  if (LEARN[key]) return;
  LEARN[key] = 1;
  try {
    localStorage.setItem('flokk-learn', JSON.stringify(LEARN));
  } catch (e) {
    /* storage unavailable: the hint just runs every time */
  }
  const el = $('hintEl');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
/* the plain first-minute goal: stays up (not a once-only flash) until the flock's first real meal,
   and at least a few seconds so it can be read; never shown again once that meal has been learned */
function goalLine() {
  const el = $('goalEl');
  if (!el) return;
  if (st.mode !== 'play' || LEARN.meal) {
    el.classList.remove('show');
    return;
  }
  if (!st.goalT) {
    st.goalT = T;
    el.textContent = 'eat the insect swarms to keep the flock fed';
  }
  if (st.eaten > 0 && T - st.goalT > 7) {
    LEARN.meal = 1;
    try {
      localStorage.setItem('flokk-learn', JSON.stringify(LEARN));
    } catch (e) {
      /* storage unavailable: shown again next run */
    }
    el.classList.remove('show');
  } else if (T - st.goalT > 1) el.classList.add('show');
}
function statsHTML() {
  return `<div><b>${birds.length}</b><span>birds</span></div><div><b>${CAL.day + 1}</b><span>day</span></div>`;
}
function overHTML(won) {
  const { run, prev } = recordBest(won);
  const cell = (k, label) => {
    const note = !prev[k] ? '' : run[k] > prev[k] ? 'new best' : `best ${prev[k]}`;
    return `<div><b>${run[k]}</b><span>${label}</span>${note ? `<i>${note}</i>` : ''}</div>`;
  };
  return cell('flock', 'largest flock') + cell('days', 'days');
}

// how many midge clouds and dragonflies the season and the hour hold: summer thick with them, none in
// winter, few at night
function insectTarget() {
  const night = LIGHT.night > 0.5;
  return {
    swarms: Math.round(40 * [0.6, 1.6, 0.7, 0][SEASON] * (night ? 0.2 : 1)),
    dflies: night ? 0 : Math.round(9 * [0.4, 1, 0.3, 0][SEASON])
  };
}
function refreshInsects() {
  swarms = [];
  dflies = [];
  const n = insectTarget();
  for (let i = 0; i < n.swarms; i++) spawnSwarm(true);
  for (let i = 0; i < n.dflies; i++) spawnDfly();
}
function landLabels() {
  const flock = getBest('flock'),
    days = getBest('days');
  $('bestTitle').textContent =
    LAND_NAME + (flock ? ` · best flock ${flock}` : '') + (days ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : '');
}
function newLand(btn, then) {
  clearSession();
  const old = btn.textContent;
  btn.textContent = 'Shaping the land…';
  btn.disabled = true;
  setTimeout(() => {
    genWorld(newSeed());
    refreshInsects();
    landLabels();
    btn.textContent = old;
    btn.disabled = false;
    if (then) then();
    else {
      resetWorld(14, START.x, START.y - 150);
      cam.x = L.x;
      cam.py = PY(L.y, L.z * 0.7);
      demo.tx = 0;
      demo.rest = 0;
    }
  }, 40);
}
function startGame() {
  clearSession();
  initAudio();
  // always start in spring, with a full year ahead
  CAL.t = 0;
  CAL.year = 1;
  RAIN.t = 0;
  RAIN.target = 0;
  RAIN.next = rr(20, 45);
  resetWeather();
  calUpdate();
  if (SEASON !== 0) applySeason(0);
  refreshInsects();
  resetWorld(6, START.x, START.y);
  Object.assign(st, {
    energy: 0.85,
    starveT: 3,
    starved: 0,
    cause: '',
    mode: 'play',
    grace: DAY_LEN,
    food: 0,
    eaten: 0,
    goalT: 0,
    lost: 0,
    maxFlock: 6,
    day0: CAL.day,
    play: 0,
    stamina: 1,
    dashT: 0,
    hawkT: 0,
    // a white-tailed eagle: rare and huge, not a regular threat like the hawk/owl rotation
    eagleT: rr(300, 900),
    joins: 0,
    overT: -1,
    dayOff: 0,
    settleCool: 0
  });
  cam.x = L.x;
  cam.py = PY(L.y, L.z * 0.7);
  $('titleOv').hidden = true;
  $('overOv').hidden = true;
  $('pauseOv').hidden = true;
  pauseIcon(false);
  dashBtn.hidden = !coarse;
  resetMilestones();
  syncHud();
  seasonBanner();
  setTimeout(() => {
    if (st.mode === 'play') teach('goal', 'bring the flock through to spring');
  }, 14000);
}
function yearWon() {
  hideBanner();
  st.mode = 'won';
  $('wonStats').innerHTML = overHTML(true);
  $('wonTitle').textContent = CAL.year > 1 ? `${CAL.year} years` : 'A year';
  $('wonSub').textContent = `${birds.length} ${birds.length === 1 ? 'bird' : 'birds'} greet the spring`;
  $('shareBtn').textContent = 'Share';
  $('wonOv').hidden = false;
  dashBtn.hidden = true;
  syncHud();
  $('keepBtn').focus();
}
/* a wordle-style result for the year just won, ready to paste anywhere */
function shareText() {
  const years = CAL.year,
    url = 'https://vvoses.github.io/flokk/';
  return [
    `flokk 🐦 ${years} ${years === 1 ? 'year' : 'years'} survived`,
    `🪶 max flock ${st.maxFlock}`,
    `🌅 flock at year end ${birds.length}`,
    url
  ].join('\n');
}
// clipboard API where allowed (secure context, permission), else a hidden textarea + execCommand
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e2) {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}
let shareTimer = 0;
$('shareBtn').onclick = async () => {
  const b = $('shareBtn'),
    ok = await copyText(shareText());
  b.textContent = ok ? 'Copied' : 'Copy failed';
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => (b.textContent = 'Share'), 2000);
};
function keepFlying() {
  CAL.year++;
  st.mode = 'play';
  $('wonOv').hidden = true;
  dashBtn.hidden = !coarse;
  syncHud();
  applySeason(0, true);
  refreshInsects();
  seasonBanner();
}
function hideBanner() {
  $('banner').classList.remove('show');
}
// menu/pause/win screens read as clean and atmospheric, not gameplay HUD - only actual flight shows it
function syncHud() {
  document.body.classList.toggle('no-hud', st.mode !== 'play');
}
// the pause button shows play while paused
function pauseIcon(paused) {
  const b = $('pauseBtn');
  b.classList.toggle('paused', paused);
  b.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}
function pause() {
  hideBanner();
  pauseIcon(true);
  st.mode = 'pause';
  pointer.down = false;
  syncHud();
  $('pauseStats').innerHTML = statsHTML();
  $('pauseOv').hidden = false;
  $('resumeBtn').focus();
  saveSession();
}
function resume() {
  st.mode = 'play';
  $('pauseOv').hidden = true;
  pauseIcon(false);
  syncHud();
}
function gameOver() {
  clearSession();
  hideBanner();
  st.mode = 'over';
  $('overTitle').textContent = st.cause === 'starved' ? 'Starved' : 'Taken';
  $('overStats').innerHTML = overHTML();
  $('overOv').hidden = false;
  dashBtn.hidden = true;
  syncHud();
  $('againBtn').focus();
}
function closeNewFlightConfirm() {
  $('newFlightOv').hidden = true;
  $('titleOv').hidden = false;
  $('startBtn').focus();
}
function requestNewFlight() {
  if (!hasStoredSession()) return startGame();
  $('titleOv').hidden = true;
  $('newFlightOv').hidden = false;
  $('cancelNewFlightBtn').focus();
}
$('startBtn').onclick = requestNewFlight;
$('cancelNewFlightBtn').onclick = closeNewFlightConfirm;
$('confirmNewFlightBtn').onclick = () => {
  $('newFlightOv').hidden = true;
  startGame();
};
$('keepBtn').onclick = keepFlying;
$('wonNewBtn').onclick = e => newLand(e.currentTarget, startGame);
$('againBtn').onclick = startGame;
$('newLandBtn').onclick = e => {
  initAudio();
  newLand(e.currentTarget);
};
$('overNewBtn').onclick = e => newLand(e.currentTarget, startGame);
$('resumeBtn').onclick = resume;
$('pauseBtn').onclick = () => {
  if (st.mode === 'play') pause();
  else if (st.mode === 'pause') resume();
};
$('muteBtn').onclick = () => {
  muted = !muted;
  initAudio();
  if (master) master.gain.value = muted ? 0 : 0.9;
  $('waves').style.display = muted ? 'none' : '';
  $('muteBtn').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && st.mode === 'play') pause();
});
syncHud();

/* ---------- particles ---------- */
function feathers(x, y, z, col) {
  for (let i = 0; i < 14; i++)
    parts.push({
      k: 'f',
      x,
      y,
      z,
      vx: rr(-60, 60),
      vy: rr(-60, 60),
      r: rr(0, TAU),
      vr: rr(-6, 6),
      life: rr(1.8, 2.8),
      max: 2.8,
      col: i % 3 ? col : '#CFC2AE'
    });
}
function sparkle(x, y, z, col = '#F4E7A1') {
  parts.push({ k: 's', x, y, z, life: 0.45, max: 0.45, col });
}
// a stoop that grazed close but didn't connect: a few feathers brushed loose, not the burst of a catch
function nearMiss(b) {
  for (let i = 0; i < 5; i++)
    parts.push({
      k: 'f',
      x: b.x,
      y: b.y,
      z: b.z,
      vx: rr(-100, 100),
      vy: rr(-100, 100),
      r: rr(0, TAU),
      vr: rr(-9, 9),
      life: rr(0.5, 0.9),
      max: 0.9,
      col: b.c2
    });
  whooshMiss(b.x, b.y);
}

function feedingSnap(x, y, z) {
  const followers = birds.filter(b => b !== L && b.state === 'fly'),
    nearby = followers.filter(b => Math.hypot(wdx(b.x, x), b.y - y) < 130),
    pool = (nearby.length ? nearby : followers)
      .map(b => ({ b, order: Math.random() + Math.hypot(wdx(b.x, x), b.y - y) / 500 }))
      .sort((a, b) => a.order - b.order)
      .map(o => o.b);
  for (const b of pool.slice(0, 1 + (Math.random() < 0.45 ? 1 : 0))) {
    b.feedT = rr(0.18, 0.32);
    b.feedX = b.x + wdx(x, b.x) + rr(-5, 5);
    b.feedY = y + rr(-5, 5);
    b.feedZ = z;
    b.flapping = true;
    b.fbT = Math.max(b.fbT, b.feedT);
  }
}
function eat(v, x, y, z) {
  st.food += v;
  st.eaten += v;
  feed(0.04 * v);
  feedingSnap(x, y, z);
  sparkle(x, y, z);
  chirp(0.045, undefined, x, y);
  tryGrow();
}
function joinBird() {
  const a = rr(0, TAU),
    d = Math.hypot(vw, vh) / 2 / cam.z / TILT + 60;
  const b = newBird(L.x + Math.cos(a) * d, L.y + Math.sin(a) * d);
  b.vx = -Math.cos(a) * 220;
  b.vy = -Math.sin(a) * 220;
  b.heading = a + Math.PI;
  b.joining = 16;
  birds.push(b);
  st.joins++;
  if (birds.length > st.maxFlock) st.maxFlock = birds.length;
  joinSnd();
  ui.count.classList.add('pop');
  setTimeout(() => ui.count.classList.remove('pop'), 180);
}

/* ---------- energy ---------- */
function feed(v) {
  st.energy = clamp(st.energy + (v * 6) / Math.max(6, birds.length), 0, 1);
}
// a caught bird leaving the flock: clears its perch, counts the loss, spawns feathers, ends the run
// if that was the last bird, and hands leadership to the nearest survivor if it was the leader.
// Shared by every predator (catchBird in flight.js for hawks/owls, foxCatch in interact.js); the
// caller still plays its own thud() with whatever kind/power fits it, and does any predator-specific
// bookkeeping around the call (a hawk clearing other hawks' target on this bird, say). Returns
// whether the bird was actually removed, so the caller knows whether to do that bookkeeping at all.
// starveBird below is similar but deliberately separate: it picks its own bird rather than being
// given one, and hands leadership to birds[0] rather than searching for the nearest survivor.
function removeBird(b) {
  const i = birds.indexOf(b);
  if (i < 0) return false;
  birds.splice(i, 1);
  if (b.perch && b.perch.occ === b) b.perch.occ = null;
  st.lost++;
  feathers(b.x, b.y, b.z, b.c2);
  if (!birds.length) {
    st.overT = 1.3;
    return true;
  }
  if (b === L) {
    let nb = birds[0],
      bd = 1e18;
    for (const o of birds) {
      const q = d2(o, b);
      if (q < bd) {
        bd = q;
        nb = o;
      }
    }
    L = nb;
    if (L.state === 'perch' || L.state === 'land') takeoffAll();
  }
  return true;
}
function starveBird() {
  if (!birds.length) return;
  let b = birds[birds.length - 1];
  if (b === L && birds.length > 1) b = birds[birds.length - 2];
  const i = birds.indexOf(b);
  birds.splice(i, 1);
  if (b.perch && b.perch.occ === b) b.perch.occ = null;
  feathers(b.x, b.y, b.z, b.c2);
  st.lost++;
  st.starved++;
  if (!birds.length) {
    st.overT = 1.3;
    st.cause = 'starved';
    return;
  }
  if (b === L) {
    L = birds[0];
  }
}
