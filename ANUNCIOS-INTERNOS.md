# Anuncios internos y reanimación

No se conecta ninguna red publicitaria, no se recopilan datos para anuncios y no
hay pagos. Las tarjetas solo recomiendan juegos que ya forman parte del arcade.

## Al terminar

La pantalla compartida de resultados rota entre Nocturna, Pinball Nova, UNO 3D,
Umbra, Lotería Mexicana y Última guardia, excluyendo el juego actual. La tarjeta
tiene un enlace directo al juego recomendado. Los juegos de fiesta y las pantallas
propias de Pinball, Umbra y Nocturna usan el mismo concepto.
Los juegos clásicos lo muestran después de guardar su puntuación mediante el
componente compartido `scripts.js`.

## Reanimación

Disponible una vez por partida individual en:

- Zombis: vuelve con 55% de vida, cargador lleno y aleja a los enemigos activos.
- Corredor infinito: se levanta unos metros después del obstáculo conservando puntos.
- Paracaidista: si el aterrizaje fue un accidente, vuelve al aire para intentarlo otra vez.
- Surf: recibe 12 segundos y una caída adicional.
- Cruza la calle: regresa a una fila segura conservando los pasos alcanzados.

La tarjeta dura cuatro segundos antes de habilitar el botón. El jugador puede
rechazarla inmediatamente. No aparece en modo local, contra bot ni online para no
alterar partidas competitivas. La reanimación no entrega monedas ni vuelve a pagar
eventos del perfil.

## Verificación

`tests/anuncios-browser.cjs` comprueba en Edge los cinco flujos de reanimación,
cuenta regresiva, límite de una vez, exclusión del juego actual, promoción final y
disposición móvil. Las pruebas Python existentes comprueban las rutas y APIs.
