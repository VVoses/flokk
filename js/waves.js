/* Flokk - waves.js
   Wind on open water (lakes, the pond and the fjord): the same wind field the grass and trees feel (gustAt) raises
   waves on the surface. Crests, troughs and white caps are the contour lines of a travelling wave height field whose
   amplitude follows the wind: a gust is a patch of waves drifting across the lake, a lull is glass, the lee of a shore
   stays calm, and in a gale the crests pile up into broken caps with foam streaked back along the wind. A hard wind
   also greys the water, and breakers run in along the fjord shore.
   Where there is a GPU the surface itself is a fragment shader (see waveShader below): the same smoothed wind
   amplitude, direction and wave clock, but a fluid height field with a normal and light per pixel and soft foam.
   Without one the lattice and marching squares below draw it on the 2D canvas.
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
const waveRough = (x, y) => clamp(0.5 * (WV.init ? WV.sm : WEATHER.s) + gustAt(x, y), 0, 1.4);

/* Crests are the contour lines of a wave height field: three wave trains running a little off the wind's line,
   at different wavelengths, with their phase warped so the lines never lie straight, and an amplitude that follows
   the wind field (waveRough: a gust is a patch of waves, a lull is glass) and falls to nothing at the shore.
   Marching squares over the lattice turns that field into light crest lines, dark trough lines and, where the
   crests pile up in a gale, broken white caps with foam streaks laid back along the wind. */
/* The state of the sea, once a frame: the wave direction, the wave clock and the sea state itself (WV.sm). The sea does
   not follow the wind at once. It builds with some inertia as the weather turns up, and keeps its swell for a long while
   after the wind drops; but a hard jump in the wind (a squall, a gale arriving) brings it up much faster, so a real change
   of weather is still dramatic. The gusts riding on top are settled separately, block by block, over a few seconds. */
