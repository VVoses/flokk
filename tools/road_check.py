"""Checks how farms meet the road, over many generated lands.
usage: python3 tools/road_check.py [N]   (default 60 seeds; exits 1 on failure)

Fails if a farm's lane runs alongside the road before turning in (it should leave the road where it is nearest
the gate), or if the road cuts through a corner of a farmyard."""
from playwright.sync_api import sync_playwright
import os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
n = int(sys.argv[1]) if len(sys.argv) > 1 else 60
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(root, 'index.html') + '?dev')
    pg.wait_for_timeout(1200)
    pg.click('#startBtn')
    pg.wait_for_timeout(300)
    res = pg.evaluate(
        """n => { const out = [];
        for (let sd = 1; sd <= n; sd++) {
          genWorld(sd);
          FARMS.forEach((fm, i) => {
            // length of lane that stays within reach of the road once well clear of where it leaves it
            const L = LANES[fm.lane]; let along = 0;
            for (let k = 1; k < L.length; k++) {
              const q = L[k];
              if (roadDist(q[0], q[1]) < 45 && Math.hypot(q[0] - L[0][0], q[1] - L[0][1]) > 60)
                along += Math.hypot(q[0] - L[k - 1][0], q[1] - L[k - 1][1]);
            }
            let cut = 0; const y = fm.yard;
            for (let gx = y.x; gx <= y.x + y.w; gx += 15)
              for (let gy = y.y; gy <= y.y + y.h; gy += 15) if (inYard(y, gx, gy, -10) && roadDist(gx, gy) < 22) cut++;
            out.push([sd, i, Math.round(along), cut]);
          });
        }
        return out; }""",
        n,
    )
    b.close()
fails = [f'seed {sd} farm {i}: lane runs {a} units alongside the road' for sd, i, a, c in res if a > 40]
fails += [f'seed {sd} farm {i}: the road cuts through the yard' for sd, i, a, c in res if c]
for f in fails:
    print('FAIL', f)
print(f'{len(res)} farms on {n} lands checked; page errors:', errs or 'none')
sys.exit(1 if fails or errs else 0)
