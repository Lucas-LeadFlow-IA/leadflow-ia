import io
import logging
import subprocess
from pathlib import Path

import pytest

from config.live_guard import ModeGuardError, validate_mode
from config.settings import LIVE_CONFIRMATION_PHRASE, Settings
from core.models import TradingMode
from monitoring.logging_setup import RedactingFilter, redact

KEY = "0x" + "ab" * 32
ADDR = "0x" + "12" * 20
ROOT = Path(__file__).resolve().parent.parent


def test_paper_is_default_and_never_needs_keys(monkeypatch):
    monkeypatch.delenv("TRADING_MODE", raising=False)
    s = Settings(_env_file=None)
    assert s.trading_mode == TradingMode.PAPER
    assert s.execution_api_url is None
    assert validate_mode(s) == TradingMode.PAPER


def test_testnet_requires_credentials():
    s = Settings(_env_file=None, trading_mode="testnet")
    with pytest.raises(ModeGuardError):
        validate_mode(s)
    ok = Settings(_env_file=None, trading_mode="testnet", hl_account_address=ADDR, hl_api_wallet_private_key=KEY)
    assert validate_mode(ok) == TradingMode.TESTNET
    assert ok.execution_api_url == "https://api.hyperliquid-testnet.xyz"


def test_live_refused_without_every_gate(monkeypatch):
    base = dict(_env_file=None, trading_mode="live", hl_account_address=ADDR, hl_api_wallet_private_key=KEY)
    with pytest.raises(ModeGuardError, match="CONFIRMATION"):
        validate_mode(Settings(**base), cli_live_flag=True)
    s = Settings(**base, live_trading_confirmation=LIVE_CONFIRMATION_PHRASE)
    with pytest.raises(ModeGuardError, match="ELIGIBILITY"):
        validate_mode(s, cli_live_flag=True)
    s = Settings(**base, live_trading_confirmation=LIVE_CONFIRMATION_PHRASE, live_eligibility_acknowledged=True)
    with pytest.raises(ModeGuardError, match="--live"):
        validate_mode(s, cli_live_flag=False)
    with pytest.raises(ModeGuardError, match="interactive"):
        validate_mode(s, cli_live_flag=True, interactive=False)


def test_live_requires_typed_random_code(monkeypatch):
    s = Settings(_env_file=None, trading_mode="live", hl_account_address=ADDR, hl_api_wallet_private_key=KEY,
                 live_trading_confirmation=LIVE_CONFIRMATION_PHRASE, live_eligibility_acknowledged=True)
    monkeypatch.setattr("sys.stdin.isatty", lambda: True)
    with pytest.raises(ModeGuardError, match="mismatch"):
        validate_mode(s, cli_live_flag=True, input_fn=lambda prompt: "WRONG")
    captured = {}

    def echo_code(prompt):
        captured["code"] = prompt.split("code ")[1].split(" ")[0]
        return captured["code"]

    assert validate_mode(s, cli_live_flag=True, input_fn=echo_code) == TradingMode.LIVE


def test_log_redaction():
    assert KEY not in redact(f"key={KEY}")
    assert "123456789:" not in redact("https://api.telegram.org/bot123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/getMe")
    stream = io.StringIO()
    h = logging.StreamHandler(stream)
    h.addFilter(RedactingFilter(["my-dashboard-secret-token"]))
    lg = logging.getLogger("redaction-test")
    lg.addHandler(h)
    lg.warning("token my-dashboard-secret-token and key %s", KEY)
    out = stream.getvalue()
    assert "my-dashboard-secret-token" not in out and KEY not in out


def test_env_is_gitignored_and_example_has_no_secret():
    gi = (ROOT / ".gitignore").read_text()
    assert ".env" in gi.splitlines()
    example = (ROOT / ".env.example").read_text()
    for line in example.splitlines():
        if line.startswith(("HL_API_WALLET_PRIVATE_KEY=", "TELEGRAM_BOT_TOKEN=", "LIVE_TRADING_CONFIRMATION=")):
            assert line.split("=", 1)[1].strip() == ""


def test_no_hardcoded_private_keys_in_source():
    import re
    pat = re.compile(r"0x[0-9a-fA-F]{64}")
    offenders = []
    for p in ROOT.rglob("*.py"):
        if any(part in (".venv", "node_modules", "tests") for part in p.parts):
            continue
        if pat.search(p.read_text(encoding="utf-8", errors="ignore")):
            offenders.append(str(p))
    assert not offenders, offenders
