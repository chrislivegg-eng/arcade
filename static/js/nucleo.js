(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const c = $("game");
  const x = c.getContext("2d");
  const W = 780;
  const C = 390;
  const rr = [326, 270, 214, 158, 102];

  // Temas visuales 3D por nivel de Núcleo Jefe
  const TEMAS_NUCLEO = [
    {
      nombre: "CUARZO CRIOGÉNICO",
      cTop: "#38bdf8",
      cMid: "#0284c7",
      cBot: "#0f172a",
      cPared3D: "#082f49",
      cBorde: "#e0f2fe",
      cGlow: "#38bdf8",
      cCorazon: "#7dd3fc",
    },
    {
      nombre: "AMATISTA CUÁNTICA",
      cTop: "#c084fc",
      cMid: "#7e22ce",
      cBot: "#1e1b4b",
      cPared3D: "#3b0764",
      cBorde: "#f3e8ff",
      cGlow: "#d946ef",
      cCorazon: "#f0abfc",
    },
    {
      nombre: "ESMERALDA TÓXICA",
      cTop: "#34d399",
      cMid: "#059669",
      cBot: "#062c22",
      cPared3D: "#064e3b",
      cBorde: "#d1fae5",
      cGlow: "#10b981",
      cCorazon: "#6ee7b7",
    },
    {
      nombre: "MAGMA SOLAR",
      cTop: "#fb923c",
      cMid: "#dc2626",
      cBot: "#2a0808",
      cPared3D: "#450a0a",
      cBorde: "#fef08a",
      cGlow: "#f97316",
      cCorazon: "#fde047",
    },
    {
      nombre: "SINGULARIDAD OBSCURA",
      cTop: "#f43f5e",
      cMid: "#4c1d95",
      cBot: "#090414",
      cPared3D: "#2e1065",
      cBorde: "#fda4af",
      cGlow: "#e11d48",
      cCorazon: "#facc15",
    },
  ];

  const multGates = [
    { baseMult: 2, mult: 2, y: 558, color: "#818cf8", rim: "#c7d2fe", pulso: 0, giros: 0 },
    { baseMult: 3, mult: 3, y: 616, color: "#c084fc", rim: "#f3e8ff", pulso: 0, giros: 1.2 },
    { baseMult: 4, mult: 4, y: 674, color: "#38bdf8", rim: "#e0f2fe", pulso: 0, giros: 2.4 },
  ];

  // Portal Dorado Móvil en el cañón central (convierte bolas en Bombas Nova ×2)
  const portalDorado = {
    x: C - 4,
    y: 340,
    vy: 115,
    radio: 22,
    pulso: 0,
    angulo: 0,
  };

  let active = false;
  let balls = [];
  let proyectiles = [];
  let bits = [];
  let ondas = [];
  let textosFlotantes = [];

  let score = 0;
  let energia = 0; // Moneda táctica para mejoras (no resta puntos de récord)
  let bestScore = 0;
  let ultimoGuardado = 0;
  let chain = 0;
  let timerCadena = 0;
  let crack = 0;
  let maxCrackActual = 320;
  let nivelNucleo = 1;
  let indiceCarril = 0;
  let carrilApuntado = -1; // -1 = ciclo automático, 0..4 = carril apuntado con cursor
  let totalDisparos = 0;

  // Sobrecarga / Modo Fiebre
  let cargaFiebre = 0;
  let tiempoFiebre = 0;

  // Control de disparo continuo (Hold-to-Fire) y Dron
  let manteniendoDisparo = false;
  let cooldownDisparo = 0;
  let cooldownDron = 0;

  // Cámara 3D con inclinación parallax y sacudida física
  let tiltX = 0;
  let tiltY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let sacudida = 0;
  let tiempoGlobal = 0;

  // Mejoras Tácticas en vivo
  const mejoras = {
    multi: { nivel: 1, baseCost: 60 },
    potencia: { nivel: 1, baseCost: 80 },
    portales: { nivel: 1, baseCost: 120 },
    dron: { nivel: 0, baseCost: 100 },
  };

  let last = 0;
  let noticeTimer = 0;
  let name = "Jugador";
  let sound = true;
  let ac = null;

  // Perfil dentado de la grieta vertical (60 segmentos de arriba a abajo)
  const NUM_SEG = 60;
  const erosion = new Float32Array(NUM_SEG);

  // Facetas 3D precalculadas para el bloque de cristal tallado
  const facetasCristal = [];
  for (let i = 0; i < 22; i++) {
    const ang = -Math.PI * 0.44 + (i / 21) * Math.PI * 0.88;
    const rad = 110 + ((i * 73) % 190);
    facetasCristal.push({
      cx: C + Math.cos(ang) * rad * 0.85,
      cy: C + Math.sin(ang) * rad,
      r: 36 + ((i * 29) % 38),
      lados: 5 + (i % 3),
      rot: (i * 1.1) % 6.28,
      brillo: 0.04 + (i % 4) * 0.025,
    });
  }

  try {
    name = localStorage.getItem("nombreUsuario") || "";
    if ($("name")) $("name").value = name;
  } catch (_) {}

  const r = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function temaActual() {
    return TEMAS_NUCLEO[(nivelNucleo - 1) % TEMAS_NUCLEO.length];
  }

  function costoMejora(clave) {
    const m = mejoras[clave];
    return Math.round(m.baseCost * Math.pow(1.55, m.nivel - (clave === "dron" ? 0 : 1)));
  }

  function actualizarMultiplicadoresPortales() {
    const bonus = mejoras.portales.nivel - 1;
    for (const g of multGates) {
      g.mult = g.baseMult + bonus;
    }
  }

  function actualizarUIMejoras() {
    actualizarMultiplicadoresPortales();
    const cfg = [
      {
        clave: "multi",
        btn: "upgMultiDisparo",
        lvl: "lvlMultiDisparo",
        cost: "costMultiDisparo",
        txt: `Nv.${mejoras.multi.nivel} · ${mejoras.multi.nivel} bola${mejoras.multi.nivel > 1 ? "s" : ""}`,
      },
      {
        clave: "potencia",
        btn: "upgPotencia",
        lvl: "lvlPotencia",
        cost: "costPotencia",
        txt: `Nv.${mejoras.potencia.nivel} · Daño ×${(1 + (mejoras.potencia.nivel - 1) * 0.45).toFixed(1)}`,
      },
      {
        clave: "portales",
        btn: "upgPortales",
        lvl: "lvlPortales",
        cost: "costPortales",
        txt: `Nv.${mejoras.portales.nivel} · ×${multGates[0].mult}/×${multGates[1].mult}/×${multGates[2].mult}`,
      },
      {
        clave: "dron",
        btn: "upgDron",
        lvl: "lvlDron",
        cost: "costDron",
        txt:
          mejoras.dron.nivel === 0
            ? "Nv.0 · Inactivo"
            : `Nv.${mejoras.dron.nivel} · ${(1.8 + mejoras.dron.nivel * 1.4).toFixed(1)}/s`,
      },
    ];

    for (const item of cfg) {
      const cVal = costoMejora(item.clave);
      const bEl = $(item.btn);
      const lEl = $(item.lvl);
      const cEl = $(item.cost);
      if (lEl) lEl.textContent = item.txt;
      if (cEl) cEl.textContent = `⚡ ${cVal}`;
      if (bEl) {
        const puede = active && energia >= cVal;
        bEl.disabled = !puede;
        bEl.classList.toggle("disponible", puede);
      }
    }

    const tema = temaActual();
    if ($("badgeNivel")) {
      $("badgeNivel").textContent = `NÚCLEO NV. ${nivelNucleo} · ${tema.nombre}`;
    }

    const pctF = Math.min(100, Math.round(cargaFiebre));
    if ($("pctFiebre")) {
      $("pctFiebre").textContent =
        tiempoFiebre > 0 ? `🔥 ${tiempoFiebre.toFixed(1)}s` : `${pctF}%`;
    }
    if ($("barraFiebre")) {
      $("barraFiebre").style.width =
        tiempoFiebre > 0 ? `${Math.min(100, (tiempoFiebre / 6) * 100)}%` : `${pctF}%`;
    }
    if ($("estadoFiebre")) {
      $("estadoFiebre").textContent =
        tiempoFiebre > 0
          ? `🔥 ¡SOBRECARGA ACTIVA! (LÁSER + DAÑO ×2)`
          : `⚡ ENERGÍA TÁCTICA: ${energia.toLocaleString()} · SOBRECARGA`;
    }
    if ($("btnOverdrive")) {
      $("btnOverdrive").disabled = !(active && cargaFiebre >= 100 && tiempoFiebre <= 0);
    }
  }

  function comprarMejora(clave) {
    if (!active) return;
    const costo = costoMejora(clave);
    if (energia < costo) {
      aviso("⚡ ENERGÍA INSUFICIENTE");
      return;
    }
    energia -= costo;
    mejoras[clave].nivel++;
    sacudida = Math.max(sacudida, 6);
    beep(540 + mejoras[clave].nivel * 65, 0.14, "triangle");
    aviso(`⬆️ ¡MEJORA NV.${mejoras[clave].nivel} ACTIVADA!`);
    actualizarUIMejoras();
  }

  function activarOverdrive() {
    if (!active || (cargaFiebre < 100 && tiempoFiebre <= 0)) return;
    cargaFiebre = 0;
    tiempoFiebre = 6.0;
    sacudida = 14;
    beep(740, 0.25, "sawtooth");
    aviso("🔥 ¡SOBRECARGA MÁXIMA ACTIVADA!");
    ondas.push({
      x: C,
      y: C,
      r: 20,
      maxR: 350,
      color: "#fde047",
      alpha: 1,
    });
    actualizarUIMejoras();
  }

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
      g.gain.setValueAtTime(0.032, t0);
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
    }, 640);
  }

  function agregarTextoFlotante(txt, px, py, color = "#fde047", escala = 1) {
    if (textosFlotantes.length > 26) textosFlotantes.shift();
    textosFlotantes.push({
      txt,
      x: px,
      y: py,
      vy: -75 - escala * 20,
      color,
      escala,
      vida: 0.72,
      maxVida: 0.72,
    });
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

  function lanzarBolaIndividual(laneForzado = -1) {
    const lane =
      laneForzado >= 0
        ? laneForzado % rr.length
        : carrilApuntado >= 0
          ? carrilApuntado
          : indiceCarril % rr.length;
    indiceCarril++;
    totalDisparos++;

    // Cada 10 disparos sale una Bomba Nova; cada 5 sale una Esfera de Plasma (rebota 2 veces)
    const tipoBola =
      tiempoFiebre > 0 || totalDisparos % 10 === 0
        ? "nova"
        : totalDisparos % 5 === 0
          ? "plasma"
          : "termica";

    balls.push({
      a: Math.PI * 1.488,
      lane,
      v: r(1.55, 2.05) + lane * 0.14 + (tiempoFiebre > 0 ? 0.55 : 0),
      tipo: tipoBola,
      estela: [],
    });
  }

  function add() {
    if (!active) return;
    const cantidad = mejoras.multi.nivel;
    const baseLane =
      carrilApuntado >= 0 ? carrilApuntado : indiceCarril % rr.length;
    for (let i = 0; i < cantidad; i++) {
      lanzarBolaIndividual((baseLane + i) % rr.length);
    }
    beep(200 + (baseLane % 5) * 28, 0.07, "triangle");
  }

  function bordeGrietaEnY(py) {
    const t = clamp((py - 54) / 672, 0, 1);
    const idx = Math.min(NUM_SEG - 1, Math.floor(t * NUM_SEG));
    const diente =
      Math.sin(py * 0.15 + nivelNucleo) * 7 + Math.cos(py * 0.07) * 4.5;
    const progreso = (crack / Math.max(1, maxCrackActual)) * 135;
    return C + diente + progreso + erosion[idx];
  }

  function impactarGrieta(px, py, potenciaBase = 1, tipo = "termica", esCritico = false) {
    const multPotencia =
      (1 + (mejoras.potencia.nivel - 1) * 0.45) *
      (tiempoFiebre > 0 ? 1.85 : 1) *
      (esCritico ? 2.2 : 1);
    const potencia = potenciaBase * multPotencia;

    const t = clamp((py - 54) / 672, 0, 1);
    const idx = Math.min(NUM_SEG - 1, Math.floor(t * NUM_SEG));
    const radioSeg = tipo === "nova" ? 5 : 2;
    for (let k = -radioSeg; k <= radioSeg; k++) {
      const j = idx + k;
      if (j >= 0 && j < NUM_SEG) {
        const peso = (radioSeg + 1 - Math.abs(k)) / (radioSeg + 1);
        erosion[j] = Math.min(255, erosion[j] + peso * 4.8 * potencia);
      }
    }

    chain++;
    timerCadena = 2.4;
    const multCombo = 1 + Math.floor(chain / 6);
    const ptsGanados = Math.max(1, Math.round(multCombo * potencia * 2));
    score += ptsGanados;
    energia += Math.max(1, Math.round(ptsGanados * 0.65));
    crack = Math.min(maxCrackActual, crack + 3.6 * potencia);

    if (tiempoFiebre <= 0) {
      cargaFiebre = Math.min(100, cargaFiebre + 2.4 * potenciaBase);
      if (cargaFiebre >= 100) {
        aviso("🔥 ¡SOBRECARGA LISTA! PULSA EL BOTÓN O ESPACIO");
      }
    }

    sacudida = Math.min(13, sacudida + (tipo === "nova" ? 5.5 : 1.8));

    // Onda expansiva 3D en impactos fuertes o críticos
    if (tipo === "nova" || esCritico) {
      ondas.push({
        x: px,
        y: py,
        r: 8,
        maxR: tipo === "nova" ? 92 : 58,
        color: esCritico ? "#fde047" : "#38bdf8",
        alpha: 0.95,
      });
      agregarTextoFlotante(
        esCritico ? `💥 CRÍTICO +${ptsGanados}` : `💣 NOVA +${ptsGanados}`,
        px - 18,
        py - 10,
        esCritico ? "#fde047" : "#f43f5e",
        1.25,
      );
    } else if (Math.random() < 0.32) {
      agregarTextoFlotante(`+${ptsGanados}`, px - 10, py, "#7dd3fc", 0.9);
    }

    // Esquirlas 3D de cristal desprendido
    const tema = temaActual();
    const numBits = tipo === "nova" ? 16 : 8;
    for (let i = 0; i < numBits; i++) {
      bits.push({
        x: px,
        y: py,
        vx: r(-190, 210),
        vy: r(-190, 150),
        tam: r(3.5, 7.8),
        rot: r(0, 6.28),
        vRot: r(-8, 8),
        color:
          i % 3 === 0
            ? "#ffffff"
            : i % 2 === 0
              ? tema.cTop
              : tema.cCorazon,
        life: r(0.32, 0.78),
      });
    }

    beep(340 + Math.min(520, chain * 10), 0.08, tipo === "nova" ? "sawtooth" : "sine");
    actualizarUIMejoras();

    if (score % 20 === 0) guardarRecord(false);
    if (crack >= maxCrackActual && active) {
      completarNucleo();
    }
  }

  async function completarNucleo() {
    active = false;
    manteniendoDisparo = false;
    const bono = 250 * nivelNucleo;
    score += bono;
    energia += Math.round(bono * 0.5);
    sacudida = 18;
    aviso(`💥 ¡NÚCLEO ${nivelNucleo} DEMOLIDO! +${bono}`);

    const tema = temaActual();
    ondas.push({
      x: C + 120,
      y: C,
      r: 15,
      maxR: 380,
      color: tema.cCorazon,
      alpha: 1,
    });

    for (let i = 0; i < 80; i++) {
      bits.push({
        x: C + r(10, 270),
        y: C + r(-260, 260),
        vx: r(-280, 290),
        vy: r(-290, 250),
        tam: r(4.5, 10.5),
        rot: r(0, 6.28),
        vRot: r(-10, 10),
        color: i % 2 === 0 ? tema.cTop : "#fde047",
        life: r(0.55, 1.25),
      });
    }
    beep(660, 0.28, "triangle");
    guardarRecord(false);
    actualizarUIMejoras();

    if ($("resultTitle")) {
      $("resultTitle").textContent = `¡Núcleo ${nivelNucleo} (${tema.nombre}) pulverizado!`;
    }
    if ($("result")) $("result").textContent = `${score.toLocaleString()} PTS`;
    setTimeout(() => {
      if ($("end") && $("end").showModal && !$("end").open) {
        $("end").showModal();
      }
    }, 640);
  }

  // Dibuja una esfera 3D con sombra proyectada, iluminación especular y halo
  function dibujarEsfera3D(px, py, radio, tipo) {
    // Sombra 3D proyectada abajo-derecha
    x.fillStyle = "rgba(0, 0, 0, 0.48)";
    x.beginPath();
    x.arc(px + 4, py + 5, radio * 0.96, 0, Math.PI * 2);
    x.fill();

    const gr = x.createRadialGradient(
      px - radio * 0.36,
      py - radio * 0.36,
      radio * 0.12,
      px,
      py,
      radio,
    );
    if (tipo === "nova") {
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.32, "#fde047");
      gr.addColorStop(0.72, "#f97316");
      gr.addColorStop(1, "#7c2d12");
    } else if (tipo === "plasma") {
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.35, "#e879f9");
      gr.addColorStop(0.75, "#9333ea");
      gr.addColorStop(1, "#3b0764");
    } else {
      gr.addColorStop(0, "#fff1f2");
      gr.addColorStop(0.35, "#fb7185");
      gr.addColorStop(0.72, "#e11d48");
      gr.addColorStop(1, "#4c0519");
    }

    x.fillStyle = gr;
    x.beginPath();
    x.arc(px, py, radio, 0, Math.PI * 2);
    x.fill();

    // Brillo especular 3D superior
    x.fillStyle = "rgba(255, 255, 255, 0.72)";
    x.beginPath();
    x.ellipse(
      px - radio * 0.3,
      py - radio * 0.32,
      radio * 0.28,
      radio * 0.16,
      -0.6,
      0,
      Math.PI * 2,
    );
    x.fill();
  }

  function draw(ms) {
    requestAnimationFrame(draw);
    const dt = Math.min(0.035, (ms - (last || ms)) / 1000);
    last = ms;
    tiempoGlobal += dt;

    const tema = temaActual();

    // Actualizar timers de cadena, disparo continuo, dron y fiebre
    if (timerCadena > 0) {
      timerCadena -= dt;
      if (timerCadena <= 0) chain = Math.max(0, Math.floor(chain * 0.5));
    }

    if (active) {
      if (manteniendoDisparo) {
        cooldownDisparo -= dt;
        if (cooldownDisparo <= 0) {
          add();
          cooldownDisparo = Math.max(0.085, 0.18 - mejoras.multi.nivel * 0.015);
        }
      }
      if (mejoras.dron.nivel > 0) {
        cooldownDron -= dt;
        const intervaloDron = 1 / (1.4 + mejoras.dron.nivel * 1.25);
        if (cooldownDron <= 0) {
          lanzarBolaIndividual();
          cooldownDron = intervaloDron;
        }
      }
      if (tiempoFiebre > 0) {
        tiempoFiebre = Math.max(0, tiempoFiebre - dt);
        // El láser de sobrecarga erosiona continuamente el centro del cristal
        if (Math.random() < 0.45) {
          const pyLaser = C + Math.sin(tiempoGlobal * 14) * 140;
          impactarGrieta(bordeGrietaEnY(pyLaser), pyLaser, 0.55, "nova", false);
        }
        actualizarUIMejoras();
      }
    }

    // Mover Portal Dorado central
    portalDorado.y += portalDorado.vy * dt;
    if (portalDorado.y > 475) {
      portalDorado.y = 475;
      portalDorado.vy = -Math.abs(portalDorado.vy);
    } else if (portalDorado.y < 185) {
      portalDorado.y = 185;
      portalDorado.vy = Math.abs(portalDorado.vy);
    }
    portalDorado.angulo += dt * 3.2;
    portalDorado.pulso = Math.max(0, portalDorado.pulso - dt * 3.5);

    // Suavizar inclinación 3D (Parallax) + Sacudida de cámara
    tiltX += (targetTiltX - tiltX) * Math.min(1, dt * 8);
    tiltY += (targetTiltY - tiltY) * Math.min(1, dt * 8);
    sacudida = Math.max(0, sacudida - dt * 28);
    const shakeX = (Math.random() - 0.5) * sacudida;
    const shakeY = (Math.random() - 0.5) * sacudida;

    // Fondo abisal del reactor
    x.fillStyle = "#020611";
    x.fillRect(0, 0, W, W);

    x.save();
    x.translate(shakeX + tiltX * 12, shakeY + tiltY * 12);

    // =========================================================
    //  0. ANILLO EXTERIOR 3D DEL CHASIS Y TURBINA DE FONDO
    // =========================================================
    const gHalo = x.createRadialGradient(C, C, 50, C, C, 372);
    gHalo.addColorStop(0, "rgba(14, 116, 144, 0.22)");
    gHalo.addColorStop(0.75, "rgba(15, 23, 42, 0.55)");
    gHalo.addColorStop(1, "rgba(2, 6, 17, 0)");
    x.fillStyle = gHalo;
    x.beginPath();
    x.arc(C, C, 372, 0, Math.PI * 2);
    x.fill();

    // Pared 3D inferior del plato circular del reactor
    x.strokeStyle = "#0f172a";
    x.lineWidth = 18;
    x.beginPath();
    x.arc(C + 5, C + 8, 348, 0, Math.PI * 2);
    x.stroke();

    // Bisel metálico 3D del reactor con remaches luminosos
    x.strokeStyle = "rgba(56, 189, 248, 0.28)";
    x.lineWidth = 6;
    x.beginPath();
    x.arc(C, C, 348, 0, Math.PI * 2);
    x.stroke();

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + tiempoGlobal * 0.08;
      const rx = C + Math.cos(a) * 348;
      const ry = C + Math.sin(a) * 348;
      x.fillStyle = i % 2 === 0 ? tema.cTop : "#475569";
      x.beginPath();
      x.arc(rx, ry, 2.4, 0, Math.PI * 2);
      x.fill();
    }

    // =========================================================
    //  1. MONOLITO DE CRISTAL 3D EXTRUIDO (PARED LATERAL + CARA SUPERIOR + CORAZÓN)
    // =========================================================
    const yTop = 52;
    const yBot = 728;
    const espesor3D = 18; // Extrusión 3D hacia la izquierda/abajo

    // 1A. Pared 3D extruida del acantilado de cristal (da volumen 3D real a la grieta)
    x.fillStyle = tema.cPared3D;
    x.beginPath();
    x.moveTo(bordeGrietaEnY(yTop) - espesor3D, yTop + 6);
    for (let py = yTop + 12; py <= yBot; py += 12) {
      x.lineTo(bordeGrietaEnY(py) - espesor3D, py + 6);
    }
    for (let py = yBot; py >= yTop; py -= 12) {
      x.lineTo(bordeGrietaEnY(py), py);
    }
    x.closePath();
    x.fill();

    // Estrías horizontales de profundidad en el acantilado 3D
    x.strokeStyle = "rgba(255, 255, 255, 0.14)";
    x.lineWidth = 1.4;
    for (let py = yTop + 24; py < yBot; py += 24) {
      const bx = bordeGrietaEnY(py);
      x.beginPath();
      x.moveTo(bx - espesor3D, py + 6);
      x.lineTo(bx, py);
      x.stroke();
    }

    // 1B. Superficie superior 3D del bloque de cristal
    x.save();
    x.beginPath();
    x.moveTo(bordeGrietaEnY(yTop), yTop);
    for (let py = yTop + 12; py <= yBot; py += 12) {
      x.lineTo(bordeGrietaEnY(py), py);
    }
    x.arc(C, C, 338, Math.PI * 0.5, -Math.PI * 0.5, true);
    x.closePath();

    const gCristal = x.createLinearGradient(
      C - tiltX * 40,
      C - 340 - tiltY * 40,
      C + 340,
      C + 340,
    );
    gCristal.addColorStop(0, tema.cTop);
    gCristal.addColorStop(0.45, tema.cMid);
    gCristal.addColorStop(1, tema.cBot);
    x.fillStyle = gCristal;
    x.fill();

    x.clip();

    // Capas concéntricas 3D del blindaje interior
    for (const rCapa of [280, 210, 140]) {
      x.strokeStyle = "rgba(255, 255, 255, 0.12)";
      x.lineWidth = 3;
      x.beginPath();
      x.arc(C + 40, C, rCapa, -Math.PI * 0.55, Math.PI * 0.55);
      x.stroke();
    }

    // Facetas geométricas 3D talladas con reflejo dinámico según inclinación
    for (const f of facetasCristal) {
      const lum =
        f.brillo +
        Math.sin(tiempoGlobal * 2 + f.rot + tiltX * 3) * 0.03;
      x.fillStyle = `rgba(255, 255, 255, ${ clamp(lum, 0.02, 0.16) })`;
      x.strokeStyle = "rgba(255, 255, 255, 0.14)";
      x.lineWidth = 1.1;
      x.beginPath();
      for (let k = 0; k < f.lados; k++) {
        const a = f.rot + (k / f.lados) * Math.PI * 2;
        const vx = f.cx + Math.cos(a) * f.r;
        const vy = f.cy + Math.sin(a) * f.r;
        if (k === 0) x.moveTo(vx, vy);
        else x.lineTo(vx, vy);
      }
      x.closePath();
      x.fill();
      x.stroke();
    }

    // Vetas de energía incandescentes que crecen con el % de fractura
    const pctFractura = clamp(crack / Math.max(1, maxCrackActual), 0, 1);
    x.strokeStyle = tema.cBorde;
    x.lineWidth = 1.6 + pctFractura * 2.4;
    x.shadowColor = tema.cGlow;
    x.shadowBlur = 8 + pctFractura * 14;
    for (let i = -3; i <= 3; i++) {
      const pyBase = C + i * 78;
      const bx = bordeGrietaEnY(pyBase);
      x.beginPath();
      x.moveTo(bx, pyBase);
      x.lineTo(bx + 75 + pctFractura * 65, pyBase + (i % 2 === 0 ? -24 : 24));
      x.lineTo(bx + 150 + pctFractura * 90, pyBase - i * 12);
      x.stroke();
    }
    x.shadowBlur = 0;

    // 1C. Corazón 3D del Reactor Jefe (Punto Débil Crítico ×3)
    const coreX = C + 205;
    const coreY = C + Math.sin(tiempoGlobal * 2.2) * 38;
    const gCore = x.createRadialGradient(coreX - 6, coreY - 6, 3, coreX, coreY, 44);
    gCore.addColorStop(0, "#ffffff");
    gCore.addColorStop(0.35, tema.cCorazon);
    gCore.addColorStop(0.75, tema.cGlow);
    gCore.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gCore;
    x.beginPath();
    x.arc(coreX, coreY, 44, 0, Math.PI * 2);
    x.fill();

    // Anillos giroscópicos 3D alrededor del Corazón
    x.strokeStyle = "#ffffff";
    x.lineWidth = 2.2;
    for (let k = 0; k < 2; k++) {
      x.save();
      x.translate(coreX, coreY);
      x.rotate(tiempoGlobal * (k === 0 ? 2.4 : -1.8) + k);
      x.scale(1, 0.48);
      x.beginPath();
      x.arc(0, 0, 32 + k * 8, 0, Math.PI * 2);
      x.stroke();
      x.restore();
    }

    x.restore(); // Fin del clip del cristal

    // =========================================================
    //  2. CONDUCTOS TUBULARES 3D IZQUIERDOS (5 PISTAS EN RELIEVE)
    // =========================================================
    for (let i = 0; i < rr.length; i++) {
      const rad = rr[i];
      const esApuntado = carrilApuntado === i;

      // Sombra/pared 3D inferior del tubo
      x.strokeStyle = "rgba(2, 6, 23, 0.9)";
      x.lineWidth = 17;
      x.beginPath();
      x.arc(C + 3, C + 5, rad, Math.PI * 0.5, Math.PI * 1.5, false);
      x.stroke();

      // Cuerpo exterior metálico del conducto 3D
      x.strokeStyle = esApuntado
        ? "rgba(250, 204, 21, 0.42)"
        : "rgba(30, 58, 95, 0.72)";
      x.lineWidth = 13;
      x.beginPath();
      x.arc(C, C, rad, Math.PI * 0.5, Math.PI * 1.5, false);
      x.stroke();

      // Riel interior de neón
      x.strokeStyle = esApuntado
        ? "#fde047"
        : i % 2 === 0
          ? "#65eee6"
          : "#38bdf8";
      x.lineWidth = esApuntado ? 3.8 : 2.6;
      x.beginPath();
      x.arc(C, C, rad, Math.PI * 0.5, Math.PI * 1.5, false);
      x.stroke();

      // Brillo especular 3D en el borde del tubo
      x.strokeStyle = "rgba(255, 255, 255, 0.24)";
      x.lineWidth = 1;
      x.beginPath();
      x.arc(C, C, rad - 4.5, Math.PI * 0.5, Math.PI * 1.5, false);
      x.stroke();

      // Boquilla 3D de entrada superior para cada carril (12 en punto)
      const topY = C - rad;
      x.fillStyle = esApuntado ? "#fde047" : "#0f172a";
      x.strokeStyle = esApuntado ? "#ffffff" : "#38bdf8";
      x.lineWidth = 1.8;
      x.beginPath();
      x.arc(C - 4, topY, esApuntado ? 7.5 : 5.5, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }

    // =========================================================
    //  3. BORDE INCANDESCENTE DE LA FRACTURA CENTRAL + LÁSER DE FIEBRE
    // =========================================================
    if (tiempoFiebre > 0) {
      const pyLaser = C + Math.sin(tiempoGlobal * 14) * 140;
      const bxLaser = bordeGrietaEnY(pyLaser);
      x.strokeStyle = "#fde047";
      x.lineWidth = 8;
      x.shadowColor = "#f97316";
      x.shadowBlur = 18;
      x.beginPath();
      x.moveTo(C, 82);
      x.lineTo(bxLaser, pyLaser);
      x.stroke();
      x.shadowBlur = 0;
    }

    x.strokeStyle = tema.cBorde;
    x.lineWidth = 3.6;
    x.shadowColor = tema.cGlow;
    x.shadowBlur = 12;
    x.beginPath();
    for (let py = yTop; py <= yBot; py += 12) {
      const bx = bordeGrietaEnY(py);
      if (py === yTop) x.moveTo(bx, py);
      else x.lineTo(bx, py);
    }
    x.stroke();
    x.shadowBlur = 0;

    // =========================================================
    //  4. CAÑÓN INYECTOR 3D SUPERIOR + DRON AUTOMÁTICO
    // =========================================================
    const carrilActivo =
      carrilApuntado >= 0 ? carrilApuntado : indiceCarril % rr.length;
    const yBoquilla = C - rr[carrilActivo];

    // Línea guía láser hacia el carril activo
    x.strokeStyle = "rgba(250, 204, 21, 0.35)";
    x.setLineDash([4, 4]);
    x.lineWidth = 1.8;
    x.beginPath();
    x.moveTo(C, 46);
    x.lineTo(C - 4, yBoquilla);
    x.stroke();
    x.setLineDash([]);

    // Torreta inyectora 3D superior
    const gTorreta = x.createLinearGradient(C - 26, 36, C + 26, 92);
    gTorreta.addColorStop(0, "#f8fafc");
    gTorreta.addColorStop(0.5, "#94a3b8");
    gTorreta.addColorStop(1, "#1e293b");
    x.fillStyle = gTorreta;
    x.beginPath();
    x.moveTo(C - 24, 44);
    x.lineTo(C + 24, 44);
    x.lineTo(C + 10, 82);
    x.lineTo(C - 10, 82);
    x.closePath();
    x.fill();
    x.strokeStyle = "#38bdf8";
    x.lineWidth = 2;
    x.stroke();

    // Si el Dron Auto-Cañón está activo, dibujarlo orbitando arriba
    if (mejoras.dron.nivel > 0) {
      const dxDron = C - 58 + Math.sin(tiempoGlobal * 4) * 14;
      const dyDron = 68 + Math.cos(tiempoGlobal * 3) * 6;
      x.fillStyle = "#38bdf8";
      x.beginPath();
      x.arc(dxDron, dyDron, 11, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = "#ffffff";
      x.lineWidth = 2;
      x.stroke();
      x.fillStyle = "#020617";
      x.font = "900 10px system-ui";
      x.textAlign = "center";
      x.fillText("🤖", dxDron, dyDron + 3.5);
    }

    // =========================================================
    //  5. PORTAL DORADO MÓVIL (×2 NOVA) Y PORTALES INFERIORES 3D
    // =========================================================
    // Portal Dorado oscilante en la grieta
    x.save();
    x.translate(portalDorado.x, portalDorado.y);
    const rPortal = portalDorado.radio + portalDorado.pulso * 7;
    const gPortal = x.createRadialGradient(0, 0, 4, 0, 0, rPortal + 8);
    gPortal.addColorStop(0, "rgba(254, 240, 138, 0.95)");
    gPortal.addColorStop(0.55, "rgba(245, 158, 11, 0.75)");
    gPortal.addColorStop(1, "rgba(245, 158, 11, 0)");
    x.fillStyle = gPortal;
    x.beginPath();
    x.arc(0, 0, rPortal + 8, 0, Math.PI * 2);
    x.fill();

    x.rotate(portalDorado.angulo);
    x.strokeStyle = "#fef08a";
    x.lineWidth = 2.6;
    x.strokeRect(-rPortal * 0.68, -rPortal * 0.68, rPortal * 1.36, rPortal * 1.36);
    x.restore();

    x.fillStyle = "#090d16";
    x.font = "900 10px system-ui";
    x.textAlign = "center";
    x.fillText("NOVA ×2", portalDorado.x, portalDorado.y + 3.5);

    // Anillos Multiplicadores Inferiores 3D (×2, ×3, ×4 mejorables)
    for (const gate of multGates) {
      gate.pulso = Math.max(0, gate.pulso - dt * 4.2);
      gate.giros += dt * 2.5;
      const radioGate = 19 + gate.pulso * 7;

      // Sombra 3D del anillo
      x.fillStyle = "rgba(0, 0, 0, 0.55)";
      x.beginPath();
      x.arc(C + 3, gate.y + 4, radioGate + 2, 0, Math.PI * 2);
      x.fill();

      // Cuerpo 3D del portal multiplicador
      const gg = x.createRadialGradient(
        C - 5,
        gate.y - 5,
        2,
        C,
        gate.y,
        radioGate,
      );
      gg.addColorStop(0, gate.rim);
      gg.addColorStop(0.55, gate.color);
      gg.addColorStop(1, "#0f172a");
      x.fillStyle = gg;
      x.beginPath();
      x.arc(C, gate.y, radioGate, 0, Math.PI * 2);
      x.fill();

      // Aro orbital 3D
      x.strokeStyle = "#ffffff";
      x.lineWidth = 2;
      x.beginPath();
      x.arc(
        C,
        gate.y,
        radioGate,
        gate.giros,
        gate.giros + Math.PI * 1.35,
      );
      x.stroke();

      x.fillStyle = "#ffffff";
      x.font = "900 13px system-ui";
      x.textAlign = "center";
      x.fillText(`×${gate.mult}`, C, gate.y + 4.5);
    }

    // =========================================================
    //  6. ESFERAS 3D EN LOS CONDUCTOS CURVOS IZQUIERDOS
    // =========================================================
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      b.a -= b.v * dt;
      const rad = rr[b.lane];
      const px = C + Math.cos(b.a) * rad;
      const py = C + Math.sin(b.a) * rad;

      b.estela.push({ x: px, y: py });
      if (b.estela.length > 7) b.estela.shift();

      if (b.a <= Math.PI * 0.5) {
        // Llegó a la base: atraviesa el portal multiplicador
        const gate = multGates[b.lane % multGates.length];
        gate.pulso = 1;
        beep(310 + gate.mult * 45, 0.07, "sine");

        const totalGen = gate.mult * (tiempoFiebre > 0 ? 2 : 1);
        for (let m = 0; m < totalGen; m++) {
          proyectiles.push({
            x: C + r(-11, 7),
            y: gate.y - (m % 5) * 11,
            vx: r(42, 112),
            vy: -r(410, 560),
            potencia: 1,
            tipo: b.tipo,
            rebotes: b.tipo === "plasma" ? 1 : 0,
            cruzoDorado: false,
          });
        }
        balls.splice(i, 1);
      } else {
        // Dibujar estela luminosa
        for (let s = 0; s < b.estela.length; s++) {
          const pt = b.estela[s];
          const al = ((s + 1) / b.estela.length) * 0.35;
          x.fillStyle =
            b.tipo === "nova"
              ? `rgba(250, 204, 21, ${al})`
              : b.tipo === "plasma"
                ? `rgba(217, 70, 239, ${al})`
                : `rgba(244, 63, 94, ${al})`;
          x.beginPath();
          x.arc(pt.x, pt.y, 4 + s * 0.7, 0, Math.PI * 2);
          x.fill();
        }
        dibujarEsfera3D(px, py, 11, b.tipo);
      }
    }

    // =========================================================
    //  7. PROYECTILES EN EL CAÑÓN CENTRAL + CHOQUE CONTRA EL CRISTAL 3D
    // =========================================================
    const coreYActual = C + Math.sin(tiempoGlobal * 2.2) * 38;
    for (let i = proyectiles.length - 1; i >= 0; i--) {
      const p = proyectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // ¿Atraviesa el Portal Dorado Móvil? -> ¡Se duplica y evoluciona a Bomba Nova!
      if (
        !p.cruzoDorado &&
        Math.hypot(p.x - portalDorado.x, p.y - portalDorado.y) <
          portalDorado.radio + 9
      ) {
        p.cruzoDorado = true;
        p.tipo = "nova";
        p.potencia *= 1.8;
        portalDorado.pulso = 1;
        if (proyectiles.length < 160) {
          proyectiles.push({
            x: p.x - 6,
            y: p.y + 6,
            vx: p.vx + r(25, 65),
            vy: p.vy * 0.96,
            potencia: p.potencia,
            tipo: "nova",
            rebotes: 0,
            cruzoDorado: true,
          });
        }
      }

      const limiteX = bordeGrietaEnY(p.y);
      if (p.x >= limiteX - 8 || p.y <= 74) {
        const yImpacto = clamp(p.y, 72, 708);
        const esCritico = Math.abs(yImpacto - coreYActual) < 44;
        impactarGrieta(limiteX, yImpacto, p.potencia, p.tipo, esCritico);

        // Las esferas de Plasma rebotan hacia atrás para golpear dos veces
        if (p.rebotes > 0) {
          p.rebotes--;
          p.x = limiteX - 28;
          p.vx = r(65, 130);
          p.vy = -r(180, 320);
          continue;
        }
        proyectiles.splice(i, 1);
        continue;
      }

      dibujarEsfera3D(p.x, p.y, p.tipo === "nova" ? 10.5 : 9, p.tipo);
    }

    // =========================================================
    //  8. ONDAS DE CHOQUE 3D, ESQUIRLAS POLIGONALES Y TEXTOS FLOTANTES
    // =========================================================
    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i];
      o.r += (o.maxR - o.r) * Math.min(1, dt * 9) + 90 * dt;
      o.alpha -= dt * 2.1;
      if (o.alpha <= 0 || o.r >= o.maxR) {
        ondas.splice(i, 1);
        continue;
      }
      x.save();
      x.globalAlpha = clamp(o.alpha, 0, 1);
      x.strokeStyle = o.color;
      x.lineWidth = 3.2;
      x.beginPath();
      x.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      x.stroke();
      x.restore();
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const p = bits[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.rot += (p.vRot || 0) * dt;
      if (p.life <= 0) {
        bits.splice(i, 1);
        continue;
      }
      x.save();
      x.globalAlpha = clamp(p.life / 0.75, 0, 1);
      x.translate(p.x, p.y);
      x.rotate(p.rot || 0);
      x.fillStyle = p.color || "#a4fff5";
      const t = p.tam || 5;
      x.beginPath();
      x.moveTo(-t * 0.6, -t * 0.5);
      x.lineTo(t * 0.7, -t * 0.2);
      x.lineTo(t * 0.3, t * 0.7);
      x.lineTo(-t * 0.5, t * 0.4);
      x.closePath();
      x.fill();
      x.restore();
    }

    for (let i = textosFlotantes.length - 1; i >= 0; i--) {
      const tf = textosFlotantes[i];
      tf.vida -= dt;
      tf.y += tf.vy * dt;
      if (tf.vida <= 0) {
        textosFlotantes.splice(i, 1);
        continue;
      }
      x.save();
      x.globalAlpha = clamp(tf.vida / tf.maxVida, 0, 1);
      x.font = `900 ${Math.round(13 * tf.escala)}px system-ui`;
      x.fillStyle = tf.color;
      x.shadowColor = "#000000";
      x.shadowBlur = 6;
      x.textAlign = "center";
      x.fillText(tf.txt, tf.x, tf.y);
      x.restore();
    }

    x.restore(); // Fin de transformación de cámara 3D

    if ($("score")) $("score").textContent = score.toLocaleString();
    if ($("combo")) $("combo").textContent = `×${1 + Math.floor(chain / 6)}`;
    if ($("shield")) {
      $("shield").textContent = `${Math.min(100, Math.round((crack / Math.max(1, maxCrackActual)) * 100))}%`;
    }
  }

  function prepararNucleo(reiniciarTodo = false) {
    if (reiniciarTodo) {
      score = 0;
      energia = 0;
      ultimoGuardado = 0;
      nivelNucleo = 1;
      cargaFiebre = 0;
      tiempoFiebre = 0;
      mejoras.multi.nivel = 1;
      mejoras.potencia.nivel = 1;
      mejoras.portales.nivel = 1;
      mejoras.dron.nivel = 0;
    }
    maxCrackActual = 320 + (nivelNucleo - 1) * 140;
    chain = 0;
    crack = 0;
    balls = [];
    proyectiles = [];
    bits = [];
    ondas = [];
    textosFlotantes = [];
    erosion.fill(0);
    active = true;
    actualizarUIMejoras();
  }

  function start() {
    name =
      (($("name") && $("name").value) || "").trim().slice(0, 14) || "Jugador";
    try {
      localStorage.setItem("nombreUsuario", name);
    } catch (_) {}
    prepararNucleo(true);
    if ($("intro") && $("intro").open) $("intro").close();
    aviso("🚀 ¡MANTÉN PULSADO PARA DISPARAR!");
  }

  if ($("intro") && $("intro").showModal) $("intro").showModal();

  // Apuntado 3D interactivo + Parallax con el cursor/dedo
  function actualizarApuntado(clientX, clientY) {
    const rect = c.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((clientX - rect.left) / rect.width) * W;
    const ny = ((clientY - rect.top) / rect.height) * W;

    targetTiltX = clamp((nx - C) / C, -1, 1);
    targetTiltY = clamp((ny - C) / C, -1, 1);

    // Si apunta al hemisferio izquierdo o superior, seleccionar el carril más cercano al radio
    if (nx <= C + 40) {
      const distCentro = Math.hypot(nx - C, ny - C);
      let mejorIdx = 0;
      let mejorDiff = Infinity;
      for (let i = 0; i < rr.length; i++) {
        const diff = Math.abs(distCentro - rr[i]);
        if (diff < mejorDiff) {
          mejorDiff = diff;
          mejorIdx = i;
        }
      }
      carrilApuntado = mejorDiff < 65 ? mejorIdx : -1;
    } else {
      carrilApuntado = -1;
    }
  }

  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    actualizarApuntado(e.clientX, e.clientY);
    add();
    manteniendoDisparo = true;
    cooldownDisparo = 0.16;
  });

  c.addEventListener("pointermove", (e) => {
    actualizarApuntado(e.clientX, e.clientY);
  });

  window.addEventListener("pointerup", () => {
    manteniendoDisparo = false;
  });
  window.addEventListener("pointercancel", () => {
    manteniendoDisparo = false;
  });

  // Atajos de teclado Pro (Espacio = Ráfaga/Overdrive, 1-4 = Mejoras)
  window.addEventListener("keydown", (e) => {
    if (!active) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (cargaFiebre >= 100 && tiempoFiebre <= 0) activarOverdrive();
      else add();
    } else if (e.key === "1") comprarMejora("multi");
    else if (e.key === "2") comprarMejora("potencia");
    else if (e.key === "3") comprarMejora("portales");
    else if (e.key === "4") comprarMejora("dron");
  });

  if ($("upgMultiDisparo"))
    $("upgMultiDisparo").onclick = () => comprarMejora("multi");
  if ($("upgPotencia"))
    $("upgPotencia").onclick = () => comprarMejora("potencia");
  if ($("upgPortales"))
    $("upgPortales").onclick = () => comprarMejora("portales");
  if ($("upgDron")) $("upgDron").onclick = () => comprarMejora("dron");
  if ($("btnOverdrive")) $("btnOverdrive").onclick = activarOverdrive;

  if ($("start")) $("start").onclick = start;
  if ($("again")) {
    $("again").onclick = () => {
      if ($("end") && $("end").open) $("end").close();
      nivelNucleo++;
      prepararNucleo(false);
      aviso(`⚡ NÚCLEO NV.${nivelNucleo}: ${temaActual().nombre}`);
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
  actualizarUIMejoras();
  requestAnimationFrame(draw);
})();
