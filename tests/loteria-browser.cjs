const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5055";
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  try {
    for (const movil of [false, true]) {
      const ctx = await browser.newContext({
        viewport: movil
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
        isMobile: movil,
        hasTouch: movil,
      });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept());
      await p.addInitScript(() => {
        window.__cantadas = [];
        window.__plays = [];
        window.__pauses = 0;
        Object.defineProperty(window, "speechSynthesis", {
          value: {
            cancel() {},
            speak(u) {
              __cantadas.push(u.text);
            },
          },
        });
        window.Audio = class {
          constructor() {
            this.src = "";
            window.__audio = this;
          }
          play() {
            __plays.push(this.src);
            return Promise.resolve();
          }
          pause() {
            __pauses++;
          }
        };
      });
      let llamada = 44;
      await p.route("**/api/fiesta/estado/*", async (route) => {
        const r = await route.fetch();
        const e = await r.json();
        if (e.fase === "jugando") {
          // Una cantada controlada hace reproducibles el brillo y el audio.
          e.actual = llamada;
          e.cantadas = [llamada];
          e.verso = e.versos[llamada];
          e.audios = llamada === 44 ? { 44: "/__test-venado.mp3" } : {};
          e.mis_tablas.slice(0, 2).forEach((t) => {
            if (!t.includes(44)) t[0] = 44;
          });
        }
        await route.fulfill({ response: r, json: e });
      });
      await p.goto(base + "/loteria");
      await p.locator("#nombre").fill("LoteriaQA");
      await p.locator("#btn-crear").click();
      await p.locator('[data-cantidad="3"]').waitFor();
      const codigo = await p.locator("#codigo-sala").textContent();
      await ctx.request.post(base + "/api/fiesta/unirse", {
        data: {
          juego: "loteria",
          codigo,
          pid: "amigo-" + codigo,
          nombre: "Amigo",
        },
      });
      await p.locator('[data-cantidad="3"]').click();
      await p.getByLabel("Color de mi tabla 3").waitFor();
      await p.getByLabel("Color de mi tabla 1").selectOption("morado");
      await p.getByLabel("Color de mi tabla 2").selectOption("verde");
      await p.getByLabel("Color de mi tabla 3").selectOption("azul");
      await p.getByRole("button", { name: "¡Empezar a cantar!" }).click();
      await p.waitForFunction(() => Fiesta.estado?.mis_tablas?.length === 3);
      assert.deepEqual(await p.evaluate(() => Fiesta.estado.mis_colores), [
        "morado",
        "verde",
        "azul",
      ]);
      assert.equal(await p.locator(".lot-tablas .lot-celda").count(), 48);
      const c0 = p.locator('.lot-celda[data-tabla="0"][data-carta="44"]');
      const c1 = p.locator('.lot-celda[data-tabla="1"][data-carta="44"]');
      assert.ok((await c0.getAttribute("class")).includes("actual"));
      assert.equal(await c0.getAttribute("aria-pressed"), "false");
      await c0.click();
      assert.equal(await c0.getAttribute("aria-pressed"), "true");
      assert.equal(await c1.getAttribute("aria-pressed"), "false");
      const veces = await p.evaluate(
        () => __plays.filter((s) => s.endsWith("/__test-venado.mp3")).length,
      );
      await p.locator(".lot-pestanas button").nth(1).click();
      await c1.click();
      assert.equal(await c1.getAttribute("aria-pressed"), "true");
      assert.equal(
        await p.evaluate(
          () => __plays.filter((s) => s.endsWith("/__test-venado.mp3")).length,
        ),
        veces,
      );
      assert.equal(
        await p.locator(".lot-tablas .lot-tablero:visible").count(),
        movil ? 1 : 3,
      );
      await p.reload();
      await p.waitForFunction(() => Fiesta.estado?.mis_tablas?.length === 3);
      assert.equal(await c0.getAttribute("aria-pressed"), "true");
      assert.equal(await c1.getAttribute("aria-pressed"), "true");
      await p.evaluate(() => (window.__viejoFin = __audio.onended));
      llamada = 15;
      await p.evaluate(() => Fiesta.refrescar());
      await p.waitForFunction(() => Fiesta.estado.actual === 15);
      const img = p.locator(".lot-cantada img");
      await img.waitFor();
      await img.evaluate((i) => i.decode());
      assert.ok(await img.evaluate((i) => i.naturalWidth > 0));
      const frases = await p.evaluate(() => __cantadas.length);
      await p.evaluate(() => __viejoFin?.());
      assert.equal(await p.evaluate(() => __cantadas.length), frases);
      assert.ok(
        await p.evaluate(() =>
          __cantadas.some((f) => f.includes("viva México")),
        ),
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (process.env.CAPTURAS_LOTERIA)
        await p.screenshot({
          path:
            process.env.CAPTURAS_LOTERIA + (movil ? "-movil.png" : "-pc.png"),
          fullPage: true,
        });
      const pausas = await p.evaluate(() => __pauses);
      await p.locator("#btn-salir").click();
      assert.ok(await p.evaluate((n) => __pauses > n, pausas));
      await ctx.close();
      console.log(
        "PASS lotería:",
        movil ? "móvil" : "PC",
        "3 tablas, colores, marcas independientes, brillo, bandera, voz y cancelación de música",
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
