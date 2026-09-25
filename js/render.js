/* Flokk - render.js
   Rendering: copies of the looping world, painter sort, cast shadows.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- rendering ---------- */
/* ground-plane visibility (projected y) and upright visibility (object extends hpx upward) */
const visG = (x, y, m) => x > V.x0 - m && x < V.x1 + m && y * TILT > V.py0 - m && y * TILT < V.py1 + m;
const visU = (x, y, m, hpx) => x > V.x0 - m && x < V.x1 + m && y * TILT - hpx < V.py1 + m && y * TILT > V.py0 - m;

function drawPerched(b, alpha) {
  const s = b.s * 0.95,
    X = b.x + b.hx,
    Y = PY(b.y + b.hy, b.z);
  const f = Math.cos(b.heading) >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(X, Y);
  ctx.scale(f, 1);
  if (alpha < 1) ctx.globalAlpha = alpha;
  const pk = b.peck > 0 ? Math.max(0, Math.sin(b.peck * 18)) * s * 0.35 : 0;
  ctx.strokeStyle = '#8A6A4A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 0.2);
  ctx.lineTo(-s * 0.1, 0);
  ctx.moveTo(s * 0.1, -s * 0.2);
  ctx.lineTo(s * 0.08, 0);
  ctx.stroke();
  ctx.fillStyle = b.c1;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.52);
  ctx.lineTo(-s * 1.02, -s * 0.3);
  ctx.lineTo(-s * 0.98, -s * 0.18);
  ctx.lineTo(-s * 0.3, -s * 0.34);
  ctx.fill();
  ctx.fillStyle = b.c2;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.46, s * 0.56, s * 0.36, -0.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#BCA88C';
  ctx.beginPath();
  ctx.ellipse(s * 0.1, -s * 0.34, s * 0.4, s * 0.22, -0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = b.c1;
  ctx.beginPath();
  ctx.ellipse(-s * 0.14, -s * 0.52, s * 0.42, s * 0.22, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,212,178,.6)';
  ctx.lineWidth = s * 0.06;
  ctx.beginPath();
  ctx.moveTo(-s * 0.02, -s * 0.58);
  ctx.lineTo(-s * 0.38, -s * 0.5);
  ctx.stroke();
  const hx = s * 0.44 + pk * 0.4,
    hy = -s * 0.82 + pk;
  ctx.fillStyle = b.c3;
  ctx.beginPath();
  ctx.arc(hx, hy, s * 0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#CFC4B2';
  ctx.beginPath();
  ctx.ellipse(hx + s * 0.04, hy + s * 0.08, s * 0.13, s * 0.09, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(hx + s * 0.1, hy - s * 0.04, s * 0.045, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#D8B25A';
  ctx.beginPath();
  ctx.moveTo(hx + s * 0.2, hy - s * 0.05);
  ctx.lineTo(hx + s * 0.4, hy + s * 0.02);
  ctx.lineTo(hx + s * 0.2, hy + s * 0.07);
  ctx.fill();
  if (b === L) {
    ctx.fillStyle = '#F2C94C';
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.05, hy - s * 0.55);
    ctx.lineTo(hx + s * 0.1, hy - s * 0.35);
    ctx.lineTo(hx - s * 0.2, hy - s * 0.35);
    ctx.fill();
  }
  ctx.restore();
}
/* 3D hawk: wings, tail and body are modelled in the bird's own frame (forward, right, up),
   rotated by bank, pitch and heading, then projected like everything else in the world. */
const HLIGHT = (() => {
  const v = [-0.45, -0.35, 0.82],
    l = Math.hypot(...v);
  return v.map(x => x / l);
})();
const HVIEW = (() => {
  const l = Math.hypot(1, TILT);
  return [0, 1 / l, TILT / l];
})();
const OWING = [
  [0.2, 0.12],
  [0.26, 0.45],
  [0.2, 0.78],
  [0.1, 1.02],
  [0.02, 1.1],
  [-0.06, 1.15],
  [-0.12, 1.16],
  [-0.18, 1.15],
  [-0.24, 1.1],
  [-0.3, 1.02],
  [-0.36, 0.86],
  [-0.37, 0.62],
  [-0.32, 0.34],
  [-0.26, 0.12]
];
const HWING = [
  [0.18, 0.12],
  [0.22, 0.45],
  [0.13, 0.76],
  [-0.02, 1.16],
  [-0.06, 1.08],
  [-0.12, 1.26],
  [-0.16, 1.16],
  [-0.22, 1.29],
  [-0.26, 1.17],
  [-0.32, 1.22],
  [-0.36, 1.02],
  [-0.35, 0.7],
  [-0.3, 0.36],
  [-0.24, 0.12]
];
function hawkGeom(h) {
  const K = h.s * (0.92 + 0.06 * h.z);
  const cb = Math.cos(h.bank),
    sb = Math.sin(h.bank),
    cp = Math.cos(h.pitch),
    sp = Math.sin(h.pitch),
    cy = Math.cos(h.psi),
    sy = Math.sin(h.psi);
  const T3 = (f, s2, u) => {
    f *= K;
    s2 *= K;
    u *= K;
    const s1 = s2 * cb + u * sb,
      u1 = u * cb - s2 * sb;
    const f2 = f * cp + u1 * sp,
      u2 = u1 * cp - f * sp;
    return [f2 * cy - s1 * sy, f2 * sy + s1 * cy, u2];
  };
  const fold = h.fold,
    span = 1 - 0.5 * fold,
    beat = h.flapOn || Math.abs(Math.sin(h.flap)) > 0.08 ? Math.sin(h.flap) * 0.55 : 0;
  const wing = sg =>
    (h.kind === 'owl' ? OWING : HWING).map(([f, s2]) => {
      const ff = f - fold * 0.55 * s2,
        u = h.dih * s2 + beat * Math.pow(s2, 1.25) * (1 - fold);
      return T3(ff, sg * s2 * span, u);
    });
  const fan = 0.2 + 0.3 * h.fan,
    tl = h.kind === 'owl' ? 0.62 : 1;
  const tail = [
    [-0.3, -0.1],
    [-0.78, -fan],
    [-0.88, -fan * 0.45],
    [-0.91, 0],
    [-0.88, fan * 0.45],
    [-0.78, fan],
    [-0.3, 0.1]
  ].map(([f, s2]) => T3(-0.3 + (f + 0.3) * tl, s2, 0.03));
  return { K, T3, wR: wing(1), wL: wing(-1), tail };
}
function wingNormal(p, sg) {
  const a = p[0],
    b = p[7],
    c = p[11];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = (Math.hypot(n[0], n[1], n[2]) || 1) * sg;
  return [n[0] / l, n[1] / l, n[2] / l];
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function drawHawk(h) {
  const g = hawkGeom(h),
    K = g.K;
  ctx.save();
  ctx.globalAlpha = Math.max(0, h.alpha);
  const P = p => [h.x + p[0], (h.y + p[1]) * TILT - h.z * HZ - p[2]];
  const path = pts => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = P(p);
      i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
    });
    ctx.closePath();
  };
  const line = (a, b, col, w) => {
    const p = P(a),
      q = P(b);
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  };
  const depth = pts => {
    let d = 0;
    for (const p of pts) d += p[1] * HVIEW[1] + p[2] * HVIEW[2];
    return d / pts.length;
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const drawWing = (pts, sg) => {
    let n = wingNormal(pts, sg);
    const top = dot3(n, HVIEW) >= 0;
    if (!top) n = n.map(x => -x);
    const lit = clamp(0.62 + 0.55 * dot3(n, HLIGHT), 0.5, 1.18);
    const owl = h.kind === 'owl';
    path(pts);
    ctx.fillStyle = shade(top ? (owl ? '#766656' : '#5C3F28') : owl ? '#DCCFBA' : '#D6C3A0', lit);
    ctx.fill();
    path(pts.slice(2, 11).concat([mix3(pts[2], pts[11], 0.5)]));
    ctx.fillStyle = top ? 'rgba(28,18,10,.5)' : 'rgba(70,48,30,.4)';
    ctx.fill();
    if (top) {
      line(mix3(pts[0], pts[13], 0.4), mix3(pts[2], pts[11], 0.35), shade('#A07F58', lit), K * 0.09);
      line(mix3(pts[1], pts[12], 0.5), mix3(pts[2], pts[11], 0.55), shade('#8A6A48', lit), K * 0.06);
    } else {
      const c = P(mix3(pts[2], pts[11], 0.25));
      ctx.fillStyle = 'rgba(45,30,20,.75)';
      ctx.beginPath();
      ctx.ellipse(c[0], c[1], K * 0.1, K * 0.07, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,26,.6)';
      ctx.lineWidth = K * 0.06;
      ctx.beginPath();
      [10, 11, 12, 13].forEach((k, i) => {
        const q = P(pts[k]);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      });
      ctx.stroke();
    }
    path(pts);
    ctx.strokeStyle = 'rgba(25,16,10,.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  const drawTail = () => {
    path(g.tail);
    ctx.fillStyle = '#7A5A3A';
    ctx.fill();
    for (const f of [-0.55, -0.7, -0.84]) {
      const w = 0.12 + (0.28 * h.fan * (-f - 0.3)) / 0.6;
      line(g.T3(f, -w, 0.03), g.T3(f, w, 0.03), 'rgba(40,26,16,.55)', K * 0.05);
    }
  };
  const drawBody = () => {
    const nose = P(g.T3(0.46, 0, 0.04)),
      rump = P(g.T3(-0.36, 0, 0)),
      mx = (nose[0] + rump[0]) / 2,
      my = (nose[1] + rump[1]) / 2,
      len = Math.hypot(nose[0] - rump[0], nose[1] - rump[1]),
      ang = Math.atan2(nose[1] - rump[1], nose[0] - rump[0]);
    ctx.fillStyle = '#6E4E31';
    ctx.beginPath();
    ctx.ellipse(mx, my, Math.max(len / 2, K * 0.2), K * 0.2, ang, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#93704B';
    ctx.beginPath();
    ctx.ellipse(mx - K * 0.03, my - K * 0.05, Math.max(len / 2, K * 0.2) * 0.75, K * 0.1, ang, 0, TAU);
    ctx.fill();
    if (h.prey) {
      const p = P(g.T3(-0.02, 0, -0.35));
      ctx.fillStyle = h.prey.c2;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 3, 4.5, 0, 0, TAU);
      ctx.fill();
    }
    const hd = P(g.T3(0.5, 0, 0.07)),
      bk = P(g.T3(0.68, 0, 0.02));
    if (h.kind === 'owl') {
      ctx.fillStyle = '#7E6E5C';
      ctx.beginPath();
      ctx.arc(hd[0], hd[1], K * 0.25, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#D8CCB4';
      ctx.beginPath();
      ctx.ellipse(hd[0] + (bk[0] - hd[0]) * 0.25, hd[1] + (bk[1] - hd[1]) * 0.25, K * 0.17, K * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1A120C';
      const ex = (bk[0] - hd[0]) * 0.3,
        ey = (bk[1] - hd[1]) * 0.3,
        px = -(bk[1] - hd[1]),
        py = bk[0] - hd[0],
        pl = Math.hypot(px, py) || 1;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(hd[0] + ex + (px / pl) * K * 0.07 * sg, hd[1] + ey + (py / pl) * K * 0.07 * sg, K * 0.045, 0, TAU);
        ctx.fill();
      }
      return;
    }
    ctx.fillStyle = '#8F6E4A';
    ctx.beginPath();
    ctx.arc(hd[0], hd[1], K * 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#B8966B';
    ctx.beginPath();
    ctx.arc(hd[0] - K * 0.04, hd[1] - K * 0.05, K * 0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#E4B84A';
    ctx.beginPath();
    ctx.moveTo(hd[0] + (bk[0] - hd[0]) * 0.55, hd[1] + (bk[1] - hd[1]) * 0.55 - K * 0.05);
    ctx.lineTo(bk[0], bk[1]);
    ctx.lineTo(hd[0] + (bk[0] - hd[0]) * 0.55, hd[1] + (bk[1] - hd[1]) * 0.55 + K * 0.05);
    ctx.fill();
    const eo = Math.cos(h.psi) >= 0 ? 1 : -1;
    ctx.fillStyle = '#1A120C';
    ctx.beginPath();
    ctx.arc(hd[0] + (bk[0] - hd[0]) * 0.25, hd[1] + (bk[1] - hd[1]) * 0.25 - K * 0.06 * eo * 0.5, K * 0.035, 0, TAU);
    ctx.fill();
  };
  const parts = [
    { d: depth(g.wL), f: () => drawWing(g.wL, -1) },
    { d: depth(g.wR), f: () => drawWing(g.wR, 1) },
    { d: depth(g.tail) - K * 0.2, f: drawTail },
    { d: 0, f: drawBody }
  ];
  parts.sort((a, b) => a.d - b.d);
  for (const p of parts) p.f();
  ctx.restore();
}
function hawkShadow(c, h) {
  const g = hawkGeom(h);
  const G = p => {
    const H2 = (h.z * HZ + p[2]) / HZ;
    return [h.x + p[0] + H2 * SX, h.y + p[1] + H2 * SY];
  };
  for (const pts of [g.wL, g.wR, g.tail]) {
    c.beginPath();
    pts.forEach((p, i) => {
      const q = G(p);
      i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]);
    });
    c.closePath();
    c.fill();
  }
  const a = G(g.T3(0.62, 0, 0.04)),
    b = G(g.T3(-0.36, 0, 0));
  c.lineCap = 'round';
  c.lineWidth = g.K * 0.38;
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
}
const HINT = {
  on: false,
  trees: new Set(),
  t: 0,
  counted: false,
  learned: (() => {
    try {
      return +(localStorage.getItem('flokk-cover') || 0);
    } catch (e) {
      return 0;
    }
  })()
};
function coverHint(dt) {
  if (st.mode !== 'play' || !L) {
    HINT.on = false;
    return;
  }
  const threat = hawks.some(h => h.state !== 'leave' && h.state !== 'carry' && Math.hypot(h.x - L.x, h.y - L.y) < 950);
  const allHidden = birds.length > 0 && birds.every(coveredNow);
  if (threat && allHidden && !HINT.counted) {
    HINT.counted = true;
    HINT.learned++;
    try {
      localStorage.setItem('flokk-cover', String(HINT.learned));
    } catch (e) {
      /* storage unavailable */
    }
  }
  if (!threat) HINT.counted = false;
  HINT.on = threat && !allHidden && HINT.learned < 2;
  HINT.t -= dt;
  if (HINT.on && HINT.t <= 0) {
    HINT.t = 0.5;
    HINT.trees.clear();
    const near = [];
    const cx = Math.floor(L.x / TC),
      cy = Math.floor(L.y / TC);
    for (let i = -4; i <= 4; i++)
      for (let j = -4; j <= 4; j++) {
        const a = TG.get(cx + i + ',' + (cy + j));
        if (!a) continue;
        for (const t of a) {
          if (SEASON === 3 && t.type !== 'spruce') continue;
          const d = Math.hypot(t.x - L.x, t.y - L.y);
          if (d < 360) near.push([d, t]);
        }
      }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, t] of near.slice(0, 4)) HINT.trees.add(t.orig || t);
  }
}
/* a small side-to-side shear, pivoting at the trunk's foot, so the crown leans and flutters in the
   wind while the roots stay put - free on a pre-rendered sprite since it's just the draw transform,
   not a redraw. Two out-of-phase sines per tree (rather than one) keep a whole stand from swaying
   in lockstep, and riding the same amb_gust()/WIND that already drives the smoke, reeds and the
   yard flag means a gust reads the same way across the whole scene at once. Spruce boughs are
   stiffer than a birch's thin trunk, so each type gets its own give. */
