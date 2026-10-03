/* Flokk - waves.js
   Wind on open water (lakes, the pond and the fjord): the same wind field the grass and trees feel (gustAt) raises
   waves on the surface. Crests, troughs and white caps are the contour lines of a travelling wave height field whose
   amplitude follows the wind: a gust is a patch of waves drifting across the lake, a lull is glass, the lee of a shore
   stays calm, and in a gale the crests pile up into broken caps with foam streaked back along the wind. A hard wind
   also greys the water, and breakers run in along the fjord shore.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const WV = {
  LX: 10, // the wave field is sampled on a lattice 10 wide, 7 deep (ground units); a block of 4 shares one gust reading
  LY: 7,
  B: 4,
  y0: 700,
  nx: 0,
  ny: 0,
  key: null,
  ws: null,
  fk: null,
  ft: null,
  rs: null,
  rt: null,
  ncx: 0
};
function waveGrid() {
  if (WV.ws && WV.key === NS + ':' + LAKE.x + ':' + POND.x) return;
  WV.key = NS + ':' + LAKE.x + ':' + POND.x;
  WV.nx = Math.ceil(W / WV.LX);
  WV.ny = Math.ceil((H + 1300 - WV.y0) / WV.LY);
  const n = WV.nx * WV.ny;
  WV.ws = new Float32Array(n).fill(-1); // how deep into the water a node is, 0 at the shore to 1 well out
  WV.fk = new Float32Array(n).fill(1); // how much of the wind the shore upwind lets through
  WV.ft = new Float32Array(n).fill(-9);
  WV.ncx = Math.ceil(WV.nx / WV.B) + 2;
  const nc = WV.ncx * (Math.ceil(WV.ny / WV.B) + 2);
  WV.rs = new Float32Array(nc); // the wind amplitude as the water has settled to it, per block corner
  WV.rt = new Float32Array(nc).fill(-9);
}
// 0 on land and at the water's edge, up to 1 a little way out (lake, pond or fjord)
function waveDepth(x, y) {
  const sy = shoreY(x);
  if (y > sy) return smooth(0, 26, y - sy);
  let d = -9;
  for (const [c, rf] of [
    [LAKE, lakeR],
    [POND, pondR]
  ]) {
    if (c.x < -1000) continue;
    const dx = wdx(x, c.x),
      dy = y - c.y;
    if (dx * dx + dy * dy > (c.r * 1.45) ** 2) continue;
    d = Math.max(d, rf(Math.atan2(dy, dx)) - Math.sqrt(dx * dx + dy * dy));
  }
  return smooth(6, 44, d);
}
/* the sea state out of the wind: the breeze plus the gust over the spot */
const waveRough = (x, y) => clamp(0.5 * WEATHER.s + gustAt(x, y), 0, 1.4);

/* Crests are the contour lines of a wave height field: three wave trains running a little off the wind's line,
   at different wavelengths, with their phase warped so the lines never lie straight, and an amplitude that follows
   the wind field (waveRough: a gust is a patch of waves, a lull is glass) and falls to nothing at the shore.
   Marching squares over the lattice turns that field into light crest lines, dark trough lines and, where the
   crests pile up in a gale, broken white caps with foam streaks laid back along the wind. */
