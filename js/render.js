/* Flokk - render.js
   Rendering: copies of the looping world, painter sort, cast shadows.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- rendering ---------- */
// a round blob of colour 'r,g,b' fading smoothly to nothing, drawn scaled and faded: far softer than a filled shape
const PUFFS = {};
function softPuff(rgb) {
  if (PUFFS[rgb]) return PUFFS[rgb];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'),
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.45, `rgba(${rgb},.5)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return (PUFFS[rgb] = c);
}
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
// broader, nearly parallel-edged "flying door" wing - an eagle's, not a hawk's tapered one
const EWING = [
  [0.22, 0.12],
  [0.28, 0.42],
  [0.24, 0.74],
  [0.08, 1.14],
  [0.02, 1.06],
  [-0.05, 1.22],
  [-0.1, 1.13],
  [-0.16, 1.24],
  [-0.2, 1.14],
  [-0.27, 1.18],
  [-0.42, 1.0],
  [-0.46, 0.7],
  [-0.44, 0.36],
  [-0.34, 0.12]
];
function hawkGeom(h) {
  const K = h.s * (0.92 + 0.06 * h.z);
  const T3 = mkRot3(h.bank, h.pitch, h.psi, K);
  const fold = h.fold,
    owl = h.kind === 'owl',
    flapping = h.flapOn || Math.abs(Math.sin(h.flap)) > 0.08,
    beat = flapping ? Math.sin(h.flap) * (owl ? 0.5 : 0.95) : 0,
    // a real wingbeat folds in a little on the upstroke and snaps flat on the power downstroke - that
    // asymmetry, not just a bigger sine, is most of what reads as an actual flap rather than a wobble
    stroke = flapping && !owl ? Math.max(0, -Math.sin(h.flap)) * 0.2 : 0,
    span = 1 - 0.5 * fold - 0.15 * stroke;
  const wing = sg =>
    (owl ? OWING : h.kind === 'eagle' ? EWING : HWING).map(([f, s2]) => {
      const wrist = Math.max(0, s2 - 0.55),
        ff = f - fold * 0.55 * s2 - stroke * (0.18 * s2 + wrist * 0.55),
        u =
          h.dih * s2 +
          beat * Math.min(s2, 0.55) * (1 - fold) +
          Math.sin(h.flap - 0.22) * (flapping ? (owl ? 0.5 : 0.95) : 0) * wrist * (1 - fold - stroke * 0.5);
      return T3(ff, sg * s2 * span, u);
    });
  const fan = (0.2 + 0.3 * h.fan) * (h.kind === 'eagle' ? 1.3 : 1),
    tl = h.kind === 'owl' ? 0.62 : h.kind === 'eagle' ? 0.72 : 1;
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
const wingNormal = (p, sg) => crossNormal(p[0], p[7], p[11], sg);
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function drawHawk(h) {
  const g = hawkGeom(h),
    K = g.K;
  ctx.save();
  ctx.globalAlpha = Math.max(0, h.alpha);
  const P = p => [h.x + p[0], (h.y + p[1]) * TILT - h.z * HZ - p[2]];
  const path = pts => tracePath(pts, P);
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
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const drawWing = (pts, sg) => {
    let n = wingNormal(pts, sg);
    const top = dot3(n, HVIEW) >= 0;
    if (!top) n = n.map(x => -x);
    const lit = clamp(0.62 + 0.55 * dot3(n, HLIGHT), 0.5, 1.18);
    const owl = h.kind === 'owl',
      eagle = h.kind === 'eagle';
    path(pts);
    // a white-tailed eagle reads dark on both wing faces; an owl's top is a cooler, greyer brown
    // than a hawk's warm rufous, closer to bark and dead leaves than to a hawk's ruddy tan
    ctx.fillStyle = shade(eagle ? '#3B2C20' : top ? (owl ? '#696451' : '#625A4A') : owl ? '#C7C3AC' : '#BEB39C', lit);
    ctx.fill();
    path(pts.slice(2, 11).concat([mix3(pts[2], pts[11], 0.5)]));
    ctx.fillStyle = top ? 'rgba(28,18,10,.5)' : 'rgba(70,48,30,.4)';
    ctx.fill();
    if (top) {
      const la = mix3(pts[0], pts[13], 0.4),
        lb = mix3(pts[2], pts[11], 0.35),
        ma = mix3(pts[1], pts[12], 0.5),
        mb = mix3(pts[2], pts[11], 0.55);
      line(la, lb, shade(owl ? '#8A8065' : '#A07F58', lit), K * 0.09);
      line(ma, mb, shade(owl ? '#766C54' : '#8A6A48', lit), K * 0.06);
      if (owl) {
        // dappled mottling across the wing - a real owl's cryptic bark-and-leaf camouflage pattern,
        // in place of a hawk's clean splayed primaries, so the two read differently at a glance
        ctx.fillStyle = 'rgba(38,32,22,.4)';
        for (const t of [0.25, 0.5, 0.75])
          for (const [p1, p2] of [
            [la, lb],
            [ma, mb]
          ]) {
            const q = P(mix3(p1, p2, t));
            ctx.beginPath();
            ctx.ellipse(q[0], q[1], K * 0.028, K * 0.018, 0, 0, TAU);
            ctx.fill();
          }
      } else {
        // the splayed primaries of a soaring hawk, each one visible rather than one flat blade of wing
        const wrist = mix3(pts[1], pts[2], 0.4);
        for (const k of [3, 5, 7, 9]) line(wrist, pts[k], 'rgba(28,17,9,.4)', K * 0.03);
      }
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
    ctx.strokeStyle = 'rgba(25,22,18,.18)';
    ctx.lineWidth = Math.max(0.35, K * 0.012);
    ctx.stroke();
  };
  const drawTail = () => {
    path(g.tail);
    // an adult white-tailed eagle's signature: a clean white wedge, not a barred brown fan
    ctx.fillStyle = h.kind === 'eagle' ? '#F2EDE0' : '#7A5A3A';
    ctx.fill();
    if (h.kind === 'eagle') return;
    for (const f of [-0.55, -0.7, -0.84]) {
      const w = 0.12 + (0.28 * h.fan * (-f - 0.3)) / 0.6;
      line(g.T3(f, -w, 0.03), g.T3(f, w, 0.03), 'rgba(40,26,16,.55)', K * 0.05);
    }
    // individual feather shafts fanning from the base - a tail of feathers, not one solid blade
    const tw = 0.12 + (0.28 * h.fan * 0.9) / 0.6;
    for (const s of [-0.85, -0.35, 0.35, 0.85])
      line(g.T3(-0.3, 0, 0.032), g.T3(-0.88, s * tw, 0.03), 'rgba(120,88,56,.3)', K * 0.016);
  };
  // Project the full volume into the same bank/pitch frame as the wings.
  // This keeps the breast and skull from remaining flat circles while the bird turns.
  const volume = (center, radii, color) => {
    const c = P(g.T3(...center));
    const axes = radii.map((r, i) => {
      const q = center.slice();
      q[i] += r;
      const p = P(g.T3(...q));
      return [p[0] - c[0], p[1] - c[1]];
    });
    let xx = 0,
      xy = 0,
      yy = 0;
    for (const [x, y] of axes) {
      xx += x * x;
      xy += x * y;
      yy += y * y;
    }
    const det = Math.sqrt(Math.max(0.00001, xx * yy - xy * xy)),
      den = Math.sqrt(xx + yy + 2 * det);
    ctx.save();
    ctx.transform((xx + det) / den, xy / den, xy / den, (yy + det) / den, c[0], c[1]);
    const grad = ctx.createRadialGradient(-0.3, -0.38, 0.08, 0, 0, 1.1);
    grad.addColorStop(0, shade(color, 1.13));
    grad.addColorStop(0.65, color);
    grad.addColorStop(1, shade(color, 0.64));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  const drawBody = () => {
    const owl = h.kind === 'owl',
      eagle = h.kind === 'eagle',
      body = eagle ? '#494238' : owl ? '#756E5C' : '#756856',
      head = eagle ? '#B8AD92' : owl ? '#756E5C' : '#817866';
    volume([-0.04, 0, -0.025], [owl ? 0.43 : 0.47, 0.145, owl ? 0.22 : 0.18], body);
    volume([0.25, 0, 0.035], [0.24, 0.12, 0.14], body);
    volume([0.44, 0, 0.075], [owl ? 0.2 : 0.155, owl ? 0.18 : 0.105, owl ? 0.21 : 0.125], head);
    const forward = g.T3(1, 0, 0),
      facing = dot3(forward, HVIEW) / K;
    if (owl && facing > 0.05) {
      // The disc is on the face plane, so it turns out of view instead of staring at the camera.
      const disk = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        disk.push(g.T3(0.565, Math.cos(a) * 0.143, 0.07 + Math.sin(a) * 0.164));
      }
      path(disk);
      ctx.fillStyle = '#B5AE97';
      ctx.fill();
      for (const side of [-1, 1]) {
        const eye = P(g.T3(0.578, side * 0.061, 0.083));
        ctx.fillStyle = '#24231E';
        ctx.beginPath();
        ctx.arc(...eye, K * 0.023, 0, TAU);
        ctx.fill();
      }
    } else if (!owl) {
      for (const side of [-1, 1]) {
        if (dot3(g.T3(0, side, 0), HVIEW) <= 0) continue;
        const eye = P(g.T3(0.47, side * 0.09, 0.11));
        ctx.fillStyle = '#BAA66A';
        ctx.beginPath();
        ctx.arc(...eye, K * 0.025, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#181B18';
        ctx.beginPath();
        ctx.arc(...eye, K * 0.014, 0, TAU);
        ctx.fill();
      }
    }
    const tip = owl ? 0.63 : eagle ? 0.72 : 0.66;
    path(
      [
        [0.55, -0.035, 0.06],
        [tip, 0, 0.02],
        [tip - 0.03, 0, -0.035],
        [0.55, 0.035, 0.025]
      ].map(p => g.T3(...p))
    );
    ctx.fillStyle = owl ? '#494235' : '#9D916C';
    ctx.fill();
    if (h.prey) {
      const prey = P(g.T3(-0.02, 0, -0.3));
      ctx.fillStyle = h.prey.c2;
      ctx.beginPath();
      ctx.ellipse(...prey, 3, 4, 0, 0, TAU);
      ctx.fill();
    }
  };
  const parts = [
    { d: depthOf(g.wL), f: () => drawWing(g.wL, -1) },
    { d: depthOf(g.wR), f: () => drawWing(g.wR, 1) },
    { d: depthOf(g.tail) - K * 0.2, f: drawTail },
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
  const flutter = windWave(t.x, t.y) * 0.7 + Math.sin(T * 1.7 + ph) * 0.3;
  // the gust passing over this tree (weather.js), so you can watch a gust come through a stand tree by tree
  const g = gustAt(t.x, t.y),
    lean = Math.cos(WEATHER.ang) * WEATHER.s * (0.25 + g);
  return (flutter * 0.04 * (0.5 + 0.5 * WEATHER.s + 0.8 * g) + lean * 0.03) * stiff;
}
// the sprite recoloured to the sky's colour, in a scratch canvas the size of the sprite (trees past the map's
// north edge only, so a few per frame)
const EDGE_TINT = document.createElement('canvas');
function edgeTint(spr) {
  if (EDGE_TINT.width !== spr.width || EDGE_TINT.height !== spr.height) {
    EDGE_TINT.width = spr.width;
    EDGE_TINT.height = spr.height;
  }
  const q = EDGE_TINT.getContext('2d');
  q.globalCompositeOperation = 'source-over';
  q.clearRect(0, 0, spr.width, spr.height);
  q.drawImage(spr, 0, 0);
  q.globalCompositeOperation = 'source-atop';
  q.fillStyle = LIGHT.skyBot;
  q.fillRect(0, 0, spr.width, spr.height);
  return EDGE_TINT;
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
  crossfadeUnder(TRANS.prevSPR && TRANS.prevSPR[t.type][t.v], x, y, w, h);
  // bare twigs and first leaves under a tree still leafing out, or losing its leaves (grow.js)
  const la = growUnder(t, x, y, w, h);
  ctx.globalAlpha *= la;
  if (la > 0.005) drawTrim(ctx, spr, x, y, w, h);
  ctx.globalAlpha = 1;
  // recede into the sky only past the map's actual northern edge (y<0 - the thin strip generated
  // beyond it purely so the treeline doesn't look clipped): without this, a bare tree's crown out
  // there, taller on screen than the misty ridge far behind it, reads as a hard shape floating in
  // open sky rather than a hazy, distant one. Never touches anything within the real map (y>=0).
  const edge = Math.pow(clamp(-t.y / 260, 0, 1), 1.5);
  if (edge > 0.01 && la > 0.005) {
    // tint the tree's own pixels only: a source-atop fill on the main canvas would wash a hard rectangle
    // over everything already drawn behind the tree (ridge, other trees), and that box swayed with it
    const q = edgeTint(spr);
    ctx.globalAlpha = edge * 0.5 * la;
    ctx.drawImage(q, x, y, w, h);
    ctx.globalAlpha = 1;
  }
  if (LIGHT.rim > 0.04 && la > 0.005) {
    const r = RIM[t.type][t.v];
    if (r) {
      const si = LIGHT.rimSide > 0 ? 1 : 0;
      ctx.globalAlpha = LIGHT.rim * 0.3 * la * tEase();
      drawTrim(ctx, r.c[1 - si], x, y, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = LIGHT.rim * (LIGHT.eve ? 0.36 : 0.28) * la * tEase();
      drawTrim(ctx, r.w[si], x, y, w, h);
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
    // a gust breaks the mirror up: fainter, and shivering sideways
    const rg = clamp(0.3 * WEATHER.s + gustAt(lx, c.y), 0, 1.3);
    ctx.translate(Math.sin(T * 3.1 + t.x * 0.07) * rg * 1.4, 0);
    ctx.globalAlpha = al * (1 - 0.35 * Math.min(1, rg));
    ctx.drawImage(spr, t.x - AX * kw, -AY * k, SW * kw, SHT * k);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// a round-headed opening on a wall: Q(u, h) is the wall point; u0..u1 wide, from h0 up to the crown at h1
function arch(Q, u0, u1, h0, h1, fill, stroke, rise = 3.5) {
  const m = (u0 + u1) / 2,
    hw = (u1 - u0) / 2,
    pts = [Q(u0, h0), Q(u1, h0)];
  for (let i = 0; i <= 8; i++) {
    const t = (i / 8) * Math.PI;
    pts.push(Q(m + hw * Math.cos(t), h1 - rise + rise * Math.sin(t)));
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
// the church spire: a tall four-sided pyramid on the tower, shingled, with an iron cross at the tip
function drawSpire(b, P, poly, cols, hl, hd) {
  const o = 3,
    c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    ap = P(0, 0, b.rh),
    base = b.wh - 2,
    faces = [
      [-hl - o, -hd - o, hl + o, -hd - o, 0, -1],
      [hl + o, -hd - o, hl + o, hd + o, 1, 0],
      [hl + o, hd + o, -hl - o, hd + o, 0, 1],
      [-hl - o, hd + o, -hl - o, -hd - o, -1, 0]
    ].map(([x1, y1, x2, y2, nx, ny]) => ({ x1, y1, x2, y2, wnx: nx * c - ny * s, wny: nx * s + ny * c }));
  faces.sort((a, q) => a.wny - q.wny);
  const ww = winterW();
  for (const f of faces) {
    let col = shade(cols, clamp(1 - 0.3 * f.wnx + 0.1 * f.wny, 0.6, 1.15));
    if (LIGHT.rim > 0.05 && f.wnx * LIGHT.rimSide > 0) col = mixRgb(col, rimCol(), LIGHT.rim * 0.4 * Math.abs(f.wnx));
    const e0 = P(f.x1, f.y1, base),
      e1 = P(f.x2, f.y2, base);
    poly([e0, e1, ap], col, 'rgba(20,15,10,.35)');
    if (f.wny <= 0) continue;
    // shingle courses across the face, closer together towards the tip
    ctx.strokeStyle = 'rgba(0,0,0,.16)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 1; i < 12; i++) {
      const t = 1 - (1 - i / 12) ** 1.4;
      ctx.moveTo(lerp(e0[0], ap[0], t), lerp(e0[1], ap[1], t));
      ctx.lineTo(lerp(e1[0], ap[0], t), lerp(e1[1], ap[1], t));
    }
    ctx.stroke();
    if (ww > 0.5) {
      // snow only holds in a lip along the flared foot of a spire this steep
      ctx.strokeStyle = '#F7F9FB';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(e0[0], e0[1]);
      ctx.lineTo(e1[0], e1[1]);
      ctx.stroke();
    }
  }
  // iron cross
  ctx.strokeStyle = '#2E2B28';
  ctx.lineCap = 'butt';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(ap[0], ap[1] + 1);
  ctx.lineTo(ap[0], ap[1] - 13);
  ctx.moveTo(ap[0] - 4, ap[1] - 8.5);
  ctx.lineTo(ap[0] + 4, ap[1] - 8.5);
  ctx.stroke();
  ctx.fillStyle = '#C9A95A';
  ctx.fillRect(ap[0] - 1, ap[1] - 1.5, 2, 2);
}
const rnd2 = (b, h, u) => hash2((h * 13 + b.cy) | 0, (u * 1013) | 0);
/* building: real walls, gable ends and a pitched roof, projected in 2.5D */
function drawBuilding(b) {
  // the church draws as its parts (tower, nave, chancel), back to front
  if (b.parts) {
    for (const p of b.parts.slice().sort((a, q) => a.cy - q.cy)) drawBuilding(p);
    return;
  }
  const c = Math.cos(b.ang),
    s = Math.sin(b.ang),
    hl = b.len / 2,
    hd = b.dep / 2;
  const z = b.z || 0, // raised parts (a stave church's nave on its gallery) start this high
    P = (lx, ly, h) => [b.cx + lx * c - ly * s, (b.cy + lx * s + ly * c) * TILT - h - z];
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
  // a soft contact shadow where the walls meet the ground (not under parts raised on others)
  if (!z)
    for (const g of [7, 4.5, 2])
      poly(
        [P(-hl - g, -hd - g, 0), P(hl + g, -hd - g, 0), P(hl + g, hd + g, 0), P(-hl - g, hd + g, 0)],
        'rgba(20,24,18,.07)'
      );
  for (const [x1, y1, x2, y2, nx, ny, gb] of sides) {
    const gable = gb && !b.spire && !b.flat,
      wnx = nx * c - ny * s,
      wny = nx * s + ny * c;
    if (wny <= 0.02) continue;
    const lit = clamp(1 - 0.28 * wnx - 0.08, 0.62, 1.12);
    const wcol = k => {
      const cc = shade(b.wall, lit * k);
      return LIGHT.rim > 0.05 && wnx * LIGHT.rimSide > 0 ? mixRgb(cc, rimCol(), LIGHT.rim * 0.42 * Math.abs(wnx)) : cc;
    };
    const Q = (u, v) => P(lerp(x1, x2, u), lerp(y1, y2, u), v);
    // walls darken toward the ground, where less sky reaches them
    const g0 = Q(0.5, 0),
      g1 = Q(0.5, gable ? rh : wh),
      col = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
    col.addColorStop(0, wcol(0.8));
    col.addColorStop(0.3, wcol(0.97));
    col.addColorStop(1, wcol(1.05));
    poly([Q(0, 0), Q(1, 0), Q(1, wh), Q(0, wh)], col);
    if (gable) poly([Q(0, wh), Q(1, wh), P((x1 + x2) / 2, (y1 + y2) / 2, rh)], col);
    if (b.stone) {
      // fieldstone: rough courses of lighter and darker stones in lime mortar
      const L = Math.hypot(x2 - x1, y2 - y1),
        top = gable ? rh : wh;
      for (let hh = 3; hh < top - 2; hh += 5)
        for (let u = ((hh * 7) % 9) / L; u < 1; u += (rnd2(b, hh, u) * 8) / L + 4 / L) {
          const cap = gable ? lerp(wh, rh, 1 - Math.abs(u - 0.5) * 2) : wh;
          if (hh > cap - 2) continue;
          const k = hash2((u * 997) | 0, (hh * 31 + b.cx) | 0),
            a = Q(u, hh),
            w = Math.min(1 - u, (3 + 3 * k) / L),
            q = Q(u + w, hh + 3);
          ctx.fillStyle = k < 0.5 ? 'rgba(0,0,0,.1)' : 'rgba(255,250,235,.1)';
          ctx.fillRect(
            Math.min(a[0], q[0]),
            Math.min(a[1], q[1]),
            Math.abs(q[0] - a[0]) + 0.5,
            Math.abs(q[1] - a[1]) + 0.5
          );
        }
    } else if (b.wall !== '#E6E0D2') {
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
    // the overhanging eaves shade the top of the wall; a stone plinth runs along its foot
    if (!gable) {
      const e0 = Q(0, wh),
        d0 = Q(0, wh - 8),
        eg = ctx.createLinearGradient(e0[0], e0[1], d0[0], d0[1]);
      eg.addColorStop(0, 'rgba(15,12,10,.36)');
      eg.addColorStop(1, 'rgba(15,12,10,0)');
      poly([e0, Q(1, wh), Q(1, wh - 8), d0], eg);
    }
    if (!z) {
      poly([Q(0, 0), Q(1, 0), Q(1, 2.6), Q(0, 2.6)], shade('#8C877D', lit * 0.92));
      poly([Q(0, 2.6), Q(1, 2.6), Q(1, 3.2), Q(0, 3.2)], 'rgba(0,0,0,.12)');
    }
    // a house's front door sits in the middle of the side the farmer walks out of, with a stone step
    const front = b.kind === 'house' && ny === 1 && !b.flat;
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
    if (b.flat && ny === 1) drawStorefront(Q, wh, poly);
    if (b.service === 'farmstore' && ny === 1) {
      const signColor = '#344E36';
      poly(
        [
          P(-hl * 0.82, hd + 0.2, wh - 9),
          P(hl * 0.82, hd + 0.2, wh - 9),
          P(hl * 0.82, hd + 0.2, wh - 2),
          P(-hl * 0.82, hd + 0.2, wh - 2)
        ],
        signColor
      );
      const origin = P(0, hd + 0.4, wh - 4.7),
        axis = P(1, hd + 0.4, wh - 4.7);
      ctx.save();
      ctx.transform(axis[0] - origin[0], axis[1] - origin[1], 0, 1, origin[0], origin[1]);
      ctx.font = 'bold 4.6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#E6E0CD';
      ctx.fillText('GÅRDSBUTIKK', 0, 0);
      ctx.restore();
      for (const lx of [-hl * 0.6, hl * 0.6]) {
        poly([P(lx - 7, hd + 8, 0), P(lx + 7, hd + 8, 0), P(lx + 7, hd + 8, 7), P(lx - 7, hd + 8, 7)], '#8F7251');
        for (let i = -5; i <= 5; i += 2.5) {
          const q = P(lx + i, hd + 7, 8);
          ctx.fillStyle = '#B3A254';
          ctx.beginPath();
          ctx.arc(...q, 1.6, 0, TAU);
          ctx.fill();
        }
      }
    }
    if (b.portal && nx === -1) {
      // the church door, facing the road
      const L = Math.hypot(x2 - x1, y2 - y1),
        w = 6 / L,
        tar = b.wall === '#3B2A1F';
      arch(
        Q,
        0.5 - w,
        0.5 + w,
        0,
        Math.min(20, wh * 0.9 + (gable ? (rh - wh) * 0.5 : 0)),
        shade(tar ? '#6A4A30' : '#4A3226', lit),
        tar ? '#8A6A48' : '#F1ECE2'
      );
    }
    if (b.spire) {
      // louvred openings for the bells up top
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (const u of [0.32, 0.68]) arch(Q, u - 3.2 / L, u + 3.2 / L, wh * 0.76, wh * 0.9, 'rgba(30,26,22,.85)');
    } else if (b.tall) {
      // the church's tall, round-headed windows, none in the gable ends
      if (!gable) {
        const L = Math.hypot(x2 - x1, y2 - y1),
          n = Math.max(1, Math.round(L / 30));
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n,
            w = 4.5 / L;
          arch(Q, u - w, u + w, wh * 0.22, wh * 0.82, winCol(), '#F4F0E6');
          // small panes behind white glazing bars
          const m0 = Q(u, wh * 0.22),
            m1 = Q(u, wh * 0.8),
            h0 = Q(u - w, wh * 0.52),
            h1 = Q(u + w, wh * 0.52);
          ctx.strokeStyle = 'rgba(244,240,230,.85)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(m0[0], m0[1]);
          ctx.lineTo(m1[0], m1[1]);
          ctx.moveTo(h0[0], h0[1]);
          ctx.lineTo(h1[0], h1[1]);
          ctx.stroke();
        }
      }
    } else if (b.windows && !(b.flat && ny === 1)) {
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
        // set into the wall: shade under the head, a sill standing out below
        poly([Q(u - w, wh * 0.78), Q(u + w, wh * 0.78), Q(u + w, wh * 0.7), Q(u - w, wh * 0.7)], 'rgba(0,0,0,.2)');
        poly(
          [Q(u - w * 1.3, wh * 0.35), Q(u + w * 1.3, wh * 0.35), Q(u + w * 1.3, wh * 0.3), Q(u - w * 1.3, wh * 0.3)],
          '#F4F0E6'
        );
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
      b.spire ? ww * 0.45 : ww
    );
  if (b.spire) {
    drawSpire(b, P, poly, cols, hl, hd);
    return;
  }
  if (b.flat) {
    drawFlatRoof(b, P, poly, cols, hl, hd);
    return;
  }
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
    const rcol = k => {
      const cc = shade(cols, lit * k);
      return LIGHT.rim > 0.05 && pl.wx * LIGHT.rimSide > 0
        ? mixRgb(cc, rimCol(), LIGHT.rim * 0.35 * Math.abs(pl.wx))
        : cc;
    };
    const [e0, e1, r0, r1] = pl.pts;
    // each roof plane catches a little more light up by the ridge than down at the eaves
    const rg = ctx.createLinearGradient(
      (r0[0] + r1[0]) / 2,
      (r0[1] + r1[1]) / 2,
      (e0[0] + e1[0]) / 2,
      (e0[1] + e1[1]) / 2
    );
    rg.addColorStop(0, rcol(1.07));
    rg.addColorStop(1, rcol(0.9));
    poly(pl.pts, rg, 'rgba(20,15,10,.35)');
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
  // the roof's thickness: a board along the front eave and up each gable edge
  const board = b.trim ? '#ECE6DA' : shade(cols, 0.5);
  for (const pl of planes) {
    const [e0, e1, r0, r1] = pl.pts;
    if (pl.wy > 0) poly([e0, e1, [e1[0], e1[1] + 2.4], [e0[0], e0[1] + 2.4]], board);
    ctx.strokeStyle = board;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e0[0], e0[1]);
    ctx.lineTo(r1[0], r1[1]);
    ctx.moveTo(e1[0], e1[1]);
    ctx.lineTo(r0[0], r0[1]);
    ctx.stroke();
  }
  if (xmasLit(b)) {
    // a string of lights along the front eave, and on Jul up the gable edges as well
    const seed = hash2(b.cx, b.cy + 7) * 4;
    for (const { pts, wy } of planes) {
      if (wy <= 0) continue;
      const [e0, e1, r0, r1] = pts;
      xmasString(
        e0[0],
        e0[1] + 3.6,
        e1[0],
        e1[1] + 3.6,
        seed | 0,
        b.kind === 'house' ? 2.2 : 3,
        b.kind === 'house' ? 11 : 15
      );
      if (isYule()) {
        xmasString(e0[0], e0[1] + 2, r1[0], r1[1], (seed + 1) | 0, 1.2, 9);
        xmasString(e1[0], e1[1] + 2, r0[0], r0[1], (seed + 2) | 0, 1.2, 9);
      }
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
  ctx.strokeStyle = shade(cols, 1.25);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(r0[0], r0[1] - 1.1);
  ctx.lineTo(r1[0], r1[1] - 1.1);
  ctx.stroke();
  if (b.dragons) {
    // carved dragon heads rearing off both gable tips
    const dl = Math.hypot(r1[0] - r0[0], r1[1] - r0[1]) || 1;
    ctx.strokeStyle = '#2A1E16';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (const [e, sg] of [
      [r0, -1],
      [r1, 1]
    ]) {
      const ox = ((r1[0] - r0[0]) / dl) * sg,
        oy = ((r1[1] - r0[1]) / dl) * sg;
      ctx.moveTo(e[0], e[1]);
      ctx.quadraticCurveTo(e[0] + ox * 11, e[1] + oy * 11 - 5, e[0] + ox * 9, e[1] + oy * 9 - 16);
      ctx.lineTo(e[0] + ox * 15, e[1] + oy * 15 - 18);
      ctx.moveTo(e[0] + ox * 9, e[1] + oy * 9 - 16);
      ctx.lineTo(e[0] + ox * 12, e[1] + oy * 12 - 13);
    }
    ctx.stroke();
  }
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
    top = PY(p.y, POLE_H),
    snow = winterW();
  // the trunk itself: a tapered wood post (wider at the foot), a weathered highlight down one edge,
  // and a few short grain flecks so it doesn't read as a flat stick
  const bw = 2.1,
    tw = 1.1;
  ctx.fillStyle = '#4E3D2B';
  ctx.beginPath();
  ctx.moveTo(p.x - bw, base);
  ctx.lineTo(p.x - tw, top);
  ctx.lineTo(p.x + tw, top);
  ctx.lineTo(p.x + bw, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,98,70,.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(p.x - bw * 0.35, base);
  ctx.lineTo(p.x - tw * 0.35, top);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(38,28,16,.35)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4,
      gy = lerp(base, top, t),
      gw = lerp(bw, tw, t) * 0.7,
      gx = p.x + (i % 2 ? 1 : -1) * gw * 0.3;
    ctx.moveTo(gx - gw * 0.3, gy - 2);
    ctx.lineTo(gx + gw * 0.3, gy + 2);
  }
  ctx.stroke();
  const ca = p.ang + Math.PI / 2,
    dx = Math.cos(ca) * 9,
    dy = Math.sin(ca) * 9 * TILT;
  const ay = PY(p.y, WIRE_H);
  // the cross-arm, a faint top highlight, and a diagonal brace truss under one side, the way a real
  // distribution pole is braced
  ctx.strokeStyle = '#4E3D2B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x - dx, ay - dy);
  ctx.lineTo(p.x + dx, ay + dy);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(122,98,70,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x - dx, ay - dy - 1);
  ctx.lineTo(p.x + dx, ay + dy - 1);
  ctx.stroke();
  ctx.strokeStyle = '#3E2F20';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x, ay + 3.5);
  ctx.lineTo(p.x + dx * 0.7, ay + dy * 0.7 - 1);
  ctx.stroke();
  // ceramic insulator caps, not just dots: a small standing shape each with its own glint
  for (const sg of [-1, 1]) {
    const ix = p.x + sg * dx * 0.67,
      iy = ay + sg * dy * 0.67;
    ctx.fillStyle = '#DDE3E6';
    ctx.beginPath();
    ctx.ellipse(ix, iy - 1.5, 1.5, 2.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.arc(ix - 0.5, iy - 2.2, 0.6, 0, TAU);
    ctx.fill();
  }
  // winter: a cap of settled snow on the post and along the top of the cross-arm
  if (snow > 0.4) {
    const sa = (snow - 0.4) / 0.6;
    ctx.fillStyle = `rgba(236,241,246,${sa * 0.9})`;
    ctx.beginPath();
    ctx.ellipse(p.x, top + 0.5, tw * 1.4, 1.7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(236,241,246,${sa * 0.95})`;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(p.x - dx, ay - dy - 1.6);
    ctx.lineTo(p.x + dx, ay + dy - 1.6);
    ctx.stroke();
  }
}
function drawXSign(s) {
  const b = s.y * TILT,
    top = PY(s.y, 1.55),
    hw = 8.5,
    hh = 3;
  ctx.strokeStyle = '#8A8478';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(s.x, b);
  ctx.lineTo(s.x, top);
  ctx.stroke();
  ctx.save();
  ctx.translate(s.x, top - 1);
  ctx.fillStyle = '#F4F1E6';
  ctx.strokeStyle = '#B3302A';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-hw, 0);
  ctx.lineTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.lineTo(0, hh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#B3302A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.68, -hh * 0.55);
  ctx.lineTo(hw * 0.68, hh * 0.55);
  ctx.moveTo(-hw * 0.68, hh * 0.55);
  ctx.lineTo(hw * 0.68, -hh * 0.55);
  ctx.stroke();
  ctx.restore();
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
function drawFieldGate(gate) {
  const { p, q } = gate;
  ctx.strokeStyle = '#665039';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const post of [p, q]) {
    ctx.moveTo(post.x, post.y * TILT);
    ctx.lineTo(post.x, PY(post.y, POST_H * 1.15));
  }
  for (const h of [0.12, 0.26]) {
    ctx.moveTo(p.x, PY(p.y, h));
    ctx.lineTo(q.x, PY(q.y, h));
  }
  ctx.moveTo(p.x, PY(p.y, 0.12));
  ctx.lineTo(q.x, PY(q.y, 0.26));
  ctx.stroke();
}
function drawWires() {
  // wires stay light: they are everywhere, and should read as lines in the air, not ink. In deep winter
  // they whiten with rime and sag a touch further, as if carrying a little snow load
  const snow = winterW();
  ctx.strokeStyle = snow > 0.5 ? `rgba(206,214,222,${0.55 + snow * 0.2})` : 'rgba(40,36,30,.5)';
  ctx.lineWidth = 0.9 + snow * 0.3;
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
        ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + SAG * HZ * (2 + snow * 0.7), bx, by);
      }
    }
  ctx.stroke();
}
/* ---------- cast shadows ----------
   Everything is drawn into a white mask with 'darken', so overlapping shadows never stack,
   then the mask is blurred slightly and multiplied onto the ground. The sun sits low in the
   north-west, so a point at height h lands (h*SX, h*SY) away on the ground. */
