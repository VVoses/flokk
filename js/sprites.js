/* Flokk - sprites.js
   Tree sprites (spruce, birch, deciduous), rebuilt per season.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- tree sprites, one set per season ---------- */
const SPR = { spruce: [], birch: [], decid: [] };
const LEAF = {
  birch: [
    [['#7FA24A', '#9DC05A', '#BCD875', '#DCEBA2']],
    [['#4E7A34', '#5F8D3E', '#77A450', '#93BC68']],
    [
      ['#7C8A38', '#AF983A', '#D5B94F', '#E8D276'],
      ['#6C873A', '#98A242', '#C6AE48', '#DCC66A'],
      ['#80903C', '#B9A040', '#DDBF55', '#EFD983']
    ]
  ],
  decid: [
    [
      ['#5E8A3E', '#79A34C', '#96BC62', '#B6D58A'],
      ['#5A8540', '#72A04A', '#90B962', '#ADD184']
    ],
    [
      ['#2F5226', '#3E6630', '#517D3C', '#67954C'],
      ['#35552F', '#46693A', '#5A8249', '#6E985A']
    ],
    [
      ['#3A5B2D', '#4B7236', '#608A44', '#77A052'],
      ['#35552F', '#46693A', '#5A8249', '#6E985A']
    ]
  ],
  blossom: ['#CFCBC0', '#E6E2D8', '#F4F1EA', '#FFFFFF'],
  rowanAut: ['#5B4B2A', '#8A562A', '#B36E38', '#CE8C4E'],
  rowanSum: ['#3A5B2D', '#4E7336', '#628A44', '#7AA052']
};
/* stage (birch and leafy trees only): 'bare' draws the twigs without snow, 'bud' the first small leaves of
   spring - grow.js blends these under the season's own sprite as the trees leaf out or drop their leaves */
function makeSprite(type, vi, season, stage) {
  const keepR = R;
  R = mulberry32(9000 + vi * 131 + (type === 'spruce' ? 1 : type === 'birch' ? 2 : 3) * 17);
  const c = mk(SW * SS, SHT * SS),
    g = c.getContext('2d');
  g.scale(SS, SS);
  g.translate(AX, AY);
  const Ht = TD[type] * SR;
  if (type === 'spruce') drawSpruce(g, Ht, season, vi);
  else drawLeafy(g, type, vi, season, stage);
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(-SR * 1.1, -Ht, SR * 1.1, 0);
  gr.addColorStop(0, 'rgba(255,245,200,.1)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(8,18,4,.26)');
  g.fillStyle = gr;
  g.fillRect(-AX, -AY, SW, SHT);
  R = keepR;
  return c;
}
/* spruce: tiers of drooping fronds, lit on top, dark underneath, needle strokes along the edges.
   Shape (height, width/taper, tier count, droop) varies by sprite variant so a stand of them reads
   as a mixed bunch of trees, not the same tree stamped over and over. */
