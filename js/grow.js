/* Flokk - grow.js
   The year moving on inside each season, not just at its edges: snow melting back in patches (south-facing
   slopes first, forest shade last), last year's straw greening day by day, birches and then the other leafy
   trees breaking bud and leafing out, crops sprouting, ripening gold and being harvested field by field,
   leaves dropping at the end of autumn, and the first snow of winter settling in over a day.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// a fixed 0..1 value per integer key, for staggering fields and trees
const jit = k => {
  const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
// how far through the current season: 0 at its first midnight, 1 at its last
function seasonP() {
  if (DEV && DEV.growP !== undefined) return DEV.growP; // dev.grow(p) pins it for screenshots
  if (CAL.season !== SEASON) return 0;
  return ((CAL.t / DAY_LEN + START_HOUR / 24) / DAYS_PER_SEASON) % 1;
}
const GROW = {
  p: 0,
  seed: null,
  fsSeason: -1,
  fc: [], // each field painted as its in-between stage (see fieldStage) on a canvas of its own, or null
  fa: [], // per-field alpha of that stage, this frame
  MC: null, // the snow-and-straw mask: one pixel per grid cell, drawn stretched over the ground
  cells: null,
  mT: 0,
  mKey: '',
  leaf: null, // the extra tree sprites for leafing out / leaf fall: {bare:{birch,decid}, bud:{birch,decid}}
  leafSeason: -1,
  northSnow: 0
};
const GQ = 12, // world units per mask cell
  GUP = 3, // and the smooth upscale it is drawn from
  GP = 2; // cells of padding round the mask: wrapped east-west, the edge row repeated north and south

/* ---------- fields ---------- */
/* what a row-crop field grows: potatoes, onions or winter rapeseed, handed out in turn so a farm's plots differ
   (every other field is grain). Handed out by order, off the world's random stream, so the layout never changes. */
const CROP_KINDS = ['rapeseed', 'potato', 'onion', 'potato', 'rapeseed', 'onion'];
function cropOf(f) {
  if (f.t !== 'crop') return f.t === 'plow' || f.t === 'stubble' ? 'grain' : null;
  if (f.cv === undefined)
    FIELDS.filter(q => q.t === 'crop').forEach((q, n) => (q.cv = CROP_KINDS[n % CROP_KINDS.length]));
  return f.cv;
}
// the look a field has before (or after) the season's own ground look takes over, or null if it keeps one look
function fieldStage(f, s) {
  if (f.t === 'sty') return null;
  if (cropOf(f) === 'rapeseed') return s === 0 ? 'bloom' : s === 1 ? 'pods' : null; // green, then yellow, then seed
  if (s === 0) return f.t === 'pasture' ? 'dormant' : f.t === 'plow' ? null : 'plow'; // bare soil, then the sown rows show
  if (s === 1) return f.t === 'pasture' || f.t === 'crop' ? null : 'ripe'; // green grain goes gold
  if (s === 2) return f.t === 'pasture' ? null : f.t === 'crop' ? (cropOf(f) === 'onion' ? 'onion' : 'crop') : 'ripe'; // standing until harvested
  return null;
}
// harvest time of field i in autumn, as season progress: over the first two days, one field at a time
const harvestAt = i => 0.05 + jit(i + 7) * 0.5;
function fieldAlpha(i, s, p) {
  const j = jit(i);
  if (cropOf(FIELDS[i]) === 'rapeseed')
    return s === 0 ? smooth(0.55 + j * 0.1, 0.92, p) : smooth(0.28 + j * 0.15, 0.68 + j * 0.1, p);
  if (s === 0) {
    const a =
      FIELDS[i].t === 'pasture'
        ? 1 - smooth(0.1 + j * 0.2, 0.45 + j * 0.25, p)
        : 1 - smooth(0.14 + j * 0.3, 0.34 + j * 0.4, p);
    return a * tEase(); // winter's crossfade still under way at the very start
  }
  if (s === 1) return smooth(0.42 + j * 0.2, 0.88 + j * 0.1, p);
  if (s === 2) return 1 - smooth(harvestAt(i), harvestAt(i) + 0.03, p);
  return 0;
}
const fieldHarvested = i => SEASON !== 2 || !fieldStage(FIELDS[i], 2) || GROW.fa[i] < 0.5;
// one small canvas per field rather than one the size of the ground: much cheaper to draw from every frame
function* paintFieldStagesGen() {
  const keep = R;
  const fields = [];
  for (const [fi, f] of FIELDS.entries()) {
    const kind = fieldStage(f, SEASON);
    if (!kind) {
      fields.push(null);
      continue;
    }
    const c = mk(Math.ceil(f.w * S) + 2, Math.ceil(f.h * S) + 2),
      q = c.getContext('2d');
    R = mulberry32((SEED ^ 0x3a3) + fi * 7919 + SEASON * 131);
    q.setTransform(S, 0, 0, S, 1 - f.x * S, 1 - f.y * S);
    paintField(q, f, kind, SEASON, false);
    fields.push(c);
    R = keep;
    yield;
  }
  GROW.fc = fields;
  R = keep;
  GROW.fsSeason = SEASON;
}

