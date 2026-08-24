# Instalar Bento Desktop y completar el primer inicio

Bento Desktop incluye la interfaz, la API y el worker. No requiere Docker, Python, Node ni un archivo `.env`. El modo local funciona sin una cuenta de Telegram y es la opción recomendada para empezar.

## Antes de instalar

Descarga únicamente un release de producción y el archivo `SHA256SUMS-<plataforma>`. Cada línea usa el nombre final plano del archivo descargado, por lo que puede verificarse desde una sola carpeta sin reconstruir rutas internas de CI. Los artefactos de validación que incluyen `unsigned` en el nombre no están destinados a usuarios finales.

Comprueba el hash desde la carpeta de descargas:

```sh
# macOS o Linux
shasum -a 256 -c SHA256SUMS-<plataforma>
```

En Windows usa PowerShell y compara el resultado con la línea del instalador:

```powershell
Get-FileHash .\BentoSetup.exe -Algorithm SHA256
```

## Windows x64

Ejecuta el `Setup.exe` de Squirrel. Windows debe mostrar un editor válido en la firma digital. Bento se instala por usuario y puede abrirse desde Inicio. Desinstalar la aplicación elimina sus binarios, pero no borra automáticamente el directorio de datos.

## macOS 13+ Intel y Apple silicon

Elige el `.dmg` que coincida con el procesador, arrastra Bento a Aplicaciones y ábrelo. El release de producción debe superar Gatekeeper sin instrucciones para eludirlo: se firma con Developer ID y se notariza. No instales un DMG de otra arquitectura bajo la expectativa de soporte nativo.

## Ubuntu 22.04 x64

Instala el `.deb` con el gestor gráfico o con:

```sh
sudo apt install ./bento_*.deb
```

El `.zip` es una distribución portátil sin integración de instalación. En otros Linux puede funcionar, pero solo Ubuntu 22.04 x64 se declara soportado cuando el smoke nativo está verde.

La protección de secretos requiere un keyring de escritorio disponible y desbloqueado, por ejemplo Secret Service/libsecret en GNOME o KWallet. Electron puede caer en el backend `basic_text` cuando no existe un keyring; Bento lo rechaza de forma cerrada. En ese estado puedes usar las funciones locales sin secretos, pero no guardar credenciales de Telegram. Inicia o desbloquea el keyring y vuelve a abrir Bento; no fuerces almacenamiento en texto plano.

## Primer inicio

1. Elige una carpeta de datos segura, local, con espacio suficiente y que no sea la raíz del disco.
2. Mantén `Almacenamiento local` si no has preparado Telegram Bot API y canales privados.
3. Omite OCR y embeddings para el perfil más ligero; pueden habilitarse después en **Ajustes → AI e indexación**.
4. Revisa el resumen y termina. Bento migra la base local, inicia API y worker en puertos efímeros de loopback y abre la interfaz solo cuando están listos.

Una segunda apertura enfoca la ventana existente. Al cerrar, Bento detiene primero sus sidecars. Las elecciones se conservan al actualizar o reinstalar porque viven en el directorio de datos/usuario, no dentro del paquete ejecutable.

## Migrar un `.env` existente

En **Ajustes → Avanzado → Importar `.env`**, selecciona el archivo, revisa valores reconocidos, desconocidos o bloqueados y confirma una sola vez. Los secretos aparecen únicamente como presentes/ausentes; nunca se muestran en la vista previa. Tras importar correctamente, Bento deja de releer el archivo. Conserva el original fuera de carpetas sincronizadas hasta verificar la migración y luego elimínalo de forma segura si ya no lo necesitas.

Los despliegues Docker/headless siguen usando variables de entorno con mayor precedencia. En esa modalidad la UI muestra esos valores bloqueados y los secretos continúan siendo environment-only.
