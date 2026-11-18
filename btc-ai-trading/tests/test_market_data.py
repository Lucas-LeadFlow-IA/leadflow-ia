import asyncio
import json
import time

import httpx
import pytest

from market_data.candles import candles_from_api, detect_gaps
from market_data.hyperliquid_info import HyperliquidInfoClient, InfoAPIError
from market_data.store import MarketDataStore
from market_data.websocket_feed import HyperliquidWebSocket


def _candle(t, tf_ms=60_000, px=100.0, i="1m"):
    return {"t": t, "T": t + tf_ms - 1, "s": "BTC", "i": i, "o": str(px), "c": str(px + 1),
            "h": str(px + 2), "l": str(px - 1), "v": "1.5", "n": 10}


def test_candles_from_api_and_gaps():
    rows = [_candle(0), _candle(60_000), _candle(240_000), _candle(60_000, px=101)]
    df = candles_from_api(rows)
    assert list(df["open_time"]) == [0, 60_000, 240_000]
    assert df.loc[1, "open"] == 101.0  # last update of a duplicated candle wins
    assert detect_gaps(df, "1m") == [(60_000, 240_000)]


def test_store_only_exposes_closed_candles():
    s = MarketDataStore(timeframes=["1m"])
    now = 1_000_000_000_000
    t0 = now - 3 * 60_000 - (now % 60_000)
    s.set_candles("1m", candles_from_api([_candle(t0), _candle(t0 + 60_000), _candle(t0 + 120_000),
                                          _candle(t0 + 180_000)]), now_ms=now)
    closed = s.closed("1m", now_ms=now)
    assert closed["close_time"].max() < now
    forming_t = t0 + 180_000
    # websocket pushes an update of the forming candle, then the next candle
    s.on_candle(_candle(forming_t, px=105), now_ms=now)
    s.on_candle(_candle(forming_t + 60_000, px=106), now_ms=now + 60_000)
    closed = s.closed("1m", now_ms=now + 60_000)
    assert int(closed["open_time"].iloc[-1]) == forming_t
    assert float(closed["open"].iloc[-1]) == 105.0


def test_store_book_ctx_and_staleness():
    s = MarketDataStore()
    s.on_l2book({"levels": [[{"px": "100", "sz": "2", "n": 1}], [{"px": "101", "sz": "1", "n": 1}]]}, now_ms=1000)
    s.on_asset_ctx({"coin": "BTC", "ctx": {"funding": "0.0000125", "markPx": "100.4"}}, now_ms=1000)
    assert s.mid == 100.5 and s.mark == 100.4 and s.funding_rate == pytest.approx(1.25e-5)
    assert s.staleness_s("book", now_ms=6000) == pytest.approx(5.0)
    assert s.staleness_s("never") == float("inf")


async def test_info_client_retries_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request):
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(502, text="bad gateway")
        return httpx.Response(200, json={"BTC": "100.0"})

    client = HyperliquidInfoClient("https://example.invalid", transport=httpx.MockTransport(handler))
    client.max_retries = 3
    mids = await client.all_mids()
    assert mids == {"BTC": "100.0"} and calls["n"] == 3
    await client.close()


async def test_info_client_does_not_retry_client_errors():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(422, text="bad payload")

    client = HyperliquidInfoClient("https://example.invalid", transport=httpx.MockTransport(handler))
    with pytest.raises(InfoAPIError):
        await client.all_mids()
    assert calls["n"] == 1
    await client.close()


class _FakeWS:
    """Minimal async websocket used to test reconnection logic."""

    def __init__(self, messages, sent):
        self.messages = list(messages)
        self.sent = sent

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def send(self, data):
        self.sent.append(json.loads(data))

    async def close(self):
        self.messages = []

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.messages:
            raise StopAsyncIteration  # server closed the connection
        await asyncio.sleep(0)
        return self.messages.pop(0)


async def test_websocket_resubscribes_and_calls_reconnect_hook():
    sent: list = []
    sessions = [
        [json.dumps({"channel": "l2Book", "data": {"levels": [[], []]}})],
        [json.dumps({"channel": "l2Book", "data": {"levels": [[], []]}})],
    ]
    received, hooks = [], []

    def connect(url, **kw):
        if not sessions:
            raise ConnectionError("down")
        return _FakeWS(sessions.pop(0), sent)

    ws = HyperliquidWebSocket("wss://test", connect=connect)
    ws.MAX_BACKOFF = 0.01
    ws.subscribe({"type": "l2Book", "coin": "BTC"})
    ws.on("l2Book", lambda d: received.append(d))

    async def hook():
        hooks.append(1)

    ws.on_reconnect(hook)
    task = asyncio.create_task(ws.run())
    for _ in range(200):
        await asyncio.sleep(0.01)
        if len(received) >= 2 and hooks:
            break
    await ws.stop()
    task.cancel()
    subs = [m for m in sent if m.get("method") == "subscribe"]
    assert len(subs) == 2, "subscription must be replayed after reconnect"
    assert len(received) == 2 and hooks == [1]
    assert ws.reconnects == 1


# ---------------------------------------------------------------- real API (read-only)
@pytest.mark.network
async def test_real_hyperliquid_read_only():
    client = HyperliquidInfoClient("https://api.hyperliquid.xyz")
    try:
        idx, uni, ctx = await client.asset_info("BTC")
        assert uni["name"] == "BTC" and int(uni["szDecimals"]) >= 0
        assert float(ctx["markPx"]) > 1000
        book = await client.l2_book("BTC")
        assert book["levels"][0] and book["levels"][1]
        now = int(time.time() * 1000)
        df = await client.candles("BTC", "15m", now - 200 * 900_000, now)
        assert len(df) >= 150
        funding = await client.funding_history("BTC", now - 3 * 86_400_000)
        assert len(funding) >= 48
    finally:
        await client.close()
