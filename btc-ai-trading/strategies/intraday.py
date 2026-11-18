"""INTRADAY — M15 entries, M30 + H1 trend confirmation.

Entry: H1 bias (price vs EMA50, EMA50 slope, structure not opposed),
M30 trend strength, then an M15 pullback into a value zone (EMA20, FVG,
order block or liquidity sweep) followed by a confirmation candle /
structure break. Stop beyond the pullback (1–2.5 ATR15). Target 2R unless
H1/M15 resistance blocks the path. Dynamic stop: breakeven at +1R, ATR
trail after +1.5R.
"""
from __future__ import annotations

from agents.technical_analyst import TechnicalAnalyst
from core.models import Direction, StrategyName, TradeSetup
from core.snapshot import finite
from strategies.base import Strategy, StrategyContext


class IntradayStrategy(Strategy):
    name = StrategyName.INTRADAY
    entry_tf, confirm_tf, context_tf = "15m", "30m", "1h"
    max_hold_minutes = 8 * 60
    min_stop_atr, max_stop_atr = 1.0, 2.5
    target_r = 2.0
    breakeven_r, trail_start_r, trail_atr = 1.0, 1.5, 1.5

    def evaluate(self, ctx: StrategyContext) -> TradeSetup | None:
        best = None
        for d in ctx.allowed_directions:
            s = self._evaluate(ctx, d)
            if s is not None and (best is None or s.score > best.score):
                best = s
        return best

    def _evaluate(self, ctx: StrategyContext, d: Direction) -> TradeSetup | None:
        snap, s, tag = ctx.snap, d.sign, f"intraday {d.value}"
        if not snap.has("15m", "30m", "1h"):
            ctx.notes.append(f"{tag}: missing 15m/30m/1h data")
            return None
        m15 = lambda c: snap.get("15m", c)  # noqa: E731
        m30 = lambda c: snap.get("30m", c)  # noqa: E731
        h1 = lambda c: snap.get("1h", c)  # noqa: E731
        if not finite(h1("ema50"), h1("ema50_slope"), m30("adx"), m30("ema20"), m30("ema50"), m15("atr14"), m15("ema20")):
            ctx.notes.append(f"{tag}: indicators warming up")
            return None
        if not (s * (h1("close") - h1("ema50")) > 0 and s * h1("ema50_slope") > 0 and h1("structure_trend") != -s):
            ctx.notes.append(f"{tag}: H1 bias not supportive")
            return None
        if not (m30("adx") >= 18 and s * (m30("ema20") - m30("ema50")) > 0):
            ctx.notes.append(f"{tag}: M30 trend too weak or opposed (ADX {m30('adx'):.0f})")
            return None
        atr, close = m15("atr14"), m15("close")
        bull = s > 0
        ema_zone = (min(m15("low"), snap.prev("15m", "low")) <= m15("ema20") + 0.2 * atr and close > m15("ema50")) if bull \
            else (max(m15("high"), snap.prev("15m", "high")) >= m15("ema20") - 0.2 * atr and close < m15("ema50"))
        smc_zone = (m15("in_fvg_bull") == 1 or m15("in_ob_bull") == 1) if bull else (m15("in_fvg_bear") == 1 or m15("in_ob_bear") == 1)
        sweep = (m15("bars_since_sweep_bull") <= 3) if bull else (m15("bars_since_sweep_bear") <= 3)
        if not (ema_zone or smc_zone or sweep):
            ctx.notes.append(f"{tag}: price not in a M15 value zone (EMA20/FVG/OB/sweep)")
            return None
        candle_conf = (close > m15("open") and close > snap.prev("15m", "high")) if bull else \
            (close < m15("open") and close < snap.prev("15m", "low"))
        struct_conf = (m15("bars_since_bos_bull") <= 2 or m15("bars_since_choch_bull") <= 2) if bull else \
            (m15("bars_since_bos_bear") <= 2 or m15("bars_since_choch_bear") <= 2)
        if not (candle_conf or struct_conf):
            ctx.notes.append(f"{tag}: no M15 confirmation candle / structure break")
            return None
        rsi = m15("rsi14")
        if not finite(rsi) or not ((40 <= rsi <= 68) if bull else (32 <= rsi <= 60)):
            ctx.notes.append(f"{tag}: M15 RSI {rsi:.0f} outside entry band")
            return None
        ok, treasons = TechnicalAnalyst.confirms(ctx.technical, d, ("15m", "1h"))
        if not ok:
            ctx.notes.append(f"{tag}: " + "; ".join(treasons))
            return None

        entry = snap.price
        lows = [m15("low"), snap.prev("15m", "low")] if bull else [m15("high"), snap.prev("15m", "high")]
        extreme = min(lows) if bull else max(lows)
        swing = m15("swing_low_last") if bull else m15("swing_high_last")
        if finite(swing) and abs(entry - swing) <= 2.5 * atr and s * (entry - swing) > 0:
            extreme = min(extreme, swing) if bull else max(extreme, swing)
        raw_stop = extreme - s * 0.3 * atr
        dist = min(max(abs(entry - raw_stop), self.min_stop_atr * atr), self.max_stop_atr * atr)
        target = entry + s * self.target_r * dist
        # obstacle check: H1 / M15 resistance (support for shorts) too close
        obstacle = None
        for tf in ("1h", "15m"):
            lvl = snap.get(tf, "resistance" if bull else "support")
            if finite(lvl) and 0 < s * (lvl - entry) < 1.5 * dist:
                obstacle = (tf, lvl)
                break
        if obstacle:
            ctx.notes.append(f"{tag}: {obstacle[0]} {'resistance' if bull else 'support'} at {obstacle[1]:,.0f} within 1.5R")
            return None
        liq_bias = float(ctx.liquidity.data.get("liquidity_bias", 0.0))
        comps = {
            "h1_bias": 20.0 if h1("structure_trend") == s else 14.0,
            "m30_strength": min(15.0, m30("adx") * 0.5),
            "value_zone": 20.0 if (smc_zone or sweep) else 12.0,
            "confirmation": 15.0 if (candle_conf and struct_conf) else 10.0,
            "momentum": 10.0 if s * m15("macd_hist") > 0 else 3.0,
            "liquidity": 10.0 * max(0.0, s * liq_bias),
            "room_to_target": 10.0,
        }
        reasons = [
            f"H1 {'above' if bull else 'below'} rising EMA50, structure {'HH/HL' if h1('structure_trend') == s else 'neutral'}",
            f"M30 ADX {m30('adx'):.0f} with EMA20/50 aligned",
            "M15 value zone: " + ", ".join(n for n, v in (("EMA20", ema_zone), ("FVG/OB", smc_zone), ("sweep", sweep)) if v),
            "M15 confirmation: " + ", ".join(n for n, v in (("candle", candle_conf), ("structure break", struct_conf)) if v),
            *treasons,
        ]
        invalidations = [
            f"M15 close beyond stop {raw_stop:,.0f}",
            f"{'bearish' if bull else 'bullish'} CHOCH on M15",
            f"H1 close {'below' if bull else 'above'} EMA50",
        ]
        return self.build_setup(ctx, d, entry, raw_stop, comps, reasons, invalidations, target=target)
