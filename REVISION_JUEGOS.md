# Revisión de los juegos nuevos

## Correcciones

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

Las 12 pruebas cubren páginas y recursos de los juegos nuevos, salas y eventos de los ocho juegos de duelo, récords, turnos/victoria/revancha de Dardos, partidas completas de los seis juegos de fiesta adicionales, los dos juegos originales de salas y actualización desde el app.py antiguo.

Para las pruebas de navegador se necesita Node.js, Playwright y Microsoft Edge. Con la aplicación disponible en `http://127.0.0.1:5055`:

```sh
python -m flask --app app run --port 5055
# En otra terminal, con Playwright instalado:
node tests/browser-check.cjs
node tests/online-check.cjs
node tests/shared-regression.cjs
```

Se puede indicar `PLAYWRIGHT_PATH` para usar una instalación existente de Playwright y `PLAYWRIGHT_CHANNEL` para seleccionar otro canal de Chromium.

- `browser-check.cjs`: arranque y controles de los nueve juegos arcade en vistas de PC y celular, en los modos solo/bot/local que cada uno ofrece.
- `online-check.cjs`: dos sesiones independientes conectadas en cada uno de los nueve juegos arcade, intercambio de eventos y arranque de las ocho interfaces de fiesta con salas.
- `shared-regression.cjs`: entrada tardía, primer movimiento, cambio de sala después de jugar local y récord del invitado.

Las pruebas de navegador usan Edge en modo headless y una vista móvil emulada. No sustituyen una partida manual completa de cada juego 3D ni una prueba en teléfonos físicos.

## Despliegue

La revisión se realizó localmente; no confirma el estado de una instalación de PythonAnywhere. El script `actualizar.sh` instala los archivos de la rama indicada en `RAMA`; su valor predeterminado es `claude/sweet-cray-umwhon`. Debe ejecutarse en la carpeta que contiene el `app.py` del arcade, usando `CARPETA` si no coincide con la predeterminada.

Las salas nuevas viven en memoria: requieren un único proceso de aplicación y se pierden al reiniciar. Para varios procesos hace falta almacenamiento compartido.

Durante la revisión general también se detectó un problema anterior en `/memorama_online`: falta su plantilla. No pertenece a los juegos agregados por esta rama y queda fuera de estas correcciones.
