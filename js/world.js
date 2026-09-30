/* Flokk - world.js
   World state and procedural generation: lake, road, rail route, farms, fields, trees, perches, poles, seam twins.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- world state (filled by genWorld) ---------- */
let LAKE,
  POND,
  ROAD,
  LANES,
  ACCESS_TRUNKS = [],
  FIELDS,
  DIVIDES = [], // the balks, ditches and hedges between neighbouring plots: {t, w, pts}
  YARD,
  YARDS = [],
  FARMS = [],
  BUILDS,
  CHURCH = null, // {b, yard, px, py}: the parish church, its churchyard and the road point by its gate
  NAUST,
  JET,
  BOAT,
  tg,
  ZONES,
  START,
  LAND_NAME = '',
  ROADBOX;
const lakeR = a =>
  LAKE.r *
  (1 +
    LAKE.k[0] * Math.sin(2 * a + LAKE.p[0]) +
    LAKE.k[1] * Math.sin(3 * a + LAKE.p[1]) +
    LAKE.k[2] * Math.sin(5 * a + LAKE.p[2]));
const pondR = a => POND.r * (1 + POND.k[0] * Math.sin(2 * a + POND.p[0]) + POND.k[1] * Math.sin(3 * a + POND.p[1]));
function inBlob(x, y, c, rf, m) {
  if (c.x < -1000) return false;
  const dx = wdx(x, c.x),
    dy = y - c.y,
    q = dx * dx + dy * dy;
  if (q > (c.r * 1.45 + m) ** 2) return false;
  return Math.sqrt(q) < rf(Math.atan2(dy, dx)) + m;
}
const NORTH = 820; // fields, farms, roads and lakes keep south of this, leaving room for the northern forest
const inWater = (x, y, m = 0) => y > shoreY(x) - m || inBlob(x, y, LAKE, lakeR, m) || inBlob(x, y, POND, pondR, m);
function roadDist(x, y) {
  if (y < ROADBOX[0] - 300 || y > ROADBOX[1] + 300) return 1e9;
  return polyDist(x, y, ROAD);
}
function inBuild(x, y, m = 0) {
  return buildAt(x, y, m) !== null;
}
// how much extra height the flock should keep here: a climb over roofs and treetops it would
// otherwise clip, a bit lower again over open water where there's nothing to catch a wing on
function terrainClearance(x, y) {
  if (inBuild(x, y, 60)) return 0.9;
  if (forestness(x, y) > 0.56) return 0.8;
  if (inWater(x, y)) return -0.45;
  return 0;
}
/* ---- farmyards: rectangles turned to fit the land ----
   A yard is lw x lh in its own frame (u along ang, v across), centred on cx,cy; x,y,w,h is its bounding box
   and poly its corners, so the field helpers (inField, ptIn) work on it too. */
function mkYard(cx, cy, ang, lw, lh) {
  const c = Math.cos(ang),
    s = Math.sin(ang),
    poly = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ].map(([a, b]) => [cx + (a * lw * c - b * lh * s) / 2, cy + (a * lw * s + b * lh * c) / 2]),
    xs = poly.map(p => p[0]),
    ys = poly.map(p => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { cx, cy, ang, lw, lh, poly, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
// x,y in yard Y's own frame, from its centre
function yardLocal(Y, x, y) {
  const dx = x - Y.cx,
    dy = y - Y.cy,
    c = Math.cos(Y.ang),
    s = Math.sin(Y.ang);
  return [dx * c + dy * s, -dx * s + dy * c];
}
function yardWorld(Y, u, v) {
  const c = Math.cos(Y.ang),
    s = Math.sin(Y.ang);
  return [Y.cx + u * c - v * s, Y.cy + u * s + v * c];
}
function inYard(Y, x, y, m = 0) {
  if (!inRect(x, y, Y, Math.max(0, m) + 1)) return false;
  const [u, v] = yardLocal(Y, x, y);
  return Math.abs(u) < Y.lw / 2 + m && Math.abs(v) < Y.lh / 2 + m;
}
const inChurchyard = (x, y, m = 0) => !!CHURCH && inYard(CHURCH.yard, x, y, m);
// the point at fractions a (along) and b (across) of yard Y
const yardAt = (Y, a, b) => yardWorld(Y, (a - 0.5) * Y.lw, (b - 0.5) * Y.lh);
// the nearest point to x,y at least m inside yard Y
function yardClamp(Y, x, y, m = 0) {
  const [u, v] = yardLocal(Y, x, y);
  return yardWorld(Y, clamp(u, -Y.lw / 2 + m, Y.lw / 2 - m), clamp(v, -Y.lh / 2 + m, Y.lh / 2 - m));
}
// the road's heading near x: averaged over +-span, so a local wiggle doesn't turn a whole farm
function roadAng(x, span = 250) {
  const near = x2 => ROAD.reduce((b, q) => (Math.abs(q[0] - x2) < Math.abs(b[0] - x2) ? q : b));
  const a = near(x - span),
    b = near(x + span);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}
/* ---- walking around buildings ----
   Anything on foot uses groundStep(). While the straight line to where it is going is clear it just
   walks; when a building is in the way it plans a route round the corners of the buildings (a small
   visibility graph over each footprint's corners, grown a little) and follows it, cutting straight to
   the next corner as soon as that is in plain view. Steering by feel alone used to get caught in the
   middle of a long wall, turning back and forth with the goal straight through it. */
const NAV_M = 9; // how close to a wall anything walks
function buildAt(x, y, m = 0) {
  for (const b of BUILDS) {
    const dx = wdx(x, b.cx),
      dy = y - b.cy,
      c = Math.cos(b.ang),
      s = Math.sin(b.ang);
    if (Math.abs(dx * c + dy * s) < b.len / 2 + m && Math.abs(-dx * s + dy * c) < b.dep / 2 + m) return b;
  }
  return null;
}
// the nearest point outside any building footprint grown by m
function pushOut(x, y, m) {
  for (let i = 0; i < 3; i++) {
    const b = buildAt(x, y, m);
    if (!b) break;
    const c = Math.cos(b.ang),
      s = Math.sin(b.ang),
      dx = wdx(x, b.cx),
      dy = y - b.cy;
    let lx = dx * c + dy * s,
      ly = -dx * s + dy * c;
    if (b.len / 2 + m - Math.abs(lx) < b.dep / 2 + m - Math.abs(ly)) lx = Math.sign(lx || 1) * (b.len / 2 + m + 0.5);
    else ly = Math.sign(ly || 1) * (b.dep / 2 + m + 0.5);
    x = x - dx + lx * c - ly * s;
    y = b.cy + lx * s + ly * c;
  }
  return [x, y];
}
// does the segment (x0,y0)-(x1,y1) pass through building b grown by m? (slab test in the building's frame)
function segHits(b, x0, y0, x1, y1, m) {
  const c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    ox = wdx(x0, b.cx),
    oy = y0 - b.cy,
    ex = x1 - x0,
    ey = y1 - y0;
  const p = [ox * c + oy * s, -ox * s + oy * c],
    d = [ex * c + ey * s, -ex * s + ey * c],
    h = [b.len / 2 + m, b.dep / 2 + m];
  let t0 = 0,
    t1 = 1;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) {
      if (Math.abs(p[k]) >= h[k]) return false;
      continue;
    }
    let ta = (-h[k] - p[k]) / d[k],
      tb = (h[k] - p[k]) / d[k];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 >= t1) return false;
  }
  return true;
}
const NAV_SEG = NAV_M - 4; // clearance a straight leg needs; corners sit further out, at NAV_M + 3
function segClear(x0, y0, x1, y1) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  for (const b of BUILDS) {
    // quick reject: the building's bounding circle is nowhere near the segment's
    const r = Math.hypot(b.len, b.dep) / 2 + NAV_SEG,
      mx = wdx((x0 + x1) / 2, b.cx),
      my = (y0 + y1) / 2 - b.cy;
    if (mx * mx + my * my > (r + L / 2) ** 2) continue;
    if (segHits(b, x0, y0, x1, y1, NAV_SEG)) return false;
  }
  return true;
}
// corners of every footprint (grown so a route clears the walls) and which pairs see each other
let NAVG = null;
function navGraph() {
  if (NAVG && NAVG.src === BUILDS && NAVG.n === BUILDS.length) return NAVG;
  const pts = [];
  for (const b of BUILDS) {
    const c = Math.cos(b.ang),
      s = Math.sin(b.ang),
      hl = b.len / 2 + NAV_M + 3,
      hd = b.dep / 2 + NAV_M + 3;
    for (const [lx, ly] of [
      [-hl, -hd],
      [hl, -hd],
      [hl, hd],
      [-hl, hd]
    ]) {
      const x = b.cx + lx * c - ly * s,
        y = b.cy + lx * s + ly * c;
      if (!inBuild(x, y, NAV_M) && !inWater(x, y)) pts.push([x, y]);
    }
  }
  const nb = pts.map(() => []);
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const [ax, ay] = pts[i],
        bx = ax + wdx(pts[j][0], ax),
        by = pts[j][1],
        d = Math.hypot(bx - ax, by - ay);
      if (d < 700 && segClear(ax, ay, bx, by)) {
        nb[i].push([j, d]);
        nb[j].push([i, d]);
      }
    }
  NAVG = { src: BUILDS, n: BUILDS.length, pts, nb };
  return NAVG;
}
// shortest route from (x0,y0) to (x1,y1) through footprint corners; waypoints in the walker's own
// x-frame (so a route across the seam just continues past it). null if there is none.
function navPlan(x0, y0, x1, y1) {
  const G = navGraph(),
    n = G.pts.length,
    P = G.pts.map(([x, y]) => [x0 + wdx(x, x0), y]);
  const dist = new Float64Array(n + 1).fill(Infinity),
    prev = new Int32Array(n + 1).fill(-1),
    done = new Uint8Array(n + 1),
    reach = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i];
    if (Math.hypot(px - x0, py - y0) < 700 && segClear(x0, y0, px, py)) dist[i] = Math.hypot(px - x0, py - y0);
    reach.push(Math.hypot(px - x1, py - y1) < 700 && segClear(px, py, x1, y1));
  }
  // node n is the goal
  for (;;) {
    let u = -1;
    for (let i = 0; i <= n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) return null;
    if (u === n) break;
    done[u] = 1;
    if (reach[u]) {
      const d = dist[u] + Math.hypot(P[u][0] - x1, P[u][1] - y1);
      if (d < dist[n]) ((dist[n] = d), (prev[n] = u));
    }
    for (const [v, w] of G.nb[u])
      if (!done[v] && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
  }
  const route = [[x1, y1]];
  for (let u = prev[n]; u >= 0; u = prev[u]) route.unshift(P[u]);
  return route;
}
// one step of s units/second towards (a.x+dx, a.y+dy), going round any building in the way
function groundStep(a, dx, dy, d, s, dt) {
  if (!(dt > 0)) return;
  const gx = a.x + dx,
    gy = a.y + dy;
  let ux = dx,
    uy = dy;
  if (!segClear(a.x, a.y, gx, gy)) {
    let n = a.nav;
    n = a.nav =
      n && Math.hypot(wdx(n.gx, gx), n.gy - gy) < 12 && (n.age += dt) < 3
        ? n
        : { gx, gy, age: 0, i: 0, pts: navPlan(...pushOut(a.x, a.y, NAV_SEG + 1), gx, gy) };
    if (n.pts) {
      // re-anchor to this frame's x (the walker may have been shifted across the seam)
      const at = i => [a.x + wdx(n.pts[i][0], a.x), n.pts[i][1]];
      let w = at(n.i);
      while (n.i < n.pts.length - 1 && (Math.hypot(w[0] - a.x, w[1] - a.y) < 5 || segClear(a.x, a.y, ...at(n.i + 1))))
        w = at(++n.i);
      ux = w[0] - a.x;
      uy = w[1] - a.y;
    }
  } else a.nav = null;
  const ul = Math.hypot(ux, uy) || 1;
  const aim = Math.atan2(uy, ux),
    speed = Math.hypot(a.vx || 0, a.vy || 0),
    heading = a.moveHeading ?? a.hd3 ?? aim,
    turn = angDiff(aim, heading),
    large = a.k === 'cow' || a.k === 'moose' || a.k === 'tractor',
    rate = large ? 2.2 : a.k === 'fox' || a.k === 'dog' ? 4.8 : 3.4,
    nextHeading = heading + clamp(turn, -rate * dt, rate * dt),
    // Slow before a corner, then accelerate out along the new heading.
    target = Math.min(s, Math.sqrt(2 * 70 * ul)) * Math.max(0, Math.cos(turn)),
    acceleration = large ? 28 : 65,
    nextSpeed = Math.max(0, speed + clamp(target - speed, -110 * dt, acceleration * dt)),
    step = Math.min(ul, nextSpeed * dt);
  a.moveHeading = nextHeading;
  let nx = a.x + Math.cos(nextHeading) * step,
    ny = a.y + Math.sin(nextHeading) * step;
  // never onto a roof: slide along the wall instead (also the fallback when no route exists)
  if (inBuild(nx, ny, NAV_M - 4)) [nx, ny] = pushOut(nx, ny, NAV_M - 3);
  a.vx = (nx - a.x) / dt;
  a.vy = (ny - a.y) / dt;
  a.x = nx;
  a.y = ny;
  if (Math.abs(a.vx) > 1.5) a.f = a.vx > 0 ? 1 : -1;
}
const onFoot = a => (a.z || 0) < 0.3 && a.k !== 'duck';
function fieldAt(x, y) {
  for (const f of FIELDS) if (inField(f, x, y)) return f;
  return null;
}
function forestness(x, y) {
  let f = pfbm(x, y, 620, 11, 7) * 0.75;
  for (const [zx, zy, zr, b] of ZONES) {
    const d = Math.hypot(wdx(x, zx), y - zy);
    if (d < zr) f += b * Math.pow(1 - d / zr, 0.7);
  }
  {
    const nb = clamp(1 - y / 950, 0, 1);
    f += 0.42 * nb * nb * (3 - 2 * nb);
  }
  {
    const se = H - y;
    if (se < 450) f += 0.22 * (1 - Math.max(0, se) / 450);
  }
  const out = Math.max(-y, y - H);
  if (out > 0) f += 0.5;
  if (REGIONS.length) {
    const regional = regionWeights(x, y);
    f -= regional.town * 0.2;
    f += regional.highland * 0.035;
  }
  return f;
}
/* a gentle rolling elevation field, purely for hillshading the ground texture - the land itself
   stays a flat plane (nothing here moves a tree, a bird or the camera), it just tints the grass
   a little lighter on slopes that face the sun and a little darker on slopes that face away, so
   the farmland reads as broad, slow swells instead of a perfectly flat tabletop. Low frequency by
   design (hills a few hundred units across), and built from pfbm so it wraps at the seam for free. */
