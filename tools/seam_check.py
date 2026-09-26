"""Regression test for the world seam: the land repeats east-west, and where one copy meets the next there
must be no visible line in any season, hour or zoom.
usage: python3 tools/seam_check.py [SEEDS]   (default 7,424242,5; exits 1 on failure)

Checks, per seed:
  1. the painted ground canvas G wraps: its last column continues into its first no more sharply than
     neighbouring columns differ from each other;
  2. the snow/straw mask wraps the same way;
  3. screenshots with the seam in view (flock set a little east of it, so the seam is off the birds) in every
     season at several hours and zooms, plus mid-crossfade between seasons: the column pair at the seam
     must not stand out from the columns just beside it. A line down the whole screen raises the per-row
     median difference at that column; trees or animals crossing it only touch some rows, so they don't. It is
     compared with the busier quarter of the columns a few pixels either side, so busy ground doesn't trip it."""
from playwright.sync_api import sync_playwright
from PIL import Image
import io, os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
seeds = (sys.argv[1] if len(sys.argv) > 1 else '7,424242,5').split(',')
out = os.path.join(root, 'tools', 'out', 'seam')
os.makedirs(out, exist_ok=True)
LIMIT = 1.6  # how many times sharper than its surroundings the seam column may be


def col_stats(img, c0, c1):
    """per-row-median |difference| between columns x and x+1, for x in [c0, c1)"""
    px = img.load()
    w, h = img.size
    res = {}
    for x in range(max(0, c0), min(w - 1, c1)):
        d = sorted(sum(abs(a - b) for a, b in zip(px[x, y], px[x + 1, y])) for y in range(40, h - 40, 2))
        res[x] = d[len(d) // 2]
    return res


def seam_ratio(img, sx):
    """how far the seam's columns stand out from the columns just beside them: a line is a sharp local peak,
    while a forest or a road that happens to straddle the seam raises its neighbours just as much"""
    around = col_stats(img, sx - 14, sx + 14)
    near = [around[x] for x in around if abs(x - sx) <= 2]
    ring = sorted(around[x] for x in around if abs(x - sx) >= 4)
    base = max(2.0, ring[int(len(ring) * 0.75)])
    return max(near) / base


def shot(pg, keep):
    """a screenshot and the screen column of the seam in it; retried until the camera holds still across it"""
    at = 'Math.round(vw / 2 + (0 - cam.x) * cam.z)'
    for _ in range(12):
        pg.evaluate(keep)
        pg.wait_for_timeout(250)
        a = pg.evaluate(at)
        img = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
        if pg.evaluate(at) == a:
            return img, a
    return img, a


fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(root, 'index.html') + '?dev')
    pg.wait_for_timeout(1200)
    pg.click('#startBtn')
    pg.wait_for_timeout(300)
    for sd in seeds:
        pg.evaluate(f'genWorld({sd})')
        pg.wait_for_timeout(200)
        for s in range(4):
            pg.evaluate(f'dev.calm();dev.season({s},12)')
            pg.wait_for_timeout(600)
            g = pg.evaluate("""(()=>{
              const wrap = cv => { const c = cv.getContext('2d'), w = cv.width, h = cv.height,
                a = c.getImageData(w - 2, 0, 2, h).data, b = c.getImageData(0, 0, 1, h).data;
                let js = 0, jn = 0;
                for (let y = 0; y < h; y++) for (let k = 0; k < 4; k++) {
                  js += Math.abs(a[(y * 2 + 1) * 4 + k] - b[y * 4 + k]); jn += Math.abs(a[(y * 2 + 1) * 4 + k] - a[y * 2 * 4 + k]); }
                return [js / h, jn / h]; };
              const r = { G: wrap(G) };
              if (GROW.maskOn && GROW.MC && typeof GPAD !== 'undefined') {
                // the mask carries GPAD wrapped cells each side: compare the real last column with the first
                const c = GROW.MC.getContext('2d'), w = GROW.MC.width, h = GROW.MC.height,
                  a = c.getImageData(w - 1 - GPAD, 0, 1, h).data, b = c.getImageData(w - GPAD, 0, 1, h).data,
                  f = c.getImageData(GPAD, 0, 1, h).data;
                let bad = 0; for (let i = 0; i < a.length; i++) bad += Math.abs(b[i] - f[i]);
                r.mask = bad;
              }
              return r; })()""")
            js, jn = g['G']
            if js > max(3.0, jn * 1.6):
                fails.append(f'seed {sd} season {s}: ground canvas jumps at the seam ({js:.1f} vs {jn:.1f} between neighbours)')
            if g.get('mask'):
                fails.append(f'seed {sd} season {s}: snow mask padding does not repeat the first columns')
            for h, z, y in ((12, 1.0, 1100), (7, 1.0, 1700), (20, 1.0, 2300), (12, 0.6, 1500), (15, 1.6, 1300)):
                pg.evaluate(f'dev.season({s},{h});dev.to(170,{y},{z})')
                pg.wait_for_timeout(1500)
                # the least of three frames: a real seam is in every one, falling snow or a passing bird isn't
                r = 1e9
                for _ in range(3):
                    im, x = shot(pg, '0')
                    rr = seam_ratio(im, x)
                    if rr < r:
                        r, img, sx = rr, im, x
                tag = f'seed {sd} season {s} hour {h} zoom {z} y {y}'
                if os.environ.get('SEAM_DEBUG'):
                    st = col_stats(img, sx - 30, sx + 30)
                    print('   sx', sx, 'sharpest', sorted(st, key=lambda x: -st[x])[:3], {x - sx: st[x] for x in st if abs(x - sx) <= 6})
                if r > LIMIT:
                    f = os.path.join(out, f'fail_{sd}_s{s}_h{h}_z{z}.png')
                    img.save(f)
                    fails.append(f'{tag}: seam column {r:.1f}x sharper than its surroundings ({f})')
                else:
                    print(f'ok   {tag}  ratio {r:.2f}')
        # halfway through a season's crossfade, when two ground canvases are drawn over each other
        pg.evaluate('dev.season(0,12);TRANS.prevG=G;TRANS.t=0.5;dev.to(170,1200,1.0)')
        pg.wait_for_timeout(300)
        r = min(seam_ratio(*shot(pg, 'TRANS.t=0.5')) for _ in range(3))
        (fails.append if r > LIMIT else print)(f'{"" if r > LIMIT else "ok   "}seed {sd} crossfade: ratio {r:.2f}')
    b.close()
for f in fails:
    print('FAIL', f)
print('page errors:', errs or 'none')
sys.exit(1 if fails or errs else 0)
