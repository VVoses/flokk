/* Flokk - weather.js
   Weather that moves. The wind veers and freshens and drops away; gusts roll across the land as travelling
   patches you can watch come through a stand of trees and silver the grass ahead of them; autumn gales strip
   the leaves and send them tumbling; winter storms drive the snow sideways and lift spindrift off the drifts;
   showers ring the lake; and some days fog rolls in, thick enough that a hawk is on you before you see it.
   Rain and snow fall through the world, not over the screen: every drop and flake has a place on the ground it
   is falling to, drawn in its turn with the trees and roofs, so what stands in front hides it. Fog lies in
   banks the same way. When a shower comes (RAIN, the overcast and thunder live in light.js) is decided there;
   this file sets the wind it falls through and draws it falling.
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
  fall: [], // raindrops and snowflakes in the air
  splash: [],
  banks: [],
  fogCol: '#DCE1E0',
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
  WEATHER.fall = [];
  WEATHER.splash = [];
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
  leeTick();
  driftTick(dt);
  precipTick(dt);
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
      ang: W2.ang, // kept with the gust, so it stays a streak along the way it was blowing even if the wind veers
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
  let gustWrite = 0;
  for (const g of W2.gusts) if (g.t < g.life) W2.gusts[gustWrite++] = g;
  W2.gusts.length = gustWrite;
}
// swells in as it arrives, dies away as it goes
const gustEnv = g => Math.min(1, g.t / 2.5, (g.life - g.t) / 2.5);
// the extra wind at a point from the gusts passing over it (0 in their lee, ~1 in the heart of one).
// A gust is a streak, not a puff: long the way it's travelling, narrow across it, so it reads as a
// band running through the grass rather than a ring spreading out from a point.
function gustAt(x, y) {
  let a = 0;
  for (const g of WEATHER.gusts) {
    const dx = wdx(x, g.x),
      dy = y - g.y,
      c = Math.cos(g.ang),
      s = Math.sin(g.ang),
      along = dx * c + dy * s,
      across = -dx * s + dy * c,
      q = (along * along) / (g.r * g.r * 2.5) + (across * across) / (g.r * g.r * 0.4);
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
          c: pickP(LEAF_COL),
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
  const keepLeaf = f => f.down < 4.5 && Math.abs(f.x - v.cx) < v.hx + 900 && Math.abs(f.y - v.cy) < v.hy + 900;
  let leafWrite = 0;
  for (const f of W2.leaves) if (keepLeaf(f)) W2.leaves[leafWrite++] = f;
  W2.leaves.length = leafWrite;
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

/* ---------- animals feel it: in a hard wind the grazing beasts stand with their backs to it ---------- */
const LEE_KINDS = { sheep: 1, cow: 1, pig: 1, deer: 1, moose: 1 };
function leeTick() {
  for (const a of ANIMALS) {
    if (!LEE_KINDS[a.k]) continue;
    const hard = WEATHER.s > 1.1 || windAt(a.x, a.y) > 0.9;
    if (hard && a.lee === undefined && Math.random() < 0.02) a.lee = WEATHER.ang + rr(-0.35, 0.35);
    else if (!hard && a.lee !== undefined && Math.random() < 0.01) a.lee = undefined;
  }
}

/* ---------- rain and snow falling through the world ----------
   Each drop or flake has a ground position (x, y) and a height z, like a bird. It is drawn at PY(y, z) in the
   painter's order by its y, so a tree or a roof standing in front of the spot it will land on hides it, and it
   ends where it lands: a ring on the water, a splash on the ground, a flake gone into the snow. */