function drawWaves(ctx) {
  if (winterW() >= 0.5) return;
  const W2 = WEATHER,
    s = W2.s;
  waveGrid();
  // the sea does not follow every shift of the wind at once: the wave direction, speed and the wind amplitude
  // each settle slowly, so the crests keep their course and the water doesn't flicker as the gusts sweep by
  const dtv = WV.init && T >= WV.lt && T - WV.lt < 0.5 ? T - WV.lt : 0,
    wa = Math.atan2(W2.gs, W2.gc);
  WV.lt = T;
  if (!WV.init || !dtv) {
    WV.th = wa;
    WV.sm = s;
    if (!WV.init) WV.tw = 0;
    WV.init = 1;
  } else {
    const da = ((((wa - WV.th + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
    WV.th += da * (1 - Math.exp(-dtv / 45));
    WV.sm += (s - WV.sm) * (1 - Math.exp(-dtv / 10));
  }
  WV.tw += dtv * (0.8 + 0.4 * Math.min(1.5, WV.sm)); // the waves' own clock: its rate eases, so their phase never jumps
  const { LX, LY, B, y0, nx, ny, ws, fk, ft, rs, rt, ncx } = WV;
  const midX = (V.x0 + V.x1) / 2;
  const lakeNear = [LAKE, POND].some(
    c => c.x > -1000 && Math.abs(wdx(c.x, midX)) < c.r * 1.45 + (V.x1 - V.x0) / 2 + 20
  );
  const seaNear = V.py1 / TILT > H - 300;
  if (!lakeNear && !seaNear) return;
  const ix0 = Math.floor((V.x0 - 20) / LX / B) * B,
    ix1 = Math.ceil((V.x1 + 20) / LX),
    iy0 = Math.max(0, Math.floor((V.py0 / TILT - 20 - y0) / LY / B) * B),
    iy1 = Math.min(ny - 1, Math.ceil((V.py1 / TILT + 20 - y0) / LY));
  const vw = ix1 - ix0 + 1,
    vh = iy1 - iy0 + 1;
  if (vw < 2 || vh < 2 || vw * vh > 40000) return;
  // wind amplitude at the corners of the 4x4 blocks, with the lee-of-the-shore factor, then blended across each block
  const cw = Math.ceil((vw - 1) / B) + 1,
    ch = Math.ceil((vh - 1) / B) + 1,
    rc = new Float32Array(cw * ch),
    wpc = new Float32Array(cw * ch),
    g0c = new Float32Array(cw * ch),
    g1c = new Float32Array(cw * ch);
  const gc = Math.cos(WV.th),
    gs = Math.sin(WV.th),
    ox = LAKE.x > -1000 ? LAKE.x : W / 2, // phases are measured from the lake, so a turn of the wave direction stays small where it is looked at
    oy = LAKE.x > -1000 ? LAKE.y : H;
  for (let cj = 0; cj < ch; cj++)
    for (let ci = 0; ci < cw; ci++) {
      const lx = ix0 + ci * B,
        ly = Math.min(ny - 1, iy0 + cj * B),
        x = lx * LX,
        y = y0 + ly * LY,
        ni = (((lx % nx) + nx) % nx) + ly * nx;
      let w = ws[ni];
      if (w < 0) w = ws[ni] = waveDepth(x, y);
      let r;
      {
        r = waveRough(x, y);
        if (y < shoreY(x)) {
          if (T - ft[ni] > 1.5 + (ni % 7) * 0.2 || ft[ni] > T) {
            ft[ni] = T;
            let n = 0;
            for (const d of [40, 110, 220]) if (inWater(x - gc * d, y - gs * d, 0)) n++;
            fk[ni] = 0.4 + 0.2 * n;
          }
          r *= fk[ni];
        }
      }
      {
        const kk = (((lx % nx) + nx) % nx) / B + (iy0 / B + cj) * ncx,
          dk = T - rt[kk];
        if (dk > 0.6 || dk < 0) rs[kk] = r;
        else rs[kk] += (r - rs[kk]) * (1 - Math.exp(-dk / 1.6));
        rt[kk] = T;
        r = rs[kk];
      }
      rc[cj * cw + ci] = r;
      // the phase warp that keeps crests from lying straight, and the wave-group envelopes of each train
      wpc[cj * cw + ci] =
        3.2 * Math.sin(x * 0.0091 + y * 0.0127 + T * 0.19) +
        1.5 * Math.sin(x * 0.021 - y * 0.017 - T * 0.31) +
        0.8 * Math.sin(x * 0.043 + y * 0.037 + T * 0.4);
      for (let t = 0; t < 2; t++) {
        const gk = t ? 0.023 : 0.0151;
        (t ? g1c : g0c)[cj * cw + ci] =
          (0.5 + 0.5 * Math.sin((x * gs - y * gc) * gk + 1.3 + 2.1 * t + 0.9 * Math.sin(T * 0.06 + x * 0.004 + t))) *
          (0.55 + 0.45 * Math.sin((x * gc + y * gs) * 0.011 - T * 0.12 * (1 + t) + 4.1 * t));
      }
    }
  let top = 0;
  for (let k = 0; k < rc.length; k++) if (rc[k] > top) top = rc[k];
  if (top < 0.15) return; // glass: nothing to draw
  const dim0 = 1 - 0.45 * LIGHT.night;
  // two wave trains: a long swell across the wind and a shorter chop at an angle to it. Wavelength grows with the wind
  const th0 = WV.th,
    TR = [
      [th0, 46, 1, 0.0151],
      [th0 + 0.5, 30, 0.35, 0.023]
    ].map(([th, lam, wgt, gk]) => {
      const k = TAU / lam,
        c = 14 * Math.sqrt(lam / 30);
      return { kx: Math.cos(th) * k, ky: Math.sin(th) * k, om: k * c, wgt, gk };
    });
  // per node: the amplitude (wind, shore, and wave groups so a crest runs a while and dies away) and the phase of
  // each train in turns, so a crest is the line where the phase crosses a whole number
  if (!WV.buf || WV.buf[0].length < vw * vh) WV.buf = [0, 1, 2, 3].map(() => new Float32Array(40000));
  const amp = [WV.buf[0].fill(0, 0, vw * vh), WV.buf[1].fill(0, 0, vw * vh)],
    ph = [WV.buf[2].fill(0, 0, vw * vh), WV.buf[3].fill(0, 0, vw * vh)];
  let any = 0;
  const bl = (arr, k0, fx, fy) =>
    (arr[k0] * (1 - fx) + arr[k0 + 1] * fx) * (1 - fy) + (arr[k0 + cw] * (1 - fx) + arr[k0 + cw + 1] * fx) * fy;
  for (let j = 0; j < vh; j++) {
    const ly = iy0 + j,
      y = y0 + ly * LY,
      cj = (j / B) | 0,
      fy = (j % B) / B;
    for (let i = 0; i < vw; i++) {
      const lx = ix0 + i,
        x = lx * LX,
        o = j * vw + i,
        ci = (i / B) | 0,
        fx = (i % B) / B,
        k0 = cj * cw + ci,
        warp = bl(wpc, k0, fx, fy);
      // the phase is defined everywhere; only the amplitude is held to the water
      for (let t = 0; t < 2; t++)
        ph[t][o] = (TR[t].kx * (x - ox) + TR[t].ky * (y - oy) - TR[t].om * WV.tw + warp * (1 + 0.5 * t)) / TAU;
      const ni = (((lx % nx) + nx) % nx) + ly * nx;
      let w = ws[ni];
      if (w < 0) w = ws[ni] = waveDepth(x, y);
      if (w <= 0) continue;
      const r = bl(rc, k0, fx, fy);
      if (r < 0.15) continue;
      amp[0][o] = r * w * TR[0].wgt * (0.12 + 1.15 * bl(g0c, k0, fx, fy));
      amp[1][o] = r * w * TR[1].wgt * (0.12 + 1.15 * bl(g1c, k0, fx, fy));
      any = 1;
    }
  }
  if (!any) return;
  // the surface shaded: light where the water leans toward the sky, dark in the troughs, drawn soft from a small
  // offscreen picture with one pixel per lattice node
  {
    if (!WV.cv || WV.cv.width !== vw || WV.cv.height !== vh) {
      WV.cv = document.createElement('canvas');
      WV.cv.width = vw;
      WV.cv.height = vh;
      WV.cx = WV.cv.getContext('2d');
      WV.img = WV.cx.createImageData(vw, vh);
      WV.px = new Uint32Array(WV.img.data.buffer);
    }
    const px = WV.px,
      A0 = amp[0],
      A1 = amp[1],
      P0 = ph[0],
      P1 = ph[1],
      kl = (0.3 + 0.18 * Math.min(1.5, WV.sm)) * dim0,
      kd = (0.24 + 0.15 * Math.min(1.5, WV.sm)) * dim0;
    for (let o = 0; o < vw * vh; o++) {
      if (A0[o] === 0 && A1[o] === 0) {
        px[o] = 0;
        continue;
      }
      const h = A0[o] * Math.cos(P0[o] * TAU) + A1[o] * Math.cos(P1[o] * TAU);
      px[o] =
        h > 0
          ? (((Math.min(1.2, h) * kl * 255) | 0) << 24) | 0x00eef4e8
          : (((Math.min(1.2, -h) * kd * 255) | 0) << 24) | 0x00332a0e;
    }
    WV.cx.putImageData(WV.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(WV.cv, ix0 * LX - LX / 2, y0 + iy0 * LY - LY / 2, vw * LX, vh * LY);
  }
  // white water: only where the wind is really up, and only as foam on the crest, in patches that come and go
  // slowly, thickest at the heart and thinning to nothing at the edges, with a streak trailing back along the wind
  const lc = ctx.strokeStyle,
    sm = WV.sm,
    strong = sm > 0.8,
    thr = 0.44 - 0.1 * Math.min(1, sm - 0.8),
    tw = WV.tw,
    NT = 3,
    cap = Array.from({ length: NT }, () => new Path2D()),
    streak = Array.from({ length: NT }, () => new Path2D()),
    sl = 6 + 8 * Math.min(1.3, sm);
  if (strong) {
    const A = amp[0],
      Q = ph[0];
    for (let j = 0; j < vh - 1; j++)
      for (let i = 0; i < vw - 1; i++) {
        const o = j * vw + i,
          am = (A[o] + A[o + 1] + A[o + vw] + A[o + vw + 1]) / 4;
        if (am < thr) continue;
        const qa = Q[o],
          qb = Q[o + 1],
          qc = Q[o + vw + 1],
          qd = Q[o + vw],
          lo = Math.min(qa, qb, qc, qd),
          hi = Math.max(qa, qb, qc, qd),
          x = (ix0 + i) * LX,
          y = y0 + (iy0 + j) * LY,
          // foam patches drift over the crests as slowly changing noise; strength is the wave's height times the patch
          pf =
            0.5 + 0.5 * Math.sin(x * 0.052 + y * 0.037 + tw * 0.3) * Math.sin(x * 0.031 - y * 0.047 - tw * 0.2 + 1.7),
          f = am * (0.35 + 0.9 * pf);
        if (f < thr) continue;
        const tier = f > thr + 0.5 ? 2 : f > thr + 0.22 ? 1 : 0;
        for (let L0 = Math.ceil(lo); L0 <= Math.floor(hi); L0++) {
          const a = qa - L0,
            b = qb - L0,
            c = qc - L0,
            d = qd - L0,
            idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
          if (idx === 0 || idx === 15) continue;
          const T_ = () => [x + (LX * -a) / (b - a), y],
            R_ = () => [x + LX, y + (LY * -b) / (c - b)],
            B_ = () => [x + (LX * -d) / (c - d), y + LY],
            L_ = () => [x, y + (LY * -a) / (d - a)];
          const seg = (p, q) => {
            cap[tier].moveTo(p[0], p[1]);
            cap[tier].lineTo(q[0], q[1]);
            // a trailing streak from some points along the crest, picked by where they lie so they keep to the crest
            const g = Math.sin(p[0] * 0.37 + p[1] * 0.53);
            if (g > 0.82) {
              const u = 0.4 + 0.6 * (g - 0.82),
                st = streak[0];
              st.moveTo(p[0], p[1]);
              st.lineTo(p[0] - gc * sl * u * (0.5 + f), p[1] - gs * sl * u * (0.5 + f));
            }
          };
          switch (idx) {
            case 1:
            case 14:
              seg(L_(), T_());
              break;
            case 2:
            case 13:
              seg(T_(), R_());
              break;
            case 3:
            case 12:
              seg(L_(), R_());
              break;
            case 4:
            case 11:
              seg(R_(), B_());
              break;
            case 6:
            case 9:
              seg(T_(), B_());
              break;
            case 7:
            case 8:
              seg(L_(), B_());
              break;
            default: {
              // saddle: join along the diagonal the cell's centre favours
              const hiC = (a + b + c + d) / 4 > 0;
              if ((idx === 5) === hiC) {
                seg(T_(), R_());
                seg(L_(), B_());
              } else {
                seg(L_(), T_());
                seg(R_(), B_());
              }
            }
          }
        }
      }
    const dim = 1 - 0.45 * LIGHT.night;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#F4FAF8';
    for (let t = 0; t < NT; t++) {
      // a broad faint pass, a softer one and a bright core, so the foam is a patch with body and no hard edge
      ctx.lineWidth = 8;
      ctx.globalAlpha = (0.025 + 0.03 * t) * dim;
      ctx.stroke(cap[t]);
      ctx.lineWidth = 4;
      ctx.globalAlpha = (0.06 + 0.07 * t) * dim;
      ctx.stroke(cap[t]);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = (0.1 + 0.12 * t) * dim;
      ctx.stroke(cap[t]);
    }
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.07 * dim;
    ctx.stroke(streak[0]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = lc;
    ctx.lineWidth = 2;
  }
}

/* under it all: a hard wind greys and darkens the water, and breakers run in along the fjord shore */
function drawWaterMood(ctx) {
  if (winterW() >= 0.5) return;
  const s = WEATHER.s,
    k = smooth(0.55, 1.5, s);
  if (k <= 0.01) return;
  const dim = 1 - 0.4 * LIGHT.night;
  ctx.fillStyle = '#1B3640';
  ctx.globalAlpha = 0.2 * k * dim;
  for (const [c, rf] of [
    [LAKE, lakeR],
    [POND, pondR]
  ]) {
    if (c.x < -1000 || !visG(c.x, c.y, c.r * 1.4)) continue;
    blobPath(ctx, c.x, c.y, rf, -2, 90);
    ctx.fill();
  }
  if (V.py1 / TILT > H - 400) {
    const y1 = V.py1 / TILT + 60,
      x0 = Math.floor((V.x0 - 20) / 16) * 16;
    ctx.beginPath();
    ctx.moveTo(V.x0 - 20, y1);
    for (let x = x0; x <= V.x1 + 36; x += 16) ctx.lineTo(x, shoreY(x));
    ctx.lineTo(V.x1 + 36, y1);
    ctx.closePath();
    ctx.fill();
    // breakers: bands of surf lift out of the swell and run shoreward, and spend themselves in a line of foam
    const n = 3,
      amt = clamp(0.25 + 0.7 * s, 0, 1.3);
    ctx.lineCap = 'round';
    for (let b = 0; b < n; b++) {
      const ph = (T * (0.07 + 0.05 * s) + b / n) % 1,
        off = 8 + 90 * (1 - ph),
        fade = Math.sin(Math.PI * Math.min(1, ph * 1.15));
      ctx.beginPath();
      for (let x = x0; x <= V.x1 + 36; x += 14) {
        const y = shoreY(x) + off + 5 * Math.sin(x * 0.021 + T * 0.4 + b * 2.3) + 3 * Math.sin(x * 0.07 - T * 0.7);
        x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#E8F4EE';
      ctx.lineWidth = 1.2 + 1.6 * ph;
      ctx.globalAlpha = (0.05 + 0.17 * ph * ph) * fade * amt * dim;
      ctx.setLineDash([26 + 30 * ph, 10 + 16 * (1 - ph)]);
      ctx.lineDashOffset = -T * 4 * b;
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}
