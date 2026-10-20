# Nocturna y Última guardia

## Mansión · `/juego/mansion`

Aventura original de suspenso en primera persona. Hay que encontrar las tres llaves
de la biblioteca, comedor y cuarto olvidado y regresar a la puerta principal.
La presencia patrulla, escucha cuando corres y persigue cuando te ve. Recorre una
red de pasos libres alrededor de paredes y muebles. Los armarios permiten esconderse.
Hay tres oportunidades; cada captura conserva las llaves pero añade 20 segundos.

Linterna con batería que se recupera apagada, materiales y texturas procedurales,
retratos, muebles, candelabros, polvo, luz lunar y sonido sintetizado. Sin recursos
externos ni música comercial. No pretende reproducir un juego ajeno.

WASD/arrastrar/E/F/Shift/Esc en PC; palanca, arrastrar y botones en móvil. Pausa al
ocultar la pestaña o perder el foco. Respeta movimiento reducido. Selector de calidad
compartido con Umbra. La victoria guarda logro y récord de tiempo (menor es mejor).
La partida en curso no se guarda: el perfil y el logro sí siguen a una cuenta iniciada.

## Zombis · `/juego/zombis`

- Cada enemigo emitido por el servidor tiene un identificador: normal 3 monedas,
  corredor 5, gigante 12. Una baja repetida no vuelve a pagar.
- Armería entre oleadas: daño, capacidad, recarga y cadencia, con cinco niveles cada
  una y precios 30/60/110/180/280. Las compras descuentan del mismo saldo del perfil.
  La cuenta administradora recibe las cuatro mejoras máximas y saldo infinito.
- La compra incluye el nivel esperado para que un reintento no cobre dos niveles.
  Las mejoras se recuperan al iniciar sesión en otro dispositivo.
- Mantener pulsado dispara con cadencia; R/botón/deslizar recarga. Pausa congela
  enemigos, recarga y aparición de oleadas. Se puede comprar antes de la primera
  oleada y entre ellas. Conserva la carrera online por puntos.
- Nuevas fachadas de ladrillo, cristales, tablas, charcos, escombros, enemigos
  articulados, arma visible, fogonazo y retroceso. Encuadre adaptado a vertical.
- Reintentos de recompensas conservan el identificador del enemigo. Una pérdida de
  conexión impide avanzar a la siguiente oleada hasta sincronizar las bajas; al
  morir se ofrece reintentar antes de cerrar la partida si quedan pagos pendientes.

Los disparos y daños siguen siendo simulados en el cliente, como los demás juegos
3D. El servidor controla identificadores, orden de oleadas, duplicados, compras y
saldo; no es una simulación autoritativa de física ni un sistema antitrampas completo.
Sin cuenta, el progreso pertenece al identificador local del navegador.

## Validación y despliegue

`python -m unittest discover -s tests -p 'test_*.py'`: 53 pruebas, incluidas economía,
reintentos, entradas inválidas, cuentas en dos dispositivos, privilegios de admin,
ruta nueva y logro de escape.

`node tests/mansion-zombis-browser.cjs` con Playwright y Edge: PC y móvil; movimiento
real de teclado/palanca, pausa, colisiones, escondite, tres interacciones y escape,
disparo apuntado con raycast, pausa de recarga, oleadas, compras y persistencia tras
recargar. Simula fallo de conexión al comenzar una oleada y pérdida de la respuesta
después de que el servidor pagó una baja. Los acercamientos a las tres llaves y el
resto de bajas se aceleran por estado para probar los flujos completos.

Los archivos nuevos están en `archivos_nuevos.txt`; el actualizador habitual instala
el módulo de progreso y recursos. El blueprint cuelga de `perfil_bp`, sin editar el
`app.py` de producción. No modifica bases de datos existentes manualmente.
