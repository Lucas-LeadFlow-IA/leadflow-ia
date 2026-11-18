"""Strategy interface + shared position-management logic.

Every strategy is deterministic: same snapshot -> same setup. A strategy
proposes a `TradeSetup` (or None) and manages an open position through
`manage()`; it never sizes or sends orders (Risk Manager / Execution do).

Stop rule enforced here AND in execution: a stop can only be tightened,
never loosened.
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from backtesting.costs import CostModel
from core.models import AgentReport, Direction, EntryType, ManagedPosition, StrategyName, TradeSetup
from core.snapshot import MarketSnapshot, finite


@dataclass
class PositionAction:
    action: str = "hold"             # hold | update_stop | close
    new_stop: float | None = None
    reason: str = ""


@dataclass
class StrategyContext:
    snap: MarketSnapshot
    technical: AgentReport
    liquidity: AgentReport
    regime: AgentReport
    costs: CostModel
    allowed_directions: tuple[Direction, ...] = (Direction.LONG, Direction.SHORT)
    notes: list[str] = field(default_factory=list)


class Strategy(ABC):
    name: StrategyName
    entry_tf: str
    confirm_tf: str
    context_tf: str
    entry_type: EntryType = EntryType.MARKET
    tp_as_limit: bool = False
    max_hold_minutes: int = 240
    min_stop_atr: float = 1.0
    max_stop_atr: float = 3.0
    target_r: float = 2.0
    breakeven_r: float | None = 1.0
    trail_start_r: float | None = 1.5
    trail_atr: float = 1.5
    use_choch_invalidation: bool = True

    @property
    def timeframes(self) -> tuple[str, str, str]:
        return (self.entry_tf, self.confirm_tf, self.context_tf)

    # ------------------------------------------------------------------ entry
    @abstractmethod
    def evaluate(self, ctx: StrategyContext) -> TradeSetup | None:
        """Return a setup or None. Must append the refusal reason to ctx.notes."""

    def build_setup(self, ctx: StrategyContext, direction: Direction, entry: float, raw_stop: float,
                    components: dict[str, float], reasons: list[str], invalidations: list[str],
                    target: float | None = None) -> TradeSetup | None:
        atr = ctx.snap.get(self.entry_tf, "atr14")
        if not finite(atr, entry, raw_stop) or atr <= 0:
            ctx.notes.append(f"{self.name.value}: ATR/price unavailable")
            return None
        dist = abs(entry - raw_stop)
        dist = min(max(dist, self.min_stop_atr * atr), self.max_stop_atr * atr)
        stop = entry - dist if direction == Direction.LONG else entry + dist
        if target is None:
            target = entry + direction.sign * self.target_r * dist
        score = max(0.0, min(100.0, sum(components.values())))
        feats = _setup_features(ctx.snap, self.entry_tf, self.context_tf)
        feats.update({"stop_atr": dist / atr, "dir": float(direction.sign), "score": score})
        return TradeSetup(
            strategy=self.name, direction=direction, entry_type=self.entry_type, entry_price=entry,
            stop_loss=stop, take_profit=target, tp_as_limit=self.tp_as_limit, timeframe=self.entry_tf, score=score,
            score_components={k: round(v, 2) for k, v in components.items()}, reasons=reasons,
            invalidations=invalidations, max_hold_minutes=self.max_hold_minutes, features=feats,
        )

    # ------------------------------------------------------------------ management
    def manage(self, pos: ManagedPosition, snap: MarketSnapshot) -> PositionAction:
        price = snap.price
        if not finite(price):
            return PositionAction()
        sign = pos.direction.sign
        r_dist = abs(pos.entry_price - pos.initial_stop)
        if r_dist <= 0:
            return PositionAction()
        best = pos.best_price if pos.best_price is not None else pos.entry_price
        best = max(best, price) if sign > 0 else min(best, price)
        pos.best_price = best
        open_r = sign * (price - pos.entry_price) / r_dist
        best_r = sign * (best - pos.entry_price) / r_dist

        # time stop
        held_min = (snap.timestamp - pos.opened_at) / 60_000
        if held_min >= pos.max_hold_minutes:
            return PositionAction("close", reason=f"time stop after {held_min:.0f} min ({open_r:+.2f}R)")

        # strategy-specific invalidation
        inv = self.invalidated(pos, snap)
        if inv:
            return PositionAction("close", reason=inv)

        candidates = []
        if self.breakeven_r is not None and best_r >= self.breakeven_r:
            # breakeven + a small buffer covering round-trip costs
            candidates.append(pos.entry_price + sign * 0.1 * r_dist)
        atr = snap.get(self.entry_tf, "atr14")
        if self.trail_start_r is not None and best_r >= self.trail_start_r and finite(atr):
            candidates.append(best - sign * self.trail_atr * atr)
        if not candidates:
            return PositionAction()
        new_stop = max(candidates) if sign > 0 else min(candidates)
        tighter = new_stop > pos.stop_loss if sign > 0 else new_stop < pos.stop_loss
        # never place a stop through the current price
        valid = new_stop < price if sign > 0 else new_stop > price
        if tighter and valid and abs(new_stop - pos.stop_loss) >= 0.05 * r_dist:
            return PositionAction("update_stop", new_stop=new_stop,
                                  reason=f"trail/breakeven at {best_r:.2f}R best excursion")
        return PositionAction()

    def invalidated(self, pos: ManagedPosition, snap: MarketSnapshot) -> str | None:
        """Default invalidation: change of character against the position on the entry TF."""
        if not self.use_choch_invalidation:
            return None
        tf = self.entry_tf
        if pos.direction == Direction.LONG and snap.get(tf, "choch_bear") == 1:
            return f"invalidation: bearish CHOCH on {tf}"
        if pos.direction == Direction.SHORT and snap.get(tf, "choch_bull") == 1:
            return f"invalidation: bullish CHOCH on {tf}"
        return None


def _setup_features(snap: MarketSnapshot, entry_tf: str, context_tf: str) -> dict[str, float]:
    keys = ("rsi14", "adx", "atr_pct", "atr_pct_rank", "bb_width_rank", "er20", "ema20_slope", "ema50_slope",
            "dist_vwap_atr", "vol_z", "ret_z", "macd_hist", "bb_pctb", "structure_trend", "ema_stack")
    out: dict[str, float] = {}
    for tf, tag in ((entry_tf, "e"), (context_tf, "c")):
        for k in keys:
            v = snap.get(tf, k)
            if finite(v):
                out[f"{tag}_{k}"] = float(v)
    for k in ("1h", "4h"):
        v = snap.get(k, "adx")
        if finite(v):
            out[f"adx_{k}"] = float(v)
    if snap.funding_rate is not None and math.isfinite(snap.funding_rate):
        out["funding"] = float(snap.funding_rate)
    hour = (snap.timestamp // 3_600_000) % 24
    out["hour_sin"], out["hour_cos"] = math.sin(2 * math.pi * hour / 24), math.cos(2 * math.pi * hour / 24)
    return out


def dir_values(direction: Direction, bull, bear):
    return bull if direction == Direction.LONG else bear
