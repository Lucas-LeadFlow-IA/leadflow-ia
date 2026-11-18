"""Run the strategy comparison backtests on local Hyperliquid history.

Usage:
  python scripts/run_backtest.py                 # full comparison (5 runs)
  python scripts/run_backtest.py --only intraday --base-tf 15m
  python scripts/run_backtest.py --research      # also run strategies without regime gating

Each strategy runs on the finest timeframe it needs; the available depth
of that timeframe on Hyperliquid limits the test window (see README).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backtesting.costs import CostModel  # noqa: E402
from backtesting.engine import BacktestConfig, load_data, Backtester  # noqa: E402
from backtesting.report import write_report  # noqa: E402
from config.settings import PROJECT_ROOT, get_settings  # noqa: E402
from core.models import StrategyName  # noqa: E402

RUNS = [
    ("Scalping", StrategyName.SCALPING, "1m"),
    ("Intraday", StrategyName.INTRADAY, "15m"),
    ("Trend following", StrategyName.TREND_FOLLOWING, "1h"),
    ("Range trading", StrategyName.RANGE_TRADING, "15m"),
    ("Adaptive (15m)", None, "15m"),
    ("Adaptive (1h, long history)", None, "1h"),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=[s.value for s in StrategyName if s != StrategyName.NONE] + ["adaptive"])
    ap.add_argument("--base-tf")
    ap.add_argument("--research", action="store_true", help="add runs without regime gating")
    ap.add_argument("--out", default=str(PROJECT_ROOT / "reports"))
    args = ap.parse_args()
    s = get_settings()
    costs = CostModel.from_settings(s)
    runs = RUNS
    if args.only:
        strat = None if args.only == "adaptive" else StrategyName(args.only)
        runs = [(r[0], r[1], args.base_tf or r[2]) for r in RUNS if r[1] == strat][:1] or [(args.only, strat, args.base_tf or "15m")]
    cache = {}
    results = []
    plan = list(runs)
    if args.research:
        plan += [(f"{n} [no regime gating]", st, tf) for n, st, tf in runs if st is not None]
    for name, strat, tf in plan:
        t0 = time.time()
        if tf not in cache:
            cache[tf] = load_data(s.data_dir, tf)
        cfg = BacktestConfig(base_tf=tf, strategy=strat, label=name, costs=costs, limits=s.risk_limits,
                             min_score=s.min_setup_score, initial_equity=s.initial_capital_usd,
                             ignore_regime="no regime gating" in name)
        res = Backtester(cache[tf], cfg).run()
        print(f"{name:<40} trades={len(res.trades):>4} final={res.equity.iloc[-1]:>9.2f} ({time.time() - t0:.1f}s)")
        results.append(res)
    md, js, _ = write_report(results, Path(args.out), "BTC strategies comparison — Hyperliquid")
    print(f"report: {md}\njson:   {js}")


if __name__ == "__main__":
    main()
