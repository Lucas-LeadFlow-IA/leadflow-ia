"""Decision pipeline shared by live trading and the backtester.

Order (spec §4): Market Scanner -> Technical Analyst -> Liquidity Analyst
-> Market Regime -> Strategy Engine -> (ML filter, optional) -> Risk
Manager. Execution and performance recording happen outside, in the
orchestrator (live) or the simulator (backtest).

The final `TradeSignal` always contains direction (LONG/SHORT/NO TRADE),
strategy, regime, entry, stop, take-profit, size, risk in USD, estimated
cost, confidence and the reasons — including for refused trades.
"""
from __future__ import annotations

from dataclasses import dataclass

from agents.liquidity_analyst import LiquidityAnalyst
from agents.market_scanner import MarketScanner
from agents.regime_detector import RegimeDetector
from agents.risk_manager import RiskManager, SystemHealth
from agents.strategy_engine import StrategyEngine
from agents.technical_analyst import TechnicalAnalyst
from core.models import AccountState, AgentReport, Confidence, Direction, Regime, StrategyName, TradeSetup, TradeSignal
from core.snapshot import MarketSnapshot


@dataclass
class PipelineResult:
    signal: TradeSignal
    reports: dict[str, AgentReport]
    setup: TradeSetup | None


class DecisionPipeline:
    def __init__(self, scanner: MarketScanner | None, technical: TechnicalAnalyst, liquidity: LiquidityAnalyst,
                 regime: RegimeDetector, engine: StrategyEngine, risk: RiskManager,
                 calibrator=None, trade_filter=None):
        self.scanner = scanner
        self.technical = technical
        self.liquidity = liquidity
        self.regime = regime
        self.engine = engine
        self.risk = risk
        self.calibrator = calibrator
        self.trade_filter = trade_filter

    def analyze(self, snap: MarketSnapshot) -> dict[str, AgentReport]:
        reports: dict[str, AgentReport] = {}
        if self.scanner is not None:
            reports["scan"] = self.scanner.analyze(snap)
        reports["technical"] = self.technical.analyze(snap)
        reports["liquidity"] = self.liquidity.analyze(snap)
        reports["regime"] = self.regime.analyze(snap)
        return reports

    def confidence(self, setup: TradeSetup) -> Confidence:
        if self.calibrator is not None:
            return self.calibrator.confidence(setup)
        return Confidence(raw_score=setup.score)

    def decide(self, snap: MarketSnapshot, account: AccountState, health: SystemHealth,
               evaluate_risk: bool = True) -> PipelineResult:
        reports = self.analyze(snap)
        regime = Regime(reports["regime"].data["regime"])
        setup, eng = self.engine.decide(snap, reports["technical"], reports["liquidity"], reports["regime"])
        reports["strategy"] = eng
        if setup is None:
            sig = TradeSignal(timestamp=snap.timestamp, regime=regime, strategy=self.engine.active_strategy,
                              reasons=eng.data.get("rejections", [])[-5:] or reports["regime"].data.get("reasons", []),
                              strategy_rationale=eng.data.get("rationale", ""))
            return PipelineResult(sig, reports, None)

        conf = self.confidence(setup)
        reasons = list(setup.reasons)
        if self.trade_filter is not None and self.trade_filter.enabled:
            p = self.trade_filter.predict_proba(setup, regime.value)
            if p is not None and p < self.trade_filter.threshold:
                sig = TradeSignal(timestamp=snap.timestamp, regime=regime, strategy=setup.strategy,
                                  entry_price=setup.entry_price, stop_loss=setup.stop_loss, take_profit=setup.take_profit,
                                  confidence=conf, setup=setup, strategy_rationale=eng.data.get("rationale", ""),
                                  reasons=[f"ML trade filter: p(win)={p:.2f} < {self.trade_filter.threshold:.2f}"] + reasons,
                                  invalidations=setup.invalidations)
                return PipelineResult(sig, reports, setup)
        if not evaluate_risk:
            sig = TradeSignal(timestamp=snap.timestamp, direction=setup.direction, strategy=setup.strategy, regime=regime,
                              entry_price=setup.entry_price, stop_loss=setup.stop_loss, take_profit=setup.take_profit,
                              confidence=conf, reasons=reasons, invalidations=setup.invalidations, setup=setup,
                              strategy_rationale=eng.data.get("rationale", ""))
            return PipelineResult(sig, reports, setup)

        verdict = self.risk.evaluate(setup, account, health, regime, snap.funding_rate, ts=snap.timestamp)
        reports["risk"] = self.risk.last_report
        direction = setup.direction if verdict.approved else Direction.NO_TRADE
        sig = TradeSignal(
            timestamp=snap.timestamp, direction=direction, strategy=setup.strategy if verdict.approved else StrategyName(setup.strategy),
            regime=regime, entry_price=setup.entry_price, stop_loss=setup.stop_loss, take_profit=setup.take_profit,
            size=verdict.size, risk_usd=verdict.risk_usd, est_cost_usd=verdict.est_cost_usd, confidence=conf,
            reasons=(reasons if verdict.approved else ["RISK VETO: " + "; ".join(verdict.reasons)] + reasons),
            invalidations=setup.invalidations, strategy_rationale=eng.data.get("rationale", ""), risk=verdict, setup=setup,
        )
        return PipelineResult(sig, reports, setup)
