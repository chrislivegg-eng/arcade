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
  try {
    for (const movil of [false, true]) {
      const ctx = await browser.newContext({
        viewport: movil
          ? { width: 390, height: 844 }
          : { width: 1280, height: 1000 },
        isMobile: movil,
        hasTouch: movil,
      });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept());
      await p.route("https://fonts.**", (r) => r.abort());
      await p.goto(base + "/uno");
      await p.locator("#nombre").fill("ChrisQA");
      await p.locator("#btn-crear").click();
      await p.getByRole("button", { name: /Agregar bot/ }).waitFor();
      const codigo = await p.locator("#codigo-sala").textContent(),
        pid = await p.evaluate(() => Fiesta.pid),
        otro = "amigo-" + codigo;
      const api = async (accion, datos = {}, jugador = pid) =>
        (
          await ctx.request.post(base + "/api/fiesta/accion", {
            data: { codigo, pid: jugador, accion, ...datos },
          })
        ).json();
      const vista = async (jugador = pid) =>
        (
          await ctx.request.get(
            base + "/api/fiesta/estado/" + codigo + "?pid=" + jugador,
          )
        ).json();
      await ctx.request.post(base + "/api/fiesta/unirse", {
        data: { juego: "uno", codigo, pid: otro, nombre: "LunaQA" },
      });
      let e;
      for (let i = 0; i < 35; i++) {
        await api("lobby");
        await api("iniciar");
        e = await vista();
        if (e.mano.some((c) => c.c === "negro")) break;
      }
      assert.ok(e.mano.some((c) => c.c === "negro"));
      if (e.turno !== pid) {
        await api("robar", {}, otro);
        let o = await vista(otro);
        if (o.turno === otro && o.robo != null) await api("pasar", {}, otro);
      }
      await p.evaluate(() => Fiesta.refrescar());
      await p.waitForFunction(
        () =>
          Fiesta.estado?.turno === Fiesta.pid &&
          Fiesta.estado?.fase === "jugando",
      );
      assert.equal(await p.evaluate(() => UNOMesa3D.lista), true);
      const wild = await p.evaluate(() =>
        Fiesta.estado.mano.find((c) => c.c === "negro"),
      );
      await p.locator(`.mano [data-carta="${wild.id}"]`).click();
      await p.getByRole("dialog").waitFor();
      await p.getByRole("button", { name: "Elegir azul", exact: true }).click();
      await p.waitForFunction(
        (id) => Fiesta.estado?.ultima_jugada?.id === id,
        wild.id,
      );
      assert.equal(await p.evaluate(() => Fiesta.estado.color), "azul");
      assert.equal(await p.locator(".uno-selector").count(), 0);
      assert.ok(
        await p.evaluate(() => UNOMesa3D.renderer.info.render.calls > 0),
      );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      if (process.env.CAPTURAS_UNO)
        await p.screenshot({
          path: process.env.CAPTURAS_UNO + (movil ? "-movil.png" : "-pc.png"),
          fullPage: true,
        });
      // Solo el dueño recibe su mano; la mesa usa exclusivamente los contadores rivales.
      e = await vista();
      assert.equal("manos" in e, false);
      assert.equal("manos_finales" in e, false);
      while (e.turno !== pid) {
        await api("robar", {}, otro);
        let o = await vista(otro);
        if (o.turno === otro && o.robo != null) await api("pasar", {}, otro);
        e = await vista();
      }
      await p.evaluate(() => Fiesta.refrescar());
      await p.waitForFunction(
        () => Fiesta.estado.turno === Fiesta.pid && Fiesta.estado.robo == null,
      );
      const n = await p.evaluate(() => Fiesta.estado.mano.length);
      await p.locator("#uno-robar").click();
      await p.waitForFunction((n) => Fiesta.estado.mano.length === n + 1, n);
      if (
        await p.evaluate(
          () =>
            Fiesta.estado.turno === Fiesta.pid && Fiesta.estado.robo != null,
        )
      )
        await p.getByRole("button", { name: /Pasar/ }).click();
      // Juega una ronda real con dos participantes, sin alterar el estado del servidor.
      for (let i = 0; i < 600; i++) {
        e = await vista();
        if (e.fase === "resultado") break;
        const actual = e.turno,
          v = await vista(actual);
        if (v.mano.length === 2) await api("uno", {}, actual);
        const opciones = v.mano.filter((c) => v.jugables?.includes(c.id));
        if (opciones.length) {
          const c = opciones.sort(
            (a, b) =>
              (({ "+4": 5, "+2": 4, salta: 3, reversa: 3 })[b.v] || 1) -
              ({ "+4": 5, "+2": 4, salta: 3, reversa: 3 }[a.v] || 1),
          )[0];
          await api("jugar", { id: c.id, color: "azul" }, actual);
        } else if (v.robo != null) await api("pasar", {}, actual);
        else await api("robar", {}, actual);
      }
      assert.equal(e.fase, "resultado");
      await p.evaluate(() => Fiesta.refrescar());
      await p.getByRole("button", { name: /Otra ronda/ }).waitFor();
      assert.ok(
        await p.evaluate(() => UNOMesa3D.renderer.info.memory.textures < 90),
      );
      const ronda = e.ronda;
      await p.getByRole("button", { name: /Otra ronda/ }).click();
      await p.waitForFunction(
        (r) => Fiesta.estado.ronda > r && Fiesta.estado.fase === "jugando",
        ronda,
      );
      await p.locator("#btn-salir").click();
      assert.equal(await p.locator(".uno-escena").isVisible(), false);
      assert.equal(await p.evaluate(() => UNOMesa3D.animaciones), 0);
      await ctx.close();
      console.log(
        "PASS UNO 3D",
        movil ? "móvil" : "PC",
        "comodín, robo, ronda online completa, revancha y cancelación",
      );
    }
    {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("https://fonts.**", (r) => r.abort());
      await p.goto(base + "/uno");
      await p.locator("#nombre").fill("MesaCompleta");
      await p.locator("#btn-crear").click();
      await p.getByRole("button", { name: /Agregar bot/ }).waitFor();
      for (let i = 0; i < 9; i++)
        await p.evaluate(() => Fiesta.accion("agregar_bot"));
      await p.waitForFunction(() => Fiesta.estado.jugadores.length === 10);
      await p.getByRole("button", { name: /Repartir cartas/ }).click();
      await p.waitForFunction(() => Fiesta.estado?.cuentas?.length === 10);
      assert.equal(await p.locator(".rivales .rival").count(), 10);
      assert.ok(
        await p.evaluate(() => UNOMesa3D.renderer.info.memory.textures < 90),
      );
      await ctx.close();
      console.log("PASS UNO 3D: mesa de diez jugadores");
    }
    // La falta de WebGL conserva los controles y la mesa clásica.
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, ...a) {
        return /webgl/i.test(t) ? null : get.call(this, t, ...a);
      };
    });
    await p.goto(base + "/uno");
    await p.locator("#nombre").fill("SinGPU");
    await p.locator("#btn-crear").click();
    await p.getByRole("button", { name: /Agregar bot/ }).click();
    await p.getByRole("button", { name: /Repartir cartas/ }).click();
    await p.waitForFunction(() => Fiesta.estado?.fase === "jugando");
    assert.equal(await p.evaluate(() => UNOMesa3D.lista), false);
    assert.equal(await p.locator(".centro-mesa").isVisible(), true);
    assert.equal(await p.locator(".mano .carta").count(), 7);
    await ctx.close();
    assert.deepEqual(errors, []);
    console.log("PASS UNO sin WebGL: mesa clásica disponible");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
