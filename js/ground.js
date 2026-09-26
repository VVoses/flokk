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
function paintGround(season) {
  const keepR = R;
  R = mulberry32((SEED ^ 0x5151) + season * 7919);
  const winter = season === 3,
    [c0, c1, c2] = GRASS[season];
  const XW = W + 2 * GB,
    RX = () => R() * XW - GB,
    RY = () => R() * H;
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
  for (let j = 0; j < nh; j++)
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
      const heath = pfbm(x, y, 380, 17, 3),
        rock = pfbm(x, y, 230, 71, 29),
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
  for (const t0 of TREES) {
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
        g.fillStyle = cols[(R() * cols.length) | 0];
        g.fillRect(tx + Math.cos(a) * d, t.y + Math.sin(a) * d * 0.8, 2.2, 1.8);
      }
    }
  }
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
  const edgeOffs = (a, b) => [0].concat(a < GB + 60 ? [W] : [], b > W - GB - 60 ? [-W] : []);
  for (const YARD of YARDS)
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
      g.fillStyle = winter ? 'rgba(150,160,175,.25)' : 'rgba(90,80,60,.25)';
      g.beginPath();
      for (let i = 0; i < 2200; i++) g.rect(rnd(YARD.x, YARD.x + YARD.w), rnd(YARD.y, YARD.y + YARD.h), 2, 2);
      g.fill();
      g.fillStyle = winter ? 'rgba(255,255,255,.35)' : 'rgba(210,202,172,.3)';
      g.beginPath();
      for (let i = 0; i < 900; i++) g.rect(rnd(YARD.x, YARD.x + YARD.w), rnd(YARD.y, YARD.y + YARD.h), 1.6, 1.6);
      g.fill();
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
  const R0 = R;
  FIELDS.forEach((f, fi) => {
    for (const ox of edgeOffs(f.x, f.x + f.w)) {
      R = mulberry32((SEED ^ 0x77) + fi * 7919 + season * 131);
      g.save();
      g.translate(ox, 0);
      let kind = f.t;
      if (winter) kind = 'snow';
      else if (season === 0)
        kind = f.t === 'pasture' ? 'pasture' : f.t === 'sty' ? 'sty' : f.t === 'plow' ? 'plow' : 'sown';
      else if (season === 1)
        kind = f.t === 'pasture' ? 'pasture' : f.t === 'sty' ? 'sty' : f.t === 'crop' ? 'crop' : 'grain';
      else if (f.t === 'crop') kind = 'plow'; // autumn: the potatoes are lifted (grow.js shows them before that)
      paintField(g, f, kind, season);
      g.restore();
    }
  });
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
  paintRailBed(winter);
  if (winter) {
    strokePoly(g, ROAD, 32, 'rgba(150,160,175,.35)');
    strokePoly(g, ROAD, 26, '#E3E8EC');
    strokePoly(g, offsetPoly(ROAD, 6), 4, 'rgba(165,175,188,.7)');
    strokePoly(g, offsetPoly(ROAD, -6), 4, 'rgba(165,175,188,.7)');
    for (const P of LANES)
      for (const ox of edgeOffs(Math.min(...P.map(q => q[0])), Math.max(...P.map(q => q[0])))) {
        g.save();
        g.translate(ox, 0);
        strokePoly(g, P, 18, '#E6EAEE');
        strokePoly(g, offsetPoly(P, 4), 3, 'rgba(170,180,192,.6)');
        g.restore();
      }
  } else {
    strokePoly(g, ROAD, 58, 'rgba(160,150,110,.09)');
    strokePoly(g, ROAD, 44, 'rgba(160,150,110,.13)');
    strokePoly(g, ROAD, 36, 'rgba(60,62,38,.22)');
    strokePoly(g, ROAD, 29, '#A69A77');
    strokePoly(g, ROAD, 23, '#BDAF8A');
    strokePoly(g, offsetPoly(ROAD, 6), 4, 'rgba(150,136,104,.55)');
    strokePoly(g, offsetPoly(ROAD, -6), 4, 'rgba(150,136,104,.55)');
    for (const P of LANES)
      for (const ox of edgeOffs(Math.min(...P.map(q => q[0])), Math.max(...P.map(q => q[0])))) {
        g.save();
        g.translate(ox, 0);
        strokePoly(g, P, 22, 'rgba(60,62,38,.25)');
        strokePoly(g, P, 18, '#AFA27E');
        strokePoly(g, P, 6, season === 2 ? '#86A15D' : '#7FA858');
        g.restore();
      }
  }
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
  if (POND.x > 0) water(POND, pondR, POND.r);
  if (season === 1 || season === 2) {
    const LILY = rnd(0, TAU);
    for (let i = 0; i < 34; i++) {
      const a = LILY + rnd(-0.3, 0.3),
        r = lakeR(a) - rnd(20, 90);
      const x = LAKE.x + Math.cos(a) * r,
        y = LAKE.y + Math.sin(a) * r,
        s = rnd(4, 7),
        o = rnd(0, TAU);
      g.fillStyle = R() < 0.5 ? '#557F3F' : '#6A9048';
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, s, o + 0.35, o + TAU - 0.35);
      g.closePath();
      g.fill();
    }
  }
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
  } else if (kind === 'dormant') {
    // last year's grass, flattened and straw-coloured by the snow, with the first green at its roots
    g.fillStyle = '#A89A6A';
    g.fillRect(f.x, f.y, f.w, f.h);
    blotch(30, 'rgba(188,172,118,.5)', 'rgba(126,130,78,.35)', 20, 70);
    g.fillStyle = 'rgba(122,150,70,.35)';
    for (let i = 0; i < (f.w * f.h) / 300; i++) g.fillRect(rnd(f.x, f.x + f.w), rnd(f.y, f.y + f.h), 2, 2);
  } else if (kind === 'pasture') {
    g.fillStyle = season === 1 ? '#7DA452' : season === 0 ? '#94B866' : '#8DAE5E';
    g.fillRect(f.x, f.y, f.w, f.h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(110,150,70,.4)' : 'rgba(170,190,100,.3)';
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
    g.fillStyle = '#6D573F';
    g.fillRect(f.x, f.y, f.w, f.h);
    lines(14, 6, season === 1 ? '#4F8036' : '#5B8A3E');
    lines(14, 2.5, '#76A152', -1.5);
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
      g.fillStyle = cols[(R() * 4) | 0];
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
      dots(x, y, 4, 9, FC[(R() * FC.length) | 0], 2);
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
    SPARK.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, p: rnd(0, TAU), l: rnd(4, 10), s: rnd(0.7, 1.4) });
  }
}
