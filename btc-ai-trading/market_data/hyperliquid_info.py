"""Async, read-only client for the Hyperliquid `info` endpoint.

Only request types documented at
https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
are used. This client can never sign or send an order.

Rate limiting: the documented IP budget is 1200 weight / minute. We keep
a client-side token bucket at 900/min (safety margin) using the documented
weights (2 for l2Book/allMids/clearinghouseState/orderStatus, 20 otherwise,
plus per-item surcharges for candles / funding history).
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

import httpx

from market_data.candles import candles_from_api, interval_ms, merge

log = logging.getLogger(__name__)

LIGHT_TYPES = {"l2Book", "allMids", "clearinghouseState", "orderStatus", "spotClearinghouseState", "exchangeStatus"}


class InfoAPIError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class _WeightBucket:
    def __init__(self, per_minute: float = 900.0):
        self.capacity = per_minute
        self.tokens = per_minute
        self.rate = per_minute / 60.0
        self.updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, weight: float) -> None:
        async with self._lock:
            while True:
                now = time.monotonic()
                self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
                self.updated = now
                if self.tokens >= weight:
                    self.tokens -= weight
                    return
                await asyncio.sleep((weight - self.tokens) / self.rate)


class HyperliquidInfoClient:
    def __init__(self, base_url: str, timeout: float = 10.0, max_retries: int = 4,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout, transport=transport,
                                         headers={"Content-Type": "application/json"})
        self.max_retries = max_retries
        self._bucket = _WeightBucket()
        self.last_success_ms: int | None = None
        self.consecutive_failures = 0

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self.close()

    # ------------------------------------------------------------------
    async def post(self, payload: dict[str, Any], weight: float | None = None) -> Any:
        if weight is None:
            weight = 2 if payload.get("type") in LIGHT_TYPES else 20
        await self._bucket.acquire(weight)
        delay = 0.5
        last_exc: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                resp = await self._client.post("/info", json=payload)
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise InfoAPIError(f"HTTP {resp.status_code}: {resp.text[:200]}", resp.status_code)
                if resp.status_code >= 400:
                    # client errors are not retried (bad request = our bug)
                    self.consecutive_failures += 1
                    raise InfoAPIError(f"HTTP {resp.status_code}: {resp.text[:300]}", resp.status_code)
                data = resp.json()
                self.last_success_ms = int(time.time() * 1000)
                self.consecutive_failures = 0
                return data
            except InfoAPIError as exc:
                if exc.status is not None and 400 <= exc.status < 500 and exc.status != 429:
                    raise
                last_exc = exc
            except (httpx.TransportError, ValueError) as exc:
                last_exc = exc
            self.consecutive_failures += 1
            if attempt < self.max_retries:
                await asyncio.sleep(delay + random.uniform(0, delay / 2))
                delay = min(delay * 2, 8.0)
        raise InfoAPIError(f"info request failed after retries: {last_exc}")

    # ------------------------------------------------------------------ market
    async def meta(self) -> dict:
        return await self.post({"type": "meta"})

    async def meta_and_asset_ctxs(self) -> list:
        return await self.post({"type": "metaAndAssetCtxs"})

    async def asset_info(self, coin: str = "BTC") -> tuple[int, dict, dict]:
        """Return (asset_index, universe entry, asset context) for `coin`."""
        meta, ctxs = await self.meta_and_asset_ctxs()
        for idx, u in enumerate(meta["universe"]):
            if u["name"] == coin:
                return idx, u, ctxs[idx]
        raise InfoAPIError(f"coin {coin} not found in perp universe")

    async def all_mids(self) -> dict[str, str]:
        return await self.post({"type": "allMids"})

    async def l2_book(self, coin: str = "BTC", n_sig_figs: int | None = None) -> dict:
        payload: dict[str, Any] = {"type": "l2Book", "coin": coin}
        if n_sig_figs is not None:
            payload["nSigFigs"] = n_sig_figs
        return await self.post(payload)

    async def candle_snapshot(self, coin: str, interval: str, start_ms: int, end_ms: int) -> list[dict]:
        n_expected = max(1, (end_ms - start_ms) // interval_ms(interval))
        weight = 20 + min(5000, n_expected) / 60.0
        return await self.post(
            {"type": "candleSnapshot", "req": {"coin": coin, "interval": interval,
                                               "startTime": int(start_ms), "endTime": int(end_ms)}},
            weight=weight,
        )

    async def candles(self, coin: str, interval: str, start_ms: int, end_ms: int | None = None,
                      chunk: int = 4000):
        """Candles in [start, end] (paginated). Hyperliquid only serves the most
        recent ~5000 candles per interval; older requests return what exists."""
        import pandas as pd  # local import keeps module import light

        end_ms = end_ms or int(time.time() * 1000)
        step = interval_ms(interval)
        out = pd.DataFrame()
        cursor = start_ms
        while cursor < end_ms:
            stop = min(end_ms, cursor + chunk * step)
            rows = await self.candle_snapshot(coin, interval, cursor, stop)
            if rows:
                out = merge(out, candles_from_api(rows))
            cursor = stop + 1
        return out

    async def funding_history(self, coin: str, start_ms: int, end_ms: int | None = None) -> list[dict]:
        """Hourly funding rates, paginated (500 rows per response)."""
        rows: list[dict] = []
        cursor = start_ms
        end_ms = end_ms or int(time.time() * 1000)
        while cursor < end_ms:
            payload = {"type": "fundingHistory", "coin": coin, "startTime": int(cursor), "endTime": int(end_ms)}
            batch = await self.post(payload, weight=20 + 500 / 20)
            if not batch:
                break
            rows.extend(batch)
            last = int(batch[-1]["time"])
            if len(batch) < 500 or last <= cursor:
                break
            cursor = last + 1
        seen, uniq = set(), []
        for r in rows:
            if r["time"] not in seen:
                seen.add(r["time"])
                uniq.append(r)
        return uniq

    # ------------------------------------------------------------------ account (read-only)
    async def clearinghouse_state(self, user: str) -> dict:
        return await self.post({"type": "clearinghouseState", "user": user})

    async def open_orders(self, user: str) -> list[dict]:
        return await self.post({"type": "openOrders", "user": user})

    async def frontend_open_orders(self, user: str) -> list[dict]:
        return await self.post({"type": "frontendOpenOrders", "user": user})

    async def order_status(self, user: str, oid_or_cloid: int | str) -> dict:
        return await self.post({"type": "orderStatus", "user": user, "oid": oid_or_cloid})

    async def user_fills_by_time(self, user: str, start_ms: int, end_ms: int | None = None) -> list[dict]:
        payload: dict[str, Any] = {"type": "userFillsByTime", "user": user, "startTime": int(start_ms)}
        if end_ms is not None:
            payload["endTime"] = int(end_ms)
        return await self.post(payload, weight=40)

    async def user_funding(self, user: str, start_ms: int, end_ms: int | None = None) -> list[dict]:
        payload: dict[str, Any] = {"type": "userFunding", "user": user, "startTime": int(start_ms)}
        if end_ms is not None:
            payload["endTime"] = int(end_ms)
        return await self.post(payload, weight=40)

    async def user_fees(self, user: str) -> dict:
        return await self.post({"type": "userFees", "user": user})
