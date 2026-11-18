import pytest

from agents.execution_agent import CriticalExecutionError, ExecutionAgent
from backtesting.costs import CostModel
from core.models import (AccountState, Confidence, Direction, EntryType, ManagedPosition, OpenOrder, OrderKind,
                         OrderRequest, OrderState, Position, Regime, RiskVerdict, StrategyName, TradeSetup, TradeSignal,
                         TradingMode)
from execution.hyperliquid_exchange import (HyperliquidExchange, parse_account, parse_order_response,
                                            parse_order_status)
from execution.paper import PaperExchange
from execution.reconciliation import reconcile
from execution.rounding import new_cloid, round_price, round_size
from execution.base import ExchangeError
from market_data.store import MarketDataStore


def make_store(mid=60_000.0, depth=0.5):
    s = MarketDataStore()
    bids = [{"px": str(mid - 1 - i), "sz": str(depth), "n": 1} for i in range(10)]
    asks = [{"px": str(mid + i), "sz": str(depth), "n": 1} for i in range(10)]
    s.on_l2book({"levels": [bids, asks]})
    s.on_asset_ctx({"coin": "BTC", "ctx": {"markPx": str(mid), "oraclePx": str(mid), "funding": "0.0000125"}})
    return s


def set_mark(store, px):
    store.on_asset_ctx({"coin": "BTC", "ctx": {"markPx": str(px), "oraclePx": str(px), "funding": "0.0000125"}})
    bids = [{"px": str(px - 1 - i), "sz": "0.5", "n": 1} for i in range(10)]
    asks = [{"px": str(px + i), "sz": "0.5", "n": 1} for i in range(10)]
    store.on_l2book({"levels": [bids, asks]})


def signal(direction=Direction.LONG, size=0.01, entry=60_000.0, stop=59_400.0, tp=61_200.0, entry_type=EntryType.MARKET):
    st = TradeSetup(strategy=StrategyName.INTRADAY, direction=direction, entry_type=entry_type, entry_price=entry,
                    stop_loss=stop, take_profit=tp, timeframe="15m", score=70)
    return TradeSignal(direction=direction, strategy=st.strategy, regime=Regime.STRONG_BULL, entry_price=entry,
                       stop_loss=stop, take_profit=tp, size=size, setup=st, confidence=Confidence(raw_score=70),
                       risk=RiskVerdict(approved=True, size=size, notional_usd=size * entry, risk_usd=6.5))


async def _nosleep(_):
    return None


def agent(ex):
    return ExecutionAgent(ex, sz_decimals=5, confirm_timeout_s=0.05, poll_interval_s=0.0, limit_entry_timeout_s=0.05,
                          sleep=_nosleep)


# ---------------------------------------------------------------- rounding
def test_rounding_rules():
    assert round_price(64_712.37, 5) == 64_712.0
    assert round_price(64_712.6, 5, "down") == 64_712.0
    assert round_price(64_712.2, 5, "up") == 64_713.0
    assert round_price(1234.567, 2) == 1234.6        # 5 significant figures
    assert round_price(0.0123456, 0) == 0.012346     # 6 decimals max for perps
    assert round_size(0.0123456789, 5) == 0.01234
    c = new_cloid()
    assert c.startswith("0x") and len(c) == 34


# ---------------------------------------------------------------- paper exchange
async def test_paper_ioc_walks_book_partial_fill_and_fees(tmp_path):
    store = make_store(depth=0.01)
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    ack = await ex.place_order(OrderRequest(is_buy=True, size=0.05, limit_price=60_002, kind=OrderKind.ENTRY, tif="Ioc"))
    assert ack.ok and ack.filled_size == pytest.approx(0.03)  # only 3 levels within the limit
    acct = await ex.get_account_state()
    assert acct.position().size == pytest.approx(0.03)
    assert acct.balance < 1000  # taker fee paid


async def test_paper_rules(tmp_path):
    store = make_store()
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    small = await ex.place_order(OrderRequest(is_buy=True, size=0.0001, limit_price=60_100, kind=OrderKind.ENTRY, tif="Ioc"))
    assert not small.ok and "minimum" in small.error
    ro = await ex.place_order(OrderRequest(is_buy=False, size=0.01, limit_price=59_000, kind=OrderKind.EXIT,
                                           reduce_only=True, tif="Ioc"))
    assert not ro.ok and "Reduce only" in ro.error
    alo = await ex.place_order(OrderRequest(is_buy=True, size=0.01, limit_price=60_005, kind=OrderKind.ENTRY, tif="Alo"))
    assert not alo.ok  # would cross


