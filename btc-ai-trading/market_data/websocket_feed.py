"""Resilient Hyperliquid WebSocket client.

* Subscriptions use the documented format
  `{"method": "subscribe", "subscription": {...}}`.
* Heartbeat: the server closes a connection that has not received a
  message for 60 s, so we send `{"method": "ping"}` every 20 s and expect
  `{"channel": "pong"}`.
* Reconnection with exponential back-off + jitter; all subscriptions are
  replayed and an `on_reconnect` hook lets the store refill gaps via REST
  (docs: "missed data ... can be queried using the corresponding info request").
* Connection-health counters feed the kill switch (unstable connection).
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from collections.abc import Awaitable, Callable
from typing import Any

import websockets

log = logging.getLogger(__name__)

Handler = Callable[[dict], Any]


class HyperliquidWebSocket:
    PING_INTERVAL = 20.0
    PONG_TIMEOUT = 15.0
    MAX_BACKOFF = 60.0

    def __init__(self, url: str, connect: Callable[..., Awaitable] | None = None):
        self.url = url
        self._connect = connect or websockets.connect
        self._subs: list[dict] = []
        self._handlers: dict[str, list[Handler]] = {}
        self._reconnect_hooks: list[Callable[[], Awaitable[None]]] = []
        self._ws = None
        self._stop = asyncio.Event()
        self.connected = False
        self.last_message_ms: int | None = None
        self.last_pong_ms: int | None = None
        self.reconnects = 0
        self.disconnect_times: list[float] = []

    # ------------------------------------------------------------------ config
    def subscribe(self, subscription: dict) -> None:
        if subscription not in self._subs:
            self._subs.append(subscription)

    def on(self, channel: str, handler: Handler) -> None:
        self._handlers.setdefault(channel, []).append(handler)

    def on_reconnect(self, hook: Callable[[], Awaitable[None]]) -> None:
        self._reconnect_hooks.append(hook)

    def disconnects_last(self, seconds: float) -> int:
        cutoff = time.monotonic() - seconds
        self.disconnect_times = [t for t in self.disconnect_times if t >= cutoff]
        return len(self.disconnect_times)

    # ------------------------------------------------------------------ run
    async def run(self) -> None:
        backoff = 1.0
        first = True
        while not self._stop.is_set():
            try:
                async with self._connect(self.url, open_timeout=15, ping_interval=None, max_size=8 * 2**20) as ws:
                    self._ws = ws
                    self.connected = True
                    backoff = 1.0
                    for sub in self._subs:
                        await ws.send(json.dumps({"method": "subscribe", "subscription": sub}))
                    if not first:
                        self.reconnects += 1
                        for hook in self._reconnect_hooks:
                            try:
                                await hook()
                            except Exception:  # noqa: BLE001
                                log.exception("reconnect hook failed")
                    first = False
                    log.info("websocket connected", extra={"url": self.url, "subs": len(self._subs)})
                    await self._session(ws)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.warning("websocket error: %s", exc)
            finally:
                if self.connected:
                    self.disconnect_times.append(time.monotonic())
                self.connected = False
                self._ws = None
            if self._stop.is_set():
                break
            sleep = min(self.MAX_BACKOFF, backoff) * random.uniform(0.7, 1.3)
            log.info("websocket reconnecting in %.1fs", sleep)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=sleep)
            except asyncio.TimeoutError:
                pass
            backoff = min(self.MAX_BACKOFF, backoff * 2)

    async def _session(self, ws) -> None:
        pinger = asyncio.create_task(self._ping_loop(ws))
        try:
            async for raw in ws:
                self.last_message_ms = int(time.time() * 1000)
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                channel = msg.get("channel")
                if channel == "pong":
                    self.last_pong_ms = self.last_message_ms
                    continue
                if channel == "error":
                    log.error("websocket server error: %s", msg.get("data"))
                for h in self._handlers.get(channel, []):
                    try:
                        res = h(msg.get("data"))
                        if asyncio.iscoroutine(res):
                            await res
                    except Exception:  # noqa: BLE001
                        log.exception("handler for %s failed", channel)
                if self._stop.is_set():
                    break
        finally:
            pinger.cancel()

    async def _ping_loop(self, ws) -> None:
        while True:
            await asyncio.sleep(self.PING_INTERVAL)
            sent = int(time.time() * 1000)
            await ws.send(json.dumps({"method": "ping"}))
            await asyncio.sleep(self.PONG_TIMEOUT)
            if (self.last_pong_ms or 0) < sent:
                log.warning("pong timeout — forcing reconnect")
                await ws.close()
                return

    async def stop(self) -> None:
        self._stop.set()
        if self._ws is not None:
            await self._ws.close()
