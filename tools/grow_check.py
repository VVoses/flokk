"""The year moving within each season: python3 tools/grow_check.py [TAG]
1. plays a whole year headless at speed (update + render, the flock kept fed and hawk-free) and fails on any
   page error or a season that never arrived;
2. photographs one place at four points through each season (contact sheet tools/out/survey/TAG_grow.png)
   and at dawn, to eyeball snow melt, greening, leaf-out, ripening, harvest, mist, dew and light shafts."""
from playwright.sync_api import sync_playwright
from PIL import Image
import os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag = sys.argv[1] if len(sys.argv) > 1 else 'grow'
out = os.path.join(root, 'tools', 'out', 'survey')
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 800})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'ERR_' not in m.text and errs.append(m.text))
    pg.goto('file://' + os.path.join(root, 'index.html') + '?dev')
    pg.wait_for_timeout(1200)
    pg.evaluate('genWorld(424242)')
    pg.click('#startBtn')
    pg.wait_for_timeout(300)
    # 1. a full year, stepped in-page: 0.1 s steps, a frame drawn every 2 game seconds
    seen = pg.evaluate("""(() => {
      const seen = [], ps = [];
      const end = CAL.t + YEAR_DAYS * DAY_LEN - 5;
      let n = 0;
      while (CAL.t < end) {
        dev.calm(); st.energy = 1;
        update(0.1); audioTick(0.1);
        if (++n % 20 === 0) render();
        if (!seen.includes(SEASON)) seen.push(SEASON);
        if (n % 300 === 0) ps.push([SEASON, +GROW.p.toFixed(2), +AIR.mist.toFixed(2), +AIR.dewK.toFixed(2)]);
        if (st.mode !== 'play') break;
      }
      return { seen, mode: st.mode, ps };
    })()""")
    print('seasons seen:', seen['seen'], 'mode:', seen['mode'])
    for r in seen['ps']:
        print('  season %d  p %.2f  mist %.2f  dew %.2f' % tuple(r))
    ok = sorted(seen['seen']) == [0, 1, 2, 3]
    # 2. four points through each season, and dawn
    ims = []
    # a grain field near the main farm, with its trees and hedges round it
    where = pg.evaluate("""(() => { const fm = FARMS[0], d = f => Math.hypot(f.x + f.w / 2 - fm.cx, f.y + f.h / 2 - fm.cy);
      const f = FIELDS.filter(f => f.t === 'stubble' || f.t === 'plow').sort((a, b) => d(a) - d(b))[0] || FIELDS[0];
      return `${f.x + f.w / 2},${f.y + f.h / 2},0.9`; })()""")
    for s in range(4):
        for q in (0.1, 0.35, 0.6, 0.9):
            pg.evaluate(f"(() => {{ dev.calm(); dev.season({s}, 11); dev.grow({q}); dev.to({where}); }})()")
            pg.wait_for_timeout(700)
            f = os.path.join(out, f'{tag}_s{s}_{int(q*100)}.png')
            pg.screenshot(path=f)
            ims.append(Image.open(f).convert('RGB').resize((400, 250)))
    sheet = Image.new('RGB', (1600, 1000))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 4) * 400, (i // 4) * 250))
    sheet.save(os.path.join(out, f'{tag}_grow.png'))
    pg.evaluate('dev.grow()')
    dawn = []
    for s in range(4):
        pg.evaluate(f"(()=>{{dev.calm();dev.season({s},6);AIR.mist=1;dev.to(LAKE.x,LAKE.y-LAKE.r*0.6,0.8)}})()")
        pg.wait_for_timeout(1500)
        f = os.path.join(out, f'{tag}_dawn_s{s}.png')
        pg.screenshot(path=f)
        dawn.append(Image.open(f).convert('RGB').resize((640, 400)))
    sheet = Image.new('RGB', (1280, 800))
    for i, im in enumerate(dawn):
        sheet.paste(im, ((i % 2) * 640, (i // 2) * 400))
    sheet.save(os.path.join(out, f'{tag}_dawn.png'))
    print('errors:', errs or 'none')
    b.close()
    sys.exit(0 if ok and not errs else 1)