function waveState() {
  const W2 = WEATHER,
    wa = Math.atan2(W2.gs, W2.gc);
  if (!WV.init || T < WV.lt || T - WV.lt > 2) {
    WV.th = wa;
    WV.sm = W2.s;
    if (!WV.init) WV.tw = 0;
    WV.init = 1;
    WV.lt = T;
    return;
  }
  const dtv = Math.min(0.5, T - WV.lt);
  if (dtv <= 0) return;
  WV.lt = T;
  const da = ((((wa - WV.th + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  WV.th += da * (1 - Math.exp(-dtv / 45));
  const d = W2.s - WV.sm,
    tau = d > 0 ? 30 / (1 + 3 * Math.max(0, d - 0.25)) : 75;
  WV.sm += d * (1 - Math.exp(-dtv / tau));
  WV.tw += dtv * (0.8 + 0.4 * Math.min(1.5, WV.sm)); // the waves' own clock: its rate eases, so their phase never jumps
}
// the water freezes with the winter transition: the waves fade out as it goes, not at one instant
const waveFreeze = () => 1 - smooth(0.2, 0.5, winterW());
function drawWaves(ctx) {
  const wf = waveFreeze();
  if (wf < 0.02) return;
  waveGrid();
  const glm = waveGLInit();
  waveState();
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
        if (dk > 1.5 || dk < 0) rs[kk] = r;
        else rs[kk] += (r - rs[kk]) * (1 - Math.exp(-dk / 6)); // a gust lifts the sea over several seconds, never flips it
        rt[kk] = T;
        r = rs[kk];
      }
      rc[cj * cw + ci] = r * wf;
      if (glm) continue;
      // the phase warp that keeps crests from lying straight, and the wave-group envelopes of each train
      wpc[cj * cw + ci] =
        3.2 * Math.sin(x * 0.0091 + y * 0.0127 + T * 0.07) +
        1.5 * Math.sin(x * 0.021 - y * 0.017 - T * 0.11) +
        0.8 * Math.sin(x * 0.043 + y * 0.037 + T * 0.14);
      for (let t = 0; t < 2; t++) {
        const gk = t ? 0.023 : 0.0151;
        (t ? g1c : g0c)[cj * cw + ci] =
          (0.5 + 0.5 * Math.sin((x * gs - y * gc) * gk + 1.3 + 2.1 * t + 0.9 * Math.sin(T * 0.02 + x * 0.004 + t))) *
          (0.55 + 0.45 * Math.sin((x * gc + y * gs) * 0.011 - T * 0.04 * (1 + t) + 4.1 * t));
      }
    }
  let top = 0;
  for (let k = 0; k < rc.length; k++) if (rc[k] > top) top = rc[k];
  if (top < 0.06) return; // glass: nothing to draw
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
  if (glm && (!WV.tex || WV.tex.length < vw * vh)) WV.tex = new Uint8Array(40000);
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
      if (glm) {
        const ni = (((lx % nx) + nx) % nx) + ly * nx;
        let w = ws[ni];
        if (w < 0) w = ws[ni] = waveDepth(x, y);
        const r = w > 0 ? bl(rc, k0, fx, fy) : 0;
        WV.tex[o] = r < 0.04 ? 0 : Math.min(255, ((r * smooth(0.04, 0.4, r) * w * 255) / 1.4 + 0.5) | 0);
        if (WV.tex[o]) any = 1;
        continue;
      }
      // the phase is defined everywhere; only the amplitude is held to the water
      for (let t = 0; t < 2; t++)
        ph[t][o] = (TR[t].kx * (x - ox) + TR[t].ky * (y - oy) - TR[t].om * WV.tw + warp * (1 + 0.5 * t)) / TAU;
      const ni = (((lx % nx) + nx) % nx) + ly * nx;
      let w = ws[ni];
      if (w < 0) w = ws[ni] = waveDepth(x, y);
      if (w <= 0) continue;
      const r = bl(rc, k0, fx, fy);
      if (r < 0.04) continue;
      const rf = r * smooth(0.04, 0.4, r); // waves rise out of glass instead of switching on
      amp[0][o] = rf * w * TR[0].wgt * (0.12 + 1.15 * bl(g0c, k0, fx, fy));
      amp[1][o] = rf * w * TR[1].wgt * (0.12 + 1.15 * bl(g1c, k0, fx, fy));
      any = 1;
    }
  }
  if (!any) return;
  if (glm) return waveShader(ctx, glm, { ix0, iy0, vw, vh, th: th0, dim: dim0 });
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
    fade = smooth(0.65, 1.05, sm), // foam fades in with the wind rather than switching on
    strong = fade > 0.01,
    thr = 0.4 - 0.08 * Math.min(1, sm - 0.8),
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
            0.5 + 0.5 * Math.sin(x * 0.052 + y * 0.037 + tw * 0.15) * Math.sin(x * 0.031 - y * 0.047 - tw * 0.1 + 1.7),
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
      ctx.globalAlpha = (0.025 + 0.03 * t) * dim * fade;
      ctx.stroke(cap[t]);
      ctx.lineWidth = 4;
      ctx.globalAlpha = (0.06 + 0.07 * t) * dim * fade;
      ctx.stroke(cap[t]);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = (0.1 + 0.12 * t) * dim * fade;
      ctx.stroke(cap[t]);
    }
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.07 * dim * fade;
    ctx.stroke(streak[0]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = lc;
    ctx.lineWidth = 2;
  }
}