function landHeight(x, y) {
  return pfbm(x, y, 1300, 210, 55) * 0.7 + pfbm(x, y, 480, 33, 190) * 0.3;
}
const HS_D = 9,
  HS_SL = Math.hypot(SX, SY),
  HS_LX = -SX / HS_SL,
  HS_LY = -SY / HS_SL;
// how much brighter (>0) or darker (<0) a point on the ground should read from its slope alone.
// landHeight is normalized to roughly [0,1] over spans of hundreds of units, so its raw slope is
// tiny (a real derivative, not a step-size artifact) - the 1200 just rescales that real-world-tiny
// slope into a [-1,1] shading strength, tuned so typical ground reads as a gentle swell and only
// the steepest hillsides push all the way to full light or full shadow.
function hillshade(x, y) {
  const e0 = landHeight(x, y),
    ex = landHeight(x + HS_D, y),
    ey = landHeight(x, y + HS_D);
  const sx = (ex - e0) / HS_D,
    sy = (ey - e0) / HS_D;
  return clamp((sx * HS_LX + sy * HS_LY) * 1800, -1, 1);
}
function landName() {
  const pre = ['', '', '', '', 'Øvre ', 'Nedre ', 'Store ', 'Vesle ', 'Søndre ', 'Vestre '];
  const a = [
    'Mo',
    'Li',
    'Haug',
    'Vik',
    'Dal',
    'Ås',
    'Berg',
    'Holt',
    'Myr',
    'Tjern',
    'Rud',
    'Bakk',
    'Lund',
    'Eik',
    'Hegg',
    'Bjørk',
    'Grå',
    'Sol',
    'Rogn',
    'Lyng',
    'Furu',
    'Stein',
    'Kvern',
    'Sel',
    'Brå',
    'Ul'
  ];
  const b = [
    'en',
    'set',
    'stad',
    'rud',
    'land',
    'heim',
    'vollen',
    'tjønna',
    'li',
    'haugen',
    'moen',
    'åsen',
    'dalen',
    'bakken',
    'vika',
    'bekken',
    'sætra'
  ];
  return pick(pre) + pick(a) + pick(b);
}

/* ---------- perches ---------- */
const perches = [],
  PG = new Map(),
  PC = 160;
const gkey = (x, y, c) => Math.floor(x / c) + ',' + Math.floor(y / c);
function addPerch(x, y, h, type, cover, ang = null, key = y) {
  const p = { x, y, h, type, cover, occ: null, ang, key };
  perches.push(p);
  const k = gkey(x, y, PC);
  let a = PG.get(k);
  if (!a) PG.set(k, (a = []));
  a.push(p);
  return p;
}
function perchesNear(x, y, r) {
  const out = [];
  const c0 = Math.floor((x - r) / PC),
    c1 = Math.floor((x + r) / PC),
    r0 = Math.floor((y - r) / PC),
    r1 = Math.floor((y + r) / PC);
  for (let i = c0; i <= c1; i++)
    for (let j = r0; j <= r1; j++) {
      const a = PG.get(i + ',' + j);
      if (!a) continue;
      for (const p of a) if ((p.x - x) ** 2 + (p.y - y) ** 2 < r * r) out.push(p);
    }
  return out;
}

/* ---------- trees (side-view sprites, anchored at the trunk base) ---------- */
const SR = 32,
  SS = 2,
  SW = Math.ceil(SR * 3),
  SHT = Math.ceil(SR * 3.4),
  AX = SW / 2,
  AY = SHT - 4;
const TD = { spruce: 3.1, birch: 2.95, decid: 2.75 };
const CAN = { birch: [1.95, 0.82, 1.0], decid: [1.7, 1.05, 0.95] };
// a spruce's silhouette by its sprite variant (0..NV-1): some short and fat, some tall and narrow,
// some full, some sparse - a pure function of vi, shared between the sprite art (sprites.js, which
// scales the drawing by it) and the canopy height used for perch placement here, so the two stay in
// sync and a bird never ends up floating above a shorter tree or buried inside a taller one.
function spruceShape(vi) {
  return {
    hMul: 0.8 + (((vi * 37) % 9) / 9) * 0.4,
    wMul: 0.76 + (((vi * 53) % 11) / 11) * 0.54,
    tiers: 8 + ((vi * 7) % 5),
    droopMul: 0.72 + (((vi * 19) % 7) / 7) * 0.64
  };
}
const TREES = [],
  TG = new Map(),
  TC = 100;
function blocked(x, y, r) {
  if (inWater(x, y, r * 0.6 + 6)) return true;
  for (const f of FIELDS) if (inField(f, x, y, r * 0.5)) return true;
  for (const Y of YARDS) if (inYard(Y, x, y, r * 0.4)) return true;
  if (inChurchyard(x, y, r * 0.4)) return true;
  if (inBuild(x, y, r * 0.6 + 12)) return true;
  if (roadDist(x, y) < 62 + r) return true;
  if (FIELD_TRACKS.some(t => polyDist(x, y, t.path) < 20 + r)) return true;
  if (railDist(x, y) < 34 + r * 0.85) return true;
  for (const P of LANES) if (polyDist(x, y, P) < 34 + r * 0.8) return true;
  if (segDist(x, y, JET.x0, JET.y0, JET.x1, JET.y1) < r + 12) return true;
  return false;
}
function addTree(x, y, type, r) {
  const k = (r / SR) * 1.45,
    v = (R() * NV) | 0,
    hMul = type === 'spruce' ? spruceShape(v).hMul : 1;
  const t = { x, y, type, r, k, hpx: TD[type] * hMul * SR * k, v, ws: rnd(0.88, 1.12) };
  TREES.push(t);
  const kk = gkey(x, y, TC);
  let a = TG.get(kk);
  if (!a) TG.set(kk, (a = []));
  a.push(t);
  const n = Math.max(3, Math.round(r / 6) + 1);
  for (let i = 0; i < n; i++) {
    let dx, hp;
    if (type === 'spruce') {
      const f = rnd(0.28, 0.82);
      dx = rnd(-1, 1) * SR * k * (1 - f) * 0.85;
      hp = f * t.hpx;
    } else {
      const [cy, rx, ry] = CAN[type];
      const a2 = rnd(0, TAU),
        d = Math.sqrt(R()) * 0.72;
      dx = Math.cos(a2) * d * rx * SR * k;
      hp = (cy + Math.sin(a2) * d * ry) * SR * k;
    }
    {
      const p = addPerch(x + dx, y + 1, hp / HZ, 'tree', true, null, y + 0.5);
      p.tt = type;
      p.tree = t;
    }
  }
  const hm = ((type === 'spruce' ? 0.42 * TD.spruce * hMul : CAN[type][0]) * SR * k) / HZ;
  t.sx = x + hm * SX;
  t.sy = y + hm * SY;
}
function underTree(x, y) {
  const cx = Math.floor(x / TC),
    cy = Math.floor(y / TC);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const a = TG.get(cx + i + ',' + (cy + j));
      if (!a) continue;
      for (const t of a) if ((t.x - x) ** 2 + (t.y - y) ** 2 < (t.r * 0.65) ** 2) return true;
    }
  return false;
}

const BALE_H = 0.3,
  POST_H = 0.34,
  POLE_H = 2.1,
  WIRE_H = 2.0,
  SAG = 0.28;
const BALES = [],
  FSEG = [],
  LINES = [],
  REEDS = [],
  SPARK = [],
  CROSSINGS = [], // where a road or lane crosses the railway: {x,y,ang (road heading),rang (rail heading),w,signs}
  XSIGNS = []; // crossbuck signs standing at a road-rail crossing, one each side
// the point (if any) where segment a-b crosses segment c-d, with each line's own heading
function segX(a, b, c, d) {
  const r1x = b[0] - a[0],
    r1y = b[1] - a[1],
    r2x = d[0] - c[0],
    r2y = d[1] - c[1],
    den = r1x * r2y - r1y * r2x;
  if (!den) return null;
  const t = ((c[0] - a[0]) * r2y - (c[1] - a[1]) * r2x) / den,
    u = ((c[0] - a[0]) * r1y - (c[1] - a[1]) * r1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a[0] + r1x * t, y: a[1] + r1y * t, ang: Math.atan2(r1y, r1x), rang: Math.atan2(r2y, r2x) };
}
function findCrossings(P, Q) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++)
    for (let j = 0; j < Q.length - 1; j++) {
      const x = segX(P[i], P[i + 1], Q[j], Q[j + 1]);
      if (x) out.push(x);
    }
  return out;
}
// true within r of any road/lane-over-rail crossing: poles, fences and hedgerows all keep clear of one
function nearCrossing(x, y, r) {
  for (const c of CROSSINGS) if ((c.x - x) ** 2 + (c.y - y) ** 2 < r * r) return true;
  return false;
}

