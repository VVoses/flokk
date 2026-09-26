/* Flokk - wild.js
   Small wild flocks that pass through the land: starlings, linnets, fieldfares and snow buntings.
   A flock flies in from beyond the view, may wheel once or twice over a field, drops down and feeds,
   rolling across the ground as the birds at the back fly over to the front, then moves on. Hawks,
   people, cats and traffic flush it, so a flock bursting up and away is often the first sign of a hawk.
   Members live in ANIMALS (k = the species, busy so updateAnimals leaves them alone); the flock itself
   lives in WILD. Like the geese, they are kept on the camera's side of the seam.
   Plain script sharing one global scope with the other files; load order is set in index.html. */
'use strict';
// n: flock size; v: cruising speed; z: cruising height; S: spread on the ground; wheel: seconds of wheeling
// before settling; drift: how fast the feeding flock rolls forward; walk: walks rather than hops
const WILD_SP = {
  starling: {
    seasons: [0, 1, 2],
    n: [14, 30],
    v: 120,
    z: 2.4,
    S: 46,
    wheel: [4, 8],
    stay: [35, 70],
    drift: 6,
    walk: true,
    sz: 1,
    flap: 17
  },
  linnet: {
    seasons: [1, 2],
    n: [6, 14],
    v: 92,
    z: 1.8,
    S: 32,
    wheel: [0, 3],
    stay: [30, 55],
    drift: 3,
    sz: 0.8,
    flap: 19
  },
  fieldfare: {
    seasons: [0, 2, 3],
    n: [8, 18],
    v: 105,
    z: 2.7,
    S: 64,
    wheel: [0, 2],
    stay: [30, 60],
    drift: 3,
    sz: 1.15,
    flap: 13
  },
  bunting: {
    seasons: [3],
    n: [12, 26],
    v: 96,
    z: 1.6,
    S: 44,
    wheel: [3, 6],
    stay: [35, 65],
    drift: 6,
    walk: true,
    sz: 0.9,
    flap: 16
  }
};
const WILD = { t: 30, flocks: [] };
// how they look in the air (the shared 3D flier rig); bound: the dip-and-rise flight of finches and thrushes
Object.assign(LOOK, {
  starling: {
    K: 7.4,
    wing: [
      [0.16, 0.1],
      [0.2, 0.45],
      [0.08, 0.8],
      [-0.06, 1.02],
      [-0.14, 0.98],
      [-0.2, 0.78],
      [-0.24, 0.5],
      [-0.22, 0.25],
      [-0.18, 0.1]
    ],
    top: '#2B2B31',
    under: '#4C4C52',
    tip: '#18181C',
    tipF: 0.75,
    body: '#25252B',
    belly: '#3C3C42',
    head: '#222228',
    headR: 0.16,
    beak: '#D9B63C',
    beakL: 0.15,
    tail: [0.34, 0.16],
    tailCol: '#222226',
    amp: 0.7
  },
  linnet: {
    K: 6.2,
    wing: LOOK.sparrow.wing,
    top: '#8E6E52',
    under: '#DCCBB4',
    tip: '#2E2620',
    tipF: 0.7,
    body: '#9A7A5E',
    belly: '#E0CDB2',
    head: '#8A8683',
    headR: 0.18,
    beak: '#7A7672',
    beakL: 0.1,
    tail: [0.58, 0.14],
    tailCol: '#3A302A',
    amp: 0.8,
    bound: 5
  },
  fieldfare: {
    K: 8.6,
    wing: [
      [0.16, 0.1],
      [0.2, 0.42],
      [0.1, 0.78],
      [-0.04, 1.02],
      [-0.12, 1.06],
      [-0.2, 1.0],
      [-0.27, 0.86],
      [-0.3, 0.6],
      [-0.26, 0.34],
      [-0.2, 0.1]
    ],
    top: '#7C4C32',
    under: '#F2EEE6',
    tip: '#2E2622',
    tipF: 0.74,
    body: '#8A5A3C',
    belly: '#E4D2B0',
    head: '#8E949C',
    headR: 0.16,
    beak: '#C9A040',
    beakL: 0.12,
    tail: [0.62, 0.16],
    tailCol: '#221E1C',
    amp: 0.7,
    bound: 3
  },
  bunting: {
    K: 6.8,
    wing: LOOK.sparrow.wing,
    top: '#F4F2EC',
    under: '#FFFFFF',
    tip: '#1C1A18',
    tipF: 0.58,
    body: '#E8E2D6',
    belly: '#FAF8F2',
    head: '#C8A67E',
    headR: 0.17,
    beak: '#D8B060',
    beakL: 0.1,
    tail: [0.5, 0.15],
    tailCol: '#2A2622',
    amp: 0.75,
    bound: 4
  }
});
const wrapW = x => ((x % W) + W) % W;
function wildReset() {
  WILD.flocks = [];
  WILD.t = rr(20, 45);
}
function wildShift(d) {
  for (const F of WILD.flocks) {
    F.x += d;
    F.lx += d;
  }
}
// a field near the flock for a wild flock to come down on, and a spot in it (camera-side coordinates)
function wildLanding(sp, F) {
  const cand = [];
  for (const f of FIELDS) {
    if (f.t === 'sty') continue;
    const cx = f.x + f.w / 2,
      cy = f.y + f.h / 2,
      dx = wdx(cx, L.x);
    if (Math.abs(dx) > 1100 || Math.abs(cy - L.y) > 800) continue;
    // starlings follow the cattle; everyone else likes stubble and bare soil
    const w = sp === 'starling' && f.t === 'pasture' ? 3 : f.t === 'stubble' || f.t === 'plow' ? 2 : 1;
    for (let i = 0; i < w; i++) cand.push(f);
  }
  for (let k = 0; k < 8 && cand.length; k++) {
    const f = F && F.field && k < 4 ? F.field : pickP(cand);
    let p = ptIn(f, 40);
    if (F && f === F.field) {
      // resettle a little further on, not across the field
      const [x, y] = [wrapW(F.lx) + Math.cos(F.fd) * rr(90, 220), F.ly + Math.sin(F.fd) * rr(60, 160)];
      if (inField(f, wrapW(x), y, -30)) p = [wrapW(x), y];
    }
    if (!openLand(p[0], p[1]) || inWater(p[0], p[1], 40)) continue;
    return { field: f, lx: L.x + wdx(p[0], L.x), ly: p[1] };
  }
  return null;
}
function spawnWild(sp) {
  const S = WILD_SP[sp];
  const land = wildLanding(sp);
  if (!land) return null;
  const fromL = Math.random() < 0.5,
    x = fromL ? V.x0 - 260 : V.x1 + 260,
    y = land.ly + rr(-320, 320);
  const F = {
    sp,
    x,
    y,
    z: S.z,
    vx: 0,
    vy: 0,
    st: 'in',
    t: 0,
    ...land,
    fd: rr(0, TAU),
    lift: rr(10, 20),
    chk: 0,
    callT: rr(0.5, 2),
    dir: Math.random() < 0.5 ? 1 : -1,
    exit: fromL ? 0 : Math.PI,
    members: []
  };
  const n = rr(S.n[0], S.n[1]) | 0;
  for (let i = 0; i < n; i++) {
    // a denser core and a looser fringe
    const r = Math.sqrt(Math.random()) * (Math.random() < 0.8 ? 0.8 : 1.25),
      an = rr(0, TAU);
    const a = mkA(sp, x + Math.cos(an) * r * S.S * 1.4, y + Math.sin(an) * r * S.S, {
      busy: true,
      wild: F,
      st: 'fly',
      ox: Math.cos(an) * r,
      oy: Math.sin(an) * r,
      oz: rr(-0.25, 0.25),
      gx: x,
      gy: y,
      z: S.z,
      flap: rr(0, 6),
      fade: 1
    });
    F.members.push(a);
    ANIMALS.push(a);
  }
  WILD.flocks.push(F);
  return F;
}
// every bird up at once, with a whirr of wings
function wildLift(F, alarm) {
  for (const a of F.members) {
    a.st = 'fly';
    a.spot = false;
    a.graze = false;
    a.z = Math.max(a.z, 0.02);
    a.vx += rr(-40, 40);
    a.vy += rr(-40, 40);
  }
  callAt('whirr', F.x, F.y, 1);
  callAt(F.sp, F.x, F.y, alarm ? 2 : 1, F);
}
function wildLeave(F, ax, ay) {
  if (F.st === 'out') return;
  if (F.st === 'feed' || F.st === 'land') wildLift(F, ax !== undefined);
  F.st = 'out';
  // away from whatever flushed it, else on the way it was heading
  F.exit = ax !== undefined ? Math.atan2(F.y - ay, wdx(F.x, ax)) : F.exit;
}
// what sends a feeding flock up: a hawk or owl about is the end of the visit, anything else may only move it on
function wildThreat(F) {
  for (const h of hawks) {
    const dx = wdx(h.x, F.x);
    if (Math.abs(dx) < 340 && Math.abs(h.y - F.y) < 340) return ['hawk', F.x + dx, h.y];
  }
  for (let i = 0; i < 3 && F.members.length; i++) {
    const a = pickP(F.members);
    if (a.st === 'fly') continue;
    const p = threatNear(a, 60);
    if (p) return ['near', p[0], p[1]];
  }
  return null;
}
function updateWild(dt) {
  if (!L) return;
  WILD.t -= dt;
  if (WILD.t <= 0) {
    WILD.t = rr(50, 110);
    const kinds = Object.keys(WILD_SP).filter(k => WILD_SP[k].seasons.includes(SEASON));
    // no open field near enough this time: look again soon
    if (!WILD.flocks.length && kinds.length && LIGHT.night < 0.25 && !spawnWild(pickP(kinds))) WILD.t = rr(10, 20);
  }
  for (const F of WILD.flocks) wildFlock(F, dt);
  WILD.flocks = WILD.flocks.filter(F => {
    if (F.st !== 'out' || inView(F.x, F.y, 700)) return true;
    for (const a of F.members) a.life = 0;
    return false;
  });
}
function wildFlock(F, dt) {
  const S = WILD_SP[F.sp];
  F.t -= dt;
  F.chk -= dt;
  F.callT -= dt;
  const toward = (tx, ty, v, k) => {
    const dx = tx - F.x,
      dy = ty - F.y,
      d = Math.hypot(dx, dy) || 1,
      s = Math.min(v, d * k);
    F.vx += ((dx / d) * s - F.vx) * Math.min(1, dt * 1.5);
    F.vy += ((dy / d) * s - F.vy) * Math.min(1, dt * 1.5);
    return d;
  };
  let zT = S.z;
  if (F.st === 'in') {
    if (toward(F.lx, F.ly, S.v, 3) < 230) {
      F.t = rr(S.wheel[0], S.wheel[1]);
      F.st = F.t > 0.5 ? 'wheel' : 'land';
      F.ang = Math.atan2(F.y - F.ly, F.x - F.lx);
      F.R = clamp(Math.hypot(F.x - F.lx, F.y - F.ly), 80, 150);
    }
  } else if (F.st === 'wheel') {
    // circling the field, lower each time round
    F.ang += (F.dir * S.v * 0.9 * dt) / F.R;
    F.R = Math.max(60, F.R - dt * 6);
    toward(F.lx + Math.cos(F.ang) * F.R, F.ly + Math.sin(F.ang) * F.R * 0.7, S.v * 1.2, 4);
    zT = Math.max(1.1, S.z * 0.6);
    if (F.t <= 0) F.st = 'land';
  } else if (F.st === 'land') {
    toward(F.lx, F.ly, 40, 2);
    zT = 0.8;
    let down = 0;
    for (const a of F.members)
      if (!a.spot && a.st === 'fly') {
        a.spot = true;
        a.gx = F.lx + a.ox * S.S + rr(-6, 6);
        a.gy = F.ly + a.oy * S.S * 0.75 + rr(-5, 5);
      } else if (a.st !== 'fly') down++;
    if (down === F.members.length) {
      F.st = 'feed';
      F.x = F.lx;
      F.y = F.ly;
      F.vx = F.vy = 0;
      if (F.stay === undefined) F.stay = rr(S.stay[0], S.stay[1]);
    }
  } else if (F.st === 'feed') {
    // the feeding flock rolls slowly across the field
    const c = Math.cos(F.fd),
      s = Math.sin(F.fd);
    F.x += c * S.drift * dt;
    F.y += s * S.drift * dt;
    if (!inField(F.field, wrapW(F.x + c * 40), F.y + s * 40, -10)) {
      const [fx, fy] = ptIn(F.field, 40);
      F.fd = Math.atan2(fy - F.y, wdx(fx, F.x)) + rr(-0.4, 0.4);
    }
    F.lx = F.x;
    F.ly = F.y;
    F.stay -= dt;
    F.lift -= dt;
    if (F.stay <= 0 || LIGHT.night > 0.35) wildLeave(F);
    else if (F.lift <= 0) {
      // now and then the whole flock goes up for no reason anyone can see, wheels, and comes down further on
      F.lift = rr(12, 24);
      if (Math.random() < 0.3) wildRelocate(F, false);
    }
  } else if (F.st === 'out') {
    toward(F.x + Math.cos(F.exit) * 500, F.y + Math.sin(F.exit) * 500, S.v * 1.25, 3);
    zT = S.z + 0.8;
  }
  if (F.st !== 'feed') {
    F.x += F.vx * dt;
    F.y += F.vy * dt;
  }
  F.z += (zT - F.z) * Math.min(1, dt * 0.8);
  if (F.st !== 'out' && F.chk <= 0) {
    F.chk = 0.25;
    const th = wildThreat(F);
    if (th) {
      if (th[0] === 'hawk' || F.st !== 'feed' || Math.random() < 0.4) wildLeave(F, th[1], th[2]);
      else wildRelocate(F, true, th[1], th[2]);
    } else if (F.st !== 'feed' && LIGHT.night > 0.35) wildLeave(F);
  }
  if (F.callT <= 0) {
    F.callT = F.st === 'feed' ? rr(3, 8) : rr(1.5, 4);
    callAt(F.sp, F.x, F.y, 1, F);
  }
  for (const a of F.members) wildBird(a, F, S, dt);
}
function wildRelocate(F, alarm, ax, ay) {
  const land = wildLanding(F.sp, F);
  if (!land) return wildLeave(F, ax, ay);
  wildLift(F, alarm);
  Object.assign(F, land, { st: 'wheel', t: rr(2, 4), R: rr(55, 90), stay: F.stay });
  F.x = F.members.reduce((s, a) => s + a.x, 0) / F.members.length;
  F.y = F.members.reduce((s, a) => s + a.y, 0) / F.members.length;
  F.ang = Math.atan2(F.y - F.ly, F.x - F.lx);
  if (ax !== undefined) F.fd = Math.atan2(F.ly - ay, wdx(F.lx, ax));
}
function wildBird(a, F, S, dt) {
  if (a.st === 'fly') {
    a.flap += dt * S.flap;
    if (a.spot) {
      // coming down to a spot on the ground, or a short hop over the others
      const dx = a.gx - a.x,
        dy = a.gy - a.y,
        d = Math.hypot(dx, dy);
      if (d < 3) {
        a.st = 'idle';
        a.spot = false;
        a.z = 0;
        a.t = rr(0.2, 1);
        a.vx = a.vy = 0;
        return;
      }
      const v = Math.min(S.v, 30 + d * 2);
      a.vx += ((dx / d) * v - a.vx) * Math.min(1, dt * 5);
      a.vy += ((dy / d) * v - a.vy) * Math.min(1, dt * 5);
      a.z = Math.max(0, Math.min(a.z + dt * 1.2, d / 55, a.hop ? 0.45 : 9));
    } else {
      // in formation round the flock's centre; the offsets turn slowly so the flock breathes and folds
      const sw = F.st === 'out' ? 1.5 : 1.3,
        tw = a.anim * 0.35 + a.ph,
        ox = a.ox + Math.sin(tw) * 0.25,
        oy = a.oy + Math.cos(tw * 1.3) * 0.25;
      const tx = F.x + ox * S.S * sw,
        ty = F.y + oy * S.S * sw * 0.8;
      const vx = F.vx + (tx - a.x) * 2,
        vy = F.vy + (ty - a.y) * 2,
        s = Math.hypot(vx, vy),
        mx = S.v * 1.6,
        k = s > mx ? mx / s : 1;
      a.vx += (vx * k - a.vx) * Math.min(1, dt * 4);
      a.vy += (vy * k - a.vy) * Math.min(1, dt * 4);
      const dip = LOOK[a.k].bound ? Math.sin(a.anim * LOOK[a.k].bound + a.ph) * 0.12 : 0;
      a.z += (Math.max(0.3, F.z + a.oz + dip) - a.z) * Math.min(1, dt * 2);
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (Math.hypot(a.vx, a.vy) > 4) a.hd = Math.atan2(a.vy, a.vx);
    a.f = a.vx > 0 ? 1 : -1;
  } else {
    // on the ground: peck, look up, shuffle forward; the ones left at the back fly over to the front
    a.t -= dt;
    if (a.st === 'walk') {
      const dx = a.tx - a.x,
        dy = a.ty - a.y,
        d = Math.hypot(dx, dy),
        v = S.walk ? 16 : 22;
      if (d < 1.5) {
        a.st = 'idle';
        a.vx = a.vy = 0;
      } else {
        a.vx = (dx / d) * v;
        a.vy = (dy / d) * v;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
      }
    } else if (a.t <= 0) {
      const c = Math.cos(F.fd),
        s = Math.sin(F.fd),
        rx = a.x - F.x,
        ry = a.y - F.y,
        back = rx * c + ry * s;
      const r = Math.random();
      if (back < -S.S * 0.8 && r < 0.5) {
        a.st = 'fly';
        a.spot = a.hop = true;
        a.z = 0.02;
        const side = rr(-0.6, 0.6) * S.S;
        a.gx = F.x + c * S.S * rr(0.4, 0.9) - s * side;
        a.gy = F.y + s * S.S * rr(0.4, 0.9) + c * side;
      } else if (r < 0.45) {
        a.graze = true;
        a.t = rr(0.3, 1.1);
      } else if (r < 0.85) {
        a.graze = false;
        const f = rr(3, 12);
        a.tx = a.x + c * f + rr(-7, 7);
        a.ty = a.y + s * f * 0.8 + rr(-5, 5);
        a.f = a.tx > a.x ? 1 : -1;
        a.st = 'walk';
        a.t = rr(0.2, 0.8);
      } else {
        a.graze = false;
        a.t = rr(0.4, 1.4);
        if (Math.random() < 0.4) a.f = -a.f;
      }
    }
  }
  a.x = L.x + wdx(a.x, L.x);
}
/* on the ground: a small side-view bird, feet at the origin, facing +x */
function drawWildBird(a) {
  const S = WILD_SP[a.k],
    walk = a.st === 'walk',
    pk = (a.ht || 0) * 2.2;
  const hop = walk && !S.walk ? Math.abs(Math.sin(a.gp || 0)) * 1.6 : 0,
    step = walk && S.walk ? Math.sin(a.gp || 0) : 0;
  const summer = SEASON < 2;
  let back, belly, head, beak, tail, legs;
  if (a.k === 'starling') {
    back = '#25252B';
    belly = '#2E2E34';
    head = '#222228';
    beak = summer ? '#E4C23E' : '#4A4440';
    tail = '#1E1E22';
    legs = '#B8847A';
  } else if (a.k === 'linnet') {
    back = '#8E6E52';
    belly = '#E0CDB2';
    head = '#8A8683';
    beak = '#6E6A66';
    tail = '#3A302A';
    legs = '#8A6A5A';
  } else if (a.k === 'fieldfare') {
    back = '#7A4A30';
    belly = '#E8DCC2';
    head = '#8E949C';
    beak = '#C9A040';
    tail = '#2A2622';
    legs = '#6A5040';
  } else {
    back = '#9A7A5A';
    belly = '#F3F1EA';
    head = '#B08A62';
    beak = '#D8B060';
    tail = '#2A2622';
    legs = '#2A2622';
  }
  ctx.save();
  ctx.scale(S.sz, S.sz);
  ctx.translate(0, -hop);
  ctx.strokeStyle = legs;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-0.2, -2.2);
  ctx.lineTo(-0.4 + step, 0);
  ctx.moveTo(0.9, -2.2);
  ctx.lineTo(1 - step, 0);
  ctx.stroke();
  // tail
  ctx.save();
  ctx.translate(-2.6, -3.6);
  ctx.rotate(a.k === 'fieldfare' ? 0.35 : 0.2);
  ctx.fillStyle = tail;
  ctx.fillRect(a.k === 'starling' ? -2.6 : -3.8, -0.7, a.k === 'starling' ? 2.6 : 3.8, 1.4);
  ctx.restore();
  // body, tilted down while pecking; the thrush stands up tall
  ctx.save();
  ctx.translate(0, -3.8);
  ctx.rotate((a.k === 'fieldfare' ? -0.35 : -0.15) + pk * 0.12);
  ell(0, 0, 3.4, 2.2, belly);
  ell(-0.6, -0.5, 2.9, 1.6, back);
  if (a.k === 'starling') {
    ell(-0.4, -0.7, 1.6, 0.8, summer ? '#34473C' : '#3A3446'); // the oily green-purple sheen
    if (!summer) {
      ctx.fillStyle = '#E6DDC0';
      for (const [sx, sy] of [
        [1.4, 0.6],
        [0.4, 1.2],
        [-0.8, 0.9],
        [1.9, -0.2],
        [-1.6, 0.2]
      ])
        ctx.fillRect(sx, sy, 0.5, 0.5);
    }
  } else if (a.k === 'fieldfare') {
    ell(1.4, 0.4, 1.7, 1.2, '#D6A456');
    ctx.fillStyle = '#3A2E26';
    for (const [sx, sy] of [
      [1.2, 0.2],
      [2, 0.8],
      [0.6, 1],
      [1.6, 1.4]
    ])
      ctx.fillRect(sx, sy, 0.45, 0.45);
    ell(-2, -0.4, 1, 0.8, '#8E949C'); // grey rump
  } else if (a.k === 'linnet') {
    if (summer) ell(1.6, 0, 1.3, 1, '#C0584C');
  } else {
    ell(-0.2, -0.6, 1.8, 0.7, '#F8F6F0'); // the white wing patch
    ell(-1.9, -0.6, 0.9, 0.5, '#1C1A18');
  }
  ctx.restore();
  const hx = a.k === 'fieldfare' ? 3 : 2.9,
    hy = (a.k === 'fieldfare' ? -6.4 : -5.4) + pk;
  ell(hx, hy, 1.7, 1.55, head);
  if (a.k === 'linnet' && summer) ell(hx + 0.3, hy - 1.1, 0.8, 0.45, '#C0584C');
  ctx.strokeStyle = beak;
  ctx.lineWidth = a.k === 'linnet' || a.k === 'bunting' ? 1.1 : 0.9;
  ctx.beginPath();
  ctx.moveTo(hx + 1.3, hy + 0.1);
  ctx.lineTo(hx + (a.k === 'starling' ? 3.4 : 2.6), hy + 0.5 + pk * 0.15);
  ctx.stroke();
  ctx.fillStyle = '#141412';
  ctx.fillRect(hx + 0.3, hy - 0.6, 0.6, 0.6);
  ctx.restore();
}
