"""Check that the glacial bekk joins the fjord without swallowing land use.

Usage: python3 tools/stream_check.py [seed count]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
count = int(sys.argv[1]) if len(sys.argv) > 1 else 30

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((root / 'index.html').as_uri() + '?dev')
    page.click('#startBtn')
    failures = page.evaluate('''count => {
      const failures = [];
      for (let seed = 1; seed <= count; seed++) {
        genWorld(seed);
        const fail = msg => failures.push(`seed ${seed}: ${msg}`);
        if (!STREAM || STREAM.source[1] !== 96 ||
            Math.abs(STREAM.mouth[1] - shoreY(STREAM.mouth[0])) > 1) {
          fail('source or fjord mouth missing');
          continue;
        }
        if (!STREAM_CROSSINGS.some(c => c.kind === 'road') ||
            !STREAM_CROSSINGS.some(c => c.kind === 'rail')) fail('road or railway bridge missing');
        for (let i = 1; i < STREAM.points.length; i++)
          if (STREAM.points[i][1] <= STREAM.points[i - 1][1]) fail('water runs uphill');
        for (let y = 132; y < STREAM.mouth[1] - 30; y += 12) {
          const x = streamXAt(y);
          if (!Number.isFinite(x)) { fail(`missing centreline at y=${y}`); continue; }
          if (inBlob(x, y, LAKE, lakeR, 20) || inBlob(x, y, POND, pondR, 20))
            fail(`lake or pond collision at y=${y}`);
          if (YARDS.some(Y => inYard(Y, x, y, 2)) || inChurchyard(x, y, 2))
            fail(`courtyard collision at y=${y}`);
          if (BUILDS.some(b => inBuild(x, y, 2))) fail(`building collision at y=${y}`);
          if (FIELDS.some(f => inField(f, x, y, -2))) fail(`field collision at y=${y}`);
          if (!onStreamBridge(x, y) && !inWater(x, y)) fail(`water collision missing at y=${y}`);
        }
        for (const c of STREAM_CROSSINGS) {
          if (!onStreamBridge(c.x, c.y) || inWater(c.x, c.y))
            fail(`${c.kind} crossing is not passable`);
        }
      }
      return failures;
    }''', count)
    browser.close()

for failure in failures[:50]:
    print('FAIL', failure)
print(f'{count} seeds checked; {len(failures)} failures; page errors: {errors or "none"}')
sys.exit(1 if failures or errors else 0)
