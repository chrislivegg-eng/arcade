(() => {
  "use strict";
  let intervalo = 5,
    modo = "llena",
    rondaVista = "",
    ultimaCantada = "",
    tablaVisible = 0;
  let marcadas = [new Set(), new Set(), new Set()],
    sonido = true,
    epocaAudio = 0,
    temporizador = null;
  let colaPreferencias = Promise.resolve(),
    preferenciasLocales = null,
    salaVista = "";
  const audio = new Audio();
  audio.preload = "none";
  const esc = Fiesta.esc,
    $ = (id) => document.getElementById(id);
  try {
    sonido = localStorage.getItem("loteria_sonido") !== "0";
  } catch (_) {}
  function detener() {
    epocaAudio++;
    clearTimeout(temporizador);
    audio.pause();
    audio.onended = null;
    try {
      speechSynthesis.cancel();
    } catch (_) {}
  }
  function hablar(frase) {
    if (!sonido || document.hidden) return;
    try {
      const u = new SpeechSynthesisUtterance(frase);
      u.lang = "es-MX";
      u.rate = 1.13;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (_) {}
  }
  function cantar(e) {
    detener();
    if (!sonido || document.hidden || e.actual == null) return;
    const frase = e.verso + ". " + e.cartas[e.actual][0],
      archivo = e.audios?.[e.actual];
    if (!archivo) {
      hablar(frase);
      return;
    }
    const epoca = epocaAudio;
    const terminar = () => {
      if (epocaAudio !== epoca) return;
      clearTimeout(temporizador);
      audio.pause();
      audio.onended = null;
      hablar(frase);
    };
    audio.src = archivo;
    audio.currentTime = 0;
    audio.volume = 0.65;
    audio.onended = terminar;
    audio
      .play()
      .then(() => {
        if (epocaAudio !== epoca) return;
        temporizador = setTimeout(
          terminar,
          Math.min(6500, Math.max(900, (e.intervalo - 1.6) * 1000)),
        );
      })
      .catch(() => {
        if (epocaAudio === epoca) hablar(frase);
      });
  }
  // La primera reproducción bajo un gesto habilita el mismo elemento en móvil.
  document.addEventListener(
    "pointerdown",
    () => {
      if (!sonido || audio.src) return;
      const b = new ArrayBuffer(124),
        d = new DataView(b);
      const tag = (p, s) =>
        [...s].forEach((c, i) => d.setUint8(p + i, c.charCodeAt(0)));
      tag(0, "RIFF");
      d.setUint32(4, 116, true);
      tag(8, "WAVE");
      tag(12, "fmt ");
      d.setUint32(16, 16, true);
      d.setUint16(20, 1, true);
      d.setUint16(22, 1, true);
      d.setUint32(24, 8000, true);
      d.setUint32(28, 16000, true);
      d.setUint16(32, 2, true);
      d.setUint16(34, 16, true);
      tag(36, "data");
      d.setUint32(40, 80, true);
      const url = URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
      audio.src = url;
      audio
        .play()
        .catch(() => {})
        .finally(() => URL.revokeObjectURL(url));
    },
    { once: true },
  );
  function dibujo(c, C) {
    return c === 15
      ? '<img class="lot-bandera" src="/static/img/bandera-mexico.svg" alt="Bandera de México">'
      : esc(C[c][1]);
  }
  function preferencias() {
    return (
      preferenciasLocales ||
      Fiesta.estado?.preferencias || {
        cantidad: 1,
        colores: ["rosa", "azul", "verde"],
      }
    );
  }
  function configuracion(e) {
    const p = preferencias();
    return `<div class="tarjeta pila lot-ajustes"><h2>🎴 Mis tablas</h2><p class="nota">Elige cuántas quieres jugar. Cada tabla tiene 16 cartas y puede ganar por separado.</p>
      <div class="lot-chips">${[1, 2, 3].map((n) => `<button class="lot-chip ${p.cantidad === n ? "activo" : ""}" data-cantidad="${n}" onclick="LoteriaUI.cantidad(${n})">${n} ${n === 1 ? "tabla" : "tablas"}</button>`).join("")}</div>
      <div class="lot-colores">${Array.from(
        { length: p.cantidad },
        (_, i) =>
          `<label class="lot-color-fila">Color de mi tabla ${i + 1}<select aria-label="Color de mi tabla ${i + 1}" onchange="LoteriaUI.color(${i},this.value)">${Object.keys(
            e.colores_disponibles,
          )
            .map(
              (c) =>
                `<option value="${c}" ${p.colores[i] === c ? "selected" : ""}>${c[0].toUpperCase() + c.slice(1)}</option>`,
            )
            .join("")}</select></label>`,
      ).join("")}</div>
      <p class="lot-resumen">${e.jugadores.map((j) => `${esc(j.nombre)}: ${e.tablas_por_jugador[j.id] || 1} tabla(s)`).join(" · ")}</p></div>`;
  }
  function configurar(cantidad, colores) {
    const opciones = { cantidad, colores: [...colores] },
      sala = $("codigo-sala").textContent;
    preferenciasLocales = opciones;
    colaPreferencias = colaPreferencias
      .then(() =>
        sala === $("codigo-sala").textContent
          ? Fiesta.accion("configurar_tablas", opciones)
          : null,
      )
      .then((r) => {
        if (!r && preferenciasLocales === opciones) preferenciasLocales = null;
        return r;
      });
    return colaPreferencias;
  }
  function controlesAudio() {
    return `<div class="lot-audio"><button aria-pressed="${sonido}" onclick="LoteriaUI.sonido()">${sonido ? "🔊 Gritón activado" : "🔇 Activar gritón"}</button><button onclick="LoteriaUI.repetir()">↻ Repetir carta</button></div>`;
  }
  function guardarMarcas() {
    try {
      sessionStorage.setItem(
        "loteria_marcas",
        JSON.stringify({
          ronda: rondaVista,
          marcas: marcadas.map((s) => [...s]),
        }),
      );
    } catch (_) {}
  }
  function celda(c, t, e, ganadora = false) {
    const llamada = e.cantadas.includes(c),
      marcada = ganadora ? llamada : marcadas[t].has(c),
      actual = e.actual === c && e.fase === "jugando";
    const contenido = `<span class="lot-numero">${c + 1}</span><span class="lot-e">${dibujo(c, e.cartas)}</span><span class="lot-nombre">${esc(e.cartas[c][0])}</span><span class="lot-chiste">${esc(e.versos[c])}</span>`;
    const clases = `lot-celda ${llamada ? "salio" : ""} ${marcada ? "marcada" : ""} ${actual ? "actual" : ""}`;
    return ganadora
      ? `<div class="${clases}">${contenido}</div>`
      : `<button class="${clases}" data-tabla="${t}" data-carta="${c}" aria-pressed="${marcada}" aria-label="${esc(e.cartas[c][0])}, tabla ${t + 1}${llamada ? ", ya salió" : ""}. ${esc(e.versos[c])}" title="${esc(e.versos[c])}" onclick="LoteriaUI.marcar(${t},${c})">${contenido}</button>`;
  }
  function tablero(tabla, i, e, ganadora = false) {
    const nombreColor = ganadora ? e.color_ganadora : e.mis_colores[i],
      color = e.colores_disponibles[nombreColor] || "#d95386";
    const cantidad = tabla.filter((c) => e.cantadas.includes(c)).length;
    return `<section class="lot-tablero ${tablaVisible === i ? "visible" : ""}" style="--lot-color:${color}"><header><span>🎴 Tabla ${ganadora ? e.numero_tabla_ganadora : i + 1}</span><small>${cantidad} de 16 cantadas</small></header><div class="lot-rejilla">${tabla.map((c) => celda(c, i, e, ganadora)).join("")}</div></section>`;
  }
  function pintar(e, zona) {
    if (!e) return;
    const codigo = $("codigo-sala").textContent;
    if (salaVista !== codigo) {
      salaVista = codigo;
      preferenciasLocales = null;
    }
    if (
      preferenciasLocales &&
      JSON.stringify(preferenciasLocales) === JSON.stringify(e.preferencias)
    )
      preferenciasLocales = null;
    document.body.classList.toggle(
      "lot-multiple",
      (e.mis_tablas?.length || 0) > 1,
    );
    if (e.fase === "lobby") {
      if (ultimaCantada) {
        detener();
        ultimaCantada = "";
      }
      zona.innerHTML =
        configuracion(e) +
        controlesAudio() +
        (e.soy_host
          ? `<div class="tarjeta pila lot-ajustes"><h2>⏱️ Velocidad del gritón</h2><div class="lot-chips">${[3, 5, 8].map((n) => `<button class="lot-chip ${intervalo === n ? "activo" : ""}" onclick="LoteriaUI.elegir('intervalo',${n})">${n} s</button>`).join("")}</div><h2>🏆 Para ganar</h2><div class="lot-chips"><button class="lot-chip ${modo === "llena" ? "activo" : ""}" onclick="LoteriaUI.elegir('modo','llena')">Tabla llena</button><button class="lot-chip ${modo === "linea" ? "activo" : ""}" onclick="LoteriaUI.elegir('modo','linea')">Línea o 4 esquinas</button></div><button class="boton morado" onclick="Fiesta.accion('agregar_bot')">➕🤖 Agregar bot</button><button class="boton verde" onclick="LoteriaUI.iniciar()">🎯 ¡Empezar a cantar!</button></div>`
          : `<div class="tarjeta centro"><p class="nota">Esperando a <b>${esc(Fiesta.nombreDe(e.host))}</b>… Puedes elegir tus tablas mientras tanto.</p></div>`);
      return;
    }
    const ronda = $("codigo-sala").textContent + ":" + e.ronda;
    if (ronda !== rondaVista) {
      detener();
      rondaVista = ronda;
      ultimaCantada = "";
      tablaVisible = 0;
      marcadas = [new Set(), new Set(), new Set()];
      try {
        const s = JSON.parse(sessionStorage.getItem("loteria_marcas"));
        if (s?.ronda === ronda && Array.isArray(s.marcas))
          marcadas = [0, 1, 2].map(
            (i) =>
              new Set(
                (Array.isArray(s.marcas[i]) ? s.marcas[i] : []).filter(
                  (c) => Number.isInteger(c) && c >= 0 && c < 54,
                ),
              ),
          );
      } catch (_) {}
    }
    let html = "";
    if (e.actual != null) {
      const [nom] = e.cartas[e.actual];
      html = `<div class="lot-cantada"><div class="lot-dibujo">${dibujo(e.actual, e.cartas)}</div><div><h2>${esc(nom)}</h2><p class="lot-verso">${esc(e.verso)}</p><span class="lot-contador">${e.cantadas.length} de ${e.cartas.length} cartas · ${e.modo_lot === "llena" ? "Tabla llena" : "Línea o 4 esquinas"}</span></div></div>`;
    } else
      html =
        '<div class="lot-cantada"><div class="lot-dibujo">🎴</div><h2>¡Prepárense! Corre y se va…</h2></div>';
    html += controlesAudio();
    if (e.fase === "jugando") {
      const tablas = e.mis_tablas || [];
      if (tablas.length > 1)
        html += `<div class="lot-pestanas">${tablas.map((t, i) => `<button class="${tablaVisible === i ? "activo" : ""} ${t.includes(e.actual) ? "coincide" : ""}" onclick="LoteriaUI.ver(${i})">Tabla ${i + 1}${t.includes(e.actual) ? " ✧" : ""}</button>`).join("")}</div><p class="lot-ayuda-movil">Toca una pestaña para cambiar de tabla.</p>`;
      html += `<div class="lot-tablas">${tablas.map((t, i) => tablero(t, i, e)).join("")}</div>`;
      if (tablas.length) {
        const castigado = Fiesta.segundosHasta(e.castigo) > 0;
        html += `<button class="boton lot-grito" id="lot-grito" ${castigado ? "disabled" : ""} onclick="Fiesta.accion('loteria')">${castigado ? "⏳ Espera tu castigo…" : "📣 ¡LOTERÍA!"}</button>`;
      } else
        html +=
          '<p class="tarjeta nota">La ronda ya había empezado. Podrás elegir tus tablas para la siguiente.</p>';
      html += `<div class="lot-historial">${e.cantadas
        .slice()
        .reverse()
        .slice(0, 12)
        .map(
          (c) =>
            `<span title="${esc(e.cartas[c][0])}">${dibujo(c, e.cartas)}</span>`,
        )
        .join("")}</div>`;
      if (ultimaCantada !== ronda + ":" + e.actual && e.actual != null) {
        ultimaCantada = ronda + ":" + e.actual;
        cantar(e);
      }
    } else if (e.fase === "resultado") {
      html =
        `<div class="tarjeta centro pila lot-resultado"><div class="grande">${e.ganador_ronda ? "🏆" : "🤷"}</div><h2>${e.ganador_ronda ? "¡" + esc(Fiesta.nombreDe(e.ganador_ronda)) + " gritó LOTERÍA!" : "Se acabaron las cartas"}</h2>${e.tabla_ganadora ? tablero(e.tabla_ganadora, 0, e, true) : ""}</div>` +
        configuracion(e) +
        (e.soy_host
          ? '<div class="lot-ajustes pila"><button class="boton verde" onclick="LoteriaUI.iniciar()">🔁 Otra ronda</button><button class="boton morado" onclick="Fiesta.accion(\'agregar_bot\')">➕🤖 Agregar bot</button></div>'
          : "") +
        Fiesta.ranking(e);
      if (ultimaCantada !== ronda + ":fin") {
        ultimaCantada = ronda + ":fin";
        detener();
        if (e.ganador_ronda)
          hablar("¡Lotería! ¡Que revisen esa tabla, que aquí nadie se escapa!");
      }
    }
    zona.innerHTML = html;
  }
  function repintar() {
    pintar(Fiesta.estado, $("zona-juego"));
  }
  window.LoteriaUI = {
    cantidad(n) {
      const p = preferencias();
      return configurar(n, p.colores);
    },
    color(i, c) {
      const p = preferencias(),
        colores = [...p.colores];
      colores[i] = c;
      return configurar(p.cantidad, colores);
    },
    elegir(tipo, v) {
      if (tipo === "intervalo") intervalo = v;
      else modo = v;
      repintar();
    },
    async iniciar() {
      await colaPreferencias;
      return Fiesta.accion("iniciar", { intervalo, modo });
    },
    marcar(t, c) {
      if (!Fiesta.estado?.mis_tablas?.[t]?.includes(c)) return;
      marcadas[t].has(c) ? marcadas[t].delete(c) : marcadas[t].add(c);
      guardarMarcas();
      repintar();
    },
    ver(t) {
      tablaVisible = t;
      repintar();
    },
    sonido() {
      sonido = !sonido;
      try {
        localStorage.setItem("loteria_sonido", sonido ? "1" : "0");
      } catch (_) {}
      detener();
      if (sonido) hablar("¡Corre y se va corriendo!");
      repintar();
    },
    repetir() {
      const e = Fiesta.estado;
      if (e?.actual != null && e.fase === "jugando") cantar(e);
    },
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) detener();
  });
  window.addEventListener("pagehide", detener);
  $("btn-salir").addEventListener("click", () => {
    detener();
    ultimaCantada = "";
  });
  setInterval(() => {
    const b = $("lot-grito"),
      e = Fiesta.estado;
    if (b && e?.fase === "jugando") {
      const segundos = Fiesta.segundosHasta(e.castigo);
      b.disabled = segundos > 0;
      b.textContent =
        segundos > 0 ? `⏳ Castigo: ${segundos} s` : "📣 ¡LOTERÍA!";
    }
  }, 500);
  Fiesta.iniciar({
    juego: "loteria",
    titulo: "Lotería 🇲🇽",
    pintar,
    intervalo: 800,
  });
})();
