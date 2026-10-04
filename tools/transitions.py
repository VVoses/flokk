"""Transition matrix: how each element of the land changes through every season change and every dawn and dusk.

DESIGN.md's third pillar says things emerge, they don't switch. This renders a fixed land, frame by frame
through each transition, from a fixed camera per element, and looks for frames where something pops.

  rows     elements: farm, crop field, pasture, forest, lake, shore, road, rail, church and lights, sky and fog,
           overview (see VIEWS)
  columns  transitions: spring->summer, summer->autumn, autumn->winter, winter->spring, and in each season the
           dawn (night->day) and the dusk (day->night)

Everything is deterministic: the world and every frame's random numbers are seeded, game time is faked (the
simulation is not run, only the calendar, the season crossfade and the growth state are stepped, so nothing
wanders between frames and a frame differs from the last only through the transition itself), and
the camera is parked at the element. Frames are drawn on a SwiftShader (software) GPU canvas.

A pop is a step whose change is far out of line with the steps around it, either over the whole view (the sky
flipping) or in one small patch (a lamp, a tree, a field flipping). Per cell the report gives the worst global
and the worst local spike ratio, the game time it happens at, and where in the view.

Writes <out>/sheet_<element>.png (one strip per transition, flagged steps outlined red, change per step plotted
under it), <out>/matrix.png (the whole matrix at a glance), <out>/report.md and <out>/report.json.

usage: python3 tools/transitions.py [--out DIR] [--only farm,lake] [--transitions spring-summer,dawn-winter]
                                    [--seed N] [--quick] [--keep-frames] [--strict]
  --quick   fewer frames per transition (what CI runs)
  --strict  exit 1 if any cell pops (the CI job is non-blocking until that is decided)
CHROMIUM_PATH may point at a Chromium binary."""
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
import argparse, base64, io, json, os, sys, time
import numpy as np

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(root, "tools", "out", "transitions"))
ap.add_argument("--only", default="", help="comma-separated element names")
ap.add_argument("--transitions", default="", help="comma-separated transition names (e.g. spring-summer,dawn-winter)")
ap.add_argument("--seed", type=int, default=424242)
ap.add_argument("--quick", action="store_true")
ap.add_argument("--keep-frames", action="store_true", help="also write every captured frame as a png")
ap.add_argument("--strict", action="store_true")
ap.add_argument("--size", default="480x300")
ap.add_argument("--season-hours", default="12", help="time of day the season changes are looked at, light held there (comma-separated)")
args = ap.parse_args()
VW, VH = map(int, args.size.split("x"))
FW, FH = 256, 160  # captured frame size: the view scaled down (area-averaged), what the metrics and sheets use
os.makedirs(args.out, exist_ok=True)

DAYS_PER_SEASON, DAY_LEN, START_HOUR = 3, 100, 7  # light.js
SEASONS = ["spring", "summer", "autumn", "winter"]
# change-detection thresholds (0..255 grey levels per pixel, over FW x FH frames)
TILE = 16            # px square a local change is measured over
SPIKE = 3.0          # a step this many times the bigger of the two steps beside it ...
G_MIN, T_MIN = 0.8, 9.0   # ... and at least this big (whole view mean, worst tile mean) is a pop
G_FLOOR, T_FLOOR = 0.15, 1.5  # keeps a near-still stretch from turning a hair of change into a "spike"

