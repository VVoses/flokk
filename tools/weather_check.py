"""Weather checks: gusts, blown leaves, a winter storm, fog by day and night, rain on the lake.
Screenshots go to tools/out/weather/; prints frame times and fails on any page error.
usage: python3 tools/weather_check.py [TAG]"""
from playwright.sync_api import sync_playwright
import os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tag = sys.argv[1] if len(sys.argv) > 1 else "w"
out = os.path.join(root, "tools", "out", "weather")
os.makedirs(out, exist_ok=True)

# a spot with broadleaf trees next to open fields, and one on the lake shore
PICK = """(()=>{
  let best=null,bs=-1;
  for(let i=0;i<400;i++){const x=200+Math.random()*(W-400),y=500+Math.random()*(H-1200);
    if(inWater(x,y,40))continue;let n=0;
    for(const t of TREES){if(t.type!=='spruce'&&Math.abs(t.x-x)<380&&Math.abs(t.y-y)<260)n++;}
    const open=[[-250,0],[250,0],[0,200]].filter(([a,b])=>!underTree(x+a,y+b)).length;
    const s=Math.min(n,8)+open*6;if(s>bs){bs=s;best=[x,y];}}
  return best;})()"""
FRAME = """(async()=>{const t=[];let l=performance.now();for(let i=0;i<90;i++){await new Promise(r=>requestAnimationFrame(r));const n=performance.now();t.push(n-l);l=n;}
  t.sort((a,b)=>a-b);return [t[45].toFixed(1),t[80].toFixed(1)];})()"""

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
    spot = pg.evaluate(PICK)
    lake = pg.evaluate("[LAKE.x, LAKE.y - lakeR(-Math.PI/2) - 60]")

    def shot(name, js, wait=4000):
        pg.evaluate(js)
        pg.wait_for_timeout(wait)
        pg.screenshot(path=os.path.join(out, f"{tag}_{name}.png"))
        ft = pg.evaluate(FRAME)
        st = pg.evaluate("({s:WEATHER.s.toFixed(2),g:WEATHER.g.toFixed(2),gust:gustAt(L.x,L.y).toFixed(2),leaves:WEATHER.leaves.length,drift:WEATHER.drift.length,fog:WEATHER.fog.toFixed(2),storm:WEATHER.storm.toFixed(2)})")
        print(name, "frame ms median/p90", ft, st)

    to = f"dev.to({spot[0]},{spot[1]},1.0)"
    shot("summer_breeze", f"dev.calm();dev.season(1,11);{to};RAIN.t=RAIN.target=0;RAIN.next=999;dev.weather({{s:0.9,ang:0.2,fog:0}})")
    shot("summer_gale_calm_ref", f"dev.weather({{s:0.2,ang:0.2,fog:0}})")
    shot("autumn_gale", f"dev.season(2,12);dev.grow(0.5);{to};dev.weather({{s:1.6,ang:0.3,fog:0}})", 6000)
    shot("autumn_gale_rain", "RAIN.t=RAIN.target=0.8", 2500)
    shot("lake_rain", f"dev.season(0,13);dev.to({lake[0]},{lake[1]},1.1);RAIN.t=RAIN.target=0.85;dev.weather({{s:1.0,ang:0.1,fog:0}})", 3000)
    pg.evaluate("RAIN.t=RAIN.target=0;dev.grow()")
    shot("winter_calm_ref", f"dev.season(3,12);{to};dev.weather({{s:0.3,ang:0.2,fog:0}})", 6000)
    shot("winter_storm", f"dev.weather({{s:1.6,ang:3.2,fog:0}})", 9000)
    shot("winter_storm_night", "dev.hour(22)", 3000)
    shot("fog_morning", f"dev.season(2,8);{to};dev.weather({{s:0.15,ang:0.2,fog:0.9}})", 9000)
    shot("fog_night_farm", "dev.hour(23);const f=FARMS[0];dev.to(f.cx,f.cy+80,1.0)", 3000)
    shot("fog_winter_dusk", f"dev.season(3,15.5);{to};dev.weather({{s:0.15,ang:0.2,fog:1}})", 4000)
    shot("clear_ref", "dev.season(1,11);dev.weather({s:0.5,ang:0.2,fog:0})", 6000)
    print("errors:", errs or "none")
    b.close()
    sys.exit(1 if errs else 0)
