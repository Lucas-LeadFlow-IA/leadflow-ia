"""Event-driven, bar-by-bar backtester.

Uses the SAME agents (technical, liquidity, regime, strategy engine, risk
manager) and the SAME strategy position-management code as live trading.

Bias controls
* Decisions are taken at the close of base bar i; orders execute from the
  open of bar i+1 (no trading on the bar that produced the signal).
* Higher-timeframe rows are only visible once their candle has CLOSED
  (searchsorted on close_time); features are causal (tested).
* Stop and take-profit in the same bar: the stop is assumed first
  (pessimistic). Gaps through a stop fill at the open, minus slippage.

Costs
* Taker / maker fees, market and stop slippage (CostModel), hourly funding
  from Hyperliquid's historical funding rates (fallback: interest rate).
* Passive limit entries: full fill only if price trades through by one
  tick; a mere touch gives a partial fill (configurable fraction).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from agents.liquidity_analyst import LiquidityAnalyst
from agents.pipeline import DecisionPipeline
from agents.regime_detector import RegimeDetector
from agents.risk_manager import RiskManager, SystemHealth
from agents.strategy_engine import StrategyEngine
from agents.technical_analyst import TechnicalAnalyst
from analysis.features import compute_features
from backtesting.costs import CostModel
from core.models import (AccountState, Direction, EntryType, ManagedPosition, Regime, StrategyName, TradeRecord,
                         TradeSetup)
from core.snapshot import MarketSnapshot
from market_data.candles import interval_ms, resample
from market_data.history import load_candles, load_funding
from risk.kill_switch import KillSwitch
from risk.limits import RiskLimits
from risk.sizing import MIN_ORDER_NOTIONAL_USD
from risk.state import RiskState
from strategies.base import Strategy
from strategies.registry import build_strategies

ALL_TFS = ["1m", "5m", "15m", "30m", "1h", "4h"]
HOUR_MS = 3_600_000


@dataclass
class BacktestConfig:
    base_tf: str = "15m"
    timeframes: tuple[str, ...] | None = None
    initial_equity: float = 1000.0
    strategy: StrategyName | None = None        # None = adaptive engine
    ignore_regime: bool = False                 # research mode: run a strategy in all non-safety regimes
    min_score: float = 60.0
    limits: RiskLimits = field(default_factory=RiskLimits)
    costs: CostModel = field(default_factory=CostModel)
    tick: float = 1.0
    partial_fill_fraction: float = 0.5
    limit_ttl_bars: int = 2
    warmup_bars: int = 250
    start_ms: int | None = None
    end_ms: int | None = None
    record_candidates: bool = False
    label: str = ""
    sz_decimals: int = 5
    strategy_overrides: dict = field(default_factory=dict)  # {strategy_value: {attr: value}} (research only)


@dataclass
class BacktestData:
    base_tf: str
    base: pd.DataFrame
    features: dict[str, pd.DataFrame]
    records: dict[str, list[dict]]
    close_times: dict[str, np.ndarray]
    funding_t: np.ndarray
    funding_r: np.ndarray

    def funding_rate_at(self, ts: int, default: float) -> float:
        if len(self.funding_t) == 0:
            return default
        k = int(np.searchsorted(self.funding_t, ts, side="right")) - 1
        if k < 0 or ts - self.funding_t[k] > 2 * HOUR_MS:
            return default
        return float(self.funding_r[k])


def prepare_data(candles: dict[str, pd.DataFrame], base_tf: str, timeframes: list[str],
                 funding: pd.DataFrame | None = None) -> BacktestData:
    """candles: native frames by tf (missing tfs are resampled from the finest native frame)."""
    base = candles[base_tf].reset_index(drop=True)
    frames: dict[str, pd.DataFrame] = {}
    for tf in timeframes:
        if tf in candles and not candles[tf].empty:
            frames[tf] = candles[tf]
        else:
            finer = [t for t in ALL_TFS if t in candles and not candles[t].empty and interval_ms(t) < interval_ms(tf)
                     and interval_ms(tf) % interval_ms(t) == 0]
            if not finer:
                continue
            src = max(finer, key=interval_ms)
            frames[tf] = resample(candles[src], tf)
    feats = {tf: compute_features(df, tf) for tf, df in frames.items()}
    records = {tf: f.to_dict("records") for tf, f in feats.items()}
    close_times = {tf: f["close_time"].to_numpy(np.int64) for tf, f in feats.items()}
    if funding is not None and not funding.empty:
        f = funding.sort_values("time")
        ft, fr = f["time"].to_numpy(np.int64), f["funding_rate"].to_numpy(float)
    else:
        ft, fr = np.array([], dtype=np.int64), np.array([])
    return BacktestData(base_tf, base, feats, records, close_times, ft, fr)


def load_data(data_dir: Path, base_tf: str, timeframes: list[str] | None = None, coin: str = "BTC") -> BacktestData:
    tfs = timeframes or [t for t in ALL_TFS if interval_ms(t) >= interval_ms(base_tf)]
    native = {}
    for tf in set(tfs) | {base_tf}:
        df = load_candles(data_dir, coin, tf)
        if not df.empty:
            native[tf] = df
    if base_tf not in native:
        raise FileNotFoundError(f"no {base_tf} candles in {data_dir} — run scripts/download_history.py first")
    return prepare_data(native, base_tf, tfs, load_funding(data_dir, coin))


@dataclass
class _Pending:
    setup: TradeSetup
    size: float
    risk_usd: float
    regime: Regime
    ttl: int
    confidence: float | None


@dataclass
class _SimPos:
    mp: ManagedPosition
    strategy: Strategy
    entry_fill: float
    fee_in: float
    slip_in: float
    funding: float = 0.0
    tp_as_limit: bool = False
    features: dict = field(default_factory=dict)


@dataclass
class BacktestResult:
    config: BacktestConfig
    trades: list[TradeRecord]
    equity: pd.Series
    candidates: list[dict]
    halted_at: int | None
    halted_reason: str | None
    bars: int
    period: tuple[int, int]
    decisions: int
    vetoes: int
    regime_counts: dict[str, int]


class Backtester:
    def __init__(self, data: BacktestData, config: BacktestConfig):
        self.d = data
        self.cfg = config
        self.costs = config.costs
        strategies = build_strategies()
        for name, attrs in config.strategy_overrides.items():
            for k, v in attrs.items():
                if not hasattr(strategies[StrategyName(name)], k):
                    raise AttributeError(f"unknown strategy parameter {name}.{k}")
                setattr(strategies[StrategyName(name)], k, v)
        self.strategies = strategies
        enabled = [config.strategy] if config.strategy else list(strategies.keys())
        self.engine = StrategyEngine(strategies, config.costs, enabled=enabled, min_score=config.min_score,
                                     force_strategy=config.strategy, ignore_regime=config.ignore_regime)
        self.state = RiskState()
        self.kill = KillSwitch(None)
        self.risk = RiskManager(config.limits, config.costs, self.kill, self.state, sz_decimals=config.sz_decimals)
        self.regime = RegimeDetector(calendar_path=None)
        self.pipeline = DecisionPipeline(None, TechnicalAnalyst(), LiquidityAnalyst(), self.regime, self.engine, self.risk)

    # ------------------------------------------------------------------ snapshot
    def snapshot(self, i: int) -> MarketSnapshot:
        b = self.d.base
        t_close = int(b.at[i, "close_time"])
        rows, prev = {}, {}
        for tf, ct in self.d.close_times.items():
            j = int(np.searchsorted(ct, t_close, side="right")) - 1
            if j >= 1:
                rows[tf] = self.d.records[tf][j]
                prev[tf] = self.d.records[tf][j - 1]
        ts = t_close + 1
        return MarketSnapshot(timestamp=ts, price=float(b.at[i, "close"]), rows=rows, prev_rows=prev,
                              funding_rate=self.d.funding_rate_at(ts, self.costs.default_hourly_funding),
                              source="backtest")

    # ------------------------------------------------------------------ helpers
    def _close(self, pos: _SimPos, exit_px: float, fee_rate: float, ideal_px: float, t: int, reason: str,
               trades: list[TradeRecord]) -> float:
        mp = pos.mp
        sign = mp.direction.sign
        gross = (exit_px - pos.entry_fill) * mp.size * sign
        fee_out = exit_px * mp.size * fee_rate
        slip_out = abs(exit_px - ideal_px) * mp.size
        net = gross - pos.fee_in - fee_out - pos.funding
        trades.append(TradeRecord(
            mode="backtest", strategy=mp.strategy, regime=mp.regime, direction=mp.direction, entry_time=mp.opened_at,
            exit_time=t, entry_price=pos.entry_fill, exit_price=exit_px, size=mp.size, initial_stop=mp.initial_stop,
            take_profit=mp.take_profit, risk_usd=mp.risk_usd, gross_pnl=gross, fees=pos.fee_in + fee_out,
            funding=pos.funding, slippage_cost=pos.slip_in + slip_out, net_pnl=net, exit_reason=reason,
            score=mp.score, confidence=mp.confidence, r_multiple=net / mp.risk_usd if mp.risk_usd > 0 else 0.0,
            reasons=mp.reasons, features=pos.features,
        ))
        self.risk.on_trade_closed(net, t)
        return gross - fee_out  # cash delta at exit

    # ------------------------------------------------------------------ main loop
    def run(self) -> BacktestResult:
        cfg, b, costs = self.cfg, self.d.base, self.costs
        n = len(b)
        o, h, l, c = (b[k].to_numpy(float) for k in ("open", "high", "low", "close"))
        t_open, t_close = b["open_time"].to_numpy(np.int64), b["close_time"].to_numpy(np.int64)
        start = cfg.warmup_bars
        if cfg.start_ms is not None:
            start = max(start, int(np.searchsorted(t_open, cfg.start_ms)))
        end = n if cfg.end_ms is None else int(np.searchsorted(t_open, cfg.end_ms))
        cash = cfg.initial_equity
        pos: _SimPos | None = None
        pending: _Pending | None = None
        pending_close: str | None = None
        trades: list[TradeRecord] = []
        eq_t, eq_v = [], []
        candidates: list[dict] = []
        halted_at, halted_reason = None, None
        decisions = vetoes = 0
        regime_counts: dict[str, int] = {}
        slip_m, slip_s = costs.slippage_bps_market / 1e4, costs.slippage_bps_stop / 1e4
        self.risk.update_equity(cash, int(t_open[start]) if start < n else 0)

        for i in range(start, end):
            # A) pending entry from previous close
            if pending is not None and pos is None:
                s = pending.setup
                sign = s.direction.sign
                fill_px, size, fee_rate = None, pending.size, None
                if s.entry_type == EntryType.MARKET:
                    fill_px = o[i] * (1 + sign * slip_m)
                    fee_rate = costs.taker_fee
                    slip_in = abs(fill_px - o[i]) * size
                    pending = None
                else:
                    L = s.entry_price
                    through = (l[i] <= L - cfg.tick) if sign > 0 else (h[i] >= L + cfg.tick)
                    touch = (l[i] <= L) if sign > 0 else (h[i] >= L)
                    if through or touch:
                        if not through:
                            size = math.floor(size * cfg.partial_fill_fraction * 10 ** cfg.sz_decimals) / 10 ** cfg.sz_decimals
                        if size * L >= MIN_ORDER_NOTIONAL_USD:
                            fill_px, fee_rate, slip_in = L, costs.maker_fee, 0.0
                        pending = None
                    else:
                        pending.ttl -= 1
                        if pending.ttl <= 0:
                            pending = None
                if fill_px is not None:
                    fee_in = fill_px * size * fee_rate
                    cash -= fee_in
                    # re-anchor stop / target on the actual fill (same distances as planned)
                    dist = abs(s.entry_price - s.stop_loss)
                    stop = fill_px - sign * dist
                    tp = None if s.take_profit is None else fill_px + sign * abs(s.take_profit - s.entry_price)
                    risk_usd = costs.loss_at_stop(size, fill_px, stop, s.entry_type)
                    mp = ManagedPosition(direction=s.direction, size=size, entry_price=fill_px, stop_loss=stop,
                                         initial_stop=stop, take_profit=tp, strategy=s.strategy,
                                         regime=self._entry_regime, opened_at=int(t_open[i]), risk_usd=risk_usd,
                                         score=s.score, confidence=self._entry_conf, max_hold_minutes=s.max_hold_minutes,
                                         reasons=s.reasons)
                    pos = _SimPos(mp, self.strategies[s.strategy], fill_px, fee_in, slip_in,
                                  tp_as_limit=s.tp_as_limit, features=s.features)

            # B) close decided at previous close -> execute at this open
            if pos is not None and pending_close is not None:
                sign = pos.mp.direction.sign
                px = o[i] * (1 - sign * slip_m)
                cash += self._close(pos, px, costs.taker_fee, o[i], int(t_open[i]), pending_close, trades)
                pos, pending_close = None, None

            # C) intrabar stop / take-profit
            if pos is not None:
                mp = pos.mp
                sign = mp.direction.sign
                stop_hit = (l[i] <= mp.stop_loss) if sign > 0 else (h[i] >= mp.stop_loss)
                tp_hit = False
                if mp.take_profit is not None:
                    if pos.tp_as_limit:
                        tp_hit = (h[i] >= mp.take_profit + cfg.tick) if sign > 0 else (l[i] <= mp.take_profit - cfg.tick)
                    else:
                        tp_hit = (h[i] >= mp.take_profit) if sign > 0 else (l[i] <= mp.take_profit)
                gap_tp = mp.take_profit is not None and ((o[i] >= mp.take_profit) if sign > 0 else (o[i] <= mp.take_profit))
                if stop_hit and not gap_tp:
                    gap = (o[i] <= mp.stop_loss) if sign > 0 else (o[i] >= mp.stop_loss)
                    ref = o[i] if gap else mp.stop_loss
                    px = ref * (1 - sign * slip_s)
                    cash += self._close(pos, px, costs.taker_fee, mp.stop_loss, int(t_close[i]),
                                        "stop_loss_gap" if gap else ("stop_loss" if sign * (mp.stop_loss - mp.initial_stop) <= 0
                                                                     else "trailing_stop"), trades)
                    pos = None
                elif tp_hit or gap_tp:
                    if pos.tp_as_limit and not gap_tp:
                        px, fr = mp.take_profit, costs.maker_fee
                    else:
                        ref = o[i] if gap_tp else mp.take_profit
                        px, fr = ref * (1 - sign * slip_m), costs.taker_fee
                    cash += self._close(pos, px, fr, mp.take_profit, int(t_close[i]), "take_profit", trades)
                    pos = None

            # D) hourly funding while the position is open
            if pos is not None:
                first_h, last_h = int(t_open[i]) // HOUR_MS + 1, (int(t_close[i]) + 1) // HOUR_MS
                for hh in range(first_h, last_h + 1):
                    ts = hh * HOUR_MS
                    if pos.mp.opened_at < ts <= int(t_close[i]) + 1:
                        rate = self.d.funding_rate_at(ts, costs.default_hourly_funding)
                        pay = pos.mp.direction.sign * pos.mp.size * c[i] * rate
                        pos.funding += pay
                        cash -= pay

            # E) mark to market
            upnl = 0.0 if pos is None else (c[i] - pos.entry_fill) * pos.mp.size * pos.mp.direction.sign
            equity = cash + upnl
            eq_t.append(int(t_close[i]))
            eq_v.append(equity)
            self.risk.update_equity(equity, int(t_close[i]) + 1)

            # F) circuit breakers
            if halted_at is None:
                acct = AccountState(equity=equity, balance=cash)
                for action, why in self.risk.circuit_breakers(acct, SystemHealth(), int(t_close[i]) + 1):
                    if action == "halt":
                        halted_at, halted_reason = int(t_close[i]), why
                        self.kill.halt(why, "backtest")
                        pending = None
                        if pos is not None:
                            pending_close = f"kill switch: {why}"
                        break
            if i == end - 1:
                break

            # G) decisions at bar close
            snap = self.snapshot(i)
            if pos is not None:
                reports = self.pipeline.analyze(snap)
                regime_counts[reports["regime"].data["regime"]] = regime_counts.get(reports["regime"].data["regime"], 0) + 1
                if pending_close is None:
                    snap.price = c[i]
                    act = pos.strategy.manage(pos.mp, snap)
                    if act.action == "update_stop" and act.new_stop is not None:
                        tighter = (act.new_stop > pos.mp.stop_loss) if pos.mp.direction == Direction.LONG else (act.new_stop < pos.mp.stop_loss)
                        if tighter:
                            pos.mp.stop_loss = act.new_stop
                    elif act.action == "close":
                        pending_close = act.reason
                if cfg.record_candidates:
                    self.engine.decide(snap, reports["technical"], reports["liquidity"], reports["regime"])
                    self._collect(candidates, i, reports["regime"].data["regime"])
                continue
            if pending is not None or halted_at is not None:
                reports = self.pipeline.analyze(snap)
                regime_counts[reports["regime"].data["regime"]] = regime_counts.get(reports["regime"].data["regime"], 0) + 1
                continue
            acct = AccountState(equity=equity, balance=cash)
            res = self.pipeline.decide(snap, acct, SystemHealth())
            reg = res.reports["regime"].data["regime"]
            regime_counts[reg] = regime_counts.get(reg, 0) + 1
            if cfg.record_candidates:
                self._collect(candidates, i, reg)
            if res.setup is not None:
                decisions += 1
                if res.signal.actionable:
                    self._entry_regime = res.signal.regime
                    self._entry_conf = res.signal.confidence.probability if res.signal.confidence else None
                    pending = _Pending(res.setup, res.signal.risk.size, res.signal.risk.risk_usd, res.signal.regime,
                                       cfg.limit_ttl_bars, None)
                else:
                    vetoes += 1

        # close any open position at the last close (marked as end of test)
        if pos is not None and end - 1 >= start:
            k = end - 1
            sign = pos.mp.direction.sign
            cash += self._close(pos, c[k] * (1 - sign * slip_m), costs.taker_fee, c[k], int(t_close[k]), "end_of_test", trades)
            eq_v[-1] = cash
        equity_s = pd.Series(eq_v, index=eq_t, dtype=float)
        return BacktestResult(cfg, trades, equity_s, candidates, halted_at, halted_reason, max(0, end - start),
                              (int(t_open[start]) if start < n else 0, int(t_close[end - 1]) if end > start else 0),
                              decisions, vetoes, regime_counts)

    _entry_regime: Regime = Regime.UNKNOWN
    _entry_conf: float | None = None

    def _collect(self, out: list[dict], i: int, regime: str) -> None:
        for s in self.engine.last_candidates:
            out.append({"i": i, "regime": regime, "setup": s})


def run_backtest(data_dir: Path, config: BacktestConfig, data: BacktestData | None = None) -> BacktestResult:
    data = data or load_data(data_dir, config.base_tf, list(config.timeframes) if config.timeframes else None)
    return Backtester(data, config).run()