async def test_paper_stop_trigger_and_funding(tmp_path):
    store = make_store()
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    await ex.place_order(OrderRequest(is_buy=True, size=0.01, limit_price=60_100, kind=OrderKind.ENTRY, tif="Ioc"))
    sl = await ex.place_order(OrderRequest(is_buy=False, size=0.01, limit_price=53_000, kind=OrderKind.STOP_LOSS,
                                           reduce_only=True, trigger_price=59_000, tpsl="sl"))
    assert sl.state == OrderState.RESTING
    ex.last_funding_hour -= 1  # force an hourly settlement
    await ex.on_market_update()
    assert ex.funding_events and ex.funding_events[-1]["paid"] > 0  # long pays positive funding
    set_mark(store, 58_900)
    await ex.on_market_update()
    acct = await ex.get_account_state()
    assert acct.position() is None
    assert (await ex.query_order(oid=sl.oid)).state == OrderState.TRIGGERED
    reloaded = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    assert reloaded.balance == pytest.approx(ex.balance)


# ---------------------------------------------------------------- execution agent
async def test_open_position_installs_verified_protection(tmp_path):
    store = make_store()
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    ag = agent(ex)
    pos = await ag.open_position(signal())
    assert pos is not None and pos.size == pytest.approx(0.01)
    acct = await ex.get_account_state()
    triggers = [o for o in acct.open_orders if o.is_trigger]
    assert len(triggers) == 2 and all(o.reduce_only for o in triggers)
    sl = [o for o in triggers if "Stop" in o.order_type][0]
    assert sl.trigger_price == 59_400 and sl.size == pytest.approx(0.01)
    # second position must be refused
    assert await ag.open_position(signal()) is None


async def test_partial_fill_protection_sized_on_real_position(tmp_path):
    store = make_store(depth=0.001)  # 10 levels x 0.001 = 0.01 BTC < 0.02 requested
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    ag = agent(ex)
    pos = await ag.open_position(signal(size=0.02))
    assert pos is not None
    real = (await ex.get_account_state()).position().size
    assert real < 0.02 and pos.size == pytest.approx(real)
    sl = [o for o in (await ex.get_account_state()).open_orders if "Stop" in o.order_type][0]
    assert sl.size == pytest.approx(real)


class _NoStopExchange(PaperExchange):
    async def place_order(self, req):
        if req.tpsl == "sl":
            from core.models import OrderAck
            return OrderAck(ok=False, state=OrderState.REJECTED, cloid=req.cloid, error="Invalid TP/SL price.")
        return await super().place_order(req)


async def test_stop_failure_triggers_emergency_close(tmp_path):
    store = make_store()
    ex = _NoStopExchange(store, 1000, CostModel(), tmp_path / "p.json")
    ag = agent(ex)
    with pytest.raises(CriticalExecutionError):
        await ag.open_position(signal())
    acct = await ex.get_account_state()
    assert acct.position() is None, "position must never stay unprotected"
    assert not acct.open_orders


async def test_update_stop_only_tightens_and_close(tmp_path):
    store = make_store()
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    ag = agent(ex)
    await ag.open_position(signal())
    assert not await ag.update_stop(59_000, "loosen attempt")
    assert await ag.update_stop(59_700, "tighten")
    stops = [o for o in (await ex.get_account_state()).open_orders if "Stop" in o.order_type]
    assert len(stops) == 1 and stops[0].trigger_price == 59_700
    assert await ag.close_position("test")
    acct = await ex.get_account_state()
    assert acct.position() is None and not acct.open_orders
    rec = await ag.build_trade_record(ag.position, "manual", "paper")
    assert rec.fees > 0 and rec.net_pnl == pytest.approx(rec.gross_pnl - rec.fees - rec.funding)


async def test_preflight_refuses_when_exchange_not_flat(tmp_path):
    store = make_store()
    ex = PaperExchange(store, 1000, CostModel(), tmp_path / "p.json")
    await ex.place_order(OrderRequest(is_buy=True, size=0.01, limit_price=60_100, kind=OrderKind.ENTRY, tif="Ioc"))
    ag = agent(ex)
    assert await ag.open_position(signal()) is None


