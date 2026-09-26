/* Flokk - weather.js
   Weather that moves. The wind veers and freshens and drops away; gusts roll across the land as travelling
   patches you can watch come through a stand of trees and silver the grass ahead of them; autumn gales strip
   the leaves and send them tumbling; winter storms drive the snow sideways and lift spindrift off the drifts;
   showers ring the lake; and some days fog rolls in, thick enough that a hawk is on you before you see it.
   Rain itself (RAIN, drawRain, thunder) lives in light.js; this file sets the wind it falls through.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const WEATHER = {
  ang: 0.22, // where the wind blows toward (0 = east); WIND in life.js is this times the strength
  angT: 0.22,
  s: 0.7, // strength: ~0.2 still, ~0.7 a breeze, ~1 fresh, 1.3+ a gale
  sT: 0.7,
  next: 8,
  gusts: [],
  gustT: 1,
  g: 0.5, // the gust felt where the flock is: sound, the yard flag, chimney smoke
  storm: 0, // winter gale: driven snow, whiteout, cold that cuts through
  fog: 0,
  fogT: 0,
  fogNext: rr(50, 110),
  leaves: [],
  drift: [],
  drops: [],
  banks: [],
  pin: null // dev.weather() holds the targets still
};
const GUST_SEASON = [0.8, 0.55, 1, 0.9], // baseline strength per season: summer stillest, autumn wildest
  GALE_CHANCE = [0.1, 0.04, 0.26, 0.3],
  FOG_CHANCE = [0.3, 0.08, 0.4, 0.22];
function resetWeather() {
  Object.assign(WEATHER, { s: 0.7, sT: 0.7, next: rr(10, 30), fog: 0, fogT: 0, fogNext: rr(50, 110), storm: 0 });
  WEATHER.gusts = [];
  WEATHER.leaves = [];
  WEATHER.drift = [];
  WEATHER.drops = [];
}

/* ---------- the weather deciding what to do next (only while playing) ---------- */
function rollWeather(dt) {
  const W2 = WEATHER;
  if (W2.pin) return Object.assign(W2, W2.pin);
  W2.next -= dt;
  if (W2.next <= 0) {
    // mostly a westerly off the sea; now and then the wind swings round to a cold easterly, more so in winter
    const east = Math.random() < (SEASON === 3 ? 0.35 : 0.12);
    W2.angT = (east ? Math.PI : 0) + rr(-0.55, 0.55);
    const gale = Math.random() < GALE_CHANCE[SEASON];
    W2.sT = gale ? rr(1.3, 1.7) : GUST_SEASON[SEASON] * rr(0.35, 1.25);
    W2.next = gale ? rr(25, 55) : rr(30, 80);
  }
  W2.fogNext -= dt;
  if (W2.fogNext <= 0) {
    // fog comes in on still air, most often in the cool of night and early morning; never with a gale blowing
    const still = W2.sT < 1.1 && RAIN.target < 0.3,
      cool = LIGHT.el < 8 ? 1.5 : 0.7;
    W2.fogT = W2.fogT > 0 ? 0 : still && Math.random() < FOG_CHANCE[SEASON] * cool ? rr(0.55, 1) : 0;
    W2.fogNext = W2.fogT > 0 ? rr(45, 110) : rr(40, 100);
  }
}
function weatherTick(dt) {
  const W2 = WEATHER;
  if (st.mode === 'play') rollWeather(dt);
  // showers blow in on a freshening wind; fog only lies while the air is still, and lifts as the wind gets up
  let sT = W2.sT * (1 + 0.4 * RAIN.t);
  if (W2.fogT > 0) sT = Math.min(sT, 0.3);
  W2.s += (sT - W2.s) * Math.min(1, dt * 0.08);
  let da = ((((W2.angT - W2.ang + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  W2.ang += da * Math.min(1, dt * 0.04);
  WIND.x = Math.cos(W2.ang) * W2.s;
  WIND.y = Math.sin(W2.ang) * W2.s * 0.7;
  W2.fog += ((W2.s > 0.9 ? 0 : W2.fogT) - W2.fog) * Math.min(1, dt * (W2.fogT > W2.fog ? 0.05 : 0.08));
  if (W2.fog < 0.004) W2.fog = 0;
  W2.storm += ((SEASON === 3 ? smooth(0.95, 1.45, W2.s) : 0) - W2.storm) * Math.min(1, dt * 0.2);
  gustTick(dt);
  const g0 = L ? gustAt(L.x, L.y) : 0.3;
  W2.g += (clamp(0.08 + 0.32 * W2.s + 0.65 * g0, 0, 1.3) - W2.g) * Math.min(1, dt * 1.5);
  leafTick(dt);
  driftTick(dt);
  dropTick(dt);
  fogTick(dt);
}
// how the fog and a winter storm grey out the light (called from calUpdate after the rain grading)
function weatherLight() {
  const f = WEATHER.fog,
    sm = WEATHER.storm;
  const k = Math.max(f * 0.75, sm * 0.6);
  if (k < 0.01) return;
  LIGHT.skyTop = mixHex(LIGHT.skyTop, LIGHT.night > 0.5 ? '#232A33' : '#A9B2B6', k);
  LIGHT.skyBot = mixHex(LIGHT.skyBot, LIGHT.night > 0.5 ? '#2E353D' : '#C9CFCF', k * 0.9);
  LIGHT.rim *= 1 - k * 0.6;
  LIGHT.shadowA *= 1 - k * 0.75;
  LIGHT.aurora *= 1 - k;
}
// how far you (and a hawk) can see: 1 on a clear day, down to about a third in thick fog or a blizzard
const seeK = () => 1 - Math.max(WEATHER.fog * 0.68, WEATHER.storm * 0.4);

/* ---------- gusts: patches of stronger wind travelling downwind across the land ----------
   Kept in flock coordinates around the camera (like the flock itself), so they draw in the k=0 copy and
   anything in the world measures against them with wdx. */
function viewSpan() {
  const z = cam.z || 1;
  return { hx: vw / 2 / z, hy: vh / 2 / z / TILT, cx: cam.x, cy: cam.py / TILT };
}
function gustTick(dt) {
  const W2 = WEATHER,
    v = viewSpan(),
    speed = 60 + 130 * W2.s;
  W2.gustT -= dt;
  if (W2.gustT <= 0 && W2.s > 0.28 && W2.gusts.length < 7) {
    // a gust comes in from upwind of the view and runs right across it
    const r = rr(260, 480) * (0.8 + 0.3 * W2.s),
      c = Math.cos(W2.ang),
      s = Math.sin(W2.ang),
      reach = Math.abs(c) * v.hx + Math.abs(s) * v.hy + r,
      side = rr(-1, 1) * (Math.abs(s) * v.hx + Math.abs(c) * v.hy);
    W2.gusts.push({
      x: v.cx - c * reach - s * side,
      y: v.cy - s * reach + c * side,
      r,
      k: rr(0.55, 1) * Math.min(1.25, 0.4 + W2.s * 0.7),
      t: 0,
      life: (reach * 2) / speed,
      ph: rr(0, 256)
    });
    W2.gustT = rr(1.2, 4.5) / Math.max(0.5, W2.s);
  }
  const c = Math.cos(W2.ang),
    s = Math.sin(W2.ang);
  for (const g of W2.gusts) {
    g.t += dt;
    g.x += c * speed * dt;
    g.y += s * speed * dt;
  }
  W2.gusts = W2.gusts.filter(g => g.t < g.life);
}
// swells in as it arrives, dies away as it goes
const gustEnv = g => Math.min(1, g.t / 2.5, (g.life - g.t) / 2.5);
// the extra wind at a point from the gusts passing over it (0 in their lee, ~1 in the heart of one)
function gustAt(x, y) {
  let a = 0;
  for (const g of WEATHER.gusts) {
    const dx = wdx(x, g.x),
      dy = y - g.y,
      q = (dx * dx + dy * dy) / (g.r * g.r);
    if (q >= 1) continue;
    const f = 1 - q;
    a += g.k * f * f * gustEnv(g);
  }
  return Math.min(1.3, a);
}
// what a tree, a reed or a flag feels: the steady wind plus whatever gust is on it
const windAt = (x, y) => WEATHER.s * (0.25 + gustAt(x, y));
// flying birds are pushed along: nothing in a breeze, a real drag to fly into in a gale
function windPush(b) {
  const k = Math.max(0, WEATHER.s - 0.5) * (0.6 + gustAt(b.x, b.y)) * 30;
  return [Math.cos(WEATHER.ang) * k, Math.sin(WEATHER.ang) * k];
}

/* the wave that runs through grass and standing crops ahead of a gust: soft crests across the wind,
   wavering a little, tileable along it so they can roll forward inside the patch */
const GUST_BANDS = (() => {
  const c = mk(256, 256),
    q = c.getContext('2d'),
    r = mulberry32(4242);
  q.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const bx = (i / 7) * 256 + r() * 14,
      amp = 5 + r() * 9,
      fr = 0.015 + r() * 0.02,
      ph = r() * TAU;
    for (const off of [-256, 0, 256])
      for (const [lw, al] of [
        [26, 0.2],
        [14, 0.3],
        [5, 0.42]
      ]) {
        q.strokeStyle = `rgba(255,255,255,${al})`;
        q.lineWidth = lw;
        q.beginPath();
        for (let y = -8; y <= 264; y += 8) {
          const x = bx + off + Math.sin(y * fr + ph) * amp + Math.sin(y * 0.061 + i) * 3;
          y < 0 ? q.moveTo(x, y) : q.lineTo(x, y);
        }
        q.stroke();
      }
  }
  return c;
})();
// the patch's soft outline: longer across the wind than along it, like a gust front
const GUST_MASK = (() => {
  const c = mk(256, 256),
    q = c.getContext('2d');
  q.translate(128, 128);
  q.scale(0.62, 1);
  const gr = q.createRadialGradient(0, 0, 0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,.7)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  q.fillStyle = gr;
  q.fillRect(-128 / 0.62, -128, 256 / 0.62, 256);
  return c;
})();
const GUST_C = mk(256, 256),
  gcx = GUST_C.getContext('2d');

/* ---------- leaves torn off and tumbling downwind (late summer, autumn) ---------- */
const LEAF_COL = ['#C8862E', '#D9A441', '#A4462A', '#8E5A2B', '#E0B84E', '#B86B2C'];
function leafySeason() {
  if (SEASON === 2) return 0.5 + 0.8 * smooth(0, 0.6, GROW.p) * (1 - smooth(0.75, 1, GROW.p));
  if (SEASON === 1) return 0.25 * smooth(0.7, 1, GROW.p);
  return 0;
}
// a broadleaf tree over this point (spruce keep their needles)
function leafTreeAt(x, y) {
  const wx = wrapX(x),
    cx = Math.floor(wx / TC),
    cy = Math.floor(y / TC);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const a = TG.get(cx + i + ',' + (cy + j));
      if (a)
        for (const t of a) if (t.type !== 'spruce' && (t.x - wx) ** 2 + (t.y - y) ** 2 < (t.r * 0.7) ** 2) return t;
    }
  return null;
}
function leafTick(dt) {
  const W2 = WEATHER,
    ls = leafySeason();
  if (ls > 0 && W2.leaves.length < 160)
    for (const g of W2.gusts) {
      // a few tries a frame inside each gust: wherever one lands on a broadleaf crown, a leaf lets go
      const n = g.k * gustEnv(g) * W2.s * ls * dt * 26;
      for (let i = 0; i < 3; i++) {
        if (Math.random() > n) continue;
        const a = rr(0, TAU),
          d = Math.sqrt(Math.random()) * g.r * 0.8,
          x = g.x + Math.cos(a) * d,
          y = g.y + Math.sin(a) * d,
          t = leafTreeAt(x, y);
        if (!t) continue;
        W2.leaves.push({
          x: x + rr(-8, 8),
          y,
          z: rr(0.8, 2.6) * t.k,
          vx: 0,
          vy: 0,
          sp: rr(3, 9) * (Math.random() < 0.5 ? -1 : 1),
          rot: rr(0, TAU),
          ph: rr(0, TAU),
          c: LEAF_COL[(Math.random() * LEAF_COL.length) | 0],
          s: rr(0.9, 1.4),
          age: 0,
          down: 0
        });
      }
    }
  for (const f of W2.leaves) {
    f.age += dt;
    if (f.z > 0 && f.age < 14) {
      const w = windAt(f.x, f.y) * (36 + 60 * Math.random());
      f.vx += (Math.cos(W2.ang) * w - f.vx) * Math.min(1, dt * 2);
      f.vy += (Math.sin(W2.ang) * w * 0.7 - f.vy) * Math.min(1, dt * 2);
      f.x += (f.vx + Math.sin(T * 3 + f.ph) * 14) * dt;
      f.y += f.vy * dt;
      // flutter down, lifted for a moment when a gust gets under it
      f.z -= (0.32 + 0.25 * Math.sin(T * 2.3 + f.ph) - 0.35 * gustAt(f.x, f.y)) * dt;
      f.rot += f.sp * dt;
    } else {
      f.z = 0;
      f.down += dt;
      // skittering along the ground a little, then still
      const k = Math.max(0, 1 - f.down * 1.4);
      f.x += f.vx * 0.25 * k * dt;
      f.y += f.vy * 0.25 * k * dt;
      f.rot += f.sp * 0.3 * k * dt;
    }
  }
  const v = viewSpan();
  W2.leaves = W2.leaves.filter(
    f => f.down < 4.5 && Math.abs(f.x - v.cx) < v.hx + 900 && Math.abs(f.y - v.cy) < v.hy + 900
  );
}
function drawLeaf(f, Y, a) {
  ctx.save();
  ctx.translate(f.x, Y);
  ctx.rotate(f.rot);
  ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(f.rot * 1.7 + f.ph)));
  ctx.globalAlpha = a;
  ctx.fillStyle = f.c;
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.4 * f.s, 1.8 * f.s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ---------- spindrift: snow lifted off the drifts and streaming low across the ground in a hard wind ---------- */
function driftTick(dt) {
  const W2 = WEATHER,
    v = viewSpan(),
    want = winterW() > 0.5 ? Math.round(220 * smooth(0.75, 1.4, W2.s)) : 0,
    c = Math.cos(W2.ang),
    s = Math.sin(W2.ang);
  while (W2.drift.length < want)
    W2.drift.push({
      x: v.cx + rr(-1, 1) * v.hx * 1.2,
      y: v.cy + rr(-1, 1) * v.hy * 1.2,
      l: rr(10, 30),
      v: rr(0.7, 1.3),
      a: 0
    });
  if (W2.drift.length > want) W2.drift.length = want;
  for (const p of W2.drift) {
    const sp = (150 + 240 * gustAt(p.x, p.y)) * W2.s * p.v;
    p.x += c * sp * dt;
    p.y += s * sp * dt * 0.7;
    p.a = Math.min(1, p.a + dt * 2);
    // blown off the far side of the view: start again upwind
    if (Math.abs(p.x - v.cx) > v.hx * 1.25 || Math.abs(p.y - v.cy) > v.hy * 1.25) {
      p.x = v.cx - c * v.hx * rr(0.9, 1.2) + rr(-1, 1) * Math.abs(s) * v.hx;
      p.y = v.cy - s * v.hy * rr(0.9, 1.2) + rr(-1, 1) * (Math.abs(c) * v.hy + 60);
      p.a = 0;
    }
  }
}

/* ---------- rain on the water: little rings everywhere a drop lands ---------- */
function dropTick(dt) {
  const W2 = WEATHER,
    I = SEASON === 3 ? 0 : LIGHT.rain,
    v = viewSpan();
  for (const d of W2.drops) d.t += dt;
  W2.drops = W2.drops.filter(d => d.t < 0.7);
  let n = I * 90 * dt;
  while (n > 0 && W2.drops.length < 120) {
    if (Math.random() < n) {
      const x = v.cx + rr(-1, 1) * v.hx,
        y = v.cy + rr(-1, 1) * v.hy;
      if (inWater(wrapX(x), y, -6)) W2.drops.push({ x, y, t: 0, s: rr(0.7, 1.3) });
    }
    n -= 1;
  }
}

/* ---------- fog: banks drifting through on the still air, closing the view down round the flock ---------- */
const FOG_SPR = (() => {
  const c = mk(256, 128),
    q = c.getContext('2d'),
    r = mulberry32(991);
  for (let i = 0; i < 60; i++) {
    const a = r() * TAU,
      d = Math.sqrt(r()) * 0.7,
      x = 128 + Math.cos(a) * d * 100,
      y = 64 + Math.sin(a) * d * 38,
      rr2 = 20 + r() * 34;
    const gr = q.createRadialGradient(x, y, 0, x, y, rr2);
    gr.addColorStop(0, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    q.fillStyle = gr;
    q.fillRect(x - rr2, y - rr2, rr2 * 2, rr2 * 2);
  }
  return c;
})();
const FOGC = document.createElement('canvas'),
  fgx = FOGC.getContext('2d');
function fogTick(dt) {
  const W2 = WEATHER;
  if (W2.fog <= 0 && W2.storm <= 0.02) return;
  const v = viewSpan(),
    sx = v.hx + 700,
    sy = v.hy + 500;
  while (W2.banks.length < 16)
    W2.banks.push({ x: v.cx + rr(-sx, sx), y: v.cy + rr(-sy, sy), r: rr(420, 820), ph: rr(0, TAU), v: rr(0.6, 1.4) });
  for (const b of W2.banks) {
    // fog creeps along with what air there is, and rolls slowly on itself
    b.x += (WIND.x * 22 * b.v + Math.sin(T * 0.05 + b.ph) * 6) * dt;
    b.y += (WIND.y * 22 * b.v + Math.cos(T * 0.04 + b.ph) * 4) * dt;
    if (b.x - v.cx > sx) b.x -= 2 * sx;
    if (b.x - v.cx < -sx) b.x += 2 * sx;
    if (b.y - v.cy > sy) b.y -= 2 * sy;
    if (b.y - v.cy < -sy) b.y += 2 * sy;
  }
}
// drawn over the world (trees, birds, hawks) but under the light overlay, so the night darkens it and the
// yard lamps and headlights glow in it. Half resolution: it is all soft.
function drawFog() {
  const f = WEATHER.fog,
    sm = WEATHER.storm * winterW();
  const k = Math.max(f, sm * 0.7);
  if (k < 0.01) return;
  const SQ = 0.5,
    w = Math.ceil(vw * SQ),
    h = Math.ceil(vh * SQ),
    z = cam.z;
  if (FOGC.width !== w || FOGC.height !== h) {
    FOGC.width = w;
    FOGC.height = h;
  }
  const c = fgx,
    nf = LIGHT.night;
  let col = mixHex(mixHex('#DCE1E0', LIGHT.skyBot, 0.3), '#6A7580', nf * 0.55);
  if (sm > f) col = mixHex(col, '#E8EEF4', 0.5);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, w, h);
  // an even veil, thicker at the top of the screen (further off)
  const vg = c.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, col + hex2(Math.min(1, k * 0.85)));
  vg.addColorStop(1, col + hex2(k * 0.42));
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);
  // banks rolling through it
  c.globalAlpha = Math.min(1, k * 1.1);
  const tint = mk2Tint(col);
  for (const b of WEATHER.banks) {
    const X = ((b.x - cam.x) * z + vw / 2) * SQ,
      Y = ((b.y * TILT - cam.py) * z + vh / 2) * SQ,
      rx = b.r * (1 + 0.1 * Math.sin(T * 0.06 + b.ph)) * z * SQ,
      ry = rx * 0.42;
    if (X + rx < 0 || X - rx > w || Y + ry < 0 || Y - ry > h) continue;
    c.drawImage(tint, X - rx, Y - ry, rx * 2, ry * 2);
  }
  c.globalAlpha = 1;
  // a pocket of clearer air round the flock: you can see your own birds, and not much past them
  if (L && birds.length) {
    const X = ((L.x - cam.x) * z + vw / 2) * SQ,
      Y = ((PY(L.y, L.z) - cam.py) * z + vh / 2) * SQ,
      r0 = lerp(260, 90, k) * z * SQ,
      r1 = r0 * 2.8;
    c.globalCompositeOperation = 'destination-out';
    const gr = c.createRadialGradient(X, Y, r0 * 0.2, X, Y, r1);
    gr.addColorStop(0, `rgba(0,0,0,${0.85 - 0.25 * k})`);
    gr.addColorStop(0.45, `rgba(0,0,0,${0.45 - 0.2 * k})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr;
    c.fillRect(X - r1, Y - r1, r1 * 2, r1 * 2);
    c.globalCompositeOperation = 'source-over';
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(FOGC, 0, 0, cv.width, cv.height);
}
// the bank sprite recoloured to the fog's colour (cached; the colour only drifts slowly)
let FOG_TINT = null,
  FOG_TINT_COL = '';
function mk2Tint(col) {
  if (FOG_TINT && FOG_TINT_COL === col) return FOG_TINT;
  if (!FOG_TINT) FOG_TINT = mk(256, 128);
  const q = FOG_TINT.getContext('2d');
  q.globalCompositeOperation = 'source-over';
  q.clearRect(0, 0, 256, 128);
  q.drawImage(FOG_SPR, 0, 0);
  q.globalCompositeOperation = 'source-in';
  q.fillStyle = col;
  q.fillRect(0, 0, 256, 128);
  FOG_TINT_COL = col;
  return FOG_TINT;
}

/* ---------- drawing on the ground (ground transform, the k=0 copy: everything here is in flock coordinates) ---------- */
function drawWeatherGround() {
  const W2 = WEATHER,
    nf = LIGHT.night,
    snowy = winterW() > 0.5;
  // gust waves: bright crests rolling through the grass and the crops, a darker ruffle on open water
  if (!snowy && nf < 0.9 && W2.gusts.length) {
    ctx.globalCompositeOperation = 'soft-light';
    for (const g of W2.gusts) {
      const e = gustEnv(g) * g.k;
      if (e < 0.03 || !visG(g.x, g.y, g.r)) continue;
      // crests run forward through the patch a little faster than the patch itself moves
      const off = (((g.ph + T * (22 + 30 * W2.s)) % 256) + 256) % 256;
      gcx.globalCompositeOperation = 'source-over';
      gcx.clearRect(0, 0, 256, 256);
      gcx.drawImage(GUST_BANDS, off - 256, 0);
      gcx.drawImage(GUST_BANDS, off, 0);
      gcx.globalCompositeOperation = 'destination-in';
      gcx.drawImage(GUST_MASK, 0, 0);
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(W2.ang);
      ctx.globalAlpha = Math.min(1, e * 1.1) * (1 - nf) * (1 - 0.4 * AIR.mist);
      ctx.drawImage(GUST_C, -g.r, -g.r, g.r * 2, g.r * 2);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // spindrift streaming over the snow
  if (W2.drift.length) {
    const c = Math.cos(W2.ang),
      s = Math.sin(W2.ang);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = `rgba(250,252,255,${0.55 - 0.2 * nf})`;
    ctx.beginPath();
    for (const p of W2.drift) {
      if (!visG(p.x, p.y, 40) || p.a < 0.2) continue;
      const l = p.l * (0.6 + gustAt(p.x, p.y));
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - c * l, p.y - s * l);
    }
    ctx.stroke();
  }
  // raindrop rings on the water
  if (W2.drops.length) {
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(220,232,236,.5)';
    for (const d of W2.drops) {
      if (!visG(d.x, d.y, 10)) continue;
      ctx.globalAlpha = (1 - d.t / 0.7) * 0.8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, (1 + d.t * 9) * d.s, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // leaves come to rest and lie a moment before they are lost among the others already down
  for (const f of W2.leaves) if (f.z <= 0 && visG(f.x, f.y, 6)) drawLeaf(f, f.y, Math.min(1, (4.5 - f.down) / 1.5));
}
// in the air (upright world transform, k=0 copy), over everything on the ground
function drawWeatherAir() {
  for (const f of WEATHER.leaves) {
    if (f.z <= 0 || !visU(f.x, f.y, 10, f.z * HZ + 10)) continue;
    drawLeaf(f, PY(f.y, f.z), 1);
  }
  ctx.globalAlpha = 1;
}
