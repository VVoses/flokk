/* Flokk - sky.js
   Natural borders: shoreline, sky layers, clouds, boulders.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- natural borders: fjord to the south, mountains to the north ---------- */
let SHORE = { a: 0, b: 0 };
const shoreY = x =>
  H -
  210 +
  48 * Math.sin((x * TAU * 2) / W + SHORE.a) +
  28 * Math.sin((x * TAU * 5) / W + SHORE.b) +
  50 * (pfbm(x, 0, 600, SHORE.a, 7.3) - 0.5);
const RIDGES = [],
  SKYCLOUDS = [],
  CLOUDSH = [],
  SEASPARK = [],
  BOULDERS = [],
  BUSHES = [];
function genSky() {
  RIDGES.length = 0;
  SKYCLOUDS.length = 0;
  CLOUDSH.length = 0;
  const lay = (by, p, base, amp, freq, top, bot, snow, trees) => {
    const step = 12,
      n = 640,
      P = n * step,
      hs = new Float32Array(n),
      o = rnd(0, 400);
    let mx = 0;
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const ridge = 1 - Math.abs(pfbmP(x, 0, freq, P, o, o) * 2 - 1);
      const h = Math.max(
        16,
        base +
          amp * (pfbmP(x, 0, freq * 0.55, P, o * 2, o + 5) - 0.45) * 1.7 +
          amp * 0.9 * (ridge - 0.5) +
          amp * 0.12 * (pfbmP(x, 0, freq * 0.12, P, 0, o + 9) - 0.5)
      );
      hs[i] = h;
      if (h > mx) mx = h;
    }
    RIDGES.push({
      by,
      p,
      base,
      amp,
      x0: 0,
      step,
      hs,
      mx,
      top,
      bot,
      snow,
      snowH: base + amp * 0.32,
      trees,
      tt: trees ? Array.from({ length: n }, () => rnd(0.6, 1.35)) : null
    });
  };
  // four depth bands, nearest last: heights and colors step down together so each band's base
  // sits close to the next nearer one's typical top, instead of one layer looming over the rest
  lay(-160, 0.55, 195, 120, 1200, '#A9BCC8', '#C3CFCC', true, false);
  lay(-128, 0.3, 92, 55, 720, '#889893', '#93A69A', false, false);
  lay(-104, 0.12, 72, 45, 420, '#4B6650', '#5E7560', false, true);
  lay(-93, 0, 40, 30, 300, '#2F4A34', '#2C4430', false, true);
  for (let i = 0; i < 11; i++)
    SKYCLOUDS.push({ x: rnd(0, 6000), y: rnd(-680, -330), s: rnd(0.6, 1.5), p: rnd(0.6, 0.85) });
  for (let i = 0; i < 5; i++) CLOUDSH.push({ x: rnd(0, W), y: rnd(-300, H + 300), s: rnd(650, 1300) });
}
const CLOUD_SPR = (() => {
  const c = mk(520, 220),
    g2 = c.getContext('2d');
  const R2 = mulberry32(99);
  for (let i = 0; i < 24; i++) {
    const x = 110 + R2() * 300,
      y = 132 - R2() * 56 + Math.abs(x - 260) * 0.14,
      r = 28 + R2() * 46;
    const gr = g2.createRadialGradient(x, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.95)');
    gr.addColorStop(0.7, 'rgba(242,244,246,.8)');
    gr.addColorStop(1, 'rgba(228,232,238,0)');
    g2.fillStyle = gr;
    g2.beginPath();
    g2.arc(x, y, r, 0, TAU);
    g2.fill();
  }
  g2.globalCompositeOperation = 'source-atop';
  const lg = g2.createLinearGradient(0, 70, 0, 200);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(1, 'rgba(140,152,170,.5)');
  g2.fillStyle = lg;
  g2.fillRect(0, 0, 520, 220);
  return c;
})();
const SHADOW_SPR = (() => {
  const c = mk(256, 256),
    g2 = c.getContext('2d');
  const R2 = mulberry32(7);
  for (let i = 0; i < 12; i++) {
    const a = R2() * TAU,
      d = R2() * 46,
      x = 128 + Math.cos(a) * d,
      y = 128 + Math.sin(a) * d * 0.8,
      r = 34 + R2() * 36;
    const gr = g2.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(24,34,52,.42)');
    gr.addColorStop(1, 'rgba(24,34,52,0)');
    g2.fillStyle = gr;
    g2.beginPath();
    g2.arc(x, y, r, 0, TAU);
    g2.fill();
  }
  // feather to nothing well before the edge of the canvas
  g2.globalCompositeOperation = 'destination-in';
  const m = g2.createRadialGradient(128, 128, 60, 128, 128, 126);
  m.addColorStop(0, '#000');
  m.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = m;
  g2.fillRect(0, 0, 256, 256);
  return c;
})();
function genBorderBits() {
  SEASPARK.length = 0;
  BOULDERS.length = 0;
  for (let i = 0; i < 300; i++) {
    const x = rnd(0, W),
      y = shoreY(x) + rnd(30, 700);
    SEASPARK.push({ x, y, p: rnd(0, TAU), l: rnd(5, 12), s: rnd(0.6, 1.3) });
  }
  const addB = (x, y, r) => {
    if (
      inBuild(x, y, r + 10) ||
      inBlob(x, y, LAKE, lakeR, r) ||
      inBlob(x, y, POND, pondR, r) ||
      roadDist(x, y) < 30 + r ||
      railDist(x, y) < 24 + r
    )
      return;
    for (const f of FIELDS) if (inField(f, x, y, r)) return;
    for (const Y of YARDS) if (inRect(x, y, Y, r)) return;
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts.push([Math.cos(a) * r * rnd(0.8, 1.1), Math.sin(a) * r * rnd(0.75, 1.05)]);
    }
    const b = { x, y, r, h: r * rnd(0.6, 0.95), pts, moss: R() < 0.6, sea: y > shoreY(x) - 40 };
    BOULDERS.push(b);
    addPerch(x, y + 1, b.h / HZ, 'rock', false, null, y + 0.5);
  };
  for (let x = 0; x < W; x += rnd(70, 160))
    if (R() < 0.35) {
      const y = shoreY(x) + rnd(-40, 60);
      addB(x, y, rnd(8, 20));
    }
  for (let i = 0; i < 60; i++) {
    const x = rnd(0, W),
      y = rnd(0, H - 250);
    if (forestness(x, y) > 0.6 && !underTree(x, y)) addB(x, y, rnd(10, 22));
  }
  for (let i = 0; i < 9; i++) {
    const x = rnd(300, W - 300),
      y = rnd(200, H - 400);
    if (!underTree(x, y) && !inWater(x, y, 20)) addB(x, y, rnd(9, 18));
  }
  genBushes();
}
/* ---------- bushes: low undergrowth along forest edges, field margins and the yard ----------
   Mostly cosmetic clutter (and a low, unshowy perch), but placed thickest through the northern
   band of forest, where they help break up the tree canopy into something less like a solid wall. */
