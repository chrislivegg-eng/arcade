# Revisión de los juegos nuevos

## Correcciones

- El Impostor permite adivinar la palabra durante la ronda o la votación: acertar termina la ronda y da la victoria inmediata al equipo impostor. Un fallo deja seguir jugando. La comparación acepta diferencias de mayúsculas, acentos y espacios.
- Completa la Frase conserva la votación con dos jugadores y permite sumar puntos.
- Espía vuelve a exigir tres jugadores al iniciar otra ronda después de una salida.
- Los duelos procesan los movimientos recibidos antes de la primera consulta del rival.
- Cada sala nueva empieza en la partida 1, aunque antes se hayan jugado partidas locales.
- Las consultas online no se solapan y las respuestas o avisos de salas anteriores no cierran una sala nueva.
- Los récords online se guardan a nombre de quien juega, también en el segundo celular.
- Básquet presenta los puntos propios con el nombre del jugador correcto en ambos celulares.
- El actualizador corrige la coma faltante del app.py original antes de comprobar su sintaxis.

## Pruebas

Instalar las dependencias de `requirements.txt` en un entorno virtual y ejecutar:

```sh
python -m unittest discover -s tests -v
```

Las pruebas del servidor cubren páginas y recursos de todos los juegos registrados, salas y eventos de duelo, récords, turnos/victoria/revancha de Dardos, partidas completas de los seis juegos de fiesta adicionales, los dos juegos originales de salas, victoria del impostor al adivinar, control de permisos, actualización desde el app.py antiguo y la lista completa de archivos de despliegue, incluida Batalla Naval 3D.

Para las pruebas de navegador se necesita Node.js, Playwright y Microsoft Edge. Con la aplicación disponible en `http://127.0.0.1:5055`:

```sh
python -m flask --app app run --port 5055
# En otra terminal, con Playwright instalado:
node tests/browser-check.cjs
node tests/online-check.cjs
node tests/shared-regression.cjs
node tests/impostor-check.cjs
node tests/naval-check.cjs
node tests/pong-check.cjs
node tests/new-games-check.cjs
node tests/puzzle-check.cjs
node tests/uno-check.cjs
node tests/batch2-smoke.cjs
node tests/batch2-regression.cjs
```

Se puede indicar `PLAYWRIGHT_PATH` para usar una instalación existente de Playwright y `PLAYWRIGHT_CHANNEL` para seleccionar otro canal de Chromium.

- `browser-check.cjs`: arranque y controles de los nueve juegos arcade en vistas de PC y celular, en los modos solo/bot/local que cada uno ofrece.
- `online-check.cjs`: dos sesiones independientes conectadas en cada uno de los nueve juegos arcade, intercambio de eventos y arranque de las ocho interfaces de fiesta con salas.
- `shared-regression.cjs`: entrada tardía, primer movimiento, cambio de sala después de jugar local y récord del invitado.
- `impostor-check.cjs`: tres sesiones móviles, formulario exclusivo del impostor, intento incorrecto, conservación del texto al pasar a votación y victoria inmediata visible para todos.
- `naval-check.cjs`: Batalla Naval 3D, colocación/disparos con el ratón sobre las casillas 3D, victoria contra el bot en PC y móvil emulado, guardado del ranking, reinicio, cancelación de turnos pendientes, partida online PC/móvil completa y alternativa accesible sin WebGL. El guardado del ranking se intercepta para no escribir victorias de prueba.
- `pong-check.cjs`: entrada limpia en los doce vasos de ambos lados, rechazo de roces, 360 tiros de calibración de las tres dificultades del bot, partidas completas PC/móvil con gestos reales, potencia, alternancia de turnos aunque haya dos aciertos, cámara y estela del bot, retirada de tus vasos, revancha, cancelación de partidas y sincronización online. El guardado del ranking se intercepta.
- `new-games-check.cjs`: arranque y controles de los cinco juegos nuevos en PC/móvil; reglas de la bola 8; cancelación de física, cuentas, metas, recargas y animaciones al reiniciar; enemigos nuevos que siguen recibiendo disparos; resultados válidos y conexión/eventos online en los cinco juegos.

Las pruebas de navegador usan Edge en modo headless y una vista móvil emulada. No sustituyen una partida manual completa de cada juego 3D ni una prueba en teléfonos físicos.

## Despliegue

La revisión se realizó localmente; no confirma el estado de una instalación de PythonAnywhere. El script `actualizar.sh` instala los archivos de la rama indicada en `RAMA`; su valor predeterminado es `main`. Debe ejecutarse en la carpeta que contiene el `app.py` del arcade, usando `CARPETA` si no coincide con la predeterminada.

Las salas nuevas viven en memoria: requieren un único proceso de aplicación y se pierden al reiniciar. Para varios procesos hace falta almacenamiento compartido.

El problema anterior de la plantilla faltante en `/memorama_online` se resuelve en esta tanda mediante una redirección al nuevo Memorama Duelo.

## Batalla Naval 3D

La ruta `/juego_naval` ahora muestra dos tableros con perspectiva, agua animada, barcos modelados con iluminación y sombras, proyectiles, salpicaduras, fuego y humo. Conserva los modos bot y online, los tres barcos de una casilla y las APIs y rankings existentes. El sonido es opcional; la preferencia de movimiento reducido detiene el vaivén del agua y los barcos. Si WebGL no está disponible se muestran controles de casillas accesibles para seguir jugando.

El actualizador incluye `templates/juego_naval.html`, `static/naval3d.css` y `static/js/naval3d.js` en su lista de archivos.

## Vaso Pong: puntería y turno del rival

