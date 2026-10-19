const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5055";

(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  async function open(mobile = false) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept("Jugador 2"));
    await page.route("https://fonts.**", (r) => r.abort());
    await page.route("**/api/records/beer_pong", async (r) =>
      r.request().method() === "POST"
        ? r.fulfill({ json: { nuevo_record: true } })
        : r.continue(),
    );
    await page.goto(base + "/juego/beer_pong", {
      waitUntil: "domcontentloaded",
    });
    return page;
  }
  const physics = await open();
  const calibration = await physics.evaluate(async () => {
    cancelarPartida();
    J.activa = true;
    J.sesion++;
    crearVasos();
    async function shoot(j, target) {
      const pending = simular(j, target);
      for (let n = 0; n < 900 && tiroActual; n++) {
        const prev = cuerpoPelota.position.clone();
        mundoFisico.step(1 / 120);
        revisarTiro(prev);
      }
      if (tiroActual) {
        // Los subpasos corren sin esperar tiempo de reloj; activa el límite real del tiro.
        tiroActual.inicio = performance.now() - 6000;
        revisarTiro(cuerpoPelota.position.clone());
      }
      return pending;
    }
    const centers = [],
      misses = [];
    for (const j of [0, 1])
      for (let i = 0; i < 6; i++) {
        const v = vasos[1 - j][i];
        centers.push([j, i, await shoot(j, { x: v.x, z: v.z })]);
      }
    for (const j of [0, 1]) {
      const v = vasos[1 - j][0];
      for (const dx of [-0.04, 0.04])
        misses.push(await shoot(j, { x: v.x + dx, z: v.z }));
    }
    const originalRandom = Math.random;
    let seed = 1729;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const levels = {};
    for (const difficulty of ["facil", "normal", "pro"]) {
      J.dificultad = difficulty;
      let hits = 0;
      for (let i = 0; i < 120; i++)
        if ((await shoot(1, tiroBot(1))) >= 0) hits++;
      levels[difficulty] = hits / 120;
    }
    Math.random = originalRandom;
    cancelarPartida();
    return { centers, misses, levels };
  });
  calibration.centers.forEach(([j, i, got]) =>
    assert.equal(got, i, `centro ${j}/${i}`),
  );
  assert.ok(
    calibration.misses.every((v) => v === -1),
    JSON.stringify(calibration.misses),
  );
  assert.ok(
    calibration.levels.normal > calibration.levels.facil + 0.15,
    JSON.stringify(calibration.levels),
  );
  assert.ok(
    calibration.levels.pro > calibration.levels.normal + 0.15,
    JSON.stringify(calibration.levels),
  );
  assert.ok(calibration.levels.pro < 1, "El bot no debe ser infalible");
  console.log(
    "PASS: entrada limpia, roces rechazados y dificultad graduada",
    JSON.stringify(calibration.levels),
  );
  await physics.context().close();

  async function swipe(page, cup) {
    await page.waitForFunction(() => !!esperandoTiro);
    const gesture = await page.evaluate((cup) => {
      const v = vasos[1 - J.turno][cup];
      const power = (Math.abs(v.z) - 0.45) / 1.2;
      const dy = power * innerHeight * 0.46;
      return {
        x: innerWidth / 2,
        y: innerHeight * 0.78,
        dy,
        dx: (v.x / J.lado / 0.6) * dy,
      };
    }, cup);
    await page.mouse.move(gesture.x, gesture.y);
    await page.mouse.down();
    await page.mouse.move(gesture.x + gesture.dx, gesture.y - gesture.dy, {
      steps: 12,
    });
    const power = await page.locator("#potencia-texto").innerText();
    assert.notEqual(power, "0%");
    await page.mouse.up();
  }
  for (const mobile of [false, true]) {
    const page = await open(mobile);
    // Bot determinista para comprobar la animación y las retiradas de vasos.
    await page.evaluate(() => {
      tiroBot = (j) => {
        const v = vasos[1 - j].find((v) => v.vivo);
        return { x: v.x, z: v.z };
      };
    });
    await page.locator("[data-modo=bot]").click();
    await page.waitForTimeout(900);
    await swipe(page, 0);
    await page.waitForFunction(() => quedan(1) === 5);
    await swipe(page, 1);
    await page.waitForFunction(() => J.turno === 1 && J.camaraRival);
    await page.waitForFunction(() => simulando && J.turno === 1);
    await page.waitForTimeout(150);
    const visible = await page.evaluate(() =>
      vasos
        .flat()
        .filter((v) => v.vivo)
        .every((v) => {
          const p = v.grupo.position.clone().project(camara);
          return (
            Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.9 && p.z > -1 && p.z < 1
          );
        }),
    );
    assert.ok(
      visible,
      "Deben verse los dos lados de la mesa durante el tiro del bot",
    );
    assert.equal(
      await page.evaluate(() => pelota.visible && estela.visible),
      true,
    );
    await page.waitForFunction(
      () => quedan(0) === 4 && J.turno === 0 && !!esperandoTiro,
    );
    assert.equal(
      await page.evaluate(() => quedan(1)),
      4,
      "Dos aciertos no conceden otro turno",
    );
    for (const cup of [2, 3]) {
      await swipe(page, cup);
      await page.waitForFunction((i) => !vasos[1][i].vivo, cup);
    }
    await page.waitForFunction(
      () => quedan(0) === 2 && J.turno === 0 && !!esperandoTiro,
    );
    for (const cup of [4, 5]) {
      await swipe(page, cup);
      await page.waitForFunction((i) => !vasos[1][i].vivo, cup);
    }
    await page.locator("#menu-fin").waitFor({ state: "visible" });
    assert.equal(await page.locator("#fin-texto").innerText(), "¡Ganaste!");
    assert.equal(await page.evaluate(() => quedan(0)), 2);
    await page.locator("#btn-revancha").click();
    assert.equal(await page.evaluate(() => quedan(0) + quedan(1)), 12);
    await page.context().close();
    console.log(
      "PASS: " +
        (mobile ? "móvil" : "PC") +
        " · gestos, potencia, turnos alternados, cámara/estela del bot, impactos en tus vasos, victoria y revancha",
    );
  }
  // Salir mientras el bot apunta no debe lanzar una pelota en la partida siguiente.
  const cancel = await open();
  await cancel.locator("[data-modo=bot]").click();
  await swipe(cancel, 0);
  await cancel.waitForFunction(() => quedan(1) === 5);
  await swipe(cancel, 1);
  await cancel.waitForFunction(
    () => J.turno === 1 && J.camaraRival && !simulando,
  );
  await cancel.locator("#btn-menu").click();
  await cancel.locator("[data-modo=bot]").click();
  await cancel.waitForTimeout(1800);
  assert.deepEqual(
    await cancel.evaluate(() => [
      quedan(0),
      quedan(1),
      J.turno,
      !!esperandoTiro,
      simulando,
    ]),
    [6, 6, 0, true, false],
  );
  await cancel.context().close();
  // Dos rondas online: el observador reproduce el lanzamiento y ambos conservan el mismo marcador.
  const host = await open(),
    guest = await open(true);
  for (const page of [host, guest])
    await page.locator("[data-modo=online]").click();
  await host.locator("#btn-crear").click();
  await host.locator("#menu-espera").waitFor({ state: "visible" });
  const code = await host.locator("#codigo-espera").innerText();
  await guest.locator("#codigo").fill(code);
  await guest.locator("#btn-unirse").click();
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(() => J.modo === "online" && J.activa),
    ),
  );
  for (let turn = 0; turn < 2; turn++) {
    const actor = (await host.evaluate(() => soyYo(J.turno))) ? host : guest;
    const observer = actor === host ? guest : host;
    for (const cup of [0, 1]) {
      await swipe(actor, cup);
      await observer.waitForFunction(() => J.camaraRival && simulando);
      await observer.waitForFunction((i) => !vasos[1 - J.turno][i].vivo, cup);
    }
    await Promise.all(
      [host, guest].map((p) =>
        p.waitForFunction((n) => J.tiroN >= n && !simulando, (turn + 1) * 2),
      ),
    );
    if (turn === 0)
      await observer.waitForFunction(() => soyYo(J.turno) && !!esperandoTiro);
  }
  for (const page of [host, guest])
    assert.deepEqual(await page.evaluate(() => [quedan(0), quedan(1)]), [4, 4]);
  await host.context().close();
  await guest.context().close();
  console.log(
    "PASS: dos turnos online PC/móvil, trayectoria del rival y marcadores sincronizados",
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("PASS: cancelación del turno anterior y sin errores JavaScript");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