/* under it all: a hard wind greys and darkens the water, and breakers run in along the fjord shore */
function drawWaterMood(ctx) {
  const wf = waveFreeze();
  if (wf < 0.02) return;
  waveState();
  const s = WV.sm,
    k = smooth(0.55, 1.5, s) * wf;
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

/* The GPU surface. Each pixel of the water adds up eight travelling waves (fixed wavelengths, a spread of directions
   about the wind, the longer ones always present and the short chop rising with the gust amplitude), keeps the
   slope of the sum for a normal, and lights it: facets that lean toward the sky go pale, those that lean away go
   dark, all soft and matte. In a hard wind the highest crests lighten a little in patches that drift over the sea.
   The wind amplitude comes in as a small texture, one texel per lattice node, that the CPU side has already settled
   and shaped to the shore, so the shader sees nothing sudden. */
const WAVE_FS = `#version 300 es
precision highp float;
#define LX ${WV.LX}.0
#define LY ${WV.LY}.0
#define Y0 ${WV.y0}.0
uniform vec4 W[8];
uniform vec4 xf;
uniform vec4 ti;
uniform vec2 org;
uniform vec4 st;
uniform vec3 mix3;
uniform sampler2D tex;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vec2((gl_FragCoord.x - xf.z) / xf.x, ((st.w - gl_FragCoord.y) - xf.w) / xf.y);
  vec2 uv = vec2(((p.x / LX - ti.x) + 0.5) / ti.y, (((p.y - Y0) / LY - ti.z) + 0.5) / ti.w);
  float R = texture(tex, uv).r * 1.4;
  if (R < 0.01) discard;
  vec2 q = p - org;
  float T = st.z, tw = st.y, sm = st.x;
  float a1 = p.x * 0.0091 + p.y * 0.0127 + T * 0.07, a2 = p.x * 0.021 - p.y * 0.017 + T * 0.11, a3 = p.x * 0.043 + p.y * 0.037 + T * 0.14;
  float wp = 3.2 * sin(a1) + 1.5 * sin(a2) + 0.8 * sin(a3);
  vec2 dwp = 3.2 * cos(a1) * vec2(0.0091, 0.0127) + 1.5 * cos(a2) * vec2(0.021, -0.017) + 0.8 * cos(a3) * vec2(0.043, 0.037);
  float h = 0.0;
  vec2 g = vec2(0.0);
  float hmax = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 w = W[i];
    float fi = float(i);
    float k = length(w.xy);
    vec2 pd = w.xy / k;
    float u = dot(p, vec2(-pd.y, pd.x)), v = dot(p, pd);
    float grp = 0.12 + 1.15 * (0.5 + 0.5 * sin(u * (0.012 + 0.004 * fi) + 1.3 + 2.1 * fi + 0.9 * sin(T * 0.02 + p.x * 0.004 + fi)))
              * (0.55 + 0.45 * sin(v * 0.011 - T * 0.04 * (1.0 + fi * 0.3) + 4.1 * fi));
    float chop = i < 3 ? 1.0 : smoothstep(0.2 + 0.05 * fi, 1.0 + 0.05 * fi, R);
    float odd = 1.0 + 0.5 * mod(fi, 2.0);
    float ph = dot(w.xy, q) + w.z + wp * odd;
    float a = w.w * R * grp * chop;
    h += a * (cos(ph) + 0.22 * cos(2.0 * ph + 0.5));
    g += -a * (sin(ph) + 0.44 * sin(2.0 * ph + 0.5)) * (w.xy + odd * dwp);
    hmax += a * 1.2;
  }
  vec3 n = normalize(vec3(-g * 1.4, 1.0));
  vec3 L = normalize(vec3(-0.4, -0.55, 0.73));
  float d = dot(n, L) - L.z;
  float kl = (0.28 + 0.14 * min(1.5, sm)) * mix3.x, kd = (0.22 + 0.12 * min(1.5, sm)) * mix3.x;
  float al = d > 0.0 ? (1.0 - exp(-d * 3.2)) * kl : 0.0; // saturates softly, so no facet ever blazes
  float ad = d < 0.0 ? (1.0 - exp(d * 3.2)) * kd : 0.0;
  // foam on the highest crests, in drifting patches, only in a hard wind
  float hn = h / max(hmax, 0.001);
  vec2 np = q * 0.045 + vec2(tw * 0.03, -tw * 0.02);
  float pf = vnoise(np) * 0.65 + vnoise(np * 2.3 + 7.0) * 0.35;
  float lace = 0.7 + 0.3 * vnoise(q * 0.22 + tw * 0.05);
  float thr = 0.24 - 0.06 * min(1.0, max(0.0, sm - 0.8));
  float f = smoothstep(thr, thr + 0.6, hn * (0.5 + 0.8 * pf)) * mix3.y * lace;
  vec3 lc = vec3(0.78, 0.88, 0.86), dc = vec3(0.055, 0.165, 0.2), fc = vec3(0.86, 0.93, 0.92);
  float aw = al;
  vec3 rgb = lc * aw + dc * ad;
  float a = aw + ad;
  float fa = f * f * 0.3 * mix3.x; // foam is only a lightening of the crest, never a white edge
  rgb = rgb * (1.0 - fa) + fc * fa;
  a = a * (1.0 - fa) + fa;
  o = vec4(rgb, a);
}`;
const WAVE_VS = `#version 300 es
layout(location=0) in vec2 c;
void main() { gl_Position = vec4(c * 2.0 - 1.0, 0.0, 1.0); }`;
const WAVES_GL = { tried: false, gl: null, cv: null, prog: null, tx: null, u: {} };
function waveGLInit() {
  const G = WAVES_GL;
  if (G.tried) return G.gl && G.gl.isContextLost() ? null : G.gl;
  G.tried = true;
  const c = document.createElement('canvas');
  let gl = null;
  try {
    gl = c.getContext('webgl2', { premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  // a software WebGL would be slower than the lattice it replaces
  const dbg = gl.getExtension('WEBGL_debug_renderer_info'),
    rn = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|softpipe|software/i.test(rn) && !(DEV && (DEV.glWaves || DEV.glBlades))) return null;
  try {
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, WAVE_VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, WAVE_FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    G.prog = p;
    for (const n of ['W', 'xf', 'ti', 'org', 'st', 'mix3', 'tex']) G.u[n] = gl.getUniformLocation(p, n);
  } catch (e) {
    console.warn('Flokk: GPU waves unavailable, drawing them on the 2D canvas', e);
    return null;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  G.tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, G.tx);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  c.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    G.gl = null; // back to the 2D lattice
  });
  G.cv = c;
  G.gl = gl;
  return gl;
}
// WV.tex holds the settled wind amplitude per lattice node of the window; draw the water's surface over it
function waveShader(ctx, gl, o) {
  const G = WAVES_GL,
    c = G.cv,
    m = ctx.getTransform(),
    { LX, LY, y0 } = WV;
  if (c.width !== cv.width || c.height !== cv.height) {
    c.width = cv.width;
    c.height = cv.height;
  }
  // the part of the frame the window covers
  const xa = m.a * o.ix0 * LX + m.e,
    xb = m.a * (o.ix0 + o.vw) * LX + m.e,
    ya = m.d * (y0 + o.iy0 * LY) + m.f,
    yb = m.d * (y0 + (o.iy0 + o.vh) * LY) + m.f,
    sx = Math.max(0, Math.floor(Math.min(xa, xb))),
    sy = Math.max(0, Math.floor(Math.min(ya, yb))),
    sw = Math.min(c.width, Math.ceil(Math.max(xa, xb))) - sx,
    sh = Math.min(c.height, Math.ceil(Math.max(ya, yb))) - sy;
  if (sw < 1 || sh < 1) return;
  const th = o.th,
    sm = WV.sm,
    ox = LAKE.x > -1000 ? LAKE.x : W / 2,
    oy = LAKE.x > -1000 ? LAKE.y : H,
    { LAM, OFF, WT } = WAVE_TR,
    Wd = new Float32Array(32);
  for (let i = 0; i < 8; i++) {
    const k = TAU / LAM[i],
      c0 = 14 * Math.sqrt(LAM[i] / 30),
      a = th + OFF[i];
    Wd[i * 4] = Math.cos(a) * k;
    Wd[i * 4 + 1] = Math.sin(a) * k;
    Wd[i * 4 + 2] = (((-k * c0 * WV.tw) % TAU) + TAU) % TAU;
    Wd[i * 4 + 3] = 0.035 * LAM[i] * WT[i];
  }
  gl.viewport(0, 0, c.width, c.height);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(sx, c.height - sy - sh, sw, sh);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(G.prog);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, G.tx);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, o.vw, o.vh, 0, gl.RED, gl.UNSIGNED_BYTE, WV.tex.subarray(0, o.vw * o.vh));
  gl.uniform1i(G.u.tex, 0);
  gl.uniform4fv(G.u.W, Wd);
  gl.uniform4f(G.u.xf, m.a, m.d, m.e, m.f);
  gl.uniform4f(G.u.ti, o.ix0, o.vw, o.iy0, o.vh);
  gl.uniform2f(G.u.org, ox, oy);
  gl.uniform4f(G.u.st, sm, WV.tw, T, c.height);
  gl.uniform3f(G.u.mix3, o.dim, smooth(0.65, 1.05, sm), 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.disable(gl.SCISSOR_TEST);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.restore();
}

