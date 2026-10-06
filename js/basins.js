/* Bounded lake/pond waves. A damped height field with reflecting shore cells and zero net displacement.
   This models surface ripples, not a full fluid solver; the fjord remains open water in waves.js. */
'use strict';
const BASINS = { lake: null, pond: null, list: [], carry: 0, lastT: 0 };
const BASIN_STEP = 1 / 30;
function basinInit() {
  if (BASINS.lake === LAKE && BASINS.pond === POND && T >= BASINS.lastT) return;
  BASINS.lake = LAKE;
  BASINS.pond = POND;
  BASINS.carry = 0;
  BASINS.list = [];
  for (const [c, rf] of [
    [LAKE, lakeR],
    [POND, pondR]
  ]) {
    if (c.x < -1000) continue;
    const cell = 8,
      half = Math.ceil((c.r * 1.45) / cell) + 2,
      n = half * 2 + 1;
    const b = {
      c,
      rf,
      cell,
      n,
      half,
      time: 0,
      count: 0,
      h: new Float32Array(n * n),
      v: new Float32Array(n * n),
      next: new Float32Array(n * n),
      force: new Float32Array(n * n),
      sources: [],
      mask: new Uint8Array(n * n),
      depth: new Float32Array(n * n),
      gust: new Float32Array(n * n),
      gustT: 0,
      phase: hash2(c.x | 0, c.y | 0) * TAU,
      cv: document.createElement('canvas')
    };
    b.cv.width = b.cv.height = n;
    b.ctx = b.cv.getContext('2d');
    b.img = b.ctx.createImageData(n, n);
    for (let j = 1; j < n - 1; j++)
      for (let i = 1; i < n - 1; i++) {
        const x = (i - half) * cell,
          y = (j - half) * cell,
          k = j * n + i;
        const depth = rf(Math.atan2(y, x)) - Math.hypot(x, y);
        if (depth <= 0) continue;
        b.mask[k] = 1;
        b.depth[k] = smooth(0, 36, depth);
        b.count++;
      }
    BASINS.list.push(b);
    const sourceCount = Math.max(6, Math.min(32, Math.ceil(b.count / 100)));
    for (let i = 0; i < sourceCount; i++) b.sources.push({ id: i, cycle: -1 });
  }
  BASINS.lastT = T;
}
function basinTick(dt) {
  basinInit();
  BASINS.lastT = T;
  if (waveFreeze() < 0.02) return;
  BASINS.carry += Math.min(0.1, dt);
  while (BASINS.carry >= BASIN_STEP) {
    BASINS.carry -= BASIN_STEP;
    for (const b of BASINS.list) basinStep(b, BASIN_STEP);
  }
}
function basinStep(b, dt) {
  const { n, h, v, next, mask, cell } = b;
  b.time += dt;
  const speed = 35,
    lapScale = (speed * speed) / (cell * cell),
    damping = Math.exp(-dt * (b.c === POND ? 0.9 : 0.6)),
    strength = 2.5 * smooth(0.05, 0.9, WEATHER.s) * waveFreeze() * (b.c === POND ? 0.55 : 1);
  if (b.force) {
    b.force.fill(0);
    if (strength > 0) basinForcing(b, strength);
  }
  let totalV = 0;
  for (let j = 1; j < n - 1; j++)
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      if (!mask[k]) continue;
      // Missing neighbours use the current height: no flow through the shoreline, and waves reflect.
      const lap =
        (mask[k - 1] ? h[k - 1] - h[k] : 0) +
        (mask[k + 1] ? h[k + 1] - h[k] : 0) +
        (mask[k - n] ? h[k - n] - h[k] : 0) +
        (mask[k + n] ? h[k + n] - h[k] : 0);
      const force = b.force ? b.force[k] : 0;
      next[k] = (v[k] + (lapScale * lap + force) * dt) * damping;
      totalV += next[k];
    }
  const meanV = totalV / Math.max(1, b.count);
  let totalH = 0;
  for (let k = 0; k < h.length; k++)
    if (mask[k]) {
      v[k] = next[k] - meanV;
      h[k] += v[k] * dt;
      totalH += h[k];
    }
  // Wind redistributes the surface rather than adding water to a closed body.
  const meanH = totalH / Math.max(1, b.count);
  for (let k = 0; k < h.length; k++) if (mask[k]) h[k] -= meanH;
}
function basinForcing(b, strength) {
  // Short-lived pressure patches excite the solver locally; no whole-surface phase translates.
  for (const s of b.sources) {
    if (s.nextBirth === undefined) s.nextBirth = hash2(s.id + 19, b.phase * 200) * 3;
    if (b.time < s.nextBirth && s.cycle < 0) continue;
    if (b.time >= s.nextBirth) {
      const cycle = s.cycle + 1;
      s.cycle = cycle;
      s.birth = b.time;
      s.nextBirth = b.time + 2.4 + hash2(s.id + 71, cycle * 37 + b.phase * 100) * 3.6;
      for (let attempt = 0; attempt < 20; attempt++) {
        s.x = 1 + Math.floor(hash2(s.id * 31 + attempt, cycle * 17 + b.phase * 100) * (b.n - 2));
        s.y = 1 + Math.floor(hash2(s.id * 47 + attempt, cycle * 23 + b.phase * 200) * (b.n - 2));
        if (b.mask[s.y * b.n + s.x]) break;
      }
      s.radius = 2 + hash2(s.id + 101, cycle + b.phase * 100) * 2;
      s.duration = 1.1 + hash2(s.id + 211, cycle + b.phase * 100) * 1.1;
      const angle = hash2(s.id + 307, cycle + b.phase * 100) * TAU;
      s.cos = Math.cos(angle);
      s.sin = Math.sin(angle);
      s.stretch = 1.2 + hash2(s.id + 401, cycle + b.phase * 100) * 0.8;
      s.frequency = 3 + hash2(s.id + 503, cycle + b.phase * 100) * 4;
    }
    const age = b.time - s.birth;
    if (age >= s.duration || !b.mask[s.y * b.n + s.x]) continue;
    const envelope = Math.sin((Math.PI * age) / s.duration) ** 2,
      wind = 0.45 + 0.55 * gustAt(b.c.x + (s.x - b.half) * b.cell, b.c.y + (s.y - b.half) * b.cell),
      amplitude = strength * 7 * envelope * wind * Math.sin(age * s.frequency),
      reach = Math.ceil(s.radius * s.stretch * 2);
    for (let j = Math.max(1, s.y - reach); j <= Math.min(b.n - 2, s.y + reach); j++)
      for (let i = Math.max(1, s.x - reach); i <= Math.min(b.n - 2, s.x + reach); i++) {
        const k = j * b.n + i;
        if (!b.mask[k]) continue;
        const dx = i - s.x,
          dy = j - s.y,
          along = (dx * s.cos + dy * s.sin) / s.stretch,
          across = -dx * s.sin + dy * s.cos,
          r2 = (along * along + across * across) / (s.radius * s.radius);
        if (r2 > 4) continue;
        b.force[k] += amplitude * (1 - r2) * Math.exp(-r2);
      }
  }
}
function basinSample(x, y) {
  basinInit();
  for (const b of BASINS.list) {
    const dx = wdx(x, b.c.x),
      dy = y - b.c.y;
    if (Math.hypot(dx, dy) >= b.rf(Math.atan2(dy, dx))) continue;
    const fx = dx / b.cell + b.half,
      fy = dy / b.cell + b.half,
      ix = Math.floor(fx),
      iy = Math.floor(fy),
      tx = fx - ix,
      ty = fy - iy;
    if (ix < 1 || iy < 1 || ix >= b.n - 2 || iy >= b.n - 2) continue;
    let h = 0,
      gx = 0,
      gy = 0;
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const k = (iy + j) * b.n + ix + i,
          w = (i ? tx : 1 - tx) * (j ? ty : 1 - ty);
        if (!b.mask[k]) continue;
        const at = q => (b.mask[q] ? b.h[q] : b.h[k]);
        h += w * b.h[k];
        gx += (w * (at(k + 1) - at(k - 1))) / (2 * b.cell);
        gy += (w * (at(k + b.n) - at(k - b.n))) / (2 * b.cell);
      }
    return { h, gx, gy };
  }
  return null;
}
function drawClosedBasins(c) {
  basinInit();
  const freeze = waveFreeze(),
    dim = 1 - 0.45 * LIGHT.night,
    sun = waterSunHalf(),
    sunStrength = waterSunStrength(),
    roughness = Math.min(1.5, WEATHER.s),
    lightGain = 0.28 + 0.14 * roughness,
    darkGain = 0.22 + 0.12 * roughness;
  if (freeze < 0.02) return;
  for (const b of BASINS.list) {
    const x = cam.x + wdx(b.c.x, cam.x),
      span = b.half * b.cell;
    if (x + span < V.x0 || x - span > V.x1 || (b.c.y + span) * TILT < V.py0 || (b.c.y - span) * TILT > V.py1) continue;
    const { h, mask, n, cell } = b,
      p = b.img.data;
    const gustBlend = 1 - Math.exp(-Math.max(0, Math.min(0.1, T - b.gustT)) / 1.8);
    b.gustT = T;
    p.fill(0);
    for (let k = n; k < h.length - n; k++) {
      if (!mask[k]) continue;
      const at = q => (mask[q] ? h[q] : h[k]),
        gx = (at(k + 1) - at(k - 1)) / (2 * cell),
        gy = (at(k + n) - at(k - n)) / (2 * cell),
        // Short enclosed ripples need a stronger visual slope to share the fjord's surface definition.
        nx = -gx * 3.2,
        ny = -gy * 3.2,
        norm = Math.hypot(nx, ny, 1),
        d = (-0.4 * nx - 0.55 * ny + 0.73) / Math.hypot(0.4, 0.55, 0.73) / norm - 0.73 / Math.hypot(0.4, 0.55, 0.73),
        // The shared wind field sweeps a soft sheen over the independent surface ripples.
        gustTarget = gustAt(b.c.x + ((k % n) - b.half) * cell, b.c.y + (Math.floor(k / n) - b.half) * cell),
        gust = (b.gust[k] += (gustTarget - b.gust[k]) * gustBlend),
        sheen = 0.035 * smooth(0.2, 0.9, WEATHER.s) * smooth(0.15, 0.85, gust) * (1 - LIGHT.rain),
        // A small daylight lift keeps enclosed water from looking dull beside the fjord.
        lit = d + (0.012 + sheen) * (1 - LIGHT.night),
        light = lit > 0,
        a = (1 - Math.exp(-Math.abs(lit) * 3.2)) * (light ? lightGain : darkGain) * dim * freeze * b.depth[k],
        spec =
          Math.pow(Math.max(0, (nx * sun[0] + ny * sun[1] + sun[2]) / norm), 180) *
          sunStrength *
          smooth(0.62, 0.9, hash2(k % n, Math.floor(k / n))) *
          0.65 *
          b.depth[k],
        alpha = a * (1 - spec) + spec,
        blend = alpha > 0 ? spec / alpha : 0,
        o = k * 4;
      p[o] = lerp(light ? 199 : 14, 255, blend);
      p[o + 1] = lerp(light ? 224 : 42, 245, blend);
      p[o + 2] = lerp(light ? 219 : 51, 212, blend);
      p[o + 3] = Math.min(255, alpha * 255);
    }
    b.ctx.putImageData(b.img, 0, 0);
    for (const offset of [-W, 0, W]) {
      const copyX = x + offset;
      if (copyX + span < V.x0 || copyX - span > V.x1) continue;
      c.save();
      blobPath(c, copyX, b.c.y, b.rf, -2, 90);
      c.clip();
      c.globalAlpha = 1;
      c.imageSmoothingEnabled = true;
      c.drawImage(b.cv, copyX - span - cell / 2, b.c.y - span - cell / 2, n * cell, n * cell);
      c.restore();
    }
  }
}
