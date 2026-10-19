# Cuentas del arcade

Los jugadores crean un usuario único de 3–14 letras, números o `_` y contraseña de al menos 10 caracteres en `/cuenta`. No se pide correo. Las mayúsculas no permiten duplicar usuarios. Guardan su código de recuperación privado para restablecer una contraseña olvidada; recuperarla invalida todas las sesiones y genera otro código.

El perfil de invitado de ese navegador se copia una sola vez al crear una cuenta. Iniciar sesión en otra cuenta no mezcla perfiles. Cada dispositivo conserva su identificador de salas; el servidor vincula su sesión al perfil de la cuenta. Se sincronizan monedas, compras, avatar, marco, logros y estadísticas. Las partidas abiertas no se reanudan entre dispositivos.

## Activar al administrador

Después de ejecutar `actualizar.sh`, desde la carpeta del servidor donde está `app.py`:

```bash
python3 -m cuentas invitar-admin TU_CORREO
```

El comando muestra un enlace relativo privado `/cuenta?invitacion=...`, válido durante 48 horas y un solo uso. Ábrelo en el dominio del arcade y crea `chris` con ese correo y una contraseña. Nunca publiques el enlace ni el código de recuperación. El correo solo se usa en esta cuenta; conocerlo no concede permisos. Puedes entrar después con el correo o el usuario. Regenerar una invitación invalida las anteriores pendientes.

El administrador tiene monedas infinitas y todos los avatares y marcos disponibles, sin alterar los logros o las victorias reales. Se excluye de la clasificación de monedas.

Al activar la invitación se asocian los alias históricos `chris`, `chrs` y `chros`, incluidas variantes de mayúsculas. Se suman victorias y se conserva la mejor puntuación o el menor número de intentos. Las lecturas no reescriben los récords; la siguiente escritura del juego guarda su tabla normalizada. Los invitados no pueden guardar bajo una identidad registrada.

## Datos y despliegue

Conserva juntos `cuentas.sqlite3` (incluidos sus archivos WAL mientras esté en uso), `perfiles.json` y los archivos de récords. `actualizar.sh` hace copia de los perfiles y récords y un respaldo consistente de SQLite antes de actualizar. No se distribuyen datos de cuentas ni contraseñas en GitHub. Las contraseñas se guardan como hashes scrypt y las sesiones y códigos como hashes SHA-256.

Por defecto SQLite se guarda junto a `cuentas.py`, independientemente del directorio de trabajo. `ARCADE_CUENTAS_DB` permite configurar otra ruta para SQLite; el proceso web y la consola de administración deben usar la misma ruta. El despliegue actual conserva la arquitectura de un proceso del arcade y sus salas en memoria. Para varios procesos haría falta migrar también perfiles, bloqueos y salas a almacenamiento compartido.

Pruebas: `python -m unittest discover -s tests -v`. `tests/cuentas-browser.cjs` verifica el flujo real en dos navegadores y tamaño móvil con Playwright; `ADMIN_INVITACION` permite añadir la activación en un servidor local de prueba vacío. No ejecutes ese alta de prueba contra producción.

El administrador puede subir un icono personalizado desde su perfil (PNG, JPG o WebP, hasta 5 MB). El navegador recorta al centro a 256 × 256; el servidor valida el PNG y guarda la imagen en perfiles.json, incluido en los respaldos. Elegir un emoji vuelve al avatar del catálogo. Los permisos de subida se comprueban en el servidor.
