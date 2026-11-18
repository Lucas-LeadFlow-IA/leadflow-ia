"""TREND FOLLOWING — H1 entries in the direction of the H4 trend.

Entry: H4 trend (EMA50 vs EMA200, price vs EMA50, ADX) + H1 alignment,
then a pullback into the H1 EMA20 zone that is reclaimed, or an H1
break of structure. Stop beyond the last H1 swing (1.5–3.5 ATR).
Exit: volatility-adapted chandelier trail (3 ATR) after +2R, breakeven at
+1.5R, safety take-profit at 4R, H4 trend failure invalidates.
"""
from __future__ import annotations

from agents.technical_analyst import TechnicalAnalyst
from core.models import Direction, ManagedPosition, StrategyName, TradeSetup
from core.snapshot import MarketSnapshot, finite
from strategies.base import Strategy, StrategyContext


class TrendFollowingStrategy(Strategy):
    name = StrategyName.TREND_FOLLOWING
    entry_tf, confirm_tf, context_tf = "1h", "1h", "4h"
    max_hold_minutes = 7 * 24 * 60
    min_stop_atr, max_stop_atr = 1.5, 3.5
    target_r = 4.0
    breakeven_r, trail_start_r, trail_atr = 1.5, 2.0, 3.0

    def evaluate(self, ctx: StrategyContext) -> TradeSetup | None:
        best = None
        for d in ctx.allowed_directions:
            s = self._evaluate(ctx, d)
            if s is not None and (best is None or s.score > best.score):
                best = s
        return best

    def _evaluate(self, ctx: StrategyContext, d: Direction) -> TradeSetup | None:
        snap, s, tag = ctx.snap, d.sign, f"trend_following {d.value}"
        if not snap.has("1h", "4h"):
            ctx.notes.append(f"{tag}: missing 1h/4h data")
            return None
        h1 = lambda c: snap.get("1h", c)  # noqa: E731
        h4 = lambda c: snap.get("4h", c)  # noqa: E731
        if not finite(h4("ema50"), h4("ema200"), h4("close"), h4("adx"), h1("ema20"), h1("ema50"), h1("atr14")):
            ctx.notes.append(f"{tag}: indicators warming up")
            return None
        if not (s * (h4("ema50") - h4("ema200")) > 0 and s * (h4("close") - h4("ema50")) > 0 and h4("adx") >= 18):
            ctx.notes.append(f"{tag}: H4 trend not aligned (EMA50/EMA200/ADX)")
            return None
        if not (s * (h1("ema20") - h1("ema50")) > 0 and s * (h1("close") - h1("ema50")) > 0):
            ctx.notes.append(f"{tag}: H1 not aligned with H4 trend")
            return None
        atr, close, ema20 = h1("atr14"), h1("close"), h1("ema20")
        if d == Direction.LONG:
            touched = min(h1("low"), snap.prev("1h", "low")) <= ema20 + 0.3 * atr
            reclaimed = close > ema20 and close > h1("open")
            breakout = h1("bos_bull") == 1
        else:
            touched = max(h1("high"), snap.prev("1h", "high")) >= ema20 - 0.3 * atr
            reclaimed = close < ema20 and close < h1("open")
            breakout = h1("bos_bear") == 1
        pullback = touched and reclaimed
        if not (pullback or breakout):
            ctx.notes.append(f"{tag}: no pullback-reclaim of H1 EMA20 nor H1 break of structure")
            return None
        rsi = h1("rsi14")
        if not finite(rsi) or not ((45 <= rsi <= 72) if s > 0 else (28 <= rsi <= 55)):
            ctx.notes.append(f"{tag}: H1 RSI {rsi:.0f} outside entry band")
            return None
        ok, treasons = TechnicalAnalyst.confirms(ctx.technical, d, ("1h", "4h"))
        if not ok:
            ctx.notes.append(f"{tag}: " + "; ".join(treasons))
            return None

        liq_tf = ctx.liquidity.data.get("timeframes", {})
        liq_hit = any(
            (v.get("in_fvg_bull") or v.get("in_ob_bull") or (v.get("sweep_bull_bars_ago") or 99) <= 5) if s > 0 else
            (v.get("in_fvg_bear") or v.get("in_ob_bear") or (v.get("sweep_bear_bars_ago") or 99) <= 5)
            for k, v in liq_tf.items() if k in ("15m", "1h"))
        comps = {
            "h4_trend_strength": min(20.0, h4("adx") * 0.6),
            "h1_alignment": 20.0 if h1("ema_stack") == s else 12.0,
            "entry_quality": 15.0 if pullback else 10.0,
            "momentum": 15.0 if (s * h1("macd_hist") > 0 and s * (rsi - 50) > 0) else 5.0,
            "structure": 15.0 if h1("structure_trend") == s else (8.0 if h1("struct_bias") == s else 0.0),
            "liquidity_confluence": 10.0 if liq_hit else 0.0,
            "volume": 5.0 if finite(h1("vol_z")) and h1("vol_z") > 0.5 else 0.0,
        }
        swing = h1("swing_low_last") if s > 0 else h1("swing_high_last")
        entry = snap.price
        raw_stop = (swing - s * 0.5 * atr) if finite(swing) and s * (entry - swing) > 0 else entry - s * 2.0 * atr
        reasons = [
            f"H4 trend {'up' if s > 0 else 'down'}: EMA50 {'>' if s > 0 else '<'} EMA200, ADX {h4('adx'):.0f}",
            "H1 " + ("pullback to EMA20 reclaimed" if pullback else "break of structure"),
            f"H1 RSI {rsi:.0f}, MACD hist {h1('macd_hist'):+.1f}",
            *treasons,
        ]
        if liq_hit:
            reasons.append("liquidity confluence (FVG / order block / sweep) on 15m-1h")
        invalidations = [
            f"H1 close {'below' if s > 0 else 'above'} EMA50 ({h1('ema50'):,.0f})",
            f"{'bearish' if s > 0 else 'bullish'} CHOCH on H1",
            f"H4 close {'below' if s > 0 else 'above'} EMA50 ({h4('ema50'):,.0f})",
        ]
        return self.build_setup(ctx, d, entry, raw_stop, comps, reasons, invalidations)

    def invalidated(self, pos: ManagedPosition, snap: MarketSnapshot) -> str | None:
        base = super().invalidated(pos, snap)
        if base:
            return base
        s = pos.direction.sign
        c4, e4 = snap.get("4h", "close"), snap.get("4h", "ema50")
        if finite(c4, e4) and s * (c4 - e4) < 0:
            return "invalidation: H4 close crossed EMA50 against the position"
        return None
