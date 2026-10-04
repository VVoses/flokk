/* Flokk - dock.js
   The jetty and the rowboat beside it, drawn live as small solid things instead of flat paint.
   The jetty is a plank deck on piles: it rises out of the shore, stands over the water on posts and has a bollard at its
   end. People standing on it are lifted to the deck (jettyLift). The rowboat is a hull with a rim, inside walls, two
   thwarts and an oar, and it rides the same waves as the water (waveAt, waves.js): lifted, carried and tilted by the
   water at its bow, stern and sides, so it pitches and rolls with each crest and sits still on glass and in the ice.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const JETTY = { hw: 6.5, deck: 0.16, th: 0.05, seg: 18 };
const HR = HZ / Math.sqrt(1 - TILT * TILT); // a height unit in ground units: the view is tilted, so up is stretched
const VIEW = [0, Math.sqrt(1 - TILT * TILT), TILT]; // from the scene toward the viewer, in ground units
const jettyRise = f => smooth(0, 0.16, f);
const jettyLen = () => Math.hypot(JET.x1 - JET.x0, JET.y1 - JET.y0);

/* how high the deck stands under something at (x, y); 0 off the jetty. It starts at the shore and climbs. */
function jettyLift(x, y) {
  const dx = JET.x1 - JET.x0,
    dy = JET.y1 - JET.y0,
    t = ((x - JET.x0) * dx + (y - JET.y0) * dy) / (dx * dx + dy * dy);
  if (t < 0 || t > 1.03) return 0;
  const d = Math.hypot(x - JET.x0 - t * dx, y - JET.y0 - t * dy);
  return d > JETTY.hw + 3 ? 0 : JETTY.deck * jettyRise(t) * (1 - smooth(JETTY.hw - 1, JETTY.hw + 3, d));
}

// shade() takes a hex colour; the lit faces below hand colours on to each other, so accept the rgb() it returns too
const sh = (c, f) =>
  shade(
    c[0] === 'r'
      ? '#' +
          c
            .match(/\d+/g)
            .map(v => (+v).toString(16).padStart(2, '0'))
            .join('')
      : c,
    f
  );
