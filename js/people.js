/* Flokk - people.js
   A few people, kept deliberately scarce:
     - the farmer at the main farm, on a loose daily routine: chores in the barn, a bucket out to the pasture,
       leaning on the fence, firewood from the shed, shovelling snow in winter, indoors at night;
       sometimes whistles for the dog, which trots along
     - someone fishing off the end of the jetty (on a stool by a hole in the ice in winter), by day
     - now and then a walker passing along the road, by day
   People live in ANIMALS (k:'human'), so they are drawn, shadowed, culled and faded like the animals.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';

const PEOPLE_PAL = {
  farmer: [
    { coat: '#3E5A7A', legs: '#2E3440', hat: '#2A2E34', cap: true },
    { coat: '#6E7A3A', legs: '#3A3630', hat: '#8A3A2C', cap: true }
  ],
  fisher: [
    { coat: '#B8462E', legs: '#2E3440', hat: '#2E3A44' },
    { coat: '#D9A441', legs: '#3A3A3E', hat: '#3E5A44' }
  ],
  walker: [
    { coat: '#3D6B6B', legs: '#34323A', hat: '#C9B98E' },
    { coat: '#8A5A7A', legs: '#2E3440', hat: '#E8E6E0' },
    { coat: '#C8B08A', legs: '#3E3A36', hat: '#5A3A2E', pack: '#4A5A3A' },
    { coat: '#2F4A6A', legs: '#2A2A2E', hat: '#B3302A', pack: '#8A5A34' }
  ]
};
const SKIN = ['#E8C4A4', '#D9AE8A', '#C08A64', '#8E6244'],
  HAIR = ['#3A2A1E', '#5A4030', '#8A6A44', '#C8A870', '#2A2624', '#9A9690'];
const pickP = a => a[(Math.random() * a.length) | 0];
function mkPerson(role, x, y, o) {
  return mkA(
    'human',
    x,
    y,
    Object.assign({ role, pal: pickP(PEOPLE_PAL[role]), skin: pickP(SKIN), hair: pickP(HAIR), busy: true, plan: [] }, o)
  );
}

// the spot just in front of a building's long side, where its door is
function frontOf(b, out = 10) {
  return [b.cx - Math.sin(b.ang) * (b.dep / 2 + out), b.cy + Math.cos(b.ang) * (b.dep / 2 + out)];
}
// a point just outside a field, on the side nearest (x,y)
function fieldEdge(f, x, y) {
  const cx = clamp(x, f.x + 20, f.x + f.w - 20),
    cy = clamp(y, f.y + 20, f.y + f.h - 20);
  const dx = Math.min(cx - f.x, f.x + f.w - cx),
    dy = Math.min(cy - f.y, f.y + f.h - cy);
  if (dx < dy) return [cx < f.x + f.w / 2 ? f.x - 14 : f.x + f.w + 14, cy];
  return [cx, cy < f.y + f.h / 2 ? f.y - 12 : f.y + f.h + 14];
}

function spawnPeople() {
  const fm = FARMS[0];
  if (fm && fm.house) {
    const [x, y] = frontOf(fm.house);
    ANIMALS.push(mkPerson('farmer', x, y, { farm: fm }));
  }
  if (JET) {
    if (SEASON < 3) {
      const t = 0.9,
        x = lerp(JET.x0, JET.x1, t),
        y = lerp(JET.y0, JET.y1, t);
      ANIMALS.push(mkPerson('fisher', x, y, { pose: 'sit', f: JET.x1 > JET.x0 ? 1 : -1, lineT: rr(4, 9) }));
    } else {
      for (let i = 0; i < 40; i++) {
        const an = rr(0, TAU),
          r = lakeR(an) * rr(0.35, 0.6),
          x = LAKE.x + Math.cos(an) * r,
          y = LAKE.y + Math.sin(an) * r;
        if (!inBlob(x, y, LAKE, lakeR, -60)) continue;
        ANIMALS.push(
          mkPerson('fisher', x, y, { pose: 'stool', ice: true, f: Math.random() < 0.5 ? 1 : -1, lineT: rr(4, 9) })
        );
        break;
      }
    }
  }
  LIFE.walkT = rr(25, 60);
}

/* ---- the farmer's routine: a queue of small steps ---- */
function farmerPlan(a) {
  const fm = a.farm,
    Y = fm.yard,
    mid = () => yardAt(Y, rr(0.35, 0.65), rr(0.35, 0.65));
  const door = frontOf(fm.house),
    b = fm.builds || [];
  const barn = b.find(o => o.kind === 'barn' || o.kind === 'sbarn'),
    shed = b.find(o => o.kind === 'shed' || o.kind === 'stabbur');
  const plan = [];
  const go = (p, o) => plan.push(Object.assign({ go: p }, o));
  const act = (d, t, o) => plan.push(Object.assign({ act: d, t }, o));
  if (LIGHT.night > 0.55) {
    // evening: home, and indoors until morning
    go(mid());
    go(door);
    act('inside', 1e9);
    return plan;
  }
  const r = Math.random(),
    pasture = FIELDS.filter(f => f.t === 'pasture').sort(
      (p, q) =>
        Math.hypot(p.x + p.w / 2 - fm.cx, p.y + p.h / 2 - fm.cy) -
        Math.hypot(q.x + q.w / 2 - fm.cx, q.y + q.h / 2 - fm.cy)
    )[0];
  if (SEASON === 3 && r < 0.45) {
    // clearing the yard, a strip at a time
    const b0 = rr(0.3, 0.7);
    go(yardAt(Y, 0.2, b0));
    go(yardAt(Y, 0.8, b0), { pose: 'shovel', spd: 5 });
    go(yardAt(Y, 0.2, b0 + 16 / Y.lh), { pose: 'shovel', spd: 5 });
  } else if (barn && r < 0.5) {
    // chores in the barn, then a bucket out to the animals
    go(mid());
    go(frontOf(barn));
    act('inside', rr(5, 12));
    if (pasture && SEASON < 3) {
      go(fieldEdge(pasture, fm.cx, fm.cy), { carry: 'bucket' });
      act('lean', rr(4, 8));
    }
  } else if (fm.line && SEASON < 2 && LIGHT.night < 0.3 && LIGHT.rain < 0.15 && r < 0.62) {
    // out to the clothesline
    go([fm.line.x + rr(-14, 14), fm.line.y + 9]);
    act('look', rr(3, 6));
    act('stoop', rr(1, 2));
    act('look', rr(3, 6));
  } else if ((fm.wood || shed) && (SEASON >= 2 || r < 0.65)) {
    // an armful of firewood for the house
    go(mid());
    go(fm.wood ? [fm.wood.x + rr(-8, 8), fm.wood.y + 14] : frontOf(shed));
    act('stoop', rr(1.5, 3));
    go(door, { carry: 'logs' });
    act('inside', rr(4, 10));
  } else if (pasture && SEASON < 3) {
    go(fieldEdge(pasture, fm.cx, fm.cy));
    act('lean', rr(5, 10));
  } else {
    go(mid());
    act('look', rr(3, 7));
  }
  go(mid());
  act('look', rr(2, 5));
  if (Math.random() < 0.5) {
    go(door);
    act('inside', rr(8, 25));
  }
  return plan;
}
function farmerLife(a, dt) {
  // nightfall ends whatever the farmer was doing: home and indoors
  if (LIGHT.night > 0.6 && !a.plan.some(p => p.act === 'inside' && p.t > 1e8)) a.plan = [];
  if (!a.plan.length) {
    a.plan = farmerPlan(a);
    // a whistle, and the dog comes along for the walk
    const dog = ANIMALS.find(o => o.k === 'dog' && !o.dying);
    if (dog && Math.random() < 0.4 && a.plan.some(s => s.go) && !a.hide) {
      dog.follow = a;
      dog.followT = rr(15, 30);
      callAt('whistle', a.x, a.y, 1);
    }
  }
  const s = a.plan[0];
  a.carry = s.carry || null;
  a.pose = s.pose || null;
  if (s.go) {
    a.hide = false;
    a.st = 'walk';
    if (steerA(a, s.go[0], s.go[1], s.spd || 14, dt) < 3) a.plan.shift();
    return;
  }
  a.st = 'idle';
  a.vx = a.vy = 0;
  a.pose = s.act;
  a.hide = s.act === 'inside';
  // idling within sight of the flock, the farmer turns to watch it
  if (s.act === 'look' && L && Math.abs(wdx(L.x, a.x)) < 320 && Math.abs(L.y - a.y) < 260)
    a.f = wdx(L.x, a.x) > 0 ? 1 : -1;
  s.t -= dt;
  // back out in the morning, or when the chore is done
  if (s.t <= 0 || (s.act === 'inside' && s.t > 1e8 && LIGHT.night < 0.35)) {
    a.plan.shift();
    a.hide = false;
  }
}

