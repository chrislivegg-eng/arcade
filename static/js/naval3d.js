/* Batalla Naval: la misma flota de tres barcos, en un océano 3D. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    mode: "",
    phase: "menu",
    player: "p1",
    room: "",
    turn: "p1",
    mine: Array(25).fill(0),
    enemy: Array(25).fill(0),
    placed: [],
    busy: false,
    version: 0,
    won: false,
    saved: false,
  };
  let pollTimer,
    botTimer,
    resultTimer,
    polling = false;
  let audio,
    soundOn = false;
  const boats = [new Map(), new Map()],
    marks = [new Map(), new Map()];
  const effects = [],
    boards = [],
    targets = [];
  let renderer,
    scene,
    camera,
    hover,
    hoverCell = null;
  const canvas = $("oceano"),
    sceneBox = canvas.parentElement;
  const cyan = 0x58e4e2,
    orange = 0xff9865;

  function error(message = "") {
    $("error").textContent = message;
    $("error").hidden = !message;
  }
  function status(title, note, stage = "EN COMBATE", icon = "◎") {
    $("mensaje").textContent = title;
    $("instruccion").textContent = note;
    $("fase-texto").textContent = stage;
    $("fase-icono").textContent = icon;
  }
  async function api(path, body) {
    const response = await fetch(
      path,
      body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await response.json();
    if (!response.ok || data.error)
      throw new Error(data.error || "No se pudo conectar. Inténtalo otra vez.");
    return data;
  }
  function sound(hit) {
    if (!soundOn) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      const osc = audio.createOscillator(),
        gain = audio.createGain(),
        t = audio.currentTime;
      osc.type = hit ? "triangle" : "sine";
      osc.frequency.setValueAtTime(hit ? 150 : 600, t);
      osc.frequency.exponentialRampToValueAtTime(hit ? 35 : 110, t + 0.35);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(t + 0.46);
    } catch (_) {
      /* El juego también funciona sin audio. */
    }
  }
  $("btn-sonido").onclick = () => {
    soundOn = !soundOn;
    $("btn-sonido").setAttribute("aria-pressed", String(soundOn));
    $("btn-sonido").setAttribute(
      "aria-label",
      soundOn ? "Desactivar sonido" : "Activar sonido",
    );
    $("btn-sonido").querySelector("span").textContent = soundOn
      ? "SONIDO ON"
      : "SONIDO OFF";
    if (soundOn) sound(false);
  };

  // ----- Escena: agua, iluminación y maquetas de barcos -----
  function material(color, options = {}) {
    return Graficos3D.material({
      color,
      roughness: 0.48,
      metalness: 0.35,
      ...options,
    });
  }
  function box(parent, w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function labelTexture(text, color) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.font = "500 30px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, 64, 44);
    return new THREE.CanvasTexture(c);
  }
  function waterTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0a536b";
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#62c9d4";
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 18; row++)
      for (let col = 0; col < 8; col++) {
        const x = col * 72 + (row % 2) * 30,
          y = row * 30;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 12, y - 6, x + 24, y);
        ctx.stroke();
      }
    const texture = new THREE.CanvasTexture(c);
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
  function createBoard(side) {
    const group = new THREE.Group();
    scene.add(group);
    const accent = side ? orange : cyan;
    box(group, 6.15, 0.33, 6.15, 0, -0.4, 0, material(0x122b3b));
    box(group, 5.95, 0.12, 5.95, 0, -0.18, 0, material(0x204857));
    box(
      group,
      6.17,
      0.035,
      0.035,
      0,
      -0.3,
      3.075,
      material(accent, { emissive: accent, emissiveIntensity: 0.9 }),
    );
    box(
      group,
      0.035,
      0.035,
      6.17,
      -3.075,
      -0.3,
      0,
      material(accent, { emissive: accent, emissiveIntensity: 0.9 }),
    );
    const waterGeometry = new THREE.PlaneGeometry(5.8, 5.8, 32, 32);
    waterGeometry.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(
      waterGeometry,
      material(side ? 0x96bbdf : 0x8ce2df, {
        map: waterTexture(),
        roughness: 0.42,
        metalness: 0.18,
      }),
    );
    Graficos3D.superficie(water, "agua", { repetir: 3 });
    water.receiveShadow = true;
    group.add(water);
    const lines = [];
    for (let i = 0; i <= 5; i++) {
      const p = -2.5 + i;
      lines.push(
        new THREE.Vector3(p, 0.085, -2.5),
        new THREE.Vector3(p, 0.085, 2.5),
      );
      lines.push(
        new THREE.Vector3(-2.5, 0.085, p),
        new THREE.Vector3(2.5, 0.085, p),
      );
    }
    group.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(lines),
        new THREE.LineBasicMaterial({
          color: side ? 0xa3c4d0 : 0x9cf3ed,
          transparent: true,
          opacity: 0.28,
        }),
      ),
    );
    const cells = [];
    for (let i = 0; i < 25; i++) {
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(0.98, 0.98),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set((i % 5) - 2, 0.1, Math.floor(i / 5) - 2);
      tile.userData = { side, index: i };
      group.add(tile);
      targets.push(tile);
      cells.push(tile);
    }
    for (let i = 0; i < 5; i++) {
      for (const [text, x, z] of [
        [String(i + 1), i - 2, 2.78],
        [String.fromCharCode(65 + i), -2.78, i - 2],
      ]) {
        const tag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.38, 0.19),
          new THREE.MeshBasicMaterial({
            map: labelTexture(text, "#afdae2"),
            transparent: true,
            depthWrite: false,
          }),
        );
        tag.rotation.x = -Math.PI / 2;
        tag.position.set(x, 0.07, z);
        group.add(tag);
      }
    }
    boards.push({ group, water, cells });
  }
  function makeBoat(side) {
    const boat = new THREE.Group();
    const hullMat = material(0x859eaa),
      deckMat = material(side ? 0xd78963 : 0x64bcc1);
    const darkMat = material(0x273d4d),
      whiteMat = material(0xe5eef0);
    const shape = new THREE.Shape();
    shape.moveTo(-0.43, -0.17);
    shape.lineTo(0.25, -0.17);
    shape.lineTo(0.49, 0);
    shape.lineTo(0.25, 0.17);
    shape.lineTo(-0.43, 0.17);
    shape.closePath();
    const hull = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.02,
      }),
      hullMat,
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.19;
    hull.castShadow = true;
    boat.add(hull);
    box(boat, 0.65, 0.045, 0.26, -0.05, 0.23, 0, deckMat);
    box(boat, 0.25, 0.16, 0.23, -0.12, 0.32, 0, whiteMat);
    box(boat, 0.27, 0.065, 0.25, -0.12, 0.43, 0, darkMat);
    box(
      boat,
      0.12,
      0.055,
      0.232,
      -0.04,
      0.35,
      0,
      material(0x135267, { emissive: cyan, emissiveIntensity: 0.35 }),
    );
    box(boat, 0.035, 0.36, 0.035, -0.21, 0.55, 0, darkMat);
    box(boat, 0.19, 0.025, 0.025, -0.21, 0.66, 0, hullMat);
    box(boat, 0.1, 0.06, 0.1, 0.22, 0.28, 0, darkMat);
    box(boat, 0.19, 0.025, 0.025, 0.32, 0.3, 0, hullMat);
    box(boat, 0.08, 0.08, 0.1, -0.32, 0.3, 0, darkMat);
    const wake = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.31, 32),
      new THREE.MeshBasicMaterial({
        color: 0xb8fafa,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.scale.set(1.8, 0.75, 1);
    wake.position.y = 0.035;
    boat.add(wake);
    const smoke = new THREE.Group();
    smoke.visible = false;
    boat.add(smoke);
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 7, 6),
        material(0x66757c, {
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      smoke.add(puff);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.3, 6),
      material(orange, { emissive: 0xff6a20, emissiveIntensity: 1.2 }),
    );
    flame.position.set(0.1, 0.38, 0);
    flame.visible = false;
    boat.add(flame);
    boat.userData = {
      phase: Math.random() * 6,
      destroyed: false,
      wake,
      smoke,
      flame,
    };
    return boat;
  }
  function removeObject(object) {
    object.parent?.remove(object);
    object.traverse((child) => {
      child.geometry?.dispose();
      const materials = child.material
        ? Array.isArray(child.material)
          ? child.material
          : [child.material]
        : [];
      materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
  }
  function ring(color, radius = 0.13) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.025, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }
  function renderBoard(side, values) {
    if (!renderer) return;
    values.forEach((value, index) => {
      const x = (index % 5) - 2,
        z = Math.floor(index / 5) - 2;
      const showBoat = (side === 0 && value === 1) || value === 3;
      if (showBoat && !boats[side].has(index)) {
        const boat = makeBoat(side);
        boat.position.set(x, 0, z);
        boat.rotation.y = ((index % 3) - 1) * 0.18;
        boards[side].group.add(boat);
        boats[side].set(index, boat);
      }
      if (!showBoat && boats[side].has(index)) {
        removeObject(boats[side].get(index));
        boats[side].delete(index);
      }
      const boat = boats[side].get(index);
      if (boat) {
        boat.userData.destroyed = value === 3;
        if (value === 3)
          boat.traverse((child) => {
            if (
              child.material?.color &&
              child !== boat.userData.wake &&
              child !== boat.userData.flame &&
              child.parent !== boat.userData.smoke
            )
              child.material.color.set(0x574b48);
          });
        boat.userData.smoke.visible = boat.userData.flame.visible = value === 3;
      }
      if (value >= 2 && !marks[side].has(index)) {
        const marker = ring(
          value === 3 ? orange : 0xb0d8f4,
          value === 3 ? 0.35 : 0.12,
        );
        marker.position.set(x, 0.1, z);
        boards[side].group.add(marker);
        marks[side].set(index, marker);
      }
      if (value < 2 && marks[side].has(index)) {
        removeObject(marks[side].get(index));
        marks[side].delete(index);
      }
    });
  }
  function projectCell(side, index) {
    const p = new THREE.Vector3(
      (index % 5) - 2,
      0.12,
      Math.floor(index / 5) - 2,
    );
    boards[side].group.localToWorld(p);
    p.project(camera);
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) * r.width) / 2,
      y: r.top + ((1 - p.y) * r.height) / 2,
    };
  }
  function resize() {
    if (!renderer) return;
    const { width, height } = canvas.getBoundingClientRect(),
      mobile = width < 580;
    renderer.setSize(width, height, false);
    const aspect = width / height,
      half = mobile ? 8.1 : 4.7;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.position.set(mobile ? 0 : 5, 14, mobile ? 12 : 14);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    boards[0].group.position.set(mobile ? 0 : -3.6, 0, mobile ? 3.65 : 0.35);
    boards[1].group.position.set(mobile ? 0 : 3.6, 0, mobile ? -3.65 : -0.35);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    boards.forEach((board, side) => {
      const p = new THREE.Vector3(0, 0.1, -3.45);
      board.group.localToWorld(p);
      p.project(camera);
      const label = $(side ? "label-enemigo" : "label-mio");
      label.style.left = ((p.x + 1) * width) / 2 + "px";
      label.style.top = ((1 - p.y) * height) / 2 + "px";
    });
  }
  function impact(side, index, hit) {
    if (!renderer) {
      sound(hit);
      return;
    }
    const destination = new THREE.Vector3(
      (index % 5) - 2,
      0.15,
      Math.floor(index / 5) - 2,
    );
    boards[side].group.localToWorld(destination);
    const start = boards[1 - side].group.position
      .clone()
      .add(new THREE.Vector3(0, 0.5, 0));
    const missile = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2c6 }),
    );
    scene.add(missile);
    const born = performance.now(),
      duration = reducedMotion.matches ? 1 : 650;
    effects.push({
      object: missile,
      tick(now) {
        const t = Math.min(1, (now - born) / duration);
        missile.position.lerpVectors(start, destination, t);
        missile.position.y += Math.sin(t * Math.PI) * 3;
        if (t < 1) return true;
        burst(destination, hit);
        sound(hit);
        return false;
      },
    });
  }
  function burst(position, hit) {
    const count = reducedMotion.matches ? 3 : 18,
      born = performance.now();
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(hit ? 0.06 : 0.035, 5, 4),
        new THREE.MeshBasicMaterial({
          color: hit ? (i % 2 ? 0xffb453 : 0xff6549) : 0xbceef8,
          transparent: true,
        }),
      );
      const angle = Math.random() * Math.PI * 2,
        speed = 0.4 + Math.random();
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        0.8 + Math.random() * 2,
        Math.sin(angle) * speed,
      );
      scene.add(particle);
      effects.push({
        object: particle,
        tick(now) {
          const t = (now - born) / 1000;
          particle.position.copy(position).addScaledVector(velocity, t);
          particle.position.y -= t * t * 1.8;
          particle.material.opacity = Math.max(0, 1 - t);
          return t < 1;
        },
      });
    }
    const splash = ring(hit ? orange : 0xc0f7ff, 0.15);
    splash.position.copy(position);
    scene.add(splash);
    effects.push({
      object: splash,
      tick(now) {
        const t = (now - born) / 1000;
        splash.scale.setScalar(1 + t * 6);
        splash.material.opacity = Math.max(0, 0.8 - t);
        return t < 0.8;
      },
    });
    if (hit && !reducedMotion.matches) {
      $("flash").classList.remove("active");
      void $("flash").offsetWidth;
      $("flash").classList.add("active");
    }
  }
  function initialize3D() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xb5efff, 0x173548, 0.65));
      const sun = new THREE.DirectionalLight(0xfff1df, 1.25);
      sun.position.set(-3, 10, 5);
      sun.castShadow = true;
      Object.assign(sun.shadow.camera, {
        left: -12,
        right: 12,
        top: 12,
        bottom: -12,
      });
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.bias = -0.0005;
      scene.add(sun);
      const rim = new THREE.DirectionalLight(cyan, 0.65);
      rim.position.set(5, 3, -7);
      scene.add(rim);
      createBoard(0);
      createBoard(1);
      Graficos3D.configurar({renderer,escena:scene}, "interior");
      Graficos3D.selector($("pantalla-menu").querySelector(".menu-copy"));
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(70, 70),
        new THREE.ShadowMaterial({ opacity: 0.22 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.62;
      floor.receiveShadow = true;
      scene.add(floor);
      hover = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 0.94),
        new THREE.MeshBasicMaterial({
          color: cyan,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      hover.rotation.x = -Math.PI / 2;
      hover.visible = false;
      scene.add(hover);
      new ResizeObserver(resize).observe(sceneBox);
      resize();
      const ray = new THREE.Raycaster(),
        pointer = new THREE.Vector2();
      let down;
      function pick(event) {
        const r = canvas.getBoundingClientRect();
        pointer.set(
          ((event.clientX - r.left) / r.width) * 2 - 1,
          (-(event.clientY - r.top) / r.height) * 2 + 1,
        );
        ray.setFromCamera(pointer, camera);
        return ray.intersectObjects(targets)[0]?.object.userData;
      }
      canvas.addEventListener("pointermove", (event) => {
        const cell = pick(event);
        hoverCell = cell;
        hover.visible =
          !!cell &&
          ((cell.side === 0 && state.phase === "placing") ||
            (cell.side === 1 && canFire()));
        if (cell) {
          const position = boards[cell.side].cells[cell.index].getWorldPosition(
            new THREE.Vector3(),
          );
          hover.position.copy(position);
          hover.position.y = 0.12;
          hover.material.color.set(cell.side ? orange : cyan);
          $("coordenada").textContent =
            `${cell.side ? "ENEMIGO" : "TU FLOTA"} / ${coordinate(cell.index)}`;
        }
      });
      canvas.addEventListener("pointerleave", () => {
        hover.visible = false;
        hoverCell = null;
      });
      canvas.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY };
      });
      canvas.addEventListener("pointerup", (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12)
          return;
        const cell = pick(e);
        down = null;
        if (cell) cell.side ? fire(cell.index) : place(cell.index);
      });
      let last = 0;
      function animate(now) {
        requestAnimationFrame(animate);
        if (
          document.hidden ||
          now - last < 1000 / (reducedMotion.matches ? 15 : 40)
        )
          return;
        last = now;
        const t = reducedMotion.matches ? 0 : now / 1000;
        boards.forEach((board) => {
          const positions = board.water.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++)
            positions.setY(
              i,
              Math.sin(positions.getX(i) * 3 + t * 1.2) * 0.035 +
                Math.cos(positions.getZ(i) * 4 - t) * 0.025,
            );
          positions.needsUpdate = true;
          board.water.geometry.computeVertexNormals();
          board.water.material.map.offset.set(t * 0.007, t * 0.012);
        });
        boats.forEach((map) =>
          map.forEach((boat) => {
            const p = boat.userData.phase,
              dead = boat.userData.destroyed;
            boat.position.y = dead ? -0.05 : Math.sin(t * 1.6 + p) * 0.025;
            boat.rotation.z = (dead ? 0.18 : 0) + Math.sin(t * 1.4 + p) * 0.025;
            boat.rotation.x = Math.cos(t + p) * 0.02;
            boat.userData.wake.material.opacity = dead
              ? 0.1
              : 0.22 + Math.sin(t * 2 + p) * 0.1;
            if (dead) {
              boat.userData.flame.scale.y = 1 + Math.sin(t * 9 + p) * 0.2;
              boat.userData.smoke.children.forEach((puff, i) => {
                const age = (t * 0.5 + i / 3) % 1;
                puff.position.set(
                  0.06 + age * 0.15,
                  0.4 + age * 0.7,
                  Math.sin(i) * 0.04,
                );
                puff.scale.setScalar(0.4 + age * 1.5);
                puff.material.opacity = 0.35 * (1 - age);
              });
            }
          }),
        );
        for (let i = effects.length - 1; i >= 0; i--)
          if (!effects[i].tick(now)) {
            removeObject(effects[i].object);
            effects.splice(i, 1);
          }
        if (hover.visible && !hoverCell) hover.visible = false;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(animate);
    } catch (_) {
      renderer = null;
      sceneBox.hidden = true;
      $("vista-tactica").open = true;
      error(
        "La vista 3D no está disponible en este navegador. Puedes jugar con la vista táctica.",
      );
      $("label-mio").hidden = $("label-enemigo").hidden = true;
    }
  }

  // ----- Estado y reglas: bot y las salas online existentes -----
  function coordinate(i) {
    return String.fromCharCode(65 + Math.floor(i / 5)) + ((i % 5) + 1);
  }
  function canFire() {
    return (
      state.phase === "playing" &&
      !state.busy &&
      (state.mode !== "online" || state.turn === state.player)
    );
  }
  function draw() {
    renderBoard(0, state.mine);
    renderBoard(1, state.enemy);
    const ownHits = state.mine.filter((v) => v === 3).length,
      enemyHits = state.enemy.filter((v) => v === 3).length;
    $("cuenta-mia").textContent =
      `${state.phase === "placing" ? state.placed.length : 3 - ownHits} / 3`;
    $("cuenta-enemiga").textContent = `${3 - enemyHits} / 3`;
    for (let side = 0; side < 2; side++) {
      const values = side ? state.enemy : state.mine;
      const buttons = $(side ? "t-enemigo" : "t-mio").children;
      values.forEach((value, i) => {
        const visible = side && value === 1 ? 0 : value;
        buttons[i].dataset.value = visible;
        buttons[i].textContent =
          visible === 3
            ? "✹"
            : visible === 2
              ? "·"
              : visible === 1
                ? "▰"
                : coordinate(i);
        buttons[i].setAttribute(
          "aria-label",
          `${coordinate(i)}: ${["agua sin explorar", "barco", "disparo al agua", "barco hundido"][visible]}`,
        );
        buttons[i].disabled = side
          ? !canFire() || value >= 2
          : state.phase !== "placing" || value !== 0;
      });
    }
    $("btn-azar").hidden = state.phase !== "placing";
    if (hover && hoverCell)
      hover.visible =
        (hoverCell.side === 0 && state.phase === "placing") ||
        (hoverCell.side === 1 && canFire());
  }
  function clearSession() {
    state.version++;
    clearTimeout(botTimer);
    clearTimeout(resultTimer);
    clearInterval(pollTimer);
    state.busy = false;
    state.won = false;
    state.saved = false;
    state.room = "";
    state.turn = "p1";
    state.mine = Array(25).fill(0);
    state.enemy = Array(25).fill(0);
    state.placed = [];
    $("resultado").close();
    $("record-status").textContent = "";
    $("btn-guardar").disabled = false;
    effects.splice(0).forEach((e) => removeObject(e.object));
    error(
      renderer
        ? ""
        : "La vista 3D no está disponible. Puedes jugar con los tableros de la vista táctica.",
    );
  }
  function showPanel(name) {
    ["menu", "lobby", "juego"].forEach((n) => {
      $("pantalla-" + n).hidden = n !== name;
    });
  }
  function preview() {
    renderBoard(
      0,
      [
        1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0,
        0,
      ],
    );
    renderBoard(1, Array(25).fill(0));
    $("cuenta-mia").textContent = "3 / 3";
    $("cuenta-enemiga").textContent = "? / 3";
  }
  function menu() {
    clearSession();
    state.mode = "";
    state.phase = "menu";
    showPanel("menu");
    $("modo-badge").textContent = "VISTA DE RECONOCIMIENTO";
    preview();
  }
  function start(mode, room = "", player = "p1") {
    clearSession();
    window.Perfil && Perfil.iniciar("naval", { modo: mode });
    state.mode = mode;
    state.room = room;
    state.player = player;
    state.phase = "placing";
    showPanel("juego");
    $("texto-codigo-sala").hidden = mode !== "online";
    $("texto-codigo-sala").textContent = "SALA " + room;
    $("modo-badge").textContent =
      mode === "bot" ? "MISIÓN / CONTRA EL BOT" : "MISIÓN ONLINE / " + room;
    status(
      "Coloca 3 barcos en tu mar",
      "Toca tres casillas del tablero azul para desplegar tu flota.",
      "DESPLIEGUE",
      "＋",
    );
    if (mode === "bot") {
      let n = 0;
      while (n < 3) {
        const i = Math.floor(Math.random() * 25);
        if (!state.enemy[i]) {
          state.enemy[i] = 1;
          n++;
        }
      }
    } else {
      pollTimer = setInterval(sync, 850);
      sync();
    }
    draw();
  }
  async function place(index) {
    if (state.phase !== "placing" || state.mine[index]) return;
    state.mine[index] = 1;
    state.placed.push(index);
    sound(false);
    draw();
    status(
      `${state.placed.length} de 3 barcos desplegados`,
      "Elige bien: estas posiciones no las verá tu rival.",
      "DESPLIEGUE",
      "＋",
    );
    if (state.placed.length < 3) return;
    state.phase = "waiting";
    draw();
    const version = state.version;
    if (state.mode === "bot") {
      state.phase = "playing";
      turnStatus();
      draw();
      return;
    }
    status(
      "Flota lista para zarpar",
      "Esperando a que tu amigo despliegue sus tres barcos.",
      "EN ESPERA",
      "◷",
    );
    try {
      await api("/api/colocar_nav", {
        sala: state.room,
        jugador: state.player,
        barcos: state.placed,
      });
      if (version === state.version) sync();
    } catch (e) {
      if (version !== state.version) return;
      state.phase = "placing";
      state.placed = [];
      state.mine.fill(0);
      draw();
      status(
        "Vuelve a desplegar tu flota",
        "No se pudieron confirmar los barcos. Elige tres casillas otra vez.",
        "DESPLIEGUE",
        "＋",
      );
      error(e.message);
    }
  }
  function turnStatus() {
    const mine = state.turn === state.player || state.mode === "bot";
    status(
      mine ? "Tu turno. Elige una coordenada." : "El enemigo está apuntando…",
      mine
        ? "Toca el mar enemigo. Si aciertas, vuelves a disparar."
        : "Tu flota está en alerta. Espera el disparo de tu rival.",
      mine ? "OBJETIVO EN LA MIRA" : "FLOTA EN ALERTA",
      mine ? "⌖" : "◈",
    );
  }
  async function sync() {
    if (!state.room || polling) return;
    polling = true;
    const version = state.version,
      room = state.room;
    try {
      const data = await api(
        `/api/estado_nav?sala=${encodeURIComponent(room)}&jugador=${state.player}`,
      );
      if (version !== state.version) return;
      error();
      state.turn = data.turno;
      if (state.phase === "placing") return;
      data.mi_tablero.forEach((v, i) => {
        if (v >= 2 && state.mine[i] !== v) impact(0, i, v === 3);
      });
      data.tablero_rival.forEach((v, i) => {
        if (v >= 2 && state.enemy[i] !== v) impact(1, i, v === 3);
      });
      state.mine = data.mi_tablero;
      state.enemy = data.tablero_rival;
      if (data.estado === "terminado") finish(data.ganador === state.player);
      else if (data.estado === "jugando") {
        state.phase = "playing";
        turnStatus();
      }
      draw();
    } catch (e) {
      if (version === state.version) error(e.message);
    } finally {
      polling = false;
    }
  }
  async function fire(index) {
    if (!canFire() || state.enemy[index] >= 2) return;
    state.busy = true;
    draw();
    const version = state.version;
    if (state.mode === "online") {
      try {
        await api("/api/disparar_nav", {
          sala: state.room,
          jugador: state.player,
          idx: index,
        });
        if (version === state.version) await sync();
      } catch (e) {
        if (version === state.version) error(e.message);
      } finally {
        if (version === state.version) {
          state.busy = false;
          draw();
        }
      }
      return;
    }
    const hit = state.enemy[index] === 1;
    state.enemy[index] = hit ? 3 : 2;
    impact(1, index, hit);
    draw();
    status(
      hit ? "Impacto confirmado." : "Agua. Cambiamos de turno.",
      hit
        ? "Un barco menos. Busca el siguiente objetivo."
        : "El bot está preparando su respuesta.",
      hit ? "OBJETIVO HUNDIDO" : "DISPARO AL AGUA",
      hit ? "✹" : "◷",
    );
    botTimer = setTimeout(() => {
      if (version !== state.version) return;
      if (state.enemy.filter((v) => v === 3).length === 3) {
        state.busy = false;
        finish(true);
        draw();
        return;
      }
      if (hit) {
        state.busy = false;
        turnStatus();
        draw();
      } else botShot(version);
    }, 850);
  }
  function botShot(version) {
    if (version !== state.version || state.phase === "finished") return;
    const available = state.mine
      .map((v, i) => (v < 2 ? i : -1))
      .filter((i) => i >= 0);
    if (!available.length) return;
    const index = available[Math.floor(Math.random() * available.length)],
      hit = state.mine[index] === 1;
    state.mine[index] = hit ? 3 : 2;
    impact(0, index, hit);
    draw();
    botTimer = setTimeout(() => {
      if (version !== state.version) return;
      state.busy = false;
      if (state.mine.filter((v) => v === 3).length === 3) finish(false);
      else turnStatus();
      draw();
    }, 850);
  }
  function finish(won) {
    if (state.phase === "finished") return;
    state.phase = "finished";
    state.won = won;
    window.Perfil && Perfil.evento("naval", "fin", { gano: won });
    clearInterval(pollTimer);
    status(
      won ? "Victoria. La flota rival ha caído." : "Tu flota ha sido hundida.",
      "Misión terminada. Puedes volver a intentarlo.",
      "MISIÓN COMPLETADA",
      won ? "✦" : "◈",
    );
    $("resultado-titulo").textContent = won
      ? "Océano bajo control."
      : "Volveremos a zarpar.";
    $("resultado-nota").textContent = won
      ? "Hundiste los tres barcos enemigos. Buena puntería, capitán."
      : "El rival encontró tus tres barcos. Una nueva estrategia te espera.";
    $("resultado-icono").textContent = won ? "✦" : "◈";
    $("guardar-record").hidden = !won;
    try {
      $("nombre-record").value = localStorage.getItem("nombreUsuario") || "";
    } catch (_) {}
    const version = state.version;
    resultTimer = setTimeout(() => {
      if (version === state.version && !$("resultado").open)
        $("resultado").showModal();
    }, 1100);
  }
  async function saveVictory() {
    if (!state.won || state.saved || state.phase !== "finished") return;
    const name = $("nombre-record").value.trim();
    if (!name) {
      $("record-status").textContent =
        "Escribe tu nombre para guardar la victoria.";
      return;
    }
    $("btn-guardar").disabled = true;
    const version = state.version;
    try {
      await api(
        state.mode === "online"
          ? "/guardar_victoria_nav_online"
          : "/guardar_victoria_nav",
        { nombre: name },
      );
      if (version !== state.version) return;
      state.saved = true;
      $("record-status").textContent = "Victoria guardada en el ranking.";
      try {
        localStorage.setItem("nombreUsuario", name);
      } catch (_) {}
    } catch (e) {
      if (version === state.version) {
        $("btn-guardar").disabled = false;
        $("record-status").textContent = e.message;
      }
    }
  }
  async function lobbyAction(join) {
    const version = state.version;
    $("btn-crear").disabled = true;
    error();
    try {
      if (join) {
        const code = $("input-codigo").value.trim().toUpperCase();
        if (!/^[A-Z0-9]{4}$/.test(code))
          throw new Error("Escribe el código de cuatro letras o números.");
        await api("/api/unirse_nav?sala=" + encodeURIComponent(code));
        if (version === state.version) start("online", code, "p2");
      } else {
        const data = await api("/api/crear_sala_nav", {});
        if (version === state.version) start("online", data.sala, "p1");
      }
    } catch (e) {
      if (version === state.version) error(e.message);
    } finally {
      $("btn-crear").disabled = false;
    }
  }
  for (let side = 0; side < 2; side++)
    for (let i = 0; i < 25; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = coordinate(i);
      button.onclick = () => (side ? fire(i) : place(i));
      $(side ? "t-enemigo" : "t-mio").appendChild(button);
    }
  $("btn-bot").onclick = () => start("bot");
  $("btn-online").onclick = () => {
    clearSession();
    state.phase = "lobby";
    showPanel("lobby");
  };
  $("form-sala").onsubmit = (e) => {
    e.preventDefault();
    lobbyAction(true);
  };
  $("btn-crear").onclick = () => lobbyAction(false);
  $("btn-azar").onclick = () => {
    while (state.phase === "placing") {
      const free = state.mine
        .map((v, i) => (!v ? i : -1))
        .filter((i) => i >= 0);
      place(free[Math.floor(Math.random() * free.length)]);
    }
  };
  function restart() {
    state.mode === "online"
      ? (menu(), showPanel("lobby"), (state.phase = "lobby"))
      : start("bot");
  }
  $("btn-reiniciar").onclick = restart;
  $("btn-otra").onclick = restart;
  $("btn-guardar").onclick = saveVictory;
  document.querySelectorAll("[data-volver]").forEach((b) => {
    b.onclick = menu;
  });
  initialize3D();
  menu();
  // Coordenadas públicas para los controles accesibles y las pruebas de puntería.
  window.Naval = {
    projectCell,
    get phase() {
      return state.phase;
    },
    get mode() {
      return state.mode;
    },
  };
})();
