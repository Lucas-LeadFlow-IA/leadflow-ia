"""Strategy registry and the regime -> strategy playbook."""
from __future__ import annotations

from core.models import Direction, Regime, StrategyName
from strategies.base import Strategy
from strategies.intraday import IntradayStrategy
from strategies.range_trading import RangeTradingStrategy
from strategies.scalping import ScalpingStrategy
from strategies.trend_following import TrendFollowingStrategy

ALL = (Direction.LONG, Direction.SHORT)

# regime -> (eligible strategies in priority order, allowed directions, extra score required)
PLAYBOOK: dict[Regime, tuple[list[StrategyName], tuple[Direction, ...], float]] = {
    Regime.STRONG_BULL: ([StrategyName.TREND_FOLLOWING, StrategyName.INTRADAY, StrategyName.SCALPING], (Direction.LONG,), 0.0),
    Regime.STRONG_BEAR: ([StrategyName.TREND_FOLLOWING, StrategyName.INTRADAY, StrategyName.SCALPING], (Direction.SHORT,), 0.0),
    Regime.SIDEWAYS: ([StrategyName.RANGE_TRADING, StrategyName.SCALPING], ALL, 0.0),
    Regime.HIGH_VOL: ([StrategyName.INTRADAY, StrategyName.TREND_FOLLOWING], ALL, 10.0),
    Regime.LOW_VOL: ([StrategyName.RANGE_TRADING], ALL, 5.0),
    Regime.UNSTABLE: ([], (), 0.0),
    Regime.NEWS_DRIVEN: ([], (), 0.0),
    Regime.UNKNOWN: ([], (), 0.0),
}


def build_strategies() -> dict[StrategyName, Strategy]:
    return {
        StrategyName.SCALPING: ScalpingStrategy(),
        StrategyName.INTRADAY: IntradayStrategy(),
        StrategyName.TREND_FOLLOWING: TrendFollowingStrategy(),
        StrategyName.RANGE_TRADING: RangeTradingStrategy(),
    }
