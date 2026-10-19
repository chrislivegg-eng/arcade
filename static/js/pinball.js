(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    F = PinballFisica,
    canvas = $("pinball"),
    ctx = canvas.getContext("2d");
  const fondo = document.createElement("canvas");
  fondo.width = 1080;
  fondo.height = 1800;
  const g = fondo.getContext("2d");
  g.scale(2, 2);
  const teclas = new Set(),
    dedos = new Map();
  let activa = false,
    pausada = false,
    contexto = null,
    nombre = "Jugador",
    visita = 0;
  let sonido = true,
    audio = null,
    ultima = 0,
    noticeHasta = 0,
    record = 0,
    giro = 0;
  const particulas = [],
    estela = [],
    pulsos = [];
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  try {
    sonido = localStorage.getItem("pinball_sonido") !== "0";
    $("nombre").value = localStorage.getItem("nombreUsuario") || "";
  } catch (_) {}
  const numero = (n) => Math.round(n).toLocaleString("es-MX");
  function redondo(c, x, y, w, h, r, fill, stroke) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.stroke();
    }
  }
  function linea(c, a, color, w) {
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(a[2], a[3]);
    c.strokeStyle = color;
    c.lineWidth = w;
    c.lineCap = "round";
    c.stroke();
  }
  function circulo(c, x, y, r, fill, stroke) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.stroke();
    }
  }
  function letras(c, t, x, y, size, color = "#dff8f4") {
    c.fillStyle = color;
    c.font = `800 ${size}px system-ui`;
    c.textAlign = "center";
    c.fillText(t, x, y);
  }
  function pintarFondo() {
    const grad = g.createLinearGradient(0, 0, 540, 900);
    grad.addColorStop(0, "#263b4c");
    grad.addColorStop(0.3, "#101a2a");
    grad.addColorStop(1, "#36494f");
    redondo(g, 0, 0, 540, 900, 23, grad);
    redondo(g, 10, 10, 520, 880, 18, "#0a1327", "#d5b367");
    const cosmos = g.createRadialGradient(265, 320, 15, 265, 350, 540);
    cosmos.addColorStop(0, "#234a60");
    cosmos.addColorStop(0.5, "#102439");
    cosmos.addColorStop(1, "#080d21");
    redondo(g, 23, 24, 495, 852, 15, cosmos);
    for (let i = 0; i < 95; i++) {
      const x = 36 + ((i * 137.3) % 468),
        y = 45 + ((i * 91.7) % 795);
      circulo(g, x, y, i % 7 === 0 ? 1.5 : 0.7, i % 3 ? "#587f92" : "#b5d8d0");
    }
    g.save();
    g.strokeStyle = "#6df4d91b";
    g.lineWidth = 1;
    for (let r = 150; r < 410; r += 55) {
      g.beginPath();
      g.ellipse(265, 355, r * 0.68, r, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    g.lineWidth = 1;
    redondo(g, 482, 175, 36, 690, 14, "#071221", "#5e8992");
    for (let i = 0; i < 23; i++)
      linea(g, [490, 660 + i * 8, 511, 664 + i * 8], "#5b7483", 2);
    F.walls.forEach((s, i) => {
      if (i >= 14) return;
      linea(g, s, "#0008", 14);
      linea(g, [s[0] + 1, s[1] - 2, s[2] + 1, s[3] - 2], "#697b88", 10);
      linea(g, s, "#c4d9dd", 5);
      linea(g, [s[0], s[1] - 2, s[2], s[3] - 2], "#edfcff", 1.5);
    });
    for (const mirror of [false, true]) {
      g.save();
      if (mirror) {
        g.translate(535, 0);
        g.scale(-1, 1);
      }
      g.beginPath();
      g.moveTo(105, 630);
      g.lineTo(178, 718);
      g.lineTo(105, 700);
      g.closePath();
      g.fillStyle = "#f05aa521";
      g.fill();
      g.strokeStyle = "#e494c4";
      g.lineWidth = 4;
      g.stroke();
      for (let i = 0; i < 4; i++)
        linea(g, [115, 657 + i * 10, 132 + i * 6, 679 + i * 9], "#d55f983b", 2);
      g.restore();
    }
    letras(g, "N O V A", 265, 550, 35, "#8ec7cd");
    letras(g, "O R B I T A L   P I N B A L L", 265, 574, 10, "#d2b477");
    g.strokeStyle = "#ceb47955";
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(265, 543, 145, 43, -0.12, 0, Math.PI * 2);
    g.stroke();
    letras(g, "CHRIS ARCADE", 265, 863, 11, "#6a8e9f");
    letras(g, "LANZADOR", 499, 630, 7, "#88b8b7");
    for (const [x, y] of [
      [16, 22],
      [524, 22],
      [16, 875],
      [524, 875],
    ]) {
      circulo(g, x, y, 4, "#a3adb2");
      linea(g, [x - 2, y + 2, x + 2, y - 2], "#293846", 1);
    }
  }
  function tono(tipo) {
    if (!sonido || !audio || audio.state !== "running") return;
    const o = audio.createOscillator(),
      v = audio.createGain(),
      t = audio.currentTime;
    const freq =
      {
        bumper: 680,
        objetivo: 980,
        pasillo: 520,
        jackpot: 1320,
        flipper: 130,
        lanzar: 180,
        perdida: 90,
        sling: 280,
        spinner: 850,
        multiplicador: 1100,
        salvada: 650,
      }[tipo] || 330;
    o.type = tipo === "flipper" ? "triangle" : "sine";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq * 0.45),
      t + 0.13,
    );
    v.gain.setValueAtTime(0.0001, t);
    v.gain.linearRampToValueAtTime(0.085, t + 0.004);
    v.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(v);
    v.connect(audio.destination);
    o.start(t);
    o.stop(t + 0.18);
    o.onended = () => {
      o.disconnect();
      v.disconnect();
    };
  }
  function audioListo() {
    if (!audio) {
      const A = window.AudioContext || window.webkitAudioContext;
      if (A) audio = new A();
    }
    if (audio?.state === "suspended") audio.resume().catch(() => {});
  }
  function aviso(t, seg = 2.2) {
    $("aviso").textContent = t;
    noticeHasta = performance.now() + seg * 1000;
  }
  function evento(tipo, data) {
    tono(tipo);
    if (data && typeof data === "object") {
      pulsos.push({ x: data.x, y: data.y, vida: 0.5, t: tipo, p: data.p });
      if (pulsos.length > 24) pulsos.shift();
      if (!reducido)
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5;
          particulas.push({
            x: data.x,
            y: data.y,
            vx: Math.cos(a) * (45 + i * 8),
            vy: Math.sin(a) * 90,
            vida: 0.5,
          });
        }
      if (particulas.length > 100)
        particulas.splice(0, particulas.length - 100);
    }
    if (tipo === "spinner") giro += 2;
    if (tipo === "lanzar") aviso("¡A por el récord!");
    if (tipo === "corta")
      aviso("Dale más fuerza: mantén LANZAR un poco más", 4);
    if (tipo === "salvada") aviso("BOLA SALVADA · ¡Sigue jugando!", 3);
    if (tipo === "multiplicador")
      aviso(`BONUS ×${data} · Pasillos completos`, 3);
    if (tipo === "jackpot") aviso(`¡NOVA COMPLETA! +${numero(data.p)}`, 3);
    if (tipo === "perdida")
      aviso(`BONUS +${numero(data)} · Prepara tu siguiente bola`, 3);
    if (tipo === "final") terminar(true);
  }
  const mesa = new F.Mesa(evento);
  function render(dt = 0) {
    ctx.clearRect(0, 0, 540, 900);
    ctx.drawImage(fondo, 0, 0, 540, 900);
    F.lanes.forEach((c, i) => {
      const on = mesa.pasillos[i];
      ctx.lineWidth = 2;
      redondo(
        ctx,
        c.x - 21,
        c.y - 35,
        42,
        63,
        20,
        on ? "#56dfc633" : "#0c2030",
        on ? "#86ffe0" : "#496677",
      );
      letras(ctx, String(i + 1), c.x, c.y + 3, 19, on ? "#98ffe4" : "#698e9b");
      linea(ctx, [c.x - 27, 90, c.x - 27, 146], "#d5c38e", 4);
    });
    F.bumpers.forEach((c, i) => {
      const hot = (mesa.cooldowns["b" + i] || 0) > mesa.tiempo;
      ctx.save();
      ctx.shadowColor = hot ? "#a1ffdc" : "#41c9c8";
      ctx.shadowBlur = hot ? 30 : 10;
      circulo(ctx, c.x, c.y + 6, c.r + 8, "#0009");
      circulo(ctx, c.x, c.y, c.r + 5, "#d9c08e");
      const cap = ctx.createRadialGradient(
        c.x - 11,
        c.y - 14,
        1,
        c.x,
        c.y,
        c.r,
      );
      cap.addColorStop(0, hot ? "#ffffff" : "#c3fff0");
      cap.addColorStop(0.4, hot ? "#b1ffe9" : "#48c7c1");
      cap.addColorStop(1, "#125568");
      circulo(ctx, c.x, c.y, c.r, cap, "#e5ffef");
      circulo(ctx, c.x, c.y, c.r - 7, null, "#163f5799");
      letras(ctx, "100", c.x, c.y + 6, 15, "#0d394b");
      ctx.restore();
    });
    F.targets.forEach((c, i) => {
      ctx.save();
      ctx.shadowColor = "#fbbd67";
      ctx.shadowBlur = mesa.objetivos[i] ? 18 : 0;
      redondo(
        ctx,
        c.x - 15,
        c.y - 24,
        27,
        48,
        8,
        mesa.objetivos[i] ? "#f9c56c" : "#244055",
        "#e2bd79",
      );
      letras(
        ctx,
        "NOVA"[i],
        c.x - 1,
        c.y + 7,
        20,
        mesa.objetivos[i] ? "#253043" : "#d3b678",
      );
      ctx.restore();
    });
    giro += dt * 1.2;
    ctx.save();
    ctx.translate(265, 480);
    ctx.rotate(giro);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#c9ad6f";
    ctx.beginPath();
    ctx.ellipse(0, 0, 41, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 41, 16, Math.PI / 2, 0, Math.PI * 2);
    ctx.stroke();
    circulo(ctx, 0, 0, 8, "#b1f7de");
    ctx.restore();
    mesa.flippers.forEach((f, i) => {
      const x = f.x + 90 * Math.cos(f.a),
        y = f.y + 90 * Math.sin(f.a);
      linea(ctx, [f.x, f.y + 7, x, y + 7], "#0008", 28);
      const metal = ctx.createLinearGradient(f.x, f.y - 14, f.x, f.y + 14);
      metal.addColorStop(0, "#fff5ca");
      metal.addColorStop(0.25, "#f0cb78");
      metal.addColorStop(0.65, "#b77536");
      metal.addColorStop(1, "#f9dda0");
      linea(ctx, [f.x, f.y, x, y], metal, 25);
      linea(ctx, [f.x, f.y - 5, x, y - 5], "#ffeed4", 3);
      circulo(ctx, f.x, f.y, 9, "#38475a", "#f1dcac");
      circulo(ctx, f.x, f.y, 3, "#91b4bb");
    });
    if (mesa.fase === "lista") {
      const y = 853 + mesa.carga * 13;
      redondo(ctx, 486, y, 28, 12, 4, "#d4b473");
      redondo(ctx, 494, 720, 11, 90, 5, "#1e3a4a");
      if (mesa.carga > 0)
        redondo(
          ctx,
          494,
          810 - 90 * mesa.carga,
          11,
          90 * mesa.carga,
          4,
          "#a2ffda",
        );
    }
    const b = mesa.bola;
    if (!reducido && mesa.fase === "jugando") {
      estela.push({ x: b.x, y: b.y });
      if (estela.length > 8) estela.shift();
    } else estela.length = 0;
    estela.forEach((p, i) =>
      circulo(ctx, p.x, p.y, 3 + i * 0.45, `rgba(151,241,234,${i * 0.025})`),
    );
    circulo(ctx, b.x + 4, b.y + 7, 10, "#0009");
    const chrome = ctx.createRadialGradient(b.x - 3, b.y - 4, 1, b.x, b.y, 10);
    chrome.addColorStop(0, "#fff");
    chrome.addColorStop(0.22, "#e4f7ff");
    chrome.addColorStop(0.5, "#98c0d0");
    chrome.addColorStop(0.65, "#253f55");
    chrome.addColorStop(1, "#c9edf5");
    circulo(ctx, b.x, b.y, 9, chrome);
    circulo(ctx, b.x - 3, b.y - 4, 2, "#fff");
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vida <= 0) {
        particulas.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.vida * 1.5;
      circulo(ctx, p.x, p.y, 2, "#f8db94");
    }
    ctx.globalAlpha = 1;
    for (let i = pulsos.length - 1; i >= 0; i--) {
      const p = pulsos[i];
      p.vida -= dt;
      if (p.vida <= 0) {
        pulsos.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = p.vida * 2;
      ctx.lineWidth = 2;
      circulo(ctx, p.x, p.y, 35 + (1 - p.vida) * 25, null, "#8bffe6");
      letras(ctx, "+" + p.p, p.x, p.y - 40 - (0.5 - p.vida) * 35, 14);
    }
    ctx.globalAlpha = 1;
  }
  function resize() {
    const r = $("tablero").getBoundingClientRect(),
      scale = Math.max(0.1, Math.min(r.width / 540, r.height / 900)),
      dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.style.width = 540 * scale + "px";
    canvas.style.height = 900 * scale + "px";
    canvas.width = Math.round(540 * scale * dpr);
    canvas.height = Math.round(900 * scale * dpr);
    ctx.setTransform(canvas.width / 540, 0, 0, canvas.height / 900, 0, 0);
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe($("tablero"));
  function entrada() {
    const vals = [...dedos.values()];
    return {
      izq:
        teclas.has("ArrowLeft") || teclas.has("KeyA") || vals.includes("izq"),
      der:
        teclas.has("ArrowRight") || teclas.has("KeyD") || vals.includes("der"),
      cargar:
        teclas.has("ArrowDown") ||
        teclas.has("Space") ||
        vals.includes("cargar"),
    };
  }
  function soltar() {
    teclas.clear();
    dedos.clear();
    mesa.carga = 0;
    for (const id of ["izquierda", "derecha", "lanzar"])
      $(id).classList.remove("activo");
  }
  function hud() {
    const i = entrada();
    $("puntos").textContent = numero(mesa.puntos);
    $("vidas").textContent = `${mesa.bolaNumero} / 3`;
    $("multi").textContent = "×" + mesa.multiplicador;
    $("record").textContent = numero(Math.max(record, mesa.puntos));
    $("izquierda").classList.toggle("activo", i.izq);
    $("derecha").classList.toggle("activo", i.der);
    $("lanzar").classList.toggle("activo", i.cargar);
    if (performance.now() > noticeHasta)
      $("aviso").textContent =
        mesa.fase === "lista"
          ? "Mantén LANZAR y suelta · ← → para las palancas"
          : "Pasillos: multiplicador · NOVA: jackpot";
  }
  function frame(t) {
    const dt = ultima ? Math.min(0.05, (t - ultima) / 1000) : 0;
    ultima = t;
    if (activa && !pausada && !document.hidden) {
      mesa.avanzar(dt, entrada());
      render(dt);
      hud();
    }
    requestAnimationFrame(frame);
  }
  function empezar() {
    visita++;
    soltar();
    mesa.nueva();
    particulas.length = estela.length = pulsos.length = 0;
    nombre =
      $("nombre").value.trim().slice(0, 14) ||
      window.Perfil?.datos?.nombre ||
      "Jugador";
    try {
      localStorage.setItem("nombreUsuario", nombre);
    } catch (_) {}
    contexto = window.Perfil?.iniciar("pinball", { modo: "solo" });
    activa = true;
    pausada = false;
    ultima = 0;
    for (const id of ["menu", "final", "pausado"])
      if ($(id).open) $(id).close();
    audioListo();
    aviso("Mantén LANZAR y suelta · ¡Buena suerte!", 3);
    hud();
    render();
  }
  function pausar() {
    if (!activa || pausada) return;
    pausada = true;
    soltar();
    $("pausado").showModal();
  }
  function continuar() {
    if (!activa) return;
    pausada = false;
    ultima = 0;
    $("pausado").close();
    audioListo();
  }
  async function terminar(completa) {
    if (!activa) return;
    activa = false;
    pausada = false;
    soltar();
    if ($("pausado").open) $("pausado").close();
    const id = visita,
      puntos = mesa.puntos;
    $("resultado").textContent = numero(puntos);
    $("guardado").textContent = completa
      ? "Guardando puntuación…"
      : "Partida terminada antes de gastar las tres bolas. No se guardó el resultado.";
    $("final").showModal();
    if (!completa) return;
    record = Math.max(record, puntos);
    try {
      localStorage.setItem("pinball_record", String(record));
    } catch (_) {}
    const r = await Promise.allSettled([
      window.Perfil?.evento("pinball", "fin", { gano: false }, contexto),
      fetch("/api/records/pinball", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, puntos }),
      }).then((r) => {
        if (!r.ok) throw new Error("No guardado");
      }),
    ]);
    if (id === visita)
      $("guardado").textContent = r.every((x) => x.status === "fulfilled")
        ? "Puntuación guardada. ¿Una más?"
        : "Tu puntuación quedó en este dispositivo; no se pudo confirmar el guardado online.";
  }
  function enganchar(el, tipo) {
    el.addEventListener("pointerdown", (e) => {
      if (!activa || pausada || e.button > 0) return;
      e.preventDefault();
      audioListo();
      el.setPointerCapture(e.pointerId);
      const t =
        tipo ||
        (mesa.fase === "lista"
          ? "cargar"
          : e.clientX <
              canvas.getBoundingClientRect().left +
                canvas.getBoundingClientRect().width / 2
            ? "izq"
            : "der");
      dedos.set(e.pointerId, t);
    });
    const liberar = (e, cancel) => {
      const antes = entrada().cargar;
      dedos.delete(e.pointerId);
      if (antes && !entrada().cargar && !cancel && activa && !pausada)
        mesa.lanzar();
      if (cancel && !entrada().cargar) mesa.carga = 0;
    };
    el.addEventListener("pointerup", (e) => liberar(e, false));
    el.addEventListener("pointercancel", (e) => liberar(e, true));
    el.addEventListener("lostpointercapture", (e) => liberar(e, true));
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  enganchar(canvas);
  enganchar($("izquierda"), "izq");
  enganchar($("derecha"), "der");
  enganchar($("lanzar"), "cargar");
  const controles = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "Space",
    "KeyA",
    "KeyD",
  ];
  document.addEventListener("keydown", (e) => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.code === "KeyP" || e.code === "Escape") && activa) {
      e.preventDefault();
      if (!e.repeat) (pausada ? continuar : pausar)();
      return;
    }
    if (!activa || pausada || !controles.includes(e.code)) return;
    e.preventDefault();
    audioListo();
    teclas.add(e.code);
  });
  document.addEventListener("keyup", (e) => {
    const antes = entrada().cargar;
    teclas.delete(e.code);
    if (antes && !entrada().cargar && activa && !pausada) mesa.lanzar();
  });
  $("pausado").addEventListener("cancel", (e) => {
    e.preventDefault();
    continuar();
  });
  for (const id of ["menu", "final"])
    $(id).addEventListener("cancel", (e) => e.preventDefault());
  window.addEventListener("blur", pausar);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pausar();
  });
  $("empezar").onclick = $("otra").onclick = empezar;
  $("pausa").onclick = () => (pausada ? continuar() : pausar());
  $("continuar").onclick = continuar;
  $("abandonar").onclick = () => terminar(false);
  function botonAudio() {
    $("sonido").setAttribute("aria-pressed", String(sonido));
    $("sonido").setAttribute(
      "aria-label",
      sonido ? "Silenciar efectos" : "Activar efectos",
    );
    $("sonido").textContent = sonido ? "♫" : "♪";
  }
  $("sonido").onclick = () => {
    sonido = !sonido;
    audioListo();
    try {
      localStorage.setItem("pinball_sonido", sonido ? "1" : "0");
    } catch (_) {}
    botonAudio();
  };
  $("pantalla").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else aviso("Gira tu dispositivo para ajustar la mesa", 3);
    } catch (_) {
      aviso("Pantalla completa no disponible", 3);
    }
  };
  let editado = false;
  $("nombre").addEventListener("input", () => {
    editado = true;
  });
  window.Perfil?.cargar()
    .then((p) => {
      if (!editado && p?.nombre) $("nombre").value = p.nombre;
    })
    .catch(() => {});
  try {
    record = Math.max(0, Number(localStorage.getItem("pinball_record")) || 0);
  } catch (_) {}
  fetch("/api/records/pinball")
    .then((r) => (r.ok ? r.json() : []))
    .then((rs) => {
      if (rs[0]) record = Math.max(record, rs[0].puntos);
      hud();
    })
    .catch(() => {});
  pintarFondo();
  resize();
  botonAudio();
  hud();
  $("menu").showModal();
  requestAnimationFrame(frame);
  window.Pinball = {
    mesa,
    get activa() {
      return activa;
    },
    get pausada() {
      return pausada;
    },
  };
})();
