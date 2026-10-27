const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5019';

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const mobile of [false,true]) {
      const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
      const page = await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`${base}/juego/beisbol`);
      await page.locator('#shopItems .item-card').first().waitFor();
      await page.locator('[data-tab="bates"]').click();
      assert.equal(await page.locator('#shopItems .item-card').count(),5);
      await page.locator('[data-tab="pelotas"]').click();
      assert.equal(await page.locator('#shopItems .item-card').count(),5);
      await page.locator('[data-tab="personajes"]').click();
      assert.equal(await page.locator('#shopItems .item-card').count(),5);
      await page.locator('#pitch').click();
      await page.waitForTimeout(1430);
      await page.locator('#swing').click();
      await page.locator('#result:not([hidden])').waitFor({timeout:14000});
      const result=await page.locator('#resultText').innerText();
      assert.match(result,/Ganaste [\d,.]+ monedas/);
      assert.notEqual(await page.locator('#record').innerText(),'0 m');
      await page.locator('[data-tab="mejoras"]').click();
      await page.locator('[data-action="mejorar"][data-category="fuerza"]').click();
      await page.getByText('Nivel 1/10').waitFor();
      assert.equal(errors.length,0,errors.join('\n'));
      if (process.env.ARCADE_CAPTURE) await page.screenshot({path:process.env.ARCADE_CAPTURE.replace('.png',mobile?'-mobile.png':'-desktop.png'),fullPage:true});
      console.log(`${mobile?'móvil':'PC'}: bateo, vuelo, recompensa y mejora de fuerza aprobados`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
