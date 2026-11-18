"""Confidence calibration: deterministic setup score -> historical win rate.

The confluence score (0-100) is NOT a probability. This calibrator maps it
to an empirical probability of a net-positive outcome using isotonic
regression on labelled historical candidates. Calibration quality is
measured out of sample (walk-forward Brier score). With fewer than
`min_samples` labelled outcomes the calibrator refuses to produce a
probability and the UI shows "uncalibrated".

Stored as JSON (thresholds), never as pickle.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import brier_score_loss

from core.models import Confidence, TradeSetup
from machine_learning.walk_forward import walk_forward_splits

CALIB_FILE = "confidence_calibration.json"


def fit_isotonic(scores: np.ndarray, wins: np.ndarray) -> tuple[list[float], list[float]]:
    iso = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip").fit(scores, wins)
    return [float(x) for x in iso.X_thresholds_], [float(v) for v in iso.y_thresholds_]


def evaluate_and_fit(rows: list[dict], min_samples: int = 50) -> dict:
    rows = sorted(rows, key=lambda r: r["i"])
    n = len(rows)
    if n < min_samples:
        return {"status": "insufficient_data", "samples": n, "min_samples": min_samples}
    s = np.array([r["score"] for r in rows], dtype=float)
    y = np.array([r["win"] for r in rows], dtype=float)
    pos = np.array([r["i"] for r in rows])
    horizon = int(max(r["horizon"] for r in rows))
    p_all, y_all, base_all = [], [], []
    for tr, te in walk_forward_splits(pos, n_folds=4, horizon=horizon):
        xs, ys = fit_isotonic(s[tr], y[tr])
        p_all.append(np.interp(s[te], xs, ys))
        y_all.append(y[te])
        base_all.append(np.full(len(te), y[tr].mean()))
    oos = None
    if p_all:
        p, yt, b = np.concatenate(p_all), np.concatenate(y_all), np.concatenate(base_all)
        oos = {"brier": float(brier_score_loss(yt, p)), "brier_base_rate": float(brier_score_loss(yt, b)),
               "samples": int(len(yt))}
    xs, ys = fit_isotonic(s, y)
    return {"status": "fitted", "samples": n, "x": xs, "y": ys, "base_rate": float(y.mean()), "oos": oos,
            "useful": bool(oos and oos["brier"] < oos["brier_base_rate"])}


class ConfidenceCalibrator:
    def __init__(self, data: dict | None):
        self.data = data or {}

    @classmethod
    def load(cls, models_dir: Path) -> ConfidenceCalibrator:
        p = Path(models_dir) / CALIB_FILE
        if p.exists():
            return cls(json.loads(p.read_text(encoding="utf-8")))
        return cls(None)

    def save(self, models_dir: Path) -> Path:
        p = Path(models_dir) / CALIB_FILE
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(self.data, indent=1), encoding="utf-8")
        return p

    @property
    def usable(self) -> bool:
        return self.data.get("status") == "fitted" and bool(self.data.get("useful"))

    def confidence(self, setup: TradeSetup) -> Confidence:
        if not self.usable:
            return Confidence(raw_score=setup.score, calibrated=False, calibration_samples=int(self.data.get("samples", 0)),
                              method="uncalibrated (insufficient or non-informative history)")
        p = float(np.interp(setup.score, self.data["x"], self.data["y"]))
        return Confidence(raw_score=setup.score, probability=p, calibrated=True,
                          calibration_samples=int(self.data["samples"]), method="isotonic (walk-forward validated)")
