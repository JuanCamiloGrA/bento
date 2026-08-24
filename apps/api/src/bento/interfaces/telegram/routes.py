from __future__ import annotations

import hmac
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from bento.domain.errors import DomainError
from bento.infrastructure.telegram.client import StdlibTelegramBotApiClient
from bento.infrastructure.telegram.config import require_telegram_storage_config
from bento.interfaces.telegram.ingestion import TelegramWebhookIngestionService

router = APIRouter()


class TelegramWebhookResponse(BaseModel):
    accepted: bool
    ignored: bool
    asset_id: str | None = None
    duplicate: bool = False


@router.post("/telegram/webhook", response_model=TelegramWebhookResponse)
async def telegram_webhook(request: Request) -> TelegramWebhookResponse | JSONResponse:
    try:
        if not _valid_webhook_secret(request):
            return _domain_error_response(request, _WebhookForbiddenError())
        update = await request.json()
        if not isinstance(update, dict):
            raise ValueError("Telegram update must be a JSON object")
        result = await _webhook_service(request).ingest_update(update)
        return TelegramWebhookResponse(
            accepted=result.accepted,
            ignored=result.ignored,
            asset_id=result.asset_id,
            duplicate=result.duplicate,
        )
    except DomainError as exc:
        return _domain_error_response(request, exc)
    except ValueError:
        return _domain_error_response(request, _ValidationError("Invalid Telegram update payload"))


def _webhook_service(request: Request) -> TelegramWebhookIngestionService:
    cached = getattr(request.app.state, "telegram_webhook_ingestion", None)
    if cached is not None:
        return cached

    from bento.interfaces.http.routes import _asset_dependencies, _data_dir, _settings

    settings = _settings(request)
    config = require_telegram_storage_config(settings)
    service = TelegramWebhookIngestionService(
        client=StdlibTelegramBotApiClient(config),
        ingestion=_asset_dependencies(request).ingestion,
        temp_dir=_data_dir(settings) / "cache" / "telegram",
    )
    request.app.state.telegram_webhook_ingestion = service
    return service


class _ValidationError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__("validation_failed", message)


class _WebhookForbiddenError(DomainError):
    def __init__(self) -> None:
        super().__init__("telegram_webhook_forbidden", "Telegram webhook authentication failed")


def _valid_webhook_secret(request: Request) -> bool:
    expected = getattr(request.app.state, "telegram_webhook_secret", None)
    if expected is None:
        from bento.interfaces.http.routes import _settings

        expected = require_telegram_storage_config(_settings(request)).webhook_secret
    provided = request.headers.get("x-telegram-bot-api-secret-token")
    return bool(provided and hmac.compare_digest(provided, expected))


def _domain_error_response(request: Request, error: DomainError) -> JSONResponse:
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    return JSONResponse(
        status_code=_status_code(error),
        content={
            "error": {
                "code": error.code,
                "message": error.message,
                "details": error.details,
                "request_id": request_id,
            }
        },
    )


def _status_code(error: DomainError) -> int:
    if error.code == "telegram_webhook_forbidden":
        return 403
    if error.code == "telegram_not_configured":
        return 503
    if error.code == "storage_unavailable":
        return 503
    return 400
