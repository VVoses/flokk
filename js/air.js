/* Flokk - air.js
   Light and air: morning mist pooling over the lake and in the hollows, dew (and frost, and snow) glittering
   in the first low sun, and soft shafts of light at dawn and dusk. None of it touches the night: winter
   nights stay clear, dark and cold.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const AIR = { seed: null, banks: [], dew: [], mist: 0, dewK: 0, rays: 0 };

/* soft sprites, made once */
const MIST_SPR = (() => {
  const c = mk(256, 128),
    q = c.getContext('2d'),
    r = mulberry32(777);
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU,
      d = Math.sqrt(r()) * 0.62,
      x = 128 + Math.cos(a) * d * 110,
      y = 64 + Math.sin(a) * d * 44,
      rr2 = 22 + r() * 30;
    const gr = q.createRadialGradient(x, y, 0, x, y, rr2);
    gr.addColorStop(0, 'rgba(255,255,255,.075)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = gr;
    q.fillRect(x - rr2, y - rr2, rr2 * 2, rr2 * 2);
  }
  return c;
})();
// a shaft of light: narrow where it enters, widening and fading along its length, soft at the sides
function mkBeam(col) {
  const c = mk(512, 96),
    q = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const k = 1 - i / 9,
      h0 = 2 + 5 * k,
      h1 = 8 + 40 * k;
    q.fillStyle = `rgba(${col},0.11)`;
    q.beginPath();
    q.moveTo(0, 48 - h0);
    q.lineTo(512, 48 - h1);
    q.lineTo(512, 48 + h1);
    q.lineTo(0, 48 + h0);
    q.closePath();
    q.fill();
  }
  q.globalCompositeOperation = 'destination-in';
  const gr = q.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(0.12, 'rgba(0,0,0,1)');
  gr.addColorStop(0.5, 'rgba(0,0,0,.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  q.fillStyle = gr;
  q.fillRect(0, 0, 512, 96);
  return c;
}
const BEAM_M = mkBeam('255,226,188'),
  BEAM_E = mkBeam('255,178,112');

/* where the mist lies and the dew glints, per land */
function buildAir() {
  AIR.seed = SEED;
  AIR.banks = [];
  AIR.dew = [];
  const r = mulberry32((SEED ^ 0xa11) >>> 0);
  for (let n = 0; n < 5000 && AIR.banks.length < 90; n++) {
    const x = r() * W,
      y = r() * H;
    if (y > shoreY(x) - 20) continue;
    const onWater = inWater(x, y, -30);
    // mist gathers over still water and sinks into the low ground, not up on the ridges or in the forest
    if (!onWater && (landHeight(x, y) > 0.42 || forestness(x, y) > 0.62 || r() < 0.4)) continue;
    const s = onWater ? 180 + r() * 170 : 110 + r() * 130;
    AIR.banks.push({ x, y, rx: s, ry: s * (0.3 + r() * 0.15), ph: r() * TAU, w: onWater ? 1 : 0.7, sp: 0.5 + r() });
  }
  for (let n = 0; n < 12000 && AIR.dew.length < 2600; n++) {
    const x = r() * W,
      y = r() * H;
    if (inWater(x, y, 16) || forestness(x, y) > 0.55 || roadDist(x, y) < 24) continue;
    AIR.dew.push({ x, y, p: r() * TAU, s: 0.6 + r() * 1.4, c: (r() * 3) | 0 });
  }
  AIR.dew.sort((a, b) => a.x - b.x);
}
/* ---------- how much of each, now ---------- */
function airTick(dt) {
  if (AIR.seed !== SEED) buildAir();
  const el = LIGHT.el,
    nf = LIGHT.night,
    rain = LIGHT.rain,
    S2 = SEASON;
  // mist: thickest around sunrise and burning off as the sun climbs, a thin veil over the water at dusk;
  // some mornings thick, some clear. Nothing after dark, so the nights stay open and stark.
  let m = LIGHT.eve
    ? 0.3 * clamp(1 - Math.abs(el - 1) / 6, 0, 1)
    : el < -7
      ? 0
      : el < 0
        ? (el + 7) / 7
        : clamp(1 - el / 16, 0, 1);
  m *= [0.85, 0.6, 1, 0.4][S2] * (0.35 + 0.65 * jit(CAL.day + CAL.year * 17)) * (1 - 0.4 * rain);
  AIR.mist += (m - AIR.mist) * Math.min(1, dt * 0.5);
  // dew in the first sun; frost in autumn; in winter, snow sparkling whenever the sun is out
  let d = S2 === 3 ? clamp(el / 6, 0, 1) * 0.8 : LIGHT.eve ? 0 : clamp((el + 1) / 3, 0, 1) * clamp(1 - el / 18, 0, 1);
  d *= (1 - rain) * (1 - nf);
  AIR.dewK += (d - AIR.dewK) * Math.min(1, dt * 0.8);
  // light shafts: only with the sun low and a clear sky, strongest through mist
  const r2 = LIGHT.rim * (1 - nf) * (1 - 0.85 * rain) * (0.5 + 0.7 * AIR.mist);
  AIR.rays += (r2 - AIR.rays) * Math.min(1, dt * 0.6);
}

