/* Flokk - interact.js
   Animals noticing each other. Runs before the per-animal behaviour in updateAnimals();
   any animal with a.busy set is driven entirely from here that frame.
     - crows rise to mob a circling hawk; a mobbed hawk loses patience faster
     - the cat stalks magpies and sparrows resting on the ground, then pounces
     - the farm dog chases corvids and the cat, rushes a grounded flock, barks at trains
     - lambs follow their ewes and bleat when apart; herds and deer groups keep together
     - a startled deer sets off the rest of its group
     - drakes follow their mates and now and then chase a rival; ducks keep clear of the heron
     - in winter a magpie now and then claims the feeder, chasing any sparrows off it for a while
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';

const near2 = (a, b) => wdx(a.x, b.x) ** 2 + (a.y - b.y) ** 2;
const alive = o => o && !o.dying && ANIMALS.includes(o);
// move towards (tx,ty) at up to sp, across the seam if that is shorter; returns remaining distance
function steerA(a, tx, ty, sp, dt) {
  const walk = onFoot(a);
  if (walk && inBuild(tx, ty, NAV_M)) [tx, ty] = pushOut(tx, ty, NAV_M + 2);
  const dx = wdx(tx, a.x),
    dy = ty - a.y,
    d = Math.hypot(dx, dy);
  if (d < 2) {
    a.vx = a.vy = 0;
    return d;
  }
  const s = Math.min(sp, d * 4);
  if (walk) {
    groundStep(a, dx, dy, d, s, dt);
    return d;
  }
  a.vx = (dx / d) * s;
  a.vy = (dy / d) * s;
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  if (Math.abs(a.vx) > 1.5) a.f = a.vx > 0 ? 1 : -1;
  return d;
}
// queue a call to be heard (audio.js plays up to a few per tick, quieter with distance)
function callAt(k, x, y, n) {
  const q = LIFE.calls || (LIFE.calls = []);
  q.push({ k, x, y, n });
  if (q.length > 12) q.shift();
}
// another member of the same herd, pasture or deer group
function herdMate(a) {
  const m = ANIMALS.filter(
    o => o !== a && o.k === a.k && !o.dying && !o.lamb && (a.rect ? o.rect === a.rect : o.hx === a.hx)
  );
  return m.length ? m[(Math.random() * m.length) | 0] : null;
}
// a corvid takes off from a threat and resettles elsewhere in its patch
function shoo(o, fx, fy) {
  if (o.st === 'fly' || o.busy) return;
  let best = null,
    bd = -1;
  for (let i = 0; i < 6; i++) {
    const p = inRectPt(o.rect, 10),
      d = (p[0] - fx) ** 2 + (p[1] - fy) ** 2;
    if (d > bd) {
      bd = d;
      best = p;
    }
  }
  [o.tx, o.ty] = best;
  o.st = 'fly';
  o.z = 0.05;
  callAt(o.k, o.x, o.y, 1);
}
// every sparrow resting low near (x,y) bursts up
function scatterFlock(x, y, r) {
  let n = 0;
  for (const b of birds) {
    if (b.state !== 'perch' && b.state !== 'land') continue;
    const p = b.perch;
    if (p && p.cover) continue;
    if (p && p.h > 0.45) continue;
    if (wdx(b.x, x) ** 2 + (b.y - y) ** 2 > r * r) continue;
    if (b.state === 'land') {
      if (p && p.occ === b) p.occ = null;
      b.perch = null;
      b.state = 'fly';
    } else launch(b);
    b.panic = 1.8;
    b.landCool = 3;
    n++;
  }
  if (n) {
    flutter(n);
    if (L.state === 'fly' && st.settled) {
      takeoffAll();
      st.settleCool = 2.8;
      const dx = wdx(L.x, x) || 1,
        dy = L.y - y || 1,
        l = Math.hypot(dx, dy);
      L.vx += (dx / l) * 170;
      L.vy += (dy / l) * 170;
    }
  }
  return n;
}
// a sparrow of the player's flock sitting low enough to be hunted
const lowBird = b => (b.state === 'perch' || b.state === 'land') && b.perch && !b.perch.cover && b.perch.h < 0.45;
const nearestLowBird = (a, r) => {
  let best = null,
    bd = r * r;
  for (const b of birds) {
    if (!lowBird(b)) continue;
    const d = near2(b, a);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
};

function interact(dt) {
  for (const a of ANIMALS)
    if (a.answer > 0) {
      a.answer -= dt;
      if (a.answer <= 0) callAt('sheep', a.x, a.y, 1);
    }
  mobHawks(dt);
  feederRaids(dt);
  foxProwl(dt);
  for (const a of ANIMALS) {
    if (a.dying) continue;
    if (a.k === 'crow' && (a.st === 'mob' || a.st === 'mobret')) crowMob(a, dt);
    else if (a.k === 'magpie' && (a.st === 'raid' || a.st === 'hold' || a.st === 'leave')) magpieRaid(a, dt);
    else if (a.k === 'fox' && a.busy) foxLife(a, dt);
    else if (a.k === 'cat') catLife(a, dt);
    else if (a.k === 'dog') dogLife(a, dt);
    else if (a.k === 'sheep' && a.lamb) lambLife(a, dt);
    else if (a.k === 'deer') deerAlarm(a);
    else if (a.k === 'duck') duckLife(a, dt);
    a.pst = a.st;
  }
}

/* ---- winter: a magpie claims the feeder now and then ----
   A sparrow flock can otherwise just park at the feeder all winter without a worry; a magpie
   muscling in for a while, chasing perched sparrows off and holding the perches until it's done,
   gives the player a reason to keep checking back rather than a free ride. Never actually harms
   anything - just an inconvenience, in keeping with the rest of the game's tone. */
