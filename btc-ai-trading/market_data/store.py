"""In-memory market state shared by the agents.

Only CLOSED candles are exposed to analysis (`closed()` / `features()`):
the forming candle is kept aside so no agent ever reasons on an
incomplete bar. Every stream records its last update time so the
Risk Manager / kill switch can refuse to trade on stale data.
"""
from __future__ import annotations

import time
from collections import deque
from typing import Any

import pandas as pd

from analysis.features import compute_features
from analysis.orderbook import BookStats, book_stats
from market_data.candles import CANDLE_COLUMNS, interval_ms, merge, normalize

DEFAULT_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h"]


def _now_ms() -> int:
    return int(time.time() * 1000)


class MarketDataStore:
    def __init__(self, coin: str = "BTC", timeframes: list[str] | None = None, max_rows: int = 2000):
        self.coin = coin
        self.timeframes = timeframes or list(DEFAULT_TIMEFRAMES)
        self.max_rows = max_rows
        self._closed: dict[str, pd.DataFrame] = {tf: pd.DataFrame(columns=CANDLE_COLUMNS) for tf in self.timeframes}
        self._forming: dict[str, dict] = {}
        self._feat_cache: dict[str, tuple[int, int, pd.DataFrame]] = {}
        self.bids: list[tuple[float, float]] = []
        self.asks: list[tuple[float, float]] = []
        self.trades: deque[dict] = deque(maxlen=5000)
        self.asset_ctx: dict[str, Any] = {}
        self.last_update: dict[str, int] = {}
        # exchange metadata
        self.asset_index: int | None = None
        self.sz_decimals: int = 5
        self.max_leverage: int | None = None

    # ------------------------------------------------------------------ ingestion
    def set_candles(self, tf: str, df: pd.DataFrame, now_ms: int | None = None) -> None:
        """Bootstrap / refill from REST. Splits closed vs forming candles."""
        now_ms = now_ms or _now_ms()
        df = normalize(df.copy())
        closed = df[df["close_time"] < now_ms]
        forming = df[df["close_time"] >= now_ms]
        self._closed[tf] = merge(self._closed.get(tf), closed).tail(self.max_rows).reset_index(drop=True)
        if not forming.empty:
            self._forming[tf] = forming.iloc[-1].to_dict()
        self.last_update[f"candle_{tf}"] = now_ms

    def on_candle(self, data: dict, now_ms: int | None = None) -> None:
        tf = data.get("i")
        if tf not in self._closed:
            return
        now_ms = now_ms or _now_ms()
        row = {
            "open_time": int(data["t"]), "close_time": int(data["T"]), "open": float(data["o"]),
            "high": float(data["h"]), "low": float(data["l"]), "close": float(data["c"]),
            "volume": float(data["v"]), "trades": int(data.get("n", 0) or 0),
        }
        prev = self._forming.get(tf)
        if prev is not None and row["open_time"] > prev["open_time"]:
            self._append_closed(tf, prev)
        self._forming[tf] = row
        self.last_update[f"candle_{tf}"] = now_ms
        self.last_update["candles"] = now_ms

    def _append_closed(self, tf: str, row: dict) -> None:
        df = self._closed[tf]
        if not df.empty and int(df["open_time"].iloc[-1]) >= int(row["open_time"]):
            # update in place if it is the same candle
            if int(df["open_time"].iloc[-1]) == int(row["open_time"]):
                df = df.iloc[:-1]
            else:
                return
        new = pd.DataFrame([row], columns=CANDLE_COLUMNS)
        self._closed[tf] = normalize(pd.concat([df, new], ignore_index=True)).tail(self.max_rows).reset_index(drop=True)

    def on_l2book(self, data: dict, now_ms: int | None = None) -> None:
        levels = data.get("levels") or [[], []]
        self.bids = [(float(x["px"]), float(x["sz"])) for x in levels[0]]
        self.asks = [(float(x["px"]), float(x["sz"])) for x in levels[1]]
        self.last_update["book"] = now_ms or _now_ms()

    def on_trades(self, data: list[dict], now_ms: int | None = None) -> None:
        for t in data or []:
            if t.get("coin") == self.coin:
                self.trades.append({"px": float(t["px"]), "sz": float(t["sz"]), "side": t["side"],
                                    "time": int(t["time"])})
        self.last_update["trades"] = now_ms or _now_ms()

    def on_asset_ctx(self, data: dict, now_ms: int | None = None) -> None:
        if data.get("coin") not in (None, self.coin):
            return
        ctx = data.get("ctx", data)
        self.asset_ctx = {k: (float(v) if isinstance(v, str) and _is_number(v) else v) for k, v in ctx.items()}
        self.last_update["asset_ctx"] = now_ms or _now_ms()

    # ------------------------------------------------------------------ access
    def closed(self, tf: str, now_ms: int | None = None) -> pd.DataFrame:
        now_ms = now_ms or _now_ms()
        f = self._forming.get(tf)
        if f is not None and f["close_time"] < now_ms:
            # the forming candle ended but no newer update arrived yet
            self._append_closed(tf, f)
            self._forming.pop(tf, None)
        return self._closed[tf]

    def features(self, tf: str, now_ms: int | None = None) -> pd.DataFrame:
        df = self.closed(tf, now_ms)
        if df.empty:
            return df
        key = (int(df["open_time"].iloc[-1]), len(df))
        cached = self._feat_cache.get(tf)
        if cached and (cached[0], cached[1]) == key:
            return cached[2]
        feats = compute_features(df, tf)
        self._feat_cache[tf] = (key[0], key[1], feats)
        return feats

    def book(self) -> BookStats | None:
        return book_stats(self.bids, self.asks)

    @property
    def mid(self) -> float | None:
        if self.bids and self.asks:
            return (self.bids[0][0] + self.asks[0][0]) / 2.0
        mid = self.asset_ctx.get("midPx")
        if isinstance(mid, float):
            return mid
        for tf in self.timeframes:
            f = self._forming.get(tf)
            if f:
                return float(f["close"])
        return None

    @property
    def mark(self) -> float | None:
        m = self.asset_ctx.get("markPx")
        return m if isinstance(m, float) else self.mid

    @property
    def funding_rate(self) -> float:
        f = self.asset_ctx.get("funding")
        return float(f) if isinstance(f, float) else 0.0

    def staleness_s(self, stream: str, now_ms: int | None = None) -> float:
        t = self.last_update.get(stream)
        if t is None:
            return float("inf")
        return ((now_ms or _now_ms()) - t) / 1000.0

    def freshness(self, now_ms: int | None = None) -> dict[str, float]:
        now_ms = now_ms or _now_ms()
        return {k: round((now_ms - v) / 1000.0, 1) for k, v in self.last_update.items()}

    def last_closed_age_s(self, tf: str, now_ms: int | None = None) -> float:
        """Seconds since the last closed candle should have been followed by a new one."""
        now_ms = now_ms or _now_ms()
        df = self.closed(tf, now_ms)
        if df.empty:
            return float("inf")
        expected_next_close = int(df["close_time"].iloc[-1]) + interval_ms(tf)
        return max(0.0, (now_ms - expected_next_close) / 1000.0)


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False
