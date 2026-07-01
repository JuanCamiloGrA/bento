# Telegram Configuration Guide in Bento

Bento is a local-first private cloud that allows you to use Telegram as a private and unlimited object storage (blob store) engine. All metadata, search indexes, local SQLite database, and cache remain on your local machine, while encrypted or raw files are securely saved in private Telegram channels.

This guide will walk you through setting up your environment step-by-step and enabling the Telegram storage backend.

---

## Prerequisites

To configure Telegram as a storage backend (`STORAGE_BACKEND=telegram`), you will need:
1. A Telegram account.
2. Obtain Telegram API credentials (`API_ID` and `API_HASH`).
3. Create a Telegram Bot and obtain its Token (`BOT_TOKEN`).
4. Create three private Telegram channels and obtain their IDs (`CHAT_ID`).

---

## Step 1: Obtain Telegram API ID and API Hash

To allow the local Telegram Bot API server to work with your Telegram account and upload large files (up to 2 GB), you need application credentials:

1. Go to [https://my.telegram.org](https://my.telegram.org) and log in with your phone number.
2. Access the **API development tools** section.
3. If you don't have an application created, fill out the form to create one (you can name it anything, for example, "Bento Storage").
4. Copy the **App api_id** and **App api_hash** values. You will need them for your `.env` file.

---

## Step 2: Create a Telegram Bot

The bot will handle read and write operations (uploading and downloading files).

1. Open Telegram and search for the official [@BotFather](https://t.me/BotFather) user.
2. Send the `/newbot` command to start the creation process.
3. Assign a friendly name to the bot (e.g., `Bento Storage Bot`).
4. Assign a unique username ending in `bot` (e.g., `my_bento_storage_bot`).
5. [@BotFather](https://t.me/BotFather) will reply with a message containing the **HTTP API Access Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`). Keep this token secure.

---

## Step 3: Create Private Channels

Bento organizes files into three categories for greater efficiency. You must create **three different Telegram channels** (configured as **Private**):

1. **Channel for Raw Files (Raw)**:
   - Suggested name: `Bento - Raw Files`
   - Usage: Stores the original files uploaded by the user in an encrypted/secure format.
2. **Channel for Thumbnails (Thumbnails & Previews)**:
   - Suggested name: `Bento - Previews`
   - Usage: Stores generated thumbnails and optimized previews to speed up interface loading.
3. **Channel for the Journal (Journal)**:
   - Suggested name: `Bento - Journal`
   - Usage: Stores physical manifest event logs for event synchronization and auditing.

### Add the Bot as an Administrator
In each of the three newly created channels:
1. Go to the channel settings and enter the **Administrators** section.
2. Add your bot (by searching for the username you chose in Step 2).
3. Grant it permissions to **Post Messages**.

---

## Step 4: Obtain the Channel Chat IDs

Private Telegram channel IDs are negative integers that usually start with `-100` (for example, `-1001234567890`). To obtain them:

### Method A: Using an Auxiliary Bot
1. Forward any message posted in your private channel to the Telegram bot [@ShowJsonBot](https://t.me/ShowJsonBot) or [@userinfobot](https://t.me/userinfobot).
2. The bot will respond with a JSON or text containing the `forward_from_chat` or `chat.id` property. That number (including the minus sign and `-100`) is your ID.

### Method B: Via Web Browser
1. Post a test message in the channel where you added the bot.
2. Go to the following URL in your browser, replacing `<YOUR_BOT_TOKEN>` with your bot's token:
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for the block corresponding to the channel in the JSON response and extract the ID (e.g., `"chat":{"id":-100xxxxxxxxxx,...}`).

---hat":{"id":-100xxxxxxxxxx,...}`).

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
