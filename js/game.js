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
  const p = PAL[(Math.random() * PAL.length) | 0];
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
function needFor(n) {
  return 4 + Math.floor(n / 5);
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
      const f = FIELDS[(Math.random() * FIELDS.length) | 0];
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
function spawnSwarm(allowView) {
  for (let k = 0; k < 8; k++) {
    const [x, y] = randomSpot();
    if (!allowView && inView(x, y, 80)) continue;
    const n = rr(5, 11) | 0,
      m = [];
    for (let i = 0; i < n; i++)
      m.push({
        a: rr(0, TAU),
        rr: rr(4, 22),
        ph: rr(0, TAU),
        sp: rr(1.5, 3.5) * (Math.random() < 0.5 ? -1 : 1),
        hz: rr(-0.35, 0.35)
      });
    swarms.push({ x, y, vx: rr(-8, 8), vy: rr(-8, 8), z: rr(1.7, 2.3), m });
    return;
  }
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
const motePos = (s, m) => [
  s.x + Math.cos(T * m.sp + m.a) * m.rr + Math.sin(T * 2.3 + m.ph) * 3,
  s.y + Math.sin(T * m.sp * 1.3 + m.ph) * m.rr * 0.8,
  s.z + m.hz + Math.sin(T * 3 + m.ph) * 0.08
];

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
const exposed = b => !coveredNow(b);

/* ---------- input ---------- */
const keys = {};
const pointer = { down: false, x: 0, y: 0, id: null };
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && st.mode === 'play')
    e.preventDefault();
  keys[e.code] = true;
  if ((e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) dash();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
    if (st.mode === 'play') pause();
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
function getBest() {
  try {
    return +(localStorage.getItem('flokk-best') || 0);
  } catch (e) {
    return 0;
  }
}
function setBest(v) {
  try {
    localStorage.setItem('flokk-best', String(v));
  } catch (e) {
    /* storage unavailable: best score just isn't kept */
  }
}
function statsHTML() {
  return `<div><b>${birds.length}</b><span>birds</span></div><div><b>${CAL.day + 1}</b><span>day</span></div>`;
}
function overHTML(won) {
  const days = won ? YEAR_DAYS * CAL.year : CAL.day + 1;
  return `<div><b>${st.maxFlock}</b><span>largest flock</span></div><div><b>${days}</b><span>days</span></div>`;
}

function refreshInsects() {
  swarms = [];
  dflies = [];
  for (let i = 0; i < 40; i++) spawnSwarm(true);
  for (let i = 0; i < 9; i++) spawnDfly();
}
function landLabels() {
  $('bestTitle').textContent = LAND_NAME + (getBest() ? ` · best ${getBest()}` : '');
}
function newLand(btn, then) {
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
  initAudio();
  refreshInsects();
  // start in spring, or in whatever season was picked from the title screen, with a full year ahead
  const s0 = st.pickS || 0;
  CAL.t = s0 * DAYS_PER_SEASON * DAY_LEN;
  CAL.year = 1;
  RAIN.t = 0;
  RAIN.target = 0;
  RAIN.next = rr(20, 45);
  resetWeather();
  calUpdate();
  if (SEASON !== s0) {
    applySeason(s0);
    refreshInsects();
  }
  resetWorld(6, START.x, START.y);
  Object.assign(st, {
    energy: 0.85,
    starveT: 3,
    starved: 0,
    cause: '',
    mode: 'play',
    grace: 20,
    food: 0,
    eaten: 0,
    lost: 0,
    maxFlock: 6,
    play: 0,
    stamina: 1,
    dashT: 0,
    hawkT: 0,
    joins: 0,
    overT: -1,
    dayOff: s0 * DAYS_PER_SEASON,
    settleCool: 0
  });
  cam.x = L.x;
  cam.py = PY(L.y, L.z * 0.7);
  $('titleOv').hidden = true;
  $('overOv').hidden = true;
  $('pauseOv').hidden = true;
  pauseIcon(false);
  dashBtn.hidden = !coarse;
  seasonBanner();
}
function yearWon() {
  hideBanner();
  st.mode = 'won';
  const best = getBest();
  if (st.maxFlock > best) setBest(st.maxFlock);
  $('wonStats').innerHTML = overHTML(true);
  $('wonTitle').textContent = CAL.year > 1 ? `${CAL.year} years` : 'A year';
  $('wonOv').hidden = false;
  dashBtn.hidden = true;
  $('keepBtn').focus();
}
function keepFlying() {
  CAL.year++;
  st.mode = 'play';
  $('wonOv').hidden = true;
  dashBtn.hidden = !coarse;
  applySeason(0, true);
  refreshInsects();
  seasonBanner();
}
function hideBanner() {
  $('banner').classList.remove('show');
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
  $('pauseStats').innerHTML = statsHTML();
  $('pauseOv').hidden = false;
  $('resumeBtn').focus();
}
function resume() {
  st.mode = 'play';
  $('pauseOv').hidden = true;
  pauseIcon(false);
}
function gameOver() {
  hideBanner();
  st.mode = 'over';
  $('overTitle').textContent = st.cause === 'starved' ? 'Starved' : 'Taken';
  const best = getBest();
  if (st.maxFlock > best) setBest(st.maxFlock);
  $('overStats').innerHTML = overHTML();
  $('overOv').hidden = false;
  dashBtn.hidden = true;
  $('againBtn').focus();
}
$('startBtn').onclick = startGame;
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

function eat(v, x, y, z) {
  st.food += v;
  st.eaten += v;
  feed(0.04 * v);
  sparkle(x, y, z);
  chirp();
  let need = needFor(birds.length);
  while (st.food >= need) {
    st.food -= need;
    joinBird();
    need = needFor(birds.length);
  }
}
function joinBird() {
  const a = rr(0, TAU),
    d = Math.hypot(vw, vh) / 2 / cam.z / TILT + 60;
  const b = newBird(L.x + Math.cos(a) * d, L.y + Math.sin(a) * d);
  b.vx = -Math.cos(a) * 220;
  b.vy = -Math.sin(a) * 220;
  b.heading = a + Math.PI;
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

/* ---------- hidden: tap the year bar three times to pick a season ---------- */
function jumpToSeason(s) {
  // the first day of that season within the year being played (which may have begun mid-year), at the same hour
  const base = (CAL.year - 1) * YEAR_DAYS + (st.mode === 'title' ? 0 : st.dayOff || 0),
    day = base + ((((s * DAYS_PER_SEASON - base) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS);
  CAL.t = ((day * 24 + CAL.hour - START_HOUR) / 24) * DAY_LEN;
  calUpdate();
  if (st.mode !== 'play') st.pickS = s;
  if (CAL.season !== SEASON) {
    applySeason(CAL.season, true);
    refreshInsects();
    seasonBanner();
  }
}
{
  const yearEl = $('yearEl'),
    pick = $('seasonPick');
  let taps = [],
    hideT = 0;
  const hidePick = () => (pick.hidden = true);
  yearEl.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const now = performance.now();
    taps = taps.filter(t => now - t < 700);
    taps.push(now);
    if (taps.length >= 3 && pick.hidden) {
      taps = [];
      for (const b of pick.children) b.classList.toggle('on', +b.dataset.s === SEASON);
      pick.hidden = false;
      clearTimeout(hideT);
      hideT = setTimeout(hidePick, 6000);
    }
  });
  pick.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    jumpToSeason(+b.dataset.s);
    hidePick();
  });
}
