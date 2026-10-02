"""Render representative seeded landscapes and check visible road connections.

Writes inspectable screenshots to tools/out/visual-smoke. Run with an optional
seed count (default 6); CI uploads the images as artifacts.
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'tools' / 'out' / 'visual-smoke'
OUT.mkdir(parents=True, exist_ok=True)
COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 6
SEEDS = [1, 3, 7, 14, 26, 33, 41, 51]

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={'width': 1400, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((ROOT / 'index.html').as_uri() + '?dev')
    page.click('#startBtn')
    for seed in SEEDS[:COUNT]:
        state = page.evaluate('''seed => {
          genWorld(seed);
          roadInit();
          refreshInsects();
          resetWorld(6, START.x, START.y);
          $('titleOv').hidden = $('pauseOv').hidden = true;
          hideBanner();
          dev.season(1, 13);
          const orphan = ACCESS_TRUNKS.filter(trunk => {
            const end = trunk[trunk.length - 1];
            let joined = 0;
            for (const lane of LANES)
              if (lane.some(p => Math.hypot(wdx(p[0], end[0]), p[1] - end[1]) < 2)) joined++;
            return joined < 2;
          }).length;
          const stops = vehicleDestinations();
          const parking = stops.filter(stop => stop.name === 'farm').every((stop, i) =>
            inYard(FARMS[i].yard, ...stop.point, -8) &&
            !inBuild(stop.point[0], stop.point[1], 14) &&
            !inBuild(stop.rest[0], stop.rest[1], 14) &&
            Math.hypot(wdx(stop.point[0], FARMS[i].yard.gate[0]), stop.point[1] - FARMS[i].yard.gate[1]) > 80
          );
          const serviceParking = BUILDS.filter(b => b.service).every(b => {
            const spaces = b.parkingStops || [b.stop];
            return (b.service !== 'farmstore' || spaces.length === 3) && spaces.every(p =>
              !inBuild(p[0], p[1], 12) &&
              Math.hypot(wdx(p[0], b.cx), p[1] - b.cy) > b.dep / 2 + 15 &&
              roadDist(p[0], p[1]) > 60
            );
          });
          const storeRoutes = stops.filter(s => s.name === 'farmstore').every(s => {
            const route = makeJourney(FARMS[0].yard.gate, s.point);
            const end = route.points[route.points.length - 1];
            return Number.isFinite(route.length) && route.length > 0 &&
              Math.hypot(wdx(end[0], s.point[0]), end[1] - s.point[1]) < 1 &&
              !route.points.some(p => inBuild(p[0], p[1], -2) || inWater(wrapX(p[0]), p[1], 0));
          });
          const service = BUILDS.find(b => b.service);
          return {orphan, parking, serviceParking, storeRoutes, trunks: ACCESS_TRUNKS.length, lanes: LANES.length,
            farm: [FARMS[0].cx, FARMS[0].cy], service: service && [service.cx, service.cy]};
        }''', seed)
        if state['orphan'] or not state['parking'] or not state['serviceParking'] or not state['storeRoutes']:
            raise AssertionError(f'seed {seed}: {state}')
        views = [('world', [2100, 1900], 0.34), ('farm', state['farm'], 0.9)]
        if state['service']:
            views.append(('service', state['service'], 1.0))
        for label, point, zoom in views:
            page.evaluate('''({point, zoom}) => {dev.to(point[0], point[1], zoom); render();}''',
                          {'point': point, 'zoom': zoom})
            page.wait_for_timeout(200)
            visual = page.evaluate('''() => {
              const canvas = $('game'), ctx = canvas.getContext('2d');
              const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let opaque = 0; const colors = new Set();
              for (let y = 80; y < canvas.height; y += 37)
                for (let x = 0; x < canvas.width; x += 37) {
                  const i = (y * canvas.width + x) * 4;
                  if (data[i + 3] > 240) opaque++;
                  colors.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`);
                }
              return {opaque, colors: colors.size};
            }''')
            if visual['opaque'] < 100 or visual['colors'] < 50:
                raise AssertionError(f'seed {seed} {label}: blank or incomplete frame {visual}')
            page.screenshot(path=str(OUT / f'{seed:02d}-{label}.png'))
        print(f'seed {seed}: {state["trunks"]} shared trunks, {state["lanes"]} access lanes, {len(views)} frames')
    browser.close()
    if errors:
        raise AssertionError(f'page errors: {errors}')
print(f'visual smoke passed: {min(COUNT, len(SEEDS))} seeds')
