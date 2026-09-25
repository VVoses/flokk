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
function makeSprite(type, vi, season) {
  const keepR = R;
  R = mulberry32(9000 + vi * 131 + (type === 'spruce' ? 1 : type === 'birch' ? 2 : 3) * 17);
  const c = mk(SW * SS, SHT * SS),
    g = c.getContext('2d');
  g.scale(SS, SS);
  g.translate(AX, AY);
  const Ht = TD[type] * SR;
  if (type === 'spruce') drawSpruce(g, Ht, season, vi);
  else drawLeafy(g, type, vi, season);
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
function drawLeafy(g, type, vi, season) {
  const birch = type === 'birch',
    [cyu, rxu, ryu] = CAN[type],
    cy = -cyu * SR,
    rx = rxu * SR * 1.05,
    ry = ryu * SR * (type === 'birch' ? 1.12 : 1.02),
    rowan = !birch && vi % 4 === 3,
    winter = season === 3;
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
  const bcol = birch ? (winter ? '#6E5A56' : '#8E8A84') : winter ? '#4E3D30' : '#5A4230';
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
  if (winter) {
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
      r: SR * rnd(0.17, 0.26) * (birch ? 0.85 : 1) * (season === 0 ? 0.88 : 1),
      back: R() < 0.35
    };
  });
  for (let i = 0; i < (birch ? 12 : 10); i++) {
    const a = R() * TAU,
      d = Math.sqrt(R()) * 0.78;
    clusters.push({
      x: Math.cos(a) * d * rx,
      y: cy + Math.sin(a) * d * ry * (birch ? 1.08 : 1) + (birch ? ry * 0.12 : 0),
      r: SR * rnd(0.17, 0.27) * (birch ? 0.85 : 1),
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
const NV = 12;
function buildSprites(s) {
  for (const t of ['spruce', 'birch', 'decid']) for (let i = 0; i < NV; i++) SPR[t][i] = makeSprite(t, i, s);
}
buildSprites(0);
