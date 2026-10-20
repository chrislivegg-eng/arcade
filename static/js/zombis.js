const { $, esperar, azar, limitar, lin, material, sonar } = Arcade;

let CARGADOR = 8;
let arma = { danio: 1, cargador: 8, recarga: 1.4, cadencia: 0.3 };
let catalogo = null;
const LINEA_BARRICADA = -2.2;

// =========================================================
//  ESCENA (calle de noche)
// =========================================================
const M = Arcade.mundo({
  fondo: 0x05070d,
  niebla: [22, 70],
  fov: 60,
  exposicion: 1.45,
  colorAmbiente: 0x101828,
  lamparas: [
    [0, 10, -20, 0x9fb8ff, 1.5],
    [-8, 3, 4, 0xffb060, 1],
    [8, 3, 4, 0xffb060, 1],
  ],
});
const { escena, camara } = M;
const acabado3D = Graficos3D.configurar(M, "interior");
escena.add(new THREE.HemisphereLight(0x8094c8, 0x1a1a24, 0.95));
const luna = new THREE.DirectionalLight(0xc6d6ff, 1.25);
luna.position.set(-8, 20, -25);
luna.castShadow = true;
luna.shadow.mapSize.set(1024, 1024);
Object.assign(luna.shadow.camera, {
  left: -20,
  right: 20,
  top: 25,
  bottom: -25,
  near: 1,
  far: 70,
});
escena.add(luna, luna.target);
luna.target.position.set(0, 0, -15);
const disco = new THREE.Mesh(
  new THREE.CircleGeometry(2.2, 32),
  new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }),
);
disco.position.set(-22, 30, -90);
escena.add(disco);

const texturaCalle = M.textura(256, 512, (g, w, h) => {
  g.fillStyle = "#24262e";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},0.07)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.fillStyle = "rgba(255,210,80,0.7)";
  for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 4, y, 8, 34);
});
texturaCalle.wrapT = THREE.RepeatWrapping;
texturaCalle.repeat.set(1, 6);
const calle = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 80),
  material(0xffffff, { map: texturaCalle, roughness: 0.9 }),
);
calle.rotation.x = -Math.PI / 2;
calle.position.z = -30;
calle.receiveShadow = true;
escena.add(calle);
const tierra = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  material(0x1d2a18, { roughness: 1 }),
);
tierra.rotation.x = -Math.PI / 2;
tierra.position.y = -0.02;
tierra.receiveShadow = true;
escena.add(tierra);

