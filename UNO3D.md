# UNO · Mesa 3D

La página `/uno` conserva las salas, bots y reglas existentes. Añade un escenario WebGL con mesa ovalada, tapete, borde metálico, iluminación, mazo y descarte con grosor, reversos rivales y animaciones de reparto, robo y jugadas especiales. La mano propia conserva botones HTML con relieve y efectos CSS para poder jugar con tacto, mouse y teclado.

Las animaciones usan estados confirmados por el servidor. `ultima_jugada` identifica únicamente el jugador y el identificador de la última carta pública del descarte; no transmite manos rivales. La selección de color se cierra si cambia la ronda, la sala o la validez de la carta. Al salir o cambiar de ronda se cancelan los vuelos y efectos anteriores.

El selector Automática/Alta/Ahorro usa la configuración gráfica compartida. Se respeta la preferencia de movimiento reducido. Si WebGL no inicia, los controles y la mesa clásica siguen disponibles. Las texturas de las cartas, el tapete y los rótulos se generan localmente, sin recursos gráficos ni dependencias externos nuevos.

Validación: `python -m unittest discover -s tests -v` y `node tests/uno3d-browser.cjs` con Playwright y un servidor local. La prueba de navegador recorre una ronda online real, selección de comodín, robo, revancha y salida en PC y móvil emulado; también revisa diez jugadores y la alternativa sin WebGL. El rendimiento no se ha medido en teléfonos físicos.
