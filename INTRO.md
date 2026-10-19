# Presentación del arcade

`/secreto` abre una presentación de 24 segundos en cada carga. Al terminar, al pulsar «Entrar a jugar» o con Escape se vuelve al menú y se libera el vídeo. «Ver intro» permite repetirla.

- PC: vídeo horizontal 1920 × 1080, aproximadamente 4,4 MB.
- Celular: montaje vertical propio 720 × 1280, aproximadamente 2,5 MB.
- Se elige una sola fuente según el tamaño/orientación de pantalla; no se descargan ambas.
- Gameplay real grabado en el arcade publicado: Umbra, UNO 3D, Lotería, Hockey y Duelo de espadas. Música instrumental sintetizada para la presentación.
- Reproducción automática sin sonido; un toque activa la música. Si el navegador bloquea el autoplay, aparece «Reproducir con música».
- Movimiento reducido o ahorro de datos: se muestra la portada y no se solicita el vídeo hasta pulsar play.
- El diálogo mantiene el foco y el menú inactivo durante la presentación; Escape y el botón de entrada siempre están disponibles. Si el vídeo no carga o se queda esperando más de 10 segundos, se abre el menú.
- El selector PC/celular del catálogo conserva su funcionamiento independiente.

Los archivos `static/video/*-v1.*` están incluidos en `archivos_nuevos.txt` para el actualizador de PythonAnywhere. No requieren dependencias nuevas. Una edición futura debe incrementar el sufijo de versión y actualizar plantilla/manifiesto para evitar cachés antiguas.

Validación: `tests/intro-browser.cjs` comprueba PC, móvil, selección de una sola fuente, autoplay, audio, pausa, cierre, fin, repetición, recarga, movimiento reducido, bloqueo de autoplay, error del vídeo y uso sin JavaScript. La emulación de celular no sustituye una medición en un teléfono físico.
