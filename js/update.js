/* Flokk - update.js
   Per-frame simulation step (update).
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
// spends a small time budget stepping BG_JOB (the season-change sprite/ground rebuild, light.js) each
// frame instead of running it to completion in one. 6ms leaves the rest of the frame's own budget free.
const BG_JOB_MS = 6;
function runBgJob() {
  if (!BG_JOB) return;
  const t0 = performance.now();
  let r;
  do {
    r = BG_JOB.next();
  } while (!r.done && performance.now() - t0 < BG_JOB_MS);
  if (r.done) BG_JOB = null;
}
function update(dt) {
  T += dt;
  const playing = st.mode === 'play';
  if (playing) {
    st.play += dt;
    st.grace -= dt;
    CAL.t += dt;
    updateWeather(dt);
  }
  weatherTick(dt);
  calUpdate();
  runBgJob();
  if (TRANS.t < 1 && !BG_JOB) {
    // Reveal the incoming season only when every asset and growth stage is ready.
    TRANS.t = Math.min(1, TRANS.t + dt / 10);
    if (TRANS.t >= 1) {
      TRANS.prevG = null;
      TRANS.prevSPR = null;
    }
  }
  if (playing && CAL.season !== SEASON) {
    applySeason(CAL.season, true);
    refreshInsects();
    seasonBanner();
  }
  growTick(dt);
  airTick(dt);
  if (playing && CAL.day >= YEAR_DAYS * CAL.year + (st.dayOff || 0) && CAL.hour >= START_HOUR) {
    yearWon();
    return;
  }
  if (playing) {
    // energy: cold and flying at night cost more; roosting under cover costs less
    const nightNow = LIGHT.night > 0.5,
      roost = st.settled && L.state === 'perch' && coveredNow(L);
    let drain = 0.0062 * [1, 0.8, 1.1, 1.75][SEASON];
    if (nightNow) drain *= roost ? 0.55 : 1.35;
    // a winter storm cuts through anything but the thickest cover
    if (!roost) drain *= 1 + 0.45 * WEATHER.storm;
    st.energy = clamp(st.energy - drain * dt, 0, 1);
    // a hungry flock eats its stores before it raises more young: a little banked food at a time
    st.eatT = (st.eatT ?? 0) - dt;
    if (st.energy < 0.5 && st.food >= 0.5 && st.eatT <= 0) {
      st.eatT = 0.5;
      const bite = Math.min(1, st.food);
      st.food -= bite;
      feed(0.04 * bite);
    }
    if (st.energy <= 0.5 && st.food >= needFor(birds.length))
      teach('stores', 'a hungry flock eats its stores first: new birds come once it is fed');
    if (SEASON === 2 && CAL.day % DAYS_PER_SEASON >= 1)
      teach('autumn', 'the insects are thinning: eat well, winter has none');
    if (st.energy < 0.45) teach('hunger', 'eat insects to keep the flock fed');
    if (SEASON === 3 && st.energy < 0.8)
      teach('winter', 'no insects now: try the feeder and rowan berries, roost in spruce');
    if (st.energy <= 0) {
      st.starveT -= dt;
      if (st.starveT <= 0) {
        st.starveT = 4.5;
        starveBird();
      }
    } else st.starveT = 3;
  }
  st.dashT -= dt;
  // slow refill: one dash about every five seconds, a full bar in ~14s, so a dash is spent with care
  st.stamina = Math.min(1, st.stamina + dt * 0.07);
  st.settleCool -= dt;
  let steer = false,
    useT = false,
    ax = 0,
    ay = 0,
    tx = 0,
    ty = 0;
  if (playing) {
    const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0),
      ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    if (kx || ky) {
      steer = true;
      const l = Math.hypot(kx, ky);
      ax = kx / l;
      ay = ky / l;
    } else if (pointer.down) {
      steer = true;
      useT = true;
      const w = screenToWorld(pointer.x, pointer.y, L.z);
      tx = w.x;
      ty = w.y;
    }
  } else if (st.mode === 'title') {
    if (demo.rest > 0) {
      demo.rest -= dt;
    } else {
      steer = true;
      useT = true;
      tx = demo.tx;
      ty = demo.ty;
      if (Math.hypot(L.x - demo.tx, L.y - demo.ty) < 60 || !demo.tx) {
        if (demo.tx && Math.random() < 0.55) demo.rest = 4.5;
        for (let i = 0; i < 20; i++) {
          demo.tx = L.x + rr(-700, 700);
          demo.ty = clamp(L.y + rr(-500, 500), 400, H - 400);
          if (!inWater(demo.tx, demo.ty, 40)) break;
        }
      }
    }
  }
  if (steer && st.grounded > 0) takeoffAll();
  if (steer) st.stillT = 0;
  if (L.state === 'fly') {
    if (st.settled) {
      st.settled = false;
      st.stillT = 0;
    }
    const maxS = st.dashT > 0 ? 470 : 250;
    if (steer) {
      let dvx = 0,
        dvy = 0;
      if (useT) {
        const dx = tx - L.x,
          dy = ty - L.y,
          d = Math.hypot(dx, dy);
        if (d > 6) {
          const sp = maxS * Math.min(1, d / 160);
          dvx = (dx / d) * sp;
          dvy = (dy / d) * sp;
        }
      } else {
        dvx = ax * maxS;
        dvy = ay * maxS;
      }
      const kk = st.dashT > 0 ? 6 : 3.2;
      L.vx += (dvx - L.vx) * Math.min(1, kk * dt);
      L.vy += (dvy - L.vy) * Math.min(1, kk * dt);
    } else {
      const f = Math.exp(-2.6 * dt);
      L.vx *= f;
      L.vy *= f;
    }
    // a gale pushes the flock along with it: easy downwind, hard work flying into it
    const [wx, wy] = windPush(L);
    L.x += (L.vx + wx) * dt;
    L.y += (L.vy + wy) * dt;
    {
      const sy = shoreY(L.x) + 30;
      if (L.y > sy) {
        L.y = sy;
        L.vy = Math.min(0, L.vy);
      }
    }
    if (L.y < 40) {
      L.y = 40;
      L.vy = Math.max(0, L.vy);
    }
    if (L.y > H - 60) {
      L.y = H - 60;
      L.vy = Math.min(0, L.vy);
    }
    L.z += (FZ + terrainClearance(L.x, L.y) + 0.15 * Math.sin(T * 0.9) - L.z) * Math.min(1, dt * 2.2);
    if (!steer && Math.hypot(L.vx, L.vy) < 22) {
      st.stillT += dt;
      if (st.stillT > 0.45 && !st.settled) settle();
    }
  }
  if (L.state === 'fly' && (L.x > W + 260 || L.x < -260)) worldShift(L.x > 0 ? -W : W);
  let grounded = 0;
  for (const b of birds) {
    b.panic -= dt;
    b.landCool -= dt;
    if (b.state === 'fly' && b !== L) {
      flyUpdate(b, dt);
      if (st.settled && L.state !== 'fly' && b.panic <= 0 && b.landCool <= 0 && d2(b, L) < 420 * 420) assign(b);
    } else if (b.state === 'land') landUpdate(b, dt);
    else if (b.state === 'perch') perchUpdate(b, dt);
    else if (b.state === 'takeoff') {
      b.delay -= dt;
      if (b.delay <= 0) launch(b);
    }
    if (b.state !== 'fly') grounded++;
    if (b.state === 'fly' || b.state === 'land') {
      const sp = Math.hypot(b.vx, b.vy),
        ph0 = b.heading;
      if (sp > 12) b.heading = angLerp(b.heading, Math.atan2(b.vy, b.vx), Math.min(1, dt * 10));
      b.turn = lerp(b.turn || 0, angDiff(b.heading, ph0) / Math.max(dt, 1e-3), Math.min(1, dt * 6));
      b.bank = lerp(b.bank || 0, clamp((b.turn * sp) / 260, -1.1, 1.1), Math.min(1, dt * 6));
      const vz = (b.z - (b.pz ?? b.z)) / Math.max(dt, 1e-3);
      b.pz = b.z;
      b.pitch = lerp(
        b.pitch || 0,
        clamp(-vz * 0.35, -0.6, 0.6) + (b.state === 'land' ? -0.35 : 0),
        Math.min(1, dt * 5)
      );
      // effort against the wind: a headwind along the bird's heading (a tailwind eases it a little)
      const eff = b.state === 'fly' ? windEffort(b, b.vx, b.vy) : 0;
      b.fold = lerp(
        b.fold || 0,
        b.state === 'fly' && !b.flapping && b.panic <= 0 ? 0.6 * (1 - Math.max(0, eff)) : 0,
        Math.min(1, dt * 9)
      );
      b.fbT -= dt;
      if (b.fbT <= 0) {
        b.flapping = !b.flapping;
        // into the wind there is less gliding between bursts and the bursts run longer
        b.fbT = b.flapping ? rr(0.35, 1) * (1 + eff * 0.8) : rr(0.25, 0.8) * (1 - eff * 0.7);
      }
      if (b.flapping || b.panic > 0 || sp < 60 || b.state === 'land')
        b.flap += dt * (b.panic > 0 ? 34 : 24) * (1 + eff * 0.45);
    }
  }
  st.grounded = grounded;
  if (playing) {
    st.hawkT -= dt;
    // hawks by day, owls by night; the wrong one for the hour drifts off
    const nightNow = LIGHT.night > 0.55,
      dayNow = LIGHT.night < 0.25,
      kind = nightNow ? 'owl' : dayNow ? 'hawk' : null;
    for (const h of hawks)
      if (
        ((h.kind === 'owl' && dayNow) || (h.kind !== 'owl' && nightNow)) &&
        (h.state === 'patrol' || h.state === 'stalk')
      ) {
        h.state = 'leave';
        h.t = 0;
      }
    if (kind) {
      let active = 0;
      for (const h of hawks) if (h.kind === kind && h.state !== 'carry' && h.state !== 'leave') active++;
      let want = st.grace > 0 ? 0 : Math.min(7, Math.max(1, 1 + Math.floor((birds.length - 5) / 6)));
      // winter nights are the dangerous ones: a large flock can draw up to four owls, not two
      if (kind === 'owl') want = Math.min(SEASON === 3 ? 4 : 2, want);
      if (SEASON === 3 && kind === 'hawk') want = Math.min(2, want);
      let birdExposed = false;
      for (const b of birds)
        if (exposed(b)) {
          birdExposed = true;
          break;
        }
      if (active < want && st.hawkT <= 0 && birdExposed) {
        spawnHawk(kind);
        st.hawkT = rr(7, 13);
        // hawk or owl plays the same from the flock's side, so one shared tip rather than two
        teach('predator', 'a predator is chasing you, hide in the trees');
      }
    }
    // a white-tailed eagle: a rare, once-in-a-while sight rather than a standing threat like the
    // hawk/owl rotation above - huge, slower to commit, and much harder to shake off once it does
    st.eagleT -= dt;
    let eagleActive = false,
      birdExposed = false;
    for (const h of hawks)
      if (h.kind === 'eagle' && h.state !== 'leave') {
        eagleActive = true;
        break;
      }
    for (const b of birds)
      if (exposed(b)) {
        birdExposed = true;
        break;
      }
    if (dayNow && st.grace <= 0 && st.eagleT <= 0 && birds.length >= 3 && birdExposed && !eagleActive) {
      spawnHawk('eagle');
      st.eagleT = rr(700, 1200);
    }
  }
  for (const h of hawks) updateHawk(h, dt);
  let hawkWrite = 0;
  for (const h of hawks) if ((h.alpha ?? 1) > 0) hawks[hawkWrite++] = h;
  hawks.length = hawkWrite;
  for (const s of swarms) {
    stepSwarm(s, dt);
    if (s.moth) continue;
    s.vx += rr(-20, 20) * dt;
    s.vy += rr(-20, 20) * dt;
    s.vx = clamp(s.vx, -14, 14);
    s.vy = clamp(s.vy, -14, 14);
    s.x = wrapX(s.x + s.vx * dt);
    s.y += s.vy * dt;
    // drift back from the edges of the reachable land rather than out over the fjord
    const ym = insectMaxY(s.x);
    if (s.y > ym) {
      s.y = ym;
      s.vy = -Math.abs(s.vy);
    } else if (s.y < 60) {
      s.y = 60;
      s.vy = Math.abs(s.vy);
    }
  }
  for (const f of dflies) {
    f.t -= dt;
    if (f.t <= 0) {
      f.t = rr(0.5, 1.6);
      const a = rr(0, TAU),
        r = f.rf(a) + rr(-60, 30);
      const nx = f.c.x + Math.cos(a) * r,
        ny = f.c.y + Math.sin(a) * r;
      if (Math.hypot(nx - f.x, ny - f.y) < 260) {
        f.tx = nx;
        f.ty = ny;
      } else {
        f.tx = f.x + rr(-120, 120);
        f.ty = f.y + rr(-120, 120);
      }
    }
    const dx = f.tx - f.x,
      dy = f.ty - f.y,
      d = Math.hypot(dx, dy);
    if (d > 2) {
      const sp = Math.min(260, d * 5);
      f.x += (dx / d) * sp * dt;
      f.y += (dy / d) * sp * dt;
      f.h = Math.atan2(dy, dx);
    }
  }
  if (playing || st.mode === 'title') {
    for (const b of birds) {
      if (!(b.state === 'fly' || b.state === 'land') || b.z < 0.8) continue;
      for (const s of swarms) {
        const dx = wdx(s.x, b.x),
          dy = s.y - b.y;
        if (dx * dx + dy * dy > 2900) continue;
        for (let i = s.m.length - 1; i >= 0; i--) {
          const [mx, my, mz] = motePos(s, s.m[i]);
          const catchR = b === L ? 26 : 15;
          if (wdx(mx, b.x) ** 2 + (my - b.y) ** 2 < catchR * catchR) {
            s.m.splice(i, 1);
            if (playing) eat(1, mx, my, mz);
            else sparkle(mx, my, mz);
          }
        }
      }
      for (let i = dflies.length - 1; i >= 0; i--) {
        const f = dflies[i];
        const catchR = b === L ? 30 : 17;
        if (wdx(f.x, b.x) ** 2 + (f.y - b.y) ** 2 < catchR * catchR) {
          dflies.splice(i, 1);
          if (playing) eat(3, f.x, f.y, f.z);
        }
      }
    }
  }
  let swarmWrite = 0,
    daySwarms = 0,
    mothSwarms = 0;
  for (const s of swarms) {
    if (!s.m.length || (s.moth && LIGHT.night < 0.3)) continue;
    swarms[swarmWrite++] = s;
    if (s.moth) mothSwarms++;
    else daySwarms++;
  }
  swarms.length = swarmWrite;
  {
    // insects follow the season and the hour; moths gather at the yard lamp at night
    const nightNow = LIGHT.night > 0.5,
      want = insectTarget(),
      target = want.swarms,
      cnt = daySwarms;
    if (cnt < target && Math.random() < dt * 1.2) spawnSwarm(false);
    if (cnt > target + 3) {
      const i = swarms.findIndex(s => !s.moth && !inView(s.x, s.y, 100));
      if (i >= 0 && Math.random() < dt * 2) swarms.splice(i, 1);
    }
    if (nightNow && SEASON < 3 && LAMPS.length && mothSwarms < 2 && Math.random() < dt * 0.5) {
      const l = LAMPS[0];
      const m = [];
      for (let i = 0; i < 7; i++) m.push(mkMote('moth', rr(8, 22)));
      swarms.push({ x: l.x + rr(-10, 10), y: l.y + rr(-8, 8), vx: 0, vy: 0, z: 2.05, moth: true, m });
    }
    const dT = want.dflies;
    if (dflies.length < dT && Math.random() < dt * 0.3) spawnDfly();
    if (dflies.length > dT && Math.random() < dt) dflies.shift();
  }
  for (const p of parts) {
    p.life -= dt;
    if (p.k === 'f' || p.k === 'lf') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.z = Math.max(0, p.z - dt * 1.1);
      p.r += p.vr * dt;
    } else if (p.k === 't') p.z += dt * 0.6;
  }
  for (const p of parts) {
    if (p.k === 'w') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      p.vz -= 3.5 * dt;
    } else if (p.k === 'd') p.z += dt * 0.2;
  }
  let partWrite = 0;
  for (const p of parts) if (p.life > 0) parts[partWrite++] = p;
  parts.length = partWrite;
  updateAnimals(dt);
  animalPost(dt);
  updateTrain(dt);
  updateTraffic(dt);
  coverHint(dt);
  if (st.settled && birds.length && Math.random() < dt * Math.min(3, birds.length * 0.12) * chatter()) {
    const cb = birds[(Math.random() * birds.length) | 0];
    chirp(0.018, undefined, cb.x, cb.y);
  }
  const base = clamp(Math.min(vw, vh) / 760, 0.72, 1.15);
  // the camera pulls back as the flock grows; eased so a mid-sized flock stays close and only a
  // big one gets the full wide view (0.32 at 83+ birds, as before)
  const grow = Math.min(1, birds.length / 83);
  const zt = base * (1 - 0.32 * Math.pow(grow, 1.8));
  cam.z += (zt - cam.z) * Math.min(1, dt * 1.5);
  if (DEV && DEV.zoom) cam.z = DEV.zoom;
  const lx = L.x + L.vx * 0.35,
    ly = PY(L.y + L.vy * 0.35, L.z * 0.7);
  cam.x += (lx - cam.x) * Math.min(1, dt * 2.6);
  cam.py += (ly - cam.py) * Math.min(1, dt * 2.6);
  if (st.overT > 0) {
    st.overT -= dt;
    if (st.overT <= 0 && st.mode === 'play') gameOver();
  }
}
