const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
        isMobile: mobile, hasTouch: mobile,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/records/canicas', async route => {
        if (route.request().method() === 'POST') await route.fulfill({status:200,contentType:'application/json',body:'{}'});
        else await route.continue();
      });
      await page.goto('http://127.0.0.1:5000/juego/squish');
      await page.locator('#start').click();
      for (let i = 0; i < 3; i++) await page.locator('#game').click({ position: { x: 100, y: 100 } });
      assert.equal(await page.locator('#total').innerText(), '3');
      assert.equal(await page.locator('#found').innerText(), '2/12');
      await page.locator('#collectionToggle').click();
      assert.equal(await page.locator('#items .item:not(.locked)').count(), 2);
      await page.goto('http://127.0.0.1:5000/juego/canicas');
      await page.locator('#start').click();
      await page.locator('#launch').click();
      assert.equal(await page.locator('#reserve').innerText(), '4');
      await page.locator('#launch').click();
      assert.equal(await page.locator('#reserve').innerText(), '0');
      if (process.env.ARCADE_CAPTURE && !mobile) {
        await page.waitForTimeout(500);
        await page.screenshot({path:process.env.ARCADE_CAPTURE});
      }
      await page.waitForFunction(() => document.querySelector('#wave').textContent === '2/3', {timeout: 10000});
      for (let i=0;i<2;i++) await page.locator('#launch').click();
      await page.waitForFunction(() => document.querySelector('#wave').textContent === '3/3');
      for (let i=0;i<2;i++) await page.locator('#launch').click();
      await page.locator('#end[open]').waitFor({timeout:10000});
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`${mobile ? 'móvil' : 'PC'}: Squish interactivo; Canicas completó 3 rondas`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
