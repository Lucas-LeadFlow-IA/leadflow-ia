import pytest

from agents.risk_manager import RiskManager, SystemHealth
from backtesting.costs import CostModel
from core.models import AccountState, Direction, EntryType, OpenOrder, Position, Regime, StrategyName, TradeSetup
from risk.kill_switch import KillSwitch, KillSwitchError, SwitchState
from risk.limits import RiskLimitError, RiskLimits
from risk.sizing import compute_size
from risk.state import RiskState

T0 = 1_800_000_000_000


def setup(direction=Direction.LONG, entry=60_000.0, stop=59_400.0, tp=61_500.0, entry_type=EntryType.MARKET):
    return TradeSetup(strategy=StrategyName.INTRADAY, direction=direction, entry_type=entry_type, entry_price=entry,
                      stop_loss=stop, take_profit=tp, timeframe="15m", score=75)


def manager(tmp_path, **lim):
    ks = KillSwitch(tmp_path / "ks.json")
    st = RiskState.load(tmp_path / "rs.json")
    return RiskManager(RiskLimits(**lim), CostModel(), ks, st, sz_decimals=5)


def acct(equity=1000.0, positions=None, orders=None):
    return AccountState(equity=equity, balance=equity, positions=positions or [], open_orders=orders or [])


# ---------------------------------------------------------------- limits
def test_hard_ceilings_cannot_be_exceeded():
    with pytest.raises(RiskLimitError):
        RiskLimits(risk_per_trade_pct=1.0)
    with pytest.raises(RiskLimitError):
        RiskLimits(max_leverage=2)
    with pytest.raises(RiskLimitError):
        RiskLimits(max_open_positions=2)
    with pytest.raises(RiskLimitError):
        RiskLimits(max_drawdown_pct=25)
    RiskLimits()  # defaults are valid


def test_settings_reject_risk_above_ceiling(monkeypatch):
    from config.settings import Settings
    monkeypatch.setenv("RISK_PER_TRADE_PCT", "5")
    with pytest.raises(RiskLimitError):
        Settings().risk_limits


# ---------------------------------------------------------------- sizing
def test_sizing_respects_budget_including_costs():
    c = CostModel()
    r = compute_size(1000, 60_000, 59_400, 2.5, c, EntryType.MARKET, 1, 5)
    assert r.ok
    assert r.risk_usd <= 2.5 + 1e-9
    assert r.risk_usd == pytest.approx(c.loss_at_stop(r.size, 60_000, 59_400, EntryType.MARKET))
    assert r.size == round(r.size, 5)


def test_sizing_caps_leverage_and_rejects_below_min_notional():
    c = CostModel()
    tight = compute_size(1000, 60_000, 59_990, 2.5, c, EntryType.MARKET, 1, 5)  # very tight stop -> huge size
    assert tight.ok and tight.capped_by_leverage and tight.notional <= 1000 * 0.95 + 1e-6
    tiny = compute_size(1000, 60_000, 50_000, 0.05, c, EntryType.MARKET, 1, 5)
    assert not tiny.ok and "minimum" in tiny.reason


# ---------------------------------------------------------------- kill switch
def test_kill_switch_states_and_persistence(tmp_path):
    ks = KillSwitch(tmp_path / "ks.json")
    assert ks.entries_allowed
    ks.pause("manual", "dashboard")
    assert not ks.entries_allowed
    ks.resume("telegram")
    assert ks.entries_allowed
    ks.halt("max drawdown", "risk_manager")
    assert ks.pending_emergency
    with pytest.raises(KillSwitchError):
        ks.resume("telegram")
    ks.pause("x", "y")  # cannot downgrade a halt
    reloaded = KillSwitch(tmp_path / "ks.json")
    assert reloaded.state == SwitchState.HALTED and reloaded.pending_emergency
    with pytest.raises(KillSwitchError):
        reloaded.reset("yes")
    reloaded.reset("RESET")
    assert reloaded.entries_allowed


