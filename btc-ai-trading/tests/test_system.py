"""Integration tests: orchestrator tick in paper mode with an offline market,
dashboard API auth/controls, Telegram command security, database."""
import asyncio
import json

import httpx
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from agents.orchestrator import TradingSystem
from config.settings import get_settings
from core.models import Direction, Regime, StrategyName, TradeRecord, TradingMode
from dashboard.api.app import create_app
from database.repository import Database
from execution.paper import PaperExchange
from backtesting.costs import CostModel
from market_data.candles import resample
from market_data.store import MarketDataStore
from telegram.bot import TelegramBot
from tests.conftest import make_candles

TOKEN = "unit-test-token-0123456789"


class _FakeWS:
    connected = True
    reconnects = 0
    last_message_ms = None

    def disconnects_last(self, s):
        return 0


class _FakeInfo:
    consecutive_failures = 0


class FakeMarket:
    """Offline MarketDataService stand-in fed with synthetic candles."""

    def __init__(self):
        import time
        now = int(time.time() * 1000)
        base = make_candles(3000, tf_ms=60_000, seed=9, start_ms=now - 3000 * 60_000 - (now % 60_000))
        self.store = MarketDataStore(timeframes=["1m", "5m", "15m", "30m", "1h", "4h"])
        self.store.set_candles("1m", base, now)
        for tf in ("5m", "15m", "30m", "1h", "4h"):
            self.store.set_candles(tf, resample(base, tf), now)
        px = float(base["close"].iloc[-1])
        bids = [{"px": str(round(px) - 1 - i), "sz": "1", "n": 1} for i in range(10)]
        asks = [{"px": str(round(px) + i), "sz": "1", "n": 1} for i in range(10)]
        self.store.on_l2book({"levels": [bids, asks]}, now)
        self.store.on_asset_ctx({"coin": "BTC", "ctx": {"markPx": str(px), "oraclePx": str(px), "funding": "0.0000125"}}, now)
        for tf in self.store.timeframes:
            self.store.last_update[f"candle_{tf}"] = now
        self.ws, self.info = _FakeWS(), _FakeInfo()

    async def start(self):
        return None

    async def stop(self):
        return None

    def health(self):
        return {"ws_connected": True, "ws_reconnects": 0, "ws_disconnects_10min": 0, "ws_last_message_age_s": 0.1,
                "rest_consecutive_failures": 0, "staleness_s": {}, "book_age_s": 0.0, "ctx_age_s": 0.0, "candle_1m_lag_s": 0.0}


@pytest.fixture
def system():
    s = get_settings()
    s.ensure_dirs()
    market = FakeMarket()
    ex = PaperExchange(market.store, 1000, CostModel(), s.runtime_dir / "paper.json")
    sysm = TradingSystem(s, TradingMode.PAPER, market, ex, Database(s.database_url))
    asyncio.run(sysm.start())
    return sysm


def test_every_agent_exposes_state(system):
    states = system.agents_state()
    assert len(states) == 8
    assert all(isinstance(a["status"], str) and a["name"] for a in states)


def test_orchestrator_tick_paper(system):
    asyncio.run(system.tick())
    st = system.state()
    assert st["mode"] == "paper" and st["account"]["equity"] == pytest.approx(1000.0)
    assert st["last_signal"] is not None
    assert st["last_signal"]["direction"] in ("LONG", "SHORT", "NO_TRADE")
    assert set(system.last_reports) >= {"scan", "technical", "liquidity", "regime", "strategy"}


def test_stale_data_halts_and_blocks(system):
    for k in list(system.store.last_update):
        system.store.last_update[k] -= 10 * 60_000
    asyncio.run(system.tick())
    assert system.kill_switch.state.value == "halted"
    assert not system.kill_switch.entries_allowed


def test_api_auth_and_controls(system):
    client = TestClient(create_app(system, get_settings(), TOKEN))
    assert client.get("/api/health").json()["ok"] is True
    assert client.get("/api/overview").status_code == 401
    assert client.get("/api/overview", headers={"Authorization": "Bearer wrong"}).status_code == 401
    h = {"Authorization": f"Bearer {TOKEN}"}
    asyncio.run(system.tick())
    for ep in ("overview", "market", "agents", "trades", "performance", "risk", "settings", "backtests"):
        r = client.get(f"/api/{ep}", headers=h)
        assert r.status_code == 200, (ep, r.text[:200])
    assert client.post("/api/settings/mode-request", json={"mode": "live"}, headers=h).status_code == 400
    assert client.post("/api/settings/mode-request", json={"mode": "testnet"}, headers=h).status_code == 200
    assert client.post("/api/control/pause", headers=h).json()["state"] == "paused"
    assert client.post("/api/control/resume", headers=h).json()["state"] == "running"
    assert client.post("/api/control/emergency-stop", json={"confirm": "nope"}, headers=h).status_code == 400
    assert client.post("/api/control/emergency-stop", json={"confirm": "EMERGENCY"}, headers=h).json()["state"] == "halted"
    assert client.post("/api/control/resume", headers=h).status_code == 409  # halted needs CLI reset


async def test_telegram_whitelist_and_two_step_emergency(system):
    sent = []

    def handler(req: httpx.Request):
        sent.append(json.loads(req.content))
        return httpx.Response(200, json={"ok": True, "result": True})

    bot = TelegramBot("123456:" + "A" * 35, [111], system, transport=httpx.MockTransport(handler))
    upd = lambda uid, text: {"update_id": 1, "message": {"from": {"id": uid}, "chat": {"id": uid}, "text": text}}  # noqa: E731
    assert await bot.handle_update(upd(999, "/status")) is None          # unauthorized user ignored
    assert not sent
    assert "Mode" in await bot.handle_update(upd(111, "/status"))
    bot._last_cmd.clear()
    r = await bot.execute("/emergency_stop", [], 111)
    assert "CONFIRM" in r and system.kill_switch.entries_allowed
    r = await bot.execute("/emergency_stop", ["CONFIRM"], 111)
    assert "URGENCE" in r and system.kill_switch.state.value == "halted"
    r = await bot.execute("/risk", [], 111)
    assert "non modifiable" in r
    assert "inconnue" in await bot.execute("/set_risk", ["5"], 111)
    await bot.stop()


def test_database_roundtrip(tmp_path):
    db = Database(f"sqlite:///{tmp_path / 'db.sqlite'}")
    t = TradeRecord(mode="paper", strategy=StrategyName.INTRADAY, regime=Regime.SIDEWAYS, direction=Direction.LONG,
                    entry_time=1, exit_time=2, entry_price=100, exit_price=101, size=0.01, initial_stop=99, risk_usd=1,
                    gross_pnl=0.01, fees=0.001, funding=0, net_pnl=0.009, exit_reason="tp", r_multiple=0.009)
    db.add_trade(t)
    db.add_event(1, "paper", "info", "test", "k", "msg")
    db.add_equity(1, "paper", 1000, 1000, 0, 0, 0)
    assert db.trades("paper")[0].net_pnl == pytest.approx(0.009)
    assert db.events("paper")[0]["message"] == "msg"
    assert db.equity_curve("paper")[0]["equity"] == 1000
