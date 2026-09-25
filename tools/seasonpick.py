"""Hidden season picker: triple-tap the year bar, pick a season; from the title it carries into the game."""
from playwright.sync_api import sync_playwright
import os
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));out=os.path.join(root,'tools','out')
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1100,'height':700})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html'));pg.wait_for_timeout(1500)
    q=lambda: pg.evaluate("[st.mode,SEASON,CAL.day,Math.round(CAL.hour),document.getElementById('seasonPick').hidden]")
    print('title',q())
    pg.click('#yearEl',force=True);pg.click('#yearEl',force=True)
    print('two taps: still hidden',q()[4])
    pg.click('#yearEl',force=True);pg.wait_for_timeout(300)
    print("three taps: shown",not q()[4]);pg.screenshot(path=os.path.join(out,'pick_open.png'))
    pg.click('#seasonPick button[data-s="3"]',force=True);pg.wait_for_timeout(500)
    print('picked winter on title',q())
    pg.click('#startBtn');pg.wait_for_timeout(800)
    print('game starts in winter',q(),'win day',pg.evaluate("YEAR_DAYS*CAL.year+st.dayOff"))
    pg.click('#yearEl',force=True);pg.click('#yearEl',force=True);pg.click('#yearEl',force=True);pg.wait_for_timeout(200)
    h=q()[3]
    pg.click('#seasonPick button[data-s="1"]',force=True);pg.wait_for_timeout(4000)
    r=q();print('jump to summer in play',r,'hour kept',abs(r[3]-h)<=1)
    pg.screenshot(path=os.path.join(out,'pick_summer.png'))
    print('errors:',errs or 'none');b.close()
