"""BTC AI Trading System — Hyperliquid. Command-line entry point.

  python main.py run                 # mode from .env (PAPER by default) + dashboard API + Telegram
  python main.py run --live          # LIVE: only with every gate in docs/GO_LIVE.md
  python main.py check-connection    # read-only connectivity check (market + account if configured)
  python main.py download-data       # fetch history for backtests
  python main.py backtest [--research]
  python main.py train-ml
  python main.py walk-forward
  python main.py kill-switch status|reset
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from config.live_guard import ModeGuardError, validate_mode  # noqa: E402
from config.settings import Settings, get_settings  # noqa: E402
from core.models import TradingMode  # noqa: E402
from monitoring.logging_setup import setup_logging  # noqa: E402

log = logging.getLogger("main")


def build_exchange(settings: Settings, mode: TradingMode, store):
    from backtesting.costs import CostModel

    if mode == TradingMode.PAPER:
        from execution.paper import PaperExchange

        return PaperExchange(store, settings.initial_capital_usd, CostModel.from_settings(settings),
                             settings.runtime_dir / "paper_account.json", sz_decimals=store.sz_decimals)
    from execution.hyperliquid_exchange import HyperliquidExchange

    return HyperliquidExchange(mode, settings.execution_api_url, settings.hl_account_address,
                               settings.hl_api_wallet_private_key.get_secret_value())


async def run_system(settings: Settings, mode: TradingMode) -> bool:
    """Run until SIGINT/SIGTERM or until a task crashes. Returns True if a task crashed
    (so a supervisor such as launchd or Docker can restart the process)."""
    import uvicorn

    from agents.orchestrator import TradingSystem
    from dashboard.api.app import create_app, resolve_token
    from database.repository import Database
    from market_data.service import MarketDataService

    settings.ensure_dirs()
    db = Database(settings.database_url)
    market = MarketDataService(settings.market_data_api_url, settings.market_data_ws_url)
    await market.bootstrap()
    exchange = build_exchange(settings, mode, market.store)
    notifier = None
    bot = None
    tg_token = settings.telegram_bot_token.get_secret_value()
    if tg_token and settings.telegram_allowed_user_ids:
        from telegram.bot import TelegramBot

        bot = TelegramBot(tg_token, settings.telegram_allowed_user_ids)
        notifier = bot
    system = TradingSystem(settings, mode, market, exchange, db, notifier)
    if bot is not None:
        bot.system = system
    await system.start()

    token, token_file = resolve_token(settings)
    if token_file:
        log.warning("DASHBOARD_TOKEN not set: a random token was written to %s", token_file)
    app = create_app(system, settings, token)
    server = uvicorn.Server(uvicorn.Config(app, host=settings.api_host, port=settings.api_port, log_level="warning",
                                               lifespan="off"))
    tasks = [asyncio.create_task(system.run(), name="trading"), asyncio.create_task(server.serve(), name="api")]
    if bot is not None:
        tasks.append(asyncio.create_task(bot.run(), name="telegram"))
    log.info("dashboard on http://%s:%s", settings.api_host, settings.api_port)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except (NotImplementedError, RuntimeError):  # Windows
            pass
    crashed = False
    try:
        stop_task = asyncio.create_task(stop.wait(), name="stop")
        done, _ = await asyncio.wait([stop_task, *tasks], return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            if t is stop_task or t.cancelled():
                continue
            if t.exception() is not None:
                crashed = True
                log.error("task %s crashed: %s", t.get_name(), t.exception())
            elif not (stop.is_set() or server.should_exit):
                # uvicorn traps SIGINT/SIGTERM itself and sets should_exit: that is a requested stop.
                crashed = True
                log.error("task %s stopped unexpectedly", t.get_name())
    except KeyboardInterrupt:
        pass
    finally:
        log.info("shutting down (open positions keep their exchange-side stop-loss)")
        server.should_exit = True
        await system.stop()
        if bot is not None:
            await bot.stop()
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    return crashed


async def check_connection(settings: Settings) -> int:
    import time

    from market_data.hyperliquid_info import HyperliquidInfoClient

    url = settings.market_data_api_url
    print(f"market data endpoint: {url} (read-only)")
    async with HyperliquidInfoClient(url) as c:
        idx, uni, ctx = await c.asset_info("BTC")
        print(f"BTC asset index {idx}, szDecimals {uni['szDecimals']}, maxLeverage {uni.get('maxLeverage')}")
        print(f"mark {ctx['markPx']} oracle {ctx['oraclePx']} funding/h {ctx['funding']} OI {ctx['openInterest']}")
        book = await c.l2_book("BTC")
        print(f"book best bid {book['levels'][0][0]['px']} / ask {book['levels'][1][0]['px']}")
        now = int(time.time() * 1000)
        df = await c.candles("BTC", "1m", now - 10 * 60_000, now)
        print(f"last 1m candles: {len(df)} (latest close {df['close'].iloc[-1] if len(df) else '–'})")
    if settings.hl_account_address:
        acc_url = settings.execution_api_url or url
        async with HyperliquidInfoClient(acc_url) as c:
            st = await c.clearinghouse_state(settings.hl_account_address)
            print(f"account {settings.hl_account_address} on {acc_url}: accountValue "
                  f"{st.get('marginSummary', {}).get('accountValue')} positions {len(st.get('assetPositions', []))}")
    print("OK — nothing was signed or sent.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="BTC AI Trading System — Hyperliquid")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--live", action="store_true", help="required (with all .env gates) for LIVE mode")
    sub.add_parser("check-connection")
    sub.add_parser("download-data")
    b = sub.add_parser("backtest")
    b.add_argument("--research", action="store_true")
    sub.add_parser("train-ml")
    sub.add_parser("walk-forward")
    k = sub.add_parser("kill-switch")
    k.add_argument("action", choices=["status", "reset"])
    args = ap.parse_args()

    settings = get_settings()
    setup_logging(settings)
    settings.ensure_dirs()
    scripts = ROOT / "scripts"
    if args.cmd == "run":
        try:
            mode = validate_mode(settings, cli_live_flag=args.live, interactive=True)
        except ModeGuardError as exc:
            print(f"REFUSED: {exc}")
            return 2
        return 1 if asyncio.run(run_system(settings, mode)) else 0
    if args.cmd == "check-connection":
        return asyncio.run(check_connection(settings))
    if args.cmd == "download-data":
        return subprocess.call([sys.executable, str(scripts / "download_history.py")])
    if args.cmd == "backtest":
        return subprocess.call([sys.executable, str(scripts / "run_backtest.py")] + (["--research"] if args.research else []))
    if args.cmd == "train-ml":
        return subprocess.call([sys.executable, str(scripts / "train_models.py")])
    if args.cmd == "walk-forward":
        return subprocess.call([sys.executable, str(scripts / "walk_forward_study.py")])
    if args.cmd == "kill-switch":
        from risk.kill_switch import KillSwitch

        ks = KillSwitch(settings.runtime_dir / "kill_switch.json")
        print(ks.to_dict())
        if args.action == "reset":
            typed = input("Type RESET to re-enable trading after reviewing the cause: ").strip()
            ks.reset(typed)
            print("kill switch reset -> running")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
