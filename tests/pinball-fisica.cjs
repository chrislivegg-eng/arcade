const assert = require("node:assert/strict");
const F = require("../static/js/pinball-fisica.js");
{
  const m = new F.Mesa();
  for (let i = 0; i < 180 * 120 && m.fase !== "final"; i++) {
    if (m.fase === "lista") {
      m.carga = 1;
      m.lanzar();
    }
    m.avanzar(1 / 120);
  }
  assert.equal(m.fase, "final", "resting flippers must leave a real drain gap");
  console.log("PASS una partida sin tocar las palancas pierde sus tres bolas");
}
function avanzar(m, s, input = {}, fps = 60) {
  for (let i = 0; i < Math.round(s * fps); i++) m.avanzar(1 / fps, input);
}
{
  const m = new F.Mesa();
  avanzar(m, 1.2, { cargar: true });
  assert.equal(m.carga, 1);
  m.lanzar();
  let entro = false;
  for (let i = 0; i < 600; i++) {
    m.avanzar(1 / 120);
    if (!m.bola.carril) entro = true;
    assert.ok(Number.isFinite(m.bola.x + m.bola.y));
  }
  assert.ok(entro, "full launch must reach playfield");
  console.log("PASS lanzamiento y entrada real a la mesa");
}
{
  const m = new F.Mesa();
  m.lanzar();
  avanzar(m, 3);
  assert.equal(m.fase, "lista");
  assert.equal(m.bolaNumero, 1);
  assert.equal(m.puntos, 0);
  console.log("PASS carga corta vuelve al lanzador sin perder bola");
}
for (const right of [false, true]) {
  const m = new F.Mesa();
  m.fase = "jugando";
  m.bola = {
    x: right ? 325 : 215,
    y: 790,
    vx: 0,
    vy: 300,
    r: 9,
    carril: false,
  };
  avanzar(m, 0.1, right ? { der: true } : { izq: true }, 240);
  assert.ok(m.bola.vy < -100, "rising flipper must propel ball upwards");
  console.log("PASS impulso físico palanca", right ? "derecha" : "izquierda");
}
{
  const m = new F.Mesa();
  m.fase = "jugando";
  for (const c of F.lanes) {
    m.bola = { x: c.x, y: c.y, vx: 0, vy: 100, carril: false };
    m.paso(F.STEP, {});
  }
  assert.equal(m.multiplicador, 2);
  for (const c of F.targets) {
    m.bola = { x: c.x - 17, y: c.y, vx: 350, vy: 0, carril: false };
    m.paso(F.STEP, {});
  }
  assert.ok(m.puntos >= 6000);
  assert.ok(m.objetivos.every((x) => !x));
  console.log("PASS pasillos, multiplicador y jackpot");
}
{
  const ev = [];
  const m = new F.Mesa((t, d) => ev.push([t, d]));
  for (let n = 1; n <= 3; n++) {
    m.fase = "jugando";
    m.tiempo += 10;
    m.bola = { x: 270, y: 930, vx: 0, vy: 50, carril: false };
    m.bonus = 100;
    m.paso(F.STEP, {});
    assert.equal(m.bolaNumero, Math.min(n + 1, 3));
  }
  assert.equal(m.fase, "final");
  assert.equal(m.puntos, 300);
  avanzar(m, 3);
  assert.equal(ev.filter((e) => e[0] === "final").length, 1);
  console.log("PASS tres bolas y fin único con bonus");
}
{
  const m = new F.Mesa();
  m.fase = "jugando";
  m.bola = { x: 270, y: 930, vx: 0, vy: 100, carril: false };
  m.paso(F.STEP, {});
  assert.equal(m.bolaNumero, 1);
  assert.ok(m.salvada);
  m.bola = { x: 270, y: 930, vx: 0, vy: 100, carril: false };
  m.paso(F.STEP, {});
  assert.equal(m.bolaNumero, 2);
  console.log("PASS una sola salvada por bola");
}
{
  const a = new F.Mesa(),
    b = new F.Mesa();
  for (const m of [a, b]) {
    m.carga = 1;
    m.lanzar();
  }
  avanzar(a, 2, {}, 30);
  avanzar(b, 2, {}, 120);
  assert.ok(
    Math.abs(a.bola.x - b.bola.x) < 8 && Math.abs(a.bola.y - b.bola.y) < 8,
  );
  console.log("PASS física estable a distintas tasas de fotogramas");
}
