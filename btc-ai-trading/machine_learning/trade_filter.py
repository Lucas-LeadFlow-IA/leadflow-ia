"""Meta-labeling trade filter: P(candidate setup is profitable after costs).

Trained and evaluated with purged walk-forward validation only. The filter
is ENABLED in production only if, out of sample:
  * at least `min_oos` labelled candidates were tested,
  * Brier score beats the base-rate predictor,
  * AUC >= 0.55, and
  * the mean net R of candidates kept by the filter beats the mean net R
    of all candidates (economic uplift after costs).
Otherwise it is saved for inspection with `enabled = false`.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from sklearn.base import clone
from sklearn.metrics import brier_score_loss, roc_auc_score

from core.models import TradeSetup
from machine_learning.labeling import feature_matrix
from machine_learning.models import candidate_models, load_model, save_model
from machine_learning.walk_forward import walk_forward_splits

MODEL_FILE = "trade_filter.joblib"


def evaluate_filter(rows: list[dict], n_folds: int = 5, threshold: float = 0.5, min_oos: int = 100) -> dict:
    rows = sorted(rows, key=lambda r: r["i"])
    if len(rows) < 60:
        return {"status": "insufficient_data", "samples": len(rows), "enabled": False,
                "reason": f"only {len(rows)} labelled candidates (need >= 60 to even attempt walk-forward)"}
    X, cols = feature_matrix(rows)
    y = np.array([r["win"] for r in rows])
    R = np.array([r["r"] for r in rows])
    pos = np.array([r["i"] for r in rows])
    horizon = int(max(r["horizon"] for r in rows))
    results = {}
    for name, model in candidate_models().items():
        oos_p, oos_idx = [], []
        for tr, te in walk_forward_splits(pos, n_folds=n_folds, horizon=horizon, embargo=2):
            if len(np.unique(y[tr])) < 2:
                continue
            m = clone(model).fit(X[tr], y[tr])
            oos_p.append(m.predict_proba(X[te])[:, 1])
            oos_idx.append(te)
        if not oos_idx:
            continue
        idx = np.concatenate(oos_idx)
        p = np.concatenate(oos_p)
        yt, rt = y[idx], R[idx]
        base = np.full_like(p, y[: idx[0]].mean() if idx[0] > 0 else yt.mean(), dtype=float)
        keep = p >= threshold
        results[name] = {
            "oos_samples": int(len(idx)),
            "base_rate_oos": float(yt.mean()),
            "auc": float(roc_auc_score(yt, p)) if len(np.unique(yt)) > 1 else None,
            "brier": float(brier_score_loss(yt, p)),
            "brier_baseline": float(brier_score_loss(yt, base)),
            "mean_r_all": float(rt.mean()),
            "mean_r_kept": float(rt[keep].mean()) if keep.any() else None,
            "kept_fraction": float(keep.mean()),
        }
    if not results:
        return {"status": "insufficient_data", "samples": len(rows), "enabled": False, "reason": "no valid fold"}
    best_name = min(results, key=lambda k: results[k]["brier"])
    b = results[best_name]
    enabled = (b["oos_samples"] >= min_oos and b["brier"] < b["brier_baseline"] and (b["auc"] or 0) >= 0.55
               and b["mean_r_kept"] is not None and b["mean_r_kept"] > b["mean_r_all"])
    why = []
    if b["oos_samples"] < min_oos:
        why.append(f"OOS sample {b['oos_samples']} < {min_oos}")
    if b["brier"] >= b["brier_baseline"]:
        why.append("Brier not better than base rate")
    if (b["auc"] or 0) < 0.55:
        why.append(f"AUC {b['auc']} < 0.55")
    if b["mean_r_kept"] is None or b["mean_r_kept"] <= b["mean_r_all"]:
        why.append("no economic uplift after costs")
    return {"status": "evaluated", "samples": len(rows), "columns": cols, "models": results, "best": best_name,
            "enabled": bool(enabled), "threshold": threshold, "reason": "; ".join(why) or "all OOS criteria met"}


def train_and_save(rows: list[dict], report: dict, models_dir: Path) -> Path | None:
    if report.get("status") != "evaluated":
        return None
    rows = sorted(rows, key=lambda r: r["i"])
    X, cols = feature_matrix(rows, report["columns"])
    y = np.array([r["win"] for r in rows])
    model = clone(candidate_models()[report["best"]]).fit(X, y)
    path = Path(models_dir) / MODEL_FILE
    save_model(model, path, {"kind": "trade_filter", "columns": cols, "enabled": report["enabled"],
                             "threshold": report["threshold"], "evaluation": report["models"][report["best"]],
                             "model": report["best"], "samples": len(rows), "reason": report["reason"]})
    return path


class TradeFilter:
    """Runtime wrapper used by the DecisionPipeline."""

    def __init__(self, model, meta: dict):
        self.model = model
        self.meta = meta
        self.columns = meta["columns"]
        self.enabled = bool(meta.get("enabled", False))
        self.threshold = float(meta.get("threshold", 0.5))

    @classmethod
    def load(cls, models_dir: Path) -> TradeFilter | None:
        loaded = load_model(Path(models_dir) / MODEL_FILE)
        return cls(*loaded) if loaded else None

    def predict_proba(self, setup: TradeSetup, regime: str | None = None) -> float | None:
        row = {"features": setup.features, "strategy": setup.strategy.value, "regime": regime}
        X, _ = feature_matrix([row], self.columns)
        try:
            return float(self.model.predict_proba(X)[0, 1])
        except Exception:  # noqa: BLE001
            return None
