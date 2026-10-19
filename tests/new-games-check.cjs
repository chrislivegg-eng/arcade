const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5055";
const games = ["air_hockey", "ping_pong", "billar", "karts", "zombis"];

(async () => {
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  async function open(game, mobile = false) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(game + ": " + e.message));
    page.on("dialog", (d) => d.accept("Jugador 2"));
    await page.route("https://fonts.**", (r) => r.abort());
    await page.route("**/api/records/**", async (r) =>
      r.request().method() === "POST"
        ? r.fulfill({ json: { nuevo_record: true } })
        : r.continue(),
    );
    await page.goto(base + "/juego/" + game, { waitUntil: "domcontentloaded" });
    return page;
  }
  const close = (page) => page.context().close();
  for (const mobile of [false, true])
    for (const game of games) {
      const page = await open(game, mobile);
      const modes = await page
        .locator("#menu [data-modo]")
        .evaluateAll((es) =>
          es.map((e) => e.dataset.modo).filter((m) => m !== "online"),
        );
      for (const mode of modes) {
        if (mode !== modes[0])
          await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator("[data-modo=" + mode + "]").click();
        await page.waitForTimeout(300);
        await page.mouse.move(170, 650);
        await page.mouse.down();
        await page.mouse.move(190, 390, { steps: 8 });
        await page.mouse.up();
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(300);
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await close(page);
      console.log(
        "PASS arranque/controles:",
        game,
        mobile ? "móvil" : "PC",
        modes.join("/"),
      );
    }

  const pool = await open("billar");
  const rules = await pool.evaluate(() => {
    function case8(first, pocketed, ownRemaining = false) {
      acomodar();
      J.grupos = ["lisas", "rayadas"];
      for (let i = 1; i <= 7; i++) bolas[i].dentro = true;
      if (ownRemaining) bolas[1].dentro = false;
      return aplicarReglas(0, { primera: first, metidas: pocketed }).ganador;
    }
    return [
      case8(8, [8]),
      case8(9, [8]),
      case8(null, [8]),
      case8(8, [8, 0]),
      case8(8, [8], true),
    ];
  });
  assert.deepEqual(rules, [0, 1, 1, 1, 1]);
  await pool.locator("[data-modo=bot]").click();
  await pool.waitForFunction(() => !!esperandoTiro);
  await pool.evaluate(() => {
    const fire = esperandoTiro;
    esperandoTiro = null;
    fire({ dx: 0, dz: -1, v: 3 });
  });
  await pool.waitForFunction(() => !!M.alCuadro.siguiente);
  await pool.locator("#btn-menu").click();
  await pool.locator("[data-modo=bot]").click();
  await pool.waitForTimeout(700);
  assert.deepEqual(
    await pool.evaluate(() => [
      J.activa,
      !!M.alCuadro.siguiente,
      !!esperandoTiro,
      bolas.every((b) => b.vx === 0 && b.vz === 0),
    ]),
    [true, false, true, true],
  );
  await close(pool);
  console.log(
    "PASS Billar: bola 8 con/sin falta y cancelación de física al reiniciar",
  );

  const zombie = await open("zombis");
  await zombie.locator("[data-modo=solo]").click();
  const tracked = await zombie.evaluate(async () => {
    J.porSalir = [];
    J.entreOleadas = true;
    const old = crearZombi("normal");
    matar(old, false);
    empezar("solo", { nombres: ["Nueva"], partida: 2 });
    J.porSalir = [];
    J.entreOleadas = true;
    const fresh = crearZombi("normal");
    fresh.x = 0;
    fresh.z = -10;
    await new Promise((r) => setTimeout(r, 1900));
    window.freshZombie = fresh;
    return {
      tracked: zombis.includes(fresh),
      inScene: !!fresh.g.parent,
      count: zombis.length,
    };
  });
  assert.deepEqual(tracked, { tracked: true, inScene: true, count: 1 });
  for (let shot = 0; shot < 2; shot++) {
    const point = await zombie.evaluate(() => {
      const head = freshZombie.g.children.find((o) => o.name === "cabeza");
      const p = head.getWorldPosition(new THREE.Vector3()).project(camara);
      return {
        x: ((p.x + 1) * innerWidth) / 2,
        y: ((1 - p.y) * innerHeight) / 2,
      };
    });
    await zombie.mouse.click(point.x, point.y);
    await zombie.waitForTimeout(100);
  }
  await zombie.waitForFunction(() => J.muertos === 1 && freshZombie.muerto);
  assert.equal(await zombie.evaluate(() => J.puntos), 20);
  const ammo = await zombie.evaluate(async () => {
    J.balas = 2;
    recargar();
    empezar("solo", { nombres: ["Nueva"], partida: 3 });
    J.porSalir = [];
    J.entreOleadas = true;
    J.balas = 3;
    await new Promise((r) => setTimeout(r, 1300));
    return J.balas;
  });
  assert.equal(ammo, 3);
  await zombie.evaluate(() => {
    perder();
    empezar("solo", { nombres: ["Otra"], partida: 4 });
    J.porSalir = [];
    J.entreOleadas = true;
  });
  await zombie.waitForTimeout(2000);
  assert.deepEqual(
    await zombie.evaluate(() => [
      J.jugando,
      document.getElementById("menu-fin").classList.contains("oculto"),
    ]),
    [true, true],
  );
  await close(zombie);
  console.log(
    "PASS Zombis: enemigo nuevo recibe disparos; muerte, recarga y fin de partida anteriores no afectan la nueva",
  );

  const kart = await open("karts");
  await kart.locator("[data-modo=bot]").click();
  await kart.waitForFunction(() => J.corriendo);
  await kart.evaluate(() => {
    yo().fin = 1000;
    revisarCarrera(performance.now());
  });
  await kart.locator("#btn-menu").click();
  await kart.locator("[data-modo=bot]").click();
  await kart.waitForTimeout(3800);
  assert.deepEqual(
    await kart.evaluate(() => [
      J.terminado,
      J.corriendo,
      yo().fin,
      document.getElementById("menu-fin").classList.contains("oculto"),
    ]),
    [false, true, null, true],
  );
  await kart.locator("#btn-menu").click();
  await kart.locator("[data-modo=bot]").click();
  await kart.waitForTimeout(1600);
  await kart.locator("#btn-menu").click();
  await kart.locator("[data-modo=bot]").click();
  await kart.waitForTimeout(1200);
  assert.equal(
    await kart.evaluate(() => J.corriendo),
    false,
    "La cuenta anterior no debe adelantar la salida",
  );
  await kart.waitForFunction(() => J.corriendo);
  await kart.evaluate(() => {
    yo().fin = 120000;
    revisarCarrera(performance.now());
  });
  await kart.locator("#menu-fin").waitFor({ state: "visible" });
  await kart.locator("#btn-revancha").click();
  assert.equal(await kart.evaluate(() => J.terminado), false);
  await close(kart);
  console.log(
    "PASS Karts: meta y cuenta anteriores canceladas, fin válido y revancha",
  );

  const ping = await open("ping_pong");
  await ping.locator("[data-modo=bot]").click();
  await ping.waitForFunction(() => !!alDeslizar);
  await ping.evaluate(() => {
    punto(0, "fallo");
  });
  await ping.locator("#btn-menu").click();
  await ping.locator("[data-modo=bot]").click();
  await ping.waitForTimeout(1900);
  assert.deepEqual(
    await ping.evaluate(() => [J.golpeN, J.puntos, !!alDeslizar]),
    [1, [0, 0], true],
  );
  await ping.evaluate(() => {
    J.puntos = [10, 9];
    punto(0, "fallo");
  });
  await ping.locator("#menu-fin").waitFor({ state: "visible" });
  assert.equal(await ping.locator("#fin-texto").innerText(), "¡Ganaste!");
  await close(ping);
  console.log(
    "PASS Ping Pong: un solo saque tras reiniciar y victoria a 11 por dos",
  );

  const hockey = await open("air_hockey");
  await hockey.locator("[data-modo=bot]").click();
  await hockey.waitForTimeout(1300);
  await hockey.evaluate(() => {
    anotar(0, false);
  });
  await hockey.locator("#btn-menu").click();
  await hockey.locator("[data-modo=bot]").click();
  await hockey.waitForTimeout(1500);
  assert.deepEqual(await hockey.evaluate(() => J.goles), [0, 0]);
  await hockey.evaluate(() => {
    J.goles = [6, 0];
    anotar(0, false);
  });
  await hockey.locator("#menu-fin").waitFor({ state: "visible" });
  assert.equal(await hockey.locator("#fin-texto").innerText(), "¡Ganaste!");
  await close(hockey);
  console.log("PASS Air Hockey: goles anteriores cancelados y victoria a 7");

  for (const game of games) {
    const host = await open(game),
      guest = await open(game, true);
    for (const p of [host, guest])
      await p.locator("[data-modo=online]").click();
    await host.locator("#btn-crear").click();
    await host.locator("#menu-espera").waitFor({ state: "visible" });
    const code = await host.locator("#codigo-espera").innerText();
    await guest.locator("#codigo").fill(code);
    await guest.locator("#btn-unirse").click();
    await Promise.all(
      [host, guest].map((p) => p.waitForFunction(() => ui.modo === "online")),
    );
    await guest.evaluate(() => {
      window.observed = [];
      const old = ui.alEvento;
      ui.alEvento = (type, data) => {
        observed.push(type);
        old?.(type, data);
      };
    });
    await host.evaluate(() => ui.enviar("prueba", { valor: 42 }));
    await guest.waitForFunction(() => observed.includes("prueba"));
    if (game === "air_hockey") {
      await host.evaluate(() => {
        P[0].objX = 0.2;
        P[0].objZ = 0.6;
      });
      await guest.waitForFunction(() => Math.abs(P[0].objX - 0.2) < 0.01);
    }
    if (game === "karts") await guest.waitForFunction(() => !!J.remoto);
    if (game === "zombis") {
      await host.waitForTimeout(600);
      await host.evaluate(() => {
        J.puntos = 40;
        marcador();
      });
      await guest.waitForFunction(() => J.rival === 40);
    }
    await close(host);
    await close(guest);
    console.log("PASS conexión/eventos online PC/móvil:", game);
  }
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
