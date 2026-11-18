"""AGENT 2 — TECHNICAL ANALYST.

Builds a multi-timeframe technical picture (EMA 9/20/50/200, RSI, MACD,
VWAP, ATR, ADX, Bollinger, volume profile, support/resistance, BOS,
CHOCH, HH/HL/LH/LL) and confirms or invalidates a trading scenario.

Rule: no single indicator is ever sufficient. A directional bias needs
agreement of at least 3 independent factor groups (trend, structure,
momentum, location, strength).
"""
from __future__ import annotations

from agents.base import BaseAgent
from core.models import AgentReport, Direction
from core.snapshot import MarketSnapshot, finite

TF_WEIGHTS = {"5m": 0.10, "15m": 0.20, "30m": 0.15, "1h": 0.30, "4h": 0.25}


def tf_factors(snap: MarketSnapshot, tf: str) -> dict[str, int]:
    """Five independent factor groups, each -1 / 0 / +1."""
    g = lambda c: snap.get(tf, c)  # noqa: E731
    close = g("close")
    f: dict[str, int] = {}
    # 1. trend (EMA stack / position vs EMA200)
    if finite(g("ema20"), g("ema50"), g("ema200")):
        f["trend"] = 1 if (g("ema20") > g("ema50") and close > g("ema200")) else (
            -1 if (g("ema20") < g("ema50") and close < g("ema200")) else 0)
    else:
        f["trend"] = 0
    # 2. structure (HH/HL vs LH/LL + last break direction)
    st, bias = g("structure_trend"), g("struct_bias")
    f["structure"] = int(st) if finite(st) and st != 0 else (int(bias) if finite(bias) else 0)
    # 3. momentum (RSI + MACD histogram must agree)
    rsi, hist = g("rsi14"), g("macd_hist")
    if finite(rsi, hist):
        f["momentum"] = 1 if (rsi > 52 and hist > 0) else (-1 if (rsi < 48 and hist < 0) else 0)
    else:
        f["momentum"] = 0
    # 4. location (VWAP + Bollinger mid)
    if finite(g("vwap"), g("bb_mid")):
        f["location"] = 1 if (close > g("vwap") and close > g("bb_mid")) else (
            -1 if (close < g("vwap") and close < g("bb_mid")) else 0)
    else:
        f["location"] = 0
    # 5. trend strength (ADX with DI direction)
    adx_v, pdi, mdi = g("adx"), g("plus_di"), g("minus_di")
    f["strength"] = (1 if pdi > mdi else -1) if finite(adx_v, pdi, mdi) and adx_v >= 20 else 0
    return f


class TechnicalAnalyst(BaseAgent):
    name = "technical_analyst"
    role = "Analyse la structure technique multi-timeframe; confirme ou invalide les scénarios"

    def analyze(self, snap: MarketSnapshot) -> AgentReport:
        per_tf, bias_num, w_sum = {}, 0.0, 0.0
        for tf, w in TF_WEIGHTS.items():
            if tf not in snap.rows:
                continue
            f = tf_factors(snap, tf)
            votes = sum(f.values())
            agree_long = sum(1 for v in f.values() if v > 0)
            agree_short = sum(1 for v in f.values() if v < 0)
            tf_bias = 1 if agree_long >= 3 and agree_short == 0 else (-1 if agree_short >= 3 and agree_long == 0 else 0)
            per_tf[tf] = {
                "factors": f,
                "bias": tf_bias,
                "score": votes,
                "rsi": _r(snap.get(tf, "rsi14"), 1),
                "adx": _r(snap.get(tf, "adx"), 1),
                "macd_hist": _r(snap.get(tf, "macd_hist"), 2),
                "ema": {k: _r(snap.get(tf, k), 1) for k in ("ema9", "ema20", "ema50", "ema200")},
                "vwap": _r(snap.get(tf, "vwap"), 1),
                "atr": _r(snap.get(tf, "atr14"), 1),
                "bb": {k: _r(snap.get(tf, k), 1) for k in ("bb_upper", "bb_mid", "bb_lower")},
                "support": _r(snap.get(tf, "support"), 1),
                "resistance": _r(snap.get(tf, "resistance"), 1),
                "volume_profile": {"poc": _r(snap.get(tf, "vp_poc"), 1), "vah": _r(snap.get(tf, "vp_vah"), 1),
                                   "val": _r(snap.get(tf, "vp_val"), 1)},
                "structure": {
                    "high": {1: "HH", -1: "LH"}.get(int(snap.get(tf, "high_label", 0) or 0), "-"),
                    "low": {1: "HL", -1: "LL"}.get(int(snap.get(tf, "low_label", 0) or 0), "-"),
                    "bars_since_bos_bull": _r(snap.get(tf, "bars_since_bos_bull"), 0),
                    "bars_since_bos_bear": _r(snap.get(tf, "bars_since_bos_bear"), 0),
                    "bars_since_choch_bull": _r(snap.get(tf, "bars_since_choch_bull"), 0),
                    "bars_since_choch_bear": _r(snap.get(tf, "bars_since_choch_bear"), 0),
                },
            }
            bias_num += w * (votes / 5.0)
            w_sum += w
        overall = bias_num / w_sum if w_sum else 0.0
        direction = "bullish" if overall > 0.25 else "bearish" if overall < -0.25 else "neutral"
        data = {"overall_bias": round(overall, 3), "direction": direction, "timeframes": per_tf}
        summary = f"bias {direction} ({overall:+.2f}) " + " ".join(
            f"{tf}:{'+' if v['bias'] > 0 else '-' if v['bias'] < 0 else '0'}" for tf, v in per_tf.items())
        return self.record(AgentReport(agent=self.name, timestamp=snap.timestamp, summary=summary, data=data))

    @staticmethod
    def confirms(report: AgentReport, direction: Direction, tfs: tuple[str, ...]) -> tuple[bool, list[str]]:
        """A scenario is confirmed if no listed timeframe opposes it and at
        least one agrees with 3+ factor groups."""
        reasons, agree = [], 0
        for tf in tfs:
            t = report.data["timeframes"].get(tf)
            if not t:
                reasons.append(f"{tf}: no data")
                return False, reasons
            if t["bias"] == -direction.sign:
                reasons.append(f"{tf} technical bias opposes {direction.value}")
                return False, reasons
            if t["bias"] == direction.sign:
                agree += 1
        if agree == 0:
            reasons.append(f"no timeframe in {tfs} confirms {direction.value} with >=3 factor groups")
            return False, reasons
        reasons.append(f"technical confirmation on {agree}/{len(tfs)} timeframes")
        return True, reasons


def _r(v, nd=2):
    return round(float(v), nd) if finite(v) else None
