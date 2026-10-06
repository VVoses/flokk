"""Utility/rail mast road clearance and sparser catenary across generated worlds."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
    page.wait_for_function('!MENU_JOB && birds.length')
    for seed in [1, 7, 17, 42, 79, 168, 172, 2026]:
        stats = page.evaluate("""seed => {
          st.mode='pause';genWorld(seed);
          const poles=[...POLES,...CATS];
          let bad=0;
          for(const q of poles) {
            if(roadDist(q.x,q.y)<28 || laneDist(q.x,q.y)<18 || inBuild(q.x,q.y,8) || inWater(q.x,q.y,6)) bad++;
          }
          const dense=polesPeriodic(RAIL,64,MAST_OFF,20).filter(q=>!q.ghost).length;
          return {bad,poles:POLES.length,masts:CATS.length,dense,
            connected:LINES.some(line=>line.cat&&line.length>1&&line.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)))};
        }""", seed)
        assert stats['bad'] == 0 and stats['poles'] > 0 and stats['masts'] > 0, stats
        assert stats['masts'] < stats['dense'] * .85 and stats['connected'], stats
        print('ok road-clear utility poles and sparse connected railway masts', seed, stats)
    browser.close()
