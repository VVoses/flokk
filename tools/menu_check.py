"""Keyboard, dialog and reflow checks for menus. Writes screenshots to tools/out/menu-ux."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
out = root / 'tools' / 'out' / 'menu-ux'
out.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1100, 'height': 760})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((root / 'index.html').as_uri() + '?dev&seed=7')
    page.wait_for_timeout(800)

    def check(condition, message):
        assert condition, message
        print('ok', message)

    def keyboard_boundary(menu):
        page.evaluate('id => menuControls($(id))[0].focus()', menu)
        page.keyboard.press('Shift+Tab')
        check(page.evaluate('id => document.activeElement === menuControls($(id)).at(-1)', menu), menu + ' backward focus wraps')
        page.keyboard.press('Tab')
        check(page.evaluate('id => document.activeElement === menuControls($(id))[0]', menu), menu + ' forward focus wraps')
        check(page.evaluate('cv.inert && document.querySelector(".hud").inert'), menu + ' isolates gameplay')

    keyboard_boundary('titleOv')
    check(page.get_by_role('dialog', name='Flokk', exact=True).count() == 1, 'title has an accessible dialog name')
    page.click('#startBtn');page.wait_for_function("st.mode==='play' && !MENU_JOB")
    check(page.evaluate('document.activeElement === cv && !cv.inert'), 'taking off returns focus to flight')
    page.keyboard.press('Escape')
    keyboard_boundary('pauseOv')
    check(page.get_by_role('button', name='Sound', exact=True).get_attribute('aria-pressed') in ['true', 'false'], 'sound toggle has a stable accessible name and state')
    page.evaluate('const originalSave = saveSession; saveSession = () => false; goNewLand(); saveSession = originalSave')
    check(page.evaluate('st.mode === "pause"') and 'Could not save' in page.locator('#pauseSaveNote').inner_text(), 'new land stays open when saving fails')
    page.evaluate('confirmMenu("Test confirmation", "Keep your flight.", "Confirm", () => {})')
    check(page.evaluate('document.activeElement.id') == 'confirmCancelBtn', 'confirmation starts on the safe action')
    keyboard_boundary('confirmOv')
    page.keyboard.press('p')
    check(page.evaluate('st.mode === "pause" && !$("confirmOv").hidden'), 'game shortcuts cannot escape confirmation')
    page.keyboard.press('Escape')
    check(page.evaluate('st.mode === "pause" && document.activeElement.id === "resumeBtn"'), 'Escape cancels without resuming flight')
    page.click('#returnTitleBtn');page.wait_for_function("st.mode==='title' && !MENU_JOB")
    keyboard_boundary('titleOv')
    check(page.get_by_role('list', name='Saved flights').count() == 1, 'saved flights are exposed as a list')
    check(page.locator('.slot-del').evaluate('(el) => { const r=el.getBoundingClientRect(); return r.width>=44 && r.height>=44; }'), 'delete target is at least 44 by 44')
    page.click('#newFlightBtn')
    page.keyboard.press('Escape')
    check(page.evaluate('$("titleCard").dataset.view === "saves"'), 'Escape returns from new land to saved flights')
    page.click('#continueBtn');page.wait_for_function("st.mode==='play' && !MENU_JOB")
    page.evaluate('yearWon()')
    keyboard_boundary('wonOv')
    page.evaluate('copyText = async () => false')
    page.click('#shareBtn')
    check(page.locator('#shareFallback').is_visible() and page.locator('#shareFallback').input_value().find('max flock') >= 0, 'clipboard failure offers a selectable summary')
    check(page.evaluate('document.activeElement.id') == 'shareFallback', 'copy fallback receives focus')
    keyboard_boundary('wonOv')
    page.evaluate('copyText = async () => true')
    page.click('#shareBtn')
    check(page.locator('#shareNote').inner_text() == 'Flight summary copied.' and not page.locator('#shareFallback').is_visible(), 'copy success is announced separately from the button')

    page.evaluate('startGame();gameOver()')
    keyboard_boundary('overOv')
    page.set_viewport_size({'width': 320, 'height': 568})
    page.emulate_media(reduced_motion='reduce')
    for name, setup, selector in [
        ('won', 'startGame();yearWon()', '#wonOv .end-panel'),
        ('over', 'startGame();gameOver()', '#overOv .end-panel'),
        ('title', 'startGame();pause();returnToTitle()', '#titleCard'),
        ('confirmation', 'confirmMenu("Delete this flight?", "This flight cannot be recovered. Cancel to keep it.", "Delete flight", () => {})', '#confirmOv .confirm-panel')
    ]:
        page.evaluate(setup)
        check(page.locator(selector).evaluate('(el) => { const r=el.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth; }'), name + ' fits narrow screen horizontally')
        page.evaluate('menuControls(activeMenu()).at(-1).focus()')
        check(page.evaluate('(() => { const r=document.activeElement.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight; })()'), name + ' final control remains reachable')
        page.screenshot(path=str(out / (name + '-phone.png')))
    page.emulate_media(forced_colors='active')
    page.screenshot(path=str(out / 'confirmation-high-contrast.png'))
    check(not errors, 'no page errors')
    browser.close()
