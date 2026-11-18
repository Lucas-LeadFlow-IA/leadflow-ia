"""Anomaly detection (IsolationForest) on H1 market features.

Purpose: flag market states unlike anything in the training history so the
Regime Detector can classify them as UNSTABLE (no trade). Validated walk-
forward: the model is fitted on the past only, and is kept (`enabled`) only
if flagged bars are followed by materially larger absolute moves (lift)
than non-flagged bars — i.e. the flag carries real risk information.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from core.snapshot import MarketSnapshot, finite
from machine_learning.models import load_model, save_model
from machine_learning.walk_forward import walk_forward_splits

FEATURES = ["ret_z", "range_atr", "vol_z", "atr_pct_rank", "bb_width_rank", "ema_cross_count50", "dist_vwap_atr", "er20"]
MODEL_FILE = "anomaly_model.joblib"


def _xy(feat: pd.DataFrame, horizon: int = 4):
    df = feat.dropna(subset=FEATURES).reset_index(drop=True)
    fwd = (df["close"].shift(-horizon) / df["close"] - 1).abs()
    return df[FEATURES].to_numpy(float), fwd.to_numpy(float)


def evaluate(feat_1h: pd.DataFrame, contamination: float = 0.02, horizon: int = 4) -> dict:
    X, fwd = _xy(feat_1h, horizon)
    if len(X) < 500:
        return {"status": "insufficient_data", "samples": int(len(X))}
    flagged, normal = [], []
    for tr, te in walk_forward_splits(np.arange(len(X)), n_folds=5, horizon=horizon, embargo=horizon):
        m = IsolationForest(n_estimators=200, contamination=contamination, random_state=7).fit(X[tr])
        is_anom = m.predict(X[te]) == -1
        f = fwd[te]
        flagged.append(f[is_anom & np.isfinite(f)])
        normal.append(f[~is_anom & np.isfinite(f)])
    fa, no = np.concatenate(flagged), np.concatenate(normal)
    lift = float(fa.mean() / no.mean()) if len(fa) and no.mean() > 0 else None
    return {"status": "evaluated", "samples": int(len(X)), "flagged_oos": int(len(fa)), "contamination": contamination,
            "fwd_abs_move_flagged": float(fa.mean()) if len(fa) else None, "fwd_abs_move_normal": float(no.mean()),
            "lift": lift, "useful": bool(lift is not None and lift >= 1.3 and len(fa) >= 20)}


def train_and_save(feat_1h: pd.DataFrame, report: dict, models_dir: Path, contamination: float = 0.02) -> Path | None:
    if report.get("status") != "evaluated":
        return None
    X, _ = _xy(feat_1h)
    m = IsolationForest(n_estimators=200, contamination=contamination, random_state=7).fit(X)
    path = Path(models_dir) / MODEL_FILE
    save_model(m, path, {"kind": "anomaly", "features": FEATURES, "enabled": report["useful"], "evaluation": report})
    return path


class AnomalyModel:
    """Runtime wrapper passed to the RegimeDetector (only if enabled)."""

    def __init__(self, model, meta: dict):
        self.model, self.meta = model, meta

    @classmethod
    def load_enabled(cls, models_dir: Path) -> AnomalyModel | None:
        loaded = load_model(Path(models_dir) / MODEL_FILE)
        if not loaded or not loaded[1].get("enabled"):
            return None
        return cls(*loaded)

    def is_anomaly(self, snap: MarketSnapshot) -> bool:
        vals = [snap.get("1h", f) for f in FEATURES]
        if not finite(*vals):
            return False
        return bool(self.model.predict(np.array([vals]))[0] == -1)
