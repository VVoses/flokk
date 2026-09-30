/* A parish with soft regional boundaries and small, functioning roadside services. */
'use strict';
let REGIONS = [];
function regionWeights(x, y) {
  const lake = clamp(1 - Math.hypot(wdx(x, LAKE.x), y - LAKE.y) / (LAKE.r + 520), 0, 1),
    highland = 1 - smooth(380, 1100, y),
    town = REGIONS.find(r => r.kind === 'town'),
    settlement = town ? clamp(1 - Math.hypot(wdx(x, town.x), y - town.y) / 420, 0, 1) : 0;
  return { lake, highland, town: settlement, valley: Math.max(0, 1 - Math.max(lake, highland, settlement)) };
}
function regionAt(x, y) {
  const weights = regionWeights(x, y);
  return Object.keys(weights).reduce((best, k) => (weights[k] > weights[best] ? k : best), 'valley');
}
function placeServices() {
  REGIONS = [
    { kind: 'lake', x: LAKE.x, y: LAKE.y },
    { kind: 'highland', x: W / 2, y: 350 },
    { kind: 'valley', x: FARMS[0].cx, y: FARMS[0].cy }
  ];
  for (const service of ['farmstore', 'fuel']) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = rnd(220, W - 220),
        p = ROAD.reduce((best, q) => (Math.abs(q[0] - x) < Math.abs(best[0] - x) ? q : best)),
        ang = roadAng(p[0], 80),
        side = R() < 0.5 ? -1 : 1,
        nx = -Math.sin(ang) * side,
        ny = Math.cos(ang) * side,
        cx = p[0] + nx * 112,
        cy = p[1] + ny * 112,
        stop = [p[0] + nx * 63, p[1] + ny * 63];
      let clear = true;
      for (let dx = -65; dx <= 65; dx += 13)
        for (let dy = -48; dy <= 48; dy += 12) {
          const xx = cx + dx,
            yy = cy + dy;
          if (
            inWater(xx, yy, 25) ||
            inBuild(xx, yy, 28) ||
            railDist(xx, yy) < 60 ||
            roadDist(xx, yy) < 36 ||
            FIELDS.some(f => inField(f, xx, yy, 15)) ||
            YARDS.some(y => inYard(y, xx, yy, 15))
          )
            clear = false;
        }
      if (!clear || cy < NORTH || cy > H - 250) continue;
      const b = {
        cx,
        cy,
        ang: ang + (side > 0 ? Math.PI : 0),
        len: service === 'fuel' ? 66 : 88,
        dep: 42,
        wh: 23,
        rh: service === 'fuel' ? 29 : 43,
        roof: service === 'fuel' ? 'metal' : 'slate',
        wall: service === 'fuel' ? '#D8D3C5' : '#854A35',
        windows: true,
        kind: 'house',
        service,
        stop
      };
      BUILDS.push(b);
      LANES.push([p.slice(), stop]);
      if (service === 'farmstore') REGIONS.push({ kind: 'town', x: cx, y: cy });
      break;
    }
  }
  // The town is a small roadside hamlet, keeping the wider parish quiet.
  const town = REGIONS.find(r => r.kind === 'town');
  if (town)
    for (let i = 0; i < 3; i++) {
      for (let attempt = 0; attempt < 100; attempt++) {
        const cx = wrapX(town.x + rnd(-280, 280)),
          cy = town.y + rnd(-220, 220);
        if (
          cy < NORTH ||
          cy > H - 220 ||
          inWater(cx, cy, 90) ||
          inBuild(cx, cy, 90) ||
          railDist(cx, cy) < 110 ||
          roadDist(cx, cy) < 80 ||
          roadDist(cx, cy) > 200 ||
          FIELDS.some(f => inField(f, cx, cy, 65)) ||
          YARDS.some(y => inYard(y, cx, cy, 65))
        )
          continue;
        const b = {
          cx,
          cy,
          ang: roadAng(cx),
          len: 64,
          dep: 40,
          wh: 24,
          rh: 43,
          roof: 'slate',
          wall: ['#D8D2C2', '#A15B48', '#A4B1AD'][i],
          kind: 'house',
          windows: true,
          chimney: true
        };
        const door = frontOf(b),
          road = ROAD.reduce((best, q) =>
            Math.hypot(wdx(q[0], door[0]), q[1] - door[1]) < Math.hypot(wdx(best[0], door[0]), best[1] - door[1])
              ? q
              : best
          );
        let clear = true;
        for (let k = 0; k <= 12; k++) {
          const t = k / 12,
            x = road[0] + wdx(door[0], road[0]) * t,
            y = lerp(road[1], door[1], t);
          if (inWater(x, y, 12) || inBuild(x, y, 8) || FIELDS.some(f => inField(f, x, y, 5))) clear = false;
        }
        if (!clear) continue;
        BUILDS.push(b);
        LANES.push([road.slice(), door]);
        break;
      }
    }
  for (const b of BUILDS) b.region = regionAt(b.cx, b.cy);
  for (const f of FIELDS) f.region = regionAt(f.x + f.w / 2, f.y + f.h / 2);
}
// Square up a farm access at the track rather than laying a long plank strip along it.
function squareLaneCrossings(P) {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1],
      b = P[i],
      hits = findCrossings([a, b], RAIL);
    for (const c of hits) {
      if (Math.abs(Math.sin(c.ang - c.rang)) >= 0.55) continue;
      const sign = Math.sin(c.ang - c.rang) >= 0 ? 1 : -1,
        nx = -Math.sin(c.rang) * sign,
        ny = Math.cos(c.rang) * sign;
      out.push([c.x - nx * 48, c.y - ny * 48], [c.x + nx * 48, c.y + ny * 48]);
    }
    out.push(b);
  }
  return out;
}

