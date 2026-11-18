"""Trading cost model shared by the Risk Manager (live sizing) and the
backtester, so a trade is judged with the same costs everywhere.

Defaults follow the Hyperliquid perps base tier (taker 0.045%, maker
0.015%, see https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees).
Funding is paid hourly: payment = position_size * oracle_price * rate
(longs pay shorts when the rate is positive).
"""
from __future__ import annotations

from dataclasses import dataclass

from core.models import Direction, EntryType


@dataclass(frozen=True)
class CostModel:
    taker_fee: float = 0.00045
    maker_fee: float = 0.00015
    slippage_bps_market: float = 2.0    # per side, aggressive orders (incl. half spread)
    slippage_bps_stop: float = 5.0      # stop-market exits slip more
    default_hourly_funding: float = 0.0000125  # interest component (0.01% / 8h)

    @classmethod
    def from_settings(cls, s) -> CostModel:
        return cls(taker_fee=s.taker_fee_rate, maker_fee=s.maker_fee_rate,
                   slippage_bps_market=s.slippage_bps_market, slippage_bps_stop=s.slippage_bps_stop)

    def entry_rate(self, entry_type: EntryType) -> float:
        """Cost of entering, as a fraction of notional (fee + slippage)."""
        if entry_type == EntryType.LIMIT:
            return self.maker_fee
        return self.taker_fee + self.slippage_bps_market / 1e4

    def exit_rate(self, kind: str) -> float:
        """kind: 'stop' (stop-market), 'market', 'tp_limit' (resting maker), 'tp_market'."""
        if kind == "stop":
            return self.taker_fee + self.slippage_bps_stop / 1e4
        if kind == "tp_limit":
            return self.maker_fee
        return self.taker_fee + self.slippage_bps_market / 1e4

    def round_trip_rate(self, entry_type: EntryType, exit_kind: str = "stop") -> float:
        return self.entry_rate(entry_type) + self.exit_rate(exit_kind)

    def funding_cost(self, notional: float, direction: Direction, hours: float, hourly_rate: float | None = None) -> float:
        """Expected funding PAID (positive = cost) over `hours`."""
        rate = self.default_hourly_funding if hourly_rate is None else hourly_rate
        return direction.sign * rate * notional * hours

    def loss_at_stop(self, size: float, entry: float, stop: float, entry_type: EntryType) -> float:
        """Total loss in USD if the stop is hit, including fees and slippage."""
        notional_in = size * entry
        notional_out = size * stop
        return size * abs(entry - stop) + notional_in * self.entry_rate(entry_type) + notional_out * self.exit_rate("stop")
