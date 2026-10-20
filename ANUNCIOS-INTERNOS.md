# Videos internos y reanimación

No se conecta ninguna red publicitaria, no se recopilan datos para anuncios y no
hay pagos. Los clips usan gameplay real y solo recomiendan juegos que ya forman
parte del arcade. Se reproducen silenciados para que el navegador permita el
inicio automático tanto en computadora como en celular.

## Al terminar

La pantalla compartida de resultados reproduce obligatoriamente el video de
novedades y rota el enlace entre Nocturna, Pinball Nova, UNO 3D, Umbra, Lotería
Mexicana y Última guardia, excluyendo el juego actual. Los juegos de fiesta y las
pantallas propias de Batalla Naval, Pinball, Umbra y Nocturna usan el mismo video.
Los juegos clásicos también lo muestran después de guardar su puntuación mediante
el componente compartido `scripts.js`.

## Reanimación

Disponible una vez por partida individual en:

- Zombis: vuelve con 55% de vida, cargador lleno y aleja a los enemigos activos.
- Corredor infinito: se levanta unos metros después del obstáculo conservando puntos.
- Paracaidista: si el aterrizaje fue un accidente, vuelve al aire para intentarlo otra vez.
- Surf: recibe 12 segundos y una caída adicional.
- Cruza la calle: regresa a una fila segura conservando los pasos alcanzados.

El botón se habilita después de cuatro segundos reproducidos del video; detener la
reproducción también detiene la cuenta. El jugador puede rechazarlo inmediatamente.
No aparece en modo local, contra bot ni online para no alterar partidas
competitivas. La reanimación no entrega monedas ni vuelve a pagar eventos del
perfil.

## Verificación

`tests/anuncios-browser.cjs` comprueba en Edge reproducción real, los cinco flujos
de reanimación, tiempo visto, límite de una vez, exclusión del juego actual,
promoción final, Batalla Naval y disposición móvil. Las pruebas Python existentes
comprueban las rutas y APIs.
