/* Nocturna: original procedural mansion, navigation and suspense. No external assets. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let M;
  try {
    M = Arcade.mundo({
      fondo: 0x080f17,
      niebla: [10, 43],
      fov: 70,
      exposicion: 1.25,
      colorAmbiente: 0x52647a,
      lamparas: [],
    });
  } catch (e) {
    $("error").textContent =
      "Tu navegador no pudo iniciar los gráficos 3D. Prueba activar la aceleración gráfica o usar otro navegador.";
    $("empezar").disabled = true;
    return;
  }
  const { escena, camara } = M;
  Graficos3D.configurar(M, "interior");
  escena.background = new THREE.Color(0x070c12);
  Graficos3D.selector($("calidad"));
  camara.rotation.order = "YXZ";
  escena.add(new THREE.HemisphereLight(0x8094b0, 0x20231e, 0.35));
  const moon = new THREE.DirectionalLight(0x8eb8ef, 0.25);
  moon.position.set(8, 14, 3);
  escena.add(moon);
  const wood = Graficos3D.material({ color: 0x473426, roughness: 0.53 });
  const darkWood = Graficos3D.material({ color: 0x231c19, roughness: 0.62 });
  const brass = Graficos3D.material({
    color: 0xa18c53,
    metalness: 0.78,
    roughness: 0.34,
  });
  const stone = Graficos3D.material({ color: 0x636164, roughness: 0.88 });
  const walls = [],
    obstacles = [],
    props = [],
    keys = [],
    candles = [],
    rooms = [
      [-6, 6, -10, 14],
      [-15, -6, -8, 2],
      [6, 15, -8, 2],
      [-6, 6, -20, -10],
    ];
  const rect = (x, z, w, d) => ({
    x1: x - w / 2,
    x2: x + w / 2,
    z1: z - d / 2,
    z2: z + d / 2,
  });
  function box(w, h, d, x, y, z, mat, parent = escena) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function ball(r, x, y, z, mat, parent = escena) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function tex(w, h, draw, rx = 1, ry = 1) {
    const t = M.textura(w, h, draw);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
  }
  const paper = tex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#39403c";
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        g.fillStyle = "#4b5045";
        g.fillRect(x, 0, 3, h);
        for (let y = 16; y < h; y += 48) {
          g.strokeStyle = "#89846755";
          g.beginPath();
          g.ellipse(x + 16, y, 9, 17, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      for (let i = 0; i < 600; i++) {
        g.fillStyle = "#00000012";
        g.fillRect(Math.random() * w, Math.random() * h, 2, 8);
      }
    },
    4,
    1,
  );
  const wallpaper = Graficos3D.material({ map: paper, roughness: 0.9 });
  const floorTex = tex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#463528";
      g.fillRect(0, 0, w, h);
      g.save();
      g.translate(256, 256);
      g.rotate(Math.PI / 4);
      for (let y = -512; y < 512; y += 32)
        for (let x = -512; x < 512; x += 128) {
          g.fillStyle = `hsl(29 25% ${20 + Math.random() * 13}%)`;
          g.fillRect(x + (y % 64 ? 64 : 0), y, 126, 30);
          g.strokeStyle = "#bba27a1a";
          for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.moveTo(x, y + k * 6);
            g.lineTo(x + 124, y + k * 6 + 2);
            g.stroke();
          }
        }
      g.restore();
    },
    8,
    12,
  );
  const floorMat = Graficos3D.material({
    map: floorTex,
    roughness: 0.38,
    metalness: 0.08,
  });
  for (const [a, b, c, d] of rooms) {
    box(b - a, 0.15, d - c, (a + b) / 2, -0.1, (c + d) / 2, floorMat);
    box(b - a, 0.12, d - c, (a + b) / 2, 4.6, (c + d) / 2, darkWood);
  }
  function wall(x, z, w, d) {
    box(w, 4.5, d, x, 2.25, z, wallpaper);
    box(w + 0.03, 1.15, d + 0.03, x, 0.575, z, darkWood);
    box(w + 0.08, 0.1, d + 0.08, x, 1.17, z, wood);
    box(w + 0.12, 0.15, d + 0.12, x, 4.25, z, wood);
    walls.push(rect(x, z, w, d));
  }
  wall(0, 14, 12, 0.25);
  for (let sign of [-1, 1]) {
    wall(sign * 6, 6.5, 0.25, 15);
    wall(sign * 6, -6.5, 0.25, 7);
    wall(sign * 15, -3, 0.25, 10);
    wall(sign * 10.5, 2, 9, 0.25);
    wall(sign * 10.5, -8, 9, 0.25);
    wall(sign * 3.65, -10, 4.7, 0.25);
    wall(sign * 6, -15, 0.25, 10);
  }
  wall(0, -20, 12, 0.25);
  // Door frames leave 2 m passages; collision uses the same wall segments.
  function frame(x, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    escena.add(g);
    box(0.18, 3, 0.28, -1.05, 1.5, 0, wood, g);
    box(0.18, 3, 0.28, 1.05, 1.5, 0, wood, g);
    box(2.3, 0.23, 0.32, 0, 3, 0, wood, g);
    box(2.25, 1.3, 0.24, 0, 3.8, 0, wallpaper, g);
    return g;
  }
  frame(-6, -2, Math.PI / 2);
  frame(6, -2, Math.PI / 2);
  frame(0, -10);
  const exit = box(2.4, 3.2, 0.18, 0, 1.6, 13.83, wood);
  for (let x of [-0.6, 0.6])
    for (let y of [0.85, 2.2]) box(0.85, 1.05, 0.08, x, y, 13.7, darkWood);
  ball(0.08, 0.8, 1.5, 13.6, brass);
  props.push({
    x: 0,
    z: 12.5,
    name: "La puerta principal · tres cerraduras",
    type: "salida",
  });
  // Worn carpet with a woven border.
  const rugTex = tex(256, 512, (g, w, h) => {
    g.fillStyle = "#4a2024";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ad8b52";
    g.lineWidth = 4;
    g.strokeRect(12, 12, w - 24, h - 24);
    g.strokeRect(22, 22, w - 44, h - 44);
    for (let y = 48; y < 480; y += 48) {
      g.save();
      g.translate(128, y);
      g.rotate(Math.PI / 4);
      g.strokeRect(-12, -12, 24, 24);
      g.restore();
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = "#d0aa7010";
      g.fillRect(Math.random() * w, Math.random() * h, 1, 3);
    }
  });
  box(
    2.8,
    0.025,
    19,
    0,
    0.01,
    2,
    Graficos3D.material({ map: rugTex, roughness: 1 }),
  );
  function candle(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    escena.add(g);
    box(
      0.12,
      0.26,
      0.12,
      0,
      0.13,
      0,
      Graficos3D.material({ color: 0xe4d3a0 }),
      g,
    );
    const flame = ball(
      0.055,
      0,
      0.32,
      0,
      new THREE.MeshBasicMaterial({ color: 0xffbe68 }),
      g,
    );
    flame.scale.y = 1.7;
    const l = new THREE.PointLight(0xffbb77, 0.8, 7, 2);
    l.position.set(0, 0.5, 0);
    g.add(l);
    candles.push(l);
  }
  // Chandeliers, moonlit windows, framed portraits and fine wooden wall panels.
  for (let z of [8, -5, -15]) {
    const g = new THREE.Group();
    g.position.set(0, 3.45, z);
    escena.add(g);
    box(0.04, 1.2, 0.04, 0, 0.4, 0, brass, g);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.025, 8, 32),
      brass,
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      box(
        0.08,
        0.23,
        0.08,
        Math.cos(a) * 0.75,
        0,
        Math.sin(a) * 0.75,
        brass,
        g,
      );
      ball(
        0.06,
        Math.cos(a) * 0.75,
        0.15,
        Math.sin(a) * 0.75,
        new THREE.MeshBasicMaterial({ color: 0xe8c088 }),
        g,
      );
    }
    const l = new THREE.PointLight(0xffc58b, 1.3, 13, 2);
    l.position.set(0, 3, z);
    escena.add(l);
  }
  const portrait = tex(192, 256, (g, w, h) => {
    g.fillStyle = "#151c20";
    g.fillRect(0, 0, w, h);
    const grad = g.createRadialGradient(96, 95, 5, 96, 110, 110);
    grad.addColorStop(0, "#685a49");
    grad.addColorStop(1, "#161a1d");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#171c20";
    g.beginPath();
    g.ellipse(96, 228, 65, 90, 0, 0, 7);
    g.fill();
    g.fillStyle = "#8d806b";
    g.beginPath();
    g.ellipse(96, 98, 32, 46, 0, 0, 7);
    g.fill();
    g.fillStyle = "#252327";
    g.fillRect(68, 87, 56, 7);
    g.fillStyle = "#c1b098";
    g.fillRect(76, 89, 7, 3);
    g.fillRect(109, 89, 7, 3);
    g.strokeStyle = "#c0ac7740";
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.moveTo(i * 18, 0);
      g.lineTo(i * 17 + 12, 256);
      g.stroke();
    }
  });
  for (let sign of [-1, 1])
    for (let z of [2, 7, 11]) {
      const g = new THREE.Group();
      g.position.set(sign * 5.82, 2.45, z);
      g.rotation.y = (-sign * Math.PI) / 2;
      escena.add(g);
      box(1.2, 1.6, 0.12, 0, 0, 0, brass, g);
      box(
        1.02,
        1.42,
        0.13,
        0,
        0,
        0.02,
        Graficos3D.material({ map: portrait, roughness: 0.8 }),
        g,
      );
    }
  function windowPane(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 2.65, z);
    g.rotation.y = rot;
    escena.add(g);
    box(2.1, 2.4, 0.13, 0, 0, 0, darkWood, g);
    box(
      1.9,
      2.2,
      0.14,
      0,
      0,
      0.02,
      Graficos3D.material({
        color: 0x35546e,
        emissive: 0x30465f,
        emissiveIntensity: 0.6,
        roughness: 0.25,
      }),
      g,
    );
    box(0.08, 2.2, 0.16, 0, 0, 0.05, brass, g);
    box(1.9, 0.08, 0.16, 0, 0, 0.05, brass, g);
    const l = new THREE.PointLight(0x7aaceb, 1.4, 10, 2);
    l.position.set(0, 0, 1.2);
    g.add(l);
  }
  windowPane(-14.8, -3, Math.PI / 2);
  windowPane(14.8, -3, -Math.PI / 2);
  windowPane(0, -19.8, 0);
  function furniture(x, z, w, d, h, mat = wood) {
    const o = box(w, h, d, x, h / 2, z, mat);
    obstacles.push(rect(x, z, w + 0.15, d + 0.15));
    Graficos3D.superficie(o, "madera", { repetir: 3 });
    return o;
  }
  // Library shelves and individual books.
  for (let x of [-13.6, -10.8, -8]) {
    furniture(x, -7.45, 2.3, 0.7, 3.5, darkWood);
    for (let y of [0.5, 1.3, 2.1, 2.9]) {
      box(2.3, 0.07, 0.8, x, y, -7.4, wood);
      for (let k = 0; k < 9; k++) {
        const b = box(
          0.15,
          0.5 + (k % 3) * 0.09,
          0.48,
          x - 0.95 + k * 0.22,
          y + 0.3,
          -7.1,
          Graficos3D.material({ color: [0x554039, 0x384952, 0x696045][k % 3] }),
        );
        b.rotation.z = ((k % 4) - 1) * 0.025;
      }
    }
  }
  furniture(-11, -4, 2, 1, 1.1);
  candle(-11.7, 1.1, -4);
  furniture(10.7, -3.7, 3.2, 1.5, 1.05);
  for (let x of [9.4, 10.7, 12])
    for (let z of [-5.1, -2.3]) {
      furniture(x, z, 0.6, 0.6, 0.55);
      box(0.6, 1, 0.12, x, 1, z + (z < -3 ? -0.27 : 0.27), darkWood);
    }
  candle(10.7, 1.05, -3.7);
  // Nursery: an old bed and a rocking horse.
  furniture(3.8, -17.4, 2.1, 3.4, 0.65);
  box(
    2,
    0.25,
    3.2,
    3.8,
    0.8,
    -17.4,
    Graficos3D.material({ color: 0x727c70, roughness: 1 }),
  );
  box(2.15, 1.5, 0.15, 3.8, 1, -19, wood);
  furniture(-2.8, -17.3, 1.4, 0.9, 1);
  candle(-3.2, 1, -17.3);
  const horse = new THREE.Group();
  horse.position.set(0, 0, -15.7);
  escena.add(horse);
  box(0.4, 0.6, 1, 0, 0.65, 0, wood, horse);
  box(0.3, 0.6, 0.3, 0, 1.05, -0.5, wood, horse);
  for (let x of [-0.25, 0.25]) box(0.1, 0.08, 1.6, x, 0.1, 0, darkWood, horse);
  function closet(x, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    escena.add(g);
    box(1.5, 2.8, 0.8, 0, 1.4, 0, darkWood, g);
    for (let side of [-1, 1]) {
      box(0.65, 2.55, 0.06, side * 0.36, 1.4, 0.44, wood, g);
      ball(0.035, side * 0.1, 1.3, 0.5, brass, g);
    }
    obstacles.push(rect(x, z, rot ? 1 : 1.65, rot ? 1.65 : 1));
    props.push({
      x: x + Math.sin(rot) * 1.2,
      z: z + Math.cos(rot) * 1.2,
      name: "Armario · esconderse",
      type: "armario",
    });
  }
  closet(-4.6, 5, Math.PI / 2);
  closet(-13.4, 0.6, Math.PI);
  closet(13.4, 0.6, Math.PI);
  closet(-4.5, -18, Math.PI / 2);
  function key(x, y, z, label) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    escena.add(g);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.035, 8, 20),
      brass,
    );
    g.add(ring);
    box(0.05, 0.28, 0.05, 0, -0.24, 0, brass, g);
    box(0.13, 0.04, 0.05, 0.05, -0.35, 0, brass, g);
    const light = new THREE.PointLight(0xffce70, 0.8, 3, 2);
    g.add(light);
    const item = { x, z, y, name: label, type: "llave", g, taken: false };
    keys.push(item);
    props.push(item);
  }
  key(-10.4, 1.5, -4, "Llave de la biblioteca");
  key(11.5, 1.5, -3.7, "Llave del comedor");
  key(-2.5, 1.45, -17.3, "Llave del cuarto olvidado");
  // Suspended dust, gentle movement only; thin cobweb strands at the corners.
  const dustGeo = new THREE.BufferGeometry(),
    positions = new Float32Array(420 * 3);
  for (let i = 0; i < 420; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 11;
    positions[i * 3 + 1] = Math.random() * 4;
    positions[i * 3 + 2] = 14 - Math.random() * 34;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xb4c2b4,
      size: 0.018,
      transparent: true,
      opacity: 0.3,
    }),
  );
  escena.add(dust);
  for (let z of [12, -9, -19])
    for (let sign of [-1, 1]) {
      const v = [];
      for (let i = 0; i < 6; i++) {
        v.push(
          sign * 5.8,
          4.3,
          z,
          sign * (5.8 - i * 0.22),
          3 + i * 0.2,
          z + 0.05,
        );
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      escena.add(
        new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({
            color: 0xa5aba0,
            transparent: true,
            opacity: 0.22,
          }),
        ),
      );
    }
  // The watcher walks through connected doors. It never crosses a wall.
  const ghost = new THREE.Group();
  escena.add(ghost);
  const shroud = Graficos3D.material({ color: 0x11161b, roughness: 1 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.47, 2.25, 20), shroud);
  body.position.y = 1.2;
  ghost.add(body);
  ball(0.24, 0, 2.25, 0, shroud, ghost);
  for (let side of [-1, 1]) {
    const arm = box(0.12, 1.1, 0.12, side * 0.43, 1.5, 0, shroud, ghost);
    arm.rotation.z = side * 0.16;
    ball(
      0.035,
      side * 0.085,
      2.28,
      0.22,
      new THREE.MeshBasicMaterial({ color: 0xd6deb3 }),
      ghost,
    );
  }
  const nodes = [
    [0, 6],
    [0, -2],
    [-5, -2],
    [-7, -2],
    [-11, -3],
    [5, -2],
    [7, -2],
    [11, -1],
    [0, -9],
    [0, -11],
    [0, -14],
    [-2, -16],
    [-13, -2],
    [-13, -5.8],
    [-9, -5.8],
    [-8, -3],
    [8, -2],
    [8, -6],
    [13.8, -6],
    [13.8, -1],
    [0, -17],
    [-4, -15],
    [-1, -18],
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [1, 5],
    [5, 6],
    [6, 7],
    [1, 8],
    [8, 9],
    [9, 10],
    [10, 11],
  ];
  const light = new THREE.SpotLight(0xffe5ba, 2.5, 23, Math.PI / 7, 0.55, 1.25);
  light.castShadow = Graficos3D.calidad !== "ahorro";
  light.shadow.mapSize.set(1024, 1024);
  escena.add(light, light.target);
  const fill = new THREE.PointLight(0x8ca6c3, 0.25, 4, 2);
  escena.add(fill);
  const acabados = new Set();
  escena.traverse((o) => {
    if (o.isMesh && o.material.isMeshStandardMaterial && !acabados.has(o.material)) {
      acabados.add(o.material);
      o.material.color.convertSRGBToLinear();
      o.material.envMapIntensity = 0.45;
    }
  });
  const S = {
    active: false,
    paused: false,
    x: 0,
    z: 10,
    yaw: 0,
    pitch: 0,
    elapsed: 0,
    lives: 3,
    found: 0,
    battery: 100,
    flash: true,
    hidden: false,
    grace: 12,
    ghostX: 0,
    ghostZ: -14,
    route: [],
    patrol: 0,
    repath: 0,
    seen: 0,
    sprint: false,
    serial: 0,
    muted: false,
  };
  const pressed = new Set();
  let joystick = { x: 0, y: 0 },
    look = null,
    joyId = null,
    target = null,
    noticeTime = 0,
    audio = null,
    lastStep = 0;
  function blocked(x, z, r = 0.25) {
    if (!rooms.some(([a, b, c, d]) => x >= a && x <= b && z >= c && z <= d))
      return true;
    return [...walls, ...obstacles].some(
      (b) => x + r > b.x1 && x - r < b.x2 && z + r > b.z1 && z - r < b.z2,
    );
  }
  function lineFree(a, b) {
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1]),
      steps = Math.ceil(dist / 0.16);
    for (let i = 1; i <= steps; i++)
      if (
        blocked(
          a[0] + ((b[0] - a[0]) * i) / steps,
          a[1] + ((b[1] - a[1]) * i) / steps,
          0.18,
        )
      )
        return false;
    return true;
  }
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++)
      if (lineFree(nodes[a], nodes[b])) edges.push([a, b]);
  function routeTo(goal) {
    const start = [S.ghostX, S.ghostZ];
    if (lineFree(start, goal)) return [goal];
    const all = [...nodes, start, goal],
      n = all.length,
      adj = all.map(() => []);
    for (const [a, b] of edges) {
      adj[a].push(b);
      adj[b].push(a);
    }
    for (let k of [n - 2, n - 1])
      for (let i = 0; i < n - 2; i++)
        if (lineFree(all[k], all[i])) {
          adj[k].push(i);
          adj[i].push(k);
        }
    const dist = Array(n).fill(Infinity),
      prev = Array(n).fill(-1),
      open = new Set(all.map((_, i) => i));
    dist[n - 2] = 0;
    while (open.size) {
      let u = -1;
      for (const i of open) if (u < 0 || dist[i] < dist[u]) u = i;
      open.delete(u);
      if (!Number.isFinite(dist[u]) || u === n - 1) break;
      for (const v of adj[u]) {
        const d =
          dist[u] + Math.hypot(all[u][0] - all[v][0], all[u][1] - all[v][1]);
        if (d < dist[v]) {
          dist[v] = d;
          prev[v] = u;
        }
      }
    }
    if (prev[n - 1] < 0) return [];
    const path = [];
    for (let u = n - 1; u !== n - 2; u = prev[u]) path.unshift(all[u]);
    return path;
  }
  function resetInput() {
    pressed.clear();
    joystick = { x: 0, y: 0 };
    look = null;
    joyId = null;
    S.sprint = false;
    $("joystick").firstElementChild.style.transform = "";
  }
  function notice(t) {
    $("aviso").textContent = t;
    noticeTime = 4;
  }
  function tone(freq, duration = 0.2, volume = 0.015) {
    if (S.muted || !audio) return;
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(25, freq * 0.6),
      audio.currentTime + duration,
    );
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  }
  async function start() {
    S.serial++;
    const serial = S.serial;
    resetInput();
    lastStep = 0;
    Object.assign(S, {
      active: true,
      paused: false,
      x: 0,
      z: 10,
      yaw: 0,
      pitch: 0,
      elapsed: 0,
      lives: 3,
      found: 0,
      battery: 100,
      flash: true,
      hidden: false,
      grace: 15,
      ghostX: 0,
      ghostZ: -14,
      route: [],
      patrol: 0,
      repath: 0,
      seen: 0,
      context: null,
    });
    for (const k of keys) {
      k.taken = false;
      k.g.visible = true;
    }
    for (const id of ["portada", "pausa", "final"]) $(id).hidden = true;
    $("hud").hidden = false;
    document.body.classList.remove("cache", "danger");
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      await audio.resume();
    } catch (e) {}
    try {
      const p = await perfilListo;
      if (serial === S.serial && p)
        S.context = p.iniciar("mansion", { modo: "solo" });
    } catch (e) {}
    notice("La puerta tiene tres cerraduras. Encuentra sus llaves.");
  }
  function pause() {
    if (!S.active || S.paused) return;
    S.paused = true;
    resetInput();
    $("pausa").hidden = false;
  }
  function interact() {
    if (!S.active || S.paused) return;
    if (S.hidden) {
      S.hidden = false;
      document.body.classList.remove("cache");
      notice("Saliste del armario.");
      return;
    }
    if (!target) return;
    if (target.type === "llave") {
      target.taken = true;
      target.g.visible = false;
      S.found++;
      tone(520, 0.6, 0.035);
      notice(
        S.found === 3
          ? "Tres llaves. Vuelve a la puerta principal."
          : target.name + " encontrada.",
      );
    } else if (target.type === "armario") {
      S.hidden = true;
      S.flash = false;
      S.seen = 0;
      S.route = [];
      document.body.classList.add("cache");
      resetInput();
      notice("Estás a salvo mientras permanezcas escondido. E para salir.");
    } else if (target.type === "salida") {
      if (S.found === 3) finish(true);
      else notice(`Faltan ${3 - S.found} llaves para abrir.`);
    }
  }
  async function finish(win) {
    if (!S.active) return;
    S.active = false;
    resetInput();
    $("hud").hidden = true;
    $("final").hidden = false;
    document.body.classList.remove("cache", "danger");
    $("titulo-final").textContent = win
      ? "Volviste a ver el amanecer."
      : "La casa te encontró.";
    const seconds = Math.max(1, Math.round(S.elapsed));
    $("resultado").textContent = win
      ? `Escapaste en ${seconds} segundos. Las puertas vuelven a abrirse…`
      : `Encontraste ${S.found} de 3 llaves. Apaga la linterna y usa los armarios cuando se acerque.`;
    $("guardado").textContent = "Guardando resultado…";
    const serial = S.serial;
    try {
      const p = await perfilListo;
      const context = S.context;
      if (!p || !context) throw Error("perfil");
      const token = await context.lista;
      if (!token) throw Error("partida");
      const saved = await fetch("/api/perfil/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: p.pid,
          juego: "mansion",
          tipo: "fin",
          partida: token,
          evento: crypto.randomUUID(),
          datos: { gano: win },
        }),
      });
      if (!saved.ok) throw Error("perfil");
      p.cargar();
      if (win) {
        const r = await fetch("/api/records/mansion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: (
              $("nombre").value.trim() ||
              p?.datos?.nombre ||
              "Visitante"
            ).slice(0, 14),
            puntos: seconds,
          }),
        });
        if (!r.ok) throw Error("record");
      }
      if (serial === S.serial)
        $("guardado").textContent = win
          ? "Escape enviado al perfil y a los récords."
          : "Resultado enviado a tu perfil.";
    } catch (e) {
      if (serial === S.serial)
        $("guardado").textContent =
          "No se pudo confirmar el guardado. Revisa tu conexión.";
    }
  }
  function catchPlayer() {
    S.lives--;
    tone(64, 1, 0.06);
    if (!S.lives) return finish(false);
    S.elapsed += 20;
    S.x = 0;
    S.z = 10;
    S.yaw = 0;
    S.pitch = 0;
    S.ghostX = 0;
    S.ghostZ = -14;
    S.seen = 0;
    S.route = [];
    S.grace = 14;
    S.repath = 0;
    notice("Te encontró. +20 segundos. Las llaves siguen contigo.");
  }
  function update(dt, now) {
    const t = now / 1000;
    if (!S.active) {
      ghost.visible = false;
      camara.position.set(1.3, 1.8, 10.5);
      camara.rotation.set(-0.01, -0.12, 0);
      light.position.copy(camara.position);
      light.target.position.set(-2, 1, -6);
      light.intensity = 1.8;
      return;
    }
    if (S.paused) return;
    ghost.visible = true;
    dt = Math.min(dt, 0.05);
    S.elapsed += dt;
    S.grace = Math.max(0, S.grace - dt);
    noticeTime -= dt;
    if (noticeTime <= 0) $("aviso").textContent = "";
    let forward =
      (pressed.has("KeyW") || pressed.has("ArrowUp") ? 1 : 0) -
      (pressed.has("KeyS") || pressed.has("ArrowDown") ? 1 : 0) -
      joystick.y;
    let side =
      (pressed.has("KeyD") ? 1 : 0) -
      (pressed.has("KeyA") ? 1 : 0) +
      joystick.x;
    const length = Math.max(1, Math.hypot(side, forward));
    side /= length;
    forward /= length;
    if (pressed.has("ArrowLeft")) S.yaw += dt * 1.6;
    if (pressed.has("ArrowRight")) S.yaw -= dt * 1.6;
    const running =
        S.sprint || pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
      moving = !S.hidden && Math.abs(side) + Math.abs(forward) > 0.05,
      speed = running ? 4 : 2.2;
    if (moving) {
      const dx =
          (Math.cos(S.yaw) * side - Math.sin(S.yaw) * forward) * speed * dt,
        dz = (-Math.sin(S.yaw) * side - Math.cos(S.yaw) * forward) * speed * dt;
      if (!blocked(S.x + dx, S.z)) S.x += dx;
      if (!blocked(S.x, S.z + dz)) S.z += dz;
      if (S.elapsed - lastStep > (running ? 0.3 : 0.55)) {
        lastStep = S.elapsed;
        tone(70 + Math.random() * 30, 0.09, 0.015);
      }
    }
    camara.position.set(
      S.x,
      1.65 + (!reducido && moving ? Math.sin(t * speed * 3) * 0.025 : 0),
      S.z,
    );
    camara.rotation.set(S.pitch, S.yaw, 0);
    camara.updateMatrixWorld();
    S.battery = clamp(S.battery + (S.flash ? -1.6 : 4) * dt, 0, 100);
    if (S.battery === 0) S.flash = false;
    light.intensity = S.flash ? 2.8 : 0;
    light.position.copy(camara.position);
    const direction = new THREE.Vector3();
    camara.getWorldDirection(direction);
    light.target.position.copy(camara.position).addScaledVector(direction, 10);
    fill.position.copy(camara.position);
    for (let i = 0; i < candles.length; i++)
      candles[i].intensity = 0.8 + (reducido ? 0 : Math.sin(t * 2 + i) * 0.08);
    keys.forEach((k, i) => {
      k.g.rotation.y = t * 0.7 + i;
      k.g.position.y = k.y + (reducido ? 0 : Math.sin(t * 1.4 + i) * 0.035);
    });
    if (!reducido) dust.rotation.y = Math.sin(t * 0.03) * 0.015;
    const distance = Math.hypot(S.x - S.ghostX, S.z - S.ghostZ),
      visible = !S.hidden && lineFree([S.x, S.z], [S.ghostX, S.ghostZ]);
    const detect =
      S.grace === 0 &&
      !S.hidden &&
      ((visible && distance < (S.flash ? 12 : 4)) ||
        (running && moving && distance < 15));
    if (detect) S.seen = 4;
    else S.seen = Math.max(0, S.seen - dt);
    S.repath -= dt;
    if (S.repath <= 0) {
      S.repath = 0.65;
      let goal;
      if (S.seen > 0 && !S.hidden) goal = [S.x, S.z];
      else {
        const patrol = [nodes[0], nodes[4], nodes[7], nodes[11]];
        goal = patrol[S.patrol % 4];
        if (Math.hypot(S.ghostX - goal[0], S.ghostZ - goal[1]) < 0.7) {
          S.patrol++;
          goal = patrol[S.patrol % 4];
        }
      }
      S.route = routeTo(goal);
    }
    if (S.route.length) {
      const [x, z] = S.route[0],
        dx = x - S.ghostX,
        dz = z - S.ghostZ,
        len = Math.hypot(dx, dz),
        step = Math.min(len, dt * (S.seen > 0 ? 2.8 : 1.1));
      if (len < 0.15) S.route.shift();
      else {
        const nx = S.ghostX + (dx / len) * step,
          nz = S.ghostZ + (dz / len) * step;
        if (!blocked(nx, nz, 0.18)) {
          S.ghostX = nx;
          S.ghostZ = nz;
        } else S.route = [];
        ghost.rotation.y = Math.atan2(dx, dz);
      }
    }
    ghost.position.set(
      S.ghostX,
      reducido ? 0 : Math.sin(t * 2) * 0.04,
      S.ghostZ,
    );
    const danger = !S.hidden && distance < 6 && S.grace === 0;
    document.body.classList.toggle("danger", danger);
    if (!S.hidden && visible && distance < 0.8 && S.grace === 0) catchPlayer();
    if (danger && Math.floor(S.elapsed * 2) !== S.beat) {
      S.beat = Math.floor(S.elapsed * 2);
      tone(47, 0.15, 0.025);
    }
    if (Math.floor(S.elapsed / 9) !== S.creak) {
      S.creak = Math.floor(S.elapsed / 9);
      tone(130, 0.9, 0.009);
    }
    target = null;
    let closest = 2.2;
    for (const p of props) {
      if (p.taken) continue;
      const d = Math.hypot(S.x - p.x, S.z - p.z);
      if (d < closest && lineFree([S.x, S.z], [p.x, p.z])) {
        target = p;
        closest = d;
      }
    }
    // Keys rest on furniture, so test the visible approach point instead of a floor path through the table.
    for (const k of keys)
      if (!k.taken && Math.hypot(S.x - k.x, S.z - k.z) < 1.9) {
        target = k;
        break;
      }
    $("interaccion").style.display = target || S.hidden ? "flex" : "none";
    $("objeto").textContent = S.hidden
      ? "Dentro del armario"
      : target?.name || "";
    $("interactuar").textContent = S.hidden ? "Salir · E" : "Interactuar · E";
    $("llaves").textContent =
      `${S.found} / 3 llaves · ${S.lives} oportunidades`;
    $("mision").textContent =
      S.found === 3
        ? "Vuelve a la puerta del vestíbulo"
        : "Encuentra las tres llaves";
    $("zona").textContent =
      S.x < -6
        ? "BIBLIOTECA"
        : S.x > 6
          ? "COMEDOR"
          : S.z < -10
            ? "CUARTO OLVIDADO"
            : "VESTÍBULO";
    $("tiempo").textContent = `${Math.floor(S.elapsed / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor(S.elapsed % 60)
      .toString()
      .padStart(2, "0")}`;
    $("peligro").textContent = S.hidden
      ? "Estás escondido"
      : S.seen > 0
        ? "TE ESTÁ BUSCANDO"
        : danger
          ? "Escuchas pasos cerca…"
          : "La casa escucha";
    $("linterna").textContent =
      `${S.flash ? "●" : "○"} Linterna ${Math.ceil(S.battery)}%`;
  }
  M.alCuadro(update);
  $("empezar").onclick = start;
  $("otra").onclick = start;
  $("reiniciar").onclick = start;
  $("pausar").onclick = pause;
  $("reanudar").onclick = () => {
    S.paused = false;
    $("pausa").hidden = true;
    resetInput();
  };
  $("interactuar").onclick = interact;
  const toggleFlash = () => {
    if (S.active && !S.paused && !S.hidden && S.battery > 2) S.flash = !S.flash;
  };
  $("linterna").onclick = toggleFlash;
  $("sonido").onclick = () => {
    S.muted = !S.muted;
    $("sonido").textContent =
      "Sonido ambiental: " + (S.muted ? "desactivado" : "activado");
  };
  $("correr").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    S.sprint = true;
    e.target.setPointerCapture(e.pointerId);
  });
  for (const evt of ["pointerup", "pointercancel", "lostpointercapture"])
    $("correr").addEventListener(evt, () => (S.sprint = false));
  window.addEventListener("keydown", (e) => {
    if (!S.active || S.paused) {
      if (e.code === "Escape" && S.active) {
        S.paused = false;
        $("pausa").hidden = true;
      }
      return;
    }
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
    pressed.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyE") interact();
    if (e.code === "KeyF") toggleFlash();
    if (e.code === "Escape") pause();
  });
  window.addEventListener("keyup", (e) => pressed.delete(e.code));
  window.addEventListener("blur", pause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  M.lienzo.addEventListener("pointerdown", (e) => {
    if (!S.active || S.paused || look) return;
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    M.lienzo.setPointerCapture(e.pointerId);
  });
  M.lienzo.addEventListener("pointermove", (e) => {
    if (!look || look.id !== e.pointerId || S.paused) return;
    S.yaw -= (e.clientX - look.x) * 0.004;
    S.pitch = clamp(S.pitch - (e.clientY - look.y) * 0.004, -1.2, 1.2);
    look.x = e.clientX;
    look.y = e.clientY;
  });
  for (const evt of ["pointerup", "pointercancel", "lostpointercapture"])
    M.lienzo.addEventListener(evt, (e) => {
      if (look?.id === e.pointerId) look = null;
    });
  const joy = $("joystick");
  function moveJoy(e) {
    const r = joy.getBoundingClientRect();
    joystick.x = clamp((e.clientX - r.left - r.width / 2) / 38, -1, 1);
    joystick.y = clamp((e.clientY - r.top - r.height / 2) / 38, -1, 1);
    joy.firstElementChild.style.transform = `translate(${joystick.x * 25}px,${joystick.y * 25}px)`;
  }
  joy.addEventListener("pointerdown", (e) => {
    if (joyId !== null) return;
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    moveJoy(e);
  });
  joy.addEventListener("pointermove", (e) => {
    if (e.pointerId === joyId) moveJoy(e);
  });
  for (const evt of ["pointerup", "pointercancel", "lostpointercapture"])
    joy.addEventListener(evt, (e) => {
      if (e.pointerId === joyId) {
        joyId = null;
        joystick = { x: 0, y: 0 };
        joy.firstElementChild.style.transform = "";
      }
    });
  perfilListo.then((p) => {
    if (p?.datos?.nombre) $("nombre").value = p.datos.nombre;
  });
  window.Mansion = {
    estado: S,
    mundo: M,
    bloqueado: blocked,
    ruta: routeTo,
    llaves: keys,
    interactuar: interact,
    iniciar: start,
  };
})();