/* ---------- procedural land ---------- */
function genLayout() {
  SHORE = { a: rnd(0, TAU), b: rnd(0, TAU) };
  // lake
  LAKE = {
    x: rnd(1000, W - 1000),
    y: rnd(1250, H - 980),
    r: rnd(330, 470),
    k: [rnd(0.08, 0.2), rnd(0.04, 0.12), rnd(0.02, 0.06)],
    p: [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)]
  };
  POND = { x: -9999, y: -9999, r: 1, k: [0, 0], p: [0, 0] };
  // road across the land, bending around the lake
  for (let tries = 0; tries < 30; tries++) {
    const xs = periodXs(560, 820, 450),
      ys = [];
    let ry = rnd(1050, H - 650);
    for (let i = 0; i < xs.length; i++) {
      ry = clamp(ry + rnd(-230, 230), 950, H - 420);
      ys.push(ry);
    }
    const e = ys[0] - ys[ys.length - 1],
      pts = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const x = xs[i];
      let y = clamp(ys[i] + (e * x) / W, 950, H - 420);
      const dx = wdx(x, LAKE.x),
        rad = LAKE.r * 1.4 + 180;
      if (Math.abs(dx) < rad) {
        const dy = y - LAKE.y,
          need = Math.sqrt(rad * rad - dx * dx);
        if (Math.abs(dy) < need) y = LAKE.y + (dy >= 0 ? 1 : -1) * need;
      }
      pts.push([x, clamp(y, 860, H - 300)]);
    }
    ROAD = trimX(catmull(extP(pts)), -1700, W + 1700);
    ROADBOX = [Math.min(...ROAD.map(p => p[1])), Math.max(...ROAD.map(p => p[1]))];
    if (!ROAD.some(p => inWater(p[0], p[1], 70))) break;
  }
  // pond, away from lake and road
  for (let i = 0; i < 60; i++) {
    const x = rnd(600, W - 600),
      y = rnd(NORTH + 100, H - 350);
    if (Math.hypot(wdx(x, LAKE.x), y - LAKE.y) < LAKE.r * 1.5 + 350) continue;
    if (roadDist(x, y) < 260 || y + 220 > shoreY(x)) continue;
    POND = { x, y, r: rnd(80, 130), k: [rnd(0.06, 0.14), rnd(0.03, 0.08)], p: [rnd(0, TAU), rnd(0, TAU)] };
    break;
  }
  genRail();
  // farmsteads beside the road: a main farm and a second, differently laid-out one further along
  LANES = [];
  BUILDS = [];
  CHURCH = null;
  FIELDS = [];
  DIVIDES = [];
  YARDS = [];
  FARMS = [];
  const HOUSE = ['#E6E0D2', '#E6E0D2', '#E9DDB0', '#C9D4D2', '#D8C9A8', '#A8432F', '#8C9A88'],
    BARN = ['#8E2F24', '#8E2F24', '#8E2F24', '#A0442E', '#E6E0D2', '#B8955A', '#6E7274'];
  const yardFree = (y2, m) => {
    for (const o of YARDS)
      if (y2.x < o.x + o.w + m && y2.x + y2.w > o.x - m && y2.y < o.y + o.h + m && y2.y + y2.h > o.y - m) return false;
    for (const f of FIELDS)
      if (y2.x < f.x + f.w + m && y2.x + y2.w > f.x - m && y2.y < f.y + f.h + m && y2.y + y2.h > f.y - m) return false;
    return true;
  };
  const placeFarm = main => {
    let best = null,
      bestBad = 1e9;
    for (let i = 0; i < 1200; i++) {
      const p = pick(ROAD);
      if (p[0] < 480 || p[0] > W - 480) continue;
      if (FARMS.some(f => Math.abs(wdx(f.px, p[0])) < 1350)) continue;
      const small = !main && R() < 0.45,
        horiz = !main && R() < 0.5,
        side = R() < 0.5 ? 1 : -1;
      const a = small ? rnd(280, 330) : rnd(340, 420),
        b = small ? rnd(420, 500) : rnd(560, 680),
        w = horiz ? b : a,
        h = horiz ? a : b;
      // the yard lines up with its stretch of road, give or take; now and then it sits at its own angle
      const back = i < 140 ? 110 : rnd(110, 420),
        ang = roadAng(p[0]) + (R() < 0.3 ? rnd(-0.4, 0.4) : rnd(-0.1, 0.1)),
        Ax = -Math.sin(ang) * side,
        Ay = Math.cos(ang) * side,
        off = i < 300 ? 0 : rnd(-260, 260),
        cx = p[0] + Math.cos(ang) * off + Ax * (h / 2 + back),
        cy = p[1] + Math.sin(ang) * off + Ay * (h / 2 + back),
        yard = mkYard(cx, cy, ang, w, h);
      if (yard.y < NORTH || yard.y + yard.h > H - 440) continue;
      // score the spot: water and rail near the yard, a road too far away, or other yards in the way all count against it
      let bad = yardFree(yard, 200) ? 0 : 400;
      for (let gx = yard.x - 150; gx <= yard.x + yard.w + 150; gx += 60)
        for (let gy = yard.y - 150; gy <= yard.y + yard.h + 150; gy += 60) {
          if (inWater(gx, gy, 0)) bad += inYard(yard, gx, gy) ? 40 : 6;
        }
      if (roadDist(cx - Ax * (h / 2 - 10), cy - Ay * (h / 2 - 10)) > back + Math.abs(off) + 60) bad += 60;
      for (let gx = yard.x - 80; gx <= yard.x + yard.w + 80; gx += 60)
        for (let gy = yard.y - 80; gy <= yard.y + yard.h + 80; gy += 60)
          if (railDist(gx, gy) < 70) bad += inYard(yard, gx, gy, 20) ? 60 : 8;
      // the road passes the yard, never through a corner of it
      for (let gx = yard.x; gx <= yard.x + yard.w; gx += 30)
        for (let gy = yard.y; gy <= yard.y + yard.h; gy += 30)
          if (inYard(yard, gx, gy, 20) && roadDist(gx, gy) < 40) bad += 80;
      const fm = { px: p[0], py: p[1], side, cx, cy, yard, small, horiz, main };
      if (bad === 0) return fm;
      if (bad < bestBad) {
        bestBad = bad;
        best = fm;
      }
    }
    return main ? best : null;
  };
  // building plans in yard-relative coordinates (u across, v away from the road; rot=long side runs away from the road)
  const PLANS = {
    L: [
      ['house', -0.26, -0.25, 0],
      ['barn', 0.23, 0.06, 1],
      ['shed', -0.27, 0.23, 0],
      ['shed?', 0.24, 0.4, 0]
    ],
    tun: [
      ['house', 0, -0.3, 0],
      ['barn', 0, 0.28, 0],
      ['stabbur', -0.33, 0, 1],
      ['shed', 0.33, 0.02, 1]
    ],
    row: [
      ['house', -0.22, -0.3, 1],
      ['barn', 0.2, 0.1, 1],
      ['stabbur', -0.25, 0.3, 0]
    ],
    small: [
      ['house', -0.18, -0.22, 0],
      ['sbarn', 0.18, 0.16, 1],
      ['shed', -0.22, 0.3, 0]
    ]
  };
  const buildFarm = fm => {
    const { yard, side, horiz } = fm,
      mx = R() < 0.5 ? 1 : -1,
      plan = fm.small
        ? PLANS.small
        : fm.main
          ? pick([PLANS.L, PLANS.L, PLANS.tun])
          : pick([PLANS.tun, PLANS.row, PLANS.L]);
    const house = pick(HOUSE),
      barn = pick(BARN),
      red = barn === '#8E2F24' || barn === '#A0442E';
    const W0 = horiz ? yard.lh : yard.lw,
      H0 = horiz ? yard.lw : yard.lh; // the plan's own across/away extents
    for (const [kind, u, v, rot0] of plan) {
      if (kind === 'shed?' && R() < 0.35) continue;
      let pu = u * W0 * mx,
        pv = v * H0 * side,
        rot = rot0;
      if (horiz) {
        const t = pu;
        pu = pv * side * mx;
        pv = t * side;
        rot = 1 - rot;
      }
      // every building turns with its yard, and a little on its own: added one at a time over the years
      const ya = yard.ang,
        cx = fm.cx + pu * Math.cos(ya) - pv * Math.sin(ya),
        cy = fm.cy + pu * Math.sin(ya) + pv * Math.cos(ya),
        own =
          kind === 'house' || kind === 'barn' || kind === 'sbarn'
            ? rnd(-0.1, 0.1)
            : R() < 0.35
              ? rnd(-0.4, 0.4)
              : rnd(-0.12, 0.12),
        ang = ya + (rot ? Math.PI / 2 : 0) + own;
      const room = (rot ? yard.lh : yard.lw) * 0.62;
      let b;
      if (kind === 'house')
        b = {
          len: Math.min(room, rnd(100, 126)),
          dep: rnd(56, 66),
          roof: pick(['tile', 'tile', 'slate', 'dark', 'turf']),
          wall: house,
          wh: rnd(26, 30),
          rh: rnd(50, 58),
          windows: true,
          chimney: true
        };
      else if (kind === 'barn')
        b = {
          len: Math.min(room, rnd(165, 210)),
          dep: rnd(96, 118),
          roof: pick(['slate', 'slate', 'tile', 'metal']),
          wall: barn,
          wh: rnd(34, 40),
          rh: rnd(68, 80),
          trim: red,
          door: true
        };
      else if (kind === 'sbarn')
        b = {
          len: Math.min(room, rnd(105, 130)),
          dep: rnd(68, 80),
          roof: pick(['slate', 'metal', 'tile']),
          wall: barn,
          wh: rnd(28, 32),
          rh: rnd(54, 62),
          trim: red,
          door: true
        };
      else if (kind === 'stabbur')
        b = {
          len: rnd(34, 40),
          dep: rnd(30, 34),
          roof: pick(['turf', 'slate']),
          wall: pick(['#5C3B26', '#7A3A22', '#8E2F24']),
          wh: rnd(26, 30),
          rh: rnd(44, 50),
          trim: true
        };
      else
        b = {
          len: rnd(44, 64),
          dep: rnd(36, 42),
          roof: pick(['turf', 'slate', 'slate', 'metal']),
          wall: R() < 0.6 ? barn : pick(['#7A3A22', '#5C3B26', '#8E8A80']),
          wh: rnd(20, 24),
          rh: rnd(36, 42),
          trim: red
        };
      if (
        inWater(cx, cy, b.len * 0.5 + 8) ||
        railDist(cx, cy) < b.len * 0.5 + 26 ||
        roadDist(cx, cy) < b.len * 0.5 + 24
      )
        continue; // never in the lake or on the tracks
      b.cx = cx;
      b.cy = cy;
      b.ang = ang;
      b.kind = kind;
      BUILDS.push(b);
      (fm.builds || (fm.builds = [])).push(b);
      if (kind === 'house') fm.house = b;
    }
    // the lane comes in through the middle of the side facing the road
    const ya = yard.ang,
      Ax = -Math.sin(ya) * side,
      Ay = Math.cos(ya) * side,
      t = rnd(-0.2, 0.2) * yard.lw,
      ex = fm.cx - (Ax * yard.lh) / 2 + Math.cos(ya) * t,
      ey = fm.cy - (Ay * yard.lh) / 2 + Math.sin(ya) * t;
    fm.lane = LANES.length;
    fm.yard.gate = [ex + Ax * 30, ey + Ay * 30];
    fm.yard.builds = fm.builds || [];
    // and leaves the road at the point nearest the gate, so it never runs alongside the road first
    const gx = ex + Ax * 30,
      gy = ey + Ay * 30,
      r0 = ROAD.reduce((b, q) => (Math.hypot(q[0] - gx, q[1] - gy) < Math.hypot(b[0] - gx, b[1] - gy) ? q : b));
    LANES.push(
      catmull([
        [r0[0], r0[1]],
        [lerp(r0[0], ex, 0.5) + rnd(-12, 12), lerp(r0[1], ey, 0.5)],
        [gx, gy]
      ])
    );
  };
  const fieldOK = r => {
    if (r.w < 210 || r.h < 210 || r.y < NORTH) return false;
    for (const o of CHURCH ? YARDS.concat(CHURCH.yard) : YARDS)
      if (r.x < o.x + o.w + 40 && r.x + r.w > o.x - 40 && r.y < o.y + o.h + 40 && r.y + r.h > o.y - 40) return false;
    for (const o of FIELDS)
      if (r.x < o.x + o.w + 6 && r.x + r.w > o.x - 6 && r.y < o.y + o.h + 6 && r.y + r.h > o.y - 6) return false;
    for (let x = r.x - 20; x <= r.x + r.w + 20; x += 50)
      for (let y = r.y - 20; y <= r.y + r.h + 20; y += 50) {
        if (inWater(x, y, 40)) return false;
        if (roadDist(x, y) < 42 || railDist(x, y) < 48) return false;
      }
    return true;
  };
  const types = ['stubble', 'stubble', 'stubble', 'plow', 'plow', 'pasture', 'crop', 'crop'];
  /* farmland: each farm works one tract laid out square to its stretch of road, cut - the way real farmland
     is seen from above - into neighbouring plots of different sizes, angles and crops. Every cut runs a
     little off the tract's grid and carries a grass balk, a ditch or a hedge, which sets how far apart
     the plots on either side sit; both sides bend with the same noise, so a strip keeps its width. Plots
     that would land on water, the road, the rail or a yard are cut again or left as meadow. */
  // the first spot on or in plot P that sits too close to water, road, rail, a yard or another farm's plot
  const plotBad = (P, own) => {
    for (const p of P) if (p[1] < NORTH || p[1] > H - 440 || p[0] < 130 || p[0] > W - 130) return p;
    const bad = (x, y) => {
      if (inWater(x, y, 40) || roadDist(x, y) < 42 || railDist(x, y) < 48 || inBuild(x, y, 24)) return true;
      for (const Y of YARDS) if (inYard(Y, x, y, 40)) return true;
      if (inChurchyard(x, y, 40)) return true;
      for (const o of FIELDS) if (!own.has(o) && inField(o, x, y, 24)) return true;
      return false;
    };
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i],
        [bx, by] = P[(i + 1) % P.length],
        n = Math.ceil(Math.hypot(bx - ax, by - ay) / 25);
      for (let k = 0; k < n; k++) {
        const x = lerp(ax, bx, k / n),
          y = lerp(ay, by, k / n);
        if (bad(x, y)) return [x, y];
      }
    }
    const b = polyBox(P);
    for (let x = b.x + 25; x < b.x + b.w; x += 50)
      for (let y = b.y + 25; y < b.y + b.h; y += 50) if (pip(P, x, y) && bad(x, y)) return [x, y];
    return null;
  };
  // a plot keeps to sensible shapes: no slivers, no sharp wedges
  const shapely = Q => Q.length >= 3 && polyArea(Q) / Math.max(1, polyDiam(Q)) >= 95 && minAngle(Q) > 0.95;
  const plotsFor = (fm, side, maxN, depth, halfW) => {
    // behind the yard the land is laid out square to the yard; across the road it follows the road's
    // general heading, turned a little its own way, so neighbouring holdings don't share one grid
    const th = side === fm.side ? fm.yard.ang : roadAng(fm.px, halfW * 0.6) + rnd(-0.25, 0.25);
    const ux = Math.cos(th),
      uy = Math.sin(th),
      vx = -uy * side,
      vy = ux * side;
    const at = (u, v) => [fm.px + ux * u + vx * v, fm.py + uy * u + vy * v];
    const u0 = -halfW * rnd(0.8, 1.2),
      u1 = halfW * rnd(0.8, 1.2),
      v0 = 70,
      v1 = depth;
    const edge = (a, b) => mkLine(a[0], a[1], Math.atan2(b[1] - a[1], b[0] - a[0]), 'edge');
    const C = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    let P = C.map((p, i) => [p[0], p[1], edge(p, C[(i + 1) % 4])]);
    // the far side runs off at its own angle, and a corner or two is taken off the tract
    {
      const [fx, fy] = at(rnd(u0, u1), v1 * rnd(0.8, 1));
      P = clipHalf(P, fx, fy, -vx, -vy, rnd(-0.3, 0.3), 'edge');
    }
    for (const cu of [u0, u1])
      if (R() < 0.55) {
        const [kx, ky] = at(cu * rnd(0.7, 0.9), rnd(v0, v1) * rnd(0.4, 0.8));
        P = clipHalf(P, kx, ky, -Math.sign(cu) * ux, -Math.sign(cu) * uy, Math.sign(cu) * side * rnd(0.3, 0.6), 'edge');
      }
    // keep to the land
    P = clipHalf(P, 0, NORTH + 10, 0, 1, 0, 'edge');
    P = clipHalf(P, 0, H - 450, 0, -1, 0, 'edge');
    P = clipHalf(P, 140, 0, 1, 0, 0, 'edge');
    P = clipHalf(P, W - 140, 0, -1, 0, 0, 'edge');
    if (P.length < 3) return;
    const LINES = [],
      leaves = [];
    // cut across whichever way the piece is longer, mostly square to the tract, now and then well off it
    const cut = (Q, force) => {
      const A = polyArea(Q),
        su = Q.map(p => p[0] * ux + p[1] * uy),
        sv = Q.map(p => p[0] * vx + p[1] * vy),
        eu = Math.max(...su) - Math.min(...su),
        ev = Math.max(...sv) - Math.min(...sv);
      if (!force && A < rnd(70000, 210000) && Math.max(eu, ev) < 720) return [Q];
      const acrossU = eu * rnd(0.8, 1.25) > ev;
      for (let tr = 0; tr < 5; tr++) {
        const t = rnd(0.3, 0.7),
          cu = Math.min(...su) + eu * (acrossU ? t : 0.5),
          cv = Math.min(...sv) + ev * (acrossU ? 0.5 : t),
          cx = cu * ux + cv * vx,
          cy = cu * uy + cv * vy,
          ang = Math.atan2(acrossU ? vy : uy, acrossU ? vx : ux) + (R() < 0.2 ? rnd(-0.5, 0.5) : rnd(-0.16, 0.16)),
          ty = R() < 0.38 ? 'balk' : R() < 0.55 ? 'ditch' : 'hedge',
          L = mkLine(cx, cy, ang, ty);
        const a = clipHalf(Q, cx + L.nx * L.w * 0.5, cy + L.ny * L.w * 0.5, L.nx, L.ny, 0, L),
          b = clipHalf(Q, cx - L.nx * L.w * 0.5, cy - L.ny * L.w * 0.5, -L.nx, -L.ny, 0, L);
        if (!shapely(a) || !shapely(b)) continue;
        L.span = lineSpan(Q, L);
        LINES.push(L);
        return [a, b];
      }
      return [Q];
    };
    const grow = (Q, d) => {
      const S = cut(Q, false);
      if (S.length === 1 || d > 6) leaves.push([Q, 0]);
      else for (const s of S) grow(s, d + 1);
    };
    grow(P, 0);
    // work outward from the yard, so the land closest to the farm is the land that's farmed
    const far = Q => {
      const c = polyCentroid(Q);
      return Math.hypot(c[0] - fm.cx, c[1] - fm.cy);
    };
    leaves.sort((p, q) => far(p[0]) - far(q[0]));
    const own = new Set(),
      mine = [];
    const tryLeaf = (Q, d) => {
      // where a plot runs into the road, the water or a yard it is trimmed back along a new edge,
      // the way a field ends at whatever is in its way; only if that leaves too little is it cut again
      for (let k = 0; k < 14; k++) {
        if (mine.length >= maxN || polyArea(Q) < 38000 || !shapely(Q)) return;
        const poly = bendPoly(Q),
          bad = plotBad(poly, own);
        if (!bad) {
          const b = polyBox(poly),
            f = { x: b.x, y: b.y, w: b.w, h: b.h, poly, plot: true, ang: longAng(Q) + (R() < 0.2 ? Math.PI / 2 : 0) };
          own.add(f);
          mine.push(f);
          return;
        }
        const c = polyCentroid(Q),
          l = Math.hypot(bad[0] - c[0], bad[1] - c[1]) || 1,
          dx = (bad[0] - c[0]) / l,
          dy = (bad[1] - c[1]) / l,
          T = clipHalf(Q, bad[0] - dx * 50, bad[1] - dy * 50, -dx, -dy, rnd(-0.15, 0.15), 'edge');
        if (T.length < 3 || polyArea(T) < 38000 || !shapely(T)) {
          if (d < 3) {
            const S = cut(Q, true);
            if (S.length > 1) for (const s of S) tryLeaf(s, d + 1);
          }
          return;
        }
        Q = T;
      }
      if (d < 3) for (const s of cut(Q, true)) if (s !== Q) tryLeaf(s, d + 1);
    };
    for (const [Q] of leaves) if (R() < 0.92) tryLeaf(Q, 0);
    // grazing handy to the barn, crops further out
    mine.forEach((f, i) => {
      f.t = i < 2 && R() < 0.75 ? 'pasture' : pick(types);
      f.farm = fm;
      FIELDS.push(f);
    });
    // what runs along each cut is drawn only where a plot is beside it, and never across a road or a yard
    for (const L of LINES) {
      if (!L.span) continue;
      let run = [];
      const flush = () => {
        if (run.length > 2) DIVIDES.push({ t: L.t, w: L.w, pts: run });
        run = [];
      };
      for (let s = L.span[0]; s <= L.span[1]; s += 12) {
        const x0 = L.cx + L.dx * s,
          y0 = L.cy + L.dy * s,
          o = lineBend(L, x0, y0),
          x = x0 + L.nx * o,
          y = y0 + L.ny * o,
          k = L.w * 0.5 + 10,
          by = f => inField(f, x + L.nx * k, y + L.ny * k, 4) || inField(f, x - L.nx * k, y - L.ny * k, 4);
        const ok =
          mine.some(by) &&
          roadDist(x, y) > 40 &&
          railDist(x, y) > 40 &&
          !inWater(x, y, 20) &&
          !YARDS.some(Y => inYard(Y, x, y, 30)) &&
          !inChurchyard(x, y, 30) &&
          !inBuild(x, y, 20);
        if (ok) run.push([x, y]);
        else flush();
      }
      flush();
    }
  };
  // a small fenced, muddy pig pen snug against a farmyard, with a low lean-to shelter at its inner edge
  const styOK = (P, fm) => {
    const r = polyBox(P);
    if (r.y < NORTH || r.y + r.h > H - 440 || r.x < 60 || r.x + r.w > W - 60) return false;
    for (let gx = r.x - 12; gx <= r.x + r.w + 12; gx += 15)
      for (let gy = r.y - 12; gy <= r.y + r.h + 12; gy += 15) {
        if (!pip(P, gx, gy) && edgeDist(P, gx, gy) > 12) continue;
        if (inWater(gx, gy, 20)) return false;
        if (roadDist(gx, gy) < 40 || railDist(gx, gy) < 45) return false;
        if (inBuild(gx, gy, 14)) return false;
        for (const o of YARDS) if (inYard(o, gx, gy, o === fm.yard ? 4 : 30)) return false;
        for (const o of FIELDS) if (inField(o, gx, gy, 20)) return false;
      }
    return true;
  };
  const placeSty = fm => {
    const Y = fm.yard,
      ya = Y.ang,
      c = Math.cos(ya),
      s = Math.sin(ya),
      at = (u, v) => [Y.cx + u * c - v * s, Y.cy + u * s + v * c];
    for (let i = 0; i < 200; i++) {
      // pen w x h in the yard's own frame, just off one of its sides
      const w = rnd(72, 104),
        h = rnd(60, 86),
        vert = R() < 0.5,
        sg = R() < 0.5 ? 1 : -1,
        gap = rnd(16, 34);
      let u, v;
      if (vert) {
        u = sg * (Y.lw / 2 + gap + w / 2);
        v = rnd(-Y.lh / 2 + h * 0.2, Y.lh / 2 - h * 0.2);
      } else {
        u = rnd(-Y.lw / 2 + w * 0.2, Y.lw / 2 - w * 0.2);
        v = sg * (Y.lh / 2 + gap + h / 2);
      }
      const tw = rnd(-0.12, 0.12),
        tc = Math.cos(tw),
        ts = Math.sin(tw),
        corner = (du, dv) => at(u + du * tc - dv * ts + rnd(-4, 4), v + du * ts + dv * tc + rnd(-4, 4)),
        P = [corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2)];
      if (!styOK(P, fm)) continue;
      const bb = polyBox(P),
        r = { x: bb.x, y: bb.y, w: bb.w, h: bb.h, t: 'sty', dir: 0, ang: ya + tw, poly: P };
      FIELDS.push(r);
      // the shelter sits at whichever edge of the pen faces back toward the yard
      const [bx, by] = vert ? at(u - sg * (w * 0.5 - 19), v) : at(u, v - sg * (h * 0.5 - 16));
      const b = {
        cx: bx,
        cy: by,
        ang: ya + tw + (vert ? Math.PI / 2 : 0),
        len: rnd(30, 38),
        dep: rnd(24, 28),
        roof: pick(['turf', 'turf', 'slate']),
        wall: pick(['#5C3B26', '#7A3A22', '#6B5A48']),
        wh: rnd(14, 17),
        rh: rnd(24, 28),
        kind: 'sty'
      };
      if (
        !inWater(b.cx, b.cy, b.len * 0.5 + 8) &&
        roadDist(b.cx, b.cy) > b.len * 0.5 + 24 &&
        railDist(b.cx, b.cy) > b.len * 0.5 + 26
      ) {
        BUILDS.push(b);
        (fm.builds || (fm.builds = [])).push(b);
      }
      fm.sty = r;
      return;
    }
  };
  /* the parish church: a white wooden long church by the road, well away from the farms, with its tower
     and spire at the end facing the road, a lower chancel at the far end, and a walled churchyard round it.
     The church is one building for walking and shadows (b.len spans all three parts); b.parts are drawn. */
  const placeChurch = () => {
    CHURCH = null;
    for (let i = 0; i < 1500; i++) {
      const p = pick(ROAD);
      if (p[0] < 480 || p[0] > W - 480) continue;
      if (FARMS.some(f => Math.abs(wdx(f.px, p[0])) < (i < 400 ? 900 : i < 900 ? 640 : 380))) continue;
      const side = R() < 0.5 ? 1 : -1,
        ang = roadAng(p[0]) + rnd(-0.08, 0.08),
        Ax = -Math.sin(ang) * side,
        Ay = Math.cos(ang) * side,
        lw = rnd(300, 360),
        lh = rnd(250, 290),
        back = i < 300 ? 70 : rnd(70, 360), // right by the road if there's room, else up a lane of its own
        cx = p[0] + Ax * (lh / 2 + back),
        cy = p[1] + Ay * (lh / 2 + back),
        yard = mkYard(cx, cy, ang, lw, lh);
      if (yard.y < NORTH || yard.y + yard.h > H - 440 || !yardFree(yard, 160)) continue;
      let bad = false;
      for (let gx = yard.x - 60; gx <= yard.x + yard.w + 60 && !bad; gx += 40)
        for (let gy = yard.y - 60; gy <= yard.y + yard.h + 60 && !bad; gy += 40)
          if (inWater(gx, gy, 20) || railDist(gx, gy) < 60 || (inYard(yard, gx, gy) && roadDist(gx, gy) < 50))
            bad = true;
      if (bad) continue;
      // the church stands with its long axis running away from the road, its door end first. Three kinds:
      // a white-painted wooden church with a tall spire; an old grey fieldstone church with a squat tower
      // and a short spire; or a stave church, tarred black, its steep shingled roofs stacked in tiers over
      // a low gallery, dragon heads on the gables and a little turret astride the ridge
      const kind = pick(['white', 'stone', 'stave']),
        stone = kind === 'stone',
        ba = ang + (Math.PI / 2) * side + rnd(-0.04, 0.04),
        c = Math.cos(ba),
        s = Math.sin(ba),
        off = rnd(8, 20),
        bx = cx + c * off,
        by = cy + s * off,
        wall =
          kind === 'white'
            ? '#F0EDE6'
            : kind === 'stave'
              ? '#3B2A1F'
              : pick(['#9A958A', '#A39C8C', '#8C897F', '#D8D2C4']), // grey fieldstone, or lime-washed
        roof = kind === 'stave' ? 'dark' : stone ? pick(['slate', 'slate', 'dark']) : pick(['slate', 'slate', 'dark']),
        at = u => [bx + c * u, by + s * u],
        mk = (u, o) => Object.assign({ cx: at(u)[0], cy: at(u)[1], ang: ba, wall, roof }, o);
      let len, u0, parts, top;
      if (kind === 'stave') {
        const gl = rnd(84, 96), // the gallery round the nave
          cl = 30;
        len = gl + cl - 4;
        u0 = -len / 2;
        const mid = u0 + gl / 2;
        top = 152;
        parts = [
          mk(mid, { len: gl, dep: 78, wh: 12, rh: 36, portal: true }),
          mk(mid, { len: gl - 18, dep: 46, wh: 42, rh: 82, z: 20, dragons: true }),
          mk(u0 + gl - 4 + cl / 2, { len: cl, dep: 36, wh: 22, rh: 46 }),
          mk(mid, { len: 16, dep: 16, wh: 16, rh: 152 - 92, z: 92, spire: true, kind: 'turret' })
        ];
      } else {
        const tw = stone ? 36 : 30,
          nl = rnd(104, 118),
          cl = 34,
          th = stone ? 76 : 64, // tower walls
          sp = stone ? 50 : 94; // and the spire on top
        len = tw + nl + cl - 4;
        u0 = -len / 2;
        top = th + sp;
        parts = [
          mk(u0 + tw / 2, { len: tw, dep: tw, wh: th, rh: th + sp, spire: true, portal: true, kind: 'tower', stone }),
          mk(u0 + tw - 2 + nl / 2, { len: nl, dep: 54, wh: 34, rh: 66, windows: true, tall: true, stone }),
          mk(u0 + tw + nl - 4 + cl / 2, { len: cl, dep: 38, wh: 30, rh: 54, windows: true, tall: true, stone })
        ];
      }
      const b = {
        cx: bx,
        cy: by,
        ang: ba,
        len,
        dep: kind === 'stave' ? 78 : 54,
        wh: 34,
        rh: top,
        wall,
        roof,
        windows: kind !== 'stave', // the stave church has hardly a window; it stands dark at night
        kind: 'church',
        look: kind,
        parts
      };
      // the gate in the wall facing the road, and a short gravel lane to it
      const gx = cx - Ax * (lh / 2),
        gy = cy - Ay * (lh / 2);
      yard.gate = [gx + Ax * 20, gy + Ay * 20];
      yard.door = at(u0 - 12);
      yard.side = side;
      BUILDS.push(b);
      CHURCH = { b, yard, px: p[0], py: p[1] };
      if (kind === 'stave') {
        // a stave church keeps its bells in a free-standing tarred bell tower, off to one side of the gate
        const [bu, bv] = [rnd(0.26, 0.34) * yard.lw * (R() < 0.5 ? 1 : -1), -side * (lh / 2 - 44)],
          [tx, ty] = yardWorld(yard, bu, bv);
        if (!buildAt(tx, ty, 30))
          BUILDS.push({
            cx: tx,
            cy: ty,
            ang: ba + rnd(-0.05, 0.05),
            len: 20,
            dep: 20,
            wh: 34,
            rh: 66,
            wall,
            roof: 'dark',
            spire: true,
            kind: 'belfry'
          });
      }
      LANES.push(
        catmull([
          [p[0], p[1]],
          [lerp(p[0], gx, 0.5), lerp(p[1], gy, 0.5)],
          [gx + Ax * 16, gy + Ay * 16]
        ])
      );
      return;
    }
  };
  let main = placeFarm(true);
  if (!main) {
    const p = ROAD.find(q => q[0] > W * 0.4) || ROAD[(ROAD.length / 2) | 0];
    main = {
      px: p[0],
      py: p[1],
      side: 1,
      cx: p[0],
      cy: p[1] + 430,
      yard: mkYard(p[0], p[1] + 430, 0, 390, 640),
      main: true
    };
  }
  FARMS.push(main);
  YARDS.push(main.yard);
  buildFarm(main);
  placeSty(main);
  const second = placeFarm(false);
  if (second) {
    FARMS.push(second);
    YARDS.push(second.yard);
    buildFarm(second);
    if (R() < 0.5) placeSty(second);
  }
  placeChurch();
  YARD = main.yard;
  START = { x: main.px + 160 * (R() < 0.5 ? 1 : -1), y: main.py + main.side * 40 };
  // each farm's land runs back from the road behind its yard, and for a bigger farm across the road too
  for (const fm of FARMS) {
    const big = !fm.small;
    plotsFor(
      fm,
      fm.side,
      fm.main ? 13 : big ? 8 : 5,
      big ? rnd(1100, 1350) : rnd(700, 850),
      big ? rnd(950, 1150) : 650
    );
    if (big && R() < 0.75) plotsFor(fm, -fm.side, fm.main ? 6 : 4, rnd(600, 900), rnd(500, 750));
  }
  // a small seter clearing with a turf-roofed cabin somewhere else
  for (let i = 0; i < 60; i++) {
    const x = rnd(350, W - 650),
      y = rnd(NORTH, H - 550);
    if (FARMS.some(fm => Math.hypot(wdx(x, fm.cx), y - fm.cy) < 1100)) continue;
    if (CHURCH && Math.hypot(wdx(x, CHURCH.yard.cx), y - CHURCH.yard.cy) < 700) continue;
    if (Math.hypot(x - LAKE.x, y - LAKE.y) < LAKE.r + 450) continue;
    const f = { x, y, w: rnd(260, 380), h: rnd(220, 320), t: 'pasture', dir: 0 };
    if (!fieldOK(f)) continue;
    if (FIELDS.some(o => x < o.x + o.w + 80 && x + f.w > o.x - 80 && y < o.y + o.h + 80 && y + f.h > o.y - 80))
      continue;
    FIELDS.push(f);
    const cb = {
      cx: x + f.w + 60,
      cy: y + f.h * 0.4,
      len: rnd(66, 84),
      dep: rnd(46, 54),
      ang: rnd(-0.35, 0.35),
      roof: R() < 0.7 ? 'turf' : 'slate',
      wall: pick(['#5C3B26', '#7A3A22', '#6B5A48', '#8E2F24']),
      wh: 20,
      rh: 40,
      windows: true
    };
    if (!inWater(cb.cx, cb.cy, 70) && roadDist(cb.cx, cb.cy) > 90 && railDist(cb.cx, cb.cy) > 110) BUILDS.push(cb);
    break;
  }
  if (POND.x > 0) {
    const a = rnd(0, TAU),
      c = {
        cx: POND.x + Math.cos(a) * (POND.r + 75),
        cy: POND.y + Math.sin(a) * (POND.r + 75),
        len: rnd(58, 72),
        dep: rnd(42, 50),
        ang: rnd(-0.4, 0.4),
        roof: R() < 0.6 ? 'turf' : 'slate',
        wall: pick(['#5C3B26', '#7A3A22', '#6B5A48', '#E6E0D2']),
        wh: 20,
        rh: 38,
        windows: true
      };
    if (
      roadDist(c.cx, c.cy) > 90 &&
      railDist(c.cx, c.cy) > 110 &&
      !YARDS.some(Y => inYard(Y, c.cx, c.cy, 80)) &&
      !inChurchyard(c.cx, c.cy, 80) &&
      !FIELDS.some(f => inRect(c.cx, c.cy, f, 60))
    )
      BUILDS.push(c);
  }
  // boathouse facing the road, with a jetty and rowboat
  let best = null,
    bd = 1e9;
  for (const p of ROAD) {
    const d = Math.hypot(p[0] - LAKE.x, p[1] - LAKE.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  const aN = Math.atan2(best[1] - LAKE.y, best[0] - LAKE.x) + rnd(-0.35, 0.35),
    nd = [Math.cos(aN), Math.sin(aN)],
    nr = lakeR(aN);
  NAUST = {
    cx: LAKE.x + nd[0] * (nr + 24),
    cy: LAKE.y + nd[1] * (nr + 24),
    len: 64,
    dep: 38,
    ang: aN,
    roof: 'slate',
    wall: '#8E2F24',
    wh: 16,
    rh: 36,
    trim: true
  };
  BUILDS.push(NAUST);
  const npt = [NAUST.cx + nd[0] * 40, NAUST.cy + nd[1] * 40];
  let rp = best,
    rd = 1e9;
  for (const p of ROAD) {
    const d = Math.hypot(p[0] - npt[0], p[1] - npt[1]);
    if (d < rd) {
      rd = d;
      rp = p;
    }
  }
  if (rd > 60)
    LANES.push(catmull([[rp[0], rp[1]], [lerp(rp[0], npt[0], 0.5) + rnd(-40, 40), lerp(rp[1], npt[1], 0.5)], npt]));
  tg = [-nd[1], nd[0]];
  const shore = [LAKE.x + nd[0] * nr, LAKE.y + nd[1] * nr];
  const js = R() < 0.5 ? 1 : -1;
  JET = {
    x0: shore[0] + tg[0] * 50 * js + nd[0] * 14,
    y0: shore[1] + tg[1] * 50 * js + nd[1] * 14,
    x1: shore[0] + tg[0] * 50 * js - nd[0] * 95,
    y1: shore[1] + tg[1] * 50 * js - nd[1] * 95
  };
  BOAT = { x: JET.x1 + tg[0] * 24 * js, y: JET.y1 + tg[1] * 24 * js, ang: aN + rnd(0.1, 0.5) };
  // forest zones
  ZONES = [];
  const nz = rnd(6, 10) | 0;
  for (let i = 0; i < nz; i++) {
    for (let t = 0; t < 20; t++) {
      const x = rnd(0, W),
        y = rnd(NORTH, H);
      if (FARMS.some(fm => Math.hypot(wdx(x, fm.cx), y - fm.cy) < 700)) continue;
      if (CHURCH && Math.hypot(wdx(x, CHURCH.yard.cx), y - CHURCH.yard.cy) < 600) continue;
      ZONES.push([x, y, rnd(380, 950), rnd(0.22, 0.46)]);
      break;
    }
  }
  placeServices();
  clearAccessLanes();
  LANES = LANES.map(squareLaneCrossings);
  shapeFields();
  buildFieldTracks();
  LAND_NAME = landName();
}
function genWorld(seed) {
  SEED = seed >>> 0;
  R = mulberry32(SEED || 1);
  NS = Math.imul(SEED ^ 0x9e3779b9, 2654435761) | 0;
  perches.length = 0;
  PG.clear();
  TREES.length = 0;
  TG.clear();
  BALES.length = 0;
  FSEG.length = 0;
  LINES.length = 0;
  REEDS.length = 0;
  SPARK.length = 0;
  CROSSINGS.length = 0;
  XSIGNS.length = 0;
  REGIONS = [];
  FIELD_TRACKS = [];
  ACCESS_TRUNKS = [];
  genLayout();
  // trees: forest by noise and zones, hedgerows along fields, birches on the shores
  for (let gx = 0; gx < W; gx += 46)
    for (let gy = -260; gy < H + 320; gy += 46) {
      const x = wrapX(gx + rnd(-17, 17)),
        y = gy + rnd(-17, 17);
      const f = forestness(x, y);
      // thick spruce right at the northern edge, thinning out gradually over the first kilometre;
      // the line itself meanders with x (a slow noise offset) so it reads as a tree line, not a wall,
      // and never quite saturates, so a few gaps and clearings show through even at its densest
      const edgeY = 60 + 260 * (pfbm(x, 0, 900, 3, 2) - 0.5),
        nb = clamp(1 - (y + edgeY) / 1050, 0, 1),
        pn = nb * nb * (0.42 + 0.32 * pfbm(x, y, 150, 3, 3));
      const p = Math.max(f > 0.56 ? Math.min(1, (f - 0.56) * 7) : 0.02, pn);
      if (R() > p) continue;
      let r = rnd(17, 29);
      if (blocked(x, y, r)) continue;
      const u = R(),
        regional = regionWeights(x, y);
      // mixed forest even at its thickest - solid spruce reads as a wall of clones, so birch and
      // deciduous trees keep breaking up the canopy all the way to the northern edge. Regional
      // character shifts the mix without drawing a hard biome boundary.
      let type;
      if (regional.town > 0.45) type = u < 0.1 ? 'spruce' : u < 0.42 ? 'birch' : 'decid';
      else if (regional.lake > 0.58) type = u < 0.1 ? 'spruce' : u < 0.72 ? 'birch' : 'decid';
      else if (regional.highland > 0.52) type = u < 0.62 ? 'spruce' : u < 0.87 ? 'birch' : 'decid';
      else if (nb > 0.55) type = u < 0.55 ? 'spruce' : u < 0.8 ? 'birch' : 'decid';
      else if (f > 0.72) type = u < 0.5 ? 'spruce' : u < 0.78 ? 'birch' : 'decid';
      else if (f > 0.56) type = u < 0.3 ? 'spruce' : u < 0.7 ? 'birch' : 'decid';
      else type = u < 0.55 ? 'birch' : 'decid';
      if (type === 'decid') r *= 1.1;
      addTree(x, y, type, r);
    }
  // hedgerows along open field edges; where a field meets forest, a ragged tree line closes up to it
  for (const f of FIELDS) {
    if (f.t === 'sty') continue; // too small a plot for full-size hedge trees - it'd swallow the pen whole
    const P = f.poly,
      n = P.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const p = P[i],
        q = P[(i + 1) % n];
      area += p[0] * q[1] - q[0] * p[1];
    }
    const sg = area > 0 ? 1 : -1;
    let acc = rnd(0, 30);
    for (let i = 0; i < n; i++) {
      const [x0, y0] = P[i],
        [x1, y1] = P[(i + 1) % n],
        L = Math.hypot(x1 - x0, y1 - y0) || 1,
        nx = ((y1 - y0) / L) * sg,
        ny = (-(x1 - x0) / L) * sg,
        forest = f.edge && f.edge[i] === 2;
      for (; acc < L; acc += forest ? rnd(20, 34) : rnd(40, 70)) {
        const t = acc / L,
          ex = lerp(x0, x1, t),
          ey = lerp(y0, y1, t);
        if (forest) {
          // front rank right on the edge, a looser rank behind it, spruce among the birches
          for (const [pr, d0, d1] of [
            [0.9, 2, 20],
            [0.55, 26, 56]
          ]) {
            if (R() > pr) continue;
            const r = rnd(16, 27),
              d = r * 0.55 + rnd(d0, d1),
              u = R(),
              x = ex + nx * d + rnd(-8, 8),
              y = ey + ny * d + rnd(-8, 8);
            if (!blocked(x, y, r)) addTree(wrapX(x), y, u < 0.4 ? 'spruce' : u < 0.75 ? 'birch' : 'decid', r);
          }
        } else if (R() < 0.5) {
          const r = rnd(15, 23),
            d = r + rnd(4, 12),
            x = ex + nx * d,
            y = ey + ny * d;
          if (!blocked(x, y, r)) addTree(x, y, R() < 0.6 ? 'birch' : 'decid', r);
        }
      }
      acc -= L;
    }
  }
  // hedgerows standing on the hedge strips between plots
  for (const D of DIVIDES) {
    if (D.t !== 'hedge') continue;
    let acc = 0;
    for (let i = 1; i < D.pts.length; i++) {
      const [ax, ay] = D.pts[i - 1],
        [bx, by] = D.pts[i];
      acc += Math.hypot(bx - ax, by - ay);
      if (acc < rnd(30, 52)) continue;
      acc = 0;
      if (R() < 0.22) continue; // a gap in the hedge
      const r = rnd(14, 21),
        u = R(),
        x = bx + rnd(-5, 5),
        y = by + rnd(-5, 5);
      if (!blocked(x, y, r)) addTree(x, y, u < 0.45 ? 'birch' : u < 0.9 ? 'decid' : 'spruce', r);
    }
  }
  for (const [c, rf, st2] of [
    [LAKE, lakeR, 0.055],
    [POND, pondR, 0.12]
  ]) {
    if (c.x < 0) continue;
    for (let a = 0; a < TAU; a += st2) {
      if (R() < 0.5) continue;
      const r = rnd(15, 24),
        d = rf(a) + r + rnd(14, 75);
      const x = c.x + Math.cos(a) * d,
        y = c.y + Math.sin(a) * d;
      if (!blocked(x, y, r)) addTree(x, y, R() < 0.65 ? 'birch' : 'decid', r);
    }
  }
  // old birches and ashes along the churchyard wall, gaps left by the gate
  if (CHURCH) {
    const Y = CHURCH.yard,
      per = 2 * (Y.lw + Y.lh);
    for (let t = rnd(0, 40); t < per; t += rnd(38, 64)) {
      let u, v;
      if (t < Y.lw) ((u = t - Y.lw / 2), (v = -Y.lh / 2));
      else if (t < Y.lw + Y.lh) ((u = Y.lw / 2), (v = t - Y.lw - Y.lh / 2));
      else if (t < 2 * Y.lw + Y.lh) ((u = Y.lw * 1.5 + Y.lh - t), (v = Y.lh / 2));
      else ((u = -Y.lw / 2), (v = per - t - Y.lh / 2));
      if (v * Y.side < -Y.lh / 2 + 5 && Math.abs(u) < 70) continue; // keep the gate and the view of the tower open
      const out = 30 + rnd(0, 10),
        [x, y] = yardWorld(
          Y,
          u + Math.sign(u) * (Math.abs(u) >= Y.lw / 2 - 1 ? out : 0),
          v + Math.sign(v) * (Math.abs(v) >= Y.lh / 2 - 1 ? out : 0)
        ),
        r = rnd(18, 26);
      if (R() < 0.2 || blocked(x, y, r)) continue;
      addTree(x, y, R() < 0.6 ? 'birch' : 'decid', r);
    }
  }
  // bales on stubble, fences round pastures
  for (const f of FIELDS) {
    if (f.t === 'stubble') {
      const area = f.poly ? polyArea(f.poly) : f.w * f.h,
        n = Math.round((area / 26000) * rnd(0.5, 1.2));
      if (R() < 0.6) {
        // rows laid along the plot's heading, as the baler dropped them, from one end of the plot on
        const an = f.ang || 0,
          r = Math.hypot(f.w, f.h) / 2,
          ca = Math.cos(an),
          sa = Math.sin(an),
          pts = [];
        for (let v = -r + 40; v < r; v += 110)
          for (let u = -r + 40; u < r; u += 85) {
            const x = f.x + f.w / 2 + u * ca - v * sa + rnd(-10, 10),
              y = f.y + f.h / 2 + u * sa + v * ca + rnd(-10, 10);
            if (inField(f, x, y, -22)) pts.push([x, y]);
          }
        for (const [x, y] of pts.slice(0, n)) bale(x, y);
      } else
        for (let i = 0; i < n; i++) {
          const x = rnd(f.x + 25, f.x + f.w - 25),
            y = rnd(f.y + 25, f.y + f.h - 25);
          if (inField(f, x, y, -22)) bale(x, y);
        }
    }
    if (f.t === 'pasture' || f.t === 'sty') fenceField(f);
  }
  // level crossings: every place the road or a farm lane crosses the railway, plus a crossbuck sign
  // standing at the roadside on each approach; poles, wires and fences all keep clear of the gap
  for (const x of findCrossings(ROAD, RAIL)) CROSSINGS.push(Object.assign(x, { w: 15 }));
  for (const P of [...LANES, ...FIELD_TRACKS.map(t => t.path)])
    for (const x of findCrossings(P, RAIL)) CROSSINGS.push(Object.assign(x, { w: 10 }));
  const publicCrossings = CROSSINGS.filter(c => c.w >= 13 && c.x >= 0 && c.x < W),
    eligibleUnderpasses = publicCrossings.filter(c => Math.abs(Math.sin(c.ang - c.rang)) > 0.62);
  for (const c of eligibleUnderpasses) c.underpass = hash2(c.x * 0.03, c.y * 0.03) < 0.38;
  if (eligibleUnderpasses.length && !eligibleUnderpasses.some(c => c.underpass))
    eligibleUnderpasses.reduce((best, c) =>
      hash2(c.x * 0.03, c.y * 0.03) < hash2(best.x * 0.03, best.y * 0.03) ? c : best
    ).underpass = true;
  for (const c of CROSSINGS) {
    if (c.w < 13 || c.underpass) continue; // underpasses need no crossbucks or stopping place
    const relA = c.ang - c.rang,
      s = Math.max(Math.abs(Math.sin(relA)), 0.28),
      hl = clamp(26 / s, 26, 70),
      ca = Math.cos(c.ang),
      sa = Math.sin(c.ang),
      at = (u, v) => [c.x + u * ca - v * sa, c.y + u * sa + v * ca];
    XSIGNS.push({ x: at(-(hl + 16), c.w + 10)[0], y: at(-(hl + 16), c.w + 10)[1], ang: c.ang });
    XSIGNS.push({ x: at(hl + 16, -(c.w + 10))[0], y: at(hl + 16, -(c.w + 10))[1], ang: c.ang + Math.PI });
  }
  // power line along the road (on the side away from the farm), branch line up the lane
  wireUp(polesPeriodic(ROAD, 190, 40));
  for (const fm of FARMS) wireUp(polesAlong(LANES[fm.lane], 120, -18, 40));
  wireUp(polesPeriodic(RAIL, 150, 17));
  addPerch(BOAT.x + Math.cos(BOAT.ang) * 8, BOAT.y + Math.sin(BOAT.ang) * 8, 0.12, 'boat', false, BOAT.ang);
  addPerch(BOAT.x - Math.cos(BOAT.ang) * 8, BOAT.y - Math.sin(BOAT.ang) * 8, 0.12, 'boat', false, BOAT.ang + Math.PI);
  for (const b0 of BUILDS)
    for (const b of b0.parts || [b0]) {
      const c = Math.cos(b.ang),
        s = Math.sin(b.ang);
      // one bird can sit on the arm of the cross at the top of the spire
      const z = b.z || 0;
      if (b.spire) addPerch(b.cx, b.cy, (b.rh + z + 9) / HZ, 'roof', false, b.ang, b0.cy + 1);
      else if (b0.parts && b0.parts.some(o => o !== b && o.z && !o.spire && o.cx === b.cx && o.cy === b.cy))
        continue; // the stave church's gallery: its ridge is inside the nave
      else
        for (let lx = -b.len / 2 + 8; lx <= b.len / 2 - 8; lx += 11) {
          if (b.z && Math.abs(lx) < 14) continue; // where the turret stands astride the ridge
          addPerch(b.cx + c * lx, b.cy + s * lx, (b.rh + z) / HZ, 'roof', false, b.ang, b0.cy + 1);
        }
    }
  genSky();
  genBorderBits();
  buildLights();
  buildExtras();
  buildGhosts();
  applySeason(0);
}
/* near the seam, perches and trees get a twin one period over, so birds east of x=W find the trees at x=0.
   Twins share state with their originals (occupancy reads and writes go through to the original). */
