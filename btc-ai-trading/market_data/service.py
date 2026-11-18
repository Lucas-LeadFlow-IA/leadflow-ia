"""Market data service: REST bootstrap + WebSocket streaming + gap refill."""
from __future__ import annotations

import asyncio
import logging
import time

from market_data.candles import candles_from_api, interval_ms
from market_data.hyperliquid_info import HyperliquidInfoClient
from market_data.store import MarketDataStore
from market_data.websocket_feed import HyperliquidWebSocket

log = logging.getLogger(__name__)


class MarketDataService:
    BOOTSTRAP_BARS = 1500
    REFILL_BARS = 120

    def __init__(self, api_url: str, ws_url: str, coin: str = "BTC", store: MarketDataStore | None = None,
                 info: HyperliquidInfoClient | None = None, ws: HyperliquidWebSocket | None = None):
        self.coin = coin
        self.store = store or MarketDataStore(coin)
        self.info = info or HyperliquidInfoClient(api_url)
        self.ws = ws or HyperliquidWebSocket(ws_url)
        self._tasks: list[asyncio.Task] = []
        self.bootstrapped = False

    async def bootstrap(self) -> None:
        idx, uni, ctx = await self.info.asset_info(self.coin)
        self.store.asset_index = idx
        self.store.sz_decimals = int(uni["szDecimals"])
        self.store.max_leverage = int(uni.get("maxLeverage", 1))
        self.store.on_asset_ctx({"coin": self.coin, "ctx": ctx})
        await self._load_candles(self.BOOTSTRAP_BARS)
        book = await self.info.l2_book(self.coin)
        self.store.on_l2book(book)
        self.bootstrapped = True
        log.info("market data bootstrapped", extra={"coin": self.coin, "asset": idx, "szDecimals": uni["szDecimals"]})

    async def _load_candles(self, bars: int) -> None:
        now = int(time.time() * 1000)
        for tf in self.store.timeframes:
            start = now - bars * interval_ms(tf)
            rows = await self.info.candle_snapshot(self.coin, tf, start, now)
            self.store.set_candles(tf, candles_from_api(rows), now)

    async def refill(self) -> None:
        """Called after a websocket reconnect to fill missed candles."""
        try:
            await self._load_candles(self.REFILL_BARS)
            book = await self.info.l2_book(self.coin)
            self.store.on_l2book(book)
            log.info("market data refilled after reconnect")
        except Exception:  # noqa: BLE001
            log.exception("refill failed")

    async def _poll_ctx(self) -> None:
        """Low-frequency REST fallback for funding / mark (also a REST health probe)."""
        while True:
            await asyncio.sleep(30)
            try:
                _, _, ctx = await self.info.asset_info(self.coin)
                if self.store.staleness_s("asset_ctx") > 20:
                    self.store.on_asset_ctx({"coin": self.coin, "ctx": ctx})
            except Exception as exc:  # noqa: BLE001
                log.warning("asset ctx poll failed: %s", exc)

    async def start(self) -> None:
        if not self.bootstrapped:
            await self.bootstrap()
        for tf in self.store.timeframes:
            self.ws.subscribe({"type": "candle", "coin": self.coin, "interval": tf})
        self.ws.subscribe({"type": "l2Book", "coin": self.coin})
        self.ws.subscribe({"type": "trades", "coin": self.coin})
        self.ws.subscribe({"type": "activeAssetCtx", "coin": self.coin})
        self.ws.on("candle", self.store.on_candle)
        self.ws.on("l2Book", self.store.on_l2book)
        self.ws.on("trades", self.store.on_trades)
        self.ws.on("activeAssetCtx", self.store.on_asset_ctx)
        self.ws.on_reconnect(self.refill)
        self._tasks = [asyncio.create_task(self.ws.run(), name="ws"),
                       asyncio.create_task(self._poll_ctx(), name="ctx-poll")]

    async def stop(self) -> None:
        await self.ws.stop()
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        await self.info.close()

    def health(self) -> dict:
        s = self.store
        return {
            "ws_connected": self.ws.connected,
            "ws_reconnects": self.ws.reconnects,
            "ws_disconnects_10min": self.ws.disconnects_last(600),
            "ws_last_message_age_s": None if self.ws.last_message_ms is None
            else round((time.time() * 1000 - self.ws.last_message_ms) / 1000, 1),
            "rest_consecutive_failures": self.info.consecutive_failures,
            "staleness_s": s.freshness(),
            "book_age_s": s.staleness_s("book"),
            "ctx_age_s": s.staleness_s("asset_ctx"),
            "candle_1m_lag_s": s.last_closed_age_s("1m") if "1m" in s.timeframes else None,
        }