/* ---------- drawing ---------- */
// ground pass (world units, y squashed): mist banks lying on the water and the low fields
function drawMist() {
  const k = AIR.mist;
  if (k < 0.02) return;
  const lift = clamp(LIGHT.el / 10, 0, 1); // as the sun rises the mist thins and breaks up
  // drawn inside each copy's own clip (render.js), with the banks from across the seam included
  for (const b of AIR.banks)
    for (const ox of [0, -W, W]) {
      const x = b.x + ox + Math.sin(T * 0.02 * b.sp + b.ph) * 60 + WIND.x * Math.sin(T * 0.011 + b.ph) * 30,
        rx = b.rx * (1 + 0.12 * Math.sin(T * 0.05 + b.ph)),
        ry = b.ry * (1 + 0.5 * lift);
      if (!visG(x, b.y, rx + 20) && !visG(x, b.y + ry, rx + 20)) continue;
      ctx.globalAlpha = k * b.w * 0.8 * (1 - 0.45 * lift);
      ctx.drawImage(MIST_SPR, x - rx, b.y - ry, rx * 2, ry * 2);
    }
  ctx.globalAlpha = 1;
}
// ground pass: dew, frost or snow glinting, each point flashing briefly as the light catches it
const DEW_COL = ['255,255,250', '214,244,255', '255,238,200'];
function drawDew() {
  const k = AIR.dewK;
  if (k < 0.03) return;
  const list = AIR.dew,
    x0 = V.x0 - 10,
    x1 = V.x1 + 10;
  // the points are sorted by x: find the first one in view
  let lo = 0,
    hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].x < x0) lo = mid + 1;
    else hi = mid;
  }
  ctx.lineWidth = 0.9;
  for (let i = lo; i < list.length; i++) {
    const s = list[i];
    if (s.x > x1) break;
    if (!visG(s.x, s.y, 6)) continue;
    const a = Math.max(0, Math.sin(T * s.s + s.p)) ** 16 * k;
    if (a < 0.05) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = ctx.strokeStyle = `rgb(${DEW_COL[s.c]})`;
    ctx.fillRect(s.x - 0.8, s.y - 0.8, 1.6, 1.6);
    if (a > 0.45) {
      const l = 2.5 + 2.5 * a;
      ctx.beginPath();
      ctx.moveTo(s.x - l, s.y);
      ctx.lineTo(s.x + l, s.y);
      ctx.moveTo(s.x, s.y - l * 1.6);
      ctx.lineTo(s.x, s.y + l * 1.6);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
// screen space, after the glaze: shafts of low sun slanting in from the side it shines from
function drawRays() {
  const k = AIR.rays;
  if (k < 0.02) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  const side = LIGHT.rimSide > 0 ? 1 : -1,
    ox = side > 0 ? vw * 1.08 : -vw * 0.08,
    oy = -vh * 0.3,
    base = Math.atan2(vh * 0.95 - oy, vw * 0.5 - ox),
    len = Math.hypot(vw, vh) * 1.25,
    spr = LIGHT.eve ? BEAM_E : BEAM_M;
  for (let i = 0; i < 9; i++) {
    const w = 0.5 + 0.5 * Math.sin(T * 0.07 + i * 2.1),
      a = k * (0.12 + 0.5 * w * w),
      th = (0.22 + 0.45 * jit(i + 3)) * (len / 700);
    if (a < 0.01) continue;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(base + (i - 4) * 0.06 * side + (jit(i) - 0.5) * 0.03 + Math.sin(T * 0.03 + i) * 0.01);
    ctx.globalAlpha = a;
    ctx.drawImage(spr, 0, -48 * th, len, 96 * th);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
