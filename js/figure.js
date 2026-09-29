/* Flokk - figure.js
   Everything that walks, drawn as a small 3D figure: bodies, heads and limbs are ellipsoids and capsules
   placed in the figure's own frame (forward, right, up), turned to its heading and projected like the
   rest of the world (ground depth squashed by TILT, height straight up), then lit from the sun's side
   with soft gradients. Parts are painter-sorted by how far toward the viewer they sit, so a sheep
   walking toward you shows its face and front legs, and one walking away shows its rump.
   Legs are planted: each foot stays put on the ground while the body passes over it, then lifts and
   swings forward, so strides match speed and nothing skates.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';

/* ---------- the kit: a figure frame, ellipsoids, limbs ---------- */
const FIG = { c: 1, s: 0, L: [0, 0, 1], hx: 0, hy: -1, parts: [] };
function figBegin(hd) {
  FIG.c = Math.cos(hd);
  FIG.s = Math.sin(hd);
  FIG.parts.length = 0;
  // sunlight comes from opposite the shadows, fairly high, so the tops of things catch it
  const sl = Math.hypot(SX, SY) || 1,
    L = [(-SX / sl) * 0.6, (-SY / sl) * 0.6, 0.8],
    l = Math.hypot(...L);
  FIG.L = L.map(v => v / l);
  // the same light as seen on screen, for the highlight along each limb
  const hx = FIG.L[0],
    hy = FIG.L[1] * TILT - FIG.L[2],
    hl = Math.hypot(hx, hy) || 1;
  FIG.hx = hx / hl;
  FIG.hy = hy / hl;
}
// a vector in the figure's frame (forward, right, up) in world axes (east, south, up), and on screen
const W3 = (f, r, u) => [f * FIG.c - r * FIG.s, f * FIG.s + r * FIG.c, u];
const S2 = v => [v[0], v[1] * TILT - v[2]];
const P2 = (f, r, u) => S2(W3(f, r, u));
// how far toward the viewer a point sits: ground depth first, height only to break ties
const dep3 = (f, r, u) => f * FIG.s + r * FIG.c + u * 0.02;
function part(d, fn) {
  FIG.parts.push([d, fn]);
}
function figEnd() {
  FIG.parts.sort((a, b) => a[0] - b[0]);
  for (const p of FIG.parts) p[1]();
  FIG.parts.length = 0;
}
function tone(hex, f) {
  return shade(hex, clamp(f, 0, 1.9));
}
// an ellipsoid at (f,r,u) with radii (rf,rr,ru), pitched nose-up by p. Its outline on screen is the
// image of a unit circle under E (the symmetric square root of the projected axes' spread).
function ello(f, r, u, rf, rr, ru, p = 0) {
  const cp = Math.cos(p),
    sp = Math.sin(p),
    F = W3(cp * rf, 0, sp * rf),
    R = W3(0, rr, 0),
    U = W3(-sp * ru, 0, cp * ru);
  let sxx = 0,
    sxy = 0,
    syy = 0;
  for (const v of [F, R, U]) {
    const q = S2(v);
    sxx += q[0] * q[0];
    sxy += q[0] * q[1];
    syy += q[1] * q[1];
  }
  const sd = Math.sqrt(Math.max(1e-9, sxx * syy - sxy * sxy)),
    t = Math.sqrt(sxx + syy + 2 * sd);
  return { c: P2(f, r, u), F, R, U, rf, rr, ru, E: [(sxx + sd) / t, sxy / t, (syy + sd) / t], d: dep3(f, r, u) };
}
// the point of the surface in direction (x,y,z) of its own axes: [screen x, screen y, faces the viewer, light]
function ellPt(o, x, y, z) {
  const w = [0, 1, 2].map(i => o.F[i] * x + o.R[i] * y + o.U[i] * z),
    n = [0, 1, 2].map(i => (o.F[i] * x) / o.rf ** 2 + (o.R[i] * y) / o.rr ** 2 + (o.U[i] * z) / o.ru ** 2),
    nl = Math.hypot(...n) || 1,
    s = S2(w);
  return [
    o.c[0] + s[0],
    o.c[1] + s[1],
    n[1] + n[2] * TILT > 0,
    (n[0] * FIG.L[0] + n[1] * FIG.L[1] + n[2] * FIG.L[2]) / nl
  ];
}
// fill it: lit toward the sun, rolling off into shade at the far rim. marks() draws inside its outline.
function ellDraw(o, hex, k = 1, marks = null, flat = false) {
  const [e0, e1, e2] = o.E;
  ctx.save();
  ctx.transform(e0, e1, e1, e2, o.c[0], o.c[1]);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  if (flat) ctx.fillStyle = tone(hex, k);
  else {
    const L = FIG.L,
      q = [o.F, o.R, o.U].map(v => v[0] * L[0] + v[1] * L[1] + v[2] * L[2]),
      ql = Math.hypot(...q) || 1,
      hs = S2([0, 1, 2].map(i => (o.F[i] * q[0] + o.R[i] * q[1] + o.U[i] * q[2]) / ql)),
      det = e0 * e2 - e1 * e1 || 1e-6,
      hx = (e2 * hs[0] - e1 * hs[1]) / det,
      hy = (-e1 * hs[0] + e0 * hs[1]) / det;
    const g = ctx.createRadialGradient(hx * 0.5, hy * 0.5, 0, hx * 0.1, hy * 0.1, 1.08);
    g.addColorStop(0, tone(hex, k * 1.2));
    g.addColorStop(0.5, tone(hex, k));
    g.addColorStop(1, tone(hex, k * 0.6));
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (marks) {
    ctx.clip();
    const det = e0 * e2 - e1 * e1 || 1e-6;
    ctx.transform(e2 / det, -e1 / det, -e1 / det, e0 / det, 0, 0);
    ctx.translate(-o.c[0], -o.c[1]);
    marks();
  }
  ctx.restore();
}
// a round-ended limb between two screen points, with a thin highlight along its sunny side
function limb(a, b, w, hex, k = 1) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = tone(hex, k);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  if (w < 1.2) return;
  const ox = FIG.hx * w * 0.24,
    oy = FIG.hy * w * 0.24;
  ctx.strokeStyle = tone(hex, k * 1.22);
  ctx.lineWidth = w * 0.36;
  ctx.beginPath();
  ctx.moveTo(a[0] + ox, a[1] + oy);
  ctx.lineTo(b[0] + ox, b[1] + oy);
  ctx.stroke();
}
function curve(pts, w, hex, k = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = tone(hex, k);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  else for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
}
function dot(p, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, TAU);
  ctx.fill();
}
// how a side of the figure (+1 right, -1 left) faces: 1 toward the viewer, darker turned away
const sideK = sd => (sd * FIG.c > 0.15 ? 1 : sd * FIG.c < -0.15 ? 0.74 : 0.86);