// casas abandonadas a los lados
const rnd = Arcade.rng(11);
for (let k = 0; k < 16; k++) {
  const lado = k % 2 ? 1 : -1;
  const alto = 3 + rnd() * 4;
  const casa = new THREE.Mesh(
    new THREE.BoxGeometry(5, alto, 6),
    material([0x3a3040, 0x2f3a3a, 0x40362a][k % 3], { roughness: 0.9 }),
  );
  casa.position.set(
    lado * (10 + rnd() * 2),
    alto / 2,
    -6 - Math.floor(k / 2) * 9,
  );
  casa.castShadow = casa.receiveShadow = true;
  escena.add(casa);
  // ventanas con luz (algunas)
  if (rnd() < 0.5) {
    const ventana = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.8),
      new THREE.MeshBasicMaterial({ color: rnd() < 0.5 ? 0xffb060 : 0x6080ff }),
    );
    ventana.position.set(
      casa.position.x - lado * 2.51,
      alto * 0.6,
      casa.position.z,
    );
    ventana.rotation.y = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
    escena.add(ventana);
  }
}
// Detailed shop fronts: masonry, boarded windows and cornices.
const fachada = M.textura(256, 256, (g, w, h) => {
  g.fillStyle = "#333940";
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 24)
    for (let x = -32; x < w; x += 64) {
      g.fillStyle = `hsl(215 8% ${19 + Math.random() * 11}%)`;
      g.fillRect(x + (y % 48 ? 32 : 0) + 1, y + 1, 61, 21);
    }
});
fachada.wrapS = fachada.wrapT = THREE.RepeatWrapping;
fachada.repeat.set(3, 3);
const edificios = [];
escena.traverse((o) => {
  if (
    o.isMesh &&
    o.geometry.type === "BoxGeometry" &&
    o.geometry.parameters.width === 5
  )
    edificios.push(o);
});
edificios.forEach((c, i) => {
  c.material.map = fachada;
  c.material.color.set(0xcccccc);
  c.material.needsUpdate = true;
  const lado = Math.sign(c.position.x),
    alto = c.geometry.parameters.height;
  const cornisa = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.18, 6.2),
    material(0x48464a),
  );
  cornisa.position.set(c.position.x, alto, c.position.z);
  escena.add(cornisa);
  for (let z of [-1.7, 1.7])
    for (let y = 1.5; y < alto - 0.3; y += 1.7) {
      const grupo = new THREE.Group();
      grupo.position.set(c.position.x - lado * 2.52, y, c.position.z + z);
      grupo.rotation.y = lado > 0 ? -Math.PI / 2 : Math.PI / 2;
      escena.add(grupo);
      const marco = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.25, 0.1),
        material(0x11191f),
      );
      grupo.add(marco);
      const cristal = new THREE.Mesh(
        new THREE.PlaneGeometry(0.88, 1.03),
        material(0x425a67, {
          metalness: 0.65,
          roughness: 0.21,
          emissive: i % 4 === 0 ? 0x45321b : 0x000000,
          emissiveIntensity: 0.3,
        }),
      );
      cristal.position.z = 0.06;
      grupo.add(cristal);
      if (i % 3 === 0) {
        const tabla = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.15, 0.08),
          matMaderaVentana(),
        );
        tabla.position.z = 0.12;
        tabla.rotation.z = 0.5;
        grupo.add(tabla);
      }
    }
});
function matMaderaVentana() {
  return material(0x514035, { roughness: 0.9 });
}
for (let k = 0; k < 9; k++) {
  const charco = new THREE.Mesh(
    new THREE.CircleGeometry(0.8 + (k % 3) * 0.3, 24),
    material(0x374555, {
      metalness: 0.65,
      roughness: 0.12,
      transparent: true,
      opacity: 0.55,
    }),
  );
  charco.rotation.x = -Math.PI / 2;
  charco.scale.set(1, 0.35, 1);
  charco.position.set((k % 2 ? 1 : -1) * (2 + (k % 3)), 0.015, -5 - k * 4);
  escena.add(charco);
}
// faroles que parpadean
const faroles = [-1, 1].map((lado, i) => {
  const poste = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8),
    material(0x222222, { metalness: 0.6 }),
  );
  poste.position.set(lado * 6.5, 2.25, -12 - i * 14);
  escena.add(poste);
  const luz = new THREE.PointLight(0xffb060, 1.4, 16, 2);
  luz.position.set(lado * 5.8, 4.4, -12 - i * 14);
  escena.add(luz);
  const foco = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc070 }),
  );
  foco.position.copy(luz.position);
  escena.add(foco);
  return { luz, foco };
});
// barricada
const matMadera = material(0xffffff, {
  map: M.textura(256, 64, (g, w, h) =>
    Arcade.dibujarMadera(g, w, h, {
      tono: 24,
      sat: 40,
      luz: 32,
      tablas: 2,
      vertical: false,
    }),
  ),
  roughness: 0.8,
});
for (let k = 0; k < 3; k++) {
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 0.15), matMadera);
  tabla.position.set(0, 0.35 + k * 0.38, LINEA_BARRICADA + 0.2);
  tabla.rotation.z = (k - 1) * 0.04;
  tabla.castShadow = true;
  escena.add(tabla);
}
[-5, -1.5, 2, 5].forEach((x) => {
  const poste = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), matMadera);
  poste.position.set(x, 0.7, LINEA_BARRICADA + 0.3);
  escena.add(poste);
});

camara.position.set(0, 2.9, 4.2);
camara.lookAt(0, 0.9, -14);
function encuadre() {
  const vertical = innerWidth < innerHeight;
  camara.fov = vertical ? 75 : 60;
  camara.position.z = vertical ? 7 : 4.2;
  camara.updateProjectionMatrix();
}
encuadre();
window.addEventListener("resize", encuadre);

escena.background = new THREE.Color(0x070c14);
Graficos3D.superficie(calle, "roca", { repetir: 14, relieve: 0.025 });
const fusil = new THREE.Group();
camara.add(fusil);
escena.add(camara);
fusil.position.set(0.34, -0.32, -0.65);
const acero = material(0x354554, { metalness: 0.85, roughness: 0.28 });
function pieza(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  fusil.add(m);
  return m;
}
pieza(new THREE.BoxGeometry(0.16, 0.16, 0.48), acero, 0, 0, 0);
pieza(
  new THREE.BoxGeometry(0.1, 0.25, 0.13),
  material(0x1c222a),
  0,
  -0.15,
  0.1,
);
const canon = pieza(
  new THREE.CylinderGeometry(0.035, 0.04, 0.32, 16),
  acero,
  0,
  0.02,
  -0.38,
);
canon.rotation.x = Math.PI / 2;
pieza(
  new THREE.BoxGeometry(0.025, 0.055, 0.06),
  material(0x6bf5bd, { emissive: 0x39ab7c }),
  0,
  0.1,
  -0.1,
);
const fogon = new THREE.PointLight(0xffb85c, 0, 5);
fogon.position.set(0, 0.02, -0.6);
fusil.add(fogon);
for (let lado of [-1, 1])
  for (let k = 0; k < 6; k++) {
    const escombro = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.25 + (k % 3) * 0.12),
      material(0x444a51),
    );
    escombro.position.set(lado * (6.3 + (k % 2) * 0.5), 0.2, -4 - k * 6);
    escombro.castShadow = true;
    escena.add(escombro);
  }
