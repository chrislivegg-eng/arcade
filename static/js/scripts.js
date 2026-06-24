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
    })
    .catch((error) => console.error("Error al enviar:", error));
}