let FIELD_TRACKS = [];
// Keep a route in one copy of the wrapped world. A point near x=0 may be only a
// few metres from one near x=W; storing their canonical coordinates directly
// would draw (and drive) a full-width segment between them.
function continuousPath(points) {
  if (!points.length) return [];
  const out = [points[0].slice()];
  for (const p of points.slice(1)) {
    const prev = out[out.length - 1];
    out.push([prev[0] + wdx(p[0], prev[0]), p[1]]);
  }
  return out;
}
function countryCurve(a, b, salt = 0) {
  const end = [a[0] + wdx(b[0], a[0]), b[1]],
    dx = end[0] - a[0],
    dy = end[1] - a[1],
    d = Math.hypot(dx, dy) || 1,
    nx = -dy / d,
    ny = dx / d,
    bend = clamp(d * 0.07, 7, 48) * (hash2(a[0] * 0.02 + salt, a[1] * 0.02) < 0.5 ? -1 : 1),
    p1 = [lerp(a[0], end[0], 0.34) + nx * bend, lerp(a[1], end[1], 0.34) + ny * bend],
    p2 = [lerp(a[0], end[0], 0.68) + nx * bend * 0.45, lerp(a[1], end[1], 0.68) + ny * bend * 0.45];
  return continuousPath(catmull([a, p1, p2, end]));
}
function trackClear(a, b, field) {
  const dx = wdx(b[0], a[0]),
    dy = b[1] - a[1],
    n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
  for (let i = 0; i <= n; i++) {
    const x = wrapX(a[0] + (dx * i) / n),
      y = a[1] + (dy * i) / n;
    const crossesField = FIELDS.some(
        f => f !== field && inField(f, x, y, 8) && !(f.farm === field.farm && f.poly && edgeDist(f.poly, x, y) < 30)
      ),
      crossesYard = YARDS.some(yard => inYard(yard, x, y, 3));
    if (inWater(x, y, 18) || inBuild(x, y, 15) || crossesField || crossesYard) return false;
  }
  return true;
}
function trackPathClear(path, field) {
  for (let i = 1; i < path.length; i++) if (!trackClear(path[i - 1], path[i], field)) return false;
  return true;
}
function buildFieldTracks() {
  FIELD_TRACKS = [];
  const sources = ROAD.filter((p, i) => p[0] >= 0 && p[0] < W && i % 2 === 0).map(p => ({ p, prefix: [p] }));
  const registerTrack = track => {
    for (let i = 2; i < track.network.length; i += 3)
      sources.push({ p: track.network[i], prefix: track.network.slice(0, i + 1) });
  };
  for (const lane of LANES)
    for (let i = 0; i < lane.length; i += 2) sources.push({ p: lane[i], prefix: lane.slice(0, i + 1) });
  for (const f of FIELDS) {
    if (f.t === 'sty') continue;
    const poly = f.poly,
      candidates = [];
    for (let i = 0; i < poly.length; i += Math.max(1, Math.floor(poly.length / 24))) {
      const p = poly[i],
        center = [f.x + f.w / 2, f.y + f.h / 2],
        dx = center[0] - p[0],
        dy = center[1] - p[1],
        d = Math.hypot(dx, dy) || 1,
        gate = [p[0] + (dx / d) * 12, p[1] + (dy / d) * 12];
      for (const source of sources) {
        const distance = Math.hypot(wdx(source.p[0], gate[0]), source.p[1] - gate[1]);
        if (distance < 2700) candidates.push({ gate, edge: p.slice(), source, distance });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const c of candidates) {
      const path = countryCurve(c.source.p, c.gate, f.x + f.y);
      if (!trackPathClear(path, f)) continue;
      const crosses = findCrossings(path, RAIL);
      if (crosses.some(x => Math.abs(Math.sin(x.ang - x.rang)) < 0.55)) continue;
      f.gate = c.gate;
      f.gateEdge = c.edge;
      f.track = { path, network: continuousPath([...c.source.prefix, ...path.slice(1)]) };
      FIELD_TRACKS.push(f.track);
      registerTrack(f.track);
      break;
    }
    if (!f.track && candidates.length) {
      // Nearby vertices can all face the same blocked neighbour. Try enough of
      // the field perimeter to find a practical gate on irregular layouts.
      const gateCandidates = [];
      for (const candidate of candidates)
        if (
          !gateCandidates.some(c => Math.hypot(wdx(c.gate[0], candidate.gate[0]), c.gate[1] - candidate.gate[1]) < 20)
        )
          gateCandidates.push(candidate);
      for (const candidate of gateCandidates.slice(0, 16)) {
        const track = indirectTrack(candidate.gate, f, sources);
        if (!track) continue;
        f.track = track;
        f.gate = candidate.gate;
        f.gateEdge = candidate.edge;
        FIELD_TRACKS.push(track);
        registerTrack(track);
        break;
      }
    }
  }
  FIELD_GATES = FIELDS.filter(f => f.gateEdge).map(f => {
    const c = f.gateEdge;
    let best = null;
    for (let i = 0; i < f.poly.length; i++) {
      const a = f.poly[i],
        b = f.poly[(i + 1) % f.poly.length],
        d = segDist(c[0], c[1], a[0], a[1], b[0], b[1]);
      if (!best || d < best.d) best = { a, b, d };
    }
    const dx = best.b[0] - best.a[0],
      dy = best.b[1] - best.a[1],
      d = Math.hypot(dx, dy) || 1,
      ux = dx / d,
      uy = dy / d,
      p = { x: c[0] - ux * 9, y: c[1] - uy * 9 },
      q = { x: c[0] + ux * 9, y: c[1] + uy * 9 };
    return { p, q, k: Math.max(p.y, q.y), field: f };
  });
}

// Routing lanes keep their shared trunk as a prefix. Painting those complete routes would draw that
// prefix once per destination and make a junction look like several roads stacked on top of each other.
// Paint each trunk once, then only the unique tail of each branch. The road-end trim stops gravel from
// running over the public-road surface while its round cap still meets the verge cleanly.
function accessPaintPaths() {
  const same = (a, b) => Math.hypot(wdx(a[0], b[0]), a[1] - b[1]) < 0.5;
  const trimRoadEnd = path => {
    let i = 0;
    while (i < path.length - 1 && roadDist(wrapX(path[i][0]), path[i][1]) < 13) i++;
    return path.slice(i);
  };
  const out = ACCESS_TRUNKS.map(trimRoadEnd).filter(p => p.length > 1);
  for (const lane of LANES) {
    let cut = 0;
    for (const trunk of ACCESS_TRUNKS) {
      let i = 0;
      while (i < lane.length && i < trunk.length && same(lane[i], trunk[i])) i++;
      if (i > cut) cut = i;
    }
    const unique = cut > 1 ? lane.slice(cut - 1) : trimRoadEnd(lane);
    if (unique.length > 1) out.push(unique);
  }
  return out;
}

// A short path around neighbouring plots for fields without a direct roadside frontage.
function indirectTrack(gate, field, sources) {
  const targets = sources
    .map(s => ({ ...s, d: Math.hypot(wdx(s.p[0], gate[0]), s.p[1] - gate[1]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 24);
  const grid = 24,
    nodes = new Map(),
    heap = [];
  const heuristic = p => Math.min(...targets.map(t => Math.hypot(wdx(t.p[0], p[0]), t.p[1] - p[1])));
  const push = n => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].score <= n.score) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = n;
  };
  const pop = () => {
    const out = heap[0],
      last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let j = i * 2 + 1;
        if (j + 1 < heap.length && heap[j + 1].score < heap[j].score) j++;
        if (heap[j].score >= last.score) break;
        heap[i] = heap[j];
        i = j;
      }
      heap[i] = last;
    }
    return out;
  };
  const start = { x: 0, y: 0, p: gate, cost: 0, score: heuristic(gate), prev: null };
  nodes.set('0,0', start);
  push(start);
  for (let count = 0; heap.length && count < 30000; count++) {
    const n = pop();
    if (n.done) continue;
    n.done = true;
    for (const target of targets)
      if (Math.hypot(wdx(target.p[0], n.p[0]), target.p[1] - n.p[1]) < 36 && trackClear(n.p, target.p, field)) {
        const path = [target.p];
        for (let q = n; q; q = q.prev) path.push(q.p);
        // Remove stair-stepping where there is a clear direct segment.
        const simple = [path[0]];
        for (let i = 0; i < path.length - 1;) {
          let j = path.length - 1;
          while (j > i + 1 && !trackClear(path[i], path[j], field)) j--;
          simple.push(path[j]);
          i = j;
        }
        if (findCrossings(simple, RAIL).some(c => Math.abs(Math.sin(c.ang - c.rang)) < 0.55)) continue;
        return {
          path: continuousPath(simple),
          network: continuousPath([...target.prefix, ...simple.slice(1)])
        };
      }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ]) {
      const x = n.x + dx,
        y = n.y + dy,
        key = x + ',' + y,
        p = [gate[0] + x * grid, gate[1] + y * grid],
        cost = n.cost + Math.hypot(dx, dy) * grid;
      if (
        p[1] < NORTH - 100 ||
        p[1] > H - 200 ||
        Math.hypot(x, y) * grid > 2900 ||
        nodes.get(key)?.cost <= cost ||
        !trackClear(n.p, p, field)
      )
        continue;
      const next = { x, y, p, cost, score: cost + heuristic(p), prev: n };
      nodes.set(key, next);
      push(next);
    }
  }
  return null;
}

