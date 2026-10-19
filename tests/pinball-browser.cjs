const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const base = process.env.ARCADE_URL || "http://127.0.0.1:5055";
(async () => {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  try {
    for (const mobile of [false, true]) {
      const c = await b.newContext({
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1440, height: 1000 },
          isMobile: mobile,
          hasTouch: mobile,
        }),
        p = await c.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      let saves = 0;
      p.on("request", (r) => {
        if (r.method() === "POST" && r.url().endsWith("/api/records/pinball"))
          saves++;
      });
      await p.goto(base + "/juego/pinball");
      await p.locator("#nombre").fill("PinballQA");
      await p.locator("#empezar").click();
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      const rect = await p.locator("#pinball").boundingBox();
      assert.ok(rect.height > 400);
      assert.ok(rect.x >= 0 && rect.y + rect.height <= (mobile ? 844 : 1000));
      if (mobile) {
        const launch = await p.locator("#lanzar").boundingBox();
        await p.mouse.move(launch.x + launch.width / 2, launch.y + 20);
        await p.mouse.down();
        await p.waitForTimeout(1250);
        await p.mouse.up();
      } else {
        await p.keyboard.down("ArrowDown");
        await p.waitForTimeout(1250);
        await p.keyboard.up("ArrowDown");
      }
      await p.waitForFunction(
        () => !Pinball.mesa.bola.carril,
        {},
        { timeout: 8000 },
      );
      if (mobile) {
        const client = await c.newCDPSession(p),
          l = await p.locator("#izquierda").boundingBox(),
          r = await p.locator("#derecha").boundingBox();
        const left = { x: l.x + l.width / 2, y: l.y + l.height / 2, id: 1 },
          right = { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 2 };
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [left, right],
        });
        await p.waitForTimeout(150);
        assert.ok(
          await p.evaluate(
            () =>
              Pinball.mesa.flippers[0].a < 0 &&
              Pinball.mesa.flippers[1].a > Math.PI,
          ),
        );
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [left],
        });
        await p.waitForTimeout(150);
        assert.ok(
          await p.evaluate(
            () =>
              Pinball.mesa.flippers[0].a > 0 &&
              Pinball.mesa.flippers[1].a > Math.PI,
          ),
        );
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await p.keyboard.down("ArrowLeft");
        await p.keyboard.down("ArrowRight");
        await p.waitForTimeout(150);
        assert.ok(
          await p.evaluate(
            () =>
              Pinball.mesa.flippers[0].a < 0 &&
              Pinball.mesa.flippers[1].a > Math.PI,
          ),
        );
        await p.keyboard.up("ArrowLeft");
        await p.keyboard.up("ArrowRight");
      }
      await p.waitForTimeout(1500);
      if (process.env.CAPTURAS_PINBALL) {
        fs.mkdirSync(process.env.CAPTURAS_PINBALL, { recursive: true });
        await p.screenshot({
          path:
            process.env.CAPTURAS_PINBALL +
            (mobile ? "/pinball-movil.png" : "/pinball-pc.png"),
        });
      }
      await p.locator("#pausa").click();
      const snap = await p.evaluate(() => JSON.stringify(Pinball.mesa.bola));
      await p.waitForTimeout(300);
      assert.equal(
        await p.evaluate(() => JSON.stringify(Pinball.mesa.bola)),
        snap,
      );
      await p.locator("#continuar").click();
      // Force drains only to verify end-of-game persistence after real input play.
      for (let n = 1; n <= 3; n++) {
        await p.evaluate(() => {
          const m = Pinball.mesa;
          m.fase = "jugando";
          m.tiempo += 10;
          m.bola = { x: 270, y: 935, vx: 0, vy: 10, carril: false };
        });
        await p.waitForTimeout(100);
      }
      await p.locator("#final").waitFor({ state: "visible" });
      await p.waitForFunction(() =>
        document.querySelector("#guardado").textContent.includes("guardada"),
      );
      assert.equal(saves, 1);
      await p.locator("#otra").click();
      assert.equal(await p.evaluate(() => Pinball.mesa.bolaNumero), 1);
      assert.equal(await p.evaluate(() => Pinball.mesa.puntos), 0);
      await p.locator("#pausa").click();
      await p.locator("#abandonar").click();
      await p.waitForTimeout(150);
      assert.equal(saves, 1);
      await c.close();
      console.log(
        "PASS",
        mobile ? "móvil" : "PC",
        "lanzamiento, palancas simultáneas, pausa, ciclo de bolas, récord único, revancha y abandono",
      );
    }
    assert.deepEqual(errors, []);
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