/* ---------- walking: planted feet ----------
   p is where a foot is in its cycle (0..1). For the first beta of it the foot is on the ground and slides
   back under the body by e, which is exactly how far the body moves in that time; for the rest it lifts
   (second value, 0..1) and swings forward again. */
function footAt(p, beta, e) {
  if (p < beta) return [e / 2 - (e * p) / beta, 0];
  const t = (p - beta) / (1 - beta);
  return [-e / 2 + e * t * t * (3 - 2 * t), Math.sin(Math.PI * t)];
}
const frac = x => x - Math.floor(x);
/* running: a bound's stride grows with speed at a steady beat (bigger animals beat slower), instead of
   the legs spinning faster and faster. Each foot only stays down for as far as a leg can reach, so at
   speed most of the cycle is spent in the air. */
const runStride = (S, sp) => Math.max(S.stride * 1.5, sp / (2.6 * Math.sqrt(11 / S.hip)));
/* per-frame state for a figure (called from animalPost): which way it faces, turned smoothly, and how
   much it is walking (legs settle rather than snap when it stops) */
function figPost(a, sp, dt) {
  if (sp > 1) a.hdT = a.moveHeading ?? Math.atan2(a.vy, a.vx);
  else if (a.lee !== undefined)
    a.hdT = a.lee; // standing with its back to a hard wind (weather.js)
  else if (a.pose || a.role === 'fisher') a.hdT = a.f > 0 ? 0.35 : Math.PI - 0.35;
  else if (a.hdT === undefined) a.hdT = a.f > 0 ? 0.3 : Math.PI - 0.3;
  // standing still and turning to face the other way: mirror, keeping the same angle to the viewer
  else if (Math.cos(a.hdT) * a.f < -0.05) a.hdT = Math.PI - a.hdT;
  if (sp > 1 && a.moveHeading !== undefined) a.hd3 = a.moveHeading;
  a.hd3 = a.hd3 === undefined ? a.hdT : a.hd3 + angDiff(a.hdT, a.hd3) * Math.min(1, dt * (sp > 40 ? 9 : 5));
  a.gw = (a.gw || 0) + ((sp > 1 ? 1 : 0) - (a.gw || 0)) * Math.min(1, dt * 6);
}

