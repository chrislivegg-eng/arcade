const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5055';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  async function open(game, mobile = false) {
    const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const p = await c.newPage(); p.on('pageerror', e => errors.push(game + ': ' + e.message)); p.on('dialog', d => d.accept('Segundo'));
    await p.goto(base + '/juego/' + game); return p;
  }
  async function restart(p, mode) { await p.locator('#btn-menu').click(); await p.locator(`[data-modo=${mode}]`).click(); }
  const hidden = p => p.evaluate(() => document.querySelector('#menu-fin').classList.contains('oculto'));
  for (const game of ['box', 'espadas']) {
    const p = await open(game); await p.locator('[data-modo=bot]').click(); await p.waitForFunction(() => J.activa);
    await p.evaluate(() => { ko(1); }); await restart(p, 'bot'); await p.waitForTimeout(2300);
    assert.equal(await hidden(p), true); assert.equal(await p.evaluate(() => J.activa), true);
    // El KO de la partida actual sí debe terminar y entregar una sola victoria.
    await p.evaluate(() => { ko(1); }); await p.locator('#menu-fin').waitFor({ state: 'visible' });
    await p.locator('#btn-fin-menu').click(); await p.locator('[data-modo=bot]').click(); await p.waitForFunction(() => J.activa);
    await p.evaluate(() => { ko(0); }); await restart(p, 'bot'); await p.waitForTimeout(1900);
    assert.equal(await hidden(p), true); assert.equal(await p.locator('#destello').evaluate(e => +e.style.opacity), 0);
    await p.context().close(); console.log('PASS sesión de KO y final válido:', game);
  }
  const flow = await open('flow'); await flow.locator('[data-modo=solo]').click();
  await flow.evaluate(async () => { await Promise.all([resuelto(), resuelto()]); });
  assert.equal(await flow.evaluate(() => J.hechos), 1);
  await flow.evaluate(() => { resuelto(); }); await restart(flow, 'solo'); await flow.waitForTimeout(850);
  assert.equal(await flow.evaluate(() => J.hechos), 0); await flow.context().close();
  console.log('PASS Flow: un tablero por transición y reinicio');

  for (const [game, mode, start, check, wait] of [
    ['arco', 'solo', () => { registrar(0, { puntos: 4 }); }, () => J.tiro === 0 && J.puntos.every(x => x === 0), 1700],
    ['paracaidas', 'solo', () => { aterrizar(); }, () => P.vivo, 2000],
    ['nieve', 'solo', () => { siguienteTurno(); }, () => J.ronda === 1 && J.turno === 0, 1700],
    ['curling', 'local', () => { lanzar(0, -5, 0); }, () => J.tiro === 0 && J.turno === 0 && piedras.length === 0, 1800],
    ['yahtzee', 'solo', () => { tirar([6, 6, 6, 6, 6], [false, false, false, false, false]); }, () => J.tiros === 0 && !J.ocupado, 850],
    ['parejas', 'solo', () => { voltear(0); voltear(1); }, () => J.n === 0 && J.abiertas.length === 0 && J.pares.every(x => x === 0), 1200],
  ]) {
    const p = await open(game); await p.locator(`[data-modo=${mode}]`).click();
    await p.evaluate(start); await restart(p, mode); await p.waitForTimeout(wait);
    assert.equal(await p.evaluate(check), true, game); assert.equal(await hidden(p), true, game);
    await p.context().close(); console.log('PASS animación anterior cancelada:', game);
  }
  const math = await open('mate'); await math.locator('[data-modo=solo]').click();
  await math.locator('#btn-menu').click(); await math.waitForTimeout(2100);
  assert.equal(await math.evaluate(() => J.activa), false); await math.context().close();
  console.log('PASS salir durante cuenta de Mate Rápido');

  const a = await open('asteroides'), b = await open('asteroides', true);
  for (const p of [a, b]) await p.locator('[data-modo=online]').click();
  await a.locator('#btn-crear').click(); await a.locator('#menu-espera').waitFor({ state: 'visible' });
  await b.locator('#codigo').fill(await a.locator('#codigo-espera').innerText()); await b.locator('#btn-unirse').click();
  await Promise.all([a, b].map(p => p.waitForFunction(() => J.activa && J.modo === 'online')));
  for (const p of [a, b]) await p.evaluate(() => { J.siguienteRoca = 1e8; for (const n of N) { n.invencible = 1e8; n.cadencia = 1e8; } balas.forEach(x => escena.remove(x.malla)); balas = []; });
  async function rock(id, both = true) { for (const p of both ? [a, b] : [a]) await p.evaluate(id => crearRoca(id, 1, 0, 0, -30, 0, 0, 0), id); }
  const scores = p => p.evaluate(() => [J.equipo, ...N.map(n => n.puntos)]);
  await rock('choque'); await b.evaluate(() => romperRoca('choque', null, true));
  await b.waitForFunction(() => !rocas.has('choque'));
  assert.deepEqual(await scores(a), [0, 0, 0]); assert.deepEqual(await scores(b), [0, 0, 0]);
  await rock('doble'); await Promise.all([a.evaluate(() => romperRoca('doble', 0, true)), b.evaluate(() => romperRoca('doble', 1, true))]);
  await b.waitForFunction(() => J.equipo > 0); assert.deepEqual(await scores(a), await scores(b));
  const won = await scores(a); assert.equal(won[1] + won[2], won[0]); assert.equal(won[0], 100);
  await rock('temprana', false); await a.evaluate(() => romperRoca('temprana', 0, true));
  await b.waitForFunction(() => destruidas.has('temprana'));
  await b.evaluate(() => crearRoca('temprana', 1, 0, 0, -30, 0, 0, 0));
  assert.equal(await b.evaluate(() => rocas.has('temprana')), false); assert.deepEqual(await scores(a), await scores(b));
  await a.evaluate(() => ui.enviar('roca', { partida: J.partida, id: 'vieja', version: 0, equipo: 0, puntos: [0, 0] }));
  await b.waitForTimeout(400); assert.deepEqual(await scores(a), await scores(b));
  for (const p of [a, b]) await p.evaluate(() => { N[ui.yo].viva = false; N[ui.yo].vidas = 0; ui.enviar('muerto', { partida: J.partida }); revisarFin(); });
  await Promise.all([a, b].map(p => p.locator('#menu-fin').waitFor({ state: 'visible' })));
  assert.equal(await a.locator('#fin-texto').innerText(), await b.locator('#fin-texto').innerText());
  await a.context().close(); await b.context().close();
  console.log('PASS Asteroides: choque, destrucción simultánea, evento temprano, orden y final compartido');
  assert.deepEqual(errors, []); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
