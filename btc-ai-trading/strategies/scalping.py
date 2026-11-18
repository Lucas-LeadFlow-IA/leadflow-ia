"""SCALPING — M1 triggers inside an M5 / M15 trend.

Context: M15 trend (EMA20/50, ADX), M5 above/below VWAP with EMA9 > EMA20.
Trigger: M1 pullback to EMA20 reclaimed, or an M1 liquidity sweep.
Live microstructure guard: spread <= 1.5 bps and order-book imbalance not
strongly against the trade.

Costs dominate scalping. Entries are passive (post-only limit) and the
take-profit rests as a reduce-only limit (maker fee). The stop is sized
on M5 ATR so that it remains several times larger than round-trip costs;
the Risk Manager refuses any scalp whose stop is not >= 2.5x costs.
"""
from __future__ import annotations

from agents.technical_analyst import TechnicalAnalyst
from core.models import Direction, EntryType, StrategyName, TradeSetup
from core.snapshot import finite
from strategies.base import Strategy, StrategyContext


class ScalpingStrategy(Strategy):
    name = StrategyName.SCALPING
    entry_tf, confirm_tf, context_tf = "1m", "5m", "15m"
    entry_type = EntryType.LIMIT
    tp_as_limit = True
    max_hold_minutes = 45
    min_stop_atr, max_stop_atr = 1.0, 2.0     # in M5 ATR units (see build_setup override)
    target_r = 1.5
    breakeven_r, trail_start_r = 0.8, None
    stop_atr_tf = "5m"

    def evaluate(self, ctx: StrategyContext) -> TradeSetup | None:
        best = None
        for d in ctx.allowed_directions:
            s = self._evaluate(ctx, d)
            if s is not None and (best is None or s.score > best.score):
                best = s
        return best

    def build_setup(self, ctx, direction, entry, raw_stop, components, reasons, invalidations, target=None):
        # Stop distance bounds expressed in M5 ATR (M1 ATR is too small vs costs)
        atr5 = ctx.snap.get("5m", "atr14")
        if not finite(atr5) or atr5 <= 0:
            ctx.notes.append("scalping: M5 ATR unavailable")
            return None
        dist = min(max(abs(entry - raw_stop), self.min_stop_atr * atr5), self.max_stop_atr * atr5)
        stop = entry - direction.sign * dist
        setup = super().build_setup(ctx, direction, entry, stop, components, reasons, invalidations,
                                    target=entry + direction.sign * self.target_r * dist)
        if setup is not None:
            # base class clamps in M1 ATR; re-apply the M5-based stop
            setup.stop_loss = stop
            setup.take_profit = entry + direction.sign * self.target_r * dist
            setup.features["stop_atr"] = dist / atr5
        return setup

    def _evaluate(self, ctx: StrategyContext, d: Direction) -> TradeSetup | None:
        snap, s, tag = ctx.snap, d.sign, f"scalping {d.value}"
        if not snap.has("1m", "5m", "15m"):
            ctx.notes.append(f"{tag}: missing 1m/5m/15m data")
            return None
        m1 = lambda c: snap.get("1m", c)  # noqa: E731
        m5 = lambda c: snap.get("5m", c)  # noqa: E731
        m15 = lambda c: snap.get("15m", c)  # noqa: E731
        if not finite(m15("ema20"), m15("ema50"), m15("adx"), m5("vwap"), m5("ema9"), m5("ema20"), m1("ema20"), m1("atr14")):
            ctx.notes.append(f"{tag}: indicators warming up")
            return None
        if not (s * (m15("ema20") - m15("ema50")) > 0 and s * (m15("close") - m15("ema50")) > 0 and m15("adx") >= 18):
            ctx.notes.append(f"{tag}: M15 trend context missing")
            return None
        if not (s * (m5("close") - m5("vwap")) > 0 and s * (m5("ema9") - m5("ema20")) > 0):
            ctx.notes.append(f"{tag}: M5 not on the right side of VWAP / EMA9-20")
            return None
        bull = s > 0
        atr1 = m1("atr14")
        if bull:
            pull = snap.prev("1m", "low") <= snap.prev("1m", "ema20") + 0.1 * atr1 and m1("close") > m1("ema9") and m1("close") > m1("open")
            sweep = m1("bars_since_sweep_bull") <= 2
        else:
            pull = snap.prev("1m", "high") >= snap.prev("1m", "ema20") - 0.1 * atr1 and m1("close") < m1("ema9") and m1("close") < m1("open")
            sweep = m1("bars_since_sweep_bear") <= 2
        if not (pull or sweep):
            ctx.notes.append(f"{tag}: no M1 trigger (EMA20 reclaim / sweep)")
            return None
        rsi = m1("rsi14")
        if not finite(rsi) or not ((45 <= rsi <= 70) if bull else (30 <= rsi <= 55)):
            ctx.notes.append(f"{tag}: M1 RSI {rsi:.0f} outside band")
            return None
        book = snap.book
        if book is not None:
            if book.spread_bps > 1.5:
                ctx.notes.append(f"{tag}: spread {book.spread_bps:.2f} bps too wide for scalping")
                return None
            if s * book.imbalance_10bps < -0.3:
                ctx.notes.append(f"{tag}: order book imbalance {book.imbalance_10bps:+.2f} against trade")
                return None
        ok, treasons = TechnicalAnalyst.confirms(ctx.technical, d, ("5m", "15m"))
        if not ok:
            ctx.notes.append(f"{tag}: " + "; ".join(treasons))
            return None
        entry = snap.price
        extreme = min(m1("low"), snap.prev("1m", "low")) if bull else max(m1("high"), snap.prev("1m", "high"))
        raw_stop = extreme - s * 0.2 * m5("atr14")
        imb = 0.0 if book is None else s * book.imbalance_10bps
        comps = {
            "m15_context": min(20.0, m15("adx") * 0.7),
            "m5_alignment": 20.0,
            "trigger": 20.0 if (pull and sweep) else 14.0,
            "momentum": 10.0 if s * m1("macd_hist") > 0 else 4.0,
            "order_book": 10.0 * max(0.0, min(1.0, imb + 0.5)) if book is not None else 5.0,
            "spread": 10.0 if book is None or book.spread_bps <= 0.5 else 6.0,
            "volume": 5.0 if finite(m1("vol_z")) and m1("vol_z") > 0 else 0.0,
        }
        reasons = [
            f"M15 trend {'up' if bull else 'down'} (ADX {m15('adx'):.0f})",
            f"M5 {'above' if bull else 'below'} VWAP with EMA9/EMA20 aligned",
            "M1 trigger: " + ", ".join(n for n, v in (("EMA20 reclaim", pull), ("liquidity sweep", sweep)) if v),
            *treasons,
        ]
        if book is not None:
            reasons.append(f"spread {book.spread_bps:.2f} bps, imbalance {book.imbalance_10bps:+.2f}")
        invalidations = ["M1 close beyond stop", f"M5 close {'below' if bull else 'above'} VWAP",
                         f"no progress within {self.max_hold_minutes} min"]
        return self.build_setup(ctx, d, entry, raw_stop, comps, reasons, invalidations)