# the in-page driver. The simulation is not run (update() would move animals, trains and cars between frames and
# bury the transition in noise); only what a transition is made of is stepped, as update() does it.
DRIVER = r"""(() => {
  const rnd = s => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9E3779B9 | 0) >>> 0) / 4294967296;
  const TM = window.TM = {};
  TM.reseed = s => { Math.random = rnd(s); };
  const small = document.createElement('canvas');
  const sg = small.getContext('2d', { willReadFrequently: true });
  // one calendar step the way update() does: time, light, the season crossfade, growth. A smooth season change
  // finishes its background rebuild at once (a fast machine) and the crossfade then runs its 10 s.
  TM.pinT = null;
  TM.sub = dt => {
    CAL.t += dt;
    calUpdate();
    if (TM.pinT !== null) {
      // hold the light at one time of day: the sun, sky and lamps come from a fixed moment, the calendar (season,
      // growth) keeps running, so a season change is seen without the day turning under it
      const real = CAL.t, season = CAL.season, day = CAL.day;
      CAL.t = TM.pinT; calUpdate();
      CAL.t = real; CAL.season = season; CAL.day = day;
    }
    if (TRANS.t < 1 && !BG_JOB) {
      TRANS.t = Math.min(1, TRANS.t + dt / 10);
      if (TRANS.t >= 1) { TRANS.prevG = null; TRANS.prevSPR = null; }
    }
    if (CAL.season !== SEASON) {
      applySeason(CAL.season, true);
      refreshInsects();
      while (BG_JOB) runBgJob();
    }
    growTick(dt);
  };
  TM.advance = (dt) => {
    const n = Math.max(1, Math.round(dt * 30));
    for (let i = 0; i < n; i++) { GROW.mT = 1; TM.sub(dt / n); }
    GROW.mT = 0; growTick(0);
  };
  // go to absolute game time t (seconds) by way of `pre` seconds of steps, so eased state (aurora, light) has settled
  TM.jump = (t, pre, pinT = null) => {
    TM.pinT = pinT;
    t -= pre;   // the pre-roll runs up to t
    CAL.t = t; calUpdate();
    if (pinT !== null) { const season = CAL.season, day = CAL.day; CAL.t = pinT; calUpdate(); CAL.t = t; CAL.season = season; CAL.day = day; }
    applySeason(CAL.season);
    TRANS.t = 1; TRANS.prevG = null; TRANS.prevSPR = null;
    GROW.mT = 0; growTick(0);
    for (let i = 0; i < Math.round(pre * 30); i++) { GROW.mT = 1; TM.sub(1 / 30); }
  };
  // game time (s) of the sun crossing the horizon on a day of a season: [rise, set] as hours into that day
  TM.sunHours = (s, dayInSeason) => {
    const day = s * DAYS_PER_SEASON + dayInSeason; let rise = null, set = null, prev = null;
    for (let h = 0; h <= 24.001; h += 0.02) {
      CAL.t = ((day * 24 + h - START_HOUR) / 24) * DAY_LEN; calUpdate();
      if (prev !== null) { if (prev <= 0 && LIGHT.el > 0 && rise === null) rise = h; if (prev > 0 && LIGHT.el <= 0 && set === null && rise !== null) set = h; }
      prev = LIGHT.el;
    }
    return [rise, set];
  };
  TM.hourT = (s, dayInSeason, h) => (((s * DAYS_PER_SEASON + dayInSeason) * 24 + h - START_HOUR) / 24) * DAY_LEN;
  TM.view = (x, y, z) => { cam.x = x; cam.py = PY(y, 0); cam.z = z; };
  // draw the current view with the same random numbers every time, and hand back the scaled-down frame as bytes
  TM.shot = (fw, fh, seed) => {
    Math.random = rnd(seed);
    render();
    small.width = fw; small.height = fh;
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, fw, fh);
    const d = sg.getImageData(0, 0, fw, fh).data, out = new Uint8Array(fw * fh * 3);
    for (let i = 0, j = 0; i < d.length; i += 4) { out[j++] = d[i]; out[j++] = d[i + 1]; out[j++] = d[i + 2]; }
    let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, i + 8192));
    return btoa(s);
  };
  return true;
})()"""