# ---------------------------------------------------------------- risk state
def test_risk_state_day_rollover_drawdown_and_cooldown(tmp_path):
    s = RiskState.load(tmp_path / "rs.json")
    s.update_equity(1000, T0)
    s.update_equity(1100, T0 + 1000)
    s.update_equity(1012, T0 + 2000)
    assert s.drawdown_pct(1012) == pytest.approx(8.0)
    assert s.daily_loss_pct(990) == pytest.approx(1.0)
    s.update_equity(990, T0 + 86_400_000)  # next day: new baseline
    assert s.day_start_equity == 990
    for _ in range(3):
        s.on_trade_closed(-2.0, T0, max_consecutive=3, cooldown_min=120)
    assert s.cooldown_until_ms == T0 + 120 * 60_000
    s.save()
    assert RiskState.load(tmp_path / "rs.json").cooldown_until_ms == s.cooldown_until_ms


# ---------------------------------------------------------------- risk manager
def test_risk_manager_approves_valid_trade(tmp_path):
    rm = manager(tmp_path)
    v = rm.evaluate(setup(), acct(), SystemHealth(), Regime.STRONG_BULL, funding_rate=0.0000125, ts=T0)
    assert v.approved, v.reasons
    assert v.risk_usd <= 2.5 + 1e-9 and v.leverage <= 1
    assert all(v.checks.values())


@pytest.mark.parametrize("case", ["position_open", "open_orders", "paused", "tight_stop", "bad_rr", "funding", "stale"])
def test_risk_manager_vetoes(tmp_path, case):
    rm = manager(tmp_path)
    s, a, h, fr = setup(), acct(), SystemHealth(), 0.0
    if case == "position_open":
        a = acct(positions=[Position(size=0.01, entry_price=60_000)])
    elif case == "open_orders":
        a = acct(orders=[OpenOrder(oid=1, coin="BTC", is_buy=True, size=0.01, limit_price=59_000)])
    elif case == "paused":
        rm.kill_switch.pause("test", "test")
    elif case == "tight_stop":
        s = setup(stop=59_950, tp=60_200)
    elif case == "bad_rr":
        s = setup(tp=60_400)
    elif case == "funding":
        fr = 0.001
    elif case == "stale":
        h = SystemHealth(data_age_s=60, max_data_age_s=90)
    v = rm.evaluate(s, a, h, Regime.STRONG_BULL, funding_rate=fr, ts=T0)
    assert not v.approved and v.size == 0
    assert v.reasons


def test_daily_loss_blocks_and_drawdown_halts(tmp_path):
    rm = manager(tmp_path)
    rm.update_equity(1000, T0)
    v = rm.evaluate(setup(), acct(equity=989), SystemHealth(), Regime.STRONG_BULL, ts=T0 + 1000)
    assert not v.approved and any("daily loss" in r for r in v.reasons)
    rm2 = manager(tmp_path / "b")
    rm2.update_equity(1000, T0)
    breakers = rm2.circuit_breakers(acct(equity=915), SystemHealth(), T0 + 2 * 86_400_000)
    assert ("halt" in {a for a, _ in breakers})


def test_high_volatility_halves_risk(tmp_path):
    rm = manager(tmp_path)
    normal = rm.evaluate(setup(), acct(), SystemHealth(), Regime.STRONG_BULL, ts=T0)
    rm2 = manager(tmp_path / "x")
    hv = rm2.evaluate(setup(), acct(), SystemHealth(), Regime.HIGH_VOL, ts=T0)
    assert hv.approved and hv.risk_usd <= normal.risk_usd * 0.5 + 0.01


def test_circuit_breakers_for_infrastructure(tmp_path):
    rm = manager(tmp_path)
    b = rm.circuit_breakers(None, SystemHealth(data_age_s=200, max_data_age_s=90, ws_disconnects_10min=6,
                                               rest_failures=7, desync=True, desync_detail="x",
                                               execution_errors_10min=3))
    reasons = " ".join(r for _, r in b)
    for word in ("too old", "unstable", "desynchronisation", "execution errors"):
        assert word in reasons
