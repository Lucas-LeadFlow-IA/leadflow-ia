"""ML regime classifier vs the deterministic rules — kept only if it wins OOS.

Target (forward-looking, used for training labels only): the H1 market is
"trending" over the next `horizon` bars if the forward Kaufman efficiency
ratio >= `er_threshold`. Features are causal H1 features at time t.

Baseline rule: ADX >= 22 and full EMA stack (the core of the Regime
Detector's trend votes). The ML model is marked useful only if its
walk-forward balanced accuracy beats the rule by >= 3 points.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import balanced_accuracy_score, precision_score

from machine_learning.models import candidate_models, save_model
from machine_learning.walk_forward import walk_forward_splits

FEATURES = ["adx", "er20", "atr_pct_rank", "bb_width_rank", "ema50_slope", "ema20_slope", "ema_stack",
            "structure_trend", "rsi14", "vol_z", "realized_vol", "dist_vwap_atr", "ema_cross_count50", "macd_hist"]


def forward_efficiency(close: pd.Series, horizon: int) -> pd.Series:
    fut_net = (close.shift(-horizon) - close).abs()
    path = close.diff().abs()[::-1].rolling(horizon, min_periods=horizon).sum()[::-1].shift(-1)
    return fut_net / path


def build_dataset(feat_1h: pd.DataFrame, horizon: int = 24, er_threshold: float = 0.3):
    df = feat_1h.copy()
    df["fwd_er"] = forward_efficiency(df["close"], horizon)
    df = df.dropna(subset=FEATURES + ["fwd_er"]).reset_index(drop=True)
    X = df[FEATURES].to_numpy(float).copy()
    X[:, FEATURES.index("ema50_slope")] = np.abs(X[:, FEATURES.index("ema50_slope")])
    X[:, FEATURES.index("ema20_slope")] = np.abs(X[:, FEATURES.index("ema20_slope")])
    X[:, FEATURES.index("rsi14")] = np.abs(X[:, FEATURES.index("rsi14")] - 50)
    y = (df["fwd_er"] >= er_threshold).astype(int).to_numpy()
    rule = ((df["adx"] >= 22) & (df["ema_stack"].abs() == 1)).astype(int).to_numpy()
    return X, y, rule, df


def evaluate(feat_1h: pd.DataFrame, horizon: int = 24, er_threshold: float = 0.3) -> dict:
    X, y, rule, df = build_dataset(feat_1h, horizon, er_threshold)
    if len(y) < 500:
        return {"status": "insufficient_data", "samples": int(len(y))}
    pos = np.arange(len(y))
    out = {"samples": int(len(y)), "positive_rate": float(y.mean()), "horizon_bars": horizon,
           "er_threshold": er_threshold, "models": {}}
    rule_pred, rule_true = [], []
    for name, model in candidate_models().items():
        preds, trues = [], []
        for tr, te in walk_forward_splits(pos, n_folds=5, horizon=horizon, embargo=horizon):
            m = clone(model).fit(X[tr], y[tr])
            preds.append((m.predict_proba(X[te])[:, 1] >= 0.5).astype(int))
            trues.append(y[te])
            if name == "logistic":
                rule_pred.append(rule[te])
                rule_true.append(y[te])
        p, t = np.concatenate(preds), np.concatenate(trues)
        out["models"][name] = {"balanced_accuracy": float(balanced_accuracy_score(t, p)),
                               "precision_trending": float(precision_score(t, p, zero_division=0))}
    rp, rt = np.concatenate(rule_pred), np.concatenate(rule_true)
    out["rule_baseline"] = {"balanced_accuracy": float(balanced_accuracy_score(rt, rp)),
                            "precision_trending": float(precision_score(rt, rp, zero_division=0))}
    best = max(out["models"], key=lambda k: out["models"][k]["balanced_accuracy"])
    out["best"] = best
    out["useful"] = out["models"][best]["balanced_accuracy"] >= out["rule_baseline"]["balanced_accuracy"] + 0.03
    out["status"] = "evaluated"
    return out


def train_and_save(feat_1h: pd.DataFrame, report: dict, models_dir: Path) -> Path | None:
    if report.get("status") != "evaluated":
        return None
    X, y, _, _ = build_dataset(feat_1h, report["horizon_bars"], report["er_threshold"])
    model = clone(candidate_models()[report["best"]]).fit(X, y)
    path = Path(models_dir) / "regime_model.joblib"
    save_model(model, path, {"kind": "regime_model", "features": FEATURES, "enabled": report["useful"],
                             "advisory_only": True, "evaluation": report})
    return path
