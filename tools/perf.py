"""Frame-cost profile across seasons, times of day and weather.
For each scene: median/p90 frame interval with the frame-rate cap lifted (so it is the real cost of a frame,
script plus canvas raster), the script time of update() and render(), the heap the frames churn through, and
which draw functions the render time goes to (inclusive, so nested ones overlap; mean ms per frame).
Script costs are clearest at --dpr 0.25 (the same view, a sixteenth of the pixels to fill), pixel costs at
--dpr 1 or 2. On a software canvas Chrome rasterises in bursts, so one draw call can show the whole frame's
fill cost; compare whole frames there, not single functions.
usage: python3 tools/perf.py [--dpr 2] [--frames 150] [--only name,name] [--json out.json]"""
from playwright.sync_api import sync_playwright
import argparse, json, os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--dpr", type=float, default=1)
ap.add_argument("--root", default=root, help="profile another checkout (e.g. a worktree of main) for a before/after")
ap.add_argument("--frames", type=int, default=150)
ap.add_argument("--only", default="")
ap.add_argument("--json", default="")
ap.add_argument("--soft", action="store_true", help="software canvas instead of a (SwiftShader-emulated) GPU canvas")
ap.add_argument("--fns", type=int, default=12, help="how many of the costliest draw functions to list")
args = ap.parse_args()

# every top-level draw/apply/render function is a global; wrap them to time where render() spends its time
HOOK = """(()=>{
  const P = window.PERF = { fn: {}, on: false, last: {} };
  const names = Object.getOwnPropertyNames(window).filter(n => /^(draw|apply|render|grow|weather|update|paint|seamStrip|softPuff|mk2Tint)/.test(n) && typeof window[n] === 'function' && !/^(requestAnimationFrame)$/.test(n));
  for (const n of names) {
    const f = window[n];
    if (f.__perf) continue;
    const w = function () {
      if (!P.on) return f.apply(this, arguments);
      const t0 = performance.now();
      try { return f.apply(this, arguments); } finally {
        const d = performance.now() - t0, r = P.fn[n] || (P.fn[n] = [0, 0]);
        r[0] += d; r[1]++;
        if (n === 'update' || n === 'render') P.last[n] = d;
      }
    };
    w.__perf = 1;
    window[n] = w;
  }
  return names.length;
})()"""

MEASURE = """(async (n)=>{
  const P = PERF; P.fn = {}; const iv = [], up = [], rd = []; let alloc = 0, gcs = 0;
  let l = performance.now(), h0 = performance.memory.usedJSHeapSize;
  P.on = true;
  for (let i = 0; i < n; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const t = performance.now(); iv.push(t - l); l = t;
    up.push(P.last.update || 0); rd.push(P.last.render || 0);
    const h = performance.memory.usedJSHeapSize;
    if (h >= h0) alloc += h - h0; else gcs++;
    h0 = h;
  }
  P.on = false;
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
  const fn = Object.entries(P.fn).map(([k, [ms, c]]) => [k, +(ms / n).toFixed(3), +(c / n).toFixed(1)]).sort((a, b) => b[1] - a[1]);
  return { med: q(iv, 0.5), p90: q(iv, 0.9), update: q(up, 0.5), render: q(rd, 0.5), renderP90: q(rd, 0.9), allocKBperFrame: +(alloc / n / 1024).toFixed(1), gcs, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), fn };
})"""

# canvases the game keeps (sprites, ground, light maps): count and pixel memory
CANVASES = """(()=>{let n=0,px=0;for(const c of (window.__CVS||[])){const d=c.deref&&c.deref();if(!d)continue;n++;px+=d.width*d.height;}return {canvases:n, canvasMB:+(px*4/1048576).toFixed(1)};})()"""
INIT = """(()=>{window.__CVS=[];const ce=Document.prototype.createElement;Document.prototype.createElement=function(t){const e=ce.apply(this,arguments);if(String(t).toLowerCase()==='canvas')window.__CVS.push(new WeakRef(e));return e;};})()"""

PICK = """(()=>{
  let best=null,bs=-1;
  for(let i=0;i<400;i++){const x=200+Math.random()*(W-400),y=500+Math.random()*(H-1200);
    if(inWater(x,y,40))continue;let n=0;
    for(const t of TREES){if(t.type!=='spruce'&&Math.abs(t.x-x)<380&&Math.abs(t.y-y)<260)n++;}
    const open=[[-250,0],[250,0],[0,200]].filter(([a,b])=>!underTree(x+a,y+b)).length;
    const s=Math.min(n,8)+open*6;if(s>bs){bs=s;best=[x,y];}}
  return best;})()"""

