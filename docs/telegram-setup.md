# Guía de Configuración de Telegram en Bento

Bento es una nube privada local-first que permite utilizar Telegram como un motor de almacenamiento de objetos (blob store) privado e ilimitado. Toda la metadata, índices de búsqueda, base de datos local SQLite y caché permanecen en tu máquina local, mientras que los archivos encriptados o crudos se guardan en canales privados de Telegram de manera segura.

Esta guía te guiará paso a paso para configurar tu entorno y habilitar el backend de almacenamiento en Telegram.

---

## Requisitos Previos

Para configurar Telegram como backend de almacenamiento (`STORAGE_BACKEND=telegram`), necesitarás:
1. Una cuenta de Telegram.
2. Obtener las credenciales de la API de Telegram (`API_ID` y `API_HASH`).
3. Crear un Bot de Telegram y obtener su Token (`BOT_TOKEN`).
4. Crear tres canales privados de Telegram y obtener sus IDs (`CHAT_ID`).

---

## Paso 1: Obtener API ID y API Hash de Telegram

Para que el servidor local de la API de bots de Telegram funcione con tu cuenta de Telegram y permita subir archivos grandes (de hasta 2 GB), necesitas credenciales de aplicación:

1. Ve a [https://my.telegram.org](https://my.telegram.org) e inicia sesión con tu número de teléfono.
2. Accede a la sección **API development tools** (Herramientas de desarrollo de API).
3. Si no tienes una aplicación creada, rellena el formulario para crear una (puedes ponerle cualquier nombre, por ejemplo, "Bento Storage").
4. Copia los valores de **App api_id** y **App api_hash**. Los necesitarás para tu archivo `.env`.

---

## Paso 2: Crear un Bot de Telegram

El bot se encargará de realizar las operaciones de lectura y escritura (subida y descarga de archivos).

1. Abre Telegram y busca al usuario oficial [@BotFather](https://t.me/BotFather).
2. Envía el comando `/newbot` para iniciar el proceso de creación.
3. Asigna un nombre amigable para el bot (ej. `Bento Storage Bot`).
4. Asigna un nombre de usuario único que termine en `bot` (ej. `mi_bento_storage_bot`).
5. [@BotFather](https://t.me/BotFather) te responderá con un mensaje que contiene el **Token de acceso HTTP API** (ej. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`). Guarda este token de forma segura.

---

## Paso 3: Crear los Canales Privados

Bento organiza los archivos en tres categorías para mayor eficiencia. Debes crear **tres canales de Telegram diferentes** (configurados como **Privados**):

1. **Canal para Archivos Crudos (Raw)**:
   - Nombre sugerido: `Bento - Raw Files`
   - Uso: Almacena los archivos originales subidos por el usuario de forma encriptada/segura.
2. **Canal para Miniaturas (Thumbnails & Previews)**:
   - Nombre sugerido: `Bento - Previews`
   - Uso: Almacena miniaturas generadas y previsualizaciones optimizadas para acelerar la carga de la interfaz.
3. **Canal para el Diario (Journal)**:
   - Nombre sugerido: `Bento - Journal`
   - Uso: Almacena logs de eventos del manifiesto físico para sincronización y auditoría de eventos.

### Añadir el Bot como Administrador
En cada uno de los tres canales recién creados:
1. Ve a los ajustes del canal y entra en la sección **Administradores**.
2. Añade a tu bot (buscándolo por el nombre de usuario que elegiste en el Paso 2).
3. Otórgale permisos para **Publicar mensajes** (Post Messages).

---

## Paso 4: Obtener los Chat IDs de los Canales

Los IDs de los canales privados de Telegram son números enteros negativos que suelen comenzar con `-100` (por ejemplo, `-1001234567890`). Para conseguirlos:

### Método A: Usando un Bot auxiliar
1. Reenvía cualquier mensaje publicado en tu canal privado al bot de Telegram [@ShowJsonBot](https://t.me/ShowJsonBot) o [@userinfobot](https://t.me/userinfobot).
2. El bot te responderá con un JSON o texto que contiene la propiedad `forward_from_chat` o `chat.id`. Ese número (incluyendo el signo menos y `-100`) es tu ID.

### Método B: Vía Web Browser
1. Publica un mensaje de prueba en el canal donde agregaste al bot.
2. Entra en tu navegador a la siguiente URL reemplazando `<TU_BOT_TOKEN>` con el token de tu bot:
   `https://api.telegram.org/bot<TU_BOT_TOKEN>/getUpdates`
3. Busca en la respuesta JSON el bloque que corresponde al canal y extrae el ID (ej. `"chat":{"id":-100xxxxxxxxxx,...}`).

---

## Paso 5: Configurar el Archivo `.env`

Copia el archivo `.env.example` a `.env` (si no lo has hecho ya):
```bash
cp .env.example .env
```

Abre `.env` y realiza las siguientes modificaciones:

1. Cambia el backend de almacenamiento a `telegram`:
   ```env
   STORAGE_BACKEND=telegram
   ```

2. Introduce las credenciales y IDs de los canales correspondientes:
   ```env
   TELEGRAM_API_ID=tu_api_id_de_my_telegram_org
   TELEGRAM_API_HASH=tu_api_hash_de_my_telegram_org
   TELEGRAM_BOT_TOKEN=tu_token_de_bot_father
   TELEGRAM_RAW_CHAT_ID=-100XXXXXXXXXX   # ID del canal Bento - Raw Files
   TELEGRAM_THUMBS_CHAT_ID=-100XXXXXXXXXX # ID del canal Bento - Previews
   TELEGRAM_JOURNAL_CHAT_ID=-100XXXXXXXXXX # ID del canal Bento - Journal
   ```

---

## Paso 6: Levantar Bento en Modo Telegram

Dado que Bento soporta cargas y descargas de archivos pesados de hasta 2 GB, utiliza una instancia local de **Telegram Bot API server** mediante Docker Compose.

Para arrancar Bento con soporte para Telegram, debes usar el perfil de Docker `telegram`. Ejecuta el siguiente comando en la raíz del proyecto:

```bash
docker compose --profile telegram up --build
```

Esto levantará el contenedor de `telegram-bot-api` además de los servicios `web`, `api`, y `worker`.

---

## Paso 7: Validar la Configuración (Doctor)

Una vez configuradas las variables en tu archivo `.env`, puedes verificar que todo está correcto utilizando el script de diagnóstico del proyecto:

```bash
make doctor
```

Si todo está configurado correctamente, verás una salida exitosa confirmando que el modo de almacenamiento de Telegram cuenta con las configuraciones requeridas:
```text
[PASS] data directories: ...
[PASS] database migration: ...
[PASS] telegram config: telegram mode has required settings
Doctor passed: STORAGE_BACKEND=telegram.
```

¡Listo! Bento ahora utilizará tus canales privados de Telegram para almacenar todos los archivos de manera segura y confidencial.
