/* Flokk - flight.js
   Hawks and owls, flock flight and perching behaviour.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
/* ---------- hawks ---------- */
// how keen a hawk is: wariest and quickest to give up in spring (nesting season, plenty of easier prey
// about), building through the year to boldest and most persistent in winter, when it's hungriest and
// a flock is worth the risk. Textures the existing threat by season rather than just raising numbers.
const HAWK_BOLD = [0.72, 1, 1.22, 1.48];
function spawnHawk(kind = 'hawk') {
  const a = rr(0, TAU),
    d = (Math.max(vw, vh) / cam.z) * 0.7 + 200,
    bold = HAWK_BOLD[SEASON];
  hawks.push({
    x: L.x + Math.cos(a) * d,
    y: L.y + Math.sin(a) * d,
    vx: 0,
    vy: 0,
    v: 200,
    psi: a + Math.PI + rr(-0.5, 0.5),
    turn: 0,
    bank: 0,
    pitch: 0,
    kind,
    cz: kind === 'owl' ? OWLZ : HAWKZ,
    fold: 0.2,
    fan: 0,
    dih: 0.08,
    z: kind === 'owl' ? OWLZ : HAWKZ,
    s: kind === 'owl' ? 15 : 17,
    state: 'patrol',
    sub: 'glide',
    subT: rr(3, 6),
    tcx: L.x + rr(-350, 350),
    tcy: L.y + rr(-350, 350),
    od: rr(150, 230),
    dir: Math.random() < 0.5 ? 1 : -1,
    scan: 0,
    cool: 3 / bold,
    bored: 0,
    patience: rr(8, 13) * bold,
    bold,
    t: 0,
    life: 0,
    flap: 0,
    flapOn: false,
    fbT: rr(1, 3),
    flapRate: 7,
    heading: 0,
    alpha: 1,
    target: null,
    prey: null,
    tuck: false,
    hoverDur: 1
  });
}
function pickTarget(h) {
  let best = null,
    bs = 1e9;
  for (const b of birds) {
    if (!exposed(b)) continue;
    const d = Math.hypot(b.x - h.x, b.y - h.y);
    if (d > 620 * hawkSee(h)) continue;
    let nn = 1e9;
    for (const o of birds) {
      if (o === b) continue;
      const q = (o.x - b.x) ** 2 + (o.y - b.y) ** 2;
      if (q < nn) nn = q;
    }
    nn = Math.sqrt(nn);
    const s = d - Math.min(nn, 140) * 1.3 - (b.state === 'perch' ? 50 : 0);
    if (s < bs) {
      bs = s;
      best = b;
    }
  }
  return best;
}
function catchBird(h, b) {
  const i = birds.indexOf(b);
  if (i < 0) return;
  birds.splice(i, 1);
  if (b.perch && b.perch.occ === b) b.perch.occ = null;
  st.lost++;
  feathers(b.x, b.y, b.z, b.c2);
  thud();
  h.state = 'carry';
  h.target = null;
  h.prey = b;
  h.t = 0;
  for (const o of hawks)
    if (o !== h && o.target === b) {
      o.target = null;
      o.state = 'climb';
      o.cool = 2;
    }
  if (!birds.length) {
    st.overT = 1.3;
    return;
  }
  if (b === L) {
    let nb = birds[0],
      bd = 1e18;
    for (const o of birds) {
      const q = d2(o, b);
      if (q < bd) {
        bd = q;
        nb = o;
      }
    }
    L = nb;
    if (L.state === 'perch' || L.state === 'land') takeoffAll();
  }
}
/* hawk flight: heading-based with a limited turn rate, so hawks carve real arcs.
   Bank follows turn rate x speed; pitch, wing fold, dihedral and tail fan follow the flight phase. */
