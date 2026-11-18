import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Tests must never pick up a developer's real .env secrets / live mode.
os.environ.setdefault("TRADING_MODE", "paper")
os.environ["HL_API_WALLET_PRIVATE_KEY"] = ""
os.environ["TELEGRAM_BOT_TOKEN"] = ""


def make_candles(n: int = 1500, tf_ms: int = 60_000, seed: int = 7, start_price: float = 60_000.0,
                 regime_len: int = 300, start_ms: int = 1_700_000_000_000) -> pd.DataFrame:
    """Synthetic BTC-like candles alternating trend / range / volatile regimes."""
    rng = np.random.default_rng(seed)
    drifts = []
    vols = []
    for k in range(n):
        phase = (k // regime_len) % 4
        drifts.append({0: 0.0004, 1: 0.0, 2: -0.0004, 3: 0.0}[phase])
        vols.append({0: 0.0010, 1: 0.0007, 2: 0.0012, 3: 0.0025}[phase])
    rets = rng.normal(np.array(drifts), np.array(vols))
    close = start_price * np.exp(np.cumsum(rets))
    open_ = np.concatenate([[start_price], close[:-1]])
    spread = np.abs(rng.normal(0, np.array(vols) * 0.8)) * close
    high = np.maximum(open_, close) + spread
    low = np.minimum(open_, close) - spread
    vol = rng.lognormal(mean=1.0, sigma=0.5, size=n)
    open_time = start_ms + np.arange(n, dtype=np.int64) * tf_ms
    return pd.DataFrame({
        "open_time": open_time, "close_time": open_time + tf_ms - 1,
        "open": open_, "high": high, "low": low, "close": close,
        "volume": vol, "trades": rng.integers(10, 500, n),
    })


@pytest.fixture
def candles_1m() -> pd.DataFrame:
    return make_candles()


@pytest.fixture(autouse=True)
def _isolated_runtime(tmp_path, monkeypatch):
    monkeypatch.setenv("RUNTIME_DIR", str(tmp_path / "runtime"))
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("MODELS_DIR", str(tmp_path / "models"))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    from config.settings import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
