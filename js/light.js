/* Flokk - light.js
   Calendar, sun, lighting overlay, seasons, sky backdrop, snowfall, dawn/dusk grading.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- calendar, sun and light ----------
   A day lasts DAY_LEN seconds. Three days make a season; twelve make the year you have to survive.
   Day length and sun height follow the latitude of southern Norway: long bright summer nights,
   short low winter days. */
const DAY_LEN = 100,
  DAYS_PER_SEASON = 3,
  YEAR_DAYS = 12,
  START_HOUR = 7;
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const CAL = { t: 0, day: 0, hour: START_HOUR, yp: 0, season: 0, year: 1 };
let SEASON = 0;
const LIGHT = {
  el: 30,
  theta: 1.5,
  night: 0,
  C: [255, 255, 255],
  a: 0,
  C2: [255, 255, 255],
  a2: 0,
  rim: 0,
  rimSide: 1,
  eve: false,
  shadowA: 1,
  skyTop: '#6F97B3',
  skyBot: '#EDE4CF',
  glow: 0,
  glowSide: 1,
  aurora: 0,
  snow: 0,
  rain: 0
};
/* ---------- weather: rain fronts drifting through, off in winter (snow covers precipitation there) ----------
   RAIN.t eases toward RAIN.target, which is re-rolled every RAIN.next seconds so showers build up and
   tail off rather than switching on and off like a light. */
const RAIN = { t: 0, target: 0, next: rr(20, 45) };
function updateWeather(dt) {
  RAIN.next -= dt;
  if (RAIN.next <= 0) {
    const chance = SEASON === 3 ? 0 : SEASON === 1 ? 0.32 : 0.58; // summer driest, spring/autumn wetter
    RAIN.target = Math.random() < chance ? rr(0.4, 1) : 0;
    RAIN.next = RAIN.target > 0 ? rr(18, 50) : rr(25, 70);
  }
  if (SEASON === 3) RAIN.target = 0; // a season change mid-shower still rains itself out below
  RAIN.t += (RAIN.target - RAIN.t) * Math.min(1, dt * (RAIN.target > RAIN.t ? 0.1 : 0.05));
  if (RAIN.t < 0.003) RAIN.t = 0;
}
function calUpdate() {
  const hTot = START_HOUR + (CAL.t / DAY_LEN) * 24;
  CAL.day = Math.floor(hTot / 24);
  CAL.hour = hTot % 24;
  CAL.yp = (hTot / 24 / YEAR_DAYS) % 1;
  CAL.season = Math.floor(CAL.day / DAYS_PER_SEASON) % 4;
  const ph = TAU * (CAL.yp - 0.02),
    dl = 12.5 + 6.2 * Math.sin(ph),
    elMax = 34 + 22 * Math.sin(ph),
    elMin = elMax - 60;
  const rise = 12 - dl / 2,
    frac = (CAL.hour - rise) / dl;
  let el;
  if (frac >= 0 && frac <= 1) el = elMax * Math.sin(Math.PI * frac);
  else {
    const nl = 24 - dl;
    let nf = ((((CAL.hour - (12 + dl / 2)) % 24) + 24) % 24) / nl;
    el = Math.min(-0.5, elMin) * Math.sin(Math.PI * clamp(nf, 0, 1)) + (elMin > 0 ? 0 : 0);
  }
  const extra = (((dl - 12) / 12) * Math.PI) / 2,
    fr = clamp(frac, -0.15, 1.15);
  LIGHT.el = el;
  LIGHT.theta = -extra + fr * (Math.PI + 2 * extra);
  // shadows: opposite the sun, longer when it is low
  const len = clamp((HZ * 0.5) / Math.tan((Math.max(8, el) * Math.PI) / 180), 12, 40);
  SX = -Math.cos(LIGHT.theta) * len;
  SY = -Math.sin(LIGHT.theta) * len * 0.9;
  LIGHT.shadowA = clamp((el + 1.5) / 6, 0, 1) * (SEASON === 3 ? 0.75 : 0.9);
  // ambient tint and sky by sun elevation
  gradeLight(el);
  if (SEASON === 3 && el > 0) {
    LIGHT.skyTop = mixHex(LIGHT.skyTop, '#9AAFBF', 0.5);
    LIGHT.skyBot = mixHex(LIGHT.skyBot, '#E3E6E8', 0.4);
    LIGHT.C = [lerp(LIGHT.C[0], 215, 0.5), lerp(LIGHT.C[1], 225, 0.5), lerp(LIGHT.C[2], 240, 0.5)];
    LIGHT.a = Math.max(LIGHT.a, 0.07);
  }
  LIGHT.night = clamp((2 - el) / 10, 0, 1);
  LIGHT.glow = clamp(1 - Math.abs(el + 1) / 7, 0, 1);
  LIGHT.glowSide = Math.cos(LIGHT.theta) > 0 ? 1 : -1;
  const auroraNight = SEASON === 3 || (SEASON === 2 && CAL.day % 3 === 2) || (SEASON === 0 && CAL.day === 0);
  LIGHT.aurora += ((auroraNight && LIGHT.night > 0.75 ? 1 : 0) - LIGHT.aurora) * 0.01;
  LIGHT.snow = winterW() * (0.35 + 0.65 * Math.max(0, Math.sin(CAL.day * 2.3 + CAL.hour * 0.35)));
  LIGHT.rain = RAIN.t;
  if (LIGHT.rain > 0.02) {
    // an overcast sky: greyer, dimmer, and the low-sun glare all but gone
    const k = LIGHT.rain * 0.6;
    LIGHT.skyTop = mixHex(LIGHT.skyTop, '#7B858E', k);
    LIGHT.skyBot = mixHex(LIGHT.skyBot, '#9CA6AC', k * 0.85);
    LIGHT.C = [lerp(LIGHT.C[0], 150, k * 0.55), lerp(LIGHT.C[1], 158, k * 0.55), lerp(LIGHT.C[2], 168, k * 0.55)];
    LIGHT.a = clamp(Math.max(LIGHT.a, k * 0.16), 0, 0.85);
    LIGHT.rim *= 1 - k * 0.85;
  }
  // a winter gale drives the snow thick and sideways; fog and storms grey the light (weather.js)
  LIGHT.snow = Math.max(LIGHT.snow, WEATHER.storm * winterW());
  weatherLight();
}
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16),
    B = parseInt(b.slice(1), 16);
  const r = lerp(A >> 16, B >> 16, t),
    g2 = lerp((A >> 8) & 255, (B >> 8) & 255, t),
    bl = lerp(A & 255, B & 255, t);
  return '#' + ((1 << 24) + ((r | 0) << 16) + ((g2 | 0) << 8) + (bl | 0)).toString(16).slice(1);
}
function tintHex(hex, extra = 1) {
  const n = parseInt(hex.slice(1), 16),
    a = Math.min(1, LIGHT.a * extra),
    a2 = Math.min(1, LIGHT.a2 * extra * 0.4);
  const f = (v, k) => lerp(lerp(v, LIGHT.C[k], a), LIGHT.C2[k], a2) | 0;
  return `rgb(${f(n >> 16, 0)},${f((n >> 8) & 255, 1)},${f(n & 255, 2)})`;
}
const winCol = () => mixHex('#34454E', '#FFD27A', clamp(LIGHT.night * 1.3, 0, 1));

