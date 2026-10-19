/* Mesa UNO: solo representa estados confirmados. Las reglas siguen en el servidor. */
(() => {
  "use strict";
  const zona = document.getElementById("zona-juego");
  const shell = document.createElement("section");
  shell.className = "uno-escena";
  shell.hidden = true;
  shell.innerHTML =
    '<div class="uno-escena-cabecera"><span>ARCADE / CARD LOUNGE</span><span id="uno-escena-estado">MESA 3D</span></div><canvas aria-label="Mesa tridimensional de UNO con mazo y descarte"></canvas><div class="uno-efecto" role="status"></div><div class="uno-calidad"></div>';
  zona.before(shell);
  const canvas = shell.querySelector("canvas"),
    efecto = shell.querySelector(".uno-efecto");
  const COLORES = {
    rojo: 0xec4358,
    amarillo: 0xf7c349,
    verde: 0x24b987,
    azul: 0x4595ff,
    negro: 0x202638,
  };
  const SIMBOLOS = {
    salta: "⊘",
    reversa: "⇄",
    comodin: "✦",
    "+4": "+4",
    "+2": "+2",
  };
  const reducir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer,
    escena,
    camara,
    lista = false,
    previo = null,
    clave = "",
    version = 0,
    animaciones = [],
    ahoraEfecto = 0;
  let descarte = null,
    rivales = null,
    esferaColor,
    aroTurno,
    particulas,
    mazo;
  const cartas = new Map(),
    recursos = [];
  function textura(w, h, fn) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    fn(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    recursos.push(t);
    return t;
  }
  function redondear(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function cara(c) {
    const k = c ? c.c + ":" + c.v : "dorso";
    if (cartas.has(k)) return cartas.get(k);
    const tex = textura(256, 384, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      redondear(g, 0, 0, w, h, 20);
      g.fillStyle = "#f4f1eb";
      g.fill();
      redondear(g, 9, 9, w - 18, h - 18, 15);
      g.fillStyle = c
        ? "#" + COLORES[c.c].toString(16).padStart(6, "0")
        : "#121d30";
      g.fill();
      const brillo = g.createLinearGradient(0, 0, w, h);
      brillo.addColorStop(0, "#ffffff28");
      brillo.addColorStop(0.4, "#ffffff00");
      brillo.addColorStop(1, "#00000035");
      g.fillStyle = brillo;
      g.fill();
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-0.32);
      g.beginPath();
      g.ellipse(0, 0, w * 0.38, h * 0.34, 0, 0, Math.PI * 2);
      g.fillStyle = c && c.c !== "negro" ? "#fffaf0" : "#ea3b57";
      g.fill();
      if (c?.c === "negro") {
        g.save();
        g.clip();
        ["#ea435b", "#f7c349", "#28b787", "#468bff"].forEach((col, i) => {
          g.fillStyle = col;
          g.fillRect(i % 2 ? -150 : 0, i < 2 ? -180 : 0, 150, 180);
        });
        g.restore();
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `900 ${c ? 118 : 75}px Arial`;
      g.fillStyle =
        c && c.c !== "negro"
          ? "#" + COLORES[c.c].toString(16).padStart(6, "0")
          : "#fff6d2";
      g.shadowColor = "#0006";
      g.shadowBlur = 3;
      g.shadowOffsetY = 3;
      g.fillText(c ? SIMBOLOS[c.v] || c.v : "UNO", 0, 5);
      g.restore();
      if (c) {
        const simbolo = SIMBOLOS[c.v] || c.v;
        g.fillStyle = "#fff9eb";
        g.font = "900 35px Arial";
        g.textAlign = "left";
        g.fillText(simbolo, 20, 48);
        g.save();
        g.translate(w, h);
        g.rotate(Math.PI);
        g.fillText(simbolo, 20, 48);
        g.restore();
      } else {
        g.fillStyle = "#a4c7e3";
        g.textAlign = "center";
        g.font = "12px Arial";
        g.fillText("ARCADE • NIGHT EDITION", w / 2, h - 26);
      }
    });
    const m = new THREE.MeshPhysicalMaterial({
      map: tex,
      alphaTest: 0.2,
      roughness: 0.52,
      clearcoat: 0.25,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.22,
    });
    cartas.set(k, m);
    return m;
  }
  let geometriaCarta, planoCarta, bordeCarta;
  function crearCarta(c = null) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geometriaCarta, bordeCarta));
    const frente = new THREE.Mesh(planoCarta, cara(c));
    frente.rotation.x = -Math.PI / 2;
    frente.position.y = 0.025;
    g.add(frente);
    g.children.forEach((m) => {
      m.castShadow = m.receiveShadow = true;
    });
    return g;
  }
  function etiqueta(texto) {
    const c = document.createElement("canvas");
    c.width = 384;
    c.height = 70;
    const g = c.getContext("2d");
    redondear(g, 1, 1, 382, 68, 22);
    g.fillStyle = "#07101fdc";
    g.fill();
    g.strokeStyle = "#a2bee044";
    g.stroke();
    g.fillStyle = "#e2ecff";
    g.font = "bold 24px Arial";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const corto = texto.length > 22 ? texto.slice(0, 20) + "…" : texto;
    g.fillText(corto, 192, 35, 350);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const m = new THREE.SpriteMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.scale.set(2, 0.36, 1);
    s.userData.etiqueta = true;
    return s;
  }
  function limpiarRivales() {
    if (!rivales) return;
    rivales.traverse((o) => {
      if (o.userData.etiqueta) {
        o.material.map.dispose();
        o.material.dispose();
      }
      if (o.userData.descartar) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    escena.remove(rivales);
    rivales = null;
  }
  function asiento(pid, e) {
    if (pid === Fiesta.pid) return new THREE.Vector3(0, 0.5, 3.7);
    const otros = (e.cuentas || []).filter((r) => r.id !== Fiesta.pid),
      i = otros.findIndex((r) => r.id === pid);
    const a = otros.length <= 1 ? 0 : -1.85 + (i / (otros.length - 1)) * 3.7;
    return new THREE.Vector3(Math.sin(a) * 4, 0.44, -Math.cos(a) * 2.15);
  }
  function pintarRivales(e) {
    limpiarRivales();
    rivales = new THREE.Group();
    for (const r of (e.cuentas || []).filter((r) => r.id !== Fiesta.pid)) {
      const p = asiento(r.id, e),
        g = new THREE.Group();
      g.position.copy(p);
      const ang = Math.atan2(p.x, -p.z);
      g.rotation.y = -ang;
      const n = Math.min(r.n, 6);
      for (let i = 0; i < n; i++) {
        const c = crearCarta();
        c.scale.setScalar(0.42);
        c.position.set((i - (n - 1) / 2) * 0.17, i * 0.006, 0);
        c.rotation.y = (i - (n - 1) / 2) * 0.1;
        g.add(c);
      }
      const aro = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.015, 5, 40),
        new THREE.MeshBasicMaterial({
          color: r.id === e.turno ? 0xf7c349 : 0x365469,
          transparent: true,
          opacity: r.id === e.turno ? 0.9 : 0.3,
        }),
      );
      aro.rotation.x = -Math.PI / 2;
      aro.scale.set(1, 0.6, 1);
      aro.position.y = -0.08;
      aro.userData.descartar = true;
      g.add(aro);
      rivales.add(g);
      const nombre =
        e.jugadores.find((j) => j.id === r.id)?.nombre || "Jugador";
      const t = etiqueta(nombre + " · " + r.n + (r.n === 1 ? " · ¡UNO!" : ""));
      t.position.copy(p).add(new THREE.Vector3(0, 0.75, -0.25));
      rivales.add(t);
    }
    escena.add(rivales);
  }
  function limpiarAnimaciones() {
    version++;
    for (const a of animaciones) escena.remove(a.g);
    animaciones = [];
    if (descarte) descarte.visible = true;
    efecto.textContent = "";
    if (particulas) {
      escena.remove(particulas);
      particulas.geometry.dispose();
      particulas.material.dispose();
      particulas = null;
    }
  }
  function volar(c, desde, hasta, retraso = 0, alFinal = null) {
    if (reducir) {
      alFinal?.();
      return;
    }
    const g = crearCarta(c);
    g.position.copy(desde);
    escena.add(g);
    animaciones.push({
      g,
      desde: desde.clone(),
      hasta: hasta.clone(),
      inicio: performance.now() + retraso,
      duracion: 560,
      version,
      alFinal,
    });
  }
  function impacto(texto, col) {
    efecto.textContent = texto;
    efecto.style.setProperty("--impacto", col);
    efecto.classList.remove("activa");
    void efecto.offsetWidth;
    efecto.classList.add("activa");
    ahoraEfecto = performance.now() + 1500;
  }
  function confeti() {
    if (reducir) return;
    if (particulas) {
      escena.remove(particulas);
      particulas.geometry.dispose();
      particulas.material.dispose();
    }
    const g = new THREE.BufferGeometry(),
      p = new Float32Array(240 * 3),
      cs = new Float32Array(240 * 3);
    const colores = [0xef5366, 0xffd36a, 0x41dca2, 0x57adff];
    for (let i = 0; i < 240; i++) {
      p[i * 3] = (Math.random() - 0.5) * 8;
      p[i * 3 + 1] = 2 + Math.random() * 4;
      p[i * 3 + 2] = (Math.random() - 0.5) * 4;
      const c = new THREE.Color(colores[i % 4]);
      cs.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(cs, 3));
    particulas = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.065,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    particulas.userData.fin = performance.now() + 4000;
    escena.add(particulas);
  }
  function actualizar(e) {
    if (!lista) return;
    shell.hidden = false;
    document.body.classList.add("uno-con-3d");
    const nueva =
      document.getElementById("codigo-sala").textContent + ":" + e.ronda;
    if (nueva !== clave) {
      limpiarAnimaciones();
      clave = nueva;
      previo = null;
    }
    if (e.fase === "lobby") {
      limpiarAnimaciones();
      limpiarRivales();
      if (descarte) {
        escena.remove(descarte);
        descarte = null;
      }
      previo = null;
      document.getElementById("uno-escena-estado").textContent =
        "ESPERANDO JUGADORES";
      requestAnimationFrame(ajustar);
      return;
    }
    const nuevaCarta = previo && e.arriba.id !== previo.arriba.id;
    if (!previo || nuevaCarta) {
      if (descarte) escena.remove(descarte);
      descarte = crearCarta(e.arriba);
      descarte.position.set(1.05, 0.48, 0);
      descarte.rotation.y = -0.16;
      escena.add(descarte);
      if (nuevaCarta) {
        const destino = descarte;
        destino.visible = reducir;
        volar(
          e.arriba,
          asiento(e.ultima_jugada?.pid || previo.turno, previo),
          destino.position,
          0,
          () => {
            if (descarte === destino) destino.visible = true;
          },
        );
        const mensajes = {
          salta: "TURNO SALTADO",
          reversa: "CAMBIO DE SENTIDO",
          "+2": "+2 CARTAS",
          "+4": "+4 · ELIGE TU DESTINO",
          comodin: "CAMBIO DE COLOR",
        };
        if (mensajes[e.arriba.v])
          impacto(mensajes[e.arriba.v], "#" + COLORES[e.color].toString(16));
      } else if (e.fase === "jugando") {
        for (const r of e.cuentas)
          volar(
            null,
            new THREE.Vector3(-1.15, 0.55, 0),
            asiento(r.id, e),
            Math.min(500, e.cuentas.indexOf(r) * 65),
          );
      }
    }
    if (previo) {
      for (const r of e.cuentas) {
        const anterior = previo.cuentas.find((a) => a.id === r.id);
        const delta = r.n - (anterior?.n ?? r.n);
        if (delta > 0)
          for (let i = 0; i < Math.min(4, delta); i++)
            volar(
              null,
              new THREE.Vector3(-1.15, 0.55, 0),
              asiento(r.id, e),
              i * 100,
            );
      }
    }
    const firma = JSON.stringify([
      e.cuentas,
      e.turno,
      e.jugadores.map((j) => [j.id, j.nombre]),
    ]);
    if (firma !== rivales?.userData.firma) {
      pintarRivales(e);
      rivales.userData.firma = firma;
    }
    esferaColor.color.set(COLORES[e.color] || 0xffffff);
    esferaColor.emissive.set(COLORES[e.color] || 0xffffff);
    aroTurno.material.color.set(e.turno === Fiesta.pid ? 0x75efd1 : 0x6b7ca6);
    document.getElementById("uno-escena-estado").textContent =
      e.fase === "resultado"
        ? "RONDA COMPLETADA"
        : e.turno === Fiesta.pid
          ? "TU TURNO · ELIGE TU CARTA"
          : "JUGADA EN CURSO";
    if (e.fase === "resultado" && previo?.fase !== "resultado") {
      confeti();
      impacto(
        e.ganador_ronda === Fiesta.pid
          ? "¡GANASTE LA RONDA!"
          : "¡RONDA COMPLETADA!",
        "#ffd36a",
      );
    }
    previo = JSON.parse(JSON.stringify(e));
    requestAnimationFrame(ajustar);
  }
  function ajustar() {
    if (!lista || shell.hidden) return;
    const w = shell.clientWidth,
      h = canvas.clientHeight || 340;
    if (!w) return;
    renderer.setSize(w, h, false);
    const a = w / h;
    camara.left = -7.1;
    camara.right = 7.1;
    camara.top = 7.1 / a;
    camara.bottom = -7.1 / a;
    camara.updateProjectionMatrix();
  }
  function ocultar() {
    if (lista) limpiarAnimaciones();
    shell.hidden = true;
    previo = null;
    clave = "";
  }
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    escena = new THREE.Scene();
    escena.background = new THREE.Color(0x091322);
    camara = new THREE.OrthographicCamera(-6.4, 6.4, 3, -3, 0.1, 60);
    camara.position.set(0, 10, 8.4);
    camara.lookAt(0, 0.2, 0);
    escena.add(new THREE.HemisphereLight(0xb9d7f3, 0x071721, 0.65));
    const luz = new THREE.DirectionalLight(0xffe4bb, 1.25);
    luz.position.set(-3, 9, 4);
    luz.castShadow = true;
    luz.shadow.mapSize.set(2048, 2048);
    Object.assign(luz.shadow.camera, {
      left: -7,
      right: 7,
      top: 6,
      bottom: -6,
      near: 1,
      far: 25,
    });
    luz.shadow.bias = -0.0003;
    escena.add(luz);
    for (const [x, z, c] of [
      [-5, -2, 0x3be0c0],
      [5, -2, 0x9877ff],
    ]) {
      const l = new THREE.PointLight(c, 1.7, 12, 1.5);
      l.position.set(x, 2, z);
      escena.add(l);
    }
    const env = new THREE.Scene();
    env.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(20, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0x263c51, side: THREE.BackSide }),
      ),
    );
    for (const x of [-4, 4]) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 7),
        new THREE.MeshBasicMaterial({
          color: x < 0 ? 0xbbfff0 : 0xf9e8cd,
          side: THREE.DoubleSide,
        }),
      );
      p.position.set(x, 6, 2);
      p.lookAt(0, 0, 0);
      env.add(p);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    escena.environment = pmrem.fromScene(env, 0.06).texture;
    pmrem.dispose();
    env.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    const fieltro = textura(512, 512, (g, w, h) => {
      g.fillStyle = "#133c41";
      g.fillRect(0, 0, w, h);
      const r = (() => {
        let n = 4;
        return () =>
          (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
      })();
      for (let i = 0; i < 30000; i++) {
        g.fillStyle = r() > 0.5 ? "#ffffff05" : "#00000008";
        g.fillRect(r() * w, r() * h, 1, 2);
      }
      g.strokeStyle = "#a4d4c51a";
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(w / 2, h / 2, w * 0.42, h * 0.39, 0, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = "#bdeddf15";
      g.font = "900 74px Arial";
      g.textAlign = "center";
      g.fillText("UNO", w / 2, h * 0.55);
    });
    const metal = new THREE.MeshStandardMaterial({
      color: 0x293c52,
      metalness: 0.8,
      roughness: 0.27,
    });
    const borde = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.3, 96),
      metal,
    );
    borde.scale.set(5.22, 1, 3.12);
    escena.add(borde);
    const tapete = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.08, 96),
      new THREE.MeshStandardMaterial({ map: fieltro, roughness: 0.94 }),
    );
    tapete.scale.set(4.98, 1, 2.93);
    tapete.position.y = 0.2;
    tapete.receiveShadow = true;
    escena.add(tapete);
    const neon = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.008, 6, 128),
      new THREE.MeshBasicMaterial({ color: 0x4beac5 }),
    );
    neon.rotation.x = -Math.PI / 2;
    neon.scale.set(5.12, 3.04, 1);
    neon.position.y = 0.18;
    escena.add(neon);
    geometriaCarta = Graficos3D.cajaSuave(1.04, 0.045, 1.5, 0.015);
    planoCarta = new THREE.PlaneGeometry(1.015, 1.47);
    bordeCarta = new THREE.MeshStandardMaterial({
      color: 0xf2eadb,
      roughness: 0.55,
    });
    mazo = new THREE.Group();
    mazo.position.set(-1.15, 0.3, 0);
    for (let i = 0; i < 7; i++) {
      const c = crearCarta();
      c.position.y = i * 0.024;
      c.rotation.y = 0.1;
      mazo.add(c);
    }
    escena.add(mazo);
    const bases = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = crearCarta();
      c.position.set(1.05, 0.29 + i * 0.025, 0);
      c.rotation.y = -0.16 + i * 0.03;
      bases.add(c);
    }
    escena.add(bases);
    esferaColor = new THREE.MeshStandardMaterial({
      color: 0x75efd1,
      emissive: 0x75efd1,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    const indicador = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.027, 8, 48),
      esferaColor,
    );
    indicador.rotation.x = -Math.PI / 2;
    indicador.position.set(2.7, 0.3, 0);
    escena.add(indicador);
    aroTurno = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.013, 6, 64),
      new THREE.MeshBasicMaterial({
        color: 0x75efd1,
        transparent: true,
        opacity: 0.6,
      }),
    );
    aroTurno.rotation.x = -Math.PI / 2;
    aroTurno.scale.set(1, 0.6, 1);
    aroTurno.position.set(0, 0.28, 2.4);
    escena.add(aroTurno);
    lista = true;
    Graficos3D.configurar({ renderer, escena }, "interior");
    Graficos3D.selector(shell.querySelector(".uno-calidad"));
    window.addEventListener("resize", ajustar);
    new ResizeObserver(ajustar).observe(shell);
    const ray = new THREE.Raycaster(),
      mouse = new THREE.Vector2();
    canvas.addEventListener("click", (e) => {
      const s = Fiesta.estado;
      if (s?.fase !== "jugando" || s.turno !== Fiesta.pid || s.robo != null)
        return;
      const r = canvas.getBoundingClientRect();
      mouse.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, camara);
      if (ray.intersectObjects(mazo.children, true).length)
        window.UNOUI?.robar();
    });
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      lista = false;
      document.body.classList.remove("uno-con-3d");
      shell.hidden = true;
    });
    let anterior = performance.now();
    function frame(t) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - anterior) / 1000);
      anterior = t;
      if (!lista || shell.hidden || !shell.offsetParent || document.hidden)
        return;
      for (let i = animaciones.length - 1; i >= 0; i--) {
        const a = animaciones[i];
        if (t < a.inicio) continue;
        const k = Math.min(1, (t - a.inicio) / a.duracion),
          u = 1 - (1 - k) ** 3;
        a.g.position.lerpVectors(a.desde, a.hasta, u);
        a.g.position.y += Math.sin(k * Math.PI) * 1.55;
        a.g.rotation.set(
          Math.sin(k * Math.PI) * 0.3,
          -0.16 + Math.sin(k * Math.PI) * 0.5,
          0,
        );
        if (k === 1) {
          escena.remove(a.g);
          animaciones.splice(i, 1);
          if (a.version === version) a.alFinal?.();
        }
      }
      if (t > ahoraEfecto) efecto.classList.remove("activa");
      if (particulas) {
        const p = particulas.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          p.setY(i, p.getY(i) - dt * (0.7 + (i % 5) * 0.12));
        }
        p.needsUpdate = true;
        particulas.material.opacity = Math.max(
          0,
          (particulas.userData.fin - t) / 4000,
        );
        if (t > particulas.userData.fin) {
          escena.remove(particulas);
          particulas.geometry.dispose();
          particulas.material.dispose();
          particulas = null;
        }
      }
      renderer.render(escena, camara);
    }
    requestAnimationFrame(frame);
  } catch (_) {
    lista = false;
    shell.hidden = true;
    document.body.classList.remove("uno-con-3d");
    renderer?.dispose();
  }
  window.UNOMesa3D = {
    actualizar,
    ocultar,
    get lista() {
      return lista;
    },
    get animaciones() {
      return animaciones.length;
    },
    get renderer() {
      return renderer;
    },
  };
})();