function genBushes() {
  BUSHES.length = 0;
  const addBush = (x, y, r) => {
    if (
      inBuild(x, y, r + 8) ||
      inBlob(x, y, LAKE, lakeR, r) ||
      inBlob(x, y, POND, pondR, r) ||
      roadDist(x, y) < 26 + r ||
      railDist(x, y) < 20 + r ||
      underTree(x, y)
    )
      return;
    for (const f of FIELDS) if (inField(f, x, y, r * 0.4)) return;
    for (const Y of YARDS) if (inRect(x, y, Y, -10)) return; // fine right at the fence line, not in the yard proper
    const n = 4 + ((R() * 3) | 0),
      lobes = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(-0.3, 0.3),
        d = rnd(0.12, 0.5) * r;
      lobes.push([Math.cos(a) * d, Math.sin(a) * d, r * rnd(0.42, 0.64)]);
    }
    const b = { x, y, r, h: r * rnd(0.55, 0.82), lobes, berries: R() < 0.32, ph: rnd(0, 9) };
    BUSHES.push(b);
    addPerch(x, y + 1, (b.h / HZ) * 0.68, 'bush', false, null, y + 0.5);
  };
  // forest-floor undergrowth: thickest at the forest margin, where the canopy leaves it room to
  // grow - which is also exactly where it does the most to soften the tree line into the meadow
  for (let i = 0; i < 900; i++) {
    const x = rnd(0, W),
      y = rnd(0, H - 250),
      f = forestness(x, y);
    if (f < 0.08) continue;
    const edge = clamp(1 - Math.abs(f - 0.42) / 0.42, 0, 1);
    if (R() < 0.1 + 0.55 * edge) addBush(x, y, rnd(9, 17));
  }
  // low cover along field edges, between the hedgerow trees
  for (const f of FIELDS) {
    const P = f.poly;
    for (let i = 0; i < P.length; i++) {
      const p = P[i],
        q = P[(i + 1) % P.length],
        Ld = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let s = 10; s < Ld; s += rnd(30, 55)) {
        if (R() < 0.55) continue;
        const t = s / Ld,
          x = lerp(p[0], q[0], t) + rnd(-14, 14),
          y = lerp(p[1], q[1], t) + rnd(-14, 14);
        addBush(x, y, rnd(7, 13));
      }
    }
  }
  // a few by the yard fences, gone quiet and structural in winter
  for (const Y of YARDS)
    for (let i = 0; i < 3; i++) if (R() < 0.6) addBush(Y.x + rnd(-20, Y.w + 20), Y.y + rnd(-20, Y.h + 20), rnd(8, 13));
}
function drawBoulder(b) {
  const X = b.x,
    Yb = b.y * TILT;
  ctx.fillStyle = '#6E726C';
  ctx.beginPath();
  for (let i = 0; i < b.pts.length; i++) {
    const [px, py] = b.pts[i];
    const y = Yb + py * TILT * 0.5 - (py < 0 ? b.h * 0.6 : 0) - Math.max(0, -py) * 0.2;
    i ? ctx.lineTo(X + px, y) : ctx.moveTo(X + px, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8B8F88';
  ctx.beginPath();
  ctx.ellipse(X - b.r * 0.15, Yb - b.h * 0.62, b.r * 0.72, b.r * 0.34, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath();
  ctx.ellipse(X - b.r * 0.35, Yb - b.h * 0.7, b.r * 0.3, b.r * 0.12, -0.2, 0, TAU);
  ctx.fill();
  if (b.moss) {
    ctx.fillStyle = 'rgba(110,140,70,.7)';
    ctx.beginPath();
    ctx.ellipse(X + b.r * 0.1, Yb - b.h * 0.72, b.r * 0.45, b.r * 0.16, 0.1, 0, TAU);
    ctx.fill();
  }
  if (b.sea) {
    ctx.strokeStyle = 'rgba(225,238,238,.5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(X, Yb, b.r * 1.1 + Math.sin(T * 2 + b.x) * 1.5, b.r * 0.4, 0, 0, Math.PI);
    ctx.stroke();
  }
}
const BUSH_AUT = [
  ['#A47A2E', '#D2A84E'],
  ['#B8582E', '#E08248'],
  ['#8C9138', '#B7BE58']
];
function drawBush(b) {
  const X = b.x,
    Yb = b.y * TILT,
    snow = SEASON === 3,
    aut = SEASON === 2;
  const base = snow ? '#8C8272' : aut ? null : SEASON === 0 ? '#6F9A4C' : '#54803E';
  const hi = snow ? '#A79C89' : aut ? null : SEASON === 0 ? '#8FBB63' : '#6C9955';
  b.lobes.forEach(([dx, dy, rr], i) => {
    ctx.fillStyle = aut ? BUSH_AUT[i % BUSH_AUT.length][0] : base;
    ctx.beginPath();
    ctx.ellipse(X + dx, Yb + dy * TILT * 0.6 - rr * 0.55, rr, rr * 0.82, 0, 0, TAU);
    ctx.fill();
  });
  b.lobes.forEach(([dx, dy, rr], i) => {
    ctx.fillStyle = aut ? BUSH_AUT[i % BUSH_AUT.length][1] : hi;
    ctx.beginPath();
    ctx.ellipse(X + dx * 0.9, Yb + dy * TILT * 0.6 - rr * 0.85, rr * 0.55, rr * 0.32, 0, 0, TAU);
    ctx.fill();
  });
  if (snow) {
    ctx.fillStyle = '#F4F7FA';
    for (const [dx, dy, rr] of b.lobes) {
      ctx.beginPath();
      ctx.ellipse(X + dx, Yb + dy * TILT * 0.6 - rr * 1.0, rr * 0.6, rr * 0.22, 0, 0, TAU);
      ctx.fill();
    }
  } else if (b.berries && SEASON !== 1) {
    // little clustered dots: pale blossom in spring, red berries in autumn
    let s = (b.ph * 10000) | 0;
    ctx.fillStyle = SEASON === 0 ? '#F2E3EC' : '#B3402C';
    for (let i = 0; i < 5; i++) {
      s = (s * 9301 + 49297) % 233280;
      const q = s / 233280,
        [dx, dy, rr] = b.lobes[i % b.lobes.length],
        ang = q * TAU,
        d = q * rr * 0.7;
      ctx.beginPath();
      ctx.arc(X + dx + Math.cos(ang) * d, Yb + dy * TILT * 0.6 - rr * 0.7 + Math.sin(ang) * d * 0.5, 1.1, 0, TAU);
      ctx.fill();
    }
  }
}