# where each element is looked at: [world x, world y, zoom], evaluated once on the seeded land
VIEWS = r"""(() => {
  const V = {};
  const f0 = FARMS[0];
  V.farm = [f0.cx, f0.cy - 40, 1.0];
  const area = f => f.w * f.h;
  const near = f => { const c = polyCentroid(f.poly); return Math.hypot(wdx(c[0], f0.cx), c[1] - f0.cy); };
  const pick = pred => FIELDS.filter(pred).sort((a, b) => near(a) - near(b) || area(b) - area(a))[0];
  const crop = pick(f => f.t !== 'pasture' && area(f) > 40000) || pick(f => f.t !== 'pasture') || FIELDS[0];
  const past = pick(f => f.t === 'pasture') || FIELDS[1] || FIELDS[0];
  let c = polyCentroid(crop.poly); V.crops = [c[0], c[1], 1.0];
  c = polyCentroid(past.poly); V.pasture = [c[0], c[1], 1.0];
  let forest = null;
  for (let i = 0; i < 4000 && !forest; i++) {
    const x = Math.random() * W, y = 900 + Math.random() * 1400;
    if (forestness(x, y) > 0.62 && forestness(x, y + 300) < 0.5 && !inWater(x, y, 300)) forest = [x, y + 150, 1.0];
  }
  V.forest = forest || [W / 2, 1200, 1.0];
  V.lake = [LAKE.x, LAKE.y + LAKE.r * 0.7, 1.0];
  V.shore = [W * 0.6, shoreY(W * 0.6) - 200, 1.0];
  const rp = ROAD[(ROAD.length * 0.45) | 0]; V.road = [rp[0], rp[1], 1.1];
  if (RAIL) { const q = RAIL[(RAIL.length / 2) | 0]; V.rail = [q[0], q[1], 1.1]; }
  if (CHURCH) V.church = [CHURCH.b.cx, CHURCH.b.cy + 20, 1.0];
  V.sky = [W * 0.37, 120, 0.8];
  V.overview = [f0.cx, f0.cy + 250, 0.5];
  return V;
})()"""

ELEMENTS = ["farm", "crops", "pasture", "forest", "lake", "shore", "road", "rail", "church", "sky", "overview"]
LABEL = {"farm": "farm", "crops": "crop field", "pasture": "pasture", "forest": "forest", "lake": "lake", "shore": "shore",
         "road": "road", "rail": "railway", "church": "church + lights", "sky": "sky + fog", "overview": "whole land"}


def transitions():
    """[(name, label, kind, season, hour)]: kind season = the change at the turn of that season into the next, the
    light held at `hour`; dawn / dusk = the sun crossing the horizon on the middle day of that season."""
    T = []
    for h in [float(x) for x in args.season_hours.split(",") if x]:
        sfx = "" if h == 12 else f" {h:g}h"
        for s in range(4):
            T.append((f"{SEASONS[s]}-{SEASONS[(s + 1) % 4]}" + sfx.replace(" ", "-"), f"{SEASONS[s]} > {SEASONS[(s + 1) % 4]}{sfx}", "season", s, h))
    for s in range(4):
        T.append((f"dawn-{SEASONS[s]}", f"{SEASONS[s]} night > day", "dawn", s, None))
    for s in range(4):
        T.append((f"dusk-{SEASONS[s]}", f"{SEASONS[s]} day > night", "dusk", s, None))
    return T


def plan(page, kind, s, hour):
    """game times (seconds) to capture, and the label for each (hours or seconds around the event)"""
    q = args.quick
    if kind == "season":
        # the calendar turns the season at midnight (CAL.day), 7 hours short of the day clock's start: START_HOUR
        end = (s + 1) * DAYS_PER_SEASON * DAY_LEN - START_HOUR / 24 * DAY_LEN
        # a few coarse steps of the build-up, then every second (every 2 in --quick) through the flip and the
        # 10 s crossfade that follows it
        fine = 2.0 if q else 1.0
        ts = [end + d for d in (-40, -24, -8)] + list(np.arange(end - 6, end + 14 + 1e-6, fine))
        pin = page.evaluate("([s,h]) => TM.hourT(s + 1, 0, h)", [s, hour])
        return [float(t) for t in ts], [f"{t - end:+.0f}s" for t in ts], pin
    rise, set_ = page.evaluate("([s]) => TM.sunHours(s, 1)", [s])
    ev = rise if kind == "dawn" else set_
    lo, hi = (-1.5, 2.0) if kind == "dawn" else (-2.0, 1.5)
    step = 1 / 3 if q else 1 / 6
    hs = [ev + lo + i * step for i in range(int(round((hi - lo) / step)) + 1)]
    ts = [page.evaluate("([s,h]) => TM.hourT(s, 1, h)", [s, h]) for h in hs]
    return ts, [f"{h - ev:+.1f}h" for h in hs], None