/* ---------- snow and straw mask ---------- */
function buildCells() {
  const nw = Math.ceil(W / GQ),
    nh = Math.ceil(H / GQ),
    th = new Float32Array(nw * nh),
    gt = new Float32Array(nw * nh),
    kind = new Uint8Array(nw * nh),
    sf = new Float32Array(nw * nh),
    nz = new Float32Array(nw * nh),
    open = new Float32Array(nw * nh);
  for (let j = 0; j < nh; j++)
    for (let i = 0; i < nw; i++) {
      const o = j * nw + i,
        x = (i + 0.5) * GQ,
        y = (j + 0.5) * GQ;
      if (inWater(x, y, -2)) continue; // kind 0: nothing drawn
      // south-facing (ground falling away towards +y) melts first, north-facing and forest shade last
      const e0 = landHeight(x, y),
        s = clamp(((e0 - landHeight(x, y + HS_D)) / HS_D) * 1800, -1, 1),
        f = forestness(x, y),
        dense = clamp((f - 0.5) * 3, 0, 1),
        n = pfbm(x, y, 150, 61, 17),
        n2 = pfbm(x, y, 44, 7, 91);
      let t = 0.2 - 0.17 * s + 0.3 * dense + (n - 0.5) * 0.55 + (n2 - 0.5) * 0.2 + 0.1 * clamp(1 - y / 1400, 0, 1);
      let k = dense > 0.5 ? 3 : 1;
      if (roadDist(x, y) < 26) t -= 0.3; // ploughed and driven clear
      if (fieldAt(x, y)) {
        k = 2;
        t -= 0.05; // dark soil warms first
      }
      // the yard is driven and shovelled clear, fading out over a few metres into the untrodden snow round
      // it rather than stopping at a line along the yard's edge
      let yd = 0;
      for (const Y of YARDS)
        yd = Math.max(yd, [40, 10, -20, -50].filter(m => inYard(Y, x, y, m + (n2 - 0.5) * 40)).length / 4);
      t -= 0.25 * yd;
      // the road, farm lanes and railway are driven or ploughed clear, so no snow lies on the surface
      // itself and it feathers out over its verge - the same ground winter paints, in the seasons either side
      const hw = Math.min(roadDist(x, y) - 15, railDist(x, y) - 12, laneDist(x, y) - 9);
      open[o] = 1 - smooth(0, 5 + 3 * n2, hw);
      th[o] = clamp(t, -0.1, 0.7);
      gt[o] = Math.min(0.94, th[o] + 0.2 + 0.1 * n2);
      kind[o] = k;
      sf[o] = s;
      nz[o] = n2;
    }
  GROW.cells = { nw, nh, th, gt, kind, sf, nz, open };
  GROW.MC = mk(nw + 2 * GP, nh + 2 * GP);
  GROW.MC2 = mk((nw + 2 * GP) * GUP, (nh + 2 * GP) * GUP);
  GROW.mKey = '';
}
// recompute the mask for season s at progress p; k fades the whole of it (a transition out of that season)
function paintMask(s, p, k) {
  const { nw, nh, th, gt, kind, sf, nz, open } = GROW.cells,
    c = GROW.MC.getContext('2d'),
    d = new Uint8ClampedArray(nw * nh * 4),
    ease = tEase(),
    // spring opens where winter left off: the roads are still pale under the old snow on the first morning, then
    // the thaw reaches the gravel and the rails first, before the fields
    clear = s === 0 ? lerp(0.7, 1, smooth(0, 0.2, p)) : 1;
  for (let o = 0; o < nw * nh; o++) {
    const kd = kind[o];
    if (!kd) continue;
    let r = 0,
      gg = 0,
      b = 0,
      a = 0;
    if (s === 0) {
      // lingering snow, bluer on the shaded side, over last year's flattened straw
      const cov = smooth(p - 0.035, p + 0.035, th[o]),
        straw = kd === 2 ? 0 : clamp((gt[o] - p) / 0.16, 0, 1) * (kd === 3 ? 0.22 : 0.5) * ease;
      a = cov + straw * (1 - cov);
      if (a < 0.004) continue;
      const q = sf[o] * 0.5 + 0.5,
        w2 = (straw * (1 - cov)) / a;
      r = lerp(lerp(214, 240, q), 168, w2);
      gg = lerp(lerp(224, 243, q), 154, w2);
      b = lerp(lerp(238, 246, q), 102, w2);
      a *= 0.94;
    } else if (s === 1) {
      // late summer: the south-facing grass dries toward hay
      if (kd !== 1) continue;
      a = 0.24 * smooth(0.4, 0.9, p) * clamp(0.35 + sf[o], 0, 1);
      r = 182;
      gg = 166;
      b = 96;
    } else if (s === 3) {
      // the first snow doesn't cover everything at once: bare ground shows through for most of a day
      // (south slopes hold it least), in ragged patches rather than whole fields at a time
      const tw = (0.7 - th[o]) * 0.3 + (nz[o] - 0.5) * 0.5 - 0.02;
      a = clamp((tw - p) / 0.1, 0, 1) * (kd === 3 ? 0.35 : 0.72) * ease;
      if (kd === 2) ((r = 118), (gg = 98), (b = 72));
      else ((r = 138), (gg = 132), (b = 100));
    }
    a *= k * (1 - open[o] * clear);
    if (a < 0.004) continue;
    const i4 = o * 4;
    d[i4] = r;
    d[i4 + 1] = gg;
    d[i4 + 2] = b;
    d[i4 + 3] = a * 255;
  }
  // padded, so the smooth upscale below has real neighbours at the edges instead of fading them out:
  // otherwise the snow thins to a visible line where the land wraps round east-west
  const pw = nw + 2 * GP,
    ph = nh + 2 * GP,
    id = c.createImageData(pw, ph),
    pd = id.data;
  for (let j = 0; j < ph; j++) {
    const sj = clamp(j - GP, 0, nh - 1);
    for (let i = 0; i < pw; i++) {
      const si = (i - GP + nw) % nw,
        a4 = (sj * nw + si) * 4,
        b4 = (j * pw + i) * 4;
      pd[b4] = d[a4];
      pd[b4 + 1] = d[a4 + 1];
      pd[b4 + 2] = d[a4 + 2];
      pd[b4 + 3] = d[a4 + 3];
    }
  }
  c.putImageData(id, 0, 0);
  // how much of the land's northern edge still lies under snow: the nearest ridge's foot follows it (light.js)
  {
    let sum = 0;
    for (let o = 0; o < nw * 2; o++) sum += d[o * 4 + 3] / 255;
    GROW.northSnow = s === 0 ? sum / (nw * 2) : 0;
  }
  // stretched straight onto the ground, bilinear filtering shows the cell grid as soft steps; a smooth
  // 4x upscale first turns them into rounded, organic edges
  const c2 = GROW.MC2.getContext('2d');
  c2.clearRect(0, 0, GROW.MC2.width, GROW.MC2.height);
  c2.imageSmoothingEnabled = true;
  c2.imageSmoothingQuality = 'high';
  c2.drawImage(GROW.MC, 0, 0, GROW.MC2.width, GROW.MC2.height);
}
// how much of the lingering spring snow still lies at (x, y), 0 to 1 - the same cover paintMask draws, so what
// the snow hides (a tractor going out to plough) can follow it. Bare ground in every other season.
function snowAt(x, y) {
  const C = GROW.cells;
  if (SEASON !== 0 || !C) return 0;
  const i = Math.floor((((x % W) + W) % W) / GQ),
    j = clamp(Math.floor(y / GQ), 0, C.nh - 1),
    o = j * C.nw + i;
  if (!C.kind[o]) return 0;
  const clear = lerp(0.7, 1, smooth(0, 0.2, GROW.p));
  return smooth(GROW.p - 0.035, GROW.p + 0.035, C.th[o]) * (1 - C.open[o] * clear);
}
// the snow left on a field: its middle and four points round it, averaged
function snowOnField(f) {
  let sum = 0;
  for (const [u, v] of [
    [0.5, 0.5],
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ])
    sum += snowAt(f.x + f.w * u, f.y + f.h * v);
  return sum / 5;
}
function maskState() {
  // Spring and winter start from where the season before left the ground.
  // Outgoing overlays now travel with the frozen ground snapshot.
  if (SEASON === 1 || SEASON === 0 || SEASON === 3) return [SEASON, GROW.p, 1];
  // The outgoing season's mask is baked into TRANS.prevG.
  return null;
}

