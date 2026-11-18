"""AGENT 5 — ADAPTIVE STRATEGY ENGINE.

Selects a strategy from the stable market regime (playbook), lets each
eligible strategy evaluate the market, scores the candidates and returns
the best setup — or NO TRADE. It explains which regime was detected, why
the strategy was chosen, why the entry is relevant and what would
invalidate it.

Anti flip-flop: the playbook is driven by the *stable* regime (with
hysteresis in the Regime Detector), and a strategy forced to restrict
itself (`force_strategy`) is only used for single-strategy backtests.
"""
from __future__ import annotations

from agents.base import BaseAgent
from backtesting.costs import CostModel
from core.models import AgentReport, Direction, Regime, StrategyName, TradeSetup
from core.snapshot import MarketSnapshot
from strategies.base import Strategy, StrategyContext
from strategies.registry import PLAYBOOK


class StrategyEngine(BaseAgent):
    name = "strategy_engine"
    role = "Cerveau stratégique: sélectionne scalping / intraday / trend following / range ou NO TRADE"

    def __init__(self, strategies: dict[StrategyName, Strategy], costs: CostModel,
                 enabled: list[StrategyName] | None = None, min_score: float = 60.0,
                 force_strategy: StrategyName | None = None, ignore_regime: bool = False):
        super().__init__()
        self.strategies = strategies
        self.costs = costs
        self.enabled = set(enabled or strategies.keys())
        self.min_score = min_score
        self.force_strategy = force_strategy
        self.ignore_regime = ignore_regime
        self.active_strategy: StrategyName = StrategyName.NONE

    def decide(self, snap: MarketSnapshot, technical: AgentReport, liquidity: AgentReport,
               regime_report: AgentReport) -> tuple[TradeSetup | None, AgentReport]:
        regime = Regime(regime_report.data["regime"])
        eligible, directions, extra = PLAYBOOK.get(regime, ([], (), 0.0))
        if self.ignore_regime:
            # single-strategy research mode: the strategy runs in every regime except safety ones
            if regime in (Regime.NEWS_DRIVEN, Regime.UNSTABLE):
                eligible, directions, extra = [], (), 0.0
            else:
                eligible, directions, extra = list(self.strategies.keys()), (Direction.LONG, Direction.SHORT), 0.0
        if self.force_strategy is not None:
            eligible = [s for s in eligible if s == self.force_strategy]
        eligible = [s for s in eligible if s in self.enabled and s in self.strategies]
        self.active_strategy = eligible[0] if eligible else StrategyName.NONE
        threshold = self.min_score + extra

        notes: list[str] = []
        candidates: list[TradeSetup] = []
        if not eligible:
            rationale = (f"Regime '{regime.value}': no strategy allowed -> NO TRADE. "
                         + "; ".join(regime_report.data.get("reasons", [])))
        else:
            ctx = StrategyContext(snap, technical, liquidity, regime_report, self.costs, directions, notes)
            for name in eligible:
                try:
                    setup = self.strategies[name].evaluate(ctx)
                except Exception as exc:  # noqa: BLE001 - a strategy bug must not stop the engine
                    self.record_error(exc, f"strategy {name.value}")
                    notes.append(f"{name.value}: error {exc}")
                    continue
                if setup is None:
                    continue
                rt = self.costs.round_trip_rate(setup.entry_type) * setup.entry_price
                if setup.take_profit is not None and abs(setup.take_profit - setup.entry_price) < 2.0 * rt:
                    notes.append(f"{name.value}: target smaller than 2x round-trip costs")
                    continue
                if setup.score < threshold:
                    notes.append(f"{name.value}: score {setup.score:.0f} < threshold {threshold:.0f}")
                    candidates.append(setup)
                    continue
                candidates.append(setup)
            rationale = ""

        valid = [c for c in candidates if c.score >= threshold]
        chosen: TradeSetup | None = None
        if valid:
            order = {n: i for i, n in enumerate(eligible)}
            chosen = sorted(valid, key=lambda c: (-c.score, order.get(c.strategy, 99)))[0]
            rationale = (
                f"Regime '{regime.value}' -> playbook {[e.value for e in eligible]}. "
                f"Selected {chosen.strategy.value} {chosen.direction.value} (score {chosen.score:.0f} >= {threshold:.0f}) "
                f"over {len(valid) - 1} other valid candidate(s)."
            )
        elif eligible:
            rationale = (f"Regime '{regime.value}' -> playbook {[e.value for e in eligible]}, "
                         f"but no setup met the conditions/threshold -> NO TRADE.")

        data = {
            "regime": regime.value,
            "eligible": [e.value for e in eligible],
            "allowed_directions": [d.value for d in directions],
            "active_strategy": self.active_strategy.value,
            "threshold": threshold,
            "selected": chosen.model_dump(exclude={"features"}) if chosen else None,
            "candidates": [{"strategy": c.strategy.value, "direction": c.direction.value, "score": round(c.score, 1),
                            "components": c.score_components} for c in candidates],
            "rejections": notes[-20:],
            "rationale": rationale,
        }
        summary = (f"{chosen.strategy.value} {chosen.direction.value} score {chosen.score:.0f}" if chosen
                   else f"NO TRADE ({regime.value})")
        report = self.record(AgentReport(agent=self.name, timestamp=snap.timestamp, summary=summary, data=data))
        return chosen, report