/* ---- fishing ---- */
function fisherLife(a, dt) {
  a.st = 'idle';
  a.hide = LIGHT.night > 0.5;
  if (a.hide) return;
  a.lineT -= dt;
  if (a.lineT <= 0) {
    // a nibble, sometimes a catch lifted out with a little splash
    a.lineT = rr(6, 16);
    const [lx, ly] = lineEnd(a);
    RINGS.push({ x: lx, y: ly, t: 0.4 });
    if (Math.random() < 0.3) {
      a.catchT = 1.2;
      for (let j = 0; j < 4; j++)
        parts.push({
          k: 'w',
          x: lx,
          y: ly,
          z: 0.02,
          vz: rr(0.8, 1.3),
          vx: rr(-14, 14),
          vy: rr(-8, 8),
          life: 0.6,
          max: 0.6
        });
    }
  }
  if (a.catchT > 0) a.catchT -= dt;
}
const lineEnd = a => [a.x + a.f * (a.ice ? 7 : 30), a.y + (a.ice ? 3 : 10)];

/* ---- a walker on the road ---- */
function walkerLife(a, dt) {
  a.st = 'walk';
  a.s += a.dir * 13 * dt;
  a.dist += 13 * dt;
  const p = roadAt(a.s),
    hx = Math.cos(p.ang) * a.dir,
    hy = Math.sin(p.ang) * a.dir;
  const nx = p.x - hy * 13,
    ny = p.y + hx * 13;
  a.vx = wdx(nx, a.x) / Math.max(dt, 1e-3);
  a.vy = (ny - a.y) / Math.max(dt, 1e-3);
  a.x = nx;
  a.y = ny;
  if (Math.abs(hx) > 0.1) a.f = hx > 0 ? 1 : -1;
  if (a.dist > 2600 && (!L || Math.abs(wdx(a.x, L.x)) > 1400) && !a.dying) {
    a.dying = true;
    a.fade = 1;
  }
}
function spawnWalker() {
  if (!ROAD) return;
  if (RD.ref !== ROAD) roadInit();
  // start well off to one side and head back towards where the flock is
  const side = Math.random() < 0.5 ? 1 : -1,
    sx = L ? wrapX(L.x + side * rr(1300, 1500)) : rr(0, W);
  const a = mkPerson('walker', 0, 0, { s: RD.sAt(sx), dir: 1, dist: 0, fade: 0 });
  a.dir = wdx(L ? L.x : 0, sx) * Math.cos(roadAt(a.s).ang) > 0 ? 1 : -1;
  walkerLife(a, 0.016);
  ANIMALS.push(a);
}

