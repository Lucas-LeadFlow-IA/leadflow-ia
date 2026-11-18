"""Technical indicators (pure pandas / numpy, strictly causal).

Why not TA-Lib: it needs a compiled C library (painful on Windows and in
slim Docker images) and adds nothing we cannot verify here. Every
function below only uses data up to and including the current bar, which
is verified by `tests/test_no_lookahead.py`.

Smoothing conventions follow Wilder (RSI, ATR, ADX) and the usual EMA
recursion with `adjust=False`.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def ema(series: pd.Series, n: int) -> pd.Series:
    return series.ewm(span=n, adjust=False, min_periods=n).mean()


def sma(series: pd.Series, n: int) -> pd.Series:
    return series.rolling(n, min_periods=n).mean()


def wilder(series: pd.Series, n: int) -> pd.Series:
    """Wilder smoothing seeded with the simple mean of the first n valid values
    (textbook definition used for RSI / ATR / ADX)."""
    x = series.to_numpy(dtype=float)
    out = np.full(len(x), np.nan)
    valid = np.flatnonzero(~np.isnan(x))
    if len(valid) < n:
        return pd.Series(out, index=series.index)
    start = valid[0]
    seed_end = start + n - 1
    window = x[start: seed_end + 1]
    if np.isnan(window).any():  # gaps inside the seed window: fall back to nan-mean
        prev = float(np.nanmean(window))
    else:
        prev = float(window.mean())
    out[seed_end] = prev
    alpha = 1.0 / n
    for i in range(seed_end + 1, len(x)):
        v = x[i]
        if not np.isnan(v):
            prev = prev + alpha * (v - prev)
        out[i] = prev
    return pd.Series(out, index=series.index)


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_gain = wilder(gain, n)
    avg_loss = wilder(loss, n)
    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    out = 100.0 - 100.0 / (1.0 + rs)
    # avg_loss == 0 and avg_gain > 0 -> RSI 100
    out = out.where(~((avg_loss == 0) & (avg_gain > 0)), 100.0)
    return out


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.DataFrame:
    line = ema(close, fast) - ema(close, slow)
    sig = line.ewm(span=signal, adjust=False, min_periods=signal).mean()
    return pd.DataFrame({"macd": line, "macd_signal": sig, "macd_hist": line - sig})


def true_range(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr


def atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    return wilder(true_range(df), n)


def adx(df: pd.DataFrame, n: int = 14) -> pd.DataFrame:
    up = df["high"].diff()
    down = -df["low"].diff()
    plus_dm = pd.Series(np.where((up > down) & (up > 0), up, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down > up) & (down > 0), down, 0.0), index=df.index)
    tr_s = wilder(true_range(df), n)
    plus_di = 100.0 * wilder(plus_dm, n) / tr_s
    minus_di = 100.0 * wilder(minus_dm, n) / tr_s
    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0.0, np.nan)
    return pd.DataFrame({"adx": wilder(dx, n), "plus_di": plus_di, "minus_di": minus_di})


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0) -> pd.DataFrame:
    mid = sma(close, n)
    std = close.rolling(n, min_periods=n).std(ddof=0)
    upper, lower = mid + k * std, mid - k * std
    width = (upper - lower) / mid
    pctb = (close - lower) / (upper - lower).replace(0.0, np.nan)
    return pd.DataFrame({"bb_mid": mid, "bb_upper": upper, "bb_lower": lower, "bb_width": width, "bb_pctb": pctb})


def session_vwap(df: pd.DataFrame) -> pd.Series:
    """VWAP anchored at each UTC day (uses `open_time` in ms)."""
    tp = (df["high"] + df["low"] + df["close"]) / 3.0
    day = (df["open_time"] // 86_400_000).astype("int64")
    pv = (tp * df["volume"]).groupby(day).cumsum()
    vv = df["volume"].groupby(day).cumsum()
    return pv / vv.replace(0.0, np.nan)


def rolling_vwap(df: pd.DataFrame, n: int) -> pd.Series:
    tp = (df["high"] + df["low"] + df["close"]) / 3.0
    return (tp * df["volume"]).rolling(n, min_periods=n).sum() / df["volume"].rolling(n, min_periods=n).sum()


def zscore(series: pd.Series, n: int) -> pd.Series:
    m = series.rolling(n, min_periods=n).mean()
    s = series.rolling(n, min_periods=n).std(ddof=0)
    return (series - m) / s.replace(0.0, np.nan)


def realized_vol(close: pd.Series, n: int) -> pd.Series:
    """Standard deviation of log returns over n bars (per-bar, not annualized)."""
    return np.log(close).diff().rolling(n, min_periods=n).std(ddof=0)


def percentile_rank(series: pd.Series, n: int) -> pd.Series:
    """Rank (0..1) of the current value within the trailing n values (inclusive)."""
    return series.rolling(n, min_periods=max(20, n // 5)).rank(pct=True)


def donchian(df: pd.DataFrame, n: int) -> pd.DataFrame:
    return pd.DataFrame(
        {
            f"dc_high_{n}": df["high"].rolling(n, min_periods=n).max(),
            f"dc_low_{n}": df["low"].rolling(n, min_periods=n).min(),
        }
    )


def efficiency_ratio(close: pd.Series, n: int = 20) -> pd.Series:
    """Kaufman efficiency ratio: |net move| / sum(|bar moves|). 1 = straight trend, 0 = noise."""
    net = (close - close.shift(n)).abs()
    path = close.diff().abs().rolling(n, min_periods=n).sum()
    return net / path.replace(0.0, np.nan)


def volume_profile(high: np.ndarray, low: np.ndarray, volume: np.ndarray, bins: int = 40,
                   value_area: float = 0.70) -> tuple[float, float, float]:
    """Volume profile of a window of candles.

    Volume of each candle is spread uniformly over its [low, high] range.
    Returns (POC, VAH, VAL). Exchange candles do not carry traded volume by
    price, so this is an approximation — labelled as such in the reports.
    """
    lo, hi = float(np.nanmin(low)), float(np.nanmax(high))
    if not np.isfinite(lo) or not np.isfinite(hi) or hi <= lo:
        mid = (lo + hi) / 2.0
        return mid, hi, lo
    edges = np.linspace(lo, hi, bins + 1)
    centers = (edges[:-1] + edges[1:]) / 2.0
    hist = np.zeros(bins)
    width = edges[1] - edges[0]
    for h, l, v in zip(high, low, volume):
        if not np.isfinite(v) or v <= 0:
            continue
        i0 = int(min(bins - 1, max(0, (l - lo) // width)))
        i1 = int(min(bins - 1, max(0, (h - lo) // width)))
        hist[i0: i1 + 1] += v / (i1 - i0 + 1)
    poc_i = int(np.argmax(hist))
    total = hist.sum()
    if total <= 0:
        return float(centers[poc_i]), hi, lo
    lo_i, hi_i, acc = poc_i, poc_i, hist[poc_i]
    while acc < value_area * total and (lo_i > 0 or hi_i < bins - 1):
        left = hist[lo_i - 1] if lo_i > 0 else -1.0
        right = hist[hi_i + 1] if hi_i < bins - 1 else -1.0
        if right >= left:
            hi_i += 1
            acc += hist[hi_i]
        else:
            lo_i -= 1
            acc += hist[lo_i]
    return float(centers[poc_i]), float(edges[hi_i + 1]), float(edges[lo_i])


def rolling_volume_profile(df: pd.DataFrame, n: int = 100, bins: int = 40) -> pd.DataFrame:
    """POC / VAH / VAL over the trailing n candles for every row (causal)."""
    h, l, v = df["high"].to_numpy(float), df["low"].to_numpy(float), df["volume"].to_numpy(float)
    out = np.full((len(df), 3), np.nan)
    for i in range(n - 1, len(df)):
        out[i] = volume_profile(h[i - n + 1: i + 1], l[i - n + 1: i + 1], v[i - n + 1: i + 1], bins)
    return pd.DataFrame(out, columns=["vp_poc", "vp_vah", "vp_val"], index=df.index)
