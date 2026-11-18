"""Position sizing from risk budget, stop distance, costs and leverage cap.

size = risk_budget / (|entry - stop| + entry*entry_cost_rate + stop*stop_exit_cost_rate)

then capped so that notional <= equity * leverage * buffer, floored to the
exchange lot size (szDecimals) and checked against the $10 minimum order
value documented by Hyperliquid. Flooring guarantees the realised risk is
never above the budget.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from backtesting.costs import CostModel
from core.models import EntryType

MIN_ORDER_NOTIONAL_USD = 10.0  # Hyperliquid: "Order must have minimum value of $10."


@dataclass
class SizingResult:
    ok: bool
    size: float = 0.0
    notional: float = 0.0
    risk_usd: float = 0.0          # loss at stop incl. fees & slippage
    est_cost_usd: float = 0.0      # entry + stop-exit costs
    leverage: float = 0.0
    capped_by_leverage: bool = False
    reason: str = ""


def floor_to(x: float, decimals: int) -> float:
    q = 10 ** decimals
    return math.floor(x * q + 1e-9) / q


def compute_size(equity: float, entry: float, stop: float, risk_budget_usd: float, costs: CostModel,
                 entry_type: EntryType, max_leverage: float, sz_decimals: int,
                 notional_buffer: float = 0.95) -> SizingResult:
    if equity <= 0 or entry <= 0 or stop <= 0:
        return SizingResult(False, reason="invalid equity/price")
    if risk_budget_usd <= 0:
        return SizingResult(False, reason="no risk budget left")
    per_unit = abs(entry - stop) + entry * costs.entry_rate(entry_type) + stop * costs.exit_rate("stop")
    if per_unit <= 0 or abs(entry - stop) <= 0:
        return SizingResult(False, reason="zero stop distance")
    size = risk_budget_usd / per_unit
    cap = equity * max_leverage * notional_buffer / entry
    capped = size > cap
    size = floor_to(min(size, cap), sz_decimals)
    notional = size * entry
    if size <= 0 or notional < MIN_ORDER_NOTIONAL_USD:
        return SizingResult(False, size=size, notional=notional,
                            reason=f"position notional ${notional:.2f} below exchange minimum ${MIN_ORDER_NOTIONAL_USD:.0f}")
    risk = costs.loss_at_stop(size, entry, stop, entry_type)
    est_cost = notional * costs.entry_rate(entry_type) + size * stop * costs.exit_rate("stop")
    return SizingResult(True, size=size, notional=notional, risk_usd=risk, est_cost_usd=est_cost,
                        leverage=notional / equity, capped_by_leverage=capped)
