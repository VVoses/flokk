/* Flokk - life.js
   Living world: spawning and behaviour of animals and passing flocks.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- living world ---------- */
let ANIMALS = [],
  SMOKE = [],
  RINGS = [];
const WIND = { x: 1, y: 0.22 };
const LIFE = { geeseT: 45, crowT: 25, fishT: 6, tractorF: null };
// the field tractor's speeds in px/s: a steady crawl down the rows, and a road gear between fields no
// quicker than the tractors on the road (traffic.js)
const TRACTOR_WORK = 20,
  TRACTOR_ROAD = 34;
const openLand = (x, y) => y > 60 && !inWater(x, y, 14) && !inBuild(x, y, 16) && !underTree(x, y);
function mkA(k, x, y, o) {
  return Object.assign(
    {
      k,
      x,
      y,
      vx: 0,
      vy: 0,
      f: Math.random() < 0.5 ? 1 : -1,
      st: 'idle',
      t: rr(0, 3),
      tx: x,
      ty: y,
      ph: rr(0, TAU),
      anim: rr(0, 9),
      z: 0,
      graze: false,
      chk: rr(0, 0.3),
      flap: 0,
      hd: 0,
      hop: 0
    },
    o || {}
  );
}
function spawnAnimals() {
  ANIMALS = [];
  SMOKE = [];
  RINGS = [];
  wildReset();
  const pastures = FIELDS.filter(f => f.t === 'pasture');
  if (SEASON < 3)
    pastures.slice(0, 3).forEach((f, i) => {
      const kind = i % 2 ? 'cow' : 'sheep';
      const n = kind === 'sheep' ? rr(4, 7) | 0 : rr(2, 4) | 0;
      for (let j = 0; j < n; j++) ANIMALS.push(mkA(kind, ...ptIn(f, 30), { rect: f, red: Math.random() < 0.7 }));
      if (kind === 'sheep' && SEASON === 0)
        for (let j = 0; j < 3; j++) ANIMALS.push(mkA('sheep', ...ptIn(f, 30), { rect: f, lamb: true }));
    });
  // pigs stay penned by their sty year-round, snow or not
  for (const fm of FARMS)
    if (fm.sty) {
      const n = rr(2, 3) | 0;
      for (let j = 0; j < n; j++) ANIMALS.push(mkA('pig', ...ptIn(fm.sty, 14), { rect: fm.sty }));
    }
  const edgeSpot = () => {
    for (let i = 0; i < 120; i++) {
      const x = rr(250, W - 250),
        y = rr(200, H - 400);
      const fo = forestness(x, y);
      if (fo > 0.4 && fo < 0.58 && openLand(x, y) && roadDist(x, y) > 80 && !inFence(x, y, 60)) return [x, y];
    }
    return null;
  };
  for (let g = 0; g < 2; g++) {
    const p = edgeSpot();
    if (!p) continue;
    const n = rr(1, 3) | 0;
    for (let j = 0; j < n; j++)
      ANIMALS.push(mkA('deer', p[0] + rr(-40, 40), p[1] + rr(-30, 30), { hx: p[0], hy: p[1], hr: 240 }));
  }
  if (Math.random() < 0.5) {
    const p = edgeSpot();
    if (p) ANIMALS.push(mkA('moose', p[0], p[1], { hx: p[0], hy: p[1], hr: 380, bull: Math.random() < 0.6 }));
  }
  const openF = FIELDS.filter(f => f.t !== 'pasture');
  for (let i = 0; i < 2 && openF.length; i++) {
    const f = pickP(openF);
    ANIMALS.push(mkA('hare', ...ptIn(f, 20), { rect: f }));
  }
  const nd = SEASON === 3 ? 0 : rr(3, 6) | 0;
  for (let i = 0; i < nd; i++) {
    const onPond = POND.x > 0 && i === nd - 1;
    const c = onPond ? POND : LAKE,
      rf = onPond ? pondR : lakeR;
    const a = rr(0, TAU),
      r = rf(a) * rr(0.2, 0.7);
    ANIMALS.push(
      mkA('duck', c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, { pool: c, prf: rf, drake: Math.random() < 0.5 })
    );
  }
  for (let i = 0; i < (SEASON < 3 ? 1 : 0); i++) {
    const a = rr(0, TAU),
      r = lakeR(a) - rr(5, 14);
    ANIMALS.push(mkA('heron', LAKE.x + Math.cos(a) * r, LAKE.y + Math.sin(a) * r));
  }
  for (const Y of YARDS) for (let i = 0; i < 2; i++) ANIMALS.push(mkA('magpie', ...inRectPt(Y, 30), { rect: Y }));
  for (let i = 0; i < (rr(2, 4) | 0) && openF.length; i++) {
    const f = pickP(openF);
    ANIMALS.push(mkA('crow', ...ptIn(f, 20), { rect: f }));
  }
  ANIMALS.push(
    mkA('cat', ...inRectPt(YARD, 40), {
      rect: YARD,
      ginger: Math.random() < 0.5
    })
  );
  ANIMALS.push(
    mkA('dog', ...inRectPt(YARD, 40), {
      rect: YARD,
      collie: Math.random() < 0.65
    })
  );
  {
    // a fox denned at the forest edge - unseen by day, an occasional prowler once the light fades
    const p = edgeSpot();
    if (p) ANIMALS.push(mkA('fox', p[0], p[1], { hx: p[0], hy: p[1], hr: 230, hide: true }));
  }
  for (const l of ANIMALS) if (l.lamb) l.mom = herdMate(l);
  {
    const hens = ANIMALS.filter(d => d.k === 'duck' && !d.drake);
    for (const d of ANIMALS)
      if (d.k === 'duck' && d.drake && hens.length)
        d.mate = hens.find(h => h.pool === d.pool && !ANIMALS.some(o => o.mate === h)) || null;
  }
  // the tractor comes out on a different field each season, starting at the head of a row, so it is not
  // always found on the same patch of land
  let tf = null;
  if (SEASON < 3) {
    const work = FIELDS.filter(f => (f.t === 'plow' || f.t === 'stubble') && f !== LIFE.tractorF);
    tf = work.length ? pickP(work) : LIFE.tractorF;
  }
  const t0 = tf && rowStart(tf, ...ptIn(tf, 30));
  if (t0) {
    LIFE.tractorF = tf;
    const tr = mkA('tractor', t0.x, t0.y, { rect: tf, row: t0.row, rdir: 1, dirn: t0.dirn, f: t0.dirn });
    ANIMALS.push(tr);
    for (let i = 0; i < (rr(2, 4) | 0); i++)
      ANIMALS.push(
        mkA('gull', tr.x + rr(-60, 60), tr.y + rr(-60, 60), {
          follow: tr,
          z: rr(0.7, 1.5),
          oa: rr(0, TAU),
          or: rr(30, 90),
          sp: rr(0.6, 1.1) * (Math.random() < 0.5 ? 1 : -1)
        })
      );
  }
  for (const f of FIELDS.filter(f => f.t === 'pasture').slice(0, 2))
    for (let i = 0; i < [1, 3, 0, 0][SEASON]; i++)
      ANIMALS.push(
        mkA('butterfly', rr(f.x, f.x + f.w), rr(f.y, f.y + f.h), {
          z: rr(0.3, 0.9),
          col: pickP(['#E8893A', '#F2EFE2', '#E9D35A', '#9C7BC8']),
          rect: f
        })
      );
  spawnPeople();
}
function threatNear(a, r) {
  if (trainNear(a.x, a.y, r * 1.2)) return [a.x, a.y - 40];
  for (const o of ANIMALS)
    if (o.k === 'human' && !o.hide && near2(o, a) < r * r * 1.7) return [a.x + wdx(o.x, a.x), o.y];
  {
    const v = trafficNear(a.x, a.y, r);
    if (v) return [a.x + wdx(v.x, a.x), v.y];
  }
  for (const h of hawks)
    if (h.state === 'dive' && Math.hypot(wdx(h.x, a.x), h.y - a.y) < r * 1.8) return [a.x + wdx(h.x, a.x), h.y];
  for (const o of ANIMALS)
    if (
      o !== a &&
      ((o.k === 'dog' && o.st === 'chase') || (o.k === 'cat' && o.st === 'pounce')) &&
      near2(o, a) < r * r * 1.6
    )
      return [a.x + wdx(o.x, a.x), o.y];
  for (const b of birds) {
    const dx = wdx(b.x, a.x);
    if (Math.abs(dx) > r || Math.abs(b.y - a.y) > r) continue;
    if (b.state === 'land' || b.z < 1.1) return [a.x + dx, b.y];
  }
  return null;
}
// steerA (interact.js) toward a.tx/a.ty instead of an explicit target, with a gentler brake and a
// looser arrive - the shape most of this file's wandering uses
function walkTo(a, dt, sp) {
  return steerA(a, a.tx, a.ty, sp, dt, 3, 3) < 3;
}
function flyTo(a, dt, sp, maxZ) {
  const dx = a.tx - a.x,
    dy = a.ty - a.y,
    d = Math.hypot(dx, dy);
  if (d < 5) {
    a.z = 0;
    return true;
  }
  a.vx = (dx / d) * sp;
  a.vy = (dy / d) * sp;
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  a.hd = Math.atan2(a.vy, a.vx);
  a.f = a.vx > 0 ? 1 : -1;
  a.z = Math.min(maxZ, d / 70, a.z + dt * 1.6);
  return false;
}
// the first row of field f long enough to work, begun from whichever of its ends is nearer (x, y)
function rowStart(f, x, y) {
  for (let row = 0; f.y + 28 + row * 30 <= f.y + f.h - 24; row++) {
    const ry = f.y + 28 + row * 30,
      xr = f.poly ? xRange(f.poly, ry) : [f.x, f.x + f.w];
    if (!xr || xr[1] - xr[0] < 70) continue;
    const west = Math.abs(wdx(xr[0] + 30, x)) < Math.abs(wdx(xr[1] - 30, x));
    return { x: west ? xr[0] + 30 : xr[1] - 30, y: ry, row, dirn: west ? 1 : -1 };
  }
  return null;
}
// a tractor done with its field picks another ploughed, stubble or cropped field - one of the nearer ones
// of its own farm, or any farm's if its own has none - and drives to the head of that field's first row
function tractorMove(a) {
  const ok = f => f !== a.rect && (f.t === 'plow' || f.t === 'stubble' || f.t === 'crop');
  let cand = FIELDS.filter(f => ok(f) && f.farm === a.rect.farm);
  if (!cand.length) cand = FIELDS.filter(ok);
  const near = cand
    .map(f => [f, Math.hypot(wdx(f.x + f.w / 2, a.x), f.y + f.h / 2 - a.y)])
    .sort((p, q) => p[1] - q[1])
    .slice(0, 3);
  const f = near.length && pickP(near)[0],
    s = f && rowStart(f, a.x, a.y);
  if (!s) {
    // nowhere else to go: turn round and work this field again, back the way it came
    a.rdir = -a.rdir;
    a.work = rr(60, 140);
    return;
  }
  LIFE.tractorF = f;
  a.next = f;
  a.go = [s.x, s.y];
  a.row = s.row;
  a.rdir = 1;
  a.dirn = s.dirn;
}
// the tractor's heading (drawTractor) eases round toward where it is driving; a half turn at the end
// of a row swings through facing down-field, toward the next row, rather than flipping on the spot
function tractorTurn(a, aim, dt) {
  a.ang ??= aim;
  let d = angDiff(aim, a.ang);
  if (Math.abs(d) > 2.8) d = (Math.cos(a.ang) > 0 ? 1 : -1) * Math.abs(d);
  a.ang += d * Math.min(1, dt * 2.5);
}
function tractorDust(a, dt) {
  a.dust = (a.dust || 0) - dt;
  if (a.dust <= 0 && inView(a.x, a.y, 200)) {
    a.dust = 0.14;
    parts.push({
      k: 'd',
      x: a.x - Math.cos(a.ang ?? 0) * 26 + rr(-3, 3),
      y: a.y + rr(-2, 2),
      z: 0.05,
      life: 1.4,
      max: 1.4
    });
  }
}
// a random spot in a field or yard that is not inside a building
function inRectPt(r, m) {
  let p = ptIn(r, m);
  for (let i = 0; i < 12 && inBuild(p[0], p[1], NAV_M + 4); i++) p = ptIn(r, m);
  return inBuild(p[0], p[1], NAV_M) ? pushOut(p[0], p[1], NAV_M + 4) : p;
}
function updateAnimals(dt) {
  interact(dt);
  updatePeople(dt);
  for (const a of ANIMALS) {
    a.anim += dt;
    if (a.busy) continue;
    a.t -= dt;
    a.chk -= dt;
    switch (a.k) {
      case 'sheep':
      case 'cow':
      case 'pig': {
        if (a.st === 'walk') {
          a.graze = false;
          if (walkTo(a, dt, a.k === 'sheep' ? 16 : a.k === 'pig' ? 9 : 11)) {
            a.st = 'idle';
            a.t = rr(3, 10);
          }
        } else {
          a.graze = true;
          if (a.t <= 0) {
            const m = Math.random() < 0.55 ? herdMate(a) : null;
            if (m) {
              a.tx = m.x + rr(-28, 28);
              a.ty = m.y + rr(-20, 20);
            } else {
              a.tx = a.x + rr(-90, 90);
              a.ty = a.y + rr(-70, 70);
            }
            if (!inField(a.rect, a.tx, a.ty, -18)) [a.tx, a.ty] = ptIn(a.rect, 20);
            a.st = 'walk';
          }
        }
        break;
      }
      case 'deer':
      case 'moose':
      case 'hare': {
        const big = a.k === 'moose',
          hare = a.k === 'hare';
        if (a.chk <= 0 && a.st !== 'flee') {
          a.chk = 0.3;
          const th = big ? null : threatNear(a, hare ? 90 : 150);
          if (th) {
            a.st = 'flee';
            a.t = rr(2, 3.5);
            const dx = a.x - th[0],
              dy = a.y - th[1],
              d = Math.hypot(dx, dy) || 1;
            a.fx = dx / d;
            a.fy = dy / d;
          }
        }
        if (a.st === 'flee') {
          const sp = hare ? 170 : 140,
            nx = a.x + a.fx * sp * dt,
            ny = a.y + a.fy * sp * dt;
          a.hop += dt * (hare ? 11 : 8);
          if (
            inWater(nx, ny, 10) ||
            inBuild(nx, ny, 12) ||
            ny < 80 ||
            (!hare && !inFence(a.x, a.y) && inFence(nx, ny, 4))
          ) {
            const t = a.fx;
            a.fx = -a.fy;
            a.fy = t;
          } else {
            a.x = nx;
            a.y = ny;
            a.vx = a.fx * sp;
            a.vy = a.fy * sp;
            if (Math.abs(a.fx) > 0.1) a.f = a.fx > 0 ? 1 : -1;
          }
          if (a.t <= 0) {
            a.st = 'idle';
            a.t = rr(2, 5);
            if (!hare && !a.rect) {
              a.hx = a.x;
              a.hy = a.y;
            }
          }
        } else if (a.st === 'walk') {
          a.graze = false;
          a.hop += dt * 9;
          if (walkTo(a, dt, big ? 18 : hare ? 55 : 24)) {
            a.st = 'idle';
            a.t = rr(2, 8);
          }
        } else {
          a.graze = Math.sin(a.anim * 0.4 + a.ph) > -0.3;
          a.hop = 0;
          if (a.t <= 0) {
            for (let i = 0; i < 8; i++) {
              let x, y;
              if (a.rect) {
                [x, y] = inRectPt(a.rect, 15);
                if (Math.hypot(x - a.x, y - a.y) > 160) {
                  x = a.x + (x - a.x) * 0.4;
                  y = a.y + (y - a.y) * 0.4;
                }
              } else {
                const m = a.k === 'deer' && Math.random() < 0.6 ? herdMate(a) : null;
                if (m) {
                  x = m.x + rr(-40, 40);
                  y = m.y + rr(-30, 30);
                } else {
                  x = a.hx + rr(-a.hr, a.hr);
                  y = a.hy + rr(-a.hr, a.hr) * 0.7;
                }
              }
              // deer and moose keep out of fenced pastures (and find their way out if they are ever in one)
              const shut = !hare && (inFence(x, y, 12) || (!inFence(a.x, a.y) && crossesFence(a.x, a.y, x, y)));
              if (!inWater(x, y, 15) && !inBuild(x, y, 15) && y > 80 && !shut) {
                a.tx = x;
                a.ty = y;
                a.st = 'walk';
                break;
              }
            }
            a.t = rr(1, 3);
          }
        }
        break;
      }
      case 'duck': {
        if (a.st === 'dive') {
          if (a.t <= 0) {
            a.st = 'idle';
            a.t = rr(1, 4);
            RINGS.push({ x: a.x, y: a.y, t: 0 });
          }
          break;
        }
        if (a.st === 'walk') {
          if (walkTo(a, dt, 14)) {
            a.st = 'idle';
            a.t = rr(2, 7);
          }
        } else if (a.t <= 0) {
          if (Math.random() < 0.2) {
            a.st = 'dive';
            a.t = rr(1.5, 3);
            RINGS.push({ x: a.x, y: a.y, t: 0 });
          } else {
            for (let i = 0; i < 8; i++) {
              const x = a.x + rr(-160, 160),
                y = a.y + rr(-120, 120);
              if (inBlob(x, y, a.pool, a.prf, -20)) {
                a.tx = x;
                a.ty = y;
                a.st = 'walk';
                break;
              }
            }
            a.t = rr(1, 3);
          }
        }
        break;
      }
      case 'heron': {
        if (a.st === 'fly') {
          a.flap += dt * 4.5;
          if (flyTo(a, dt, 75, 1.9)) {
            a.st = 'idle';
            a.t = rr(6, 15);
          }
          break;
        }
        if (a.chk <= 0) {
          a.chk = 0.4;
          if (threatNear(a, 110)) {
            const an = rr(0, TAU),
              r = lakeR(an) - rr(5, 14);
            a.tx = LAKE.x + Math.cos(an) * r;
            a.ty = LAKE.y + Math.sin(an) * r;
            a.st = 'fly';
            a.z = 0.1;
            break;
          }
        }
        if (a.t <= 0) {
          if (a.st !== 'strike' && Math.random() < 0.3) {
            a.st = 'strike';
            a.t = 0.7;
            if (Math.random() < 0.5) RINGS.push({ x: a.x + a.f * 12, y: a.y + 4, t: 0 });
          } else {
            a.st = 'idle';
            a.t = rr(3, 9);
            if (Math.random() < 0.3) a.f = -a.f;
          }
        }
        break;
      }
      case 'magpie':
      case 'crow': {
        // at dusk they go up into the nearest tree to roost, out of sight, and come down again after dawn
        if (a.hide) {
          if (LIGHT.night > 0.3) break;
          a.hide = false;
          [a.tx, a.ty] = inRectPt(a.rect, 10);
          a.tx = a.x + wdx(a.tx, a.x);
          a.st = 'fly';
          a.z = 0.6;
          break;
        }
        if (LIGHT.night > 0.5 && a.st !== 'roost') {
          let best = null,
            bd = 700 * 700;
          for (const t of TREES) {
            const d = wdx(t.x, a.x) ** 2 + (t.y - a.y) ** 2;
            if (d < bd) {
              bd = d;
              best = t;
            }
          }
          if (best) {
            a.tx = a.x + wdx(best.x, a.x);
            a.ty = best.y;
          } else [a.tx, a.ty] = [a.x, a.y];
          a.st = 'roost';
          a.z = 0.05;
        }
        if (a.st === 'roost') {
          a.flap += dt * 14;
          if (flyTo(a, dt, 120, 1.3)) {
            a.x = wrapX(a.x);
            a.hide = true;
          }
          break;
        }
        if (a.st === 'fly') {
          a.flap += dt * 14;
          if (flyTo(a, dt, 120, 1.3)) {
            a.st = 'idle';
            a.t = rr(1, 4);
          }
          break;
        }
        if (a.chk <= 0) {
          a.chk = 0.3;
          if (threatNear(a, 75)) {
            [a.tx, a.ty] = inRectPt(a.rect, 10);
            a.st = 'fly';
            a.z = 0.05;
            if (a.k === 'crow') callAt('crow', a.x, a.y, 1, a);
            break;
          }
        }
        if (a.st === 'walk') {
          a.hop += dt * 12;
          if (walkTo(a, dt, 22)) {
            a.st = 'idle';
            a.t = rr(0.6, 2.5);
          }
        } else if (a.t <= 0) {
          a.graze = !a.graze;
          const r = Math.random();
          if (r < 0.5) {
            a.tx = clamp(a.x + rr(-40, 40), a.rect.x + 8, a.rect.x + a.rect.w - 8);
            a.ty = clamp(a.y + rr(-30, 30), a.rect.y + 8, a.rect.y + a.rect.h - 8);
            if (a.rect.poly && !inField(a.rect, a.tx, a.ty, -6)) [a.tx, a.ty] = ptIn(a.rect, 10);
            a.st = 'walk';
          } else if (r < 0.56) {
            [a.tx, a.ty] = inRectPt(a.rect, 10);
            a.st = 'fly';
            a.z = 0.05;
          }
          a.t = rr(0.5, 2.5);
        }
        break;
      }
      case 'cat': {
        if (a.st === 'walk') {
          if (walkTo(a, dt, 13)) {
            a.st = 'idle';
            a.t = rr(4, 14);
          }
        } else if (a.t <= 0) {
          [a.tx, a.ty] = inRectPt(a.rect, 25);
          if (!inBuild(a.tx, a.ty, 10)) a.st = 'walk';
          a.t = rr(1, 3);
        }
        break;
      }
      case 'fox': {
        // asleep in the den through the day; comes out to wander the forest edge from dusk on
        if (LIGHT.night < 0.2) {
          a.hide = true;
          a.vx = a.vy = 0;
          break;
        }
        a.hide = false;
        if (a.st === 'walk') {
          if (walkTo(a, dt, 22)) {
            a.st = 'idle';
            a.t = rr(3, 8);
          }
        } else if (a.t <= 0) {
          for (let i = 0; i < 6; i++) {
            const x = a.hx + rr(-a.hr, a.hr),
              y = a.hy + rr(-a.hr, a.hr) * 0.7;
            if (!inWater(x, y, 15) && !inBuild(x, y, 15) && y > 80) {
              a.tx = x;
              a.ty = y;
              a.st = 'walk';
              break;
            }
          }
          a.t = rr(2, 6);
        }
        break;
      }
      case 'tractor': {
        if (LIGHT.night > 0.4) break;
        if (a.go) {
          // on the way to the next field, in a higher gear than when working it
          const dx = wdx(a.go[0], a.x),
            dy = a.go[1] - a.y,
            d = Math.hypot(dx, dy);
          if (d < 6) {
            a.rect = a.next;
            a.go = a.next = null;
            a.work = rr(60, 140);
          } else {
            a.vx = (dx / d) * TRACTOR_ROAD;
            a.x = wrapX(a.x + a.vx * dt);
            a.y += (dy / d) * TRACTOR_ROAD * dt;
            if (Math.abs(dx) > 2) a.f = a.vx > 0 ? 1 : -1;
            tractorTurn(a, Math.atan2(dy, dx), dt);
          }
          tractorDust(a, dt);
          break;
        }
        const f = a.rect;
        a.ty = f.y + 28 + a.row * 30;
        const xr = a.row >= 0 && a.ty <= f.y + f.h - 24 && (f.poly ? xRange(f.poly, a.ty) : [f.x, f.x + f.w]);
        if (!xr || xr[1] - xr[0] < 70) {
          // past the last row (or the first, working back): the field is done, so on to the next one
          if (a.row < 0 || a.ty > f.y + f.h - 24) {
            a.row -= a.rdir;
            tractorMove(a);
          } else a.row += a.rdir;
          break;
        }
        a.tx = a.dirn > 0 ? xr[1] - 30 : xr[0] + 30;
        a.work = (a.work ?? rr(60, 140)) - dt;
        const dx = a.tx - a.x,
          dy = a.ty - a.y;
        let aim = a.f > 0 ? 0 : Math.PI;
        if (Math.abs(dy) > 1.5) {
          // swinging round at the headland onto the next row, at a crawl rather than sliding sideways:
          // face the way it is actually travelling, not the row heading it just left, or it looks like
          // it is crabbing sideways until it snaps round once the new row starts
          const step = Math.min(Math.abs(dy), TRACTOR_WORK * 0.7 * dt);
          a.y += Math.sign(dy) * step;
          if (Math.abs(dx) > 3) a.x += Math.sign(dx) * Math.min(Math.abs(dx), TRACTOR_WORK * 0.4 * dt);
          aim = Math.atan2(dy, dx);
        } else if (Math.abs(dx) < 3) {
          a.dirn *= -1;
          a.f = a.dirn;
          a.row += a.rdir;
          // enough done here: at the headland, set off for another field
          if (a.work <= 0) tractorMove(a);
        } else {
          a.y = a.ty;
          a.vx = Math.sign(dx) * Math.min(TRACTOR_WORK, Math.abs(dx) / dt);
          a.x += a.vx * dt;
          a.f = a.vx > 0 ? 1 : -1;
        }
        tractorTurn(a, aim, dt);
        tractorDust(a, dt);
        break;
      }
      case 'gull': {
        const tr = a.follow;
        a.oa += dt * a.sp;
        const tx = tr.x - tr.f * 34 + Math.cos(a.oa) * a.or,
          ty = tr.y + Math.sin(a.oa) * a.or * 0.6;
        const dx = tx - a.x,
          dy = ty - a.y,
          d = Math.hypot(dx, dy) || 1,
          sp = Math.min(110, d * 2);
        a.vx += ((dx / d) * sp - a.vx) * Math.min(1, dt * 2);
        a.vy += ((dy / d) * sp - a.vy) * Math.min(1, dt * 2);
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.hd = Math.atan2(a.vy, a.vx);
        a.z = 0.85 + 0.5 * Math.sin(a.anim * 0.7 + a.ph);
        a.flap += dt * (Math.sin(a.anim * 0.5 + a.ph) > 0 ? 9 : 0);
        break;
      }
      case 'butterfly': {
        a.vx += rr(-120, 120) * dt;
        a.vy += rr(-120, 120) * dt;
        const r = a.rect;
        if (a.x < r.x - 40) a.vx += 60 * dt;
        if (a.x > r.x + r.w + 40) a.vx -= 60 * dt;
        if (a.y < r.y - 40) a.vy += 60 * dt;
        if (a.y > r.y + r.h + 40) a.vy -= 60 * dt;
        const s = Math.hypot(a.vx, a.vy);
        if (s > 28) {
          a.vx *= 28 / s;
          a.vy *= 28 / s;
        }
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.z = 0.35 + 0.25 * Math.sin(a.anim * 2 + a.ph);
        a.hd = Math.atan2(a.vy, a.vx);
        break;
      }
      case 'goose':
      case 'rook': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (L) a.x = L.x + wdx(a.x, L.x);
        a.flap += dt * (a.k === 'goose' ? 5.5 : 7);
        a.life -= dt;
        break;
      }
    }
  }
  for (const a of ANIMALS) {
    if (a.dying) a.fade -= dt / 6;
    else if (a.k === 'human') {
      // a person going indoors or turning in for the night eases out of sight rather than
      // popping, since this happens in plain view (the farmyard, the ice hole)
      const target = a.hide ? 0 : 1;
      a.fade =
        a.fade === undefined
          ? target
          : a.fade + Math.sign(target - a.fade) * Math.min(Math.abs(target - a.fade), dt / 0.6);
    } else if (a.fade !== undefined && a.fade < 1) a.fade = Math.min(1, a.fade + dt / 6);
  }
  const keepAnimal = a => (a.life === undefined || a.life > 0) && !(a.dying && a.fade <= 0);
  if (ANIMALS.some(a => !keepAnimal(a))) ANIMALS = ANIMALS.filter(keepAnimal);
  // passing flights: geese heading south in a V, rooks crossing, small flocks dropping in to feed (wild.js)
  if (L && st.mode !== 'pause') {
    updateWild(dt);
    LIFE.geeseT -= dt;
    if (LIFE.geeseT <= 0 && (SEASON === 0 || SEASON === 2) && LIGHT.night < 0.4) {
      LIFE.geeseT = rr(80, 150);
      const cy = cam.py / TILT;
      const north = SEASON === 0;
      const sx = north ? V.x0 - 300 : V.x1 + 300,
        sy = north ? cy + rr(250, 550) : cy - rr(250, 550);
      const dir = north ? [0.86, -0.5] : [-0.86, 0.5],
        perp = [0.5, 0.86];
      const n = rr(7, 14) | 0;
      for (let i = 0; i < n; i++) {
        const rank = Math.ceil(i / 2),
          side = i % 2 ? 1 : -1;
        ANIMALS.push(
          mkA(
            'goose',
            sx - dir[0] * rank * 30 + perp[0] * side * rank * 24,
            sy - dir[1] * rank * 30 + perp[1] * side * rank * 24,
            {
              vx: dir[0] * 95,
              vy: dir[1] * 95,
              z: 4.4 + rr(-0.1, 0.1),
              hd: Math.atan2(dir[1], dir[0]),
              life: 45,
              flap: rr(0, 6)
            }
          )
        );
      }
      callAt('goose', sx, sy, 4);
    }
    LIFE.crowT -= dt;
    if (LIFE.crowT <= 0) {
      LIFE.crowT = rr(45, 90);
      const fromL = Math.random() < 0.5;
      const sx = fromL ? V.x0 - 200 : V.x1 + 200,
        sy = cam.py / TILT + rr(-300, 300);
      const vx = (fromL ? 1 : -1) * rr(70, 90),
        vy = rr(-15, 15);
      const n = rr(1, 3) | 0;
      for (let i = 0; i < n; i++)
        ANIMALS.push(
          mkA('rook', sx + rr(-50, 50), sy + rr(-40, 40), {
            vx,
            vy,
            z: rr(3, 3.6),
            hd: Math.atan2(vy, vx),
            life: 40,
            flap: rr(0, 6)
          })
        );
      callAt('crow', sx, sy, 1);
    }
    LIFE.fishT -= dt;
    if (LIFE.fishT <= 0) {
      LIFE.fishT = rr(7, 15);
      for (let i = 0; i < 6; i++) {
        const c = Math.random() < 0.8 ? LAKE : POND,
          rf = c === LAKE ? lakeR : pondR;
        if (c.x < 0) continue;
        const a = rr(0, TAU),
          r = rf(a) * Math.sqrt(Math.random()) * 0.85;
        const x = c.x + Math.cos(a) * r,
          y = c.y + Math.sin(a) * r;
        if (inView(x, y, -40)) {
          RINGS.push({ x, y, t: 0, fish: true });
          for (let j = 0; j < 5; j++)
            parts.push({
              k: 'w',
              x,
              y,
              z: 0.02,
              vz: rr(0.8, 1.4),
              vx: rr(-18, 18),
              vy: rr(-10, 10),
              life: 0.7,
              max: 0.7
            });
          break;
        }
      }
    }
  }
  // chimney smoke drifting with the wind
  // a steady trickle of soft wisps that merge into one plume, so it flows instead of stepping from blob to blob;
  // each chimney still breathes at its own slow pace, and draws harder in the cold months
  const cold = SEASON === 3 ? 1 : SEASON === 2 ? 0.75 : SEASON === 0 ? 0.5 : 0.2;
  for (const b of BUILDS) {
    if (!b.chimney) continue;
    if (b.smk === undefined) {
      b.smk = Math.random();
      b.smkPh = rr(0, TAU);
    }
    b.smkPh += dt * 0.5;
    b.smk += dt * 9 * cold * (0.6 + 0.4 * Math.sin(b.smkPh));
    if (b.smk < 1) continue;
    const c = Math.cos(b.ang),
      s = Math.sin(b.ang);
    const lx = (b.len / 2) * 0.45,
      ly = (-b.dep / 2) * 0.35;
    const x = b.cx + lx * c - ly * s,
      y = b.cy + lx * s + ly * c;
    const hz = (b.wh + (b.rh - b.wh) * 0.65 + 16) / HZ,
      see = inView(x, y, 500);
    for (; b.smk >= 1; b.smk--) {
      if (!see) continue;
      const max = rr(4.5, 6.5);
      SMOKE.push({
        x: x + rr(-0.6, 0.6),
        y,
        z: hz,
        r: rr(2.5, 3.5),
        life: max,
        max,
        a: rr(0.09, 0.13) * (0.5 + 0.5 * cold),
        ph: rr(0, TAU),
        sp: rr(-1, 1) // how far this wisp strays sideways from the plume as it spreads
      });
    }
  }
  for (const p of SMOKE) {
    p.life -= dt;
    const age = p.max - p.life;
    p.x += (WIND.x * (8 + amb_gust() * 22) + Math.sin(age * 1.3 + p.ph) * 2.5 + p.sp * age * 0.8) * dt;
    p.y += WIND.y * 10 * dt;
    p.z += dt * (0.7 - age * 0.06);
    p.r += dt * (4.2 - age * 0.35);
  }
  if (SMOKE.some(p => p.life <= 0)) SMOKE = SMOKE.filter(p => p.life > 0);
  for (const r of RINGS) r.t += dt;
  if (RINGS.some(r => r.t >= 2.4)) RINGS = RINGS.filter(r => r.t < 2.4);
  for (const c of CLOUDSH) {
    c.x += WIND.x * 14 * dt;
    c.y += WIND.y * 14 * dt;
    if (c.x > W) c.x -= W;
    else if (c.x < 0) c.x += W;
    if (c.y > H + 500) c.y = -400;
    if (c.y < -400) c.y = H + 500;
  }
  for (const c of SKYCLOUDS) {
    c.x += WIND.x * 6 * dt;
    if (c.x > 6000) c.x -= 6000;
    if (c.x < 0) c.x += 6000;
  }
}
// the gust where the flock is (weather.js)
const amb_gust = () => WEATHER.g;

/* animal drawing: side views for anything on the ground, squashed top views for fliers */
function ell(x, y, rx, ry, col, rot = 0) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}