function feederRaids(dt) {
  if (!FEEDER) return;
  if (SEASON !== 3) {
    if (FEEDER.raider) releaseFeeder();
    return;
  }
  if (FEEDER.raider) return; // magpieRaid() is driving it this frame
  FEEDER.raidCool = (FEEDER.raidCool ?? rr(20, 40)) - dt;
  if (FEEDER.raidCool > 0) return;
  FEEDER.raidCool = rr(35, 70);
  if (LIGHT.night > 0.55) return; // magpies keep sensible hours
  if (!FEEDER.perches.some(p => p.occ)) return; // not worth the trip if no one's there
  const cand = ANIMALS.find(a => a.k === 'magpie' && !a.busy && !a.dying);
  if (!cand) return;
  cand.busy = true;
  cand.st = 'raid';
  FEEDER.raider = cand;
}
function releaseFeeder() {
  for (const p of FEEDER.perches) p.off = false;
  if (FEEDER.raider) {
    FEEDER.raider.busy = false;
    FEEDER.raider.st = 'idle';
    FEEDER.raider = null;
  }
}
function magpieRaid(a, dt) {
  a.flap += dt * 14;
  if (a.st === 'raid') {
    a.tx = FEEDER.x;
    a.ty = FEEDER.y - 3;
    if (flyTo(a, dt, 130, 1.3)) {
      // claim it: any sparrow on a feeder perch bursts off, and the perches stay off-limits a while
      for (const p of FEEDER.perches) {
        p.off = true;
        if (p.occ) {
          const b = p.occ;
          p.occ = null;
          b.perch = null;
          if (b.state !== 'fly') b.state = 'fly';
          b.panic = 1.5;
          b.landCool = 2.5;
        }
      }
      flutter(2);
      callAt('magpie', a.x, a.y, 1);
      a.st = 'hold';
      a.z = 0.05;
      a.t = rr(8, 15);
      a.idle = 0;
    }
    return;
  }
  if (a.st === 'hold') {
    a.t -= dt;
    a.idle -= dt;
    if (a.idle <= 0) {
      a.idle = rr(0.5, 1.2);
      a.hop += dt * 10;
      if (Math.random() < 0.3) callAt('magpie', a.x, a.y, 0.6);
    }
    if (a.t <= 0) {
      for (const p of FEEDER.perches) p.off = false;
      a.st = 'leave';
      [a.tx, a.ty] = inRectPt(a.rect, 10);
    }
    return;
  }
  if (a.st === 'leave') {
    if (flyTo(a, dt, 120, 1.2)) {
      a.busy = false;
      a.st = 'idle';
      FEEDER.raider = null;
    }
  }
}

