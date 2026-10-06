"""Load the game headless, start it, report page errors and a screenshot (tools/out/smoke.png)."""
from playwright.sync_api import sync_playwright
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(os.path.join(root,'tools','out'),exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1280,'height':800})
    errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m:m.type=='error' and 'ERR_TUNNEL' not in m.text and errs.append(m.text))
    pg.goto('file://'+os.path.join(root,'index.html'))
    pg.wait_for_timeout(1500)
    pg.click('#startBtn')
    pg.wait_for_timeout(2500)
    pg.screenshot(path=os.path.join(root,'tools','out','smoke.png'))
    print('errors:',errs or 'none')
    b.close()
    assert not errs, 'Game emitted browser errors: ' + '; '.join(errs)
