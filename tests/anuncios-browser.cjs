const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5056";

(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  async function page(path, mobile = false) {
    const p = await browser.newPage({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    p.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
    await p.goto(base + path);
    return p;
  }
  async function startSolo(p) {
    await p.locator("#nombre").fill("PromoQA");
    await p.locator('[data-modo="solo"]').click();
  }
  async function acceptRevive(p) {
    await p.locator("#menu-revivir").waitFor({ state: "visible" });
    assert(await p.locator("#btn-revivir").isDisabled());
    assert((await p.locator("#menu-revivir .promo-titulo").textContent()).trim());
    await p.locator("#btn-revivir").waitFor({ state: "visible" });
    await p.waitForFunction(() => !document.querySelector("#btn-revivir").disabled);
    await p.locator("#btn-revivir").click();
  }
  try {
    const z = await page("/juego/zombis", true);
    await startSolo(z);
    await z.locator("#armeria-z").waitFor({ state: "visible" });
    await z.locator("#continuar-z").click();
    await z.waitForFunction(() => J.oleada === 1 && J.jugando);
    await z.evaluate(() => void perder());
    await z.locator("#menu-revivir").waitFor({ state: "visible" });
    assert.equal(await z.locator("#btn-revivir").isDisabled(), true);
    await z.waitForTimeout(1100);
    assert((await z.locator("#btn-revivir").textContent()).includes("3"));
    await acceptRevive(z);
    await z.waitForFunction(() => J.jugando && J.vida === 55);
    await z.evaluate(() => void perder());
    await z.locator("#menu-fin").waitFor({ state: "visible" });
    assert.equal(await z.locator("#menu-revivir").isVisible(), false);
    assert.equal(await z.locator("#fin-promo").isVisible(), true);
    assert(!new URL(await z.locator("#fin-promo").getAttribute("href"), base).pathname.includes("zombis"));
    assert.equal(await z.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await z.close();

    for (const game of ["corredor", "paracaidas", "surf", "cruza_calle"]) {
      const p = await page("/juego/" + game);
      await startSolo(p);
      await p.evaluate(() => {
        const original = ui.ofrecerRevivir;
        ui.ofrecerRevivir = (options = {}) => original({ ...options, segundos: 1 });
      });
      if (game === "corredor") {
        await p.waitForFunction(() => P.vivo);
        await p.evaluate(() => { P.vivo = false; void terminarCorrida(); });
      } else if (game === "paracaidas") {
        await p.waitForFunction(() => P.vivo);
        await p.evaluate(() => { P.vivo = false; P.accidente = true; void terminarSalto(); });
      } else if (game === "surf") {
        await p.waitForFunction(() => J.activa);
        await p.evaluate(() => { J.tiempo = 30; void terminarOla(); });
      } else {
        await p.waitForFunction(() => J.jugando);
        await p.evaluate(() => void morir("carro"));
      }
      await acceptRevive(p);
      if (game === "corredor") assert(await p.evaluate(() => P.vivo));
      if (game === "paracaidas") assert(await p.evaluate(() => P.vivo && P.y > 0));
      if (game === "surf") assert(await p.evaluate(() => J.activa && J.tiempo < 30));
      if (game === "cruza_calle") assert(await p.evaluate(() => J.jugando && P.vivo));
      assert.equal(await p.evaluate(() => ui.ofrecerRevivir().then(Boolean)), false);
      await p.close();
    }

    const pinball = await page("/juego/pinball");
    await pinball.evaluate(() => Perfil.anuncioFinal(document.querySelector("#final"), "pinball"));
    assert.equal(await pinball.locator("#final .perfil-promo").count(), 1);
    assert(!new URL(await pinball.locator("#final .perfil-promo").getAttribute("href"), base).pathname.includes("pinball"));
    await pinball.close();

    const clasico = await page("/juego_salto");
    await clasico.evaluate(() => mostrarAnuncioArcade());
    await clasico.locator("#anuncio-clasico .perfil-promo").waitFor({ state: "visible" });
    await clasico.locator("#anuncio-clasico button").click();
    assert.equal(await clasico.locator("#anuncio-clasico").count(), 0);
    await clasico.close();

    assert.deepEqual(errors, []);
    console.log("Promos finales y cinco reanimaciones: PC/móvil OK");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
