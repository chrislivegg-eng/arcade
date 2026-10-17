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
  async function pageFor(mobile = false, fallback = false) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1050 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://fonts.**", (r) => r.abort());
    // Nunca escribir récords de prueba en una instalación real.
    await page.route("**/guardar_victoria_nav*", (r) =>
      r.fulfill({ json: { status: "ok" } }),
    );
    if (fallback)
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return /webgl/.test(type) ? null : original.call(this, type, ...args);
        };
      });
    await page.goto(base + "/juego_naval", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    return page;
  }
  async function cell(page, side, index) {
    await page.locator("#oceano").scrollIntoViewIfNeeded();
    const point = await page.evaluate(
      ([side, index]) => Naval.projectCell(side, index),
      [side, index],
    );
    await page.mouse.click(point.x, point.y);
  }
  async function setupBot(page) {
    await page.evaluate(() => {
      let i = 0;
      Math.random = () => [0, 0.04, 0.08][i++ % 3];
    });
    await page.locator("#btn-bot").click();
    for (const i of [0, 1, 2]) await cell(page, 0, i);
    await page.waitForFunction(() => Naval.phase === "playing");
    assert.equal(await page.locator("#cuenta-mia").innerText(), "3 / 3");
  }
  for (const mobile of [false, true]) {
    const page = await pageFor(mobile);
    await setupBot(page);
    for (const i of [0, 1, 2]) {
      await cell(page, 1, i);
      await page.waitForFunction(
        (i) =>
          document.querySelector("#t-enemigo").children[i].dataset.value ===
          "3",
        i,
      );
      await page.waitForTimeout(950);
    }
    await page.locator("#resultado").waitFor({ state: "visible" });
    assert.equal(
      await page.locator("#resultado-titulo").innerText(),
      "Océano bajo control.",
    );
    await page.locator("#nombre-record").fill("Capitan Prueba");
    await page.locator("#btn-guardar").click();
    await page.waitForFunction(() =>
      document.querySelector("#record-status").textContent.includes("guardada"),
    );
    await page.locator("#btn-otra").click();
    assert.equal(await page.evaluate(() => Naval.phase), "placing");
    assert.equal(await page.locator('#t-enemigo [data-value="3"]').count(), 0);
    await page.context().close();
    console.log(
      "PASS: " +
        (mobile ? "móvil" : "PC") +
        " · colocación y disparos en 3D, victoria, ranking y reinicio",
    );
  }
  // Las animaciones pendientes del bot no deben tocar una partida nueva.
  const cancel = await pageFor();
  await setupBot(cancel);
  await cell(cancel, 1, 24);
  await cancel.locator("#pantalla-juego [data-volver]").click();
  await cancel.locator("#btn-bot").click();
  await cancel.waitForTimeout(1900);
  assert.equal(await cancel.evaluate(() => Naval.phase), "placing");
  assert.equal(
    await cancel
      .locator('#t-mio [data-value="2"], #t-mio [data-value="3"]')
      .count(),
    0,
  );
  await cancel.context().close();
  console.log("PASS: salir cancela el disparo pendiente del bot");

  const host = await pageFor(),
    guest = await pageFor(true);
  await host.locator("#btn-online").click();
  await host.locator("#btn-crear").click();
  await host.waitForFunction(() => Naval.mode === "online");
  const code = (await host.locator("#texto-codigo-sala").innerText()).replace(
    "SALA ",
    "",
  );
  await guest.locator("#btn-online").click();
  await guest.locator("#input-codigo").fill(code);
  await guest.locator("#form-sala button[type=submit]").click();
  await guest.waitForFunction(() => Naval.mode === "online");
  for (const i of [0, 1, 2]) await cell(host, 0, i);
  for (const i of [20, 21, 22]) await cell(guest, 0, i);
  await Promise.all(
    [host, guest].map((p) =>
      p.waitForFunction(() => Naval.phase === "playing"),
    ),
  );
  await guest.locator("#vista-tactica summary").click();
  assert.equal(
    await guest.locator("#t-enemigo button:not(:disabled)").count(),
    0,
  );
  await cell(host, 1, 19);
  await guest.waitForFunction(() =>
    document.querySelector("#mensaje").textContent.startsWith("Tu turno"),
  );
  await cell(guest, 1, 24);
  await host.waitForFunction(() =>
    document.querySelector("#mensaje").textContent.startsWith("Tu turno"),
  );
  for (const i of [20, 21, 22]) {
    await cell(host, 1, i);
    await host.waitForFunction(
      (i) =>
        document.querySelector("#t-enemigo").children[i].dataset.value === "3",
      i,
    );
  }
  await Promise.all(
    [host, guest].map((p) =>
      p.locator("#resultado").waitFor({ state: "visible" }),
    ),
  );
  assert.equal(
    await host.locator("#resultado-titulo").innerText(),
    "Océano bajo control.",
  );
  assert.equal(
    await guest.locator("#resultado-titulo").innerText(),
    "Volveremos a zarpar.",
  );
  assert.equal(await host.locator("#cuenta-enemiga").innerText(), "0 / 3");
  assert.equal(await guest.locator("#cuenta-mia").innerText(), "0 / 3");
  await host.context().close();
  await guest.context().close();
  console.log(
    "PASS: sala online PC/móvil, turnos, agua, impactos y victoria compartida",
  );

  const fallback = await pageFor(true, true);
  await fallback.locator("#btn-bot").click();
  assert.equal(
    await fallback.locator("#vista-tactica").getAttribute("open"),
    "",
  );
  for (const i of [0, 1, 2])
    await fallback.locator("#t-mio button").nth(i).click();
  await fallback.waitForFunction(() => Naval.phase === "playing");
  assert.equal(await fallback.locator('#t-mio [data-value="1"]').count(), 3);
  await fallback.context().close();
  console.log("PASS: controles accesibles sin WebGL");
  assert.deepEqual(errors, []);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