function buildGhosts() {
  const M = 720;
  for (const p of perches.slice()) {
    const o = p.x < M ? W : p.x > W - M ? -W : 0;
    if (!o) continue;
    const gh = Object.create(p);
    gh.x = p.x + o;
    Object.defineProperty(gh, 'occ', {
      get() {
        return p.occ;
      },
      set(v) {
        p.occ = v;
      },
      enumerable: true
    });
    gh.orig = p;
    p.gh = gh;
    const k = gkey(gh.x, gh.y, PC);
    let a = PG.get(k);
    if (!a) PG.set(k, (a = []));
    a.push(gh);
  }
  for (const t of TREES) {
    const o = t.x < M ? W : t.x > W - M ? -W : 0;
    if (!o) continue;
    const gh = Object.create(t);
    gh.x = t.x + o;
    gh.orig = t;
    const k = gkey(gh.x, gh.y, TC);
    let a = TG.get(k);
    if (!a) TG.set(k, (a = []));
    a.push(gh);
  }
}
function bale(x, y) {
  if (inWater(x, y)) return;
  const b = { x, y, r: rnd(8.5, 10), g: R() < 0.14 };
  BALES.push(b);
  addPerch(x, y, BALE_H, 'bale', false, null, y + 0.5);
}
function fenceField(f) {
  const IP = insetPoly(f.poly, 6);
  const posts = [];
  const sides = IP.map((p, i) => {
    const q = IP[(i + 1) % IP.length];
    return [p[0], p[1], q[0], q[1]];
  });
  for (const [a, b, c, d] of sides) {
    const L = Math.hypot(c - a, d - b),
      n = Math.max(1, Math.round(L / 34));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      posts.push({ x: lerp(a, c, t), y: lerp(b, d, t) });
    }
  }
  for (const p of posts) addPerch(p.x, p.y, POST_H, 'post', false, null, p.y + 0.5);
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i],
      q = posts[(i + 1) % posts.length];
    if (f.gate && Math.hypot(wdx((p.x + q.x) / 2, f.gate[0]), (p.y + q.y) / 2 - f.gate[1]) < 30) continue;
    FSEG.push({ p, q, k: Math.max(p.y, q.y) });
  }
}
function polesAlong(P, spacing, off, start) {
  const poles = [];
  let acc = start;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, ay] = P[i],
      [bx, by] = P[i + 1];
    const sl = Math.hypot(bx - ax, by - ay);
    if (!sl) continue;
    const nx = (by - ay) / sl,
      ny = -(bx - ax) / sl;
    while (acc < sl) {
      const t = acc / sl;
      const x = ax + (bx - ax) * t + nx * off,
        y = ay + (by - ay) * t + ny * off;
      if (x > -40 && x < W + 40 && !inBuild(x, y, 8) && !nearCrossing(x, y, 45)) poles.push({ x, y });
      acc += spacing;
    }
    acc -= sl;
  }
  return poles;
}
// poles spaced evenly over exactly one period of a repeating line; the last one is a stand-in for the first, one period east
function polesPeriodic(P, spacing, off) {
  const S = [0];
  for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const sAt = x => {
    for (let i = 1; i < P.length; i++)
      if (P[i][0] >= x) {
        const t = (x - P[i - 1][0]) / (P[i][0] - P[i - 1][0] || 1);
        return lerp(S[i - 1], S[i], t);
      }
    return S[S.length - 1];
  };
  const at = s => {
    let i = 1;
    while (i < S.length - 1 && S[i] < s) i++;
    const t = (s - S[i - 1]) / (S[i] - S[i - 1] || 1),
      a = P[i - 1],
      b = P[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: lerp(a[0], b[0], t) + ((b[1] - a[1]) / l) * off, y: lerp(a[1], b[1], t) - ((b[0] - a[0]) / l) * off };
  };
  const s0 = sAt(0),
    Lp = sAt(W) - s0,
    n = Math.max(2, Math.round(Lp / spacing)),
    sp = Lp / n,
    poles = [];
  for (let i = 0; i <= n; i++) {
    const p = at(s0 + sp * (i + 0.5));
    if (i === n) p.ghost = true;
    else if (inBuild(p.x, p.y, 8) || nearCrossing(p.x, p.y, 55)) continue;
    poles.push(p);
  }
  return poles;
}
function wireUp(poles) {
  if (poles.length < 2) return;
  for (let i = 0; i < poles.length; i++) {
    const a = poles[Math.max(0, i - 1)],
      b = poles[Math.min(poles.length - 1, i + 1)];
    poles[i].ang = Math.atan2(b.y - a.y, b.x - a.x);
  }
  for (const p of poles) if (!p.ghost) addPerch(p.x, p.y, POLE_H + 0.05, 'pole', false, p.ang);
  for (let i = 0; i < poles.length - 1; i++) {
    const p = poles[i],
      q = poles[i + 1];
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    const wa = Math.atan2(q.y - p.y, q.x - p.x);
    for (const w of [-6, 6]) {
      const ox = Math.cos(wa + Math.PI / 2) * w,
        oy = Math.sin(wa + Math.PI / 2) * w;
      for (let s = 14; s < L - 10; s += 13) {
        const t = s / L;
        addPerch(lerp(p.x, q.x, t) + ox, lerp(p.y, q.y, t) + oy, WIRE_H - SAG * 4 * t * (1 - t), 'wire', false, wa);
      }
    }
  }
  LINES.push(poles);
}