/* ---- a fox tests the roost after dark ----
   Hawks make the sky risky by day; the fox does the same for the ground at night, so a flock
   that just parks on the nearest low, uncovered perch once it's dark isn't automatically safe.
   Long odds of it trying at all, a slow telegraphed creep-up with a warning call, and a real
   chance of a bird if the flock is still sitting exposed when it pounces - the same shape as a
   hawk's dive, just after sundown and on foot. Never triggers while the flock is airborne or
   tucked somewhere covered. */
function foxProwl(dt) {
  const fox = ANIMALS.find(a => a.k === 'fox' && !a.dying);
  if (!fox || fox.busy) return;
  LIFE.foxCool = (LIFE.foxCool ?? rr(35, 60)) - dt;
  if (LIFE.foxCool > 0) return;
  LIFE.foxCool = rr(50, 95);
  if (LIGHT.night < 0.35) return; // stays denned until well after dusk
  if (!st.settled || !L || L.state === 'fly' || !exposed(L) || L.perch.h > 0.5) return;
  if (near2(fox, L) > 520 * 520) return;
  fox.busy = true;
  fox.st = 'stalk';
  fox.t = rr(9, 14);
  callAt('fox', fox.x, fox.y, 1);
}
function foxLife(a, dt) {
  if (a.st === 'stalk') {
    a.t -= dt;
    if (!st.settled || !L || L.state === 'fly' || !exposed(L) || a.t <= 0) {
      a.st = 'walk';
      a.t = rr(4, 7);
      [a.tx, a.ty] = [a.hx, a.hy];
      return;
    }
    // creep, freeze, creep - the same cadence the cat uses, just slower and more patient
    if (Math.sin(T * 0.9 + a.ph * 5) > -0.25) {
      const d = steerA(a, a.x + wdx(L.x, a.x), L.y, 24, dt);
      if (d < 38) {
        a.st = 'pounce';
        a.t = 0.6;
        a.px = a.x + wdx(L.x, a.x);
        a.py = L.y;
        callAt('fox', a.x, a.y, 1.3);
      }
    } else a.vx = a.vy = 0;
    return;
  }
  if (a.st === 'pounce') {
    a.t -= dt;
    const d = steerA(a, a.px, a.py, 150, dt);
    if (a.t <= 0 || d < 5) {
      let best = null,
        bd = 60 * 60;
      for (const b of birds) {
        if (b.state === 'fly' || !exposed(b)) continue;
        const q = near2(a, b);
        if (q < bd) {
          bd = q;
          best = b;
        }
      }
      if (best && Math.random() < 0.55) foxCatch(a, best);
      else {
        scatterFlock(a.x, a.y, 150);
        takeoffAll();
      }
      a.st = 'walk';
      a.t = rr(5, 9);
      [a.tx, a.ty] = [a.hx, a.hy];
    }
    return;
  }
  // heading home
  a.t -= dt;
  if (walkTo(a, dt, 55) || a.t <= 0) {
    a.busy = false;
    a.st = 'idle';
    a.t = rr(3, 6);
  }
}
function foxCatch(a, b) {
  const i = birds.indexOf(b);
  if (i < 0) return;
  birds.splice(i, 1);
  if (b.perch && b.perch.occ === b) b.perch.occ = null;
  st.lost++;
  feathers(b.x, b.y, b.z, b.c2);
  thud();
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

/* ---- crows mob hawks ---- */
function mobHawks(dt) {
  for (const h of hawks) {
    h.mobCool = (h.mobCool ?? rr(4, 10)) - dt;
    if (h.mobCool > 0 || (h.state !== 'patrol' && h.state !== 'stalk')) continue;
    const cand = ANIMALS.filter(
      a => a.k === 'crow' && !a.busy && !a.dying && a.st !== 'fly' && near2(a, h) < 700 * 700
    ).sort((p, q) => near2(p, h) - near2(q, h));
    h.mobCool = rr(22, 40);
    if (!cand.length) continue;
    for (const a of cand.slice(0, 3)) {
      a.busy = true;
      a.st = 'mob';
      a.mobH = h;
      a.mobT = rr(8, 13);
      a.ma = rr(0, TAU);
      a.z = Math.max(a.z, 0.05);
    }
    callAt('crow', cand[0].x, cand[0].y, 3);
  }
}
function crowMob(a, dt) {
  a.flap += dt * 15;
  if (a.st === 'mobret') {
    // glide home and come down before handing back to the normal crow behaviour
    const d = steerA(a, a.tx, a.ty, 120, dt);
    a.hd = Math.atan2(a.vy, a.vx);
    a.z += (Math.min(1.2, d / 70) - a.z) * Math.min(1, dt * 0.9);
    if (a.z < 1.3) {
      a.st = 'fly';
      a.busy = false;
    }
    return;
  }
  const h = a.mobH;
  a.mobT -= dt;
  if (!h || !hawks.includes(h) || h.state === 'dive' || h.state === 'leave' || h.state === 'carry' || a.mobT <= 0) {
    a.st = 'mobret';
    a.mobH = null;
    [a.tx, a.ty] = inRectPt(a.rect, 10);
    a.tx = a.x + wdx(a.tx, a.x);
    return;
  }
  a.ma += dt * (1.5 + (a.ph % 1));
  const r = 24 + 12 * Math.sin(a.ma * 1.7);
  const tx = h.x - Math.cos(h.psi) * 18 + Math.cos(a.ma) * r,
    ty = h.y - Math.sin(h.psi) * 18 + Math.sin(a.ma) * r * 0.8;
  const dx = wdx(tx, a.x),
    dy = ty - a.y,
    d = Math.hypot(dx, dy) || 1,
    sp = Math.min(270, 70 + d * 2.4);
  a.vx += ((dx / d) * sp - a.vx) * Math.min(1, dt * 3);
  a.vy += ((dy / d) * sp - a.vy) * Math.min(1, dt * 3);
  a.x += a.vx * dt;
  a.y += a.vy * dt;
  a.hd = Math.atan2(a.vy, a.vx);
  a.f = a.vx > 0 ? 1 : -1;
  a.z += (h.z - 0.3 + 0.25 * Math.sin(a.ma * 2) - a.z) * Math.min(1, dt * 1.1);
  a.cawT = (a.cawT ?? rr(0.4, 1.5)) - dt;
  if (a.cawT <= 0) {
    a.cawT = rr(1.2, 3);
    callAt('crow', a.x, a.y, 1);
  }
  if (near2(a, h) < 70 * 70 && Math.abs(a.z - h.z) < 0.8) {
    // close enough to pester: the hawk jinks, loses patience and cannot line up an attack
    h.bored += dt * 0.9;
    h.cool = Math.max(h.cool, 0.8);
    h.turn += Math.sin(T * 6 + a.ph * 3) * dt * 3;
    h.tcx += wdx(h.x, a.x) * dt * 0.8;
    h.tcy += (h.y - a.y) * dt * 0.8;
  }
}

/* ---- the farm cat ---- */
function catLife(a, dt) {
  if (!a.busy) {
    // looking for something to hunt now and then
    a.hunt = (a.hunt ?? rr(3, 7)) - dt;
    if (a.hunt > 0) return;
    a.hunt = rr(4, 9);
    let best = null,
      bd = 1e9;
    for (const o of ANIMALS)
      if (o.k === 'magpie' && o.st !== 'fly' && !o.busy && !o.dying) {
        const d = near2(o, a);
        if (d < 180 * 180 && d < bd) {
          bd = d;
          best = o;
        }
      }
    for (const b of birds) {
      if (!lowBird(b)) continue;
      const d = near2(b, a);
      if (d < 240 * 240 && d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best && Math.random() < 0.8) {
      a.busy = true;
      a.st = 'stalk';
      a.prey = best;
      a.t = rr(10, 15);
      a.graze = false;
    }
    return;
  }
  if (birds.includes(a.prey) && !lowBird(a.prey)) a.prey = nearestLowBird(a, 220) || a.prey; // the sparrows shuffle about; keep after the nearest
  const p = a.prey,
    isBird = birds.includes(p);
  if (a.st === 'flee') {
    a.t -= dt;
    const d = steerA(a, a.tx, a.ty, 72, dt);
    if (a.t <= 0 || d < 4) {
      a.st = 'idle';
      a.busy = false;
      a.t = rr(5, 10);
    }
    return;
  }
  const valid = isBird ? lowBird(p) : alive(p) && p.st !== 'fly';
  if (a.st === 'stalk') {
    a.t -= dt;
    if (!valid || a.t <= 0) {
      a.st = 'walk';
      a.busy = false;
      [a.tx, a.ty] = inRectPt(a.rect, 25);
      return;
    }
    const px = a.x + wdx(p.x, a.x),
      py = p.y;
    // creep, freeze, creep
    if (Math.sin(T * 1.4 + a.ph * 5) > -0.35) {
      const d = steerA(a, px, py, 20, dt);
      if (d < 42) {
        a.st = 'pounce';
        a.t = 0.5;
        a.px = px;
        a.py = py;
      }
    } else {
      a.vx = a.vy = 0;
    }
    if (!isBird && near2(a, p) < 85 * 85 && Math.random() < dt * 0.9)
      shoo(p, a.x, a.y); // the magpie spots it first
    else if (!isBird && Math.random() < dt * 0.5) callAt('magpie', p.x, p.y, 1); // and scolds
    return;
  }
  if (a.st === 'pounce') {
    a.t -= dt;
    const d = steerA(a, a.px, a.py, 100, dt);
    if (a.t <= 0 || d < 4) {
      // never quite catches anything
      if (isBird) scatterFlock(a.x, a.y, 95);
      else if (alive(p)) shoo(p, a.x, a.y);
      a.st = 'idle';
      a.busy = false;
      a.t = rr(5, 11);
      a.prey = null;
    }
  }
}

/* ---- the farm dog ---- */
function dogLife(a, dt) {
  a.busy = true;
  // whistled for: trot along at the farmer's heel for a while
  if (a.follow && a.st !== 'chase') {
    const f = a.follow;
    a.followT -= dt;
    if (!alive(f) || f.hide || a.followT <= 0) a.follow = null;
    else {
      const tx = f.x - (f.fs ?? f.f) * 16,
        ty = f.y + 6,
        d = Math.hypot(wdx(tx, a.x), ty - a.y);
      if (d > 8) {
        a.st = 'walk';
        steerA(a, tx, ty, d > 60 ? 60 : 22, dt);
      } else {
        a.st = 'idle';
        a.vx = a.vy = 0;
        a.f = f.f;
      }
      return;
    }
  }
  const Y = a.rect,
    cx = Y.x + Y.w / 2,
    cy = Y.y + Y.h / 2,
    far = Math.hypot(wdx(a.x, cx), a.y - cy);
  a.brain = (a.brain || 0) - dt;
  a.barkT = (a.barkT || 0) - dt;
  const bark = () => {
    if (a.barkT <= 0) {
      a.barkT = rr(0.8, 1.6);
      callAt('dog', a.x, a.y, 1);
    }
  };
  a.rest = (a.rest || 0) - dt;
  if (a.st === 'chase') {
    a.t -= dt;
    const p = a.prey,
      isBird = birds.includes(p);
    const ok = isBird
      ? lowBird(p)
      : alive(p) && p.st !== 'fly' && !(p.k === 'cat' && p.st === 'flee' && near2(a, p) > 160 * 160);
    if (!ok || a.t <= 0 || far > 520) {
      a.st = 'walk';
      a.prey = null;
      a.rest = rr(7, 16);
      a.tx = cx + rr(-90, 90);
      a.ty = cy + rr(-110, 110);
      return;
    }
    const d = steerA(a, a.x + wdx(p.x, a.x), p.y, 80, dt);
    if (Math.random() < dt * 1.1) bark();
    if (d < 60) {
      if (isBird) {
        scatterFlock(p.x, p.y, 130);
        a.t = Math.min(a.t, 0.6);
      } else if (p.k === 'cat') {
        if (p.st !== 'flee') {
          p.busy = true;
          p.st = 'flee';
          p.t = rr(1.4, 2.2);
          const dx = wdx(p.x, a.x) || 1,
            dy = p.y - a.y || 1,
            l = Math.hypot(dx, dy);
          p.tx = p.x + (dx / l) * 150;
          p.ty = p.y + (dy / l) * 110;
        }
      } else shoo(p, a.x, a.y);
    }
    return;
  }
  if (a.st === 'bark') {
    a.t -= dt;
    a.vx = a.vy = 0;
    if (a.face) a.f = wdx(a.face.x, a.x) > 0 ? 1 : -1;
    bark();
    if (a.t <= 0) {
      a.st = 'idle';
      a.t = rr(2, 5);
    }
    return;
  }
  if (a.st === 'walk') {
    a.graze = Math.sin(T * 0.9 + a.ph) > 0.55;
    if (steerA(a, a.tx, a.ty, a.graze ? 16 : 34, dt) < 4) {
      a.st = 'idle';
      a.t = rr(3, 9);
      a.graze = false;
    }
  } else {
    a.vx = a.vy = 0;
    a.t -= dt;
    a.graze = false;
    if (a.t <= 0) {
      a.st = 'walk';
      a.tx = cx + rr(-Y.w * 0.5 - 80, Y.w * 0.5 + 80);
      a.ty = cy + rr(-Y.h * 0.5 - 80, Y.h * 0.5 + 80);
    }
  }
  if (a.brain > 0) return;
  a.brain = 0.5;
  // a train going by gets a volley from the edge of the yard
  if (TRAIN && TRAIN.cars.some(c => near2(c, a) < 650 * 650) && a.barked !== TRAIN) {
    a.barked = TRAIN;
    a.st = 'bark';
    a.t = rr(2.5, 3.5);
    a.face = TRAIN.cars[0];
    return;
  }
  if (far > 380 || a.rest > 0) return;
  let best = null,
    bd = 1e9;
  for (const o of ANIMALS) {
    if (o.dying || (o.busy && o.k !== 'cat')) continue;
    if ((o.k === 'crow' || o.k === 'magpie') && o.st !== 'fly') {
      const d = near2(o, a);
      if (d < 250 * 250 && d < bd) {
        bd = d;
        best = o;
      }
    } else if (o.k === 'cat' && o.st !== 'flee' && Math.random() < 0.15) {
      const d = near2(o, a);
      if (d < 200 * 200 && d < bd) {
        bd = d;
        best = o;
      }
    }
  }
  for (const b of birds) {
    if (!lowBird(b)) continue;
    const d = near2(b, a);
    if (d < 320 * 320 && d < bd) {
      bd = d;
      best = b;
    }
  }
  if (best && Math.random() < 0.45) {
    a.st = 'chase';
    a.prey = best;
    a.t = rr(2.5, 4);
    bark();
  }
}

/* ---- sheep: lambs keep close to their ewe ---- */
function lambLife(a, dt) {
  if (!alive(a.mom)) {
    a.mom = herdMate(a);
    if (!a.mom) return;
  }
  const d = Math.sqrt(near2(a, a.mom));
  a.bleat = (a.bleat ?? rr(4, 12)) - dt;
  if (d > 70 && a.bleat <= 0) {
    a.bleat = rr(9, 18);
    callAt('lamb', a.x, a.y, 1);
    if (Math.random() < 0.6) a.mom.answer = rr(0.5, 1);
  }
  if (d > 45 && a.st !== 'walk') {
    a.tx = a.mom.x + rr(-14, 14);
    a.ty = a.mom.y + rr(-10, 10);
    if (inField(a.rect, a.tx, a.ty, -12)) a.st = 'walk';
  }
}

/* ---- deer: one bolts, the group follows ---- */
function deerAlarm(a) {
  if (a.st !== 'flee' || a.pst === 'flee') return;
  for (const o of ANIMALS)
    if (o !== a && o.k === 'deer' && o.hx === a.hx && o.st !== 'flee' && near2(o, a) < 260 * 260) {
      o.st = 'flee';
      o.t = rr(2, 3.2);
      const j = rr(-0.4, 0.4),
        c = Math.cos(j),
        s = Math.sin(j);
      o.fx = a.fx * c - a.fy * s;
      o.fy = a.fx * s + a.fy * c;
    }
}

/* ---- ducks: pairs, squabbles, and a wary eye on the heron ---- */
function duckLife(a, dt) {
  if (a.st === 'chase' || a.st === 'flee') {
    a.t -= dt;
    const o = a.foe;
    if (!alive(o) || a.t <= 0) {
      a.st = 'idle';
      a.busy = false;
      a.t = rr(2, 5);
      return;
    }
    let tx = o.x,
      ty = o.y;
    if (a.st === 'flee') {
      tx = a.x + (a.x - o.x);
      ty = a.y + (a.y - o.y);
    }
    if (!inBlob(tx, ty, a.pool, a.prf, -15)) {
      tx = a.pool.x;
      ty = a.pool.y;
    }
    steerA(a, tx, ty, a.st === 'chase' ? 48 : 44, dt);
    a.splash = (a.splash || 0) - dt;
    if (a.splash <= 0) {
      a.splash = 0.22;
      RINGS.push({ x: a.x, y: a.y, t: 0.6 });
    }
    return;
  }
  if (a.busy) return;
  a.look = (a.look ?? rr(0, 1)) - dt;
  if (a.look > 0) return;
  a.look = rr(0.6, 1.2);
  const heron = ANIMALS.find(o => o.k === 'heron' && o.st !== 'fly' && near2(o, a) < 80 * 80);
  if (heron && a.st !== 'dive') {
    const dx = a.x - heron.x,
      dy = a.y - heron.y,
      l = Math.hypot(dx, dy) || 1;
    const tx = a.x + (dx / l) * 90,
      ty = a.y + (dy / l) * 70;
    if (inBlob(tx, ty, a.pool, a.prf, -20)) {
      a.tx = tx;
      a.ty = ty;
      a.st = 'walk';
    }
    return;
  }
  if (a.drake && alive(a.mate) && a.st === 'idle' && near2(a, a.mate) > 40 * 40 && Math.random() < 0.7) {
    a.tx = a.mate.x + rr(-12, 12);
    a.ty = a.mate.y + rr(-10, 10);
    if (inBlob(a.tx, a.ty, a.pool, a.prf, -15)) a.st = 'walk';
    return;
  }
  if (a.drake && Math.random() < 0.025) {
    const rival = ANIMALS.find(
      o =>
        o !== a &&
        o.k === 'duck' &&
        o.drake &&
        o.pool === a.pool &&
        !o.busy &&
        o.st !== 'dive' &&
        near2(o, a) < 160 * 160
    );
    if (rival) {
      a.busy = rival.busy = true;
      a.st = 'chase';
      rival.st = 'flee';
      a.foe = rival;
      rival.foe = a;
      a.t = rival.t = rr(1.4, 2.2);
      callAt('duck', a.x, a.y, 1);
    }
  }
}
