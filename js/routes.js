/* Shared road/lane journeys for vehicles, walkers and farm machinery. */
'use strict';
function nearestRoad(x, y) {
  if (RD.ref !== ROAD) roadInit();
  let best = null;
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1],
      b = ROAD[i];
    if (b[0] < 0 || a[0] > W) continue;
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      px = a[0] + wdx(x, a[0]),
      t = clamp(((px - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1),
      q = [a[0] + dx * t, a[1] + dy * t],
      d = Math.hypot(wdx(x, q[0]), y - q[1]);
    if (!best || d < best.d) best = { p: q, s: lerp(RD.S[i - 1], RD.S[i], t), d };
  }
  return best;
}
function accessRoad(point) {
  point = pushOut(...point, 16);
  const direct = nearestRoad(...point);
  let path = [point, direct.p],
    score = direct.d,
    road = direct;
  const field = fieldAt(wrapX(point[0]), point[1]);
  if (field && field.track) {
    const lane = field.track.network;
    path = [point, ...lane.slice().reverse()];
    road = nearestRoad(...lane[0]);
    score = -1;
  }
  for (const lane of LANES) {
    const end = lane[lane.length - 1],
      d = Math.hypot(wdx(point[0], end[0]), point[1] - end[1]);
    // A proper access lane is preferable to cutting over a field.
    if (d < score + 100 && d < 200) {
      const candidate = [point, ...lane.slice().reverse()];
      if (d < score) {
        path = candidate;
        road = nearestRoad(...lane[0]);
        score = d;
      }
    }
  }
  const routed = [path[0]];
  for (const target of path.slice(1)) {
    const last = routed[routed.length - 1],
      safe = pushOut(...target, 16),
      q = [last[0] + wdx(safe[0], last[0]), safe[1]];
    const corners = segClear(last[0], last[1], q[0], q[1]) ? [q] : navPlan(last[0], last[1], q[0], q[1]);
    if (corners) routed.push(...corners);
    else routed.push(q);
  }
  return { path: routed, s: road.s };
}
function makeJourney(from, to) {
  const a = accessRoad(from),
    b = accessRoad(to),
    delta = ((b.s - a.s + RD.P * 1.5) % RD.P) - RD.P / 2,
    roadPts = a.path.slice();
  for (let i = 1, n = Math.max(1, Math.ceil(Math.abs(delta) / 24)); i <= n; i++) {
    const p = roadAt(a.s + (delta * i) / n);
    roadPts.push([p.x, p.y]);
  }
  roadPts.push(...b.path.slice().reverse());
  // Two destinations can sit on branches of the same access road. Going all the way to the public
  // road and immediately returning along that shared stem produces the conspicuous GPS detours seen
  // around hamlets. Meet at the cheapest common waypoint instead.
  let shared = null;
  const aLen = [0],
    bLen = [0];
  for (let i = 1; i < a.path.length; i++)
    aLen.push(aLen[i - 1] + Math.hypot(wdx(a.path[i][0], a.path[i - 1][0]), a.path[i][1] - a.path[i - 1][1]));
  for (let i = 1; i < b.path.length; i++)
    bLen.push(bLen[i - 1] + Math.hypot(wdx(b.path[i][0], b.path[i - 1][0]), b.path[i][1] - b.path[i - 1][1]));
  for (let i = 0; i < a.path.length; i++)
    for (let j = 0; j < b.path.length; j++) {
      if (Math.hypot(wdx(a.path[i][0], b.path[j][0]), a.path[i][1] - b.path[j][1]) > 1) continue;
      const length = aLen[i] + bLen[j];
      if (!shared || length < shared.length) shared = { i, j, length };
    }
  const polyLength = path => {
    let length = 0;
    for (let i = 1; i < path.length; i++)
      length += Math.hypot(wdx(path[i][0], path[i - 1][0]), path[i][1] - path[i - 1][1]);
    return length;
  };
  const shortcut = shared ? [...a.path.slice(0, shared.i + 1), ...b.path.slice(0, shared.j).reverse()] : null;
  const pts = shortcut && polyLength(shortcut) + 1 < polyLength(roadPts) ? shortcut : roadPts;
  const points = [],
    lengths = [0];
  for (const p of pts) {
    const last = points[points.length - 1],
      q = [last ? last[0] + wdx(p[0], last[0]) : p[0], p[1]];
    if (last) {
      const d = Math.hypot(q[0] - last[0], q[1] - last[1]);
      if (d < 0.1) continue;
      lengths.push(lengths[lengths.length - 1] + d);
    }
    points.push(q);
  }
  const crossings = [],
    railCopies = [-W, 0, W].map(ox => RAIL.map(p => [p[0] + ox, p[1]]));
  for (let i = 1; i < points.length; i++) {
    for (const rail of railCopies) {
      const hits = findCrossings([points[i - 1], points[i]], rail);
      for (const c of hits) {
        const s = lengths[i - 1] + Math.hypot(c.x - points[i - 1][0], c.y - points[i - 1][1]);
        const built = CROSSINGS.find(o => Math.hypot(wdx(o.x, c.x), o.y - c.y) < 5);
        if (!crossings.some(o => Math.abs(o.s - s) < 3)) crossings.push({ ...c, s, underpass: !!built?.underpass });
      }
    }
  }
  return { points, lengths, length: lengths[lengths.length - 1], crossings };
}
function journeyAt(route, s) {
  if (route.points.length === 1) {
    const [x, y] = route.points[0];
    return { x, y, ang: 0 };
  }
  s = clamp(s, 0, route.length);
  let lo = 1,
    hi = route.lengths.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route.lengths[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const a = route.points[i - 1],
    b = route.points[i] || a,
    t = (s - route.lengths[i - 1]) / (route.lengths[i] - route.lengths[i - 1] || 1);
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
function crossingClosed(c) {
  if (!TRAIN || c.underpass) return false;
  const s = railSAtX(wrapX(c.x)),
    ahead = ((((s - TRAIN.s) * TRAIN.dir) % RAIL_P) + RAIL_P) % RAIL_P;
  return ahead < Math.max(TRAIN.v, TRAIN.vmax) * 5 + 50 || ahead > RAIL_P - TRAIN.tot - 40;
}
function crossingRoom(route, s, nose = 0) {
  let room = Infinity;
  for (const c of route.crossings) {
    const d = c.s - s;
    // Once committed to the deck, keep clearing it rather than stopping on the rails.
    if (d > nose + 10 && crossingClosed(c)) room = Math.min(room, Math.max(0, d - nose - 25));
  }
  return room;
}
function travelAnimal(a, route, speed, dt) {
  a.routeS ??= 0;
  const room = crossingRoom(route, a.routeS, 3),
    step = Math.min(speed * dt, room, route.length - a.routeS);
  a.routeS += Math.max(0, step);
  const p = journeyAt(route, a.routeS),
    dx = wdx(p.x, a.x),
    dy = p.y - a.y;
  a.vx = dx / Math.max(dt, 0.001);
  a.vy = dy / Math.max(dt, 0.001);
  a.x = wrapX(p.x);
  a.y = p.y;
  a.moveHeading = p.ang;
  if (Math.abs(Math.cos(p.ang)) > 0.1) a.f = Math.cos(p.ang) > 0 ? 1 : -1;
  a.st = step > 0.01 ? 'walk' : 'idle';
  return a.routeS >= route.length - 0.5;
}
function journeyDestinations() {
  const out = [];
  for (const f of FARMS) if (f.yard.gate) out.push({ name: 'farm', point: f.yard.gate });
  if (CHURCH) out.push({ name: 'church', point: CHURCH.yard.gate });
  for (const b of BUILDS) if (b.service) out.push({ name: b.service, point: b.stop });
  return out;
}
function vehicleDestinations() {
  const out = [];
  for (const f of FARMS) {
    const Y = f.yard,
      dx = wdx(Y.cx, Y.gate[0]),
      dy = Y.cy - Y.gate[1],
      d = Math.max(1, Math.hypot(dx, dy)),
      inset = Math.min(110, Math.max(0, d - 32));
    if (f.park) {
      // visitors take the free bay on the pad beside the house; the resident car rests in the other
      out.push({
        name: 'farm',
        point: f.park.bays[1],
        ang: f.park.ang,
        rest: f.park.bays[0],
        walk: frontOf(f.house),
        pad: true
      });
      continue;
    }
    out.push({
      name: 'farm',
      point: [wrapX(Y.gate[0] + (dx / d) * inset), Y.gate[1] + (dy / d) * inset],
      ang: Y.ang
    });
  }
  for (const b of BUILDS)
    if (b.service && b.stop)
      for (const point of b.parkingStops || [b.stop])
        out.push({ name: b.service, point, ang: b.parkingStops ? b.ang + Math.PI / 2 : b.ang });
  return out;
}
