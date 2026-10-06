"""Wrapped water phase, single surface pass, shader and gust foam regression checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = root / 'tools/out/water'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1000, 'height': 700})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
    page.wait_for_function('!MENU_JOB && birds.length')
    page.click('#startBtn')
    page.wait_for_function("st.mode==='play' && !MENU_JOB")
    page.evaluate("st.mode='pause';hideBanner();dev.season(1,13);dev.to(W-18,H+550,.8);WEATHER.s=1.2;WEATHER.gc=1;WEATHER.gs=0;WX=0;gustTick(0);render();")
    assert page.evaluate('''(() => {
      const f=[[.0091,.0127],[.021,-.017],[.043,.037]];
      const maxWarp=1.5*WAVE_WARP.reduce((sum,a,i)=>sum+a*Math.hypot(...f[i]),0);
      return maxWarp < TAU/Math.max(...WAVE_TR.LAM)*.5;
    })()'''), 'curvature cannot cancel or reverse the underlying wave slope'
    assert page.evaluate("waveX(W-10)===waveX(-10)"), 'neighbouring copies share phase'
    assert page.evaluate("""(() => {
      const x=cam.x, phase=waveX(x), a={...waveAt(x,H+550)};
      worldShift(-W);gustTick(0);
      const b={...waveAt(x-W,H+550)};
      return Math.abs(phase-waveX(x-W))<1e-8 && Object.keys(a).every(k=>Math.abs(a[k]-b[k])<1e-8);
    })()"""), 'recentering preserves water height and normal'
    assert page.evaluate("""(() => {
      const old=drawWaves;let n=0;drawWaves=c=>{n++;old(c);};render();drawWaves=old;return n===1;
    })()"""), 'one surface pass at map seam'
    print('ok wrapped phase, recentering, and single surface pass')
    assert page.evaluate('''(() => {
      const old=TREES.slice(),tree={x:LAKE.x,y:LAKE.y-lakeR(-Math.PI/2)-55,k:1.2,gh:false};
      TREES.length=0;TREES.push(tree);REFLsrc=null;
      const beyondOldStrip=!inBlob(tree.x,tree.y+34,LAKE,lakeR,-4);
      const selected=reflTrees().some(r=>r.t===tree&&r.c===LAKE);
      TREES[0]={...tree,x:tree.x+.1};
      const refreshed=reflTrees().some(r=>r.t===TREES[0]);
      TREES.length=0;for(const t of old)TREES.push(t);REFLsrc=null;
      return beyondOldStrip&&selected&&refreshed;
    })()'''), 'mirrored canopy reaches water beyond the old fixed shoreline strip'
    for gpu in [False, True]:
        result = page.evaluate("""gpu => {
          WAVES_GL.gl=null;WAVES_GL.tried=!gpu;DEV.glWaves=gpu;
          const gl=gpu?waveGLInit():null;
          render();return !gpu || !!gl;
        }""", gpu)
        assert result, 'WebGL water shader compiles'
        page.screenshot(path=str(out / ('shader.png' if gpu else 'canvas.png')))
    assert page.evaluate("""(() => {
      const original=gustAt;let strokes=0;
      const c={save(){},restore(){},beginPath(){},moveTo(){},quadraticCurveTo(){},stroke(){strokes++;}};
      gustAt=()=>0;drawGustFoam(c);const lull=strokes;
      gustAt=()=>1;drawGustFoam(c);const gust=strokes;
      WEATHER.s=0;drawGustFoam(c);const calm=strokes;
      WEATHER.s=1.2;dev.season(3,13);drawGustFoam(c);
      const frozen=strokes;dev.season(1,13);gustAt=original;
      return lull===0 && gust>0 && calm===gust && frozen===gust;
    })()"""), 'foam follows gusts and stays absent in calm or frozen water'
    print('ok shader compilation and gust/calm/frozen foam')
    for name in ['LAKE', 'POND']:
        page.evaluate(f'dev.to({name}.x,{name}.y,.9);render();')
        page.screenshot(path=str(out / (name.lower() + '.png')))
    assert not errors, errors
    browser.close()