/* ---- things that float ride the same waves ----
   The shader's eight trains, summed on the CPU at a point: waveAt(x, y) leaves in WS the height of the water there (ground
   units), its slope (gx, gy: how far it rises per unit toward +x and +y) and how far the surface carries a floating thing
   along (dx, dy: the little loop a drifting object makes as each crest goes by). It is zero on land, on calm glass and in
   winter, and it uses the same settled amplitude the shader reads, so a duck and the water under it always agree. */
const WAVE_TR = {
  LAM: [52, 41, 34, 27, 21, 17, 14, 12], // fixed wavelengths, so the pattern never stretches with the wind
  OFF: [0, 0.5, -0.45, 0.9, -0.9, 0.25, -0.25, 1.25], // directions spread about the wind
  WT: [1, 0.8, 0.65, 0.5, 0.36, 0.28, 0.22, 0.17]
};
const WS = { h: 0, gx: 0, gy: 0, dx: 0, dy: 0, r: 0 };
function waveAt(x, y) {
  WS.h = WS.gx = WS.gy = WS.dx = WS.dy = WS.r = 0;
  const wf = waveFreeze();
  if (!WV.init || !WV.ws || wf < 0.02) return WS;
  const w = waveDepth(x, y);
  if (w <= 0) return WS;
  let R = waveRough(x, y);
  {
    // the block amplitude the water has settled to, blended the way the shader's texture is, where it has been drawn lately
    const { LX, LY, B, y0, nx, ncx, rs, rt } = WV,
      fx = x / (LX * B),
      fy = (y - y0) / (LY * B),
      bx = Math.floor(fx),
      by = Math.floor(fy);
    if (by >= 0) {
      let sum = 0,
        ok = true;
      for (let j = 0; j < 2 && ok; j++)
        for (let i = 0; i < 2; i++) {
          const lx = (bx + i) * B,
            kk = (((lx % nx) + nx) % nx) / B + (by + j) * ncx,
            q = T - rt[kk];
          if (!(q >= 0 && q < 1.5)) {
            ok = false;
            break;
          }
          sum += rs[kk] * (i ? fx - bx : 1 - (fx - bx)) * (j ? fy - by : 1 - (fy - by));
        }
      if (ok) R = sum;
    }
  }
  R *= smooth(0.04, 0.4, R) * w * wf;
  if (R < 0.01) return WS;
  WS.r = R;
  const th = WV.th,
    T_ = T,
    a1 = x * 0.0091 + y * 0.0127 + T_ * 0.07,
    a2 = x * 0.021 - y * 0.017 + T_ * 0.11,
    a3 = x * 0.043 + y * 0.037 + T_ * 0.14,
    wp = 3.2 * Math.sin(a1) + 1.5 * Math.sin(a2) + 0.8 * Math.sin(a3),
    dwx = 3.2 * Math.cos(a1) * 0.0091 + 1.5 * Math.cos(a2) * 0.021 + 0.8 * Math.cos(a3) * 0.043,
    dwy = 3.2 * Math.cos(a1) * 0.0127 - 1.5 * Math.cos(a2) * 0.017 + 0.8 * Math.cos(a3) * 0.037,
    ox = LAKE.x > -1000 ? LAKE.x : W / 2,
    oy = LAKE.x > -1000 ? LAKE.y : H;
  for (let i = 0; i < 8; i++) {
    const lam = WAVE_TR.LAM[i],
      k = TAU / lam,
      c0 = 14 * Math.sqrt(lam / 30),
      ang = th + WAVE_TR.OFF[i],
      pdx = Math.cos(ang),
      pdy = Math.sin(ang),
      odd = 1 + 0.5 * (i % 2),
      u = x * -pdy + y * pdx,
      v = x * pdx + y * pdy,
      grp =
        0.12 +
        1.15 *
          (0.5 + 0.5 * Math.sin(u * (0.012 + 0.004 * i) + 1.3 + 2.1 * i + 0.9 * Math.sin(T_ * 0.02 + x * 0.004 + i))) *
          (0.55 + 0.45 * Math.sin(v * 0.011 - T_ * 0.04 * (1 + i * 0.3) + 4.1 * i)),
      chop = i < 3 ? 1 : smooth(0.2 + 0.05 * i, 1 + 0.05 * i, R),
      ph = k * (pdx * (x - ox) + pdy * (y - oy)) - k * c0 * WV.tw + wp * odd,
      a = 0.035 * lam * WAVE_TR.WT[i] * R * grp * chop,
      s1 = Math.sin(ph),
      dh = -a * (s1 + 0.44 * Math.sin(2 * ph + 0.5));
    WS.h += a * (Math.cos(ph) + 0.22 * Math.cos(2 * ph + 0.5));
    WS.gx += dh * (k * pdx + odd * dwx);
    WS.gy += dh * (k * pdy + odd * dwy);
    WS.dx -= 0.6 * a * s1 * pdx;
    WS.dy -= 0.6 * a * s1 * pdy;
  }
  return WS;
}