function treeSway(t) {
  const stiff = t.type === 'spruce' ? 0.55 : t.type === 'birch' ? 1.25 : 0.95;
  const ph = t.x * 0.013 + t.y * 0.021;
  const flutter = Math.sin(T * 1.7 + ph) * 0.65 + Math.sin(T * 0.6 + ph * 1.7) * 0.35;
  const lean = WIND.x * amb_gust() * 0.5;
  return (flutter * 0.04 + lean * 0.035) * stiff;
}
function drawTree(t) {
  const spr = SPR[t.type][t.v],
    k = t.k,
    kw = k * (t.ws || 1),
    x = -AX * kw,
    y = -AY * k,
    w = SW * kw,
    h = SHT * k;
  ctx.save();
  ctx.translate(t.x, t.y * TILT);
  ctx.transform(1, 0, treeSway(t), 1, 0, 0);
  if (TRANS.prevSPR) {
    const e = tEase();
    ctx.globalAlpha = 1 - e * 0.6;
    ctx.drawImage(TRANS.prevSPR[t.type][t.v], x, y, w, h);
    ctx.globalAlpha = e;
  }
  ctx.drawImage(spr, x, y, w, h);
  ctx.globalAlpha = 1;
  if (LIGHT.rim > 0.04) {
    const r = RIM[t.type][t.v];
    if (r) {
      const si = LIGHT.rimSide > 0 ? 1 : 0;
      ctx.globalAlpha = LIGHT.rim * 0.3;
      ctx.drawImage(r.c[1 - si], x, y, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = LIGHT.rim * (LIGHT.eve ? 0.36 : 0.28);
      ctx.drawImage(r.w[si], x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }
  if (HINT.on && HINT.trees.has(t)) {
    const o = OUTL[t.type][t.v];
    if (o) {
      ctx.globalAlpha = 0.32 + 0.22 * Math.sin(T * 2.4 + t.x * 0.01);
      ctx.drawImage(o, x, y, w, h);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
/* shore trees mirrored in still water (not on ice), clipped to the water's outline */
let REFL = null,
  REFLsrc = null;
function reflTrees() {
  if (REFLsrc === TREES) return REFL;
  REFLsrc = TREES;
  REFL = [];
  for (const [c, rf] of [
    [LAKE, lakeR],
    [POND, pondR]
  ])
    for (const t of TREES)
      if (!t.gh && !inBlob(t.x, t.y, c, rf, 2) && inBlob(t.x, t.y + 34, c, rf, -4)) REFL.push({ t, c, rf });
  return REFL;
}
function drawReflections(tk, ty, z) {
  const list = reflTrees();
  if (!list.length) return;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, tk, ty);
  const al = 0.2 * (1 - LIGHT.night * 0.7);
  for (const { t, c, rf } of list) {
    if (!visU(t.x, t.y + 120, t.r * 2.4, 0)) continue;
    const spr = SPR[t.type][t.v],
      k = t.k,
      kw = k * (t.ws || 1),
      base = t.y * TILT,
      lx = t.x + wdx(c.x, t.x);
    ctx.save();
    ctx.scale(1, TILT);
    blobPath(ctx, lx, c.y, rf, -3, 90);
    ctx.restore();
    ctx.save();
    ctx.clip();
    ctx.translate(0, base);
    ctx.scale(1, -0.72);
    ctx.globalAlpha = al;
    ctx.drawImage(spr, t.x - AX * kw, -AY * k, SW * kw, SHT * k);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
/* building: real walls, gable ends and a pitched roof, projected in 2.5D */
function drawBuilding(b) {
  const c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    hl = b.len / 2,
    hd = b.dep / 2;
  const P = (lx, ly, h) => [b.cx + lx * c - ly * s, (b.cy + lx * s + ly * c) * TILT - h];
  const poly = (pts, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  const sides = [
    [-hl, -hd, hl, -hd, 0, -1, false],
    [hl, -hd, hl, hd, 1, 0, true],
    [hl, hd, -hl, hd, 0, 1, false],
    [-hl, hd, -hl, -hd, -1, 0, true]
  ];
  const wh = b.wh,
    rh = b.rh;
  for (const [x1, y1, x2, y2, nx, ny, gable] of sides) {
    const wnx = nx * c - ny * s,
      wny = nx * s + ny * c;
    if (wny <= 0.02) continue;
    const lit = clamp(1 - 0.28 * wnx - 0.08, 0.62, 1.12);
    let col = shade(b.wall, lit);
    if (LIGHT.rim > 0.05 && wnx * LIGHT.rimSide > 0) col = mixRgb(col, rimCol(), LIGHT.rim * 0.42 * Math.abs(wnx));
    const Q = (u, v) => P(lerp(x1, x2, u), lerp(y1, y2, u), v);
    poly([Q(0, 0), Q(1, 0), Q(1, wh), Q(0, wh)], col);
    if (gable) poly([Q(0, wh), Q(1, wh), P((x1 + x2) / 2, (y1 + y2) / 2, rh)], col);
    if (b.wall !== '#E6E0D2') {
      ctx.strokeStyle = 'rgba(0,0,0,.13)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let u = 5 / L; u < 1; u += 5 / L) {
        const top = gable ? lerp(wh, rh, 1 - Math.abs(u - 0.5) * 2) : wh;
        const a = Q(u, 0),
          q = Q(u, top);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    }
    if (b.trim) {
      ctx.strokeStyle = '#F1ECE2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const u of [0, 1]) {
        const a = Q(u, 0),
          q = Q(u, wh);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    }
    // a house's front door sits in the middle of the side the farmer walks out of, with a stone step
    const front = b.kind === 'house' && ny === 1;
    if (front) {
      const L = Math.hypot(x2 - x1, y2 - y1),
        w = 5.5 / L;
      poly([P(-9, hd, 0), P(9, hd, 0), P(9, hd + 6, 0), P(-9, hd + 6, 0)], '#8E8A80');
      poly([P(-9, hd + 6, 0), P(9, hd + 6, 0), P(9, hd + 6, 2.5), P(-9, hd + 6, 2.5)], '#6E6A62');
      poly([P(-9, hd, 2.5), P(9, hd, 2.5), P(9, hd + 6, 2.5), P(-9, hd + 6, 2.5)], '#A8A49A');
      const dc = ['#3F5566', '#5A3A2E', '#2F4A3A', '#6A5A3A'][(hash2(b.cx | 0, b.cy | 0) * 4) | 0];
      poly([Q(0.5 - w, 2.5), Q(0.5 + w, 2.5), Q(0.5 + w, wh * 0.74), Q(0.5 - w, wh * 0.74)], shade(dc, lit), '#F1ECE2');
      const k = Q(0.5 + w * 0.55, wh * 0.4);
      ctx.fillStyle = '#D9C27A';
      ctx.fillRect(k[0] - 0.7, k[1] - 0.7, 1.4, 1.4);
    }
    if (b.windows) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      const n = gable ? 1 : Math.max(front ? 2 : 1, Math.floor(L / 34));
      for (let i = 0; i < n; i++) {
        let u = (i + 0.5) / n;
        const w = 7 / L;
        if (front && Math.abs(u - 0.5) < 0.16) {
          if (n % 2) continue;
          u = u < 0.5 ? 0.5 - 0.2 : 0.5 + 0.2;
        }
        poly([Q(u - w, wh * 0.35), Q(u + w, wh * 0.35), Q(u + w, wh * 0.78), Q(u - w, wh * 0.78)], winCol(), '#F4F0E6');
      }
    }
    if (b.door && !gable) {
      const L = Math.hypot(x2 - x1, y2 - y1),
        w = 22 / L;
      const d = [Q(0.5 - w, 0), Q(0.5 + w, 0), Q(0.5 + w, wh * 0.85), Q(0.5 - w, wh * 0.85)];
      poly(d, shade(b.wall, lit * 0.8), '#F1ECE2');
      ctx.strokeStyle = '#F1ECE2';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d[0][0], d[0][1]);
      ctx.lineTo(d[2][0], d[2][1]);
      ctx.moveTo(d[1][0], d[1][1]);
      ctx.lineTo(d[3][0], d[3][1]);
      ctx.stroke();
    }
  }
  const ww = winterW(),
    cols = mixHex(
      { tile: '#8A3A2C', slate: '#55575A', turf: '#6F8A48', metal: '#6A7880', dark: '#3A3836' }[b.roof],
      '#E4EAF0',
      ww
    );
  const o = 5;
  const planes = [-1, 1].map(sg => {
    const eave = [P(-hl - o, sg * (hd + o), wh - 3), P(hl + o, sg * (hd + o), wh - 3)];
    const ridge = [P(hl + o, 0, rh), P(-hl - o, 0, rh)];
    const wy = sg * c;
    return { sg, pts: [eave[0], eave[1], ridge[0], ridge[1]], wy, wx: -sg * s };
  });
  planes.sort((a, b) => a.wy - b.wy);
  for (const pl of planes) {
    const lit = pl.wy < 0 ? 1.12 : 0.86 - 0.1 * pl.wx;
    let rc = shade(cols, lit);
    if (LIGHT.rim > 0.05 && pl.wx * LIGHT.rimSide > 0) rc = mixRgb(rc, rimCol(), LIGHT.rim * 0.35 * Math.abs(pl.wx));
    poly(pl.pts, rc, 'rgba(20,15,10,.35)');
    const [e0, e1, r0, r1] = pl.pts;
    if (ww > 0.5) {
      // snowed over: soft blue towards the eaves, a rounded lip of snow hanging over the edge
      const em = [(e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2],
        rm = [(r0[0] + r1[0]) / 2, (r0[1] + r1[1]) / 2],
        gr = ctx.createLinearGradient(rm[0], rm[1], em[0], em[1]);
      gr.addColorStop(0, 'rgba(140,160,196,0)');
      gr.addColorStop(1, `rgba(140,160,196,${pl.wy < 0 ? 0.12 : 0.26})`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(e0[0], e0[1]);
      ctx.lineTo(e1[0], e1[1]);
      ctx.lineTo(r0[0], r0[1]);
      ctx.lineTo(r1[0], r1[1]);
      ctx.closePath();
      ctx.fill();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(90,100,120,.28)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(e0[0], e0[1] + 1.6);
      ctx.lineTo(e1[0], e1[1] + 1.6);
      ctx.stroke();
      ctx.strokeStyle = '#F7F9FB';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(e0[0], e0[1]);
      ctx.lineTo(e1[0], e1[1]);
      ctx.stroke();
    } else if (b.roof === 'turf') {
      ctx.fillStyle = 'rgba(165,190,105,.55)';
      for (let i = 0; i < 26; i++) {
        const u = hash2(i, b.cx | 0),
          v = hash2(b.cy | 0, i + pl.sg);
        const x = lerp(lerp(e0[0], e1[0], u), lerp(r1[0], r0[0], u), v),
          y = lerp(lerp(e0[1], e1[1], u), lerp(r1[1], r0[1], u), v);
        ctx.fillRect(x - 1, y - 2, 2, 3);
      }
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,.18)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const n = Math.floor(b.len / (b.roof === 'tile' ? 5 : 7));
      for (let i = 1; i < n; i++) {
        const u = i / n;
        ctx.moveTo(lerp(e0[0], e1[0], u), lerp(e0[1], e1[1], u));
        ctx.lineTo(lerp(r1[0], r0[0], u), lerp(r1[1], r0[1], u));
      }
      ctx.stroke();
    }
  }
  const r0 = P(-hl - o, 0, rh),
    r1 = P(hl + o, 0, rh);
  ctx.strokeStyle = 'rgba(25,18,12,.6)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(r0[0], r0[1]);
  ctx.lineTo(r1[0], r1[1]);
  ctx.stroke();
  if (b.chimney) {
    const cx0 = hl * 0.45,
      cy0 = -hd * 0.35,
      base = wh + (rh - wh) * (1 - 0.35);
    const a = P(cx0 - 5, cy0, base),
      q = P(cx0 + 5, cy0, base);
    poly([a, q, [q[0], q[1] - 16], [a[0], a[1] - 16]], '#8F8A82');
    poly(
      [
        [a[0], a[1] - 16],
        [q[0], q[1] - 16],
        [q[0] + 2, q[1] - 19],
        [a[0] + 2, a[1] - 19]
      ],
      '#6E6A64'
    );
  }
}
function drawPole(p) {
  const base = p.y * TILT,
    top = PY(p.y, POLE_H);
  ctx.strokeStyle = '#4E3D2B';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(p.x, base);
  ctx.lineTo(p.x, top);
  ctx.stroke();
  ctx.strokeStyle = '#7A6246';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - 1, base);
  ctx.lineTo(p.x - 1, top);
  ctx.stroke();
  const ca = p.ang + Math.PI / 2,
    dx = Math.cos(ca) * 9,
    dy = Math.sin(ca) * 9 * TILT;
  const ay = PY(p.y, WIRE_H);
  ctx.strokeStyle = '#4E3D2B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x - dx, ay - dy);
  ctx.lineTo(p.x + dx, ay + dy);
  ctx.stroke();
  ctx.fillStyle = '#DDE3E6';
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(p.x + sg * dx * 0.67, ay + sg * dy * 0.67 - 1.5, 1.6, 0, TAU);
    ctx.fill();
  }
}
function drawBale(b) {
  const X = b.x,
    Yb = b.y * TILT,
    Yt = PY(b.y, BALE_H),
    ry = b.r * TILT,
    col = b.g ? '#4E5E48' : '#E1E5DE';
  ctx.fillStyle = shade(col, 0.82);
  ctx.beginPath();
  ctx.ellipse(X, Yb, b.r, ry, 0, 0, Math.PI);
  ctx.lineTo(X - b.r, Yt);
  ctx.lineTo(X + b.r, Yt);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = col;
  ctx.fillRect(X - b.r, Yt, b.r * 1.1, Yb - Yt);
  ctx.fillStyle = b.g ? '#6A7B62' : '#FAFBF8';
  ctx.beginPath();
  ctx.ellipse(X, Yt, b.r, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.14)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}
function drawFence(sg) {
  const { p, q } = sg;
  ctx.strokeStyle = '#8A7458';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const h of [0.13, 0.28]) {
    ctx.moveTo(p.x, PY(p.y, h));
    ctx.lineTo(q.x, PY(q.y, h));
  }
  ctx.stroke();
  ctx.strokeStyle = '#5E4A34';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y * TILT);
  ctx.lineTo(p.x, PY(p.y, POST_H));
  ctx.stroke();
}
function drawWires() {
  // wires stay light: they are everywhere, and should read as lines in the air, not ink
  ctx.strokeStyle = 'rgba(40,36,30,.5)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (const line of LINES)
    for (let i = 0; i < line.length - 1; i++) {
      const p = line[i],
        q = line[i + 1];
      if (!visU(p.x, p.y, 260, POLE_H * HZ) && !visU(q.x, q.y, 260, POLE_H * HZ)) continue;
      const wa = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
      for (const w of [-6, 6]) {
        const ox = Math.cos(wa) * w,
          oy = Math.sin(wa) * w;
        const ax = p.x + ox,
          ay = PY(p.y + oy, WIRE_H),
          bx = q.x + ox,
          by = PY(q.y + oy, WIRE_H);
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + SAG * HZ * 2, bx, by);
      }
    }
  ctx.stroke();
}
/* ---------- cast shadows ----------
   Everything is drawn into a white mask with 'darken', so overlapping shadows never stack,
   then the mask is blurred slightly and multiplied onto the ground. The sun sits low in the
   north-west, so a point at height h lands (h*SX, h*SY) away on the ground. */
const SHC = document.createElement('canvas'),
  shx = SHC.getContext('2d');
const SHADE = 'rgb(134,144,158)';
const shadeAt = f => {
  f = clamp(f, 0, 0.85);
  return `rgb(${lerp(134, 255, f) | 0},${lerp(144, 255, f) | 0},${lerp(158, 255, f) | 0})`;
};
let SSPR = null;
function mkSil(src) {
  const c = mk(src.width, src.height),
    q = c.getContext('2d');
  q.drawImage(src, 0, 0);
  q.globalCompositeOperation = 'source-in';
  q.fillStyle = SHADE;
  q.fillRect(0, 0, c.width, c.height);
  return c;
}
function hull(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [],
    up = [];
  for (const p of P) {
    while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  up.pop();
  lo.pop();
  return lo.concat(up);
}
const ASH = {
  human: [3, 0.56],
  dog: [5, 0.3],
  sheep: [8, 0.32],
  cow: [12, 0.5],
  deer: [6, 0.55],
  moose: [13, 0.95],
  hare: [4, 0.18],
  heron: [4, 0.85],
  magpie: [3, 0.14],
  crow: [3, 0.14],
  cat: [4, 0.22],
  fox: [5, 0.26],
  tractor: [15, 0.7],
  duck: [6, 0.08]
};
function renderShadows(tx, ty, KS, inK) {
  if (!SSPR) SSPR = { spruce: SPR.spruce.map(mkSil), birch: SPR.birch.map(mkSil), decid: SPR.decid.map(mkSil) };
  const SQ = 0.5,
    sw2 = Math.ceil(cv.width * SQ),
    sh2 = Math.ceil(cv.height * SQ);
  if (SHC.width !== sw2 || SHC.height !== sh2) {
    SHC.width = sw2;
    SHC.height = sh2;
  }
  const c = shx,
    z = cam.z,
    kx = SX / HZ,
    ky = SY / HZ;
  let px = -SY,
    py = SX;
  {
    const l = Math.hypot(px, py) || 1;
    px /= l;
    py /= l;
    if (px < 0) ((px = -px), (py = -py));
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, SHC.width, SHC.height);
  c.globalCompositeOperation = 'darken';
  for (const k of KS) {
    const tk = inK(k);
    const G0 = () => c.setTransform(dpr * z * SQ, 0, 0, dpr * z * TILT * SQ, tk * SQ, ty * SQ);
    G0();
    const cap = (x, y, h, w) => {
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + h * SX + 0.01, y + h * SY);
      c.stroke();
    };
    // trees: their own silhouettes, sheared along the sun
    for (const t of TREES) {
      const hh = t.hpx / HZ;
      if (!visG(t.x + hh * SX * 0.5, t.y + hh * SY * 0.5, Math.hypot(hh * SX, hh * SY) * 0.6 + t.r * 2.2 + 60))
        continue;
      const k = t.k;
      c.transform(px, py, -kx, -ky, t.x, t.y);
      c.drawImage(SSPR[t.type][t.v], -AX * k * (t.ws || 1), -AY * k, SW * k * (t.ws || 1), SHT * k);
      G0();
    }
    c.fillStyle = SHADE;
    c.strokeStyle = SHADE;
    c.lineCap = 'round';
    // buildings: the projected volume (footprint, eaves and ridge)
    trainShadowHulls(c);
    vehicleShadows(c);
    for (const b of BUILDS) {
      if (!visG(b.cx, b.cy, b.len + 180)) continue;
      const cs = Math.cos(b.ang),
        sn = Math.sin(b.ang),
        hl = b.len / 2 + 4,
        hd = b.dep / 2 + 4,
        pts = [];
      const P = (lx, ly, h) => {
        const q = h / HZ;
        pts.push([b.cx + lx * cs - ly * sn + q * SX, b.cy + lx * sn + ly * cs + q * SY]);
      };
      for (const [lx, ly] of [
        [-hl, -hd],
        [hl, -hd],
        [hl, hd],
        [-hl, hd]
      ]) {
        P(lx, ly, 0);
        P(lx, ly, b.wh);
      }
      P(-hl, 0, b.rh);
      P(hl, 0, b.rh);
      if (b.chimney) {
        P(hl * 0.45, -hd * 0.35, b.rh + 14);
      }
      const H2 = hull(pts);
      c.beginPath();
      H2.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.closePath();
      c.fill();
    }
    // poles, crossarms and sagging wires
    c.lineWidth = 3.5;
    c.beginPath();
    for (const line of LINES)
      for (const p of line) {
        if (p.ghost || !visG(p.x, p.y, 140)) continue;
        c.moveTo(p.x, p.y);
        c.lineTo(p.x + POLE_H * SX, p.y + POLE_H * SY);
        const ca = p.ang + Math.PI / 2,
          ox = p.x + WIRE_H * SX,
          oy = p.y + WIRE_H * SY;
        c.moveTo(ox - Math.cos(ca) * 9, oy - Math.sin(ca) * 9);
        c.lineTo(ox + Math.cos(ca) * 9, oy + Math.sin(ca) * 9);
      }
    c.stroke();
    c.lineWidth = 1.3;
    c.beginPath();
    for (const line of LINES)
      for (let i = 0; i < line.length - 1; i++) {
        const p = line[i],
          q = line[i + 1];
        if (!visG(p.x, p.y, 300) && !visG(q.x, q.y, 300)) continue;
        const wa = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 2;
        for (const w of [-6, 6]) {
          const ax = p.x + Math.cos(wa) * w + WIRE_H * SX,
            ay = p.y + Math.sin(wa) * w + WIRE_H * SY,
            bx = q.x + Math.cos(wa) * w + WIRE_H * SX,
            by = q.y + Math.sin(wa) * w + WIRE_H * SY;
          c.moveTo(ax, ay);
          c.quadraticCurveTo((ax + bx) / 2 - 2 * SAG * SX, (ay + by) / 2 - 2 * SAG * SY, bx, by);
        }
      }
    c.stroke();
    // fences
    c.lineWidth = 1.8;
    c.beginPath();
    for (const f of FSEG) {
      const { p, q } = f;
      if (!visG(p.x, p.y, 60)) continue;
      c.moveTo(p.x, p.y);
      c.lineTo(p.x + POST_H * SX, p.y + POST_H * SY);
      for (const h of [0.13, 0.28]) {
        c.moveTo(p.x + h * SX, p.y + h * SY);
        c.lineTo(q.x + h * SX, q.y + h * SY);
      }
    }
    c.stroke();
    // bales, rocks, animals: capsules stretched along the sun
    if (SEASON >= 2) for (const b of BALES) if (visG(b.x, b.y, 40)) cap(b.x, b.y, BALE_H, b.r * 2);
    for (const l of LAMPS) if (visG(l.x, l.y, 140)) cap(l.x, l.y, 2.3, 2.6);
    propShadows(c, cap);
    if (FEEDER && SEASON === 3 && visG(FEEDER.x, FEEDER.y, 120)) cap(FEEDER.x, FEEDER.y, 1.6, 3);
    for (const b of BOULDERS) if (visG(b.x, b.y, 60)) cap(b.x, b.y, (b.h / HZ) * 0.8, b.r * 1.8);
    for (const b of BUSHES) if (visG(b.x, b.y, 40)) cap(b.x, b.y, (b.h / HZ) * 0.55, b.r * 1.6);
    for (const a of ANIMALS) {
      if (isSky(a)) {
        if (a.z < 0.05) continue;
        const x = a.x + a.z * SX,
          y = a.y + a.z * SY;
        if (!visG(x, y, 40)) continue;
        c.fillStyle = shadeAt(a.z / 6);
        if (a.k === 'butterfly') {
          c.beginPath();
          c.ellipse(x, y, 2.5, 2, 0, 0, TAU);
          c.fill();
        } else {
          const look = LOOK[a.k];
          if (look) shadowFly3(c, a.x, a.y, a.z * HZ, skyPose(a, look), look, look.K);
          c.strokeStyle = SHADE;
        }
        c.fillStyle = SHADE;
        continue;
      }
      const d = ASH[a.k];
      if (!d || a.hide || !visG(a.x, a.y, 60)) continue;
      if (a.k === 'duck' && a.st === 'dive') continue;
      cap(a.x, a.y, d[1], d[0]);
    }
    // birds: perched ones make small shadows under their perch, fliers cast their wing shapes
    for (const b of birds) {
      const x = b.x + b.hx,
        y = b.y + b.hy;
      if (!visG(x + b.z * SX, y + b.z * SY, 40)) continue;
      if (b.state === 'perch' || b.state === 'takeoff') {
        if (b.perch && b.perch.type === 'tree') continue;
        if (b.z < 0.5) cap(x, y, 0.14, 4.5);
        else {
          c.beginPath();
          c.ellipse(x + b.z * SX, y + b.z * SY, 4, 2.6, 0, 0, TAU);
          c.fill();
        }
        continue;
      }
      const col = shadeAt(b.z / 7);
      c.fillStyle = col;
      c.strokeStyle = col;
      shadowFly3(c, x, y, b.z * HZ, birdPose(b), LOOK.sparrow, b.s * (0.95 + 0.04 * b.z));
      c.fillStyle = SHADE;
      c.strokeStyle = SHADE;
    }
    for (const h of hawks) {
      const x = h.x + h.z * SX,
        y = h.y + h.z * SY;
      if (!visG(x, y, 80)) continue;
      const col = shadeAt(h.z / 7 + (1 - h.alpha) * 0.6);
      c.fillStyle = col;
      c.strokeStyle = col;
      hawkShadow(c, h);
    }
    c.fillStyle = SHADE;
    c.strokeStyle = SHADE;
  }
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const z = cam.z,
    tx = dpr * (vw / 2 - cam.x * z),
    ty = dpr * (vh / 2 - cam.py * z);
  const hw = vw / 2 / z,
    hh = vh / 2 / z;
  const V0 = { x0: cam.x - hw, x1: cam.x + hw, py0: cam.py - hh, py1: cam.py + hh };
  V = V0;
  /* the land repeats east-west: draw every copy of it that the view touches (k = copies one period over) */
  const KS = [];
  for (const k of [-1, 0, 1]) if (k === 0 || (V0.x1 - k * W > -260 && V0.x0 - k * W < W + 260)) KS.push(k);
  const inK = k => {
    V = { x0: V0.x0 - k * W, x1: V0.x1 - k * W, py0: V0.py0, py1: V0.py1 };
    return tx + k * W * dpr * z;
  };
  /* ---- ground plane (y squashed), clipped so nothing on the ground layer can bleed into the sky ---- */
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(0, Math.max(0, ((-150 * TILT - cam.py) * z + vh / 2) * dpr), cv.width, cv.height);
  ctx.clip();
  ctx.setTransform(dpr * z, 0, 0, dpr * z * TILT, tx, ty);
  const gy0 = V0.py0 / TILT - 10,
    gy1 = V0.py1 / TILT + 10;
  {
    const top = Math.max(-150, gy0);
    ctx.fillStyle = '#34492F';
    ctx.fillRect(V0.x0 - 20, top, V0.x1 - V0.x0 + 40, gy1 - top + 20);
    if (gy1 > H - 420) {
      ctx.beginPath();
      ctx.moveTo(V0.x0 - 20, gy1 + 60);
      for (let x = Math.floor((V0.x0 - 20) / 16) * 16; x <= V0.x1 + 36; x += 16) ctx.lineTo(x, shoreY(x));
      ctx.lineTo(V0.x1 + 36, gy1 + 60);
      ctx.closePath();
      ctx.fillStyle = seaGrad(ctx);
      ctx.fill();
    }
  }
  for (const k of KS) {
    const tk = inK(k);
    ctx.setTransform(dpr * z, 0, 0, dpr * z * TILT, tk, ty);
    const sx = Math.max(0, V.x0),
      sy = Math.max(0, gy0),
      ex = Math.min(W, V.x1),
      ey = Math.min(H, gy1);
    if (ex > sx && ey > sy) {
      // at the seam, overlap each copy by a few units of its neighbour so antialiased edges never leave a hairline
      const blit = img => {
        ctx.drawImage(img, sx * S, sy * S, (ex - sx) * S, (ey - sy) * S, sx, sy, ex - sx, ey - sy);
        if (ex >= W) ctx.drawImage(img, 0, sy * S, 4 * S, (ey - sy) * S, W, sy, 4, ey - sy);
        if (sx <= 0) ctx.drawImage(img, (W - 4) * S, sy * S, 4 * S, (ey - sy) * S, -4, sy, 4, ey - sy);
      };
      blit(G);
      if (TRANS.prevG) {
        ctx.globalAlpha = 1 - tEase();
        blit(TRANS.prevG);
        ctx.globalAlpha = 1;
      }
    }
    if (winterW() < 0.5) drawReflections(tk, ty, z);
    ctx.setTransform(dpr * z, 0, 0, dpr * z * TILT, tk, ty);
    ctx.strokeStyle = LIGHT.rim > 0.05 ? mixHex('#E8F4EE', LIGHT.eve ? '#FFB060' : '#FFCDA8', LIGHT.rim) : '#E8F4EE';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (winterW() < 0.5)
      for (const s of SPARK) {
        if (!visG(s.x, s.y, 10)) continue;
        const a = Math.max(0, Math.sin(T * s.s + s.p));
        const al = a ** 10;
        if (al < 0.04) continue;
        ctx.globalAlpha = al * 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x - s.l / 2, s.y);
        ctx.lineTo(s.x + s.l / 2, s.y);
        ctx.stroke();
      }
    for (const s of SEASPARK) {
      if (!visG(s.x, s.y, 10)) continue;
      const a = Math.max(0, Math.sin(T * s.s + s.p));
      const al = a ** 8;
      if (al < 0.04) continue;
      ctx.globalAlpha = al * 0.75;
      ctx.beginPath();
      ctx.moveTo(s.x - s.l / 2, s.y);
      ctx.lineTo(s.x + s.l / 2, s.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // ripples: fish rises, diving ducks, heron strikes; and duck wakes
    ctx.lineWidth = 1.4;
    iceHoles();
    for (const r of RINGS) {
      if (!visG(r.x, r.y, 40)) continue;
      const q = r.t / 2.4;
      ctx.strokeStyle = `rgba(225,240,238,${(1 - q) * 0.55})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 + r.t * (r.fish ? 16 : 11), 0, TAU);
      ctx.stroke();
      if (r.t > 0.3) {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.t * (r.fish ? 9 : 6), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(225,240,238,.22)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (const a of ANIMALS) {
      if (a.k !== 'duck' || a.st !== 'walk' || !visG(a.x, a.y, 40)) continue;
      const sp = Math.hypot(a.vx, a.vy) || 1,
        ux = -a.vx / sp,
        uy = -a.vy / sp;
      for (const sg of [-1, 1]) {
        ctx.moveTo(a.x + ux * 6 - uy * sg * 3, a.y + uy * 6 + ux * sg * 3);
        ctx.lineTo(a.x + ux * 16 - uy * sg * 8, a.y + uy * 16 + ux * sg * 8);
      }
    }
    ctx.stroke();
    if (visG(BOAT.x, BOAT.y, 30)) {
      ctx.save();
      ctx.translate(BOAT.x, BOAT.y);
      ctx.rotate(BOAT.ang);
      ctx.fillStyle = 'rgba(15,35,40,.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 19, 8, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#E8E3D6';
      ctx.beginPath();
      ctx.moveTo(-17, 0);
      ctx.quadraticCurveTo(-12, -8, 10, -6);
      ctx.quadraticCurveTo(18, -3, 19, 0);
      ctx.quadraticCurveTo(18, 3, 10, 6);
      ctx.quadraticCurveTo(-12, 8, -17, 0);
      ctx.fill();
      ctx.fillStyle = '#8A6A48';
      ctx.fillRect(-12, -4.5, 26, 9);
      ctx.fillStyle = '#6E5238';
      ctx.fillRect(-3, -5, 3, 10);
      ctx.fillRect(8, -5, 3, 10);
      ctx.restore();
    }
    for (const c of CLOUDSH) {
      if (c.x + c.s < V.x0 || c.x - c.s > V.x1 || c.y + c.s < gy0 || c.y - c.s > gy1) continue;
      ctx.globalAlpha = 0.38 * LIGHT.shadowA;
      ctx.drawImage(SHADOW_SPR, c.x - c.s, c.y - c.s, c.s * 2, c.s * 2);
    }
    ctx.globalAlpha = 1;
  }
  V = V0;
  if (LIGHT.shadowA > 0.02) {
    renderShadows(tx, ty, KS, inK);
    V = V0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = LIGHT.shadowA;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(SHC, 0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  /* ---- upright world, painter-sorted by depth across every copy ---- */
  const items = [],
    wire = [],
    air = [],
    skyA = [],
    hk = [];
  for (const k of KS) {
    const tk = inK(k);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, tk, ty);
    ctx.strokeStyle = SEASON === 3 ? '#9A8662' : SEASON === 0 ? '#6E8A48' : '#5E7438';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const r of REEDS) {
      if (!visU(r.x, r.y, 10, 20)) continue;
      const b = r.y * TILT;
      ctx.moveTo(r.x, b);
      ctx.quadraticCurveTo(r.x + r.l * 0.3, b - r.h * 0.6, r.x + r.l, b - r.h);
    }
    ctx.stroke();
    for (const t of TREES) if (visU(t.x, t.y, t.r * 2.4, t.hpx + 10)) items.push([t.y, 0, t, k]);
    for (const b of BUILDS) if (visU(b.cx, b.cy, b.len, b.rh + b.len * 0.6)) items.push([b.cy, 1, b, k]);
    for (const line of LINES)
      for (const p of line) if (!p.ghost && visU(p.x, p.y, 14, POLE_H * HZ)) items.push([p.y, 2, p, k]);
    if (SEASON >= 2) for (const b of BALES) if (visU(b.x, b.y, 14, 16)) items.push([b.y, 3, b, k]);
    for (const f of FSEG) if (visU(f.p.x, f.p.y, 40, 16)) items.push([f.k, 4, f, k]);
    for (const b of BOULDERS) if (visU(b.x, b.y, b.r + 4, b.h + 6)) items.push([b.y, 6, b, k]);
    for (const b of BUSHES) if (visU(b.x, b.y, b.r + 4, b.h + 6)) items.push([b.y, 13, b, k]);
    if (TRAIN) for (const c of TRAIN.cars) if (visU(c.x, c.y, 40, 40)) items.push([c.y, 10, c, k]);
    for (const v of TRAFFIC) {
      if (visU(v.x, v.y, 50, 30)) items.push([v.y, 11, v, k]);
    }
    for (const l of LAMPS) if (visU(l.x, l.y, 20, 110)) items.push([l.y, 8, l, k]);
    for (const p of PROPS) if (visU(p.x, p.y, 50, 190)) items.push([p.y + 7, 12, p, k]);
    if (FEEDER && SEASON === 3 && visU(FEEDER.x, FEEDER.y, 20, 90)) items.push([FEEDER.y, 9, FEEDER, k]);
    for (const a of ANIMALS) {
      if (isSky(a)) {
        if (visU(a.x, a.y, 40, a.z * HZ + 30)) skyA.push([a, k]);
      } else if (!a.hide && visU(a.x, a.y, 40, 60)) items.push([a.y, 7, a, k]);
    }
    for (const b of birds) {
      if (b.state === 'fly' || b.state === 'land') {
        if (visU(b.x, b.y, 30, b.z * HZ + 20)) air.push([b, k]);
        continue;
      }
      const p = b.perch;
      if (!visU(b.x, b.y, 30, (p ? p.h : 0) * HZ + 20)) continue;
      if (p && (p.type === 'wire' || p.type === 'pole')) wire.push([b, k]);
      else items.push([(p ? p.key : b.y) + b.hy * 0.01, 5, b, k]);
    }
    for (const h of hawks) if (visU(h.x, h.y, 60, h.z * HZ + 40)) hk.push([h, k]);
  }
  V = V0;
  let ck = null;
  const setK = k => {
    if (k !== ck) {
      ck = k;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, tx + k * W * dpr * z, ty);
    }
  };
  items.sort((a, b) => a[0] - b[0]);
  for (const [, kind, o, k] of items) {
    setK(k);
    if (kind === 0) drawTree(o);
    else if (kind === 1) drawBuilding(o);
    else if (kind === 2) drawPole(o);
    else if (kind === 3) drawBale(o);
    else if (kind === 4) drawFence(o);
    else if (kind === 6) drawBoulder(o);
    else if (kind === 13) drawBush(o);
    else if (kind === 8) drawLamp(o);
    else if (kind === 9) drawFeeder(o);
    else if (kind === 10) drawCar(o);
    else if (kind === 11) drawVehicle(o);
    else if (kind === 12) drawProp(o);
    else if (kind === 7) drawAnimal(o);
    else drawPerched(o, o.perch && o.perch.cover ? 0.7 : 1);
  }
  for (const k of KS) {
    inK(k);
    setK(k);
    drawWires();
  }
  V = V0;
  wire.sort((a, b) => a[0].y - b[0].y);
  for (const [b, k] of wire) {
    setK(k);
    drawPerched(b, 1);
  }
  for (const k of KS) {
    inK(k);
    setK(k);
    // insects hang in the air at flock height - a wider, brighter halo helps a swarm catch the eye
    // from a little way off, and each mote gets a dark fringe so it still reads against ground
    // texture that happens to share its pale palette (wildflowers, frost, sun-fleck)
    for (const s of swarms) {
      if (!visU(s.x, s.y, 40, s.z * HZ + 30)) continue;
      const cy = PY(s.y, s.z);
      const gr = ctx.createRadialGradient(s.x, cy, 0, s.x, cy, 34);
      gr.addColorStop(0, 'rgba(255,241,175,.3)');
      gr.addColorStop(1, 'rgba(255,241,175,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(s.x, cy, 34, 0, TAU);
      ctx.fill();
      const ms = s.moth ? 2.6 : 2;
      for (const m of s.m) {
        const [mx, my, mz] = motePos(s, m);
        const py = PY(my, mz);
        const a = 0.72 + 0.28 * Math.sin(T * 9 + m.ph);
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = 'rgba(35,32,14,.6)';
        ctx.fillRect(mx - ms - 0.7, py - ms - 0.7, ms * 2 + 1.4, ms * 2 + 1.4);
        ctx.globalAlpha = a;
        ctx.fillStyle = s.moth ? '#F7F2E4' : '#FFE98C';
        ctx.fillRect(mx - ms, py - ms, ms * 2, ms * 2);
      }
      ctx.globalAlpha = 1;
    }
    for (const f of dflies) {
      if (!visU(f.x, f.y, 20, f.z * HZ + 10)) continue;
      ctx.fillStyle = 'rgba(30,50,40,.18)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y * TILT, 5, 2, 0, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(f.x, PY(f.y, f.z + Math.sin(T * 4 + f.h) * 0.05));
      ctx.scale(1, 0.8);
      ctx.rotate(f.h);
      ctx.fillStyle = 'rgba(225,240,245,.6)';
      const w = Math.sin(T * 60) * 0.5 + 0.8;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(1, sg * 5 * w, 1.6, 5 * w, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-2, sg * 4.5 * w, 1.4, 4.5 * w, 0, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = f.col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-8, 0);
      ctx.stroke();
      ctx.fillStyle = f.col;
      ctx.beginPath();
      ctx.arc(4, 0, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (const p of SMOKE) {
      if (!visU(p.x, p.y, 40, p.z * HZ + 40)) continue;
      const q = p.life / p.max,
        al = p.a * Math.min(1, (1 - q) * 6) * q * q;
      if (al < 0.01) continue;
      ctx.fillStyle = `rgba(222,222,216,${al})`;
      ctx.beginPath();
      ctx.arc(p.x, PY(p.y, p.z), p.r, 0, TAU);
      ctx.fill();
    }
  }
  V = V0;
  // aerial perspective: the far forest pales into the valley mist under the ridges
  if (V.py0 < 160) {
    ctx.setTransform(dpr * z, 0, 0, dpr * z, tx, ty);
    ck = null;
    const hz = ctx.createLinearGradient(0, -240, 0, 170),
      ha = (1 - LIGHT.night * 0.6) * (SEASON === 3 ? 0.8 : 1);
    hz.addColorStop(0, LIGHT.skyBot + '00');
    hz.addColorStop(0.3, LIGHT.skyBot + hex2(0.3 * ha));
    hz.addColorStop(0.5, LIGHT.skyBot + hex2(0.34 * ha));
    hz.addColorStop(0.72, LIGHT.skyBot + hex2(0.14 * ha));
    hz.addColorStop(1, LIGHT.skyBot + '00');
    ctx.fillStyle = hz;
    ctx.fillRect(V.x0, -240, V.x1 - V.x0, 410);
  }
  skyA.sort((a, b) => a[0].z - b[0].z || a[0].y - b[0].y);
  for (const [a, k] of skyA)
    if (a.z < 3) {
      setK(k);
      drawSkyAnimal(a);
    }
  air.sort((a, b) => a[0].y - b[0].y);
  for (const [b, k] of air) {
    setK(k);
    drawFlyer(b);
  }
  for (const k of KS) {
    inK(k);
    setK(k);
    for (const p of parts) {
      if (!visU(p.x, p.y, 40, p.z * HZ + 40)) continue;
      const a = p.life / p.max,
        Y = PY(p.y, p.z);
      if (p.k === 'f' || p.k === 'lf') {
        ctx.save();
        ctx.translate(p.x, Y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 1.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.k === 'w') {
        ctx.globalAlpha = a;
        ctx.fillStyle = '#EAF4F2';
        ctx.fillRect(p.x - 1, Y - 1, 2, 2);
      } else if (p.k === 'd') {
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = '#8A6F50';
        ctx.beginPath();
        ctx.arc(p.x, Y, Math.max(0.5, 3 + (1 - a) * 7), 0, TAU);
        ctx.fill();
      } else if (p.k === 's') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, Y, Math.max(0.5, (1 - a) * 14 + 2), 0, TAU);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.col;
        ctx.font = '700 14px "Bricolage Grotesque",system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.txt, p.x, Y);
      }
    }
    ctx.globalAlpha = 1;
    for (const h of hawks) {
      if ((h.state === 'dive' || h.state === 'stalk' || h.state === 'hover') && h.target) {
        const t = h.target;
        if (!visU(t.x, t.y, 40, t.z * HZ + 40)) continue;
        const X = t.x + t.hx,
          Y = PY(t.y + t.hy, t.z) - (t.state === 'fly' || t.state === 'land' ? 0 : 6);
        ctx.save();
        ctx.translate(X, Y);
        ctx.scale(1, 0.8);
        ctx.rotate(T * 3);
        ctx.strokeStyle = h.state === 'dive' ? 'rgba(229,87,63,.95)' : 'rgba(229,87,63,.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 18 + Math.sin(T * 12) * 2, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  V = V0;
  setK(0);
  if (pointer.down && st.mode === 'play') {
    const w = screenToWorld(pointer.x, pointer.y, L.z);
    ctx.strokeStyle = 'rgba(242,201,76,.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(w.x, PY(w.y, L.z), 11, 8, 0, 0, TAU);
    ctx.stroke();
  }
  hk.sort((a, b) => a[0].y - b[0].y);
  for (const [h, k] of hk) {
    setK(k);
    drawHawk(h);
  }
  for (const [a, k] of skyA)
    if (a.z >= 3) {
      setK(k);
      drawSkyAnimal(a);
    }
  applyLight(tx, ty, KS, inK);
  V = V0;
  drawSkyBehind(tx, ty);
  applyGlaze();
  drawSnowfall(lastDt);
  drawRain(lastDt);
  /* ---- screen space ---- */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const haze = ctx.createLinearGradient(0, 0, 0, vh * 0.45);
  haze.addColorStop(0, LIGHT.skyBot + (LIGHT.night > 0.5 ? '18' : '3a'));
  haze.addColorStop(1, LIGHT.skyBot + '00');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, vw, vh * 0.45);
  const low = ctx.createLinearGradient(0, vh * 0.7, 0, vh);
  low.addColorStop(0, 'rgba(16,26,14,0)');
  low.addColorStop(1, 'rgba(16,26,14,.28)');
  ctx.fillStyle = low;
  ctx.fillRect(0, vh * 0.7, vw, vh * 0.3);
  let diving = false;
  for (const h of hawks) {
    if (h.state === 'dive') diving = true;
    const sx2 = (h.x - cam.x) * z + vw / 2,
      sy2 = (PY(h.y, h.z) - cam.py) * z + vh / 2;
    if (sx2 > -20 && sx2 < vw + 20 && sy2 > -20 && sy2 < vh + 20) continue;
    const dist = Math.hypot(h.x - L.x, h.y - L.y);
    if (dist > 1600 || h.state === 'carry' || h.state === 'leave') continue;
    const a = Math.atan2(sy2 - vh / 2, sx2 - vw / 2);
    const m = 34;
    const ex2 = clamp(vw / 2 + Math.cos(a) * vw, m, vw - m),
      ey2 = clamp(vh / 2 + Math.sin(a) * vh, m + 60, vh - m);
    ctx.save();
    ctx.translate(ex2, ey2);
    ctx.rotate(a);
    ctx.globalAlpha = clamp(1.3 - dist / 1600, 0.3, 1);
    ctx.fillStyle = h.state === 'patrol' ? '#E0A33F' : '#E5573F';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  if (diving) {
    const p = 0.1 + 0.06 * Math.sin(T * 14);
    const gr = ctx.createRadialGradient(
      vw / 2,
      vh / 2,
      Math.min(vw, vh) * 0.35,
      vw / 2,
      vh / 2,
      Math.max(vw, vh) * 0.75
    );
    gr.addColorStop(0, 'rgba(229,87,63,0)');
    gr.addColorStop(1, `rgba(229,87,63,${p})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, vw, vh);
  }
  ctx.globalAlpha = 1;
}