with sync_playwright() as p:
    # a real browser draws the canvas on the GPU; SwiftShader stands in for one here, so the frame interval
    # counts GPU work (fill, blending) the way a player's machine would, only slower
    gpu = [] if args.soft else ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    b = p.chromium.launch(channel="chromium", args=gpu + ["--disable-gpu-vsync", "--disable-frame-rate-limit", "--enable-precise-memory-info", "--js-flags=--expose-gc"])
    pg = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=args.dpr)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT)
    pg.goto("file://" + os.path.join(args.root, "index.html") + "?dev")
    pg.wait_for_timeout(1200)
    pg.evaluate("Math.random=(()=>{let s=12345;return()=>((s=Math.imul(s^(s>>>15),2246822507)+0x9E3779B9|0)>>>0)/4294967296})()")
    pg.evaluate("genWorld(99001);landLabels()")
    pg.click("#startBtn")
    pg.wait_for_timeout(400)
    pg.evaluate(HOOK)
    spot = pg.evaluate(PICK)
    lake = pg.evaluate("[LAKE.x, LAKE.y - lakeR(-Math.PI/2) - 60]")
    farm = pg.evaluate("[FARMS[0].cx, FARMS[0].cy+80]")
    to = f"dev.to({spot[0]},{spot[1]},1.0)"
    dry = "RAIN.t=RAIN.target=0;RAIN.next=1e9;"
    scenes = [
        ("spring_morning", f"dev.calm();dev.season(0,9);{to};{dry}dev.weather({{s:0.6,ang:0.2,fog:0}})", 5000),
        ("summer_noon", f"dev.season(1,12);{to};{dry}dev.weather({{s:0.8,ang:0.2,fog:0}})", 5000),
        ("summer_evening", "dev.hour(20.5)", 2500),
        ("autumn_gale_rain", f"dev.season(2,13);{to};RAIN.t=RAIN.target=0.85;RAIN.next=1e9;dev.weather({{s:1.6,ang:0.3,fog:0}})", 6000),
        ("lake_rain", f"dev.season(0,13);dev.to({lake[0]},{lake[1]},1.1);RAIN.t=RAIN.target=0.85;dev.weather({{s:1.0,ang:0.1,fog:0}})", 4000),
        ("fog_morning", f"dev.season(2,8);{to};{dry}dev.weather({{s:0.15,ang:0.2,fog:0.9}})", 9000),
        ("fog_night_farm", f"dev.hour(23);dev.to({farm[0]},{farm[1]},1.0)", 3000),
        ("winter_noon", f"dev.season(3,12);{to};{dry}dev.weather({{s:0.3,ang:0.2,fog:0}})", 7000),
        ("winter_storm", "dev.weather({s:1.6,ang:3.2,fog:0})", 9000),
        ("winter_storm_night", "dev.hour(22)", 3000),
        ("farm_summer_breeze", f"dev.season(1,14);dev.to({farm[0]},{farm[1]},1.0);{dry}dev.weather({{s:1.0,ang:0.2,fog:0}});dev.zoom(null)", 4000),
        ("zoomed_out", f"dev.season(1,15);{to};{dry}dev.weather({{s:0.6,ang:0.2,fog:0}});dev.zoom(0.72)", 4000),
    ]
    only = set(filter(None, args.only.split(",")))
    out = {}
    print(f"{'software' if args.soft else 'GPU'} canvas, dpr {args.dpr}, {args.frames} frames per scene; ms per frame (uncapped), KB of heap allocated per frame")
    for name, js, wait in scenes:
        pg.evaluate(js)
        pg.wait_for_timeout(wait)
        if only and name not in only:
            continue
        pg.evaluate("gc&&gc()")
        r = pg.evaluate(MEASURE, args.frames)
        out[name] = r
        top = "  ".join(f"{k} {ms:.2f}" for k, ms, c in r["fn"][: args.fns] if k not in ("render", "update"))
        fmap = {k: ms for k, ms, c in r["fn"]}
        print(f"{name:20s} frame {r['med']:6.2f} / p90 {r['p90']:6.2f}   update {r['update']:5.2f}  render {r['render']:5.2f} (p90 {r['renderP90']:5.2f})   alloc {r['allocKBperFrame']:6.1f}KB  gc {r['gcs']}")
        print("    " + top)
    # an autosave runs every 5 s while playing; it is one frame's work, so it shows as a hitch
    mem = pg.evaluate(CANVASES)
    mem["saveMs"] = pg.evaluate("(()=>{saveSession();const t=performance.now();for(let i=0;i<5;i++)saveSession();return +((performance.now()-t)/5).toFixed(1)})()")
    mem["heapMB"] = pg.evaluate("+(performance.memory.usedJSHeapSize/1048576).toFixed(1)")
    print("memory:", mem)
    out["_memory"] = mem
    if args.json:
        json.dump(out, open(args.json, "w"), indent=1)
    print("errors:", errs or "none")
    b.close()
    sys.exit(1 if errs else 0)
