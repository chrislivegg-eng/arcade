// static/js/scripts.js

// 1. Función para obtener o pedir el nombre del usuario
function obtenerNombreUsuario() {
  let nombre = localStorage.getItem("nombreUsuario");

  // Si no existe, está vacío o es null, lo pedimos
  if (!nombre || nombre === "null" || nombre === "") {
    nombre = prompt("¡Hola! ¿Cómo te llamas para los récords?");
    if (nombre && nombre.trim() !== "") {
      // Normalizamos: Quita espacios, minúsculas, y pone mayúscula al inicio
      nombre = nombre
        .trim()
        .toLowerCase()
        .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
      localStorage.setItem("nombreUsuario", nombre);
    } else {
      nombre = "Invitado";
      localStorage.setItem("nombreUsuario", nombre);
    }
  }
  return nombre;
}

// 2. Función para enviar datos al servidor sin repetir código en cada juego
function enviarPuntaje(ruta, datosExtra) {
  let nombre = obtenerNombreUsuario();

  // Combinamos el nombre con los datos que nos mande el juego (ej: puntos o intentos)
  let payload = { nombre: nombre, ...datosExtra };

  fetch(ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Datos enviados correctamente:", data);
      setTimeout(mostrarAnuncioArcade, 250);
    })
    .catch((error) => console.error("Error al enviar:", error));
}

// Los juegos clásicos llaman enviarPuntaje al terminar. Esta capa les añade la
// misma recomendación interna que usan las pantallas modernas del arcade.
function mostrarAnuncioArcade() {
  if (document.getElementById("anuncio-clasico")) return;
  const pintar = () => {
    if (!window.Perfil?.anuncioFinal || document.getElementById("anuncio-clasico")) return;
    const capa = document.createElement("div");
    capa.id = "anuncio-clasico";
    capa.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:#090611d9;backdrop-filter:blur(8px)";
    const tarjeta = document.createElement("section");
    tarjeta.style.cssText =
      "width:min(92vw,420px);padding:22px;border-radius:24px;background:#21162bea;color:white;font-family:Nunito,Arial,sans-serif;box-shadow:0 28px 80px #0009";
    const titulo = document.createElement("h2");
    titulo.textContent = "¿Qué vas a jugar ahora?";
    titulo.style.textAlign = "center";
    const cerrar = document.createElement("button");
    cerrar.textContent = "Seguir aquí";
    cerrar.style.cssText =
      "width:100%;padding:13px;border:0;border-radius:14px;background:#ffffff18;color:white;font:800 16px Nunito,Arial;cursor:pointer";
    cerrar.onclick = () => capa.remove();
    tarjeta.append(titulo, cerrar);
    capa.appendChild(tarjeta);
    document.body.appendChild(capa);
    Perfil.anuncioFinal(tarjeta, location.pathname.split("/").pop());
  };
  if (window.Perfil?.anuncioFinal) return pintar();
  let script = document.getElementById("script-perfil-clasico");
  if (!script) {
    script = document.createElement("script");
    script.id = "script-perfil-clasico";
    script.src = "/static/js/perfil.js";
    document.head.appendChild(script);
  }
  script.addEventListener("load", pintar, { once: true });
}
