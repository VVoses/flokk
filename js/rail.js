/* Flokk - rail.js
   Railway: track geometry, trains, train sound.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- railway: a generated line across the land, catenary masts, and passing trains ---------- */
let RAIL = null,
  RAILBOX = [0, 0],
  RAILS = [],
  RAILLEN = 0,
  RAIL_S0 = 0,
  RAIL_P = 1;
function railDist(x, y) {
  if (!RAIL || y < RAILBOX[0] - 300 || y > RAILBOX[1] + 300) return 1e9;
  return polyDist(x, y, RAIL);
}
// push a rail control point away from the lake/pond, along x; when the straight push would
// land outside the map's valid band (NORTH-60..H-560), try the other side of the water first,
// since a point simply clamped back into the band can otherwise still land inside the shore
const RAIL_LO = NORTH - 60,
  RAIL_HI = H - 560;
function railDodge(x, yy) {
  for (const [c, extra] of [
    [LAKE, LAKE.r * 0.5 + 240],
    [POND, 160]
  ]) {
    if (c.x < 0) continue;
    const rad = c.r + extra,
      dx = wdx(x, c.x);
    if (Math.abs(dx) >= rad) continue;
    const dy = yy - c.y,
      need = Math.sqrt(rad * rad - dx * dx);
    if (Math.abs(dy) >= need) continue;
    const near = dy >= 0 ? 1 : -1,
      far = c.y + near * need,
      other = c.y - near * need;
    yy = far >= RAIL_LO && far <= RAIL_HI ? far : other;
  }
  return clamp(yy, RAIL_LO, RAIL_HI);
}
// last-resort guarantee on the finished, catmull-smoothed curve: railDodge's push above is generous
// (kept well clear of the shore for looks) and can get clamped back near the water when the map's
// band leaves no room for it, and the smoothing itself can overshoot back toward the water between
// control points. This clears any point still inside the actual (wobbly) lake or pond shore, using
// only the true radius plus a small safety margin, which fits the band far more often than the
// generous push does, so the track can end up snug to the shore here but never crosses it.
function railClear(x, yy) {
  for (const c of [LAKE, POND]) {
    if (c.x < 0) continue;
    const dx = wdx(x, c.x);
    if (Math.abs(dx) > c.r * 1.45) continue; // outside the blob's widest possible reach
    const rad = c.r * 1.4 + 30; // clears the wobbly shore at any angle, plus a safety margin
    if (Math.abs(dx) >= rad) continue;
    const need = Math.sqrt(rad * rad - dx * dx),
      dy = yy - c.y;
    if (Math.abs(dy) >= need) continue;
    const near = dy >= 0 ? 1 : -1,
      far = c.y + near * need,
      other = c.y - near * need,
      farOk = far >= RAIL_LO && far <= RAIL_HI,
      otherOk = other >= RAIL_LO && other <= RAIL_HI;
    yy = farOk
      ? far
      : otherOk
        ? other
        : Math.abs(far - clamp(far, RAIL_LO, RAIL_HI)) < Math.abs(other - clamp(other, RAIL_LO, RAIL_HI))
          ? far
          : other;
  }
  return [x, clamp(yy, RAIL_LO, RAIL_HI)];
}
function genRail() {
  const ry = (ROADBOX[0] + ROADBOX[1]) / 2,
    lower = ry < H / 2;
  let lo = lower ? Math.max(ry + 460, H * 0.48) : NORTH + 40,
    hi = lower ? H - 600 : Math.min(ry - 460, H * 0.52);
  if (hi - lo < 80) {
    lo = H * 0.62;
    hi = H - 600;
  }
  RAIL = null;
  for (let tries = 0; tries < 30 && !RAIL; tries++) {
    const xs = periodXs(720, 960, 600),
      ys = [];
    let y = rnd(lo, hi);
    for (let i = 0; i < xs.length; i++) {
      y = clamp(y + rnd(-120, 120), lo, hi);
      ys.push(y);
    }
    const e = ys[0] - ys[ys.length - 1],
      pts = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const x = xs[i];
      pts.push([x, railDodge(x, clamp(ys[i] + (e * x) / W, lo, hi))]);
    }
    const P = trimX(catmull(extP(pts), 18), -1900, W + 1900);
    if (!P.some(p => inWater(p[0], p[1], 110))) RAIL = P;
  }
  if (!RAIL) {
    // last resort after 30 failed bends: a straight line down the corridor, still dodging
    // the lake and pond by the same rule as above, so it never just cuts through them
    const xs = periodXs(720, 960, 600),
      mid = (lo + hi) / 2,
      pts = xs.map(x => [x, railDodge(x, mid)]);
    RAIL = trimX(catmull(extP(pts), 12), -1900, W + 1900);
  }
  RAIL = RAIL.map(p => railClear(p[0], p[1]));
  RAILBOX = [Math.min(...RAIL.map(p => p[1])), Math.max(...RAIL.map(p => p[1]))];
  RAILS = [0];
  for (let i = 1; i < RAIL.length; i++)
    RAILS.push(RAILS[i - 1] + Math.hypot(RAIL[i][0] - RAIL[i - 1][0], RAIL[i][1] - RAIL[i - 1][1]));
  RAILLEN = RAILS[RAILS.length - 1];
  RAIL_S0 = railSAtX(0);
  RAIL_P = railSAtX(W) - RAIL_S0;
}
function railSAtX(x) {
  for (let i = 1; i < RAIL.length; i++)
    if (RAIL[i][0] >= x) {
      const a = RAIL[i - 1],
        b = RAIL[i],
        t = (x - a[0]) / (b[0] - a[0] || 1);
      return lerp(RAILS[i - 1], RAILS[i], t);
    }
  return RAILLEN;
}
const railWrap = s => RAIL_S0 + ((((s - RAIL_S0) % RAIL_P) + RAIL_P) % RAIL_P);
function railAt(s) {
  s = clamp(s, 0, RAILLEN);
  let lo = 0,
    hi = RAILS.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (RAILS[m] <= s) lo = m;
    else hi = m;
  }
  const t = (s - RAILS[lo]) / (RAILS[hi] - RAILS[lo] || 1),
    a = RAIL[lo],
    b = RAIL[hi];
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
function paintRailBed(winter) {
  strokePoly(g, RAIL, 40, winter ? 'rgba(170,180,195,.18)' : 'rgba(120,108,86,.14)');
  strokePoly(g, RAIL, 24, winter ? '#D3D9DF' : '#8A8276');
  g.fillStyle = winter ? 'rgba(150,160,175,.4)' : 'rgba(70,64,56,.35)';
  g.beginPath();
  for (let i = 0; i < RAILLEN / 2; i++) {
    const p = railAt(R() * RAILLEN),
      o = rnd(-11, 11);
    g.rect(p.x - Math.sin(p.ang) * o, p.y + Math.cos(p.ang) * o, 1.8, 1.8);
  }
  g.fill();
  g.strokeStyle = winter ? '#8A7A6E' : '#57442F';
  g.lineWidth = 2.4;
  g.lineCap = 'butt';
  g.beginPath();
  for (let s = 0; s < RAILLEN; s += 7) {
    const p = railAt(s),
      nx = -Math.sin(p.ang),
      ny = Math.cos(p.ang);
    g.moveTo(p.x - nx * 9, p.y - ny * 9);
    g.lineTo(p.x + nx * 9, p.y + ny * 9);
  }
  g.stroke();
}
function paintRailSteel() {
  for (const o of [-5.5, 5.5]) {
    const P = offsetPoly(RAIL, o);
    strokePoly(g, P, 2, '#55585C');
    strokePoly(g, offsetPoly(RAIL, o - 0.6), 0.7, '#C4CAD0');
  }
}
let TRAIN = null,
  TRAIN_T = 14;