/* a lit face: lighter turned up, darker turned away, and a warm edge on the sun side at dusk */
function faceCol(col, n) {
  let c = sh(col, clamp(0.8 + 0.2 * n[2] - 0.2 * n[0], 0.55, 1.12));
  if (LIGHT.rim > 0.05 && n[0] * LIGHT.rimSide > 0) c = mixRgb(c, rimCol(), LIGHT.rim * 0.4 * Math.abs(n[0]));
  return c;
}
function fillPoly(pts, fill) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/* ---- the jetty ---- */
function jettyFrame() {
  const L = jettyLen(),
    ux = (JET.x1 - JET.x0) / L,
    uy = (JET.y1 - JET.y0) / L;
  // a point s along the jetty, c across it (to its left), h up (height units)
  return {
    L,
    ux,
    uy,
    P: (s, c, h) => [JET.x0 + ux * s - uy * c, (JET.y0 + uy * s + ux * c) * TILT - h * HZ],
    G: (s, c) => [JET.x0 + ux * s - uy * c, JET.y0 + uy * s + ux * c],
    h: s => JETTY.deck * jettyRise(s / L)
  };
}
const jettySegs = () => {
  const L = jettyLen(),
    n = Math.max(1, Math.ceil(L / JETTY.seg));
  return { n, L };
};
// the draw-list entries for the jetty: one per stretch of deck, each sorted by its own depth
function jettyItems(items, k) {
  const { n, L } = jettySegs();
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) / n) * L,
      x = lerp(JET.x0, JET.x1, s / L),
      y = lerp(JET.y0, JET.y1, s / L);
    if (visU(x, y, JETTY.seg + 10, 30)) items.push([y, 20, i, k]);
  }
}
function drawJetty(i) {
  const F = jettyFrame(),
    { n, L } = jettySegs(),
    s0 = (i / n) * L,
    s1 = ((i + 1) / n) * L,
    hw = JETTY.hw,
    th = JETTY.th,
    wt = winterW(),
    wood = mixHex('#7A6247', '#C9CBC8', wt * 0.92),
    beam = mixHex('#5E4A35', '#9EA3A3', wt * 0.7),
    pile = mixHex('#43352A', '#8A8F90', wt * 0.55);
  // the post at each end of the stretch: a ring where it meets the water, then the post itself
  const post = (s, c) => {
    const [px, py] = F.P(s, c, 0),
      h = F.h(s) + 0.012;
    ctx.fillStyle = `rgba(10,26,32,${0.4 * (1 - wt)})`;
    ctx.beginPath();
    ctx.ellipse(px, py, 3.1, 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pile;
    ctx.fillRect(px - 1.25, py - h * HZ, 2.5, h * HZ + 0.6);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(px - 1.25, py - h * HZ, 0.8, h * HZ + 0.6);
    if (wt > 0.1) {
      ctx.fillStyle = `rgba(236,240,242,${0.85 * wt})`;
      ctx.fillRect(px - 1.5, py - h * HZ - 0.8, 3, 1.6);
    }
  };
  // posts on the far side first, so the deck lies over their tops; the near ones after, in front of the beam
  const far = (F.G(0, -hw)[1] <= F.G(0, hw)[1] ? -1 : 1) * (hw + 0.5),
    near = -far;
  for (const s of i === n - 1 ? [s0, s1] : [s0]) post(s, far);
  // the beam along each visible edge, under the deck boards
  for (const c of [-hw, hw]) {
    // the side faces the viewer when its outward normal (to the left of travel for +c) points toward +y
    const ny = c > 0 ? F.ux : -F.ux;
    if (ny <= 0.02) continue;
    fillPoly(
      [F.P(s0, c, F.h(s0)), F.P(s1, c, F.h(s1)), F.P(s1, c, F.h(s1) - th * 1.6), F.P(s0, c, F.h(s0) - th * 1.6)],
      faceCol(beam, [c > 0 ? -F.uy : F.uy, ny, 0])
    );
  }
  // the deck: boards across, each a touch different, with a dark gap between and a lit edge on top
  const nb = Math.max(2, Math.round((s1 - s0) / 3.2));
  for (let b = 0; b < nb; b++) {
    const a0 = lerp(s0, s1, b / nb),
      a1 = lerp(s0, s1, (b + 1) / nb),
      v = hash2(i * 29 + b, 71) - 0.5;
    fillPoly(
      [F.P(a0, -hw, F.h(a0)), F.P(a1, -hw, F.h(a1)), F.P(a1, hw, F.h(a1)), F.P(a0, hw, F.h(a0))],
      faceCol(sh(wood, 1 + v * 0.16), [0, 0, 1])
    );
  }
  ctx.strokeStyle = `rgba(30,20,12,${0.4 * (1 - wt * 0.7)})`;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let b = 0; b <= nb; b++) {
    const a = lerp(s0, s1, b / nb),
      p0 = F.P(a, -hw, F.h(a)),
      p1 = F.P(a, hw, F.h(a));
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
  }
  ctx.stroke();
  if (wt > 0.1) {
    ctx.strokeStyle = `rgba(240,244,246,${0.7 * wt})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const c of [-hw + 0.7, hw - 0.7]) {
      const p0 = F.P(s0, c, F.h(s0)),
        p1 = F.P(s1, c, F.h(s1));
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
    }
    ctx.stroke();
  }
  for (const s of i === n - 1 ? [s0, s1] : [s0]) post(s, near);
  if (i === n - 1) {
    // a bollard at the end, where the boat is tied
    const [bx, by] = F.P(L - 2.2, 0, F.h(L)),
      bt = by - 0.1 * HZ;
    ctx.fillStyle = sh(pile, 1.15);
    ctx.fillRect(bx - 1.6, bt, 3.2, 0.1 * HZ);
    ctx.fillStyle = sh(pile, 1.45);
    ctx.beginPath();
    ctx.ellipse(bx, bt, 2, 1.1, 0, 0, TAU);
    ctx.fill();
  }
}
// the shadow of the deck on the water: laid in the ground pass, under everything that stands
function jettyShadow(c) {
  c.save();
  c.lineCap = 'butt';
  c.strokeStyle = 'rgba(12,28,34,.3)';
  c.lineWidth = JETTY.hw * 2;
  c.beginPath();
  c.moveTo(JET.x0 + 4, JET.y0 + 5);
  c.lineTo(JET.x1 + 4, JET.y1 + 5);
  c.stroke();
  c.restore();
}

/* ---- the rowboat ---- */
const BOATG = (() => {
  // stations from stern to bow: [x along the keel, half width at the rim, rim height]; a flat transom, a full middle,
  // a pointed bow with the stem rising a little
  const tab = [
    [0, 5.6],
    [0.1, 7.2],
    [0.24, 8.1],
    [0.46, 8.4],
    [0.68, 7.6],
    [0.84, 5.6],
    [0.94, 3],
    [1, 0.4]
  ];
  const st = [];
  for (let k = 0; k <= 16; k++) {
    const u = k / 16;
    let j = 0;
    while (j < tab.length - 2 && tab[j + 1][0] < u) j++;
    const f = (u - tab[j][0]) / (tab[j + 1][0] - tab[j][0]),
      e = f * f * (3 - 2 * f);
    st.push({ x: -17 + 36 * u, w: lerp(tab[j][1], tab[j + 1][1], e), hr: 0.15 + 0.05 * u * u + 0.012 * (1 - u) });
  }
  return { st, bottom: 0.74, floor: 0.025 };
})();
const BP = { t: -1, lift: 0, pitch: 0, roll: 0, dx: 0, dy: 0 };
function boatPose() {
  if (BP.t === T) return BP;
  BP.t = T;
  const cs = Math.cos(BOAT.ang),
    sn = Math.sin(BOAT.ang),
    at = (lx, ly) => waveAt(BOAT.x + lx * cs - ly * sn, BOAT.y + lx * sn + ly * cs).h;
  const w = waveAt(BOAT.x, BOAT.y),
    hc = w.h;
  BP.dx = w.dx * 1.6;
  BP.dy = w.dy * 1.1;
  const hb = at(14, 0),
    hs = at(-14, 0),
    hp = at(0, 7),
    hq = at(0, -7);
  // a little rocking even on glass, so a tied boat never looks bolted to the water
  const idle = (1 - Math.min(1, w.r * 3)) * (1 - winterW());
  BP.lift = ((hc + hb + hs + hp + hq) / 5) * (0.8 / HZ) + idle * 0.004 * Math.sin(T * 1.1 + 1.3);
  BP.pitch = clamp(Math.atan2(hb - hs, 28) * 1.5, -0.4, 0.4) + idle * 0.012 * Math.sin(T * 0.8);
  BP.roll = clamp(Math.atan2(hp - hq, 14) * 1.5, -0.4, 0.4) + idle * 0.02 * Math.sin(T * 0.95 + 2.1);
  // birds sitting in the boat rise and fall with it
  const sp = Math.sin(BP.pitch);
  for (const p of perchesOfType('boat')) {
    const lx = (p.x - BOAT.x) * cs + (p.y - BOAT.y) * sn;
    p.h = 0.12 + BP.lift + (lx * sp) / HR;
    if (p.occ && p.occ.perch === p && p.occ.state === 'perch') p.occ.z = p.h;
  }
  return BP;
}

function drawBoat() {
  const B = boatPose(),
    wt = winterW(),
    cs = Math.cos(BOAT.ang),
    sn = Math.sin(BOAT.ang),
    cr = Math.cos(B.roll),
    sr = Math.sin(B.roll),
    cp = Math.cos(B.pitch),
    sp = Math.sin(B.pitch),
    ox = BOAT.x + B.dx,
    oy = BOAT.y + B.dy;
  // local (x along the keel, y across, z up in ground units) to the world, in ground units
  const R = (lx, ly, lz) => {
    const y1 = ly * cr - lz * sr,
      z1 = ly * sr + lz * cr,
      x2 = lx * cp - z1 * sp,
      z2 = lx * sp + z1 * cp;
    return [x2 * cs - y1 * sn, x2 * sn + y1 * cs, z2];
  };
  const Pt = (lx, ly, h) => {
    const r = R(lx, ly, h * HR);
    return [ox + r[0], (oy + r[1]) * TILT - (B.lift * HR + r[2]) * (HZ / HR)];
  };
  const rot = n => {
    const r = R(n[0], n[1], n[2]),
      l = Math.hypot(r[0], r[1], r[2]) || 1;
    return [r[0] / l, r[1] / l, r[2] / l];
  };
  const facing = n => n[1] * VIEW[1] + n[2] * VIEW[2] > 0.02;
  const hullCol = '#E8E3D6',
    inner = mixHex('#8A6A48', '#E2E6E7', wt * 0.85),
    seat = mixHex('#6E5238', '#DADFE0', wt * 0.8),
    st = BOATG.st,
    bt = BOATG.bottom;
  // the outside of a stretch of wall between two stations, the way it faces; walls are flared out toward the rim
  const wall = (a, b, s) => {
    const q = [
        [a.x, s * a.w, a.hr],
        [b.x, s * b.w, b.hr],
        [b.x, s * b.w * bt, 0],
        [a.x, s * a.w * bt, 0]
      ],
      t1 = [b.x - a.x, s * (b.w - a.w), (b.hr - a.hr) * HR],
      t2 = [0, s * (a.w * (bt - 1)), -a.hr * HR];
    let n = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]];
    if (n[1] * s < 0) n = n.map(v => -v);
    return { pts: q.map(p => Pt(p[0], p[1], p[2])), n: rot(n) };
  };
  const walls = [];
  for (let i = 0; i < st.length - 1; i++) for (const s of [-1, 1]) walls.push(wall(st[i], st[i + 1], s));
  const tr = st[0],
    transom = {
      pts: [Pt(tr.x, -tr.w, tr.hr), Pt(tr.x, tr.w, tr.hr), Pt(tr.x, tr.w * bt, 0), Pt(tr.x, -tr.w * bt, 0)],
      n: rot([-1, 0, -0.1])
    };
  // water at the hull: a dark patch and a pale ring that ride with it
  const ring = k => {
    const pts = [];
    for (const s of [1, -1])
      for (let i = s > 0 ? 0 : st.length - 1; s > 0 ? i < st.length : i >= 0; i += s) {
        const q = st[i],
          lx = q.x + (i === 0 ? -1.2 * k : i === st.length - 1 ? 1.2 * k : 0),
          ly = s * q.w * (0.94 + 0.12 * k) * 0.98 * Math.min(1, 0.4 + 0.6 * k);
        pts.push([ox + lx * cs - ly * sn, (oy + lx * sn + ly * cs) * TILT]);
      }
    return pts;
  };
  if (wt < 0.95) {
    fillPoly(ring(1.12), `rgba(8,24,30,${0.34 * (1 - wt)})`);
    const rp = ring(1.04);
    ctx.beginPath();
    rp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.strokeStyle = `rgba(232,244,240,${0.34 * (1 - wt)})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  // inside: the floor, then the inner faces that turn toward the viewer (the far wall), then the seats
  fillPoly(
    [
      ...st.map(q => Pt(q.x, q.w * bt * 0.9, BOATG.floor)),
      ...st.map(q => Pt(q.x, -q.w * bt * 0.9, BOATG.floor)).reverse()
    ],
    sh(inner, 0.72)
  );
  for (const w of walls)
    if (!facing(w.n))
      fillPoly(
        w.pts,
        faceCol(
          sh(inner, 0.86),
          w.n.map(v => -v)
        )
      );
  if (!facing(transom.n))
    fillPoly(
      transom.pts,
      faceCol(
        sh(inner, 0.8),
        transom.n.map(v => -v)
      )
    );
  const half = x => {
    let j = 0;
    while (j < st.length - 2 && st[j + 1].x < x) j++;
    return lerp(st[j].w, st[j + 1].w, clamp((x - st[j].x) / (st[j + 1].x - st[j].x), 0, 1));
  };
  const box = (x0, x1, hy, z0, z1, col) => {
    const c = [
      [x0, -hy],
      [x1, -hy],
      [x1, hy],
      [x0, hy]
    ];
    const top = c.map(p => Pt(p[0], p[1], z1));
    for (let e = 0; e < 4; e++) {
      const a = c[e],
        b = c[(e + 1) % 4],
        d = [b[1] - a[1], -(b[0] - a[0]), 0],
        n = rot(d);
      if (facing(n))
        fillPoly(
          [Pt(a[0], a[1], z1), Pt(b[0], b[1], z1), Pt(b[0], b[1], z0), Pt(a[0], a[1], z0)],
          faceCol(sh(col, 0.82), n)
        );
    }
    fillPoly(top, faceCol(col, rot([0, 0, 1])));
  };
  for (const sx of [-4, 7]) box(sx - 1.6, sx + 1.6, half(sx) * bt * 0.97, 0.085, 0.112, seat);
  // an oar laid across the seats, its blade out over the water
  {
    const a = Pt(-5, 9.2, 0.15),
      b = Pt(7.5, -8.5, 0.12),
      c = Pt(10.2, -12.5, 0.1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = mixHex('#A98B63', '#E2E6E7', wt * 0.6);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // the outside faces that turn toward the viewer (the near wall and the transom, if it faces us)
  for (const w of walls) if (facing(w.n)) fillPoly(w.pts, faceCol(hullCol, w.n));
  if (facing(transom.n)) fillPoly(transom.pts, faceCol(hullCol, transom.n));
  // a darker strake along the waterline, and the rim, a pale edge all round
  ctx.lineJoin = 'round';
  ctx.strokeStyle = faceCol(mixHex('#8B2F24', '#C9CBC8', wt * 0.5), [0, 0, 1]);
  ctx.lineWidth = 1.2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    st.forEach((q, i) => {
      const p = Pt(q.x, s * q.w * (1 - (1 - bt) * 0.42), q.hr * 0.3);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.stroke();
  }
  ctx.strokeStyle = mixHex('#F3EEDF', '#FFFFFF', wt * 0.6);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (const s of [1, -1])
    for (let i = s > 0 ? 0 : st.length - 1; s > 0 ? i < st.length : i >= 0; i += s) {
      const q = st[i],
        p = Pt(q.x, s * q.w, q.hr);
      ctx.lineTo(p[0], p[1]);
    }
  ctx.closePath();
  ctx.stroke();
  // the painter, tied to the jetty bollard from whichever end is nearer
  {
    const JF = jettyFrame(),
      bx = JF.G(JF.L - 2.2, 0),
      bh = JF.h(JF.L) + 0.1,
      toBow =
        Math.hypot(bx[0] - (BOAT.x + cs * 19), bx[1] - (BOAT.y + sn * 19)) <
        Math.hypot(bx[0] - (BOAT.x - cs * 17), bx[1] - (BOAT.y - sn * 17)),
      end = toBow ? st[st.length - 1] : st[0],
      a = Pt(end.x, 0, end.hr),
      b = [bx[0], bx[1] * TILT - bh * HZ],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    ctx.strokeStyle = 'rgba(214,200,164,.85)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + Math.min(8, d * 0.18), b[0], b[1]);
    ctx.stroke();
  }
}
