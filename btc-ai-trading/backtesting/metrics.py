"""Performance metrics shared by the backtester and the Performance Analyst.

The win rate alone never validates a strategy: validation uses profit
factor after costs, sample size, drawdown, net expectancy and the
stability of results across periods and regimes.
"""
from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable

import numpy as np
import pandas as pd

from core.models import TradeRecord

VALIDATION_THRESHOLDS = {
    "min_profit_factor": 1.2,
    "min_trades": 100,
    "max_drawdown_pct": 8.0,
    "min_expectancy_usd": 0.0,
}


def _pf(wins: float, losses: float) -> float | None:
    if losses == 0:
        return None if wins == 0 else math.inf
    return wins / abs(losses)


def trade_metrics(trades: Iterable[TradeRecord]) -> dict:
    trades = list(trades)
    n = len(trades)
    if n == 0:
        return {"trades": 0, "wins": 0, "losses": 0, "win_rate": None, "net_pnl": 0.0, "profit_factor": None,
                "expectancy_usd": None, "expectancy_r": None, "fees": 0.0, "funding": 0.0, "slippage": 0.0,
                "gross_pnl": 0.0, "avg_win": None, "avg_loss": None, "payoff_ratio": None,
                "max_consecutive_losses": 0, "avg_hold_minutes": None}
    net = np.array([t.net_pnl for t in trades])
    wins, losses = net[net > 0], net[net <= 0]
    streak = best = 0
    for v in net:
        streak = streak + 1 if v <= 0 else 0
        best = max(best, streak)
    pf = _pf(wins.sum(), losses.sum())
    avg_win = float(wins.mean()) if len(wins) else None
    avg_loss = float(losses.mean()) if len(losses) else None
    return {
        "trades": n,
        "wins": int(len(wins)),
        "losses": int(len(losses)),
        "win_rate": float(len(wins) / n),
        "gross_pnl": float(sum(t.gross_pnl for t in trades)),
        "net_pnl": float(net.sum()),
        "profit_factor": None if pf is None else (float(pf) if math.isfinite(pf) else "inf"),
        "expectancy_usd": float(net.mean()),
        "expectancy_r": float(np.mean([t.r_multiple for t in trades])),
        "fees": float(sum(t.fees for t in trades)),
        "funding": float(sum(t.funding for t in trades)),
        "slippage": float(sum(t.slippage_cost for t in trades)),
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "payoff_ratio": (avg_win / abs(avg_loss)) if avg_win and avg_loss else None,
        "max_consecutive_losses": int(best),
        "avg_hold_minutes": float(np.mean([(t.exit_time - t.entry_time) / 60_000 for t in trades])),
    }


def equity_metrics(equity: pd.Series, initial: float) -> dict:
    """`equity` indexed by timestamp (ms)."""
    if equity is None or len(equity) < 2:
        return {"return_pct": 0.0, "max_drawdown_pct": 0.0, "sharpe": None, "sortino": None}
    eq = equity.astype(float)
    peak = eq.cummax()
    dd = ((peak - eq) / peak * 100).max()
    idx = pd.to_datetime(eq.index, unit="ms", utc=True)
    daily = pd.Series(eq.to_numpy(), index=idx).resample("1D").last().dropna()
    rets = daily.pct_change().dropna()
    sharpe = sortino = None
    if len(rets) >= 10 and rets.std() > 0:
        sharpe = float(rets.mean() / rets.std() * math.sqrt(365))
        downside = rets[rets < 0]
        if len(downside) > 1 and downside.std() > 0:
            sortino = float(rets.mean() / downside.std() * math.sqrt(365))
    return {
        "return_pct": float((eq.iloc[-1] / initial - 1) * 100),
        "max_drawdown_pct": float(dd),
        "sharpe": sharpe,
        "sortino": sortino,
        "days": float((eq.index[-1] - eq.index[0]) / 86_400_000),
    }


def grouped(trades: Iterable[TradeRecord], key: str) -> dict[str, dict]:
    groups: dict[str, list] = defaultdict(list)
    for t in trades:
        v = getattr(t, key)
        groups[getattr(v, "value", str(v))].append(t)
    return {k: trade_metrics(v) for k, v in sorted(groups.items())}


def period_stability(trades: list[TradeRecord], n_periods: int = 4) -> list[dict]:
    """Split the trade list chronologically into n periods and report each."""
    if not trades:
        return []
    trades = sorted(trades, key=lambda t: t.entry_time)
    t0, t1 = trades[0].entry_time, trades[-1].exit_time
    edges = np.linspace(t0, t1 + 1, n_periods + 1)
    out = []
    for a, b in zip(edges[:-1], edges[1:]):
        sub = [t for t in trades if a <= t.entry_time < b]
        m = trade_metrics(sub)
        m.update({"from_ms": int(a), "to_ms": int(b)})
        out.append(m)
    return out


def validate(metrics: dict, eq_metrics: dict, periods: list[dict], thresholds: dict | None = None) -> dict:
    th = thresholds or VALIDATION_THRESHOLDS
    pf = metrics.get("profit_factor")
    pf_val = math.inf if pf == "inf" else (pf or 0.0)
    profitable_periods = sum(1 for p in periods if p["trades"] > 0 and p["net_pnl"] > 0)
    active_periods = sum(1 for p in periods if p["trades"] > 0)
    checks = {
        "profit_factor_after_costs": {"value": pf, "threshold": f"> {th['min_profit_factor']}", "pass": pf_val > th["min_profit_factor"]},
        "sample_size": {"value": metrics["trades"], "threshold": f">= {th['min_trades']}", "pass": metrics["trades"] >= th["min_trades"]},
        "max_drawdown": {"value": eq_metrics.get("max_drawdown_pct"), "threshold": f"< {th['max_drawdown_pct']}%",
                         "pass": (eq_metrics.get("max_drawdown_pct") or 0) < th["max_drawdown_pct"]},
        "net_expectancy": {"value": metrics.get("expectancy_usd"), "threshold": "> 0",
                           "pass": (metrics.get("expectancy_usd") or 0) > th["min_expectancy_usd"]},
        "period_stability": {"value": f"{profitable_periods}/{active_periods} profitable periods",
                             "threshold": ">= 75% of active periods profitable",
                             "pass": active_periods >= 3 and profitable_periods >= 0.75 * active_periods},
    }
    return {"passed": all(c["pass"] for c in checks.values()), "checks": checks}
