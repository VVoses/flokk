/* Flokk - ground.js
   Ground texture: painted a little wider than one period, then blended at the seam.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- ground painting (top-down texture, drawn squashed), repainted each season ---------- */
const S = 0.6,
  GB = 320;
const G = mk(Math.round(W * S), Math.round(H * S)),
  gG = G.getContext('2d');
// the ground is painted a little wider than one period, then the two edges are blended so the seam disappears
const GE = mk(Math.round((W + 2 * GB) * S), Math.round(H * S)),
  g = GE.getContext('2d');
function blobPath(c, cx, cy, rf, extra, n = 200) {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU,
      r = rf(a) + extra;
    const x = cx + Math.cos(a) * r,
      y = cy + Math.sin(a) * r;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
function strokePoly(c, P, w, col) {
  c.beginPath();
  c.moveTo(P[0][0], P[0][1]);
  for (const p of P) c.lineTo(p[0], p[1]);
  c.lineWidth = w;
  c.strokeStyle = col;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}
// a farmyard's outline: its rounded rectangle, pushed in and out by noise so no two yards are the same shape;
// built in the yard's own frame and turned with it
function yardPath(c, Y, grow) {
  const r = 46,
    n = 96,
    w = Y.lw,
    h = Y.lh,
    x0 = -w / 2,
    y0 = -h / 2,
    per = 2 * (w + h),
    o = (Y.x * 0.37 + Y.y * 0.11) % 500;
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * per;
    let px, py, nx, ny;
    if (t < w) ((px = x0 + t), (py = y0), (nx = 0), (ny = -1));
    else if (t < w + h) ((px = x0 + w), (py = y0 + t - w), (nx = 1), (ny = 0));
    else if (t < 2 * w + h) ((px = x0 + w - (t - w - h)), (py = y0 + h), (nx = 0), (ny = 1));
    else ((px = x0), (py = y0 + h - (t - 2 * w - h)), (nx = -1), (ny = 0));
    // round the corners by pulling points toward an inset rectangle
    const cx = clamp(px, x0 + r, x0 + w - r),
      cy = clamp(py, y0 + r, y0 + h - r),
      dx = px - cx,
      dy = py - cy,
      dl = Math.hypot(dx, dy);
    if (dl > r) ((px = cx + (dx / dl) * r), (py = cy + (dy / dl) * r));
    if (dl > 0.01) ((nx = dx / dl), (ny = dy / dl));
    const k = grow + 34 * (pfbm(t + o, o, 140, 3, 7) - 0.5) + 10 * (pfbm(t + o, o, 40, 11, 5) - 0.5);
    const [X, Yy] = yardWorld(Y, px + nx * k, py + ny * k);
    i ? c.lineTo(X, Yy) : c.moveTo(X, Yy);
  }
  c.closePath();
}
/* the marks of use on a farmyard's gravel, all translucent in the ground's own hue so they sink into it by night:
   desire-line paths between the doors, a tractor's turning sweep before the barn, wet ruts with a grass ridge, damp
   drip lines and weeds along the walls, and (after the dust speckle, wet = true) puddles, straw, chips and oil */
