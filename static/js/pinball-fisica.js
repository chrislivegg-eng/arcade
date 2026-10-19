(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PinballFisica = api;
})(typeof window === "object" ? window : globalThis, function () {
  "use strict";
  const W = 540,
    H = 900,
    R = 9,
    STEP = 1 / 240;
  const walls = [
    [30, 650, 30, 140],
    [30, 140, 55, 70],
    [55, 70, 140, 32],
    [140, 32, 410, 32],
    [410, 32, 490, 58],
    [490, 58, 520, 120],
    [520, 120, 520, 880],
    [480, 160, 480, 875],
    [30, 650, 65, 730],
    [65, 730, 160, 790],
    [465, 650, 445, 730],
    [445, 730, 380, 790],
    [465, 185, 465, 650],
    [75, 190, 75, 520],
    [75, 190, 100, 160],
    [105, 630, 178, 718],
    [178, 718, 105, 700],
    [105, 700, 105, 630],
    [430, 630, 357, 718],
    [357, 718, 430, 700],
    [430, 700, 430, 630],
  ];
  const bumpers = [
    { x: 195, y: 265, r: 32 },
    { x: 335, y: 265, r: 32 },
    { x: 265, y: 365, r: 36 },
  ];
  const targets = [230, 320, 410, 500].map((y) => ({ x: 447, y, r: 12 }));
  const lanes = [150, 265, 380].map((x) => ({ x, y: 140, r: 22 }));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  class Mesa {
    constructor(evento = () => {}) {
      this.evento = evento;
      this.nueva();
    }
    nueva() {
      this.puntos = 0;
      this.bolaNumero = 1;
      this.multiplicador = 1;
      this.tiempo = 0;
      this.objetivos = [false, false, false, false];
      this.pasillos = [false, false, false];
      this.cooldowns = {};
      this.fase = "lista";
      this.acumulador = 0;
      this.bonus = 0;
      this.flippers = [
        { x: 160, y: 790, a: 0.32, old: 0.32, w: 0 },
        { x: 380, y: 790, a: Math.PI - 0.32, old: Math.PI - 0.32, w: 0 },
      ];
      this.preparar();
    }
    preparar() {
      this.bola = { x: 500, y: 825, vx: 0, vy: 0, r: R, carril: true };
      this.carga = 0;
      this.fase = "lista";
      this.salvada = false;
      this.lanzada = 0;
      this.bonus = 0;
    }
    lanzar() {
      if (this.fase !== "lista") return false;
      this.bola.vy = -(900 + 620 * this.carga);
      this.bola.vx = 0;
      this.fase = "jugando";
      this.lanzada = this.tiempo;
      this.evento("lanzar", this.carga);
      this.carga = 0;
      return true;
    }
    sumar(p, tipo, x, y) {
      this.puntos += Math.round(p * this.multiplicador);
      this.evento(tipo, { x, y, p: Math.round(p * this.multiplicador) });
    }
    enfriar(id, d = 0.13) {
      if ((this.cooldowns[id] ?? -100) > this.tiempo) return false;
      this.cooldowns[id] = this.tiempo + d;
      return true;
    }
    segmento(ax, ay, bx, by, r = 5, restitucion = 0.78, surface = null) {
      const b = this.bola,
        dx = bx - ax,
        dy = by - ay;
      const t = clamp(
        ((b.x - ax) * dx + (b.y - ay) * dy) / (dx * dx + dy * dy),
        0,
        1,
      );
      const px = ax + t * dx,
        py = ay + t * dy,
        nx = b.x - px,
        ny = b.y - py;
      const dist = Math.hypot(nx, ny),
        min = R + r;
      if (dist >= min) return false;
      const ux = dist > 1e-6 ? nx / dist : 0,
        uy = dist > 1e-6 ? ny / dist : -1;
      b.x = px + ux * (min + 0.04);
      b.y = py + uy * (min + 0.04);
      const sx = surface ? -surface.w * (py - surface.y) : 0,
        sy = surface ? surface.w * (px - surface.x) : 0;
      const vn = (b.vx - sx) * ux + (b.vy - sy) * uy;
      if (vn < 0) {
        b.vx -= (1 + restitucion) * vn * ux;
        b.vy -= (1 + restitucion) * vn * uy;
      }
      return vn < -20;
    }
    circulo(c, kick, id, tipo, puntos) {
      const b = this.bola,
        dx = b.x - c.x,
        dy = b.y - c.y,
        d = Math.hypot(dx, dy),
        min = c.r + R;
      if (d >= min) return;
      const nx = d > 1e-6 ? dx / d : 0,
        ny = d > 1e-6 ? dy / d : -1;
      b.x = c.x + nx * (min + 0.1);
      b.y = c.y + ny * (min + 0.1);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 1.7 * vn * nx;
        b.vy -= 1.7 * vn * ny;
      }
      if (this.enfriar(id)) {
        b.vx += nx * kick;
        b.vy += ny * kick;
        this.bonus += 25;
        this.sumar(puntos, tipo, c.x, c.y);
        return true;
      }
      return false;
    }
    paso(dt, input) {
      this.tiempo += dt;
      for (let i = 0; i < 2; i++) {
        const f = this.flippers[i],
          on = i === 0 ? input.izq : input.der;
        const target =
          i === 0 ? (on ? -0.55 : 0.32) : on ? Math.PI + 0.55 : Math.PI - 0.32;
        f.old = f.a;
        f.a += clamp(target - f.a, -22 * dt, 22 * dt);
        f.w = (f.a - f.old) / dt;
      }
      if (this.fase === "lista") {
        if (input.cargar) this.carga = clamp(this.carga + dt / 1.15, 0, 1);
        return;
      }
      if (this.fase !== "jugando") return;
      const b = this.bola;
      b.vy += 980 * dt;
      b.vx *= Math.exp(-0.06 * dt);
      b.vy *= Math.exp(-0.025 * dt);
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 1650) {
        b.vx *= 1650 / speed;
        b.vy *= 1650 / speed;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.carril && b.x < 470 && b.y < 160) {
        b.carril = false;
        this.lanzada = this.tiempo;
        this.evento("entrada");
      }
      walls.forEach((s, i) => {
        const hit = this.segmento(...s);
        if (hit && i >= 14 && this.enfriar("sling" + (i < 17 ? 0 : 1), 0.2)) {
          b.vy = -Math.max(420, Math.abs(b.vy));
          b.vx += (i < 17 ? 1 : -1) * 200;
          this.sumar(50, "sling", b.x, b.y);
        }
      });
      if (!b.carril) this.segmento(480, 151, 520, 151, 4, 0.65);
      if (b.carril && b.y >= 825 && b.vy > 0) {
        b.y = 825;
        b.vx = b.vy = 0;
        this.fase = "lista";
        this.evento("corta");
        return;
      }
      if (!b.carril) {
        bumpers.forEach((c, i) => this.circulo(c, 265, "b" + i, "bumper", 100));
        targets.forEach((c, i) => {
          if (this.circulo(c, 120, "t" + i, "objetivo", 250)) {
            this.objetivos[i] = true;
            if (this.objetivos.every(Boolean)) {
              this.objetivos.fill(false);
              this.sumar(2000, "jackpot", 270, 460);
            }
          }
        });
        lanes.forEach((c, i) => {
          if (
            Math.hypot(b.x - c.x, b.y - c.y) < c.r &&
            this.enfriar("lane" + i, 0.7)
          ) {
            this.pasillos[i] = true;
            this.sumar(150, "pasillo", c.x, c.y);
            if (this.pasillos.every(Boolean)) {
              this.pasillos.fill(false);
              this.multiplicador = Math.min(5, this.multiplicador + 1);
              this.evento("multiplicador", this.multiplicador);
            }
          }
        });
        if (
          Math.abs(b.y - 480) < 12 &&
          Math.abs(b.x - 265) < 30 &&
          this.enfriar("spinner", 0.15)
        )
          this.sumar(75, "spinner", 265, 480);
      }
      this.flippers.forEach((f) => {
        if (
          this.segmento(
            f.x,
            f.y,
            f.x + 90 * Math.cos(f.a),
            f.y + 90 * Math.sin(f.a),
            12,
            0.55,
            f,
          ) &&
          this.enfriar("flip" + f.x, 0.1)
        )
          this.evento("flipper");
      });
      if (b.y > 920) {
        if (!this.salvada && this.tiempo - this.lanzada < 6) {
          this.salvada = true;
          this.bola = { x: 500, y: 825, vx: 0, vy: -1480, r: R, carril: true };
          this.evento("salvada");
        } else {
          const bonus = this.bonus * this.multiplicador;
          this.puntos += bonus;
          this.evento("perdida", bonus);
          if (this.bolaNumero >= 3) {
            this.fase = "final";
            this.evento("final", this.puntos);
          } else {
            this.bolaNumero++;
            this.preparar();
          }
        }
      }
      // Numeric escape protection never grants points or extra lives.
      if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) {
        b.x = 270;
        b.y = 921;
        b.vx = b.vy = 0;
      }
    }
    avanzar(dt, input = {}) {
      if (this.fase === "final") return;
      this.acumulador += Math.min(0.05, Math.max(0, dt));
      while (this.acumulador >= STEP) {
        this.paso(STEP, input);
        this.acumulador -= STEP;
      }
    }
  }
  return { Mesa, W, H, R, walls, bumpers, targets, lanes, STEP };
});