function retirar(g) {
  escena.remove(g);
  const geos = new Set(),
    mats = new Set();
  g.traverse((o) => {
    if (o.isMesh) {
      geos.add(o.geometry);
      if (o.userData.texturaPropia) o.material.map?.dispose();
      for (const m of [].concat(o.material)) mats.add(m);
    }
  });
  // Beveled arm geometries are cached by Graficos3D and shared by living enemies.
  for (const geo of geos) if (geo.type !== "ExtrudeGeometry") geo.dispose();
  for (const mat of mats) {
    mat.dispose();
  }
}

// =========================================================
//  ZOMBIS articulados
// =========================================================
const TIPOS = {
  normal: {
    vida: 3,
    vel: 1.35,
    escala: 1,
    puntos: 10,
    piel: 0x6fae5a,
    ropa: 0x3a5a8a,
  },
  corredor: {
    vida: 2,
    vel: 2.9,
    escala: 0.9,
    puntos: 15,
    piel: 0x8fbf5a,
    ropa: 0x8a3a3a,
  },
  gigante: {
    vida: 12,
    vel: 0.85,
    escala: 1.55,
    puntos: 40,
    piel: 0x5a8a4a,
    ropa: 0x3a3a3a,
  },
};
const zombis = [];
function crearZombi(tipo, id) {
  const t = TIPOS[tipo];
  const g = new THREE.Group();
  const piel = material(t.piel, {
      roughness: 0.8,
      emissive: lin(t.piel),
      emissiveIntensity: 0.18,
    }),
    ropa = material(t.ropa, {
      roughness: 0.9,
      emissive: lin(t.ropa),
      emissiveIntensity: 0.12,
    });
  const parte = (geo, mat, x, y, z, nombre) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.name = nombre || "";
    g.add(m);
    return m;
  };
  const cabeza = parte(
    new THREE.SphereGeometry(0.29, 16, 12),
    piel,
    0,
    1.75,
    0,
    "cabeza",
  );
  // ojos que brillan
  [-0.11, 0.11].forEach((x) => {
    const ojo = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.06, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff3030 }),
    );
    ojo.position.set(x, 0.04, 0.26);
    ojo.name = "cabeza";
    cabeza.add(ojo);
  });
  parte(new THREE.CylinderGeometry(0.31, 0.24, 0.75, 12), ropa, 0, 1.12, 0);
  const brazos = [-1, 1].map((l) => {
    const hombro = new THREE.Group();
    hombro.position.set(l * 0.42, 1.42, 0);
    const brazo = new THREE.Mesh(
      Graficos3D.cajaSuave(0.2, 0.2, 0.7, 0.06),
      piel,
    );
    brazo.position.z = 0.32;
    brazo.castShadow = true;
    hombro.add(brazo);
    g.add(hombro);
    return hombro;
  });
  const piernas = [-1, 1].map((l) => {
    const cadera = new THREE.Group();
    cadera.position.set(l * 0.16, 0.75, 0);
    const pierna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.1, 0.75, 10),
      material(0x2a2a35),
    );
    pierna.position.y = -0.37;
    pierna.castShadow = true;
    cadera.add(pierna);
    g.add(cadera);
    return cadera;
  });
  // barra de vida
  const fondo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x330000, fog: false }),
  );
  fondo.position.y = 2.25;
  const relleno = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x26de81, fog: false }),
  );
  relleno.position.z = 0.001;
  fondo.add(relleno);
  g.add(fondo);
  g.scale.setScalar(t.escala);
  g.rotation.y = 0;
  escena.add(g);
  const z = {
    tipo,
    id,
    g,
    brazos,
    piernas,
    barra: relleno,
    vida: t.vida,
    vidaMax: t.vida,
    vel: t.vel * azar(0.9, 1.15) * (1 + (J.oleada - 1) * 0.06),
    puntos: t.puntos,
    x: azar(
      innerWidth < innerHeight ? -2.2 : -5,
      innerWidth < innerHeight ? 2.2 : 5,
    ),
    z: -40 - azar(0, 5),
    fase: azar(0, 6),
    atacando: false,
    muerto: false,
  };
  g.traverse((o) => {
    o.userData.zombi = z;
    if (o.isMesh && o.material.isMeshStandardMaterial)
      Graficos3D.superficie(o, o.material === ropa ? "tela" : "roca", {
        repetir: 3,
        relieve: 0.012,
      });
  });
  zombis.push(z);
  return z;
}

