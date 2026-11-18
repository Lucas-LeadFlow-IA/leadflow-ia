"""Orchestrator: runs the 8-agent loop in paper / testnet / live.

Every `decision_interval_seconds`:
 1. sync the account with the exchange (source of truth) and reconcile,
 2. evaluate circuit breakers (data age, connection stability, desync,
    execution errors, daily loss, drawdown) -> kill switch,
 3. run the emergency procedure if the kill switch asks for it,
 4. Market Scanner -> Technical -> Liquidity -> Regime -> Strategy -> Risk,
 5. Execution (if approved and entries are allowed) or position management,
 6. Performance Analyst records closed trades; everything is persisted.
A fast loop (1 s) drives the paper exchange and detects closed positions.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import deque
from pathlib import Path

from agents.execution_agent import CriticalExecutionError, ExecutionAgent
from agents.liquidity_analyst import LiquidityAnalyst
from agents.market_scanner import MarketScanner
from agents.performance_analyst import PerformanceAnalyst
from agents.pipeline import DecisionPipeline
from agents.regime_detector import RegimeDetector
from agents.risk_manager import RiskManager, SystemHealth
from agents.strategy_engine import StrategyEngine
from agents.technical_analyst import TechnicalAnalyst
from backtesting.costs import CostModel
from config.settings import PROJECT_ROOT, Settings
from core.models import AccountState, Direction, ManagedPosition, TradeSignal, TradingMode, now_ms
from core.snapshot import snapshot_from_store
from database.repository import Database
from execution.base import ExchangeClient
from execution.reconciliation import reconcile
from machine_learning.anomaly import AnomalyModel
from machine_learning.calibration import ConfidenceCalibrator
from machine_learning.trade_filter import TradeFilter
from market_data.service import MarketDataService
from risk.kill_switch import KillSwitch
from risk.state import RiskState
from strategies.registry import build_strategies

log = logging.getLogger("orchestrator")


class NullNotifier:
    async def notify(self, level: str, text: str) -> None:  # noqa: D401
        return None


class TradingSystem:
    def __init__(self, settings: Settings, mode: TradingMode, market: MarketDataService, exchange: ExchangeClient,
                 db: Database, notifier=None):
        self.s = settings
        self.mode = mode
        self.market = market
        self.store = market.store
        self.exchange = exchange
        self.db = db
        self.notifier = notifier or NullNotifier()
        rt = settings.runtime_dir
        self.costs = CostModel.from_settings(settings)
        self.kill_switch = KillSwitch(rt / "kill_switch.json")
        self.risk_state = RiskState.load(rt / f"risk_state_{mode.value}.json")
        self.position_file = rt / f"position_{mode.value}.json"

        anomaly = None
        try:
            anomaly = AnomalyModel.load_enabled(settings.models_dir)
        except Exception as exc:  # noqa: BLE001 - a broken model must not stop trading safety
            log.error("anomaly model not loaded: %s", exc)
        trade_filter = None
        try:
            tf = TradeFilter.load(settings.models_dir)
            trade_filter = tf if tf and tf.enabled else None
        except Exception as exc:  # noqa: BLE001
            log.error("trade filter not loaded: %s", exc)

        self.scanner = MarketScanner()
        self.technical = TechnicalAnalyst()
        self.liquidity = LiquidityAnalyst()
        self.regime = RegimeDetector(calendar_path=PROJECT_ROOT / "config" / "event_calendar.json", anomaly_model=anomaly)
        self.engine = StrategyEngine(build_strategies(), self.costs, enabled=settings.enabled_strategies,
                                     min_score=settings.min_setup_score)
        self.risk = RiskManager(settings.risk_limits, self.costs, self.kill_switch, self.risk_state,
                                sz_decimals=self.store.sz_decimals)
        self.execution = ExecutionAgent(exchange, sz_decimals=self.store.sz_decimals, max_leverage=settings.max_leverage,
                                        isolated=settings.margin_mode == "isolated")
        self.performance = PerformanceAnalyst(db, mode.value, settings.initial_capital_usd)
        self.calibrator = ConfidenceCalibrator.load(settings.models_dir)
        self.pipeline = DecisionPipeline(self.scanner, self.technical, self.liquidity, self.regime, self.engine,
                                         self.risk, calibrator=self.calibrator, trade_filter=trade_filter)
        self.ml_status = {"anomaly_model": anomaly is not None, "trade_filter": trade_filter is not None,
                          "calibrated_confidence": self.calibrator.usable}

        self.account: AccountState | None = None
        self.account_synced_ms: int | None = None
        self.health = SystemHealth(max_data_age_s=settings.max_data_staleness_seconds)
        self.last_signal: TradeSignal | None = None
        self.signals: deque[dict] = deque(maxlen=200)
        self.last_reports: dict = {}
        self.started_ms = now_ms()
        self.loops = 0
        self.last_error: str | None = None
        self._attempted: set[tuple] = set()
        self._last_no_trade_log = 0
        self._last_equity_log = 0
        self._last_daily_report_day = -1
        self._orders_logged = 0
        self._stop = asyncio.Event()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ lifecycle
    async def start(self) -> None:
        await self.market.start()
        await self._sync_account()
        self._restore_position()
        self._event("info", "system", "start", f"system started in {self.mode.value.upper()} mode")
        await self.notifier.notify("info", f"🟢 Système démarré en mode {self.mode.value.upper()}")

    async def run(self) -> None:
        fast = asyncio.create_task(self._fast_loop())
        try:
            while not self._stop.is_set():
                t0 = time.monotonic()
                try:
                    async with self._lock:
                        await self.tick()
                except Exception as exc:  # noqa: BLE001
                    self.last_error = f"{type(exc).__name__}: {exc}"
                    log.exception("tick failed")
                    self._event("error", "orchestrator", "tick_error", self.last_error)
                self.loops += 1
                delay = max(1.0, self.s.decision_interval_seconds - (time.monotonic() - t0))
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=delay)
                except asyncio.TimeoutError:
                    pass
        finally:
            fast.cancel()

    async def stop(self) -> None:
        self._stop.set()
        self._save_position()
        await self.market.stop()
        await self.exchange.close()

    async def _fast_loop(self) -> None:
        while not self._stop.is_set():
            await asyncio.sleep(1.0)
            try:
                await self.exchange.on_market_update()
            except Exception:  # noqa: BLE001
                log.exception("fast loop error")

    # ------------------------------------------------------------------ helpers
    def _event(self, level: str, source: str, kind: str, message: str, payload: dict | None = None) -> None:
        self.db.add_event(now_ms(), self.mode.value, level, source, kind, message, payload)
        getattr(log, "error" if level == "error" else "warning" if level == "warning" else "info")(message)

    async def _sync_account(self) -> AccountState | None:
        try:
            self.account = await self.exchange.get_account_state()
            self.account_synced_ms = now_ms()
            self.health.rest_failures = 0
        except Exception as exc:  # noqa: BLE001
            self.health.rest_failures += 1
            self._event("warning", "orchestrator", "account_sync_failed", str(exc))
        return self.account

    def _save_position(self) -> None:
        p = self.execution.position
        try:
            if p is None:
                self.position_file.unlink(missing_ok=True)
            else:
                self.position_file.write_text(p.model_dump_json(), encoding="utf-8")
        except OSError:
            log.exception("could not persist position")

    def _restore_position(self) -> None:
        if self.position_file.exists():
            try:
                self.execution.position = ManagedPosition.model_validate_json(self.position_file.read_text(encoding="utf-8"))
                log.info("restored managed position from disk")
            except ValueError:
                log.error("corrupt position file ignored")

    def _flush_orders(self) -> None:
        for o in list(self.execution.order_log):
            if o["seq"] > self._orders_logged:
                self.db.add_order(self.mode.value, o)
                self._orders_logged = o["seq"]

    def _update_health(self, now: int) -> None:
        mh = self.market.health()
        required = [f"candle_{tf}" for tf in ("1m", "15m")] + ["book"]
        ages = [self.store.staleness_s(k, now) for k in required]
        self.health.data_age_s = max(ages) if ages else float("inf")
        self.health.ws_connected = mh["ws_connected"]
        self.health.ws_disconnects_10min = mh["ws_disconnects_10min"]
        self.health.rest_failures = max(self.health.rest_failures, mh["rest_consecutive_failures"])
        self.health.account_sync_age_s = (now - self.account_synced_ms) / 1000 if self.account_synced_ms else float("inf")
        self.health.execution_errors_10min = self.execution.errors_last_10min()
        book = self.store.book()
        self.health.spread_bps = book.spread_bps if book else None

    # ------------------------------------------------------------------ main tick
    async def tick(self) -> None:
        now = now_ms()
        await self.exchange.on_market_update()
        acct = await self._sync_account()
        self._update_health(now)
        if acct is not None:
            self.risk.update_equity(acct.equity, now)
            if now - self._last_equity_log >= 60_000:
                self.db.add_equity(now, self.mode.value, acct.equity, acct.balance, acct.unrealized_pnl,
                                   self.risk_state.drawdown_pct(acct.equity), self.risk_state.daily_pnl(acct.equity))
                self._last_equity_log = now
            await self._reconcile(acct)

        # circuit breakers
        blocked = []
        for action, why in self.risk.circuit_breakers(acct, self.health, now):
            if action == "halt" and self.kill_switch.state.value != "halted":
                self.kill_switch.halt(why, "risk_manager")
                self._event("error", "risk_manager", "kill_switch_halt", why)
                await self.notifier.notify("critical", f"🛑 KILL SWITCH: {why}")
            blocked.append(why)
        if self.kill_switch.pending_emergency:
            await self._emergency_procedure()

        snap = snapshot_from_store(self.store, now)
        pos = self.execution.position
        if pos is not None:
            reports = self.pipeline.analyze(snap)
            self.last_reports = reports
            await self._manage(pos, snap)
        else:
            res = self.pipeline.decide(snap, acct or AccountState(equity=0, balance=0), self.health)
            self.last_reports = res.reports
            sig = res.signal
            self.last_signal = sig
            self._record_signal(sig, now)
            if sig.actionable and self.kill_switch.entries_allowed and not blocked:
                key = (sig.strategy.value, sig.direction.value, res.setup.timeframe,
                       int(snap.get(res.setup.timeframe, "close_time", 0) or 0))
                if key not in self._attempted:
                    self._attempted.add(key)
                    await self._open(sig)
        self._flush_orders()
        self._save_position()
        await self._daily_report(now)

    def _record_signal(self, sig: TradeSignal, now: int) -> None:
        entry = {"ts": sig.timestamp, "direction": sig.direction.value, "strategy": sig.strategy.value,
                 "regime": sig.regime.value, "approved": bool(sig.risk and sig.risk.approved),
                 "score": sig.confidence.raw_score if sig.confidence else None, "reasons": sig.reasons[:5],
                 "rationale": sig.strategy_rationale}
        if sig.setup is not None or now - self._last_no_trade_log >= 300_000:
            self.signals.appendleft(entry)
            self.db.add_decision(self.mode.value, sig)
            if sig.setup is None:
                self._last_no_trade_log = now

    async def _open(self, sig: TradeSignal) -> None:
        self._event("info", "execution", "entry_attempt", f"{sig.strategy.value} {sig.direction.value} "
                    f"size {sig.size} risk ${sig.risk_usd:.2f}", {"reasons": sig.reasons})
        try:
            pos = await self.execution.open_position(sig)
        except CriticalExecutionError as exc:
            self.kill_switch.halt(f"critical execution error: {exc}", "execution_agent")
            self._event("error", "execution", "execution_critical", str(exc))
            await self.notifier.notify("critical", f"🛑 Erreur critique d'exécution: {exc}. Kill switch activé.")
            return
        if pos is not None:
            await self.notifier.notify("info", f"✅ {pos.direction.value} {pos.size} BTC @ {pos.entry_price:,.0f} "
                                               f"| SL {pos.stop_loss:,.0f} | TP {pos.take_profit or 0:,.0f} | "
                                               f"{pos.strategy.value} / {pos.regime.value}")

    async def _manage(self, pos: ManagedPosition, snap) -> None:
        strat = self.engine.strategies.get(pos.strategy)
        if strat is None:
            return
        act = strat.manage(pos, snap)
        if act.action == "update_stop" and act.new_stop is not None:
            await self.execution.update_stop(act.new_stop, act.reason)
        elif act.action == "close":
            if await self.execution.close_position(act.reason):
                await self._finalize(pos, act.reason)

    async def _finalize(self, pos: ManagedPosition, reason: str) -> None:
        trade = await self.execution.build_trade_record(pos, reason, self.mode.value)
        self.performance.record_trade(trade)
        self.risk.on_trade_closed(trade.net_pnl)
        self.execution.position = None
        self._save_position()
        self._event("info", "performance", "trade_closed", f"{trade.strategy.value} {trade.direction.value} "
                    f"net {trade.net_pnl:+.2f} ({trade.r_multiple:+.2f}R) — {reason}")
        await self.notifier.notify("info", f"{'🟩' if trade.net_pnl > 0 else '🟥'} Trade clôturé {trade.direction.value} "
                                           f"{trade.net_pnl:+.2f} USD ({trade.r_multiple:+.2f}R) — {reason}")

    async def _reconcile(self, acct: AccountState) -> None:
        res = reconcile(self.execution.position, acct, self.store.coin)
        self.health.desync = res.desync
        self.health.desync_detail = res.detail
        if res.ok:
            return
        pos = self.execution.position
        if "closed" in res.actions and pos is not None:
            await self.execution._cancel_protection()
            await self._finalize(pos, "exchange stop/take-profit or external close")
            return
        if res.desync:
            self._event("error", "reconciliation", "desync", res.detail)
            if "protect_unmanaged" in res.actions or pos is not None:
                await self.execution.emergency_flatten(f"desync: {res.detail}")
            return
        if "adopt_size" in res.actions and pos is not None:
            pos.size = abs(res.exchange_size)
            self._event("warning", "reconciliation", "adopt_size", f"adopted exchange size {res.exchange_size}")
            res.actions.append("missing_sl")  # resize protection
            for o in acct.open_orders:
                if o.reduce_only and o.is_trigger:
                    await self.exchange.cancel_order(oid=o.oid)
        if "missing_sl" in res.actions and pos is not None:
            self._event("error", "reconciliation", "missing_sl", "position without verified stop — reinstalling")
            sl = await self.execution._place_stop(pos.direction == Direction.LONG, pos.size, pos.stop_loss)
            if sl is None:
                await self.execution.emergency_flatten("stop-loss could not be reinstalled")
                self.kill_switch.halt("stop-loss could not be reinstalled", "reconciliation")
            else:
                pos.sl_oid, pos.sl_cloid = sl
        if "stray_orders" in res.actions:
            for oid in res.stray_order_ids:
                await self.exchange.cancel_order(oid=oid)
            self._event("warning", "reconciliation", "stray_orders", f"cancelled incoherent orders {res.stray_order_ids}")

    async def _emergency_procedure(self) -> None:
        policy = self.s.emergency_position_policy
        self._event("error", "kill_switch", "emergency", f"emergency procedure (policy={policy}): {self.kill_switch.reason}")
        if policy == "flatten":
            ok = await self.execution.emergency_flatten(self.kill_switch.reason)
            if ok and self.execution.position is not None:
                await self._finalize(self.execution.position, f"emergency: {self.kill_switch.reason}")
        else:
            await self.execution.cancel_entries_keep_protection()
            ok = True
        if ok:
            self.kill_switch.emergency_done()
        await self.notifier.notify("critical", f"🚨 Procédure d'urgence ({policy}) {'terminée' if ok else 'ÉCHEC — intervention manuelle requise'}")

    async def _daily_report(self, now: int) -> None:
        day = now // 86_400_000
        if day != self._last_daily_report_day and (now % 86_400_000) >= 5 * 60_000:
            if self._last_daily_report_day != -1:
                await self.notifier.notify("info", self.performance.daily_report_text(self.risk.risk_status(self.account)))
            self._last_daily_report_day = day

    # ------------------------------------------------------------------ controls (dashboard / Telegram)
    async def pause(self, source: str) -> str:
        self.kill_switch.pause("paused by operator", source)
        self._event("warning", source, "pause", "new entries paused")
        return "paused"

    async def resume(self, source: str) -> str:
        self.kill_switch.resume(source)  # raises if HALTED
        self._event("info", source, "resume", "entries resumed")
        return "running"

    async def emergency_stop(self, source: str) -> str:
        self.kill_switch.halt(f"emergency stop requested by {source}", source)
        async with self._lock:
            await self._emergency_procedure()
        return "halted"

    # ------------------------------------------------------------------ state for API
    def state(self) -> dict:
        acct = self.account
        risk_status = self.risk.risk_status(acct)
        return {
            "mode": self.mode.value,
            "started_ms": self.started_ms,
            "loops": self.loops,
            "last_error": self.last_error,
            "account": acct.model_dump() if acct else None,
            "position": self.execution.position.model_dump() if self.execution.position else None,
            "risk": risk_status,
            "health": self.health.__dict__,
            "market_health": self.market.health(),
            "last_signal": self.last_signal.model_dump(mode="json", exclude={"setup": {"features"}}) if self.last_signal else None,
            "signals": list(self.signals)[:50],
            "ml": self.ml_status,
            "active_strategy": self.engine.active_strategy.value,
            "regime": self.regime.stable.value,
        }

    def agents_state(self) -> list[dict]:
        return [a.state() for a in (self.scanner, self.technical, self.liquidity, self.regime, self.engine, self.risk,
                                    self.execution, self.performance)]


def mode_request_path(settings: Settings) -> Path:
    return settings.runtime_dir / "mode_request.json"


def write_mode_request(settings: Settings, mode: str, source: str) -> dict:
    if mode not in ("paper", "testnet"):
        raise ValueError("only paper or testnet can be requested from the dashboard (LIVE needs the CLI procedure)")
    d = {"requested_mode": mode, "source": source, "ts": now_ms(),
         "note": "applied only after a manual restart with TRADING_MODE set accordingly"}
    mode_request_path(settings).write_text(json.dumps(d), encoding="utf-8")
    return d
