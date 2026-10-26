(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const c = $("game");
  const x = c.getContext("2d");
  const W = 780;
  const C = 390;
  const MAX_CRACK = 300;
  const rr = [326, 270, 214, 158, 102];
  const multGates = [
    { mult: 2, y: 562, color: "#9d8bff", pulso: 0 },
    { mult: 3, y: 618, color: "#be63ff", pulso: 0 },
    { mult: 4, y: 674, color: "#8edcff", pulso: 0 },
  ];

  let active = false;
  let balls = [];
  let proyectiles = [];
  let bits = [];
  let score = 0;
  let bestScore = 0;
  let ultimoGuardado = 0;
  let chain = 0;
  let crack = 0;
  let nivelNucleo = 1;
  let indiceCarril = 0;
  let last = 0;
  let noticeTimer = 0;
  let name = "Jugador";
  let sound = true;
  let ac = null;

  // Perfil dentado de la grieta vertical (54 segmentos de arriba a abajo)
  const NUM_SEG = 54;
  let erosion = new Float32Array(NUM_SEG);

  try {
    name = localStorage.getItem("nombreUsuario") || "";
    if ($("name")) $("name").value = name;
  } catch (_) {}

  const r = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function beep(f, dur = 0.11, tipo = "sine") {
    if (!sound) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const t0 = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.035, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur);
    } catch (_) {}
  }

  function aviso(texto) {
    const n = $("notice");
    if (!n) return;
    n.textContent = texto;
    n.style.opacity = "1";
    n.style.transform = "translateY(0)";
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      n.style.opacity = "0";
      n.style.transform = "translateY(8px)";
    }, 520);
  }

  function cargarRecord() {
    fetch("/api/records/nucleo")
      .then((res) => res.json())
      .then((d) => {
        const lista = Array.isArray(d) ? d : d.records || [];
        const max = Math.max(0, ...lista.map((v) => Number(v.puntos) || 0));
        bestScore = Math.max(bestScore, max);
        if ($("best")) $("best").textContent = bestScore.toLocaleString();
      })
      .catch(() => {});
  }

  async function guardarRecord(forzarAviso = false) {
    if (score <= 0) return;
    if (!forzarAviso && score <= ultimoGuardado) return;
    ultimoGuardado = score;
    if (score > bestScore) {
      bestScore = score;
      if ($("best")) $("best").textContent = bestScore.toLocaleString();
    }
    try {
      await fetch("/api/records/nucleo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: name || "Jugador", puntos: score }),
      });
      if (forzarAviso) aviso(`💾 RÉCORD: ${score.toLocaleString()}`);
    } catch (_) {}
  }

  function add() {
    if (!active) return;
    const lane = indiceCarril % rr.length;
    indiceCarril++;
    // La bola entra por el embudo superior (12 en punto = 1.5*PI) y baja por el semicírculo izquierdo hasta las 6 en punto (0.5*PI)
    balls.push({
      a: Math.PI * 1.485,
      lane,
      v: r(1.35, 1.85) + lane * 0.12,
    });
    beep(190 + lane * 25, 0.08, "triangle");
  }

  function bordeGrietaEnY(py) {
    const t = clamp((py - 54) / 672, 0, 1);
    const idx = Math.min(NUM_SEG - 1, Math.floor(t * NUM_SEG));
    const diente = Math.sin(py * 0.16) * 7 + Math.cos(py * 0.07) * 4;
    return C + diente + crack * 0.45 + erosion[idx];
  }

  function impactarGrieta(px, py, potencia = 1) {
    const t = clamp((py - 54) / 672, 0, 1);
    const idx = Math.min(NUM_SEG - 1, Math.floor(t * NUM_SEG));
    for (let k = -2; k <= 2; k++) {
      const j = idx + k;
      if (j >= 0 && j < NUM_SEG) {
        erosion[j] = Math.min(260, erosion[j] + (3 - Math.abs(k)) * 2.2 * potencia);
      }
    }

    const multCombo = 1 + Math.floor(chain / 6);
    score += multCombo * potencia;
    chain++;
    crack = Math.min(MAX_CRACK, crack + 4.2 * potencia);

    for (let i = 0; i < 10; i++) {
      bits.push({
        x: px,
        y: py,
        vx: r(-160, 190),
        vy: r(-160, 140),
        tam: r(3, 6.5),
        color: Math.random() > 0.35 ? "#9efcff" : "#ffffff",
        life: r(0.28, 0.72),
      });
    }
    beep(360 + Math.min(480, chain * 12), 0.09, "sine");

    if (score % 20 === 0) guardarRecord(false);
    if (crack >= MAX_CRACK && active) {
      completarNucleo();
    }
  }

  async function completarNucleo() {
    active = false;
    const bono = 150 * nivelNucleo;
    score += bono;
    aviso(`💥 ¡NÚCLEO ${nivelNucleo} DEMOLIDO! +${bono}`);

    // Explosión masiva de fragmentos de cristal
    for (let i = 0; i < 65; i++) {
      bits.push({
        x: C + r(10, 260),
        y: C + r(-260, 260),
        vx: r(-240, 260),
        vy: r(-260, 220),
        tam: r(4, 9),
        color: i % 2 === 0 ? "#73f7e6" : "#fff0bc",
        life: r(0.5, 1.1),
      });
    }
    beep(620, 0.25, "triangle");
    await guardarRecord(false);

    if ($("resultTitle"))
      $("resultTitle").textContent = `¡Núcleo ${nivelNucleo} pulverizado!`;
    if ($("result")) $("result").textContent = `${score.toLocaleString()} PTS`;
    setTimeout(() => {
      if ($("end") && $("end").showModal && !$("end").open) {
        $("end").showModal();
      }
    }, 620);
  }

  function draw(ms) {
    requestAnimationFrame(draw);
    const dt = Math.min(0.035, (ms - (last || ms)) / 1000);
    last = ms;

    // Fondo espacial oscuro
    x.fillStyle = "#020611";
    x.fillRect(0, 0, W, W);

    // Halo exterior del reactor
    const gHalo = x.createRadialGradient(C, C, 80, C, C, 365);
    gHalo.addColorStop(0, "rgba(25, 78, 120, 0.18)");
    gHalo.addColorStop(1, "rgba(2, 6, 17, 0)");
    x.fillStyle = gHalo;
    x.beginPath();
    x.arc(C, C, 365, 0, Math.PI * 2);
    x.fill();

    // 1. Bloque de cristal derecho (se va erosionando conforme avanza la fractura)
    x.save();
    x.beginPath();
    const yTop = 52;
    const yBot = 728;
    x.moveTo(bordeGrietaEnY(yTop), yTop);
    for (let py = yTop + 12; py <= yBot; py += 12) {
      x.lineTo(bordeGrietaEnY(py), py);
    }
    x.arc(C, C, 338, Math.PI * 0.5, -Math.PI * 0.5, true);
    x.closePath();

    const gCristal = x.createLinearGradient(C, C - 340, C + 340, C + 340);
    gCristal.addColorStop(0, "#2b648e");
    gCristal.addColorStop(0.5, "#1d456b");
    gCristal.addColorStop(1, "#102742");
    x.fillStyle = gCristal;
    x.fill();

    // Vetas internas del cristal
    x.clip();
    x.strokeStyle = "rgba(142, 255, 242, 0.14)";
    x.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      x.beginPath();
      x.moveTo(C + 20, C + i * 85);
      x.lineTo(C + 330, C + i * 65 - 40);
      x.stroke();
    }
    x.restore();

    // 2. Pistas semicirculares izquierdas (de 90° a 270° = Math.PI*0.5 a Math.PI*1.5)
    for (let i = 0; i < rr.length; i++) {
      const rad = rr[i];
      x.strokeStyle = i % 2 === 0 ? "#65eee6" : "#38bdf8";
      x.lineWidth = 2.6;
      x.beginPath();
      x.arc(C, C, rad, Math.PI * 0.5, Math.PI * 1.5, false);
      x.stroke();
    }

    // 3. Borde luminoso de la fractura central
    x.strokeStyle = "#e0ffff";
    x.lineWidth = 3.2;
    x.shadowColor = "#65eee6";
    x.shadowBlur = 10;
    x.beginPath();
    for (let py = yTop; py <= yBot; py += 12) {
      const bx = bordeGrietaEnY(py);
      if (py === yTop) x.moveTo(bx, py);
      else x.lineTo(bx, py);
    }
    x.stroke();
    x.shadowBlur = 0;

    // 4. Embudo blanco superior (lanzador de bolas)
    x.fillStyle = "#f1f5f9";
    x.beginPath();
    x.moveTo(C - 20, 56);
    x.lineTo(C + 20, 56);
    x.lineTo(C, 96);
    x.closePath();
    x.fill();

    // 5. Compuertas multiplicadoras inferiores (×2, ×3, ×4)
    for (const gate of multGates) {
      gate.pulso = Math.max(0, gate.pulso - dt * 4);
      const radioGate = 18 + gate.pulso * 6;
      x.fillStyle = gate.color;
      x.beginPath();
      x.arc(C, gate.y, radioGate, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#ffffff";
      x.lineWidth = 1.8;
      x.stroke();

      x.fillStyle = "#06101e";
      x.font = "900 12px system-ui";
      x.textAlign = "center";
      x.fillText(`×${gate.mult}`, C, gate.y + 4);
    }

    // 6. Actualizar y dibujar bolas en las pistas curvas izquierdas
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.a -= b.v * dt;
      const rad = rr[b.lane];
      const px = C + Math.cos(b.a) * rad;
      const py = C + Math.sin(b.a) * rad;

      if (b.a <= Math.PI * 0.5) {
        // Llegó a la base: activa el multiplicador correspondiente a su carril
        const gate = multGates[b.lane % multGates.length];
        gate.pulso = 1;
        beep(310 + gate.mult * 55, 0.08, "sine");

        for (let m = 0; m < gate.mult; m++) {
          proyectiles.push({
            x: C + r(-10, 6),
            y: gate.y - m * 12,
            vx: r(35, 95),
            vy: -r(390, 520),
            potencia: 1,
          });
        }
        balls.splice(i, 1);
      } else {
        const gr = x.createRadialGradient(px - 4, py - 4, 1, px, py, 13);
        gr.addColorStop(0, "#fff1f2");
        gr.addColorStop(0.38, "#ff4b52");
        gr.addColorStop(1, "#881337");
        x.fillStyle = gr;
        x.beginPath();
        x.arc(px, py, 10.5, 0, Math.PI * 2);
        x.fill();
      }
    }

    // 7. Proyectiles multiplicados que suben por la grieta y demuelen el cristal
    for (let i = proyectiles.length - 1; i >= 0; i--) {
      const p = proyectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const limiteX = bordeGrietaEnY(p.y);

      if (p.x >= limiteX - 8 || p.y <= 78) {
        impactarGrieta(limiteX, clamp(p.y, 75, 705), p.potencia);
        proyectiles.splice(i, 1);
        continue;
      }

      const gr = x.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, 11);
      gr.addColorStop(0, "#fef08a");
      gr.addColorStop(0.45, "#ff4b52");
      gr.addColorStop(1, "#9f1239");
      x.fillStyle = gr;
      x.beginPath();
      x.arc(p.x, p.y, 9, 0, Math.PI * 2);
      x.fill();
    }

    // 8. Fragmentos de cristal desprendidos
    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      x.globalAlpha = clamp(p.life / 0.75, 0, 1);
      x.fillStyle = p.color || "#a4fff5";
      x.fillRect(p.x, p.y, p.tam || 4, p.tam || 4);
      if (p.life <= 0) bits.splice(i, 1);
    }
    x.globalAlpha = 1;

    if ($("score")) $("score").textContent = score.toLocaleString();
    if ($("combo"))
      $("combo").textContent = `×${1 + Math.floor(chain / 6)}`;
    if ($("shield"))
      $("shield").textContent = `${Math.min(100, Math.round((crack / MAX_CRACK) * 100))}%`;
  }

  function prepararNucleo(reiniciarPuntos = false) {
    if (reiniciarPuntos) {
      score = 0;
      ultimoGuardado = 0;
      nivelNucleo = 1;
    }
    chain = 0;
    crack = 0;
    balls = [];
    proyectiles = [];
    bits = [];
    erosion.fill(0);
    active = true;
  }

  function start() {
    name =
      (($("name") && $("name").value) || "").trim().slice(0, 14) || "Jugador";
    try {
      localStorage.setItem("nombreUsuario", name);
    } catch (_) {}
    prepararNucleo(true);
    if ($("intro") && $("intro").open) $("intro").close();
    aviso("¡TOCA PARA LANZAR BOLAS!");
  }

  if ($("intro") && $("intro").showModal) $("intro").showModal();

  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    add();
  });

  if ($("start")) $("start").onclick = start;
  if ($("again")) {
    $("again").onclick = () => {
      if ($("end") && $("end").open) $("end").close();
      nivelNucleo++;
      prepararNucleo(false);
      aviso(`⚡ NÚCLEO ${nivelNucleo}`);
    };
  }
  if ($("saveBtn")) {
    $("saveBtn").onclick = () => guardarRecord(true);
  }
  if ($("audio")) {
    $("audio").onclick = () => {
      sound = !sound;
      $("audio").textContent = sound ? "♫" : "×";
    };
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") guardarRecord(false);
  });

  cargarRecord();
  requestAnimationFrame(draw);
})();