/* Lily pads on the lake, drawn live so they ride the waves (they used to be painted into the ground). They keep to the
   same stretch of shore each world; in summer and autumn only. */
const lilyW = () => {
  const on = n => (n === 1 || n === 2 ? 1 : 0);
  return lerp(on(TRANS.prevSeason), on(SEASON), tEase());
};
const LILIES = { key: null, list: [] };
function lilyList() {
  const key = NS + ':' + LAKE.x + ':' + LAKE.y;
  if (LILIES.key === key) return LILIES.list;
  LILIES.key = key;
  LILIES.list = [];
  if (LAKE.x < -1000) return LILIES.list;
  const base = hash2(LAKE.x | 0, LAKE.y | 0) * TAU;
  for (let i = 0; i < 34; i++) {
    const h = n => hash2(i * 131 + n * 17, ((LAKE.x * 7 + LAKE.y) | 0) + n * 1009);
    const a = base + (h(1) - 0.5) * 0.6,
      r = lakeR(a) - (20 + 70 * h(2));
    LILIES.list.push({
      x: LAKE.x + Math.cos(a) * r,
      y: LAKE.y + Math.sin(a) * r,
      s: 4 + 3 * h(3),
      o: h(4) * TAU,
      c: h(5) < 0.5 ? '#557F3F' : '#6A9048'
    });
  }
  return LILIES.list;
}
function drawLilies(ctx) {
  const k = lilyW();
  if (k < 0.02 || LAKE.x < -1000) return;
  ctx.save();
  ctx.globalAlpha = k;
  for (const p of lilyList()) {
    if (!visG(p.x, p.y, 14)) continue;
    const w = waveAt(p.x, p.y),
      x = p.x + w.dx * 1.6,
      y = p.y + w.dy * 1.1 - w.h * 0.8;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // a pad tips a little with the slope of the water under it, and turns slowly with the drift
    ctx.ellipse(
      x,
      y,
      p.s,
      p.s * (1 - Math.min(0.25, Math.hypot(w.gx, w.gy) * 0.4)),
      p.o + w.gx * 0.8,
      0.35,
      TAU - 0.35
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ---- the swash: water running up the shore and draining back ----
   Along the edge of the lake, the pond and the fjord shore, each wave that arrives pushes the waterline a little way inland
   and it slides back. The run-up at a point is the height of the real wave a short way off the shore (waveAt), so it comes in
   sets with the wind and the sea state, and a calm day only laps. A band of wet ground is left behind where the water has
   been and dries slowly, a thin line of foam rides the front, and nothing is drawn but a ribbon along the shore points that are
   in view, so it costs a few hundred wave samples a frame. */
const SWASH = { key: null, lake: null, pond: null, sea: null, N: 180, SEA_STEP: 24 };
function swashPts(c, rf) {
  const N = SWASH.N,
    P = { x: new Float32Array(N), y: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N) };
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU,
      r = rf(a);
    P.x[i] = c.x + Math.cos(a) * r;
    P.y[i] = c.y + Math.sin(a) * r;
    P.nx[i] = Math.cos(a); // inland is away from the water's centre
    P.ny[i] = Math.sin(a);
  }
  P.ext = new Float32Array(N);
  P.tl = new Float32Array(N).fill(-9);
  P.N = N;
  return P;
}
// the swash along one shore, given a way to get the i-th point (pt), whether it's visible, and where its memory lives
function swashRun(ctx, S, n, step, ptAt, wet, front, soft) {
  let any = false,
    prev = null;
  for (let i = 0; i < n; i++) {
    const p = ptAt(i);
    if (!p || !visG(p.x, p.y, 40)) {
      prev = null;
      continue;
    }
    const k = p.k,
      dtl = T - S.tl[k];
    if (dtl <= 0 || dtl > 30) S.ext[k] = dtl > 30 ? 0 : S.ext[k];
    else S.ext[k] *= Math.exp(-dtl / 7); // the wet ground dries
    S.tl[k] = T;
    const w = waveAt(p.x - p.nx * 30, p.y - p.ny * 30),
      calm = smooth(0.1, 0.4, WV.sm),
      d = Math.min(12, (0.5 * calm + 4 * Math.max(0, w.h)) * (0.7 + 0.3 * Math.sin(p.x * 0.11 + T * 0.4)));
    if (d > S.ext[k]) S.ext[k] = d;
    const e = S.ext[k],
      qx = p.x + p.nx * d,
      qy = p.y + p.ny * d,
      ex = p.x + p.nx * e,
      ey = p.y + p.ny * e;
    if (prev) {
      wet.moveTo(prev.x, prev.y);
      wet.lineTo(p.x, p.y);
      wet.lineTo(ex, ey);
      wet.lineTo(prev.ex, prev.ey);
      wet.closePath();
      // foam rides the front while it is advancing, thinner as it slips back
      const f = d > e * 0.8 && d > 0.8 ? front : soft;
      f.moveTo(prev.qx, prev.qy);
      f.lineTo(qx, qy);
      any = true;
    }
    prev = { x: p.x, y: p.y, qx, qy, ex, ey };
  }
  return any;
}
function drawSwash(ctx) {
  const wf = waveFreeze();
  if (wf < 0.02 || !WV.init) return;
  const key = NS + ':' + LAKE.x + ':' + POND.x;
  if (SWASH.key !== key) {
    SWASH.key = key;
    SWASH.lake = LAKE.x > -1000 ? swashPts(LAKE, lakeR) : null;
    SWASH.pond = POND.x > 0 ? swashPts(POND, pondR) : null;
    const M = Math.ceil(W / SWASH.SEA_STEP);
    SWASH.sea = { ext: new Float32Array(M), tl: new Float32Array(M).fill(-9), M };
  }
  const wet = new Path2D(),
    front = new Path2D(),
    soft = new Path2D();
  let any = false;
  for (const [P, c] of [
    [SWASH.lake, LAKE],
    [SWASH.pond, POND]
  ]) {
    if (!P || Math.abs(wdx(c.x, (V.x0 + V.x1) / 2)) > c.r * 1.5 + (V.x1 - V.x0) / 2 + 60) continue;
    // the lake outline is drawn in the world copy the view sits in
    const sh = Math.round(((V.x0 + V.x1) / 2 - c.x) / W) * W;
    any =
      swashRun(
        ctx,
        P,
        P.N + 1,
        1,
        i => {
          const j = i % P.N;
          return { x: P.x[j] + sh, y: P.y[j], nx: P.nx[j], ny: P.ny[j], k: j };
        },
        wet,
        front,
        soft
      ) || any;
  }
  // the fjord shore south of the land: a line of points under the view
  const S = SWASH.sea,
    st = SWASH.SEA_STEP,
    i0 = Math.floor(V.x0 / st) - 1,
    n = Math.ceil((V.x1 - V.x0) / st) + 3;
  any =
    swashRun(
      ctx,
      S,
      n,
      st,
      i => {
        const gx = (i0 + i) * st;
        return { x: gx, y: shoreY(gx), nx: 0, ny: -1, k: (((i0 + i) % S.M) + S.M) % S.M };
      },
      wet,
      front,
      soft
    ) || any;
  if (!any) return;
  const dim = (1 - 0.45 * LIGHT.night) * wf;
  ctx.save();
  ctx.fillStyle = '#2A3A2E';
  ctx.globalAlpha = 0.26 * dim;
  ctx.fill(wet);
  ctx.strokeStyle = '#E4EFEA';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.4;
  ctx.globalAlpha = 0.08 * dim;
  ctx.stroke(front);
  ctx.lineWidth = 1.3;
  ctx.globalAlpha = 0.55 * dim;
  ctx.stroke(front);
  ctx.globalAlpha = 0.2 * dim;
  ctx.stroke(soft);
  ctx.restore();
}
