"""Independent music/world routing, persistent controls and keyboard access."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = root / 'tools/out/menu-ux'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width':1100, 'height':760})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
    page.click('#startBtn')
    page.wait_for_function("st.mode==='play' && !MENU_JOB")
    page.keyboard.press('Escape')
    page.locator('#musicLevel').focus()
    page.keyboard.press('Home')
    assert page.locator('#musicLevelValue').inner_text() == '0%'
    assert page.evaluate('soundLevels.music===0 && soundLevels.world===1')
    page.keyboard.press('End')
    page.locator('#worldLevel').focus()
    page.keyboard.press('Home')
    assert page.evaluate('soundLevels.world===0 && soundLevels.music===1')
    page.keyboard.press('Tab')
    assert page.evaluate("document.activeElement.id==='resumeBtn'"), 'last slider wraps focus within pause'
    for width,height in [(1100,760),(320,568),(844,390)]:
        page.set_viewport_size(dict(width=width,height=height))
        page.locator('#worldLevel').scroll_into_view_if_needed()
        bounds=page.locator('#worldLevel').evaluate('(el)=>{const r=el.getBoundingClientRect();return {left:r.x,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight};}')
        assert bounds['left']>=0 and bounds['right']<=bounds['width'] and bounds['bottom']<=bounds['height'], bounds
        assert page.locator('#pauseOv .pause-panel').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'), 'pause content has no horizontal overflow'
        page.screenshot(path=str(out / f'sound-balance-{width}.png'))
    page.reload()
    assert page.evaluate('soundLevels.music===1 && soundLevels.world===0'), 'balance persists across reload'
    page.evaluate("st.mode='pause';muted=true;openingSeasonCue=null;")
    for source in ['music', 'world']:
        for music, world in [(1,0),(0,1),(0,0)]:
            result = page.evaluate('''async ({source,music,world}) => {
              st.mode='pause';muted=false;amb=null;MUS=null;hawks=[];
              ac=new OfflineAudioContext(2,48000*8,48000);
              master=ac.createGain();master.gain.value=.9;master.connect(ac.destination);
              worldBus=ac.createGain();worldBus.gain.value=world;worldBus.connect(master);
              verb=audioRoom(worldBus).input;
              soundLevels.music=music;soundLevels.world=world;
              if(source==='music') {
                musInit();MUS.bus.gain.value=1;seasonJingle(0,.1);
              } else {
                lastChirp=-1;
                amb={noise:noiseBuf(4)};
                // A distant call exercises both the dry path and its room tail.
                chirp(.08,3200,L.x+200,L.y);
                amb=null;
              }
              const buffer=await ac.startRendering(), samples=buffer.getChannelData(0);
              let peak=0,tail=0;
              for(let i=0;i<samples.length;i++) {
                peak=Math.max(peak,Math.abs(samples[i]));
                if(i>48000) tail=Math.max(tail,Math.abs(samples[i]));
              }
              muted=true;return {peak,tail};
            }''', dict(source=source,music=music,world=world))
            audible = music if source == 'music' else world
            if audible:
                assert result['peak'] > .001 and result['tail'] > 1e-7, (source,music,world,result)
            else:
                assert result['peak'] < 1e-9, (source,music,world,result)
            print('independent sound routing', source, music, world, result)
    assert not errors, errors
    browser.close()
print('sound balance, persistence, keyboard access and independent tails passed')
