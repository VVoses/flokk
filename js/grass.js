/* Flokk - grass.js
   Standing grass: tufts of blades over the open meadows, the pastures and the verges, drawn upright on the
   ground like the reeds so they lean and ripple with the wind instead of lying painted flat. They follow the
   year with the rest of the land (grow.js): in spring they come up short and pale through last year's straw
   as the snow melts back, in summer they stand deep green and set seed, the south slopes drying toward hay,
   autumn turns them olive and then gold and flattens them, and in winter only the tallest dry stalks along
   the verges and field edges still poke up through the snow.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const GRS = {
  seed: null,
  n: 0,
  gc: 160, // world units per culling bucket
  nc: 0,
  nr: 0,
  buckets: null, // tuft indices per bucket, row-major
  g: 0.5, // the wind's gust strength, eased (amb.gust jumps from one value to the next)
  lastT: 0
};
const GRASS_NB = 6; // at most this many blades per tuft

/* scatter the tufts once per land: a jittered grid, kept to open ground (not forest, water, roads, the rail,
   yards, buildings or ploughed and sown fields), clumpy by noise, longer along verges and field edges and
   cropped short where the stock graze. Uses its own random stream so the rest of the world is unchanged. */
function buildGrass() {
  const r = mulberry32((SEED ^ 0x6a55) >>> 0),
    rr = (a, b) => a + (b - a) * r(),
    C = GROW.cells,
    SP = 11,
    X = [],
    Y = [],
    HT = [],
    NB = [],
    KD = [],
    FI = [],
    CI = [];
  const nearLane = (x, y, m) => {
    for (const P of LANES) {
      if (polyDist(x, y, P) < m) return true;
      if (x < 200 && polyDist(x + W, y, P) < m) return true;
      if (x > W - 200 && polyDist(x - W, y, P) < m) return true;
    }
    return false;
  };
  for (let gy = 0; gy < H; gy += SP)
    for (let gx = 0; gx < W; gx += SP) {
      const x = wrapX(gx + r() * SP),
        y = gy + r() * SP,
        dice = r();
      // a pasture is cleared land wherever it lies; elsewhere the grass thins out into the forest floor
      const fd = fieldAt(x, y),
        f = forestness(x, y);
      if (fd ? fd.t !== 'pasture' : f > 0.56 || dice < clamp((f - 0.36) / 0.2, 0, 1)) continue;
      // clumps: some of the meadow is thick with grass, some thin and mossy or heathy
      const clump = pfbm(x, y, 170, 29, 63);
      if (dice > (fd ? 0.55 : 0.35) + clump * 0.75) continue;
      if (!fd && pfbm(x, y, 230, 71, 29) > 0.72) continue; // bare rock
      if (inWater(x, y, 3)) continue;
      const rd = roadDist(x, y),
        rl = railDist(x, y);
      if (rd < 17 || rl < 22 || nearLane(x, y, 12) || inBuild(x, y, 5) || inChurchyard(x, y, 4)) continue;
      let inY = false;
      for (const Yd of YARDS) if (inYard(Yd, x, y, 2)) inY = true;
      if (inY) continue;
      // verges: the uncut strip beside the road and the rail, and along the edges of the fields
      let edge = rd < 34 || rl < 40;
      if (!fd && !edge)
        for (const q of FIELDS)
          if (x > q.x - 24 && x < q.x + q.w + 24 && y > q.y - 24 && y < q.y + q.h + 24 && inField(q, x, y, 20)) {
            edge = true;
            break;
          }
      const kd = fd ? 1 : edge ? 2 : 0,
        tall = pfbm(x, y, 260, 13, 88);
      let h = kd === 1 ? rr(2.6, 4.6) : kd === 2 ? rr(7, 12) : rr(3.5, 6.5) + clamp((tall - 0.45) * 12, 0, 4);
      if (!fd && f > 0.4) h *= 0.8; // thinner under the trees at the forest margin
      X.push(x);
      Y.push(y);
      HT.push(h);
      NB.push(4 + ((r() * 3) | 0));
      KD.push(kd);
      FI.push(fd ? FIELDS.indexOf(fd) : -1);
      CI.push(C ? clamp(Math.floor(y / GQ), 0, C.nh - 1) * C.nw + clamp(Math.floor(x / GQ), 0, C.nw - 1) : -1);
    }
  // painter order within a bucket: back to front, so a tuft's blades overlap the one behind it
  const n = X.length,
    ord = [...Array(n).keys()].sort((a, b) => Y[a] - Y[b]),
    A = {
      x: new Float32Array(n),
      y: new Float32Array(n),
      h: new Float32Array(n),
      nb: new Uint8Array(n),
      kd: new Uint8Array(n),
      fi: new Int16Array(n),
      ph: new Float32Array(n),
      sh: new Uint8Array(n), // which of the three green shades
      th: new Float32Array(n), // grow.js snow/straw thresholds for the tuft's cell
      gt: new Float32Array(n),
      sf: new Float32Array(n),
      tw: new Float32Array(n),
      bl: new Float32Array(n * GRASS_NB), // each blade's own lean,
      bk: new Float32Array(n * GRASS_NB), // length,
      bo: new Float32Array(n * GRASS_NB) // and foot offset
    };
  ord.forEach((s, i) => {
    A.x[i] = X[s];
    A.y[i] = Y[s];
    A.h[i] = HT[s];
    A.nb[i] = NB[s];
    A.kd[i] = KD[s];
    A.fi[i] = FI[s];
    A.ph[i] = r() * TAU;
    A.sh[i] = (r() * 3) | 0;
    const o = CI[s];
    if (C && o >= 0) {
      A.th[i] = C.th[o];
      A.gt[i] = C.gt[o];
      A.sf[i] = C.sf[o];
      A.tw[i] = (0.7 - C.th[o]) * 0.3 + (C.nz[o] - 0.5) * 0.5 - 0.02; // when the first snow covers it (grow.js)
    }
    const nb = NB[s];
    for (let b = 0; b < nb; b++) {
      const u = nb > 1 ? b / (nb - 1) - 0.5 : 0;
      A.bl[i * GRASS_NB + b] = u * 0.62 + rr(-0.16, 0.16);
      A.bk[i * GRASS_NB + b] = rr(0.6, 1.1) * (1 - Math.abs(u) * 0.35);
      A.bo[i * GRASS_NB + b] = u * 2.2 + rr(-0.4, 0.4);
    }
  });
  GRS.A = A;
  GRS.n = n;
  GRS.nc = Math.ceil(W / GRS.gc);
  GRS.nr = Math.ceil(H / GRS.gc);
  const B = Array.from({ length: GRS.nc * GRS.nr }, () => []);
  for (let i = 0; i < n; i++)
    B[
      clamp(Math.floor(A.y[i] / GRS.gc), 0, GRS.nr - 1) * GRS.nc + clamp(Math.floor(A.x[i] / GRS.gc), 0, GRS.nc - 1)
    ].push(i);
  GRS.buckets = B.map(a => Uint32Array.from(a));
  GRS.seed = SEED;
}

