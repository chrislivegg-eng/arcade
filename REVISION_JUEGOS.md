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

Las 15 pruebas cubren páginas y recursos de todos los juegos registrados, salas y eventos de duelo, récords, turnos/victoria/revancha de Dardos, partidas completas de los seis juegos de fiesta adicionales, los dos juegos originales de salas, victoria del impostor al adivinar, control de permisos, actualización desde el app.py antiguo y la lista completa de archivos de despliegue, incluida Batalla Naval 3D.

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

Durante la revisión general también se detectó un problema anterior en `/memorama_online`: falta su plantilla. No pertenece a los juegos agregados por esta rama y queda fuera de estas correcciones.

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
