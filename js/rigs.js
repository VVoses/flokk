/* Flokk - rigs.js
   Animal drawing: shared 3D flier rig and articulated ground-animal rigs.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- 3D birds in flight: one rig shared by sparrows, gulls, geese, corvids, herons and the wild flocks ---------- */
const LOOK = {
  sparrow: {
    K: 8.5,
    wing: [
      [0.16, 0.1],
      [0.2, 0.4],
      [0.1, 0.72],
      [-0.04, 0.94],
      [-0.12, 0.98],
      [-0.2, 0.95],
      [-0.27, 0.84],
      [-0.3, 0.6],
      [-0.26, 0.34],
      [-0.2, 0.1]
    ],
    top: '#6E543A',
    under: '#D2C1A4',
    tip: '#3A2B1E',
    tipF: 0.72,
    body: '#7A6048',
    belly: '#CDBDA2',
    head: '#665A4E',
    headR: 0.18,
    beak: '#C9A040',
    beakL: 0.1,
    tail: [0.55, 0.16],
    tailCol: '#4E3C2B',
    amp: 0.75
  },
  gull: {
    K: 8.5,
    wing: [
      [0.16, 0.08],
      [0.2, 0.5],
      [0.1, 0.95],
      [-0.02, 1.35],
      [-0.12, 1.6],
      [-0.2, 1.62],
      [-0.24, 1.45],
      [-0.26, 1],
      [-0.24, 0.5],
      [-0.2, 0.1]
    ],
    top: '#AEB7BE',
    under: '#F4F5F5',
    tip: '#1C1C1E',
    tipF: 0.78,
    body: '#F6F6F4',
    belly: '#FFFFFF',
    head: '#FFFFFF',
    headR: 0.12,
    beak: '#E8C240',
    beakL: 0.16,
    tail: [0.42, 0.2],
    tailCol: '#F6F6F4',
    amp: 0.5,
    dih: 0.1
  },
  goose: {
    K: 11,
    wing: [
      [0.16, 0.1],
      [0.2, 0.45],
      [0.1, 0.85],
      [-0.04, 1.2],
      [-0.14, 1.3],
      [-0.22, 1.22],
      [-0.28, 1],
      [-0.3, 0.6],
      [-0.26, 0.3],
      [-0.2, 0.1]
    ],
    top: '#7E7366',
    under: '#A89E90',
    tip: '#3E3830',
    tipF: 0.72,
    body: '#8C8172',
    belly: '#C9C0B2',
    head: '#6E655A',
    headR: 0.1,
    beak: '#E08A3A',
    beakL: 0.16,
    tail: [0.36, 0.18],
    tailCol: '#5A5248',
    neck: 0.55,
    amp: 0.5
  },
  rook: {
    K: 8.5,
    wing: [
      [0.16, 0.1],
      [0.2, 0.45],
      [0.1, 0.8],
      [-0.02, 1.1],
      [-0.08, 1.02],
      [-0.13, 1.16],
      [-0.18, 1.04],
      [-0.23, 1.13],
      [-0.28, 0.98],
      [-0.32, 0.7],
      [-0.27, 0.36],
      [-0.2, 0.1]
    ],
    top: '#1C1C22',
    under: '#2A2A30',
    tip: '#101014',
    tipF: 0.8,
    body: '#18181C',
    belly: '#222226',
    head: '#18181C',
    headR: 0.15,
    beak: '#6A6A6E',
    beakL: 0.2,
    tail: [0.6, 0.2],
    tailCol: '#141418',
    amp: 0.6
  },
  crow: {
    K: 7.5,
    wing: [
      [0.16, 0.1],
      [0.2, 0.45],
      [0.1, 0.8],
      [-0.02, 1.1],
      [-0.08, 1.02],
      [-0.13, 1.16],
      [-0.18, 1.04],
      [-0.23, 1.13],
      [-0.28, 0.98],
      [-0.32, 0.7],
      [-0.27, 0.36],
      [-0.2, 0.1]
    ],
    top: '#1E1E22',
    under: '#2C2C30',
    tip: '#121216',
    tipF: 0.8,
    body: '#8E8E8B',
    belly: '#A2A29E',
    head: '#1A1A1C',
    headR: 0.16,
    beak: '#1A1A1C',
    beakL: 0.18,
    tail: [0.55, 0.18],
    tailCol: '#1A1A1C',
    amp: 0.6
  },
  magpie: {
    K: 7,
    wing: [
      [0.16, 0.1],
      [0.2, 0.42],
      [0.1, 0.72],
      [-0.04, 0.92],
      [-0.14, 0.96],
      [-0.24, 0.88],
      [-0.3, 0.66],
      [-0.28, 0.36],
      [-0.2, 0.1]
    ],
    top: '#1C2838',
    under: '#2A3040',
    tip: '#F2F2EE',
    tipF: 0.62,
    body: '#141418',
    belly: '#F4F2EC',
    head: '#121216',
    headR: 0.15,
    beak: '#111114',
    beakL: 0.14,
    tail: [1.15, 0.13],
    tailCol: '#1E3A4A',
    amp: 0.75
  },
  heron: {
    K: 15,
    wing: [
      [0.16, 0.12],
      [0.2, 0.5],
      [0.12, 0.95],
      [-0.02, 1.25],
      [-0.1, 1.18],
      [-0.16, 1.3],
      [-0.22, 1.2],
      [-0.28, 1.28],
      [-0.34, 1.1],
      [-0.38, 0.8],
      [-0.34, 0.4],
      [-0.26, 0.12]
    ],
    top: '#8A9198',
    under: '#B9BFC4',
    tip: '#2E3238',
    tipF: 0.7,
    body: '#9AA0A6',
    belly: '#D8DBDD',
    head: '#E4E6E8',
    headR: 0.11,
    beak: '#D9B84A',
    beakL: 0.3,
    tail: [0.3, 0.14],
    tailCol: '#8A9198',
    tuck: true,
    legs: true,
    amp: 0.6,
    dih: -0.06
  }
};
const angDiff = (a, b) => ((((a - b + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
function flyGeom(o, look, K) {
  const T3 = mkRot3(o.bank, o.pitch, o.psi, K);
  const span = 1 - 0.45 * o.fold,
    dih = o.dih ?? look.dih ?? 0.05;
  const wing = sg =>
    look.wing.map(([f, s2]) =>
      T3(f - o.fold * 0.5 * s2, sg * s2 * span, dih * s2 + o.beat * Math.pow(s2, 1.2) * (1 - o.fold))
    );
  const tl = look.tail[0],
    tw = look.tail[1] * (1 + (o.fan || 0));
  const tail = [
    [-0.26, -0.08],
    [-0.26 - tl * 0.85, -tw],
    [-0.26 - tl, -tw * 0.4],
    [-0.26 - tl * 1.02, 0],
    [-0.26 - tl, tw * 0.4],
    [-0.26 - tl * 0.85, tw],
    [-0.26, 0.08]
  ].map(([f, s2]) => T3(f, s2, 0.02));
  return { T3, wL: wing(-1), wR: wing(1), tail };
}
function drawFly3(X, Y, o, look, K) {
  const g = flyGeom(o, look, K),
    n = look.wing.length;
  const P = p => [X + p[0], Y + p[1] * TILT - p[2]];
  const path = pts => tracePath(pts, P);
  let maxS = 0;
  for (const w of look.wing) maxS = Math.max(maxS, w[1]);
  const tipIdx = look.wing.map((w, i) => (w[1] > look.tipF * maxS ? i : -1)).filter(i => i >= 0);
  const wingN = (p, sg) => crossNormal(p[0], p[(n / 2) | 0], p[n - 3], sg);
  const drawWing = (pts, sg) => {
    let nv = wingN(pts, sg);
    const top = dot3(nv, HVIEW) >= 0;
    if (!top) nv = nv.map(x => -x);
    const lit = clamp(0.62 + 0.55 * dot3(nv, HLIGHT), 0.5, 1.2);
    path(pts);
    ctx.fillStyle = shade(top ? look.top : look.under, lit);
    ctx.fill();
    if (tipIdx.length > 1) {
      const a = tipIdx[0],
        b = tipIdx[tipIdx.length - 1];
      path([
        mix3(pts[Math.max(0, a - 1)], pts[a], 0.5),
        ...pts.slice(a, b + 1),
        mix3(pts[b], pts[Math.min(n - 1, b + 1)], 0.5)
      ]);
      ctx.fillStyle = shade(look.tip, top ? lit : lit * 0.9);
      ctx.fill();
    }
  };
  const drawTail = () => {
    path(g.tail);
    ctx.fillStyle = shade(look.tailCol, 0.95);
    ctx.fill();
  };
  const drawBody = () => {
    const nose = P(g.T3(0.34, 0, 0.02)),
      rump = P(g.T3(-0.3, 0, 0)),
      mx = (nose[0] + rump[0]) / 2,
      my = (nose[1] + rump[1]) / 2,
      len = Math.hypot(nose[0] - rump[0], nose[1] - rump[1]),
      ang = Math.atan2(nose[1] - rump[1], nose[0] - rump[0]);
    const bw = K * 0.17;
    ctx.fillStyle = look.body;
    ctx.beginPath();
    ctx.ellipse(mx, my, Math.max(len / 2, bw), bw, ang, 0, TAU);
    ctx.fill();
    ctx.fillStyle = look.belly;
    ctx.globalAlpha *= 0.6;
    ctx.beginPath();
    ctx.ellipse(mx, my + bw * 0.35, Math.max(len / 2, bw) * 0.7, bw * 0.45, ang, 0, TAU);
    ctx.fill();
    ctx.globalAlpha /= 0.6;
    if (look.legs) {
      ctx.strokeStyle = '#4E4A44';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const sg of [-0.04, 0.04]) {
        const a = P(g.T3(-0.26, sg, 0)),
          b = P(g.T3(-1.1, sg, -0.02));
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    let hp = look.tuck ? g.T3(0.3, 0, 0.1) : look.neck ? g.T3(0.3 + look.neck, 0, 0.04) : g.T3(0.36, 0, 0.04);
    if (look.neck) {
      const a = P(g.T3(0.28, 0, 0.02)),
        b = P(hp);
      ctx.strokeStyle = look.head;
      ctx.lineWidth = K * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    const hd = P(hp),
      bf = look.tuck ? 0.3 : look.neck ? 0.3 + look.neck : 0.36;
    const bk = P(g.T3(bf + look.beakL + look.headR, 0, 0.03));
    ctx.fillStyle = look.head;
    ctx.beginPath();
    ctx.arc(hd[0], hd[1], K * look.headR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = look.beak;
    ctx.lineWidth = Math.max(1, K * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hd[0] + (bk[0] - hd[0]) * 0.35, hd[1] + (bk[1] - hd[1]) * 0.35);
    ctx.lineTo(bk[0], bk[1]);
    ctx.stroke();
  };
  const parts = [
    { d: depthOf(g.wL), f: () => drawWing(g.wL, -1) },
    { d: depthOf(g.wR), f: () => drawWing(g.wR, 1) },
    { d: depthOf(g.tail) - K * 0.2, f: drawTail },
    { d: 0, f: drawBody }
  ];
  parts.sort((a, b) => a.d - b.d);
  for (const p of parts) p.f();
}
function shadowFly3(c, x, y, zpx, o, look, K) {
  const g = flyGeom(o, look, K);
  const G = p => {
    const H2 = (zpx + p[2]) / HZ;
    return [x + p[0] + H2 * SX, y + p[1] + H2 * SY];
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
  const a = G(g.T3(0.4, 0, 0)),
    b = G(g.T3(-0.3, 0, 0));
  c.lineCap = 'round';
  c.lineWidth = K * 0.3;
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
}
function birdPose(b) {
  const land = b.state === 'land',
    fl = b.flapping || land || b.panic > 0;
  return {
    psi: b.heading,
    bank: b.bank || 0,
    pitch: b.pitch || 0,
    beat: fl ? Math.sin(b.flap) * LOOK.sparrow.amp : 0,
    fold: b.fold || 0,
    fan: land ? 1 : 0
  };
}
function skyPose(a, look) {
  let on = true;
  if (a.k === 'gull') on = Math.sin(a.anim * 0.5 + a.ph) > 0;
  else if (look.bound) on = Math.sin(a.anim * look.bound + a.ph) > -0.3; // bursts of wingbeats, then a dip
  return {
    psi: a.hd,
    bank: a.bank || 0,
    pitch: a.pitch || 0,
    beat: on ? Math.sin(a.flap) * look.amp : 0.05,
    fold: 0,
    fan: Math.min(1, Math.abs(a.turn || 0) * 0.6)
  };
}
// a faint pale aura keeps the flock readable over forest, fields and yards
const HALO = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'),
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,250,232,1)');
  gr.addColorStop(0.45, 'rgba(255,250,232,.45)');
  gr.addColorStop(1, 'rgba(255,250,232,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
})();
// the same aura, warmed to gold, so the leader the camera follows reads as sunlit rather than
// picked out by a UI ring
const HALO_GOLD = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'),
    gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,224,140,1)');
  gr.addColorStop(0.45, 'rgba(255,224,140,.5)');
  gr.addColorStop(1, 'rgba(255,224,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
})();
function drawFlyer(b) {
  const K = b.s * (0.95 + 0.04 * b.z),
    X = b.x,
    Y = PY(b.y, b.z);
  // over canopy the shader pool of light (flocklight.js) marks the flock; without WebGL2 each bird's aura swells instead
  const fq = FLIGHT.on ? 0 : flyerForest(b);
  ctx.globalAlpha = 0.035 + 0.015 * LIGHT.night + 0.015 * fq * (1 - 0.35 * LIGHT.night);
  const hr = K * (1.05 + 0.045 * fq);
  ctx.drawImage(HALO, X - hr, Y - hr, hr * 2, hr * 2);
  ctx.globalAlpha = 1;
  if (b === L) {
    ctx.globalAlpha = 0.11 + 0.03 * Math.sin(T * 2) + 0.01 * fq;
    ctx.drawImage(HALO_GOLD, X - K * 1.3, Y - K * 1.3, K * 2.6, K * 2.6);
    ctx.globalAlpha = 1;
  }
  const look = LOOK.sparrow;
  look.top = b.c1;
  look.body = b.c2;
  look.head = b.c3;
  look.tailCol = b.c1;
  drawFly3(X, Y, birdPose(b), look, K);
}
function drawButterfly(a) {
  const X = a.x,
    Y = PY(a.y, a.z),
    K = 4.2,
    ang = Math.sin(a.anim * 26) * 1.05 + 0.4,
    c = Math.cos(ang),
    s = Math.sin(ang),
    cy = Math.cos(a.hd),
    sy = Math.sin(a.hd);
  const P = (f, s2, u) => {
    const dx = f * cy - s2 * sy,
      dy = f * sy + s2 * cy;
    return [X + dx * K, Y + dy * K * TILT - u * K];
  };
  for (const sg of [-1, 1]) {
    for (const [w, dark] of [
      [
        [
          [0.05, 0.08],
          [0.6, 0.95],
          [0.15, 1.1],
          [-0.08, 0.35]
        ],
        0
      ],
      [
        [
          [0, 0.08],
          [-0.05, 0.85],
          [-0.55, 0.72],
          [-0.3, 0.1]
        ],
        1
      ]
    ]) {
      ctx.beginPath();
      w.forEach(([f, s2], i) => {
        const q = P(f, sg * s2 * c, s2 * s);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      });
      ctx.closePath();
      ctx.fillStyle = shade(a.col, dark ? 0.82 : s > 0 ? 1 : 0.9);
      ctx.fill();
    }
  }
  const h = P(0.35, 0, 0),
    t = P(-0.45, 0, 0);
  ctx.strokeStyle = '#2A2420';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  ctx.lineTo(t[0], t[1]);
  ctx.stroke();
}
function drawSkyAnimal(a) {
  ctx.globalAlpha = clamp(a.fade ?? 1, 0, 1);
  drawSkyAnimal2(a);
  ctx.globalAlpha = 1;
}
function drawSkyAnimal2(a) {
  if (a.k === 'butterfly') return drawButterfly(a);
  const look =
    LOOK[a.k] ||
    (a.k === 'duck'
      ? { ...LOOK.goose, K: 8.5, neck: 0.15, head: a.drake ? '#364C43' : '#736550', beak: '#AAA15C', amp: 0.8 }
      : null);
  if (!look) return;
  drawFly3(a.x, PY(a.y, a.z), skyPose(a, look), look, look.K * (0.95 + 0.03 * a.z));
}

/* ---------- ground animals ----------
   Four-legged animals and people are 3D figures (figure.js) built on the specs and IK here; the hare,
   corvids and heron are side-view rigs; ducks are 3D figures too. Gait phase comes from distance walked, so strides match
   speed. Heads ease between alert and grazing, ears flick, tails swish. */
function ik(hx, hy, fx, fy, l1, l2, bend) {
  let dx = fx - hx,
    dy = fy - hy,
    d = Math.hypot(dx, dy) || 0.001;
  const mx = l1 + l2 - 0.01;
  if (d > mx) {
    fx = hx + (dx / d) * mx;
    fy = hy + (dy / d) * mx;
    dx = fx - hx;
    dy = fy - hy;
    d = mx;
  }
  const a = Math.atan2(dy, dx),
    off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const k1 = [hx + Math.cos(a + off) * l1, hy + Math.sin(a + off) * l1],
    k2 = [hx + Math.cos(a - off) * l1, hy + Math.sin(a - off) * l1];
  return [(bend > 0 ? k1[0] >= k2[0] : k1[0] < k2[0]) ? k1 : k2, [fx, fy]];
}
const QSPEC = {
  sheep: {
    L: 9,
    H: 5.2,
    hip: 7.4,
    lw: 1.7,
    leg: '#2E2A26',
    neckL: 3.5,
    neckW: 4.6,
    neckUp: 0.55,
    hRx: 3.6,
    hRy: 2.5,
    head: '#3A3531',
    stride: 8,
    lift: 2.2,
    tail: 'wool',
    wool: true,
    ear: '#3A3531'
  },
  pig: {
    L: 8.2,
    H: 4.6,
    hip: 5.8,
    lw: 2,
    neckL: 2.1,
    neckW: 5.2,
    neckUp: 0.12,
    hRx: 3.1,
    hRy: 2.7,
    stride: 7,
    lift: 1.6,
    tail: 'curl',
    ear: '#D9A290'
  },
  cow: {
    L: 15,
    H: 7.2,
    hip: 11,
    lw: 2.8,
    neckL: 5.5,
    neckW: 7,
    neckUp: 0.3,
    hRx: 5.3,
    hRy: 3.3,
    stride: 12,
    lift: 3,
    tail: 'rope',
    horns: true
  },
  deer: {
    L: 9,
    H: 4.3,
    hip: 11.5,
    lw: 1.5,
    leg: '#5E3F28',
    neckL: 8.5,
    neckW: 3.2,
    neckUp: 1.1,
    hRx: 3.4,
    hRy: 2.1,
    stride: 11,
    lift: 4,
    tail: 'flag',
    bigEars: true
  },
  moose: {
    L: 16,
    H: 8,
    hip: 20,
    lw: 3.1,
    leg: '#9A8E80',
    neckL: 9.5,
    neckW: 7.5,
    neckUp: 0.3,
    hRx: 7,
    hRy: 3.6,
    stride: 17,
    lift: 5,
    tail: 'stub',
    hump: true
  },
  dog: {
    L: 8.2,
    H: 3.7,
    hip: 7.6,
    lw: 1.6,
    neckL: 3.4,
    neckW: 3.4,
    neckUp: 0.75,
    hRx: 3.4,
    hRy: 2.3,
    stride: 8,
    lift: 2.4,
    tail: 'dog',
    ear: '#1A1818'
  },
  cat: {
    L: 6.2,
    H: 2.6,
    hip: 5,
    lw: 1.3,
    neckL: 2.2,
    neckW: 3,
    neckUp: 0.8,
    hRx: 2.8,
    hRy: 2.5,
    stride: 6,
    lift: 1.6,
    tail: 'cat',
    catEars: true
  },
  fox: {
    L: 8.2,
    H: 2.65,
    hip: 6.2,
    lw: 1.05,
    leg: '#241512',
    neckL: 2.6,
    neckW: 2.9,
    neckUp: 0.7,
    hRx: 2.9,
    hRy: 2.2,
    stride: 8,
    lift: 2,
    tail: 'brush',
    catEars: true,
    ear: '#2E1710'
  }
};
function animalColors(a) {
  switch (a.k) {
    case 'sheep':
      return { body: '#ECE8DE', shade: '#CFC8B8' };
    case 'pig':
      return { body: '#E7B6A8', shade: '#C88E80' };
    case 'cow':
      return a.red ? { body: '#8A3A22', shade: '#6E2C18' } : { body: '#2E2A28', shade: '#1E1A18' };
    case 'deer':
      return SEASON === 3 ? { body: '#76685A', shade: '#5C5046' } : { body: '#8E5C36', shade: '#6E4428' };
    case 'moose':
      return { body: '#3E2E24', shade: '#2B2019' };
    case 'dog':
      return a.collie ? { body: '#1E1C1C', shade: '#141212' } : { body: '#8A5A34', shade: '#6A4426' };
    case 'cat':
      return a.ginger ? { body: '#C8793A', shade: '#A55F2A' } : { body: '#6B6560', shade: '#524D48' };
    case 'fox':
      return { body: '#A56D43', shade: '#704A32' };
  }
}
function drawHare(a) {
  const C = SEASON === 3 ? ['#EEF0F2', '#D2D8DE'] : ['#8C7A60', '#6E5E48'],
    run = a.st === 'walk' || a.st === 'flee';
  const ph = a.gp || 0,
    air = run ? Math.max(0, Math.sin(ph)) : 0,
    stretch = run ? 0.5 + 0.5 * Math.cos(ph) : 0;
  const y0 = -4 - air * (a.st === 'flee' ? 8 : 5),
    rot = run ? lerp(-0.25, 0.2, stretch) : -0.12;
  ctx.save();
  ctx.translate(0, y0);
  ctx.rotate(rot);
  ctx.strokeStyle = C[1];
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-3, 1.5);
  ctx.lineTo(-3 - stretch * 6, 3 + (run ? 0 : 1));
  ctx.stroke();
  ell(0, 0, 5.6 + stretch * 1.4, 3.8 - stretch * 0.5, C[0]);
  ell(-5, -0.4, 1.6, 1.6, '#F2EEE6');
  ctx.strokeStyle = C[1];
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(3.5, 2);
  ctx.lineTo(4.5 + stretch * 4, 3.8 - air * 2);
  ctx.stroke();
  ell(5, -2.4, 2.7, 2.3, C[0]);
  ctx.fillStyle = '#1A1A18';
  ctx.fillRect(5.6, -3, 0.9, 0.9);
  const ea = run ? -0.9 : -0.2 + (a.earF > 0 ? Math.sin(a.earF * 30) * 0.3 : 0);
  ctx.save();
  ctx.translate(4.2, -4);
  ctx.rotate(ea);
  ctx.fillStyle = C[0];
  ctx.beginPath();
  ctx.ellipse(-0.6, -3.4, 0.9, 3.4, -0.1, 0, TAU);
  ctx.ellipse(0.8, -3.2, 0.9, 3.2, 0.15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2A2420';
  ctx.fillRect(-1.1, -6.6, 1, 1);
  ctx.restore();
  ctx.restore();
}
function drawCorvid(a) {
  const mag = a.k === 'magpie',
    walk = a.st === 'walk',
    ph = a.gp || 0;
  const hop = walk && mag ? Math.abs(Math.sin(ph)) * 2.5 : 0,
    step = walk && !mag ? Math.sin(ph) : 0;
  const pk = (a.ht || 0) * 3;
  ctx.save();
  ctx.translate(0, -hop);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-0.2, -3);
  ctx.lineTo(-0.6 + step * 1.5, 0);
  ctx.moveTo(1.2, -3);
  ctx.lineTo(1.4 - step * 1.5, 0);
  ctx.stroke();
  const flick = a.flk > 0 ? Math.sin(a.flk * 25) * 0.35 : 0;
  ctx.save();
  ctx.translate(-3.5, -5);
  ctx.rotate(0.15 + flick);
  ctx.fillStyle = mag ? '#1E3A4A' : '#161616';
  ctx.fillRect(-(mag ? 9 : 5), -1, mag ? 9 : 5, 2.1);
  ctx.restore();
  ctx.save();
  ctx.translate(0, -5);
  ctx.rotate(-0.25 + pk * 0.12);
  ell(0, 0, 5.2, 3.2, mag ? '#161616' : '#8C8C88');
  if (mag) {
    ell(1, 1, 3, 1.6, '#F4F2EC');
    ell(-1.8, -0.9, 2.3, 1, '#F4F2EC');
  }
  ell(-1, -0.6, 3.8, 2.3, mag ? '#1C2838' : '#1A1A1C');
  ctx.restore();
  const hx = 4.2,
    hy = -7.4 + pk;
  ell(hx, hy, 2.3, 2.1, mag ? '#121216' : '#1A1A1C');
  ctx.strokeStyle = '#1A1A1A';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(hx + 1.6, hy + 0.1);
  ctx.lineTo(hx + 4, hy + 0.9 + pk * 0.2);
  ctx.stroke();
  ctx.fillStyle = '#E8E8E0';
  ctx.fillRect(hx + 0.4, hy - 0.9, 0.7, 0.7);
  ctx.restore();
}
/* a swimming duck, as a 3D figure floating at its waterline (u = 0). Whatever rides the water can nudge it
   with two optional fields set by the wave code: a.wpitch tips the bow up and a.wroll heels it over. The swell's
   lift and drift are applied to the whole canvas in drawAnimal before this runs, so the waterline rides along.
   Dabbling dips the head; diving stands it on its head with only the tail showing. */
function drawDuck(a) {
  const drake = !!a.drake,
    up = a.st === 'dive',
    wp = a.wpitch || 0,
    wr = a.wroll || 0,
    bodyHex = drake ? '#A6A59C' : '#86694A',
    breastHex = drake ? '#7A3E26' : '#76593E',
    headHex = drake ? '#1F5A3A' : '#6E5638',
    beakHex = drake ? '#D8C040' : '#C88A40',
    dive = up ? 1.1 : 0,
    // the duck rocks with the water, and (rarely) dips its head to dabble
    rock = Math.sin(T * 1.6 + a.ph) * 0.03 + wp,
    dab = up ? 0 : clamp((Math.sin(T * 0.5 + a.ph * 3) - 0.6) * 3, 0, 1),
    look = Math.sin(T * 0.37 + a.ph * 5) > 0.7 ? 1 : 0;
  figBegin(a.hd3 ?? (a.f > 0 ? 0 : Math.PI));
  const cp = Math.cos(rock - dive),
    sp = Math.sin(rock - dive);
  // a point in the duck's own frame, tipped by its pitch and heel and lifted by the swell
  const at = (f, r, u) => [
    f * cp - u * sp,
    r + wr * u * 0.5,
    f * sp + u * cp - dive * 3.5 + 0.4 * Math.sin(T * 2 + a.ph)
  ];
  const body = at(0, 0, 1.2 - dive * 0.6),
    pb = rock - dive;
  // tail
  part(dep3(...at(-6.4, 0, 2.6)), () => {
    const t = at(-6.6, 0, 2.7);
    ellDraw(ello(...t, 2.6, 1.3, 1.1, pb + 0.35), drake ? '#1C1C1C' : '#5E4A34');
    if (drake) {
      const c = at(-8.4, 0, 3.8);
      ellDraw(ello(...c, 1.2, 0.7, 1.2, pb + 0.9), '#1C1C1C');
    }
  });
  // body, breast and folded wings
  part(dep3(...body), () => ellDraw(ello(...body, 6.8, 3.8, 3.3, pb), bodyHex));
  part(dep3(...at(4, 0, 2.4)) + 0.01, () => {
    const c = at(4, 0, 2.6);
    ellDraw(ello(...c, 3.3, 3.3, 3, pb), breastHex);
  });
  for (const sd of [-1, 1])
    part(dep3(...at(-1, sd * 3, 3)) + 0.02, () => {
      const c = at(-1.4, sd * 3, 3);
      ellDraw(ello(...c, 4.6, 1.1, 2, pb + 0.1), drake ? '#8E8D84' : '#6A5238', sideK(sd) * 0.95);
      if (!drake) return;
      const sp2 = at(-2.6, sd * 3.8, 3.1);
      ellDraw(ello(...sp2, 1.6, 0.4, 0.9, pb), '#4E5A70', sideK(sd), null, true);
    });
  if (!drake)
    part(dep3(...at(-1, 0, 5)) + 0.02, () => {
      // the hen's flecks along her back
      for (let i = 0; i < 6; i++) {
        const p = P2(...at(-5 + i * 1.9, ((i * 7) % 3) - 1, 4.9 - Math.abs(i - 2.5) * 0.25));
        dot(p, 0.55, 'rgba(60,42,26,.6)');
      }
    });
  if (!up) {
    // neck, head and bill, with the head dipping forward when it dabbles
    const hu = 7.6 - dab * 3.8,
      hf = 5.8 + dab * 2.6,
      hr = look * 0.9,
      neck = at((4.6 + hf) / 2, hr * 0.5, (4.6 + hu) / 2),
      hd = at(hf, hr, hu);
    part(dep3(...neck) + 0.01, () => {
      ellDraw(ello(...neck, 1.9, 1.9, 2.6 + dab * 0.8, pb - dab * 0.7), drake ? '#1F5A3A' : '#7D6446');
      if (drake) ellDraw(ello(...at(4.8, 0, 5), 2, 2, 0.5, pb), '#F2F0E8');
    });
    part(dep3(...hd) + 0.02, () => {
      const head = ello(...hd, 2.6, 2.3, 2.3, pb - dab * 0.4);
      ellDraw(head, headHex);
      const bill = ello(...at(hf + 2.8, hr, hu - 0.4 - dab * 0.4), 2.1, 1.1, 0.7, pb - dab * 0.5);
      ellDraw(bill, beakHex);
      for (const sd of [-1, 1]) {
        const e = ellPt(head, 0.55, sd * 0.8, 0.4);
        if (e[2]) dot([e[0], e[1]], 0.55, '#111');
      }
    });
  }
  // everything below the waterline stays hidden: clip to just under it
  ctx.save();
  ctx.beginPath();
  // (the waterline is a ring on the ground, so it dips lower in front of a body turned toward you)
  const near = Math.hypot(6.2 * FIG.s, 3.5 * FIG.c) * TILT;
  ctx.rect(-22, -34, 44, 34 + 0.6 + near);
  ctx.clip();
  figEnd();
  ctx.restore();
  ctx.strokeStyle = 'rgba(225,238,238,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0.5, up ? 4 : 8, 1.6 + Math.abs(wr) * 0.4, 0, 0, TAU);
  ctx.stroke();
}
function drawHeron(a) {
  const strike = a.st === 'strike',
    k = strike ? Math.sin(clamp(1 - a.t / 0.7, 0, 1) * Math.PI) : 0,
    sway = Math.sin(T * 0.7 + a.ph) * 0.8,
    hunch = Math.sin(T * 0.13 + a.ph) > 0.5 ? 1 : 0;
  ctx.strokeStyle = '#6E6A62';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-1, -17);
  ctx.lineTo(-1.4, 0);
  ctx.moveTo(2, -17);
  ctx.lineTo(2.2, 0);
  ctx.stroke();
  ell(0, -21, 8, 5.2, '#8E959C', -0.45);
  ell(-2.5, -20, 6.5, 3.5, '#6F767D', -0.45);
  ctx.fillStyle = '#3A3F45';
  ctx.beginPath();
  ctx.moveTo(-6, -18.5);
  ctx.lineTo(-10, -16);
  ctx.lineTo(-5, -17.2);
  ctx.fill();
  const nb = [4, -23.5],
    hx = lerp(lerp(6, 4, hunch) + sway, 15, k),
    hy = lerp(lerp(-35, -29, hunch), -12, k);
  ctx.strokeStyle = '#DDE0E3';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(nb[0], nb[1]);
  ctx.bezierCurveTo(nb[0] + 6 - k * 2, nb[1] - 3, hx - 4 + k * 4, hy + 5 - k * 2, hx, hy);
  ctx.stroke();
  ell(hx, hy, 2.4, 2, '#E4E6E8');
  ctx.strokeStyle = '#1E1E1E';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(hx - 0.5, hy - 1);
  ctx.lineTo(hx - 5, hy - 0.4);
  ctx.stroke();
  const ba = lerp(0, 0.95, k);
  ctx.strokeStyle = '#D9B84A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hx + 1.5, hy);
  ctx.lineTo(hx + 1.5 + Math.cos(ba) * 6, hy + Math.sin(ba) * 6);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.fillRect(hx + 0.2, hy - 0.9, 0.8, 0.8);
}
function drawAnimal(a) {
  if (a.k === 'tractor') {
    drawTractor(a);
    return;
  }
  ctx.save();
  ctx.globalAlpha = clamp(a.fade ?? 1, 0, 1);
  ctx.translate(a.x, PY(a.y, a.z + (a.k === 'human' && !a.ice ? jettyLift(a.x, a.y) : 0)));
  // a duck on the water rides it: lifted and carried by the waves, with the pitch (nose up or down along its heading)
  // and roll (lean to the side) of the surface left in a.wpitch / a.wroll for whatever draws it
  if (a.k === 'duck' && a.st !== 'dive') {
    const w = waveAt(a.x, a.y),
      hd = a.hd3 ?? (a.f > 0 ? 0 : Math.PI),
      al = w.gx * Math.cos(hd) + w.gy * Math.sin(hd),
      ac = w.gy * Math.cos(hd) - w.gx * Math.sin(hd);
    ctx.translate(w.dx * 1.6, w.dy * 1.1 - w.h * 0.8);
    a.wpitch = -clamp(al * 0.9, -0.3, 0.3);
    a.wroll = clamp(ac * 0.9, -0.3, 0.3);
  } else if (a.k === 'duck') a.wpitch = a.wroll = 0;
  if (a.k === 'cat') ctx.scale(0.76, 0.76);
  else if (a.k === 'dog') ctx.scale(0.82, 0.82);
  else if (a.k === 'fox') ctx.scale(0.82, 0.82);
  if (a.lamb) {
    ctx.scale(0.62, 0.62);
    if (a.frolic > 0) ctx.translate(0, -Math.abs(Math.sin(a.frolic * 9)) * 6);
  }
  // four-legged animals and people are 3D figures (figure.js); the smaller side-view rigs are drawn
  // on a card that turns with the animal's heading, narrowing as it faces toward or away from you
  if (QSPEC[a.k]) {
    if (a.k === 'cat' && a.st === 'idle') drawCatSit(a);
    else drawQuad(a);
  } else if (a.k === 'human') drawHuman(a);
  else if (a.k === 'duck') drawDuck(a);
  else {
    const hd = a.hd3 ?? (a.f > 0 ? 0 : Math.PI),
      c = Math.cos(hd);
    ctx.transform(Math.sign(c || 1) * Math.max(0.42, Math.abs(c)), Math.sin(hd) * TILT * 0.5, 0, 1, 0, 0);
    if (a.k === 'hare') drawHare(a);
    else if (a.k === 'crow' || a.k === 'magpie') drawCorvid(a);
    else if (a.k === 'heron') drawHeron(a);
    else if (a.wild) drawWildBird(a);
  }
  ctx.restore();
}
// the field tractor is built from the same projected boxes as the road traffic (traffic.js): a cab
// over the back axle, a bonnet out front, big rear and small front wheels and a harrow dragged behind.
// It turns round at the end of each row instead of flipping, and the wheels roll as it drives.
function drawTractor(a) {
  ctx.save();
  ctx.globalAlpha = clamp(a.fade ?? 1, 0, 1);
  const still = LIGHT.night > 0.4,
    o = { x: a.x, y: a.y, ang: a.ang ?? (a.f > 0 ? 0 : Math.PI) },
    cs = Math.cos(o.ang),
    sn = Math.sin(o.ang),
    near = cs >= 0 ? 1 : -1, // which side of the tractor faces the camera
    rot = still ? 0 : a.anim * 3,
    col = '#B5301F';
  // harrow first: it sits behind and below everything else
  const hb = { x: a.x - cs * 22, y: a.y - sn * 22, ang: o.ang };
  vBox(hb, -5, 5, 9, 0, 0.07, '#5E4A34');
  const PH = vBox(hb, -1, 1, 9, 0.07, 0.11, '#4A3A28');
  for (let i = -3; i <= 3; i++) {
    const t = PH(0, i * 2.8, 0.07),
      b2 = PH(-1.5, i * 2.8, 0);
    ctx.strokeStyle = '#2E2820';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(t[0], t[1]);
    ctx.lineTo(b2[0], b2[1]);
    ctx.stroke();
  }
  const P0 = (lx, ly, h) => [o.x + lx * cs - ly * sn, (o.y + lx * sn + ly * cs) * TILT - h * HZ];
  const hitch = [P0(-12, 0, 0.12), P0(-17, 0, 0.1)];
  ctx.strokeStyle = '#2A2826';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hitch[0][0], hitch[0][1]);
  ctx.lineTo(hitch[1][0], hitch[1][1]);
  ctx.stroke();
  // wheels: a tyre is a disc in the tractor's side plane, so it narrows as the tractor turns toward you
  const tyre = (lx, ly, r, w) => {
    const sq = Math.max(0.18, Math.abs(cs)),
      c1 = P0(lx, ly, r / HZ),
      c2 = P0(lx, ly + Math.sign(ly) * w, r / HZ),
      front = ly * near > 0; // the outer face is the one nearer the camera
    const [cb, c] = front ? [c1, c2] : [c2, c1];
    for (const [q, f] of [
      [cb, '#141210'],
      [c, '#1C1A18']
    ]) {
      ctx.fillStyle = f;
      ctx.beginPath();
      ctx.ellipse(q[0], q[1], r * sq, r, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#C9B24A';
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], r * 0.45 * sq, r * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8A7A30';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const an = rot * (8 / r) + (i * Math.PI) / 2;
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[0] + Math.cos(an) * r * 0.45 * sq * near, c[1] + Math.sin(an) * r * 0.45);
    }
    ctx.stroke();
  };
  tyre(-6, -near * 8, 8, 3);
  tyre(11, -near * 6, 5, 2);
  // the body shakes with the engine
  if (!still) ctx.translate(0, Math.sin(T * 40) * 0.3);
  vBox(o, -12, 17, 5, 0.1, 0.18, '#3A3430'); // chassis
  vBox(o, -1, 17, 4, 0.18, 0.36, col); // bonnet
  vBox(o, 16, 17.5, 4.2, 0.2, 0.34, '#2A2826'); // grille
  vBox(o, -13, -1, 6, 0.18, 0.4, col); // cab body
  vBox(o, -12.5, -1.5, 5.8, 0.4, 0.66, col, true); // cab glass
  vBox(o, -14, 0, 6.8, 0.66, 0.72, '#3A3632'); // roof
  vBox(o, -8, -4, 8.5, 0.28, 0.32, '#8E2416'); // mudguards
  const eb = P0(9, -near * 2, 0.36),
    ex = P0(9, -near * 2, 0.56);
  ctx.strokeStyle = '#2A2826';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(eb[0], eb[1]);
  ctx.lineTo(ex[0], ex[1]);
  ctx.stroke();
  tyre(-6, near * 8, 8, 3);
  tyre(11, near * 6, 5, 2);
  ctx.restore();
}
/* per-frame animation state for every animal: gait phase from distance walked, facing turns,
   head easing, ear flicks; attitude (bank, pitch) for the fliers */