const FALL_TOP = 7; // how high (in HZ) they come into view
function fallSpawn(p, v, top) {
  p.x = v.cx + rr(-1, 1) * (v.hx + 120);
  // from the top edge of the view down to where something falling from FALL_TOP still shows at the bottom
  p.y = v.cy + rr(-v.hy - 30, v.hy + (FALL_TOP * HZ) / TILT);
  p.z = top ? FALL_TOP * rr(0.8, 1) : rr(0, FALL_TOP);
  p.s = rr(0.7, 1.3);
  p.ph = rr(0, TAU);
}
function precipTick(dt) {
  const W2 = WEATHER,
    v = viewSpan(),
    snow = winterW() > 0.5,
    I = snow ? LIGHT.snow : LIGHT.rain,
    sm = W2.storm,
    want = Math.round(I * (snow ? 620 * (0.55 + 0.45 * sm) : 900)),
    c = Math.cos(W2.ang),
    sn = Math.sin(W2.ang);
  while (W2.fall.length < want) {
    const p = { snow };
    fallSpawn(p, v, false);
    W2.fall.push(p);
  }
  // a shower tailing off: drops finish falling, no new ones start
  let n = W2.fall.length - want;
  for (const p of W2.fall) {
    const g = gustAt(p.x, p.y);
    if (p.snow) {
      // flakes drift and waver; in a storm they are driven almost flat along the wind
      const drive = W2.s * (18 + (60 + 160 * sm) * (0.4 + g));
      p.x += (c * drive + Math.sin(T * 1.3 + p.ph) * 10 * (1 - sm)) * dt;
      p.y += (sn * drive * 0.7 + Math.cos(T * 1.1 + p.ph) * 5 * (1 - sm)) * dt;
      p.z -= (0.9 + 0.5 * p.s) * (1 + 0.5 * sm) * dt;
    } else {
      const drive = W2.s * (25 + 70 * g);
      p.x += c * drive * dt;
      p.y += sn * drive * 0.7 * dt;
      p.z -= (15 + 4 * p.s) * dt;
    }
    if (p.z <= 0) {
      if (!p.snow) {
        if (inWater(wrapX(p.x), p.y, -6)) {
          if (W2.drops.length < 160) W2.drops.push({ x: p.x, y: p.y, t: 0, s: rr(0.7, 1.3) });
        } else if (W2.splash.length < 120) W2.splash.push({ x: p.x, y: p.y, t: 0 });
      }
      if (n > 0) {
        p.dead = true;
        n--;
      } else fallSpawn(p, v, true);
    } else if (Math.abs(p.x - v.cx) > v.hx + 260 || p.y < v.cy - v.hy - 200 || p.y > v.cy + v.hy + 500) {
      // blown out of the view: come in again from the top
      if (n > 0) {
        p.dead = true;
        n--;
      } else fallSpawn(p, v, true);
    }
    if (p.snow !== snow) p.dead = true;
  }
  let fallWrite = 0;
  for (const p of W2.fall) if (!p.dead) W2.fall[fallWrite++] = p;
  W2.fall.length = fallWrite;
  let dropWrite = 0;
  for (const d of W2.drops) {
    d.t += dt;
    if (d.t < 0.7) W2.drops[dropWrite++] = d;
  }
  W2.drops.length = dropWrite;
  let splashWrite = 0;
  for (const d of W2.splash) {
    d.t += dt;
    if (d.t < 0.18) W2.splash[splashWrite++] = d;
  }
  W2.splash.length = splashWrite;
}

/* ---------- fog: banks drifting through on the still air, closing the view down round the flock ---------- */
const FOG_SPR = puffSprite({
  seed: 991,
  n: 60,
  alpha: 0.12,
  spreadX: 100,
  spreadY: 38,
  dPow: 0.7,
  rMin: 20,
  rRange: 34
});
const FOGC = document.createElement('canvas'),
  fgx = FOGC.getContext('2d');
