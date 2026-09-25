"""Quick check of the fox prowl mechanic: forces a winter-night, low-exposed-perch scenario
close to the spawned fox, then steps the sim to confirm foxProwl triggers, the fox creeps in
and reaches a pounce, and everything resolves without a stuck state or a page error."""
from playwright.sync_api import sync_playwright
import os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 760})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + os.path.join(root, 'index.html') + '?dev')
    pg.wait_for_timeout(1200)
    pg.click('#startBtn')
    pg.wait_for_timeout(500)

    setup = pg.evaluate("""() => {
        genWorld(4242); landLabels(); refreshInsects(); resetWorld(6, START.x, START.y);
        dev.season(3, 22);
        const fox = ANIMALS.find(a => a.k === 'fox');
        if (!fox) return { error: 'no fox spawned' };
        L.state = 'land'; L.x = fox.x + 70; L.y = fox.y;
        const gp = groundSpot(L.x, L.y, 60);
        if (!gp) return { error: 'no ground spot near fox' };
        gp.occ = L; L.perch = gp; L.state = 'perch'; st.settled = true;
        for (const b of birds) if (b !== L) b.state = 'fly';
        LIFE.foxCool = 0.1;
        return { fox: { x: fox.x, y: fox.y, hide: fox.hide }, Lx: L.x, Ly: L.y };
    }""")
    print('setup', setup)
    assert 'error' not in setup, setup

    triggered = False
    pounced = False
    resolved = False
    for i in range(400):
        pg.evaluate("() => { for (let j = 0; j < 6; j++) update(1/60); }")
        st2 = pg.evaluate("""() => {
            const fox = ANIMALS.find(a => a.k === 'fox');
            return { busy: fox.busy, st: fox.st, hide: fox.hide,
                     lost: st.lost, settled: st.settled, Lstate: L.state, birds: birds.length };
        }""")
        if st2['busy'] and not triggered:
            triggered = True
            print('triggered at step', i, st2)
        if st2['st'] == 'pounce' and not pounced:
            pounced = True
            print('pounced at step', i, st2)
        if triggered and not st2['busy']:
            resolved = True
            print('resolved at step', i, st2)
            break

    print('triggered:', triggered, 'pounced:', pounced, 'resolved:', resolved)
    print('page errors:', errs[:10])
    assert triggered, 'fox never triggered a prowl'
    assert pounced, 'fox never reached a pounce'
    assert resolved, 'fox raid never resolved (stuck busy)'
    assert not errs, errs
    print('OK')
    b.close()