function animalPost(dt) {
  for (const a of ANIMALS) {
    if (isSky(a)) {
      const d = angDiff(a.hd, a.phd ?? a.hd);
      a.phd = a.hd;
      a.turn = lerp(a.turn || 0, d / Math.max(dt, 1e-3), Math.min(1, dt * 4));
      const sp = Math.hypot(a.vx, a.vy);
      a.bank = lerp(a.bank || 0, clamp((a.turn * sp) / 220, -1, 1), Math.min(1, dt * 3));
      const vz = (a.z - (a.pz ?? a.z)) / Math.max(dt, 1e-3);
      a.pz = a.z;
      a.pitch = lerp(a.pitch || 0, clamp(-vz * 0.4, -0.5, 0.5), Math.min(1, dt * 4));
      continue;
    }
    const sp = MOVES.has(a.st) ? Math.hypot(a.vx, a.vy) : 0;
    const S = QSPEC[a.k],
      strideLen =
        S && BOUNDS.has(a.st)
          ? runStride(S, sp)
          : (S ? S.stride : a.k === 'hare' ? 14 : a.k === 'human' ? 10 : a.k === 'crow' || a.k === 'magpie' ? 5 : 8) *
            (BOUNDS.has(a.st) ? 1.5 : 1);
    a.strd = strideLen;
    a.gp = (a.gp || 0) + ((sp * dt) / strideLen) * TAU;
    a.fs = (a.fs ?? a.f) + (a.f - (a.fs ?? a.f)) * Math.min(1, dt * 7);
    figPost(a, sp, dt);
    a.ht = (a.ht || 0) + ((a.graze ? 1 : 0) - (a.ht || 0)) * Math.min(1, dt * 2.2);
    a.earT = (a.earT ?? rr(1, 5)) - dt;
    if (a.earT <= 0) {
      a.earT = rr(1.5, 6);
      a.earF = 0.35;
    }
    if (a.earF > 0) a.earF -= dt;
    if (a.k === 'cow') {
      a.swat = (a.swat || 0) - dt;
      if (a.swat < -rr(3, 8)) a.swat = 0.5;
    }
    if (a.k === 'crow' || a.k === 'magpie') {
      a.flk = (a.flk || 0) - dt;
      if (a.flk < -rr(2, 6)) a.flk = 0.3;
    }
    if (a.lamb) {
      a.frolic = (a.frolic || 0) - dt;
      if (a.frolic < -rr(3, 9)) a.frolic = 0.7;
    }
    if (a.st === 'flee' || a.st === 'walk') a.alert = 0;
    else a.alert = (a.alert || 0) - dt;
  }
}
const isSky = a =>
  a.migrating ||
  a.k === 'gull' ||
  a.k === 'goose' ||
  a.k === 'rook' ||
  a.k === 'butterfly' ||
  (a.wild && a.st === 'fly') ||
  ((a.k === 'heron' || a.k === 'crow' || a.k === 'magpie') &&
    (a.st === 'fly' || a.st === 'mob' || a.st === 'mobret')) ||
  ((a.k === 'crow' || a.k === 'magpie') && a.st === 'roost' && !a.hide);
// states in which a ground animal is moving, and the fast ones drawn with a bounding gait
const MOVES = new Set(['walk', 'flee', 'stalk', 'pounce', 'chase']),
  BOUNDS = new Set(['flee', 'pounce', 'chase']);
