import numpy as np
import pandas as pd
import pytest

from backtesting.costs import CostModel
from backtesting.engine import BacktestConfig, Backtester, prepare_data
from backtesting.metrics import equity_metrics, trade_metrics, validate
from core.models import Direction, EntryType, Regime, StrategyName, TradeRecord, TradeSetup
from machine_learning.calibration import ConfidenceCalibrator, evaluate_and_fit
from machine_learning.labeling import simulate_outcome
from machine_learning.walk_forward import walk_forward_splits
from market_data.candles import resample
from tests.conftest import make_candles


@pytest.fixture(scope="module")
def synthetic_data():
    base = make_candles(3000, tf_ms=900_000, seed=5, regime_len=400)
    return prepare_data({"15m": base, "1h": resample(base, "1h"), "4h": resample(base, "4h")}, "15m",
                        ["15m", "30m", "1h", "4h"])


def test_backtest_accounting_invariants(synthetic_data):
    cfg = BacktestConfig(base_tf="15m", strategy=None, ignore_regime=True, min_score=40)
    res = Backtester(synthetic_data, cfg).run()
    final = float(res.equity.iloc[-1])
    assert final == pytest.approx(cfg.initial_equity + sum(t.net_pnl for t in res.trades), abs=1e-6)
    budget = cfg.initial_equity * 1.2 * cfg.limits.risk_per_trade_pct / 100  # equity can grow
    for t in res.trades:
        assert t.fees > 0
        assert t.risk_usd <= budget + 1e-6
        assert t.net_pnl == pytest.approx(t.gross_pnl - t.fees - t.funding)
        assert t.exit_time >= t.entry_time
    em = equity_metrics(res.equity, cfg.initial_equity)
    assert em["max_drawdown_pct"] < cfg.limits.max_drawdown_pct + 2.5  # halts at the limit (+ last trade slippage)


def test_backtest_never_holds_two_positions(synthetic_data):
    res = Backtester(synthetic_data, BacktestConfig(base_tf="15m", ignore_regime=True, min_score=40)).run()
    trades = sorted(res.trades, key=lambda t: t.entry_time)
    for a, b in zip(trades, trades[1:]):
        assert b.entry_time >= a.exit_time


def _setup(direction=Direction.LONG, entry=100.0, stop=98.0, tp=104.0, entry_type=EntryType.MARKET, tp_limit=False):
    return TradeSetup(strategy=StrategyName.INTRADAY, direction=direction, entry_type=entry_type, entry_price=entry,
                      stop_loss=stop, take_profit=tp, tp_as_limit=tp_limit, timeframe="15m", score=50)


def test_outcome_stop_first_when_both_hit_same_bar():
    o = np.array([100, 100, 100.0]); h = np.array([100.5, 105, 101.0]); l = np.array([99.5, 97, 99.0]); c = np.array([100, 100, 100.0])
    res = simulate_outcome(o, h, l, c, 0, _setup(), CostModel(), 5, 15)
    assert res["reason"] == "stop" and res["win"] == 0


def test_outcome_gap_through_stop_fills_at_open():
    o = np.array([100, 100, 95.0]); h = np.array([100.5, 100.5, 96]); l = np.array([99.5, 99.5, 94]); c = np.array([100, 100, 95.0])
    res = simulate_outcome(o, h, l, c, 0, _setup(), CostModel(), 5, 15)
    assert res["reason"] == "stop" and res["r"] < -2.0  # gap loss beyond 1R


def test_outcome_limit_requires_trade_through():
    o = np.array([100, 100.5, 100.5, 100.5]); h = np.array([101, 101, 101, 101.0]); l = np.array([99.5, 100.0, 100.2, 100.3])
    c = o.copy()
    s = _setup(entry=100.0, stop=98.0, entry_type=EntryType.LIMIT)
    assert simulate_outcome(o, h, l, c, 0, s, CostModel(), 5, 15) is None  # touched only, never traded through


def test_walk_forward_splits_purge_and_order():
    pos = np.arange(0, 1000, 5)
    for tr, te in walk_forward_splits(pos, n_folds=4, horizon=50, embargo=10):
        assert pos[tr].max() + 50 < pos[te].min() - 10
        assert np.all(np.diff(te) == 1)


def test_validation_requires_all_criteria():
    trades = [TradeRecord(mode="bt", strategy=StrategyName.INTRADAY, regime=Regime.SIDEWAYS, direction=Direction.LONG,
                          entry_time=i * 1000, exit_time=i * 1000 + 500, entry_price=100, exit_price=101, size=1,
                          initial_stop=99, risk_usd=1, gross_pnl=1, fees=0.1, funding=0, net_pnl=0.9 if i % 2 else -0.5,
                          exit_reason="x") for i in range(40)]
    tm = trade_metrics(trades)
    assert tm["profit_factor"] == pytest.approx(0.9 * 20 / (0.5 * 20))
    eq = pd.Series(1000 + np.cumsum([t.net_pnl for t in trades]), index=[t.exit_time for t in trades])
    v = validate(tm, equity_metrics(eq, 1000), [{"trades": 10, "net_pnl": 1}] * 4)
    assert not v["passed"] and not v["checks"]["sample_size"]["pass"] and v["checks"]["profit_factor_after_costs"]["pass"]


def test_calibrator_refuses_without_enough_history():
    cal = ConfidenceCalibrator(evaluate_and_fit([{"i": i, "score": 60, "win": 1, "horizon": 1} for i in range(10)]))
    conf = cal.confidence(_setup())
    assert not conf.calibrated and conf.probability is None
