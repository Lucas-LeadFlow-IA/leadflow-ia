"""Walk-forward study of trend-following exit variants on 1h history.

  python scripts/walk_forward_study.py

The variants are hypotheses derived from the baseline report (early CHOCH
exits, target size, trailing width). Selection happens on past data
only; the OOS line is what matters.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backtesting.costs import CostModel  # noqa: E402
from backtesting.engine import BacktestConfig, load_data  # noqa: E402
from backtesting.walk_forward import walk_forward_select  # noqa: E402
from config.settings import PROJECT_ROOT, get_settings  # noqa: E402
from core.models import StrategyName  # noqa: E402

TF = "trend_following"
VARIANTS = {
    "baseline": {},
    "no_choch_exit": {TF: {"use_choch_invalidation": False}},
    "no_choch_target3": {TF: {"use_choch_invalidation": False, "target_r": 3.0}},
    "no_choch_trail2.5": {TF: {"use_choch_invalidation": False, "trail_atr": 2.5}},
    "target3": {TF: {"target_r": 3.0}},
    "wide_trail": {TF: {"trail_atr": 4.0, "trail_start_r": 2.5}},
}


def _d(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def main() -> None:
    s = get_settings()
    data = load_data(s.data_dir, "1h")
    cfg = BacktestConfig(base_tf="1h", strategy=StrategyName.TREND_FOLLOWING, costs=CostModel.from_settings(s),
                         limits=s.risk_limits, min_score=s.min_setup_score, initial_equity=s.initial_capital_usd)
    res = walk_forward_select(data, cfg, VARIANTS, n_folds=4)
    lines = ["# Walk-forward study — trend following exit variants (1h)", "",
             "Variant chosen on each TRAIN window (best profit factor, >= 10 trades), then evaluated on the next TEST window.", "",
             "| Test window | Chosen | Test trades | Test PF | Test net $ | Baseline trades | Baseline PF | Baseline net $ |",
             "|---|---|---|---|---|---|---|---|"]
    for f in res["folds"]:
        ts, tb = f["test_selected"], f["test_baseline"]
        lines.append(f"| → {_d(f['test_until_ms'])} | {f['chosen']} | {ts['trades']} | {ts['profit_factor']} | {ts['net_pnl']:.2f} | "
                     f"{tb['trades']} | {tb['profit_factor']} | {tb['net_pnl']:.2f} |")
    o, b = res["oos_selected"], res["oos_baseline"]
    lines += ["", f"**OOS walk-forward selection**: {o['trades']} trades, PF {o['profit_factor']}, net {o['net_pnl']:.2f} $, "
              f"expectancy {o['expectancy_usd']}", "",
              f"**OOS fixed baseline**: {b['trades']} trades, PF {b['profit_factor']}, net {b['net_pnl']:.2f} $, "
              f"expectancy {b['expectancy_usd']}", ""]
    out = PROJECT_ROOT / "reports"
    out.mkdir(exist_ok=True)
    (out / "walk_forward_trend.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (out / "walk_forward_trend.json").write_text(json.dumps(res, indent=1, default=str), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
