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
    first.wait_for_function("st.mode === 'play' && !MENU_JOB")
    original = first.evaluate('''() => {
      st.mode = 'pause'; saveSession();
      return JSON.parse(localStorage.getItem(slotKey(listSlots()[0].id))).worldSignature;
    }''')
    assert original, 'snapshot identifies its generated world'
    second = context.new_page()
    second.goto(URL)
    second.click('#continueBtn')
    second.wait_for_function("st.mode === 'play' && !MENU_JOB")
    second.evaluate('''() => {st.energy = 0.81; saveSession();}''')
    first.wait_for_function('sessionConflict')
    newer = second.evaluate('localStorage.getItem(slotKey(listSlots()[0].id))')
    protected = first.evaluate('''() => {
      st.energy = 0.01; saveSession(); clearSession();
      return {raw: localStorage.getItem(slotKey(listSlots()[0].id)),
        warning: $('sessionWarning').textContent, visible: !$('sessionWarning').hidden};
    }''')
    assert protected['raw'] == newer, 'stale tab neither overwrites nor clears the newer save'
    assert protected['visible'] and 'Another tab' in protected['warning'], 'conflict is visible'
    context.close()

    damaged_context = browser.new_context()
    damaged = damaged_context.new_page()
    damaged.goto(URL)
    damaged.click('#startBtn')
    damaged.wait_for_function("st.mode === 'play' && !MENU_JOB")
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
    damaged.wait_for_function("st.mode === 'play' && !MENU_JOB")
    assert damaged.evaluate('FEEDER && FEEDER.raidCool > 10 && FEEDER.raidCool <= 17'), 'winter feeder state restores after world rebuild'
    damaged.evaluate('''() => {
      const snapshot = JSON.parse(localStorage.getItem(slotKey(listSlots()[0].id)));
      snapshot.worldSignature = 'wrong-world';
      localStorage.setItem(slotKey(listSlots()[0].id), JSON.stringify(snapshot));
    }''')
    damaged.reload()
    damaged.click('#continueBtn')
    damaged.wait_for_function("!MENU_JOB && $('saveNote').textContent.includes('could not be restored safely')")
    mismatch = damaged.evaluate('''() => ({
      stored: listSlots().length === 1,
      note: $('saveNote').textContent,
      title: !$('titleOv').hidden
    })''')
    assert mismatch['stored'] and mismatch['title'] and 'could not be restored safely' in mismatch['note']
    damaged.evaluate('''() => {
      const snapshot = JSON.parse(localStorage.getItem(slotKey(listSlots()[0].id)));
      snapshot.version = 1;
      delete snapshot.worldSignature;
      localStorage.setItem(slotKey(listSlots()[0].id), JSON.stringify(snapshot));
    }''')
    damaged.reload()
    damaged.wait_for_function('!MENU_JOB')
    assert damaged.locator('#continueBtn').is_hidden(), 'an unreadable save cannot be continued'
    assert damaged.locator('.slot').count() == 1, 'but it stays listed so it can be deleted'
    damaged.click('#newFlightBtn')
    damaged.click('#startBtn')
    damaged.wait_for_function("st.mode === 'play' && !MENU_JOB")
    damaged.evaluate('saveSession()')
    assert damaged.evaluate('listSlots().length') == 2, 'a new flight never replaces an unreadable save'
    damaged_context.close()

    blocked_context = browser.new_context()
    blocked = blocked_context.new_page()
    blocked.goto(URL)
    blocked.click('#startBtn')
    blocked.wait_for_function("st.mode === 'play' && !MENU_JOB")
    warning = blocked.evaluate('''() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {throw new DOMException('Full', 'QuotaExceededError');};
      st.mode = 'pause'; saveSession();
      Storage.prototype.setItem = original;
      return {visible: !$('sessionWarning').hidden, text: $('sessionWarning').textContent};
    }''')
    assert warning['visible'] and 'could not be saved' in warning['text'], 'storage failure is visible'
    replacement = blocked.evaluate('''() => {
      st.mode = 'pause'; saveSession();
      const raw = localStorage.getItem(sessionKey());
      for (let i = 0; i < MAX_SLOTS; i++) localStorage.setItem(slotKey('test-' + i), raw);
      localStorage.removeItem(sessionKey());
      claimSlot();
      const key = sessionKey(), previous = localStorage.getItem(key);
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {throw new DOMException('Full', 'QuotaExceededError');};
      const failed = saveSession();
      Storage.prototype.setItem = write;
      const preserved = localStorage.getItem(key) === previous && listSlots().length === MAX_SLOTS;
      st.energy = 0.73;
      const saved = saveSession();
      return {failed, preserved, saved, changed: localStorage.getItem(key) !== previous,
        count: listSlots().length};
    }''')
    assert replacement == dict(failed=False, preserved=True, saved=True, changed=True, count=6), replacement
    loss = blocked.evaluate('''() => {
      CAL.year = 1; CAL.t = DAY_LEN * YEAR_DAYS; calUpdate();
      st.mode = 'play'; st.overT = 0.1; birds.length = 0;
      update(0.2);
      return st.mode;
    }''')
    assert loss == 'over', 'last-bird loss takes precedence over the year boundary'
    blocked_context.close()
    browser.close()
print('session conflict and world compatibility checks passed')
