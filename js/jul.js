/* Flokk - jul.js
   Christmas Eve. One winter night a year, a different one each year, the parish keeps julaften. Through
   the afternoon each farm puts out its julenek, the sheaf of oats on a pole for the small birds, and a
   wreath goes up on the door. As the dark comes the houses light up one at a time: a string of lights
   along the eaves, a paper star and a candle bridge in the front windows, a little spruce lit in the yard.
   At five the church bells ring Christmas in. By morning the lights go out again, house by house, and
   by midday it is all put away. The owl still hunts; it is still winter.
   Placed once per land by buildLights (light.js), with its own random stream so the rest of the land
   comes out the same; ticked from update(); drawn by drawBuilding (render.js) and as props (kind 12).
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const JUL = { farms: [], lights: [] };
const NEK_H = 1.9,
  JUL_TREE_K = 0.42;
// julaften for the year that holds day d: the first or the second night of that winter (never the
// last, which runs into spring at midnight)
function julDay(d) {
  const y = Math.floor(d / YEAR_DAYS);
  return y * YEAR_DAYS + 3 * DAYS_PER_SEASON + (hash2(y, 0x1a1) < 0.5 ? 0 : 1);
}
function buildJul() {
  JUL.farms = [];
  const keepR = R;
  R = mulberry32((SEED ^ 0x1a17) + 31);
  for (const fm of FARMS) {
    const h = fm.house;
    if (!h) continue;
    const Y = fm.yard,
      taken = PROPS.filter(p => p.fm === fm).map(p => [p.x, p.y, 20]);
    for (const l of LAMPS) taken.push([l.x, l.y, 14]);
    if (FEEDER) taken.push([FEEDER.x, FEEDER.y, 16]);
    const c = Math.cos(h.ang),
      s = Math.sin(h.ang),
      // the front door, where the farmer steps out
      fx = h.cx - (h.dep / 2 + 50) * s,
      fy = h.cy + (h.dep / 2 + 50) * c;
    const j = {
      fm,
      h: R(),
      out: false,
      on: false,
      col: R() < 0.3, // most strings are warm white; some farms go for coloured bulbs
      lights: []
    };
    // the julenek stands out in the open, where it can be watched from the kitchen window
    const np = yardSpot(Y, taken, 24, (x, y) => Math.abs(Math.hypot(fx - x, fy - y) - 30));
    if (np) {
      taken.push([np[0], np[1], 14]);
      j.nek = { k: 'nek', x: np[0], y: np[1], fm, ph: R() * TAU, jul: j };
      PROPS.push(j.nek);
      j.perches = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        const p = addPerch(np[0] + Math.cos(a) * 5, np[1] + Math.sin(a) * 2.4 + 0.6, NEK_H - 0.3, 'nek', false);
        p.ang = a + Math.PI / 2;
        p.off = true;
        j.perches.push(p);
      }
    }
    // a small spruce by the house, lit (not every farm has one)
    if (fm.main || R() < 0.55) {
      const tp = yardSpot(Y, taken, 18, (x, y) => Math.abs(Math.hypot(fx - x, fy - y) - 20) + Math.abs(y - fy) * 0.5);
      if (tp) {
        taken.push([tp[0], tp[1], 12]);
        const v = (R() * NV) | 0,
          sh = spruceShape(v),
          bulbs = [];
        for (let i = 0; i < 18; i++) {
          const f = 0.14 + 0.78 * ((i + R() * 0.8) / 18);
          bulbs.push([f, (R() * 2 - 1) * 0.8 * (1 - f), i % 4]);
        }
        j.tree = { k: 'jtree', x: tp[0], y: tp[1], fm, v, hpx: TD.spruce * sh.hMul * SR * JUL_TREE_K, bulbs, jul: j };
        PROPS.push(j.tree);
        j.lights.push({ x: tp[0], y: tp[1], h: (j.tree.hpx * 0.45) / HZ, r: 58, i: 0.75, fl: 0, col: '255,196,120' });
      }
    }
    // the string along the eaves lights the snow under them a little, on both sides of the house
    for (const sg of [-1, 1])
      for (const u of [-0.33, 0, 0.33]) {
        const lx = u * h.len,
          ly = sg * (h.dep / 2 + 6);
        j.lights.push({
          x: h.cx + lx * c - ly * s,
          y: h.cy + lx * s + ly * c,
          h: (h.wh - 2) / HZ,
          r: 40,
          i: 0.8,
          fl: 0,
          col: j.col ? '255,160,150' : '255,206,140'
        });
      }
    h.jul = j;
    JUL.farms.push(j);
  }
  R = keepR;
}
// each house keeps its own hours: its decorations go out some time in the afternoon and are put away
// some time the next morning, and its lights go on at some point after dark and off again at first light
function julTick() {
  const fd = CAL.day + CAL.hour / 24,
    rel = fd - julDay(CAL.day),
    winter = SEASON === 3;
  JUL.lights.length = 0;
  for (const j of JUL.farms) {
    const out = winter && rel > (13 + 3 * j.h) / 24 && rel < 1 + (9.5 + 2.5 * j.h) / 24,
      on = out && LIGHT.night > 0.1 && rel > (15.6 + 3 * j.h) / 24 && rel < 1 + (7.6 + 1.6 * j.h) / 24;
    if (out !== j.out && j.perches)
      for (const p of j.perches) {
        p.off = !out;
        const b = p.occ;
        if (!out && b) {
          p.occ = null;
          if (b.perch === p) {
            b.perch = null;
            if (b.state !== 'fly') b.state = 'fly';
          }
        }
      }
    j.out = out;
    j.on = on;
    if (on) for (const l of j.lights) JUL.lights.push(l);
  }
}
const julLights = () => JUL.lights;
// is it julaften evening, when the bells ring Christmas in?
const julEve = () => SEASON === 3 && CAL.day === julDay(CAL.day);

/* ---- on the house (called from drawBuilding) ---- */
const JUL_COLS = ['#FF5A48', '#FFD450', '#58D884', '#62A8FF'];
function julBulb(x, y, col, on, r = 1.15) {
  if (on) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, col + '88');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  }
  ctx.fillStyle = on ? col : '#3A3A34';
  ctx.beginPath();
  ctx.arc(x, y, on ? r : r * 0.7, 0, TAU);
  ctx.fill();
}
// the string hangs from hooks under the eave, sagging a little between them
function julEave(j, e0, e1) {
  const L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]),
    n = Math.max(6, Math.round(L / 5.5)),
    pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n,
      sag = Math.sin(((i % 4) / 4) * Math.PI) * 1.6;
    pts.push([lerp(e0[0], e1[0], u), lerp(e0[1], e1[1], u) + 3.2 + sag]);
  }
  ctx.strokeStyle = 'rgba(30,30,26,.55)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
  for (let i = 1; i < n; i++)
    julBulb(pts[i][0], pts[i][1] + 0.6, j.col ? JUL_COLS[i % 4] : '#FFE2A0', j.on && hash2(i, j.h * 1e6) > 0.03);
}
// the wreath on the front door: spruce twigs in a ring and a red bow
function julWreath(x, y) {
  ctx.strokeStyle = '#2F5A34';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#46784A';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, 3.1, 0.3, 2.6);
  ctx.stroke();
  ctx.fillStyle = '#C02A2A';
  ctx.fillRect(x - 1.2, y + 1.9, 2.4, 1.4);
}
// in the front windows: a paper advent star hung in one, the seven-light candle bridge in another
function julWindow(Q, u, w, wh, which, on) {
  if (which === 0) {
    const c = Q(u, wh * 0.6),
      r = 3.2;
    if (on) {
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 8);
      g.addColorStop(0, 'rgba(255,226,160,.7)');
      g.addColorStop(1, 'rgba(255,226,160,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c[0] - 8, c[1] - 8, 16, 16);
    }
    ctx.strokeStyle = 'rgba(40,30,20,.5)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(c[0], Q(u, wh * 0.78)[1]);
    ctx.lineTo(c[0], c[1] - r);
    ctx.stroke();
    ctx.fillStyle = on ? '#FFF1C8' : '#E9DFC6';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU,
        rr2 = i % 2 ? r * 0.45 : r;
      ctx.lineTo(c[0] + Math.cos(a) * rr2, c[1] + Math.sin(a) * rr2);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    // a low wooden arch on the sill with seven little bulbs stepping up to the middle
    const b0 = Q(u - w * 0.8, wh * 0.37),
      b1 = Q(u + w * 0.8, wh * 0.37),
      top = Q(u, wh * 0.56);
    ctx.fillStyle = '#4A3526';
    ctx.beginPath();
    ctx.moveTo(b0[0], b0[1]);
    ctx.lineTo(top[0], top[1] + 1);
    ctx.lineTo(b1[0], b1[1]);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const k = i / 6,
        x = lerp(b0[0], b1[0], k),
        y = lerp(b0[1], b1[1], k) - (1 - Math.abs(k - 0.5) * 2) * (b0[1] - top[1]) - 1.2;
      julBulb(x, y, '#FFE6A8', on, 0.7);
    }
  }
}