def decode(b64):
    return np.frombuffer(base64.b64decode(b64), dtype=np.uint8).reshape(FH, FW, 3)


def analyse(frames):
    """per step: global mean change, worst-tile mean change; spike ratios against the neighbouring steps"""
    F = np.stack(frames).astype(np.float32)
    d = np.abs(np.diff(F, axis=0)).mean(axis=3)  # (n-1, FH, FW)
    G = d.mean(axis=(1, 2))
    ty, tx = FH // TILE, FW // TILE
    tiles = d[:, : ty * TILE, : tx * TILE].reshape(len(d), ty, TILE, tx, TILE).mean(axis=(2, 4))
    P = tiles.reshape(len(d), -1).max(axis=1)

    def spikes(x, floor):
        # an isolated step: much bigger than the steps either side of it. A crossfade (a smooth bump over
        # several steps) or a long sunrise does not trip this; a change that happens in one step does.
        out = np.zeros(len(x))
        for i in range(len(x)):
            nb = [x[j] for j in (i - 1, i + 1) if 0 <= j < len(x)]
            out[i] = x[i] / (max(nb) + floor) if nb else 0
        return out
    sg, sp = spikes(G, G_FLOOR), spikes(P, T_FLOOR)
    pops = [i for i in range(len(d)) if (sg[i] >= SPIKE and G[i] >= G_MIN) or (sp[i] >= SPIKE and P[i] >= T_MIN)]
    return dict(G=G, P=P, sg=sg, sp=sp, tiles=tiles, pops=pops)


def font(size):
    for f in ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            pass
    return ImageFont.load_default()


def strip(frames, labels, res, thumbs=8):
    """one transition's strip: evenly spaced frames (plus every flagged step), change-per-step plot under it"""
    n = len(frames)
    idx = sorted(set(np.linspace(0, n - 1, thumbs).round().astype(int)) | {i + 1 for i in res["pops"]} | {i for i in res["pops"]})
    TW, TH = 160, 100
    W = 150 + len(idx) * (TW + 3)
    im = Image.new("RGB", (W, TH + 46), (18, 20, 22))
    dr = ImageDraw.Draw(im)
    f, fs = font(11), font(9)
    for k, i in enumerate(idx):
        t = Image.fromarray(frames[i]).resize((TW, TH), Image.LANCZOS)
        im.paste(t, (150 + k * (TW + 3), 0))
        popped = (i - 1) in res["pops"]
        dr.text((152 + k * (TW + 3), 2), labels[i], fill=(255, 235, 140), font=fs)
        if popped:
            dr.rectangle((150 + k * (TW + 3), 0, 150 + k * (TW + 3) + TW - 1, TH - 1), outline=(255, 50, 50), width=3)
    # change per step (global blue, worst tile orange), pops red; one column per step across the strip width
    gx0, gx1, gy0, gy1 = 150, W - 4, TH + 4, TH + 42
    dr.rectangle((gx0, gy0, gx1, gy1), outline=(60, 64, 68))
    m = max(res["G"].max() * 1.0, res["P"].max() * 0.35, 1e-3)
    n1 = len(res["G"])
    pts = lambda arr, sc: [(gx0 + 2 + (gx1 - gx0 - 4) * i / max(1, n1 - 1), gy1 - 2 - (gy1 - gy0 - 4) * min(1, arr[i] * sc / m)) for i in range(n1)]
    dr.line(pts(res["P"], 0.35), fill=(240, 150, 60), width=1)
    dr.line(pts(res["G"], 1.0), fill=(90, 170, 255), width=2)
    for i in res["pops"]:
        x = gx0 + 2 + (gx1 - gx0 - 4) * i / max(1, n1 - 1)
        dr.line((x, gy0 + 1, x, gy1 - 1), fill=(255, 50, 50), width=1)
    return im


