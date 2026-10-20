// static/js/arcade3d.js
// Base compartida de los juegos 3D del arcade:
//   Arcade.mundo()   → escena de Three.js con luces, reflejos y sombras
//   Arcade.sonido()  → efectos de sonido sintetizados (sin archivos)
//   Arcade.ui({...}) → menú, marcador, avisos, modo online y récords
//   Arcade.deslizar() → leer gestos de deslizar el dedo / mouse

// Carga el perfil (avatar, monedas y logros) en todos los juegos
const perfilListo = window.Perfil
  ? Promise.resolve(window.Perfil)
  : new Promise((resolver) => {
      const s = document.createElement("script");
      s.id = "script-perfil";
      s.src = "/static/js/perfil.js";
      s.onload = () => resolver(window.Perfil);
      s.onerror = () => resolver(null);
      document.head.appendChild(s);
    });

const Arcade = (() => {
  const $ = (id) => document.getElementById(id);
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const azar = (a, b) => a + Math.random() * (b - a);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  function gauss() {
    let u = 0,
      v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  // Generador de números al azar con semilla (los dos celulares sacan los mismos números)
  function rng(semilla) {
    let a = semilla >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function esc(texto) {
    const d = document.createElement("div");
    d.textContent = texto == null ? "" : String(texto);
    return d.innerHTML;
  }

  // =========================================================
  //  MUNDO 3D
  // =========================================================
  function mundo(opciones = {}) {
    let lienzo = $("lienzo");
    if (!lienzo) {
      lienzo = document.createElement("canvas");
      lienzo.id = "lienzo";
      document.body.prepend(lienzo);
    }
    const renderer = new THREE.WebGLRenderer({
      canvas: lienzo,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = opciones.sombras !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opciones.exposicion || 1.1;

    const escena = new THREE.Scene();
    const fondo = opciones.fondo == null ? 0x120c14 : opciones.fondo;
    escena.background = new THREE.Color(fondo);
    if (opciones.niebla)
      escena.fog = new THREE.Fog(fondo, opciones.niebla[0], opciones.niebla[1]);

    const camara = new THREE.PerspectiveCamera(
      opciones.fov || 50,
      1,
      0.05,
      opciones.lejos || 200,
    );

    // reflejos de ambiente para que el metal y el plástico brillen
    const reflejos = new THREE.Scene();
    reflejos.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(20, 20, 20),
        new THREE.MeshBasicMaterial({
          color: opciones.colorAmbiente || 0x2a2230,
          side: THREE.BackSide,
        }),
      ),
    );
    (
      opciones.lamparas || [
        [0, 8, 3, 0xfff0d8, 4],
        [-8, 2, 5, 0xff4f8b, 1.1],
        [8, 2, 5, 0x4fb3ff, 1.1],
      ]
    ).forEach(([x, y, z, color, fuerza]) => {
      const l = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 3),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(color).multiplyScalar(fuerza),
          side: THREE.DoubleSide,
        }),
      );
      l.position.set(x, y, z);
      l.lookAt(0, 0, 0);
      reflejos.add(l);
    });
    const generadorAmbiente = new THREE.PMREMGenerator(renderer);
    escena.environment = generadorAmbiente.fromScene(reflejos, 0.04).texture;
    generadorAmbiente.dispose();
    reflejos.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });

    const alCambiarTamano = [];
    function ajustar() {
      const w = window.innerWidth,
        h = window.innerHeight;
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
      alCambiarTamano.forEach((f) => f(w, h));
    }
    window.addEventListener("resize", ajustar);

    const animaciones = [];
    const porCuadro = [];
    function animar(duracion, paso) {
      return new Promise((fin) => {
        const inicio = performance.now();
        animaciones.push((ahora) => {
          const t = Math.min(1, (ahora - inicio) / duracion);
          paso(t, ahora);
          if (t >= 1) {
            fin();
            return false;
          }
          return true;
        });
      });
    }

    let anterior = performance.now();
    function cuadro(ahora) {
      requestAnimationFrame(cuadro);
      const dt = Math.min(0.05, (ahora - anterior) / 1000);
      anterior = ahora;
      for (let i = animaciones.length - 1; i >= 0; i--)
        if (!animaciones[i](ahora)) animaciones.splice(i, 1);
      porCuadro.forEach((f) => f(dt, ahora));
      renderer.render(escena, camara);
    }

    setTimeout(ajustar);
    requestAnimationFrame(cuadro);

    return {
      renderer,
      escena,
      camara,
      lienzo,
      animar,
      alCuadro: (f) => porCuadro.push(f),
      alCambiarTamano: (f) => alCambiarTamano.push(f),
      ajustar,
      textura: (ancho, alto, dibujar, srgb = true) => {
        const c = document.createElement("canvas");
        c.width = ancho;
        c.height = alto;
        dibujar(c.getContext("2d"), ancho, alto);
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (srgb) t.encoding = THREE.sRGBEncoding;
        return t;
      },
      pantallaARayo: (px, py) => {
        const r = new THREE.Raycaster();
        r.setFromCamera(
          new THREE.Vector2(
            (px / window.innerWidth) * 2 - 1,
            -(py / window.innerHeight) * 2 + 1,
          ),
          camara,
        );
        return r;
      },
      aPantalla: (v) => {
        const p = v.clone().project(camara);
        return {
          x: ((p.x + 1) / 2) * window.innerWidth,
          y: ((1 - p.y) / 2) * window.innerHeight,
        };
      },
    };
  }

  // Los colores se escriben como en CSS; Three.js los necesita en espacio lineal
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  function materialPBR(opciones) {
    return window.Graficos3D
      ? Graficos3D.material(opciones)
      : new THREE.MeshStandardMaterial(opciones);
  }
  function material(color, extra = {}) {
    return materialPBR({ color: lin(color), roughness: 0.6, ...extra });
  }

  // Textura de madera (pisos, mesas, paredes)
  function dibujarMadera(
    g,
    w,
    h,
    { tono = 30, sat = 45, luz = 55, tablas = 6, vertical = true } = {},
  ) {
    for (let i = 0; i < tablas; i++) {
      const pos = (i * (vertical ? w : h)) / tablas;
      const tam = (vertical ? w : h) / tablas;
      g.fillStyle = `hsl(${tono + azar(-3, 3)}, ${sat}%, ${luz + azar(-6, 6)}%)`;
      if (vertical) g.fillRect(pos, 0, tam, h);
      else g.fillRect(0, pos, w, tam);
      for (let k = 0; k < 70; k++) {
        g.strokeStyle = `rgba(${Math.random() < 0.6 ? "60,30,10" : "255,230,200"}, ${azar(0.04, 0.12)})`;
        g.lineWidth = azar(0.5, 2.5);
        g.beginPath();
        const o = pos + Math.random() * tam;
        const largo = vertical ? h : w;
        for (let s = 0; s <= largo; s += 32) {
          const d = o + Math.sin(s / azar(80, 200) + k) * azar(1, 4);
          if (vertical) s === 0 ? g.moveTo(d, s) : g.lineTo(d, s);
          else s === 0 ? g.moveTo(s, d) : g.lineTo(s, d);
        }
        g.stroke();
      }
      g.fillStyle = "rgba(40,20,5,0.45)";
      if (vertical) g.fillRect(pos, 0, 3, h);
      else g.fillRect(0, pos, w, 3);
    }
  }

  // =========================================================
  //  SONIDO
  // =========================================================
  let ctxAudio = null;
  function activarAudio() {
    if (!ctxAudio) {
      try {
        ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (ctxAudio && ctxAudio.state === "suspended") ctxAudio.resume();
  }
  document.addEventListener("pointerdown", activarAudio, { capture: true });

  function ruido(
    dur,
    frecuencia,
    volumen,
    q = 1,
    tipo = "bandpass",
    retraso = 0,
  ) {
    if (!ctxAudio) return;
    const ahora = ctxAudio.currentTime + retraso;
    const buffer = ctxAudio.createBuffer(
      1,
      Math.max(1, ctxAudio.sampleRate * dur),
      ctxAudio.sampleRate,
    );
    const d = buffer.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    const fuente = ctxAudio.createBufferSource();
    fuente.buffer = buffer;
    const filtro = ctxAudio.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = frecuencia;
    filtro.Q.value = q;
    const g = ctxAudio.createGain();
    g.gain.value = volumen;
    fuente.connect(filtro).connect(g).connect(ctxAudio.destination);
    fuente.start(ahora);
  }
  function tono(
    frecuencia,
    dur,
    volumen,
    forma = "sine",
    final = 0.5,
    retraso = 0,
  ) {
    if (!ctxAudio) return;
    const ahora = ctxAudio.currentTime + retraso;
    const osc = ctxAudio.createOscillator();
    const g = ctxAudio.createGain();
    osc.type = forma;
    osc.frequency.setValueAtTime(frecuencia, ahora);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, frecuencia * final),
      ahora + dur,
    );
    g.gain.setValueAtTime(volumen, ahora);
    g.gain.exponentialRampToValueAtTime(0.001, ahora + dur);
    osc.connect(g).connect(ctxAudio.destination);
    osc.start(ahora);
    osc.stop(ahora + dur);
  }
  function sonar(tipo, fuerza = 1) {
    const f = limitar(fuerza, 0, 1.5);
    switch (tipo) {
      case "swoosh":
        return ruido(0.25, 1600, 0.12 * f, 0.6);
      case "rebote":
        ruido(0.05, 700, 0.5 * f, 1.2);
        return tono(140, 0.12, 0.4 * f);
      case "ping":
        return tono(
          1800 + Math.random() * 400,
          0.08,
          0.25 * f,
          "triangle",
          0.7,
        );
      case "golpe":
        ruido(0.08, 500, 0.8 * f, 1);
        return tono(90, 0.18, 0.6 * f);
      case "patada":
        ruido(0.06, 900, 0.9 * f, 1.5);
        return tono(110, 0.14, 0.7 * f);
      case "pinos":
        for (let i = 0; i < 6; i++)
          ruido(
            0.08,
            azar(900, 2400),
            0.35 * f,
            3,
            "bandpass",
            i * azar(0.01, 0.04),
          );
        return;
      case "rodar":
        return ruido(0.9, 180, 0.35 * f, 0.7, "lowpass");
      case "red":
        return ruido(0.35, 2600, 0.25 * f, 0.5, "highpass");
      case "aro":
        tono(900, 0.4, 0.15 * f, "triangle", 0.95);
        return tono(1350, 0.3, 0.08 * f, "sine", 0.95);
      case "agua":
        ruido(0.18, 1200, 0.4 * f, 2);
        return tono(500, 0.12, 0.25 * f, "sine", 2.2);
      case "silbato":
        tono(2400, 0.35, 0.18, "square", 1.02);
        return tono(2550, 0.35, 0.12, "square", 1.02);
      case "publico":
        for (let i = 0; i < 8; i++)
          ruido(1.4, azar(400, 1400), 0.12, 0.8, "bandpass", i * 0.05);
        return;
      case "abucheo":
        return ruido(1.2, 300, 0.25, 0.7, "lowpass");
      case "ganar":
        [523, 659, 784, 1046].forEach((n, i) =>
          tono(n, 0.25, 0.2, "triangle", 1, i * 0.12),
        );
        return;
      case "perder":
        [392, 330, 262].forEach((n, i) =>
          tono(n, 0.3, 0.2, "triangle", 0.95, i * 0.16),
        );
        return;
      case "click":
        return tono(1200, 0.04, 0.15, "square", 0.8);
      case "salto":
        return tono(380, 0.12, 0.18, "triangle", 1.8);
      case "choque":
        ruido(0.3, 300, 0.9, 0.8, "lowpass");
        return tono(70, 0.3, 0.6);
      case "perfecto":
        return tono(880 * fuerza, 0.18, 0.2, "triangle", 1.5);
    }
  }

  // =========================================================
  //  GESTOS: deslizar el dedo o arrastrar el mouse
  // =========================================================
  // Llama a { inicio(p), mover(p, puntos), soltar(gesto) }.
  // gesto = { inicio, fin, puntos, dx, dy, duracion, vx, vy } (px y px/s, vy negativa = hacia arriba)
  function deslizar(elemento, manejadores) {
    let puntos = null;
    elemento.addEventListener("pointerdown", (e) => {
      if (manejadores.puede && !manejadores.puede()) return;
      puntos = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      elemento.setPointerCapture(e.pointerId);
      manejadores.inicio && manejadores.inicio(puntos[0], e);
    });
    elemento.addEventListener("pointermove", (e) => {
      if (!puntos) {
        manejadores.flotar &&
          manejadores.flotar({ x: e.clientX, y: e.clientY }, e);
        return;
      }
      puntos.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      manejadores.mover &&
        manejadores.mover(puntos[puntos.length - 1], puntos, e);
    });
    const terminar = (e, cancelado) => {
      if (!puntos) return;
      const p = puntos;
      puntos = null;
      if (cancelado) return manejadores.cancelar && manejadores.cancelar();
      p.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      const ini = p[0],
        fin = p[p.length - 1];
      // velocidad de los últimos 120 ms (lo que importa al soltar)
      let k = p.length - 1;
      while (k > 0 && fin.t - p[k].t < 120) k--;
      const dt = Math.max(0.016, (fin.t - p[k].t) / 1000);
      manejadores.soltar &&
        manejadores.soltar({
          inicio: ini,
          fin,
          puntos: p,
          dx: fin.x - ini.x,
          dy: fin.y - ini.y,
          duracion: (fin.t - ini.t) / 1000,
          vx: (fin.x - p[k].x) / dt,
          vy: (fin.y - p[k].y) / dt,
        });
    };
    elemento.addEventListener("pointerup", (e) => terminar(e, false));
    elemento.addEventListener("pointercancel", (e) => terminar(e, true));
  }

  // Curva del gesto: >0 si la línea se dobla a la derecha, <0 a la izquierda (en px)
  function curvaGesto(puntos) {
    if (puntos.length < 3) return 0;
    const a = puntos[0],
      b = puntos[puntos.length - 1];
    const largo = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let mayor = 0;
    puntos.forEach((p) => {
      const d = ((b.x - a.x) * (a.y - p.y) - (b.y - a.y) * (a.x - p.x)) / largo;
      if (Math.abs(d) > Math.abs(mayor)) mayor = d;
    });
    return -mayor;
  }

  // =========================================================
  //  ONLINE (duelos de 2)
  // =========================================================
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

  function nombreGuardado() {
    try {
      return localStorage.getItem("nombreUsuario") || "";
    } catch (e) {
      return "";
    }
  }

  // =========================================================
  //  INTERFAZ (menú, marcador, fin, online, récords)
  // =========================================================
  const TEXTOS_MODO = {
    bot: "🤖 Contra el bot",
    online: "🌐 Online con un amigo",
    local: "👥 2 jugadores en este aparato",
    solo: "🏆 Jugar solo (récord)",
  };
  const CLASES_MODO = {
    bot: "",
    online: "azul",
    local: "claro",
    solo: "dorado",
  };
  const PROMOS_ARCADE = [
    {
      juego: "mansion",
      emoji: "👻",
      titulo: "Nocturna",
      texto: "Explora la mansión, encuentra tres llaves y escapa.",
      href: "/juego/mansion",
    },
    {
      juego: "pinball",
      emoji: "🪩",
      titulo: "Pinball Nova",
      texto: "Luces, combos, multibola y récords de otro planeta.",
      href: "/juego/pinball",
    },
    {
      juego: "uno",
      emoji: "🃏",
      titulo: "UNO 3D",
      texto: "Cartas 3D y partidas con hasta diez amigos.",
      href: "/uno",
    },
    {
      juego: "templo",
      emoji: "🏛️",
      titulo: "Umbra",
      texto: "Resuelve los misterios del templo perdido.",
      href: "/juego/templo",
    },
    {
      juego: "loteria",
      emoji: "🎯",
      titulo: "Lotería Mexicana",
      texto: "Hasta tres cartas, colores y frases para reírse.",
      href: "/loteria",
    },
    {
      juego: "zombis",
      emoji: "🧟",
      titulo: "Última guardia",
      texto: "Gana monedas por baja y mejora tu arsenal.",
      href: "/juego/zombis",
    },
  ];
  const VIDEO_PROMO = "/static/video/anuncio-novedades-v1.mp4";
  const POSTER_PROMO = "/static/video/anuncio-novedades-v1.jpg";

  function ui(config) {
    const modos = config.modos || ["bot", "online", "local"];
    // dificultad: true, o { etiqueta, nombres: {facil, normal, pro}, siempre } para juegos sin bot
    const dif = typeof config.dificultad === "object" ? config.dificultad : {};
    const nombresDif = Object.assign(
      { facil: "Fácil", normal: "Normal", pro: "Pro" },
      dif.nombres,
    );
    const html = `
      <div id="hud" class="oculto">
        <div class="marcador">
          <div class="panel-jugador" id="panel-0"><div class="nombre"></div><div class="valor"></div><div class="detalle"></div></div>
          <div class="centro-marcador">
            <button class="boton-redondo" id="btn-menu" title="Menú">☰</button>
            <div id="badge-centro" class="badge-centro oculto"></div>
          </div>
          <div class="panel-jugador derecha" id="panel-1"><div class="nombre"></div><div class="valor"></div><div class="detalle"></div></div>
        </div>
        <div id="ayuda"></div>
      </div>
      <div id="aviso"></div>

      <div id="menu" class="capa">
        <div class="tarjeta">
          <div id="insignia-perfil" style="text-align:center"></div>
          <div class="titulo">
            <div class="emoji">${config.emoji}</div>
            <h1>${config.titulo}</h1>
            <p>${config.subtitulo || ""}</p>
          </div>
          <div class="etiqueta">Tu nombre</div>
          <input id="nombre" class="campo" maxlength="14" placeholder="Tu nombre" />
          ${
            config.dificultad && (modos.includes("bot") || dif.siempre)
              ? `<div class="etiqueta">${dif.etiqueta || "🤖 Dificultad del bot"}</div>
                 <div class="chips" id="chips-dificultad">
                   <button class="chip" data-d="facil">${nombresDif.facil}</button>
                   <button class="chip activo" data-d="normal">${nombresDif.normal}</button>
                   <button class="chip" data-d="pro">${nombresDif.pro}</button>
                 </div>`
              : ""
          }
          ${modos
            .map(
              (m) =>
                `<button class="boton ${CLASES_MODO[m]}" data-modo="${m}">${(config.textosModo || {})[m] || TEXTOS_MODO[m]}</button>`,
            )
            .join("")}
          ${
            config.reglas
              ? `<details><summary class="nota">📖 Cómo se juega</summary><ul class="reglas">${config.reglas
                  .map((r) => `<li>${r}</li>`)
                  .join("")}</ul></details>`
              : ""
          }
          ${
            config.records
              ? `<details id="caja-records"><summary class="nota">🏆 Récords</summary><div class="tabla-records" id="tabla-records"><div>Cargando…</div></div></details>`
              : ""
          }
          <a href="/secreto" class="enlace">← Volver al arcade</a>
        </div>
      </div>

      <div id="menu-online" class="capa oculto">
        <div class="tarjeta">
          <div class="titulo"><div class="emoji">🌐</div><h1>Online</h1></div>
          <div class="etiqueta">Tu nombre</div>
          <input id="nombre-online" class="campo" maxlength="14" placeholder="Tu nombre" />
          <button class="boton" id="btn-crear">✨ Crear sala</button>
          <p class="nota">— o —</p>
          <input id="codigo" class="campo codigo" maxlength="4" placeholder="CÓDIGO" />
          <button class="boton azul" id="btn-unirse">🚪 Unirme</button>
          <div class="error" id="error-online"></div>
          <button class="boton claro" id="btn-volver-online">← Atrás</button>
        </div>
      </div>

      <div id="menu-espera" class="capa oculto">
        <div class="tarjeta">
          <div class="titulo"><div class="emoji">⏳</div><p>Pásale este código a tu amigo</p></div>
          <div class="codigo-grande" id="codigo-espera">----</div>
          <button class="boton verde" id="btn-compartir">📲 Invitar por WhatsApp</button>
          <p class="nota">Esperando a que se una…</p>
          <button class="boton claro" id="btn-cancelar">Cancelar</button>
        </div>
      </div>

      <div id="menu-fin" class="capa oculto">
        <div class="tarjeta">
          <div class="trofeo" id="fin-emoji">🏆</div>
          <div class="ganador" id="fin-texto"></div>
          <p class="nota" id="fin-nota"></p>
          <div class="nuevo-record oculto" id="fin-record">⭐ ¡Nuevo récord personal! ⭐</div>
          <a id="fin-promo" class="promo-arcade" href="/secreto">
            <small>VIDEO · NUEVOS JUEGOS</small>
            <video class="promo-video" muted playsinline loop preload="auto" aria-label="Video de novedades del arcade"></video>
            <span class="promo-detalle"><span class="promo-emoji"></span><span><b class="promo-titulo"></b><em class="promo-texto"></em></span><strong>JUGAR →</strong></span>
          </a>
          <button class="boton" id="btn-revancha">🔁 Otra vez</button>
          <button class="boton claro" id="btn-fin-menu">🏠 Menú</button>
        </div>
      </div>

      <div id="menu-revivir" class="capa oculto">
        <div class="tarjeta tarjeta-revivir">
          <div class="titulo"><div class="emoji">❤️</div><h1>¿Una oportunidad más?</h1><p id="revivir-texto">Mira esta novedad del arcade y revive una vez.</p></div>
          <div class="promo-arcade promo-revivir" aria-label="Anuncio interno del arcade">
            <small>VIDEO · PRUEBA DESPUÉS</small>
            <video class="promo-video" muted playsinline loop preload="auto" aria-label="Video para revivir"></video>
            <span class="promo-detalle"><span class="promo-emoji"></span><span><b class="promo-titulo"></b><em class="promo-texto"></em></span></span>
          </div>
          <button class="boton verde" id="btn-revivir" disabled>Preparando…</button>
          <button class="boton claro" id="btn-no-revivir">No, terminar partida</button>
          <p class="nota">Promoción interna. No usa anuncios externos ni realiza compras.</p>
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", html);

    const estado = {
      modo: null,
      nombres: ["", ""],
      dificultad: "normal",
      partida: 0,
      online: null, // { codigo, yo, semilla, nombres }
      revivirUsado: false,
    };
    let intervalo = null;
    let ultimoSeq = 0;
    let consultando = false;

    const capas = [
      "menu",
      "menu-online",
      "menu-espera",
      "menu-fin",
      "menu-revivir",
    ];
    function mostrar(id) {
      capas.forEach((c) => $(c).classList.toggle("oculto", c !== id));
      $("hud").classList.toggle("oculto", !!id && id !== "menu-fin");
      if (id === "menu" && config.records) cargarRecords();
    }

    window.Graficos3D?.selector($("menu").querySelector(".tarjeta"));
    $("nombre").value = $("nombre-online").value = nombreGuardado();
    // la insignia del perfil (avatar, nombre y monedas) arriba del menú
    const esperarPerfil = setInterval(() => {
      if (!window.Perfil) return;
      clearInterval(esperarPerfil);
      Perfil.insignia($("insignia-perfil"));
      Perfil.cargar().then((d) => {
        if (d?.cuenta)
          $("nombre").readOnly = $("nombre-online").readOnly = true;
        if (
          d &&
          d.nombre &&
          d.nombre !== "Jugador" &&
          (d.cuenta || !$("nombre").value)
        )
          $("nombre").value = $("nombre-online").value = d.nombre;
      });
    }, 100);
    $("nombre").addEventListener(
      "input",
      () => ($("nombre-online").value = $("nombre").value),
    );
    $("nombre-online").addEventListener(
      "input",
      () => ($("nombre").value = $("nombre-online").value),
    );
    function miNombre() {
      const n =
        (window.Perfil?.datos?.cuenta
          ? Perfil.datos.nombre
          : $("nombre").value.trim()) || "Jugador";
      try {
        localStorage.setItem("nombreUsuario", n);
      } catch (e) {}
      return n;
    }

    document.querySelectorAll("#chips-dificultad .chip").forEach((chip) => {
      chip.onclick = () => {
        estado.dificultad = chip.dataset.d;
        document
          .querySelectorAll("#chips-dificultad .chip")
          .forEach((c) => c.classList.toggle("activo", c === chip));
      };
    });

    function empezar(modo, nombres) {
      estado.modo = modo;
      estado.nombres = nombres;
      estado.partida++;
      estado.perfil = perfilListo.then((p) =>
        p?.iniciar(config.juego, { modo, dificultad: estado.dificultad }),
      );
      estado.finalizada = false;
      estado.revivirUsado = false;
      mostrar(null);
      $("badge-centro").classList.toggle("oculto", modo !== "online");
      if (modo === "online")
        $("badge-centro").textContent = "SALA " + estado.online.codigo;
      $("ayuda").style.opacity = 1;
      config.alEmpezar(modo, {
        nombres,
        dificultad: estado.dificultad,
        online: estado.online,
        partida: estado.partida,
        perfil: estado.perfil,
        semilla: estado.online
          ? estado.online.semilla + estado.partida * 7919
          : Math.floor(Math.random() * 1e9),
      });
    }

    document.querySelectorAll("#menu [data-modo]").forEach((b) => {
      b.onclick = () => {
        activarAudio();
        const modo = b.dataset.modo;
        if (modo === "online") {
          miNombre();
          mostrar("menu-online");
        } else if (modo === "local") {
          const otro = prompt("¿Cómo se llama el otro jugador?", "Jugador 2");
          if (otro === null) return;
          empezar("local", [
            miNombre(),
            (otro.trim() || "Jugador 2").slice(0, 14),
          ]);
        } else if (modo === "bot") {
          const nivel = nombresDif[estado.dificultad];
          empezar("bot", [
            miNombre(),
            config.dificultad && !dif.siempre ? `Bot ${nivel}` : "Bot",
          ]); // si la dificultad es el tamaño del tablero, el bot no lleva número
        } else {
          empezar(modo, [miNombre(), ""]);
        }
      };
    });

    // ---------- Online ----------
    async function entrarSala(codigo) {
      $("error-online").textContent = "";
      estado.online = { codigo, yo: 0, semilla: 0, nombres: [] };
      estado.partida = 0;
      ultimoSeq = 0;
      $("codigo-espera").textContent = codigo;
      history.replaceState(null, "", location.pathname + "?sala=" + codigo);
      mostrar("menu-espera");
      clearInterval(intervalo);
      intervalo = setInterval(consultar, config.intervaloOnline || 600); // los juegos en tiempo real piden más seguido
      consultar();
    }
    function salirOnline(avisarRival) {
      clearInterval(intervalo);
      if (avisarRival && estado.online)
        api("/api/duelo/salir", {
          codigo: estado.online.codigo,
          pid: PID,
        }).catch(() => {});
      estado.online = null;
      history.replaceState(null, "", location.pathname);
    }
    async function consultar() {
      if (consultando) return;
      consultando = true;
      try {
        await consultarEstado();
      } finally {
        consultando = false;
      }
    }
    async function consultarEstado() {
      if (!estado.online) return;
      const salaConsultada = estado.online;
      let e;
      try {
        e = await api(
          `/api/duelo/estado/${estado.online.codigo}?pid=${encodeURIComponent(PID)}&desde=${ultimoSeq}`,
        );
      } catch (err) {
        if (estado.online !== salaConsultada) return;
        if (/no existe|No estás/.test(err.message)) {
          salirOnline(false);
          estado.modo = null;
          mostrar("menu-online");
          $("error-online").textContent = err.message;
        }
        return;
      }
      if (estado.online !== salaConsultada) return;
      Object.assign(estado.online, {
        yo: e.yo,
        semilla: e.semilla,
        nombres: e.nombres,
      });
      if (e.listo && estado.modo !== "online") {
        empezar("online", e.nombres);
      }
      e.eventos.forEach((ev) => {
        ultimoSeq = Math.max(ultimoSeq, ev.seq);
        if (ev.de === e.yo) return;
        if (ev.tipo === "salio") {
          avisar("Tu rival salió 😿", "#ff3b3b");
          setTimeout(() => {
            if (estado.online !== salaConsultada) return;
            salirOnline(false);
            estado.modo = null;
            config.alSalir && config.alSalir();
            mostrar("menu");
          }, 1800);
          return;
        }
        if (ev.tipo === "revancha") {
          if (ev.datos > estado.partida) {
            estado.partida = ev.datos - 1;
            empezar("online", estado.nombres);
          }
          return;
        }
        api_publica.alEvento && api_publica.alEvento(ev.tipo, ev.datos);
      });
    }
    $("btn-crear").onclick = async () => {
      try {
        const r = await api("/api/duelo/crear", {
          juego: config.juego,
          pid: PID,
          nombre: miNombre(),
        });
        entrarSala(r.codigo);
      } catch (e) {
        $("error-online").textContent = e.message;
      }
    };
    const unirse = async () => {
      const codigo = $("codigo").value.trim().toUpperCase();
      if (codigo.length !== 4)
        return ($("error-online").textContent = "El código tiene 4 letras");
      try {
        const r = await api("/api/duelo/unirse", {
          juego: config.juego,
          codigo,
          pid: PID,
          nombre: miNombre(),
        });
        entrarSala(r.codigo);
      } catch (e) {
        $("error-online").textContent = e.message;
      }
    };
    $("btn-unirse").onclick = unirse;
    $("codigo").addEventListener(
      "keydown",
      (e) => e.key === "Enter" && unirse(),
    );
    $("btn-volver-online").onclick = () => mostrar("menu");
    $("btn-cancelar").onclick = () => {
      salirOnline(true);
      mostrar("menu-online");
    };
    $("btn-compartir").onclick = async () => {
      const link =
        location.origin + location.pathname + "?sala=" + estado.online.codigo;
      const texto = `¡Te reto a ${config.titulo}! ${config.emoji} Código: ${estado.online.codigo}`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: config.titulo,
            text: texto,
            url: link,
          });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
      window.open(
        "https://wa.me/?text=" + encodeURIComponent(texto + " " + link),
        "_blank",
      );
    };

    // ---------- Menú en juego / fin ----------
    function volverAlMenu(avisarRival) {
      if (estado.modo === "online") salirOnline(avisarRival);
      estado.modo = null;
      config.alSalir && config.alSalir();
      mostrar("menu");
    }
    $("btn-menu").onclick = () => {
      if (confirm("¿Salir de la partida?")) volverAlMenu(true);
    };
    $("btn-fin-menu").onclick = () => volverAlMenu(true);
    $("btn-revancha").onclick = () => {
      if (estado.modo === "online") {
        enviar("revancha", estado.partida + 1);
        empezar("online", estado.nombres);
        return;
      }
      empezar(estado.modo, estado.nombres);
    };

    let resolverRevivir = null;
    let relojRevivir = null;
    function elegirPromo() {
      const disponibles = PROMOS_ARCADE.filter((p) => p.juego !== config.juego);
      let indice = 0;
      try {
        indice =
          Number(localStorage.getItem("promo_arcade") || 0) %
          disponibles.length;
        localStorage.setItem("promo_arcade", String(indice + 1));
      } catch (e) {}
      return disponibles[indice] || PROMOS_ARCADE[0];
    }
    function pintarPromo(contenedor, promo) {
      contenedor.querySelector(".promo-emoji").textContent = promo.emoji;
      contenedor.querySelector(".promo-titulo").textContent = promo.titulo;
      contenedor.querySelector(".promo-texto").textContent = promo.texto;
      if (contenedor.tagName === "A") contenedor.href = promo.href;
      const video = contenedor.querySelector(".promo-video");
      video.poster = POSTER_PROMO;
      if (!video.src.endsWith(VIDEO_PROMO)) video.src = VIDEO_PROMO;
      video.currentTime = 0;
      video.play().catch(() => {});
      return video;
    }
    function cerrarRevivir(resultado) {
      clearInterval(relojRevivir);
      relojRevivir = null;
      $("menu-revivir").querySelector(".promo-video")?.pause();
      const resolver = resolverRevivir;
      resolverRevivir = null;
      if (resolver) resolver(resultado);
    }
    function ofrecerRevivir({
      texto = "Mira esta novedad del arcade y revive una vez.",
      segundos = 4,
    } = {}) {
      if (estado.modo !== "solo" || estado.revivirUsado || estado.finalizada)
        return Promise.resolve(false);
      estado.revivirUsado = true;
      const promo = elegirPromo();
      const video = pintarPromo(
        $("menu-revivir").querySelector(".promo-arcade"),
        promo,
      );
      $("revivir-texto").textContent = texto;
      const boton = $("btn-revivir");
      boton.disabled = true;
      const espera = Math.max(1, Number(segundos) || 4);
      let faltan = Math.ceil(espera);
      boton.textContent = `Revive en ${faltan}…`;
      mostrar("menu-revivir");
      clearInterval(relojRevivir);
      relojRevivir = setInterval(() => {
        faltan = Math.max(0, Math.ceil(espera - video.currentTime));
        if (faltan > 0) return (boton.textContent = `Revive en ${faltan}…`);
        clearInterval(relojRevivir);
        relojRevivir = null;
        boton.disabled = false;
        boton.textContent = "❤️ Revivir ahora";
      }, 150);
      return new Promise((resolver) => (resolverRevivir = resolver));
    }
    $("btn-revivir").onclick = () => {
      if ($("btn-revivir").disabled) return;
      cerrarRevivir(true);
      mostrar(null);
    };
    $("btn-no-revivir").onclick = () => {
      cerrarRevivir(false);
      mostrar(null);
    };

    // ---------- Récords ----------
    async function cargarRecords() {
      try {
        const lista = await api(`/api/records/${config.juego}`);
        $("tabla-records").innerHTML = lista.length
          ? lista
              .map(
                (r, i) =>
                  `<div><span>${["🥇", "🥈", "🥉"][i] || i + 1 + "."} ${esc(r.nombre)}</span><span>${r.puntos} ${config.unidadRecord || ""}</span></div>`,
              )
              .join("")
          : "<div>Nadie ha jugado todavía ✨</div>";
      } catch (e) {
        $("tabla-records").innerHTML = "<div>No se pudieron cargar</div>";
      }
    }

    // ---------- Funciones para el juego ----------
    function avisar(texto, brillo) {
      const a = $("aviso");
      a.innerHTML = texto;
      a.style.setProperty("--brillo", brillo || "#ff4f8b");
      a.classList.remove("mostrar");
      void a.offsetWidth;
      a.classList.add("mostrar");
    }

    function marcador(paneles) {
      [0, 1].forEach((i) => {
        const p = paneles[i];
        const el = $("panel-" + i);
        el.classList.toggle("oculto", !p);
        if (!p) return;
        el.style.setProperty(
          "--color",
          p.color || (i === 0 ? "#ff4f8b" : "#4fb3ff"),
        );
        el.querySelector(".nombre").textContent = p.nombre;
        el.querySelector(".valor").textContent = p.valor;
        el.querySelector(".detalle").textContent = p.detalle || "";
        el.classList.toggle("activo", !!p.activo);
      });
    }

    function ayuda(texto) {
      $("ayuda").textContent = texto || "";
      $("ayuda").style.opacity = texto ? 1 : 0;
    }

    async function terminar({
      emoji = "🏆",
      texto,
      nota = "",
      record = null,
      gano = null,
      datos = {},
    }) {
      if (estado.finalizada) return;
      estado.finalizada = true;
      const partida = estado.partida,
        modo = estado.modo,
        dificultad = estado.dificultad;
      const contexto = estado.perfil;
      const nombre = estado.nombres[estado.online ? estado.online.yo : 0];
      $("fin-emoji").textContent = emoji;
      $("fin-texto").textContent = texto;
      $("fin-nota").textContent = nota;
      $("fin-record").classList.add("oculto");
      $("btn-revancha").textContent =
        estado.modo === "online" ? "🔁 Revancha" : "🔁 Otra vez";
      pintarPromo($("fin-promo"), elegirPromo());
      mostrar("menu-fin");
      let recordNuevo = false;
      if (record != null && config.records) {
        try {
          const r = await api(`/api/records/${config.juego}`, {
            nombre,
            puntos: record,
          });
          recordNuevo = !!r.nuevo_record;
          if (r.nuevo_record && estado.partida === partida)
            $("fin-record").classList.remove("oculto");
        } catch (e) {}
      }
      // monedas y logros (si el juego no dice si ganaste, se adivina por el trofeo)
      if (gano == null)
        gano =
          modo !== "solo" && modo !== "local" && ["🏆", "🥇"].includes(emoji);
      const perfil = await contexto;
      if (perfil && window.Perfil)
        Perfil.evento(
          config.juego,
          "fin",
          { ...datos, gano, modo, dificultad, record_nuevo: recordNuevo },
          perfil,
        );
    }

    function enviar(tipo, datos) {
      if (!estado.online) return Promise.resolve();
      return api("/api/duelo/evento", {
        codigo: estado.online.codigo,
        pid: PID,
        tipo,
        datos,
      }).catch(() => {});
    }

    // Link de invitación
    const params = new URLSearchParams(location.search);
    if (params.get("sala")) {
      $("codigo").value = params.get("sala").toUpperCase();
      mostrar("menu-online");
    } else if (params.get("modo") === "online" && modos.includes("online")) {
      mostrar("menu-online");
    } else {
      mostrar("menu");
    }
    if (config.ayuda) ayuda(config.ayuda);

    const api_publica = {
      avisar,
      marcador,
      ayuda,
      terminar,
      ofrecerRevivir,
      enviar,
      alEvento: null,
      get modo() {
        return estado.modo;
      },
      get yo() {
        return estado.online ? estado.online.yo : 0;
      },
      get nombres() {
        return estado.nombres;
      },
      get partida() {
        return estado.partida;
      },
      enJuego: () =>
        !!estado.modo && $("menu-fin").classList.contains("oculto"),
    };
    return api_publica;
  }

  // Los temporizadores y las animaciones solo pertenecen a la sesión que los creó.
  // Las coroutines comprueban además el identificador después de cada espera.
  function ciclo(estado, mundo) {
    const actual = () => estado.sesion || 0;
    const cancelar = () => {
      estado.sesion = actual() + 1;
    };
    function despues(fn, ms) {
      const sesion = actual();
      return setTimeout(() => {
        if (actual() === sesion) fn();
      }, ms);
    }
    function cada(fn, ms) {
      const sesion = actual();
      const id = setInterval(() => {
        if (actual() !== sesion) return clearInterval(id);
        fn();
      }, ms);
      return id;
    }
    function animar(ms, fn) {
      const sesion = actual();
      return mundo.animar(ms, (t) => {
        if (actual() === sesion) fn(t);
      });
    }
    return { cancelar, despues, cada, animar };
  }

  return {
    $,
    esperar,
    azar,
    limitar,
    gauss,
    rng,
    esc,
    lin,
    material,
    materialPBR,
    dibujarMadera,
    mundo,
    sonar,
    deslizar,
    curvaGesto,
    ui,
    ciclo,
  };
})();
