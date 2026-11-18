"""TESTNET / LIVE execution through the official Hyperliquid Python SDK.

* Signing uses the official SDK (`hyperliquid.exchange.Exchange`) with a
  dedicated API wallet (agent) key — never the main wallet key.
* Reads use our async info client with `account_address` = the MAIN
  account (docs: querying with the agent address returns empty results).
* All signed actions are serialised behind one lock and spaced >= 5 ms:
  the SDK uses the millisecond timestamp as nonce and nonces must be
  unique per signer (docs: nonces-and-api-wallets).
* Exposed actions: order, cancel, update_leverage. Nothing else — this
  class cannot transfer or withdraw funds.
* The schedule-cancel "dead man's switch" is deliberately NOT used: it
  cancels ALL open orders, including our stop-losses.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from core.models import (AccountState, Fill, OpenOrder, OrderAck, OrderRequest, OrderState, OrderStatusInfo,
                         Position, TradingMode)
from execution.base import ExchangeClient, ExchangeError
from market_data.hyperliquid_info import HyperliquidInfoClient

log = logging.getLogger(__name__)

_STATUS_MAP = {
    "open": OrderState.RESTING, "filled": OrderState.FILLED, "canceled": OrderState.CANCELED,
    "triggered": OrderState.TRIGGERED, "rejected": OrderState.REJECTED,
}


def parse_order_response(resp: Any, cloid: str | None) -> OrderAck:
    """Parse the documented `order` response. A 'filled'/'resting' status is
    an acknowledgement only — callers must still confirm via queries."""
    if not isinstance(resp, dict):
        return OrderAck(ok=False, state=OrderState.UNKNOWN, cloid=cloid, error=f"unexpected response {resp!r}", raw=resp)
    if resp.get("status") != "ok":
        return OrderAck(ok=False, state=OrderState.REJECTED, cloid=cloid, error=str(resp.get("response")), raw=resp)
    try:
        st = resp["response"]["data"]["statuses"][0]
    except (KeyError, IndexError, TypeError):
        return OrderAck(ok=False, state=OrderState.UNKNOWN, cloid=cloid, error="missing statuses", raw=resp)
    if "error" in st:
        return OrderAck(ok=False, state=OrderState.REJECTED, cloid=cloid, error=st["error"], raw=resp)
    if "filled" in st:
        f = st["filled"]
        return OrderAck(ok=True, state=OrderState.FILLED, oid=int(f["oid"]), cloid=cloid,
                        filled_size=float(f["totalSz"]), avg_price=float(f["avgPx"]), raw=resp)
    if "resting" in st:
        return OrderAck(ok=True, state=OrderState.RESTING, oid=int(st["resting"]["oid"]), cloid=cloid, raw=resp)
    return OrderAck(ok=False, state=OrderState.UNKNOWN, cloid=cloid, error=f"unknown status {st}", raw=resp)


def parse_order_status(resp: Any, oid: int | None, cloid: str | None) -> OrderStatusInfo:
    if not isinstance(resp, dict) or resp.get("status") != "order":
        return OrderStatusInfo(oid=oid, cloid=cloid, state=OrderState.UNKNOWN, raw=resp)
    o = resp["order"]["order"]
    status = resp["order"].get("status", "")
    state = _STATUS_MAP.get(status, OrderState.CANCELED if status.endswith("Canceled") else
                            OrderState.REJECTED if status.endswith("Rejected") else OrderState.UNKNOWN)
    return OrderStatusInfo(oid=int(o.get("oid")) if o.get("oid") is not None else oid, cloid=o.get("cloid") or cloid,
                           state=state, orig_size=float(o.get("origSz", 0) or 0),
                           remaining_size=float(o.get("sz", 0) or 0), is_trigger=bool(o.get("isTrigger")), raw=resp)


def parse_account(state: dict, open_orders: list[dict], coin_filter: str | None = None) -> AccountState:
    ms = state.get("marginSummary", {})
    positions = []
    for ap in state.get("assetPositions", []):
        p = ap.get("position", {})
        if coin_filter and p.get("coin") != coin_filter:
            continue
        szi = float(p.get("szi", 0) or 0)
        if szi == 0:
            continue
        lev = p.get("leverage", {}) or {}
        positions.append(Position(
            coin=p["coin"], size=szi, entry_price=float(p.get("entryPx") or 0), unrealized_pnl=float(p.get("unrealizedPnl") or 0),
            leverage=float(lev.get("value", 1) or 1), margin_mode=lev.get("type", "cross"),
            liquidation_price=float(p["liquidationPx"]) if p.get("liquidationPx") else None,
            margin_used=float(p.get("marginUsed") or 0), cum_funding=float((p.get("cumFunding") or {}).get("sinceOpen", 0) or 0),
        ))
    oo = []
    for o in open_orders:
        if coin_filter and o.get("coin") != coin_filter:
            continue
        oo.append(OpenOrder(oid=int(o["oid"]), cloid=o.get("cloid"), coin=o["coin"], is_buy=o.get("side") == "B",
                            size=float(o.get("sz", 0)), limit_price=float(o.get("limitPx", 0)),
                            reduce_only=bool(o.get("reduceOnly", False)), is_trigger=bool(o.get("isTrigger", False)),
                            trigger_price=float(o["triggerPx"]) if o.get("isTrigger") else None,
                            order_type=o.get("orderType", "")))
    equity = float(ms.get("accountValue", 0) or 0)
    upnl = sum(p.unrealized_pnl for p in positions)
    return AccountState(equity=equity, balance=equity - upnl, withdrawable=float(state.get("withdrawable", 0) or 0),
                        positions=positions, open_orders=oo)


class HyperliquidExchange(ExchangeClient):
    MIN_ACTION_SPACING_S = 0.005

    def __init__(self, mode: TradingMode, api_url: str, account_address: str, api_wallet_private_key: str,
                 coin: str = "BTC", info: HyperliquidInfoClient | None = None, sdk_exchange=None):
        if mode not in (TradingMode.TESTNET, TradingMode.LIVE):
            raise ExchangeError("HyperliquidExchange is only allowed in TESTNET or LIVE mode")
        self.mode = mode.value
        self.coin = coin
        self.account_address = account_address
        self.info = info or HyperliquidInfoClient(api_url)
        if sdk_exchange is None:
            import eth_account
            from hyperliquid.exchange import Exchange

            wallet = eth_account.Account.from_key(api_wallet_private_key)
            if wallet.address.lower() == account_address.lower():
                log.warning("API wallet address equals the main account: use a dedicated API wallet (agent)!")
            sdk_exchange = Exchange(wallet, api_url, account_address=account_address)
        self._ex = sdk_exchange
        self._lock = asyncio.Lock()
        self._last_action = 0.0

    async def _signed(self, fn, *args, **kwargs):
        async with self._lock:
            wait = self.MIN_ACTION_SPACING_S - (time.monotonic() - self._last_action)
            if wait > 0:
                await asyncio.sleep(wait)
            try:
                return await asyncio.to_thread(fn, *args, **kwargs)
            finally:
                self._last_action = time.monotonic()

    # ------------------------------------------------------------------ actions
    async def place_order(self, req: OrderRequest) -> OrderAck:
        from hyperliquid.utils.types import Cloid

        if req.trigger_price is not None:
            order_type = {"trigger": {"triggerPx": req.trigger_price, "isMarket": True, "tpsl": req.tpsl or "sl"}}
        else:
            order_type = {"limit": {"tif": req.tif}}
        try:
            resp = await self._signed(self._ex.order, req.coin, req.is_buy, req.size, req.limit_price, order_type,
                                      reduce_only=req.reduce_only, cloid=Cloid.from_str(req.cloid) if req.cloid else None)
        except Exception as exc:  # network / client errors: outcome unknown -> caller must query
            log.error("order submission error: %s", exc)
            return OrderAck(ok=False, state=OrderState.UNKNOWN, cloid=req.cloid, error=str(exc))
        ack = parse_order_response(resp, req.cloid)
        log.info("order ack", extra={"kind": req.kind.value, "state": ack.state.value, "oid": ack.oid, "error": ack.error})
        return ack

    async def cancel_order(self, oid: int | None = None, cloid: str | None = None) -> bool:
        from hyperliquid.utils.types import Cloid

        try:
            if oid is not None:
                resp = await self._signed(self._ex.cancel, self.coin, oid)
            elif cloid is not None:
                resp = await self._signed(self._ex.cancel_by_cloid, self.coin, Cloid.from_str(cloid))
            else:
                return False
        except Exception as exc:  # noqa: BLE001
            log.error("cancel error: %s", exc)
            return False
        try:
            st = resp["response"]["data"]["statuses"][0]
            return st == "success"
        except (KeyError, IndexError, TypeError):
            return False

    async def set_leverage(self, leverage: int, isolated: bool) -> bool:
        try:
            resp = await self._signed(self._ex.update_leverage, int(leverage), self.coin, not isolated)
        except Exception as exc:  # noqa: BLE001
            log.error("update_leverage error: %s", exc)
            return False
        return isinstance(resp, dict) and resp.get("status") == "ok"

    # ------------------------------------------------------------------ reads (main account address)
    async def get_account_state(self) -> AccountState:
        state = await self.info.clearinghouse_state(self.account_address)
        orders = await self.info.frontend_open_orders(self.account_address)
        return parse_account(state, orders, coin_filter=None)

    async def query_order(self, oid: int | None = None, cloid: str | None = None) -> OrderStatusInfo:
        key = oid if oid is not None else cloid
        resp = await self.info.order_status(self.account_address, key)
        return parse_order_status(resp, oid, cloid)

    async def get_fills(self, since_ms: int) -> list[Fill]:
        rows = await self.info.user_fills_by_time(self.account_address, since_ms)
        return [Fill(coin=r["coin"], price=float(r["px"]), size=float(r["sz"]), is_buy=r["side"] == "B",
                     time=int(r["time"]), fee=float(r.get("fee", 0)), oid=r.get("oid"),
                     closed_pnl=float(r.get("closedPnl", 0)), direction=r.get("dir", ""), crossed=bool(r.get("crossed", True)))
                for r in rows if r.get("coin") == self.coin]

    async def get_funding_paid(self, since_ms: int) -> float:
        rows = await self.info.user_funding(self.account_address, since_ms)
        # delta.usdc is the signed amount received (negative = paid)
        return -sum(float(r["delta"]["usdc"]) for r in rows
                    if r.get("delta", {}).get("type") == "funding" and r["delta"].get("coin") == self.coin)

    async def close(self) -> None:
        await self.info.close()