function drawSpruce(g, Ht0, season, vi = 0) {
  const shape = spruceShape(vi),
    Ht = Ht0 * shape.hMul,
    tint = 1 + (((vi * 71) % 13) / 13 - 0.5) * 0.16,
    winter = season === 3,
    B = [
      [52, 88, 54],
      [42, 76, 46],
      [40, 70, 44],
      [36, 62, 44]
    ][season].map(c => Math.round(c * tint));
  g.fillStyle = '#4A3526';
  g.fillRect(-2, -Ht * 0.3, 4, Ht * 0.3);
  const tiers = shape.tiers;
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1),
      yb = -Ht * (0.07 + f * 0.83),
      w = SR * shape.wMul * (1.02 - f * 0.9) * (0.9 + R() * 0.2),
      droop = (4 + (1 - f) * 6) * shape.droopMul;
    // dark underside so the tier reads as a shelf
    g.fillStyle = `rgb(${(B[0] * 0.55) | 0},${(B[1] * 0.55) | 0},${(B[2] * 0.6) | 0})`;
    g.beginPath();
    g.moveTo(-w * 0.9, yb + droop * 0.5);
    g.quadraticCurveTo(0, yb + droop * 0.2 + 5, w * 0.9, yb + droop * 0.5);
    g.lineTo(0, yb - 3);
    g.closePath();
    g.fill();
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const y0 = yb - 4 + k * 1.6,
          len = w * (0.62 + 0.38 * R()) * (1 - k * 0.12),
          lit = side < 0 ? 1.08 : 0.9,
          tone = (k === 2 ? 0.92 : 1) * lit * (1 + f * 0.18);
        g.fillStyle = `rgb(${Math.min(255, B[0] * tone + rnd(-4, 4)) | 0},${Math.min(255, B[1] * tone + rnd(-4, 4)) | 0},${Math.min(255, B[2] * tone) | 0})`;
        g.beginPath();
        g.moveTo(0, y0 - 3);
        g.quadraticCurveTo(side * len * 0.55, y0 - 2.5, side * len, y0 + droop * 0.7);
        const n = 8;
        for (let j = n; j >= 0; j--) {
          const t = j / n;
          g.lineTo(side * len * t + rnd(-0.6, 0.6), y0 + droop * 0.7 * t * t + 3.2 + (j % 2 ? rnd(1.5, 3.5) : 0));
        }
        g.closePath();
        g.fill();
      }
    g.lineWidth = 0.7;
    g.strokeStyle = `rgba(${B[0] + 60},${B[1] + 70},${B[2] + 40},.45)`;
    g.beginPath();
    for (let m = 0; m < w * 1.1; m++) {
      const x = rnd(-w, w) * 0.92,
        t = Math.abs(x) / w,
        y = yb - 3.5 + droop * 0.7 * t * t + rnd(0, 2);
      g.moveTo(x, y);
      g.lineTo(x + Math.sign(x || 1) * 1.4, y + 1.6);
    }
    g.stroke();
    if (winter) {
      g.fillStyle = 'rgba(242,246,250,.86)';
      for (const side of [-1, 1]) {
        if (R() < 0.3) continue;
        g.beginPath();
        const len = w * rnd(0.45, 0.8);
        g.moveTo(side * 1.5, yb - 4.2);
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          g.lineTo(side * len * t, yb - 4.2 + droop * 0.7 * t * t - 0.5);
        }
        for (let j = 6; j >= 0; j--) {
          const t = j / 6;
          g.lineTo(side * len * t, yb - 4.2 + droop * 0.7 * t * t + rnd(0.5, 1.4));
        }
        g.closePath();
        g.fill();
      }
    }
  }
  g.strokeStyle = `rgb(${B[0] + 10},${B[1] + 16},${B[2]})`;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(0, -Ht * 0.88);
  g.lineTo(0, -Ht);
  g.stroke();
}
/* birch and leafy trees: a branch skeleton carrying shaded leaf clusters */
function drawLeafy(g, type, vi, season, stage) {
  const birch = type === 'birch',
    [cyu, rxu, ryu] = CAN[type],
    cy = -cyu * SR,
    rx = rxu * SR * 1.05,
    ry = ryu * SR * (type === 'birch' ? 1.12 : 1.02),
    rowan = !birch && vi % 4 === 3,
    winter = season === 3,
    bare = winter || stage === 'bare',
    bud = stage === 'bud';
  // trunk
  if (birch) {
    g.fillStyle = '#ECE8DE';
    g.beginPath();
    g.moveTo(-3.2, 0);
    g.lineTo(3.2, 0);
    g.lineTo(1.2, cy * 0.9);
    g.lineTo(-1.2, cy * 0.9);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,.14)';
    g.beginPath();
    g.moveTo(0.8, 0);
    g.lineTo(3.2, 0);
    g.lineTo(1.2, cy * 0.9);
    g.lineTo(0.4, cy * 0.9);
    g.fill();
    g.fillStyle = '#2A2724';
    g.beginPath();
    g.moveTo(-3.2, 0);
    g.lineTo(3.2, 0);
    g.lineTo(2.8, -5);
    g.lineTo(-2.6, -4);
    g.fill();
    for (let i = 0; i < 12; i++) {
      const y = -rnd(6, -cy * 0.9 - 2),
        w = rnd(1.2, 3.2);
      g.fillRect(rnd(-2.6, 1.8 - w * 0.3), y, w, rnd(0.8, 1.5));
    }
  } else {
    g.fillStyle = '#5A4230';
    g.beginPath();
    g.moveTo(-4.4, 0);
    g.lineTo(4.4, 0);
    g.lineTo(2.2, cy * 0.8);
    g.lineTo(-2.2, cy * 0.8);
    g.fill();
    g.strokeStyle = 'rgba(30,20,12,.35)';
    g.lineWidth = 0.6;
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = rnd(-3, 3);
      g.moveTo(x, 0);
      g.lineTo(x * 0.5, cy * 0.75);
    }
    g.stroke();
  }
  // skeleton
  const segs = [],
    tips = [];
  const grow = (x, y, ang, len, w, d) => {
    const x2 = x + Math.cos(ang) * len,
      y2 = y + Math.sin(ang) * len;
    segs.push([x, y, x2, y2, w]);
    if (d <= 0) {
      tips.push([x2, y2]);
      return;
    }
    const n = 2 + (R() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      let a = ang + rnd(-0.6, 0.6);
      if (birch && d <= 1) a += 0.35 * (Math.cos(a) > 0 ? 1 : -1);
      grow(x2, y2, a, len * rnd(0.62, 0.78), w * 0.64, d - 1);
    }
  };
  const nb = birch ? 4 : 5;
  for (let k = 0; k < nb; k++) {
    const a = -Math.PI / 2 + (k / (nb - 1) - 0.5) * (birch ? 1.5 : 2) + rnd(-0.2, 0.2);
    grow(0, cy * rnd(0.72, 0.95), a, SR * rnd(0.3, 0.42), birch ? 2 : 2.8, 3);
  }
  const inCrown = (x, y) => {
    const dx = x / rx,
      dy = (y - cy) / ry,
      d = Math.hypot(dx, dy);
    return d > 1 ? [(x / d) * 0.98, cy + ((y - cy) / d) * 0.98] : [x, y];
  };
  const bcol = birch ? (bare || bud ? '#6E5A56' : '#8E8A84') : bare ? '#4E3D30' : '#5A4230';
  const drawSegs = () => {
    g.strokeStyle = bcol;
    g.lineCap = 'round';
    for (const [x1, y1, x2, y2, w] of segs) {
      const a = inCrown(x2, y2);
      g.lineWidth = Math.max(0.5, w);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(a[0], a[1]);
      g.stroke();
    }
  };
  if (bare) {
    drawSegs();
    g.strokeStyle = birch ? 'rgba(120,76,72,.35)' : 'rgba(70,56,44,.3)';
    g.lineWidth = 0.5;
    g.beginPath();
    for (const t of tips) {
      const p = inCrown(t[0], t[1]);
      for (let i = 0; i < 4; i++) {
        const a = rnd(0, TAU),
          l = rnd(3, 7);
        g.moveTo(p[0], p[1]);
        g.lineTo(p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l + (birch ? 2 : 0));
      }
    }
    g.stroke();
    if (!winter) return;
    g.strokeStyle = 'rgba(245,248,252,.9)';
    g.lineWidth = 1.1;
    g.beginPath();
    for (const [x1, y1, x2, y2, w] of segs) {
      if (w < 1 || Math.abs(x2 - x1) < Math.abs(y2 - y1) * 0.5) continue;
      g.moveTo(x1, y1 - w * 0.6);
      g.lineTo((x1 + x2) / 2, (y1 + y2) / 2 - w * 0.6);
    }
    g.stroke();
    if (rowan) {
      g.fillStyle = '#C7301E';
      for (const t of tips) {
        if (R() < 0.5) continue;
        const p = inCrown(t[0], t[1]);
        for (let j = 0; j < 4; j++) {
          g.beginPath();
          g.arc(p[0] + rnd(-2, 2), p[1] + rnd(-1, 2), 1.3, 0, TAU);
          g.fill();
        }
      }
    }
    return;
  }
  const sets = season === 2 ? LEAF[type][2] : LEAF[type][season];
  let P = sets[vi % sets.length];
  if (rowan) P = season === 0 ? LEAF.blossom : season === 2 ? LEAF.rowanAut : LEAF.rowanSum;
  const clusters = tips.map(t => {
    const p = inCrown(t[0], t[1] + (birch ? rnd(1, 4) : 0));
    return {
      x: p[0],
      y: p[1],
      r: SR * rnd(0.17, 0.26) * (birch ? 0.85 : 1) * (season === 0 ? 0.88 : 1) * (bud ? 0.4 : 1),
      back: R() < 0.35
    };
  });
  for (let i = 0; i < (birch ? 12 : 10); i++) {
    const a = R() * TAU,
      d = Math.sqrt(R()) * 0.78;
    clusters.push({
      x: Math.cos(a) * d * rx,
      y: cy + Math.sin(a) * d * ry * (birch ? 1.08 : 1) + (birch ? ry * 0.12 : 0),
      r: SR * rnd(0.17, 0.27) * (birch ? 0.85 : 1) * (bud ? 0.4 : 1),
      back: R() < 0.55
    });
  }
  const clump = (cl, dark) => {
    const r = cl.r,
      k = dark ? 0.78 : 1;
    // the body of each leaf clump is drawn with a little transparency, so a lone tuft reads as soft
    // and light-permeable rather than a flat opaque blob, and dense overlap in the canopy core still
    // builds back up toward solid - the highlight/shadow flecks below stay fully opaque for texture
    g.globalAlpha = 0.8;
    g.fillStyle = shade(P[0], k * 0.9);
    g.beginPath();
    g.arc(cl.x + r * 0.18, cl.y + r * 0.22, r, 0, TAU);
    g.fill();
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU + rnd(-0.3, 0.3);
      g.beginPath();
      g.arc(cl.x + Math.cos(a) * r * 0.92, cl.y + Math.sin(a) * r * 0.85, r * rnd(0.18, 0.3), 0, TAU);
      g.fill();
    }
    g.fillStyle = shade(P[1], k);
    g.beginPath();
    g.arc(cl.x - r * 0.08, cl.y - r * 0.06, r * 0.82, 0, TAU);
    g.fill();
    g.fillStyle = shade(P[2], k);
    g.beginPath();
    g.arc(cl.x - r * 0.32, cl.y - r * 0.34, r * 0.5, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = shade(P[3], k);
    for (let j = 0; j < 6; j++) {
      g.beginPath();
      g.arc(cl.x - r * 0.35 + rnd(-r * 0.35, r * 0.35), cl.y - r * 0.4 + rnd(-r * 0.3, r * 0.3), rnd(0.7, 1.3), 0, TAU);
      g.fill();
    }
    g.fillStyle = shade(P[0], k * 0.75);
    for (let j = 0; j < 5; j++) {
      g.beginPath();
      g.arc(cl.x + rnd(-r * 0.2, r * 0.6), cl.y + rnd(r * 0.1, r * 0.6), rnd(0.6, 1.1), 0, TAU);
      g.fill();
    }
  };
  for (const cl of clusters) if (cl.back) clump(cl, true);
  drawSegs();
  for (const cl of clusters.sort((a, b) => a.y - b.y)) if (!cl.back) clump(cl, false);
  if (rowan && season === 2) {
    g.fillStyle = '#D0351F';
    for (const cl of clusters) {
      if (R() < 0.5) continue;
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.arc(cl.x + rnd(-2, 2), cl.y + cl.r * 0.4 + rnd(-1, 2), 1.4, 0, TAU);
        g.fill();
      }
    }
  }
}
/* ---------- bush sprites ----------
   Drawn once per season into little canvases, like the trees, and stamped per bush scaled to its size.
   Variants 0-5 are plain leafy shrubs (hazel, willow, alder buckthorn), 6-8 carry berries or hips (dog rose,
   hawthorn, guelder rose), 9-11 are junipers: dark, upright and evergreen, the one bush that keeps its
   colour under snow. Leafy ones are a tangle of stems under a crown built from hundreds of small leaf dabs,
   lit from the upper left, so they read as foliage rather than a stack of solid blobs; in winter they are
   bare twigs with snow along the upper sides. */