# ---------------------------------------------------------------- reconciliation
def _mp(**kw):
    base = dict(direction=Direction.LONG, size=0.01, entry_price=60_000, stop_loss=59_400, initial_stop=59_400,
                strategy=StrategyName.INTRADAY, regime=Regime.STRONG_BULL, sl_oid=7)
    base.update(kw)
    return ManagedPosition(**base)


def test_reconcile_cases():
    pos = Position(size=0.01, entry_price=60_000)
    sl = OpenOrder(oid=7, coin="BTC", is_buy=False, size=0.01, limit_price=54_000, reduce_only=True, is_trigger=True,
                   trigger_price=59_400, order_type="Stop Market")
    assert reconcile(_mp(), AccountState(equity=1000, balance=1000, positions=[pos], open_orders=[sl])).ok
    assert "closed" in reconcile(_mp(), AccountState(equity=1000, balance=1000)).actions
    assert "missing_sl" in reconcile(_mp(), AccountState(equity=1000, balance=1000, positions=[pos])).actions
    r = reconcile(None, AccountState(equity=1000, balance=1000, positions=[pos]))
    assert r.desync and "protect_unmanaged" in r.actions
    short = Position(size=-0.01, entry_price=60_000)
    assert reconcile(_mp(), AccountState(equity=1000, balance=1000, positions=[short])).desync
    bigger = Position(size=0.02, entry_price=60_000)
    assert "adopt_size" in reconcile(_mp(), AccountState(equity=1000, balance=1000, positions=[bigger], open_orders=[sl])).actions


# ---------------------------------------------------------------- hyperliquid parsing (documented payloads)
def test_parse_documented_responses():
    resting = {"status": "ok", "response": {"type": "order", "data": {"statuses": [{"resting": {"oid": 77738308}}]}}}
    filled = {"status": "ok", "response": {"type": "order", "data": {"statuses": [
        {"filled": {"totalSz": "0.02", "avgPx": "1891.4", "oid": 77747314}}]}}}
    err = {"status": "ok", "response": {"type": "order", "data": {"statuses": [{"error": "Order must have minimum value of $10."}]}}}
    assert parse_order_response(resting, None).state == OrderState.RESTING
    f = parse_order_response(filled, None)
    assert f.state == OrderState.FILLED and f.filled_size == 0.02 and f.avg_price == 1891.4
    assert parse_order_response(err, None).state == OrderState.REJECTED
    assert parse_order_response({"status": "err", "response": "bad"}, None).state == OrderState.REJECTED
    st = parse_order_status({"status": "order", "order": {"order": {"oid": 1, "origSz": "0.0076", "sz": "0.0",
                                                                     "isTrigger": False}, "status": "filled"}}, 1, None)
    assert st.state == OrderState.FILLED
    assert parse_order_status({"status": "unknownOid"}, 1, None).state == OrderState.UNKNOWN
    assert parse_order_status({"status": "order", "order": {"order": {"oid": 2}, "status": "perpMarginRejected"}}, 2, None).state == OrderState.REJECTED
    ch = {"assetPositions": [{"position": {"coin": "BTC", "entryPx": "60000", "leverage": {"type": "isolated", "value": 1},
                                           "liquidationPx": None, "marginUsed": "600", "szi": "0.01", "unrealizedPnl": "5"},
                              "type": "oneWay"}],
          "marginSummary": {"accountValue": "1005"}, "withdrawable": "400"}
    oo = [{"coin": "BTC", "isTrigger": True, "limitPx": "54000", "oid": 9, "orderType": "Stop Market", "reduceOnly": True,
           "side": "A", "sz": "0.01", "triggerPx": "59400"}]
    a = parse_account(ch, oo)
    assert a.equity == 1005 and a.position().size == 0.01 and a.open_orders[0].trigger_price == 59400


def test_signing_client_refused_in_paper_mode():
    with pytest.raises(ExchangeError):
        HyperliquidExchange(TradingMode.PAPER, "https://api.hyperliquid-testnet.xyz", "0x" + "1" * 40, "0x" + "2" * 64)


def test_sdk_exchange_object_has_no_withdraw_in_our_wrapper():
    for forbidden in ("withdraw", "transfer", "usd_transfer", "send_asset", "withdraw_from_bridge"):
        assert not hasattr(HyperliquidExchange, forbidden)
