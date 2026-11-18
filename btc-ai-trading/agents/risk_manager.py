"""AGENT 6 — RISK MANAGER (absolute veto).

Validates or refuses every trade. Nothing reaches the Execution Agent
without an approved `RiskVerdict`. Also evaluates circuit breakers that
pause/halt the whole system.

Checks (all must pass):
 kill switch running · no daily-loss lock · no loss cool-down · drawdown
 below limit · no open position / open order on the exchange (one position
 max, no pyramiding, no averaging down, no martingale) · fresh data and a
 healthy connection · stop on the correct side · spread acceptable ·
 funding not strongly adverse · stop distance >= k x round-trip costs ·
 reward/risk after costs >= minimum · size >= exchange minimum ·
 realised risk (incl. fees/slippage) <= budget · leverage <= limit.
Equity used for sizing includes unrealized P&L.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from agents.base import BaseAgent
from backtesting.costs import CostModel
from core.models import AccountState, AgentReport, Direction, Regime, RiskVerdict, TradeSetup, now_ms
from risk.kill_switch import KillSwitch
from risk.limits import RiskLimits
from risk.sizing import compute_size
from risk.state import RiskState


@dataclass
class SystemHealth:
    data_age_s: float = 0.0                 # age of the freshest required market data
    max_data_age_s: float = 90.0
    ws_connected: bool = True
    ws_disconnects_10min: int = 0
    rest_failures: int = 0
    account_sync_age_s: float = 0.0
    desync: bool = False
    desync_detail: str = ""
    execution_errors_10min: int = 0
    spread_bps: float | None = None
    # True for a short grace period after the computer slept (process suspended): data and
    # connections are expected to be stale while they resync, so connectivity breakers
    # block entries instead of halting. Drawdown, desync and execution errors still halt.
    resyncing_after_sleep: bool = False
    notes: list[str] = field(default_factory=list)


class RiskManager(BaseAgent):
    name = "risk_manager"
    role = "Droit de veto absolu: dimensionne, valide ou refuse chaque trade; déclenche les coupe-circuits"

    def __init__(self, limits: RiskLimits, costs: CostModel, kill_switch: KillSwitch, state: RiskState,
                 sz_decimals: int = 5, high_vol_risk_multiplier: float = 0.5):
        super().__init__()
        self.limits = limits
        self.costs = costs
        self.kill_switch = kill_switch
        self.risk_state = state
        self.sz_decimals = sz_decimals
        self.high_vol_risk_multiplier = high_vol_risk_multiplier

    # ------------------------------------------------------------------ equity tracking
    def update_equity(self, equity: float, ts: int | None = None) -> None:
        self.risk_state.update_equity(equity, ts or now_ms())
        self.risk_state.save()

    def on_trade_closed(self, net_pnl: float, ts: int | None = None) -> None:
        self.risk_state.on_trade_closed(net_pnl, ts or now_ms(), self.limits.max_consecutive_losses,
                                   self.limits.cooldown_minutes_after_losses)
        self.risk_state.save()

    # ------------------------------------------------------------------ circuit breakers
    def circuit_breakers(self, account: AccountState | None, health: SystemHealth, ts: int | None = None) -> list[tuple[str, str]]:
        """Return a list of (action, reason) with action in {'halt', 'pause', 'block'}.
        'block' = refuse new entries without changing the kill switch."""
        ts = ts or now_ms()
        out: list[tuple[str, str]] = []
        if account is not None:
            eq = account.equity
            dd = self.risk_state.drawdown_pct(eq)
            if dd >= self.limits.max_drawdown_pct:
                out.append(("halt", f"max drawdown reached: {dd:.2f}% >= {self.limits.max_drawdown_pct}% of peak"))
            dl = self.risk_state.daily_loss_pct(eq)
            if dl >= self.limits.max_daily_loss_pct:
                if self.risk_state.daily_lock_day != self.risk_state.day:
                    self.risk_state.daily_lock_day = self.risk_state.day
                    self.risk_state.save()
                out.append(("block", f"daily loss limit reached: {dl:.2f}% >= {self.limits.max_daily_loss_pct}% (locked until 00:00 UTC)"))
        link = "block" if health.resyncing_after_sleep else "halt"
        sleep_note = " (resyncing after computer sleep)" if health.resyncing_after_sleep else ""
        if health.data_age_s > health.max_data_age_s:
            out.append((link, f"market data too old: {health.data_age_s:.0f}s > {health.max_data_age_s:.0f}s{sleep_note}"))
        elif health.data_age_s > health.max_data_age_s / 3:
            out.append(("block", f"market data stale ({health.data_age_s:.0f}s){sleep_note}"))
        if not health.ws_connected:
            out.append(("block", "websocket disconnected"))
        if health.ws_disconnects_10min >= 5:
            out.append((link, f"unstable API connection: {health.ws_disconnects_10min} websocket drops in 10 min{sleep_note}"))
        if health.rest_failures >= 6:
            out.append((link, f"unstable API connection: {health.rest_failures} consecutive REST failures{sleep_note}"))
        if health.desync:
            out.append(("halt", f"account desynchronisation: {health.desync_detail}"))
        if health.account_sync_age_s > 120:
            out.append(("block", f"account state not synced for {health.account_sync_age_s:.0f}s"))
        if health.execution_errors_10min >= 3:
            out.append(("halt", f"repeated execution errors ({health.execution_errors_10min} in 10 min)"))
        return out

    # ------------------------------------------------------------------ trade validation
    def evaluate(self, setup: TradeSetup, account: AccountState, health: SystemHealth, regime: Regime,
                 funding_rate: float | None = None, ts: int | None = None) -> RiskVerdict:
        ts = ts or now_ms()
        L, checks, reasons = self.limits, {}, []
        equity = account.equity  # includes unrealized P&L
        self.risk_state.update_equity(equity, ts)

        def check(name: str, ok: bool, why: str) -> None:
            checks[name] = bool(ok)
            if not ok:
                reasons.append(why)

        check("kill_switch", self.kill_switch.entries_allowed, f"kill switch is {self.kill_switch.state.value}: {self.kill_switch.reason}")
        breakers = self.circuit_breakers(account, health, ts)
        check("circuit_breakers", not breakers, "; ".join(r for _, r in breakers))
        check("daily_lock", self.risk_state.daily_lock_day != self.risk_state.day, "daily loss limit already hit today")
        check("cooldown", ts >= self.risk_state.cooldown_until_ms,
              f"cool-down after {L.max_consecutive_losses} consecutive losses until {self.risk_state.cooldown_until_ms}")
        check("single_position", account.position(setup_coin(setup)) is None,
              "a position is already open (one position max, no pyramiding / averaging)")
        check("no_open_orders", not account.open_orders, f"{len(account.open_orders)} open order(s) on the exchange")
        check("direction", setup.direction in (Direction.LONG, Direction.SHORT), "invalid direction")
        stop_ok = (setup.stop_loss < setup.entry_price) if setup.direction == Direction.LONG else (setup.stop_loss > setup.entry_price)
        check("stop_side", stop_ok, "stop-loss on the wrong side of entry")
        if setup.take_profit is not None:
            tp_ok = (setup.take_profit > setup.entry_price) if setup.direction == Direction.LONG else (setup.take_profit < setup.entry_price)
            check("tp_side", tp_ok, "take-profit on the wrong side of entry")
        if health.spread_bps is not None:
            check("spread", health.spread_bps <= L.max_spread_bps, f"spread {health.spread_bps:.2f} bps > {L.max_spread_bps}")
        if funding_rate is not None:
            adverse = setup.direction.sign * funding_rate
            check("funding", adverse <= L.max_funding_rate_hourly_against,
                  f"adverse funding {adverse * 100:.4f}%/h > limit")

        # cost-aware geometry
        rt_rate = self.costs.round_trip_rate(setup.entry_type, "stop")
        rt_cost_per_unit = setup.entry_price * rt_rate
        check("stop_vs_costs", setup.stop_distance >= L.min_stop_distance_cost_multiple * rt_cost_per_unit,
              f"stop distance {setup.stop_distance:.1f} < {L.min_stop_distance_cost_multiple}x round-trip costs ({rt_cost_per_unit:.1f})")

        # risk budget: per-trade, reduced in high volatility, capped by remaining daily budget
        risk_pct = L.risk_per_trade_pct * (self.high_vol_risk_multiplier if regime == Regime.HIGH_VOL else 1.0)
        budget = equity * risk_pct / 100
        daily_left = self.risk_state.day_start_equity * L.max_daily_loss_pct / 100 - max(0.0, -self.risk_state.daily_pnl(equity))
        budget = min(budget, max(0.0, daily_left))
        sizing = compute_size(equity, setup.entry_price, setup.stop_loss, budget, self.costs, setup.entry_type,
                              L.max_leverage, self.sz_decimals, L.leverage_safety_buffer)
        check("sizing", sizing.ok, sizing.reason or "sizing failed")
        if sizing.ok:
            check("risk_budget", sizing.risk_usd <= budget * 1.0001, f"risk {sizing.risk_usd:.2f} > budget {budget:.2f}")
            check("leverage", sizing.leverage <= L.max_leverage + 1e-9, f"leverage {sizing.leverage:.2f}x > {L.max_leverage}x")
            if setup.take_profit is not None:
                tp_kind = "tp_limit" if setup.tp_as_limit else "tp_market"
                gross = sizing.size * abs(setup.take_profit - setup.entry_price)
                exit_cost = sizing.size * setup.take_profit * self.costs.exit_rate(tp_kind)
                entry_cost = sizing.notional * self.costs.entry_rate(setup.entry_type)
                net_reward = gross - exit_cost - entry_cost
                rr = net_reward / sizing.risk_usd if sizing.risk_usd > 0 else 0.0
                check("reward_risk", rr >= L.min_reward_risk, f"reward/risk after costs {rr:.2f} < {L.min_reward_risk}")

        approved = all(checks.values())
        verdict = RiskVerdict(
            approved=approved, reasons=reasons if not approved else [f"approved: risk ${sizing.risk_usd:.2f} "
                                                                    f"({sizing.risk_usd / equity * 100:.3f}% equity)"],
            size=sizing.size if approved else 0.0, notional_usd=sizing.notional if approved else 0.0,
            risk_usd=sizing.risk_usd if sizing.ok else 0.0, est_cost_usd=sizing.est_cost_usd if sizing.ok else 0.0,
            leverage=sizing.leverage if sizing.ok else 0.0, checks=checks,
        )
        self.risk_state.save()
        summary = ("APPROVED " if approved else "VETO ") + (
            f"{setup.strategy.value} {setup.direction.value} size {sizing.size} BTC risk ${sizing.risk_usd:.2f}"
            if approved else "; ".join(reasons[:2]))
        self.record(AgentReport(agent=self.name, timestamp=ts, summary=summary,
                                data={"verdict": verdict.model_dump(), "equity": equity}),
                    "ok" if approved else "warning")
        return verdict

    def risk_status(self, account: AccountState | None) -> dict:
        eq = account.equity if account else self.risk_state.last_equity
        L = self.limits
        return {
            "kill_switch": self.kill_switch.to_dict(),
            "limits": {
                "risk_per_trade_pct": L.risk_per_trade_pct, "max_daily_loss_pct": L.max_daily_loss_pct,
                "max_drawdown_pct": L.max_drawdown_pct, "max_leverage": L.max_leverage,
                "max_open_positions": L.max_open_positions, "margin_mode": L.margin_mode,
                "max_consecutive_losses": L.max_consecutive_losses, "min_reward_risk": L.min_reward_risk,
            },
            "equity": eq,
            "peak_equity": self.risk_state.peak_equity,
            "day_start_equity": self.risk_state.day_start_equity,
            "daily_pnl": self.risk_state.daily_pnl(eq),
            "daily_loss_pct": self.risk_state.daily_loss_pct(eq),
            "daily_loss_limit_usd": self.risk_state.day_start_equity * L.max_daily_loss_pct / 100,
            "drawdown_pct": self.risk_state.drawdown_pct(eq),
            "risk_per_trade_usd": eq * L.risk_per_trade_pct / 100,
            "consecutive_losses": self.risk_state.consecutive_losses,
            "cooldown_until_ms": self.risk_state.cooldown_until_ms,
            "daily_locked": self.risk_state.daily_lock_day == self.risk_state.day,
            "trades_today": self.risk_state.trades_today,
        }


def setup_coin(setup: TradeSetup) -> str:
    return "BTC"
