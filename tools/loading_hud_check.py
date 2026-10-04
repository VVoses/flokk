"""Loading feedback and compact touch HUD smoke checks; screenshots in tools/out/loading-hud."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = root / 'tools/out/loading-hud'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1100, 'height': 760})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
    page.wait_for_function('!MENU_JOB && birds.length')
    assert page.locator('#keysTxt kbd').count() >= 4
    page.evaluate("runMenuJob($('startBtn'), 'Preparing your flight…', () => new Promise(resolve => window.finishJob = resolve)); void 0")
    page.wait_for_function('typeof window.finishJob === "function"')
    assert page.locator('.menu-loading').is_visible()
    assert page.locator('#startBtn').get_attribute('aria-busy') == 'true'
    assert page.evaluate('menuControls(activeMenu()).length === 0')
    page.keyboard.press('Escape')
    page.keyboard.press('Enter')
    assert page.evaluate("st.mode === 'title' && !!MENU_JOB")
    page.screenshot(path=str(out / 'loading.png'))
    page.evaluate('window.finishJob(true)')
    page.wait_for_function('!MENU_JOB')
    assert page.locator('#startBtn').is_enabled()
    assert page.locator('.menu-loading').count() == 0
    page.evaluate("runMenuJob($('startBtn'), 'Testing failure…', () => false); void 0")
    page.wait_for_function('!MENU_JOB')
    assert page.locator('.menu-loading.error').is_visible()
    assert page.locator('#startBtn').is_enabled()
    page.click('#startBtn')
    page.wait_for_function("st.mode === 'play' && !MENU_JOB")
    assert page.locator('.menu-loading').count() == 0
    print('ok loading feedback, input guard, failure recovery, and cleanup')
    page.close()
    for width, height in [(320, 568), (390, 844), (768, 1024), (844, 390), (568, 320)]:
        page = browser.new_page(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=True)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
        page.wait_for_function('!MENU_JOB && birds.length')
        page.click('#startBtn')
        page.wait_for_function("st.mode === 'play' && !MENU_JOB")
        page.evaluate("st.mode='pause';st.energy=.2;hudT=0;hud(.1);")
        geometry = page.evaluate("""(() => {
          const rect = sel => document.querySelector(sel).getBoundingClientRect();
          const left=rect('.tl'), right=rect('.tr');
          const fits=r=>r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight;
          return left.right < right.left && fits(left) && fits(right) &&
            ['#pauseBtn','#muteBtn','#dashBtn'].every(sel=>{const r=rect(sel);return fits(r)&&r.width>=44&&r.height>=44;}) &&
            [...document.querySelectorAll('.meter:not([hidden]) .line')].every(el=>el.getBoundingClientRect().width>=30);
        })()""")
        assert geometry, f'HUD overlaps or undersized touch controls at {width}x{height}'
        page.screenshot(path=str(out / f'hud-{width}x{height}.png'))
        page.evaluate("st.mode='play'")
        page.click('#pauseBtn')
        page.wait_for_function("!$('pauseOv').hidden")
        page.screenshot(path=str(out / f'controls-{width}x{height}.png'))
        print('ok touch HUD', width, height)
        page.close()
    assert not errors, errors
    browser.close()
