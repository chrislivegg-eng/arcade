# Umbra · El templo perdido

Juego individual en primera persona disponible en `/juego/templo` y en el menú del arcade. Explora las cámaras laterales, copia sus inscripciones en el diario, despierta los tres altares y cruza la puerta del santuario para recuperar la reliquia.

## Controles

- Computadora: WASD para caminar, arrastrar el mouse para mirar, E para examinar, J para el diario y Esc para cerrar una lectura o pausar. Las flechas también permiten avanzar y girar.
- Celular: palanca izquierda para caminar y arrastrar sobre el escenario para mirar. El botón Examinar aparece al mirar un objeto cercano.
- Gráficos Automática, Alta y Ahorro desde la portada o la pausa; sonido configurable en la pausa.

El recorrido, las notas y los acertijos se guardan en el almacenamiento del navegador, separados por cuenta o identificador de invitado. Continuar recupera esa expedición en el mismo dispositivo. Nueva expedición sustituye ese avance. El perfil, las monedas y el logro se guardan mediante el sistema de cuentas existente al terminar; el récord conserva el menor tiempo. La pausa y las pestañas ocultas detienen el cronómetro; leer y resolver acertijos forma parte del tiempo de expedición.

## Escenario

Arquitectura de piedra con bloques y losas instanciados, columnas, guardianes tallados, raíces, hojas con transparencia, estanque, puerta animada, reliquias, polvo, haces de luz, antorchas y sombras. Las texturas y el sonido ambiental se generan localmente. El juego no necesita modelos, imágenes, audio ni bibliotecas nuevos de servicios externos.

Los muros y pedestales tienen colisión; las inscripciones requieren cercanía y visión sin atravesar paredes. El dispositivo debe poder iniciar WebGL. Si falla, se muestra una explicación y un enlace de regreso al arcade. La pérdida de contexto gráfico pausa y conserva el avance.

## Verificación

`python -m unittest discover -s tests -v` incluye página y recursos, mejores tiempos, premios y rechazo de resultados repetidos. `node tests/templo-browser.cjs`, con Playwright y un servidor local, recorre los tres acertijos, colisiones, controles de teclado y tacto, diario, continuación después de recargar, pausa, calidad y final con un solo premio en PC y móvil emulado. No se ha medido rendimiento en teléfonos físicos.
