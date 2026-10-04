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
    fits=lambda sel:pg.evaluate("sel => { const r=document.querySelector(sel).getBoundingClientRect(); return r.width>0 && r.height>0 && r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight; }",sel)
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
    check('title panel fits desktop',fits('#titleCard'))
    clock=pg.evaluate("(()=>{const d=Date.now,at=t=>{Date.now=()=>t;seedCalls=0;return newSeed()};const r=[at(1.7e12),at(1.7e12),at(1.7e12+1)];Date.now=d;return r})()")
    check('new land seed comes from the clock',clock[0]==clock[1] and clock[0]!=clock[2])
    pg2=b.new_page();pg2.goto('file://'+os.path.join(root,'index.html')+'?seed=1234');pg2.wait_for_timeout(800)
    check('?seed pins the land',pg2.evaluate("SEED")==1234 and pg2.evaluate("newSeed()")==1234);pg2.close()
    check('nothing saved: the land view, with Take off and Reroll but no Back',pg.evaluate("$('titleCard').dataset.view")=='land' and vis('#startBtn') and vis('#rerollBtn') and not vis('#landBackBtn'))
    land0=pg.evaluate("SEED");pg.click('#rerollBtn');pg.wait_for_timeout(1500)
    check('reroll shows a different land and stays on the title',vis('#titleOv') and pg.evaluate("SEED")!=land0 and pg.evaluate("$('landName').textContent")!='')
    pg.click('#startBtn');pg.wait_for_timeout(800)
    check('playing',pg.evaluate("st.mode")=='play' and not vis('#titleOv'))
    pg.keyboard.down('KeyD');pg.wait_for_timeout(700);pg.keyboard.up('KeyD')
    check('keyboard steers',pg.evaluate("Math.hypot(L.vx,L.vy)")>30)
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
    check('escape pauses',pg.evaluate("st.mode")=='pause' and vis('#pauseOv'));shot('pause')
    pg.keyboard.press('Shift+Tab')
    check('pause focus wraps backward',pg.evaluate("document.activeElement.id")=='pauseNewBtn')
    pg.keyboard.press('Tab')
    check('pause focus wraps forward',pg.evaluate("document.activeElement.id")=='resumeBtn')
    pg.click('#pauseSoundBtn')
    check('pause menu sound off',pg.evaluate("muted") and pg.locator('#pauseSoundBtn').inner_text()=='Sound off')
    pg.click('#pauseSoundBtn')
    check('pause menu sound on',not pg.evaluate("muted") and pg.locator('#pauseSoundBtn').inner_text()=='Sound on')
    before=pg.evaluate("[SEED,CAL.t,birds.length]")
    pg.click('#returnTitleBtn');pg.wait_for_function("st.mode==='title' && !MENU_JOB")
    check('save and title',pg.evaluate("st.mode")=='title' and vis('#titleOv') and pg.evaluate("$('titleCard').dataset.view")=='saves' and vis('#continueBtn'))
    # Capture immediately after the restore handler, before live foraging can change the flock.
    pg.evaluate("const originalRestore = restoreSession; restoreSession = id => { const ok=originalRestore(id); window.restoredFlight=[st.mode,SEED,CAL.t,birds.length]; restoreSession=originalRestore; return ok; }; void 0")
    pg.click('#continueBtn');pg.wait_for_function('window.restoredFlight && !MENU_JOB')
    restored=pg.evaluate('window.restoredFlight')
    check('saved flight restored',restored==['play',*before])
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
    check('failed save keeps pause open',pg.evaluate("""(() => {
      const original = saveSession;
      saveSession = () => false;
      returnToTitle();
      const stayed = st.mode === 'pause' && !$('pauseOv').hidden &&
        $('pauseSaveNote').textContent.includes('Could not save');
      saveSession = original;
      return stayed;
    })()"""))
    check('no slot can return to title',pg.evaluate("""(() => {
      const slot = curSlot;
      curSlot = null;
      returnToTitle();
      const left = st.mode === 'title' && !$('titleOv').hidden &&
        $('saveNote').textContent.includes('no save slot');
      curSlot = slot;
      return left;
    })()"""))
    pg.click('#continueBtn');pg.wait_for_timeout(500)
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
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
    pg.set_viewport_size({'width':700,'height':900});pg.wait_for_timeout(500);shot('portrait')
    check('resize',pg.evaluate("cv.width")==pg.evaluate("Math.round(700*dpr)"))
    pg.set_viewport_size({'width':1200,'height':760})
    reach=lambda:(pg.evaluate("(()=>{st.grace=1e9;CAL.t=YEAR_DAYS*DAY_LEN*CAL.year-0.3})()"),pg.wait_for_function("st.mode=='won'",timeout=8000))
    # New land from the won card: the finished flight stays saved, and the land view offers Take off or Reroll
    reach();seed1=pg.evaluate("SEED")
    pg.click('#wonNewBtn');pg.wait_for_timeout(1800)
    check('won card New land opens the land view, with Back',vis('#titleOv') and pg.evaluate("$('titleCard').dataset.view")=='land' and vis('#startBtn') and vis('#rerollBtn') and vis('#landBackBtn'));shot('land')
    land0=pg.evaluate("SEED");pg.click('#rerollBtn');pg.wait_for_timeout(1500)
    check('reroll shows a different land',pg.evaluate("SEED")!=land0)
    pg.click('#startBtn');pg.wait_for_timeout(800)
    check('take off: fresh year 1, no leftover card',pg.evaluate("[st.mode,CAL.year,CAL.day]")==['play',1,0] and not vis('#wonOv') and not vis('#titleOv'))
    reach();seed2=pg.evaluate("SEED")
    check('second flight reaches its own year-end',pg.evaluate("[st.mode,CAL.year]")==['won',1] and vis('#wonOv'))
    pg.evaluate("saveSession()")
    # two flights are saved side by side; Continue is the newest and the list reaches the other
    pg.reload();pg.wait_for_timeout(1500)
    check('title lists both saved flights, newest as Continue',pg.evaluate("$('titleCard').dataset.view")=='saves' and pg.evaluate("document.querySelectorAll('.slot').length")==2 and 'year complete' in pg.evaluate("$('continueInfo').textContent"));shot('saves')
    pg.click('.slot:nth-child(2) .slot-go');pg.wait_for_timeout(800)
    check('picking the other flight restores its own land',pg.evaluate("[SEED,st.mode]")==[seed1,'won'] and vis('#wonOv'))
    pg.click('#keepBtn');pg.wait_for_timeout(500)
    # pause card: Resume or New land; Back from there leads to the saved flights
    pg.keyboard.press('Escape');pg.wait_for_timeout(300)
    check('pause card offers Resume and New land',vis('#resumeBtn') and vis('#pauseNewBtn'))
    pg.click('#pauseNewBtn');pg.wait_for_timeout(1800)
    check('pause New land opens the land view',vis('#titleOv') and pg.evaluate("$('titleCard').dataset.view")=='land' and vis('#landBackBtn'))
    pg.click('#landBackBtn');pg.wait_for_timeout(300)
    check('Back leads to both saved flights',pg.evaluate("$('titleCard').dataset.view")=='saves' and pg.evaluate("document.querySelectorAll('.slot').length")==2)
    # deleting a save asks twice and leaves the other alone
    pg.click('.slot:nth-child(2) .slot-del');pg.wait_for_timeout(300)
    check('delete opens confirmation without changing saves',vis('#confirmOv') and pg.evaluate('listSlots().length')==2)
    pg.keyboard.press('Escape')
    check('cancel deletion restores focus',not vis('#confirmOv') and pg.evaluate("document.activeElement.classList.contains('slot-del')") and pg.evaluate('listSlots().length')==2)
    pg.click('.slot:nth-child(2) .slot-del');pg.click('#confirmActionBtn')
    check('confirmed delete removes that flight only',pg.evaluate("document.querySelectorAll('.slot').length")==1)
    # all slots used: a new flight replaces the oldest, never the newest
    pg.evaluate("""(()=>{const id=listSlots()[0].id,raw=localStorage.getItem(slotKey(id));
      for(let i=0;i<5;i++){const v=JSON.parse(raw);v.summary.updated=1000+i;localStorage.setItem(slotKey('old'+i),JSON.stringify(v))}})()""")
    pg.click('#newFlightBtn');pg.wait_for_timeout(300)
    check('full slots are said out loud',vis('#landNote') and 'oldest' in pg.evaluate("$('landNote').textContent"))
    pg.click('#startBtn')
    check('full slots require confirmation',vis('#confirmOv') and pg.evaluate('listSlots().length')==6)
    pg.click('#confirmCancelBtn')
    check('cancel replacement preserves saves',not vis('#confirmOv') and pg.evaluate('listSlots().length')==6)
    pg.click('#startBtn');pg.click('#confirmActionBtn');pg.wait_for_timeout(800);pg.evaluate('saveSession()')
    check('new flight with all slots used replaces the oldest',pg.evaluate("listSlots().length")==6)
    check('the oldest is the one that went',pg.evaluate("!localStorage.getItem(slotKey('old0'))") and pg.evaluate("!!localStorage.getItem(slotKey('old4'))"))
    # the flock is taken: that flight's slot goes, the others stay; New land from the game-over card
    n=pg.evaluate("listSlots().length")
    catch_all_and_wait_over()
    check('game over deletes only its own save',pg.evaluate("st.mode")=='over' and pg.evaluate("listSlots().length")==n-1)
    pg.click('#overNewBtn');pg.wait_for_timeout(1800)
    check('game over New land opens the land view',vis('#titleOv') and pg.evaluate("$('titleCard').dataset.view")=='land')
    pg.click('#startBtn');pg.wait_for_timeout(800)
    check('take off after game over starts playing',pg.evaluate("st.mode")=='play')
    pg.evaluate("dev.hour(23)");pg.wait_for_timeout(1500);shot('night')
    check('night',pg.evaluate("LIGHT.night")>.5)
    b.close()
    # phone
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+os.path.join(root,'index.html'));pg.wait_for_timeout(1500)
    check('phone: touch hint',pg.evaluate("document.getElementById('keysTxt').textContent").startswith('hold where'))
    check('phone: title panel fits',fits('#titleCard'))
    pg.screenshot(path=os.path.join(out,'flow_phone_title.png'))
    pg.tap('#startBtn');pg.wait_for_timeout(800)
    check('phone: dash button',pg.evaluate("!dashBtn.hidden"))
    pg.screenshot(path=os.path.join(out,'flow_phone_play.png'))
    pg.tap('#pauseBtn');pg.wait_for_timeout(200)
    check('phone: pause actions fit',pg.evaluate("st.mode")=='pause' and pg.evaluate("dashBtn.hidden") and pg.evaluate("(() => { const p=document.querySelector('#pauseOv .pause-panel').getBoundingClientRect(); return p.left>=0 && p.right<=innerWidth && p.top>=0 && p.bottom<=innerHeight; })()"))
    pg.screenshot(path=os.path.join(out,'flow_phone_pause.png'))
    pg.tap('#resumeBtn');pg.evaluate('yearWon()')
    check('phone: year-end panel fits',fits('#wonOv .end-panel'))
    pg.screenshot(path=os.path.join(out,'flow_phone_won.png'))
    pg.evaluate('startGame();gameOver()')
    check('phone: game-over panel fits',fits('#overOv .end-panel'))
    pg.screenshot(path=os.path.join(out,'flow_phone_over.png'))
    b.close()
    print('page errors:',errs or 'none')
    sys.exit(1 if fails or errs else 0)