function updatePeople(dt) {
  for (const a of ANIMALS) {
    if (a.k !== 'human' || a.dying) continue;
    if (a.role === 'farmer') farmerLife(a, dt);
    else if (a.role === 'fisher') fisherLife(a, dt);
    else if (a.role === 'walker') walkerLife(a, dt);
    // anyone on foot sends sparrows resting on the ground up as they pass
    if (!a.hide && a.st === 'walk') {
      a.scare = (a.scare || 0) - dt;
      if (a.scare <= 0) {
        a.scare = 0.3;
        scatterFlock(a.x, a.y, 42);
      }
    }
  }
  // the occasional walker, by day, never more than one
  if (L && st.mode !== 'pause') {
    LIFE.walkT = (LIFE.walkT ?? 40) - dt;
    if (LIFE.walkT <= 0) {
      LIFE.walkT = rr(70, 150);
      if (LIGHT.night < 0.3 && !ANIMALS.some(o => o.role === 'walker' && !o.dying)) spawnWalker();
    }
  }
}

/* ---- drawing: a small side-view figure, feet at the origin, facing +x ---- */
// the dark round hole beside an ice fisher, drawn on the ground layer
function iceHoles() {
  for (const a of ANIMALS) {
    if (a.k !== 'human' || !a.ice || a.hide || !visG(a.x, a.y, 30)) continue;
    const [x, y] = lineEnd(a);
    ctx.fillStyle = 'rgba(40,62,76,.85)';
    ctx.beginPath();
    ctx.ellipse(x, y, 4.5, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}
