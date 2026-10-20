// static/js/fiesta.js
// Código compartido de los juegos de fiesta: crear/unirse a sala, lista de
// jugadores, compartir el link y preguntarle al servidor cómo va el juego.
//
// Cada juego llama Fiesta.iniciar({ juego, pintar }) y pinta su parte en #zona-juego.

const Fiesta = (() => {
  const COLORES = [
    "#ff6b9d",
    "#6c5ce7",
    "#20bf6b",
    "#fa8231",
    "#3867d6",
    "#eb3b5a",
    "#8854d0",
    "#0fb9b1",
  ];
  let config = {};
  let codigo = "";
  let estado = null;
  let intervalo = null;
  let ultimaFirma = "";
  let desfaseReloj = 0; // diferencia entre el reloj del servidor y el del celular

  const $ = (id) => document.getElementById(id);

  function esc(texto) {
    const div = document.createElement("div");
    div.textContent = texto == null ? "" : String(texto);
    return div.innerHTML;
  }

  function miId() {
    let pid = null;
    try {
      pid = localStorage.getItem("fiesta_pid");
    } catch (e) {}
    if (!pid) {
      pid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        localStorage.setItem("fiesta_pid", pid);
      } catch (e) {}
    }
    return pid;
  }
  const PID = miId();

  function nombreGuardado() {
    try {
      return localStorage.getItem("nombreUsuario") || "";
    } catch (e) {
      return "";
    }
  }

  function colorDe(pid) {
    let suma = 0;
    for (const c of pid) suma += c.charCodeAt(0);
    return COLORES[suma % COLORES.length];
  }

  function nombreDe(pid) {
    const j = estado && estado.jugadores.find((x) => x.id === pid);
    return j ? j.nombre : "Alguien";
  }

  function mostrarError(texto) {
    const caja = $("error");
    caja.textContent = texto;
    caja.style.display = texto ? "block" : "none";
  }

  async function api(ruta, cuerpo) {
    const resp = await fetch(ruta, {
      method: cuerpo ? "POST" : "GET",
      headers: cuerpo ? { "Content-Type": "application/json" } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const datos = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(datos.error || "Algo salió mal");
    return datos;
  }

  function leerNombre() {
    const nombre = window.Perfil?.datos?.cuenta
      ? Perfil.datos.nombre
      : $("nombre").value.trim();
    if (!nombre) {
      mostrarError("Escribe tu nombre primero ✏️");
      $("nombre").focus();
      return null;
    }
    try {
      localStorage.setItem("nombreUsuario", nombre);
    } catch (e) {}
    return nombre;
  }

  async function crear() {
    const nombre = leerNombre();
    if (!nombre) return;
    try {
      const r = await api("/api/fiesta/crear", {
        juego: config.juego,
        pid: PID,
        nombre,
      });
      entrar(r.codigo);
    } catch (e) {
      mostrarError(e.message);
    }
  }

  async function unirse() {
    const nombre = leerNombre();
    if (!nombre) return;
    const cod = $("codigo").value.trim().toUpperCase();
    if (cod.length !== 4) {
      mostrarError("El código tiene 4 letras");
      return;
    }
    try {
      const r = await api("/api/fiesta/unirse", {
        juego: config.juego,
        codigo: cod,
        pid: PID,
        nombre,
      });
      entrar(r.codigo);
    } catch (e) {
      mostrarError(e.message);
    }
  }

  function entrar(cod) {
    codigo = cod;
    mostrarError("");
    try {
      sessionStorage.setItem("fiesta_sala_" + config.juego, cod);
    } catch (e) {}
    history.replaceState(null, "", location.pathname + "?sala=" + cod);
    $("pantalla-inicio").classList.add("oculto");
    $("pantalla-sala").classList.remove("oculto");
    $("codigo-sala").textContent = cod;
    ultimaFirma = "";
    clearInterval(intervalo);
    intervalo = setInterval(actualizar, config.intervalo || 1500);
    actualizar();
  }

  function salirAlInicio(mensaje) {
    clearInterval(intervalo);
    codigo = "";
    estado = null;
    try {
      sessionStorage.removeItem("fiesta_sala_" + config.juego);
    } catch (e) {}
    history.replaceState(null, "", location.pathname);
    $("pantalla-sala").classList.add("oculto");
    $("pantalla-inicio").classList.remove("oculto");
    mostrarError(mensaje || "");
  }

  async function actualizar() {
    if (!codigo) return;
    try {
      const extra = config.extraEstado ? config.extraEstado() : "";
      const nuevo = await api(
        `/api/fiesta/estado/${codigo}?pid=${encodeURIComponent(PID)}${extra}`,
      );
      if (nuevo.ahora) {
        desfaseReloj = nuevo.ahora * 1000 - Date.now();
        delete nuevo.ahora; // así la "firma" no cambia cada segundo
      }
      const firma = JSON.stringify(nuevo);
      if (firma === ultimaFirma) return; // nada cambió: no repintar (así no se borra lo que tocas)
      ultimaFirma = firma;
      estado = nuevo;
      pintarJugadores();
      config.pintar(estado, $("zona-juego"));
      avisarPerfil();
    } catch (e) {
      if (/no existe|Ya no estás/.test(e.message)) salirAlInicio(e.message);
    }
  }

  // al terminar una ronda o el juego: monedas y logros en el perfil
  let ultimoAvisoPerfil = "";
  function avisarPerfil() {
    if (
      !window.Perfil ||
      (estado.fase !== "final" && estado.fase !== "resultado")
    )
      return;
    Perfil.anuncioFinal($("zona-juego"), config.juego);
    const clave = `${codigo}:${estado.ronda}`;
    if (clave === ultimoAvisoPerfil) return;
    ultimoAvisoPerfil = clave;
    const mayor = Math.max(...estado.jugadores.map((j) => j.puntos));
    const mio = (estado.jugadores.find((j) => j.id === PID) || {}).puntos || 0;
    // si el juego dice quién ganó la ronda (UNO), se usa eso
    const gano =
      estado.ganador_ronda != null
        ? estado.ganador_ronda === PID
        : mio > 0 && mio === mayor;
    Perfil.evento(config.juego, "fin", { codigo, ronda: estado.ronda }, null);
  }

  function pintarJugadores() {
    const caja = $("lista-jugadores");
    const mostrarPuntos = estado.ronda > 0;
    caja.innerHTML = estado.jugadores
      .map((j) => {
        const listo =
          estado.fase === "votando" && estado.votaron.includes(j.id);
        const quitar =
          estado.soy_host && j.id !== PID
            ? `<button class="quitar" title="Sacar" onclick="Fiesta.expulsar('${j.id}')">✕</button>`
            : "";
        return `<div class="jugador ${listo ? "listo" : ""}">
          <div class="avatar" style="background:${colorDe(j.id)}">${esc(([...j.nombre][0] || "?").toUpperCase())}</div>
          <div class="nombre">${esc(j.nombre)}${j.id === PID ? " (tú)" : ""}</div>
          ${j.id === estado.host ? '<span class="etiqueta">👑 Anfitrión</span>' : ""}
          ${listo ? "✅" : ""}
          ${mostrarPuntos ? `<span class="puntos">${j.puntos} pts</span>` : ""}
          ${quitar}
        </div>`;
      })
      .join("");
    $("total-jugadores").textContent = estado.jugadores.length;
  }

  function linkSala() {
    return location.origin + location.pathname + "?sala=" + codigo;
  }

  async function compartir() {
    const texto = `¡Únete a mi sala de ${config.titulo}! Código: ${codigo}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: config.titulo,
          text: texto,
          url: linkSala(),
        });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(texto + " " + linkSala()),
      "_blank",
    );
  }

  async function accion(nombre, extra, silencioso) {
    try {
      const r = await api("/api/fiesta/accion", {
        codigo,
        pid: PID,
        accion: nombre,
        ...(extra || {}),
      });
      if (r && r.error) throw new Error(r.error);
      if (!silencioso) {
        ultimaFirma = "";
        actualizar();
      }
      return r;
    } catch (e) {
      alert(e.message);
      return null;
    }
  }

  // Tabla de posiciones (para el final de cada juego)
  function ranking(e) {
    const lista = e.jugadores.slice().sort((a, b) => b.puntos - a.puntos);
    const medallas = ["🥇", "🥈", "🥉"];
    return `<div class="lista-jugadores">${lista
      .map(
        (j, i) => `<div class="jugador ${i === 0 ? "listo" : ""}">
          <div class="avatar" style="background:${colorDe(j.id)}">${medallas[i] || i + 1}</div>
          <div class="nombre">${esc(j.nombre)}${j.id === PID ? " (tú)" : ""}</div>
          <span class="puntos">${j.puntos} pts</span>
        </div>`,
      )
      .join("")}</div>`;
  }

  // Mensaje que aparece un momento en medio de la pantalla
  function flotante(texto, ms = 1400) {
    const d = document.createElement("div");
    d.className = "mensaje-flotante";
    d.innerHTML = texto;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  // Los elementos con data-limite="<segundos epoch>" muestran la cuenta regresiva solos
  setInterval(() => {
    document.querySelectorAll("[data-limite]").forEach((el) => {
      const s = segundosHasta(+el.dataset.limite);
      el.textContent = s;
      el.classList.toggle("poco-tiempo", s <= 5);
    });
  }, 250);

  // Segundos que faltan para un límite que mandó el servidor
  function segundosHasta(limite) {
    return Math.max(0, Math.ceil(limite - (Date.now() + desfaseReloj) / 1000));
  }

  function salir() {
    if (!confirm("¿Seguro que quieres salir de la sala?")) return;
    api("/api/fiesta/accion", { codigo, pid: PID, accion: "salir" }).catch(
      () => {},
    );
    salirAlInicio();
  }

  function expulsar(objetivo) {
    if (confirm(`¿Sacar a ${nombreDe(objetivo)} de la sala?`))
      accion("expulsar", { objetivo });
  }

  // Botones para votar por los jugadores (sirve para los dos juegos)
  function botonesVoto(excluirme) {
    const opciones = estado.jugadores
      .filter((j) => !(excluirme && j.id === PID))
      .map(
        (
          j,
        ) => `<button class="opcion-voto ${estado.mi_voto === j.id ? "elegido" : ""}"
            ${estado.ya_vote ? "disabled" : ""}
            onclick="Fiesta.accion('votar', {voto: '${j.id}'})">${esc(j.nombre)}</button>`,
      )
      .join("");
    return `<div class="opciones-voto">${opciones}</div>`;
  }

  function iniciar(opciones) {
    config = opciones;
    $("nombre").value = nombreGuardado();
    window.Perfil?.cargar().then((d) => {
      if (d?.cuenta) {
        $("nombre").value = d.nombre;
        $("nombre").readOnly = true;
      }
    });
    $("btn-crear").onclick = crear;
    $("btn-unirse").onclick = unirse;
    $("btn-compartir").onclick = compartir;
    $("btn-salir").onclick = salir;
    $("codigo").addEventListener(
      "keydown",
      (e) => e.key === "Enter" && unirse(),
    );

    const params = new URLSearchParams(location.search);
    let cod = (params.get("sala") || "").toUpperCase();
    if (!cod) {
      try {
        cod = sessionStorage.getItem("fiesta_sala_" + config.juego) || "";
      } catch (e) {}
    }
    if (cod) {
      $("codigo").value = cod;
      // Si ya estaba en esa sala (recargó la página), entra directo
      api(`/api/fiesta/estado/${cod}?pid=${encodeURIComponent(PID)}`)
        .then(() => entrar(cod))
        .catch(() => {
          $("bloque-crear").classList.add("oculto");
          $("nombre").focus();
        });
    }
  }

  return {
    iniciar,
    accion,
    segundosHasta,
    ranking,
    flotante,
    refrescar: () => {
      ultimaFirma = "";
      actualizar();
    },
    get estado() {
      return estado;
    },
    expulsar,
    botonesVoto,
    nombreDe,
    colorDe,
    esc,
    get pid() {
      return PID;
    },
  };
})();
