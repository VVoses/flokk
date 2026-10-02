/* Flokk - crops.js
   The crops standing in the fields, drawn upright over the painted ground like the grass (grass.js) so they
   bow and ripple with the very same wind field: a gust is seen running through the barley, the rapeseed, the
   potato haulm and the onion tops together, and on into the grass and trees beyond. Grain is sown in spring,
   greens, goes gold and is cut in autumn field by field; winter rapeseed greens early, flowers yellow at the
   turn to summer, sets pods and is cut in late summer; potato haulm bushes up, blossoms, dies back and is
   lifted; onion tops stand blue-green, then yellow and flop over before the bulbs are pulled. The painted
   ground under them (ground.js, grow.js) carries the season's colour, this layer only the standing stems.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const CRP = { seed: null, F: [] };
// per crop: where the stalks stand (spacing across the rows), how tall, how much it gives to the wind
const CROPDEF = {
  grain: { sp: 7, h: 10, fl: 1, w: 0.9, nb: 3 },
  rapeseed: { sp: 8, h: 15, fl: 0.7, w: 1, nb: 3 },
  potato: { sp: 9, h: 6, fl: 0.35, w: 2.4, nb: 2 },
  onion: { sp: 6, h: 8, fl: 1.2, w: 0.9, nb: 3 }
};
const CRP_CELL = 24; // the wind is read once per cell of this many world units, not once per stalk

/* the stalks of one field, kept for good: tufts on the rows in the field's own heading, sorted by cell so the
   wind lookup is shared by neighbours. Own random stream, so the rest of the world is unchanged. */
function buildCrop(f, fi, cv) {
  const d = CROPDEF[cv],
    r = mulberry32(((SEED ^ 0x5c0b) + fi * 7919) >>> 0),
    an = f.ang !== undefined ? f.ang : f.dir ? Math.PI / 2 : 0,
    ca = Math.cos(an),
    sa = Math.sin(an),
    rad = Math.hypot(f.w, f.h) / 2,
    cx = f.x + f.w / 2,
    cy = f.y + f.h / 2,
    T0 = [];
  for (let v = -rad; v < rad; v += d.sp)
    for (let u = -rad; u < rad; u += d.sp * 0.8) {
      const uu = u + (r() - 0.5) * 3,
        vv = v + (r() - 0.5) * 1.6,
        x = cx + uu * ca - vv * sa,
        y = cy + uu * sa + vv * ca;
      if (!inField(f, x, y, -4)) continue;
      T0.push({ x: wrapX(x), y, ph: r() * TAU, sh: (r() * 3) | 0 });
    }
  T0.forEach(t => (t.c = Math.floor(t.y / CRP_CELL) * 4096 + Math.floor(t.x / CRP_CELL)));
  T0.sort((a, b) => a.c - b.c);
  const n = T0.length,
    A = {
      n,
      x: new Float32Array(n),
      y: new Float32Array(n),
      ph: new Float32Array(n),
      sh: new Uint8Array(n),
      c: new Int32Array(n)
    };
  T0.forEach((t, i) => {
    A.x[i] = t.x;
    A.y[i] = t.y;
    A.ph[i] = t.ph;
    A.sh[i] = t.sh;
    A.c[i] = t.c;
  });
  return A;
}

/* how the crop of field i stands now: height scale, the two stalk colours, the head/flower colour and how
   many tufts carry one, how flat the tops lie, or null when nothing stands there */
function cropLook(i, f, cv) {
  const s = SEASON,
    p = GROW.p,
    j = jit(i),
    ease = smooth(0.1, 0.3, p);
  let h = 0,
    c1,
    c2,
    hd,
    hdK = 0,
    lodge = 0;
  if (s === 3) return null;
  if (cv === 'grain') {
    const gr1 = [96, 138, 58],
      gr2 = [124, 164, 76],
      go1 = [196, 166, 80],
      go2 = [222, 192, 108];
    if (s === 0) {
      h = 0.45 * smooth(0.3, 1, p);
      c1 = [86, 128, 56];
      c2 = [110, 150, 66];
    } else {
      const rp = s === 1 ? fieldAlpha(i, 1, p) : 1;
      h = s === 1 ? 0.45 + 0.55 * smooth(0, 0.45, p) : fieldAlpha(i, 2, p);
      c1 = mixRGB(gr1, go1, rp);
      c2 = mixRGB(gr2, go2, rp);
      hd = mixRGB([140, 170, 80], [232, 202, 116], rp);
      hdK = smooth(0.1, 0.6, s === 1 ? p : 1) * 0.9;
    }
  } else if (cv === 'potato') {
    if (s === 0) {
      h = 0.4 * smooth(0.6, 1, p);
      c1 = [66, 112, 48];
      c2 = [86, 138, 60];
    } else {
      const old = s === 1 ? smooth(0.65, 1, p) : 1;
      h = s === 1 ? 0.4 + 0.6 * smooth(0, 0.35, p) : (1 - 0.3 * smooth(0, 0.6, p)) * fieldAlpha(i, 2, p);
      c1 = mixRGB([66, 112, 48], [132, 112, 62], old);
      c2 = mixRGB([86, 138, 60], [152, 130, 76], old);
      hd = [226, 216, 238]; // pale lilac-white blossom
      hdK = s === 1 ? smooth(0.15, 0.35, p) * (1 - smooth(0.5, 0.72, p)) * 0.5 : 0;
    }
  } else if (cv === 'onion') {
    if (s === 0) {
      h = 0.35 * smooth(0.55, 1, p);
      c1 = [104, 142, 96];
      c2 = [130, 164, 112];
    } else {
      const old = s === 1 ? smooth(0.55, 0.95, p) : 1;
      lodge = old;
      h = (s === 1 ? 0.35 + 0.65 * smooth(0, 0.4, p) : 1) * (1 - 0.35 * old);
      if (s === 2) h *= fieldAlpha(i, 2, p);
      c1 = mixRGB([104, 142, 96], [170, 154, 88], old);
      c2 = mixRGB([130, 164, 112], [194, 176, 108], old);
    }
  } else if (cv === 'rapeseed') {
    if (s === 2) return null;
    const cut = s === 1 ? 1 - smooth(0.86 + 0.08 * j, 0.9 + 0.08 * j, p) : 1;
    const ripe = s === 1 ? smooth(0.3, 0.8, p) : 0,
      bloom = s === 0 ? smooth(0.55 + j * 0.1, 0.92, p) : 1 - smooth(0.15, 0.5, p);
    h = (s === 0 ? 0.3 + 0.7 * smooth(0.1, 0.85, p) : 1) * cut;
    c1 = mixRGB([70, 110, 60], [150, 146, 70], ripe);
    c2 = mixRGB([92, 132, 70], [176, 160, 86], ripe);
    hd = mixRGB([168, 150, 70], [230, 206, 62], bloom);
    hdK = s === 0 ? smooth(0.5, 0.75, p) : 1;
  } else return null;
  h *= ease;
  if (h < 0.06) return null;
  return { h, c1, c2, hd, hdK, lodge, d: CROPDEF[cv] };
}

