const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5055";
(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  async function apuntar(p, pos, hacia, tipo) {
    await p.evaluate(
      ({ pos, hacia }) => {
        const s = Templo.estado;
        s.pos = pos;
        const dx = hacia[0] - pos[0],
          dz = hacia[2] - pos[1];
        s.yaw = Math.atan2(-dx, -dz);
        s.pitch = Math.atan2(hacia[1] - 1.68, Math.hypot(dx, dz));
      },
      { pos, hacia },
    );
    await p.waitForFunction((tipo) => Templo.objetivo?.tipo === tipo, tipo);
    await p.locator("#interactuar").click();
  }
  try {
    for (const movil of [false, true]) {
      const ctx = await browser.newContext({
        viewport: movil
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
        isMobile: movil,
        hasTouch: movil,
      });
      const p = await ctx.newPage();
      let finales = 0;
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("request", (r) => {
        if (r.url().endsWith("/api/perfil/evento")) {
          try {
            if (r.postDataJSON().juego === "templo") finales++;
          } catch {}
        }
      });
      p.on("response", (r) => {
        if (r.status() === 404 && !r.url().endsWith("favicon.ico"))
          errors.push("404 " + r.url());
      });
      await p.goto(base + "/juego/templo");
      await p.locator("#cargando").waitFor({ state: "hidden" });
      await p.locator("#nombre").fill("ExploradorQA");
      await p.locator("#empezar").click();
      await p.waitForFunction(() => Templo.activa);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.equal(await p.evaluate(() => Templo.puedeCaminar(0, -25)), false);
      assert.equal(
        await p.evaluate(() => Templo.puedeCaminar(-19.9, -5)),
        false,
      );
      assert.equal(await p.evaluate(() => Templo.puedeCaminar(-5.9, 1)), false);
      if (!movil) {
        const z = await p.evaluate(() => Templo.estado.pos[1]);
        await p.keyboard.down("w");
        await p.waitForTimeout(650);
        await p.keyboard.up("w");
        assert.ok(await p.evaluate((z) => Templo.estado.pos[1] < z - 0.5, z));
      } else {
        const z = await p.evaluate(() => Templo.estado.pos[1]);
        const r = await p.locator("#joystick").boundingBox();
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: r.x + r.width / 2, y: r.y + 8, id: 1 }],
        });
        await p.waitForFunction((z) => Templo.estado.pos[1] < z - 0.6, z);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        assert.ok(await p.evaluate((z) => Templo.estado.pos[1] < z - 0.5, z));
      }
      // La abertura de la cámara se puede atravesar con los controles normales.
      await p.evaluate(() => {
        Templo.estado.pos = [-6.8, -4.7];
        Templo.estado.yaw = Math.PI / 2;
      });
      await p.keyboard.down("w");
      await p.waitForFunction(() => Templo.estado.pos[0] < -8.7);
      await p.keyboard.up("w");
      assert.ok(await p.evaluate(() => Templo.estado.pos[0] < -8.7));
      await apuntar(p, [-14, -7.8], [-14, 2.1, -9.36], "nota-sol");
      await p.locator(".cerrar").click();
      assert.ok(await p.evaluate(() => Templo.estado.notas.includes("sol")));
      await apuntar(p, [-14, -3.9], [-14, 1.38, -6.3], "sol");
      await p.getByRole("button", { name: "Girar disco 1" }).click();
      await p.getByRole("button", { name: "Girar disco 3" }).click();
      await p.getByRole("button", { name: "Girar disco 3" }).click();
      assert.equal(await p.evaluate(() => Templo.estado.sellos[0]), true);
      await p.locator(".cerrar").click();
      await p.evaluate(() => Templo.guardar());
      await p.reload();
      await p.locator("#continuar").waitFor({ state: "visible" });
      await p.locator("#continuar").click();
      await p.waitForFunction(() => Templo.activa);
      assert.equal(await p.evaluate(() => Templo.estado.sellos[0]), true);
      await apuntar(p, [14, -11.9], [14, 1.38, -14.3], "luna");
      await p.getByRole("button", { name: "Tocar Sol", exact: true }).click();
      assert.deepEqual(await p.evaluate(() => Templo.estado.luna), []);
      for (const n of ["Luna", "Sol", "Estrella", "Luna"])
        await p
          .getByRole("button", { name: "Tocar " + n, exact: true })
          .click();
      assert.equal(await p.evaluate(() => Templo.estado.sellos[1]), true);
      await p.locator(".cerrar").click();
      await apuntar(p, [0, -14.3], [0, 1.38, -16.7], "agua");
      await p.getByRole("button", { name: "Mover compuerta 1" }).click();
      await p.getByRole("button", { name: "Mover compuerta 2" }).click();
      await p.locator(".cerrar").click();
      assert.deepEqual(await p.evaluate(() => Templo.estado.sellos), [
        true,
        true,
        true,
      ]);
      assert.equal(await p.evaluate(() => Templo.puedeCaminar(0, -25)), true);
      await p.locator("#pausar").click();
      const t = await p.evaluate(() => Templo.estado.segundos);
      await p.waitForTimeout(300);
      assert.equal(await p.evaluate(() => Templo.estado.segundos), t);
      await p.locator("#calidad-pausa select").selectOption("ahorro");
      assert.equal(
        await p.evaluate(() => Templo.mundo.renderer.shadowMap.enabled),
        false,
      );
      await p.locator("#reanudar").click();
      await apuntar(p, [0, -26.5], [0, 1.38, -28.9], "corazon");
      await p.locator("#final").waitFor({ state: "visible" });
      await p.waitForFunction(
        () =>
          !document
            .getElementById("guardado-final")
            .textContent.includes("Guardando"),
      );
      assert.equal(finales, 1);
      assert.equal(await p.evaluate(() => Templo.estado.terminada), true);
      const perfil = await p.evaluate(() =>
        fetch("/api/perfil?pid=" + Perfil.pid).then((r) => r.json()),
      );
      assert.ok(perfil.logros.templo);
      assert.equal(perfil.stats.partidas, 1);
      await p.locator("#otra").click();
      await p.waitForFunction(() => Templo.activa);
      assert.deepEqual(await p.evaluate(() => Templo.estado.sellos), [
        false,
        false,
        false,
      ]);
      await ctx.close();
      console.log(
        "PASS Umbra:",
        movil ? "móvil" : "PC",
        "controles, colisiones, tres acertijos, diario, guardado, pausa, final y premio único",
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
