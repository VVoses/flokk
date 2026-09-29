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
    pts = a.path.slice();
  for (let i = 1, n = Math.max(1, Math.ceil(Math.abs(delta) / 24)); i <= n; i++) {
    const p = roadAt(a.s + (delta * i) / n);
    pts.push([p.x, p.y]);
  }
  pts.push(...b.path.slice().reverse());
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
  const crossings = [];
  for (let i = 1; i < points.length; i++) {
    for (const ox of [-W, 0, W]) {
      const hits = findCrossings(
        [points[i - 1], points[i]],
        RAIL.map(p => [p[0] + ox, p[1]])
      );
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
  s = clamp(s, 0, route.length);
  let i = 1;
  while (i < route.lengths.length - 1 && route.lengths[i] < s) i++;
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
  const out = FARMS.map(f => ({ name: 'farm', point: f.yard.gate }));
  if (CHURCH) out.push({ name: 'church', point: CHURCH.yard.gate });
  for (const b of BUILDS) if (b.service) out.push({ name: b.service, point: b.stop });
  return out.filter(d => d.point);
}
