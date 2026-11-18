"""MarketSnapshot: the single input format consumed by analyst agents.

Built from the live `MarketDataStore` or from pre-computed backtest
frames — so the exact same decision code runs in paper/testnet/live and
in the backtester.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from analysis.orderbook import BookStats


@dataclass
class MarketSnapshot:
    timestamp: int                                   # decision time (ms)
    price: float                                     # reference price (mid in live, close in backtest)
    rows: dict[str, dict[str, float]]                # tf -> last CLOSED feature row
    prev_rows: dict[str, dict[str, float]] = field(default_factory=dict)
    book: BookStats | None = None                    # live only
    flow: dict[str, float] | None = None             # live only (aggressor flow)
    funding_rate: float | None = None                # hourly rate
    mark: float | None = None
    open_interest: float | None = None
    staleness_s: dict[str, float] = field(default_factory=dict)
    source: str = "live"
    extra: dict[str, Any] = field(default_factory=dict)

    def get(self, tf: str, col: str, default: float = math.nan) -> float:
        v = self.rows.get(tf, {}).get(col, default)
        try:
            return float(v)
        except (TypeError, ValueError):
            return default

    def prev(self, tf: str, col: str, default: float = math.nan) -> float:
        v = self.prev_rows.get(tf, {}).get(col, default)
        try:
            return float(v)
        except (TypeError, ValueError):
            return default

    def has(self, *tfs: str) -> bool:
        return all(tf in self.rows and self.rows[tf] for tf in tfs)


def finite(*vals: float) -> bool:
    return all(v is not None and isinstance(v, (int, float)) and math.isfinite(v) for v in vals)


def snapshot_from_store(store, now_ms: int, flow_window_ms: int = 60_000) -> MarketSnapshot:
    """Build a live snapshot from a MarketDataStore (closed candles only)."""
    from analysis.orderbook import trade_flow

    rows, prev_rows = {}, {}
    for tf in store.timeframes:
        f = store.features(tf, now_ms)
        if len(f) >= 2:
            rows[tf] = f.iloc[-1].to_dict()
            prev_rows[tf] = f.iloc[-2].to_dict()
    book = store.book()
    price = store.mid or (rows.get("1m", {}).get("close") if rows else None) or math.nan
    ctx = store.asset_ctx
    return MarketSnapshot(
        timestamp=now_ms,
        price=float(price),
        rows=rows,
        prev_rows=prev_rows,
        book=book,
        flow=trade_flow(list(store.trades), flow_window_ms, now_ms),
        funding_rate=store.funding_rate,
        mark=store.mark,
        open_interest=ctx.get("openInterest") if isinstance(ctx.get("openInterest"), float) else None,
        staleness_s=store.freshness(now_ms),
        source="live",
    )
