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
    // A fixed northern view must not flash at the midpoint of winter's crossfade.
    for (const [from, to] of [
      [2, 3],
      [3, 0]
    ]) {
      const jump = await page.evaluate(
        ([from, to]) => {
          dev.calm();
          dev.season(from, 12);
          dev.to(W / 2, 0, 0.8);
          st.mode = 'pause';
          applySeason(to, true);
          while (BG_JOB) runBgJob();
          const sample = t => {
            TRANS.t = t;
            calUpdate();
            render();
            const pixels = ctx.getImageData(0, 0, cv.width, Math.min(cv.height, 320)).data;
            const rgb = [0, 0, 0];
            let n = 0;
            for (let i = 0; i < pixels.length; i += 32) {
              rgb[0] += pixels[i];
              rgb[1] += pixels[i + 1];
              rgb[2] += pixels[i + 2];
              n++;
            }
            return rgb.map(v => v / n);
          };
          const a = sample(0.49),
            b = sample(0.51);
          return Math.max(...a.map((v, i) => Math.abs(v - b[i])));
        },
        [from, to]
      );
      assert.ok(jump < 5, `north view flashes across ${from} -> ${to} midpoint: ${jump.toFixed(2)}`);
      console.log(`north ${from} -> ${to} midpoint color jump: ${jump.toFixed(2)}`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
