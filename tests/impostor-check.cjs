const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  })));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors = [];
  for (const [i, page] of pages.entries()) {
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.**', r => r.abort());
    await page.goto('http://127.0.0.1:5055/impostor', { waitUntil: 'domcontentloaded' });
    await page.locator('#nombre').fill('Jugador ' + i);
  }
  await pages[0].locator('#btn-crear').click();
  await pages[0].locator('#pantalla-sala').waitFor({ state: 'visible' });
  const code = await pages[0].locator('#codigo-sala').innerText();
  for (const page of pages.slice(1)) {
    await page.locator('#codigo').fill(code);
    await page.locator('#btn-unirse').click();
    await page.locator('#pantalla-sala').waitFor({ state: 'visible' });
  }
  await pages[0].waitForFunction(() => ultimoEstado.jugadores.length === 3);
  await pages[0].evaluate(() => iniciarRonda());
  await Promise.all(pages.map(p => p.waitForFunction(() => ultimoEstado && ultimoEstado.fase === 'jugando')));
  const roles = await Promise.all(pages.map(p => p.evaluate(() => ultimoEstado.soy_impostor)));
  const spy = pages[roles.indexOf(true)];
  const innocent = pages[roles.indexOf(false)];
  const word = await innocent.evaluate(() => ultimoEstado.palabra);
  await spy.locator('.carta.tapada').click();
  await innocent.locator('.carta.tapada').click();
  assert.equal(await innocent.locator('#palabra-impostor').count(), 0);
  await spy.locator('#palabra-impostor').fill('Palabra incorrecta');
  await spy.getByRole('button', { name: 'Adivinar palabra' }).click();
  await spy.waitForFunction(() => document.body.textContent.includes('No es la palabra'));
  assert.equal(await spy.evaluate(() => ultimoEstado.fase), 'jugando');
  await spy.locator('#palabra-impostor').fill('borrador');
  await pages[0].evaluate(() => Fiesta.accion('a_votar'));
  await spy.waitForFunction(() => ultimoEstado.fase === 'votando');
  assert.equal(await spy.locator('#palabra-impostor').inputValue(), 'borrador');
  await spy.locator('#palabra-impostor').fill('  ' + word.toUpperCase() + '  ');
  await spy.getByRole('button', { name: 'Adivinar palabra' }).click();
  await Promise.all(pages.map(p => p.waitForFunction(() => ultimoEstado.fase === 'resultado' && ultimoEstado.resultado.motivo === 'palabra')));
  for (const page of pages) {
    assert.ok((await page.locator('#zona-juego').innerText()).includes('¡El impostor adivinó la palabra!'));
    assert.equal(await page.locator('#palabra-impostor').count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: campo exclusivo del impostor, error sin terminar ronda, borrador durante votación y victoria inmediata visible en tres celulares emulados');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