function fogTick(dt) {
  const W2 = WEATHER,
    nf = LIGHT.night;
  W2.fogCol = mixHex(mixHex('#DCE1E0', LIGHT.skyBot, 0.3), '#6A7580', nf * 0.55);
  if (W2.storm > W2.fog) W2.fogCol = mixHex(W2.fogCol, '#E8EEF4', 0.5);
  if (W2.fog <= 0 && W2.storm <= 0.02) return;
  const v = viewSpan(),
    sx = v.hx + 700,
    sy = v.hy + 500;
  while (W2.banks.length < 12)
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
    col = WEATHER.fogCol;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, w, h);
  // the air between you and the ground: a thin veil, thicker toward the top of the screen (further off).
  // The banks themselves lie in the world (drawFogSlice), in among the trees.
  const vg = c.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, col + hex2(Math.min(1, k * 0.55)));
  vg.addColorStop(1, col + hex2(k * 0.2));
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);
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
    nf = LIGHT.night;
  // spindrift streaming over the snow: the same soft-halo-over-a-thin-core streak as the falling
  // snow and rain, so a hard wind reads as a blur of light skimming the ground, not ruled lines on it
  if (W2.drift.length) {
    const c = Math.cos(W2.ang),
      s = Math.sin(W2.ang),
      path = new Path2D();
    let any = false;
    for (const p of W2.drift) {
      if (!visG(p.x, p.y, 40) || p.a < 0.2) continue;
      const l = p.l * (0.6 + gustAt(p.x, p.y));
      path.moveTo(p.x, p.y);
      path.lineTo(p.x - c * l, p.y - s * l);
      any = true;
    }
    if (any) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(250,252,255,${0.15 - 0.06 * nf})`;
      ctx.stroke(path);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = `rgba(250,252,255,${0.6 - 0.22 * nf})`;
      ctx.stroke(path);
    }
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
  // rain splashing up off the ground
  if (W2.splash.length) {
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(214,224,232,.5)';
    ctx.beginPath();
    for (const d of W2.splash) {
      if (!visG(d.x, d.y, 6)) continue;
      const r = 1 + d.t * 14;
      ctx.moveTo(d.x - r, d.y - r * 0.2);
      ctx.lineTo(d.x - r * 0.4, d.y);
      ctx.moveTo(d.x + r, d.y - r * 0.2);
      ctx.lineTo(d.x + r * 0.4, d.y);
    }
    ctx.stroke();
  }
  // leaves come to rest and lie a moment before they are lost among the others already down
  for (const f of W2.leaves) if (f.z <= 0 && visG(f.x, f.y, 6)) drawLeaf(f, f.y, Math.min(1, (4.5 - f.down) / 1.5));
}
/* ---------- in the air, in the painter's order (upright world transform, the k=0 copy) ----------
   Drops, flakes and blown leaves are sorted into bands by the ground y they are over, and each band goes into
   the painter's list with the trees and buildings; fog banks go in as a few slices through their depth. */
const BAND = 24;
function weatherItems(items) {
  const W2 = WEATHER,
    bands = new Map();
  const band = y => {
    const k = Math.floor(y / BAND);
    let b = bands.get(k);
    if (!b) bands.set(k, (b = { y: (k + 1) * BAND, fall: [], leaves: [] }));
    return b;
  };
  for (const p of W2.fall) if (visU(p.x, p.y, 20, p.z * HZ + 20)) band(p.y).fall.push(p);
  for (const f of W2.leaves) if (f.z > 0 && visU(f.x, f.y, 10, f.z * HZ + 10)) band(f.y).leaves.push(f);
  for (const b of bands.values()) items.push([b.y, 16, b, 0]);
  const k = Math.max(W2.fog, W2.storm * winterW() * 0.7);
  if (k > 0.01)
    for (const b of W2.banks)
      for (let i = 0; i < FOG_SLICES; i++) {
        const y = b.y + (i / (FOG_SLICES - 1) - 0.5) * b.r * 0.5;
        if (visU(b.x, y, b.r, FOG_H * HZ)) items.push([y, 15, { b, y, i }, 0]);
      }
}
function drawWeatherBand(B) {
  const nf = LIGHT.night,
    c = Math.cos(WEATHER.ang),
    s = Math.sin(WEATHER.ang),
    sm = WEATHER.storm;
  if (B.fall.length) {
    const rain = new Path2D(),
      halo = new Path2D(),
      snow = new Path2D(),
      streak = new Path2D();
    let r = 0,
      f = 0,
      k = 0;
    for (const p of B.fall) {
      const X = p.x,
        Y = PY(p.y, p.z);
      if (!p.snow) {
        // a streak along the way it is falling: mostly down, slanted by the wind
        const l = 7 * p.s,
          w = WEATHER.s * 2.5;
        rain.moveTo(X, Y);
        rain.lineTo(X - c * w, Y - l - s * w * 0.4);
        r++;
      } else if (sm > 0.3) {
        // along the way it is going: driven along the wind and still falling, so a little downhill
        const hx = c,
          hy = s * 0.7 * TILT + 0.22 / (0.4 + sm),
          hl = Math.hypot(hx, hy),
          l = (6 + 16 * sm) * p.s;
        streak.moveTo(X, Y);
        streak.lineTo(X - (hx / hl) * l, Y - (hy / hl) * l);
        k++;
      } else {
        // a soft halo around a small bright core, so a flake reads as a mote of light drifting down
        // rather than a hard-edged sticker sitting over the scene
        const rad = 0.8 + 0.7 * p.s;
        halo.moveTo(X + rad * 2.4, Y);
        halo.arc(X, Y, rad * 2.4, 0, TAU);
        snow.moveTo(X + rad * 0.6, Y);
        snow.arc(X, Y, rad * 0.6, 0, TAU);
        f++;
      }
    }
    ctx.lineCap = 'round';
    if (r) {
      // the same soft-halo-over-a-thin-core treatment as the snow, so a drop is a streak of light
      // rather than a flat, opaque dash cut hard against the rain behind it
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(222,232,240,${0.16 + 0.08 * LIGHT.rain})`;
      ctx.stroke(rain);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(226,236,242,${0.55 + 0.25 * LIGHT.rain})`;
      ctx.stroke(rain);
    }
    const sc = `rgba(250,252,255,${0.9 - 0.3 * nf})`;
    if (f) {
      ctx.fillStyle = `rgba(232,238,244,${0.17 - 0.07 * nf})`;
      ctx.fill(halo);
      ctx.fillStyle = sc;
      ctx.fill(snow);
    }
    if (k) {
      // the same soft-halo-over-bright-core treatment, drawn as strokes for the driven streak
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = `rgba(236,242,246,${0.14 - 0.06 * nf})`;
      ctx.stroke(streak);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = sc;
      ctx.stroke(streak);
    }
  }
  for (const f of B.leaves) {
    // its shadow on the ground under it, in sunlight: this is what puts a leaf in the air over a place
    if (LIGHT.shadowA > 0.05) {
      ctx.globalAlpha = 0.22 * LIGHT.shadowA;
      ctx.fillStyle = '#1E2A1A';
      ctx.beginPath();
      ctx.ellipse(f.x + SX * f.z * 0.5, (f.y + SY * f.z * 0.5) * TILT, 2.6 * f.s, 1.2 * f.s, 0, 0, TAU);
      ctx.fill();
    }
    drawLeaf(f, PY(f.y, f.z), 1);
  }
  ctx.globalAlpha = 1;
}
// one slice through a fog bank: it lies on the ground and rises a few metres, so whatever is behind it
// (further up the screen) is lost in it, and whatever stands in front is drawn over it. Tree tops and roofs
// taller than the bank stand up out of it.
const FOG_SLICES = 4,
  FOG_H = 3.2;
function drawFogSlice({ b, y, i }) {
  const k = Math.max(WEATHER.fog, WEATHER.storm * winterW() * 0.7);
  const rx = b.r * (1 + 0.1 * Math.sin(T * 0.06 + b.ph + i)),
    X = b.x + Math.sin(T * 0.03 + b.ph + i * 1.7) * 40,
    base = y * TILT,
    top = base - FOG_H * HZ * (0.7 + 0.3 * Math.sin(b.ph + i)),
    bot = base + b.r * 0.12 * TILT;
  ctx.globalAlpha = Math.min(1, (k * 2.3) / FOG_SLICES);
  ctx.drawImage(mk2Tint(WEATHER.fogCol), X - rx, top, rx * 2, bot - top);
  ctx.globalAlpha = 1;
}