El lanzamiento usa la longitud y dirección del deslizamiento, con un medidor de potencia. Para puntuar, la pelota completa debe cruzar hacia abajo la boca del vaso; la trayectoria se calibra sobre esa altura y la comprobación ocurre en cada subpaso de física de 120 Hz.

Cada jugador dispone de dos tiros y después cambia el turno, sin encadenar turnos extra por acertar ambos. El bot tiene tres niveles de dispersión distintos. Durante un tiro del rival, la cámara muestra los dos extremos de la mesa, la pelota deja una estela y se conserva el plano hasta ver el resultado y la retirada del vaso. Los lanzamientos pendientes se cancelan al salir o iniciar otra partida.

## Integración de los cinco juegos adicionales

Se incorporan Air Hockey, Ping Pong, Billar 8, Karts y Zombis, sus rutas y sus entradas en el menú. La lista del actualizador conserva los cinco juegos y los archivos de Batalla Naval 3D. Vaso Pong conserva el control por deslizamiento, la dificultad y la cámara del rival descritos arriba.

- Billar exige un tiro sin falta para ganar con la 8 y cancela la simulación al abandonar la partida.
- Karts limita cuentas y avisos de meta a la carrera que los creó.
- Zombis descarta animaciones, recargas, oleadas y resultados de partidas anteriores; la retirada de un enemigo verifica que siga perteneciendo a la lista.
- Ping Pong y Air Hockey descartan saques y continuaciones de puntos o goles de una partida anterior.

## Tableros, rompecabezas y perfiles

Se integran UNO, Ajedrez, Damas, Wordle en español, Serpientes y Escaleras, Parchís, 2048, Combina 3, Sudoku y Buscaminas. Se conservan los juegos y correcciones anteriores.

Wordle valida el diccionario incluido y bloquea entradas durante la animación. Sudoku bloquea entradas al quedarse sin vidas y cancela la derrota pendiente al reiniciar. Los nueve juegos de duelo descartan continuaciones de sesiones anteriores, incluidos dados, coronación, finales de tablero y cascadas. El logro de Combina 3 corresponde a una línea de cinco dulces.

Los perfiles se guardan en UTF-8 mediante reemplazo de archivo. Las partidas de arcade reciben una ficha del servidor al comenzar; sus eventos se procesan en orden y el fin solo se cobra una vez. Los reenvíos y fichas expiradas no vuelven a entregar premios. En fiesta se comprueba pertenencia, ronda y resultado directamente en la sala; recargar el resultado no vuelve a cobrarlo. Las compras fallidas no descuentan monedas ni cambian el avatar. Un archivo de perfiles ilegible se conserva y produce error, en lugar de reemplazarse con perfiles vacíos.

Los juegos locales y los duelos de arcade continúan calculando su resultado en el navegador: las monedas son recompensas recreativas, no un sistema contra clientes modificados. Las rondas de fiesta usan el resultado del servidor. Los perfiles siguen ligados al identificador de este navegador; no hay cuentas con contraseña ni sincronización automática entre dispositivos.

La suite tiene 29 pruebas Python. `puzzle-check.cjs` cubre arranque PC/móvil, Wordle y premios, vidas y solución de Sudoku, posiciones legales de Ajedrez, fusiones y cancelación de animaciones, finales de tablero y conexión/jugadas o resultados de los nueve duelos. `uno-check.cjs` completa una ronda PC/móvil, comprueba el logro del ganador y recarga la página para verificar que no duplique monedas.

## Segunda tanda: 28 juegos adicionales

Se agregan Corredor, Rompe-ladrillos, Box, Arco, Voleibol, Hockey sobre Hielo, Sopa de Letras, Mate Rápido, Flow, Tetris, Memorama Duelo, Nonograma, Reversi, Conecta 4 3D, Yahtzee, Curling, Pesca, Paracaidista, Bolos de Nieve, Asteroides, Surf, Drift, Espadas, Papa Caliente, Blackjack, Póker, Lotería y Dominó. La antigua ruta de Memorama Online redirige al duelo y deja de depender de la plantilla faltante.

Las animaciones, temporizadores y continuaciones de los juegos nuevos se vinculan a la sesión que los inició mediante `Arcade.ciclo`. Al salir o comenzar otra partida no pueden causar golpes, puntos, cambios de turno ni pantallas de resultado en la nueva. Flow bloquea la entrada durante el cambio de tablero y cuenta una sola resolución.

En Asteroides cooperativo, el anfitrión resuelve las destrucciones y transmite el marcador con versiones crecientes. Los choques conservan autor nulo, una roca no puntúa dos veces por impactos simultáneos, los eventos tempranos se aplican al generarse la roca y los dos clientes terminan con el mismo resultado confirmado. Blackjack conserva la identidad del jugador activo cuando sale otro asiento; si sale el jugador actual, avanza al siguiente y renueva su tiempo, sin liquidar el resultado dos veces.

`batch2-smoke.cjs` cubre los 96 arranques/controles disponibles en PC/móvil emulado, la conexión y transporte de eventos de 23 duelos y las páginas de mesa/fiesta. `batch2-regression.cjs` reproduce los reinicios de KO, flechas, aterrizajes, dados, cartas, piedras y cuentas; la transición de Flow; y los choques, impactos simultáneos, eventos tempranos, orden del marcador y final de Asteroides online. Las pruebas Python incluyen partidas de mesa con bots y las salidas de asientos de Blackjack.

Quedan pendientes torneos con llaves, reto diario con clasificación del día, skins de equipamiento/fondos y chat rápido. La tienda de avatares y marcos anterior se conserva.
