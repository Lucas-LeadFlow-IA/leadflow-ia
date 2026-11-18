"""Candidate model families and safe model persistence.

Models are deliberately simple (scikit-learn): logistic regression as a
baseline, Random Forest and Histogram Gradient Boosting (sklearn's
LightGBM-style GBM). XGBoost is not used: HistGradientBoosting covers the
same model class without an extra native dependency, and the dataset
sizes here (hundreds to a few thousand samples) do not justify more.

Persistence: joblib (pickle) can execute code when loading a tampered
file, so every model is stored with a SHA-256 in its metadata and is
refused if the hash does not match.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def candidate_models(seed: int = 7) -> dict[str, Any]:
    return {
        "logistic": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(),
                                  LogisticRegression(C=0.3, max_iter=2000)),
        "random_forest": make_pipeline(SimpleImputer(strategy="median"),
                                       RandomForestClassifier(n_estimators=300, max_depth=4, min_samples_leaf=10,
                                                              random_state=seed, n_jobs=-1)),
        "gradient_boosting": HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=150,
                                                            l2_regularization=1.0, min_samples_leaf=15, random_state=seed),
    }


def _sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_model(model: Any, path: Path, metadata: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)
    metadata = dict(metadata, sha256=_sha256(path), file=path.name)
    path.with_suffix(".json").write_text(json.dumps(metadata, indent=1, default=str), encoding="utf-8")


def load_model(path: Path) -> tuple[Any, dict] | None:
    meta_p = path.with_suffix(".json")
    if not path.exists() or not meta_p.exists():
        return None
    meta = json.loads(meta_p.read_text(encoding="utf-8"))
    if meta.get("sha256") != _sha256(path):
        raise ValueError(f"model file {path} does not match its recorded SHA-256 — refusing to load")
    return joblib.load(path), meta
