"""Gatekeeper for TESTNET / LIVE modes.

LIVE requires, *all at once*:
1. TRADING_MODE=live in the environment (explicit configuration),
2. LIVE_TRADING_CONFIRMATION equal to the exact phrase,
3. LIVE_ELIGIBILITY_ACKNOWLEDGED=true (the human checked legal/platform eligibility),
4. API wallet credentials present,
5. the `--live` command-line flag, and
6. an interactive confirmation typed by a human on the terminal at start-up
   (a random code must be re-typed — impossible to pre-script by an agent
   that does not see the terminal).

No runtime component (dashboard, Telegram, agents) can change the mode.
"""
from __future__ import annotations

import re
import secrets
import sys
from collections.abc import Callable

from config.settings import LIVE_CONFIRMATION_PHRASE, Settings
from core.models import TradingMode

_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_PRIVKEY_RE = re.compile(r"^(0x)?[0-9a-fA-F]{64}$")


class ModeGuardError(RuntimeError):
    pass


def check_credentials(settings: Settings) -> None:
    if not _ADDRESS_RE.match(settings.hl_account_address or ""):
        raise ModeGuardError("HL_ACCOUNT_ADDRESS must be the 42-char public address of the main account")
    key = settings.hl_api_wallet_private_key.get_secret_value()
    if not _PRIVKEY_RE.match(key or ""):
        raise ModeGuardError("HL_API_WALLET_PRIVATE_KEY missing or malformed (dedicated API wallet key expected)")


def validate_mode(
    settings: Settings,
    cli_live_flag: bool = False,
    interactive: bool = True,
    input_fn: Callable[[str], str] = input,
) -> TradingMode:
    """Validate the configured mode. Returns the mode or raises ModeGuardError."""
    # Always validates risk ceilings first.
    settings.risk_limits  # noqa: B018 - raises RiskLimitError if invalid

    mode = settings.trading_mode
    if mode == TradingMode.PAPER:
        return mode

    check_credentials(settings)
    if mode == TradingMode.TESTNET:
        return mode

    # ---- LIVE ----
    problems = []
    if settings.live_trading_confirmation != LIVE_CONFIRMATION_PHRASE:
        problems.append("LIVE_TRADING_CONFIRMATION does not match the required phrase")
    if not settings.live_eligibility_acknowledged:
        problems.append("LIVE_ELIGIBILITY_ACKNOWLEDGED is not true (verify legal/platform eligibility first)")
    if settings.max_leverage != 1:
        problems.append("initial live phase requires MAX_LEVERAGE=1")
    if not cli_live_flag:
        problems.append("the --live command-line flag is required")
    if not interactive or not sys.stdin.isatty():
        problems.append("LIVE requires an interactive terminal for the human confirmation")
    if problems:
        raise ModeGuardError("LIVE mode refused: " + "; ".join(problems))

    code = secrets.token_hex(3).upper()
    print("\n" + "=" * 70)
    print(" LIVE TRADING — REAL FUNDS ON HYPERLIQUID MAINNET")
    print(f" Account: {settings.hl_account_address}")
    print(f" Risk/trade: {settings.risk_per_trade_pct}%  Daily loss: {settings.max_daily_loss_pct}%"
          f"  Max DD: {settings.max_drawdown_pct}%  Leverage: {settings.max_leverage}x")
    print("=" * 70)
    typed = input_fn(f"Type the code {code} to start LIVE trading (anything else aborts): ").strip()
    if typed != code:
        raise ModeGuardError("LIVE confirmation code mismatch — aborted")
    return mode