/* ---------- four-legged animals ---------- */
const QWIDE = { sheep: 0.95, pig: 0.85, cow: 0.72, deer: 0.6, moose: 0.66, dog: 0.62, cat: 0.62, fox: 0.6 };
// [front (1) or hind (-1), side, phase]: a walk puts each foot down in turn, a bound pairs them
const GAIT = {
  walk: [
    [-1, -1, 0],
    [1, -1, 0.25],
    [-1, 1, 0.5],
    [1, 1, 0.75]
  ],
  bound: [
    [-1, -1, 0.5],
    [1, -1, 0],
    [-1, 1, 0.58],
    [1, 1, 0.08]
  ]
};
// wool tufts spread over the top of a sheep, as directions on its body
const WOOL = (() => {
  const out = [];
  for (let i = 0; i < 26; i++) {
    const z = 0.95 - (i / 25) * 1.25,
      rr = Math.sqrt(Math.max(0, 1 - z * z)),
      t = i * 2.39996;
    out.push([Math.cos(t) * rr, Math.sin(t) * rr, z]);
  }
  return out;
})();
function drawQuad(a) {
  const S = QSPEC[a.k],
    C = animalColors(a),
    walking = MOVES.has(a.st),
    bound = BOUNDS.has(a.st),
    crouch = a.st === 'stalk' ? 0.62 : 1,
    gw = a.gw || 0,
    wd = S.H * (QWIDE[a.k] || 0.7),
    legHex = S.leg || C.shade;
  figBegin(a.hd3 ?? (a.f > 0 ? 0 : Math.PI));
  // the gait
  const cyc = (a.gp || 0) / TAU,
    stride = bound ? a.strd || S.stride * 1.5 : S.stride,
    e = (bound ? Math.min(stride * 0.38, S.L * 1.05) : stride * 0.64) * gw,
    beta = bound ? Math.max(0.12, e / stride) : 0.64;
  // bounding: fore feet down together, then the hinds; in between, the body sails. It rises and falls
  // in an arc through each flight, nose up as the hinds push off and down as the fore feet reach to land.
  let bob = walking ? Math.abs(Math.sin(cyc * TAU * 2)) * 0.4 * gw : Math.sin(T * 1.7 + a.ph) * 0.2;
  if (bound) {
    bob = 0;
    for (const [a0, a1] of [
      [0.08 + beta, 0.5],
      [0.58 + beta, 1]
    ]) {
      const t = (frac(cyc) - a0) / (a1 - a0);
      if (t > 0 && t < 1) bob = 4 * t * (1 - t) * S.hip * 0.3 * gw;
    }
  }
  const pitch = bound ? Math.cos(TAU * (cyc - 0.58 - beta)) * 0.13 * gw : 0,
    bodyU = S.hip * crouch + bob,
    hipU = bodyU - S.H * 0.45,
    seg = (S.hip - S.H * 0.45) * 0.53;
  for (const [fr, sd, off] of bound ? GAIT.bound : GAIT.walk) {
    const p = frac(cyc + off);
    let [df, lf] = footAt(p, beta, e);
    // in the air a running leg folds up and back, then reaches forward to land
    if (bound && p >= beta) df -= Math.sin(TAU * ((p - beta) / (1 - beta))) * S.L * 0.3 * gw;
    const fH = fr > 0 ? S.L * 0.6 : -S.L * 0.62,
      rH = sd * wd * 0.55,
      uH = hipU + Math.sin(pitch) * fH,
      lift = lf * S.lift * (bound ? 1.4 : 1) * gw;
    // two bones solved in the leg's own plane (forward, down), as in a side view
    const [kn, ft] = ik(fH, -uH, fH + df, -lift, seg, seg, fr > 0 ? 1 : -1);
    part(dep3(fH, rH, 0), () => {
      const k = sideK(sd),
        h = P2(fH, rH, uH),
        kp = P2(kn[0], rH, -kn[1]),
        fp = P2(ft[0], rH * 0.92, -ft[1]);
      limb(h, kp, S.lw * 1.3, legHex, k);
      limb(kp, fp, S.lw, legHex, k);
      ellDraw(
        ello(ft[0] + 0.4, rH * 0.92, -ft[1] + S.lw * 0.3, S.lw * 0.8, S.lw * 0.7, S.lw * 0.45),
        legHex,
        k * 0.55,
        null,
        true
      );
    });
  }
  // tail, behind the rump
  const tf = -S.L * 0.95,
    tu = bodyU + S.H * 0.35 - Math.sin(pitch) * S.L * 0.95;
  part(dep3(tf - 1, 0, tu), () => {
    const sw = Math.sin(T * 1.2 + a.ph);
    if (S.tail === 'rope') {
      const swing = sw * 1.6 + (a.swat > 0 ? Math.sin(a.swat * 18) * 3 : 0),
        end = P2(tf - 1.2, swing, bodyU - S.H * 1.35);
      curve([P2(tf, 0, tu), P2(tf - 1.6, swing * 0.3, bodyU - S.H * 0.4), end], 1.3, C.body, 0.9);
      ellDraw(ello(tf - 1.2, swing, bodyU - S.H * 1.45, 1.1, 1.1, 1.8), C.shade, 0.8);
    } else if (S.tail === 'cat') {
      curve([P2(tf, 0, tu), P2(tf - 5, sw * 1.5, tu + 1), P2(tf - 3, sw * 3, tu + 10)], 1.6, C.body);
    } else if (S.tail === 'dog') {
      const wag = Math.sin(T * (a.st === 'idle' ? 5 : 10) + a.ph) * 2.4;
      curve([P2(tf, 0, tu), P2(tf - 4, wag * 0.4, tu + 2), P2(tf - 5, wag, tu + 7)], 1.8, C.body);
      if (a.collie) dot(P2(tf - 5, wag, tu + 7), 1.1, '#F2EEE6');
    } else if (S.tail === 'brush') {
      const s2 = (bound ? 0 : sw * 1.4) - (walking ? stride * 0.06 : 0),
        tip = [tf - 6.5 + (bound ? -2.5 : 0), s2, tu - 2.4 + (bound ? 2 : 0)];
      ellDraw(ello(tf - 3.5, s2 * 0.4, tu - 1, 4.8, 1.65, 1.8, 0.15), C.body);
      ellDraw(ello(tip[0] - 0.5, tip[1], tip[2], 2, 1.05, 1.1, 0.15), '#D8D1BE');
    } else if (S.tail === 'curl') {
      const c0 = P2(tf, 0, tu);
      ctx.strokeStyle = tone(C.body, 0.9);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(c0[0] - 1.2 * FIG.c, c0[1] - 1.2, 1.3, 0, TAU * 0.85);
      ctx.stroke();
    } else if (S.tail === 'wool') {
      ellDraw(ello(tf - 1, 0, bodyU + 0.5 + Math.sin(T * 6 + a.ph) * 0.3, 1.8, 1.7, 2.3), C.body);
    }
  });
  // body, with its markings laid on the surface so they turn with it
  const body = ello(0, 0, bodyU, S.L, wd, S.H, pitch);
  part(body.d, () => {
    const marks = [];
    if (a.k === 'cow') {
      for (let i = 0; i < 5; i++) {
        const u = hash2(i, (a.ph * 977) | 0),
          v = hash2((a.ph * 31) | 0, i + 3),
          an = u * TAU;
        marks.push([Math.cos(an) * 0.8, Math.sin(an) * 0.8, v - 0.3, 2.6 + v * 2.4, '#F1ECE2']);
      }
      for (const x of [-0.5, 0, 0.5]) marks.push([x, 0, -0.95, 4, '#F1ECE2']);
    }
    if (a.k === 'fox') marks.push([0.75, 0, -0.55, 3.2, '#F4EFE2']);
    if (a.k === 'dog' && a.collie) marks.push([0.85, 0, -0.3, 2.6, '#F2EEE6']);
    if (a.k === 'deer') marks.push([0, 0, -0.9, 3.5, SEASON === 3 ? '#A89A88' : '#C8A080']);
    ellDraw(
      body,
      C.body,
      1,
      marks.length
        ? () => {
            for (const [x, y, z, r, col] of marks) {
              const q = ellPt(body, x, y, z);
              if (!q[2]) continue;
              dot(q, r, tone(col, 0.82 + 0.3 * Math.max(0, q[3])));
            }
          }
        : null
    );
    if (S.hump) ellDraw(ello(S.L * 0.4, 0, bodyU + S.H * 0.5, S.L * 0.42, wd * 0.8, S.H * 0.62, pitch - 0.15), C.body);
    if (S.wool) {
      // tufts on the visible side make a lumpy, woolly outline
      for (const [x, y, z] of WOOL) {
        const q = ellPt(body, x * 0.92, y * 0.92, z * 0.92);
        if (!q[2]) continue;
        dot(q, S.H * 0.36, tone(C.body, 0.8 + 0.28 * Math.max(-0.3, q[3])));
      }
    }
    if (S.tail === 'flag')
      ellDraw(
        ello(-S.L * 0.92, 0, bodyU - S.H * 0.05 + (bound ? 1.5 : 0), 1.4, 2.2 + (bound ? 1 : 0), 3 + (bound ? 1 : 0)),
        '#F2ECE0'
      );
  });
  // neck and head ease between alert and grazing; chewing nods while down
  const ht = a.ht || 0,
    ease = ht * ht * (3 - 2 * ht),
    bx = S.L * 0.72,
    bu = bodyU + S.H * 0.3 + Math.sin(pitch) * bx,
    // running, the neck reaches forward
    neckUp = S.neckUp * (bound ? 1 - 0.5 * gw : 1),
    ux = bx + Math.cos(neckUp) * S.neckL,
    uu = bu + Math.sin(neckUp) * S.neckL,
    gx = S.L * 0.95 + S.hRx * 0.4,
    gu = S.hRy * 0.9 - (ht > 0.9 ? Math.sin(T * 5 + a.ph) * 0.4 : 0),
    nx = lerp(ux, gx, ease),
    nu = lerp(uu, gu, ease) + Math.sin(ease * Math.PI) * S.neckL * 0.25 + (a.alert > 0 && ht < 0.2 ? 1.2 : 0),
    ha = lerp(0.3, 1.35, ease);
  // a point in the head's own frame (along the face, down it, out to the side)
  const H3 = (x, y, r) => [nx + x * Math.cos(ha) - y * Math.sin(ha), r, nu - x * Math.sin(ha) - y * Math.cos(ha)];
  const headCol = S.head || C.body,
    hc = H3(S.hRx * 0.45, 0, 0);
  part(dep3((bx + nx) / 2, 0, (bu + nu) / 2), () =>
    limb(P2(bx - S.neckW * 0.3, 0, bu - S.neckW * 0.2), P2(nx, 0, nu), S.neckW, C.body)
  );
  // ears and horns sit either side of the head, so each is sorted on its own
  for (const sd of [-1, 1]) {
    const flick = a.earF > 0 ? Math.sin(a.earF * 30) * 0.5 : 0;
    if (S.bigEars || S.catEars || S.ear) {
      const er = S.bigEars ? [1.4, 3.2] : S.catEars ? [1, 1.8] : [2.4, 1],
        droop = S.ear && !S.catEars ? -1.2 : 0,
        base = H3(-S.hRx * 0.3, -S.hRy * 0.7, sd * S.hRy * 0.55),
        up = er[1] * 0.6;
      part(dep3(...base), () =>
        ellDraw(
          ello(
            base[0] - flick,
            base[1] + sd * (droop ? er[0] * 0.6 : 0.3),
            base[2] + (droop ? droop * 0.6 : up),
            er[0],
            er[0] * 0.45,
            er[1],
            0.5 + flick
          ),
          S.ear || C.body,
          sideK(sd) * 0.9,
          null,
          true
        )
      );
    }
    if (S.horns)
      part(dep3(...H3(0, 0, sd * S.hRy * 0.5)), () =>
        curve(
          [
            P2(...H3(-S.hRx * 0.2, -S.hRy * 0.8, sd * S.hRy * 0.4)),
            P2(...H3(-S.hRx * 0.6, -S.hRy * 1.6, sd * S.hRy)),
            P2(...H3(-S.hRx * 0.1, -S.hRy * 2.1, sd * S.hRy * 1.2))
          ],
          1.2,
          '#E8E1CC'
        )
      );
    if (a.k === 'moose' && a.bull && SEASON !== 0) {
      const b0 = H3(-S.hRx * 0.4, -S.hRy * 1.4, sd * (S.hRy + 3.2));
      part(dep3(...b0), () => ellDraw(ello(b0[0], b0[1], b0[2], 3.4, 3.6, 1.3, 0.4), '#BCA98C', sideK(sd)));
    }
  }
  part(dep3(...hc) + 0.01, () => {
    const head = ello(...hc, S.hRx, S.hRy * 0.8, S.hRy, -ha);
    ellDraw(
      head,
      headCol,
      1,
      a.k === 'cow'
        ? () => {
            const q = ellPt(head, 0.8, 0, 0.35);
            if (q[2]) dot(q, S.hRy * 0.6, '#F1ECE2');
          }
        : null
    );
    // muzzle or snout at the front of the face
    const m = H3(S.hRx * 1.2, S.hRy * (a.k === 'pig' ? 0.25 : 0.2), 0);
    ellDraw(ello(...m, S.hRx * (a.k === 'fox' ? 0.72 : 0.36), S.hRy * (a.k === 'fox' ? 0.36 : 0.6), S.hRy * (a.k === 'fox' ? 0.4 : 0.62), -ha), a.k === 'fox' ? '#C8BA9B' : headCol, a.k === 'pig' ? 0.85 : 0.72);
    if (a.k === 'pig')
      for (const sd of [-1, 1]) {
        const q = P2(...H3(S.hRx * 1.52, S.hRy * 0.25, sd * 0.6));
        dot(q, 0.5, '#8A5A50');
      }
    // eyes, only on the side turned toward the viewer
    for (const sd of [-1, 1]) {
      const e3 = H3(S.hRx * 0.2, -S.hRy * 0.35, sd * S.hRy * 0.62);
      if (dep3(e3[0] - hc[0], e3[1], 0) > -0.3) dot(P2(...e3), Math.max(0.55, S.hRy * 0.2), '#111');
    }
    if (a.k === 'moose')
      limb(P2(...H3(S.hRx * 0.2, S.hRy * 0.8, 0)), P2(...H3(S.hRx * 0.1, S.hRy * 2.2, 0)), 2, C.body, 0.9);
  });
  figEnd();
}
// a cat sitting up: haunches down, front legs straight, tail wrapped round its feet
function drawCatSit(a) {
  const C = animalColors(a);
  figBegin(a.hd3 ?? (a.f > 0 ? 0.3 : Math.PI - 0.3));
  const sw = Math.sin(T * 1.2 + a.ph),
    tilt = Math.sin(T * 0.4 + a.ph) * 0.15;
  part(dep3(-2, 0, 0), () => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6,
        an = Math.PI * (1 + t * 0.9);
      pts.push(P2(Math.cos(an) * 4.6 - 0.5, Math.sin(an) * 3.5, 0.8 + (i === 6 ? sw : 0)));
    }
    curve(pts, 1.6, C.body);
  });
  part(dep3(-0.8, 0, 3), () => ellDraw(ello(-0.8, 0, 3, 3.4, 2.7, 2.9), C.body));
  for (const sd of [-1, 1])
    part(dep3(2, sd, 2), () => limb(P2(1.6, sd * 1, 5), P2(2.2, sd * 1, 0.4), 1.4, C.body, sideK(sd)));
  part(dep3(1, 0, 6), () => ellDraw(ello(1, 0, 6, 2.2, 2.3, 3.2, -0.5), C.body));
  const hc = [1.4, 0, 10.2];
  for (const sd of [-1, 1]) {
    const fl = a.earF > 0 && sd < 0 ? Math.sin(a.earF * 30) * 0.5 : 0;
    part(dep3(hc[0] - 0.5, sd * 1.4, hc[2]), () =>
      ellDraw(ello(hc[0] - 0.5, sd * 1.4, hc[2] + 2.2, 0.9, 0.5, 1.5, fl), C.body, sideK(sd) * 0.9, null, true)
    );
  }
  part(dep3(...hc) + 0.01, () => {
    const head = ello(...hc, 2.6, 2.4, 2.3, tilt);
    ellDraw(head, C.body);
    for (const sd of [-1, 1]) {
      const e3 = [hc[0] + 2, sd * 0.95, hc[2] + 0.4];
      if (dep3(2, sd * 0.95, 0) > -0.3) dot(P2(...e3), 0.5, '#2A2A20');
    }
  });
  figEnd();
}

