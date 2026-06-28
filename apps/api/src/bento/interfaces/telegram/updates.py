from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True, slots=True)
class TelegramSharedFile:
    file_id: str
    file_unique_id: str | None
    filename: str
    mime_type: str | None
    size_bytes: int | None
    chat_id: str | None
    message_id: str | None


def extract_shared_file(update: Mapping[str, Any]) -> TelegramSharedFile | None:
    message = _message(update)
    if message is None:
        return None
    chat = message.get("chat") if isinstance(message.get("chat"), Mapping) else {}
    chat_id = _optional_str(chat.get("id")) if isinstance(chat, Mapping) else None
    message_id = _optional_str(message.get("message_id"))

    document = message.get("document")
    if isinstance(document, Mapping):
        file_id = _required_file_id(document)
        if file_id is None:
            return None
        return TelegramSharedFile(
            file_id=file_id,
            file_unique_id=_optional_str(document.get("file_unique_id")),
            filename=str(document.get("file_name") or _fallback_filename("telegram-document", document)),
            mime_type=_optional_str(document.get("mime_type")) or "application/octet-stream",
            size_bytes=_optional_int(document.get("file_size")),
            chat_id=chat_id,
            message_id=message_id,
        )

    video = message.get("video")
    if isinstance(video, Mapping):
        file_id = _required_file_id(video)
        if file_id is None:
            return None
        return TelegramSharedFile(
            file_id=file_id,
            file_unique_id=_optional_str(video.get("file_unique_id")),
            filename=str(video.get("file_name") or _fallback_filename("telegram-video", video, ".mp4")),
            mime_type=_optional_str(video.get("mime_type")) or "video/mp4",
            size_bytes=_optional_int(video.get("file_size")),
            chat_id=chat_id,
            message_id=message_id,
        )

    audio = message.get("audio")
    if isinstance(audio, Mapping):
        file_id = _required_file_id(audio)
        if file_id is None:
            return None
        return TelegramSharedFile(
            file_id=file_id,
            file_unique_id=_optional_str(audio.get("file_unique_id")),
            filename=str(audio.get("file_name") or _fallback_filename("telegram-audio", audio, ".mp3")),
            mime_type=_optional_str(audio.get("mime_type")) or "audio/mpeg",
            size_bytes=_optional_int(audio.get("file_size")),
            chat_id=chat_id,
            message_id=message_id,
        )

    photos = message.get("photo")
    if isinstance(photos, list) and photos:
        photo_candidates = [item for item in photos if isinstance(item, Mapping)]
        if not photo_candidates:
            return None
        photo = max(photo_candidates, key=lambda item: item.get("file_size") or 0)
        file_id = _required_file_id(photo)
        if file_id is None:
            return None
        return TelegramSharedFile(
            file_id=file_id,
            file_unique_id=_optional_str(photo.get("file_unique_id")),
            filename=_fallback_filename("telegram-photo", photo, ".jpg"),
            mime_type="image/jpeg",
            size_bytes=_optional_int(photo.get("file_size")),
            chat_id=chat_id,
            message_id=message_id,
        )

    return None


def _message(update: Mapping[str, Any]) -> Mapping[str, Any] | None:
    for key in ("message", "channel_post", "edited_message", "edited_channel_post"):
        value = update.get(key)
        if isinstance(value, Mapping):
            return value
    return None


def _fallback_filename(prefix: str, payload: Mapping[str, Any], suffix: str = "") -> str:
    unique = payload.get("file_unique_id") or payload.get("file_id") or "file"
    return f"{prefix}-{unique}{suffix}"


def _required_file_id(payload: Mapping[str, Any]) -> str | None:
    value = payload.get("file_id")
    if value is None or str(value).strip() == "":
        return None
    return str(value)


def _optional_str(value: object) -> str | None:
    return None if value is None else str(value)


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    return int(value)