function clearAccessLanes() {
  LANES = LANES.map(lane => {
    const out = [pushOut(...lane[0], 16)];
    for (const p of lane.slice(1)) {
      const q = pushOut(...p, 16),
        a = out[out.length - 1];
      const route = segClear(...a, ...q) ? [q] : navPlan(...a, ...q);
      out.push(...(route || [q]));
    }
    return continuousPath(out);
  });
  ACCESS_TRUNKS = [];
  const groups = [],
    farmLanes = new Set(FARMS.map(farm => farm.lane));
  for (let i = 0; i < LANES.length; i++) {
    // A farm lane must leave the public road at the point nearest its gate.
    // Grouping it with a distant entrance makes it run along the road first.
    // Houses, services and other hamlet destinations can still share a stem.
    if (farmLanes.has(i)) continue;
    const lane = LANES[i],
      root = lane[0],
      end = lane[lane.length - 1],
      ang = roadAng(wrapX(root[0]), 70),
      side = Math.sign(-Math.sin(ang) * wdx(end[0], root[0]) + Math.cos(ang) * (end[1] - root[1])) || 1;
    let group = groups.find(g => g.side === side && Math.hypot(wdx(root[0], g.root[0]), root[1] - g.root[1]) < 620);
    if (!group) groups.push((group = { side, root, lanes: [] }));
    group.lanes.push(i);
  }
  for (const group of groups) {
    if (group.lanes.length < 2) continue;
    // Use the most central existing road junction, avoiding another artificial
    // entrance. The common stem then points toward the cluster before it forks.
    const rootIndex = group.lanes.reduce((best, i) => {
      const p = LANES[i][0],
        score = group.lanes.reduce((sum, j) => sum + Math.hypot(wdx(LANES[j][0][0], p[0]), LANES[j][0][1] - p[1]), 0);
      return !best || score < best.score ? { i, score } : best;
    }, null).i;
    const root = LANES[rootIndex][0],
      ends = group.lanes.map(i => LANES[i][LANES[i].length - 1]),
      cx = root[0] + ends.reduce((sum, p) => sum + wdx(p[0], root[0]), 0) / ends.length,
      cy = ends.reduce((sum, p) => sum + p[1], 0) / ends.length,
      dx = cx - root[0],
      dy = cy - root[1],
      d = Math.hypot(dx, dy) || 1,
      stem = clamp(d * 0.38, 110, 260),
      junction = [root[0] + (dx / d) * stem, root[1] + (dy / d) * stem],
      trunk = countryCurve(root, junction, group.lanes.length);
    if (
      trunk.some(p => inWater(wrapX(p[0]), p[1], 14) || inBuild(p[0], p[1], 10)) ||
      findCrossings(trunk, RAIL).some(c => Math.abs(Math.sin(c.ang - c.rang)) < 0.55)
    )
      continue;
    ACCESS_TRUNKS.push(trunk);
    for (const i of group.lanes) {
      const end = LANES[i][LANES[i].length - 1],
        q = [junction[0] + wdx(end[0], junction[0]), end[1]],
        curved = countryCurve(junction, q, i),
        curveClear =
          curved.slice(1).every((p, k) => segClear(...curved[k], ...p)) &&
          !curved.some(p => inWater(wrapX(p[0]), p[1], 10)),
        branch = curveClear ? curved.slice(1) : segClear(...junction, ...q) ? [q] : navPlan(...junction, ...q);
      if (branch) LANES[i] = continuousPath([...trunk, ...branch]);
    }
  }
  for (const farm of FARMS) farm.yard.gate = LANES[farm.lane][LANES[farm.lane].length - 1];
}
