// static/js/perfil.js
// Perfil del jugador: avatar, monedas y logros.
//   Perfil.evento(juego, tipo, datos) → avisa al servidor (fin de partida, strike, etc.)
//   Perfil.insignia(elemento)          → muestra "😺 Nombre · 🪙 120" con link al perfil
(() => {
  if (window.Perfil) return;

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
  const leer = (k) => {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const guardar = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  };

  // estilos de los avisos
  const css = document.createElement("style");
  css.textContent = `
    .perfil-avisos{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:100;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(92vw,380px)}
    .perfil-aviso{background:linear-gradient(135deg,#2b1d63,#6c5ce7);color:#fff;border-radius:18px;padding:10px 16px;font-family:Nunito,sans-serif;font-weight:900;box-shadow:0 12px 30px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center;width:100%;animation:perfilEntra .4s ease-out}
    .perfil-aviso .icono{font-size:2rem}
    .perfil-aviso small{display:block;font-weight:700;opacity:.85}
    .perfil-aviso.monedas{background:linear-gradient(135deg,#f7b731,#fa8231);width:auto}
    @keyframes perfilEntra{from{transform:translateY(-30px);opacity:0}to{transform:none;opacity:1}}
    .perfil-insignia{display:inline-flex;align-items:center;gap:8px;padding:6px 14px 6px 6px;border-radius:30px;background:rgba(255,255,255,.92);color:#4a2a3a;font-family:Nunito,sans-serif;font-weight:900;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.15)}
    .perfil-insignia .cara{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:1.25rem;background:#fff;border:3px solid var(--marco,#ff4f8b)}
    .perfil-insignia .monedas{color:#e8930c}
    .marco-arcoiris{border-color:transparent!important;background:linear-gradient(#fff,#fff) padding-box,linear-gradient(90deg,#ff4f8b,#ffd84f,#26de81,#4fb3ff,#a29bfe) border-box!important}
    .marco-oro{border-color:#ffd700!important;box-shadow:0 0 10px #ffd700}
  `;
  document.head.appendChild(css);
  let caja = null;
  function avisar(html, clase = "", ms = 3200) {
    if (!caja) {
      caja = document.createElement("div");
      caja.className = "perfil-avisos";
      document.body.appendChild(caja);
    }
    const d = document.createElement("div");
    d.className = "perfil-aviso " + clase;
    d.innerHTML = html;
    caja.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  let datos = null;
  try {
    datos = JSON.parse(leer("perfil_cache") || "null");
  } catch (e) {}

  async function cargar() {
    try {
      const r = await fetch(`/api/perfil?pid=${encodeURIComponent(PID)}&nombre=${encodeURIComponent(leer("nombreUsuario") || "")}`);
      if (!r.ok) return datos;
      datos = await r.json();
      guardar("perfil_cache", JSON.stringify(datos));
      if (datos.nombre && datos.nombre !== "Jugador") guardar("nombreUsuario", datos.nombre);
      actualizarInsignias();
    } catch (e) {}
    return datos;
  }

  async function editar(cambios) {
    const r = await fetch("/api/perfil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid: PID, ...cambios }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo guardar");
    datos = j;
    guardar("perfil_cache", JSON.stringify(datos));
    if (cambios.nombre) guardar("nombreUsuario", datos.nombre);
    actualizarInsignias();
    return datos;
  }

  function pintarAvatar(el, d) {
    el.textContent = d.avatar;
    if (d.avatar_url && /^\/api\/perfil\/icono\/cuenta:[a-f0-9]{24}\?v=[a-f0-9]{16}$/.test(d.avatar_url)) {
      const img = document.createElement('img');
      img.src = d.avatar_url; img.alt = 'Avatar de ' + d.nombre;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%';
      el.replaceChildren(img);
    }
  }

  async function subirIcono(archivo) {
    if (!['image/png','image/jpeg','image/webp'].includes(archivo.type) || archivo.size > 5*1024*1024)
      throw new Error('Usa una imagen PNG, JPG o WebP de hasta 5 MB');
    const bitmap = await createImageBitmap(archivo);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const lado = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap,(bitmap.width-lado)/2,(bitmap.height-lado)/2,lado,lado,0,0,256,256);
    bitmap.close();
    const r = await fetch('/api/perfil/icono',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({pid:PID,imagen:canvas.toDataURL('image/png')})});
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'No se pudo subir el icono');
    datos = j; guardar('perfil_cache',JSON.stringify(datos)); actualizarInsignias();
    return datos;
  }

  const partidas = new Map();
  const nuevoId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
  function iniciar(juego, config) {
    const contexto = { cola: Promise.resolve() };
    contexto.lista = fetch('/api/perfil/iniciar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: PID, nombre: leer('nombreUsuario') || '', juego, ...config }),
    }).then(async (r) => r.ok ? (await r.json()).partida : null).catch(() => null);
    partidas.set(juego, contexto);
    return contexto;
  }

  function evento(juego, tipo, extra = {}, contexto = partidas.get(juego)) {
    // Mantiene los contadores anteriores al fin y captura la partida antes de cualquier espera.
    const id = nuevoId();
    const enviar = () => enviarEvento(juego, tipo, extra, contexto, id);
    if (!contexto) return enviar(); // Las rondas de fiesta se verifican directamente en su sala.
    contexto.cola = contexto.cola.then(enviar, enviar);
    return contexto.cola;
  }

  async function enviarEvento(juego, tipo, extra, contexto, id) {
    try {
      const partida = contexto ? await contexto.lista : null;
      if (contexto && !partida) return;
      const r = await fetch("/api/perfil/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: PID, juego, tipo, partida, evento: id,
          codigo: extra.codigo, ronda: extra.ronda, nombre: leer("nombreUsuario") || "", datos: extra }),
      });
      if (!r.ok) return;
      const j = await r.json();
      if (datos) {
        datos.monedas = j.monedas;
        (j.logros || []).forEach((l) => { datos.logros[l.id] = Date.now() / 1000; });
        guardar("perfil_cache", JSON.stringify(datos));
      }
      if (j.ganadas > 0 && tipo === "fin") avisar(`<span class="icono">🪙</span> +${j.ganadas} monedas`, "monedas", 2600);
      (j.logros || []).forEach((l, i) =>
        setTimeout(() => avisar(`<span class="icono">${l.icono}</span><span>🏅 ¡Logro desbloqueado!<small>${l.nombre} · ${l.descripcion}${l.premio ? ` · +${l.premio} 🪙` : ""}</small></span>`, "", 4200), 400 + i * 900),
      );
      actualizarInsignias();
    } catch (e) {}
  }

  const insignias = [];
  function claseMarco(m) {
    return m === "arcoiris" ? "marco-arcoiris" : m === "oro" ? "marco-oro" : "";
  }
  function pintarInsignia(el) {
    const d = datos || { nombre: leer("nombreUsuario") || "Jugador", avatar: "😺", marco: "#ff4f8b", monedas: 0 };
    const div = document.createElement("div");
    div.textContent = d.nombre;
    el.innerHTML = `<a class="perfil-insignia" href="/perfil" title="Mi perfil"><span class="cara ${claseMarco(d.marco)}" style="--marco:${d.marco}">${d.avatar}</span><span>${div.innerHTML}</span><span class="monedas">🪙 ${d.monedas_infinitas ? "∞" : d.monedas}</span></a>`;
    pintarAvatar(el.querySelector(".cara"), d);
  }
  function insignia(el) {
    if (!el) return;
    insignias.push(el);
    pintarInsignia(el);
  }
  function actualizarInsignias() {
    insignias.forEach(pintarInsignia);
  }

  window.Perfil = {
    pid: PID,
    pintarAvatar,
    subirIcono,
    cargar,
    editar,
    evento,
    iniciar,
    insignia,
    avisar,
    claseMarco,
    get datos() {
      return datos;
    },
  };
  cargar();
})();
