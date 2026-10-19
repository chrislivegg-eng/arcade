const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5055';
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const contexts = await Promise.all([b.newContext(), b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })]);
  const pages = await Promise.all(contexts.map(c => c.newPage())); const errors = [];
  for (const [i, p] of pages.entries()) {
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/uno'); await p.locator('#nombre').fill('UNO ' + i);
  }
  await pages[0].locator('#btn-crear').click(); await pages[0].locator('#pantalla-sala').waitFor({ state: 'visible' });
  const code = await pages[0].locator('#codigo-sala').innerText();
  await pages[1].locator('#codigo').fill(code); await pages[1].locator('#btn-unirse').click();
  await pages[0].waitForFunction(() => Fiesta.estado.jugadores.length === 2);
  await pages[0].getByRole('button', { name: /Repartir cartas/ }).click();
  await Promise.all(pages.map(p => p.waitForFunction(() => Fiesta.estado?.fase === 'jugando')));
  const ids = await Promise.all(pages.map(p => p.evaluate(() => Fiesta.pid)));
  let result;
  for (let n = 0; n < 1500; n++) {
    const states = await Promise.all(pages.map((p, i) => p.evaluate(async ({ code, pid }) => (await fetch(`/api/fiesta/estado/${code}?pid=${pid}`)).json(), { code, pid: ids[i] })));
    if (states[0].fase === 'resultado') { result = states[0]; break; }
    const i = ids.indexOf(states[0].turno); assert.notEqual(i, -1);
    const s = states[i];
    if (s.mano.length === 2) await pages[i].evaluate(() => Fiesta.accion('uno', {}, true));
    if (s.jugables.length) {
      const card = s.mano.find(c => c.id === s.jugables[0]);
      if (card.c === 'negro') {
        // La selección del color usa la misma interfaz que en una partida humana.
        await pages[i].evaluate(({ s, card }) => { jugar(card.id); }, { s, card });
        // La vista puede ir un sondeo detrás; enviar la carta legal obtenida de la sala.
        const selector = pages[i].locator('.selector-color [data-c=rojo]');
        if (await selector.count()) await Promise.all([
          pages[i].waitForResponse(r => r.url().endsWith('/api/fiesta/accion') && r.request().method() === 'POST'),
          selector.click(),
        ]);
        else await pages[i].evaluate(id => Fiesta.accion('jugar', { id, color: 'rojo' }, true), card.id);
      } else await pages[i].evaluate(id => Fiesta.accion('jugar', { id }, true), card.id);
    } else await pages[i].evaluate(robo => Fiesta.accion(robo == null ? 'robar' : 'pasar', {}, true), s.robo);
  }
  assert.ok(result, 'La partida debe terminar');
  await Promise.all(pages.map(p => p.waitForFunction(() => Fiesta.estado?.fase === 'resultado')));
  const winner = ids.indexOf(result.ganador_ronda); assert.notEqual(winner, -1);
  await pages[winner].waitForFunction(() => Perfil.datos?.logros?.uno);
  const before = await pages[winner].evaluate(async () => (await Perfil.cargar()).monedas);
  await pages[winner].reload();
  await pages[winner].waitForFunction(() => Fiesta.estado?.fase === 'resultado');
  await pages[winner].waitForTimeout(1500);
  assert.equal(await pages[winner].evaluate(async () => (await Perfil.cargar()).monedas), before);
  assert.deepEqual(errors, []);
  await b.close(); console.log('PASS UNO: partida completa PC/móvil, ganador, logro y recarga sin doble premio');
})().catch(e => { console.error(e); process.exit(1); });