async function matar(z, cabeza) {
  if (z.muerto || !zombis.includes(z)) return;
  const sesion = J.sesion;
  z.muerto = true;
  J.puntos += z.puntos * (cabeza ? 2 : 1);
  J.muertos++;
  J.pendientes.push(z.id);
  cobrarPendientes();
  marcador();
  sonar("choque", 0.5);
  const giro = azar(-1, 1);
  await M.animar(500, (t) => {
    z.g.rotation.x = -t * 1.45;
    z.g.rotation.z = giro * t * 0.4;
    z.g.position.y = -t * 0.2;
  });
  if (J.sesion !== sesion) return;
  await esperar(700);
  if (J.sesion !== sesion) return;
  await M.animar(400, (t) => (z.g.position.y = -0.2 - t * 1.5));
  if (J.sesion !== sesion) return;
  retirar(z.g);
  const indice = zombis.indexOf(z);
  if (indice >= 0) zombis.splice(indice, 1);
}

// chispas verdes al pegar
function chispas(punto, color = 0x7dff5a) {
  const grupo = [];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color }),
    );
    c.position.copy(punto);
    c.userData.v = new THREE.Vector3(azar(-2, 2), azar(0.5, 3), azar(-1, 2));
    escena.add(c);
    grupo.push(c);
  }
  M.animar(450, (t) => {
    grupo.forEach((c) => {
      c.position.addScaledVector(c.userData.v, 0.016);
      c.userData.v.y -= 0.15;
      c.scale.setScalar(1 - t);
    });
    if (t >= 1) grupo.forEach((c) => retirar(c));
  });
}

// =========================================================
//  CAJAS DE AYUDA (botiquín o bomba)
// =========================================================
const cajas = [];
function crearCaja() {
  if (!J.jugando) return;
  const tipo = Math.random() < 0.55 ? "vida" : "bomba";
  const c = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    material(tipo === "vida" ? 0xffffff : 0x333333, {
      emissive: lin(tipo === "vida" ? 0xff3b3b : 0xff8a00),
      emissiveIntensity: 0.35,
    }),
  );
  const marca = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({
      map: M.textura(64, 64, (g) => {
        g.font = "48px Arial";
        g.textAlign = "center";
        g.fillText(tipo === "vida" ? "➕" : "💣", 32, 50);
      }),
      transparent: true,
    }),
  );
  marca.position.z = 0.36;
  marca.userData.texturaPropia = true;
  c.add(marca);
  c.position.set(azar(-4, 4), 2.6, azar(-14, -7));
  c.userData.caja = { tipo, malla: c, vida: 7 };
  marca.userData.caja = c.userData.caja;
  escena.add(c);
  cajas.push(c.userData.caja);
}

// =========================================================
//  DISPARAR (tocar)
// =========================================================
function actualizarBalas() {
  $("balas").textContent = J.recargando
    ? "🔄 recargando…"
    : `🔫 ${J.balas}/${CARGADOR}`;
}
function recargar() {
  if (!J.jugando || J.pausado || J.recargando || J.balas === CARGADOR) return;
  J.recargando = true;
  actualizarBalas();
  sonar("click");
  programar(() => {
    J.balas = CARGADOR;
    J.recargando = false;
    actualizarBalas();
    sonar("click");
  }, arma.recarga * 1000);
}
function disparar(px, py) {
  if (!J.jugando || J.pausado || J.recargando || J.reloj < J.proximoTiro)
    return;
  J.proximoTiro = J.reloj + arma.cadencia * 1000;
  fogon.intensity = 4;
  fusil.rotation.x = -0.09;
  if (J.balas <= 0) return recargar();
  J.balas--;
  actualizarBalas();
  sonar("golpe", 0.9);
  sonar("swoosh", 0.3);
  const mira = $("mira-zombi");
  mira.style.left = px + "px";
  mira.style.top = py + "px";
  mira.classList.add("ver");
  setTimeout(() => mira.classList.remove("ver"), 60);
  // retroceso de la cámara
  camara.position.y += 0.04;
  const rayo = M.pantallaARayo(px, py);
  const objetos = [];
  zombis.forEach(
    (z) =>
      !z.muerto &&
      z.g.traverse(
        (o) =>
          o.isMesh && o.geometry.type !== "PlaneGeometry" && objetos.push(o),
      ),
  );
  cajas.forEach((c) => objetos.push(c.malla));
  const golpe = rayo.intersectObjects(objetos, true)[0];
  if (golpe && golpe.object.userData.caja) {
    usarCaja(golpe.object.userData.caja);
  } else if (golpe && golpe.object.userData.zombi) {
    const z = golpe.object.userData.zombi;
    const cabeza = golpe.object.name === "cabeza";
    z.vida -= arma.danio * (cabeza ? 2 : 1);
    chispas(golpe.point);
    if (cabeza) sonar("ping", 1);
    z.z -= 0.35; // lo empuja tantito
    if (z.vida <= 0) matar(z, cabeza);
  }
  if (J.balas === 0) programar(recargar, 200);
}
function usarCaja(c) {
  retirar(c.malla);
  cajas.splice(cajas.indexOf(c), 1);
  if (c.tipo === "vida") {
    J.vida = Math.min(100, J.vida + 35);
    ui.avisar("➕ ¡Vida!", "#26de81");
    sonar("perfecto", 1.4);
  } else {
    ui.avisar("💣 ¡BOOM!", "#ff8a00");
    sonar("choque", 1.3);
    zombis
      .filter((z) => !z.muerto && z.z > -30)
      .forEach((z) => {
        chispas(z.g.position.clone().setY(1.2), 0xff8a00);
        matar(z, false);
      });
  }
  actualizarVida();
}

