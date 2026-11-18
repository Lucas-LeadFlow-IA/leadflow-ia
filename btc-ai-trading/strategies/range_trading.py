"""RANGE TRADING — fade the edges of an established H1 range.

Conditions: H1 ADX < 22, flat EMA50, low efficiency ratio; range defined
by the 48-bar H1 Donchian channel, width 0.8%–6%. Entry near an edge
(bottom/top 25%) after an M15 liquidity sweep, a failed breakout or an
exhausted RSI turning. Stop beyond the range edge (+0.5 ATR H1). Target:
range midpoint (minimum 1.2R after costs). Passive limit entry, resting
reduce-only take-profit. Invalidation: trend emerging (H1 ADX > 28 against).
"""
from __future__ import annotations

from core.models import Direction, EntryType, ManagedPosition, StrategyName, TradeSetup
from core.snapshot import MarketSnapshot, finite
from strategies.base import Strategy, StrategyContext


class RangeTradingStrategy(Strategy):
    name = StrategyName.RANGE_TRADING
    entry_tf, confirm_tf, context_tf = "15m", "15m", "1h"
    entry_type = EntryType.LIMIT
    tp_as_limit = True
    max_hold_minutes = 12 * 60
    min_stop_atr, max_stop_atr = 1.0, 6.0   # in M15 ATR; real bound comes from the range edge
    breakeven_r, trail_start_r = 0.8, None

    def evaluate(self, ctx: StrategyContext) -> TradeSetup | None:
        best = None
        for d in ctx.allowed_directions:
            s = self._evaluate(ctx, d)
            if s is not None and (best is None or s.score > best.score):
                best = s
        return best

    def _evaluate(self, ctx: StrategyContext, d: Direction) -> TradeSetup | None:
        snap, s, tag = ctx.snap, d.sign, f"range {d.value}"
        if not snap.has("15m", "1h"):
            ctx.notes.append(f"{tag}: missing 15m/1h data")
            return None
        h1 = lambda c: snap.get("1h", c)  # noqa: E731
        m15 = lambda c: snap.get("15m", c)  # noqa: E731
        if not finite(h1("adx"), h1("ema50_slope"), h1("er20"), h1("dc_high_48"), h1("dc_low_48"), h1("atr14")):
            ctx.notes.append(f"{tag}: indicators warming up")
            return None
        if not (h1("adx") < 22 and abs(h1("ema50_slope")) < 0.15 and h1("er20") < 0.35):
            ctx.notes.append(f"{tag}: H1 not ranging (ADX {h1('adx'):.0f}, ER {h1('er20'):.2f})")
            return None
        hi, lo = h1("dc_high_48"), h1("dc_low_48")
        mid = (hi + lo) / 2.0
        width = (hi - lo) / mid
        if not (0.008 <= width <= 0.06):
            ctx.notes.append(f"{tag}: range width {width * 100:.2f}% outside 0.8–6%")
            return None
        entry = snap.price
        pos = (entry - lo) / (hi - lo)
        bull = s > 0
        if (bull and pos > 0.25) or (not bull and pos < 0.75):
            ctx.notes.append(f"{tag}: price at {pos * 100:.0f}% of range, not at the edge")
            return None
        sweep = (m15("bars_since_sweep_bull") <= 3) if bull else (m15("bars_since_sweep_bear") <= 3)
        failed_break = (m15("false_break_bull") == 1) if bull else (m15("false_break_bear") == 1)
        rsi = m15("rsi14")
        exhaustion = finite(rsi) and ((rsi < 40 and m15("close") > m15("open")) if bull else (rsi > 60 and m15("close") < m15("open")))
        if not (sweep or failed_break or exhaustion):
            ctx.notes.append(f"{tag}: no rejection signal at range edge")
            return None
        if (bull and h1("bars_since_bos_bear") <= 2) or (not bull and h1("bars_since_bos_bull") <= 2):
            ctx.notes.append(f"{tag}: recent H1 break of structure against the fade")
            return None
        atr_h1 = h1("atr14")
        raw_stop = (lo - 0.5 * atr_h1) if bull else (hi + 0.5 * atr_h1)
        target = mid
        dist = abs(entry - raw_stop)
        if dist <= 0 or abs(target - entry) / dist < 1.2:
            ctx.notes.append(f"{tag}: reward/risk to range midpoint < 1.2")
            return None
        comps = {
            "range_quality": 20.0 if h1("adx") < 18 else 14.0,
            "edge_location": 20.0 * (1 - (pos if bull else 1 - pos) / 0.25),
            "rejection": 20.0 if (sweep or failed_break) else 12.0,
            "exhaustion": 10.0 if exhaustion else 0.0,
            "liquidity": 10.0 * max(0.0, s * float(ctx.liquidity.data.get("liquidity_bias", 0.0))),
            "reward_risk": min(20.0, 10.0 * abs(target - entry) / dist),
        }
        reasons = [
            f"H1 range {lo:,.0f}–{hi:,.0f} ({width * 100:.1f}%), ADX {h1('adx'):.0f}",
            f"price at {pos * 100:.0f}% of range",
            "rejection: " + ", ".join(n for n, v in (("sweep", sweep), ("failed breakout", failed_break),
                                                     ("RSI exhaustion", exhaustion)) if v),
        ]
        invalidations = [f"H1 close {'below' if bull else 'above'} {raw_stop:,.0f}",
                         "H1 ADX > 28 in the opposite direction (trend emerging)"]
        setup = self.build_setup(ctx, d, entry, raw_stop, comps, reasons, invalidations, target=target)
        if setup is not None:
            setup.stop_loss = raw_stop   # the range edge is the real invalidation level
        return setup

    def invalidated(self, pos: ManagedPosition, snap: MarketSnapshot) -> str | None:
        adx, pdi, mdi = snap.get("1h", "adx"), snap.get("1h", "plus_di"), snap.get("1h", "minus_di")
        if finite(adx, pdi, mdi) and adx > 28:
            if (pos.direction == Direction.LONG and mdi > pdi) or (pos.direction == Direction.SHORT and pdi > mdi):
                return "invalidation: trend emerging against the range trade"
        return None
