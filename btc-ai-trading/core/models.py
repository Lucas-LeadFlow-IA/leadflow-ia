"""Shared domain models used by every agent.

All models are Pydantic v2 so they serialize cleanly to the API, the
database (JSON columns) and Telegram messages.
"""
from __future__ import annotations

import time
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


def now_ms() -> int:
    """Current UNIX time in milliseconds."""
    return int(time.time() * 1000)


class TradingMode(str, Enum):
    PAPER = "paper"
    TESTNET = "testnet"
    LIVE = "live"


class Direction(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NO_TRADE = "NO_TRADE"

    @property
    def sign(self) -> int:
        return {"LONG": 1, "SHORT": -1}.get(self.value, 0)


class Regime(str, Enum):
    STRONG_BULL = "strong_bullish_trend"
    STRONG_BEAR = "strong_bearish_trend"
    SIDEWAYS = "sideways"
    HIGH_VOL = "high_volatility"
    LOW_VOL = "low_volatility"
    UNSTABLE = "unstable"
    NEWS_DRIVEN = "news_driven"
    UNKNOWN = "unknown"


class StrategyName(str, Enum):
    SCALPING = "scalping"
    INTRADAY = "intraday"
    TREND_FOLLOWING = "trend_following"
    RANGE_TRADING = "range_trading"
    NONE = "none"


class EntryType(str, Enum):
    MARKET = "market"  # aggressive IOC limit with slippage cap
    LIMIT = "limit"    # passive post-only (ALO)


# ---------------------------------------------------------------------------
# Agent outputs
# ---------------------------------------------------------------------------
class AgentReport(BaseModel):
    """Base class for every agent output."""

    agent: str
    timestamp: int = Field(default_factory=now_ms)
    summary: str = ""
    data: dict[str, Any] = Field(default_factory=dict)


class TradeSetup(BaseModel):
    """A candidate trade proposed by a strategy (before risk sizing)."""

    strategy: StrategyName
    direction: Direction
    entry_type: EntryType = EntryType.MARKET
    entry_price: float
    stop_loss: float
    take_profit: float | None = None
    tp_as_limit: bool = False    # True: TP rests as reduce-only limit (maker); False: trigger-market TP
    timeframe: str
    score: float = Field(ge=0, le=100, description="Deterministic confluence score (not a probability)")
    score_components: dict[str, float] = Field(default_factory=dict)
    reasons: list[str] = Field(default_factory=list)
    invalidations: list[str] = Field(default_factory=list)
    max_hold_minutes: int = 240
    features: dict[str, float] = Field(default_factory=dict, description="Snapshot features at decision time (for ML)")

    @property
    def stop_distance(self) -> float:
        return abs(self.entry_price - self.stop_loss)

    @property
    def reward_risk(self) -> float | None:
        if self.take_profit is None or self.stop_distance <= 0:
            return None
        return abs(self.take_profit - self.entry_price) / self.stop_distance


class Confidence(BaseModel):
    """Confidence attached to a signal.

    `raw_score` is a deterministic 0-100 confluence score. `probability`
    is ONLY set when a calibrator fitted on out-of-sample historical
    outcomes is available; otherwise `calibrated` is False and the UI must
    not present the score as a probability.
    """

    raw_score: float
    probability: float | None = None
    calibrated: bool = False
    calibration_samples: int = 0
    method: str = "uncalibrated"


class RiskVerdict(BaseModel):
    approved: bool
    reasons: list[str] = Field(default_factory=list)
    size: float = 0.0               # BTC
    notional_usd: float = 0.0
    risk_usd: float = 0.0           # loss at stop incl. costs
    est_cost_usd: float = 0.0       # fees + slippage (+ expected funding)
    leverage: float = 0.0
    checks: dict[str, bool] = Field(default_factory=dict)


class TradeSignal(BaseModel):
    """Final decision record produced every cycle (including NO TRADE)."""

    timestamp: int = Field(default_factory=now_ms)
    direction: Direction = Direction.NO_TRADE
    strategy: StrategyName = StrategyName.NONE
    regime: Regime = Regime.UNKNOWN
    entry_price: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    size: float = 0.0
    risk_usd: float = 0.0
    est_cost_usd: float = 0.0
    confidence: Confidence | None = None
    reasons: list[str] = Field(default_factory=list)
    invalidations: list[str] = Field(default_factory=list)
    strategy_rationale: str = ""
    risk: RiskVerdict | None = None
    setup: TradeSetup | None = None

    @property
    def actionable(self) -> bool:
        return self.direction != Direction.NO_TRADE and self.risk is not None and self.risk.approved


# ---------------------------------------------------------------------------
# Account / execution
# ---------------------------------------------------------------------------
class OrderKind(str, Enum):
    ENTRY = "entry"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    EXIT = "exit"


class OrderState(str, Enum):
    PENDING = "pending"        # sent, no confirmation yet
    RESTING = "resting"        # confirmed on book (or trigger armed)
    FILLED = "filled"
    PARTIAL = "partially_filled"
    CANCELED = "canceled"
    REJECTED = "rejected"
    TRIGGERED = "triggered"
    UNKNOWN = "unknown"


class OrderRequest(BaseModel):
    coin: str = "BTC"
    is_buy: bool
    size: float
    limit_price: float
    kind: OrderKind
    reduce_only: bool = False
    tif: str = "Ioc"                     # Ioc | Gtc | Alo (for limit orders)
    trigger_price: float | None = None   # set -> trigger (TP/SL) order
    tpsl: str | None = None              # "tp" | "sl"
    cloid: str | None = None


class OrderAck(BaseModel):
    """Immediate exchange response. NOT a proof of execution."""

    ok: bool
    state: OrderState
    oid: int | None = None
    cloid: str | None = None
    filled_size: float = 0.0
    avg_price: float | None = None
    error: str | None = None
    raw: Any = None


class OrderStatusInfo(BaseModel):
    oid: int | None = None
    cloid: str | None = None
    state: OrderState
    orig_size: float = 0.0
    remaining_size: float = 0.0
    is_trigger: bool = False
    raw: Any = None


class OpenOrder(BaseModel):
    oid: int
    cloid: str | None = None
    coin: str
    is_buy: bool
    size: float
    limit_price: float
    reduce_only: bool = False
    is_trigger: bool = False
    trigger_price: float | None = None
    order_type: str = ""


class Position(BaseModel):
    coin: str = "BTC"
    size: float  # signed: >0 long, <0 short
    entry_price: float
    unrealized_pnl: float = 0.0
    leverage: float = 1.0
    margin_mode: str = "isolated"
    liquidation_price: float | None = None
    margin_used: float = 0.0
    cum_funding: float = 0.0

    @property
    def side(self) -> Direction:
        if self.size > 0:
            return Direction.LONG
        if self.size < 0:
            return Direction.SHORT
        return Direction.NO_TRADE


class Fill(BaseModel):
    coin: str
    price: float
    size: float
    is_buy: bool
    time: int
    fee: float
    oid: int | None = None
    closed_pnl: float = 0.0
    direction: str = ""
    crossed: bool = True  # True = taker


class AccountState(BaseModel):
    timestamp: int = Field(default_factory=now_ms)
    equity: float              # account value incl. unrealized PnL
    balance: float             # equity - unrealized
    withdrawable: float = 0.0
    positions: list[Position] = Field(default_factory=list)
    open_orders: list[OpenOrder] = Field(default_factory=list)

    def position(self, coin: str = "BTC") -> Position | None:
        for p in self.positions:
            if p.coin == coin and abs(p.size) > 0:
                return p
        return None

    @property
    def unrealized_pnl(self) -> float:
        return sum(p.unrealized_pnl for p in self.positions)


class ManagedPosition(BaseModel):
    """Local view of the position the system opened and protects."""

    coin: str = "BTC"
    direction: Direction
    size: float
    entry_price: float
    stop_loss: float
    initial_stop: float
    take_profit: float | None = None
    strategy: StrategyName
    regime: Regime
    opened_at: int = Field(default_factory=now_ms)
    risk_usd: float = 0.0
    sl_oid: int | None = None
    sl_cloid: str | None = None
    tp_oid: int | None = None
    tp_cloid: str | None = None
    entry_fee: float = 0.0
    score: float = 0.0
    confidence: float | None = None
    max_hold_minutes: int = 240
    reasons: list[str] = Field(default_factory=list)
    best_price: float | None = None   # for trailing logic
    signal_id: int | None = None


class TradeRecord(BaseModel):
    """Closed trade, used by the Performance Analyst and the backtester."""

    mode: str
    strategy: StrategyName
    regime: Regime
    direction: Direction
    entry_time: int
    exit_time: int
    entry_price: float
    exit_price: float
    size: float
    initial_stop: float
    take_profit: float | None = None
    risk_usd: float
    gross_pnl: float
    fees: float
    funding: float
    slippage_cost: float = 0.0
    net_pnl: float
    exit_reason: str
    score: float = 0.0
    confidence: float | None = None
    r_multiple: float = 0.0
    reasons: list[str] = Field(default_factory=list)
    features: dict[str, float] = Field(default_factory=dict)
