/* Flokk - traffic.js
   Occasional road traffic: a car, a van or a tractor (sometimes with a trailer) driving the looping road.
   Kept sparse on purpose: at most one vehicle at a time, with long quiet gaps in between.
   Vehicles enter and leave out of sight, drive on the right, light the road at night and flush birds sitting low by the road.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';

let TRAFFIC = [],
  TRAFFIC_T = 18;
// arc-length table for the road, rebuilt whenever a new land is generated
const RD = { ref: null, S: [], S0: 0, P: 1, len: 0 };
function roadInit() {
  RD.ref = ROAD;
  RD.S = [0];
  for (let i = 1; i < ROAD.length; i++)
    RD.S.push(RD.S[i - 1] + Math.hypot(ROAD[i][0] - ROAD[i - 1][0], ROAD[i][1] - ROAD[i - 1][1]));
  RD.len = RD.S[RD.S.length - 1];
  const sAt = x => {
    for (let i = 1; i < ROAD.length; i++)
      if (ROAD[i][0] >= x) {
        const a = ROAD[i - 1],
          b = ROAD[i];
        return lerp(RD.S[i - 1], RD.S[i], (x - a[0]) / (b[0] - a[0] || 1));
      }
    return RD.len;
  };
  RD.S0 = sAt(0);
  RD.P = sAt(W) - RD.S0;
  RD.sAt = sAt;
}
// point and heading on the road at arc length s (wrapped into one period, so always within [0,W))
function roadAt(s) {
  s = RD.S0 + ((((s - RD.S0) % RD.P) + RD.P) % RD.P);
  let lo = 0,
    hi = RD.S.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (RD.S[m] <= s) lo = m;
    else hi = m;
  }
  const a = ROAD[lo],
    b = ROAD[hi],
    t = (s - RD.S[lo]) / (RD.S[hi] - RD.S[lo] || 1);
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

const CAR_COLS = ['#E8E6E0', '#B9BCBE', '#2E4A6E', '#8E2A22', '#1E2224', '#3E5A44', '#C9B98E'];
const TRACTOR_COLS = ['#B3302A', '#3E7A3A', '#2F5E9A'];
function spawnVehicle() {
  if (RD.ref !== ROAD) roadInit();
  const day = LIGHT.night < 0.35,
    r = Math.random();
  let kind = r < 0.62 ? 'car' : r < 0.82 ? 'van' : 'tractor';
  if (kind === 'tractor' && (!day || SEASON === 3)) kind = 'car';
  const dir = Math.random() < 0.5 ? 1 : -1;
  // enter half a world away from the flock, so it always drives in from out of sight
  const sx = L ? wrapX(L.x + W / 2 + rr(-300, 300)) : rr(0, W);
  const v = {
    kind,
    dir,
    s: RD.sAt(sx),
    dist: 0,
    col: kind === 'tractor' ? pickP(TRACTOR_COLS) : pickP(CAR_COLS),
    vmax: kind === 'tractor' ? rr(34, 44) : kind === 'van' ? rr(95, 120) : rr(105, 145),
    len: kind === 'tractor' ? 28 : kind === 'van' ? 42 : 38,
    hd: kind === 'tractor' ? 8 : 8.5,
    trailer: kind === 'tractor' && Math.random() < 0.55,
    scareT: 0,
    x: 0,
    y: 0,
    ang: 0
  };
  v.engineOn = true;
  v.v = 0;
  v.bales = v.trailer && SEASON === 2;
  const destinations = vehicleDestinations();
  const origins = destinations.filter(d => !inView(...d.point, 220));
  if (!origins.length || destinations.length < 2) return;
  const origin = pickP(origins),
    targets = destinations.filter(
      d => Math.hypot(wdx(d.point[0], origin.point[0]), d.point[1] - origin.point[1]) > 120
    );
  if (!targets.length) return;
  const target = pickP(targets);
  v.route = makeJourney(origin.point, target.point);
  v.destination = target.point;
  v.stop = target;
  v.stopKind = target.name;
  v.s = 0;
  TRAFFIC.push(v);
  placeVehicle(v, 0);
}
function spawnResidentCars() {
  const homes = vehicleDestinations().filter(d => d.name === 'farm');
  for (let i = 0; i < homes.length; i++) {
    if (i > 0 && hash2(i + 17, homes[i].point[0] * 0.01) > 0.72) continue;
    const x = homes[i].point[0] - Math.sin(homes[i].ang) * 22,
      y = homes[i].point[1] + Math.cos(homes[i].ang) * 22;
    TRAFFIC.push({
      kind: 'car',
      resident: true,
      engineOn: false,
      parkT: Infinity,
      x: wrapX(x),
      y,
      ang: homes[i].ang,
      col: CAR_COLS[(hash2(i, homes[i].point[1]) * CAR_COLS.length) | 0],
      len: 38,
      hd: 8.5,
      v: 0,
      scareT: Infinity
    });
  }
}
function driverExit(v) {
  if (v.kind === 'tractor' || v.driverOut) return;
  v.driverOut = true;
  v.doorT = 2.2;
  const side = hash2(v.x * 0.01, v.y * 0.01) < 0.5 ? -1 : 1,
    cs = Math.cos(v.ang),
    sn = Math.sin(v.ang),
    x = v.x - sn * side * (v.hd + 4),
    y = v.y + cs * side * (v.hd + 4),
    away = [x - sn * side * 30 - cs * 8, y + cs * side * 30 - sn * 8];
  ANIMALS.push(mkPerson('walker', x, y, { role: 'arrival', arrivalGo: away, fade: 1 }));
}
function placeVehicle(v, dt) {
  if (v.resident || !v.route) return;
  if (v.parkT > 0) {
    v.parkT -= dt;
    v.doorT = Math.max(0, (v.doorT || 0) - dt);
    v.v = 0;
    return;
  }
  if (v.s >= v.route.length - 0.2) {
    const arrived = v.stop;
    v.x = wrapX(v.destination[0]);
    v.y = v.destination[1];
    if (arrived?.ang !== undefined) v.ang = arrived.ang;
    const choices = vehicleDestinations().filter(
      d => Math.hypot(wdx(d.point[0], v.destination[0]), d.point[1] - v.destination[1]) > 120
    );
    if (!choices.length) return;
    const target = pickP(choices);
    v.route = makeJourney(v.destination, target.point);
    v.destination = target.point;
    v.stop = target;
    v.stopKind = target.name;
    v.s = 0;
    v.parkT = rr(18, 38);
    v.v = 0;
    v.engineOn = false;
    v.driverOut = false;
    driverExit(v);
    return;
  }
  const here = journeyAt(v.route, v.s),
    near = journeyAt(v.route, v.s + 32),
    ahead = journeyAt(v.route, v.s + Math.max(70, v.v * 1.25)),
    bend = Math.max(Math.abs(angDiff(near.ang, here.ang)), Math.abs(angDiff(ahead.ang, here.ang)) * 0.72),
    room = Math.min(v.route.length - v.s, crossingRoom(v.route, v.s, v.len / 2)),
    onRoad = roadDist(wrapX(here.x), here.y) < 20,
    curveSpeed = bend > 0.08 ? clamp(48 / Math.sqrt(bend + 0.04), 18, 70) : v.vmax,
    want = Math.min(onRoad ? v.vmax : 25, curveSpeed, Math.sqrt(2 * 60 * Math.max(0, room)));
  v.engineOn = true;
  v.v = Math.max(0, v.v + clamp(want - v.v, -100 * dt, 32 * dt));
  const step = Math.min(v.v * dt, room);
  v.s += step;
  v.dist += step;
  const p = journeyAt(v.route, v.s),
    ta = journeyAt(v.route, Math.max(0, v.s - 8)),
    tb = journeyAt(v.route, Math.min(v.route.length, v.s + 8)),
    tangent = Math.atan2(tb.y - ta.y, wdx(tb.x, ta.x)),
    lane = onRoad ? 4 : 1.5;
  v.x = wrapX(p.x - Math.sin(tangent) * lane);
  v.y = p.y + Math.cos(tangent) * lane;
  v.ang = tangent;
  if (v.trailer) {
    const ts = Math.max(0, v.s - (v.len / 2 + 20)),
      q = journeyAt(v.route, ts),
      qa = journeyAt(v.route, Math.max(0, ts - 8)),
      qb = journeyAt(v.route, Math.min(v.route.length, ts + 8));
    v.tr = { x: v.x + wdx(q.x, v.x), y: q.y, ang: Math.atan2(qb.y - qa.y, wdx(qb.x, qa.x)) };
  }
}

function updateTraffic(dt) {
  if (!ROAD) return;
  if (RD.ref !== ROAD) {
    roadInit();
    TRAFFIC = [];
    spawnResidentCars();
  }
  let moving = false;
  for (const v of TRAFFIC)
    if (!v.resident) {
      moving = true;
      break;
    }
  if (!moving) {
    TRAFFIC_T -= dt;
    if (TRAFFIC_T <= 0 && st.mode !== 'pause') {
      spawnVehicle();
      TRAFFIC_T = rr(35, 80) * (LIGHT.night > 0.6 ? 1.8 : 1);
    }
  }
  let write = 0;
  for (const v of TRAFFIC) {
    placeVehicle(v, dt);
    v.scareT -= dt;
    if (v.scareT <= 0) {
      v.scareT = 0.25;
      if (!v.resident && v.engineOn) scatterFlock(v.x, v.y, v.kind === 'tractor' ? 45 : 55);
    }
    if (!(v.parkT <= 0 && v.dist > W * 0.9 && (!L || Math.abs(wdx(v.x, L.x)) > 1700))) TRAFFIC[write++] = v;
  }
  // gone once it has done most of a lap and nobody can see it
  TRAFFIC.length = write;
}
function trafficNear(x, y, r) {
  for (const v of TRAFFIC) if (Math.abs(wdx(v.x, x)) < r && Math.abs(v.y - y) < r) return v;
  return null;
}

/* ---- drawing: small boxes projected like the train cars ---- */
function vBox(o, x0, x1, hd, h0, h1, col, glass) {
  const cs = Math.cos(o.ang),
    sn = Math.sin(o.ang);
  const P = (lx, ly, h) => [o.x + lx * cs - ly * sn, (o.y + lx * sn + ly * cs) * TILT - h * HZ];
  const poly = (pts, fill) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const sides = [
    [x0, -hd, x1, -hd, 0, -1],
    [x1, -hd, x1, hd, 1, 0],
    [x1, hd, x0, hd, 0, 1],
    [x0, hd, x0, -hd, -1, 0]
  ];
  for (const [ax, ay, bx, by, nx, ny] of sides) {
    const wnx = nx * cs - ny * sn,
      wny = nx * sn + ny * cs;
    if (wny <= 0.02) continue;
    let c = shade(col, clamp(1 - 0.25 * wnx, 0.62, 1.1));
    if (LIGHT.rim > 0.05 && wnx * LIGHT.rimSide > 0) c = mixRgb(c, rimCol(), LIGHT.rim * 0.4 * Math.abs(wnx));
    poly([P(ax, ay, h0), P(bx, by, h0), P(bx, by, h1), P(ax, ay, h1)], c);
    if (glass) {
      // a band of window across the upper part of each face
      const g = (u, h) => P(lerp(ax, bx, u), lerp(ay, by, u), h);
      poly(
        [g(0.12, h0 + (h1 - h0) * 0.35), g(0.88, h0 + (h1 - h0) * 0.35), g(0.84, h1 - 0.02), g(0.16, h1 - 0.02)],
        glassCol()
      );
    }
  }
  poly([P(x0, -hd, h1), P(x1, -hd, h1), P(x1, hd, h1), P(x0, hd, h1)], shade(col, 1.08));
  return P;
}
const glassCol = () => (LIGHT.night > 0.4 ? '#1A2230' : mixHex('#5E7482', '#9DB4C0', 0.4));
function wheel(P, lx, ly, r) {
  const c = P(lx, ly, r / HZ);
  ctx.fillStyle = '#1C1A18';
  ctx.beginPath();
  ctx.ellipse(c[0], c[1], r * 0.95, r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6A6660';
  ctx.beginPath();
  ctx.ellipse(c[0], c[1], r * 0.35, r * 0.38, 0, 0, TAU);
  ctx.fill();
}
function drawVehicle(v) {
  const hl = v.len / 2,
    hd = v.hd,
    side = Math.cos(v.ang) >= 0 ? 1 : -1; // the long side facing the camera
  if (v.tr) {
    const t = { x: v.tr.x, y: v.tr.y, ang: v.tr.ang };
    const P = vBox(t, -14, 14, 7.5, 0.1, 0.2, '#6E6258');
    wheel(P, 0, side * 7.5, 4);
    if (v.bales) {
      ctx.fillStyle = '#E1E5DE';
      for (const lx of [-7, 7]) {
        const c = P(lx, 0, 0.36);
        ctx.beginPath();
        ctx.ellipse(c[0], c[1], 7, 6.5, 0, 0, TAU);
        ctx.fill();
      }
    }
  }
  if (v.kind === 'tractor') {
    const P = vBox(v, -hl * 0.1, hl, hd * 0.62, 0.12, 0.3, v.col); // bonnet
    vBox(v, -hl, -hl * 0.1, hd, 0.12, 0.52, v.col, true); // cab
    wheel(P, -hl * 0.55, side * (hd + 1), 7.5);
    wheel(P, hl * 0.62, side * (hd * 0.7), 4.5);
    const ex = P(hl * 0.55, -side * 2, 0.46),
      eb = P(hl * 0.55, -side * 2, 0.3);
    ctx.strokeStyle = '#2A2826';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(eb[0], eb[1]);
    ctx.lineTo(ex[0], ex[1]);
    ctx.stroke();
    return;
  }
  const van = v.kind === 'van';
  const P = vBox(v, -hl, hl, hd, 0.07, van ? 0.24 : 0.2, v.col);
  if (van) vBox(v, -hl, hl * 0.35, hd * 0.96, 0.24, 0.44, v.col, true);
  else vBox(v, -hl * 0.55, hl * 0.3, hd * 0.9, 0.2, 0.34, v.col, true);
  wheel(P, -hl * 0.62, side * hd, 3.4);
  wheel(P, hl * 0.62, side * hd, 3.4);
  if (v.doorT > 0) {
    const open = Math.sin(clamp(v.doorT / 2.2, 0, 1) * Math.PI),
      hinge = P(-hl * 0.25, side * hd, 0.19),
      tip = P(-hl * 0.25 - 13 * open, side * (hd + 8 * open), 0.19);
    ctx.strokeStyle = shade(v.col, 0.72);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hinge[0], hinge[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
  }
  // headlamps glow on the nose at dusk and night
  if (v.engineOn && LIGHT.night > 0.25) {
    for (const s2 of [-1, 1]) {
      const c = P(hl, s2 * hd * 0.6, 0.15);
      ctx.fillStyle = `rgba(255,236,180,${0.4 + 0.6 * LIGHT.night})`;
      ctx.beginPath();
      ctx.arc(c[0], c[1], 1.6, 0, TAU);
      ctx.fill();
    }
  }
}
function vehicleShadows(c) {
  for (const v of TRAFFIC) {
    const parts = [[v, v.len / 2, v.hd, v.kind === 'tractor' ? 0.5 : v.kind === 'van' ? 0.44 : 0.34]];
    if (v.tr) parts.push([v.tr, 14, 7.5, 0.2]);
    for (const [o, hl, hd, h] of parts) {
      if (!visG(o.x, o.y, 80)) continue;
      const cs = Math.cos(o.ang),
        sn = Math.sin(o.ang),
        pts = [];
      for (const [lx, ly] of [
        [-hl, -hd],
        [hl, -hd],
        [hl, hd],
        [-hl, hd]
      ]) {
        const x = o.x + lx * cs - ly * sn,
          y = o.y + lx * sn + ly * cs;
        pts.push([x, y], [x + h * SX, y + h * SY]);
      }
      const H2 = hull(pts);
      c.beginPath();
      H2.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fill();
    }
  }
}
// headlight beams thrown ahead of each vehicle at night - the source sits right at the nose, where
// the headlamp dots in drawVehicle are actually drawn (v.len/2 along its heading), not a fixed
// offset: a van's nose is further out than a tractor's, and a flat guess drifted off the front of
// each by a different amount.
function trafficLights() {
  const out = [];
  if (LIGHT.night < 0.05) return out;
  for (const v of TRAFFIC)
    if (v.engineOn)
      out.push({
        x: v.x + Math.cos(v.ang) * (v.len / 2),
        y: v.y + Math.sin(v.ang) * (v.len / 2),
        h: 0.15,
        r: 170,
        i: 0.9,
        fl: 0,
        dir: v.ang
      });
  return out;
}
