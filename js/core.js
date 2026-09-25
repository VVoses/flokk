/* Flokk - core.js
   Canvas, projection constants, RNG, noise (plain and east-west periodic), geometry helpers.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
let DEV = null; // set by js/dev.js when the page is opened with ?dev
const cv = document.getElementById('game'),
  ctx = cv.getContext('2d');
const W = 4200,
  H = 3000,
  TAU = Math.PI * 2;
/* 2.5D projection: ground plane squashed by TILT, heights lift straight up the screen */
const TILT = 0.62,
  HZ = 42,
  FZ = 2.2,
  HAWKZ = 3.6,
  OWLZ = 2.9;
let SX = 23,
  SY = 17;
const PY = (y, h) => y * TILT - h * HZ;
let vw = innerWidth,
  vh = innerHeight,
  dpr = 1;
function resize() {
  vw = innerWidth;
  vh = innerHeight;
  dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(vw * dpr);
  cv.height = Math.round(vh * dpr);
}
addEventListener('resize', resize);
resize();

/* ---------- helpers ---------- */
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let R = mulberry32(777),
  NS = 0x27d4eb2d,
  SEED = 0;
const rnd = (a, b) => a + R() * (b - a);
const rr = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ NS;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/* the land wraps east-west: x repeats every W, so noise, roads and rails are all built to repeat too */
const wrapX = x => ((x % W) + W) % W;
const wdx = (a, b) => {
  const d = a - b;
  return d - W * Math.round(d / W);
};
function pvn(x, y, P) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % P) + P) % P,
    x1 = (x0 + 1) % P;
  const a = hash2(x0, yi),
    b = hash2(x1, yi),
    c = hash2(x0, yi + 1),
    d = hash2(x1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function pfbmP(x, y, s, P, ox = 0, oy = 0) {
  const n = Math.max(1, Math.round(P / s)),
    u = (x / P) * n + ox,
    v = y / s + oy;
  let t = 0,
    a = 0.5,
    f = 1;
  for (let i = 0; i < 4; i++) {
    t += a * pvn(u * f, v * f, n * f);
    f *= 2;
    a *= 0.5;
  }
  return t / 0.9375;
}
const pfbm = (x, y, s, ox, oy) => pfbmP(x, y, s, W, ox, oy);
// repeat one period of control points to the east and west, and keep only what can be seen
function extP(base) {
  const out = [];
  for (const k of [-1, 0, 1]) for (const p of base) out.push([p[0] + k * W, p[1]]);
  out.push([base[0][0] + 2 * W, base[0][1]]);
  return out;
}
function trimX(P, lo, hi) {
  let a = 0,
    b = P.length - 1;
  while (a < P.length - 1 && P[a + 1][0] < lo) a++;
  while (b > 0 && P[b - 1][0] > hi) b--;
  return P.slice(a, b + 1);
}
// x positions 0..W with random spacing, rescaled so the last lands exactly on W
function periodXs(a, b, stop) {
  const xs = [0];
  while (xs[xs.length - 1] < W - stop) xs.push(xs[xs.length - 1] + rnd(a, b));
  const k = W / xs[xs.length - 1];
  return xs.map(x => x * k);
}
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function angLerp(a, b, t) {
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + d * t;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16,
    g = (n >> 8) & 255,
    b = n & 255;
  if (f < 1) {
    r *= f;
    g *= f;
    b *= f;
  } else {
    r += (255 - r) * (f - 1);
    g += (255 - g) * (f - 1);
    b += (255 - b) * (f - 1);
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function catmull(pts, seg = 14) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] || p2;
    for (let t = 0; t < seg; t++) {
      const s = t / seg,
        s2 = s * s,
        s3 = s2 * s;
      const f = k =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * s +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3);
      out.push([f(0), f(1)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function polyDist(x, y, P) {
  let m = 1e9;
  for (let i = 0; i < P.length - 1; i++) {
    const d = segDist(x, y, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]);
    if (d < m) m = d;
  }
  return m;
}
function offsetPoly(P, o) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(P.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dy / l) * o, p[1] - (dx / l) * o];
  });
}
const inRect = (x, y, r, m = 0) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;

// alpha 0..1 as two hex digits, for '#rrggbb' + hex2(a)
function hex2(a) {
  return ((clamp(a, 0, 1) * 255) | 0).toString(16).padStart(2, '0');
}
