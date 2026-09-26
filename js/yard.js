/* Flokk - yard.js
   Farmyard things: a flagpole with its pennant, a woodpile, a clothesline, a wheelbarrow; graves in the churchyard.
   Placed once per land by buildLights (light.js); drawn as painter items (kind 12).
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
let PROPS = [];
const FLAG_H = 3.3,
  LINE_H = 0.78;
// an open spot in the yard: clear of buildings, the lamp and other props, scored by pref (lower is better)
function yardSpot(Y, taken, m, pref) {
  let best = null,
    bs = 1e9;
  for (let i = 0; i < 80; i++) {
    const [x, y] = yardAt(Y, rnd(34, Y.lw - 34) / Y.lw, rnd(34, Y.lh - 34) / Y.lh);
    if (buildAt(x, y, m)) continue;
    if (taken.some(t => Math.hypot(t[0] - x, t[1] - y) < (t[2] || 0) + m + 18)) continue;
    if (Y.gate && Math.hypot(Y.gate[0] - x, Y.gate[1] - y) < 60) continue;
    const s = pref(x, y) + rnd(0, 40);
    if (s < bs) ((bs = s), (best = [x, y]));
  }
  return best;
}
function placeProps(fm, taken) {
  const Y = fm.yard,
    h = fm.house,
    near = o => (x, y) => (o ? Math.hypot(o.cx - x, o.cy - y) : 0);
  const add = (k, p, r, o) => {
    if (!p) return null;
    const pr = Object.assign({ k, x: p[0], y: p[1], fm }, o);
    PROPS.push(pr);
    taken.push([p[0], p[1], r]);
    return pr;
  };
  // firewood stacked against the weather, near the house
  const gable = (x, y) => {
    if (!h) return 0;
    const ex = Math.cos(h.ang) * (h.len / 2 + 30),
      ey = Math.sin(h.ang) * (h.len / 2 + 30);
    return Math.min(Math.hypot(h.cx + ex - x, h.cy + ey - y), Math.hypot(h.cx - ex - x, h.cy - ey - y));
  };
  fm.wood = add('wood', yardSpot(Y, taken, 22, gable), 24, { len: rnd(28, 40), ph: rnd(0, 9) });
  if (fm.main || R() < 0.5) {
    const f = add(
      'flag',
      yardSpot(Y, taken, 30, (x, y) => -Math.hypot(x - Y.x - Y.w / 2, y - Y.y - Y.h / 2) * 0.3),
      10,
      {
        col: '#C0282D'
      }
    );
    if (f) addPerch(f.x, f.y, FLAG_H + 0.08, 'pole', false, 0);
  }
  if (fm.main) {
    const l = add(
      'line',
      yardSpot(Y, taken, 40, (x, y) => -near(h)(x, y) * 0.2),
      36,
      {
        clothes: Array.from({ length: 4 + ((R() * 3) | 0) }, () => ({
          u: rnd(0.12, 0.88),
          w: rnd(5, 9),
          h: rnd(6, 11),
          col: ['#F2F0E8', '#E9E2CF', '#9DB6CF', '#D98A7A', '#E6D089', '#FFFFFF'][(R() * 6) | 0]
        })).sort((a, b) => a.u - b.u)
      }
    );
    if (l) {
      fm.line = l;
      for (const u of [0.3, 0.7]) addPerch(l.x - 22 + 44 * u, l.y, LINE_H - 0.06, 'wire', false, 0);
    }
  }
  if (R() < 0.7)
    add('barrow', yardSpot(Y, taken, 18, near(fm.builds && fm.builds.find(b => b.kind !== 'house'))), 12, {
      col: ['#3E6A4A', '#B3302A', '#5A6E80'][(R() * 3) | 0],
      ang: rnd(-0.5, 0.5)
    });
}
// the churchyard's graves: rows either side of the church, the old stones leaning, a few iron crosses
function placeGraves(C) {
  const Y = C.yard;
  for (let u = -Y.lw / 2 + 30; u <= Y.lw / 2 - 30; u += rnd(26, 32))
    for (let v = -Y.lh / 2 + 34; v <= Y.lh / 2 - 26; v += rnd(20, 26)) {
      if (R() < 0.3) continue;
      const [x, y] = yardWorld(Y, u + rnd(-5, 5), v + rnd(-3, 3));
      if (buildAt(x, y, 22) || Math.hypot(x - Y.door[0], y - Y.door[1]) < 34) continue;
      const [du] = yardLocal(Y, ...Y.door);
      if (Math.abs(u - du) < 22 && v * Y.side < 0) continue; // off the path
      const k = R(),
        old = R() < 0.5;
      PROPS.push({
        k: 'grave',
        x,
        y,
        shape: k < 0.14 ? 'cross' : k < 0.6 ? 'round' : 'slab',
        w: rnd(6, 9),
        h: rnd(8, 14),
        lean: old ? rnd(-0.18, 0.18) : rnd(-0.03, 0.03),
        col: old ? ['#8A877E', '#7E7C74', '#9A9588'][(R() * 3) | 0] : ['#6E6E6C', '#A8A69E', '#4E4E50'][(R() * 3) | 0],
        moss: old ? rnd(0.2, 0.6) : 0
      });
    }
}
function propShadows(c, cap) {
  for (const p of PROPS) {
    if (!visG(p.x, p.y, 200)) continue;
    if (p.k === 'flag') cap(p.x, p.y, FLAG_H, 1.8);
    else if (p.k === 'wood') {
      c.lineCap = 'butt';
      for (let dx = -p.len / 2 + 3; dx <= p.len / 2 - 3; dx += 3) cap(p.x + dx, p.y, 0.4, 8);
      c.lineCap = 'round';
    } else if (p.k === 'line') {
      cap(p.x - 22, p.y, LINE_H, 1.6);
      cap(p.x + 22, p.y, LINE_H, 1.6);
    } else if (p.k === 'barrow') cap(p.x, p.y, 0.25, 9);
    else if (p.k === 'grave') cap(p.x, p.y, p.h / HZ, p.w * 0.8);
  }
}
function drawProp(p) {
  const X = p.x,
    gy = p.y * TILT,
    snow = SEASON === 3;
  if (p.k === 'grave') {
    ctx.save();
    ctx.translate(X, gy);
    ctx.rotate(p.lean);
    const w = p.w,
      h = p.h;
    if (p.shape === 'cross') {
      ctx.strokeStyle = '#2E2B28';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -h - 2);
      ctx.moveTo(-w * 0.4, -h + 2.5);
      ctx.lineTo(w * 0.4, -h + 2.5);
      ctx.stroke();
      if (snow) {
        ctx.fillStyle = '#F4F7FA';
        ctx.fillRect(-w * 0.45, -h + 0.8, w * 0.9, 1.2);
      }
    } else {
      const top = p.shape === 'round' ? w / 2 : 1;
      ctx.fillStyle = shade(p.col, 0.72);
      ctx.fillRect(w / 2 - 0.5, -h + top, 1.6, h - top);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2, -h + top);
      if (p.shape === 'round') ctx.arc(0, -h + top, w / 2, Math.PI, 0);
      else ctx.lineTo(w / 2, -h + top);
      ctx.lineTo(w / 2, 0);
      ctx.closePath();
      ctx.fill();
      if (p.moss && !snow) {
        ctx.fillStyle = `rgba(150,160,90,${p.moss})`;
        ctx.fillRect(-w / 2, -h * 0.3, w, h * 0.3);
      }
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(-w * 0.25, -h * 0.62, w * 0.5, 0.8);
      ctx.fillRect(-w * 0.2, -h * 0.5, w * 0.4, 0.8);
      if (snow) {
        ctx.fillStyle = '#F4F7FA';
        ctx.beginPath();
        if (p.shape === 'round') ctx.arc(0, -h + top, w / 2 + 0.4, Math.PI * 1.1, -Math.PI * 0.1);
        else ctx.rect(-w / 2 - 0.3, -h + top - 1.4, w + 0.6, 1.8);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }
  if (p.k === 'flag') {
    const top = PY(p.y, FLAG_H);
    ctx.strokeStyle = '#E8E6DE';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(X, gy);
    ctx.lineTo(X, top);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80,80,80,.35)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(X + 0.7, gy);
    ctx.lineTo(X + 0.7, top);
    ctx.stroke();
    ctx.fillStyle = '#D9C27A';
    ctx.beginPath();
    ctx.arc(X, top - 1, 1.6, 0, TAU);
    ctx.fill();
    // the pennant streams downwind, a long tapering tongue that ripples
    const dir = WIND.x < 0 ? -1 : 1,
      Ln = 34,
      wv = 0.6 + amb_gust();
    const up = [],
      dn = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10,
        x = X + dir * u * Ln,
        y = top + 2 + u * u * 6 * (1.2 - wv * 0.5) + Math.sin(T * 5 * wv - u * 7) * u * 2.4,
        w = (1 - u) * 3 + 0.35;
      up.push([x, y - w]);
      dn.push([x, y + w]);
    }
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.moveTo(up[0][0], up[0][1]);
    for (const q of up) ctx.lineTo(q[0], q[1]);
    for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
    ctx.closePath();
    ctx.fill();
    // the white and blue cross at the hoist
    ctx.fillStyle = '#F4F2EC';
    ctx.fillRect(X + (dir > 0 ? 1 : -6), top - 0.5, 5, 5);
    ctx.fillStyle = '#2B4C8C';
    ctx.fillRect(X + (dir > 0 ? 2.2 : -4.8), top + 0.7, 2.6, 2.6);
    ctx.fillStyle = p.col;
    ctx.fillRect(X + (dir > 0 ? 2.8 : -4.2), top + 1.3, 1.4, 1.4);
    return;
  }
  if (p.k === 'wood') {
    const L2 = p.len / 2,
      d = 7,
      hh = 16,
      fy = (p.y + d) * TILT,
      by = (p.y - d) * TILT;
    // top of the stack: bark
    ctx.fillStyle = snow ? '#EEF2F6' : '#6E5A42';
    ctx.beginPath();
    ctx.moveTo(X - L2, fy - hh);
    ctx.lineTo(X + L2, fy - hh);
    ctx.lineTo(X + L2, by - hh);
    ctx.lineTo(X - L2, by - hh);
    ctx.closePath();
    ctx.fill();
    // the face: split log ends in rows
    ctx.fillStyle = '#5A4632';
    ctx.fillRect(X - L2, fy - hh, p.len, hh);
    let s = p.ph;
    for (let row = 0; row < 4; row++) {
      const yy = fy - hh + 2.4 + row * 3.9;
      for (let x = X - L2 + 2.2 + (row % 2) * 1.8; x < X + L2 - 1.5; x += 3.7) {
        s = (s * 9301 + 49297) % 233280;
        const q = s / 233280;
        ctx.fillStyle = q < 0.3 ? '#D8B884' : q < 0.7 ? '#C9A36C' : '#B48E5C';
        ctx.beginPath();
        ctx.arc(x, yy, 1.75, 0, TAU);
        ctx.fill();
      }
    }
    if (snow) {
      ctx.fillStyle = '#F4F7FA';
      ctx.fillRect(X - L2 - 0.5, fy - hh - 1.8, p.len + 1, 2.4);
    }
    return;
  }
  if (p.k === 'line') {
    const xa = X - 22,
      xb = X + 22,
      ta = PY(p.y, LINE_H);
    ctx.strokeStyle = '#8A7556';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const x of [xa, xb]) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x, ta);
      ctx.moveTo(x, ta + 1.2);
      ctx.lineTo(x, ta - 1.2);
    }
    ctx.stroke();
    const sag = 3.2,
      lineY = u => ta + 4 * sag * u * (1 - u);
    ctx.strokeStyle = 'rgba(70,64,56,.7)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(xa, ta);
    ctx.quadraticCurveTo(X, ta + 2 * sag, xb, ta);
    ctx.stroke();
    // laundry out on dry days in the light half of the year, taken in for the night
    if (SEASON < 2 && LIGHT.night < 0.3 && LIGHT.rain < 0.15) {
      const sw = Math.sin(T * 2.2) * (0.5 + amb_gust());
      for (const c of p.clothes) {
        const x = lerp(xa, xb, c.u),
          y = lineY(c.u);
        ctx.fillStyle = c.col;
        ctx.beginPath();
        ctx.moveTo(x - c.w / 2, y);
        ctx.lineTo(x + c.w / 2, y);
        ctx.lineTo(x + c.w / 2 + sw * 1.2, y + c.h);
        ctx.lineTo(x - c.w / 2 + sw * 1.2, y + c.h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.12)';
        ctx.fillRect(x - c.w / 2, y, c.w, 1);
      }
    }
    return;
  }
  if (p.k === 'barrow') {
    ctx.save();
    ctx.translate(X, gy);
    ctx.scale(1.3, 1.3);
    ctx.rotate(p.ang * 0.25);
    ctx.strokeStyle = '#4A3E30';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-11, -1.5);
    ctx.moveTo(-4, -2.5);
    ctx.lineTo(-11, 0);
    ctx.moveTo(-3, -2);
    ctx.lineTo(-4, 0);
    ctx.stroke();
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(6, -7.5);
    ctx.lineTo(4, -2);
    ctx.lineTo(-3.5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(p.col, 0.7);
    ctx.fillRect(-5, -7.6, 11, 1.2);
    if (snow) {
      ctx.fillStyle = '#F4F7FA';
      ctx.fillRect(-4.5, -8.4, 10, 1.6);
    }
    ctx.fillStyle = '#2A2622';
    ctx.beginPath();
    ctx.arc(5, -1.6, 1.9, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
