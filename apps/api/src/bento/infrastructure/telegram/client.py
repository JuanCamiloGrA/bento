from __future__ import annotations

import asyncio
import http.client
import json
import shutil
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

from bento.infrastructure.telegram.config import TelegramStorageConfig


@dataclass(frozen=True, slots=True)
class TelegramDocumentRef:
    chat_id: str
    message_id: str
    file_id: str
    file_unique_id: str | None
    file_size: int | None


@dataclass(frozen=True, slots=True)
class TelegramFileRef:
    file_id: str
    file_unique_id: str | None
    file_size: int | None
    file_path: str


@dataclass(frozen=True, slots=True)
class TelegramSentMessage:
    chat_id: str
    message_id: str


class TelegramApiClient(Protocol):
    async def probe(self, chat_ids: tuple[str, ...]) -> bool: ...

    async def send_document(
        self,
        chat_id: str,
        source_path: Path,
        *,
        filename: str,
        caption: str | None = None,
    ) -> TelegramDocumentRef: ...

    async def get_file(self, file_id: str) -> TelegramFileRef: ...

    async def download_file(self, file_path: str, destination_path: Path) -> None: ...

    async def delete_message(self, chat_id: str, message_id: str) -> bool: ...

    async def send_message(self, chat_id: str, text: str) -> TelegramSentMessage: ...