/* how the grass looks at season s, p of the way through it: blade height scale, the three greens (dark, mid,
   light), the dry straw colour, the sunlit sheen a gust shows, the seed heads, and how much of it is dry */
const GLOOK = [
  // spring: short and pale at first, fresh bright green by the end
  p => ({
    hs: 0.35 + 0.6 * smooth(0.05, 0.95, p),
    c: [
      mixRGB([92, 112, 62], [66, 112, 48], p),
      mixRGB([132, 148, 84], [104, 156, 66], p),
      mixRGB([170, 176, 110], [150, 196, 96], p)
    ],
    dry: [178, 164, 118],
    sheen: [206, 226, 160],
    heads: 0,
    dryK: 0
  }),
  // summer: deep and lush, seeding from midsummer on
  p => ({
    hs: 1,
    c: [
      [54, 94, 40],
      [84, 128, 52],
      [122, 158, 70]
    ],
    dry: [182, 166, 98],
    sheen: [196, 214, 142],
    heads: smooth(0.25, 0.6, p),
    dryK: 0
  }),
  // autumn: olive going gold, then dull and flattened
  p => ({
    hs: 0.95 - 0.2 * smooth(0.5, 1, p),
    c: [
      mixRGB([92, 102, 54], [104, 94, 60], p),
      mixRGB([140, 138, 76], [150, 126, 78], p),
      mixRGB([190, 176, 102], [176, 150, 96], p)
    ],
    dry: mixRGB([196, 168, 104], [160, 132, 92], p),
    sheen: [232, 214, 150],
    heads: 1 - smooth(0.4, 0.9, p),
    dryK: 0.25 + 0.5 * p
  }),
  // winter: dry stalks
  () => ({
    hs: 0.8,
    c: [
      [124, 108, 78],
      [150, 132, 96],
      [172, 154, 114]
    ],
    dry: [168, 148, 108],
    sheen: [214, 204, 178],
    heads: 0.5,
    dryK: 1
  })
];
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgbS = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
function grassLook() {
  const L = GLOOK[SEASON](GROW.p);
  if (TRANS.t < 1 && TRANS.prevSeason !== SEASON) {
    const P = GLOOK[TRANS.prevSeason](1),
      e = tEase();
    L.hs = lerp(P.hs, L.hs, e);
    L.c = L.c.map((c, i) => mixRGB(P.c[i], c, e));
    L.dry = mixRGB(P.dry, L.dry, e);
    L.sheen = mixRGB(P.sheen, L.sheen, e);
    L.heads = lerp(P.heads, L.heads, e);
    L.dryK = lerp(P.dryK, L.dryK, e);
  }
  return L;
}