/* ---------- trees ---------- */
function* buildLeafStagesGen() {
  const L2 = { bare: { birch: [], decid: [] }, bud: { birch: [], decid: [] } };
  for (const t of ['birch', 'decid'])
    for (let i = 0; i < NV; i++) {
      L2.bare[t][i] = makeSprite(t, i, SEASON, 'bare');
      if (SEASON === 0) L2.bud[t][i] = makeSprite(t, i, 0, 'bud');
      yield;
    }
  GROW.leaf = L2;
  GROW.leafSeason = SEASON;
}
/* draws what shows under a leafy tree's own sprite while it is leafing out (bare twigs, then the first small
   leaves) or dropping its leaves, and returns the alpha for the sprite itself */
function growUnder(t, x, y, w, h) {
  if (t.type === 'spruce' || !GROW.leaf || GROW.leafSeason !== SEASON || (SEASON !== 0 && SEASON !== 2)) return 1;
  const p = GROW.p,
    j = jit(Math.round(t.x * 0.37 + t.y * 1.3)) * 0.1;
  if (SEASON === 0) {
    const late = t.type === 'birch' ? 0 : 0.13, // birches break bud first
      e1 = smooth(0.1 + late + j, 0.3 + late + j, p),
      e2 = smooth(0.3 + late + j, 0.6 + late + j, p);
    if (e2 >= 1) return 1;
    const a0 = ctx.globalAlpha;
    // the budding sprite carries its own branches, so once it is fully in the bare one isn't needed
    if (e1 < 0.99) drawTrim(ctx, GROW.leaf.bare[t.type][t.v], x, y, w, h);
    if (e1 > 0.01) {
      ctx.globalAlpha = a0 * e1;
      drawTrim(ctx, GROW.leaf.bud[t.type][t.v], x, y, w, h);
      ctx.globalAlpha = a0;
    }
    return e2;
  }
  const fall = smooth(0.6 + j, 0.99, p) * (t.type === 'birch' ? 0.85 : 0.7);
  if (fall <= 0.01) return 1;
  drawTrim(ctx, GROW.leaf.bare[t.type][t.v], x, y, w, h);
  return 1 - fall;
}

