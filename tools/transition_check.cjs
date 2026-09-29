// PLAYWRIGHT_MODULE may point at a bundled Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(resolve(__dirname, '../index.html')).href + '?dev');
    await page.waitForFunction(() => typeof dev !== 'undefined');
    await page.click('#startBtn');
    for (let season = 0; season < 4; season++) {
      const result = await page.evaluate(s => {
        st.mode = 'pause';
        dev.season(s, 23);
        const next = (s + 1) % 4;
        applySeason(next, true);
        // Simulate a slow device: rebuild must not become visible while incomplete.
        update(0.033);
        const held = BG_JOB ? TRANS.t === 0 : true;
        let frames = 0;
        while (BG_JOB && frames++ < 5000) runBgJob();
        update(0.033);
        const started = TRANS.t > 0 && TRANS.t < 1;
        const complete = !BG_JOB && GROW.fsSeason === next;
        for (let i = 0; i < 310; i++) update(0.033);
        render();
        return { held, started, complete, released: !TRANS.prevG && !TRANS.prevSPR, frames };
      }, season);
      assert.equal(result.held, true);
      assert.equal(result.started, true);
      assert.equal(result.complete, true);
      assert.equal(result.released, true);
      console.log(`season ${season} -> ${(season + 1) % 4}:`, result);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