// tocar = disparar; deslizar hacia abajo = recargar
let toque = null;
M.lienzo.addEventListener("pointerdown", (e) => {
  toque = {
    x: e.clientX,
    y: e.clientY,
    inicioY: e.clientY,
    id: e.pointerId,
    t: performance.now(),
  };
  M.lienzo.setPointerCapture(e.pointerId);
  disparar(e.clientX, e.clientY);
});
M.lienzo.addEventListener("pointerup", (e) => {
  if (toque && e.clientY - toque.inicioY > 80) recargar();
  toque = null;
});
M.lienzo.addEventListener("pointermove", (e) => {
  if (toque?.id === e.pointerId) {
    toque.x = e.clientX;
    toque.y = e.clientY;
    if (e.clientY - toque.inicioY > 80) {
      toque = null;
      recargar();
    }
  }
});
for (const evt of ["pointercancel", "lostpointercapture"])
  M.lienzo.addEventListener(evt, () => (toque = null));
window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") recargar();
});

// =========================================================
//  PARTIDA
// =========================================================
const J = {
  modo: null,
  nombres: [],
  jugando: false,
  puntos: 0,
  vida: 100,
  balas: CARGADOR,
  recargando: false,
  oleada: 0,
  muertos: 0,
  porSalir: [],
  partida: 0,
  rival: 0,
  rivalTermino: false,
  sesion: 0,
};
function programar(accion, demora) {
  J.tareas.push({ accion, cuando: J.reloj + demora });
}
function actualizarVida() {
  $("vida").style.width = Math.max(0, J.vida) + "%";
}
function marcador() {
  if (J.modo === "online") {
    const yo = ui.yo;
    const v = yo === 0 ? [J.puntos, J.rival] : [J.rival, J.puntos];
    ui.marcador(
      [0, 1].map((i) => ({
        nombre: J.nombres[i] + (i === yo ? " (tú)" : ""),
        valor: v[i],
        detalle:
          i === yo
            ? `Oleada ${J.oleada}`
            : J.rivalTermino
              ? "💀 cayó"
              : "🌐 en vivo",
        activo: i === yo,
      })),
    );
    if (performance.now() - (J.ultimoEnvio || 0) > 500) {
      J.ultimoEnvio = performance.now();
      ui.enviar("puntos", { partida: J.partida, puntos: J.puntos });
    }
  } else
    ui.marcador([
      {
        nombre: J.nombres[0],
        valor: J.puntos,
        detalle: `Oleada ${J.oleada} · ${J.muertos} 🧟`,
        activo: true,
      },
      null,
    ]);
}

async function siguienteOleada() {
  if (J.cargando) return;
  const sesion = J.sesion;
  J.cargando = true;
  $("continuar-z").disabled = true;
  try {
    await J.contexto;
    await cobrarPendientes();
    if (J.pendientes.length)
      throw Error("Falta guardar recompensas. Reintenta la conexión.");
    const d = await api("oleada", { partida: J.token, oleada: J.oleada + 1 });
    if (sesion !== J.sesion) return;
    aplicar(d);
    J.oleada++;
    J.entreOleadas = false;
    J.pausado = false;
    J.porSalir = d.enemigos.filter((e) => !e.cobrada);
    J.balas = CARGADOR;
    J.recargando = false;
    J.tareas = [];
    J.siguienteSalida = J.reloj + 1200;
    J.intervalo = Math.max(450, 1900 - J.oleada * 150);
    $("armeria-z").close();
    actualizarBalas();
    marcador();
    ui.avisar(`Oleada ${J.oleada}`, "#7dff5a");
    if (J.oleada > 1) programar(crearCaja, 4000);
  } catch (e) {
    if (sesion === J.sesion) {
      abrirArmeria();
      $("mensaje-z").textContent = e.message;
    }
  } finally {
    if (sesion === J.sesion) {
      J.cargando = false;
      $("continuar-z").disabled = false;
    }
  }
}

