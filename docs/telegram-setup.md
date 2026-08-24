# Configurar Telegram en Bento

Bento mantiene SQLite, índices, trabajos y caché en esta máquina. En modo Telegram,
los blobs originales, miniaturas y eventos de journal se guardan en canales privados.

## Límites y seguridad

- Telegram no ofrece almacenamiento contractual "infinito" ni sustituye un backup.
- El Bot API local admite subidas de hasta 2.000 MB por archivo y descargas sin el
  límite del Bot API hospedado. Los límites pueden cambiar.
- Bento cifra cada blob localmente con AES-256-GCM antes de enviarlo a Telegram.
  El nombre original, MIME y contenido no forman parte del documento remoto.
- La clave vive únicamente en `.env`; perderla hace irrecuperables los blobs cifrados.
  Guárdala también en un gestor de contraseñas seguro.
- SQLite en `data/db` es la fuente de verdad. Conserva una copia de `data/` y no
  borres los mensajes de los canales manualmente.

Referencias oficiales: [Bot API local](https://core.telegram.org/bots/api#using-a-local-bot-api-server)
y [servidor Bot API](https://github.com/tdlib/telegram-bot-api#readme).

## 1. Crear las credenciales

1. En <https://my.telegram.org>, abre **API development tools**, crea una app y
   guarda su `api_id` y `api_hash`.
2. Habla con [@BotFather](https://t.me/BotFather), ejecuta `/newbot` y guarda el token.
3. Crea tres canales **privados**:
   - `Bento - Raw Files`
   - `Bento - Previews`
   - `Bento - Journal`
4. Añade el bot como administrador en los tres canales. Dale permiso para publicar
   y borrar mensajes.

No pegues el token, el hash ni los IDs en un chat, issue, commit o captura.

## 2. Obtener los IDs de los canales

Antes de migrar el bot al servidor local:

1. Publica un mensaje nuevo en cada canal.
2. Consulta `getUpdates` con el Bot API hospedado.
3. En cada `channel_post`, copia `chat.id`; normalmente empieza por `-100`.

Puedes hacer la consulta sin escribir el token literalmente en el historial del shell:

```bash
read -rsp "Bot token: " TELEGRAM_BOT_TOKEN; echo
curl --silent --show-error --config - <<EOF
url = "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"
EOF
unset TELEGRAM_BOT_TOKEN
```

## 3. Completar `.env`

Edita el `.env` local de la raíz (está ignorado por Git):

```dotenv
STORAGE_BACKEND=telegram
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=tu_api_hash
TELEGRAM_BOT_TOKEN=123456789:tu_token
TELEGRAM_RAW_CHAT_ID=-1001111111111
TELEGRAM_THUMBS_CHAT_ID=-1002222222222
TELEGRAM_JOURNAL_CHAT_ID=-1003333333333
TELEGRAM_WEBHOOK_SECRET=secreto_url_safe_de_32_caracteres_o_mas
ENCRYPTION_MODE=aes_gcm
BENTO_ENCRYPTION_KEY=clave_base64_url_safe_de_32_bytes
BENTO_ENCRYPTION_KEY_ID=primary
```

Genera valores nuevos —no reutilices el token del bot— con:

```bash
python -c 'import base64,secrets; print("BENTO_ENCRYPTION_KEY=" + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")); print("TELEGRAM_WEBHOOK_SECRET=" + secrets.token_urlsafe(32))'
```

Copia ambos resultados en `.env`, no en `.env.example`. Bento se negará a iniciar
el backend Telegram sin AES-GCM, clave y secreto de webhook.

Comprueba solo la estructura, sin imprimir secretos:

```bash
make doctor
```

## 4. Migrar el bot al Bot API local

Telegram indica que debes ejecutar `logOut` en el Bot API hospedado antes de usar
un servidor local. Carga `.env` en el proceso y realiza la llamada:

```bash
set -a; . ./.env; set +a
curl --silent --show-error --config - <<EOF
url = "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/logOut"
request = "POST"
EOF
```

No podrás volver a iniciar sesión inmediatamente en el Bot API hospedado; consulta
la documentación oficial antes de revertir esta migración.

## 5. Iniciar Bento con Telegram

Detén el modo local y arranca el perfil Telegram:

```bash
docker compose down
docker compose --profile telegram up --build -d
docker compose ps
```

Valida el bot contra el servidor local:

```bash
curl --silent --show-error --config - <<EOF
url = "http://127.0.0.1:8081/bot${TELEGRAM_BOT_TOKEN}/getMe"
EOF
```

## 6. Activar archivos enviados al bot

Las subidas desde la web ya usan Telegram cuando `STORAGE_BACKEND=telegram`. Para
que los documentos enviados directamente al bot entren en Bento, registra el webhook
interno accesible desde la red de Docker:

```bash
curl --silent --show-error --config - <<EOF
url = "http://127.0.0.1:8081/bot${TELEGRAM_BOT_TOKEN}/setWebhook"
data-urlencode = "url=http://api:8000/api/telegram/webhook"
data-urlencode = "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
EOF
unset TELEGRAM_BOT_TOKEN TELEGRAM_API_ID TELEGRAM_API_HASH TELEGRAM_WEBHOOK_SECRET BENTO_ENCRYPTION_KEY
```

Comprueba el resultado:

```bash
set -a; . ./.env; set +a
curl --silent --show-error --config - <<EOF
url = "http://127.0.0.1:8081/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
EOF
unset TELEGRAM_BOT_TOKEN TELEGRAM_API_ID TELEGRAM_API_HASH TELEGRAM_WEBHOOK_SECRET BENTO_ENCRYPTION_KEY
```

Abre <http://127.0.0.1:5173>, sube un archivo pequeño desde Drive, descárgalo y
confirma que apareció en `Bento - Raw Files`. Después envía otro archivo al bot y
comprueba que aparece en Bento.

## Operación y recuperación

- Arrancar: `docker compose --profile telegram up -d`
- Ver logs: `docker compose logs -f api worker telegram-bot-api`
- Detener: `docker compose down`
- Diagnóstico local: `make doctor`
- Backup mínimo: copia `data/` con los contenedores detenidos.
- Backup de clave: conserva `BENTO_ENCRYPTION_KEY` y `BENTO_ENCRYPTION_KEY_ID` por
  separado de `data/`; sin ellos no existe recuperación posible.
