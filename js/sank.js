/* Flokk - sank.js
   Sankthansaften: the middle night of summer, when the parish burns a bonfire down by the water
   through the almost-sunless short dark. One fire for the whole land, by the boathouse, out for one
   evening a year and then gone - the pyre isn't built until dusk and it's ash by morning.
   Ticked from update(); its light joins the others in applyLight (light.js); drawn as a painter item
   (kind 17, render.js) and, unlit, nothing is there to draw.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
const SANK = { x: 0, y: 0, on: false, smk: 0 };
// is (x,y) clear of any tree crown within rad - a real bonfire needs an open patch of beach, not a
// gap between branches
function clearOfTrees(x, y, rad) {
  const cx = Math.floor(x / TC),
    cy = Math.floor(y / TC),
    n = Math.ceil(rad / TC) + 1;
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const a = TG.get(cx + i + ',' + (cy + j));
      if (!a) continue;
      for (const t of a) if ((t.x - x) ** 2 + (t.y - y) ** 2 < (rad + t.r) ** 2) return false;
    }
  return true;
}
function buildSank() {
  SANK.on = false;
  SANK.spot = false;
  if (!NAUST) return;
  const keepR = R;
  R = mulberry32((SEED ^ 0x5a17) + 7);
  const c = Math.cos(NAUST.ang),
    s = Math.sin(NAUST.ang); // NAUST.ang points inland, away from the water
  let best = null;
  for (let i = 0; i < 200 && !best; i++) {
    const along = rnd(-260, 260),
      out = rnd(-60, -6), // a little way along the shore from the boathouse, out on the open beach
      x = NAUST.cx - s * along + c * out,
      y = NAUST.cy + c * along + s * out;
    if (inWater(x, y, 16)) continue;
    if (!inWater(x, y, 65)) continue; // has to stay close enough to the water to be "down by the lake"
    if (segDist(x, y, JET.x0, JET.y0, JET.x1, JET.y1) < 60) continue;
    if (roadDist(x, y) < 45) continue;
    if (!clearOfTrees(x, y, 30)) continue;
    best = [x, y];
  }
  R = keepR;
  if (!best) return; // no clearing on this stretch of shore this year - no bonfire rather than one in the trees
  SANK.x = best[0];
  SANK.y = best[1];
  SANK.spot = true;
}
// the fixed midsummer day within whatever year holds day d (the middle day of summer, unlike julaften's
// pick of one of two nights - a village bonfire is planned, not left to chance)
const sankDay = d => Math.floor(d / YEAR_DAYS) * YEAR_DAYS + DAYS_PER_SEASON + 1;
function sankTick() {
  if (!NAUST || !SANK.spot) return;
  const rel = CAL.day + CAL.hour / 24 - sankDay(CAL.day);
  SANK.on = SEASON === 1 && rel > 21.4 / 24 && rel < 1 + 1.4 / 24;
  if (!SANK.on) return;
  SANK.smk = (SANK.smk || 0) + lastDt * 9;
  for (; SANK.smk >= 1; SANK.smk--) {
    const max = rr(3.5, 5);
    SMOKE.push({
      x: SANK.x + rr(-2, 2),
      y: SANK.y,
      z: rr(1.4, 2),
      r: rr(2, 3),
      life: max,
      max,
      a: rr(0.1, 0.15),
      ph: rr(0, TAU),
      sp: rr(-1, 1)
    });
  }
}
const sankLights = () => (SANK.on ? [{ x: SANK.x, y: SANK.y, h: 0.35, r: 145, i: 1, fl: 1, col: '255,140,70' }] : []);
function drawSankFire(f) {
  const X = f.x,
    gy = f.y * TILT,
    flick = 0.85 + 0.15 * Math.sin(T * 9) + 0.1 * Math.sin(T * 23 + 1);
  // a stack of driftwood logs, leant together
  ctx.strokeStyle = '#4A362A';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = -0.55 + (i / 6) * 1.1;
    ctx.moveTo(X + Math.sin(a) * 11, gy);
    ctx.lineTo(X + Math.sin(a) * 2, gy - 13 - Math.cos(a) * 3);
  }
  ctx.stroke();
  // the glow, then the flame itself as a few short soft licks rather than one tall tongue
  const g = ctx.createRadialGradient(X, gy - 10, 0, X, gy - 10, 60 * flick);
  g.addColorStop(0, `rgba(255,190,110,${0.28 * flick})`);
  g.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(X, gy - 10, 60 * flick, 0, TAU);
  ctx.fill();
  const lick = (u, h, w, cols) => {
    const sway = Math.sin(T * 5 + u * 9) * 1.1,
      hh = h * flick * (0.8 + 0.25 * Math.sin(T * 7 + u * 11)),
      bx = X + u * 8,
      by = gy - 7;
    const gg = ctx.createRadialGradient(bx + sway * 0.5, by - hh * 0.5, 0, bx + sway * 0.5, by - hh * 0.5, hh * 0.75);
    gg.addColorStop(0, cols[1]);
    gg.addColorStop(1, cols[0]);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(bx + sway * 0.4, by - hh * 0.45, w, hh * 0.55, 0, 0, TAU);
    ctx.fill();
  };
  lick(-0.55, 9, 4, ['rgba(196,58,30,0)', 'rgba(196,58,30,.85)']);
  lick(0.5, 10, 4.4, ['rgba(196,58,30,0)', 'rgba(196,58,30,.85)']);
  lick(0, 13, 5, ['rgba(220,90,30,0)', 'rgba(230,110,30,.92)']);
  lick(-0.15, 8, 3.6, ['rgba(255,180,70,0)', 'rgba(255,196,90,.95)']);
  lick(0.2, 6.5, 3, ['rgba(255,220,120,0)', 'rgba(255,232,150,.95)']);
}
