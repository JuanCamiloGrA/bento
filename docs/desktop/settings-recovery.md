# Ajustes, datos, copias de seguridad y recuperación

## Ajustes

La pantalla de Ajustes separa General, Almacenamiento, Telegram, AI e indexación, Rendimiento y Avanzado. Cada campo indica su origen y si requiere reiniciar worker, servicios o aplicación. **Guardar cambios** valida el borrador completo; **Guardar y reiniciar** aplica el cambio mínimo y confirma la nueva revisión. Si la salud falla, Bento restaura automáticamente la última revisión válida.

Los secretos guardados no vuelven al renderer ni a la API en texto plano. Se cifran con `safeStorage` y el almacén protegido del sistema; SQLite contiene como máximo referencias opacas. Exportar configuración y copiar diagnósticos excluye secretos.

## Ubicaciones y logs

Las ubicaciones exactas dependen del sistema y del usuario. Usa **Ajustes → Avanzado → Abrir logs** para evitar adivinar rutas. El log principal es `desktop.jsonl` dentro del directorio de logs de Electron; rota al superar aproximadamente 5 MiB y conserva una generación anterior. Los tokens de lanzamiento, contraseñas y secretos conocidos se redactan.

Los binarios y recursos instalados son de solo lectura. La base SQLite, blobs, caché, journal, bootstrap y almacén cifrado viven bajo los directorios de usuario/datos. Bento nunca debe escribir configuración dentro de `resources` o `app.asar`.

## Copia de seguridad

1. Cierra Bento y espera a que desaparezca su proceso; así API y worker liberan SQLite.
2. Copia el directorio de datos completo, incluidos DB, blobs y `journal`, a un destino protegido.
3. Copia también el directorio `bento-desktop` del user-data de Electron si necesitas conservar bootstrap y secretos cifrados.
4. Conserva el backup en el mismo sistema/cuenta cuando dependa del keyring: un `secrets.json` cifrado aislado no es una copia portable de las credenciales.
5. Verifica tamaño, fecha y posibilidad de leer la copia antes de actualizar o mover datos.

Para restaurar, instala la misma versión o una posterior compatible, cierra Bento, restaura el directorio completo y selecciónalo como ubicación de datos. Nunca combines parcialmente dos bases activas. El journal JSONL facilita una recuperación parcial, pero no sustituye una copia de la base y blobs.

## Actualizar, reinstalar y desinstalar

Una actualización sustituye el paquete ejecutable y conserva el user-data/directorio de datos. El smoke de release abre el mismo paquete dos veces con un perfil aislado y comprueba retención básica. La desinstalación conserva datos deliberadamente para evitar pérdida accidental; para borrarlos, primero confirma la ubicación en Ajustes, cierra Bento, crea una copia si procede y elimina solo esa ruta explícita.

Los modelos descargados y la caché pueden ocupar espacio. Limpiarlos no debe interpretarse como borrar la biblioteca; no borres la base ni blobs al liberar caché.

## Recuperación

Si el inicio falla, la ventana de recuperación muestra un diagnóstico seguro. Prueba en este orden:

1. Reabre Bento una vez y comprueba espacio libre y permisos de la carpeta de datos.
2. Revisa el final de `desktop.jsonl`; comparte solo el código/error ya redactado, nunca archivos de secretos o `.env`.
3. Revierte el último cambio desde Ajustes si la pantalla sigue disponible. Tres caídas rápidas detienen el bucle y dejan Bento en modo recuperación.
4. Restaura el backup completo si SQLite o la carpeta fueron alterados externamente.
5. Reinstala la misma versión para reparar binarios. La reinstalación no debe requerir borrar datos.

No edites `bootstrap.json`, `secrets.json` ni SQLite mientras Bento está abierto. Si el keyring de Linux informa `basic_text`, desbloquea/configura un keyring real; Bento no guarda secretos hasta que el backend seguro esté disponible.

## Limitación de Telegram en escritorio

El paquete actual contiene API y worker, pero no el ejecutable `telegram-bot-api`. Para almacenamiento Telegram debes operar por separado Telegram Bot API en modo local, enlazado únicamente a loopback, y configurar su URL y canales. El host Electron no lo inicia ni actualiza. Si no tienes ese servicio, mantén almacenamiento local; el resto de Bento funciona normalmente.