def main():
    t0 = time.time()
    only = set(filter(None, args.only.split(",")))
    onlyT = set(filter(None, args.transitions.split(",")))
    trs = [t for t in transitions() if not onlyT or t[0] in onlyT]
    kw = {}
    if os.environ.get("CHROMIUM_PATH"):
        kw["executable_path"] = os.environ["CHROMIUM_PATH"]
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"], **kw)
        except Exception as e:  # the pip Playwright and the installed Chromium can disagree on a revision
            import glob
            c = glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome")
            if not c:
                raise
            b = p.chromium.launch(executable_path=c[0], args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": VW, "height": VH})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        # the game's own loop would run update() between our frames; it never gets to start
        pg.add_init_script("window.requestAnimationFrame=()=>0;")
        pg.goto("file://" + os.path.join(root, "index.html") + "?dev")
        pg.wait_for_timeout(800)
        pg.evaluate(DRIVER)
        pg.evaluate("TM.reseed(7)")
        pg.evaluate(f"genWorld({args.seed});landLabels()")
        pg.evaluate("TM.reseed(8)")
        pg.evaluate("document.getElementById('startBtn').click()")
        pg.evaluate("(()=>{dev.calm();st.mode='pause';lastDt=1;dev.weather({s:0.5,ang:0.2,fog:0.3});RAIN.t=RAIN.target=0;RAIN.next=1e9;for(const o of ['titleOv','pauseOv']){const e=document.getElementById(o);if(e)e.hidden=true}})()")
        views = pg.evaluate(VIEWS)
        elements = [e for e in ELEMENTS if e in views and (not only or e in only)]
        print(f"seed {args.seed}, {VW}x{VH}, elements {elements}")
        results = {}   # (element, transition) -> analysis
        sheets = {e: [] for e in elements}
        for (name, label, kind, s, hour) in trs:
            ts, labels, pin = plan(pg, kind, s, hour)
            frames = {e: [] for e in elements}
            pg.evaluate("([t, pin]) => TM.jump(t, 4, pin)", [ts[0], pin])
            for k, t in enumerate(ts):
                if k:
                    pg.evaluate("([dt]) => TM.advance(dt)", [t - ts[k - 1]])
                for e in elements:
                    x, y, z = views[e]
                    pg.evaluate("([x,y,z]) => TM.view(x,y,z)", [x, y, z])
                    frames[e].append(decode(pg.evaluate("([w,h]) => TM.shot(w,h,99)", [FW, FH])))
            for e in elements:
                r = analyse(frames[e])
                r["labels"] = labels
                results[(e, name)] = r
                sheets[e].append((label, strip(frames[e], labels, r)))
                if args.keep_frames:
                    d = os.path.join(args.out, "frames", e, name)
                    os.makedirs(d, exist_ok=True)
                    for i, fr in enumerate(frames[e]):
                        Image.fromarray(fr).save(os.path.join(d, f"{i:02d}_{labels[i]}.png"))
            npop = sum(1 for e in elements if results[(e, name)]["pops"])
            print(f"{name:16s} {len(ts)} steps x {len(elements)} views   pops in {npop} elements   [{time.time() - t0:.0f}s]")
        b.close()
    report(elements, trs, results, sheets, errs)
    pops = sum(1 for r in results.values() if r["pops"])
    print(f"{pops} of {len(results)} cells pop; page errors: {errs or 'none'}; {time.time() - t0:.0f}s")
    sys.exit(1 if errs or (args.strict and pops) else 0)


def where(r, i):
    t = r["tiles"][i]
    ty, tx = np.unravel_index(np.argmax(t), t.shape)
    return f"{int((tx + 0.5) * TILE / FW * 100)}%,{int((ty + 0.5) * TILE / FH * 100)}%"


def report(elements, trs, results, sheets, errs):
    f, fb = font(11), font(12)
    # sheets, one per element
    for e in elements:
        rows = sheets[e]
        w = max(im.width for _, im in rows)
        sh = Image.new("RGB", (w, sum(im.height + 4 for _, im in rows) + 22), (18, 20, 22))
        dr = ImageDraw.Draw(sh)
        dr.text((6, 4), f"{LABEL[e]}: frames through each transition (red = flagged pop; blue = change per step, orange = worst patch)", fill=(230, 230, 230), font=fb)
        y = 22
        for label, im in rows:
            sh.paste(im, (0, y))
            dr.text((6, y + 40), label, fill=(240, 240, 240), font=fb)
            y += im.height + 4
        sh.save(os.path.join(args.out, f"sheet_{e}.png"))
    # matrix overview: colour = worst spike ratio (green calm .. red pop), number = ratio
    cw, ch, lw, th = 74, 34, 120, 62
    mx = Image.new("RGB", (lw + cw * len(trs), th + ch * len(elements)), (18, 20, 22))
    dr = ImageDraw.Draw(mx)
    for j, (name, label, kind, s, hour) in enumerate(trs):
        top = SEASONS[s][:6] if kind != "season" else SEASONS[s][:3] + ">" + SEASONS[(s + 1) % 4][:3]
        dr.text((lw + j * cw + 4, 8), top, fill=(220, 220, 220), font=f)
        dr.text((lw + j * cw + 4, 24), "dawn" if kind == "dawn" else "dusk" if kind == "dusk" else (f"{hour:g}h" if hour != 12 else "noon"), fill=(160, 170, 180), font=f)
    for i, e in enumerate(elements):
        dr.text((6, th + i * ch + 10), LABEL[e], fill=(220, 220, 220), font=f)
        for j, (name, *_rest) in enumerate(trs):
            r = results[(e, name)]
            s = max(r["sg"].max(), r["sp"].max())
            k = min(1, max(0, (s - 1.5) / (SPIKE * 2 - 1.5)))
            col = (int(40 + 200 * k), int(120 - 80 * k), int(70 - 30 * k)) if not r["pops"] else (225, 50, 50)
            x, y = lw + j * cw, th + i * ch
            dr.rectangle((x + 1, y + 1, x + cw - 2, y + ch - 2), fill=col)
            dr.text((x + 6, y + 10), f"{s:.1f}" + (" POP" if r["pops"] else ""), fill=(255, 255, 255), font=f)
    mx.save(os.path.join(args.out, "matrix.png"))
    # machine and human readable
    js, lines = {"seed": args.seed, "size": [VW, VH], "thresholds": dict(spike=SPIKE, g_min=G_MIN, tile_min=T_MIN), "cells": []}, []
    lines += ["# Transition matrix", "", f"seed {args.seed}, {VW}x{VH}. A cell pops when one step's change is >= {SPIKE:g}x the bigger of the steps either side of it "
              f"and at least {G_MIN:g} (whole view) or {T_MIN:g} (worst {TILE}px patch) grey levels.", ""]
    for e in elements:
        for (name, label, kind, s, hour) in trs:
            r = results[(e, name)]
            cell = dict(element=e, transition=name, steps=len(r["G"]) + 1, worst_global_spike=round(float(r["sg"].max()), 2),
                        worst_patch_spike=round(float(r["sp"].max()), 2), pops=[])
            for i in r["pops"]:
                cell["pops"].append(dict(between=[r["labels"][i], r["labels"][i + 1]], global_change=round(float(r["G"][i]), 2),
                                         global_spike=round(float(r["sg"][i]), 1), patch_change=round(float(r["P"][i]), 1),
                                         patch_spike=round(float(r["sp"][i]), 1), patch_at=where(r, i)))
            js["cells"].append(cell)
    popped = [c for c in js["cells"] if c["pops"]]
    lines += [f"**{len(popped)} of {len(js['cells'])} cells pop.**", ""]
    if popped:
        lines += ["| element | transition | between | whole view | worst patch | patch at (x,y of view) |", "|---|---|---|---|---|---|"]
        for c in popped:
            for p in c["pops"]:
                lines.append(f"| {LABEL[c['element']]} | {c['transition']} | {p['between'][0]} to {p['between'][1]} | "
                             f"{p['global_change']} (x{p['global_spike']}) | {p['patch_change']} (x{p['patch_spike']}) | {p['patch_at']} |")
    json.dump(js, open(os.path.join(args.out, "report.json"), "w"), indent=1)
    open(os.path.join(args.out, "report.md"), "w").write("\n".join(lines) + "\n")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
