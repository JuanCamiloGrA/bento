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

## Step 5: Configure the `.env` File

Copy the `.env.example` file to `.env` (if you haven't already):
```bash
cp .env.example .env
```

Open `.env` and make the following changes:

1. Change the storage backend to `telegram`:
   ```env
   STORAGE_BACKEND=telegram
   ```

2. Enter the credentials and IDs for the corresponding channels:
   ```env
   TELEGRAM_API_ID=your_api_id_from_my_telegram_org
   TELEGRAM_API_HASH=your_api_hash_from_my_telegram_org
   TELEGRAM_BOT_TOKEN=your_token_from_bot_father
   TELEGRAM_RAW_CHAT_ID=-100XXXXXXXXXX   # ID of the Bento - Raw Files channel
   TELEGRAM_THUMBS_CHAT_ID=-100XXXXXXXXXX # ID of the Bento - Previews channel
   TELEGRAM_JOURNAL_CHAT_ID=-100XXXXXXXXXX # ID of the Bento - Journal channel
   ```

---

## Step 6: Start Bento in Telegram Mode

Since Bento supports large file uploads and downloads up to 2 GB, it uses a local instance of the **Telegram Bot API server** via Docker Compose.

To start Bento with Telegram support, you must use the `telegram` Docker profile. Run the following command in the root of the project:

```bash
docker compose --profile telegram up --build
```

This will spin up the `telegram-bot-api` container in addition to the `web`, `api`, and `worker` services.

---

## Step 7: Validate the Configuration (Doctor)

Once the variables are configured in your `.env` file, you can verify that everything is correct using the project diagnostic script:

```bash
make doctor
```

If everything is configured correctly, you will see a successful output confirming that the Telegram storage mode has the required settings:
```text
[PASS] data directories: ...
[PASS] database migration: ...
[PASS] telegram config: telegram mode has required settings
Doctor passed: STORAGE_BACKEND=telegram.
```

Done! Bento will now use your private Telegram channels to store all files securely and confidentially.
