"""Targeted checks for the rain feature. Writes tools/out/rain/*.png"""
from playwright.sync_api import sync_playwright
import os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(root, "tools", "out", "rain")
os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.join(root, "index.html") + "?dev")
    pg.wait_for_timeout(1200)
    pg.evaluate("genWorld(99001);landLabels()")
    pg.click("#startBtn")
    pg.wait_for_timeout(400)

    # 1) force a heavy shower in spring, farm view, daytime
    pg.evaluate(
        "(()=>{dev.calm();dev.season(0,12);const p=[FARMS[0].cx,FARMS[0].cy-60];dev.to(p[0],p[1],1.0);RAIN.t=0.9;RAIN.target=0.9;RAIN.next=999;})()"
    )
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(out, "01_spring_heavy_rain.png"))

    # 2) force thunder flash right now and grab a frame
    pg.evaluate("(()=>{THUNDER.flash=1;})()")
    pg.wait_for_timeout(50)
    pg.screenshot(path=os.path.join(out, "02_thunder_flash.png"))
    pg.wait_for_timeout(600)
    pg.screenshot(path=os.path.join(out, "03_after_flash_fades.png"))

    # 3) light drizzle for contrast
    pg.evaluate("(()=>{RAIN.t=0.15;RAIN.target=0.15;RAIN.next=999;})()")
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(out, "04_light_drizzle.png"))

    # 4) winter: rain should never show even if forced, snow system covers precip instead
    pg.evaluate(
        "(()=>{dev.season(3,12);const p=[FARMS[0].cx,FARMS[0].cy-60];dev.to(p[0],p[1],1.0);RAIN.t=0.9;RAIN.target=0.9;RAIN.next=999;})()"
    )
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(out, "05_winter_no_rain.png"))

    # 5) clear sky for baseline comparison (spring, no rain)
    pg.evaluate(
        "(()=>{dev.season(0,12);const p=[FARMS[0].cx,FARMS[0].cy-60];dev.to(p[0],p[1],1.0);RAIN.t=0;RAIN.target=0;RAIN.next=999;})()"
    )
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(out, "06_spring_clear.png"))

    # 6) laundry gating: clear vs rainy at the yard clothesline
    pg.evaluate(
        "(()=>{dev.season(0,12);RAIN.t=0;RAIN.target=0;RAIN.next=999;const y=FARMS.find(f=>f.line);dev.to(y?y.cx:FARMS[0].cx,(y?y.cy:FARMS[0].cy)-40,1.4);})()"
    )
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(out, "07_yard_clear.png"))
    pg.evaluate("(()=>{RAIN.t=0.8;RAIN.target=0.8;RAIN.next=999;})()")
    pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(out, "08_yard_rain.png"))

    stats = pg.evaluate(
        "(()=>({rain:LIGHT.rain, season:SEASON, hasThunder: typeof thunder==='function', hasRng: !!(amb && amb.rng && amb.rng2)}))()"
    )
    print("stats:", stats)
    print("page errors:", errs if errs else "none")
    b.close()
