"""Walk-forward selection of strategy variants (anti-overfitting protocol).

For each fold: every variant is backtested on the TRAIN window only, the
best one (by profit factor, with a minimum number of trades) is selected,
and only that variant is run on the following TEST window. The reported
result is the concatenation of the test windows — the selection never
saw them. Compare it with the fixed baseline on the same test windows.
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np

from backtesting.engine import BacktestConfig, BacktestData, Backtester
from backtesting.metrics import trade_metrics


def _pf_value(m: dict) -> float:
    pf = m.get("profit_factor")
    if pf == "inf":
        return 99.0
    return float(pf) if pf is not None else 0.0


def walk_forward_select(data: BacktestData, base_cfg: BacktestConfig, variants: dict[str, dict],
                        n_folds: int = 4, min_train_frac: float = 0.4, min_train_trades: int = 10) -> dict:
    t = data.base["open_time"].to_numpy(np.int64)
    warm = base_cfg.warmup_bars
    start_i = warm + int((len(t) - warm) * min_train_frac)
    edges = np.linspace(start_i, len(t) - 1, n_folds + 1).astype(int)
    folds, oos_selected, oos_baseline = [], [], []
    for a, b in zip(edges[:-1], edges[1:]):
        train_cfg = dict(start_ms=int(t[warm]), end_ms=int(t[a]))
        test_cfg = dict(start_ms=int(t[a]), end_ms=int(t[b]))
        scores = {}
        for name, overrides in variants.items():
            cfg = replace(base_cfg, strategy_overrides=overrides, label=f"{name} train", **train_cfg)
            m = trade_metrics(Backtester(data, cfg).run().trades)
            scores[name] = {"pf": _pf_value(m), "trades": m["trades"], "net": m["net_pnl"]}
        eligible = {k: v for k, v in scores.items() if v["trades"] >= min_train_trades} or scores
        chosen = max(eligible, key=lambda k: (eligible[k]["pf"], eligible[k]["net"]))
        sel = Backtester(data, replace(base_cfg, strategy_overrides=variants[chosen], label=f"{chosen} test", **test_cfg)).run()
        base = Backtester(data, replace(base_cfg, strategy_overrides=variants["baseline"], label="baseline test", **test_cfg)).run()
        oos_selected += sel.trades
        oos_baseline += base.trades
        folds.append({"train_until_ms": int(t[a]), "test_until_ms": int(t[b]), "chosen": chosen, "train_scores": scores,
                      "test_selected": trade_metrics(sel.trades), "test_baseline": trade_metrics(base.trades)})
    return {"folds": folds, "oos_selected": trade_metrics(oos_selected), "oos_baseline": trade_metrics(oos_baseline),
            "variants": variants}