function steerTo(h, dt, x, y, maxTurn, gain) {
  const want = Math.atan2(y - h.y, x - h.x);
  const d = ((((want - h.psi + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  const tr = clamp(d * (gain || 2.4), -maxTurn, maxTurn);
  h.turn += (tr - h.turn) * Math.min(1, dt * 4);
  return Math.hypot(x - h.x, y - h.y);
}
// fog and driven snow shorten how far a hawk can see; an owl hunts by ear and hardly minds
const hawkSee = h => (h.kind === 'owl' ? 1 - 0.25 * (1 - seeK()) : 0.25 + 0.75 * seeK());
const hawkTargetOK = t => t && birds.indexOf(t) >= 0 && exposed(t);
function scareAround(h) {
  for (const b of birds) {
    const q = (b.x - h.x) ** 2 + (b.y - h.y) ** 2;
    if (q < 200 * 200) {
      if (b.state === 'perch' && !b.perch.cover) {
        launch(b);
        b.panic = 2.2;
        b.landCool = 3;
      } else if (b.state === 'fly' || b.state === 'land') {
        if (b !== L || b.state === 'land') {
          b.panic = Math.max(b.panic, 1.4);
          b.landCool = Math.max(b.landCool, 2.5);
          if (b.state === 'land' && !(b.perch && b.perch.cover)) {
            if (b.perch && b.perch.occ === b) b.perch.occ = null;
            b.perch = null;
            b.state = 'fly';
          }
        }
      }
    }
  }
}
function updateHawk(h, dt) {
  h.life += dt;
  h.cool -= dt;
  h.scan -= dt;
  let vT = 160,
    pitchT = 0,
    foldT = 0.1,
    dihT = 0.1,
    flapWant = 0,
    zT = h.z,
    zRate = 0.5,
    accel = 1.2,
    turnSet = null;
  switch (h.state) {
    case 'patrol': {
      /* a hawk only stays interested while it can see prey; hidden flocks bore it */
      const sr = 900 * hawkSee(h),
        seen = st.mode === 'play' && birds.some(b => exposed(b) && d2(b, h) < sr * sr);
      if (seen) {
        h.bored = Math.max(0, h.bored - dt * 2);
        h.tcx += (L.x - h.tcx) * dt * 0.08;
        h.tcy += (L.y - h.tcy) * dt * 0.08;
      } else {
        h.bored += dt;
        h.od = Math.min(h.od + dt * 10, 400);
        h.tcx += Math.cos(h.life * 0.3 + h.dir) * dt * 25;
        h.tcy += Math.sin(h.life * 0.23) * dt * 25;
      }
      h.subT -= dt;
      if (h.sub === 'circle') {
        // riding a thermal: steady banked circles, slowly gaining height
        const oa = Math.atan2(h.y - h.tcy, h.x - h.tcx) + h.dir * 0.55;
        steerTo(h, dt, h.tcx + Math.cos(oa) * h.od, h.tcy + Math.sin(oa) * h.od, 1.5, 3);
        vT = 150;
        dihT = 0.17;
        foldT = 0;
        zT = h.cz + 0.9;
        zRate = 0.12;
        if (h.subT <= 0) {
          h.sub = 'glide';
          h.subT = rr(4, 8);
          const bx = seen ? L.x : h.tcx,
            by = seen ? L.y : h.tcy;
          h.tcx = bx + rr(-550, 550);
          h.tcy = by + rr(-450, 450);
        }
      } else {
        // gliding to the next thermal on swept wings, sinking a little
        const d = steerTo(h, dt, h.tcx, h.tcy, 0.9, 1.6);
        vT = 220;
        foldT = 0.3;
        dihT = 0.05;
        zT = h.cz - 0.5;
        zRate = 0.1;
        if (d < h.od * 1.1 || h.subT <= 0) {
          h.sub = 'circle';
          h.subT = rr(6, 11);
          h.od = rr(130, 230);
          h.dir = Math.random() < 0.5 ? 1 : -1;
        }
      }
      if (h.bored > h.patience) {
        h.state = 'leave';
        h.t = 0;
        st.hawkT = Math.max(st.hawkT, rr(14, 22));
        break;
      }
      if (h.scan <= 0) {
        h.scan = 0.4;
        if (h.cool <= 0 && st.mode === 'play') {
          const t = pickTarget(h);
          if (t) {
            h.target = t;
            h.state = 'stalk';
          }
        }
      }
      if (h.life > 80) {
        h.state = 'leave';
        h.t = 0;
      }
      break;
    }
    case 'stalk': {
      // shallow powered approach, leading the target
      const t = h.target;
      if (!hawkTargetOK(t)) {
        h.state = 'patrol';
        h.sub = 'circle';
        h.tcx = h.x;
        h.tcy = h.y;
        h.cool = 2 / h.bold;
        h.target = null;
        h.bored += 2;
        break;
      }
      const d = steerTo(h, dt, t.x + t.vx * 0.5, t.y + t.vy * 0.5, 1.8, 2.6);
      vT = 245;
      foldT = 0.25;
      dihT = 0.03;
      zT = h.cz - 0.2;
      zRate = 0.3;
      flapWant = d > 500 ? 8 : 0;
      if (d < 320) {
        const still = t.state === 'perch' || t.state === 'takeoff' || Math.hypot(t.vx, t.vy) < 70;
        if (still && h.kind !== 'owl') {
          h.state = 'hover';
          h.t = 0;
          h.hoverDur = rr(0.7, 1.4);
        } else {
          h.state = 'dive';
          h.t = 0;
          if (h.kind !== 'owl') hawkCry();
        }
      } else if (d > 950) {
        h.state = 'patrol';
        h.target = null;
      }
      break;
    }
    case 'hover': {
      // hanging on the wind above still prey, tail fanned, before the stoop
      const t = h.target;
      if (!hawkTargetOK(t)) {
        h.state = 'climb';
        h.t = 0;
        h.cool = 2.5 / h.bold;
        h.target = null;
        h.bored += 2;
        break;
      }
      h.t += dt;
      const d = steerTo(h, dt, t.x, t.y, 2.6, 3);
      vT = Math.min(70, d * 1.2);
      accel = 2.6;
      pitchT = -0.22;
      foldT = 0;
      dihT = 0.04;
      flapWant = 15;
      zRate = 0;
      if (h.t > h.hoverDur) {
        h.state = 'dive';
        h.t = 0;
        if (h.kind !== 'owl') hawkCry();
      }
      break;
    }
    case 'dive': {
      // the stoop: wings folded, nose down, accelerating
      const t = h.target;
      h.t += dt;
      if (!hawkTargetOK(t) || h.t > 2.2) {
        h.state = 'climb';
        h.t = 0;
        h.cool = 2.8 / h.bold;
        h.target = null;
        h.bored += exposed(t || L) ? 0 : 3;
        break;
      }
      const d = steerTo(h, dt, t.x + t.vx * 0.25, t.y + t.vy * 0.25, 3, 4);
      vT = (h.kind === 'owl' ? 370 : 480) + Math.min(90, birds.length * 0.8);
      accel = 1.8;
      foldT = 0.85;
      dihT = 0;
      zRate = 0;
      pitchT = clamp(Math.atan2((h.z - t.z) * HZ, Math.max(20, d)) * 1.15, 0.15, 1.25);
      h.z = Math.max(t.z + 0.1, h.z - dt * (1.1 + 2.8 * Math.max(0, Math.sin(h.pitch))));
      scareAround(h);
      if (Math.hypot(t.x - h.x, t.y - h.y) < 17 && h.z - t.z < 0.45) catchBird(h, t);
      break;
    }
    case 'climb': {
      // pulling out: nose up, hard wingbeats, swinging wide before climbing away
      h.t += dt;
      pitchT = -0.5;
      foldT = 0;
      dihT = 0.04;
      flapWant = 9;
      vT = 175;
      accel = 0.9;
      zT = h.cz;
      zRate = 1.1;
      turnSet = h.dir * 0.9;
      if (h.t > 1.6 && h.z > h.cz - 0.7) {
        h.state = 'patrol';
        h.sub = 'circle';
        h.subT = rr(4, 8);
        const a = h.psi + (h.dir * Math.PI) / 2;
        h.tcx = h.x + Math.cos(a) * 160;
        h.tcy = h.y + Math.sin(a) * 160;
        h.od = 160;
      }
      break;
    }
    case 'carry':
    case 'leave': {
      h.t += dt;
      steerTo(h, dt, h.x + (h.x - L.x), h.y + (h.y - L.y), 1, 1.5);
      if (h.state === 'carry') {
        vT = 165;
        flapWant = 8;
        zT = h.cz;
        zRate = 0.8;
        pitchT = -0.12;
      } else {
        vT = 215;
        foldT = 0.28;
        zT = h.cz + 1.2;
        zRate = 0.3;
      }
      if (h.t > (h.state === 'leave' ? 2.5 : 1.6)) h.alpha -= dt * 0.4;
      break;
    }
  }
  if (turnSet !== null) h.turn += (turnSet - h.turn) * Math.min(1, dt * 2);
  if (zRate) h.z += (zT - h.z) * Math.min(1, dt * zRate * 2);
  if (h.kind === 'owl' && h.state !== 'dive') vT *= 0.82;
  h.v += (vT - h.v) * Math.min(1, dt * accel);
  h.psi += h.turn * dt;
  h.heading = h.psi;
  h.vx = Math.cos(h.psi) * h.v;
  h.vy = Math.sin(h.psi) * h.v;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  const bankT = h.state === 'hover' ? 0 : clamp((h.turn * h.v) / 240, -1.15, 1.15);
  h.bank += (bankT - h.bank) * Math.min(1, dt * 3);
  h.pitch += (pitchT - h.pitch) * Math.min(1, dt * 3);
  h.fold += (foldT - h.fold) * Math.min(1, dt * 4);
  h.dih += (dihT - h.dih) * Math.min(1, dt * 2);
  const fanT = h.state === 'hover' ? 1 : clamp(Math.abs(h.turn) * 0.7, 0, 1);
  h.fan += (fanT - h.fan) * Math.min(1, dt * 3);
  // wingbeats: forced in hover, pull-out and carrying; otherwise short bursts between long glides
  if (flapWant) {
    h.flapOn = true;
    h.flapRate = flapWant;
  } else {
    h.fbT -= dt;
    if (h.fbT <= 0) {
      h.flapOn = !h.flapOn;
      h.fbT = h.flapOn ? rr(0.5, 1) : rr(2.5, 6);
      h.flapRate = h.kind === 'owl' ? 5 : 7;
    }
  }
  if (h.flapOn || Math.abs(Math.sin(h.flap)) > 0.08) h.flap += dt * h.flapRate;
  h.tuck = h.fold > 0.5;
}

/* ---------- bird updates ---------- */
function flyUpdate(b, dt) {
  let sx = 0,
    sy = 0,
    avx = 0,
    avy = 0,
    n = 0;
  for (const o of birds) {
    if (o === b || o.state === 'perch' || o.state === 'takeoff') continue;
    const dx = o.x - b.x,
      dy = o.y - b.y,
      q = dx * dx + dy * dy;
    if (q > 3600) continue;
    n++;
    avx += o.vx;
    avy += o.vy;
    if (q < 256 && q > 0.0001) {
      const d = Math.sqrt(q),
        f = (16 - d) / 16;
      sx -= (dx / d) * f;
      sy -= (dy / d) * f;
    }
  }
  b.oa += dt * b.ospin;
  const fr = 11 * Math.sqrt(birds.length) + 8;
  const tx = L.x - L.vx * 0.28 + Math.cos(b.oa) * b.or * fr,
    ty = L.y - L.vy * 0.28 + Math.sin(b.oa) * b.or * fr * 0.8;
  let dvx = L.vx + (tx - b.x) * 2.2,
    dvy = L.vy + (ty - b.y) * 2.2;
  if (n) {
    dvx += (avx / n - b.vx) * 0.25;
    dvy += (avy / n - b.vy) * 0.25;
  }
  dvx += sx * 260;
  dvy += sy * 260;
  dvx += Math.cos(T * 1.3 + b.ph) * 25;
  dvy += Math.sin(T * 1.1 + b.ph * 1.7) * 25;
  for (const h of hawks) {
    if (h.state !== 'dive' && h.state !== 'stalk' && h.state !== 'hover') continue;
    const hx = b.x - h.x,
      hy = b.y - h.y,
      hd = Math.hypot(hx, hy) || 1;
    if (hd < 190 && h.z < HAWKZ - 0.5) {
      dvx += (hx / hd) * 320 * (1 - hd / 190);
      dvy += (hy / hd) * 320 * (1 - hd / 190);
    }
  }
  const maxS = b.panic > 0 ? 395 : st.dashT > 0 ? 480 : 305;
  const dm = Math.hypot(dvx, dvy);
  if (dm > maxS) {
    dvx *= maxS / dm;
    dvy *= maxS / dm;
  }
  const k = b.panic > 0 ? 6 : 3.5;
  b.vx += (dvx - b.vx) * Math.min(1, k * dt);
  b.vy += (dvy - b.vy) * Math.min(1, k * dt);
  const [wx, wy] = windPush(b);
  b.x += (b.vx + wx) * dt;
  b.y += (b.vy + wy) * dt;
  /* altitude layering: birds in the flock spread vertically, and dip when panicking */
  b.fz = FZ + 0.35 * Math.sin(T * 0.8 + b.ph) + (b.or - 0.5) * 0.4 - (b.panic > 0 ? 0.4 : 0);
  b.z += (b.fz - b.z) * Math.min(1, dt * 2.2);
}
function landUpdate(b, dt) {
  const p = b.perch;
  if (!p) {
    b.state = 'fly';
    return;
  }
  const dx = p.x - b.x,
    dy = p.y - b.y,
    d = Math.hypot(dx, dy) || 0.001;
  const sp = Math.min(330, 30 + d * 2.8);
  b.vx += ((dx / d) * sp - b.vx) * Math.min(1, 5 * dt);
  b.vy += ((dy / d) * sp - b.vy) * Math.min(1, 5 * dt);
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const tz = p.h + (FZ - p.h) * clamp((d - 4) / 150, 0, 1);
  b.z += (tz - b.z) * Math.min(1, dt * 6);
  if (d < 5) {
    if (p.cover && p.type === 'tree' && Math.random() < 0.7)
      for (let i = 0; i < 2; i++)
        parts.push({
          k: 'lf',
          x: p.x,
          y: p.y,
          z: p.h,
          vx: rr(-18, 18),
          vy: rr(-8, 8),
          r: rr(0, TAU),
          vr: rr(-5, 5),
          life: 1.3,
          max: 1.3,
          col: SEASON === 2 ? '#D9A640' : SEASON === 3 ? '#5E7A52' : '#7FA850'
        });
    b.state = 'perch';
    b.x = p.x;
    b.y = p.y;
    b.vx = b.vy = 0;
    b.z = p.h;
    if (p.ang != null) b.heading = p.ang + (Math.random() < 0.85 ? 0 : Math.PI);
    b.idle = rr(0.4, 2);
    if (Math.random() < 0.25 * chatter()) chirp(0.025);
  }
}
function perchUpdate(b, dt) {
  const p = b.perch;
  if (!p) {
    b.state = 'fly';
    return;
  }
  b.z = p.h;
  b.idle -= dt;
  if (b.peck > 0) b.peck -= dt;
  const grd = p.type === 'ground' || p.type === 'field';
  if (b.idle <= 0) {
    b.idle = rr(0.8, 3);
    if (grd && Math.random() < 0.6) {
      b.hx = clamp(b.hx + rr(-7, 7), -11, 11);
      b.hy = clamp(b.hy + rr(-7, 7), -11, 11);
      b.heading = rr(0, TAU);
      b.peck = 0.35;
    } else if (p.ang == null && Math.random() < 0.5) b.heading += Math.PI;
    else b.peck = 0.3;
  }
  if (st.mode === 'play') {
    const rowan = p.type === 'tree' && p.tree && p.tree.type === 'decid' && p.tree.v % 4 === 3 && SEASON >= 2;
    const rate =
      p.type === 'feeder'
        ? 0.55
        : rowan
          ? 0.12
          : grd
            ? p.type === 'field'
              ? [0.05, 0.03, 0.06, 0.006][SEASON]
              : [0.018, 0.018, 0.018, 0.003][SEASON]
            : 0;
    if (rate && Math.random() < dt * rate) {
      st.food += 1;
      st.eaten += 1;
      feed(p.type === 'feeder' ? 0.03 : 0.04);
      sparkle(b.x + b.hx, b.y + b.hy, b.z + 0.1, rowan ? '#E0503A' : '#E7C98A');
      let need = needFor(birds.length);
      while (st.food >= need) {
        st.food -= need;
        joinBird();
        need = needFor(birds.length);
      }
    }
  }
}