/* ---------- lights: windows, the yard lamp, and a faint pool around your flock at night ---------- */
let LIGHTS = [],
  LAMPS = [],
  FEEDER = null;
function buildLights() {
  LIGHTS = [];
  LAMPS = [];
  PROPS = [];
  FEEDER = null;
  for (const b of BUILDS) {
    const c = Math.cos(b.ang),
      s = Math.sin(b.ang);
    if (b.windows) {
      for (const sg of [-1, 1]) {
        const lx = 0,
          ly = sg * (b.dep / 2 + 6);
        LIGHTS.push({
          x: b.cx + lx * c - ly * s,
          y: b.cy + lx * s + ly * c,
          h: (b.wh * 0.55) / HZ,
          r: 62,
          i: 0.85,
          fl: 0
        });
      }
    }
    if (b.door) {
      LIGHTS.push({
        x: b.cx + (b.len / 2 + 6) * c,
        y: b.cy + (b.len / 2 + 6) * s,
        h: (b.wh * 0.9) / HZ,
        r: 56,
        i: 0.75,
        fl: 0
      });
    }
  }
  if (CHURCH) placeGraves(CHURCH);
  for (const fm of FARMS) {
    const house = fm.house;
    if (!house) continue;
    const Y = fm.yard;
    // the yard lamp stands off the house's gable, on the yard side, kept inside the yard
    const [hu, hv] = yardLocal(Y, house.cx, house.cy),
      [lx, ly] = yardClamp(Y, ...yardWorld(Y, hu + (hu < 0 ? 95 : -95), hv + 48), 15);
    LAMPS.push({ x: lx, y: ly });
    LIGHTS.push({ x: lx, y: ly, h: 2.25, r: 135, i: 0.9, fl: 1 });
    addPerch(lx, ly, 2.4, 'pole', false, 0);
    const taken = [[lx, ly, 14]];
    if (fm.main) {
      // the winter feeder stands in the open, where it can be seen from the kitchen window
      const f = yardSpot(Y, taken, 30, (x, y) => Math.hypot(house.cx - x, house.cy + 60 - y));
      if (f) {
        FEEDER = { x: f[0], y: f[1], perches: [] };
        taken.push([f[0], f[1], 16]);
      }
    }
    placeProps(fm, taken);
    if (!FEEDER || !fm.main) continue;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      FEEDER.perches.push(
        addPerch(FEEDER.x + Math.cos(a) * 7, FEEDER.y + Math.sin(a) * 3 + 1, 1.62, 'feeder', false, a + Math.PI / 2)
      );
    }
  }
}
const LMC = document.createElement('canvas'),
  lmx = LMC.getContext('2d');
