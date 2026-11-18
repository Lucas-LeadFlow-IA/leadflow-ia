"""Feature pipeline: one function turns a candle frame into the full,
causal feature frame used by every analyst agent, by the backtester and
by the ML models. Same code path in live and in backtest.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analysis import indicators as ind
from analysis.structure import compute_structure

# Swing length per timeframe (bars on each side of a pivot)
SWING_LEN = {"1m": 3, "3m": 3, "5m": 3, "15m": 3, "30m": 3, "1h": 3, "2h": 2, "4h": 2, "1d": 2}
# Rolling lookback (bars) used for percentile ranks
RANK_LOOKBACK = {"1m": 1440, "5m": 864, "15m": 672, "30m": 480, "1h": 720, "4h": 360, "1d": 180}
VOLUME_PROFILE_TFS = {"15m", "1h", "4h"}


def compute_features(candles: pd.DataFrame, tf: str, with_volume_profile: bool | None = None) -> pd.DataFrame:
    """Return candles + all indicator / structure / liquidity columns.

    Every column at row i only depends on rows <= i (verified by tests).
    """
    df = candles.reset_index(drop=True).copy()
    if df.empty:
        return df
    close = df["close"]

    for n in (9, 20, 50, 200):
        df[f"ema{n}"] = ind.ema(close, n)
    df["rsi14"] = ind.rsi(close, 14)
    df = pd.concat([df, ind.macd(close)], axis=1)
    df["atr14"] = ind.atr(df, 14)
    df["atr_pct"] = df["atr14"] / close
    df = pd.concat([df, ind.adx(df, 14), ind.bollinger(close, 20, 2.0)], axis=1)
    df["vwap"] = ind.session_vwap(df)
    df["dist_vwap_atr"] = (close - df["vwap"]) / df["atr14"]
    df["vol_z"] = ind.zscore(df["volume"], 50)
    df["ret_1"] = close.pct_change()
    df["ret_z"] = ind.zscore(df["ret_1"], 100)
    df["range_atr"] = (df["high"] - df["low"]) / df["atr14"]
    df["realized_vol"] = ind.realized_vol(close, 30)
    lb = RANK_LOOKBACK.get(tf, 500)
    df["atr_pct_rank"] = ind.percentile_rank(df["atr_pct"], lb)
    df["bb_width_rank"] = ind.percentile_rank(df["bb_width"], lb)
    df["er20"] = ind.efficiency_ratio(close, 20)
    df = pd.concat([df, ind.donchian(df, 20), ind.donchian(df, 48)], axis=1)
    df["ema20_slope"] = (df["ema20"] - df["ema20"].shift(5)) / df["atr14"]
    df["ema50_slope"] = (df["ema50"] - df["ema50"].shift(5)) / df["atr14"]
    df["ema_stack"] = np.select(
        [(df["ema20"] > df["ema50"]) & (df["ema50"] > df["ema200"]),
         (df["ema20"] < df["ema50"]) & (df["ema50"] < df["ema200"])],
        [1, -1], default=0,
    )
    # EMA20/EMA50 cross count over 50 bars (whipsaw / instability measure)
    above = (df["ema20"] > df["ema50"]).astype(float)
    df["ema_cross_count50"] = above.diff().abs().rolling(50, min_periods=10).sum()
    df["candle_body_atr"] = (df["close"] - df["open"]) / df["atr14"]

    struct = compute_structure(df, df["atr14"].to_numpy(float), swing_len=SWING_LEN.get(tf, 3))
    df = pd.concat([df, struct], axis=1)

    if with_volume_profile is None:
        with_volume_profile = tf in VOLUME_PROFILE_TFS
    if with_volume_profile and len(df) >= 100:
        df = pd.concat([df, ind.rolling_volume_profile(df, 100, 40)], axis=1)
    else:
        df["vp_poc"] = np.nan
        df["vp_vah"] = np.nan
        df["vp_val"] = np.nan
    return df


def row_dict(features: pd.DataFrame, i: int = -1) -> dict[str, float]:
    """Plain dict view of one row (fast access for agents)."""
    if features.empty:
        return {}
    rec = features.iloc[i]
    return {k: (float(v) if isinstance(v, (int, float, np.integer, np.floating)) else v) for k, v in rec.items()}