/* drawn once per copy of the land, right after the grass, in the upright layer under everything that stands */
function drawCrops() {
  if (GROW.seed !== SEED || !GROW.cells || SEASON === 3) return;
  if (CRP.seed !== SEED) {
    CRP.seed = SEED;
    CRP.F = [];
  }
  const g = GRS.g,
    lean = WIND.x * (0.12 + 0.15 * g),
    gLean = Math.cos(WEATHER.ang) * Math.min(1.4, WEATHER.s) * 0.5,
    tm = T,
    step = cam.z < 0.62 ? 2 : 1,
    ey = TILT;
  for (let fi = 0; fi < FIELDS.length; fi++) {
    const f = FIELDS[fi],
      cv = cropOf(f);
    if (!cv) continue;
    // fields cut across the seam are kept in wrapped pieces, so only whole ones can be skipped by their box
    if (f.x >= 0 && f.x + f.w <= W) {
      if (f.x > V.x1 + 20 || f.x + f.w < V.x0 - 20) continue;
      if (f.y * ey - 30 > V.py1 + 20 || (f.y + f.h) * ey < V.py0 - 4) continue;
    }
    const L = cropLook(fi, f, cv);
    if (!L) continue;
    let A = CRP.F[fi];
    if (!A) A = CRP.F[fi] = buildCrop(f, fi, cv);
    const d = L.d,
      paths = [new Path2D(), new Path2D(), new Path2D()],
      heads = new Path2D(),
      sheenC = mixRGB(L.c2, [244, 240, 190], 0.4);
    let lc = -1,
      wv = 0,
      gl = 0,
      any = false;
    for (let i = 0; i < A.n; i += step) {
      const x = A.x[i],
        y = A.y[i],
        hh = d.h * L.h;
      if (!visU(x, y, 10, hh + 4)) continue;
      if (A.c[i] !== lc) {
        lc = A.c[i];
        wv = windWave(x, y);
        gl = gustAt(x, y);
      }
      any = true;
      const ph = A.ph[i],
        b = y * ey,
        ge = 0.3 + 0.55 * gl,
        bow = (lean * (0.7 + 0.8 * wv * g) + gLean * ge * (0.8 + 0.3 * wv)) * d.fl,
        lit = gl * (0.6 + 0.4 * wv) > 0.6;
      for (let k = 0; k < d.nb; k++) {
        const hk = hh * (0.8 + 0.2 * Math.sin(ph * 3 + k * 2)),
          bx = x + (k - 1) * 1.7,
          lx =
            ((k - 1) * 0.16 + bow + Math.sin(tm * 3.1 + ph + k) * 0.05 * d.fl + L.lodge * Math.sin(ph * 5 + k) * 1.1) *
            hk;
        const P = lit && k === d.nb - 1 ? paths[2] : paths[(A.sh[i] + k) & 1];
        const tx = bx + lx,
          ty = b - hk + Math.abs(lx) * 0.25;
        P.moveTo(bx, b);
        P.quadraticCurveTo(bx + lx * 0.15, b - hk * 0.65, tx, ty);
        if (L.hdK > 0 && k !== 0 && (ph * 7) % 1 < L.hdK) {
          if (cv === 'grain') heads.rect(tx - 0.7, ty - 2.4, 1.4, 3);
          else if (cv === 'rapeseed') {
            heads.rect(tx - 1.3, ty - 1.2, 2.6, 1.9);
            heads.rect(tx - 0.4 + Math.sin(ph) * 1.6, ty + 2.6, 2.2, 1.5);
          } else heads.rect(tx - 0.8, ty - 0.8, 1.6, 1.6);
        }
      }
    }
    if (!any) continue;
    ctx.lineWidth = d.w;
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgbS(L.c1);
    ctx.stroke(paths[0]);
    ctx.strokeStyle = rgbS(L.c2);
    ctx.stroke(paths[1]);
    ctx.strokeStyle = rgbS(sheenC);
    ctx.stroke(paths[2]);
    if (L.hdK > 0) {
      ctx.fillStyle = rgbS(L.hd);
      ctx.fill(heads);
    }
    ctx.lineCap = 'butt';
  }
}
