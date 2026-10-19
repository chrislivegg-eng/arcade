const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5055';
const games = ['corredor', 'ladrillos', 'box', 'arco', 'voleibol', 'hockey', 'sopa', 'mate', 'flow', 'tetris', 'parejas', 'nonograma', 'reversi', 'conecta3d', 'yahtzee', 'curling', 'pesca', 'paracaidas', 'nieve', 'asteroides', 'surf', 'drift', 'espadas'];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  async function open(game, mobile = false) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(game + ': ' + e.message)); page.on('dialog', d => d.accept('Segundo'));
    await page.route('https://fonts.**', r => r.abort());
    await page.goto(base + '/juego/' + game); await page.locator('[data-modo]').first().waitFor(); return page;
  }
  for (const mobile of [false, true]) for (const game of games) {
    const page = await open(game, mobile);
    const modes = await page.locator('#menu [data-modo]').evaluateAll(es => es.map(e => e.dataset.modo).filter(m => m !== 'online'));
    for (const mode of modes) {
      await page.locator(`[data-modo=${mode}]`).click(); await page.waitForTimeout(350);
      await page.mouse.move(180, 680); await page.mouse.down(); await page.mouse.move(210, 430, { steps: 8 }); await page.mouse.up();
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, game);
      await page.reload();
    }
    await page.context().close(); console.log('PASS arranque/controles:', game, mobile ? 'móvil' : 'PC');
  }
  for (const game of games) {
    const host = await open(game), guest = await open(game, true);
    for (const p of [host, guest]) await p.locator('[data-modo=online]').click();
    await host.locator('#btn-crear').click(); await host.locator('#menu-espera').waitFor({ state: 'visible' });
    await guest.locator('#codigo').fill(await host.locator('#codigo-espera').innerText()); await guest.locator('#btn-unirse').click();
    await Promise.all([host, guest].map(p => p.waitForFunction(() => ui.modo === 'online')));
    await guest.evaluate(() => { window.reviewReceived = false; const prev = ui.alEvento; ui.alEvento = (t, d) => { if (t === 'review') reviewReceived = true; else prev?.(t, d); }; });
    await host.evaluate(() => ui.enviar('review', { ok: true })); await guest.waitForFunction(() => reviewReceived);
    await host.context().close(); await guest.context().close(); console.log('PASS conexión online PC/móvil:', game);
  }
  for (const route of ['papa_caliente', 'blackjack', 'poker', 'loteria', 'domino', 'memorama_online']) {
    const page = await browser.newPage(); page.on('pageerror', e => errors.push(route + ': ' + e.message));
    assert.equal((await page.goto(base + '/' + route)).status(), 200); await page.waitForTimeout(200);
    if (route === 'memorama_online') assert.ok(page.url().includes('/juego/parejas?modo=online'));
    await page.close();
  }
  assert.deepEqual(errors, []); await browser.close(); console.log('PASS páginas de sala y redirección de Memorama');
})().catch(e => { console.error(e); process.exit(1); });
