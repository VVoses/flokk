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
const SKIN = ['#E8C4A4', '#D9AE8A', '#C08A64', '#8E6244'];
const pickP = a => a[(Math.random() * a.length) | 0];
function mkPerson(role, x, y, o) {
  return mkA(
    'human',
    x,
    y,
    Object.assign({ role, pal: pickP(PEOPLE_PAL[role]), skin: pickP(SKIN), busy: true, plan: [] }, o)
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
function drawHuman(a) {
  if (a.hide) return;
  const P = a.pal,
    walking = a.st === 'walk',
    ph = a.gp || 0,
    pose = a.pose;
  const seated = pose === 'sit' || pose === 'stool',
    stoop = pose === 'stoop' ? 1 : pose === 'shovel' ? 0.45 + 0.25 * Math.sin(T * 4) : pose === 'lean' ? 0.35 : 0;
  const hipY = seated ? (pose === 'stool' ? -7 : -1.5) : -11.5;
  const lean = stoop * 0.7 + (walking ? 0.08 : 0);
  const shX = Math.sin(lean) * 8.5,
    shY = hipY - Math.cos(lean) * 8.5;
  const sw = walking ? Math.sin(ph) : 0;
  const bob = walking ? -Math.abs(Math.cos(ph)) * 0.6 : 0;
  ctx.save();
  ctx.translate(0, bob);
  ctx.lineCap = 'round';
  // legs: thigh and shin, far leg first and a shade darker
  const leg = (s, far) => {
    ctx.strokeStyle = far ? shade(P.legs, 0.78) : P.legs;
    ctx.lineWidth = 2.3;
    let kx, ky, fx, fy;
    if (seated && pose === 'sit') {
      // on the jetty edge, legs over the side
      kx = 5;
      ky = hipY;
      fx = 5.5 + Math.sin(T * 1.3 + (far ? 1 : 0)) * 0.8;
      fy = hipY + 5.5;
    } else if (seated) {
      kx = 5;
      ky = hipY - 0.5;
      fx = 5.5;
      fy = 0;
    } else {
      const th = s * 0.5,
        bend = walking ? Math.max(0, -Math.sin(ph + (far ? Math.PI : 0) + 0.6)) * 0.7 : 0;
      kx = Math.sin(th) * 5.8;
      ky = hipY + Math.cos(th) * 5.8;
      fx = kx + Math.sin(th - bend) * 5.8;
      fy = Math.min(0, ky + Math.cos(th - bend) * 5.8);
    }
    ctx.beginPath();
    ctx.moveTo(0, hipY);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.strokeStyle = '#2A2420';
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(fx - 0.6, fy);
    ctx.lineTo(fx + 1.6, fy);
    ctx.stroke();
  };
  leg(-sw, true);
  if (P.pack) {
    ctx.fillStyle = P.pack;
    ctx.beginPath();
    ctx.ellipse(shX * 0.5 - 3.2, (shY + hipY) / 2 - 1, 2.2, 3.8, lean, 0, TAU);
    ctx.fill();
  }
  // far arm
  const arm = (far, a1, a2) => {
    ctx.strokeStyle = far ? shade(P.coat, 0.75) : shade(P.coat, 0.92);
    ctx.lineWidth = 2;
    const ex = shX + Math.sin(a1) * 4.4,
      ey = shY + 1 + Math.cos(a1) * 4.4,
      hx = ex + Math.sin(a2) * 4,
      hy = ey + Math.cos(a2) * 4;
    ctx.beginPath();
    ctx.moveTo(shX, shY + 1);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = a.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 1, 0, TAU);
    ctx.fill();
    return [hx, hy];
  };
  let A = [0.35 * sw, 0.5 * sw + 0.2],
    B = [-0.35 * sw, -0.5 * sw + 0.2];
  if (pose === 'lean') ((A = [1.3, 1.6]), (B = [1.2, 1.5]));
  else if (pose === 'shovel') ((A = [0.9 + 0.3 * Math.sin(T * 4), 1.4]), (B = [0.5 + 0.3 * Math.sin(T * 4), 0.9]));
  else if (pose === 'stoop') ((A = [0.4, 0.2]), (B = [0.2, 0.1]));
  else if (seated) ((A = [1, 2.1]), (B = [0.9, 2]));
  else if (a.carry === 'logs') ((A = [0.9, 2.2]), (B = [0.8, 2.1]));
  else if (a.carry === 'bucket') A = [0.05, 0.05];
  const hf = arm(true, B[0], B[1]);
  // torso: a coat, slightly wider at the shoulders
  ctx.fillStyle = P.coat;
  ctx.beginPath();
  ctx.moveTo(-2.4, hipY + 1.5);
  ctx.lineTo(2.2, hipY + 1.5);
  ctx.lineTo(shX + 2.6, shY + 0.5);
  ctx.lineTo(shX - 2.6, shY + 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(-2.4, hipY - 0.5, 4.6, 2);
  // head and hat
  const hx = shX + Math.sin(lean) * 3.2 + 0.3,
    hy = shY - 2.9;
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 2.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = SEASON === 3 && !P.cap ? P.coat : P.hat;
  ctx.beginPath();
  ctx.arc(hx, hy - 0.4, 2.6, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  if (P.cap) ctx.fillRect(hx, hy - 1.6, 3.4, 0.9);
  else if (SEASON === 3) {
    ctx.beginPath();
    ctx.arc(hx - 0.4, hy - 3, 0.9, 0, TAU);
    ctx.fill();
  }
  const hn = arm(false, A[0], A[1]);
  // what the hands hold
  if (a.carry === 'bucket') {
    ctx.fillStyle = '#8A9298';
    ctx.beginPath();
    ctx.moveTo(hn[0] - 1.8, hn[1] + 0.6);
    ctx.lineTo(hn[0] + 1.8, hn[1] + 0.6);
    ctx.lineTo(hn[0] + 1.4, hn[1] + 4);
    ctx.lineTo(hn[0] - 1.4, hn[1] + 4);
    ctx.closePath();
    ctx.fill();
  } else if (a.carry === 'logs') {
    ctx.fillStyle = '#8A6A48';
    for (let i = 0; i < 3; i++) ctx.fillRect(hn[0] - 3.5, hn[1] - 1.5 - i * 1.4, 6.5, 1.3);
  } else if (pose === 'shovel') {
    ctx.strokeStyle = '#7A5A3A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hf[0] - 2, hf[1] - 2);
    ctx.lineTo(hn[0] + 5, 0);
    ctx.stroke();
    ctx.fillStyle = '#5A6066';
    ctx.fillRect(hn[0] + 4, -1.2, 3.4, 1.4);
  } else if (a.role === 'fisher') {
    // rod up and out over the water, line down to the float
    const tip = [hn[0] + (a.ice ? 5 : 14), hn[1] - (a.ice ? 3 : 11) + (a.catchT > 0 ? -3 : Math.sin(T * 1.7) * 0.6)];
    ctx.strokeStyle = '#3A3028';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hn[0] - 1, hn[1] + 1);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    const endX = a.ice ? 7 : 30,
      endY = (a.ice ? 3 : 10) * TILT;
    ctx.strokeStyle = 'rgba(230,230,220,.55)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.quadraticCurveTo((tip[0] + endX) / 2, tip[1] + 6, endX, endY);
    ctx.stroke();
    if (!a.ice) {
      ctx.fillStyle = '#D8432E';
      ctx.fillRect(endX - 0.7, endY - 1, 1.4, 1.4);
    }
  }
  ctx.restore();
  if (pose === 'stool') {
    ctx.strokeStyle = '#5A4430';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.lineTo(1, 0);
    ctx.moveTo(1, -7);
    ctx.lineTo(-2, 0);
    ctx.stroke();
  }
}
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
