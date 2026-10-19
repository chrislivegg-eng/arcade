const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const games = [
  "basquet",
  "boliche",
  "beer_pong",
  "mini_golf",
  "air_hockey",
  "billar",
  "ping_pong",
  "penales",
  "cruza_calle",
  "stack",
  "karts",
  "zombis",
  "corredor",
  "ladrillos",
  "box",
  "arco",
  "voleibol",
  "hockey",
  "conecta3d",
  "curling",
  "pesca",
  "paracaidas",
  "nieve",
  "asteroides",
  "surf",
  "drift",
  "espadas",
];
(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  const errors = [];
  try {
    const dir = process.env.CAPTURAS_3D;
    if (dir) fs.mkdirSync(dir, { recursive: true });
    for (const mobile of [false, true])
      for (const game of (process.env.JUEGOS_3D ? process.env.JUEGOS_3D.split(",") : games)) {
        const ctx = await browser.newContext({
          viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1280, height: 800 },
          isMobile: mobile,
          hasTouch: mobile,
        });
        const p = await ctx.newPage();
        p.on("pageerror", (e) => errors.push(game + ": " + e.message));
        p.on("console", (m) => {
          if (m.type() === "error" && /shader|webgl|THREE/i.test(m.text()))
            errors.push(game + ": " + m.text());
        });
        await p.route("https://fonts.**", (r) => r.abort());
        await p.goto("http://127.0.0.1:5055/juego/" + game);
        const s = p.locator("[data-calidad-3d]");
        await s.waitFor();
        await s.selectOption("ahorro");
        assert.equal(
          await p.evaluate(() => M.renderer.shadowMap.enabled),
          false,
          game,
        );
        await s.selectOption("alta");
        assert.equal(await p.evaluate(() => M.renderer.getPixelRatio()), 1);
        await s.selectOption("auto");
        const mode = p
          .locator("#menu [data-modo]:not([data-modo=online])")
          .first();
        await mode.click();
        await p.waitForTimeout(450);
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          game,
        );
        const info = await p.evaluate(() => ({
          calls: M.renderer.info.render.calls,
          triangles: M.renderer.info.render.triangles,
          textures: M.renderer.info.memory.textures,
          bg: M.escena.background.isTexture,
        }));
        assert.ok(info.calls > 0, game);
        assert.ok(game === "stack" || info.bg, game);
        assert.ok(info.textures < 90, game + " texturas sin límite");
        if (
          dir &&
          [
            "drift",
            "hockey",
            "surf",
            "espadas",
            "pesca",
            "asteroides",
          ].includes(game)
        )
          await p.screenshot({
            path: path.join(dir, game + (mobile ? "-movil" : "-pc") + ".png"),
          });
        await ctx.close();
        console.log(
          "PASS",
          game,
          mobile ? "móvil" : "PC",
          JSON.stringify(info),
        );
      }
    const p = await browser.newPage();
    p.on("pageerror", (e) => errors.push("naval: " + e.message));
    await p.goto("http://127.0.0.1:5055/juego_naval");
    await p.waitForTimeout(600);
    assert.equal(await p.locator("#oceano").count(), 1);
    await p.close();
    assert.deepEqual(errors, []);
    console.log("PASS: 28 juegos 3D, calidad, render y texturas en PC/móvil.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
