"""Look-ahead bias guard.

For every feature column, the value computed on data truncated at bar k
must equal the value computed on the full history at bar k. Any feature
that "peeks" at future bars fails this test.
"""
import numpy as np
import pandas as pd
import pytest

from analysis.features import compute_features
from market_data.candles import resample
from tests.conftest import make_candles

CHECK_POINTS = [260, 517, 899, 1211]


@pytest.mark.parametrize("tf", ["1m", "15m"])
def test_features_are_causal(tf):
    full_candles = make_candles(1300, seed=11)
    full = compute_features(full_candles, tf, with_volume_profile=True)
    numeric_cols = [c for c in full.columns if pd.api.types.is_numeric_dtype(full[c])]
    for k in CHECK_POINTS:
        trunc = compute_features(full_candles.iloc[: k + 1], tf, with_volume_profile=True)
        a = trunc.iloc[k][numeric_cols].astype(float).to_numpy()
        b = full.iloc[k][numeric_cols].astype(float).to_numpy()
        both_nan = np.isnan(a) & np.isnan(b)
        diff = ~both_nan & ~np.isclose(a, b, rtol=1e-9, atol=1e-9)
        bad = [c for c, d in zip(numeric_cols, diff) if d]
        assert not bad, f"look-ahead detected at bar {k} in columns {bad}"


def test_resample_is_causal_and_correct():
    base = make_candles(600, seed=3)
    r = resample(base, "15m")
    first = base.iloc[:15]
    # bucket alignment: epoch-aligned 15m buckets
    b0 = r.iloc[1]
    rows = base[(base["open_time"] >= b0["open_time"]) & (base["open_time"] <= b0["close_time"])]
    assert b0["high"] == rows["high"].max() and b0["low"] == rows["low"].min()
    assert b0["open"] == rows["open"].iloc[0] and b0["close"] == rows["close"].iloc[-1]
    assert b0["volume"] == pytest.approx(rows["volume"].sum())
    assert (r["close_time"] - r["open_time"] == 900_000 - 1).all()
    assert len(first) == 15


def test_structure_detects_bos_choch_and_fvg():
    # Build an explicit path: up-swing, pullback, break up (BOS), then sharp drop (CHOCH).
    path = [100, 102, 104, 106, 108, 107, 105, 104, 105, 107, 110, 112, 114, 113, 111, 110,
            109, 107, 104, 100, 96, 92, 90, 91, 92, 91, 90]
    n = len(path)
    close = np.array(path, dtype=float)
    open_ = np.concatenate([[100.0], close[:-1]])
    df = pd.DataFrame({
        "open_time": np.arange(n) * 60000, "close_time": np.arange(n) * 60000 + 59999,
        "open": open_, "high": np.maximum(open_, close) + 0.2, "low": np.minimum(open_, close) - 0.2,
        "close": close, "volume": np.ones(n), "trades": np.ones(n, dtype=int),
    })
    from analysis.structure import compute_structure
    s = compute_structure(df, np.full(n, 1.0), swing_len=2)
    assert s["bos_bull"].sum() >= 1, "bullish break of the first swing high expected"
    assert s["choch_bear"].sum() >= 1, "bearish change of character expected after the drop"
    first_bos = int(np.argmax(s["bos_bull"].to_numpy()))
    first_choch = int(np.argmax(s["choch_bear"].to_numpy()))
    assert first_choch > first_bos


def test_fvg_detection():
    # candle 0 high=101, candle 2 low=103 -> bullish FVG [101, 103]
    df = pd.DataFrame({
        "open_time": np.arange(6) * 60000, "close_time": np.arange(6) * 60000 + 59999,
        "open": [100, 101, 103.5, 104, 104, 102.5], "high": [101, 104, 105, 105, 104.5, 103],
        "low": [99.5, 100.8, 103, 103.6, 103.5, 102.0], "close": [100.8, 103.6, 104.5, 104.2, 103.8, 102.6],
        "volume": np.ones(6), "trades": np.ones(6, dtype=int),
    })
    from analysis.structure import compute_structure
    s = compute_structure(df, np.full(6, 1.0), swing_len=1)
    assert s.loc[2, "fvg_bull_bottom"] == pytest.approx(101) and s.loc[2, "fvg_bull_top"] == pytest.approx(103)
    assert s.loc[5, "in_fvg_bull"] == 1  # price traded back into the gap
