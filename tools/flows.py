"""End-to-end check of every screen and transition. Screenshots in tools/out/flow_*.png."""
from playwright.sync_api import sync_playwright
import os,sys
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));out=os.path.join(root,'tools','out');os.makedirs(out,exist_ok=True)
fails=[]
def check(name,cond):
    print(('ok   ' if cond else 'FAIL ')+name)
    if not cond:fails.append(name)
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':1200,'height':760})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    vis=lambda sel:pg.evaluate(f"!document.querySelector('{sel}').hidden")
    shot=lambda n:pg.screenshot(path=os.path.join(out,'flow_'+n+'.png'))
    def catch_all_and_wait_over(timeout=10000):
        # catching the last bird sets a real-time countdown (st.overT, ~1.3s) before the game
        # actually flips to 'over'; each frame's dt is capped at 33ms, so on a slow/loaded
        # renderer (seen in sandboxed/CI runs) that countdown can take much longer than 1.3s of
        # wall clock. Poll for the real transition instead of guessing a fixed sleep.
        pg.evaluate("(()=>{const h=dev.hawk();for(const b of birds.slice())catchBird(h,b)})()")
        try:
            pg.wait_for_function("st.mode=='over'",timeout=timeout)
        except Exception:
            pass
    pg.goto('file://'+os.path.join(root,'index.html')+'?dev');pg.wait_for_timeout(1500)
    check('standards mode',pg.evaluate("document.compatMode")=='CSS1Compat')
    check('title shown',vis('#titleOv'));shot('title')
    clock=pg.evaluate("(()=>{const d=Date.now,at=t=>{Date.now=()=>t;seedCalls=0;return newSeed()};const r=[at(1.7e12),at(1.7e12),at(1.7e12+1)];Date.now=d;return r})()")
    check('new land seed comes from the clock',clock[0]==clock[1] and clock[0]!=clock[2])
    pg2=b.new_page();pg2.goto('file://'+os.path.join(root,'index.html')+'?seed=1234');pg2.wait_for_timeout(800)
    check('?seed pins the land',pg2.evaluate("SEED")==1234 and pg2.evaluate("newSeed()")==1234);pg2.close()
    pg.click('#newLandBtn');pg.wait_for_timeout(1500)
    check('new land on title keeps title',vis('#titleOv'))
    pg.click('#startBtn');pg.wait_for_timeout(800)
    check('playing',pg.evaluate("st.mode")=='play' and not vis('#titleOv'))
    pg.keyboard.down('KeyD');pg.wait_for_timeout(700);pg.keyboard.up('KeyD')
    check('keyboard steers',pg.evaluate("Math.hypot(L.vx,L.vy)")>30)
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
    check('escape pauses',pg.evaluate("st.mode")=='pause' and vis('#pauseOv'));shot('pause')
    pg.click('#resumeBtn');pg.wait_for_timeout(300)
    check('resume',pg.evaluate("st.mode")=='play' and not vis('#pauseOv'))
    pg.click('#pauseBtn');pg.wait_for_timeout(200);check('pause button',pg.evaluate("st.mode")=='pause');pg.keyboard.press('Escape');pg.wait_for_timeout(200);check('escape resumes',pg.evaluate("st.mode")=='play')
    pg.click('#muteBtn');pg.wait_for_timeout(200)
    check('mute',pg.evaluate("muted&&(!master||master.gain.value===0)"));pg.click('#muteBtn');pg.wait_for_timeout(200)
    check('unmute',pg.evaluate("!muted"))
    # the flock is taken, one bird at a time
    catch_all_and_wait_over()
    check('game over after last bird',pg.evaluate("st.mode")=='over' and vis('#overOv'));shot('over')
    pg.click('#againBtn');pg.wait_for_timeout(800)
    check('fly again',pg.evaluate("st.mode")=='play' and pg.evaluate("birds.length")==6)
    pg.evaluate("(()=>{st.energy=0;st.starveT=0})()");pg.wait_for_timeout(1000)
    check('starving costs birds',pg.evaluate("birds.length")<6)
    pg.evaluate("(()=>{st.energy=.9})()")
    # a whole year: crossing the year boundary still takes several frames of simulated time
    # (dt capped at 33ms/frame), so poll rather than sleep a fixed amount (see catch_all_and_wait_over)
    pg.evaluate("CAL.t=YEAR_DAYS*DAY_LEN-0.3")
    try:
        pg.wait_for_function("st.mode=='won'",timeout=8000)
    except Exception:
        pass
    check('year won',pg.evaluate("st.mode")=='won' and vis('#wonOv'));shot('won')
    pg.click('#keepBtn');pg.wait_for_timeout(800)
    check('keep flying: year 2, spring',pg.evaluate("[st.mode,CAL.year,SEASON]")==['play',2,0])
    # a second flight must reach its own ending: win -> New land (from the won card) -> win again
    reach=lambda:(pg.evaluate("(()=>{st.grace=1e9;CAL.t=YEAR_DAYS*DAY_LEN*CAL.year-0.3})()"),pg.wait_for_function("st.mode=='won'",timeout=8000))
    reach()
    pg.click('#wonNewBtn');pg.wait_for_timeout(2500)
    check('new land from won card: card gone, fresh year 1',pg.evaluate("[st.mode,CAL.year,CAL.day]")==['play',1,0] and not vis('#wonOv'))
    reach()
    check('second flight reaches its own year-end',pg.evaluate("[st.mode,CAL.year]")==['won',1] and vis('#wonOv'))
    pg.click('#keepBtn');pg.wait_for_timeout(500)
    # save mid-run, reload, continue: resumes where it was and still reaches the end
    pg.evaluate("(()=>{st.mode='play';CAL.t+=300;calUpdate();saveSession()})()")
    pg.reload();pg.wait_for_timeout(1500)
    check('reload offers continue',vis('#continueBtn') and pg.evaluate("hasStoredSession()"))
    pg.click('#continueBtn');pg.wait_for_timeout(800)
    check('continue restores paused mid-run',pg.evaluate("st.mode")=='pause' and vis('#pauseOv'))
    pg.click('#resumeBtn');pg.wait_for_timeout(300)
    reach()
    check('continued flight reaches year-end',pg.evaluate("st.mode")=='won' and vis('#wonOv'))
    pg.click('#wonNewBtn');pg.wait_for_timeout(2500)
    check('new land after continued flight: fresh year 1',pg.evaluate("[st.mode,CAL.year]")==['play',1] and not vis('#wonOv'))
    pg.set_viewport_size({'width':700,'height':900});pg.wait_for_timeout(500);shot('portrait')
    check('resize',pg.evaluate("cv.width")==pg.evaluate("Math.round(700*dpr)"))
    catch_all_and_wait_over()
    pg.click('#overNewBtn');pg.wait_for_timeout(2500)
    check('new land from game over starts playing',pg.evaluate("st.mode")=='play')
    pg.evaluate("dev.hour(23)");pg.wait_for_timeout(1500);shot('night')
    check('night',pg.evaluate("LIGHT.night")>.5)
    b.close()
    # phone
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html'));pg.wait_for_timeout(1500)
    check('phone: touch hint',pg.evaluate("document.getElementById('keysTxt').textContent").startswith('hold where'))
    pg.screenshot(path=os.path.join(out,'flow_phone_title.png'))
    pg.tap('#startBtn');pg.wait_for_timeout(800)
    check('phone: dash button',pg.evaluate("!dashBtn.hidden"))
    pg.screenshot(path=os.path.join(out,'flow_phone_play.png'))
    b.close()
    print('page errors:',errs or 'none')
    sys.exit(1 if fails or errs else 0)
