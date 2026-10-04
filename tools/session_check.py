"""Saved-flight safety: concurrent tabs and incompatible generated worlds."""
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parent.parent / 'index.html').as_uri() + '?dev'

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    context = browser.new_context()
    first = context.new_page()
    first.goto(URL)
    first.click('#startBtn')
    original = first.evaluate('''() => {
      st.mode = 'pause'; saveSession();
      return JSON.parse(localStorage.getItem(SESSION_KEY)).worldSignature;
    }''')
    assert original, 'snapshot identifies its generated world'
    second = context.new_page()
    second.goto(URL)
    second.click('#continueBtn')
    second.evaluate('''() => {st.energy = 0.81; saveSession();}''')
    first.wait_for_function('sessionConflict')
    newer = second.evaluate('localStorage.getItem(SESSION_KEY)')
    protected = first.evaluate('''() => {
      st.energy = 0.01; saveSession(); clearSession();
      return {raw: localStorage.getItem(SESSION_KEY),
        warning: $('sessionWarning').textContent, visible: !$('sessionWarning').hidden};
    }''')
    assert protected['raw'] == newer, 'stale tab neither overwrites nor clears the newer save'
    assert protected['visible'] and 'Another tab' in protected['warning'], 'conflict is visible'
    context.close()

    damaged_context = browser.new_context()
    damaged = damaged_context.new_page()
    damaged.goto(URL)
    damaged.click('#startBtn')
    winter = damaged.evaluate('''() => {
      dev.season(3, 12);
      if (!FEEDER) return false;
      FEEDER.raidCool = 17;
      st.mode = 'pause'; saveSession();
      return true;
    }''')
    assert winter, 'winter feeder exists before saving'
    damaged.reload()
    damaged.click('#continueBtn')
    # the world rebuilds after the click; a slow runner has not finished when the next line runs
    damaged.wait_for_function('FEEDER && FEEDER.raidCool > 10 && FEEDER.raidCool <= 17', timeout=15000)
    damaged.evaluate('''() => {
      const snapshot = JSON.parse(localStorage.getItem(SESSION_KEY));
      snapshot.worldSignature = 'wrong-world';
      localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    }''')
    damaged.reload()
    damaged.click('#continueBtn')
    mismatch = damaged.evaluate('''() => ({
      stored: !!localStorage.getItem(SESSION_KEY),
      note: $('saveNote').textContent,
      title: !$('titleOv').hidden
    })''')
    assert mismatch['stored'] and mismatch['title'] and 'could not be restored safely' in mismatch['note']
    damaged.evaluate('''() => {
      const snapshot = JSON.parse(localStorage.getItem(SESSION_KEY));
      snapshot.version = 1;
      delete snapshot.worldSignature;
      localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    }''')
    damaged.reload()
    assert damaged.locator('#continueBtn').is_hidden()
    assert damaged.locator('#startBtn').inner_text() == 'New flight'
    damaged.click('#startBtn')
    assert damaged.locator('#newFlightOv').is_visible(), 'replacing a legacy save still requires confirmation'
    assert damaged.evaluate('hasStoredSession()'), 'opening confirmation preserves the legacy save'
    damaged_context.close()

    blocked_context = browser.new_context()
    blocked = blocked_context.new_page()
    blocked.goto(URL)
    blocked.click('#startBtn')
    warning = blocked.evaluate('''() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {throw new DOMException('Full', 'QuotaExceededError');};
      st.mode = 'pause'; saveSession();
      Storage.prototype.setItem = original;
      return {visible: !$('sessionWarning').hidden, text: $('sessionWarning').textContent};
    }''')
    assert warning['visible'] and 'could not be saved' in warning['text'], 'storage failure is visible'
    blocked_context.close()
    browser.close()
print('session conflict and world compatibility checks passed')
