"""Backtest reports (Markdown + JSON + equity CSV)."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from backtesting.engine import BacktestResult
from backtesting.metrics import equity_metrics, grouped, period_stability, trade_metrics, validate


def _d(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


def summarize(res: BacktestResult, n_periods: int = 4) -> dict:
    tm = trade_metrics(res.trades)
    em = equity_metrics(res.equity, res.config.initial_equity)
    periods = period_stability(res.trades, n_periods)
    cfg = res.config
    return {
        "label": cfg.label,
        "base_tf": cfg.base_tf,
        "strategy": cfg.strategy.value if cfg.strategy else "adaptive",
        "ignore_regime": cfg.ignore_regime,
        "period": {"from": _d(res.period[0]), "to": _d(res.period[1]), "bars": res.bars},
        "initial_equity": cfg.initial_equity,
        "final_equity": float(res.equity.iloc[-1]) if len(res.equity) else cfg.initial_equity,
        "trade_metrics": tm,
        "equity_metrics": em,
        "by_strategy": grouped(res.trades, "strategy"),
        "by_regime": grouped(res.trades, "regime"),
        "by_direction": grouped(res.trades, "direction"),
        "by_exit_reason": grouped(res.trades, "exit_reason"),
        "periods": periods,
        "validation": validate(tm, em, periods),
        "setups_seen": res.decisions,
        "risk_vetoes": res.vetoes,
        "regime_time_share": {k: round(v / max(1, sum(res.regime_counts.values())), 3) for k, v in res.regime_counts.items()},
        "halted": {"at": _d(res.halted_at) if res.halted_at else None, "reason": res.halted_reason},
        "costs": {"taker": cfg.costs.taker_fee, "maker": cfg.costs.maker_fee, "slip_market_bps": cfg.costs.slippage_bps_market,
                  "slip_stop_bps": cfg.costs.slippage_bps_stop},
    }


def _fmt(v, nd=2):
    if v is None:
        return "–"
    if isinstance(v, str):
        return v
    if isinstance(v, float):
        return f"{v:,.{nd}f}"
    return str(v)


def to_markdown(summaries: list[dict], title: str = "Backtest report") -> str:
    lines = [f"# {title}", "", f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC. "
             "Data: Hyperliquid BTC perpetual candles + hourly funding history (read-only API).", "",
             "> Results are historical simulations after fees, slippage and funding. They are not a guarantee of "
             "future returns. A strategy is only considered validated if every criterion below passes.", ""]
    lines += ["## Comparison", "",
              "| Run | Base TF | Period | Trades | Win rate | PF | Expectancy $ | Net P&L $ | Fees $ | Funding $ | Max DD % | Sharpe | Validated |",
              "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for s in summaries:
        t, e = s["trade_metrics"], s["equity_metrics"]
        wr = None if t["win_rate"] is None else f"{t['win_rate'] * 100:.1f}%"
        lines.append(f"| {s['label']} | {s['base_tf']} | {s['period']['from'][:10]} → {s['period']['to'][:10]} | {t['trades']} | "
                     f"{_fmt(wr)} | {_fmt(t['profit_factor'])} | {_fmt(t['expectancy_usd'])} | {_fmt(t['net_pnl'])} | "
                     f"{_fmt(t['fees'])} | {_fmt(t['funding'])} | {_fmt(e['max_drawdown_pct'])} | {_fmt(e['sharpe'])} | "
                     f"{'YES' if s['validation']['passed'] else 'NO'} |")
    for s in summaries:
        t = s["trade_metrics"]
        lines += ["", f"## {s['label']}", "",
                  f"- Strategy: **{s['strategy']}**{' (regime gating disabled — research mode)' if s['ignore_regime'] else ''}",
                  f"- Period: {s['period']['from']} → {s['period']['to']} UTC ({s['period']['bars']} bars of {s['base_tf']})",
                  f"- Equity: {s['initial_equity']:,.2f} → {s['final_equity']:,.2f} USD "
                  f"({_fmt(s['equity_metrics']['return_pct'])}%)",
                  f"- Setups seen: {s['setups_seen']}, risk vetoes: {s['risk_vetoes']}",
                  f"- Avg win / loss: {_fmt(t['avg_win'])} / {_fmt(t['avg_loss'])} USD, payoff {_fmt(t['payoff_ratio'])}, "
                  f"max consecutive losses {t['max_consecutive_losses']}, avg hold {_fmt(t['avg_hold_minutes'], 0)} min",
                  f"- Slippage cost: {_fmt(t['slippage'])} USD",
                  f"- Regime time share: " + ", ".join(f"{k} {v * 100:.0f}%" for k, v in s["regime_time_share"].items())]
        if s["halted"]["at"]:
            lines.append(f"- **Kill switch halted the run** at {s['halted']['at']}: {s['halted']['reason']}")
        lines += ["", "### Validation", "", "| Criterion | Value | Threshold | Pass |", "|---|---|---|---|"]
        for k, ck in s["validation"]["checks"].items():
            lines.append(f"| {k} | {_fmt(ck['value'])} | {ck['threshold']} | {'✅' if ck['pass'] else '❌'} |")
        for name, key in (("By strategy", "by_strategy"), ("By regime", "by_regime"), ("By direction", "by_direction"),
                          ("By exit reason", "by_exit_reason")):
            if not s[key]:
                continue
            lines += ["", f"### {name}", "", "| Group | Trades | Win rate | PF | Expectancy $ | Net $ |", "|---|---|---|---|---|---|"]
            for g, m in s[key].items():
                wr = None if m["win_rate"] is None else f"{m['win_rate'] * 100:.0f}%"
                lines.append(f"| {g} | {m['trades']} | {_fmt(wr)} | {_fmt(m['profit_factor'])} | {_fmt(m['expectancy_usd'])} | {_fmt(m['net_pnl'])} |")
        if s["periods"]:
            lines += ["", "### Stability across periods", "", "| Period | Trades | PF | Net $ |", "|---|---|---|---|"]
            for p in s["periods"]:
                lines.append(f"| {_d(p['from_ms'])[:10]} → {_d(p['to_ms'])[:10]} | {p['trades']} | {_fmt(p['profit_factor'])} | {_fmt(p['net_pnl'])} |")
    return "\n".join(lines) + "\n"


def write_report(results: list[BacktestResult], out_dir: Path, title: str = "Backtest report") -> tuple[Path, Path, list[dict]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
    summaries = [summarize(r) for r in results]
    md = out_dir / f"backtest_{stamp}.md"
    js = out_dir / f"backtest_{stamp}.json"
    md.write_text(to_markdown(summaries, title), encoding="utf-8")
    js.write_text(json.dumps(summaries, indent=1, default=str), encoding="utf-8")
    for r in results:
        safe = (r.config.label or "run").replace(" ", "_").replace("/", "-")
        r.equity.rename("equity").to_csv(out_dir / f"equity_{stamp}_{safe}.csv", index_label="time_ms")
    (out_dir / "latest.json").write_text(json.dumps(summaries, indent=1, default=str), encoding="utf-8")
    return md, js, summaries
