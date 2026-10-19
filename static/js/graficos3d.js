/* Acabados compartidos: texturas locales, iluminación y calidad sin descargas externas. */
(() => {
  "use strict";
  const mapas = new Map(),
    mundos = new Set();
  const movil = matchMedia("(pointer: coarse)").matches;
  let calidad = "auto";
  try {
    calidad = localStorage.getItem("arcade_calidad") || "auto";
  } catch (_) {}
  if (!["auto", "alta", "ahorro"].includes(calidad)) calidad = "auto";
  const semilla = () => {
    let n = 17942;
    return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
  };

  function textura(tipo, repetir = 1) {
    const clave = `${tipo}:${repetir}`;
    if (mapas.has(clave)) return mapas.get(clave);
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d"),
      r = semilla();
    const pixels = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        let v = 216 + (r() - 0.5) * 35;
        if (tipo === "tela")
          v = 205 + (x % 4 < 2 !== y % 4 < 2 ? 25 : -12) + (r() - 0.5) * 12;
        if (tipo === "metal") v = 222 + Math.sin(y * 3.1) * 9 + (r() - 0.5) * 8;
        if (tipo === "agua")
          v =
            204 +
            18 * Math.sin(x * 0.074 + 8 * Math.sin(y * 0.025)) +
            12 * Math.cos(y * 0.098 + x * 0.025);
        if (tipo === "arena")
          v =
            219 +
            9 * Math.sin(y * 0.14 + 2 * Math.sin(x * 0.025)) +
            (r() - 0.5) * 27;
        if (tipo === "madera")
          v =
            205 +
            15 * Math.sin(x * 0.12 + 2 * Math.sin(y * 0.018)) +
            7 * Math.sin(x * 0.45 + y * 0.012);
        if (tipo === "asfalto") v = 183 + (r() - 0.5) * 60;
        if (tipo === "nieve") v = 235 + (r() - 0.5) * 30;
        if (tipo === "roca")
          v =
            185 +
            22 * Math.sin(x * 0.07) * Math.cos(y * 0.09) +
            (r() - 0.5) * 35;
        const i = (y * 256 + x) * 4;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = v;
        pixels.data[i + 3] = 255;
      }
    g.putImageData(pixels, 0, 0);
    if (tipo === "cesped") {
      for (let i = 0; i < 3200; i++) {
        g.strokeStyle = r() > 0.5 ? "#a5a5a5" : "#f5f5f5";
        g.lineWidth = 0.65;
        const x = r() * 256,
          y = r() * 256;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + r() * 3 - 1.5, y - 2 - r() * 5);
        g.stroke();
      }
    }
    if (tipo === "hielo") {
      g.strokeStyle = "rgba(110,130,150,.25)";
      g.lineWidth = 0.55;
      for (let i = 0; i < 170; i++) {
        const x = r() * 256,
          y = r() * 256;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 20, y + 8, x + 40 * r(), y + 30 * r());
        g.stroke();
      }
    }
    if (tipo === "fachada") {
      g.fillStyle = "#777b86";
      g.fillRect(0, 0, 256, 256);
      for (let y = 8; y < 256; y += 24)
        for (let x = 8; x < 256; x += 20) {
          g.fillStyle = r() > 0.42 ? "#fbebbd" : "#303a51";
          g.fillRect(x, y, 9, 12);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetir, repetir);
    t.anisotropy = 4;
    // Altura y color usan copias con espacios de color independientes.
    mapas.set(clave, t);
    return t;
  }

  function material(opciones = {}) {
    const o = { ...opciones };
    if (!o.bumpMap && !o.transparent && !o.vertexColors) {
      o.bumpMap = textura((o.metalness || 0) > 0.4 ? "metal" : "micro", 2);
      o.bumpScale = (o.metalness || 0) > 0.4 ? 0.0008 : 0.0012;
    }
    return o.clearcoat != null
      ? new THREE.MeshPhysicalMaterial(o)
      : new THREE.MeshStandardMaterial(o);
  }

  const geometriaSuave = new Map();
  function cajaSuave(w, h, d, radio = 0.06) {
    const key = [w, h, d, radio].join(":");
    if (geometriaSuave.has(key)) return geometriaSuave.get(key);
    const r = Math.min(radio, w / 4, h / 4, d / 4),
      x = w / 2 - r,
      y = h / 2 - r;
    const shape = new THREE.Shape();
    shape.moveTo(-x, -y);
    shape.lineTo(x, -y);
    shape.lineTo(x, y);
    shape.lineTo(-x, y);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: d - 2 * r,
      bevelEnabled: true,
      bevelSize: r,
      bevelThickness: r,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 4,
    });
    g.translate(0, 0, -d / 2 + r);
    geometriaSuave.set(key, g);
    return g;
  }

  function superficie(
    objeto,
    tipo,
    { repetir = 4, relieve, conservarMapa = true } = {},
  ) {
    const lista = Array.isArray(objeto.material)
      ? objeto.material
      : [objeto.material];
    for (const m of lista) {
      if (!m?.isMeshStandardMaterial || !objeto.geometry?.attributes.uv)
        continue;
      m.bumpMap = textura(tipo, repetir);
      m.bumpScale =
        relieve ??
        ({
          agua: 0.018,
          hielo: 0.004,
          cesped: 0.035,
          arena: 0.055,
          roca: 0.09,
          nieve: 0.045,
          tela: 0.018,
          madera: 0.022,
          asfalto: 0.035,
          metal: 0.0015,
        }[tipo] ||
          0.02);
      if (!conservarMapa || !m.map) {
        const key = `color:${tipo}:${repetir}`;
        if (!mapas.has(key)) {
          const t = textura(tipo, repetir).clone();
          t.encoding = THREE.sRGBEncoding;
          t.needsUpdate = true;
          mapas.set(key, t);
        }
        m.map = mapas.get(key);
      }
      if (tipo === "agua") {
        m.roughness = 0.32;
        m.metalness = 0.08;
        m.envMapIntensity = 0.55;
      }
      if (tipo === "hielo") {
        m.roughness = 0.2;
        m.envMapIntensity = 0.8;
      }
      m.needsUpdate = true;
    }
    return objeto;
  }

  function ajustar(mundo) {
    const ahorro = calidad === "ahorro",
      alta = calidad === "alta";
    mundo.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        ahorro ? 1 : alta ? 2 : movil ? 1.5 : 1.75,
      ),
    );
    mundo.renderer.shadowMap.enabled = !ahorro && mundo.sombras;
    const max = ahorro ? 512 : alta ? 2048 : movil ? 1024 : 2048;
    mundo.escena.traverse((o) => {
      if (!o.isLight || !o.shadow) return;
      const size = Math.min(mundo.tamanos.get(o) || o.shadow.mapSize.x, max);
      if (o.shadow.mapSize.x !== size) {
        o.shadow.map?.dispose();
        o.shadow.map = null;
        o.shadow.mapSize.set(size, size);
      }
      o.shadow.normalBias = 0.018;
      o.shadow.radius = 3;
    });
    mundo.renderer.shadowMap.needsUpdate = true;
  }

  function elegir(valor) {
    calidad = valor;
    try {
      localStorage.setItem("arcade_calidad", valor);
    } catch (_) {}
    mundos.forEach(ajustar);
    document
      .querySelectorAll("[data-calidad-3d]")
      .forEach((s) => (s.value = valor));
  }

  function configurar(M, tema = "interior") {
    const estado = {
      ...M,
      sombras: M.renderer.shadowMap.enabled,
      tamanos: new Map(),
    };
    mundos.add(estado);
    // Se ejecuta cuando la escena del juego ya terminó de construir sus luces.
    requestAnimationFrame(() => {
      M.escena.traverse((o) => {
        if (o.isLight && o.shadow) estado.tamanos.set(o, o.shadow.mapSize.x);
      });
      ajustar(estado);
    });
    const original = M.escena.background;
    if (original?.isColor && tema !== "dinamico") {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 512;
      const g = c.getContext("2d"),
        base = "#" + original.getHexString();
      const grad = g.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(
        0,
        tema === "cielo" ? "#4585c1" : tema === "espacio" ? "#020613" : base,
      );
      grad.addColorStop(0.55, base);
      grad.addColorStop(1, tema === "cielo" ? "#f4e4d0" : base);
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 512);
      if (tema === "espacio") {
        const r = semilla();
        for (let i = 0; i < 300; i++) {
          g.fillStyle = `rgba(200,220,255,${0.2 + r() * 0.6})`;
          g.fillRect(r() * 512, r() * 512, 1, 1);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      M.escena.background = t;
    }
    // Agua animada por UV: no altera la geometría ni las colisiones.
    const aguas = new Set();
    if (M.alCuadro)
      M.alCuadro((dt) => {
        for (const m of aguas) {
          m.bumpMap.offset.x = (m.bumpMap.offset.x + dt * 0.008) % 1;
          m.bumpMap.offset.y = (m.bumpMap.offset.y + dt * 0.004) % 1;
        }
      });
    return {
      superficie(objeto, tipo, opciones) {
        superficie(objeto, tipo, opciones);
        if (tipo === "agua") {
          // Cada mar tiene su desplazamiento; nunca mueve los mapas de otros objetos.
          const materiales = Array.isArray(objeto.material)
            ? objeto.material
            : [objeto.material];
          for (const m of materiales) {
            m.bumpMap = m.bumpMap.clone();
            m.bumpMap.needsUpdate = true;
            aguas.add(m);
          }
        }
        return objeto;
      },
    };
  }

  function selector(contenedor) {
    if (!contenedor || contenedor.querySelector("[data-calidad-3d]")) return;
    const label = document.createElement("label");
    label.className = "calidad-3d";
    label.append("Gráficos ");
    const s = document.createElement("select");
    s.setAttribute("data-calidad-3d", "");
    s.setAttribute("aria-label", "Calidad de gráficos");
    for (const [v, t] of [
      ["auto", "Automática"],
      ["alta", "Alta"],
      ["ahorro", "Ahorro"],
    ]) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      s.append(o);
    }
    s.value = calidad;
    s.onchange = () => elegir(s.value);
    label.append(s);
    contenedor.append(label);
  }
  window.Graficos3D = {
    material,
    superficie,
    cajaSuave,
    configurar,
    selector,
    get calidad() {
      return calidad;
    },
  };
})();