function yardLines(Y) {
  const out = [],
    gate = Y.gate,
    bs = Y.builds || [],
    house = bs.find(b => b.windows),
    end = (b, k) => [b.cx + k * (b.len / 2 + 14) * Math.cos(b.ang), b.cy + k * (b.len / 2 + 14) * Math.sin(b.ang)];
  for (const b of bs) if (b.door && gate) out.push({ a: gate, b: end(b, 1), car: true });
  if (house) {
    const hd = [
      house.cx - Math.sin(house.ang) * (house.dep / 2 + 10),
      house.cy + Math.cos(house.ang) * (house.dep / 2 + 10)
    ];
    for (const b of bs) if (b !== house && b.door) out.push({ a: hd, b: end(b, -1), car: false });
    const wp = PROPS.find(p => p.k === 'wood' && p.fm && p.fm.yard === Y);
    if (wp) out.push({ a: hd, b: [wp.x, wp.y + 10], car: false });
  }
  return out;
}
function paintYardWear(g, Y, winter, season) {
  const bs = Y.builds || [],
    lines = yardLines(Y);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // churned mud where traffic turns (gate, doors), and grass that has taken back the quiet corners
  const soft = (x, y, r, c) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${c})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)'.replace('0,0,0,0', c.split(',').slice(0, 3).join(',') + ',0'));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  if (!winter) {
    for (const L of lines) if (L.car) soft(L.b[0], L.b[1], 58, season === 1 ? '92,78,54,.3' : '70,56,38,.4');
    if (Y.gate) soft(Y.gate[0], Y.gate[1], 50, season === 1 ? '92,78,54,.26' : '70,56,38,.34');
    for (let i = 0, k = 0; k < 9 && i < 120; i++) {
      const [x, y] = yardAt(Y, rnd(0.05, 0.95), rnd(0.05, 0.95)),
        [u, v] = yardLocal(Y, x, y),
        e = Math.min(Y.lw / 2 - Math.abs(u), Y.lh / 2 - Math.abs(v));
      if (
        e > 70 ||
        buildAt(x, y, 24) ||
        (Y.park && Math.hypot(Y.park.x - x, Y.park.y - y) < 80) ||
        lines.some(L => Math.hypot(L.b[0] - x, L.b[1] - y) < 50)
      )
        continue;
      k++;
      soft(x, y, rnd(26, 52), season === 2 ? '128,124,66,.5' : '96,136,60,.5');
    }
  }
  const pt = (L, t, off) => {
    const dx = L.b[0] - L.a[0],
      dy = L.b[1] - L.a[1],
      d = Math.hypot(dx, dy) || 1,
      bow = L.bow * Math.sin(Math.PI * t);
    return [L.a[0] + dx * t - (dy / d) * (bow + off), L.a[1] + dy * t + (dx / d) * (bow + off)];
  };
  for (const L of lines) {
    L.bow = rnd(-22, 22);
    // a desire line is worn bare and darker down the middle; a wheel track is two ruts with a ridge between
    const tr = L.car ? [-7, 7] : [0];
    for (const off of tr) {
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const q = pt(L, i / 16, off + (L.car ? 0 : rnd(-0.6, 0.6)));
        i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
      }
      g.lineWidth = L.car ? 6 : 8;
      g.strokeStyle = winter ? 'rgba(130,126,128,.2)' : L.car ? 'rgba(72,58,38,.42)' : 'rgba(112,94,64,.34)';
      g.stroke();
    }
    if (L.car && !winter) {
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const q = pt(L, i / 16, 0);
        i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
      }
      g.lineWidth = 6;
      g.setLineDash([9, 7]);
      g.strokeStyle = season === 2 ? 'rgba(128,124,64,.4)' : 'rgba(100,134,62,.42)';
      g.stroke();
      g.setLineDash([]);
    }
  }
  // the sweep a tractor makes turning out of the barn: two arcs and the track it leaves, in front of the biggest door
  const barn = bs.filter(b => b.door).sort((a, b) => b.len - a.len)[0];
  if (barn) {
    const k = R() < 0.5 ? 1 : -1,
      [ex, ey] = [
        barn.cx + k * (barn.len / 2 + 40) * Math.cos(barn.ang),
        barn.cy + k * (barn.len / 2 + 40) * Math.sin(barn.ang)
      ],
      sw = rnd(0, 1) < 0.5 ? 1 : -1;
    for (const [rr, w] of [
      [34, 5],
      [50, 5]
    ]) {
      g.beginPath();
      g.ellipse(ex, ey, rr, rr, barn.ang, sw > 0 ? -1.2 : 0.6, sw > 0 ? 1.6 : 3.4);
      g.lineWidth = w;
      g.strokeStyle = winter ? 'rgba(128,124,130,.24)' : 'rgba(72,58,38,.36)';
      g.stroke();
    }
  }
  // damp drip line under the eaves and weeds that grow where nothing is walked
  for (const b of bs) {
    const c = Math.cos(b.ang),
      s = Math.sin(b.ang),
      loc = (u, v) => [b.cx + u * c - v * s, b.cy + u * s + v * c];
    g.save();
    g.translate(b.cx, b.cy);
    g.rotate(b.ang);
    g.lineWidth = 10;
    g.strokeStyle = winter ? 'rgba(120,124,132,.16)' : 'rgba(70,58,42,.16)';
    g.strokeRect(-b.len / 2 - 4, -b.dep / 2 - 4, b.len + 8, b.dep + 8);
    g.restore();
    if (winter) continue;
    g.fillStyle = season === 2 ? 'rgba(138,122,64,.55)' : 'rgba(92,134,56,.5)';
    g.beginPath();
    for (let i = 0; i < b.len / 3; i++) {
      const side = R() < 0.5 ? -1 : 1,
        [x, y] = loc(rnd(-b.len / 2, b.len / 2), side * (b.dep / 2 + rnd(4, 11)));
      g.rect(x, y, rnd(1.5, 3), rnd(2, 5));
    }
    g.fill();
  }
}
function paintYardMarks(g, Y, winter, season) {
  const bs = Y.builds || [],
    inY = (x, y) =>
      inYard(Y, x, y, -8) && !buildAt(x, y, 4) && !(Y.park && Math.hypot(Y.park.x - x, Y.park.y - y) < 60);
  // wet weather puddles lie in the ruts and low spots: many in the thaw and the autumn rain, a few in summer
  const n = winter ? 0 : season === 0 ? 12 : season === 2 ? 9 : 4;
  for (let i = 0, k = 0; k < n && i < 200; i++) {
    const [x, y] = yardAt(Y, rnd(0.08, 0.92), rnd(0.08, 0.92));
    if (!inY(x, y)) continue;
    k++;
    const rx = rnd(10, 34) * (season === 1 ? 0.65 : 1),
      ry = rx * rnd(0.38, 0.55),
      a = rnd(-0.4, 0.4) + Y.ang;
    g.fillStyle = 'rgba(70,56,40,.22)';
    g.beginPath();
    g.ellipse(x, y, rx + 3, ry + 2, a, 0, TAU);
    g.fill();
    g.fillStyle = season === 1 ? 'rgba(104,120,128,.3)' : 'rgba(96,114,126,.42)';
    g.beginPath();
    g.ellipse(x, y, rx, ry, a, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(214,226,232,.16)';
    g.beginPath();
    g.ellipse(x - rx * 0.12, y - ry * 0.28, rx * 0.6, ry * 0.4, a, 0, TAU);
    g.fill();
  }
  // loose stones and gravel kicked to the edges, oil under where the machines stand
  g.fillStyle = winter ? 'rgba(130,128,132,.3)' : 'rgba(128,120,102,.4)';
  g.beginPath();
  for (let i = 0; i < 160; i++) {
    const [x, y] = yardAt(Y, rnd(0.02, 0.98), rnd(0.02, 0.98));
    if (inY(x, y)) {
      g.moveTo(x + 3, y);
      g.ellipse(x, y, rnd(1.5, 3.2), rnd(1, 2), rnd(0, 3), 0, TAU);
    }
  }
  g.fill();
  const barn = bs.find(b => b.door);
  if (barn && !winter)
    for (let i = 0; i < 4; i++) {
      const [x, y] = [barn.cx + rnd(-1, 1) * barn.len * 0.9, barn.cy + rnd(-1, 1) * barn.dep * 0.9];
      if (!inY(x, y)) continue;
      g.fillStyle = 'rgba(38,32,26,.22)';
      g.beginPath();
      g.ellipse(x, y, rnd(5, 11), rnd(3, 6), rnd(0, 3), 0, TAU);
      g.fill();
    }
  // straw and hay dropped by the barn doors, bark and chips round the woodpile
  g.lineWidth = 1;
  g.lineCap = 'butt';
  for (const b of bs.filter(q => q.door)) {
    if (winter) break;
    g.strokeStyle = 'rgba(184,160,96,.42)';
    g.beginPath();
    for (let i = 0; i < 34; i++) {
      const k = R() < 0.5 ? 1 : -1,
        r = rnd(8, 52),
        t = rnd(0, TAU),
        x = b.cx + k * (b.len / 2 + 8) * Math.cos(b.ang) + Math.cos(t) * r,
        y = b.cy + k * (b.len / 2 + 8) * Math.sin(b.ang) + Math.sin(t) * r * 0.7;
      if (!inY(x, y)) continue;
      g.moveTo(x, y);
      g.lineTo(x + rnd(-5, 5), y + rnd(-1.5, 1.5));
    }
    g.stroke();
  }
  const wp = PROPS.find(p => p.k === 'wood' && p.fm && p.fm.yard === Y);
  if (wp) {
    g.fillStyle = winter ? 'rgba(120,112,108,.35)' : 'rgba(150,118,76,.45)';
    g.beginPath();
    for (let i = 0; i < 40; i++)
      g.rect(wp.x + rnd(-wp.len * 0.8, wp.len * 0.8), wp.y + rnd(-14, 24), rnd(1.4, 3.2), rnd(1, 1.8));
    g.fill();
  }
  g.lineCap = 'round';
}
/* the churchyard: close-cut grass inside a low dry-stone wall, a gravel path from the gate to the tower door */
function paintChurchyard(C, winter, season, edgeOffs) {
  const Y = C.yard,
    lw = Y.lw,
    lh = Y.lh;
  for (const ox of edgeOffs(Y.x, Y.x + Y.w)) {
    g.save();
    g.translate(ox + Y.cx, Y.cy);
    g.rotate(Y.ang);
    // kept grass, a little greener and smoother than the meadow round it
    g.fillStyle = winter ? 'rgba(236,240,244,.5)' : season === 2 ? 'rgba(128,138,74,.35)' : 'rgba(96,140,64,.3)';
    g.beginPath();
    g.roundRect(-lw / 2, -lh / 2, lw, lh, 20);
    g.fill();
    // the path, from the gate in the road-side wall to the tower door
    const [du, dv] = yardLocal(Y, ...Y.door),
      gv = (-lh / 2) * Y.side;
    g.lineCap = 'round';
    g.strokeStyle = winter ? 'rgba(200,208,218,.55)' : 'rgba(176,164,132,.9)';
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(du * 0.3, gv);
    g.quadraticCurveTo(du * 0.4, (gv + dv) / 2, du, dv);
    g.stroke();
    g.fillStyle = winter ? 'rgba(150,160,175,.3)' : 'rgba(110,98,74,.35)';
    for (let i = 0; i < 160; i++) {
      const t = R(),
        u = lerp(du * 0.3, du, t) + rnd(-6, 6),
        v = lerp(gv, dv, t) + rnd(-3, 3);
      g.fillRect(u, v, 1.6, 1.6);
    }
    // the wall: grey fieldstone, a darker foot where it stands up out of the grass, lichen on the top
    const wall = () => {
      g.beginPath();
      g.roundRect(-lw / 2, -lh / 2, lw, lh, 20);
    };
    g.lineJoin = 'round';
    g.strokeStyle = winter ? 'rgba(90,98,112,.35)' : 'rgba(40,36,28,.35)';
    g.lineWidth = 13;
    g.save();
    g.translate(0, 3);
    wall();
    g.stroke();
    g.restore();
    g.strokeStyle = winter ? '#C9CFD6' : '#8E8A80';
    g.lineWidth = 9;
    wall();
    g.stroke();
    const per = 2 * (lw + lh);
    for (let t = 0; t < per; t += rnd(4, 7)) {
      let u, v;
      if (t < lw) ((u = t - lw / 2), (v = -lh / 2));
      else if (t < lw + lh) ((u = lw / 2), (v = t - lw - lh / 2));
      else if (t < 2 * lw + lh) ((u = lw * 1.5 + lh - t), (v = lh / 2));
      else ((u = -lw / 2), (v = per - t - lh / 2));
      if (Math.abs(u) > lw / 2 - 16 && Math.abs(v) > lh / 2 - 16) continue; // leave the rounded corners plain
      const k = R();
      g.fillStyle = winter
        ? k < 0.5
          ? '#F4F6F8'
          : '#B4BCC6'
        : k < 0.3
          ? '#A7A398'
          : k < 0.6
            ? '#76726A'
            : k < 0.8
              ? '#9A9684'
              : '#A8A46C';
      g.fillRect(u + rnd(-3, 1), v + rnd(-3, 1), rnd(3, 6), rnd(3, 5));
    }
    // the gateway: a gap in the wall with a stone post each side
    g.fillStyle = winter ? 'rgba(236,240,244,.95)' : '#9C9068';
    g.fillRect(du * 0.3 - 12, gv - 7, 24, 14);
    g.fillStyle = winter ? '#B4BCC6' : '#6E6A62';
    for (const sg of [-1, 1]) g.fillRect(du * 0.3 + sg * 14 - 3, gv - 5, 6, 10);
    g.restore();
  }
}
function seaGrad(c) {
  const gr = c.createLinearGradient(0, H - 330, 0, H + 40);
  const w = SEASON === 3;
  gr.addColorStop(0, w ? '#3D6873' : '#447C86');
  gr.addColorStop(0.3, w ? '#284D5A' : '#2F5E6B');
  gr.addColorStop(1, w ? '#173744' : '#1E4351');
  return gr;
}
// per season: [low, high, dry patches]. Spring is pale and fresh with last year's straw, summer deep and lush,
// autumn olive going gold, winter snow
const GRASS = [
  [
    [104, 142, 70],
    [160, 186, 100],
    [186, 174, 118]
  ],
  [
    [62, 104, 46],
    [98, 140, 62],
    [138, 150, 70]
  ],
  [
    [108, 116, 64],
    [154, 152, 88],
    [184, 160, 96]
  ],
  [
    [204, 212, 224],
    [240, 243, 248],
    [224, 230, 238]
  ]
];
// same ground painting as paintGround, but yielding through the costly per-cell noise field (by far
// its biggest cost) so a season change can spread that across several frames instead of freezing one;
// see BG_JOB in light.js. Everything below the cell loop still runs in one go: it's a small fraction
// of the cost and, unlike the loop above, several of its steps read back what earlier steps drew.
// A farm's parking: ruts curving in from the gate to a soft-edged pad of packed gravel beside the house, with
// two worn bays, a pale scatter of fresh gravel and the odd oil stain. Drawn in the yard's own gravel.
function drawParkingPad(g, P, winter) {
  const edge = pts => {
    const n = pts.length;
    g.beginPath();
    g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[(i + 1) % n];
      g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    g.closePath();
  };
  g.save();
  g.lineCap = 'round';
  const [a, m, b] = P.spur,
    sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
    sx = -(b[1] - a[1]) / sl,
    sy = (b[0] - a[0]) / sl;
  for (const [off, w, col] of [
    [-6, 3.5, winter ? 'rgba(160,172,188,.34)' : 'rgba(96,84,60,.24)'],
    [6, 3.5, winter ? 'rgba(160,172,188,.34)' : 'rgba(96,84,60,.24)'],
    [0, 12, winter ? 'rgba(255,255,255,.22)' : 'rgba(128,140,84,.14)']
  ]) {
    g.beginPath();
    g.moveTo(a[0] + sx * off, a[1] + sy * off);
    g.quadraticCurveTo(m[0] + sx * off, m[1] + sy * off, b[0] + sx * off, b[1] + sy * off);
    g.lineWidth = w;
    g.strokeStyle = col;
    g.stroke();
  }
  edge(P.blob);
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.strokeStyle = winter ? 'rgba(190,200,212,.18)' : 'rgba(120,108,80,.22)';
  g.stroke();
  g.fillStyle = winter ? 'rgba(168,180,196,.6)' : 'rgba(116,102,72,.58)';
  g.fill();
  g.save();
  edge(P.blob);
  g.clip();
  const fx = Math.cos(P.ang),
    fy = Math.sin(P.ang);
  for (let i = 0; i < 60; i++) {
    const t = hash2(i, P.x),
      u = hash2(i + 91, P.y);
    g.fillStyle = winter ? 'rgba(255,255,255,.4)' : 'rgba(214,204,170,.4)';
    g.fillRect(
      P.x + fx * (t - 0.5) * 60 - fy * (u - 0.5) * 60,
      P.y + fy * (t - 0.5) * 60 + fx * (u - 0.5) * 60,
      1.8,
      1.8
    );
  }
  for (const [bx, by] of P.bays) {
    // two tyre tracks and a drip of oil where each car has stood
    for (const sg of [-4.5, 4.5]) {
      g.beginPath();
      g.moveTo(bx - fx * 19 - fy * sg, by - fy * 19 + fx * sg);
      g.lineTo(bx + fx * 19 - fy * sg, by + fy * 19 + fx * sg);
      g.lineWidth = 3;
      g.strokeStyle = winter ? 'rgba(120,132,148,.3)' : 'rgba(70,60,42,.26)';
      g.stroke();
    }
    g.fillStyle = winter ? 'rgba(90,100,114,.22)' : 'rgba(40,34,26,.2)';
    g.beginPath();
    g.ellipse(bx + fx * 5, by + fy * 5, 4.5, 2.6, P.ang, 0, TAU);
    g.fill();
  }
  g.restore();
  g.restore();
}
function* paintGroundGen(season) {
  const keepR = R;
  R = mulberry32((SEED ^ 0x5151) + season * 7919);
  const winter = season === 3,
    [c0, c1, c2] = GRASS[season];
  const XW = W + 2 * GB,
    RX = () => R() * XW - GB,
    RY = () => R() * H;
  // the widened canvas is only needed while painting (composeG lets it go again)
  GE.width = Math.round((W + 2 * GB) * S);
  GE.height = Math.round(H * S);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, GE.width, GE.height);
  /* base colour field, one sample every Q units: grass, heath, bog, bare rock, and the forest floor */
  const Q = 12,
    nw = Math.ceil(XW / Q),
    nh = Math.ceil(H / Q);
  const nc = mk(nw, nh),
    nx = nc.getContext('2d'),
    id = nx.createImageData(nw, nh),
    dd = id.data;
  const FA = new Float32Array(nw * nh),
    BA = new Float32Array(nw * nh),
    RA = new Float32Array(nw * nh);
  const HC = [
    [118, 104, 78],
    [112, 118, 72],
    [128, 100, 96],
    [0, 0, 0]
  ][season];
  const BC = [
    [118, 112, 72],
    [104, 120, 68],
    [150, 114, 74],
    [226, 232, 238]
  ][season]; // bog: sedge, cotton grass, rusty autumn moss
  const FF = [
    [70, 84, 48],
    [58, 76, 42],
    [90, 72, 46],
    [188, 196, 206]
  ][season]; // forest floor
  const NDL = [124, 90, 56],
    MOS = [92, 124, 54];
  for (let j = 0; j < nh; j++) {
    for (let i = 0; i < nw; i++) {
      const x = i * Q - GB,
        y = j * Q;
      const n = pfbm(x, y, 520),
        m = pfbm(x, y, 160, 40, 9),
        yel = pfbm(x, y, 900, 90, 3);
      const t = clamp(n * 1.15 - 0.12 + (m - 0.5) * 0.4, 0, 1);
      let r = lerp(c0[0], c1[0], t),
        gg = lerp(c0[1], c1[1], t),
        b = lerp(c0[2], c1[2], t);
      const yy = clamp((yel - 0.52) * 3, 0, 1) * 0.55;
      r = lerp(r, c2[0], yy);
      gg = lerp(gg, c2[1], yy);
      b = lerp(b, c2[2], yy);
      const regional = regionWeights(x, y),
        heath = pfbm(x, y, 380, 17, 3) + regional.highland * 0.09,
        rock = pfbm(x, y, 230, 71, 29) + regional.highland * 0.1,
        moss = pfbm(x, y, 120, 5, 50),
        bog = pfbm(x, y, 300, 23, 41);
      const f = forestness(x, y),
        dense = clamp((f - 0.56) * 3.2, 0, 1);
      FA[j * nw + i] = f;
      BA[j * nw + i] = bog;
      RA[j * nw + i] = rock;
      if (!winter) {
        const hk = clamp((heath - 0.58) * 3.2, 0, 0.6);
        r = lerp(r, HC[0], hk);
        gg = lerp(gg, HC[1], hk);
        b = lerp(b, HC[2], hk);
        const dl = Math.hypot(wdx(x, LAKE.x), y - LAKE.y) - LAKE.r * 1.1,
          wk = clamp(1 - dl / 280, 0, 1) * 0.45;
        r = lerp(r, 58, wk);
        gg = lerp(gg, 102, wk);
        b = lerp(b, 62, wk);
        const mk2 = clamp((moss - 0.62) * 3, 0, 0.35);
        r = lerp(r, 74, mk2);
        gg = lerp(gg, 118, mk2);
        b = lerp(b, 58, mk2);
      }
      {
        const bg = clamp((bog - 0.63) * 4, 0, 1) * (1 - dense) * 0.75;
        r = lerp(r, BC[0], bg);
        gg = lerp(gg, BC[1], bg);
        b = lerp(b, BC[2], bg);
      }
      {
        const rk = clamp((rock - 0.7) * 4, 0, 0.55) * (f < 0.62 ? 1 : 0.4);
        const RC = winter ? [208, 212, 218] : [128, 128, 116];
        r = lerp(r, RC[0], rk);
        gg = lerp(gg, RC[1], rk);
        b = lerp(b, RC[2], rk);
      }
      if (dense > 0) {
        // under the canopy: needle litter and moss carpets instead of grass; thin grey snow in winter
        const nd = pfbm(x, y, 70, 13, 77);
        let fr = FF[0],
          fg = FF[1],
          fb = FF[2];
        if (!winter) {
          const u = clamp((nd - 0.5) * 3, -1, 1);
          const C = u > 0 ? NDL : MOS,
            a = Math.abs(u) * (u > 0 ? 0.5 : 0.42);
          fr = lerp(fr, C[0], a);
          fg = lerp(fg, C[1], a);
          fb = lerp(fb, C[2], a);
        } else {
          const u = clamp((nd - 0.56) * 3, 0, 1) * 0.45;
          fr = lerp(fr, 118, u);
          fg = lerp(fg, 114, u);
          fb = lerp(fb, 106, u);
        }
        const k = dense * (winter ? 0.6 : 0.85);
        r = lerp(r, fr, k);
        gg = lerp(gg, fg, k);
        b = lerp(b, fb, k);
      } else if (f > 0.5) {
        const k = (f - 0.5) * 2;
        r *= 1 - k * 0.2;
        gg *= 1 - k * 0.14;
        b *= 1 - k * 0.18;
      }
      // rolling hills, entirely in the shading: brighten the slopes that face the sun, dim the
      // ones that turn away from it, so open ground reads as gentle swells rather than flat felt
      const hs = 1 + hillshade(x, y) * (winter ? 0.2 : 0.15);
      r *= hs;
      gg *= hs;
      b *= hs;
      const o = (j * nw + i) * 4;
      dd[o] = r;
      dd[o + 1] = gg;
      dd[o + 2] = b;
      dd[o + 3] = 255;
    }
    yield;
  }
  nx.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(nc, 0, 0, nw * Q * S, nh * Q * S);
  g.setTransform(S, 0, 0, S, GB * S, 0);
  const K = XW / W;
  g.fillStyle = winter ? 'rgba(150,170,195,.16)' : 'rgba(38,60,26,.18)';
  g.beginPath();
  for (let i = 0; i < 70000 * K; i++) g.rect(RX(), RY(), 2.6, 2.6);
  g.fill();
  g.fillStyle = winter ? 'rgba(255,255,255,.35)' : 'rgba(205,214,140,.11)';
  g.beginPath();
  for (let i = 0; i < 45000 * K; i++) g.rect(RX(), RY(), 2.2, 2.2);
  g.fill();
  yield;
  // small ground detail: tufts, stones, and what falls from the trees
  if (!winter) {
    for (const [col, n] of [
      ['rgba(52,80,36,.32)', 14000],
      ['rgba(190,196,120,.22)', 9000]
    ]) {
      g.strokeStyle = col;
      g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < n * K; i++) {
        const x = RX(),
          y = RY(),
          l = rnd(3, 6),
          a = rnd(-0.5, 0.5);
        g.moveTo(x, y);
        g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l);
      }
      g.stroke();
      yield;
    }
  }
  g.fillStyle = winter ? 'rgba(150,160,175,.35)' : 'rgba(120,118,108,.55)';
  g.beginPath();
  for (let i = 0; i < 3500 * K; i++) {
    const x = RX(),
      y = RY();
    g.rect(x, y, rnd(2, 4), rnd(1.5, 3));
  }
  g.fill();
  yield;
  g.fillStyle = winter ? 'rgba(255,255,255,.6)' : 'rgba(215,215,200,.45)';
  g.beginPath();
  for (let i = 0; i < 3500 * K; i++) {
    const x = RX(),
      y = RY();
    g.rect(x, y - 1, 1.5, 1);
  }
  g.fill();
  const smp = A => (x, y) => A[clamp(Math.round(y / Q), 0, nh - 1) * nw + clamp(Math.round((x + GB) / Q), 0, nw - 1)];
  paintFloor(season, RX, RY, K, smp(FA), smp(BA), smp(RA));
  yield;
  let _tc = 0;
  for (const t0 of TREES) {
    if (++_tc % 40 === 0) yield;
    if (t0.y < -20 || t0.y > H) continue;
    const offs = [0];
    if (t0.x < GB + 40) offs.push(W);
    if (t0.x > W - GB - 40) offs.push(-W);
    for (const ox of offs) {
      const tx = t0.x + ox,
        t = t0;
      if (winter) {
        g.fillStyle = t.type === 'spruce' ? 'rgba(120,130,140,.3)' : 'rgba(160,175,196,.28)';
        g.beginPath();
        g.ellipse(tx, t.y + 2, t.r * 1.1, t.r * 0.7, 0, 0, TAU);
        g.fill();
        continue;
      }
      const n =
        t.type === 'spruce' ? 14 : season === 2 ? 26 : season === 0 && t.type === 'decid' && t.v % 4 === 3 ? 18 : 6;
      const cols =
        t.type === 'spruce'
          ? ['rgba(80,60,38,.5)', 'rgba(60,48,30,.45)']
          : season === 2
            ? t.type === 'birch'
              ? ['#D9B84A', '#C9A23C', '#E4C862']
              : ['#B8662E', '#C98A3E', '#8A5A2A']
            : season === 0 && t.v % 4 === 3
              ? ['#F4F1EA', '#FFFFFF']
              : ['rgba(70,96,46,.5)'];
      for (let i = 0; i < n; i++) {
        const a = R() * TAU,
          d = Math.sqrt(R()) * t.r * 1.5;
        g.fillStyle = pick(cols);
        g.fillRect(tx + Math.cos(a) * d, t.y + Math.sin(a) * d * 0.8, 2.2, 1.8);
      }
    }
  }
  yield;
  if (winter) {
    g.fillStyle = 'rgba(255,255,255,.4)';
    for (let i = 0; i < 260 * K; i++) {
      g.beginPath();
      g.ellipse(RX(), RY(), rnd(30, 110), rnd(8, 24), rnd(-0.3, 0.3), 0, TAU);
      g.fill();
    }
  }
  const x0 = -GB - 10,
    x1 = W + GB + 10;
  const shoreLine = o => {
    g.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      const y = shoreY(x) + o;
      x === x0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
  };
  g.beginPath();
  g.moveTo(x0, H + 10);
  for (let x = x0; x <= x1; x += 8) g.lineTo(x, shoreY(x) - 14);
  g.lineTo(x1, H + 10);
  g.closePath();
  g.fillStyle = winter ? '#D9DFE4' : '#B9AC86';
  g.fill();
  g.fillStyle = winter ? 'rgba(140,150,160,.3)' : 'rgba(120,110,80,.35)';
  g.beginPath();
  for (let i = 0; i < 5000 * K; i++) {
    const x = RX();
    g.rect(x, shoreY(x) - R() * 16, 2, 2);
  }
  g.fill();
  g.beginPath();
  g.moveTo(x0, H + 10);
  for (let x = x0; x <= x1; x += 8) g.lineTo(x, shoreY(x));
  g.lineTo(x1, H + 10);
  g.closePath();
  g.fillStyle = seaGrad(g);
  g.fill();
  g.save();
  g.beginPath();
  g.moveTo(x0, H + 10);
  for (let x = x0; x <= x1; x += 8) g.lineTo(x, shoreY(x));
  g.lineTo(x1, H + 10);
  g.closePath();
  g.clip();
  for (let i = 0; i < 70 * K; i++) {
    const x = RX(),
      y = shoreY(x) + rnd(10, 60);
    g.fillStyle = 'rgba(60,80,50,.35)';
    g.beginPath();
    g.ellipse(x, y, rnd(20, 60), rnd(6, 14), 0, 0, TAU);
    g.fill();
  }
  shoreLine(3);
  g.lineWidth = 14;
  g.strokeStyle = 'rgba(140,190,180,.35)';
  g.stroke();
  shoreLine(12);
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(230,240,236,.45)';
  g.stroke();
  g.strokeStyle = 'rgba(205,228,222,.08)';
  g.lineWidth = 2;
  for (let i = 0; i < 180 * K; i++) {
    const x = RX(),
      y = shoreY(x) + rnd(30, 300);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + rnd(40, 120), y + rnd(-4, 4));
    g.stroke();
  }
  g.restore();
  shoreLine(-3);
  g.lineWidth = 3;
  g.strokeStyle = winter ? 'rgba(120,130,140,.4)' : 'rgba(95,85,60,.5)';
  g.stroke();
  yield;
  const edgeOffs = (a, b) => [0].concat(a < GB + 60 ? [W] : [], b > W - GB - 60 ? [-W] : []);
  for (const YARD of YARDS) {
    for (const ox of edgeOffs(YARD.x, YARD.x + YARD.w)) {
      g.save();
      g.translate(ox, 0);
      // worn grass fading out round an irregular gravel yard
      for (const [gr2, al] of [
        [26, 0.12],
        [13, 0.22]
      ]) {
        g.fillStyle = winter ? `rgba(221,227,232,${al})` : `rgba(150,142,104,${al})`;
        yardPath(g, YARD, gr2);
        g.fill();
      }
      g.fillStyle = winter ? '#DDE3E8' : '#A69A78';
      yardPath(g, YARD, 0);
      g.fill();
      g.save();
      yardPath(g, YARD, 0);
      g.clip();
      // damp, packed and loose patches
      for (let i = 0; i < 16; i++) {
        const x = rnd(YARD.x, YARD.x + YARD.w),
          y = rnd(YARD.y, YARD.y + YARD.h),
          r = rnd(40, 110),
          dark = R() < 0.55;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const c = winter ? (dark ? '170,182,196' : '248,250,252') : dark ? '120,106,78' : '196,186,150';
        gr.addColorStop(0, `rgba(${c},${winter ? 0.22 : 0.26})`);
        gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // wheel ruts from the lane to the door of every building that has one
      if (YARD.gate) {
        const [gx, gy] = YARD.gate;
        for (const b of YARD.builds) {
          if (!b.door) continue;
          const tx2 = b.cx + (b.len / 2 + 14) * Math.cos(b.ang),
            ty2 = b.cy + (b.len / 2 + 14) * Math.sin(b.ang),
            mx = lerp(gx, tx2, 0.5) + rnd(-30, 30),
            my = lerp(gy, ty2, 0.5);
          const d = Math.hypot(tx2 - gx, ty2 - gy) || 1,
            nx = -(ty2 - gy) / d,
            ny = (tx2 - gx) / d;
          for (const sg of [-1, 1]) {
            g.beginPath();
            g.moveTo(gx + nx * sg * 7, gy + ny * sg * 7);
            g.quadraticCurveTo(mx + nx * sg * 7, my + ny * sg * 7, tx2 + nx * sg * 7, ty2 + ny * sg * 7);
            g.lineWidth = 4.5;
            g.lineCap = 'round';
            g.strokeStyle = winter ? 'rgba(160,172,188,.32)' : 'rgba(96,84,60,.22)';
            g.stroke();
          }
          g.beginPath();
          g.moveTo(gx, gy);
          g.quadraticCurveTo(mx, my, tx2, ty2);
          g.lineWidth = 5;
          g.strokeStyle = winter ? 'rgba(255,255,255,.3)' : 'rgba(128,140,84,.18)';
          g.stroke();
        }
      }
      paintYardWear(g, YARD, winter, season);
      if (YARD.park) drawParkingPad(g, YARD.park, winter);
      g.fillStyle = winter ? 'rgba(150,160,175,.25)' : 'rgba(90,80,60,.25)';
      g.beginPath();
      for (let i = 0; i < 2200; i++) g.rect(rnd(YARD.x, YARD.x + YARD.w), rnd(YARD.y, YARD.y + YARD.h), 2, 2);
      g.fill();
      g.fillStyle = winter ? 'rgba(255,255,255,.35)' : 'rgba(210,202,172,.3)';
      g.beginPath();
      for (let i = 0; i < 900; i++) g.rect(rnd(YARD.x, YARD.x + YARD.w), rnd(YARD.y, YARD.y + YARD.h), 1.6, 1.6);
      g.fill();
      paintYardMarks(g, YARD, winter, season);
      g.restore();
      // grass creeping in along the edge
      if (!winter) {
        g.fillStyle = season === 2 ? 'rgba(128,130,70,.5)' : 'rgba(96,132,60,.45)';
        g.beginPath();
        for (let i = 0; i < 420; i++) {
          const u = rnd(-10, YARD.lw + 10) - YARD.lw / 2,
            v = rnd(-10, YARD.lh + 10) - YARD.lh / 2,
            [x, y] = yardWorld(YARD, u, v);
          const e = Math.min(YARD.lw / 2 - Math.abs(u), YARD.lh / 2 - Math.abs(v));
          if (e > R() * 26) continue;
          g.rect(x, y, rnd(2, 4), rnd(2, 3));
        }
        g.fill();
      }
      g.restore();
    }
    yield;
  }
  if (CHURCH) paintChurchyard(CHURCH, winter, season, edgeOffs);
  const R0 = R;
  for (const [fi, f] of FIELDS.entries()) {
    for (const ox of edgeOffs(f.x, f.x + f.w)) {
      R = mulberry32((SEED ^ 0x77) + fi * 7919 + season * 131);
      g.save();
      g.translate(ox, 0);
      let kind = f.t;
      const cv = cropOf(f);
      if (winter) kind = 'snow';
      else if (season === 0)
        kind =
          f.t === 'pasture'
            ? 'pasture'
            : f.t === 'sty'
              ? 'sty'
              : f.t === 'plow'
                ? 'plow'
                : cv === 'rapeseed'
                  ? 'rape'
                  : 'sown';
      else if (season === 1)
        kind =
          f.t === 'pasture'
            ? 'pasture'
            : f.t === 'sty'
              ? 'sty'
              : cv === 'rapeseed'
                ? 'bloom'
                : f.t === 'crop'
                  ? cv === 'onion'
                    ? 'onion'
                    : 'crop'
                  : 'grain';
      else if (cv === 'rapeseed')
        kind = 'stubble'; // cut in late summer
      else if (f.t === 'crop') kind = 'plow'; // autumn: the crop is lifted (grow.js shows it before that)
      paintField(g, f, kind, season);
      g.restore();
    }
    yield;
  }
  R = R0;
  // what lies between neighbouring plots: a ditch is a dark wet line in rank grass (a frozen, drifted
  // groove in winter); a hedge sits on a darker, weedy bank; a balk is just the meadow showing through
  for (const D of DIVIDES) {
    const xs = D.pts.map(q => q[0]);
    for (const ox of edgeOffs(Math.min(...xs), Math.max(...xs))) {
      g.save();
      g.translate(ox, 0);
      g.lineJoin = g.lineCap = 'round';
      if (D.t === 'ditch') {
        if (winter) {
          strokePoly(g, D.pts, 12, 'rgba(176,190,208,.35)');
          strokePoly(g, D.pts, 4, 'rgba(140,156,178,.5)');
        } else {
          const bank = season === 2 ? '120,112,60' : '74,96,46';
          strokePoly(g, D.pts, D.w + 6, `rgba(${bank},.35)`);
          strokePoly(g, D.pts, 6, 'rgba(46,52,40,.6)');
          strokePoly(g, D.pts, 2.5, season === 0 ? 'rgba(96,120,128,.8)' : 'rgba(64,78,72,.7)');
          strokePoly(g, offsetPoly(D.pts, -1.5), 1, 'rgba(190,210,214,.3)');
        }
      } else if (D.t === 'hedge')
        strokePoly(g, D.pts, D.w * 0.7, winter ? 'rgba(170,180,196,.25)' : 'rgba(70,84,44,.28)');
      g.restore();
    }
  }
  yield;
  paintRailBed(winter);
  if (winter) {
    strokePoly(g, ROAD, 32, 'rgba(150,160,175,.35)');
    strokePoly(g, ROAD, 26, '#E3E8EC');
    strokePoly(g, offsetPoly(ROAD, 6), 4, 'rgba(165,175,188,.7)');
    strokePoly(g, offsetPoly(ROAD, -6), 4, 'rgba(165,175,188,.7)');
    for (const P of accessPaintPaths())
      for (const ox of edgeOffs(Math.min(...P.map(q => q[0])), Math.max(...P.map(q => q[0])))) {
        g.save();
        g.translate(ox, 0);
        strokePoly(g, P, 18, '#E6EAEE');
        strokePoly(g, offsetPoly(P, 4), 3, 'rgba(170,180,192,.6)');
        g.restore();
      }
    g.fillStyle = '#E6EAEE';
    for (const farm of FARMS) {
      const p = farm.yard.gate;
      g.beginPath();
      g.ellipse(p[0], p[1], 20, 14, farm.yard.ang, 0, TAU);
      g.fill();
    }
  } else {
    // A soft, irregular verge keeps the public road from reading as a hard strip laid over the map.
    // The darker outer line also gives access lanes a clear visual hierarchy when they join it.
    strokePoly(g, offsetPoly(ROAD, 23), 5, 'rgba(72,82,48,.16)');
    strokePoly(g, offsetPoly(ROAD, -23), 5, 'rgba(72,82,48,.16)');
    strokePoly(g, ROAD, 58, 'rgba(160,150,110,.09)');
    strokePoly(g, ROAD, 44, 'rgba(160,150,110,.13)');
    strokePoly(g, ROAD, 36, 'rgba(60,62,38,.22)');
    strokePoly(g, ROAD, 29, '#A69A77');
    strokePoly(g, ROAD, 23, '#BDAF8A');
    strokePoly(g, offsetPoly(ROAD, 6), 4, 'rgba(150,136,104,.55)');
    strokePoly(g, offsetPoly(ROAD, -6), 4, 'rgba(150,136,104,.55)');
    // Sparse passing bays break up the road's uniform ribbon and give oncoming traffic a believable
    // place to yield. Keep them on quiet stretches, away from junctions, crossings and sensitive edges.
    const junctions = accessJunctions();
    for (let x = 620; x < W - 300; x += 860) {
      let best = ROAD[0],
        bestDx = Infinity,
        bestIndex = 0;
      for (let i = 1; i < ROAD.length - 1; i++) {
        const dx = Math.abs(ROAD[i][0] - x);
        if (dx < bestDx) {
          best = ROAD[i];
          bestDx = dx;
          bestIndex = i;
        }
      }
      let busy = best[0] < 0 || best[0] >= W || inWater(best[0], best[1], 90) || inChurchyard(best[0], best[1], 130);
      for (const j of junctions)
        if (Math.hypot(wdx(j.root[0], best[0]), j.root[1] - best[1]) < 150) {
          busy = true;
          break;
        }
      if (!busy)
        for (const c of CROSSINGS)
          if (Math.hypot(wdx(c.x, best[0]), c.y - best[1]) < 170) {
            busy = true;
            break;
          }
      if (busy) continue;
      const a = ROAD[bestIndex - 1],
        b = ROAD[bestIndex + 1],
        ang = Math.atan2(b[1] - a[1], b[0] - a[0]),
        side = hash2(x * 0.01, best[1] * 0.01) < 0.5 ? -1 : 1,
        nx = -Math.sin(ang) * side,
        ny = Math.cos(ang) * side,
        bx = best[0] + nx * 13,
        by = best[1] + ny * 13;
      g.save();
      g.translate(bx, by);
      g.rotate(ang);
      g.fillStyle = '#A69A77';
      g.beginPath();
      g.ellipse(0, 0, 42, 12, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#BDAF8A';
      g.beginPath();
      g.ellipse(0, 0, 36, 8, 0, 0, TAU);
      g.fill();
      // Paired delineators make the bay visible in rain and snow without turning it into a car park.
      for (const px of [-34, 34]) {
        g.fillStyle = 'rgba(238,236,218,.9)';
        g.fillRect(px - 1.2, side * 8 - 4, 2.4, 8);
        g.fillStyle = 'rgba(52,54,48,.85)';
        g.fillRect(px - 1.2, side * 8 - 1, 2.4, 2.5);
      }
      g.restore();
    }
    for (const P of accessPaintPaths())
      for (const ox of edgeOffs(Math.min(...P.map(q => q[0])), Math.max(...P.map(q => q[0])))) {
        g.save();
        g.translate(ox, 0);
        strokePoly(g, P, 22, 'rgba(60,62,38,.25)');
        strokePoly(g, P, 18, '#AFA27E');
        strokePoly(g, P, 6, season === 2 ? 'rgba(134,161,93,.55)' : 'rgba(110,150,78,.55)');
        g.restore();
      }
    g.fillStyle = '#AFA27E';
    for (const farm of FARMS) {
      const p = farm.yard.gate;
      g.beginPath();
      g.ellipse(p[0], p[1], 22, 15, farm.yard.ang, 0, TAU);
      g.fill();
    }
  }
  // One tapered apron per physical entrance keeps a T-junction from looking like two round-capped
  // roads laid on top of one another. The paired dark strokes are the culvert carrying the verge ditch.
  for (const junction of accessJunctions()) {
    const root = junction.root,
      tip = junction.tip,
      ra = roadAng(wrapX(root[0]), 45),
      rnx = -Math.sin(ra),
      rny = Math.cos(ra),
      la = Math.atan2(tip[1] - root[1], wdx(tip[0], root[0])),
      lnx = -Math.sin(la),
      lny = Math.cos(la),
      tx = root[0] + wdx(tip[0], root[0]),
      ty = tip[1];
    g.beginPath();
    g.moveTo(root[0] + rnx * 13, root[1] + rny * 13);
    g.lineTo(root[0] - rnx * 13, root[1] - rny * 13);
    g.lineTo(tx - lnx * 9, ty - lny * 9);
    g.lineTo(tx + lnx * 9, ty + lny * 9);
    g.closePath();
    g.fillStyle = winter ? '#E6EAEE' : '#AFA27E';
    g.fill();
    if (!winter) {
      g.strokeStyle = 'rgba(66,70,48,.48)';
      g.lineWidth = 1.5;
      for (const k of [-1, 1]) {
        const cx = lerp(root[0], tx, 0.58) + Math.cos(la) * k * 2.2,
          cy = lerp(root[1], ty, 0.58) + Math.sin(la) * k * 2.2;
        g.beginPath();
        g.moveTo(cx - lnx * 10, cy - lny * 10);
        g.lineTo(cx + lnx * 10, cy + lny * 10);
        g.stroke();
      }
    }
  }
  // Small, deliberate stopping bays make destination traffic read as parked rather than abandoned at
  // a gate. Farm bays sit just inside the courtyard; roadside services mark theirs more clearly.
  for (const b of BUILDS)
    if (b.service === 'farmstore' && b.parkingStops) {
      g.save();
      g.translate(b.stop[0], b.stop[1]);
      g.rotate(b.ang);
      g.fillStyle = winter ? '#A3A29A' : '#B6AA88';
      g.fillRect(-48, -29, 96, 58);
      g.restore();
    }
  for (const b of BUILDS) if (b.service === 'fuel') paintForecourt(g, b, winter);
  for (const spot of vehicleDestinations()) {
    if (spot.pad) continue;
    const service = spot.name !== 'farm';
    g.save();
    g.translate(spot.point[0], spot.point[1]);
    g.rotate(spot.ang);
    g.strokeStyle = winter ? 'rgba(140,150,160,.55)' : service ? 'rgba(226,220,194,.72)' : 'rgba(92,80,58,.42)';
    g.lineWidth = service ? 1.8 : 1.2;
    g.setLineDash(service ? [] : [5, 5]);
    g.strokeRect(-25, -12, 50, 24);
    g.beginPath();
    g.moveTo(-18, -12);
    g.lineTo(-18, 12);
    g.stroke();
    if (!service) {
      g.translate(0, 22);
      g.strokeRect(-25, -12, 50, 24);
      g.beginPath();
      g.moveTo(-18, -12);
      g.lineTo(-18, 12);
      g.stroke();
    }
    g.restore();
  }
  yield;
  // Narrow wheel-worn access tracks, with grass between the ruts. They stay subordinate to the
  // gravel access lanes at a zoomed-out gameplay scale.
  for (const track of FIELD_TRACKS) {
    const P = track.path;
    for (const ox of edgeOffs(Math.min(...P.map(p => p[0])), Math.max(...P.map(p => p[0])))) {
      g.save();
      g.translate(ox, 0);
      strokePoly(g, P, 10, winter ? 'rgba(217,224,228,.76)' : 'rgba(105,92,65,.24)');
      for (const side of [-2.8, 2.8])
        strokePoly(g, offsetPoly(P, side), 2.2, winter ? 'rgba(185,195,204,.82)' : 'rgba(153,136,98,.78)');
      g.restore();
    }
  }
  paintCrossings(winter);
  paintRailSteel();
  function water(c, rf, R0) {
    blobPath(g, c.x, c.y, rf, 20);
    g.fillStyle = winter ? 'rgba(150,165,180,.3)' : 'rgba(70,76,44,.3)';
    g.fill();
    blobPath(g, c.x, c.y, rf, 10);
    g.fillStyle = winter ? '#E4E9ED' : '#A39570';
    g.fill();
    blobPath(g, c.x, c.y, rf, 3);
    g.fillStyle = winter ? '#C4D0D8' : '#6E7650';
    g.fill();
    blobPath(g, c.x, c.y, rf, -2);
    if (winter) {
      const gr = g.createRadialGradient(c.x, c.y, R0 * 0.1, c.x, c.y, R0 * 1.2);
      gr.addColorStop(0, '#A9C2CE');
      gr.addColorStop(1, '#CFDEE5');
      g.fillStyle = gr;
      g.fill();
      g.save();
      blobPath(g, c.x, c.y, rf, -2);
      g.clip();
      // snow blown into long drifts along the wind, with patches of dark clear ice between
      const wa = Math.atan2(WIND.y, WIND.x);
      const soft = (x, y, rx, ry, a, col, al) => {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, `rgba(${col},${al})`);
        gr.addColorStop(0.6, `rgba(${col},${al * 0.45})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.scale(rx, ry);
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, 1, 0, TAU);
        g.fill();
        g.restore();
      };
      for (let i = 0; i < R0 / 40; i++)
        soft(
          c.x + rnd(-R0, R0) * 0.7,
          c.y + rnd(-R0, R0) * 0.7,
          rnd(40, 90),
          rnd(26, 50),
          rnd(0, 3),
          '120,150,170',
          0.22
        );
      for (let i = 0; i < R0 / 16; i++)
        soft(
          c.x + rnd(-R0, R0),
          c.y + rnd(-R0, R0),
          rnd(50, 130),
          rnd(5, 12),
          wa + rnd(-0.12, 0.12),
          '248,250,253',
          0.5
        );
      g.strokeStyle = 'rgba(255,255,255,.7)';
      g.lineWidth = 1.2;
      for (let i = 0; i < R0 / 20; i++) {
        let x = c.x + rnd(-R0 * 0.8, R0 * 0.8),
          y = c.y + rnd(-R0 * 0.8, R0 * 0.8);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += rnd(-40, 40);
          y += rnd(-25, 25);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.restore();
      return;
    }
    const gr = g.createRadialGradient(c.x - R0 * 0.2, c.y - R0 * 0.2, R0 * 0.1, c.x, c.y, R0 * 1.25);
    gr.addColorStop(0, '#27505F');
    gr.addColorStop(0.62, '#336272');
    gr.addColorStop(1, '#57918F');
    g.fillStyle = gr;
    g.fill();
    g.save();
    blobPath(g, c.x, c.y, rf, -2);
    g.clip();
    blobPath(g, c.x, c.y, rf, -2);
    g.lineWidth = 30;
    g.strokeStyle = 'rgba(120,170,150,.2)';
    g.stroke();
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(160,196,168,.22)';
    g.stroke();
    g.strokeStyle = 'rgba(205,228,222,.07)';
    g.lineWidth = 2;
    for (let i = 0; i < R0 / 7; i++) {
      const x = c.x + rnd(-R0, R0),
        y = c.y + rnd(-R0, R0);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rnd(40, 120), y + rnd(-5, 5));
      g.stroke();
    }
    g.restore();
  }
  water(LAKE, lakeR, LAKE.r);
  yield;
  if (POND.x > 0) water(POND, pondR, POND.r);
  // the lily pads are drawn live over the water, so they ride the waves (waves.js)
  g.lineCap = 'butt';
  g.strokeStyle = 'rgba(20,30,20,.3)';
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(JET.x0 + 6, JET.y0 + 6);
  g.lineTo(JET.x1 + 6, JET.y1 + 6);
  g.stroke();
  g.strokeStyle = winter ? '#C9CBC8' : '#7A6247';
  g.lineWidth = 13;
  g.beginPath();
  g.moveTo(JET.x0, JET.y0);
  g.lineTo(JET.x1, JET.y1);
  g.stroke();
  const jl = Math.hypot(JET.x1 - JET.x0, JET.y1 - JET.y0);
  g.strokeStyle = winter ? '#A9ABA8' : '#9C8160';
  g.lineWidth = 1;
  for (let s = 3; s < jl; s += 6) {
    const t = s / jl,
      x = lerp(JET.x0, JET.x1, t),
      y = lerp(JET.y0, JET.y1, t);
    g.beginPath();
    g.moveTo(x - tg[0] * 6, y - tg[1] * 6);
    g.lineTo(x + tg[0] * 6, y + tg[1] * 6);
    g.stroke();
  }
  composeG();
  paintTracks(season);
  R = keepR;
  G.ver = (G.ver || 0) + 1; // lets the seam strip in render.js know to rebuild
  // a wooden plank deck wherever the road or a lane crosses the railway, so the crossing reads as a
  // built thing rather than two textures just overlapping; the rails themselves are repainted on top
  // right after, so their running surface still shows through the planking
  function paintCrossings(winter) {
    for (const c of CROSSINGS) {
      const relA = c.ang - c.rang,
        s = Math.max(Math.abs(Math.sin(relA)), 0.28),
        hl = clamp(26 / s, 26, 70),
        hw = c.w;
      for (const ox of edgeOffs(c.x - hl - 20, c.x + hl + 20)) {
        g.save();
        g.translate(c.x + ox, c.y);
        g.rotate(c.ang);
        if (c.underpass) {
          // The road drops into a short dark cutting while the railway stays on
          // its embankment above. Pale retaining walls make the two levels read.
          g.fillStyle = winter ? 'rgba(72,78,86,.78)' : 'rgba(48,43,34,.78)';
          g.fillRect(-hl * 1.15, -hw, hl * 2.3, hw * 2);
          const wall = g.createLinearGradient(-hl * 1.15, 0, hl * 1.15, 0);
          wall.addColorStop(0, winter ? '#BCC3CA' : '#8E846E');
          wall.addColorStop(0.22, winter ? '#737B84' : '#554D40');
          wall.addColorStop(0.78, winter ? '#737B84' : '#554D40');
          wall.addColorStop(1, winter ? '#BCC3CA' : '#8E846E');
          g.fillStyle = wall;
          g.fillRect(-hl * 1.15, -hw - 4, hl * 2.3, 4);
          g.fillRect(-hl * 1.15, hw, hl * 2.3, 4);
          g.restore();
          continue;
        }
        g.fillStyle = winter ? 'rgba(213,217,222,.92)' : '#7C6A50';
        g.fillRect(-hl, -hw, hl * 2, hw * 2);
        // worn wheel path down the middle where wheels have crossed it season after season
        g.fillStyle = winter ? 'rgba(180,186,194,.4)' : 'rgba(40,32,20,.18)';
        g.fillRect(-hl, -hw * 0.32, hl * 2, hw * 0.64);
        // plank seams, perpendicular to the rails
        g.strokeStyle = winter ? 'rgba(140,144,150,.5)' : 'rgba(48,38,24,.5)';
        g.lineWidth = 1.3;
        g.beginPath();
        for (let px = -hl + 6; px < hl - 3; px += 9) {
          g.moveTo(px, -hw + 1);
          g.lineTo(px, hw - 1);
        }
        g.stroke();
        g.strokeStyle = winter ? 'rgba(150,158,168,.6)' : 'rgba(90,76,54,.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.rect(-hl, -hw, hl * 2, hw * 2);
        g.stroke();
        g.restore();
      }
    }
  }
}
/* one field painted as a given kind (the kinds a field passes through over the year: snow, plow, sown, grain,
   ripe, stubble, crop, dormant pasture, pasture, sty). Also used by grow.js for the within-season stages. */
function paintField(g, f, kind, season, edge = true) {
  const winter = season === 3;
  g.save();
  fieldPath(g, f);
  g.clip();
  const lines = (step, w, col, off = 0) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    // rows run along the plot's heading (plots cut from a tract carry `ang`, older ones `dir`)
    const an = f.ang !== undefined ? f.ang : f.dir ? Math.PI / 2 : 0,
      r = Math.hypot(f.w, f.h) / 2;
    g.save();
    g.translate(f.x + f.w / 2, f.y + f.h / 2);
    g.rotate(an);
    g.beginPath();
    for (let y = -r + off; y < r; y += step) {
      g.moveTo(-r, y);
      g.lineTo(r, y + rnd(-3, 3));
    }
    g.stroke();
    g.restore();
  };
  // soft, feathered patches (hard-edged ones read as camouflage)
  const blotch = (n, a, b2, rmin, rmax) => {
    for (let i = 0; i < n; i++) {
      const col = R() < 0.5 ? a : b2,
        x = rnd(f.x, f.x + f.w),
        y = rnd(f.y, f.y + f.h),
        rx = rnd(rmin, rmax) * 1.3,
        ry = rnd(0.45, 0.7),
        an = rnd(0, 3);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, col);
      gr.addColorStop(
        0.55,
        col.replace(/,([\d.]+)\)$/, (m, al) => `,${al * 0.5})`)
      );
      gr.addColorStop(1, col.replace(/,([\d.]+)\)$/, ',0)'));
      g.save();
      g.translate(x, y);
      g.rotate(an);
      g.scale(rx, rx * ry);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, 1, 0, TAU);
      g.fill();
      g.restore();
    }
  };
  if (kind === 'snow') {
    g.fillStyle = '#EEF2F6';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(26, 'rgba(255,255,255,.7)', 'rgba(200,212,226,.4)', 30, 90);
    // furrows only show through the snow here and there - a trampled pen has no furrows to show
    if (f.t !== 'pasture' && f.t !== 'sty') {
      g.save();
      g.globalAlpha = 0.55;
      lines(13, 1.3, 'rgba(160,176,196,.3)');
      g.restore();
    }
  } else if (kind === 'sty') {
    // churned, muddy pen - soft irregular wallows instead of tilled rows
    g.fillStyle = '#6B4A32';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(20, 'rgba(84,58,38,.55)', 'rgba(120,90,58,.4)', 10, 26);
    blotch(8, 'rgba(46,34,24,.5)', 'rgba(60,44,30,.4)', 16, 30);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(38,32,26,.4)';
      g.beginPath();
      g.ellipse(rnd(f.x + 14, f.x + f.w - 14), rnd(f.y + 14, f.y + f.h - 14), rnd(9, 15), rnd(5, 9), rnd(0, 3), 0, TAU);
      g.fill();
    }
  } else if (kind === 'stubble') {
    g.fillStyle = '#C9AA5C';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(34, 'rgba(222,194,116,.45)', 'rgba(170,138,70,.3)', 30, 90);
    lines(8, 1.8, 'rgba(120,94,42,.3)');
    lines(8, 1.1, 'rgba(236,214,150,.26)', 4);
    lines(92, 5, 'rgba(132,104,52,.3)', 30);
  } else if (kind === 'plow') {
    g.fillStyle = '#7A5A3F';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(28, 'rgba(95,70,48,.5)', 'rgba(140,108,78,.35)', 30, 80);
    lines(8, 3.5, 'rgba(50,34,22,.5)');
    lines(8, 1.2, 'rgba(172,136,100,.3)', 3);
  } else if (kind === 'sown') {
    g.fillStyle = '#806247';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(22, 'rgba(100,76,54,.5)', 'rgba(150,120,90,.3)', 30, 80);
    lines(9, 2, 'rgba(60,44,30,.4)');
    lines(9, 1.6, 'rgba(130,170,80,.5)', 4);
  } else if (kind === 'grain') {
    g.fillStyle = '#A9B25A';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(36, 'rgba(206,200,116,.4)', 'rgba(128,150,74,.3)', 30, 100);
    lines(8, 1.6, 'rgba(90,110,50,.26)');
    lines(8, 1, 'rgba(230,226,160,.24)', 4);
  } else if (kind === 'ripe') {
    // standing grain gone gold, combed into soft swathes by the wind
    g.fillStyle = '#CFAC55';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(40, 'rgba(236,210,128,.5)', 'rgba(170,134,58,.35)', 30, 100);
    lines(6, 2, 'rgba(146,112,46,.3)');
    lines(6, 1.2, 'rgba(246,226,156,.32)', 3);
    blotch(10, 'rgba(120,96,40,.22)', 'rgba(250,232,170,.26)', 60, 140);
  } else if (kind === 'rape') {
    // winter rapeseed in spring: a blue-green mat of rosettes thickening into stems
    g.fillStyle = '#5E7F46';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(30, 'rgba(110,150,80,.45)', 'rgba(70,104,60,.4)', 24, 80);
    lines(10, 2.2, 'rgba(60,92,52,.3)');
  } else if (kind === 'bloom') {
    // in flower: a sheet of yellow that carries a long way across the land
    g.fillStyle = '#C9B93A';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(34, 'rgba(236,214,58,.5)', 'rgba(150,150,56,.35)', 24, 80);
    lines(9, 1.6, 'rgba(110,128,50,.28)');
  } else if (kind === 'pods') {
    // petals fallen, the green pods ripening towards straw
    g.fillStyle = '#8E9A48';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(30, 'rgba(184,170,86,.45)', 'rgba(100,122,56,.4)', 24, 80);
    lines(9, 1.4, 'rgba(120,120,52,.28)');
  } else if (kind === 'onion') {
    // pale blue-green quills in tidy bands, the tops yellowing and flopping over before they are lifted
    const au = season === 2;
    g.fillStyle = au ? '#8A7A50' : '#74744A';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(26, au ? 'rgba(170,150,86,.4)' : 'rgba(140,164,96,.4)', 'rgba(90,86,56,.35)', 24, 70);
    lines(7, 2.2, au ? 'rgba(150,130,70,.4)' : 'rgba(132,168,96,.4)');
    lines(7, 1, 'rgba(60,50,34,.3)', 3);
  } else if (kind === 'dormant') {
    // last year's grass, flattened and straw-coloured by the snow, with the first green at its roots
    g.fillStyle = '#A89A6A';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(30, 'rgba(188,172,118,.5)', 'rgba(126,130,78,.35)', 20, 70);
    g.fillStyle = 'rgba(122,150,70,.35)';
    for (let i = 0; i < (f.w * f.h) / 300; i++) g.fillRect(rnd(f.x, f.x + f.w), rnd(f.y, f.y + f.h), 2, 2);
  } else if (kind === 'pasture') {
    // grazed turf stays greener than the hay meadow round it, but by autumn it has dulled and yellowed too
    const au = season === 2;
    g.fillStyle = season === 1 ? '#7DA452' : season === 0 ? '#94B866' : '#8C9A57';
    g.fillRect(f.x, f.y, f.w, f.h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle =
        R() < 0.5
          ? au
            ? 'rgba(112,128,64,.4)'
            : 'rgba(110,150,70,.4)'
          : au
            ? 'rgba(176,168,96,.3)'
            : 'rgba(170,190,100,.3)';
      g.beginPath();
      g.arc(rnd(f.x, f.x + f.w), rnd(f.y, f.y + f.h), rnd(8, 36), 0, TAU);
      g.fill();
    }
    g.strokeStyle = 'rgba(150,150,100,.35)';
    g.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(rnd(f.x, f.x + f.w), f.y);
      g.bezierCurveTo(
        rnd(f.x, f.x + f.w),
        rnd(f.y, f.y + f.h),
        rnd(f.x, f.x + f.w),
        rnd(f.y, f.y + f.h),
        rnd(f.x, f.x + f.w),
        f.y + f.h
      );
      g.stroke();
    }
  } else {
    // potato rows: ridges under bushy green haulm, dying back to yellow-brown before the lifting
    const au = season === 2;
    g.fillStyle = '#6D573F';
    g.fillRect(f.x, f.y, f.w, f.h);
    lines(14, 6, au ? '#8A7440' : season === 1 ? '#4F8036' : '#5B8A3E');
    lines(14, 2.5, au ? '#A89050' : '#76A152', -1.5);
  }
  g.restore();
  if (!edge) return;
  {
    const mc = winter ? '236,240,245' : season === 2 ? '150,150,86' : season === 1 ? '104,140,70' : '122,152,80';
    fieldPath(g, f);
    g.lineJoin = 'round';
    for (const [w2, al] of [
      [22, 0.16],
      [11, 0.24],
      [5, 0.3]
    ]) {
      g.lineWidth = w2;
      g.strokeStyle = `rgba(${mc},${al})`;
      g.stroke();
    }
    g.lineWidth = 1.2;
    g.strokeStyle = winter ? 'rgba(160,172,188,.3)' : 'rgba(70,60,34,.18)';
    g.stroke();
  }
  if (f.t === 'pasture' && season < 2) {
    const cols =
      season === 0 ? ['#F4F2EA', '#F4F2EA', '#E9D35A', '#F4F2EA'] : ['#E8E4F2', '#E9D35A', '#B08AD0', '#F2F0E6'];
    for (let i = 0; i < (f.w * f.h) / (season === 0 ? 1100 : 800); i++) {
      g.fillStyle = pick(cols);
      const x = rnd(f.x, f.x + f.w),
        y = rnd(f.y, f.y + f.h);
      if (inField(f, x, y, -3)) g.fillRect(x, y, 2.4, 2.4);
    }
  }
  if (f.t === 'sty' && !winter) {
    g.fillStyle = 'rgba(226,198,140,.55)';
    for (let i = 0; i < 16; i++) {
      const x = rnd(f.x, f.x + f.w),
        y = rnd(f.y, f.y + f.h),
        an = rnd(0, TAU);
      if (!inField(f, x, y, -4)) continue;
      g.save();
      g.translate(x, y);
      g.rotate(an);
      g.fillRect(-rnd(2, 4), 0, rnd(4, 8), 1);
      g.restore();
    }
  }
}
/* hare and deer tracks wandering across the snow, painted last and straight onto G's own
   canonical width - each trail is folded back into [0,W) with wrapX as it's drawn, so a trail
   that wanders past the seam just carries straight on from the other side, with no independent
   "other copy" to blend against and no ghosting. */
function paintTracks(season) {
  if (season !== 3) return;
  const c = gG;
  c.setTransform(S, 0, 0, S, 0, 0);
  c.fillStyle = 'rgba(120,138,160,.5)';
  for (let t = 0; t < 16; t++) {
    let x = R() * W,
      y = R() * H,
      a = rnd(0, TAU);
    const hare = R() < 0.6;
    for (let i = 0; i < 50; i++) {
      a += rnd(-0.35, 0.35);
      x += Math.cos(a) * (hare ? 9 : 7);
      y += Math.sin(a) * (hare ? 9 : 7) * 0.8;
      const wx = wrapX(x);
      if (hare) {
        c.fillRect(wx, y, 1.6, 1.6);
        c.fillRect(wrapX(wx + 2), y + 1, 1.6, 1.6);
      } else {
        c.fillRect(wrapX(wx + Math.sin(a) * 2), y - Math.cos(a) * 2, 1.4, 1.8);
      }
    }
  }
}
/* copy the middle period into G, then blend each edge band with the strip from the far side,
   so the ground at x=W runs straight on into x=0 */
function composeG() {
  const c = gG,
    b = Math.round(GB * S),
    w = G.width,
    h = G.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.clearRect(0, 0, w, h);
  c.drawImage(GE, b, 0, w, h, 0, 0, w, h);
  const tmp = mk(b, h),
    q = tmp.getContext('2d');
  const band = (sx, dx, a0, a1) => {
    q.globalCompositeOperation = 'copy';
    q.drawImage(GE, sx, 0, b, h, 0, 0, b, h);
    q.globalCompositeOperation = 'destination-in';
    const gr = q.createLinearGradient(0, 0, b, 0);
    gr.addColorStop(0, `rgba(0,0,0,${a0})`);
    gr.addColorStop(1, `rgba(0,0,0,${a1})`);
    q.fillStyle = gr;
    q.fillRect(0, 0, b, h);
    c.drawImage(tmp, dx, 0);
  };
  band(0, w - b, 0, 0.5); // east edge takes in what lies just west of x=0
  band(b + w, 0, 0.5, 0); // west edge takes in what lies just east of x=W
  // G now holds the season's ground; the widened scratch canvas (~17 MB) waits empty for the next repaint
  GE.width = GE.height = 1;
}
/* forest floor and the smaller textures of open land, scattered over the whole (widened) ground */
function paintFloor(season, RX, RY, K, fAt, bogAt, rockAt) {
  const winter = season === 3;
  const pts = [];
  for (let i = 0; i < 30000 * K; i++) {
    const x = RX(),
      y = RY();
    if (y < -40 || y > shoreY(x) - 30) continue;
    pts.push([x, y, fAt(x, y)]);
  }
  const forest = pts.filter(p => p[2] > 0.6),
    open = pts.filter(p => p[2] < 0.52);
  // small dots are batched per colour into one path each (thousands of single fillRects are slow)
  const DB = new Map(),
    dots = (x, y, n, rad, col, sz = 1.8) => {
      let a2 = DB.get(col);
      if (!a2) DB.set(col, (a2 = []));
      for (let i = 0; i < n; i++) {
        const a = R() * TAU,
          d = Math.sqrt(R()) * rad;
        a2.push(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, sz);
      }
    };
  if (!winter) {
    // moss cushions
    g.fillStyle = season === 2 ? 'rgba(118,136,58,.32)' : season === 0 ? 'rgba(112,152,64,.34)' : 'rgba(92,138,56,.34)';
    for (const [x, y] of forest) {
      if (R() < 0.7) continue;
      g.beginPath();
      g.ellipse(x, y, rnd(4, 11), rnd(3, 7), rnd(0, 3), 0, TAU);
      g.fill();
    }
    // needle litter
    g.strokeStyle = season === 2 ? 'rgba(158,98,50,.5)' : 'rgba(136,92,54,.42)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (const [x, y] of forest) {
      if (R() < 0.45) continue;
      for (let k = 0; k < 3; k++) {
        const px = x + rnd(-6, 6),
          py = y + rnd(-5, 5),
          a = rnd(0, TAU),
          l = rnd(2, 4);
        g.moveTo(px, py);
        g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      }
    }
    g.stroke();
    // ferns where the floor is damp; brown in autumn, small and young in spring
    const fcol = season === 2 ? 'rgba(170,110,54,.75)' : season === 0 ? 'rgba(126,170,72,.7)' : 'rgba(84,134,56,.75)',
      fs = season === 0 ? 0.6 : 1;
    g.strokeStyle = fcol;
    g.lineWidth = 1;
    g.beginPath();
    for (const [x, y] of forest) {
      if (R() < 0.55 || pfbm(x, y, 200, 31, 5) < 0.56) continue;
      const s = rnd(7, 13) * fs,
        a0 = rnd(0, TAU);
      for (let k = 0; k < 5; k++) {
        const a = a0 + (k * TAU) / 5 + rnd(-0.3, 0.3),
          Lf = s * rnd(0.7, 1),
          ex = x + Math.cos(a) * Lf,
          ey = y + Math.sin(a) * Lf * 0.8;
        g.moveTo(x, y);
        g.lineTo(ex, ey);
        for (let j = 1; j < 5; j++) {
          const t = j / 5,
            px = lerp(x, ex, t),
            py = lerp(y, ey, t),
            w = (1 - t) * s * 0.3;
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(a + 1.1) * w, py + Math.sin(a + 1.1) * w * 0.8);
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(a - 1.1) * w, py + Math.sin(a - 1.1) * w * 0.8);
        }
      }
    }
    g.stroke();
    // blueberry and lingonberry heath in drier patches
    for (const [x, y] of forest) {
      if (R() < 0.6 || pfbm(x, y, 240, 57, 19) < 0.54) continue;
      dots(x, y, 9, 7, season === 2 ? 'rgba(168,64,44,.6)' : 'rgba(46,74,38,.6)', 2);
      if (season === 1 && R() < 0.6) dots(x, y, 3, 6, '#3E4F92', 1.6);
      if (season === 2 && R() < 0.3) dots(x, y, 2, 6, '#C4302A', 1.5);
    }
    // mushrooms in autumn
    if (season === 2)
      for (const [x, y] of forest) {
        if (R() < 0.94) continue;
        const fly = R() < 0.3;
        g.fillStyle = fly ? '#C8342A' : '#D9C9A8';
        g.beginPath();
        g.ellipse(x, y, 2.2, 1.6, 0, 0, TAU);
        g.fill();
        if (fly) {
          g.fillStyle = '#F4EEE4';
          g.fillRect(x - 0.8, y - 0.6, 1, 1);
        }
      }
    // anthills in the spruce woods
    for (const [x, y, f] of forest) {
      if (f < 0.7 || R() < 0.985) continue;
      const r = rnd(5, 7);
      g.fillStyle = '#6A4E34';
      g.beginPath();
      g.ellipse(x, y, r, r * 0.8, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#8A6A48';
      g.beginPath();
      g.ellipse(x - 1, y - 1, r * 0.6, r * 0.45, 0, 0, TAU);
      g.fill();
      dots(x, y, 6, r, 'rgba(50,34,22,.6)', 1);
    }
  } else {
    // winter: needle and cone patches showing through thin snow under the trees
    for (const [x, y] of forest) {
      if (R() < 0.8) continue;
      g.fillStyle = 'rgba(110,104,94,.22)';
      g.beginPath();
      g.ellipse(x, y, rnd(4, 10), rnd(3, 6), rnd(0, 3), 0, TAU);
      g.fill();
    }
  }
  // fallen trunks and branches, mossy or snow-topped
  for (const [x, y] of forest) {
    if (R() < 0.988) continue;
    const a = rnd(-0.6, 0.6) + (R() < 0.5 ? 0 : Math.PI),
      l = rnd(18, 40),
      ex = x + Math.cos(a) * l,
      ey = y + Math.sin(a) * l * 0.7;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(30,24,16,.35)';
    g.lineWidth = 4.5;
    g.beginPath();
    g.moveTo(x + 1, y + 1.5);
    g.lineTo(ex + 1, ey + 1.5);
    g.stroke();
    g.strokeStyle = '#5A4430';
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(ex, ey);
    g.stroke();
    g.strokeStyle = winter ? 'rgba(245,248,252,.9)' : 'rgba(110,146,62,.7)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y - 1);
    g.lineTo(lerp(x, ex, 0.7), lerp(y, ey, 0.7) - 1);
    g.stroke();
    g.lineCap = 'butt';
  }
  // open land: wet bog hollows, bare rock, wildflowers
  for (const [x, y] of open) {
    if (R() < 0.5 || bogAt(x, y) < 0.64) continue;
    if (winter) {
      if (R() < 0.3) {
        g.fillStyle = 'rgba(170,190,205,.45)';
        g.beginPath();
        g.ellipse(x, y, rnd(5, 12), rnd(3, 6), 0, 0, TAU);
        g.fill();
      }
      continue;
    }
    if (R() < 0.12) {
      const rx = rnd(6, 14),
        ry = rx * rnd(0.4, 0.55);
      g.fillStyle = 'rgba(120,138,104,.35)';
      g.beginPath();
      g.ellipse(x, y, rx + 3, ry + 2, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(66,84,78,.42)';
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(170,196,200,.25)';
      g.fillRect(x - rx * 0.4, y - ry * 0.3, rx * 0.5, 1);
    } else if (season === 1)
      dots(x, y, 5, 6, 'rgba(250,250,244,.85)', 1.6); // cotton grass
    else dots(x, y, 6, 7, season === 2 ? 'rgba(170,70,48,.5)' : 'rgba(170,120,80,.4)', 1.8);
  } // sphagnum
  for (const [x, y] of open) {
    if (R() < 0.82 || rockAt(x, y) < 0.76) continue;
    const r = rnd(9, 18),
      n = 7;
    g.fillStyle = winter ? 'rgba(196,202,210,.55)' : 'rgba(150,150,140,.5)';
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU,
        rr2 = r * rnd(0.7, 1.1);
      const px = x + Math.cos(a) * rr2,
        py = y + Math.sin(a) * rr2 * 0.75;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(80,80,74,.4)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x - r * 0.5, y);
    g.lineTo(x + r * 0.3, y + r * 0.2);
    g.stroke();
    if (!winter) dots(x, y, 4, r * 0.7, 'rgba(200,196,120,.7)', 1.4);
  }
  if (season < 2) {
    const FC =
      season === 0 ? ['#F6F4EC', '#F6F4EC', '#E9D35A'] : ['#B08AD0', '#E9D35A', '#F2F0E6', '#6E8AD0', '#D9587A'];
    for (const [x, y] of open) {
      if (R() < 0.55 || pfbm(x, y, 180, 43, 11) < 0.58) continue;
      dots(x, y, 4, 9, pick(FC), 2);
    }
  }
  // hare and deer tracks: painted separately, straight onto the composed canonical canvas (see
  // paintTracks) rather than here in the padded margin - a wandering trail is a one-off random
  // walk, not a periodic function, so a copy of it seeded in the margin never matches the copy
  // seeded on the far side of the seam, and blending the two together at the wrap band just
  // ghosts two unrelated trails on top of each other instead of hiding a seam.
  for (const [col, a2] of DB) {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < a2.length; i += 3) g.rect(a2[i], a2[i + 1], a2[i + 2], a2[i + 2] * 0.85);
    g.fill();
  }
}
/* reeds, water glints and the minimap for the current land */
function buildExtras() {
  for (const [c, rf] of [
    [LAKE, lakeR],
    [POND, pondR]
  ]) {
    if (c.x < 0) continue;
    const ph = rnd(0, TAU);
    for (let a = 0; a < TAU; a += 0.018) {
      if (Math.sin(a * 3 + ph) < 0.35 || R() < 0.35) continue;
      const r = rf(a) - rnd(-2, 16);
      REEDS.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, h: rnd(9, 17), l: rnd(-3, 3) });
    }
  }
  for (let i = 0; i < 260; i++) {
    const inL = i < 230 || POND.x < 0,
      c = inL ? LAKE : POND,
      rf = inL ? lakeR : pondR;
    const a = rnd(0, TAU),
      r = Math.sqrt(R()) * (rf(a) - 12);
    SPARK.push({
      x: c.x + Math.cos(a) * r,
      y: c.y + Math.sin(a) * r,
      p: rnd(0, TAU),
      l: rnd(4, 10),
      s: rnd(0.7, 1.4),
      fT: -9,
      fk: 1
    });
  }
}
