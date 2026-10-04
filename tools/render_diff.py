"""Does a change leave the picture alone? Renders the same frames from two checkouts and compares pixels.
Each run seeds Math.random, fakes the clock, stops the animation loop and steps update()/render() by hand, so
two checkouts that draw the same thing give the same bytes. Prints the share of pixels that differ and the
largest per-channel difference (out of 255); optionally saves the frames and a before/after strip.
usage: python3 tools/render_diff.py --base /path/to/other/checkout [--only name,name] [--out dir] [--dpr 1]"""
from playwright.sync_api import sync_playwright
import argparse, base64, io, os, sys
from PIL import Image, ImageChops

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True, help="the checkout to compare against (e.g. a worktree of main)")
ap.add_argument("--root", default=root)
ap.add_argument("--only", default="")
ap.add_argument("--out", default="", help="save <scene>_before/after/diff png here")
ap.add_argument("--dpr", type=float, default=1)
ap.add_argument("--steps", type=int, default=90, help="update/render steps before the frame is taken")
args = ap.parse_args()

SEED = "Math.random=(()=>{let s=12345;return()=>((s=Math.imul(s^(s>>>15),2246822507)+0x9E3779B9|0)>>>0)/4294967296})()"
INIT = SEED + """;(()=>{
  let fake = 1000; const pn = performance.now.bind(performance);
  performance.now = () => fake; Date.now = () => 1.7e12 + fake;
  window.__tick = ms => { fake += ms; };
  window.requestAnimationFrame = () => 0;
})()"""
north = "dev.to(W*0.5,330,1.0);"
dry = "RAIN.t=RAIN.target=0;RAIN.next=1e9;"
crowd = "dev.crowd(80,3,2);"
SCENES = [
    ("autumn_fog_north", f"dev.season(2,8);{north}{dry}dev.weather({{s:0.15,ang:0.2,fog:0.9}});{crowd}"),
    ("winter_fog_north", f"dev.season(3,11);{north}dev.weather({{s:0.6,ang:0.2,fog:0.9}});{crowd}"),
    ("night_north", f"dev.season(2,8);dev.hour(22);{north}{dry}dev.weather({{s:0.15,ang:0.2,fog:0.9}});{crowd}"),
    ("summer_dusk", f"dev.calm();dev.season(1,20.2);dev.to(W*0.5,1500,1.0);{dry}dev.weather({{s:0.8,ang:0.2,fog:0}})"),
    ("summer_noon", f"dev.calm();dev.season(1,12);dev.to(W*0.5,1500,1.0);{dry}dev.weather({{s:0.8,ang:0.2,fog:0}})"),
    ("spring_leafout", f"dev.calm();dev.season(0,9);dev.to(W*0.5,1500,1.0);{dry}dev.weather({{s:0.5,ang:0.2,fog:0}});dev.grow(0.45)"),
    ("boat_noon", f"dev.calm();dev.season(1,12);dev.to(BOAT.x,BOAT.y+60,1.0);{dry}dev.weather({{s:0.8,ang:0.2,fog:0}})"),
    ("autumn_leaffall", f"dev.calm();dev.season(2,15);dev.to(W*0.5,1500,1.0);{dry}dev.weather({{s:1.2,ang:0.3,fog:0}});dev.grow(0.8)"),
]
only = set(filter(None, args.only.split(",")))


def shoot(pg, js, steps):
    pg.evaluate(js)
    pg.evaluate("(n)=>{for(let i=0;i<n;i++){__tick(16.7);update(0.0167);render();}}", steps)
    return pg.evaluate("document.querySelector('canvas').toDataURL('image/png')")


def run(p, checkout):
    # one fresh page per scene: what one scene leaves behind (flocks, weather, timers) must not reach the next
    b = p.chromium.launch(channel="chromium", args=["--disable-gpu"])
    out, errs = {}, []
    for name, js in SCENES:
        if only and name not in only:
            continue
        pg = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=args.dpr)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.add_init_script(INIT)
        pg.goto("file://" + os.path.join(checkout, "index.html") + "?dev")
        pg.wait_for_timeout(1000)
        pg.evaluate(SEED)
        pg.evaluate("genWorld(99001);landLabels()")
        pg.click("#startBtn")
        pg.wait_for_timeout(300)
        pg.evaluate(SEED)
        out[name] = shoot(pg, js, args.steps)
        pg.close()
    b.close()
    return out, errs


def png(url):
    return Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")


with sync_playwright() as p:
    before, e0 = run(p, args.base)
    after, e1 = run(p, args.root)
bad = 0
for name in before:
    a, b = png(before[name]), png(after[name])
    d = ImageChops.difference(a, b)
    px = sum(1 for v in d.convert("L").tobytes() if v)
    mx = max(max(ch.getextrema()) for ch in d.split())
    tot = a.width * a.height
    print(f"{name:18s} {px:8d} of {tot} pixels differ ({100 * px / tot:.4f}%), largest channel difference {mx}/255")
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        a.save(os.path.join(args.out, f"{name}_before.png"))
        b.save(os.path.join(args.out, f"{name}_after.png"))
    bad += mx > 2
print("errors:", (e0 + e1) or "none")
sys.exit(1 if bad or e0 or e1 else 0)