/* ---------- per season and per frame ---------- */
function* growSeasonGen() {
  if (GROW.seed !== SEED) {
    GROW.seed = SEED;
    buildCells();
    for (const p of perches) if (p.type === 'bale') p.fi = FIELDS.indexOf(fieldAt(wrapX(p.x), p.y));
    for (const b of BALES) b.fi = FIELDS.indexOf(fieldAt(b.x, b.y));
  }
  yield* paintFieldStagesGen();
  if (SEASON === 0 || SEASON === 2) yield* buildLeafStagesGen();
  GROW.mKey = '';
  growTick(0);
}
function treeFoliage(t, season, progress) {
  if (t.type === 'spruce') return 1;
  if (season === 3) return 0;
  const tree = t.orig || t;
  const j = jit(Math.round(tree.x * 0.37 + tree.y * 1.3)) * 0.1;
  if (season === 0) {
    const late = t.type === 'birch' ? 0 : 0.13;
    return smooth(0.3 + late + j, 0.6 + late + j, progress);
  }
  if (season === 2) return 1 - smooth(0.6 + j, 0.99, progress) * (t.type === 'birch' ? 0.85 : 0.7);
  return 1;
}
// a forest's worth of perches, but their leaves only move with the season's progress (a season lasts minutes)
// and the crossfade: refresh them when either has moved enough to show, not every frame
const COVER = { p0: null, s: -1, n: -1, p: -1, e: -1 };
function updateTreeCover() {
  const e = TRANS.t < 1 ? tEase() : 1,
    C = COVER;
  if (
    C.p0 === perches[0] && // a new world makes new perches
    C.s === SEASON &&
    C.n === perches.length &&
    Math.abs(GROW.p - C.p) < 5e-4 &&
    Math.abs(e - C.e) < 0.01 &&
    (e === 1) === (C.e === 1)
  )
    return;
  Object.assign(C, { p0: perches[0], s: SEASON, n: perches.length, p: GROW.p, e });
  // a tree carries several perches; work its leaves out once (stamped with this refresh's progress)
  const k = GROW.p + SEASON * 2;
  for (const p of perches) {
    if (p.type !== 'tree' || !p.tree) continue;
    const t = p.tree;
    if (t.folK !== k) {
      t.folK = k;
      t.fol = treeFoliage(t, SEASON, GROW.p);
    }
    const incoming = t.fol;
    p.foliage = e < 1 ? lerp(p.leafBefore ?? incoming, incoming, e) : incoming;
    p.cover = p.foliage >= 0.45;
  }
}
function growTick(dt) {
  if (GROW.seed !== SEED || GROW.fsSeason !== SEASON) return;
  GROW.p = seasonP();
  updateTreeCover();
  for (let i = 0; i < FIELDS.length; i++)
    GROW.fa[i] = fieldStage(FIELDS[i], SEASON) ? fieldAlpha(i, SEASON, GROW.p) : 0;
  // the mask is small but not free: refresh it a few times a second at most, and only when it has moved
  GROW.mT -= dt;
  if (GROW.mT <= 0) {
    GROW.mT = 0.3;
    const ms = maskState(),
      key = ms ? ms.map(v => v.toFixed(3)).join() + tEase().toFixed(2) : 'none';
    if (key !== GROW.mKey) {
      GROW.mKey = key;
      if (ms) paintMask(...ms);
      GROW.maskOn = !!ms;
    }
  }
  // bales only lie on a field once it has been cut
  if (SEASON === 2)
    for (const p of perches) {
      if (p.type !== 'bale' || p.fi === undefined || p.fi < 0) continue;
      const off = !fieldHarvested(p.fi);
      if (off === !!p.off) continue;
      p.off = off;
      const b = p.occ;
      if (off && b) {
        p.occ = null;
        if (b.perch === p) {
          b.perch = null;
          if (b.state !== 'fly') b.state = 'fly';
        }
      }
    }
}
const baleShown = b => SEASON !== 2 || b.fi === undefined || b.fi < 0 || fieldHarvested(b.fi);
// drawn right after the ground texture, in world units, for the part of it in view
function growGround(sx, sy, ex, ey, ctx = cv.getContext('2d')) {
  if (BG_JOB) return;
  if (GROW.fsSeason !== SEASON || GROW.seed !== SEED) return;
  FIELDS.forEach((f, i) => {
    const a = GROW.fa[i],
      c = GROW.fc[i];
    if (!c || !(a > 0.004)) return;
    // clipped to this copy of the land, so a field across the seam is drawn once, half on each side
    for (const ox of [0, W, -W]) {
      const x0 = Math.max(sx, f.x + ox),
        x1 = Math.min(ex, f.x + f.w + ox),
        y0 = Math.max(sy, f.y),
        y1 = Math.min(ey, f.y + f.h);
      if (x1 <= x0 || y1 <= y0) continue;
      ctx.globalAlpha = a * (SEASON === 2 ? tEase() : 1);
      ctx.drawImage(
        c,
        (x0 - f.x - ox) * S + 1,
        (y0 - f.y) * S + 1,
        (x1 - x0) * S,
        (y1 - y0) * S,
        x0,
        y0,
        x1 - x0,
        y1 - y0
      );
    }
  });
  ctx.globalAlpha = 1;
  if (GROW.maskOn) {
    const q = GUP / GQ,
      M = GROW.MC2,
      m = ctx.getTransform(),
      X = x => Math.round(m.a * x + m.e);
    // at the east-west seam two copies of the mask meet; if each drew up to the seam with soft edges, the
    // two half-covered pixels would let the green under the snow show through as a thin line. So clip each
    // copy to whole device pixels and let it run a little past its own edge, into the wrapped padding
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(X(sx), 0, X(ex) - X(sx), ctx.canvas.height);
    ctx.clip();
    ctx.setTransform(m);
    ctx.imageSmoothingEnabled = true;
    const o = GP * GUP;
    ctx.drawImage(M, (sx - 4) * q + o, sy * q + o, (ex - sx + 8) * q, (ey - sy) * q, sx - 4, sy, ex - sx + 8, ey - sy);
    ctx.restore();
  }
}
