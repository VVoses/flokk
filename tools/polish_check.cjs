const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?dev');
    await page.click('#startBtn');
    const save = await page.evaluate(() => {
      st.mode = 'pause';
      st.energy = 0.63;
      st.food = 2;
      CAL.t = 70;
      calUpdate();
      const p = perches.find(p => p.type === 'tree' && p.tt === 'spruce');
      L.perch = p;
      p.occ = L;
      L.state = 'perch';
      L.x = p.x;
      L.y = p.y;
      L.z = p.h;
      saveSession();
      return {
        seed: SEED,
        time: CAL.t,
        energy: st.energy,
        count: birds.length,
        x: L.x,
        bytes: localStorage.getItem(SESSION_KEY)?.length || 0
      };
    });
    assert(save.bytes > 0, 'session is written');
    await page.reload();
    const titleLayout = await page.evaluate(() => {
      const actions = [...document.querySelectorAll('#titleOv .actions .btn:not([hidden])')].map(el =>
        el.getBoundingClientRect()
      );
      const hints = [...document.querySelectorAll('#keysTxt li')].map(el => el.getBoundingClientRect());
      return {
        actions: actions.map(r => ({ top: r.top, left: r.left, right: r.right })),
        hints: hints.map(r => ({ top: r.top, bottom: r.bottom })),
        label: $('startBtn').textContent,
        destructive: $('startBtn').classList.contains('danger'),
        inlineWarning: getComputedStyle($('startBtn'), '::after').content
      };
    });
    assert.equal(titleLayout.actions.length, 3);
    assert(titleLayout.actions[1].top > titleLayout.actions[0].top, 'secondary saved-game actions sit below continue');
    assert.equal(titleLayout.actions[1].top, titleLayout.actions[2].top, 'new-flight choices share one deliberate row');
    assert(titleLayout.actions[1].right < titleLayout.actions[2].left, 'new-flight choices do not wrap or overlap');
    assert(
      titleLayout.hints.every((r, i, all) => !i || r.top >= all[i - 1].bottom),
      'gameplay hints form separate rows'
    );
    assert.equal(titleLayout.label, 'Start new flight');
    assert(titleLayout.destructive, 'starting over is visually marked as destructive');
    assert(
      ['none', 'normal'].includes(titleLayout.inlineWarning),
      'destructive copy is not permanently attached to the button'
    );
    await page.click('#startBtn');
    assert(await page.locator('#newFlightOv').isVisible(), 'saved flight opens a confirmation dialog');
    assert(await page.locator('#titleOv').isHidden(), 'confirmation replaces the title card instead of overlapping it');
    assert(await page.evaluate(() => !!readSession()), 'opening confirmation preserves the saved flight');
    await page.click('#cancelNewFlightBtn');
    assert(await page.locator('#newFlightOv').isHidden(), 'confirmation can be cancelled');
    assert(await page.locator('#titleOv').isVisible(), 'cancelling restores the title card');
    await page.click('#continueBtn');
    const restored = await page.evaluate(() => ({
      seed: SEED,
      time: CAL.t,
      energy: st.energy,
      count: birds.length,
      x: L.x,
      mode: st.mode,
      perch: perches.includes(L.perch),
      occupied: L.perch?.occ === L
    }));
    for (const k of ['seed', 'time', 'energy', 'count', 'x']) assert.equal(restored[k], save[k], k);
    assert.equal(restored.mode, 'pause');
    assert(restored.perch && restored.occupied);
    console.log('session round trip', save.bytes, 'bytes');
    await page.evaluate(() => {
      resume();
      update(0.016);
      pause();
    });
    const resident = await page.evaluate(() => {
      dev.season(1);
      const dog = ANIMALS.find(a => a.k === 'dog'),
        farmer = ANIMALS.find(a => a.role === 'farmer');
      const x = dog.x;
      applySeason(2, true);
      while (BG_JOB) runBgJob();
      return ANIMALS.includes(dog) && ANIMALS.includes(farmer) && dog.x === x;
    });
    assert(resident, 'residents survive season boundary');
    const report = await page.evaluate(() => {
      const report = [];
      for (let seed = 1; seed <= 8; seed++) {
        genWorld(seed);
        roadInit();
        const dest = journeyDestinations(),
          route = makeJourney(dest[0].point, dest[1].point);
        const bad = route.points
          .filter(p => inWater(wrapX(p[0]), p[1], 0) || inBuild(p[0], p[1], -2))
          .map(p => ({ p, water: inWater(wrapX(p[0]), p[1], 0), building: buildAt(p[0], p[1], -2)?.kind }));
        const hazards = bad.length;
        const shallow = CROSSINGS.filter(c => c.x >= 0 && c.x < W && Math.abs(Math.sin(c.ang - c.rang)) < 0.45).length;
        const underpasses = CROSSINGS.filter(c => c.x >= 0 && c.x < W && c.underpass).length;
        const paths = [...ACCESS_TRUNKS, ...LANES, ...FIELD_TRACKS.flatMap(t => [t.path, t.network])],
          seamJumps = [];
        let longestSegment = 0,
          malformedLanes = 0;
        for (const path of paths)
          for (let i = 1; i < path.length; i++) {
            const dx = path[i][0] - path[i - 1][0],
              dy = path[i][1] - path[i - 1][1];
            longestSegment = Math.max(longestSegment, Math.hypot(dx, dy));
            if (Math.abs(dx) > W / 2) seamJumps.push([path[i - 1], path[i]]);
          }
        for (const path of LANES) {
          if (path.length < 2) continue;
          let length = 0,
            maxTurn = 0,
            self = false;
          for (let i = 1; i < path.length; i++) {
            length += Math.hypot(wdx(path[i][0], path[i - 1][0]), path[i][1] - path[i - 1][1]);
            if (i < path.length - 1) {
              const a = Math.atan2(path[i][1] - path[i - 1][1], wdx(path[i][0], path[i - 1][0])),
                b = Math.atan2(path[i + 1][1] - path[i][1], wdx(path[i + 1][0], path[i][0]));
              maxTurn = Math.max(maxTurn, Math.abs(angDiff(b, a)));
            }
          }
          for (let i = 0; i < path.length - 1 && !self; i++)
            for (let j = i + 2; j < path.length - 1; j++)
              if (!(i === 0 && j === path.length - 2) && segX(path[i], path[i + 1], path[j], path[j + 1])) self = true;
          const direct = Math.hypot(wdx(path.at(-1)[0], path[0][0]), path.at(-1)[1] - path[0][1]);
          if (self || maxTurn > 1.45 || length > Math.max(120, direct * 1.85)) malformedLanes++;
        }
        let minorIntrusions = 0;
        for (const track of FIELD_TRACKS)
          for (let i = 1; i < track.path.length; i++) {
            const a = track.path[i - 1],
              b = track.path[i],
              n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10));
            for (let j = 0; j <= n; j++) {
              const x = lerp(a[0], b[0], j / n),
                y = lerp(a[1], b[1], j / n);
              if (inWater(wrapX(x), y, 12) || YARDS.some(yard => inYard(yard, x, y, 2))) minorIntrusions++;
            }
          }
        const roadShoreHits = ROAD.filter(p => p[0] >= 0 && p[0] < W && inWater(p[0], p[1], 60)).length;
        const roadFieldHits = ROAD.filter(
            p => p[0] >= 0 && p[0] < W && FIELDS.some(f => f.t !== 'sty' && inField(f, p[0], p[1], 8))
          ).length,
          laneFieldHits = LANES.reduce(
            (sum, lane) =>
              sum + lane.filter(p => FIELDS.some(f => f.t !== 'sty' && inField(f, wrapX(p[0]), p[1], 8))).length,
            0
          ),
          churchRoadHits = CHURCH
            ? ROAD.filter(p => p[0] >= 0 && p[0] < W && inYard(CHURCH.yard, p[0], p[1], 18)).length
            : 0,
          churchLaneHits = CHURCH
            ? LANES.reduce(
                (sum, lane, i) =>
                  sum + (i === CHURCH.lane ? 0 : lane.filter(p => inYard(CHURCH.yard, wrapX(p[0]), p[1], 12)).length),
                0
              )
            : 0;
        const missing = FIELDS.filter(f => f.t !== 'sty' && !f.track).map(f => ({
          x: Math.round(f.x),
          y: Math.round(f.y),
          w: Math.round(f.w),
          h: Math.round(f.h),
          type: f.t
        }));
        const regionalTrees = {};
        for (const tree of TREES) {
          const region = regionAt(tree.x, tree.y),
            counts = (regionalTrees[region] ||= { spruce: 0, birch: 0, decid: 0 });
          counts[tree.type]++;
        }
        report.push({
          seed,
          worldWidth: W,
          services: BUILDS.filter(b => b.service).map(b => b.service),
          hazards,
          bad,
          shallow,
          underpasses,
          seamJumps: seamJumps.length,
          longestSegment: Math.round(longestSegment),
          malformedLanes,
          minorIntrusions,
          roadShoreHits,
          roadFieldHits,
          laneFieldHits,
          churchRoadHits,
          churchLaneHits,
          trunks: ACCESS_TRUNKS.length,
          fields: FIELDS.filter(f => f.t !== 'sty').length,
          tracks: FIELD_TRACKS.length,
          missing,
          trees: TREES.length,
          regionalTrees,
          railRadius: Math.round(railMinRadius(RAIL)),
          railMinimum: RAIL_MIN_RADIUS,
          route: route.length
        });
      }
      return report;
    });
    console.log('layout survey', JSON.stringify(report));
    assert(
      report.every(r => r.hazards === 0),
      'routes stay on dry open ground'
    );
    assert(
      report.every(r => r.shallow === 0),
      'crossings have safe approach angles'
    );
    assert(
      report.every(r => r.seamJumps === 0),
      'tracks never take the long way across the world seam'
    );
    assert(
      report.every(r => r.longestSegment < r.worldWidth / 2),
      'track segments remain locally connected'
    );
    assert(
      report.every(r => r.malformedLanes === 0),
      'access roads avoid reversals, self-intersections and excessive detours'
    );
    assert(
      report.some(r => r.trunks > 0),
      'nearby destinations share hierarchical access-road trunks'
    );
    assert(
      report.every(r => r.tracks === r.fields),
      'every workable field has an access track'
    );
    assert(
      report.every(r => r.minorIntrusions === 0),
      'minor tracks stay outside courtyards and water'
    );
    assert(
      report.every(r => r.roadShoreHits === 0),
      'public roads retain a stable lake-shore verge'
    );
    assert(
      report.every(r => r.roadFieldHits === 0),
      'public roads follow field edges instead of crossing cultivated ground'
    );
    assert(
      report.every(r => r.laneFieldHits === 0),
      'access roads follow field edges instead of crossing cultivated ground'
    );
    assert(
      report.every(r => r.churchRoadHits === 0 && r.churchLaneHits === 0),
      'unrelated roads stay outside churchyards'
    );
    assert(
      report.every(r => r.railRadius >= r.railMinimum),
      'railway bends retain a high-speed minimum radius'
    );
    assert(
      report.every(r => r.trees < 3200),
      'regional vegetation remains within the reviewed scene-density budget'
    );
    assert(
      report.every(r => r.regionalTrees.highland.spruce > r.regionalTrees.highland.birch),
      'highland woodland keeps a spruce-led canopy'
    );
    assert(
      report.every(r => !r.regionalTrees.lake || r.regionalTrees.lake.birch > r.regionalTrees.lake.spruce),
      'lake woodland keeps a birch-led canopy'
    );
    const traffic = await page.evaluate(() => {
      genWorld(17);
      roadInit();
      const destination = journeyDestinations();
      const route = makeJourney(destination[0].point, destination[1].point);
      const c = { x: railAt(RAIL_S0 + 300).x, y: railAt(RAIL_S0 + 300).y, s: 200 };
      TRAIN = { s: railSAtX(wrapX(c.x)) - 100, dir: 1, v: 160, vmax: 200, tot: 160 };
      const blocked = crossingRoom({ crossings: [c] }, 140, 15);
      const underpassOpen = crossingRoom({ crossings: [{ ...c, underpass: true }] }, 140, 15);
      TRAIN = null;
      const open = crossingRoom({ crossings: [c] }, 140, 15);
      const a = mkA('deer', 100, 100);
      groundStep(a, 100, 0, 100, 60, 0);
      const finite = Number.isFinite(a.x) && Number.isFinite(a.vx);
      const leaderV = [L.vx, L.vy];
      for (const b of birds.slice(1)) b.state = 'fly';
      feedingSnap(L.x + 35, L.y + 18, L.z - 0.2);
      const reactor = birds.slice(1).find(b => b.feedT > 0),
        oldV = reactor && [reactor.vx, reactor.vy];
      if (reactor) flyUpdate(reactor, 0.05);
      const feedingReaction =
        reactor &&
        Math.hypot(reactor.vx - oldV[0], reactor.vy - oldV[1]) > 1 &&
        L.vx === leaderV[0] &&
        L.vy === leaderV[1];
      const fields = FIELDS.filter(f => f.track && ['plow', 'stubble', 'crop'].includes(f.t));
      let fieldPair = fields.length > 1 ? [fields[0], fields[1]] : null,
        fieldSeparation = -1;
      for (let i = 0; i < fields.length; i++)
        for (let j = i + 1; j < fields.length; j++) {
          const sa = nearestRoad(...fields[i].track.network[0]).s,
            sb = nearestRoad(...fields[j].track.network[0]).s,
            separation = Math.abs(((sb - sa + RD.P * 1.5) % RD.P) - RD.P / 2);
          if (separation > fieldSeparation) {
            fieldSeparation = separation;
            fieldPair = [fields[i], fields[j]];
          }
        }
      const tractorRoute = fieldPair ? makeJourney(ptIn(fieldPair[0], 30), ptIn(fieldPair[1], 30)) : null;
      const usesRoad = tractorRoute && tractorRoute.points.some(p => roadDist(wrapX(p[0]), p[1]) < 20);
      const usesTrack =
        tractorRoute && tractorRoute.points.some(p => FIELD_TRACKS.some(t => polyDist(wrapX(p[0]), p[1], t.path) < 12));
      const stops = vehicleDestinations(),
        parkedRoute = makeJourney(stops[0].point, stops[1].point),
        parkedPoint = journeyAt(parkedRoute, parkedRoute.length),
        parkedVehicle = {
          kind: 'car',
          route: parkedRoute,
          destination: stops[1].point,
          stop: stops[1],
          s: parkedRoute.length,
          dist: W,
          v: 40,
          vmax: 110,
          col: '#2E4A6E',
          len: 38,
          hd: 8.5,
          x: wrapX(parkedPoint.x),
          y: parkedPoint.y,
          ang: parkedPoint.ang,
          scareT: 1
        };
      TRAFFIC = [parkedVehicle];
      placeVehicle(parkedVehicle, 0.1);
      updateTraffic(0.1);
      const parkedRetained = TRAFFIC.includes(parkedVehicle) && parkedVehicle.parkT > 0 && parkedVehicle.v === 0,
        parkingAligned =
          Math.hypot(wdx(parkedVehicle.x, stops[1].point[0]), parkedVehicle.y - stops[1].point[1]) < 1 &&
          Math.abs(angDiff(parkedVehicle.ang, stops[1].ang)) < 0.01;
      TRAFFIC = [];
      spawnResidentCars();
      const residentCars = TRAFFIC.filter(v => v.resident),
        residentCarsParked = residentCars.length > 0 && residentCars.every(v => !v.engineOn && v.v === 0);
      let farmParkingInset = true,
        farmStopIndex = 0;
      for (const s of stops) {
        if (s.name !== 'farm') continue;
        const f = FARMS[farmStopIndex++],
          gateDistance = Math.hypot(wdx(s.point[0], f.yard.gate[0]), s.point[1] - f.yard.gate[1]);
        if (gateDistance <= 80) farmParkingInset = false;
      }
      const arrivalsBefore = ANIMALS.filter(a => a.role === 'arrival').length;
      parkedVehicle.driverOut = false;
      driverExit(parkedVehicle);
      const arrivalAnimated =
        parkedVehicle.doorT > 0 && ANIMALS.filter(a => a.role === 'arrival').length === arrivalsBefore + 1;
      return {
        blocked,
        underpassOpen: underpassOpen === Infinity,
        open: open === Infinity,
        finite,
        feedingReaction,
        journey: route.length > 0,
        usesRoad,
        usesTrack,
        parkedRetained,
        parkingAligned,
        residentCars: residentCars.length,
        residentCarsParked,
        farmParkingInset,
        arrivalAnimated,
        parkingSpaces: stops.length,
        gates: FIELD_GATES.length,
        trackedFields: FIELD_TRACKS.length
      };
    });
    console.log('traffic checks', traffic);
    assert(
      traffic.blocked < 60 &&
        traffic.underpassOpen &&
        traffic.open &&
        traffic.finite &&
        traffic.feedingReaction &&
        traffic.journey &&
        traffic.usesRoad &&
        traffic.usesTrack &&
        traffic.parkedRetained &&
        traffic.parkingAligned &&
        traffic.residentCarsParked &&
        traffic.farmParkingInset &&
        traffic.arrivalAnimated &&
        traffic.parkingSpaces >= 4 &&
        traffic.gates === traffic.trackedFields
    );
    const animalMovement = await page.evaluate(() => {
      spawnAnimals();
      st.mode = 'play';
      const tractor = ANIMALS.find(a => a.k === 'tractor'),
        tractorTarget =
          tractor && FIELDS.find(f => f.track && f !== tractor.rect && ['plow', 'stubble', 'crop'].includes(f.t));
      let tractorClearsRoadAtNight = true;
      if (tractor && tractorTarget) {
        const row = rowStart(tractorTarget, tractor.x, tractor.y),
          oldNight = LIGHT.night;
        tractor.next = tractorTarget;
        tractor.go = [row.x, row.y];
        tractor.route = makeJourney([tractor.x, tractor.y], tractor.go);
        tractor.routeS = 0;
        LIGHT.night = 1;
        updateAnimals(1 / 60);
        tractorClearsRoadAtNight = tractor.routeS > 0;
        LIGHT.night = oldNight;
      }
      const fleeing = ANIMALS.find(a => a.k === 'deer');
      let fleeAligned = true;
      if (fleeing) {
        Object.assign(fleeing, { st: 'flee', t: 1, chk: 1, fx: 0, fy: 1, graze: true, moveHeading: 0 });
        updateAnimals(1 / 60);
        fleeAligned =
          !fleeing.graze && Math.abs(angDiff(fleeing.moveHeading, Math.atan2(fleeing.vy, fleeing.vx))) < 0.01;
      }
      for (let i = 0; i < 1200; i++) updateAnimals(1 / 60);
      const grounded = ANIMALS.filter(a => SEP_R[a.k] && !a.migrating && !a.dying),
        invalid = grounded.filter(a => {
          if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.vx) || !Number.isFinite(a.vy))
            return true;
          if (a.rect && !inField(a.rect, a.x, a.y, -3)) return true;
          if (a.k === 'duck' && !inBlob(a.x, a.y, a.pool, a.prf, -3)) return true;
          if ((a.k === 'deer' || a.k === 'moose') && (inWater(a.x, a.y, 4) || inBuild(a.x, a.y, 6))) return true;
          return false;
        });
      let severeOverlaps = 0;
      for (let i = 0; i < grounded.length; i++)
        for (let j = i + 1; j < grounded.length; j++) {
          const min = SEP_R[grounded[i].k] + SEP_R[grounded[j].k];
          if (near2(grounded[i], grounded[j]) < (min * 0.35) ** 2) severeOverlaps++;
        }
      const deer = ANIMALS.filter(a => a.k === 'deer'),
        moose = ANIMALS.filter(a => a.k === 'moose');
      return {
        count: grounded.length,
        invalid: invalid.map(a => a.k),
        severeOverlaps,
        fleeAligned,
        tractorClearsRoadAtNight,
        deerValley: deer.map(a => regionWeights(a.x, a.y).valley),
        mooseHighland: moose.map(a => regionWeights(a.x, a.y).highland)
      };
    });
    assert(animalMovement.count > 10, 'ground movement simulation includes a mixed population');
    assert.deepEqual(animalMovement.invalid, [], 'ground animals respect habitat boundaries while moving');
    assert.equal(animalMovement.severeOverlaps, 0, 'herd spacing prevents stacked animal sprites');
    assert(animalMovement.fleeAligned, 'fleeing deer raise their heads and face their actual movement');
    assert(
      animalMovement.tractorClearsRoadAtNight,
      'tractors finish reaching a field instead of parking on a road at night'
    );
    assert(
      animalMovement.deerValley.some(weight => weight > 0.35),
      'deer inhabit the valley woodland edge'
    );
    assert(
      !animalMovement.mooseHighland.length || animalMovement.mooseHighland.some(weight => weight > 0.35),
      'moose inhabit the highland woodland edge'
    );
    console.log('animal movement checks', animalMovement);
    const renderBudget = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        render();
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return {
        median: samples[Math.floor(samples.length * 0.5)],
        p95: samples[Math.floor(samples.length * 0.95)],
        max: samples.at(-1),
        trees: TREES.length,
        animals: ANIMALS.length
      };
    });
    assert(renderBudget.p95 < 80, 'representative full-scene rendering stays within the reviewed frame budget');
    console.log('render budget', renderBudget);
    fs.mkdirSync(path.join(root, 'tools/out/polish'), { recursive: true });
    for (const target of ['farmstore', 'fuel']) {
      await page.evaluate(kind => {
        st.mode = 'pause';
        $('pauseOv').hidden = true;
        $('titleOv').hidden = true;
        dev.season(1, 13);
        const b = BUILDS.find(b => b.service === kind);
        if (b) dev.to(b.cx, b.cy, 2);
        render();
      }, target);
      await page.screenshot({ path: path.join(root, `tools/out/polish/${target}.png`) });
    }
    await page.evaluate(() => {
      st.mode = 'title';
      clearSession();
      localStorage.setItem(SESSION_KEY, '{broken');
    });
    await page.reload();
    assert(await page.locator('#continueBtn').isHidden());
    assert.deepEqual(errors, []);
    console.log('polish checks passed');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
