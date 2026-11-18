"""Historical data download / persistence for backtesting and ML.

Hyperliquid's `candleSnapshot` only serves the most recent ~5000 candles
per interval (verified: 1m ≈ 3.5 days, 5m ≈ 17 days, 15m ≈ 52 days,
1h ≈ 208 days, 4h ≈ 833 days). Running `download` regularly (e.g. daily
via the collector) makes the local history grow beyond that window.
Older data can be imported from CSV files with the same columns
(`import_csv`) — the user is responsible for the provenance of such data.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

import pandas as pd

from market_data.candles import CANDLE_COLUMNS, interval_ms, merge, normalize
from market_data.hyperliquid_info import HyperliquidInfoClient

log = logging.getLogger(__name__)

MAX_SERVED_CANDLES = 5000


def candle_path(data_dir: Path, coin: str, tf: str) -> Path:
    return Path(data_dir) / "candles" / f"{coin}_{tf}.csv"


def funding_path(data_dir: Path, coin: str) -> Path:
    return Path(data_dir) / "funding" / f"{coin}.csv"


def load_candles(data_dir: Path, coin: str, tf: str) -> pd.DataFrame:
    p = candle_path(data_dir, coin, tf)
    if not p.exists():
        return pd.DataFrame(columns=CANDLE_COLUMNS)
    return normalize(pd.read_csv(p))


def save_candles(data_dir: Path, coin: str, tf: str, df: pd.DataFrame) -> Path:
    p = candle_path(data_dir, coin, tf)
    p.parent.mkdir(parents=True, exist_ok=True)
    merged = merge(load_candles(data_dir, coin, tf), df)
    # never persist a still-forming candle
    merged = merged[merged["close_time"] < int(time.time() * 1000)]
    merged.to_csv(p, index=False)
    return p


def load_funding(data_dir: Path, coin: str) -> pd.DataFrame:
    p = funding_path(data_dir, coin)
    if not p.exists():
        return pd.DataFrame(columns=["time", "funding_rate", "premium"])
    return pd.read_csv(p)


async def download(client: HyperliquidInfoClient, data_dir: Path, coin: str = "BTC",
                   intervals: tuple[str, ...] = ("1m", "5m", "15m", "1h", "4h"),
                   funding_days: int = 900) -> dict[str, int]:
    """Download everything the API serves and merge into local CSV files."""
    now = int(time.time() * 1000)
    summary: dict[str, int] = {}
    for tf in intervals:
        start = now - (MAX_SERVED_CANDLES + 10) * interval_ms(tf)
        df = await client.candles(coin, tf, start, now)
        p = save_candles(data_dir, coin, tf, df)
        total = len(load_candles(data_dir, coin, tf))
        summary[tf] = total
        log.info("candles saved", extra={"tf": tf, "downloaded": len(df), "total": total, "path": str(p)})
    rows = await client.funding_history(coin, now - funding_days * 86_400_000, now)
    fdf = pd.DataFrame(
        [{"time": int(r["time"]), "funding_rate": float(r["fundingRate"]), "premium": float(r.get("premium", 0.0))}
         for r in rows]
    )
    fp = funding_path(data_dir, coin)
    fp.parent.mkdir(parents=True, exist_ok=True)
    old = load_funding(data_dir, coin)
    fdf = pd.concat([old, fdf], ignore_index=True).drop_duplicates("time").sort_values("time")
    fdf.to_csv(fp, index=False)
    summary["funding"] = len(fdf)
    return summary


def import_csv(data_dir: Path, coin: str, tf: str, csv_file: Path) -> int:
    """Import external candles (columns: open_time, open, high, low, close, volume[, close_time, trades])."""
    df = pd.read_csv(csv_file)
    if "close_time" not in df.columns:
        df["close_time"] = df["open_time"] + interval_ms(tf) - 1
    if "trades" not in df.columns:
        df["trades"] = 0
    save_candles(data_dir, coin, tf, df[CANDLE_COLUMNS])
    return len(load_candles(data_dir, coin, tf))
