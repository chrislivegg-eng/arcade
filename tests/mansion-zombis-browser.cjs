const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5055";
(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  fs.mkdirSync("../../outputs", { recursive: true });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
        isMobile: mobile,
        hasTouch: mobile,
      });
      const p = await context.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base + "/juego/mansion");
      await p.locator("#nombre").fill("MansionQA");
      await p.locator("#empezar").click();
      await p.waitForFunction(() => Mansion.estado.context);
      await p.waitForTimeout(300);
      await p.screenshot({
        path: `../../outputs/mansion-${mobile ? "movil" : "pc"}.png`,
      });
      // Real input moves the camera; pause freezes simulation time and movement.
      const before = await p.evaluate(() => Mansion.estado.z);
      if (!mobile) {
        await p.keyboard.down("KeyW");
        await p.waitForTimeout(600);
        await p.keyboard.up("KeyW");
      } else {
        const r = await p.locator("#joystick").boundingBox();
        await p.mouse.move(r.x + 50, r.y + 50);
        await p.mouse.down();
        await p.mouse.move(r.x + 50, r.y + 15);
        await p.waitForTimeout(600);
        await p.mouse.up();
      }
      assert((await p.evaluate(() => Mansion.estado.z)) < before - 0.2);
      await p.locator("#pausar").click();
      const t = await p.evaluate(() => Mansion.estado.elapsed);
      await p.waitForTimeout(250);
      assert.equal(await p.evaluate(() => Mansion.estado.elapsed), t);
      await p.locator("#reanudar").click();
      assert(
        await p.evaluate(
          () => Mansion.bloqueado(-6, 5) && !Mansion.bloqueado(-6, -2),
        ),
      );
      assert(
        await p.evaluate(() => {
          Mansion.estado.ghostX = -13;
          Mansion.estado.ghostZ = -5.8;
          return Mansion.ruta([13.8, -6]).length > 1;
        }),
      );
      // Check a real hiding interaction and recovery.
      await p.evaluate(() =>
        Object.assign(Mansion.estado, { x: -3.4, z: 5, grace: 999 }),
      );
      await p.waitForFunction(() =>
        document.querySelector("#objeto").textContent.includes("Armario"),
      );
      await p.locator("#interactuar").click();
      assert(await p.evaluate(() => Mansion.estado.hidden));
      await p.locator("#interactuar").click();
      assert(!(await p.evaluate(() => Mansion.estado.hidden)));
      // Move to reachable approaches to exercise each pickup and the actual completion handler.
      for (const [x, z] of [
        [-10.4, -2.7],
        [11.5, -5.2],
        [-2.5, -16.1],
      ]) {
        await p.evaluate(
          ({ x, z }) => Object.assign(Mansion.estado, { x, z, grace: 999 }),
          { x, z },
        );
        await p.waitForFunction(() =>
          document.querySelector("#objeto").textContent.includes("Llave"),
        );
        await p.locator("#interactuar").click();
      }
      assert.equal(await p.evaluate(() => Mansion.estado.found), 3);
      await p.evaluate(() => Object.assign(Mansion.estado, { x: 0, z: 12.1 }));
      await p.waitForFunction(() =>
        document.querySelector("#objeto").textContent.includes("principal"),
      );
      await p.locator("#interactuar").click();
      await p.locator("#final").waitFor({ state: "visible" });
      await p.waitForFunction(
        () =>
          !document
            .querySelector("#guardado")
            .textContent.includes("Guardando"),
      );
      assert(
        (await p.locator("#titulo-final").textContent()).includes("amanecer"),
      );
      await p.goto(base + "/juego/zombis");
      await p.locator("#nombre").fill("ZombieQA");
      await p.locator('[data-modo="solo"]').click();
      await p.locator("#armeria-z").waitFor({ state: "visible" });
      await p.waitForFunction(() => catalogo?.arma);
      let waveRequests = 0;
      await p.route('**/api/zombis/oleada', async route => {
        if (++waveRequests === 1) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Conexión de prueba interrumpida'})});
        return route.continue();
      });
      await p.locator("#continuar-z").click();
      await p.waitForFunction(() => document.querySelector('#mensaje-z').textContent.includes('interrumpida'));
      assert.equal(await p.evaluate(() => J.oleada), 0);
      await p.locator("#continuar-z").click();
      await p.waitForFunction(() => J.oleada === 1 && !J.pausado);
      let rewardRequests = 0;
      await p.route('**/api/zombis/baja', async route => {
        if (++rewardRequests === 1) { await route.fetch(); return route.abort('connectionreset'); }
        return route.continue();
      });
      // Spawn an issued enemy near the player, then use pointer aiming/raycast rather than calling matar.
      await p.evaluate(() => {
        const e = J.porSalir.shift();
        const z = crearZombi(e.tipo, e.id);
        z.x = 0;
        z.z = -8;
        J.siguienteSalida = J.reloj + 999999;
      });
      await p.waitForTimeout(150);
      for (let i = 0; i < 3; i++) {
        const point = await p.evaluate(() => {
          const z = zombis.find((z) => !z.muerto);
          return z
            ? M.aPantalla(z.g.localToWorld(new THREE.Vector3(0, 1.15, 0)))
            : null;
        });
        if (point) await p.mouse.click(point.x, point.y);
        await p.waitForTimeout(380);
      }
      await p.waitForFunction(
        () => J.muertos === 1 && J.pendientes.length === 0,
      );
      // First reward reached the server but its response was lost. Retry must not double-pay.
      assert(rewardRequests >= 2);
      assert.equal(await p.evaluate(async () => (await (await fetch('/api/perfil?pid='+Perfil.pid)).json()).stats.zombis), 1);
      const count = await p.evaluate(() => J.balas);
      await p.locator("#recarga-z").click();
      await p.waitForTimeout(200);
      await p.locator("#pausa-z").click();
      await p.waitForTimeout(1600);
      assert.equal(await p.evaluate(() => J.balas), count);
      await p.locator("#continuar-z").click();
      await p.waitForFunction(() => !J.recargando);
      assert.equal(await p.evaluate(() => J.balas), 8);
      // Finish remaining issued enemies, verify wave transition and a persistent purchase.
      await p.evaluate(() => {
        for (const e of J.porSalir.splice(0)) {
          const z = crearZombi(e.tipo, e.id);
          z.z = -12;
          z.x = 0;
        }
        for (const z of zombis.filter((z) => !z.muerto)) matar(z, false);
      });
      await p.waitForFunction(
        () => J.pendientes.length === 0 && J.muertos === 7,
      );
      await p.locator("#armeria-z").waitFor({ state: "visible" });
      await p.waitForFunction(() => catalogo.monedas >= 71);
      await p.locator("#mejoras-z button").filter({ hasText: "Daño" }).click();
      await p.waitForFunction(() => catalogo.niveles.danio === 1);
      await p.locator("#continuar-z").click();
      await p.waitForFunction(() => J.oleada === 2 && !J.pausado);
      await p.evaluate(() => {
        for (const e of J.porSalir.splice(0, 3)) {
          const z = crearZombi(e.tipo, e.id);
          z.z = -9 - Math.random() * 4;
          z.x = (Math.random() - 0.5) * 3;
        }
        J.siguienteSalida = J.reloj + 999999;
      });
      await p.waitForTimeout(200);
      await p.screenshot({
        path: `../../outputs/zombis-${mobile ? "movil" : "pc"}.png`,
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await p.reload();
      await p.locator('[data-modo="solo"]').click();
      await p.waitForFunction(() => catalogo?.niveles.danio === 1);
      await context.close();
      console.log(
        `${mobile ? "Mobile" : "Desktop"}: escape, hiding, collision, pause, aimed kill, rewards, purchases and reload OK`,
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