/* ---------- field outlines ----------
   Plots are planned as rectangles (cheap to keep apart from each other, the road, water and yards), then
   shaped once the whole land is known, the way real farmland is: cleared right up to whatever it meets.
   Each outline starts as a rounded box, and every point on it moves along its normal:
   - with a slow warp of the land that all fields share, so neighbours lean together and the strip
     between two plots stays a strip instead of pinching shut;
   - out to a narrow verge where it faces the road or the railway, so the edge traces their curves;
   - out to the trees where it faces forest, with a ragged margin (genWorld then plants the tree line);
   and never onto anything it must not cover: water, road, rail, lanes, yards, buildings, other plots.
   f.edge marks each outline point 0 open land, 1 road or rail, 2 forest. */
const VERGE = 36, // road or rail centre line to the field edge
  FREACH = 240; // how far an edge may reach out beyond its planned box
// may field f cover the point (x,y)?
function fieldFree(f, x, y) {
  if (x < 30 || x > W - 30 || y < NORTH - 60 || y > H - 400) return false;
  if (inWater(x, y, 26) || roadDist(x, y) < VERGE || railDist(x, y) < VERGE) return false;
  for (const Y of YARDS) if (inYard(Y, x, y, 22)) return false;
  if (inChurchyard(x, y, 22)) return false;
  if (inBuild(x, y, 18)) return false;
  for (const P of LANES) if (polyDist(x, y, P) < 20) return false;
  for (const o of FIELDS) if (o !== f && (o.poly ? inField(o, x, y, 14) : inRect(x, y, o, 4))) return false;
  return true;
}
// a rounded box, sampled about every `step` units clockwise (on screen), with outward normals
function roundBox(f, rc, step) {
  const out = [],
    { x, y, w, h } = f,
    arc = (cx, cy, a0) => {
      const n = Math.max(2, Math.round((rc * Math.PI) / 2 / step));
      for (let k = 0; k < n; k++) {
        const a = a0 + ((k / n) * Math.PI) / 2,
          nx = Math.cos(a),
          ny = Math.sin(a);
        out.push({ x: cx + nx * rc, y: cy + ny * rc, nx, ny, c: 1 });
      }
    },
    line = (x0, y0, x1, y1, nx, ny) => {
      const L = Math.hypot(x1 - x0, y1 - y0),
        n = Math.max(1, Math.round(L / step));
      for (let k = 0; k < n; k++) out.push({ x: lerp(x0, x1, k / n), y: lerp(y0, y1, k / n), nx, ny, c: 0 });
    };
  line(x + rc, y, x + w - rc, y, 0, -1);
  arc(x + w - rc, y + rc, -Math.PI / 2);
  line(x + w, y + rc, x + w, y + h - rc, 1, 0);
  arc(x + w - rc, y + h - rc, 0);
  line(x + w - rc, y + h, x + rc, y + h, 0, 1);
  arc(x + rc, y + h - rc, Math.PI / 2);
  line(x, y + h - rc, x, y + rc, -1, 0);
  arc(x + rc, y + rc, Math.PI);
  return out;
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function polySimple(P) {
  const n = P.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segsCross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false;
    }
  return true;
}
function shapeField(f) {
  const m = Math.min(f.w, f.h),
    rc = m * (0.07 + 0.16 * pfbm(f.x, f.y, 300, 5, 9)),
    B = roundBox(f, rc, 26),
    N = B.length,
    A = Math.min(75, m * 0.18),
    room = new Float32Array(N),
    tgt = new Float32Array(N),
    land = new Float32Array(N),
    edge = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const b = B[i],
      at = t => [b.x + b.nx * t, b.y + b.ny * t],
      free = t => fieldFree(f, ...at(t));
    // how far out this point may go: coarse steps, then halve down onto the obstacle
    let t = 0;
    if (!free(0)) t = -1;
    else {
      while (t < FREACH && free(t + 10)) t += 10;
      if (t < FREACH) for (let d = 5; d >= 1.25; d /= 2) if (free(t + d)) t += d;
    }
    room[i] = t;
    // the shared warp of the land (a slow 2D drift, so facing edges of two plots move together) and a ripple
    const wx = pfbm(b.x, b.y, 420, 17, 53) - 0.5,
      wy = pfbm(b.x, b.y, 420, 61, 29) - 0.5,
      lo = (wx * b.nx + wy * b.ny) * 3.5 * A + (pfbm(b.x, b.y, 110, 7, 91) - 0.5) * m * 0.16;
    let o = lo;
    // forest within reach: clear right up to it
    let tf = -1;
    for (let s = 0; s <= Math.min(t, 200); s += 12)
      if (forestness(...at(s)) > 0.56) {
        tf = s;
        break;
      }
    if (tf >= 0) {
      edge[i] = 2;
      o = tf - 8;
    } else if (t >= 0 && t < (b.c ? 60 : 150)) {
      // the road or railway: close in to a narrow verge, letting go gradually as it bends away
      // (a corner only reaches for one it nearly touches, or it grows a spike along the diagonal)
      const [sx, sy] = at(t + 3);
      if (roadDist(sx, sy) < VERGE + 1 || railDist(sx, sy) < VERGE + 1) {
        const k = b.c ? 1 : clamp((150 - t) / 80, 0, 1);
        o = lerp(Math.min(lo, t), t - 2, k * k * (3 - 2 * k));
        if (k > 0.5) edge[i] = 1;
      }
    }
    land[i] = Math.min(lo, t);
    tgt[i] = o;
  }
  // road-facing points with hardly any straight edge among them are a corner catching the road at a
  // slant: following it would grow a spike
  for (let i = 0; i < N; i++) {
    if (edge[i] !== 1 || edge[(i + N - 1) % N] === 1) continue;
    let k = 0,
      flat = 0;
    for (; k < N && edge[(i + k) % N] === 1; k++) flat += 1 - B[(i + k) % N].c;
    if (flat < 3)
      for (let j = 0; j < k; j++) {
        edge[(i + j) % N] = 0;
        tgt[(i + j) % N] = land[(i + j) % N];
      }
  }
  // smooth along the outline so neighbouring points agree, then roughen the forest edges again
  let off = tgt;
  for (let pass = 0; pass < 3; pass++) {
    const nx = new Float32Array(N);
    for (let i = 0; i < N; i++) nx[i] = (off[(i + N - 1) % N] + 2 * off[i] + off[(i + 1) % N]) / 4;
    off = nx;
  }
  for (let i = 0; i < N; i++)
    if (edge[i] === 2)
      off[i] += (pfbm(B[i].x, B[i].y, 60, 23, 37) - 0.5) * 50 + (pfbm(B[i].x, B[i].y, 23, 3, 71) - 0.5) * 18;
  // a deeply pulled-in point can fold the outline over itself: ease the pull until it can't
  for (let inK = 1; ; inK *= 0.5) {
    const P = B.map((b, i) => {
      const lo = -(b.c ? rc * 0.85 : m * 0.2) * inK,
        o = Math.max(lo, Math.min(off[i], room[i]));
      return [b.x + b.nx * o, b.y + b.ny * o];
    });
    if (inK < 0.1 || polySimple(P)) {
      f.poly = P;
      break;
    }
  }
  f.edge = edge;
  // the planned box becomes the outline's bounds (quick rejects, painting and sampling all use it)
  const xs = f.poly.map(p => p[0]),
    ys = f.poly.map(p => p[1]);
  f.x = Math.min(...xs);
  f.y = Math.min(...ys);
  f.w = Math.max(...xs) - f.x;
  f.h = Math.max(...ys) - f.y;
}
// pig pens, and plots laid out with their final outline already (f.plot), keep the shape they came with
function shapeFields() {
  const own = f => f.t !== 'sty' && !f.plot;
  for (const f of FIELDS) if (own(f)) f.poly = null;
  for (const f of FIELDS) if (own(f)) shapeField(f);
}
function pip(P, x, y) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const xi = P[i][0],
      yi = P[i][1],
      xj = P[j][0],
      yj = P[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function edgeDist(P, x, y) {
  let m = 1e9;
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
    const d = segDist(x, y, a[0], a[1], b[0], b[1]);
    if (d < m) m = d;
  }
  return m;
}
function inField(f, x, y, m = 0) {
  if (!f.poly) return inRect(x, y, f, m);
  if (!inRect(x, y, f, Math.max(0, m) + 1)) return false;
  const inside = pip(f.poly, x, y);
  return m >= 0 ? inside || edgeDist(f.poly, x, y) < m : inside && edgeDist(f.poly, x, y) > -m;
}
/* ---- fences ----
   Pastures and pig sties are fenced. Livestock keep to their own field anyway; wild deer and moose treat
   the fences as walls: they never aim for a spot inside one or along a line across one, and a fleeing
   animal turns along a fence rather than through it. */
