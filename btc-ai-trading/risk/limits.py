"""Risk limits.

`HARD_CEILINGS` are coded constants: no environment variable, dashboard
action, Telegram command or AI agent can push a configured limit above
them. Raising one requires a code change, a review and new tests.

`RiskLimits` holds the active (configured) values, always validated
against the ceilings.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class _HardCeilings:
    max_risk_per_trade_pct: float = 0.5     # % of equity
    max_daily_loss_pct: float = 2.0         # % of start-of-day equity
    max_drawdown_pct: float = 10.0          # % from equity peak
    max_leverage: int = 1                   # initial phase: 1x only
    max_open_positions: int = 1             # one position at a time, always
    min_reward_risk_after_costs: float = 1.0


HARD_CEILINGS = _HardCeilings()


class RiskLimitError(ValueError):
    """Raised when a configuration tries to exceed a hard ceiling."""


@dataclass(frozen=True)
class RiskLimits:
    risk_per_trade_pct: float = 0.25
    max_daily_loss_pct: float = 1.0
    max_drawdown_pct: float = 8.0
    max_leverage: int = 1
    max_open_positions: int = 1
    margin_mode: str = "isolated"
    max_consecutive_losses: int = 3
    cooldown_minutes_after_losses: int = 120
    min_reward_risk: float = 1.2           # after costs
    min_stop_distance_cost_multiple: float = 3.0  # stop distance >= k * round-trip cost
    max_spread_bps: float = 5.0
    max_funding_rate_hourly_against: float = 0.0005  # 0.05%/h adverse funding -> refuse
    leverage_safety_buffer: float = 0.95    # use at most 95% of equity*leverage as notional

    def __post_init__(self) -> None:
        c = HARD_CEILINGS
        checks = [
            (0 < self.risk_per_trade_pct <= c.max_risk_per_trade_pct, "risk_per_trade_pct", c.max_risk_per_trade_pct),
            (0 < self.max_daily_loss_pct <= c.max_daily_loss_pct, "max_daily_loss_pct", c.max_daily_loss_pct),
            (0 < self.max_drawdown_pct <= c.max_drawdown_pct, "max_drawdown_pct", c.max_drawdown_pct),
            (1 <= self.max_leverage <= c.max_leverage, "max_leverage", c.max_leverage),
            (self.max_open_positions == c.max_open_positions, "max_open_positions", c.max_open_positions),
            (self.min_reward_risk >= c.min_reward_risk_after_costs, "min_reward_risk", c.min_reward_risk_after_costs),
        ]
        for ok, name, ceiling in checks:
            if not ok:
                raise RiskLimitError(
                    f"{name}={getattr(self, name)} violates hard ceiling {ceiling} (see risk/limits.py)"
                )
        if self.margin_mode not in ("isolated", "cross"):
            raise RiskLimitError("margin_mode must be 'isolated' or 'cross'")
        if self.max_consecutive_losses < 1:
            raise RiskLimitError("max_consecutive_losses must be >= 1")