let golpeado = 0;
M.alCuadro((dt, ahora) => {
  const t = ahora / 1000;
  fogon.intensity *= Math.exp(-dt * 28);
  fusil.rotation.x *= Math.exp(-dt * 14);
  if (J.jugando && J.pausado) return;
  faroles.forEach((f, i) => {
    const parpadeo = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 0.9 + Math.sin(t * 2 + i) * 0.1;
    f.luz.intensity = 1.4 * parpadeo;
  });
  // la cámara respira un poquito
  const baseY = 2.9 + Math.sin(t * 1.3) * 0.02;
  camara.position.y += (baseY - camara.position.y) * Math.min(1, dt * 10);
  camara.position.x = Math.sin(t * 0.7) * 0.04;
  camara.lookAt(0, 0.9, -14);
  cajas.forEach((c) => {
    c.malla.rotation.y += dt * 1.5;
    c.malla.position.y = 2.6 + Math.sin(t * 2) * 0.15;
    c.vida -= dt;
    if (c.vida <= 0) {
      retirar(c.malla);
      cajas.splice(cajas.indexOf(c), 1);
    }
  });

  if (!J.jugando) return;
  J.reloj += dt * 1000;
  if (toque && performance.now() - toque.t > 200) disparar(toque.x, toque.y);
  for (const tarea of J.tareas.slice())
    if (J.reloj >= tarea.cuando) {
      J.tareas.splice(J.tareas.indexOf(tarea), 1);
      tarea.accion();
    }
  if (J.porSalir.length && J.reloj > J.siguienteSalida) {
    const enemigo = J.porSalir.shift();
    crearZombi(enemigo.tipo, enemigo.id);
    J.siguienteSalida = J.reloj + J.intervalo * azar(0.6, 1.3);
  }
  let atacan = 0;
  for (const z of zombis) {
    if (z.muerto) continue;
    z.fase += dt * z.vel * 3.2;
    const limite = LINEA_BARRICADA - 0.45 * TIPOS[z.tipo].escala;
    if (z.z < limite) {
      z.z = Math.min(limite, z.z + z.vel * dt);
      z.x += (Math.sin(z.fase * 0.3) * 0.2 - z.x * 0.02) * dt;
      z.piernas.forEach(
        (p, i) => (p.rotation.x = Math.sin(z.fase + i * Math.PI) * 0.6),
      );
      z.brazos.forEach(
        (b, i) => (b.rotation.x = -0.15 + Math.sin(z.fase * 0.5 + i) * 0.12),
      );
    } else {
      // golpea la barricada
      atacan++;
      z.brazos.forEach(
        (b, i) => (b.rotation.x = -0.6 + Math.sin(t * 9 + i * Math.PI) * 0.6),
      );
      z.piernas.forEach((p) => (p.rotation.x = 0));
    }
    z.g.position.x = z.x;
    z.g.position.z = z.z;
    z.g.position.y = Math.abs(Math.sin(z.fase)) * 0.05;
    z.g.rotation.z = Math.sin(z.fase * 0.5) * 0.08;
    z.barra.scale.x = Math.max(0.001, z.vida / z.vidaMax);
    z.barra.position.x = -0.35 * (1 - z.barra.scale.x);
    z.barra.parent.lookAt(camara.position);
  }
  if (atacan) {
    J.vida -= atacan * 7 * dt;
    actualizarVida();
    golpeado -= dt;
    if (golpeado <= 0) {
      golpeado = 0.8;
      $("danio").classList.add("pegado");
      setTimeout(() => $("danio").classList.remove("pegado"), 120);
      sonar("golpe", 0.4);
    }
    if (J.vida <= 0) return perder();
  }
  if (
    !J.porSalir.length &&
    !zombis.some((z) => !z.muerto) &&
    !J.entreOleadas &&
    !J.cargando &&
    J.oleada > 0
  ) {
    J.entreOleadas = true;
    J.puntos += 25 * J.oleada;
    marcador();
    ui.avisar(
      `✅ ¡Oleada ${J.oleada} superada!<small>+${25 * J.oleada}</small>`,
      "#26de81",
    );
    programar(() => {
      if (J.jugando) abrirArmeria();
    }, 2800);
  }
});

