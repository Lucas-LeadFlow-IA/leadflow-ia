"""AGENT 1 — MARKET SCANNER.

Continuously summarises the BTC market across timeframes: price changes,
volume, abnormal moves, volatility, spread, data quality. It flags
*opportunities* (things worth analysing) but never takes positions.
"""
from __future__ import annotations

import math

from agents.base import BaseAgent
from core.models import AgentReport
from core.snapshot import MarketSnapshot, finite

SCAN_TFS = ("1m", "5m", "15m", "30m", "1h", "4h")


class MarketScanner(BaseAgent):
    name = "market_scanner"
    role = "Surveille le marché BTC (prix, volumes, volatilité, spreads, anomalies) — ne trade jamais"

    def __init__(self, abnormal_ret_z: float = 3.0, abnormal_range_atr: float = 2.5, volume_spike_z: float = 3.0):
        super().__init__()
        self.abnormal_ret_z = abnormal_ret_z
        self.abnormal_range_atr = abnormal_range_atr
        self.volume_spike_z = volume_spike_z

    def analyze(self, snap: MarketSnapshot) -> AgentReport:
        tfs: dict[str, dict] = {}
        anomalies, opportunities = [], []
        for tf in SCAN_TFS:
            if tf not in snap.rows:
                continue
            r = snap.rows[tf]
            ret_z, rng, vz = snap.get(tf, "ret_z"), snap.get(tf, "range_atr"), snap.get(tf, "vol_z")
            info = {
                "close": snap.get(tf, "close"),
                "ret_pct": round(snap.get(tf, "ret_1") * 100, 4) if finite(snap.get(tf, "ret_1")) else None,
                "atr_pct": round(snap.get(tf, "atr_pct") * 100, 4) if finite(snap.get(tf, "atr_pct")) else None,
                "atr_rank": _r(snap.get(tf, "atr_pct_rank")),
                "vol_z": _r(vz),
                "ret_z": _r(ret_z),
                "momentum": int(math.copysign(1, snap.get(tf, "ema20_slope"))) if finite(snap.get(tf, "ema20_slope")) else 0,
                "close_time": r.get("close_time"),
            }
            tfs[tf] = info
            if finite(ret_z) and abs(ret_z) >= self.abnormal_ret_z:
                anomalies.append(f"{tf}: abnormal move (return z={ret_z:.1f})")
            if finite(rng) and rng >= self.abnormal_range_atr:
                anomalies.append(f"{tf}: wide range candle ({rng:.1f}x ATR)")
            if finite(vz) and vz >= self.volume_spike_z:
                anomalies.append(f"{tf}: volume spike (z={vz:.1f})")
            if snap.get(tf, "sweep_bull") == 1 or snap.get(tf, "sweep_bear") == 1:
                opportunities.append(f"{tf}: liquidity sweep")
            if any(snap.get(tf, c) == 1 for c in ("bos_bull", "bos_bear", "choch_bull", "choch_bear")):
                opportunities.append(f"{tf}: structure break")
            prev_rank = snap.prev(tf, "bb_width_rank")
            if finite(prev_rank, snap.get(tf, "bb_width_rank")) and prev_rank < 0.2 <= snap.get(tf, "bb_width_rank"):
                opportunities.append(f"{tf}: volatility expansion from squeeze")

        moms = [v["momentum"] for v in tfs.values()]
        alignment = sum(moms) / len(moms) if moms else 0.0
        book = snap.book
        spread_bps = book.spread_bps if book else None
        vol_rank = tfs.get("1h", {}).get("atr_rank")
        vol_state = "unknown" if vol_rank is None else ("high" if vol_rank > 0.85 else "low" if vol_rank < 0.15 else "normal")
        data = {
            "price": snap.price,
            "mark": snap.mark,
            "funding_rate_hourly": snap.funding_rate,
            "spread_bps": None if spread_bps is None else round(spread_bps, 3),
            "book_imbalance_10bps": None if book is None else round(book.imbalance_10bps, 3),
            "trade_flow_delta_ratio": None if not snap.flow else round(snap.flow.get("delta_ratio", 0.0), 3),
            "timeframes": tfs,
            "momentum_alignment": round(alignment, 2),
            "volatility_state": vol_state,
            "anomalies": anomalies,
            "opportunities": opportunities,
            "staleness_s": snap.staleness_s,
        }
        summary = (f"BTC {snap.price:,.0f} | vol {vol_state} | alignment {alignment:+.2f} | "
                   f"{len(anomalies)} anomalies, {len(opportunities)} opportunities")
        status = "warning" if anomalies else "ok"
        return self.record(AgentReport(agent=self.name, timestamp=snap.timestamp, summary=summary, data=data), status)


def _r(v: float, nd: int = 3):
    return round(v, nd) if finite(v) else None