// the time-of-day glaze: a soft-light wash over the finished frame, sky included. Soft light warms the
// highlights and cools the darks without flattening the contrast the way a plain tint does.
function applyGlaze() {
  if (LIGHT.a2 < 0.004) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [r, gg, b] = LIGHT.C2,
    a2 = Math.min(0.6, LIGHT.a2);
  // multiply pulls green and blue down (a warm, lower sun); soft-light then lifts the warmth back into the lights
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${a2 * 0.55})`;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${a2 * 0.5})`;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // low sun: a little extra warmth on the side it shines from, fading across the view
  const g = LIGHT.rim * (1 - LIGHT.night);
  if (g > 0.05) {
    const side = LIGHT.rimSide > 0 ? 1 : 0,
      lg = ctx.createLinearGradient(cv.width * (1 - side), 0, cv.width * side, 0);
    const c = LIGHT.eve ? '255,150,70' : '255,175,150';
    lg.addColorStop(0, `rgba(${c},0)`);
    lg.addColorStop(1, `rgba(${c},${0.3 * g})`);
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  ctx.globalCompositeOperation = 'source-over';
}
// a headlamp's throw: a cone that starts at the lamp and widens and fades forward along the ground,
// soft at its edges and with nothing behind the lamp. One mask for cutting the dark, one warm for the glow.
function mkCone(col) {
  const c = mk(256, 128),
    q = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const w = 60 * (1 - i / 8) + 6;
    q.fillStyle = `rgba(${col},0.2)`;
    q.beginPath();
    q.moveTo(0, 64 - 1.5);
    q.lineTo(256, 64 - w);
    q.lineTo(256, 64 + w);
    q.lineTo(0, 64 + 1.5);
    q.closePath();
    q.fill();
  }
  q.globalCompositeOperation = 'destination-in';
  const gr = q.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(0,0,0,.7)');
  gr.addColorStop(0.08, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,.5)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  q.fillStyle = gr;
  q.fillRect(0, 0, 256, 128);
  return c;
}
const CONE = { cut: mkCone('0,0,0'), glow: mkCone('255,176,96') };
// Trees stand between the lamps and the eye. The light overlay is laid over the finished frame, so
// without this a yard lamp's pool, a window's spill or a car's beams glowed straight through any crown
// in the way. The crowns near a light are drawn into their own mask, and there the night stays dark:
// the pool lies on the ground *under* the crown, and a crown lit only from below shows a dark top.
// A little light is let through at the rim so a tree beside a lamp still reads as standing in its glow.
const OCC = document.createElement('canvas'),
  ocx = OCC.getContext('2d'),
  OCC_K = 0.88;