/* ---------- people ---------- */
const HUMAN = { leg: 5.8, hip: 1.3, sh: 2.5, torso: 8.4, stride: 10 };
function drawHuman(a) {
  if ((a.fade ?? 1) <= 0.02) return;
  const P = a.pal,
    pose = a.pose,
    seated = pose === 'sit' || pose === 'stool',
    gw = seated ? 0 : a.gw || 0,
    stoop = pose === 'stoop' ? 1 : pose === 'shovel' ? 0.45 + 0.25 * Math.sin(T * 4) : pose === 'lean' ? 0.35 : 0,
    lean = stoop * 0.7 + 0.08 * gw;
  figBegin(a.hd3 ?? (a.f > 0 ? 0.3 : Math.PI - 0.3));
  if (pose === 'stool') {
    ctx.strokeStyle = '#5A4430';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [p, q] of [
      [P2(-1.5, -1.2, 7), P2(-1.5, -1.6, 0)],
      [P2(1.2, 1.2, 7), P2(1.5, 1.6, 0)],
      [P2(1.2, -1.2, 7), P2(1.5, -1.6, 0)]
    ]) {
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  }
  // legs: right foot first in the cycle, left half a cycle later
  const cyc = (a.gp || 0) / TAU,
    beta = 0.6,
    e = HUMAN.stride * beta * gw,
    L2 = HUMAN.leg * 2;
  const feet = [1, -1].map((sd, i) => {
    const [df, lf] = footAt(frac(cyc + i * 0.5), beta, e);
    return { sd, f: df + sd * 0.5 * (1 - gw), u: lf * 1.8 * gw };
  });
  // the pelvis rides up and over whichever foot is planted (a compass gait)
  let hipU = pose === 'sit' ? 1.5 : pose === 'stool' ? 7 : 11.45;
  if (!seated) for (const ft of feet) if (ft.u < 0.05) hipU = Math.min(hipU, Math.sqrt(L2 * L2 * 0.985 - ft.f * ft.f));
  for (const ft of feet) {
    const r = ft.sd * HUMAN.hip;
    let kn, fp;
    if (pose === 'sit') {
      kn = [5, hipU];
      fp = [5.5 + Math.sin(T * 1.3 + (ft.sd > 0 ? 0 : 1)) * 0.8, hipU - 5.5];
    } else if (pose === 'stool') {
      kn = [5, hipU - 0.5];
      fp = [5.5, 0];
    } else {
      const [k, f] = ik(0, -hipU, ft.f, -ft.u, HUMAN.leg, HUMAN.leg, 1);
      kn = [k[0], -k[1]];
      fp = [f[0], -f[1]];
    }
    part(dep3(Math.max(kn[0], fp[0]), r, 0) - 2.5, () => {
      const k = sideK(ft.sd);
      limb(P2(0, r, hipU), P2(kn[0], r, kn[1]), 2.5, P.legs, k);
      limb(P2(kn[0], r, kn[1]), P2(fp[0], r, fp[1]), 2.2, P.legs, k);
      ellDraw(ello(fp[0] + 0.6, r, fp[1] + 0.6, 1.5, 0.9, 0.7), '#2A2420', k, null, true);
    });
  }
  // torso leaning forward from the hips
  const sx = Math.sin(lean),
    cx = Math.cos(lean),
    at = t => [sx * t, hipU + cx * t],
    tc = at(4.4),
    sh = at(HUMAN.torso),
    torso = ello(tc[0], 0, tc[1], 1.9, 2.7, 4.9, -lean);
  if (P.pack) {
    const pk = at(5.2);
    part(dep3(pk[0] - 2.3 * cx, 0, pk[1]), () =>
      ellDraw(ello(pk[0] - 2.3 * cx, 0, pk[1] + 2.3 * sx, 1.3, 2.1, 3.4, -lean), P.pack)
    );
  }
  part(torso.d, () => {
    ellDraw(torso, P.coat);
    // collar and belt, as bands round the coat
    const b = ellPt(torso, 0, 0, -0.62);
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.beginPath();
    ctx.ellipse(b[0], b[1], Math.hypot(...S2(torso.R)) * 0.8, 0.9, 0, 0, TAU);
    ctx.fill();
  });
  // arms: angles from hanging straight down, forward positive (upper arm, forearm)
  const sw = clamp(-feet[0].f / Math.max(1.5, e / 2), -1, 1) * gw;
  let A = [0.4 * sw, 0.55 * sw + 0.25],
    B = [-0.4 * sw, -0.55 * sw + 0.25],
    inward = 0;
  if (pose === 'lean') ((A = [1.3, 1.6]), (B = [1.2, 1.5]), (inward = 1));
  else if (pose === 'shovel')
    ((A = [0.9 + 0.3 * Math.sin(T * 4), 1.4]), (B = [0.5 + 0.3 * Math.sin(T * 4), 0.9]), (inward = 1));
  else if (pose === 'stoop') ((A = [0.4, 0.2]), (B = [0.2, 0.1]));
  else if (seated) ((A = [1, 2.1]), (B = [0.9, 2]), (inward = 0.5));
  else if (a.carry === 'logs') ((A = [0.9, 2.2]), (B = [0.8, 2.1]), (inward = 1));
  else if (a.carry === 'bucket') A = [0.05, 0.05];
  const hands = {};
  for (const [sd, an] of [
    [1, A],
    [-1, B]
  ]) {
    const r0 = sd * HUMAN.sh,
      el = [sh[0] + Math.sin(an[0]) * 4.4, sh[1] - 0.8 - Math.cos(an[0]) * 4.4],
      hd = [el[0] + Math.sin(an[1]) * 4, el[1] - Math.cos(an[1]) * 4],
      r1 = sd * lerp(HUMAN.sh + 0.3, 1.2, inward),
      r2 = sd * lerp(HUMAN.sh + 0.1, 0.8, inward);
    hands[sd] = [hd[0], r2, hd[1]];
    part(dep3(Math.max(el[0], hd[0]) * 0.6, r0, 0) + (sd > 0 ? 0.3 : 0), () => {
      const k = sideK(sd);
      limb(P2(sh[0], r0, sh[1] - 0.8), P2(el[0], r1, el[1]), 2.1, P.coat, k * 0.94);
      limb(P2(el[0], r1, el[1]), P2(hd[0], r2, hd[1]), 1.9, P.coat, k * 0.94);
      dot(P2(hd[0], r2, hd[1]), 1, a.skin);
      if (sd > 0) carried(a, P2(hd[0], r2, hd[1]), hands, pose);
    });
  }
  // head: hair behind, face forward, a cap or knitted hat on top
  const hf = sh[0] + sx * 3.2 + 0.3,
    hu = sh[1] + 2.9;
  part(dep3(hf - 0.7, 0, hu), () => ellDraw(ello(hf - 0.7, 0, hu - 0.1, 2.2, 2.4, 2.4), a.hair || '#4A3A2A'));
  part(dep3(hf, 0, hu) + 0.01, () => {
    ellDraw(ello(hf, 0, hu, 2.5, 2.3, 2.6), a.skin);
    for (const sd of [-1, 1]) if (dep3(2, sd * 0.9, 0) > 0.4) dot(P2(hf + 2.05, sd * 0.9, hu + 0.3), 0.36, '#2A2420');
  });
  const hatCol = SEASON === 3 && !P.cap ? P.coat : P.hat;
  part(dep3(hf, 0, hu) + 0.02, () => {
    ellDraw(ello(hf - 0.2, 0, hu + 1.05, 2.7, 2.55, 1.75), hatCol);
    if (P.cap) ellDraw(ello(hf + 2.1, 0, hu + 0.75, 1.7, 1.9, 0.35), hatCol, 0.8);
    else if (SEASON === 3) ellDraw(ello(hf - 0.5, 0, hu + 3, 0.95, 0.95, 0.95), hatCol, 1.1);
  });
  figEnd();
}
// what the near hand holds
function carried(a, hn, hands, pose) {
  if (a.carry === 'bucket') {
    ctx.fillStyle = '#8A9298';
    ctx.beginPath();
    ctx.moveTo(hn[0] - 1.8, hn[1] + 0.6);
    ctx.lineTo(hn[0] + 1.8, hn[1] + 0.6);
    ctx.lineTo(hn[0] + 1.4, hn[1] + 4);
    ctx.lineTo(hn[0] - 1.4, hn[1] + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#B8C0C6';
    ctx.fillRect(hn[0] - 1.8, hn[1] + 0.4, 3.6, 0.7);
  } else if (a.carry === 'logs') {
    for (let i = 0; i < 3; i++) {
      const q = P2(hands[1][0] + 0.4, 0, hands[1][2] + 1 + i * 1.4);
      limb(
        [q[0] - 3.2 * FIG.s, q[1] - 3.2 * FIG.c * TILT],
        [q[0] + 3.2 * FIG.s, q[1] + 3.2 * FIG.c * TILT],
        1.4,
        '#8A6A48'
      );
    }
  } else if (pose === 'shovel') {
    const hf = P2(...hands[-1]),
      tipL = [hands[1][0] + 5, 0, 0],
      tip = P2(...tipL);
    ctx.strokeStyle = '#7A5A3A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hf[0], hf[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ellDraw(ello(tipL[0] + 1, 0, 0.6, 1.8, 1.3, 0.5), '#5A6066', 1, null, true);
  } else if (a.role === 'fisher') {
    // rod up and out over the water, line down to the float
    const tip = [
      hn[0] + a.f * (a.ice ? 5 : 14),
      hn[1] - (a.ice ? 3 : 11) + (a.catchT > 0 ? -3 : Math.sin(T * 1.7) * 0.6)
    ];
    ctx.strokeStyle = '#3A3028';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hn[0] - a.f, hn[1] + 1);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    const endX = a.f * (a.ice ? 7 : 30),
      endY = (a.ice ? 3 : 10) * TILT;
    ctx.strokeStyle = 'rgba(230,230,220,.55)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.quadraticCurveTo((tip[0] + endX) / 2, tip[1] + 6, endX, endY);
    ctx.stroke();
    if (!a.ice) {
      ctx.fillStyle = '#D8432E';
      ctx.fillRect(endX - 0.7, endY - 1, 1.4, 1.4);
    }
  }
}
