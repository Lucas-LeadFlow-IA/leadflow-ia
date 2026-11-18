"""Order-book and trade-flow analytics (live only — Hyperliquid does not
provide historical L2 snapshots through the public API, so these inputs
are neutral in backtests and reported as unavailable)."""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np


@dataclass
class BookStats:
    best_bid: float
    best_ask: float
    mid: float
    spread_bps: float
    bid_depth_10bps: float   # BTC within 10 bps of mid
    ask_depth_10bps: float
    imbalance_10bps: float   # (bid - ask) / (bid + ask) in [-1, 1]
    imbalance_25bps: float
    bid_wall: float | None   # price of an unusually large bid level
    ask_wall: float | None
    levels: int

    def to_dict(self) -> dict:
        return asdict(self)


def _depth(levels: list[tuple[float, float]], mid: float, bps: float, side: str) -> float:
    lim = mid * (1 - bps / 1e4) if side == "bid" else mid * (1 + bps / 1e4)
    if side == "bid":
        return float(sum(sz for px, sz in levels if px >= lim))
    return float(sum(sz for px, sz in levels if px <= lim))


def book_stats(bids: list[tuple[float, float]], asks: list[tuple[float, float]], wall_k: float = 5.0) -> BookStats | None:
    """bids/asks: lists of (price, size) sorted best first."""
    if not bids or not asks:
        return None
    bb, ba = bids[0][0], asks[0][0]
    if bb <= 0 or ba <= 0 or ba < bb:
        return None
    mid = (bb + ba) / 2.0
    spread_bps = (ba - bb) / mid * 1e4
    bd10, ad10 = _depth(bids, mid, 10, "bid"), _depth(asks, mid, 10, "ask")
    bd25, ad25 = _depth(bids, mid, 25, "bid"), _depth(asks, mid, 25, "ask")
    imb10 = (bd10 - ad10) / (bd10 + ad10) if bd10 + ad10 > 0 else 0.0
    imb25 = (bd25 - ad25) / (bd25 + ad25) if bd25 + ad25 > 0 else 0.0
    sizes = np.array([s for _, s in bids + asks], dtype=float)
    med = float(np.median(sizes)) if len(sizes) else 0.0
    bid_wall = next((px for px, sz in bids if med > 0 and sz >= wall_k * med), None)
    ask_wall = next((px for px, sz in asks if med > 0 and sz >= wall_k * med), None)
    return BookStats(bb, ba, mid, spread_bps, bd10, ad10, imb10, imb25, bid_wall, ask_wall, len(bids) + len(asks))


def market_impact_price(levels: list[tuple[float, float]], size: float) -> tuple[float | None, float]:
    """Average fill price for `size` walking the given side; returns (avg_px, filled)."""
    remaining, cost = size, 0.0
    for px, sz in levels:
        take = min(remaining, sz)
        cost += take * px
        remaining -= take
        if remaining <= 1e-12:
            break
    filled = size - max(remaining, 0.0)
    return (cost / filled if filled > 0 else None), filled


def trade_flow(trades: list[dict], window_ms: int, now_ms: int) -> dict[str, float]:
    """Aggressor buy/sell volume over a recent window (side 'B' = buyer aggressor)."""
    recent = [t for t in trades if now_ms - int(t["time"]) <= window_ms]
    buy = sum(float(t["sz"]) for t in recent if t.get("side") == "B")
    sell = sum(float(t["sz"]) for t in recent if t.get("side") == "A")
    tot = buy + sell
    return {"buy_volume": buy, "sell_volume": sell, "delta": buy - sell,
            "delta_ratio": (buy - sell) / tot if tot > 0 else 0.0, "count": float(len(recent))}