// one soft wisp of chimney smoke; many overlapping ones make the plume
const SMOKE_SPR = (() => {
  const c = mk(64, 64),
    g = c.getContext('2d'),
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(222,222,216,1)');
  gr.addColorStop(0.4, 'rgba(222,222,216,.7)');
  gr.addColorStop(0.75, 'rgba(222,222,216,.2)');
  gr.addColorStop(1, 'rgba(222,222,216,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
})();
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
  c.box = boxFrom(src, c);
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
  duck: [6, 0.08],
  starling: [2, 0.1],
  linnet: [1.6, 0.08],
  fieldfare: [2.4, 0.13],
  bunting: [1.8, 0.09]
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
    ky = SY / HZ,
    shLen = (Math.hypot(SX, SY) / HZ) * 0.6; // a tree's shadow reaches its height times this
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
    // trees: their own silhouettes, sheared along the sun. Each tree's transform is G0 composed with
    // its own shear/translate; setting the composed matrix directly (one setTransform) instead of
    // concatenating then resetting (transform + setTransform) halves the matrix changes in this loop,
    // which matters with a forest's worth of trees on screen.
    const a1 = dpr * z * SQ,
      d1 = dpr * z * TILT * SQ,
      e1 = tk * SQ,
      f1 = ty * SQ;
    for (const t of TREES) {
      const hh = t.hpx / HZ;
      if (!visG(t.x + hh * SX * 0.5, t.y + hh * SY * 0.5, t.hpx * shLen + t.r * 2.2 + 60)) continue;
      const k = t.k;
      c.setTransform(a1 * px, d1 * py, -a1 * kx, -d1 * ky, a1 * t.x + e1, d1 * t.y + f1);
      drawTrim(c, SSPR[t.type][t.v], -AX * k * (t.ws || 1), -AY * k, SW * k * (t.ws || 1), SHT * k);
    }
    G0();
    c.fillStyle = SHADE;
    c.strokeStyle = SHADE;
    c.lineCap = 'round';
    // buildings: the projected volume (footprint, eaves and ridge)
    trainShadowHulls(c);
    vehicleShadows(c);
    for (const b0 of BUILDS)
      for (const b of b0.parts || [b0]) {
        if (!visG(b0.cx, b0.cy, b0.len + (b0.parts ? 480 : 180))) break;
        const cs = Math.cos(b.ang),
          sn = Math.sin(b.ang),
          hl = b.len / 2 + 4,
          hd = b.dep / 2 + 4,
          pts = [];
        const P = (lx, ly, h) => {
          const q = (h + (b.z || 0)) / HZ;
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
        if (b.spire) P(0, 0, b.rh);
        else {
          P(-hl, 0, b.rh);
          P(hl, 0, b.rh);
        }
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
    if (SEASON >= 2) for (const b of BALES) if (baleShown(b) && visG(b.x, b.y, 40)) cap(b.x, b.y, BALE_H, b.r * 2);
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
// the ground's last SEAM_U units and first SEAM_U units side by side, rebuilt when the ground canvas changes
const SEAM_U = 10, // 6 whole pixels of the ground canvas each side
  SEAMC = new WeakMap();
function seamStrip(img) {
  let c = SEAMC.get(img);
  if (!c || c.ver !== img.ver) {
    if (!c) SEAMC.set(img, (c = document.createElement('canvas')));
    const u = Math.round(SEAM_U * S);
    c.width = 2 * u;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, img.width - u, 0, u, img.height, 0, 0, u, img.height);
    x.drawImage(img, 0, 0, u, img.height, u, 0, u, img.height);
    c.ver = img.ver;
  }
  return c;
}
// the screen row (device pixels) where the ground plane starts: it is painted opaque from there down
const groundTopPx = () => Math.max(0, ((-150 * TILT - cam.py) * cam.z + vh / 2) * dpr);
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
  ctx.rect(0, groundTopPx(), cv.width, cv.height);
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
  /* every copy's ground first, then every copy's snow-and-straw layer on top: the ground blit runs a few
     units past each seam, and done copy by copy it would paint over the neighbour's snow there in a line */
  for (const pass of [0, 1])
    for (const k of KS) {
      const tk = inK(k);
      ctx.setTransform(dpr * z, 0, 0, dpr * z * TILT, tk, ty);
      const sx = Math.max(0, V.x0),
        sy = Math.max(0, gy0),
        ex = Math.min(W, V.x1),
        ey = Math.min(H, gy1);
      if (!(ex > sx && ey > sy)) continue;
      // where this copy meets its eastern neighbour, lay one strip of ground straddling the seam (the land's
      // last few units and its first few, side by side) so neither copy's antialiased edge ends on bare
      // background. Only this copy draws it: the neighbour only paints its own ground from the seam east
      const blit = (img, sy, ey) => {
        ctx.drawImage(img, sx * S, sy * S, (ex - sx) * S, (ey - sy) * S, sx, sy, ex - sx, ey - sy);
        if (ex >= W) {
          const q = seamStrip(img);
          ctx.drawImage(q, 0, sy * S, q.width, (ey - sy) * S, W - SEAM_U, sy, 2 * SEAM_U, ey - sy);
        }
      };
      const paint = (sy, ey) => {
        if (pass) return growGround(sx, sy, ex, ey);
        blit(G, sy, ey);
        if (TRANS.prevG) {
          ctx.globalAlpha = 1 - tEase();
          blit(TRANS.prevG, sy, ey);
          ctx.globalAlpha = 1;
        }
      };
      paint(sy, ey);
      // north of y=0 the land runs on under the ridges: mirror the top rows up into that strip, so the
      // forest floor (snow in winter) carries on instead of stopping in a straight line against a flat fill
      if (gy0 < 0) {
        ctx.setTransform(dpr * z, 0, 0, -dpr * z * TILT, tk, ty);
        paint(0, Math.min(H, 150, -gy0));
      }
    }
  for (const k of KS) {
    const tk = inK(k);
    if (winterW() < 0.5) drawReflections(tk, ty, z);
    ctx.setTransform(dpr * z, 0, 0, dpr * z * TILT, tk, ty);
    ctx.strokeStyle = LIGHT.rim > 0.05 ? mixHex('#E8F4EE', LIGHT.eve ? '#FFB060' : '#FFCDA8', LIGHT.rim) : '#E8F4EE';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    drawWaterMood(ctx);
    if (winterW() < 0.5) {
      drawLilies(ctx);
      // glints twinkle on calm water and give way to the wind's own waves as it roughens (waves.js)
      for (const s of SPARK) {
        if (!visG(s.x, s.y, 10)) continue;
        const a = Math.max(0, Math.sin(T * s.s + s.p));
        const al = a ** 10 * (1 - smooth(0.15, 0.7, waterRough(s)));
        if (al < 0.04) continue;
        ctx.globalAlpha = al * 0.8;
        ctx.beginPath();
        ctx.moveTo(s.x - s.l / 2, s.y);
        ctx.lineTo(s.x + s.l / 2, s.y);
        ctx.stroke();
      }
      drawWaves(ctx);
    }
    {
      const sc = ctx.strokeStyle;
      drawDew();
      ctx.strokeStyle = sc;
      ctx.lineWidth = 2;
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
    // each copy shades only its own stretch of land (cut on whole device pixels, like the snow), with the
    // cloud shadows and mist that reach it from across the seam included, so one crossing the seam stays whole
    ctx.save();
    {
      const m = ctx.getTransform(),
        snap = x => (Math.round(m.a * x + m.e) - m.e) / m.a,
        x0 = snap(0);
      ctx.beginPath();
      ctx.rect(x0, gy0 - 10, snap(W) - x0, gy1 - gy0 + 20);
      ctx.clip();
    }
    ctx.globalAlpha = 0.38 * LIGHT.shadowA;
    for (const c of CLOUDSH)
      for (const ox of [0, -W, W]) {
        const x = c.x + ox;
        if (x + c.s < Math.max(0, V.x0) || x - c.s > Math.min(W, V.x1) || c.y + c.s < gy0 || c.y - c.s > gy1) continue;
        ctx.drawImage(SHADOW_SPR, x - c.s, c.y - c.s, c.s * 2, c.s * 2);
      }
    ctx.globalAlpha = 1;
    drawMist(); // the mist banks likewise
    ctx.restore();
    // gusts, spindrift, rain rings and fallen leaves are in flock coordinates, so they draw once, unclipped, in the k=0 copy
    if (k === 0) drawWeatherGround();
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
    shelt = [],
    skyA = [],
    hk = [];
  bladesBegin(); // the grass and crop blades go to the GPU layer when there is one (blades.js)
  for (const k of KS) {
    const tk = inK(k);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, tk, ty);
    ctx.strokeStyle = SEASON === 3 ? '#9A8662' : SEASON === 0 ? '#6E8A48' : '#5E7438';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const r of REEDS) {
      if (!visU(r.x, r.y, 10, 20)) continue;
      const b = r.y * TILT;
      const sw = r.l + (windWave(r.x, r.y) * 1.6 + 1.2) * WIND.x * 1.6;
      ctx.moveTo(r.x, b);
      ctx.quadraticCurveTo(r.x + sw * 0.3, b - r.h * 0.6, r.x + sw, b - r.h);
    }
    ctx.stroke();
    drawGrass(); // standing grass over the meadows and pastures (grass.js)
    drawCrops(); // the standing grain, rapeseed, potatoes and onions (crops.js)
    for (const t of TREES) if (visU(t.x, t.y, t.r * 2.4, t.hpx + 10)) items.push([t.y, 0, t, k]);
    for (const b of BUILDS) if (visU(b.cx, b.cy, b.len, b.rh + b.len * 0.6)) items.push([b.cy, 1, b, k]);
    for (const line of LINES)
      for (const p of line) if (!p.ghost && visU(p.x, p.y, 14, POLE_H * HZ)) items.push([p.y, 2, p, k]);
    if (SEASON >= 2) for (const b of BALES) if (baleShown(b) && visU(b.x, b.y, 14, 16)) items.push([b.y, 3, b, k]);
    for (const f of FSEG) if (visU(f.p.x, f.p.y, 40, 16)) items.push([f.k, 4, f, k]);
    for (const gate of FIELD_GATES) if (visU(gate.p.x, gate.p.y, 40, 18)) items.push([gate.k, 17, gate, k]);
    for (const b of BOULDERS) if (visU(b.x, b.y, b.r + 4, b.h + 6)) items.push([b.y, 6, b, k]);
    for (const b of BUSHES) if (visU(b.x, b.y, b.r + 4, b.h + 6)) items.push([b.y, 13, b, k]);
    if (TRAIN) for (const c of TRAIN.cars) if (visU(c.x, c.y, 40, 40)) items.push([c.y, 10, c, k]);
    for (const v of TRAFFIC) {
      if (visU(v.x, v.y, 50, 30)) items.push([v.y, 11, v, k]);
    }
    for (const l of LAMPS) if (visU(l.x, l.y, 20, 110)) items.push([l.y, 8, l, k]);
    for (const p of PROPS) if (visU(p.x, p.y, 50, 190)) items.push([p.key ?? p.y + 7, 12, p, k]);
    for (const s of XSIGNS) if (visU(s.x, s.y, 20, 60)) items.push([s.y, 14, s, k]);
    if (FEEDER && SEASON === 3 && visU(FEEDER.x, FEEDER.y, 20, 90)) items.push([FEEDER.y, 9, FEEDER, k]);
    for (const a of ANIMALS) {
      if (isSky(a)) {
        if (visU(a.x, a.y, 40, a.z * HZ + 30)) skyA.push([a, k]);
      } else if ((a.k === 'human' ? (a.fade ?? 1) > 0.02 : !a.hide) && visU(a.x, a.y, 40, 60))
        items.push([a.y, 7, a, k]);
    }
    for (const b of birds) {
      if (b.state === 'fly' || b.state === 'land') {
        if (visU(b.x, b.y, 30, b.z * HZ + 20)) air.push([b, k]);
        continue;
      }
      const p = b.perch;
      if (!visU(b.x, b.y, 30, (p ? p.h : 0) * HZ + 20)) continue;
      if (p && p.cover && coveredNow(b)) shelt.push([b, k]);
      if (p && (p.type === 'wire' || p.type === 'pole')) wire.push([b, k]);
      else items.push([(p ? p.key : b.y) + b.hy * 0.01, 5, b, k]);
    }
    for (const h of hawks) if (visU(h.x, h.y, 60, h.z * HZ + 40)) hk.push([h, k]);
    // rain, snow, blown leaves and fog banks take their place among the trees (weather.js)
    if (k === 0) weatherItems(items);
  }
  bladesFlush(); // lay the GPU grass and crop layer in, under everything that stands
  V = V0;
  let ck = null;
  const setK = k => {
    if (k !== ck) {
      ck = k;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, tx + k * W * dpr * z, ty);
    }
  };
  items.sort((a, b) => a[0] - b[0]);
  // indexed rather than destructured: a destructuring for-of makes an iterator per item, every frame
  for (let i = 0; i < items.length; i++) {
    const it = items[i],
      kind = it[1],
      o = it[2];
    setK(it[3]);
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
    else if (kind === 14) drawXSign(o);
    else if (kind === 17) drawFieldGate(o);
    else if (kind === 7) drawAnimal(o);
    else if (kind === 16)
      drawWeatherBand(o); // 15 and 16 belong to weather.js (weatherItems)
    else if (kind === 15) drawFogSlice(o);
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
    // insects are tiny living specks, not tokens: a dark body and a blur of wing, and in the sun a
    // wing catches the light for a blink - the whole cloud glitters when the sun is low behind it.
    // Their shadows flicker on the ground below, which ties a cloud to the land it hangs over.
    const sunK = (1 - LIGHT.night) * (1 - LIGHT.rain * 0.7),
      gold = LIGHT.glow,
      glintA = sunK * (0.55 + 0.45 * gold),
      glintC = gold > 0.3 ? '255,226,160' : '255,250,232',
      // zoomed out, a speck must still be a pixel or so on screen, and the cloud's haze carries it
      px = 1 / cam.z,
      mb = Math.max(1.4, 2.1 * px),
      ms = Math.max(1.1, 1.7 * px),
      hazeA = clamp(0.1 + (1 - cam.z) * 0.12, 0.1, 0.18),
      // against sun-lit land the cloud shimmers pale; at dusk and in the dark it is a smoky grey
      hazeC = sunK > 0.4 ? '250,244,214' : '58,60,50';
    for (const s of swarms) {
      if (!visU(s.x, s.y, 60, s.z * HZ + 40)) continue;
      if (!s.moth && LIGHT.shadowA > 0.05) {
        ctx.fillStyle = `rgba(18,24,15,${0.28 * LIGHT.shadowA})`;
        for (const m of s.m) {
          const [mx, my, mz] = motePos(s, m);
          const sh = clamp(1 - mz / 6, 0.45, 0.85);
          ctx.beginPath();
          ctx.ellipse(mx + mz * SX, (my + mz * SY) * TILT, 3.8 * sh, 1.8 * sh, 0, 0, TAU);
          ctx.fill();
        }
      }
      if (!s.moth) {
        // many tiny wings together make a faint smudge in the air, shaped by where the flies are. Each fly
        // gives a soft round puff that thins to nothing, so the cloud has no edge to read as an outline.
        const hz = softPuff(hazeC);
        ctx.globalAlpha = hazeA * 1.5;
        for (const m of s.m) {
          const [mx, my, mz] = motePos(s, m);
          ctx.drawImage(hz, mx - 15, PY(my, mz) - 18, 30, 36);
        }
        if (sunK > 0.4) {
          // in sunshine a dancing column of midges lights up like a puff of bright air: backlit wings seen
          // together from well off, which is how a hungry flock (and the player) spots one across a meadow
          const gl = softPuff(glintC);
          ctx.globalAlpha = 0.07 * ((sunK - 0.4) / 0.6);
          for (const m of s.m) {
            const [mx, my, mz] = motePos(s, m);
            ctx.drawImage(gl, mx - 24, PY(my, mz) - 29, 48, 58);
          }
        }
        ctx.globalAlpha = 1;
        // in the dark, at dusk, in rain and under the canopy dark specks vanish into the ground, so the
        // cloud takes on a faint warm shimmer of its own, like pollen in a sunbeam: gentle, never neon
        if (!(s.fqT > T)) {
          s.fqT = T + 0.25 + Math.random() * 0.1;
          s.fqTo = smooth(0.42, 0.66, forestness(s.x, s.y));
        }
        s.fq = (s.fq || 0) + ((s.fqTo || 0) - (s.fq || 0)) * 0.08;
        const dim = clamp(Math.max(LIGHT.night, s.fq * 0.75, LIGHT.rain * 0.4) * (1 - LIGHT.glow * 0.3), 0, 1);
        if (dim > 0.05) {
          const sh = softPuff('255,232,168'),
            ao = ctx.globalCompositeOperation;
          ctx.globalCompositeOperation = 'lighter';
          for (const m of s.m) {
            const [mx, my, mz] = motePos(s, m),
              py = PY(my, mz),
              tw = 0.7 + 0.3 * Math.sin(T * 2.1 + m.ph * 5);
            ctx.globalAlpha = 0.17 * dim * tw;
            ctx.drawImage(sh, mx - 13, py - 16, 26, 32);
            const g = Math.max(0, Math.sin(T * 4.3 + m.ph * 9)) ** 4;
            if (g > 0.05) {
              ctx.globalAlpha = 0.6 * dim * g;
              ctx.fillStyle = '#FFF0C0';
              ctx.fillRect(mx + Math.sin(T * 5 + m.ph) * 5 - 0.8, py + Math.cos(T * 4 + m.ph) * 6 - 0.8, 1.6, 1.6);
            }
          }
          ctx.globalCompositeOperation = ao;
          ctx.globalAlpha = 1;
        }
      }
      for (const m of s.m) {
        const [mx, my, mz] = motePos(s, m);
        const py = PY(my, mz);
        if (m.kind === 'moth') {
          // pale wings beating fast, warm where the lamp lights them
          const w = 1 + Math.abs(Math.sin(T * 34 + m.ph)) * 2.4;
          ctx.fillStyle = 'rgba(246,236,210,.9)';
          ctx.beginPath();
          ctx.ellipse(mx - w * 0.55, py, w * 0.6, 1.6, -0.3, 0, TAU);
          ctx.ellipse(mx + w * 0.55, py, w * 0.6, 1.6, 0.3, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#5C4E3C';
          ctx.fillRect(mx - 0.6, py - 1.3, 1.2, 2.6);
          continue;
        }
        const fly = m.kind === 'fly';
        if (fly) {
          // a hoverfly: a banded body in a blur of wing
          const wb = Math.sin(T * 70 + m.ph);
          ctx.fillStyle = 'rgba(228,232,222,.45)';
          ctx.fillRect(mx - 2.6, py - 0.9 + wb * 0.5, 2.2, 1.1);
          ctx.fillRect(mx + 0.4, py - 0.9 - wb * 0.5, 2.2, 1.1);
          ctx.fillStyle = '#3A2E14';
          ctx.fillRect(mx - 0.9, py - 1.1, 1.8, 2.4);
          ctx.fillStyle = '#C99A2E';
          ctx.fillRect(mx - 0.9, py - 0.2, 1.8, 0.6);
        } else {
          // each midge the flock can catch is a knot of several, buzzing round one another
          ctx.fillStyle = 'rgba(30,27,22,.85)';
          ctx.fillRect(mx - mb / 2, py - mb / 2, mb, mb);
          for (let j = 1; j < 7; j++) {
            const q = m.ph * j;
            const sx = mx + Math.sin(T * (6 + j * 1.7) + q) * 7 + Math.sin(T * 13.1 + q * 3) * 1.5,
              sy = py + Math.cos(T * (4.3 + j) + q * 2) * 9 + Math.sin(T * 17 + q) * 1.5;
            ctx.fillRect(sx - ms / 2, sy - ms / 2, ms, ms);
          }
        }
        if (glintA > 0.02) {
          // now and then a wing flashes in the sun
          const g = Math.max(0, Math.sin(T * (fly ? 3 : 5.5) + m.ph * 7)) ** 3 * glintA;
          if (g > 0.03) {
            ctx.fillStyle = `rgba(${glintC},${g})`;
            ctx.fillRect(mx - mb, py - mb, mb * 1.7, mb * 1.7);
          }
        }
      }
    }
    for (const f of dflies) {
      if (!visU(f.x, f.y, 20, f.z * HZ + 10)) continue;
      const shadowX = f.x + f.z * SX,
        shadowY = (f.y + f.z * SY) * TILT,
        shadowPulse = 0.85 + Math.sin(T * 7 + f.h) * 0.15;
      ctx.fillStyle = `rgba(20,35,25,${0.3 * LIGHT.shadowA})`;
      ctx.beginPath();
      ctx.ellipse(shadowX, shadowY, 7 * shadowPulse, 2.4 * shadowPulse, f.h, 0, 0, TAU);
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
      // eased in and out, so a wisp neither pops into being nor blinks away
      const q = p.life / p.max,
        fin = Math.min(1, (p.max - p.life) * 5),
        al = p.a * fin * fin * (3 - 2 * fin) * q * q;
      if (al < 0.004) continue;
      const R = p.r * 1.8;
      ctx.globalAlpha = al;
      ctx.drawImage(SMOKE_SPR, p.x - R, PY(p.y, p.z) - R, R * 2, R * 2);
    }
    ctx.globalAlpha = 1;
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
  // birds sheltering in a tree are drawn among the leaves and vanish behind them; a faint warm glow and a
  // pale glint over the canopy keep each findable. It is light on the bird, not a UI ring: it breathes slowly
  // and every bird keeps its own phase
  for (const [b, k] of shelt) {
    setK(k);
    const s = b.s * 0.95,
      X = b.x + b.hx,
      Y = PY(b.y + b.hy, b.z) - s * 0.5,
      br = 0.5 + 0.5 * Math.sin(T * 1.6 + b.hx * 0.7 + b.hy * 0.3);
    ctx.globalAlpha = 0.34 + 0.18 * br;
    ctx.drawImage(HALO_GOLD, X - s * 2, Y - s * 2, s * 4, s * 4);
    ctx.globalAlpha = 0.5 + 0.2 * br;
    ctx.fillStyle = 'rgba(255,240,200,1)';
    ctx.beginPath();
    ctx.arc(X, Y, Math.max(0.9, s * 0.16), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  air.sort((a, b) => a[0].y - b[0].y);
  flightDraw(air, setK); // the flock's pool of light over forest, under the birds themselves
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
        // a catch is a soft puff of light widening and thinning out, not a hard drawn ring; dimmer in the dark
        ctx.globalAlpha = 1;
        const r = Math.max(1, (1 - a) * 14 + 3),
          gr = ctx.createRadialGradient(p.x, Y, r * 0.35, p.x, Y, r);
        gr.addColorStop(0, p.col + '00');
        gr.addColorStop(0.7, p.col + hex2(0.3 * a * (1 - LIGHT.night * 0.5)));
        gr.addColorStop(1, p.col + '00');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, Y, r, 0, TAU);
        ctx.fill();
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
        // a warm pulse of light on the marked bird, not a UI reticle drawn over it
        const pulse = 0.6 + 0.4 * Math.sin(T * 6),
          k = (h.state === 'dive' ? 1 : 0.55) * pulse,
          r = 16 + Math.sin(T * 6) * 2,
          gr = ctx.createRadialGradient(X, Y, 0, X, Y, r);
        gr.addColorStop(0, `rgba(229,87,63,${0.5 * k})`);
        gr.addColorStop(0.6, `rgba(229,87,63,${0.22 * k})`);
        gr.addColorStop(1, 'rgba(229,87,63,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(X, Y, r, 0, TAU);
        ctx.fill();
      }
    }
  }
  V = V0;
  setK(0);
  // a dash leaves soft light streaks trailing every flier, fading as the burst ends
  if (st.dashT > 0 && st.mode === 'play') {
    const f = clamp(st.dashT / 0.6, 0, 1),
      sp = Math.hypot(L.vx, L.vy) || 1,
      ux = L.vx / sp,
      uy = L.vy / sp;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,246,222,${0.85 * f})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (const b of birds) {
      if (b.state !== 'fly') continue;
      const X = b.x + b.hx,
        Y = PY(b.y + b.hy, b.z),
        len = 34 + 26 * f;
      ctx.moveTo(X, Y);
      ctx.lineTo(X - ux * len, Y - uy * len * TILT);
    }
    ctx.stroke();
  }
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
  drawFog();
  applyLight(tx, ty, KS, inK);
  V = V0;
  drawSkyBehind(tx, ty);
  applyGlaze();
  drawRays();
  drawRain(lastDt);
  /* ---- screen space ---- */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const haze = ctx.createLinearGradient(0, 0, 0, vh * 0.45);
  // a misty morning softens the distance too
  haze.addColorStop(0, LIGHT.skyBot + (LIGHT.night > 0.5 ? '18' : hex2(0.23 + 0.3 * AIR.mist)));
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
    // in fog or a blizzard you get far less warning
    if (dist > 1600 * seeK() || h.state === 'carry' || h.state === 'leave') continue;
    const a = Math.atan2(sy2 - vh / 2, sx2 - vw / 2);
    const m = 34;
    const ex2 = clamp(vw / 2 + Math.cos(a) * vw, m, vw - m),
      ey2 = clamp(vh / 2 + Math.sin(a) * vh, m + 60, vh - m);
    ctx.save();
    ctx.translate(ex2, ey2);
    ctx.rotate(a);
    // a gentle throb so the arrow reads as a signal; a little larger until the dash has been taught
    const throb = (1 + 0.12 * Math.sin(T * 5)) * (LEARN.dash ? 1 : 1.25);
    ctx.scale(throb, throb);
    ctx.globalAlpha = clamp(1.4 - dist / (1600 * seeK()), 0.45, 1);
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