const fenced = f => f.t === 'pasture' || f.t === 'sty';
function inFence(x, y, m = 0) {
  for (const f of FIELDS) if (fenced(f) && inField(f, x, y, m)) return f;
  return null;
}
const turn3 = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function crossesFence(x0, y0, x1, y1) {
  for (const f of FIELDS) {
    if (!fenced(f)) continue;
    if (Math.max(x0, x1) < f.x - 2 || Math.min(x0, x1) > f.x + f.w + 2) continue;
    if (Math.max(y0, y1) < f.y - 2 || Math.min(y0, y1) > f.y + f.h + 2) continue;
    const P = f.poly || [
      [f.x, f.y],
      [f.x + f.w, f.y],
      [f.x + f.w, f.y + f.h],
      [f.x, f.y + f.h]
    ];
    for (let i = 0; i < P.length; i++) {
      const [ax, ay] = P[i],
        [bx, by] = P[(i + 1) % P.length];
      if (
        turn3(x0, y0, x1, y1, ax, ay) * turn3(x0, y0, x1, y1, bx, by) <= 0 &&
        turn3(ax, ay, bx, by, x0, y0) * turn3(ax, ay, bx, by, x1, y1) <= 0
      )
        return true;
    }
  }
  return false;
}
function ptIn(r, m) {
  if (!r.poly) return [rr(r.x + m, r.x + r.w - m), rr(r.y + m, r.y + r.h - m)];
  for (let i = 0; i < 30; i++) {
    const x = rr(r.x, r.x + r.w),
      y = rr(r.y, r.y + r.h);
    if (inField(r, x, y, -m)) return [x, y];
  }
  const c = polyCentroid(r.poly);
  return c;
}
function polyCentroid(P) {
  let x = 0,
    y = 0;
  for (const p of P) {
    x += p[0];
    y += p[1];
  }
  return [x / P.length, y / P.length];
}
function insetPoly(P, d) {
  const c = polyCentroid(P);
  return P.map(([x, y]) => {
    const dx = c[0] - x,
      dy = c[1] - y,
      l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * d, y + (dy / l) * d];
  });
}
function xRange(P, y) {
  let lo = 1e9,
    hi = -1e9;
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
    if (a[1] > y !== b[1] > y) {
      const x = a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return lo < hi ? [lo, hi] : null;
}
function fieldPath(c, f) {
  c.beginPath();
  f.poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.closePath();
}

/* ---------- plots cut from a farm's tract ----------
   A plot is built as a convex polygon whose vertices are [x, y, line]: `line` is the straight cut (or
   tract edge) its next side lies on. bendPoly then lets every side bow with a noise read along its own
   line, so the two plots either side of a cut bend together and the strip between them keeps its width. */
const DIV = { balk: [8, 13, 18], ditch: [15, 22, 22], hedge: [44, 58, 24] }; // gap min, max, bend
function mkLine(cx, cy, ang, t) {
  const g = DIV[t] || [0, 0, 32],
    dx = Math.cos(ang),
    dy = Math.sin(ang);
  return { cx, cy, dx, dy, nx: -dy, ny: dx, t, w: rnd(g[0], g[1]), amp: g[2] * rnd(0.7, 1.2), o: rnd(0, 97) };
}
// keep the part of P on the side n points to (n turned by rot); new sides lie on `tag`, or on a fresh edge line
function clipHalf(P, px, py, nx, ny, rot, tag) {
  const c = Math.cos(rot),
    s = Math.sin(rot),
    mx = nx * c - ny * s,
    my = nx * s + ny * c;
  const L = typeof tag === 'string' ? mkLine(px, py, Math.atan2(my, mx) + Math.PI / 2, tag) : tag,
    out = [],
    side = p => (p[0] - px) * mx + (p[1] - py) * my;
  for (let i = 0; i < P.length; i++) {
    const p = P[i],
      q = P[(i + 1) % P.length],
      sp = side(p),
      sq = side(q),
      cross = () => {
        const t = sp / (sp - sq);
        return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
      };
    if (sp >= 0) {
      out.push(p);
      if (sq < 0) out.push([...cross(), L]);
    } else if (sq >= 0) out.push([...cross(), p[2]]);
  }
  return out;
}
function lineBend(L, x, y) {
  const s = (x - L.cx) * L.dx + (y - L.cy) * L.dy,
    qx = L.cx + L.dx * s,
    qy = L.cy + L.dy * s;
  return (pfbm(qx, qy, 240, L.o, 31) * 0.8 + pfbm(qx, qy, 95, L.o + 13, 7) * 0.2 - 0.5) * 2 * L.amp;
}
// where line L crosses convex polygon Q, as distances along L
function lineSpan(Q, L) {
  let lo = 1e9,
    hi = -1e9;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i],
      b = Q[(i + 1) % Q.length],
      sa = (a[0] - L.cx) * L.nx + (a[1] - L.cy) * L.ny,
      sb = (b[0] - L.cx) * L.nx + (b[1] - L.cy) * L.ny;
    if (sa > 0 === sb > 0) continue;
    const t = sa / (sa - sb),
      d = (lerp(a[0], b[0], t) - L.cx) * L.dx + (lerp(a[1], b[1], t) - L.cy) * L.dy;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  return lo < hi ? [lo, hi] : null;
}
function bendPoly(Q) {
  const P = [];
  for (let i = 0; i < Q.length; i++) {
    const c = Q[i],
      nxt = Q[(i + 1) % Q.length],
      L1 = Q[(i + Q.length - 1) % Q.length][2],
      L2 = c[2];
    // the corner moves to where the two bent sides meet
    const d1 = lineBend(L1, c[0], c[1]),
      d2 = lineBend(L2, c[0], c[1]),
      det = L1.nx * L2.ny - L1.ny * L2.nx;
    if (Math.abs(det) > 0.25) P.push([c[0] + (d1 * L2.ny - d2 * L1.ny) / det, c[1] + (L1.nx * d2 - L2.nx * d1) / det]);
    else P.push([c[0] + (L1.nx * d1 + L2.nx * d2) / 2, c[1] + (L1.ny * d1 + L2.ny * d2) / 2]);
    const len = Math.hypot(nxt[0] - c[0], nxt[1] - c[1]),
      n = Math.floor(len / 40);
    for (let k = 1; k < n; k++) {
      const x = lerp(c[0], nxt[0], k / n),
        y = lerp(c[1], nxt[1], k / n),
        o = lineBend(L2, x, y);
      P.push([x + L2.nx * o, y + L2.ny * o]);
    }
  }
  return P;
}
function polyArea(P) {
  let a = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += P[j][0] * P[i][1] - P[i][0] * P[j][1];
  return Math.abs(a) / 2;
}
function polyDiam(P) {
  let m = 0;
  for (const a of P) for (const b of P) m = Math.max(m, Math.hypot(a[0] - b[0], a[1] - b[1]));
  return m;
}
function polyBox(P) {
  const xs = P.map(p => p[0]),
    ys = P.map(p => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
// the heading of a plot's longest side: the way its furrows run
function longAng(Q) {
  let best = 0,
    ang = 0;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[i],
      b = Q[(i + 1) % Q.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) {
      best = l;
      ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  return ang;
}
// the sharpest corner of a polygon, ignoring the near-straight ones a trim can leave
function minAngle(Q) {
  let m = Math.PI;
  for (let i = 0; i < Q.length; i++) {
    const a = Q[(i + Q.length - 1) % Q.length],
      b = Q[i],
      c = Q[(i + 1) % Q.length],
      t = Math.abs(
        Math.atan2(
          (a[0] - b[0]) * (c[1] - b[1]) - (a[1] - b[1]) * (c[0] - b[0]),
          (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1])
        )
      );
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 8 && Math.hypot(c[0] - b[0], c[1] - b[1]) > 8) m = Math.min(m, t);
  }
  return m;
}
