"""Candle utilities: normalisation of Hyperliquid payloads and causal resampling.

DataFrame convention used everywhere:
    open_time (int ms), close_time (int ms), open, high, low, close, volume, trades
A candle is *available* only after `close_time` (Hyperliquid's `T`,
which is open + interval - 1 ms).
"""
from __future__ import annotations

from collections.abc import Iterable

import numpy as np
import pandas as pd

# Intervals documented by Hyperliquid (info candleSnapshot / ws candle)
INTERVAL_MS: dict[str, int] = {
    "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
    "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "8h": 28_800_000,
    "12h": 43_200_000, "1d": 86_400_000,
}
CANDLE_COLUMNS = ["open_time", "close_time", "open", "high", "low", "close", "volume", "trades"]


def interval_ms(tf: str) -> int:
    try:
        return INTERVAL_MS[tf]
    except KeyError as exc:  # pragma: no cover - defensive
        raise ValueError(f"unsupported interval {tf!r}") from exc


def candles_from_api(rows: Iterable[dict]) -> pd.DataFrame:
    """Convert Hyperliquid candle dicts ({t,T,o,h,l,c,v,n,...}) to a DataFrame."""
    recs = [
        {
            "open_time": int(r["t"]),
            "close_time": int(r["T"]),
            "open": float(r["o"]),
            "high": float(r["h"]),
            "low": float(r["l"]),
            "close": float(r["c"]),
            "volume": float(r["v"]),
            "trades": int(r.get("n", 0) or 0),
        }
        for r in rows
    ]
    df = pd.DataFrame.from_records(recs, columns=CANDLE_COLUMNS)
    return normalize(df)


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Sort, de-duplicate (keep last update of a candle) and type the frame."""
    if df.empty:
        return pd.DataFrame(columns=CANDLE_COLUMNS).astype(
            {"open_time": "int64", "close_time": "int64", "trades": "int64"})
    df = df.sort_values("open_time").drop_duplicates("open_time", keep="last").reset_index(drop=True)
    df["open_time"] = df["open_time"].astype("int64")
    df["close_time"] = df["close_time"].astype("int64")
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = df[col].astype(float)
    df["trades"] = df["trades"].fillna(0).astype("int64")
    return df[CANDLE_COLUMNS]


def merge(old: pd.DataFrame, new: pd.DataFrame) -> pd.DataFrame:
    if old is None or old.empty:
        return normalize(new.copy())
    if new is None or new.empty:
        return old
    return normalize(pd.concat([old, new], ignore_index=True))


def only_closed(df: pd.DataFrame, now_ms: int) -> pd.DataFrame:
    """Drop the still-forming candle(s): keep rows whose close_time < now."""
    return df[df["close_time"] < now_ms].reset_index(drop=True)


def resample(base: pd.DataFrame, tf: str) -> pd.DataFrame:
    """Aggregate base candles into `tf` buckets aligned on UTC epoch.

    Buckets with missing base candles are kept (OHLC of what exists);
    `close_time` is the theoretical bucket end, so an incomplete trailing
    bucket is never "available" before its end in a backtest.
    """
    step = interval_ms(tf)
    if base.empty:
        return base.copy()
    bucket = (base["open_time"] // step) * step
    g = base.groupby(bucket, sort=True)
    out = pd.DataFrame(
        {
            "open_time": g["open_time"].first().index.astype("int64"),
            "open": g["open"].first().to_numpy(),
            "high": g["high"].max().to_numpy(),
            "low": g["low"].min().to_numpy(),
            "close": g["close"].last().to_numpy(),
            "volume": g["volume"].sum().to_numpy(),
            "trades": g["trades"].sum().to_numpy(),
        }
    )
    out["close_time"] = out["open_time"] + step - 1
    return out[CANDLE_COLUMNS].reset_index(drop=True)


def detect_gaps(df: pd.DataFrame, tf: str) -> list[tuple[int, int]]:
    """Return (from_open_time, to_open_time) pairs where candles are missing."""
    if len(df) < 2:
        return []
    step = interval_ms(tf)
    t = df["open_time"].to_numpy()
    d = np.diff(t)
    idx = np.where(d > step)[0]
    return [(int(t[i]), int(t[i + 1])) for i in idx]
