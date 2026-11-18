"""AGENT 8 — PERFORMANCE ANALYST.

Records every closed trade and computes: win rate, profit factor,
expectancy, fees, funding, slippage, drawdown, Sharpe (when there is
enough history), performance by strategy and by regime, execution errors.

It identifies degrading strategies and writes *recommendations*. It never
changes production parameters: any change requires human validation and
new backtests / walk-forward tests.
"""
from __future__ import annotations

import time

import pandas as pd

from agents.base import BaseAgent
from backtesting.metrics import equity_metrics, grouped, trade_metrics
from core.models import AgentReport, TradeRecord
from database.repository import Database


class PerformanceAnalyst(BaseAgent):
    name = "performance_analyst"
    role = "Enregistre et analyse les performances; recommande sans jamais modifier la production"

    def __init__(self, db: Database, mode: str, initial_equity: float, min_trades_for_verdict: int = 20):
        super().__init__()
        self.db = db
        self.mode = mode
        self.initial_equity = initial_equity
        self.min_trades = min_trades_for_verdict

    def record_trade(self, trade: TradeRecord) -> None:
        self.db.add_trade(trade)
        self.analyze()

    def analyze(self) -> AgentReport:
        trades = self.db.trades(self.mode, limit=5000)
        tm = trade_metrics(trades)
        eq = self.db.equity_curve(self.mode)
        em = equity_metrics(pd.Series([e["equity"] for e in eq], index=[e["ts"] for e in eq]), self.initial_equity) if eq else {}
        by_strategy = grouped(trades, "strategy")
        by_regime = grouped(trades, "regime")
        errors_7d = self.db.count_events(self.mode, "execution", int(time.time() * 1000) - 7 * 86_400_000)
        recs = []
        for name, m in by_strategy.items():
            pf = m["profit_factor"]
            pf_v = 99.0 if pf == "inf" else (pf or 0.0)
            if m["trades"] >= self.min_trades and pf_v < 1.0:
                recs.append(f"{name}: PF {pf_v:.2f} over {m['trades']} trades — degrading. Recommendation: disable "
                            "via ENABLED_STRATEGIES after human review and new walk-forward tests.")
            elif m["trades"] >= self.min_trades and pf_v >= 1.2:
                recs.append(f"{name}: PF {pf_v:.2f} over {m['trades']} trades — performing; keep monitoring.")
        if tm["trades"] < self.min_trades:
            recs.append(f"only {tm['trades']} trades recorded: no statistically meaningful verdict yet")
        data = {"overall": tm, "equity": em, "by_strategy": by_strategy, "by_regime": by_regime,
                "execution_errors_7d": errors_7d, "recommendations": recs,
                "auto_parameter_changes": "disabled by design"}
        pf = tm.get("profit_factor")
        summary = f"{tm['trades']} trades, net {tm['net_pnl']:+.2f} USD, PF {pf if pf is not None else '–'}"
        return self.record(AgentReport(agent=self.name, summary=summary, data=data))

    def daily_report_text(self, risk_status: dict) -> str:
        rep = self.analyze()
        o = rep.data["overall"]
        wr = "–" if o["win_rate"] is None else f"{o['win_rate'] * 100:.0f}%"
        lines = [
            f"📊 Rapport quotidien ({self.mode.upper()})",
            f"Equity: {risk_status.get('equity', 0):,.2f} USD | P&L jour: {risk_status.get('daily_pnl', 0):+.2f}",
            f"Drawdown: {risk_status.get('drawdown_pct', 0):.2f}% | Trades: {o['trades']} | Win rate: {wr}",
            f"PF: {o['profit_factor'] if o['profit_factor'] is not None else '–'} | Net total: {o['net_pnl']:+.2f} | "
            f"Frais: {o['fees']:.2f} | Funding: {o['funding']:.2f}",
        ]
        lines += [f"• {r}" for r in rep.data["recommendations"][:4]]
        return "\n".join(lines)
