"""AGENT 3 — LIQUIDITY ANALYST.

Identifies liquidity features: sweeps, equal highs/lows, order-book
imbalance and walls, volume spikes, fair value gaps, order blocks and
false breakouts.

Honesty rules:
* We never claim to know other traders' stops or positions. "Stop-hunt"
  means a *price pattern* (wick through a resting-liquidity level and
  close back inside), nothing more.
* Liquidation zones: Hyperliquid's public API does not publish a reliable
  liquidation map, so this agent reports them as unavailable instead of
  inventing estimates.
"""
from __future__ import annotations

from agents.base import BaseAgent
from core.models import AgentReport
from core.snapshot import MarketSnapshot, finite

LIQ_TFS = ("1m", "5m", "15m", "1h", "4h")


class LiquidityAnalyst(BaseAgent):
    name = "liquidity_analyst"
    role = "Identifie sweeps, equal highs/lows, FVG, order blocks, déséquilibres du carnet, faux breakouts"

    def analyze(self, snap: MarketSnapshot) -> AgentReport:
        per_tf, score = {}, 0.0
        for tf in LIQ_TFS:
            if tf not in snap.rows:
                continue
            g = lambda c: snap.get(tf, c)  # noqa: E731
            item = {
                "sweep_bull_bars_ago": _int(g("bars_since_sweep_bull")),
                "sweep_bear_bars_ago": _int(g("bars_since_sweep_bear")),
                "equal_highs": _r(g("eqh_level")),
                "equal_lows": _r(g("eql_level")),
                "fvg_bull": _zone(g("fvg_bull_bottom"), g("fvg_bull_top")),
                "fvg_bear": _zone(g("fvg_bear_bottom"), g("fvg_bear_top")),
                "ob_bull": _zone(g("ob_bull_bottom"), g("ob_bull_top")),
                "ob_bear": _zone(g("ob_bear_bottom"), g("ob_bear_top")),
                "in_fvg_bull": g("in_fvg_bull") == 1, "in_fvg_bear": g("in_fvg_bear") == 1,
                "in_ob_bull": g("in_ob_bull") == 1, "in_ob_bear": g("in_ob_bear") == 1,
                "false_break_bull": g("false_break_bull") == 1, "false_break_bear": g("false_break_bear") == 1,
                "volume_spike": finite(g("vol_z")) and g("vol_z") >= 3.0,
            }
            per_tf[tf] = item
            w = {"1m": 0.5, "5m": 0.75, "15m": 1.0, "1h": 1.25, "4h": 1.0}[tf]
            if item["sweep_bull_bars_ago"] is not None and item["sweep_bull_bars_ago"] <= 3:
                score += w
            if item["sweep_bear_bars_ago"] is not None and item["sweep_bear_bars_ago"] <= 3:
                score -= w
            score += 0.5 * w * (int(item["in_fvg_bull"] or item["in_ob_bull"]) - int(item["in_fvg_bear"] or item["in_ob_bear"]))
            score += 0.75 * w * (int(item["false_break_bull"]) - int(item["false_break_bear"]))

        book = snap.book
        book_info = None
        if book is not None:
            book_info = {
                "spread_bps": round(book.spread_bps, 3),
                "imbalance_10bps": round(book.imbalance_10bps, 3),
                "imbalance_25bps": round(book.imbalance_25bps, 3),
                "bid_depth_10bps": round(book.bid_depth_10bps, 3),
                "ask_depth_10bps": round(book.ask_depth_10bps, 3),
                "bid_wall": book.bid_wall, "ask_wall": book.ask_wall,
            }
            score += 1.0 * book.imbalance_10bps
        if snap.flow:
            score += 0.5 * snap.flow.get("delta_ratio", 0.0)
        bias = max(-1.0, min(1.0, score / 4.0))
        data = {
            "liquidity_bias": round(bias, 3),
            "timeframes": per_tf,
            "order_book": book_info,
            "trade_flow": snap.flow,
            "liquidation_zones": "unavailable: no reliable public liquidation data on Hyperliquid",
            "order_book_history": "live only (no historical L2 in public API)" if snap.source == "backtest" else "live",
        }
        summary = f"liquidity bias {bias:+.2f}" + (f" | book imb {book.imbalance_10bps:+.2f}" if book else "")
        return self.record(AgentReport(agent=self.name, timestamp=snap.timestamp, summary=summary, data=data))


def _r(v, nd=1):
    return round(float(v), nd) if finite(v) else None


def _int(v):
    return int(v) if finite(v) else None


def _zone(lo, hi):
    return [round(float(lo), 1), round(float(hi), 1)] if finite(lo, hi) else None
