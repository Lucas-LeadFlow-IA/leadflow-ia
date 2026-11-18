"""Train / evaluate the ML components with purged walk-forward validation.

  python scripts/train_models.py

Produces models/*.joblib|json and reports/ml_report.md. A component is
only marked `enabled` when it beats its baseline OUT OF SAMPLE (after
costs for the trade filter). Production never changes automatically:
enabling a model in live trading still requires a human to review the
report and restart the system.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backtesting.costs import CostModel  # noqa: E402
from backtesting.engine import Backtester, BacktestConfig, load_data  # noqa: E402
from config.settings import PROJECT_ROOT, get_settings  # noqa: E402
from machine_learning import anomaly, calibration, regime_model, trade_filter  # noqa: E402
from machine_learning.labeling import label_candidates  # noqa: E402


def collect(base_tf: str, settings, costs) -> list[dict]:
    data = load_data(settings.data_dir, base_tf)
    cfg = BacktestConfig(base_tf=base_tf, strategy=None, ignore_regime=True, record_candidates=True, costs=costs,
                         limits=settings.risk_limits, min_score=0.0, label=f"candidates {base_tf}")
    res = Backtester(data, cfg).run()
    rows = label_candidates(data.base, res.candidates, costs, base_tf)
    return rows, data


def main() -> None:
    s = get_settings()
    s.ensure_dirs()
    costs = CostModel.from_settings(s)
    t0 = time.time()
    rows15, _ = collect("15m", s, costs)
    rows1h, data1h = collect("1h", s, costs)
    # trend-following candidates come from the 1h run (longer history); others from 15m
    rows = [r for r in rows15 if r["strategy"] != "trend_following"] + [r for r in rows1h if r["strategy"] == "trend_following"]
    rows.sort(key=lambda r: r["i"])
    by_strat = {}
    for r in rows:
        d = by_strat.setdefault(r["strategy"], {"n": 0, "wins": 0, "sum_r": 0.0})
        d["n"] += 1
        d["wins"] += r["win"]
        d["sum_r"] += r["r"]
    print(f"labelled candidates: {len(rows)} ({time.time() - t0:.0f}s)")

    tf_report = trade_filter.evaluate_filter(rows)
    tf_path = trade_filter.train_and_save(rows, tf_report, s.models_dir)
    cal = calibration.evaluate_and_fit(rows)
    calibration.ConfidenceCalibrator(cal).save(s.models_dir)
    feat1h = data1h.features["1h"]
    rg = regime_model.evaluate(feat1h)
    regime_model.train_and_save(feat1h, rg, s.models_dir)
    an = anomaly.evaluate(feat1h)
    anomaly.train_and_save(feat1h, an, s.models_dir)

    report = {"generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "candidates": len(rows),
              "candidates_by_strategy": {k: {"n": v["n"], "win_rate": v["wins"] / v["n"], "mean_r": v["sum_r"] / v["n"]}
                                         for k, v in by_strat.items()},
              "trade_filter": {k: v for k, v in tf_report.items() if k != "columns"}, "trade_filter_file": str(tf_path),
              "calibration": {k: v for k, v in cal.items() if k not in ("x", "y")},
              "regime_model": rg, "anomaly": an}
    out = PROJECT_ROOT / "reports"
    out.mkdir(exist_ok=True)
    (out / "ml_report.json").write_text(json.dumps(report, indent=1, default=str), encoding="utf-8")
    (out / "ml_report.md").write_text(to_markdown(report), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("candidates", "candidates_by_strategy")}, indent=1))
    print("trade filter:", tf_report.get("best"), "enabled=", tf_report.get("enabled"), "-", tf_report.get("reason"))
    print("calibration:", cal.get("status"), "useful=", cal.get("useful"), cal.get("oos"))
    print("regime model:", rg.get("best"), rg.get("models", {}).get(rg.get("best"), {}), "rule:", rg.get("rule_baseline"), "useful=", rg.get("useful"))
    print("anomaly:", {k: an.get(k) for k in ("lift", "flagged_oos", "useful")})


def _f(v, nd=3):
    return "–" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v))


def to_markdown(r: dict) -> str:
    L = ["# Machine-learning evaluation (purged walk-forward, out-of-sample only)", "", f"Generated {r['generated']}.", "",
         "Every number below is out of sample: models are fitted on past folds only, with purge/embargo equal to the "
         "label horizon. A component is enabled only if it beats its baseline.", "",
         f"## Labelled candidate setups: {r['candidates']}", "", "| Strategy | Candidates | Win rate (net) | Mean net R |", "|---|---|---|---|"]
    for k, v in r["candidates_by_strategy"].items():
        L.append(f"| {k} | {v['n']} | {v['win_rate'] * 100:.1f}% | {v['mean_r']:+.3f} |")
    tf = r["trade_filter"]
    L += ["", "## Trade filter (meta-labeling)", "", f"Status: **{tf.get('status')}** — enabled: **{tf.get('enabled')}** — {tf.get('reason')}", ""]
    if tf.get("models"):
        L += ["| Model | OOS n | AUC | Brier | Brier base rate | Mean R all | Mean R kept | Kept |", "|---|---|---|---|---|---|---|---|"]
        for name, m in tf["models"].items():
            L.append(f"| {name} | {m['oos_samples']} | {_f(m['auc'])} | {_f(m['brier'])} | {_f(m['brier_baseline'])} | "
                     f"{_f(m['mean_r_all'])} | {_f(m['mean_r_kept'])} | {m['kept_fraction'] * 100:.0f}% |")
    c = r["calibration"]
    L += ["", "## Confidence calibration (score → P(net win))", "", f"Status: **{c.get('status')}**, samples {c.get('samples')}, "
          f"useful (beats base rate OOS): **{c.get('useful')}**, OOS: {c.get('oos')}"]
    g = r["regime_model"]
    L += ["", "## Regime classifier (forward trendiness, H1)", "", f"Status: {g.get('status')}, samples {g.get('samples')}, useful: **{g.get('useful')}**", ""]
    if g.get("models"):
        L += ["| Model | Balanced acc. | Precision (trending) |", "|---|---|---|",
              f"| rule baseline (ADX>=22 & EMA stack) | {_f(g['rule_baseline']['balanced_accuracy'])} | {_f(g['rule_baseline']['precision_trending'])} |"]
        for name, m in g["models"].items():
            L.append(f"| {name} | {_f(m['balanced_accuracy'])} | {_f(m['precision_trending'])} |")
    a = r["anomaly"]
    L += ["", "## Anomaly detection (IsolationForest, H1)", "",
          f"Status: {a.get('status')}, flagged OOS bars: {a.get('flagged_oos')}, forward |move| flagged {_f(a.get('fwd_abs_move_flagged'), 4)} "
          f"vs normal {_f(a.get('fwd_abs_move_normal'), 4)} → lift {_f(a.get('lift'), 2)}; enabled (lift ≥ 1.3): **{a.get('useful')}**", ""]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    main()
