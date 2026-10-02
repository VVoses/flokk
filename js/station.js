/* Flokk - station.js
   The roadside petrol station: a low flat-roofed kiosk, a paved forecourt, a flat canopy on pillars over a
   pump island, and a price pylon by the road. The kiosk itself is an ordinary building (regions.js,
   drawBuilding); everything out front is placed once by buildLights (light.js) and drawn as painter items
   (kind 12, drawProp in yard.js). Local coordinates: x runs along the kiosk's front, y out towards the road.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const ST = {
  hl: 42, // canopy half-length
  y0: 24, // canopy spans y0..y1 in front of the kiosk's centre
  y1: 78,
  top: 25, // height of the canopy deck
  fas: 5, // the fascia band hangs this far below it
  pump: 24 // pump x offset from the island's middle
};
// the pumps stand on the camera's side of the car's bay (which is 55 out), so the deck never hides them
const stIsY = b => (Math.cos(b.ang) > 0 ? 72 : 37);
const stW = (b, lx, ly) => {
  const c = Math.cos(b.ang),
    s = Math.sin(b.ang);
  return [b.cx + lx * c - ly * s, b.cy + lx * s + ly * c];
};
function placeStation(b) {
  const [cx, cy] = stW(b, 0, (ST.y0 + ST.y1) / 2),
    isY = stIsY(b),
    [ix, iy] = stW(b, 0, isY),
    corners = [-1, 1].flatMap(sx => [ST.y0, ST.y1].map(ly => stW(b, sx * ST.hl, ly)));
  // the pumps stand on their island in front of the cars; the canopy over them sorts by its nearest edge
  PROPS.push({ k: 'pumps', x: ix, y: iy, b, isY, key: iy + 3 });
  PROPS.push({ k: 'canopy', x: cx, y: cy, b, key: Math.max(...corners.map(p => p[1])) + 1 });
  const side = hash2(b.cx | 0, b.cy | 0) < 0.5 ? -1 : 1,
    [px, py] = stW(b, side * (ST.hl + 18), ST.y1 - 6);
  PROPS.push({ k: 'pylon', x: px, y: py });
  LIGHTS.push({ x: cx, y: cy, h: (ST.top - 4) / HZ, r: 105, i: 1, fl: 0 });
  LIGHTS.push({ x: px, y: py, h: 0.4, r: 46, i: 0.6, fl: 0 });
}
// a box: its camera-facing sides (lit like a building's walls) and its top
function stBox(b, x0, y0, x1, y1, z0, z1, wall, top) {
  const c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    P = (lx, ly, h) => [b.cx + lx * c - ly * s, (b.cy + lx * s + ly * c) * TILT - h],
    poly = (pts, fill) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
  for (const [ax, ay, bx, by, nx, ny] of [
    [x0, y0, x1, y0, 0, -1],
    [x1, y0, x1, y1, 1, 0],
    [x1, y1, x0, y1, 0, 1],
    [x0, y1, x0, y0, -1, 0]
  ]) {
    const wnx = nx * c - ny * s,
      wny = nx * s + ny * c;
    if (wny <= 0.02) continue;
    poly(
      [P(ax, ay, z0), P(bx, by, z0), P(bx, by, z1), P(ax, ay, z1)],
      shade(wall, clamp(1 - 0.28 * wnx - 0.08, 0.62, 1.12))
    );
  }
  if (top) poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
}
const stFas = () => mixHex('#EDEBE4', '#FFF1CC', clamp(LIGHT.night * 1.2, 0, 1));
function drawStationProp(p) {
  const b = p.b;
  if (p.k === 'pylon') return drawPylon(p);
  const c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    P = (lx, ly, h) => [b.cx + lx * c - ly * s, (b.cy + lx * s + ly * c) * TILT - h],
    poly = (pts, fill, stroke) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const q of pts) ctx.lineTo(q[0], q[1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    },
    ww = winterW(),
    night = clamp(LIGHT.night * 1.3, 0, 1);
  if (p.k === 'pumps') {
    // the island: a low kerbed slab, a pump at each end, and the hose looped on its holster
    stBox(
      b,
      -32,
      p.isY - 3.6,
      32,
      p.isY + 3.6,
      0,
      1.7,
      mixHex('#B9B6AA', '#E2E7EA', ww),
      mixHex('#CFCCC0', '#F2F5F8', ww)
    );
    [
      ['#B63A30', '#E4E3DC'],
      ['#2A2B2C', '#E4E3DC']
    ].forEach(([band, body], i) => {
      const x = (i ? 1 : -1) * ST.pump;
      stBox(b, x - 3.3, p.isY - 1.9, x + 3.3, p.isY + 1.9, 1.7, 15, body, shade(band, 1));
      stBox(b, x - 3.5, p.isY - 2.1, x + 3.5, p.isY + 2.1, 12.8, 15.4, band, shade(band, 1.15));
      const face = c > 0 ? 1 : -1, // which long side the camera sees
        fy = p.isY + face * 2;
      poly([P(x - 2.4, fy, 11.6), P(x + 2.4, fy, 11.6), P(x + 2.4, fy, 7.6), P(x - 2.4, fy, 7.6)], '#25302F');
      if (night > 0.2) {
        ctx.fillStyle = `rgba(190,235,170,${0.8 * night})`;
        const a = P(x - 1.8, fy, 10.6),
          q = P(x + 1.8, fy, 9);
        ctx.fillRect(Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.abs(q[0] - a[0]), Math.abs(q[1] - a[1]));
      }
      const h0 = P(x + 3.3, fy, 7),
        h1 = P(x + 7.5, fy, 2.5),
        h2 = P(x + 3.3, fy, 3.2);
      ctx.beginPath();
      ctx.moveTo(h0[0], h0[1]);
      ctx.quadraticCurveTo(h1[0], h1[1], h2[0], h2[1]);
      ctx.strokeStyle = '#1F1F1F';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    });
    return;
  }
  // the canopy: four pillars, a flat deck with a white fascia band and a red stripe, lit from beneath at night
  const pil = [-1, 1].flatMap(sx => [ST.y0 + 4, ST.y1 - 4].map(ly => [sx * (ST.hl - 4), ly]));
  const pw = pil.map(([lx, ly]) => stW(b, lx, ly)[1]),
    mid = (pw[0] + pw[1] + pw[2] + pw[3]) / 4;
  const pillar = ([lx, ly]) => {
    stBox(b, lx - 1.4, ly - 1.4, lx + 1.4, ly + 1.4, 0, ST.top - ST.fas, '#D6D5CD');
    stBox(b, lx - 1.5, ly - 1.5, lx + 1.5, ly + 1.5, 0, 3, '#B63A30');
  };
  pil.filter((q, i) => pw[i] < mid).forEach(pillar);
  const deck = mixHex('#C9CDCE', '#F4F7FA', ww),
    z1 = ST.top,
    z0 = ST.top - ST.fas,
    hl = ST.hl + 2,
    y0 = ST.y0 - 2,
    y1 = ST.y1 + 2;
  poly([P(-hl, y0, z1), P(hl, y0, z1), P(hl, y1, z1), P(-hl, y1, z1)], deck);
  // standing seams along the deck, and a pale sheen on the sunward half
  ctx.strokeStyle = 'rgba(60,70,76,.16)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let lx = -hl + 6; lx < hl; lx += 6) {
    const a = P(lx, y0, z1),
      q = P(lx, y1, z1);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  const stripe = '#C0392E';
  for (const [x1, y1b, x2, y2b, nx, ny] of [
    [-hl, y0, hl, y0, 0, -1],
    [hl, y0, hl, y1, 1, 0],
    [hl, y1, -hl, y1, 0, 1],
    [-hl, y1, -hl, y0, -1, 0]
  ]) {
    if (nx * s + ny * c <= 0.02) continue;
    const Q = (u, h) => P(lerp(x1, x2, u), lerp(y1b, y2b, u), h),
      shadeF = clamp(1 - 0.28 * (nx * c - ny * s) - 0.08, 0.7, 1.08);
    poly([Q(0, z0), Q(1, z0), Q(1, z1), Q(0, z1)], shade(stFas(), shadeF));
    poly(
      [Q(0, z0 + 1), Q(1, z0 + 1), Q(1, z0 + 2.4), Q(0, z0 + 2.4)],
      night > 0.2 ? mixHex(stripe, '#FF6B58', night * 0.6) : stripe
    );
    if (ny === 1 || ny === -1) {
      // the name along the long fascia
      const o = Q(0.5, z0 + 1.3),
        ax = Q(0.6, z0 + 1.3),
        k = (ny ? hl * 2 : y1 - y0) * 0.1,
        flip = ax[0] < o[0] ? -1 : 1; // read left to right whichever way the fascia runs
      ctx.save();
      ctx.transform(((ax[0] - o[0]) / k) * flip, ((ax[1] - o[1]) / k) * flip, 0, 1, o[0], o[1]);
      ctx.font = 'bold 3.4px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#3A3F42';
      ctx.fillText('BENSIN', 0, 0);
      ctx.restore();
    }
  }
  if (ww > 0.5) {
    // the snow on the deck piles to a soft lip
    ctx.strokeStyle = '#FAFCFD';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const a = P(-hl, y1, z1 + 0.4),
      q = P(hl, y1, z1 + 0.4);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }
  pil.filter((q, i) => pw[i] >= mid).forEach(pillar);
}
function drawPylon(p) {
  const X = p.x,
    gy = p.y * TILT,
    ww = winterW(),
    night = clamp(LIGHT.night * 1.3, 0, 1),
    h = 40;
  // a slim steel post, a red-headed sign above a panel of prices
  ctx.fillStyle = '#7E8284';
  ctx.fillRect(X - 1, gy - h, 2, h);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(X - 3, gy - 1, 6, 1.6);
  ctx.fillStyle = '#EDEBE4';
  ctx.fillRect(X - 11, gy - h - 25, 22, 26);
  ctx.fillStyle = night > 0.2 ? mixHex('#C0392E', '#FF6B58', night * 0.6) : '#C0392E';
  ctx.fillRect(X - 10, gy - h - 24, 20, 9);
  ctx.fillStyle = '#F4F0E6';
  ctx.font = 'bold 5.4px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BENSIN', X, gy - h - 17);
  ctx.fillStyle = mixHex('#2A3236', '#FFF1C2', night * 0.85);
  ctx.fillRect(X - 10, gy - h - 14, 20, 14);
  ctx.fillStyle = night > 0.3 ? '#4A3A14' : '#E9E5D6';
  ctx.font = 'bold 4.4px sans-serif';
  ctx.fillText('95  21,49', X, gy - h - 8.6);
  ctx.fillText('D   20,89', X, gy - h - 3);
  if (ww > 0.5) {
    ctx.fillStyle = '#FAFCFD';
    ctx.fillRect(X - 11.5, gy - h - 26.6, 23, 2);
  }
}
// shadows: the pillars and the pylon as posts, the canopy deck as a slab laid along the sun
function stationShadow(c, cap, p) {
  if (p.k === 'pylon') {
    cap(p.x, p.y, 0.95, 1.6);
    cap(p.x, p.y, 0.58, 12);
    return;
  }
  if (p.k === 'pumps') {
    for (const sx of [-1, 1]) {
      const [x, y] = stW(p.b, sx * ST.pump, p.isY);
      cap(x, y, 14 / HZ, 5);
    }
    return;
  }
  const b = p.b,
    pts = [];
  for (const sx of [-1, 1])
    for (const ly of [ST.y0, ST.y1]) {
      const [x, y] = stW(b, sx * ST.hl, ly);
      pts.push([x, y], [x + (ST.top / HZ) * SX, y + (ST.top / HZ) * SY]);
    }
  const H2 = hull(pts);
  c.beginPath();
  H2.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
  c.closePath();
  c.fill();
}
// the forecourt: tarmac that spills a little past the pumps, a kerbed apron before the kiosk, tyre marks at the bay
function paintForecourt(g, b, winter) {
  g.save();
  g.translate(b.cx, b.cy);
  g.rotate(b.ang);
  const wob = (i, a) => (hash2(i * 7 + (b.cx | 0), (b.cy | 0) + i) - 0.5) * a,
    x0 = -ST.hl - 12,
    x1 = ST.hl + 12,
    y0 = ST.y0 - 6,
    y1 = ST.y1 + 10,
    r = 9;
  g.beginPath();
  g.moveTo(x0 + r, y0 + wob(1, 3));
  g.lineTo(x1 - r, y0 + wob(2, 3));
  g.quadraticCurveTo(x1 + wob(3, 4), y0, x1 + wob(4, 3), y0 + r);
  g.lineTo(x1 + wob(5, 4), y1 - r);
  g.quadraticCurveTo(x1, y1 + wob(6, 4), x1 - r, y1 + wob(7, 3));
  g.lineTo(x0 + r, y1 + wob(8, 3));
  g.quadraticCurveTo(x0, y1, x0 + wob(9, 3), y1 - r);
  g.lineTo(x0 + wob(10, 4), y0 + r);
  g.quadraticCurveTo(x0, y0 + wob(11, 3), x0 + r, y0 + wob(1, 3));
  g.closePath();
  g.fillStyle = winter ? 'rgba(110,118,124,.5)' : 'rgba(50,52,48,.34)';
  g.save();
  g.translate(0, 2);
  g.fill();
  g.restore();
  g.fillStyle = winter ? '#8F959B' : '#76776F';
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = winter ? '#C4CBD0' : '#A5A39A';
  g.stroke();
  // a mottled patch of fresher tarmac, and worn grey where the cars stand
  g.fillStyle = winter ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)';
  g.fillRect(x0 + 8, y0 + 5, x1 - x0 - 16, 14);
  g.fillStyle = 'rgba(20,20,18,.16)';
  g.beginPath();
  g.ellipse(-6, 55, 18, 7, 0, 0, TAU);
  g.fill();
  // the walkway along the kiosk's front
  g.fillStyle = winter ? '#C9CED2' : '#B8B5AB';
  g.fillRect(-b.len / 2 - 3, b.dep / 2 - 1, b.len + 6, 9);
  g.restore();
}

// the kiosk's glass front: a band of shop window with a sliding door in the middle, shelves showing within
function drawStorefront(Q, wh, poly) {
  poly([Q(0.07, 2.4), Q(0.93, 2.4), Q(0.93, wh - 3), Q(0.07, wh - 3)], winCol(), '#F1ECE2');
  const night = LIGHT.night;
  for (const u of [0.14, 0.26, 0.74, 0.86]) {
    const a = Q(u - 0.045, 3.6),
      q = Q(u + 0.045, 3.6 + (wh - 8.5) * 0.7);
    ctx.fillStyle = night > 0.2 ? 'rgba(255,214,150,.28)' : 'rgba(30,40,44,.28)';
    ctx.fillRect(Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.abs(q[0] - a[0]), Math.abs(q[1] - a[1]));
  }
  ctx.strokeStyle = '#E8E4D8';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const u of [0.07, 0.4, 0.5, 0.6, 0.93]) {
    const a = Q(u, 2.4),
      q = Q(u, wh - 3);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
  poly([Q(0.4, 2.4), Q(0.6, 2.4), Q(0.6, wh - 3), Q(0.4, wh - 3)], 'rgba(255,255,255,.1)');
}
// a flat roof with a white parapet fascia and red stripe, a vent box on top
function drawFlatRoof(b, P, poly, cols, hl, hd) {
  const o = 2.5,
    wh = b.wh,
    top = b.rh - 1,
    c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    night = clamp(LIGHT.night * 1.2, 0, 1);
  poly(
    [P(-hl - o, -hd - o, top), P(hl + o, -hd - o, top), P(hl + o, hd + o, top), P(-hl - o, hd + o, top)],
    shade(cols, 1.05),
    'rgba(20,15,10,.3)'
  );
  // a little rooftop box and flue
  stBox(b, hl * 0.3, -hd * 0.4, hl * 0.3 + 9, -hd * 0.4 + 6, top, top + 4, '#9A9C9A', '#B9BBB9');
  for (const [x1, y1, x2, y2, nx, ny] of [
    [-hl - o, -hd - o, hl + o, -hd - o, 0, -1],
    [hl + o, -hd - o, hl + o, hd + o, 1, 0],
    [hl + o, hd + o, -hl - o, hd + o, 0, 1],
    [-hl - o, hd + o, -hl - o, -hd - o, -1, 0]
  ]) {
    if (nx * s + ny * c <= 0.02) continue;
    const Q = (u, h) => P(lerp(x1, x2, u), lerp(y1, y2, u), h),
      f = clamp(1 - 0.28 * (nx * c - ny * s) - 0.08, 0.7, 1.08);
    poly([Q(0, wh - 2), Q(1, wh - 2), Q(1, b.rh), Q(0, b.rh)], shade(stFas(), f));
    poly(
      [Q(0, wh - 1), Q(1, wh - 1), Q(1, wh + 0.8), Q(0, wh + 0.8)],
      night > 0.2 ? mixHex('#C0392E', '#FF6B58', night * 0.6) : '#C0392E'
    );
  }
  if (winterW() > 0.5) {
    ctx.strokeStyle = '#FAFCFD';
    ctx.lineWidth = 1.6;
    const a = P(-hl - o, hd + o, b.rh + 0.3),
      q = P(hl + o, hd + o, b.rh + 0.3);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }
}
