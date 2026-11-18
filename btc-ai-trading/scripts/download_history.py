"""Download all BTC history served by Hyperliquid (read-only) into ./data.

Usage:  python scripts/download_history.py [--source mainnet|testnet]
Run it regularly (e.g. daily) so the local history grows beyond the
~5000-candles-per-interval window served by the API.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import MAINNET_API_URL, TESTNET_API_URL, get_settings  # noqa: E402
from market_data.history import download  # noqa: E402
from market_data.hyperliquid_info import HyperliquidInfoClient  # noqa: E402
from monitoring.logging_setup import setup_logging  # noqa: E402


async def main(source: str) -> None:
    settings = get_settings()
    setup_logging(settings)
    settings.ensure_dirs()
    url = MAINNET_API_URL if source == "mainnet" else TESTNET_API_URL
    async with HyperliquidInfoClient(url) as client:
        summary = await download(client, settings.data_dir, "BTC")
    for k, v in summary.items():
        print(f"{k:>8}: {v} rows")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["mainnet", "testnet"], default="mainnet")
    asyncio.run(main(ap.parse_args().source))
