(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const c = $("lienzo");
  const x = c.getContext("2d");
  const W = 720;
  const C = W / 2;
  const CY = C - 18;
  const META = 25000;

  // Lienzo persistente para acumular los cortes reales sobre la lima
  const capaCortes = document.createElement("canvas");
  capaCortes.width = capaCortes.height = W;
  const xc = capaCortes.getContext("2d");

  let cuts = 0;
  let bestRecord = 0;
  let active = false;
  let recienCortes = [];
  let chips = [];
  let gotasJugo = [];
  let knife = { t: 0, a: 0, offset: 0 };
  let noteTimer = 0;
  let name = "Jugador";
  let sound = true;
  let ac = null;
  let last = 0;
  let ultimoGuardado = 0;
  let arrastrando = false;
  let ultDrag = { x: 0, y: 0, ms: 0 };

  try {
    name = localStorage.getItem("nombreUsuario") || "";
    if ($("name")) $("name").value = name;
  } catch (_) {}

  const r = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function sonidoCorte() {
    if (!sound) return;
    try {
      ac ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const t0 = ac.currentTime;
      // Golpe suave de cuchillo en madera + chasquido ASMR
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(210 + (cuts % 14) * 18, t0);
      osc.frequency.exponentialRampToValueAtTime(75, t0 + 0.085);
      gain.gain.setValueAtTime(0.05, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.09);
    } catch (_) {}
  }

  function msg(t) {
    const n = $("note");
    if (!n) return;
    n.textContent = t;
    n.style.opacity = "1";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      n.style.opacity = "0";
    }, 520);
  }

  function cargarRecord() {
    fetch("/api/records/cortes")
      .then((res) => res.json())
      .then((d) => {
        const lista = Array.isArray(d) ? d : d.records || [];
        const max = Math.max(0, ...lista.map((v) => Number(v.puntos) || 0));
        bestRecord = Math.max(bestRecord, max);
        if ($("record")) $("record").textContent = bestRecord.toLocaleString();
      })
      .catch(() => {});
  }

  async function guardarRecord(forzarAviso = false) {
    if (cuts <= 0) return;
    if (!forzarAviso && cuts <= ultimoGuardado) return;
    ultimoGuardado = cuts;
    if (cuts > bestRecord) {
      bestRecord = cuts;
      if ($("record")) $("record").textContent = bestRecord.toLocaleString();
    }
    try {
      await fetch("/api/records/cortes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: name || "Jugador", puntos: cuts }),
      });
      if (forzarAviso) msg(`💾 RÉCORD GUARDADO: ${cuts.toLocaleString()}`);
    } catch (_) {}
  }

  function radioActual() {
    const p = clamp(cuts / META, 0, 1);
    return 192 * (1 - p * 0.36);
  }

  function estadoLima() {
    if (cuts < 50) return "ENTERA";
    if (cuts < 300) return "RAYADA";
    if (cuts < 1200) return "RODAJAS";
    if (cuts < 4000) return "JULIANA";
    if (cuts < 10000) return "CUBOS FINOS";
    if (cuts < 20000) return "PICADA FINA";
    return "PARTÍCULAS";
  }

  function estamparCortePermanente(angulo, desp, rad) {
    xc.save();
    xc.translate(C, CY);
    xc.rotate(angulo);
    // Sombra de la hendidura
    xc.strokeStyle =
      cuts < 2000
        ? "rgba(22, 52, 18, 0.58)"
        : "rgba(32, 70, 22, 0.45)";
    xc.lineWidth = cuts < 1500 ? r(1.6, 2.8) : r(1.1, 2.0);
    xc.beginPath();
    const cuerda = Math.sqrt(Math.max(16, rad * rad - desp * desp)) * 0.94;
    xc.moveTo(-cuerda, desp);
    xc.lineTo(cuerda, desp);
    xc.stroke();

    // Brillo húmedo de pulpa de lima junto al corte
    xc.strokeStyle = "rgba(228, 255, 160, 0.35)";
    xc.lineWidth = 1;
    xc.beginPath();
    xc.moveTo(-cuerda * 0.9, desp + 1.4);
    xc.lineTo(cuerda * 0.9, desp + 1.4);
    xc.stroke();
    xc.restore();
  }

  function cut(px, py, anguloForzado) {
    if (!active) return;
    cuts++;
    const rad = radioActual();
    const a =
      anguloForzado != null
        ? anguloForzado
        : px != null && py != null
          ? Math.atan2(py - CY, px - C) + Math.PI / 2 + r(-0.28, 0.28)
          : r(0, Math.PI * 2);
    const desp = r(-rad * 0.65, rad * 0.65);

    estamparCortePermanente(a, desp, rad);
    recienCortes.push({ a, desp, w: r(1.6, 2.8), life: 0.28, rad });

    for (let i = 0; i < 8; i++) {
      const d = r(-rad * 0.75, rad * 0.75);
      const sx = C + Math.cos(a) * d - Math.sin(a) * desp;
      const sy = CY + Math.sin(a) * d + Math.cos(a) * desp;
      chips.push({
        x: sx,
        y: sy,
        vx: r(-155, 155),
        vy: r(-175, 85),
        tam: r(3, 6.2),
        color: Math.random() > 0.3 ? "#d8ff90" : "#7ccf44",
        life: r(0.32, 0.75),
      });
    }

    if (gotasJugo.length < 70 && Math.random() < 0.45) {
      gotasJugo.push({
        x: C + r(-rad * 1.15, rad * 1.15),
        y: CY + r(-rad * 1.05, rad * 1.15),
        r: r(2.5, 6.5),
      });
    }

    knife = { t: 0.16, a, offset: desp };
    sonidoCorte();

    if (cuts === 1 || cuts % 25 === 0) {
      msg(`${cuts.toLocaleString()} CORTES`);
      guardarRecord(false);
    }
    if (cuts >= META) {
      finish();
    }
  }

  function draw(ms) {
    requestAnimationFrame(draw);
    const dt = Math.min(0.04, (ms - (last || ms)) / 1000);
    last = ms;

    // 1. Tabla de madera cálida de cocina ASMR
    const g = x.createRadialGradient(C, CY, 30, C, C, 560);
    g.addColorStop(0, "#754c30");
    g.addColorStop(0.55, "#3a2316");
    g.addColorStop(1, "#120b08");
    x.fillStyle = g;
    x.fillRect(0, 0, W, W);

    // Vetas de la tabla de madera
    x.strokeStyle = "rgba(255, 215, 170, 0.045)";
    x.lineWidth = 2;
    for (let y = 40; y < W; y += 36) {
      x.beginPath();
      x.moveTo(0, y);
      x.bezierCurveTo(220, y + 8, 500, y - 8, W, y + 3);
      x.stroke();
    }

    // Borde inferior de la mesa de madera
    const gMesa = x.createLinearGradient(0, 565, 0, W);
    gMesa.addColorStop(0, "#9c6c44");
    gMesa.addColorStop(0.18, "#6f492b");
    gMesa.addColorStop(1, "#2a190f");
    x.fillStyle = gMesa;
    x.fillRect(0, 565, W, W - 565);

    // Gotas de jugo de lima sobre la tabla
    x.fillStyle = "rgba(195, 255, 110, 0.22)";
    for (const gota of gotasJugo) {
      x.beginPath();
      x.arc(gota.x, gota.y, gota.r, 0, Math.PI * 2);
      x.fill();
    }

    const rad = radioActual();

    // Sombra proyectada de la lima
    x.fillStyle = "rgba(0, 0, 0, 0.42)";
    x.beginPath();
    x.ellipse(C + 10, CY + 24, rad * 1.02, rad * 0.92, 0, 0, Math.PI * 2);
    x.fill();

    // 2. Cuerpo esférico 3D de la lima + máscara de cortes permanentes
    x.save();
    x.beginPath();
    x.arc(C, CY, rad, 0, Math.PI * 2);
    x.clip();

    const lg = x.createRadialGradient(
      C - rad * 0.34,
      CY - rad * 0.38,
      6,
      C,
      CY,
      rad,
    );
    lg.addColorStop(0, "#efffb5");
    lg.addColorStop(0.32, "#9be158");
    lg.addColorStop(0.75, "#42892f");
    lg.addColorStop(1, "#1b441b");
    x.fillStyle = lg;
    x.fillRect(C - rad, CY - rad, rad * 2, rad * 2);

    // Poros cítricos sutiles
    x.fillStyle = "rgba(255, 255, 210, 0.12)";
    for (let i = 0; i < 28; i++) {
      const ang = i * 2.39996;
      const dist = Math.sqrt(i / 28) * rad * 0.85;
      x.beginPath();
      x.arc(
        C + Math.cos(ang) * dist,
        CY + Math.sin(ang) * dist,
        2.2,
        0,
        Math.PI * 2,
      );
      x.fill();
    }

    // Dibujar todos los cortes permanentes acumulados en la lima
    x.drawImage(capaCortes, 0, 0);

    // Destello de los cortes recién hechos
    for (const m of recienCortes) {
      m.life -= dt;
      x.save();
      x.translate(C, CY);
      x.rotate(m.a);
      x.globalAlpha = clamp(m.life / 0.28, 0, 1);
      x.strokeStyle = "#f4ffd1";
      x.lineWidth = m.w + 1.5;
      x.beginPath();
      x.moveTo(-m.rad, m.desp);
      x.lineTo(m.rad, m.desp);
      x.stroke();
      x.restore();
    }
    recienCortes = recienCortes.filter((m) => m.life > 0);
    x.restore();

    // 3. Navaja / Cuchillo de chef pasando exactamente por la línea de corte
    if (knife.t > 0) {
      knife.t -= dt;
      const prog = 1 - clamp(knife.t / 0.16, 0, 1);
      const avance = (prog - 0.5) * 180;
      x.save();
      x.translate(C, CY);
      x.rotate(knife.a);
      x.translate(avance, knife.offset);

      // Hoja de acero inoxidable con bisel brillante
      const gradHoja = x.createLinearGradient(0, -18, 0, 18);
      gradHoja.addColorStop(0, "#f8fafc");
      gradHoja.addColorStop(0.5, "#cbd5e1");
      gradHoja.addColorStop(1, "#64748b");
      x.fillStyle = gradHoja;
      x.beginPath();
      x.roundRect(-210, -14, 340, 28, 6);
      x.fill();

      // Mango ergonómico oscuro con remaches
      x.fillStyle = "#1e293b";
      x.beginPath();
      x.roundRect(125, -18, 115, 36, 10);
      x.fill();
      x.fillStyle = "#eab308";
      for (const rx of [148, 182, 214]) {
        x.beginPath();
        x.arc(rx, 0, 4, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    }

    // 4. Partículas y trocitos de lima saltando
    for (let i = chips.length - 1; i >= 0; i--) {
      const q = chips[i];
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 320 * dt;
      x.globalAlpha = clamp(q.life / 0.7, 0, 1);
      x.fillStyle = q.color;
      x.beginPath();
      x.arc(q.x, q.y, q.tam * 0.5, 0, Math.PI * 2);
      x.fill();
      if (q.life <= 0) chips.splice(i, 1);
    }
    x.globalAlpha = 1;

    if ($("cuts")) $("cuts").textContent = cuts.toLocaleString();
    if ($("rhythm")) $("rhythm").textContent = estadoLima();
  }

  async function finish() {
    active = false;
    await guardarRecord(false);
    if ($("endScore"))
      $("endScore").textContent = `${cuts.toLocaleString()} CORTES`;
    if ($("end")) $("end").showModal();
  }

  function reiniciarLima() {
    cuts = 0;
    ultimoGuardado = 0;
    recienCortes = [];
    chips = [];
    gotasJugo = [];
    xc.clearRect(0, 0, W, W);
  }

  function start() {
    name =
      (($("name") && $("name").value) || "").trim().slice(0, 14) || "Jugador";
    try {
      localStorage.setItem("nombreUsuario", name);
    } catch (_) {}
    reiniciarLima();
    active = true;
    if ($("intro") && $("intro").open) $("intro").close();
    msg("¡CORTA LA LIMA!");
  }

  function coordCanvas(e) {
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * W,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * W,
    };
  }

  if ($("intro") && $("intro").showModal) $("intro").showModal();

  c.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    arrastrando = true;
    const p = coordCanvas(e);
    ultDrag = { x: p.x, y: p.y, ms: performance.now() };
    cut(p.x, p.y);
  });

  c.addEventListener("pointermove", (e) => {
    if (!arrastrando || !active) return;
    const ahora = performance.now();
    const p = coordCanvas(e);
    const dx = p.x - ultDrag.x;
    const dy = p.y - ultDrag.y;
    if (Math.hypot(dx, dy) > 28 && ahora - ultDrag.ms > 32) {
      const ang = Math.atan2(dy, dx);
      ultDrag = { x: p.x, y: p.y, ms: ahora };
      cut(p.x, p.y, ang);
    }
  });

  window.addEventListener("pointerup", () => {
    arrastrando = false;
  });

  if ($("start")) $("start").onclick = start;
  if ($("again")) {
    $("again").onclick = () => {
      if ($("end") && $("end").open) $("end").close();
      reiniciarLima();
      active = true;
    };
  }
  if ($("saveBtn")) {
    $("saveBtn").onclick = () => guardarRecord(true);
  }
  if ($("sound")) {
    $("sound").onclick = () => {
      sound = !sound;
      $("sound").textContent = sound ? "♫" : "×";
    };
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") guardarRecord(false);
  });

  cargarRecord();
  requestAnimationFrame(draw);
})();
