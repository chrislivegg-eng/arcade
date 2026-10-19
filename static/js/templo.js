/* Umbra: escenario, controles y acertijos propios. Sin recursos remotos. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    random = Arcade.rng(817263);
  const rango = (a, b) => a + random() * (b - a),
    clamp = Arcade.limitar;
  const movimientoReducido = matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const SIMBOLOS = ["☾", "☀", "✦"],
    NOMBRES = ["Luna", "Sol", "Estrella"];
  const SOLUCION_SOL = [1, 0, 2],
    SOLUCION_LUNA = [0, 1, 2, 0];
  const areas = [
    [-8, 8, -23, 13],
    [-19, -8, -10, 0],
    [8, 19, -18, -8],
    [-6, 6, -33, -23],
  ];
  let M;
  try {
    M = Arcade.mundo({
      fondo: 0x1d2c29,
      niebla: [9, 55],
      fov: 67,
      exposicion: 1.04,
      colorAmbiente: 0x52635b,
      lejos: 130,
      lamparas: [
        [0, 12, -9, 0xc2dcc9, 2.2],
        [-12, 3, -5, 0xf9a557, 1.2],
        [12, 3, -13, 0x87d5cb, 1.2],
      ],
    });
  } catch (_) {
    const aviso = document.createElement("div");
    aviso.style.cssText =
      "max-width:420px;padding:28px;letter-spacing:0;line-height:1.7";
    const titulo = document.createElement("h2");
    titulo.textContent = "No se pudo iniciar la vista 3D";
    const mensaje = document.createElement("p");
    mensaje.textContent =
      "Comprueba que la aceleración gráfica de tu navegador esté activada e intenta de nuevo.";
    const volver = document.createElement("a");
    volver.href = "/secreto";
    volver.className = "secundario";
    volver.textContent = "Volver al arcade";
    aviso.append(titulo, mensaje, volver);
    $("cargando").replaceChildren(aviso);
    return;
  }
  const { escena, camara } = M;
  const acabado = Graficos3D.configurar(M, "interior");
  escena.fog = new THREE.FogExp2(0x22352e, 0.026);
  const textura = (size, fn, srgb = true) => M.textura(size, size, fn, srgb);
  const color = Arcade.lin;
  const rayo = new THREE.Raycaster(),
    centro = new THREE.Vector2();
  const interactivos = [],
    colisiones = [],
    llamas = [],
    discos = [],
    estatuas = [];
  let estado,
    activa = false,
    iniciando = false,
    contexto = null,
    objetivo = null,
    relojGuardado = 0,
    avisoHasta = 0,
    tokenVisita = 0;
  let clave = "",
    cache = null,
    sonido = true,
    paso = 0,
    nombreExpedicion = "Explorador";
  const teclas = new Set(),
    mando = { x: 0, y: 0 },
    mirada = { id: null, x: 0, y: 0 };
  const nuevo = () => ({
    version: 1,
    pos: [0, 8],
    yaw: 0,
    pitch: 0,
    sol: [0, 0, 0],
    luna: [],
    agua: [false, true, false, true],
    sellos: [false, false, false],
    notas: [],
    segundos: 0,
    terminada: false,
  });
  estado = nuevo();

  // Piedra con vetas, fracturas y poros. La textura no depende de fotografías externas.
  const piedra = textura(512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const veta =
          Math.sin(x * 0.039 + Math.sin(y * 0.017) * 3) * 4 +
          Math.cos(y * 0.07 + x * 0.012) * 3;
        const v = 141 + veta + rango(-15, 15),
          i = (y * w + x) * 4;
        img.data[i] = v * 1.04;
        img.data[i + 1] = v;
        img.data[i + 2] = v * 0.88;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 9; i++) {
      let x = rango(0, w),
        y = rango(0, h);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += rango(-22, 24);
        y += rango(8, 28);
        g.lineTo(x, y);
      }
      g.strokeStyle = "rgba(42,45,32,.24)";
      g.lineWidth = 0.7;
      g.stroke();
    }
  });
  piedra.wrapS = piedra.wrapT = THREE.RepeatWrapping;
  piedra.repeat.set(0.8, 0.8);
  const relievePiedra = piedra.clone();
  relievePiedra.encoding = THREE.LinearEncoding;
  relievePiedra.needsUpdate = true;
  const musgo = textura(256, (g, w, h) => {
    g.fillStyle = "#44543a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = `rgba(${Math.floor(rango(55, 100))},${Math.floor(rango(90, 145))},45,${rango(0.2, 0.7)})`;
      g.fillRect(rango(0, w), rango(0, h), rango(1, 4), rango(1, 4));
    }
  });
  const matPiedra = Arcade.materialPBR({
    color: color(0xb9b39a),
    map: piedra,
    bumpMap: relievePiedra,
    bumpScale: 0.065,
    roughness: 0.94,
  });
  const matSuelo = matPiedra.clone();
  matSuelo.color = color(0x9c9e85);
  matSuelo.bumpScale = 0.035;
  const matMusgo = Arcade.materialPBR({
    color: color(0x79875a),
    map: musgo,
    roughness: 1,
    bumpMap: relievePiedra,
    bumpScale: 0.04,
  });
  const bronce = Arcade.materialPBR({
    color: color(0x9a783b),
    metalness: 0.76,
    roughness: 0.34,
  });
  const oro = Arcade.materialPBR({
    color: color(0xe2b961),
    metalness: 0.83,
    roughness: 0.25,
  });
  const oscuro = Arcade.materialPBR({ color: color(0x242d27), roughness: 0.9 });
  const prisma = Arcade.materialPBR({
    color: color(0x8bd6bd),
    emissive: color(0x4cae96),
    emissiveIntensity: 0.7,
    metalness: 0.45,
    roughness: 0.16,
  });
  function caja(w, h, d, mat, x, y, z, radio = 0.04) {
    const m = new THREE.Mesh(Graficos3D.cajaSuave(w, h, d, radio), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function agregar(mesh) {
    escena.add(mesh);
    return mesh;
  }
  const temp = new THREE.Object3D();
  function instancias(geo, mat, datos) {
    const m = new THREE.InstancedMesh(geo, mat, datos.length);
    m.castShadow = m.receiveShadow = true;
    datos.forEach((d, i) => {
      temp.position.set(d.x, d.y, d.z);
      temp.rotation.set(0, d.rot || 0, 0);
      temp.scale.set(d.sx || 1, d.sy || 1, d.sz || 1);
      temp.updateMatrix();
      m.setMatrixAt(i, temp.matrix);
      m.setColorAt(i, new THREE.Color().setScalar(d.tono || 1));
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
    agregar(m);
    return m;
  }

  // Los bloques y las losas se agrupan: cientos de piezas conservan sus cantos reales.
  const bloques = [],
    losas = [];
  function muro(x, z, largo, rot = 0, alto = 4.9) {
    const filas = Math.floor(alto / 0.55),
      n = Math.ceil(largo / 1.8),
      ancho = largo / n;
    colisiones.push({
      x,
      z,
      rx: rot ? 0.39 : largo / 2,
      rz: rot ? largo / 2 : 0.39,
      pared: true,
    });
    for (let f = 0; f < filas; f++)
      for (let i = 0; i < n; i++) {
        const u = -largo / 2 + (i + 0.5) * ancho;
        bloques.push({
          x: x + Math.cos(rot) * u,
          y: 0.28 + f * 0.55,
          z: z - Math.sin(rot) * u,
          rot,
          sx: ancho - 0.035,
          tono: rango(0.76, 1.15),
        });
      }
    agregar(
      caja(largo + 0.2, 0.23, 0.94, matMusgo, x, filas * 0.55 + 0.1, z),
    ).rotation.y = rot;
  }
  function pavimento(x0, x1, z0, z1) {
    for (let x = x0 + 0.99; x < x1; x += 2)
      for (let z = z0 + 0.99; z < z1; z += 2)
        losas.push({ x, y: -0.12, z, sx: 1, tono: rango(0.7, 1.08) });
  }
  for (const a of areas) pavimento(...a);
  // Fachadas laterales: se dejan libres las entradas reales de las cámaras.
  muro(-8, 6.5, 13, Math.PI / 2);
  muro(-8, -1.5, 3, Math.PI / 2);
  muro(-8, -15, 16, Math.PI / 2);
  muro(8, 1, 24, Math.PI / 2);
  muro(8, -19, 8, Math.PI / 2);
  muro(0, 13, 16);
  muro(-5, -23, 6);
  muro(5, -23, 6);
  muro(-19, -5, 10, Math.PI / 2);
  muro(-13.5, 0, 11);
  muro(-13.5, -10, 11);
  muro(19, -13, 10, Math.PI / 2);
  muro(13.5, -8, 11);
  muro(13.5, -18, 11);
  muro(-6, -28, 10, Math.PI / 2, 6);
  muro(6, -28, 10, Math.PI / 2, 6);
  muro(0, -33, 12, 0, 6);
  instancias(Graficos3D.cajaSuave(1, 0.52, 0.72, 0.035), matPiedra, bloques);
  instancias(Graficos3D.cajaSuave(1.96, 0.16, 1.96, 0.035), matSuelo, losas);
  // Cimientos bajo juntas y agua.
  for (const [a, b, c, d] of areas)
    agregar(caja(b - a, 0.3, d - c, oscuro, (a + b) / 2, -0.35, (c + d) / 2));
  const columnas = [];
  for (const x of [-5.9, 5.9])
    for (const z of [8, 1, -6, -13, -20]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.add(caja(1.2, 0.28, 1.2, matPiedra, 0, 0.15, 0));
      const cuerpo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.47, 4.2, 12, 1),
        matPiedra,
      );
      cuerpo.position.y = 2.35;
      cuerpo.castShadow = cuerpo.receiveShadow = true;
      g.add(cuerpo);
      for (let y = 0.6; y < 4.5; y += 0.65) {
        const aro = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.027, 5, 16),
          bronce,
        );
        aro.rotation.x = Math.PI / 2;
        aro.position.y = y;
        g.add(aro);
      }
      g.add(caja(1.1, 0.3, 1.1, matMusgo, 0, 4.55, 0));
      agregar(g);
      columnas.push(g);
      colisiones.push({ x, z, rx: 0.62, rz: 0.62 });
    }
  // Dinteles y fragmentos de techo: la luz entra por los huecos.
  for (const z of [8, 1, -13, -20])
    agregar(caja(13, 0.42, 0.9, matPiedra, 0, 4.9, z));
  for (const x of [-6.7, 6.7])
    agregar(caja(1.1, 0.28, 34, matMusgo, x, 5.1, -5));
  // Guardianes tallados: plintos, túnicas, capuchas y lámparas ceremoniales.
  for (const x of [-3.8, 3.8]) {
    const g = new THREE.Group();
    g.position.set(x, 0, -21.1);
    g.add(caja(1.3, 0.3, 1.3, matMusgo, 0, 0.15, 0));
    const tunica = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.52, 1.35, 10),
      matPiedra,
    );
    tunica.position.y = 0.98;
    tunica.castShadow = true;
    g.add(tunica);
    const cabeza = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3, 2),
      matPiedra,
    );
    cabeza.position.set(0, 1.95, 0.08);
    g.add(cabeza);
    const capucha = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.13, 6, 18, Math.PI * 1.65),
      matMusgo,
    );
    capucha.rotation.z = -0.32;
    capucha.position.set(0, 2, 0.04);
    g.add(capucha);
    for (const lado of [-1, 1]) {
      const brazo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.75, 8),
        matPiedra,
      );
      brazo.position.set(lado * 0.4, 1.35, 0.17);
      brazo.rotation.z = lado * 0.55;
      brazo.rotation.x = -0.3;
      g.add(brazo);
    }
    const cuenco = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.14, 0.2, 16),
      bronce,
    );
    cuenco.position.set(0, 1.12, 0.5);
    g.add(cuenco);
    const luz = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), prisma);
    luz.position.set(0, 1.4, 0.5);
    g.add(luz);
    agregar(g);
    colisiones.push({ x, z: -21.1, rx: 0.68, rz: 0.68 });
  }
  const arco = new THREE.Group();
  arco.add(
    caja(1, 5, 1.3, matPiedra, -2.7, 2.5, -23),
    caja(1, 5, 1.3, matPiedra, 2.7, 2.5, -23),
    caja(6.5, 0.7, 1.4, matPiedra, 0, 5, -23),
  );
  agregar(arco);
  const puerta = agregar(caja(4.5, 4.6, 0.48, oscuro, 0, 2.3, -23));
  for (const x of [-1.3, 0, 1.3])
    puerta.add(caja(0.06, 4.1, 0.08, bronce, x, 0, 0.28));

  // Jardín interior: hojas recortadas, raíces y piedras bajo la humedad.
  const hoja = textura(128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#91af55";
    g.beginPath();
    g.moveTo(w * 0.5, h);
    g.bezierCurveTo(-w * 0.3, h * 0.4, w * 0.35, -h * 0.3, w * 0.5, 0);
    g.bezierCurveTo(w * 1.3, h * 0.4, w * 0.8, h * 0.8, w * 0.5, h);
    g.fill();
    g.strokeStyle = "#d4c989";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w * 0.5, h);
    g.lineTo(w * 0.5, 8);
    g.stroke();
  });
  const hojas = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.42, 0.62),
    new THREE.MeshStandardMaterial({
      map: hoja,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
    700,
  );
  let nh = 0;
  for (const x of [-7.5, 7.5])
    for (const z of [6, -2, -10, -18]) {
      const puntos = [];
      for (let i = 0; i < 8; i++)
        puntos.push(
          new THREE.Vector3(
            x + Math.sin(i * 0.8) * 0.2,
            5.4 - i * 0.7,
            z + Math.cos(i) * 0.18,
          ),
        );
      const raiz = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(puntos),
          16,
          0.035,
          5,
          false,
        ),
        matMusgo,
      );
      agregar(raiz);
      for (let i = 0; i < 65; i++) {
        temp.position.set(
          x + rango(-0.45, 0.45),
          rango(0.2, 5.4),
          z + rango(-0.65, 0.65),
        );
        temp.rotation.set(
          rango(-0.7, 0.7),
          rango(0, Math.PI * 2),
          rango(-1, 1),
        );
        temp.scale.setScalar(rango(0.55, 1.4));
        temp.updateMatrix();
        hojas.setMatrixAt(nh++, temp.matrix);
      }
    }
  for (; nh < 700; nh++) {
    temp.position.set(rango(-7, 7), 0.05, rango(-21, 11));
    temp.rotation.set(-Math.PI / 2, rango(0, 6), rango(0, 6));
    temp.scale.setScalar(rango(0.4, 0.8));
    temp.updateMatrix();
    hojas.setMatrixAt(nh, temp.matrix);
  }
  hojas.instanceMatrix.needsUpdate = true;
  agregar(hojas);
  const rocas = [];
  for (let i = 0; i < 65; i++) {
    const lado = random() > 0.5 ? 1 : -1;
    rocas.push({
      x: lado * rango(6.7, 7.5),
      y: 0.1,
      z: rango(-21, 11),
      sx: rango(0.15, 0.45),
      sy: rango(0.1, 0.35),
      sz: rango(0.15, 0.4),
      rot: rango(0, 6),
      tono: rango(0.65, 0.95),
    });
  }
  instancias(new THREE.DodecahedronGeometry(1, 0), matMusgo, rocas);

  // Luz cálida de las antorchas, luz fría de las aberturas y polvo suspendido.
  escena.add(new THREE.HemisphereLight(0xaec7bd, 0x1c2116, 0.65));
  const sol = new THREE.DirectionalLight(0xffe0a4, 2.4);
  sol.position.set(-9, 17, -7);
  sol.target.position.set(2, 0, -8);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, {
    left: -24,
    right: 24,
    top: 30,
    bottom: -23,
    near: 1,
    far: 65,
  });
  sol.shadow.bias = -0.00018;
  escena.add(sol, sol.target);
  const fuego = textura(128, (g, w, h) => {
    const gr = g.createRadialGradient(
      w / 2,
      h * 0.65,
      1,
      w / 2,
      h * 0.55,
      w * 0.48,
    );
    gr.addColorStop(0, "#fff9d5");
    gr.addColorStop(0.2, "#ffda74");
    gr.addColorStop(0.48, "#ed7f32bb");
    gr.addColorStop(1, "#e4431000");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const luces = [];
  for (const [i, [x, z]] of [
    [-7.35, 4],
    [7.35, -4],
    [-17.9, -5],
    [17.9, -13],
    [0, -31],
  ].entries()) {
    agregar(caja(0.23, 0.85, 0.25, bronce, x, 1.5, z));
    const llama = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fuego,
        color: 0xffbd58,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    llama.position.set(x, 2.1, z);
    llama.scale.set(0.65, 1.1, 1);
    agregar(llama);
    llamas.push(llama);
    if (i < 4) {
      const luz = new THREE.PointLight(0xffac5a, 1.25, 10, 1.5);
      luz.position.set(x, 2.2, z);
      agregar(luz);
      luces.push(luz);
    }
  }
  const farol = new THREE.PointLight(0xffdca8, 0.38, 5, 1.3);
  farol.position.set(0.15, -0.4, 0.1);
  camara.add(farol);
  escena.add(camara);
  const hazMat = new THREE.MeshBasicMaterial({
    color: 0xffe0a0,
    transparent: true,
    opacity: 0.035,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const z of [-16, -7, 3]) {
    const haz = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 8, 24, 1, true),
      hazMat,
    );
    haz.position.set(-1, 3.2, z);
    haz.rotation.z = -0.45;
    agregar(haz);
  }
  const polvo = new THREE.BufferGeometry();
  const particulas = new Float32Array(210 * 3);
  for (let i = 0; i < particulas.length; i += 3) {
    particulas[i] = rango(-7, 7);
    particulas[i + 1] = rango(0.3, 5.5);
    particulas[i + 2] = rango(-23, 12);
  }
  polvo.setAttribute("position", new THREE.BufferAttribute(particulas, 3));
  const polvoMesh = new THREE.Points(
    polvo,
    new THREE.PointsMaterial({
      color: 0xf3d5a3,
      size: 0.035,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  agregar(polvoMesh);

  // Estanque: una superficie física bajo el puente y un borde de piedra erosionada.
  const estanque = agregar(
    new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 8, 32, 32),
      Arcade.materialPBR({
        color: color(0x48796c),
        transparent: true,
        opacity: 0.8,
        roughness: 0.17,
        metalness: 0.15,
        clearcoat: 0.7,
      }),
    ),
  );
  estanque.rotation.x = -Math.PI / 2;
  estanque.position.set(0, -0.005, -9);
  acabado.superficie(estanque, "agua", { repetir: 4, relieve: 0.013 });
  for (const x of [-3.4, 3.4])
    agregar(caja(0.24, 0.18, 8.5, matMusgo, x, 0.04, -9));
  for (const z of [-13.2, -4.8])
    agregar(caja(7, 0.18, 0.25, matMusgo, 0, 0.04, z));
  const puente = agregar(caja(2.5, 0.18, 9, matPiedra, 0, 0.15, -9));
  for (const x of [-1.38, 1.38])
    for (const z of [-12, -6]) agregar(caja(0.2, 0.6, 0.2, bronce, x, 0.36, z));

  function runa(simbolo, tinte = "#cfb77a") {
    return textura(256, (g, w, h) => {
      g.fillStyle = "#1d2a22";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#9a8247";
      g.lineWidth = 5;
      g.strokeRect(14, 14, w - 28, h - 28);
      g.beginPath();
      g.arc(w / 2, h / 2, 91, 0, Math.PI * 2);
      g.stroke();
      g.font = (simbolo.length > 2 ? "58" : "140") + "px Georgia";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = tinte;
      g.fillText(simbolo, w / 2, h / 2 + 5);
    });
  }
  const mapasRuna = SIMBOLOS.map((s) => runa(s));
  function interactivo(mesh, tipo, nombre) {
    mesh.userData.interaccion = { tipo, nombre };
    interactivos.push(mesh);
    return mesh;
  }
  function pedestal(x, z, simbolo, tipo, nombre) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(caja(1.8, 0.2, 1.8, matMusgo, 0, 0.1, 0));
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.95, 8),
      matPiedra,
    );
    p.position.y = 0.68;
    p.castShadow = p.receiveShadow = true;
    g.add(p);
    g.add(caja(1.65, 0.18, 1.2, bronce, 0, 1.22, 0));
    const placa = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 0.9),
      Arcade.materialPBR({
        map: runa(simbolo),
        emissive: color(0x6a4c1c),
        emissiveIntensity: 0.15,
        roughness: 0.6,
      }),
    );
    placa.rotation.x = -Math.PI / 4;
    placa.position.set(0, 1.38, 0.1);
    g.add(placa);
    interactivo(placa, tipo, nombre);
    agregar(g);
    colisiones.push({ x, z, rx: 0.9, rz: 0.7 });
    return g;
  }
  pedestal(-14, -6.4, "☀", "sol", "Altar del sol");
  pedestal(14, -14.4, "☾", "luna", "Las campanas de la luna");
  pedestal(0, -16.8, "≈", "agua", "Compuertas de las mareas");
  function inscripcion(x, z, rot, texto, tipo, nombre) {
    const base = agregar(caja(2.8, 1.9, 0.24, matPiedra, x, 2.1, z));
    base.rotation.y = rot;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 1.6),
      Arcade.materialPBR({ map: runa(texto), roughness: 0.9 }),
    );
    face.position.z = 0.14;
    base.add(face);
    interactivo(face, tipo, nombre);
  }
  inscripcion(-14, -9.5, 0, "☀ ☾ ✦", "nota-sol", "La promesa del sol");
  inscripcion(14, -17.5, 0, "☾ ☀ ✦", "nota-luna", "El canto de las guardianas");
  inscripcion(-4, -19.5, 0, "≈ ≈ ≈", "nota-agua", "El pacto de las aguas");
  // Discos y canales visibles en el propio escenario, vinculados al acertijo.
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.12, 32),
      bronce.clone(),
    );
    m.rotation.x = Math.PI / 2;
    m.position.set(-15 + i, 2.1, -8.7);
    agregar(m);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 32),
      new THREE.MeshStandardMaterial({ map: mapasRuna[0], roughness: 0.5 }),
    );
    face.position.set(-15 + i, 2.1, -8.61);
    agregar(face);
    discos.push(face);
  }
  const canales = [];
  for (let i = 0; i < 4; i++) {
    const m = agregar(
      caja(0.34, 0.04, 1.15, prisma.clone(), -1.6 + i * 1.05, 0.04, -15),
    );
    canales.push(m);
  }
  const santuarios = [
    [-14, -5.2],
    [14, -13.2],
    [0, -15.8],
  ];
  for (const [x, z] of santuarios) {
    const m = agregar(
      new THREE.Mesh(new THREE.OctahedronGeometry(0.23), prisma.clone()),
    );
    m.position.set(x, 1.9, z);
    estatuas.push(m);
  }
  pedestal(0, -29, "✦", "corazon", "Corazón de Umbra");
  const corazon = agregar(
    new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), oro),
  );
  corazon.position.set(0, 2.2, -29);
  const halo = agregar(
    new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.026, 8, 64), oro),
  );
  halo.position.copy(corazon.position);
  for (const x of [-3.7, 3.7])
    agregar(caja(0.75, 5.8, 0.75, matMusgo, x, 2.9, -30));

  const notas = {
    sol: {
      titulo: "La promesa del sol",
      texto:
        "«Primero el Sol abre los ojos. Después la Luna guarda su sueño. Al final, la Estrella vela por ambos.»\nLos tres discos se leen de izquierda a derecha.",
    },
    luna: {
      titulo: "El canto de las guardianas",
      texto:
        "«La Luna llama al Sol. El Sol despierta a la Estrella. La Estrella vuelve a la Luna.»\nCuatro notas, un mismo ciclo.",
    },
    agua: {
      titulo: "El pacto de las aguas",
      texto:
        "«Ningún cauce vive solo. Cada compuerta mueve a su vecina. Cuando las cuatro aguas despierten, la marea regresará.»",
    },
  };
  function guardar() {
    if (!clave || estado.terminada) return;
    try {
      localStorage.setItem(clave, JSON.stringify(estado));
    } catch (_) {}
  }
  function leerCache() {
    try {
      const p = JSON.parse(localStorage.getItem(clave) || "null");
      if (
        !p ||
        p.version !== 1 ||
        p.terminada ||
        !Array.isArray(p.pos) ||
        !p.pos.every(Number.isFinite) ||
        !Array.isArray(p.sol) ||
        p.sol.length !== 3 ||
        !p.sol.every((v) => Number.isInteger(v) && v >= 0 && v < 3) ||
        !Array.isArray(p.sellos) ||
        p.sellos.length !== 3 ||
        !p.sellos.every((v) => typeof v === "boolean") ||
        !Array.isArray(p.agua) ||
        p.agua.length !== 4 ||
        !p.agua.every((v) => typeof v === "boolean") ||
        !Array.isArray(p.luna) ||
        p.luna.length > 4 ||
        !p.luna.every((v) => [0, 1, 2].includes(v)) ||
        !Number.isFinite(p.yaw) ||
        !Number.isFinite(p.pitch) ||
        !Number.isFinite(p.segundos) ||
        p.segundos < 0
      )
        return null;
      p.notas = Array.isArray(p.notas) ? p.notas.filter((n) => notas[n]) : [];
      return p;
    } catch (_) {
      return null;
    }
  }
  function avisar(texto) {
    $("aviso").textContent = texto;
    $("aviso").classList.add("visible");
    avisoHasta = performance.now() + 3800;
  }
  let ambienteAudio = null,
    ultimoPaso = 0,
    ultimaGota = 0;
  function iniciarAmbiente() {
    if (!sonido) return;
    try {
      if (!ambienteAudio) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.025) / 1.025;
          data[i] = brown;
        }
        const viento = ctx.createBufferSource();
        viento.buffer = buffer;
        viento.loop = true;
        const filtro = ctx.createBiquadFilter();
        filtro.type = "lowpass";
        filtro.frequency.value = 460;
        const volumen = ctx.createGain();
        volumen.gain.value = 0.22;
        viento.connect(filtro);
        filtro.connect(volumen);
        volumen.connect(master);
        viento.start();
        const drone = ctx.createOscillator(),
          vg = ctx.createGain();
        drone.frequency.value = 61.7;
        vg.gain.value = 0.024;
        drone.connect(vg);
        vg.connect(master);
        drone.start();
        ambienteAudio = { ctx, master, buffer };
      }
      ambienteAudio.ctx.resume().catch(() => {});
      actualizarSonido();
    } catch (_) {
      /* La exploración también funciona sin audio. */
    }
  }
  function actualizarSonido() {
    if (ambienteAudio)
      ambienteAudio.master.gain.setTargetAtTime(
        activa && sonido ? 0.28 : 0,
        ambienteAudio.ctx.currentTime,
        0.18,
      );
  }
  function ambientePaso(agua) {
    if (!sonido || !ambienteAudio) return;
    const { ctx, master, buffer } = ambienteAudio,
      s = ctx.createBufferSource(),
      g = ctx.createGain(),
      f = ctx.createBiquadFilter();
    s.buffer = buffer;
    f.type = "bandpass";
    f.frequency.value = agua ? 650 : 1250;
    f.Q.value = 0.6;
    g.gain.setValueAtTime(0.01, ctx.currentTime);
    g.gain.linearRampToValueAtTime(agua ? 0.34 : 0.48, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(0, Math.random());
    s.stop(ctx.currentTime + 0.15);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  function ambienteGota() {
    if (!sonido || !ambienteAudio) return;
    const { ctx, master } = ambienteAudio,
      s = ctx.createOscillator(),
      g = ctx.createGain();
    s.frequency.setValueAtTime(1100, ctx.currentTime);
    s.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.035, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    s.connect(g);
    g.connect(master);
    s.start();
    s.stop(ctx.currentTime + 0.21);
    s.onended = () => {
      s.disconnect();
      g.disconnect();
    };
  }
  function tono(tipo) {
    if (sonido) Arcade.sonar(tipo, 0.4);
  }
  function sincronizar() {
    const n = estado.sellos.filter(Boolean).length;
    $("sellos").textContent =
      `${estado.sellos[0] ? "☀" : "○"}　${estado.sellos[1] ? "☾" : "○"}　${estado.sellos[2] ? "≈" : "○"}　 ·　${n} / 3`;
    $("mision").textContent =
      n === 3
        ? "La puerta está abierta. Encuentra el corazón."
        : "Recupera los tres sellos del templo";
    discos.forEach((m, i) => {
      m.material.map = mapasRuna[estado.sol[i]];
      m.material.needsUpdate = true;
    });
    canales.forEach((m, i) => {
      m.material.emissiveIntensity = estado.agua[i] ? 1.3 : 0.05;
      m.material.color = color(estado.agua[i] ? 0x80d7c1 : 0x38463c);
    });
    estatuas.forEach((m, i) => {
      m.material.emissiveIntensity = estado.sellos[i] ? 2 : 0.12;
    });
  }
  function sellar(i) {
    if (estado.sellos[i]) return;
    estado.sellos[i] = true;
    sincronizar();
    guardar();
    tono("perfecto");
    avisar(
      [
        "Sello del sol recuperado.",
        "Sello de la luna recuperado.",
        "Sello de las mareas recuperado.",
      ][i],
    );
    if (estado.sellos.every(Boolean))
      avisar("Los tres sellos responden. La puerta del santuario se abre.");
  }
  function girar(i) {
    if (estado.sellos[0]) return;
    estado.sol[i] = (estado.sol[i] + 1) % 3;
    tono("click");
    sincronizar();
    if (estado.sol.every((v, k) => v === SOLUCION_SOL[k])) sellar(0);
    guardar();
  }
  function campana(i) {
    if (estado.sellos[1]) return;
    estado.luna.push(i);
    tono("ping");
    if (estado.luna.at(-1) !== SOLUCION_LUNA[estado.luna.length - 1]) {
      estado.luna = [];
      avisar("El eco se desvanece. Escucha de nuevo la inscripción.");
    }
    if (estado.luna.length === SOLUCION_LUNA.length) sellar(1);
    guardar();
  }
  function compuerta(i) {
    if (estado.sellos[2]) return;
    estado.agua[i] = !estado.agua[i];
    estado.agua[(i + 1) % 4] = !estado.agua[(i + 1) % 4];
    tono("agua");
    sincronizar();
    if (estado.agua.every(Boolean)) sellar(2);
    guardar();
  }
  function texto(p) {
    const n = document.createElement("p");
    n.textContent = p;
    return n;
  }
  function dialogo(titulo, tipo) {
    teclas.clear();
    mando.x = mando.y = 0;
    mirada.id = null;
    document.exitPointerLock?.();
    $("titulo-lectura").textContent = titulo;
    $("tipo-lectura").textContent = tipo;
    $("contenido-lectura").replaceChildren();
    if (!$("lectura").open) $("lectura").showModal();
    return $("contenido-lectura");
  }
  function dibujarAcertijo(tipo) {
    const indice = ["sol", "luna", "agua"].indexOf(tipo),
      done = estado.sellos[indice];
    const c = $("contenido-lectura");
    c.replaceChildren();
    if (done) {
      c.append(
        texto(
          "El sello ya está despierto. Su luz espera en la puerta del santuario.",
        ),
      );
      return;
    }
    c.append(
      texto(
        {
          sol: "Gira los tres discos. La inscripción cercana conserva el orden de los guardianes.",
          luna: "Repite el canto de las guardianas. Una nota equivocada hace que el eco comience de nuevo.",
          agua: "Abre los cuatro cauces. Cada compuerta mueve también a la siguiente.",
        }[tipo],
      ),
    );
    const grupo = document.createElement("div");
    grupo.className = "mecanismo";
    const n = tipo === "agua" ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "runa";
      b.setAttribute(
        "aria-label",
        tipo === "sol"
          ? `Girar disco ${i + 1}`
          : tipo === "luna"
            ? `Tocar ${NOMBRES[i]}`
            : `Mover compuerta ${i + 1}`,
      );
      b.textContent =
        tipo === "sol"
          ? SIMBOLOS[estado.sol[i]]
          : tipo === "luna"
            ? SIMBOLOS[i]
            : "≈";
      const desc = document.createElement("small");
      desc.textContent =
        tipo === "agua"
          ? estado.agua[i]
            ? "Abierto"
            : "Cerrado"
          : tipo === "sol"
            ? `Disco ${i + 1}`
            : NOMBRES[i];
      b.append(desc);
      if (tipo === "agua")
        b.classList.add("canal", estado.agua[i] ? "abierto" : "cerrado");
      b.onclick = () => {
        ({ sol: girar, luna: campana, agua: compuerta })[tipo](i);
        dibujarAcertijo(tipo);
      };
      grupo.append(b);
    }
    c.append(grupo);
    if (tipo === "luna")
      c.append(
        texto(
          "El eco: " + (estado.luna.map((i) => SIMBOLOS[i]).join("　") || "…"),
        ),
      );
    const ayuda = document.createElement("button");
    ayuda.type = "button";
    ayuda.className = "secundario";
    ayuda.textContent = "Consultar el diario";
    ayuda.onclick = () => mostrarDiario();
    c.append(ayuda);
  }
  function mostrarDiario() {
    const c = dialogo("Diario de la expedición", "ARCHIVO DEL EXPLORADOR");
    c.append(
      texto(
        "El santuario tiene tres altares. Busca las cámaras laterales y examina sus inscripciones. Los sellos abrirán la puerta del fondo.",
      ),
    );
    for (const k of estado.notas) {
      const h = document.createElement("h3");
      h.textContent = notas[k].titulo;
      c.append(h, texto(notas[k].texto));
    }
    if (!estado.notas.length)
      c.append(
        texto(
          "Todavía no has copiado ninguna inscripción. Mira las placas grabadas en las paredes.",
        ),
      );
  }
  function examinar() {
    if (!activa || !objetivo || $("lectura").open) return;
    const { tipo, nombre } = objetivo;
    if (tipo === "corazon") {
      if (!estado.sellos.every(Boolean)) return;
      terminar();
      return;
    }
    if (tipo.startsWith("nota-")) {
      const k = tipo.slice(5);
      if (!estado.notas.includes(k)) estado.notas.push(k);
      guardar();
      dialogo(notas[k].titulo, "INSCRIPCIÓN COPIADA AL DIARIO").append(
        texto(notas[k].texto),
      );
    } else {
      dialogo(nombre, "MECANISMO ANTIGUO");
      dibujarAcertijo(tipo);
    }
  }

  function puntoValido(x, z) {
    if (!areas.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d))
      return false;
    if (!estado.sellos.every(Boolean) && z < -22.3) return false;
    for (const o of colisiones)
      if (Math.abs(x - o.x) < o.rx + 0.22 && Math.abs(z - o.z) < o.rz + 0.22)
        return false;
    return true;
  }
  function puedeCaminar(x, z) {
    return [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ].every(([a, b]) => puntoValido(x + a, z + b));
  }
  function mover(dx, dz) {
    const [x, z] = estado.pos;
    if (puedeCaminar(x + dx, z)) estado.pos[0] += dx;
    if (puedeCaminar(estado.pos[0], z + dz)) estado.pos[1] += dz;
  }
  function tiempo(s) {
    const n = Math.floor(s);
    return (
      String(Math.floor(n / 60)).padStart(2, "0") +
      ":" +
      String(n % 60).padStart(2, "0")
    );
  }
  function zona() {
    const [x, z] = estado.pos;
    return x < -8
      ? "Cámara del sol"
      : x > 8
        ? "Cámara de las guardianas"
        : z < -23
          ? "El corazón de Umbra"
          : z < -13
            ? "Altar de las mareas"
            : z < -4
              ? "Puente de los recuerdos"
              : "Atrio de las raíces";
  }
  function soltar() {
    teclas.clear();
    mando.x = mando.y = 0;
    mirada.id = null;
    $("joystick").querySelector("i").style.transform = "";
  }
  function pausar() {
    if (!activa || estado.terminada) return;
    activa = false;
    actualizarSonido();
    soltar();
    guardar();
    document.exitPointerLock?.();
    $("lectura").close();
    $("pausa").hidden = false;
  }
  function reanudar() {
    if (estado.terminada) return;
    $("pausa").hidden = true;
    activa = true;
    iniciarAmbiente();
    actualizarSonido();
    relojGuardado = 0;
  }
  async function comenzar(continuar = false) {
    if (iniciando) return;
    iniciando = true;
    iniciarAmbiente();
    try {
      await perfilListo;
      await window.Perfil?.cargar();
      const nombre =
        (window.Perfil?.datos?.cuenta
          ? Perfil.datos.nombre
          : $("nombre").value.trim()) || "Explorador";
      try {
        localStorage.setItem("nombreUsuario", nombre);
      } catch (_) {}
      nombreExpedicion = nombre;
      if (window.Perfil && !Perfil.datos?.cuenta) {
        try {
          await Perfil.editar({ nombre });
        } catch (_) {
          avisar("Tu avance se guardará en este dispositivo.");
        }
      }
      estado = continuar && cache ? JSON.parse(JSON.stringify(cache)) : nuevo();
      if (!puedeCaminar(...estado.pos)) estado.pos = [0, 8];
      estado.pitch = clamp(estado.pitch, -1.1, 1.1);
      contexto = window.Perfil?.iniciar("templo", { modo: "solo" });
      tokenVisita++;
      $("portada").hidden = $("pausa").hidden = $("final").hidden = true;
      $("hud").hidden = false;
      $("lectura").close();
      activa = true;
      actualizarSonido();
      soltar();
      sincronizar();
      guardar();
      tono("swoosh");
    } finally {
      iniciando = false;
    }
  }
  async function terminar() {
    if (estado.terminada || !estado.sellos.every(Boolean)) return;
    estado.terminada = true;
    activa = false;
    actualizarSonido();
    soltar();
    document.exitPointerLock?.();
    $("lectura").close();
    try {
      localStorage.removeItem(clave);
    } catch (_) {}
    $("hud").hidden = true;
    $("final").hidden = false;
    $("resultado").textContent = tiempo(estado.segundos);
    $("guardado-final").textContent = "Guardando tu expedición…";
    tono("ganar");
    const visita = tokenVisita;
    const resultados = await Promise.allSettled([
      window.Perfil?.evento("templo", "fin", { gano: true }, contexto),
      fetch("/api/records/templo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombreExpedicion,
          puntos: Math.max(1, Math.ceil(estado.segundos)),
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("No se pudo guardar el récord");
      }),
    ]);
    if (visita !== tokenVisita) return;
    $("guardado-final").textContent = resultados.every(
      (r) => r.status === "fulfilled",
    )
      ? "Tu expedición ha quedado registrada."
      : "Terminaste la expedición. No se pudo confirmar el guardado; revisa tu conexión.";
  }

  // Caminar y mirar se mantienen independientes, también con dos dedos en móvil.
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if ($("lectura").open) return;
      if (activa) pausar();
      else if (!$("pausa").hidden) reanudar();
      return;
    }
    if (!activa || $("lectura").open) return;
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
      ].includes(e.code)
    )
      e.preventDefault();
    teclas.add(e.code);
    if (!e.repeat && e.code === "KeyE") examinar();
    if (!e.repeat && e.code === "KeyJ") mostrarDiario();
  });
  document.addEventListener("keyup", (e) => teclas.delete(e.code));
  window.addEventListener("blur", () => {
    soltar();
    if (activa) pausar();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activa) {
      pausar();
    }
  });
  M.lienzo.addEventListener("pointerdown", (e) => {
    if (!activa || $("lectura").open) return;
    mirada.id = e.pointerId;
    mirada.x = e.clientX;
    mirada.y = e.clientY;
    M.lienzo.setPointerCapture(e.pointerId);
  });
  M.lienzo.addEventListener("pointermove", (e) => {
    if (mirada.id !== e.pointerId || !activa || $("lectura").open) return;
    estado.yaw -= (e.clientX - mirada.x) * 0.0035;
    estado.pitch = clamp(
      estado.pitch - (e.clientY - mirada.y) * 0.003,
      -1.1,
      1.1,
    );
    mirada.x = e.clientX;
    mirada.y = e.clientY;
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    M.lienzo.addEventListener(ev, () => (mirada.id = null));
  const joystick = $("joystick");
  let dedoMando = null;
  function actualizarMando(e) {
    const r = joystick.getBoundingClientRect(),
      x = clamp((e.clientX - r.left - r.width / 2) / 38, -1, 1),
      y = clamp((e.clientY - r.top - r.height / 2) / 38, -1, 1),
      n = Math.max(1, Math.hypot(x, y));
    mando.x = x / n;
    mando.y = y / n;
    joystick.querySelector("i").style.transform =
      `translate(${mando.x * 27}px,${mando.y * 27}px)`;
  }
  joystick.onpointerdown = (e) => {
    if (!activa) return;
    e.preventDefault();
    dedoMando = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    actualizarMando(e);
  };
  joystick.onpointermove = (e) => {
    if (dedoMando === e.pointerId) actualizarMando(e);
  };
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    joystick.addEventListener(ev, () => {
      dedoMando = null;
      mando.x = mando.y = 0;
      joystick.querySelector("i").style.transform = "";
    });
  $("interactuar").onclick = examinar;
  $("diario").onclick = mostrarDiario;
  $("pausar").onclick = pausar;
  $("reanudar").onclick = reanudar;
  $("empezar").onclick = () => comenzar(false);
  $("continuar").onclick = () => comenzar(true);
  $("otra").onclick = () => comenzar(false);
  $("volver-portada").onclick = () => {
    activa = false;
    $("pausa").hidden = true;
    $("hud").hidden = true;
    $("portada").hidden = false;
    cache = leerCache();
    $("continuar").hidden = !cache;
  };
  $("sonido").onclick = () => {
    sonido = !sonido;
    if (sonido) iniciarAmbiente();
    actualizarSonido();
    $("sonido").setAttribute("aria-pressed", String(sonido));
    $("sonido").textContent =
      "Sonido: " + (sonido ? "activado" : "desactivado");
  };
  $("lectura").addEventListener("close", soltar);
  window.addEventListener("pagehide", guardar);
  M.lienzo.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    pausar();
    avisar("Se interrumpió la vista 3D. Tu avance está guardado.");
  });
  Graficos3D.selector($("calidad"));
  Graficos3D.selector($("calidad-pausa"));

  let apuntar = 0,
    ultimoReal = performance.now();
  M.alCuadro((dt, ahora) => {
    const dtReal = Math.max(0, ahora - ultimoReal) / 1000;
    ultimoReal = ahora;
    const t = ahora / 1000;
    const pulso = movimientoReducido
      ? 1
      : 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 17) * 0.03;
    llamas.forEach((m, i) =>
      m.scale.set(0.65 * pulso, 1.05 * pulso + Math.sin(t * 7 + i) * 0.04, 1),
    );
    luces.forEach(
      (l, i) =>
        (l.intensity =
          1.25 + (movimientoReducido ? 0 : Math.sin(t * 8 + i) * 0.12)),
    );
    if (!movimientoReducido) {
      polvoMesh.position.y = Math.sin(t * 0.13) * 0.16;
      polvoMesh.rotation.y = Math.sin(t * 0.04) * 0.015;
    }
    estatuas.forEach((m, i) => {
      m.rotation.y = t * 0.45;
      m.position.y = 1.9 + (movimientoReducido ? 0 : Math.sin(t + i) * 0.06);
    });
    corazon.rotation.y = t * 0.2;
    halo.rotation.y = t * 0.25;
    halo.rotation.z = t * 0.14;
    const deseado = estado.sellos.every(Boolean) ? 7.4 : 2.3;
    puerta.position.y += (deseado - puerta.position.y) * Math.min(1, dt * 1.8);
    if (ahora > avisoHasta) $("aviso").classList.remove("visible");
    if (!$("portada").hidden) {
      camara.position.set(0.7 + Math.sin(t * 0.08) * 0.45, 2.7, 10.8);
      camara.lookAt(-0.3, 2, -11);
      return;
    }
    if (!activa) return;
    estado.segundos += dtReal;
    $("tiempo").textContent = tiempo(estado.segundos);
    if ($("lectura").open) return;
    const delante =
      (teclas.has("KeyW") || teclas.has("ArrowUp") ? 1 : 0) -
      (teclas.has("KeyS") || teclas.has("ArrowDown") ? 1 : 0) -
      mando.y;
    const lado =
      (teclas.has("KeyD") ? 1 : 0) - (teclas.has("KeyA") ? 1 : 0) + mando.x;
    if (teclas.has("ArrowLeft")) estado.yaw += dt * 1.4;
    if (teclas.has("ArrowRight")) estado.yaw -= dt * 1.4;
    const largo = Math.max(1, Math.hypot(delante, lado)),
      v = 2.75 * dt;
    mover(
      ((-Math.sin(estado.yaw) * delante + Math.cos(estado.yaw) * lado) /
        largo) *
        v,
      ((-Math.cos(estado.yaw) * delante - Math.sin(estado.yaw) * lado) /
        largo) *
        v,
    );
    const andando = Math.abs(delante) + Math.abs(lado) > 0.1;
    if (andando && ahora - ultimoPaso > 530) {
      ultimoPaso = ahora;
      ambientePaso(
        Math.abs(estado.pos[0]) > 1.4 &&
          estado.pos[1] < -5 &&
          estado.pos[1] > -13,
      );
    }
    if (ahora - ultimaGota > 5300) {
      ultimaGota = ahora;
      ambienteGota();
    }
    paso += andando ? dt * 8 : 0;
    camara.position.set(
      estado.pos[0],
      1.68 + (andando && !movimientoReducido ? Math.sin(paso) * 0.025 : 0),
      estado.pos[1],
    );
    camara.rotation.order = "YXZ";
    camara.rotation.set(estado.pitch, estado.yaw, 0);
    $("tiempo").textContent = tiempo(estado.segundos);
    $("zona").textContent = zona();
    const ang = ((((estado.yaw * 180) / Math.PI) % 360) + 360) % 360;
    $("brujula").textContent = ["N", "NO", "O", "SO", "S", "SE", "E", "NE"][
      Math.round(ang / 45) % 8
    ];
    relojGuardado += dt;
    if (relojGuardado > 3) {
      guardar();
      relojGuardado = 0;
    }
    apuntar += dt;
    if (apuntar > 0.08) {
      apuntar = 0;
      camara.updateMatrixWorld();
      rayo.setFromCamera(centro, camara);
      const hits = rayo.intersectObjects(interactivos, false);
      objetivo = null;
      if (hits[0] && hits[0].distance < 3.1) {
        let libre = true;
        for (let d = 0.12; d < hits[0].distance - 0.12; d += 0.12) {
          const p = rayo.ray.at(d, new THREE.Vector3());
          if (
            colisiones.some(
              (o) =>
                o.pared &&
                Math.abs(p.x - o.x) < o.rx &&
                Math.abs(p.z - o.z) < o.rz,
            )
          ) {
            libre = false;
            break;
          }
        }
        if (libre) objetivo = hits[0].object.userData.interaccion;
      }
      $("interaccion").hidden = !objetivo;
      if (objetivo) $("objeto").textContent = objetivo.nombre;
    }
  });
  perfilListo
    .then(async () => {
      const p = await window.Perfil?.cargar();
      clave =
        "umbra_v1:" + (p?.cuenta ? p.nombre : window.Perfil?.pid || "invitado");
      cache = leerCache();
      $("continuar").hidden = !cache;
      $("nombre").value = p?.nombre === "Jugador" ? "" : p?.nombre || "";
      $("nombre").readOnly = !!p?.cuenta;
    })
    .catch(() => {
      clave = "umbra_v1:invitado";
    });
  // API usada por las pruebas de reglas y controles; no sustituye las interacciones de juego.
  window.Templo = {
    get estado() {
      return estado;
    },
    get activa() {
      return activa;
    },
    get objetivo() {
      return objetivo;
    },
    mundo: M,
    girar,
    campana,
    compuerta,
    puedeCaminar,
    pausar,
    reanudar,
    guardar,
    mostrarDiario,
  };
  requestAnimationFrame(() => {
    $("cargando").hidden = true;
    sincronizar();
  });
})();