const BR = 20, // bush sprite units per bush radius
  BSS = 3, // and its pixel density
  BSW = Math.ceil(BR * 2.8),
  BSH = Math.ceil(BR * 2.4),
  BAX = BSW / 2,
  BAY = BSH - 5,
  NBV = 12,
  BUSH_H = 0.68; // the height/radius ratio a sprite is drawn for; a bush's own ratio stretches it
const BSPR = { cur: [], bare: [], bud: [] };
const BLEAF = {
  spring: [
    ['#4A7430', '#66963E', '#88B654', '#B2D47A'],
    ['#557A36', '#72994A', '#95B866', '#BDD690']
  ],
  summer: [
    ['#2C4C24', '#3C632E', '#527C3C', '#6C9750'],
    ['#374F30', '#4C6A42', '#658457', '#84A172'], // willow: greyer, silvery on top
    ['#2E4A28', '#416434', '#5A8042', '#779B56']
  ],
  autumn: [
    ['#6A6428', '#9E8A32', '#C9AC46', '#E4CC74'], // hazel, clear yellow
    ['#565F2C', '#7E8838', '#A6AA4A', '#C8C674'], // willow, green going sallow
    ['#643024', '#924229', '#B8603C', '#D68A60'], // guelder rose / rowan red
    ['#71452A', '#A4622E', '#CC8840', '#E8B068'], // orange
    ['#583E26', '#84582E', '#A6763A', '#C69858'] // hawthorn rust
  ],
  juniper: ['#1F3429', '#2C4636', '#41614B', '#65836A'],
  juniperW: ['#243029', '#34453A', '#4E6152', '#76887A'] // bronzed by the cold
};
// which leaf set, stem colour and autumn colour each leafy variant uses
const BVAR = [
  { sum: 0, aut: 0, stem: '#6A5A48' },
  { sum: 1, aut: 1, stem: '#7A3E2C' },
  { sum: 2, aut: 3, stem: '#5C4A3A' },
  { sum: 0, aut: 4, stem: '#625244', cling: true }, // young oak/beech: keeps a few dry leaves all winter
  { sum: 1, aut: 1, stem: '#8A4632' },
  { sum: 2, aut: 0, stem: '#6A5A48' },
  { sum: 0, aut: 2, stem: '#5E3A2C', berry: '#C0321E', bloom: '#F4EEF0' },
  { sum: 2, aut: 4, stem: '#4E3A2E', berry: '#A8241C', bloom: '#FFFFFF' },
  { sum: 1, aut: 2, stem: '#6A4A3A', berry: '#D63A22', bloom: '#F2E6EC' }
];
function makeBush(vi, season, stage) {
  const keepR = R;
  R = mulberry32(7100 + vi * 97);
  const c = mk(BSW * BSS, BSH * BSS),
    g = c.getContext('2d');
  g.scale(BSS, BSS);
  g.translate(BAX, BAY);
  if (vi >= 9) drawJuniper(g, vi, season);
  else drawShrub(g, vi, season, stage);
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(-BR, -BR * 1.4, BR, 0);
  gr.addColorStop(0, 'rgba(255,245,200,.1)');
  gr.addColorStop(0.5, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(8,18,4,.3)');
  g.fillStyle = gr;
  g.fillRect(-BAX, -BAY, BSW, BSH);
  R = keepR;
  return c;
}
// a small leaf: a pointed ellipse at an angle
function leafDab(g, x, y, r, a) {
  g.beginPath();
  g.ellipse(x, y, r, r * 0.55, a, 0, TAU);
  g.fill();
}
function drawShrub(g, vi, season, stage) {
  const V = BVAR[vi],
    winter = season === 3,
    bare = winter || stage === 'bare',
    bud = stage === 'bud';
  // the crown: a few overlapping domes, the middle ones highest, so each variant has its own outline
  const n = 3 + ((R() * 3) | 0),
    lobes = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5,
      rr = BR * rnd(0.36, 0.52) * (1 - Math.abs(u) * 0.35);
    lobes.push({ x: u * BR * rnd(1.15, 1.4), y: -BR * rnd(0.42, 0.56) * (1 - Math.abs(u) * 0.6) - rr * 0.35, r: rr });
  }
  // how deep inside the crown a point is (1 at a dome's heart, 0 at its edge, below 0 outside), and the dome
  const inside = (x, y) => {
    let best = -9,
      L = null;
    for (const l of lobes) {
      const d = 1 - Math.hypot((x - l.x) / l.r, (y - l.y) / (l.r * 0.9));
      if (d > best) {
        best = d;
        L = l;
      }
    }
    return [best, L];
  };
  // stems: fanning up from the root, branching twice; tips stay inside the crown
  const segs = [],
    tips = [];
  const grow = (x, y, ang, len, w, d) => {
    let x2 = x + Math.cos(ang) * len,
      y2 = y + Math.sin(ang) * len;
    const [dd, L] = inside(x2, y2);
    if (dd < 0.05 && y2 < -BR * 0.2) {
      const k = 0.95 / (1 - dd + 0.05);
      x2 = L.x + (x2 - L.x) * k;
      y2 = L.y + (y2 - L.y) * k;
    }
    segs.push([x, y, x2, y2, w]);
    if (d <= 0) {
      tips.push([x2, y2]);
      return;
    }
    for (let i = 0; i < 2 + (R() < 0.35 ? 1 : 0); i++)
      grow(x2, y2, ang + rnd(-0.55, 0.55), len * rnd(0.6, 0.78), w * 0.62, d - 1);
  };
  const ns = 5 + ((R() * 3) | 0);
  for (let i = 0; i < ns; i++) {
    const u = i / (ns - 1) - 0.5;
    grow(u * BR * 0.35, 0, -Math.PI / 2 + u * 1.7 + rnd(-0.15, 0.15), BR * rnd(0.34, 0.46), 1.7, 2);
  }
  const stems = (col, snowy, twigs) => {
    g.strokeStyle = col;
    g.lineCap = 'round';
    for (const [x1, y1, x2, y2, w] of segs) {
      g.lineWidth = Math.max(0.45, w);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }
    if (!twigs) return;
    // fine twigs at the tips
    g.lineWidth = 0.4;
    g.strokeStyle = shade(col, 1.15);
    g.beginPath();
    for (const [tx, ty] of tips)
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + rnd(-1.3, 1.3),
          l = rnd(2.5, 5.5);
        g.moveTo(tx, ty);
        g.lineTo(tx + Math.cos(a) * l, ty + Math.sin(a) * l);
      }
    g.stroke();
    if (!snowy) return;
    g.strokeStyle = 'rgba(246,249,252,.92)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (const [x1, y1, x2, y2, w] of segs) {
      if (Math.abs(x2 - x1) < Math.abs(y2 - y1) * 0.45) continue; // snow only lies on the flatter twigs
      g.moveTo(x1, y1 - w * 0.55);
      g.lineTo(x2, y2 - w * 0.55);
    }
    g.stroke();
    g.fillStyle = '#F4F7FA';
    for (const [tx, ty] of tips)
      if (R() < 0.35) {
        g.beginPath();
        g.ellipse(tx, ty - 0.4, rnd(1, 2), rnd(0.5, 0.9), 0, 0, TAU);
        g.fill();
      }
  };
  if (bare) {
    stems(V.stem, winter, true);
    if (winter && V.cling) {
      // a few dry leaves still hanging on
      for (let i = 0; i < 26; i++) {
        const [tx, ty] = tips[(R() * tips.length) | 0];
        g.fillStyle = R() < 0.5 ? '#9A7446' : '#B48E58';
        leafDab(g, tx + rnd(-3, 3), ty + rnd(-2, 3), rnd(1.1, 1.7), rnd(0, TAU));
      }
    }
    if (V.berry && season >= 2) {
      // what the birds have left: a scattering in late autumn, fewer still by winter
      g.fillStyle = V.berry;
      for (const [tx, ty] of tips) {
        if (R() < (winter ? 0.8 : 0.6)) continue;
        for (let j = 0; j < 3; j++) {
          g.beginPath();
          g.arc(tx + rnd(-2, 2), ty + rnd(-1, 2), 0.9, 0, TAU);
          g.fill();
        }
      }
    }
    return;
  }
  const P = season === 0 ? BLEAF.spring[vi % 2] : season === 2 ? BLEAF.autumn[V.aut] : BLEAF.summer[V.sum],
    P2 = season === 2 ? BLEAF.summer[V.sum] : null; // a little green left among the autumn colour
  stems(shade(V.stem, 0.45), false, false); // in the bush's own shade under the leaves
  // the shaded body of the crown, so the leaves never show daylight through the middle
  if (!bud) {
    g.fillStyle = shade(P[0], 0.8);
    for (const l of lobes) {
      g.beginPath();
      g.ellipse(l.x + l.r * 0.05, l.y + l.r * 0.12, l.r * 0.86, l.r * 0.78, 0, 0, TAU);
      g.fill();
    }
  }
  // the leaves: sampled through the crown, shaded by which way their bit of dome faces, darkest drawn first
  const dabs = [],
    N = bud ? 170 : 520;
  let top = 0,
    tries = 0;
  for (const l of lobes) top = Math.min(top, l.y - l.r);
  while (dabs.length < N && tries++ < N * 8) {
    const x = rnd(-BR * 1.3, BR * 1.3),
      y = rnd(top - 2, 0),
      [d, L] = inside(x, y);
    if (d < (bud ? 0.1 : -0.1)) continue;
    const nx = (x - L.x) / L.r,
      ny = (y - L.y) / L.r,
      lit = -nx * 0.45 - ny * 0.85 + (1 - d) * 0.25 * -ny, // upper left catches the sun
      low = clamp((y - top) / -top, 0, 1); // the underside and base sit in the bush's own shade
    let v = 1.55 + lit * 1.35 - low * 1.1 + rnd(-0.55, 0.55);
    v = clamp(Math.round(v), 0, 3);
    let col = P[v];
    if (P2 && R() < 0.14 + low * 0.2) col = P2[Math.min(3, v)];
    dabs.push([v + R() * 0.5, x, y, col, bud ? rnd(0.8, 1.3) : rnd(1.3, 2.3)]);
  }
  dabs.sort((a, b) => a[0] - b[0]);
  for (const [, x, y, col, r] of dabs) {
    g.fillStyle = col;
    leafDab(g, x, y, r, rnd(-0.9, 0.9) + (x < 0 ? -0.5 : 0.5));
  }
  if (!V.berry) return;
  if (season === 0 && !bud) {
    // blossom, in small sprays on the sunny side
    g.fillStyle = V.bloom;
    for (let i = 0; i < 16; i++) {
      const L = lobes[(R() * lobes.length) | 0],
        a = rnd(-2.6, -0.4),
        d = rnd(0.4, 0.9) * L.r,
        x = L.x + Math.cos(a) * d,
        y = L.y + Math.sin(a) * d * 0.9;
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.arc(x + rnd(-2, 2), y + rnd(-1.5, 1.5), rnd(0.7, 1.1), 0, TAU);
        g.fill();
      }
    }
  } else if (season === 2) {
    // berries and hips hanging in bunches through the outer leaves
    for (let i = 0; i < 8; i++) {
      const L = lobes[(R() * lobes.length) | 0],
        a = rnd(-3, 0.3),
        d = rnd(0.35, 0.85) * L.r,
        x = L.x + Math.cos(a) * d,
        y = L.y + Math.sin(a) * d * 0.9;
      for (let j = 0; j < 4; j++) {
        const bx = x + rnd(-1.8, 1.8),
          by = y + rnd(-1, 2);
        g.fillStyle = V.berry;
        g.beginPath();
        g.arc(bx, by, 0.95, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,230,210,.55)';
        g.beginPath();
        g.arc(bx - 0.3, by - 0.35, 0.3, 0, TAU);
        g.fill();
      }
    }
  }
}
// juniper: an upright, ragged column of dark needles, a few leaning stems; snow sits on its shoulders in winter
function drawJuniper(g, vi, season) {
  const winter = season === 3,
    P = winter ? BLEAF.juniperW : BLEAF.juniper,
    tall = BR * rnd(1.35, 1.7),
    lobes = [],
    n = 3 + ((R() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5,
      h = tall * (1 - Math.abs(u) * rnd(0.5, 0.8));
    lobes.push({
      x: u * BR * 0.7 + rnd(-1.5, 1.5),
      y: -h * 0.5,
      rx: BR * rnd(0.26, 0.36),
      ry: h * 0.5,
      lean: u * 0.25
    });
  }
  const inside = (x, y) => {
    let best = -9,
      L = null;
    for (const l of lobes) {
      const xx = x - l.x - (y - l.y) * l.lean * -0.5;
      const d = 1 - Math.hypot(xx / l.rx, (y - l.y) / l.ry);
      if (d > best) {
        best = d;
        L = l;
      }
    }
    return [best, L];
  };
  g.fillStyle = shade(P[0], 0.8);
  for (const l of lobes) {
    g.beginPath();
    g.ellipse(l.x, l.y, l.rx * 0.85, l.ry * 0.9, l.lean * 0.5, 0, TAU);
    g.fill();
  }
  // a glimpse of the grey stems at the foot
  g.strokeStyle = '#5A4E44';
  g.lineWidth = 1.1;
  g.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = rnd(-3, 3);
    g.moveTo(x, 0);
    g.lineTo(x * 1.6, -BR * 0.25);
  }
  g.stroke();
  const dabs = [];
  let tries = 0;
  while (dabs.length < 480 && tries++ < 5000) {
    const x = rnd(-BR, BR),
      y = rnd(-tall - 2, 0),
      [d, L] = inside(x, y);
    if (d < -0.12) continue;
    const nx = (x - L.x) / L.rx,
      ny = (y - L.y) / L.ry,
      lit = -nx * 0.7 - ny * 0.5,
      low = clamp(y / -tall, 0, 1);
    let v = clamp(Math.round(1.3 + lit * 1.3 + (low - 0.5) * 0.8 + rnd(-0.6, 0.6)), 0, 3);
    // snow caught on the upper, outward-facing sprays (drawn last, over the needles)
    const snow = winter && ny < -0.2 && lit > -0.2 && R() < 0.3 + -ny * 0.5;
    dabs.push([v + (snow ? 5 : 0) + R() * 0.5, x, y, snow ? (R() < 0.7 ? '#F2F5F8' : '#D8E0E8') : P[v]]);
  }
  dabs.sort((a, b) => a[0] - b[0]);
  g.lineCap = 'round';
  g.lineWidth = 1.1;
  for (const [, x, y, col] of dabs) {
    // short needle sprays, pointing up and out
    g.strokeStyle = col;
    const a = -Math.PI / 2 + (x < 0 ? -0.5 : 0.5) + rnd(-0.5, 0.5),
      l = rnd(1.6, 3);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
}
function buildBushSprites(s) {
  for (let i = 0; i < NBV; i++) {
    BSPR.cur[i] = makeBush(i, s);
    BSPR.bare[i] = s === 0 || s === 2 ? makeBush(i, s, 'bare') : null;
    BSPR.bud[i] = s === 0 ? makeBush(i, s, 'bud') : null;
  }
}
const NV = 12;
// same work as buildSprites, but yielding after each variant so a season change can spread it
// across several frames instead of freezing one (see BG_JOB in light.js)
function* buildSpritesGen(s) {
  for (const t of ['spruce', 'birch', 'decid'])
    for (let i = 0; i < NV; i++) {
      SPR[t][i] = makeSprite(t, i, s);
      yield;
    }
  buildBushSprites(s);
}
function buildSprites(s) {
  const it = buildSpritesGen(s);
  while (!it.next().done);
}
buildSprites(0);