const WAGON_COLS = ['#3E6A8A', '#8A5A2E', '#6E7A3A', '#9A2E2E', '#4A5560', '#C28A2E'];
// liveries: loco colour, coach body, window band, stripe, roof
const LIVERY = [
  { loco: '#B3302A', col: '#B3302A', band: '#8E2620', stripe: '#F2EEE6', top: '#8E9296' },
  { loco: '#C8CDD0', col: '#D9DDDF', band: '#3A4A52', stripe: '#C8342A', top: '#9AA0A4' },
  { loco: '#2E5E4A', col: '#E4E0D4', band: '#2E5E4A', stripe: '#E0B03A', top: '#8A9096' }
];
function spawnTrain() {
  const dir = Math.random() < 0.5 ? 1 : -1,
    freight = Math.random() < 0.45,
    li = (Math.random() * LIVERY.length) | 0,
    lv = LIVERY[li];
  const cars = [
    freight
      ? { k: 'loco', len: 42, h: 0.66, col: '#3E4A52', stripe: '#E0B03A', top: '#5A5E62' }
      : { k: 'loco', len: 40, h: 0.66, col: lv.loco, stripe: lv.stripe, top: '#5A5E62' }
  ];
  const n = freight ? rr(4, 8) | 0 : rr(2, 4) | 0;
  for (let i = 0; i < n; i++) {
    if (!freight)
      cars.push({ k: 'coach', len: 54, h: 0.62, col: lv.col, band: lv.band, stripe: lv.stripe, top: lv.top });
    else {
      const r = Math.random(),
        c = WAGON_COLS[(Math.random() * WAGON_COLS.length) | 0];
      if (r < 0.28) cars.push({ k: 'timber', len: 46, h: 0.46, col: '#4A4038', top: '#8A6A48' });
      else if (r < 0.45)
        cars.push({ k: 'tank', len: 40, h: 0.5, col: ['#2E2E30', '#C9CCCE', '#3E5A44'][(Math.random() * 3) | 0] });
      else if (r < 0.65)
        cars.push({
          k: 'container',
          len: 50,
          h: 0.56,
          col: ['#2F5E9A', '#B3302A', '#C28A2E', '#3E6A5A', '#E4E0D4'][(Math.random() * 5) | 0]
        });
      else cars.push({ k: 'box', len: 46, h: 0.58, col: c, top: shade(c, 0.8) });
    }
  }
  let tot = 0;
  for (const c of cars) tot += c.len + 5;
  const sx = L ? wrapX(L.x + W / 2 + rr(-400, 400)) : rr(0, W);
  TRAIN = {
    dir,
    cars,
    tot,
    v: rr(150, 200),
    vmax: rr(210, 260),
    s: railSAtX(sx),
    dist: 0,
    honked: false,
    scareT: 0,
    // each kind of train has its own horn (a livery always sounds the same), and each engine is tuned a hair apart
    horn: freight ? 'freight' : HORN_OF_LIVERY[li],
    hornP: rr(0.97, 1.03)
  };
}
function updateTrain(dt) {
  if (!RAIL) return;
  if (!TRAIN) {
    TRAIN_T -= dt;
    if (TRAIN_T <= 0 && st.mode !== 'pause') spawnTrain();
    return;
  }
  const tr = TRAIN;
  tr.v += (tr.vmax - tr.v) * Math.min(1, dt * 0.8);
  tr.s += tr.dir * tr.v * dt;
  tr.dist += tr.v * dt;
  let off = 0;
  for (const c of tr.cars) {
    const p = railAt(railWrap(tr.s - tr.dir * (off + c.len / 2)));
    c.x = p.x;
    c.y = p.y;
    c.ang = p.ang + (tr.dir < 0 ? Math.PI : 0);
    off += c.len + 5;
  }
  if (tr.dist > W * 0.9) {
    let far = true;
    if (L) for (const c of tr.cars) if (Math.abs(wdx(c.x, L.x)) < 1700) far = false;
    if (far) {
      TRAIN = null;
      TRAIN_T = rr(45, 95);
      return;
    }
  }
  tr.scareT -= dt;
  if (tr.scareT <= 0) {
    tr.scareT = 0.2;
    for (const b of birds) {
      if (b.state !== 'perch' || (b.perch && b.perch.cover)) continue;
      for (const c of tr.cars)
        if (Math.abs(wdx(c.x, b.x)) < 95 && Math.abs(c.y - b.y) < 70) {
          launch(b);
          b.panic = 1.5;
          b.landCool = 2.5;
          break;
        }
    }
  }
}
function carBox(c) {
  const cs = Math.cos(c.ang),
    sn = Math.sin(c.ang),
    hl = c.len / 2,
    hd = 7.5;
  return { cs, sn, hl, hd };
}
/* ---- drawing the train: bogies and wheels, two-tone bodies, rounded roofs, and per-type detail ---- */
// a box along the car (x0..x1 lengthwise, half-width hd, heights in HZ units); deco(Q, face) paints on each visible side
function tBox(c, x0, x1, hd, h0, h1, col, deco, top) {
  const cs = Math.cos(c.ang),
    sn = Math.sin(c.ang);
  const P = (lx, ly, h) => [c.x + lx * cs - ly * sn, (c.y + lx * sn + ly * cs) * TILT - h * HZ];
  const faces = [
    [x0, -hd, x1, -hd, 0, -1, 'side'],
    [x1, -hd, x1, hd, 1, 0, 'front'],
    [x1, hd, x0, hd, 0, 1, 'side'],
    [x0, hd, x0, -hd, -1, 0, 'back']
  ];
  for (const [ax, ay, bx, by, nx, ny, kind] of faces) {
    const wnx = nx * cs - ny * sn,
      wny = nx * sn + ny * cs;
    if (wny <= 0.02) continue;
    let fc = shade(col, clamp(1 - 0.25 * wnx, 0.62, 1.1));
    if (LIGHT.rim > 0.05 && wnx * LIGHT.rimSide > 0) fc = mixRgb(fc, rimCol(), LIGHT.rim * 0.4 * Math.abs(wnx));
    const Q = (u, h) => P(lerp(ax, bx, u), lerp(ay, by, u), h);
    tPoly([Q(0, h0), Q(1, h0), Q(1, h1), Q(0, h1)], fc);
    if (deco) deco(Q, kind, Math.hypot(bx - ax, by - ay), ax, bx);
  }
  if (top !== false) tPoly([P(x0, -hd, h1), P(x1, -hd, h1), P(x1, hd, h1), P(x0, hd, h1)], top || shade(col, 1.08));
  return P;
}
function tPoly(pts, fill) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
// a band across a face from u0..u1 between heights ha..hb
const band = (Q, u0, u1, ha, hb, col) => tPoly([Q(u0, ha), Q(u1, ha), Q(u1, hb), Q(u0, hb)], col);
function drawCar(c) {
  const hl = c.len / 2,
    hd = 7.2,
    H = c.h,
    night = LIGHT.night,
    cs = Math.cos(c.ang),
    sn = Math.sin(c.ang),
    near = cs >= 0 ? 1 : -1; // the long side facing the camera
  const P = (lx, ly, h) => [c.x + lx * cs - ly * sn, (c.y + lx * sn + ly * cs) * TILT - h * HZ];
  // running gear: two bogies with their wheels showing on the near side
  const bog = hl - Math.min(9, hl * 0.28);
  for (const bx of [-bog, bog]) tBox(c, bx - 6, bx + 6, hd * 0.8, 0.02, 0.13, '#2A2826', null, '#1E1C1A');
  for (const bx of [-bog, bog])
    for (const w of [-3.4, 3.4]) {
      const q = P(bx + w, near * hd * 0.82, 0.07);
      ctx.fillStyle = '#161514';
      ctx.beginPath();
      ctx.ellipse(q[0], q[1], 2.6, 2.8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#6E6A64';
      ctx.beginPath();
      ctx.ellipse(q[0], q[1], 0.9, 1, 0, 0, TAU);
      ctx.fill();
    }
  // gangway bellows to the next coach, couplers between wagons
  if (c.k === 'coach' || c.k === 'loco')
    tBox(c, -hl - 2.6, hl + (c.k === 'loco' ? 0 : 2.6), hd * 0.55, 0.16, H - 0.06, '#26262A', null, '#1C1C20');
  else tBox(c, -hl - 2.6, hl + 2.6, 1, 0.1, 0.14, '#3A3836', null, '#2A2826');
  const top = c.top;
  if (c.k === 'loco') {
    const nose = c.col;
    tBox(
      c,
      -hl,
      hl,
      hd,
      0.13,
      H,
      nose,
      (Q, kind, L2) => {
        band(Q, 0, 1, 0.13, 0.2, '#1E1E22'); // skirt
        if (kind === 'side') {
          band(Q, 0, 1, H * 0.5, H * 0.54, c.stripe); // livery stripe
          const wc = winCol();
          band(Q, 0.05, 0.13, H * 0.62, H * 0.88, wc); // cab windows at both ends
          band(Q, 0.87, 0.95, H * 0.62, H * 0.88, wc);
          band(Q, 0.2, 0.26, 0.24, H * 0.86, shade(nose, 0.78)); // doors
          band(Q, 0.74, 0.8, 0.24, H * 0.86, shade(nose, 0.78));
          for (let i = 0; i < 4; i++) band(Q, 0.34 + i * 0.09, 0.4 + i * 0.09, H * 0.6, H * 0.86, shade(nose, 0.82)); // grilles
        } else {
          band(Q, 0.12, 0.88, H * 0.6, H * 0.9, '#1C2228'); // windscreen
          band(Q, 0.16, 0.84, H * 0.63, H * 0.87, mixHex('#3E5260', '#8FA6B2', 0.4));
          band(Q, 0, 1, H * 0.36, H * 0.46, c.stripe);
          const lit = kind === 'front' ? (night > 0.2 ? '#FFF2C8' : '#E8E4D8') : night > 0.2 ? '#C8342A' : '#6E2A24';
          band(Q, 0.12, 0.24, H * 0.26, H * 0.34, lit); // lamps
          band(Q, 0.76, 0.88, H * 0.26, H * 0.34, lit);
        }
      },
      top
    );
    tBox(c, -hl + 3, hl - 3, hd * 0.72, H, H + 0.05, top, null, shade(top, 1.12)); // roof
    // pantograph up to the wire
    const a = P(-hl * 0.35, 0, H + 0.05),
      m = P(-hl * 0.1, 0, H + 0.28),
      b = P(-hl * 0.35, 0, H + 0.5);
    ctx.strokeStyle = '#2A2A2C';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(m[0], m[1]);
    ctx.lineTo(b[0], b[1]);
    const b1 = P(-hl * 0.35, -4, H + 0.5),
      b2 = P(-hl * 0.35, 4, H + 0.5);
    ctx.moveTo(b1[0], b1[1]);
    ctx.lineTo(b2[0], b2[1]);
    ctx.stroke();
    return;
  }
  if (c.k === 'coach') {
    tBox(
      c,
      -hl,
      hl,
      hd,
      0.13,
      H,
      c.col,
      (Q, kind, L2) => {
        band(Q, 0, 1, 0.13, 0.19, '#1E1E22');
        if (kind !== 'side') {
          band(Q, 0.3, 0.7, 0.22, H * 0.82, shade(c.col, 0.8)); // end door
          return;
        }
        band(Q, 0, 1, H * 0.5, H * 0.88, c.band); // window band
        band(Q, 0, 1, H * 0.46, H * 0.5, c.stripe);
        const n = 7,
          wc = winCol();
        for (let i = 0; i < n; i++) {
          const u = 0.14 + (i / (n - 1)) * 0.72;
          band(Q, u - 0.035, u + 0.035, H * 0.56, H * 0.84, wc);
        }
        for (const u of [0.05, 0.95]) {
          band(Q, u - 0.035, u + 0.035, 0.22, H * 0.86, shade(c.col, 0.72)); // doors with a small window
          band(Q, u - 0.022, u + 0.022, H * 0.58, H * 0.8, wc);
        }
      },
      false
    );
    tBox(c, -hl, hl, hd * 0.86, H, H + 0.05, top, null, shade(top, 1.1)); // rounded roof, two steps
    tBox(c, -hl + 1, hl - 1, hd * 0.55, H + 0.05, H + 0.08, shade(top, 1.05), null, shade(top, 1.16));
    return;
  }
  if (c.k === 'box') {
    tBox(
      c,
      -hl,
      hl,
      hd,
      0.15,
      H,
      c.col,
      (Q, kind) => {
        band(Q, 0, 1, 0.15, 0.2, '#262422');
        const ribs = kind === 'side' ? 12 : 4;
        for (let i = 1; i < ribs; i++) band(Q, i / ribs - 0.006, i / ribs + 0.006, 0.2, H, 'rgba(0,0,0,.16)');
        if (kind === 'side') {
          band(Q, 0.38, 0.62, 0.22, H * 0.94, shade(c.col, 0.86)); // sliding door
          band(Q, 0.36, 0.64, H * 0.95, H * 0.98, '#3A3836'); // its rail
        }
      },
      false
    );
    tBox(c, -hl, hl, hd * 0.9, H, H + 0.04, c.top, null, shade(c.top, 1.1));
    return;
  }
  if (c.k === 'tank') {
    tBox(c, -hl, hl, hd * 0.9, 0.13, 0.19, '#2A2826', null);
    // the barrel: a rounded side, darker underside and a highlight along the top
    tBox(
      c,
      -hl + 2,
      hl - 2,
      hd * 0.85,
      0.19,
      H,
      c.col,
      (Q, kind) => {
        band(Q, 0, 1, 0.19, 0.27, shade(c.col, 0.7));
        band(Q, 0, 1, H - 0.08, H, shade(c.col, 1.15));
      },
      shade(c.col, 1.2)
    );
    const d = P(0, 0, H);
    ctx.fillStyle = '#3A3836';
    ctx.beginPath();
    ctx.ellipse(d[0], d[1] - 1.5, 2.6, 1.6, 0, 0, TAU);
    ctx.fill();
    return;
  }
  // flat wagons: timber or a container
  tBox(c, -hl, hl, hd, 0.13, 0.2, '#3E3630', null, '#4A4038');
  if (c.k === 'timber') {
    for (const u of [-0.8, -0.28, 0.28, 0.8]) {
      for (const s of [-1, 1]) {
        const a = P(u * hl, s * hd, 0.2),
          b = P(u * hl, s * hd, H + 0.12);
        ctx.strokeStyle = '#2A2826';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
    // a stack of logs, their cut ends showing on the end faces
    tBox(
      c,
      -hl + 2,
      hl - 2,
      hd - 1.2,
      0.2,
      H,
      '#7A5A3A',
      (Q, kind) => {
        if (kind === 'side') {
          for (let r = 0; r < 4; r++)
            band(Q, 0, 1, 0.2 + (r * (H - 0.2)) / 4, 0.2 + (r * (H - 0.2)) / 4 + 0.015, 'rgba(40,26,14,.4)');
          return;
        }
        ctx.fillStyle = '#C9A676';
        for (let r = 0; r < 3; r++)
          for (let i = 0; i < 3; i++) {
            const q = Q(0.2 + i * 0.3, 0.26 + r * ((H - 0.3) / 3));
            ctx.beginPath();
            ctx.arc(q[0], q[1], 1.9, 0, TAU);
            ctx.fill();
          }
      },
      '#8A6A48'
    );
    return;
  }
  // container
  tBox(
    c,
    -hl + 1.5,
    hl - 1.5,
    hd - 0.4,
    0.2,
    H,
    c.col,
    (Q, kind) => {
      const ribs = kind === 'side' ? 16 : 5;
      for (let i = 1; i < ribs; i++) band(Q, i / ribs - 0.005, i / ribs + 0.005, 0.22, H - 0.02, 'rgba(0,0,0,.15)');
      if (kind !== 'side') for (const u of [0.35, 0.65]) band(Q, u - 0.01, u + 0.01, 0.24, H - 0.04, 'rgba(0,0,0,.35)');
    },
    shade(c.col, 1.1)
  );
}
function trainShadowHulls(c2) {
  if (!TRAIN) return;
  for (const c of TRAIN.cars) {
    if (!visG(c.x, c.y, 120)) continue;
    const { cs, sn, hl, hd } = carBox(c),
      pts = [];
    const q = c.h;
    for (const [lx, ly] of [
      [-hl, -hd],
      [hl, -hd],
      [hl, hd],
      [-hl, hd]
    ]) {
      pts.push([c.x + lx * cs - ly * sn, c.y + lx * sn + ly * cs]);
      pts.push([c.x + lx * cs - ly * sn + q * SX, c.y + lx * sn + ly * cs + q * SY]);
    }
    const H2 = hull(pts);
    c2.beginPath();
    H2.forEach((p, i) => (i ? c2.lineTo(p[0], p[1]) : c2.moveTo(p[0], p[1])));
    c2.closePath();
    c2.fill();
  }
}
function trainLights() {
  const out = [];
  if (!TRAIN || LIGHT.night < 0.05) return out;
  const f = TRAIN.cars[0];
  // the source sits right at the nose (f.len/2 out along its heading) and at the lamp bands'
  // actual height on the nose face (H*0.26..0.34, see drawCar's loco deco) rather than a flat
  // guess, so the glow doesn't drift off the front of a locomotive that's longer or shorter
  // than whichever one the constants were eyeballed against.
  out.push({
    x: f.x + Math.cos(f.ang) * (f.len / 2),
    y: f.y + Math.sin(f.ang) * (f.len / 2),
    h: f.h * 0.3,
    r: 240,
    i: 1,
    fl: 0,
    dir: f.ang
  });
  for (const c of TRAIN.cars) if (c.k === 'coach') out.push({ x: c.x, y: c.y, h: 0.45, r: 58, i: 0.55, fl: 0 });
  return out;
}
function trainNear(x, y, r) {
  if (!TRAIN) return false;
  for (const c of TRAIN.cars) if (Math.abs(wdx(c.x, x)) < r && Math.abs(c.y - y) < r) return true;
  return false;
}

/* ---------- train sound ---------- */
function clack(v) {
  if (!ac || muted) return;
  const t = ac.currentTime;
  for (const d of [0, 0.09]) {
    const s = ac.createBufferSource();
    s.buffer = amb.noise;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 1.4;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(v, t + d);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
    s.connect(f).connect(gn).connect(master);
    s.start(t + d, Math.random() * 3);
    s.stop(t + d + 0.06);
  }
}
// train horns: chord notes (Hz), how bright the reeds are, and the blasts [start, length, pitch bend]
const HORNS = {
  // the red regional: the familiar two-tone, long then longer
  regional: {
    f: [311, 392],
    cut: 1150,
    wave: 'sawtooth',
    blasts: [
      [0, 0.7, 1],
      [0.95, 1.1, 1]
    ]
  },
  // the silver express: a brighter three-note chord, a short tap then a long call
  express: {
    f: [440, 554, 659],
    cut: 1700,
    wave: 'sawtooth',
    blasts: [
      [0, 0.3, 1],
      [0.45, 1.3, 1]
    ]
  },
  // the old green line: a soft, hollow whistle whose one long note sags as it fades
  old: { f: [392, 523], cut: 1400, wave: 'triangle', blasts: [[0, 1.5, 0.93]] },
  // freight: a deep, heavy minor third, one long bellow and a short grunt after it
  freight: {
    f: [175, 208],
    cut: 800,
    wave: 'sawtooth',
    blasts: [
      [0, 1.4, 0.98],
      [1.65, 0.45, 1]
    ]
  }
};
const HORN_OF_LIVERY = ['regional', 'express', 'old'];
function horn(v, tr = {}, pan = 0) {
  if (!ac || muted) return;
  const t = ac.currentTime + 0.05,
    H = HORNS[tr.horn] || HORNS.regional,
    hp = tr.hornP || 1;
  for (const [t0, d, bend] of H.blasts) {
    const out = ac.createGain(),
      lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    // a lowpass shaves off the buzzy top edge of the chord, and a slow fade in/out
    // eases the blast in and out instead of snapping on like an alarm
    lp.frequency.value = H.cut;
    out.gain.setValueAtTime(0, t + t0);
    out.gain.linearRampToValueAtTime(v * (H.g || 1), t + t0 + 0.14);
    out.gain.setValueAtTime(v * (H.g || 1), t + t0 + d - 0.18);
    out.gain.linearRampToValueAtTime(0, t + t0 + d);
    lp.connect(out);
    const p = panned(out, pan);
    p.connect(master);
    p.connect(verb);
    for (const f of H.f) {
      const o = ac.createOscillator();
      o.type = H.wave;
      // the reeds of one horn are never quite in tune with each other: a slow beating
      o.frequency.setValueAtTime(f * hp * (1 + (Math.random() - 0.5) * 0.006), t + t0);
      o.frequency.linearRampToValueAtTime(f * hp * bend, t + t0 + d);
      o.connect(lp);
      o.start(t + t0);
      o.stop(t + t0 + d + 0.05);
    }
  }
}