class TelegramApiError(Exception):
    def __init__(
        self,
        *,
        status_code: int | None,
        error_code: int | None,
        description: str,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(description)
        self.status_code = status_code
        self.error_code = error_code
        self.description = description
        self.retry_after = retry_after

    @property
    def retryable(self) -> bool:
        if self.status_code is None and self.error_code is None:
            return True
        code = self.status_code or self.error_code
        return code in {429, 500, 502, 503, 504}


class StdlibTelegramBotApiClient:
    def __init__(self, config: TelegramStorageConfig) -> None:
        self._base_url = config.normalized_bot_api_url
        self._bot_token = config.bot_token
        self._timeout = config.request_timeout_seconds

    async def probe(self, chat_ids: tuple[str, ...]) -> bool:
        await asyncio.to_thread(self._post_form, "getMe", {})
        for chat_id in dict.fromkeys(chat_ids):
            await asyncio.to_thread(self._post_form, "getChat", {"chat_id": chat_id})
        return True

    async def send_document(
        self,
        chat_id: str,
        source_path: Path,
        *,
        filename: str,
        caption: str | None = None,
    ) -> TelegramDocumentRef:
        fields = {"chat_id": chat_id}
        if caption:
            fields["caption"] = caption
        result = await asyncio.to_thread(
            self._post_multipart,
            "sendDocument",
            fields,
            "document",
            source_path,
            filename,
        )
        document = result.get("document") or {}
        chat = result.get("chat") or {}
        return TelegramDocumentRef(
            chat_id=str(chat.get("id", chat_id)),
            message_id=str(result["message_id"]),
            file_id=str(document["file_id"]),
            file_unique_id=_optional_str(document.get("file_unique_id")),
            file_size=_optional_int(document.get("file_size")),
        )

    async def get_file(self, file_id: str) -> TelegramFileRef:
        result = await asyncio.to_thread(self._post_form, "getFile", {"file_id": file_id})
        return TelegramFileRef(
            file_id=str(result["file_id"]),
            file_unique_id=_optional_str(result.get("file_unique_id")),
            file_size=_optional_int(result.get("file_size")),
            file_path=str(result["file_path"]),
        )

    async def download_file(self, file_path: str, destination_path: Path) -> None:
        await asyncio.to_thread(self._download_file, file_path, destination_path)

    async def delete_message(self, chat_id: str, message_id: str) -> bool:
        result = await asyncio.to_thread(
            self._post_form,
            "deleteMessage",
            {"chat_id": chat_id, "message_id": message_id},
        )
        return bool(result)

    async def send_message(self, chat_id: str, text: str) -> TelegramSentMessage:
        result = await asyncio.to_thread(self._post_form, "sendMessage", {"chat_id": chat_id, "text": text})
        chat = result.get("chat") or {}
        return TelegramSentMessage(chat_id=str(chat.get("id", chat_id)), message_id=str(result["message_id"]))

    def _post_form(self, method: str, fields: dict[str, str]) -> Any:
        body = urlencode(fields).encode("utf-8")
        request = Request(
            self._api_url(method),
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self._timeout) as response:
                return _parse_api_payload(response.status, response.read())
        except HTTPError as exc:
            raise _api_error_from_http_error(exc) from exc
        except URLError as exc:
            raise TelegramApiError(status_code=None, error_code=None, description="Telegram Bot API unavailable") from exc
        except OSError as exc:
            raise TelegramApiError(status_code=None, error_code=None, description="Telegram Bot API unavailable") from exc

    def _post_multipart(
        self,
        method: str,
        fields: dict[str, str],
        file_field: str,
        source_path: Path,
        filename: str,
    ) -> Any:
        url = urlparse(self._api_url(method))
        boundary = f"bento-{uuid.uuid4().hex}"
        headers = {
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Transfer-Encoding": "chunked",
        }
        connection_cls = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
        connection = connection_cls(url.hostname, url.port, timeout=self._timeout)
        try:
            target = url.path
            if url.query:
                target = f"{target}?{url.query}"
            connection.request(
                "POST",
                target,
                body=_multipart_chunks(boundary, fields, file_field, source_path, filename),
                headers=headers,
                encode_chunked=True,
            )
            response = connection.getresponse()
            return _parse_api_payload(response.status, response.read())
        except OSError as exc:
            raise TelegramApiError(status_code=None, error_code=None, description="Telegram Bot API unavailable") from exc
        finally:
            connection.close()

    def _download_file(self, file_path: str, destination_path: Path) -> None:
        source_path = Path(file_path)
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = destination_path.with_name(f".{destination_path.name}.{uuid.uuid4().hex}.tmp")
        try:
            if source_path.is_absolute() and source_path.is_file():
                shutil.copyfile(source_path, temporary_path)
            else:
                request = Request(self._file_url(file_path), method="GET")
                with urlopen(request, timeout=self._timeout) as response, temporary_path.open("wb") as handle:
                    shutil.copyfileobj(response, handle)
            temporary_path.replace(destination_path)
        except HTTPError as exc:
            temporary_path.unlink(missing_ok=True)
            raise _api_error_from_http_error(exc) from exc
        except (OSError, URLError) as exc:
            temporary_path.unlink(missing_ok=True)
            raise TelegramApiError(status_code=None, error_code=None, description="Telegram file download failed") from exc

    def _api_url(self, method: str) -> str:
        return f"{self._base_url}/bot{self._bot_token}/{method}"

    def _file_url(self, file_path: str) -> str:
        return f"{self._base_url}/file/bot{self._bot_token}/{quote(file_path.lstrip('/'), safe='/:')}"


def _multipart_chunks(
    boundary: str,
    fields: dict[str, str],
    file_field: str,
    source_path: Path,
    filename: str,
) -> Iterator[bytes]:
    separator = f"--{boundary}\r\n".encode("ascii")
    for name, value in fields.items():
        yield separator
        yield f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8")
        yield str(value).encode("utf-8")
        yield b"\r\n"
    yield separator
    yield (
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    with source_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            yield chunk
    yield b"\r\n"
    yield f"--{boundary}--\r\n".encode("ascii")


def _parse_api_payload(status_code: int, payload: bytes) -> Any:
    try:
        body = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise TelegramApiError(
            status_code=status_code,
            error_code=None,
            description="Telegram Bot API returned invalid JSON",
        ) from exc
    if status_code >= 400 or not body.get("ok", False):
        parameters = body.get("parameters") or {}
        raise TelegramApiError(
            status_code=status_code,
            error_code=_optional_int(body.get("error_code")),
            description=str(body.get("description") or "Telegram Bot API request failed"),
            retry_after=_optional_float(parameters.get("retry_after")),
        )
    return body.get("result")


def _api_error_from_http_error(error: HTTPError) -> TelegramApiError:
    try:
        _parse_api_payload(error.code, error.read())
    except TelegramApiError as exc:
        return exc
    return TelegramApiError(
        status_code=error.code,
        error_code=error.code,
        description="Telegram Bot API request failed",
    )


def _optional_str(value: object) -> str | None:
    return None if value is None else str(value)


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    return int(value)


def _optional_float(value: object) -> float | None:
    if value is None:
        return None
    return float(value)
