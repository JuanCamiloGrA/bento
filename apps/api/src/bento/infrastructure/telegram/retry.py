from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TypeVar

from bento.infrastructure.telegram.client import TelegramApiError

T = TypeVar("T")
AsyncOperation = Callable[[], Awaitable[T]]
AsyncSleep = Callable[[float], Awaitable[None]]
MonotonicClock = Callable[[], float]


@dataclass(frozen=True, slots=True)
class TelegramRetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 2.0


class TelegramRateLimiter:
    def __init__(
        self,
        *,
        min_interval_seconds: float,
        sleep: AsyncSleep = asyncio.sleep,
        monotonic: MonotonicClock = time.monotonic,
    ) -> None:
        self._min_interval_seconds = min_interval_seconds
        self._sleep = sleep
        self._monotonic = monotonic
        self._next_at = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        if self._min_interval_seconds <= 0:
            return
        async with self._lock:
            now = self._monotonic()
            delay = max(0.0, self._next_at - now)
            if delay > 0:
                await self._sleep(delay)
                now = self._monotonic()
            self._next_at = max(now, self._next_at) + self._min_interval_seconds


async def call_with_telegram_retries(
    operation: AsyncOperation[T],
    *,
    retry_policy: TelegramRetryPolicy,
    rate_limiter: TelegramRateLimiter | None = None,
    sleep: AsyncSleep = asyncio.sleep,
) -> T:
    attempt = 1
    while True:
        if rate_limiter is not None:
            await rate_limiter.wait()
        try:
            return await operation()
        except TelegramApiError as exc:
            if attempt >= retry_policy.max_attempts or not exc.retryable:
                raise
            await sleep(_retry_delay(exc, retry_policy, attempt))
            attempt += 1


def _retry_delay(error: TelegramApiError, retry_policy: TelegramRetryPolicy, attempt: int) -> float:
    if error.retry_after is not None:
        return max(0.0, error.retry_after)
    delay = retry_policy.base_delay_seconds * (2 ** (attempt - 1))
    return min(retry_policy.max_delay_seconds, delay)