// =========================================================
//  INTERFAZ
// =========================================================
const ui = Arcade.ui({
  juego: "zombis",
  titulo: "Zombis · Última guardia",
  emoji: "🧟",
  subtitulo: "Defiende la barricada. Cobra cada baja. Mejora tu arsenal.",
  modos: ["solo", "online"],
  textosModo: { online: "🌐 Carrera online (quién hace más puntos)" },
  records: true,
  unidadRecord: "pts",
  reglas: [
    "<b>Toca</b> a los zombis para dispararles. A la cabeza hace doble daño 🎯",
    "Recarga con R, el botón o deslizando hacia abajo. Mejora daño, cargador, recarga y cadencia entre oleadas.",
    "Cada baja da monedas: normal 3 · corredor 5 · gigante 12. Las mejoras se guardan en tu perfil.",
    "Si llegan a la barricada te quitan vida ❤️",
    "Corredores 🏃 son rápidos · los gigantes 🦍 aguantan mucho.",
    "Dispárale a las cajas que flotan: ➕ te cura · 💣 explota a los zombis cercanos.",
  ],
  alEmpezar: empezar,
  alSalir: limpiar,
});
ui.alEvento = (tipo, datos) => {
  if (!datos || datos.partida !== J.partida) return;
  if (tipo === "puntos" || tipo === "fin") J.rival = datos.puntos;
  if (tipo === "fin") {
    J.rivalTermino = true;
    J.alTerminarRival && J.alTerminarRival();
  }
  if (J.modo === "online") marcador();
};

function limpiar() {
  J.sesion++;
  J.tareas = [];
  J.pendientes = [];
  J.pausado = false;
  J.finPendiente = false;
  toque = null;
  $("armeria-z").close();
  if (J.alTerminarRival) {
    J.alTerminarRival();
    J.alTerminarRival = null;
  }
  J.jugando = false;
  J.modo = null;
  zombis.slice().forEach((z) => retirar(z.g));
  zombis.length = 0;
  cajas.slice().forEach((c) => retirar(c.malla));
  cajas.length = 0;
  $("estado-jugador").classList.add("oculto");
  $("danio").classList.remove("pegado");
}

function empezar(modo, info) {
  limpiar();
  Object.assign(J, {
    modo,
    nombres: info.nombres,
    partida: info.partida,
    puntos: 0,
    vida: 100,
    balas: CARGADOR,
    recargando: false,
    oleada: 0,
    muertos: 0,
    porSalir: [],
    rival: 0,
    rivalTermino: false,
    alTerminarRival: null,
    entreOleadas: true,
    jugando: true,
    pausado: true,
    reloj: 0,
    proximoTiro: 0,
    tareas: [],
    pendientes: [],
    cobrando: null,
    cargando: false,
    token: null,
  });
  $("estado-jugador").classList.remove("oculto");
  actualizarVida();
  actualizarBalas();
  ui.ayuda("👆 Toca a los zombis para dispararles");
  programar(() => ui.ayuda(""), 4000);
  const sesion = J.sesion;
  J.contexto = Promise.resolve(info.perfil).then(async (c) => {
    if (!c) throw Error("No se pudo conectar el perfil. Recarga la página.");
    const token = await c.lista;
    if (!token)
      throw Error("No se pudo iniciar la partida. Recarga la página.");
    if (sesion === J.sesion) {
      J.token = token;
      J.ctx = c;
    }
  });
  J.contexto.catch(() => {});
  abrirArmeria();
}

async function perder() {
  if (!J.jugando) return;
  const sesion = J.sesion;
  J.jugando = false;
  await cobrarPendientes();
  if (J.sesion !== sesion) return;
  if (J.pendientes.length) {
    J.finPendiente = true;
    $("armeria-z").showModal();
    $("mejoras-z").replaceChildren();
    $("mensaje-z").textContent =
      "Falta guardar " +
      J.pendientes.length +
      " recompensas. Revisa la conexión y reintenta antes de salir.";
    $("continuar-z").textContent = "Reintentar guardado";
    return;
  }
  $("armeria-z").close();
  sonar("perder");
  ui.avisar("💀 ¡Te alcanzaron!", "#ff3b3b");
  await esperar(1800);
  if (J.sesion !== sesion) return;
  $("estado-jugador").classList.add("oculto");
  if (J.modo === "online") {
    ui.enviar("fin", { partida: J.partida, puntos: J.puntos });
    if (!J.rivalTermino) {
      ui.avisar("Tu rival sigue vivo…", "#4fb3ff");
      await Promise.race([
        new Promise((r) => (J.alTerminarRival = r)),
        esperar(120000),
      ]);
      if (J.sesion !== sesion) return;
    }
    const gane = J.puntos > J.rival,
      empate = J.puntos === J.rival;
    return ui.terminar({
      emoji: empate ? "🤝" : gane ? "🏆" : "🧟",
      texto: empate
        ? "¡Empate!"
        : gane
          ? "¡Hiciste más puntos!"
          : `Ganó ${J.nombres[1 - ui.yo]}`,
      nota: `Tú: ${J.puntos} · Rival: ${J.rival} · llegaste a la oleada ${J.oleada}`,
      record: J.puntos,
    });
  }
  ui.terminar({
    emoji: "🧟",
    texto: `${J.puntos} puntos`,
    nota: `Llegaste a la oleada ${J.oleada} y eliminaste ${J.muertos} zombis`,
    record: J.puntos,
  });
}