/* drawn once per copy of the land, in the upright layer under everything that stands on the ground */
function drawGrass() {
  if (GROW.seed !== SEED || !GROW.cells) return;
  if (GRS.seed !== SEED) buildGrass();
  const A = GRS.A,
    gc = GRS.gc,
    L = grassLook(),
    s = SEASON,
    p = GROW.p,
    wint = s === 3,
    dt = clamp(T - GRS.lastT, 0, 0.1);
  GRS.lastT = T;
  GRS.g += (amb_gust() - GRS.g) * Math.min(1, dt * 0.7);
  const g = GRS.g,
    lean = WIND.x * (0.12 + 0.3 * g),
    stiff = wint ? 0.35 : 1,
    tm = T;
  // blade paths batched by colour: three greens, dry straw, the gust's sheen; seed heads as dots
  const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()],
    heads = new Path2D();
  let any = false;
  const c0 = Math.max(0, Math.floor((V.x0 - 20) / gc)),
    c1 = Math.min(GRS.nc - 1, Math.floor((V.x1 + 20) / gc)),
    r0 = Math.max(0, Math.floor((V.py0 - 4) / TILT / gc)),
    r1 = Math.min(GRS.nr - 1, Math.floor((V.py1 + 20) / TILT / gc));
  // zoomed right out the blades are under a pixel apart: every other tuft is enough
  const step = cam.z < 0.62 ? 2 : 1;
  for (let rw = r0; rw <= r1; rw++)
    for (let cl = c0; cl <= c1; cl++) {
      const Bk = GRS.buckets[rw * GRS.nc + cl];
      for (let q = 0; q < Bk.length; q += step) {
        const i = Bk[q],
          x = A.x[i],
          y = A.y[i];
        let h = A.h[i] * L.hs;
        if (!visU(x, y, 12, h + 4)) continue;
        const kd = A.kd[i];
        if (kd === 1 && s !== 3) h *= 0.8; // grazed
        let dry = L.dryK;
        if (s === 0) {
          // still under the melting snow, or coming up through last year's straw
          if (smooth(p - 0.035, p + 0.035, A.th[i]) > 0.5) continue;
          const straw = kd === 1 ? GROW.fa[A.fi[i]] || 0 : clamp((A.gt[i] - p) / 0.16, 0, 1);
          h *= 1 - 0.55 * straw;
          dry = straw;
        } else if (s === 1) {
          if (kd !== 1) dry = 0.72 * smooth(0.4, 0.9, p) * clamp(0.35 + A.sf[i], 0, 1); // south slopes drying to hay
        } else if (s === 3) {
          // once the first snow lies, only what stands taller than it shows
          const bare = clamp((A.tw[i] - p) / 0.1, 0, 1) * tEase();
          h = h * (0.6 + 0.4 * bare) - (kd === 1 ? 5 : 3.5) * (1 - bare);
        }
        if (h < 1.2) continue;
        any = true;
        const b = y * TILT,
          ph = A.ph[i];
        // a gust runs across the grass as a wave: the blades bow further as it passes and catch the light
        const wv =
            Math.sin(x * 0.011 + y * 0.004 - tm * 1.9) * 0.6 + Math.sin(x * 0.006 - y * 0.009 - tm * 1.3 + 1.7) * 0.4,
          bow = (lean * (0.7 + 0.8 * wv * g) + Math.sin(tm * 2.3 + ph) * 0.07) * stiff,
          lit = !wint && wv * g > 0.38;
        const nb = A.nb[i],
          dn = Math.round(dry * nb + (ph / TAU - 0.5) * 0.9);
        for (let k = 0; k < nb; k++) {
          const o = i * GRASS_NB + k,
            hk = h * A.bk[o],
            bx = x + A.bo[o],
            lx = (A.bl[o] + bow + Math.sin(tm * 3.1 + ph + k) * 0.04 * stiff) * hk;
          const P = k < dn ? paths[3] : lit && k === nb - 1 ? paths[4] : paths[(A.sh[i] + k) % 3];
          P.moveTo(bx, b);
          P.quadraticCurveTo(bx + lx * 0.15, b - hk * 0.65, bx + lx, b - hk + Math.abs(lx) * 0.25);
          if (k === 1 && L.heads > 0 && kd !== 1 && hk > 5 && ph < L.heads * TAU * 0.6)
            heads.rect(bx + lx - 0.7, b - hk + Math.abs(lx) * 0.25 - 1.6, 1.4, 2.4);
        }
      }
    }
  if (!any) return;
  const cols = [...L.c, L.dry, L.sheen];
  ctx.lineWidth = wint ? 0.8 : 0.85;
  ctx.lineCap = 'round';
  for (let j = 0; j < 5; j++) {
    ctx.strokeStyle = rgbS(cols[j]);
    ctx.stroke(paths[j]);
  }
  if (L.heads > 0) {
    ctx.fillStyle = rgbS(mixRGB(L.dry, [120, 100, 80], 0.35));
    ctx.fill(heads);
  }
  ctx.lineCap = 'butt';
}
