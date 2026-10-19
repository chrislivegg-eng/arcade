const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ARCADE_URL || 'http://127.0.0.1:5055';
const games = ['wordle', '2048', 'combina3', 'sudoku', 'buscaminas', 'ajedrez', 'damas', 'serpientes', 'parchis'];
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  async function open(game, mobile = false) {
    const c = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(`${game}: ${e.message}`));
    p.on('dialog', d => d.accept('Segundo'));
    await p.goto(base + '/juego/' + game);
    await p.locator('[data-modo]').first().waitFor();
    return p;
  }
  const close = p => p.context().close();
  for (const mobile of [false, true]) for (const game of games) {
    const p = await open(game, mobile);
    const modes = await p.locator('#menu [data-modo]').evaluateAll(es => es.map(e => e.dataset.modo).filter(m => m !== 'online'));
    for (const mode of modes) {
      await p.locator(`[data-modo=${mode}]`).click();
      assert.equal(await p.evaluate(() => J.activa), true, `${game}/${mode}`);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.reload();
    }
    await close(p);
  }
  console.log('PASS nueve juegos: arranque bot/local/solo en PC y móvil');

  const word = await open('wordle');
  await word.locator('[data-modo=solo]').click();
  await word.waitForFunction(() => !!window.Perfil);
  const wordResult = await word.evaluate(async () => {
    J.actual = 'ZZZZZ'; await enviarIntento(); const invalid = J.intentos.length;
    J.actual = J.palabra; const pending = enviarIntento();
    J.actual = PALABRAS.find(p => p !== J.palabra); await enviarIntento();
    await pending;
    return { invalid, attempts: J.miFin.intentos, solved: J.miFin.resuelto };
  });
  assert.deepEqual(wordResult, { invalid: 0, attempts: 1, solved: true });
  await word.waitForFunction(() => Perfil.datos?.logros?.wordle_2);
  const stats = await word.evaluate(async () => (await Perfil.cargar()).stats.partidas);
  await word.evaluate(() => ui.terminar({ texto: 'Repetido', gano: true }));
  assert.equal(await word.evaluate(async () => (await Perfil.cargar()).stats.partidas), stats);
  await close(word);
  console.log('PASS Wordle: diccionario, bloqueo de doble envío, logro y un solo premio');

  const sudoku = await open('sudoku');
  await sudoku.locator('[data-modo=solo]').click();
  assert.equal(await sudoku.evaluate(() => contar(J.b.slice(), 2)), 1);
  const lives = await sudoku.evaluate(() => {
    J.sel = J.b.findIndex(v => !v); const wrong = J.solucion[J.sel] === 1 ? 2 : 1;
    for (let i = 0; i < 8; i++) poner(wrong);
    return J.vidas;
  });
  assert.equal(lives, 0);
  await sudoku.locator('#btn-menu').click();
  await sudoku.locator('[data-modo=solo]').click();
  await sudoku.waitForTimeout(800);
  assert.equal(await sudoku.evaluate(() => J.activa && J.vidas === 3 && document.querySelector('#menu-fin').classList.contains('oculto')), true);
  await sudoku.evaluate(() => { for (let i = 0; i < 81; i++) if (!J.b[i]) { J.sel = i; poner(J.solucion[i]); } });
  await sudoku.locator('#menu-fin').waitFor({ state: 'visible' });
  await close(sudoku);
  console.log('PASS Sudoku: solución única, vidas sin negativos, derrota cancelada y victoria');

  const chess = await open('ajedrez');
  await chess.locator('[data-modo=local]').click();
  assert.equal(await chess.evaluate(() => {
    function perft(pos, depth) { return depth ? legales(pos).reduce((n, m) => n + perft(aplicar(pos, m), depth - 1), 0) : 1; }
    return perft(nuevaPosicion(), 3);
  }), 8902);
  await chess.evaluate(() => { J.pos.b = Array(64).fill('.'); J.pos.b[0] = 'k'; J.pos.b[18] = 'K'; J.pos.b[17] = 'Q'; J.pos.turno = 'b'; J.pos.enroque = ''; revisarFin(); });
  await chess.locator('#btn-menu').click();
  await chess.locator('[data-modo=local]').click();
  await chess.waitForTimeout(1400);
  assert.equal(await chess.evaluate(() => J.activa && document.querySelector('#menu-fin').classList.contains('oculto')), true);
  await close(chess);
  console.log('PASS Ajedrez: 8902 posiciones legales y final anterior cancelado');

  const merge = await open('2048');
  await merge.locator('[data-modo=solo]').click();
  assert.deepEqual(await merge.evaluate(() => moverNum([[2, 2, 2, 2], [4, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'izq').g), [[4, 4, 0, 0], [8, 8, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  await merge.evaluate(() => { jugada('aba'); });
  await merge.locator('#btn-menu').click(); await merge.locator('[data-modo=solo]').click();
  await merge.waitForTimeout(300);
  assert.equal(await merge.evaluate(() => J.g.flat().filter(Boolean).length), 2);
  await close(merge);

  const match = await open('combina3');
  await match.locator('[data-modo=solo]').click();
  assert.equal(await match.evaluate(() => buscarGrupos(S.g).length), 0);
  await match.evaluate(async () => { await jugar(...jugadas(S.g)[0]); });
  assert.equal(await match.evaluate(() => S.movs), 24);
  await match.evaluate(() => { jugar(...jugadas(S.g)[0]); });
  await match.locator('#btn-menu').click(); await match.locator('[data-modo=solo]').click();
  await match.waitForTimeout(1200);
  assert.equal(await match.evaluate(() => S.movs), 25);
  await close(match);
  console.log('PASS 2048 y Combina 3: reglas de combinación y animaciones canceladas');

  const mines = await open('buscaminas');
  await mines.locator('[data-modo=solo]').click();
  await mines.evaluate(() => { explotar([...J.minas][0]); });
  await mines.locator('#btn-menu').click(); await mines.locator('[data-modo=solo]').click();
  await mines.waitForTimeout(1800);
  assert.equal(await mines.evaluate(() => J.activa), true);
  await mines.evaluate(() => { for (let i = 0; i < J.total; i++) if (!J.minas.has(i)) excavar(i); });
  await mines.locator('#menu-fin').waitFor({ state: 'visible' });
  await close(mines);
  console.log('PASS Buscaminas: explosión anterior cancelada y campo limpio');

  for (const game of ['serpientes', 'parchis']) {
    const p = await open(game); await p.locator('[data-modo=local]').click();
    await p.evaluate(g => { if (g === 'serpientes') jugarTiro(6); else lanzar(6); }, game);
    await p.locator('#btn-menu').click(); await p.locator('[data-modo=local]').click();
    await p.waitForTimeout(1800);
    assert.equal(await p.evaluate(g => g === 'serpientes' ? J.pos.every(x => x === 0) : Object.values(J.fichas).flat().every(x => x === -1), game), true);
    await p.evaluate(async g => { if (g === 'serpientes') { J.pos = [99, 0]; await jugarTiro(1); } else { J.fichas[0] = [META, META, META, META - 1]; J.dado = 1; await mover(3); } }, game);
    await p.locator('#menu-fin').waitFor({ state: 'visible' }); await close(p);
  }
  console.log('PASS Serpientes/Parchís: reinicio durante dado y victoria');

  for (const game of games) {
    const host = await open(game), guest = await open(game, true);
    for (const p of [host, guest]) await p.locator('[data-modo=online]').click();
    await host.locator('#btn-crear').click(); await host.locator('#menu-espera').waitFor({ state: 'visible' });
    await guest.locator('#codigo').fill(await host.locator('#codigo-espera').innerText());
    await guest.locator('#btn-unirse').click();
    await Promise.all([host, guest].map(p => p.waitForFunction(() => ui.modo === 'online' && J.activa)));
    if (game === 'ajedrez') { await host.evaluate(() => jugarYo(legales(J.pos).find(m => m.de === 52 && m.a === 36))); await guest.waitForFunction(() => J.historial.length === 1); }
    else if (game === 'damas') { await host.evaluate(() => jugarYo(jugadas(J.pos)[0])); await guest.waitForFunction(() => J.n === 1); }
    else if (game === 'wordle') { await host.evaluate(() => { J.actual = J.palabra; enviarIntento(); }); await guest.waitForFunction(() => !!J.rival.fin); await guest.evaluate(() => { J.actual = J.palabra; enviarIntento(); }); await Promise.all([host, guest].map(p => p.locator('#menu-fin').waitFor({ state: 'visible' }))); }
    else if (game === 'serpientes') { await host.evaluate(() => tirar()); await guest.waitForFunction(() => J.n === 1); }
    else if (game === 'parchis') { await host.evaluate(() => lanzar(6)); await guest.waitForFunction(() => J.n === 1); }
    else if (game === 'sudoku') { await host.evaluate(() => { for (let i = 0; i < 81; i++) if (!J.b[i]) { J.sel = i; poner(J.solucion[i]); } }); await guest.locator('#menu-fin').waitFor({ state: 'visible' }); }
    else if (game === 'buscaminas') { await host.evaluate(() => { for (let i = 0; i < J.total; i++) if (!J.minas.has(i)) excavar(i); }); await guest.locator('#menu-fin').waitFor({ state: 'visible' }); }
    else { await host.evaluate(() => terminarMio()); await guest.waitForFunction(() => J.rival.fin); }
    await close(host); await close(guest);
    console.log('PASS online PC/móvil:', game);
  }
  assert.deepEqual(errors, []);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
