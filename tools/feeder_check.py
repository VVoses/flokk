from playwright.sync_api import sync_playwright
import os

root = "/tmp/claude-0/-home-claude/d96c0d78-1713-5825-99bd-b3fda5e980ea/scratchpad/flokk"
out = os.path.join(root, "tools", "out", "feeder")
os.makedirs(out, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.join(root, "index.html") + "?dev")
    pg.wait_for_timeout(1000)
    pg.evaluate("genWorld(77021);landLabels()")
    pg.click("#startBtn")
    pg.wait_for_timeout(400)
    # winter, camp the whole flock at the feeder, force a raid to trigger immediately
    pg.evaluate(
        "(()=>{dev.calm();dev.season(3,12);dev.to(FEEDER.x, FEEDER.y-30, 1.6);})()"
    )
    pg.wait_for_timeout(2500)
    pg.screenshot(path=os.path.join(out, "01_before_raid.png"))
    stats0 = pg.evaluate("(()=>({occ: FEEDER.perches.filter(p=>p.occ).length, raider: !!FEEDER.raider}))()")
    print("before:", stats0)

    pg.evaluate("(()=>{FEEDER.raidCool=0;})()")
    pg.wait_for_timeout(1500)
    stats1 = pg.evaluate(
        "(()=>({raider: !!FEEDER.raider, raiderSt: FEEDER.raider&&FEEDER.raider.st, occ: FEEDER.perches.filter(p=>p.occ).length, off: FEEDER.perches.filter(p=>p.off).length}))()"
    )
    print("raid starting:", stats1)
    pg.screenshot(path=os.path.join(out, "02_raid_incoming.png"))

    pg.wait_for_timeout(2000)
    stats2 = pg.evaluate(
        "(()=>({raider: !!FEEDER.raider, raiderSt: FEEDER.raider&&FEEDER.raider.st, occ: FEEDER.perches.filter(p=>p.occ).length, off: FEEDER.perches.filter(p=>p.off).length}))()"
    )
    print("holding feeder:", stats2)
    pg.screenshot(path=os.path.join(out, "03_raid_holding.png"))

    # fast-forward the hold duration
    pg.evaluate("(()=>{if(FEEDER.raider) FEEDER.raider.t=0.05;})()")
    pg.wait_for_timeout(3000)
    stats3 = pg.evaluate(
        "(()=>({raider: !!FEEDER.raider, occ: FEEDER.perches.filter(p=>p.occ).length, off: FEEDER.perches.filter(p=>p.off).length}))()"
    )
    print("after raid:", stats3)
    pg.screenshot(path=os.path.join(out, "04_after_raid.png"))

    print("page errors:", errs if errs else "none")
    b.close()