// the mask is soft and half-size, so each crown goes in from a small copy of its sprite (made once a season)
const OCC_SPR = new WeakMap();
function occSprite(spr) {
  let m = OCC_SPR.get(spr);
  if (!m) {
    m = mk(Math.ceil(spr.width / 3), Math.ceil(spr.height / 3));
    m.getContext('2d').drawImage(spr, 0, 0, m.width, m.height);
    OCC_SPR.set(spr, m);
  }
  return m;
}
// the lit patch of ground round a light, as a box on screen (world x, tilted y)
function lightBox(l) {
  const R = l.dir !== undefined ? l.r * 1.4 : l.r;
  return [l.x - R, l.x + R, (l.y - R) * TILT - l.h * HZ - 12, (l.y + R) * TILT];
}
// the trees whose crowns cover some of a visible light's patch (V must be the copy being drawn)
function treesOver(src, out) {
  for (const l of src) {
    if (l.soft || !visU(l.x, l.y, l.r * 1.4, l.h * HZ + l.r)) continue;
    const [x0, x1, y0, y1] = lightBox(l),
      i0 = Math.floor((x0 - 80) / TC),
      i1 = Math.floor((x1 + 80) / TC),
      j0 = Math.floor(y0 / TILT / TC),
      j1 = Math.floor((y1 + 180) / TILT / TC);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const a = TG.get(i + ',' + j);
        if (!a) continue;
        for (const t of a) {
          const hw = SW * t.k * 0.5,
            b = t.y * TILT;
          if (t.x + hw > x0 && t.x - hw < x1 && b > y0 && b - t.hpx < y1) out.add(t);
        }
      }
  }
  return out;
}
// does a crown in front of a light hide the lamp itself? A rough outline of the crown in screen space:
// a cone for a spruce, an ellipse for a leafy tree (bare branches in winter hide nothing). 0 = hidden.
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function crownCover(t, X, Y) {
  if (SEASON === 3 && t.type !== 'spruce') return 1;
  const k = t.k,
    base = t.y * TILT;
  if (t.type === 'spruce') {
    const f = (base - Y) / t.hpx;
    if (f < 0.12 || f > 1) return 1;
    const hw = SR * k * (1 - f) * 0.9;
    return sstep(0.75, 1.05, Math.abs(X - t.x) / hw);
  }
  const [cy, rx, ry] = CAN[t.type],
    dx = (X - t.x) / (rx * SR * k * (t.ws || 1)),
    dy = (Y - (base - cy * SR * k)) / (ry * SR * k);
  return sstep(0.7, 1.05, Math.hypot(dx, dy));
}
function applyLight(tx, ty, KS, inK) {
  const a = LIGHT.a;
  if (a + LIGHT.a2 < 0.012) return;
  const z = cam.z,
    SQ = 0.5,
    w = Math.ceil(cv.width * SQ),
    h = Math.ceil(cv.height * SQ);
  if (LMC.width !== w || LMC.height !== h) {
    LMC.width = w;
    LMC.height = h;
  }
  const c = lmx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, w, h);
  c.fillStyle = `rgba(${LIGHT.C[0] | 0},${LIGHT.C[1] | 0},${LIGHT.C[2] | 0},${a})`;
  c.fillRect(0, 0, w, h);
  const nf = LIGHT.night;
  if (nf > 0.02) {
    const src = LIGHTS.concat(trainLights(), trafficLights());
    if (L && birds.includes(L)) src.push({ x: L.x, y: L.y, h: L.z, r: 170, i: 0.32, fl: 0, soft: 1 });
    const K = l => nf * l.i * (l.fl ? 0.93 + 0.07 * Math.sin(T * 11 + l.x) : 1);
    // 1. the light on the ground: round pools, and the beams thrown ahead of vehicles
    for (const pass of ['destination-out', 'lighter']) {
      c.globalCompositeOperation = pass;
      for (const kk2 of KS) {
        const tk = inK(kk2);
        c.setTransform(dpr * z * SQ, 0, 0, dpr * z * SQ, tk * SQ, ty * SQ);
        for (const l of src) {
          if (!visU(l.x, l.y, l.r * 1.4, l.h * HZ + l.r)) continue;
          const k = K(l);
          const col = pass === 'lighter' ? (l.soft ? '150,170,210' : '255,176,96') : '0,0,0';
          const kk = pass === 'lighter' ? k * (l.soft ? 0.05 : 0.2) : k * 0.95;
          c.save();
          c.translate(l.x, l.y * TILT);
          c.scale(1, TILT);
          if (l.dir !== undefined) {
            // a beam: a cone thrown forward along the ground from the lamp, none of it behind
            c.rotate(l.dir);
            c.globalAlpha = Math.min(1, kk * (pass === 'lighter' ? 1.7 : 1));
            c.drawImage(pass === 'lighter' ? CONE.glow : CONE.cut, 0, -l.r * 0.34, l.r * 1.4, l.r * 0.68);
            c.globalAlpha = 1;
          } else {
            const gr = c.createRadialGradient(0, 0, 0, 0, 0, l.r);
            gr.addColorStop(0, `rgba(${col},${kk * 0.9})`);
            gr.addColorStop(1, `rgba(${col},0)`);
            c.fillStyle = gr;
            c.fillRect(-l.r, -l.r, l.r * 2, l.r * 2);
          }
          c.restore();
        }
      }
    }
    // 2. the crowns near a light keep the night on them. Only the patch of the mask the crowns cover is
    // touched, so a night with no tree near a lamp costs next to nothing.
    const near = new Set(),
      sc = dpr * z * SQ;
    let bx0 = w,
      by0 = h,
      bx1 = 0,
      by1 = 0;
    if (OCC.width !== w || OCC.height !== h) {
      OCC.width = w;
      OCC.height = h;
    }
    const o = ocx;
    // the set of trees covering a light is pure world-space geometry, independent of which repeated
    // copy of the map (kk2) we're drawing it into, so the grid scan only needs to run once per frame
    const over = treesOver(src, new Set());
    for (const kk2 of KS) {
      const tk = inK(kk2);
      for (const t of over) {
        if (!visU(t.x, t.y, t.r * 2.4, t.hpx + 10)) continue;
        near.add(t);
        const k = t.k,
          kw = k * (t.ws || 1),
          X = t.x * sc + tk * SQ,
          Y = t.y * TILT * sc + ty * SQ,
          hw = (AX * kw + SHT * k * 0.1) * sc;
        if (bx0 > bx1) {
          o.setTransform(1, 0, 0, 1, 0, 0);
          o.globalCompositeOperation = 'source-over';
          o.clearRect(0, 0, w, h);
        }
        bx0 = Math.min(bx0, X - hw);
        bx1 = Math.max(bx1, X + hw);
        by0 = Math.min(by0, Y - AY * k * sc);
        by1 = Math.max(by1, Y + (SHT - AY) * k * sc);
        o.setTransform(sc, 0, 0, sc, X, Y);
        o.transform(1, 0, treeSway(t), 1, 0, 0);
        o.drawImage(occSprite(SPR[t.type][t.v]), -AX * kw, -AY * k, SW * kw, SHT * k);
      }
    }
    bx0 = Math.max(0, Math.floor(bx0) - 1);
    by0 = Math.max(0, Math.floor(by0) - 1);
    bx1 = Math.min(w, Math.ceil(bx1) + 1);
    by1 = Math.min(h, Math.ceil(by1) + 1);
    if (bx1 > bx0 && by1 > by0) {
      const bw = bx1 - bx0,
        bh = by1 - by0;
      o.setTransform(1, 0, 0, 1, 0, 0);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = OCC_K;
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(OCC, bx0, by0, bw, bh, bx0, by0, bw, bh);
      o.globalCompositeOperation = 'source-in';
      o.fillStyle = `rgb(${LIGHT.C[0] | 0},${LIGHT.C[1] | 0},${LIGHT.C[2] | 0})`;
      o.fillRect(bx0, by0, bw, bh);
      c.globalAlpha = OCC_K * a;
      c.globalCompositeOperation = 'source-over';
      c.drawImage(OCC, bx0, by0, bw, bh, bx0, by0, bw, bh);
      c.globalAlpha = 1;
    }
    // 3. the glow round each lamp itself, kept small, and hidden by a crown standing in front of it
    for (const pass of ['destination-out', 'lighter']) {
      c.globalCompositeOperation = pass;
      for (const kk2 of KS) {
        const tk = inK(kk2);
        c.setTransform(dpr * z * SQ, 0, 0, dpr * z * SQ, tk * SQ, ty * SQ);
        for (const l of src) {
          if (!visU(l.x, l.y, l.r * 1.4, l.h * HZ + l.r)) continue;
          const X = l.x,
            Y = PY(l.y, l.h);
          let vis = 1;
          if (!l.soft)
            for (const t of near) {
              if (t.y <= l.y || t.y - l.y > 260 || Math.abs(t.x - X) > t.r * 3) continue;
              vis *= 1 - OCC_K * (1 - crownCover(t, X, Y));
              if (vis < 0.02) break;
            }
          if (vis < 0.02) continue;
          const k = K(l) * vis;
          const col = pass === 'lighter' ? (l.soft ? '150,170,210' : '255,176,96') : '0,0,0';
          const kk = pass === 'lighter' ? k * (l.soft ? 0.05 : 0.2) : k * 0.95;
          const hr = l.dir !== undefined ? 12 : l.r * 0.55;
          const gr = c.createRadialGradient(X, Y, 0, X, Y, hr);
          gr.addColorStop(0, `rgba(${col},${kk})`);
          gr.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = gr;
          c.fillRect(X - hr, Y - hr, hr * 2, hr * 2);
        }
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.drawImage(LMC, 0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'source-over';
}
function drawLamp(l) {
  const b = l.y * TILT,
    top = PY(l.y, 2.3);
  ctx.strokeStyle = '#3E3A36';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(l.x, b);
  ctx.lineTo(l.x, top);
  ctx.lineTo(l.x + 7, top + 2);
  ctx.stroke();
  const on = LIGHT.night > 0.1;
  ctx.fillStyle = on ? mixHex('#8A8070', '#FFE3A0', LIGHT.night) : '#8A8070';
  ctx.beginPath();
  ctx.moveTo(l.x + 3, top + 2);
  ctx.lineTo(l.x + 11, top + 2);
  ctx.lineTo(l.x + 9, top + 6);
  ctx.lineTo(l.x + 5, top + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2E2A26';
  ctx.fillRect(l.x + 2.5, top, 9, 2.4);
}
function drawFeeder(f) {
  if (SEASON !== 3) return;
  const b = f.y * TILT,
    top = PY(f.y, 1.45);
  ctx.strokeStyle = '#6A5238';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(f.x, b);
  ctx.lineTo(f.x, top);
  ctx.stroke();
  ctx.fillStyle = '#C9A14A';
  ctx.beginPath();
  ctx.moveTo(f.x, top + 2);
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    ctx.lineTo(f.x + Math.cos(a) * 9, top - 6 + Math.sin(a) * 9);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#A37E34';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + ((i + 0.5) / 7) * Math.PI;
    ctx.moveTo(f.x, top + 1);
    ctx.lineTo(f.x + Math.cos(a) * 9, top - 6 + Math.sin(a) * 9);
  }
  ctx.stroke();
  ctx.fillStyle = '#B8292B';
  ctx.fillRect(f.x - 2.5, top - 1, 5, 3);
}

/* ---------- seasons ---------- */
/* season changes crossfade: the old ground and old trees fade out over ~10 s while the new season comes in */
const TRANS = { t: 1, prevG: null, prevSPR: null, prevSeason: 0 };
// building the new season's tree sprites, rims and ground texture is real work (the ground repaint alone
// samples noise over the whole map). Done all at once it freezes the game for over a second right as the
// season turns; instead a smooth season change hands the job here and update() steps through it a little
// each frame (see runBgJob in update.js), while the old sprites and ground (TRANS.prevSPR/prevG) keep
// showing through the crossfade in the meantime, so nothing pops once the job actually finishes.
let BG_JOB = null;
function* seasonVisualsGen(s) {
  yield* buildSpritesGen(s);
  yield* buildRimsGen();
  SSPR = null;
  yield* paintGroundGen(s);
}
const tEase = () => {
  const t = clamp(TRANS.t, 0, 1);
  return t * t * (3 - 2 * t);
};
const winterW = () => lerp(TRANS.prevSeason === 3 ? 1 : 0, SEASON === 3 ? 1 : 0, tEase());
// growUnder/drawBush blend a tree or bush's baked sprite with a bare overlay live, by how far
// through spring's leafing-out or autumn's leaf-fall the season actually is - so by the end of
// autumn a tree is mostly bare on screen even though its baked sprite is still the full green one
// underneath. A season-change snapshot that just grabs the baked sprite forgets that overlay
// entirely, so the outgoing tree flashes back to full leaf for the whole crossfade right as the
// new (often bare) season fades in. This bakes the same end-of-season blend into the snapshot
// once, so the crossfade starts from what was actually on screen a moment before. Only autumn
// needs it: spring's own blend already reaches full leaf (matching the baked sprite) by its end.
function leafFallSnap(spr, bare, fallEnd) {
  const c = mk(spr.width, spr.height),
    g = c.getContext('2d');
  g.drawImage(bare, 0, 0);
  g.globalAlpha = 1 - fallEnd;
  g.drawImage(spr, 0, 0);
  return c;
}
function applySeason(s, smooth) {
  if (smooth && s !== SEASON) {
    TRANS.prevG = mk(G.width, G.height);
    TRANS.prevG.getContext('2d').drawImage(G, 0, 0);
    const autumnFall = SEASON === 2 && GROW.leaf && GROW.leafSeason === SEASON;
    TRANS.prevSPR = {
      spruce: SPR.spruce.slice(),
      birch: SPR.birch.map((spr, v) => (autumnFall ? leafFallSnap(spr, GROW.leaf.bare.birch[v], 0.85) : spr)),
      decid: SPR.decid.map((spr, v) => (autumnFall ? leafFallSnap(spr, GROW.leaf.bare.decid[v], 0.7) : spr)),
      bush: BSPR.cur.map((spr, v) =>
        autumnFall && v < 9 && BSPR.bare[v] ? leafFallSnap(spr, BSPR.bare[v], 0.85) : spr
      )
    };
    TRANS.prevSeason = SEASON;
    TRANS.t = 0;
  } else {
    TRANS.t = 1;
    TRANS.prevG = null;
    TRANS.prevSPR = null;
    TRANS.prevSeason = s;
  }
  const oldA = smooth ? ANIMALS.filter(a => a.life === undefined) : [];
  SEASON = s;
  if (smooth) {
    BG_JOB = seasonVisualsGen(s); // stepped a little each frame in update() instead of all at once here
  } else {
    BG_JOB = null; // a hard cut (new game, dev jump): no crossfade waiting on it, so just do it now
    const it = seasonVisualsGen(s);
    while (!it.next().done);
  }
  for (const p of perches) {
    if (p.type === 'tree') p.cover = s !== 3 || p.tt === 'spruce';
    if (p.type === 'bale') p.off = !(s === 2 || s === 3);
    if (p.type === 'feeder') p.off = s !== 3;
    if (p.off && p.occ) {
      const b = p.occ;
      p.occ = null;
      if (b.perch === p) {
        b.perch = null;
        if (b.state !== 'fly') b.state = 'fly';
      }
    }
  }
  growSeason();
  spawnAnimals();
  if (smooth) {
    for (const a of ANIMALS) a.fade = 0;
    for (const a of oldA) {
      a.dying = true;
      a.fade = a.fade ?? 1;
      ANIMALS.push(a);
    }
  }
}
function seasonBanner() {
  const el = $('banner');
  $('bSeason').textContent = SEASONS[SEASON];
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

/* ---------- sky behind the world: drawn last, underneath, with destination-over ---------- */
const STARS = [];
{
  const R2 = mulberry32(4242);
  for (let i = 0; i < 260; i++)
    STARS.push({ x: R2() * 4000, y: -900 + R2() * 680, b: 0.3 + R2() * 0.7, p: R2() * TAU });
}
function drawSkyBehind(tx, ty) {
  const z = cam.z;
  ctx.globalCompositeOperation = 'destination-over';
  ctx.setTransform(dpr * z, 0, 0, dpr * z, tx, ty);
  if (V.py0 < -60) {
    const SNF = [0.2, 0.55, 0.32, -0.5],
      snowAll = winterW() > 0.5,
      snowF = lerp(SNF[TRANS.prevSeason], SNF[SEASON], tEase());
    for (let li = RIDGES.length - 1; li >= 0; li--) {
      const L2 = RIDGES[li],
        off = PX(L2.p),
        st2 = L2.step,
        nH = L2.hs.length,
        HS = i => L2.hs[((i % nH) + nH) % nH],
        TT = i => L2.tt[((i % nH) + nH) % nH];
      const i0 = Math.floor((V.x0 - off) / st2) - 1,
        i1 = Math.ceil((V.x1 - off) / st2) + 1;
      if (L2.p > 0) {
        const hz = ctx.createLinearGradient(0, L2.by - 70, 0, L2.by);
        const hc = LIGHT.skyBot;
        hz.addColorStop(0, hc + '00');
        hz.addColorStop(1, hc + '99');
        ctx.fillStyle = hz;
        ctx.fillRect(V.x0, L2.by - 70, V.x1 - V.x0, 72);
      }
      if (L2.trees) {
        ctx.fillStyle = tintHex(mixHex(snowAll ? '#3A4A40' : shade(L2.bot, 0.9), L2.top, L2.p ? 0.35 : 0.12));
        ctx.beginPath();
        for (let i = i0; i <= i1; i++) {
          const x = i * st2 + off,
            top = L2.by - HS(i),
            hh = (L2.p ? 7 : 11) * TT(i);
          ctx.moveTo(x - hh * 0.42, top + 3);
          ctx.lineTo(x, top - hh);
          ctx.lineTo(x + hh * 0.42, top + 3);
        }
        ctx.fill();
      }
      if (L2.snow || snowAll) {
        const sH = L2.trees ? -999 : L2.base + L2.amp * snowF;
        ctx.fillStyle = tintHex(
          mixHex('#F2F5F7', LIGHT.eve ? '#FFB49A' : '#FFD0C4', L2.p > 0.2 ? LIGHT.rim * 0.7 : 0),
          0.9
        );
        ctx.beginPath();
        for (let i = i0; i < i1; i++) {
          const a2 = HS(i),
            b2 = HS(i + 1);
          if (a2 < sH && b2 < sH) continue;
          const x = i * st2 + off;
          const cap = L2.trees ? 10 : 26;
          const da = Math.min(cap, Math.max(0, a2 - sH) * 0.35 * (0.7 + 0.3 * Math.sin(i * 1.9))),
            db = Math.min(cap, Math.max(0, b2 - sH) * 0.35 * (0.7 + 0.3 * Math.sin((i + 1) * 1.9)));
          ctx.moveTo(x, L2.by - a2);
          ctx.lineTo(x + st2, L2.by - b2);
          ctx.lineTo(x + st2, L2.by - b2 + db);
          ctx.lineTo(x, L2.by - a2 + da);
          ctx.closePath();
        }
        ctx.fill();
      }
      const glowK = L2.p > 0.2 ? LIGHT.rim * (L2.p > 0.5 ? 0.62 : 0.35) : 0,
        gcol = LIGHT.eve ? '#F2A084' : '#F4BCAE';
      const gr = ctx.createLinearGradient(0, L2.by - L2.mx, 0, L2.by);
      const top = mixHex(snowAll && !L2.trees ? mixHex(L2.top, '#E8EDF1', 0.55) : L2.top, gcol, glowK),
        // the nearest band sits right on the land's northern edge: while snow lies there (winter, and spring
        // until it melts) its foot is snowy forest floor like the ground in front of it, or the snow would
        // end in a straight line against a dark band
        bot = L2.p
          ? snowAll
            ? mixHex(L2.bot, '#DCE3E8', L2.trees ? 0.35 : 0.5)
            : L2.bot
          : mixHex(L2.bot, '#DCE3E8', 0.8 * (snowAll ? 1 : GROW.maskOn ? GROW.northSnow : 0));
      gr.addColorStop(0, tintHex(top));
      gr.addColorStop(1, tintHex(bot));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(i0 * st2 + off, L2.by + 2);
      for (let i = i0; i <= i1; i++) ctx.lineTo(i * st2 + off, L2.by - HS(i));
      ctx.lineTo(i1 * st2 + off, L2.by + 2);
      ctx.closePath();
      ctx.fill();
    }
    const nf = LIGHT.night;
    for (const c of SKYCLOUDS) {
      const X = V.x0 - 700 + ((((c.x + PX(c.p) - (V.x0 - 700)) % 6000) + 6000) % 6000),
        w = 520 * c.s,
        h = 220 * c.s;
      if (X + w / 2 < V.x0 || X - w / 2 > V.x1) continue;
      if (LIGHT.rim > 0.04) {
        ctx.globalAlpha = 0.85 * LIGHT.rim;
        ctx.drawImage(CLOUD_WARM, X - w / 2, c.y - h / 2, w, h);
      }
      ctx.globalAlpha = 0.9 * (1 - 0.75 * nf) * (1 - 0.55 * LIGHT.rim);
      ctx.drawImage(CLOUD_SPR, X - w / 2, c.y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    if (LIGHT.aurora > 0.02) {
      for (let k = 0; k < 3; k++) {
        const base = -520 + k * 55,
          off = PX(0.85);
        for (let x = Math.floor((V.x0 - off) / 10) * 10; x < V.x1 - off + 10; x += 10) {
          const n = Math.sin(x * 0.004 + T * 0.25 + k * 2) * 0.5 + Math.sin(x * 0.011 - T * 0.4 + k) * 0.35;
          const a = clamp(0.25 + 0.5 * n, 0, 1) * LIGHT.aurora * (k === 1 ? 0.9 : 0.55);
          if (a < 0.02) continue;
          const y = base + 40 * Math.sin(x * 0.003 + T * 0.15 + k);
          const hh = 120 + 60 * Math.sin(x * 0.007 + k);
          const gr = ctx.createLinearGradient(0, y - hh, 0, y);
          gr.addColorStop(0, `rgba(${k === 2 ? '170,90,200' : '90,255,170'},0)`);
          gr.addColorStop(0.75, `rgba(${k === 2 ? '170,90,200' : '90,255,170'},${a * 0.45})`);
          gr.addColorStop(1, `rgba(120,255,190,${a * 0.12})`);
          ctx.fillStyle = gr;
          ctx.fillRect(x + off, y - hh, 11, hh);
        }
      }
    }
    if (nf > 0.05) {
      const mx = cam.x + (vw / cam.z) * 0.26,
        my = -600;
      const gr = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
      gr.addColorStop(0, `rgba(235,238,225,${0.35 * nf})`);
      gr.addColorStop(1, 'rgba(235,238,225,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(mx - 90, my - 90, 180, 180);
      ctx.fillStyle = `rgba(244,242,228,${nf})`;
      ctx.beginPath();
      ctx.arc(mx, my, 13, 0, TAU);
      ctx.fill();
      for (const s of STARS) {
        const X = V.x0 + ((((s.x + PX(0.95) - V.x0) % 4000) + 4000) % 4000);
        if (X < V.x0 || X > V.x1 || s.y < V.py0) continue;
        const a = nf * s.b * (0.7 + 0.3 * Math.sin(T * 2 + s.p));
        ctx.fillStyle = `rgba(255,255,245,${a})`;
        ctx.fillRect(X, s.y, 1.6, 1.6);
      }
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const hY = ((-93 - cam.py) * z + vh / 2) * dpr;
  if (LIGHT.glow > 0.02) {
    const gx = cv.width * (0.5 + 0.45 * LIGHT.glowSide);
    const gr = ctx.createRadialGradient(gx, hY, 0, gx, hY, cv.width * 0.6);
    const gc = LIGHT.eve ? '255,118,58' : '255,176,150';
    gr.addColorStop(0, `rgba(${gc},${0.62 * LIGHT.glow})`);
    gr.addColorStop(1, `rgba(${gc},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  const gr = ctx.createLinearGradient(0, hY - 480 * z * dpr, 0, hY);
  gr.addColorStop(0, LIGHT.skyTop);
  gr.addColorStop(1, LIGHT.skyBot);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------- rain: the overcast and thunder (the drops fall in weather.js) ---------- */
let THUNDER = { flash: 0, next: rr(30, 90) };
function drawRain(dt) {
  const I = LIGHT.rain;
  if (I < 0.02 || SEASON === 3) return;
  // an overcast wash plus a faint sheen, so the whole scene reads as wet rather than just streaked
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(150,160,172,${0.16 * I})`;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.globalCompositeOperation = 'source-over';
  if (THUNDER.flash > 0.001) {
    ctx.fillStyle = `rgba(226,232,242,${THUNDER.flash * 0.55})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
    THUNDER.flash *= Math.max(0, 1 - dt * 3.2);
  }
  // a rare, distant flash-and-rumble during a heavy shower
  if (I > 0.55) {
    THUNDER.next -= dt;
    if (THUNDER.next <= 0) {
      THUNDER.next = rr(35, 110);
      THUNDER.flash = rr(0.5, 1);
      thunder();
    }
  }
  // the drops themselves fall through the world (weather.js)
}

/* ---------- sunrise / sunset grading ----------
   Two tint layers over the world (a shade layer and a coloured glaze), separate palettes for
   morning and evening, a warm rim of light on whatever faces the low sun, and alpenglow. */
// [sun elevation, shade colour, shade amount, glaze colour, glaze amount (soft-light), sky top, sky bottom]
const KM = [
  [-20, [10, 16, 42], 0.66, [40, 50, 120], 0.1, '#060B1E', '#16213D'],
  [-9, [22, 30, 70], 0.54, [90, 80, 160], 0.14, '#0E1834', '#2C3A66'],
  [-4, [50, 46, 100], 0.32, [245, 140, 170], 0.3, '#34427A', '#D8A0AC'],
  [0, [60, 44, 76], 0.09, [255, 140, 140], 0.46, '#6A84B2', '#F7C4AA'],
  [5, [40, 30, 40], 0.03, [255, 160, 140], 0.4, '#7B98BC', '#F7D9BE'],
  [12, [10, 10, 20], 0.01, [255, 190, 160], 0.24, '#6F97B3', '#EDE4CF'],
  [20, [0, 0, 0], 0, [255, 240, 210], 0.08, '#6F97B3', '#EDE4CF'],
  [70, [0, 0, 0], 0, [255, 255, 255], 0, '#6A94B4', '#E6E8DE']
];
const KE = [
  [-20, [10, 16, 42], 0.66, [40, 50, 120], 0.1, '#060B1E', '#16213D'],
  [-9, [20, 24, 66], 0.55, [110, 80, 170], 0.16, '#0C1532', '#2A2C5E'],
  [-4, [48, 34, 90], 0.32, [255, 110, 130], 0.32, '#2E3470', '#D8707C'],
  [0, [70, 36, 60], 0.08, [255, 105, 80], 0.42, '#566AA0', '#F59656'],
  [5, [50, 30, 40], 0.03, [255, 128, 84], 0.36, '#6E86B0', '#F6BE80'],
  [12, [20, 16, 30], 0.01, [255, 160, 110], 0.26, '#6F97B3', '#EDE4CF'],
  [20, [0, 0, 0], 0, [255, 225, 170], 0.1, '#6F97B3', '#EDE4CF'],
  [70, [0, 0, 0], 0, [255, 255, 255], 0, '#6A94B4', '#E6E8DE']
];
function gradeLight(el) {
  const eve = Math.cos(LIGHT.theta) < 0,
    K = eve ? KE : KM;
  let i = 0;
  while (i < K.length - 2 && el > K[i + 1][0]) i++;
  const A = K[i],
    B = K[i + 1],
    t = clamp((el - A[0]) / (B[0] - A[0]), 0, 1);
  const L3 = (p, q) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
  LIGHT.C = L3(A[1], B[1]);
  LIGHT.a = lerp(A[2], B[2], t);
  LIGHT.C2 = L3(A[3], B[3]);
  LIGHT.a2 = lerp(A[4], B[4], t);
  LIGHT.skyTop = mixHex(A[5], B[5], t);
  LIGHT.skyBot = mixHex(A[6], B[6], t);
  LIGHT.eve = eve;
  LIGHT.rim = el > -1.5 ? clamp((el + 1.5) / 3, 0, 1) * clamp((16 - el) / 11, 0, 1) : 0;
  LIGHT.rimSide = Math.cos(LIGHT.theta) > 0 ? 1 : -1;
}
function mixRgb(str, c, t) {
  const m = str.match(/\d+/g).map(Number);
  return `rgb(${lerp(m[0], c[0], t) | 0},${lerp(m[1], c[1], t) | 0},${lerp(m[2], c[2], t) | 0})`;
}
const rimCol = () => (LIGHT.eve ? [255, 150, 76] : [255, 188, 150]);
const CLOUD_WARM = (() => {
  const c = mk(520, 220),
    q = c.getContext('2d');
  q.drawImage(CLOUD_SPR, 0, 0);
  q.globalCompositeOperation = 'source-atop';
  const lg = q.createLinearGradient(0, 40, 0, 210);
  lg.addColorStop(0, 'rgba(255,214,186,.55)');
  lg.addColorStop(1, 'rgba(240,110,86,.75)');
  q.fillStyle = lg;
  q.fillRect(0, 0, 520, 220);
  return c;
})();
/* rim masks for the trees: a warm edge on the sun side, a cool shade on the far side (half resolution) */
const RIM = { spruce: [], birch: [], decid: [] };
function mkRim(src, side, warm) {
  const w = SW,
    h = SHT,
    c = mk(w, h),
    q = c.getContext('2d');
  q.drawImage(src, 0, 0, w, h);
  q.globalCompositeOperation = 'source-in';
  const gr = q.createLinearGradient(side > 0 ? w * 0.78 : w * 0.22, 0, side > 0 ? w * 0.42 : w * 0.58, 0);
  const col = warm ? '255,176,96' : '34,40,86';
  gr.addColorStop(0, `rgba(${col},1)`);
  gr.addColorStop(1, `rgba(${col},0)`);
  q.fillStyle = gr;
  q.fillRect(0, 0, w, h);
  return c;
}
const OUTL = { spruce: [], birch: [], decid: [] };
function mkOutline(src) {
  const w = SW,
    h = SHT,
    c = mk(w, h),
    q = c.getContext('2d');
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-0.7, -0.7],
    [0.7, -0.7],
    [-0.7, 0.7],
    [0.7, 0.7]
  ])
    q.drawImage(src, dx, dy, w, h);
  q.globalCompositeOperation = 'source-in';
  q.fillStyle = '#FFF4D8';
  q.fillRect(0, 0, w, h);
  q.globalCompositeOperation = 'destination-out';
  q.drawImage(src, 0, 0, w, h);
  return c;
}
function* buildRimsGen() {
  for (const t of ['spruce', 'birch', 'decid'])
    for (let i = 0; i < NV; i++) {
      OUTL[t][i] = mkOutline(SPR[t][i]);
      yield;
    }
  for (const t of ['spruce', 'birch', 'decid'])
    for (let i = 0; i < NV; i++) {
      const s = SPR[t][i];
      RIM[t][i] = { w: [mkRim(s, -1, 1), mkRim(s, 1, 1)], c: [mkRim(s, -1, 0), mkRim(s, 1, 0)] };
      yield;
    }
}