/* ---- in the yard (props) ---- */
function drawJulProp(p) {
  const j = p.jul;
  if (!j.out) return;
  const X = p.x,
    gy = p.y * TILT;
  if (p.k === 'nek') {
    const top = PY(p.y, NEK_H);
    ctx.strokeStyle = '#6A5238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X, gy);
    ctx.lineTo(X, top + 4);
    ctx.stroke();
    // the sheaf: oat straws bound at the pole's head, the heads nodding out and down all round
    const sw = Math.sin(T * 1.3 + p.ph) * 0.6 * (0.4 + amb_gust());
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + p.ph,
        dx = Math.cos(a) * 7,
        dy = Math.sin(a) * 2.2,
        back = dy < 0;
      ctx.strokeStyle = back ? '#A8894A' : '#D6B868';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(X, top + 1);
      ctx.quadraticCurveTo(X + dx * 0.5 + sw, top - 5 + dy, X + dx + sw * 1.4, top + 3 + dy);
      ctx.stroke();
      ctx.fillStyle = back ? '#B8954E' : '#E6C87A';
      ctx.fillRect(X + dx + sw * 1.4 - 0.8, top + 2.4 + dy, 1.6, 2.4);
    }
    // bound with a red ribbon under the head
    ctx.strokeStyle = '#B8292B';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(X - 2, top + 3);
    ctx.lineTo(X + 2, top + 3);
    ctx.stroke();
    ctx.lineCap = 'butt';
    return;
  }
  // the yard spruce, snow on its boughs like the forest's, the string wound round it and a star on top
  const k = JUL_TREE_K;
  ctx.drawImage(SPR.spruce[p.v], X - AX * k, gy - AY * k, SW * k, SHT * k);
  for (const [f, sx, ci] of p.bulbs) {
    const y = gy - f * p.hpx,
      x = X + sx * SR * k * 0.95;
    julBulb(x, y, j.col ? JUL_COLS[ci] : '#FFE2A0', j.on, 0.95);
  }
  const ty = gy - p.hpx * 0.97;
  ctx.fillStyle = j.on ? '#FFE9A0' : '#C9A95A';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU,
      r = i % 2 ? 1.2 : 2.8;
    ctx.lineTo(X + Math.cos(a) * r, ty + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}
