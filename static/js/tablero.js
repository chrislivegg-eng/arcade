// static/js/tablero.js
// Cosas compartidas por Ajedrez y Damas: dibujar un tablero de 8x8,
// tocar para elegir/mover y sincronizar jugadas online en orden.
window.Tablero = (() => {
  // pinta las 64 casillas una sola vez; luego solo cambian clases y contenido
  function crear(el, alTocar) {
    el.innerHTML = Array.from({ length: 64 }, (_, i) => `<div class="casilla ${((i >> 3) + (i & 7)) % 2 ? "oscura" : "clara"}" data-i="${i}"><span class="pieza"></span></div>`).join("");
    el.addEventListener("click", (e) => {
      const c = e.target.closest(".casilla");
      if (c) alTocar(+c.dataset.i);
    });
    return [...el.children];
  }

  // Las jugadas online llegan numeradas; se aplican en orden aunque lleguen revueltas
  function cola(aplicar) {
    let pendientes = {};
    return {
      reiniciar() {
        pendientes = {};
      },
      recibir(n, jugada, actual) {
        pendientes[n] = jugada;
        let k = actual();
        while (pendientes[k]) {
          const j = pendientes[k];
          delete pendientes[k];
          aplicar(j);
          k = actual();
        }
      },
    };
  }

  // El bot piensa sin congelar la pantalla
  function pensar(fn, ms = 350) {
    return new Promise((ok) => setTimeout(() => ok(fn()), ms));
  }

  return { crear, cola, pensar };
})();