async function api(ruta, datos) {
  await perfilListo;
  if (!window.Perfil)
    throw Error("No se pudo cargar el perfil. Recarga la página.");
  const ctl = new AbortController(),
    timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(
      "/api/zombis/" +
        ruta +
        (datos ? "" : "?pid=" + encodeURIComponent(Perfil.pid)),
      datos
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pid: Perfil.pid, ...datos }),
            signal: ctl.signal,
          }
        : { signal: ctl.signal },
    );
    const d = await r.json();
    if (!r.ok) {
      if (d.arma) aplicar(d);
      throw Error(d.error || "No se pudo guardar");
    }
    return d;
  } finally {
    clearTimeout(timer);
  }
}
function aplicar(d) {
  catalogo = d;
  arma = d.arma;
  CARGADOR = arma.cargador;
  $("monedas-z").textContent = "🪙 " + (d.infinitas ? "∞" : d.monedas);
}
function pintarArmeria() {
  const lista = $("mejoras-z");
  lista.replaceChildren();
  if (!catalogo) return;
  $("saldo-z").textContent =
    `${catalogo.infinitas ? "∞" : catalogo.monedas} monedas · mejoras permanentes`;
  for (const m of catalogo.mejoras) {
    const b = document.createElement("button");
    b.textContent = `${m.nombre} ${m.nivel}/5 · ${m.precio === null ? "MÁXIMO" : m.precio + " 🪙"}`;
    b.disabled =
      !J.entreOleadas ||
      m.precio === null ||
      (!catalogo.infinitas && catalogo.monedas < m.precio) ||
      J.comprando;
    b.onclick = async () => {
      J.comprando = true;
      pintarArmeria();
      try {
        aplicar(await api("arsenal", { mejora: m.id, nivel: m.nivel }));
        Perfil.cargar();
        $("mensaje-z").textContent = "Mejora guardada.";
      } catch (e) {
        $("mensaje-z").textContent = e.message;
      } finally {
        J.comprando = false;
        pintarArmeria();
      }
    };
    lista.append(b);
  }
}
async function abrirArmeria() {
  if (!J.jugando) return;
  J.pausado = true;
  toque = null;
  if (!$("armeria-z").open) $("armeria-z").showModal();
  $("continuar-z").textContent = J.entreOleadas
    ? "Comenzar oleada " + (J.oleada + 1)
    : "Reanudar";
  $("mensaje-z").textContent = J.entreOleadas
    ? "Compra mejoras antes de volver a la barricada."
    : "En pausa. Compra mejoras al terminar la oleada.";
  const sesion = J.sesion;
  try {
    const d = await api("arsenal");
    if (sesion === J.sesion) {
      aplicar(d);
      pintarArmeria();
    }
  } catch (e) {
    $("mensaje-z").textContent = e.message;
  }
}
function cobrarPendientes() {
  if (J.cobrando) return J.cobrando;
  const pendientes = J.pendientes,
    token = J.token,
    sesion = J.sesion;
  const tarea = (async () => {
    while (pendientes.length) {
      let d = null;
      for (let i = 0; i < 3 && !d; i++) {
        try {
          d = await api("baja", { partida: token, enemigo: pendientes[0] });
        } catch (e) {
          if (i < 2) await esperar(400);
        }
      }
      if (!d) break;
      pendientes.shift();
      if (sesion === J.sesion) {
        aplicar(d);
        if (d.ganadas)
          $("premio-z").textContent =
            `+${d.ganadas} monedas · ${J.muertos} bajas`;
      }
    }
  })();
  J.cobrando = tarea.finally(() => {
    if (sesion === J.sesion) J.cobrando = null;
  });
  if (J.ctx) J.ctx.cola = J.ctx.cola.then(() => tarea);
  return J.cobrando;
}
$("continuar-z").onclick = () => {
  if (J.comprando) return;
  if (J.finPendiente) {
    J.finPendiente = false;
    J.jugando = true;
    $("armeria-z").close();
    perder();
    return;
  }
  if (J.entreOleadas) siguienteOleada();
  else {
    J.pausado = false;
    $("armeria-z").close();
  }
};
$("pausa-z").onclick = abrirArmeria;
$("recarga-z").onclick = recargar;
$("armeria-z").addEventListener("cancel", (e) => e.preventDefault());
document.addEventListener("visibilitychange", () => {
  if (document.hidden && J.jugando) abrirArmeria();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && J.jugando) abrirArmeria();
});
