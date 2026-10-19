# Pinball Nova

Mesa original de Chris Arcade, accesible en `/juego/pinball`. Conserva el concepto de máquina clásica y los controles de la referencia pedida (https://playpager.com/juego-pinball/): mantener y soltar el lanzador, dos palancas independientes, rebotes y puntuación. La mesa, el dibujo, los efectos y el código son propios; no se incrusta ni se reutiliza el juego externo.

## Partida

Tres bolas, lanzador de potencia variable, tres bumpers, dos slingshots, pasillos para multiplicador hasta ×5, cuatro objetivos NOVA con jackpot, spinner y bonus al perder cada bola. Una carga insuficiente vuelve al lanzador sin consumir bola. Cada bola tiene un único salvado durante sus primeros seis segundos en la mesa.

La física usa pasos fijos de 1/240 s y colisión con segmentos, círculos y palancas móviles. La velocidad de la palanca se incorpora al impulso de contacto; mantenerla arriba no da golpes a distancia. El hueco central permite perder la bola de forma natural. El dibujo es Canvas 2D con volumen, reflejos y sombras; no requiere WebGL.

PC: flechas o A/D para las palancas; abajo o espacio para cargar. Celular: mantener la mesa para lanzar y después tocar sus mitades; los botones inferiores también admiten dos dedos simultáneos. Cancelar un toque, perder foco o pausar suelta los controles. P/Escape pausa. Incluye sonido, pantalla completa y adaptación a tamaño/orientación.

Las partidas completadas registran récord y progreso con las API existentes. Terminar anticipadamente no envía resultado. El guardado asíncrono de una partida anterior no modifica la pantalla de una revancha.

## Validación

- `node tests/pinball-fisica.cjs`: lanzamiento, carga insuficiente, impulsos de ambas palancas, multiplicador, jackpot, tres bolas, bonus, salvado único, estabilidad temporal y caída natural sin usar palancas.
- `tests/pinball-browser.cjs`: teclado y toque, multitáctil independiente, pausa, dimensiones, guardado único y revancha en PC/móvil emulado. Se fuerzan caídas al final para verificar persistencia, tras jugar con controles reales.
- `tests/test_pinball.py`: ruta, conservación del mejor récord y progreso sin duplicar partidas.

No se ha medido el rendimiento en un teléfono físico. Los archivos necesarios están incluidos en `archivos_nuevos.txt`.

