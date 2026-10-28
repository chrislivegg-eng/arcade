const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5000';

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const mobile of [false,true]) {
      const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
      const page = await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`${base}/juego/billar`);
      await page.locator('[data-modo="bot"]').click();
      await page.locator('#billar-controles:not(.oculto)').waitFor();
      await page.locator('#lienzo').click({position:{x:mobile?195:640,y:mobile?245:300}});
      await page.locator('#billar-potencia').fill('90');
      assert.equal(await page.locator('#billar-potencia-valor').innerText(),'90%');
      const initialRack = await page.evaluate(() => eval('bolas.slice(1).map(b => [b.x, b.z])'));
      if (process.env.ARCADE_CAPTURE) await page.screenshot({path:process.env.ARCADE_CAPTURE.replace('.png',mobile?'-mobile.png':'-desktop.png')});
      if (mobile) await page.locator('#billar-tirar').click();
      else await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('#billar-controles').classList.contains('oculto'));
      await page.waitForTimeout(1200);
      const moved = await page.evaluate(before => eval('bolas.slice(1).some((b, i) => Math.hypot(b.x - before[i][0], b.z - before[i][1]) > 0.015)'), initialRack);
      assert.ok(moved, 'El tiro debe mover las bolas del triángulo');
      assert.equal(errors.length,0,errors.join('\n'));
      console.log(`${mobile?'móvil':'PC'}: apuntar, potencia y tiro funcionan`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
