"""PAPER exchange: simulated execution against REAL market data.

Nothing is signed and nothing is sent to Hyperliquid. Fill model:
* IOC (market-like) orders walk the live L2 book up to the limit price
  (partial fills when depth is insufficient), taker fee.
* ALO (post-only) orders are rejected if they would cross; resting limit
  orders fill (maker fee) once a public trade prints through the price
  or the opposite best price reaches it.
* Trigger orders (TP/SL) fire on the mark price and execute as market
  orders against the book with extra stop slippage, taker fee.
* Funding is settled every hour: size * oracle_px * funding_rate.
* Same validation rules as the venue: $10 minimum (non reduce-only),
  reduce-only can't increase a position, lot/tick rounding.
State is persisted to JSON so restarts keep the paper account.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from backtesting.costs import CostModel
from core.models import (AccountState, Fill, OpenOrder, OrderAck, OrderRequest, OrderState, OrderStatusInfo,
                         Position)
from execution.base import ExchangeClient
from execution.rounding import round_size
from risk.sizing import MIN_ORDER_NOTIONAL_USD


def _now() -> int:
    return int(time.time() * 1000)


@dataclass
class PaperOrder:
    oid: int
    cloid: str | None
    is_buy: bool
    size: float          # remaining
    orig_size: float
    limit_px: float
    reduce_only: bool
    tif: str
    trigger_px: float | None
    tpsl: str | None
    created_ms: int
    state: str = OrderState.RESTING.value
    filled: float = 0.0
    avg_px: float | None = None


class PaperExchange(ExchangeClient):
    mode = "paper"

    def __init__(self, store, initial_equity: float, costs: CostModel, state_path: Path | None = None,
                 sz_decimals: int = 5, coin: str = "BTC"):
        self.store = store
        self.costs = costs
        self.coin = coin
        self.sz_decimals = sz_decimals
        self.state_path = Path(state_path) if state_path else None
        self.balance = float(initial_equity)
        self.pos_size = 0.0
        self.pos_entry = 0.0
        self.orders: dict[int, PaperOrder] = {}
        self.history: dict[int, PaperOrder] = {}
        self.fills: list[dict] = []
        self.funding_events: list[dict] = []
        self.next_oid = 1
        self.last_funding_hour = _now() // 3_600_000
        self.leverage = 1
        self.isolated = True
        self._last_trade_check = _now()
        self._load()

    # ------------------------------------------------------------------ persistence
    def _load(self) -> None:
        if self.state_path and self.state_path.exists():
            d = json.loads(self.state_path.read_text(encoding="utf-8"))
            self.balance = d["balance"]
            self.pos_size, self.pos_entry = d["pos_size"], d["pos_entry"]
            self.orders = {int(k): PaperOrder(**v) for k, v in d.get("orders", {}).items()}
            self.fills = d.get("fills", [])
            self.funding_events = d.get("funding_events", [])
            self.next_oid = d.get("next_oid", 1)
            self.last_funding_hour = d.get("last_funding_hour", self.last_funding_hour)

    def _save(self) -> None:
        if not self.state_path:
            return
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        d = {"balance": self.balance, "pos_size": self.pos_size, "pos_entry": self.pos_entry,
             "orders": {str(k): asdict(v) for k, v in self.orders.items()}, "fills": self.fills[-1000:],
             "funding_events": self.funding_events[-2000:], "next_oid": self.next_oid,
             "last_funding_hour": self.last_funding_hour}
        fd, tmp = tempfile.mkstemp(dir=self.state_path.parent, prefix=".paper")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(d, fh)
        os.replace(tmp, self.state_path)

    # ------------------------------------------------------------------ market access
    def _mark(self) -> float | None:
        return self.store.mark or self.store.mid

    def _book_side(self, is_buy: bool) -> list[tuple[float, float]]:
        return list(self.store.asks if is_buy else self.store.bids)

    # ------------------------------------------------------------------ fills & accounting
    def _apply_fill(self, order: PaperOrder, px: float, sz: float, taker: bool) -> None:
        signed = sz if order.is_buy else -sz
        fee = px * sz * (self.costs.taker_fee if taker else self.costs.maker_fee)
        closed_pnl = 0.0
        if self.pos_size == 0 or (self.pos_size > 0) == (signed > 0):
            new = self.pos_size + signed
            self.pos_entry = (self.pos_entry * abs(self.pos_size) + px * sz) / abs(new)
            self.pos_size = new
            direction = "Open Long" if signed > 0 else "Open Short"
        else:
            closing = min(abs(signed), abs(self.pos_size))
            sign = 1 if self.pos_size > 0 else -1
            closed_pnl = (px - self.pos_entry) * closing * sign
            self.balance += closed_pnl
            rest = abs(signed) - closing
            self.pos_size += signed if rest == 0 else -sign * closing
            direction = "Close Long" if sign > 0 else "Close Short"
            if abs(self.pos_size) < 1e-12:
                self.pos_size, self.pos_entry = 0.0, 0.0
            if rest > 0:  # flip (only possible without reduce-only)
                self.pos_size = -sign * rest
                self.pos_entry = px
        self.balance -= fee
        order.avg_px = px if order.avg_px is None else (order.avg_px * order.filled + px * sz) / (order.filled + sz)
        order.filled += sz
        order.size = max(0.0, order.size - sz)
        self.fills.append({"coin": self.coin, "price": px, "size": sz, "is_buy": order.is_buy, "time": _now(),
                           "fee": fee, "oid": order.oid, "closed_pnl": closed_pnl, "direction": direction,
                           "crossed": taker})

    def _walk_book(self, order: PaperOrder, limit_px: float | None, extra_slip_bps: float = 0.0) -> float:
        """Fill `order` against the book up to limit_px. Returns filled size."""
        levels = self._book_side(order.is_buy)
        filled = 0.0
        if not levels:
            mid = self.store.mid
            if mid is None:
                return 0.0
            px = mid * (1 + (self.costs.slippage_bps_market + extra_slip_bps) / 1e4 * (1 if order.is_buy else -1))
            if limit_px is not None and ((order.is_buy and px > limit_px) or (not order.is_buy and px < limit_px)):
                return 0.0
            self._apply_fill(order, px, order.size, taker=True)
            return order.filled
        for px, sz in levels:
            if limit_px is not None and ((order.is_buy and px > limit_px) or (not order.is_buy and px < limit_px)):
                break
            take = min(order.size, sz)
            if take <= 0:
                break
            fill_px = px * (1 + extra_slip_bps / 1e4 * (1 if order.is_buy else -1))
            self._apply_fill(order, fill_px, take, taker=True)
            filled += take
            if order.size <= 1e-12:
                break
        return filled

    def _reduce_only_size(self, is_buy: bool, size: float) -> float:
        if self.pos_size == 0 or (self.pos_size > 0) == is_buy:
            return 0.0
        return min(size, abs(self.pos_size))

    # ------------------------------------------------------------------ ExchangeClient
    async def place_order(self, req: OrderRequest) -> OrderAck:
        size = round_size(req.size, self.sz_decimals)
        if size <= 0:
            return OrderAck(ok=False, state=OrderState.REJECTED, cloid=req.cloid, error="size rounds to zero")
        if req.cloid and any(o.cloid == req.cloid for o in list(self.orders.values()) + list(self.history.values())):
            return OrderAck(ok=False, state=OrderState.REJECTED, cloid=req.cloid, error="duplicate cloid")
        if req.reduce_only:
            size = self._reduce_only_size(req.is_buy, size)
            if size <= 0 and req.trigger_price is None:
                return OrderAck(ok=False, state=OrderState.REJECTED, cloid=req.cloid,
                                error="Reduce only order would increase position.")
        elif size * req.limit_price < MIN_ORDER_NOTIONAL_USD:
            return OrderAck(ok=False, state=OrderState.REJECTED, cloid=req.cloid,
                            error="Order must have minimum value of $10.")
        oid = self.next_oid
        self.next_oid += 1
        o = PaperOrder(oid, req.cloid, req.is_buy, size if size > 0 else req.size, size if size > 0 else req.size,
                       req.limit_price, req.reduce_only, req.tif, req.trigger_price, req.tpsl, _now())
        if req.trigger_price is not None:
            self.orders[oid] = o
            self._save()
            return OrderAck(ok=True, state=OrderState.RESTING, oid=oid, cloid=req.cloid)
        if req.tif == "Alo":
            book = self._book_side(req.is_buy)
            if book and ((req.is_buy and req.limit_price >= book[0][0]) or (not req.is_buy and req.limit_price <= book[0][0])):
                return OrderAck(ok=False, state=OrderState.REJECTED, cloid=req.cloid,
                                error="Post only order would have immediately matched")
            self.orders[oid] = o
            self._save()
            return OrderAck(ok=True, state=OrderState.RESTING, oid=oid, cloid=req.cloid)
        filled = self._walk_book(o, req.limit_price)
        if req.tif == "Ioc" or o.size <= 1e-12:
            o.state = (OrderState.FILLED if o.size <= 1e-12 else
                       OrderState.CANCELED if filled > 0 else OrderState.REJECTED).value
            self.history[oid] = o
            self._save()
            if filled <= 0:
                return OrderAck(ok=False, state=OrderState.REJECTED, oid=oid, cloid=req.cloid,
                                error="Order could not immediately match against any resting orders.")
            return OrderAck(ok=True, state=OrderState.FILLED, oid=oid, cloid=req.cloid, filled_size=o.filled, avg_price=o.avg_px)
        self.orders[oid] = o  # GTC remainder rests
        self._save()
        return OrderAck(ok=True, state=OrderState.RESTING if filled == 0 else OrderState.PARTIAL, oid=oid,
                        cloid=req.cloid, filled_size=o.filled, avg_price=o.avg_px)

    def _find(self, oid: int | None, cloid: str | None) -> PaperOrder | None:
        for pool in (self.orders, self.history):
            for o in pool.values():
                if (oid is not None and o.oid == oid) or (cloid is not None and o.cloid == cloid):
                    return o
        return None

    async def cancel_order(self, oid: int | None = None, cloid: str | None = None) -> bool:
        o = self._find(oid, cloid)
        if o is None or o.oid not in self.orders:
            return False
        o.state = OrderState.CANCELED.value
        self.history[o.oid] = self.orders.pop(o.oid)
        self._save()
        return True

    async def query_order(self, oid: int | None = None, cloid: str | None = None) -> OrderStatusInfo:
        o = self._find(oid, cloid)
        if o is None:
            return OrderStatusInfo(oid=oid, cloid=cloid, state=OrderState.UNKNOWN)
        return OrderStatusInfo(oid=o.oid, cloid=o.cloid, state=OrderState(o.state), orig_size=o.orig_size,
                               remaining_size=o.size, is_trigger=o.trigger_px is not None)

    async def get_account_state(self) -> AccountState:
        mark = self._mark()
        upnl = (mark - self.pos_entry) * self.pos_size if (mark and self.pos_size) else 0.0
        positions = []
        if self.pos_size:
            positions.append(Position(coin=self.coin, size=self.pos_size, entry_price=self.pos_entry,
                                      unrealized_pnl=upnl, leverage=self.leverage,
                                      margin_mode="isolated" if self.isolated else "cross",
                                      margin_used=abs(self.pos_size) * self.pos_entry / max(self.leverage, 1)))
        oo = [OpenOrder(oid=o.oid, cloid=o.cloid, coin=self.coin, is_buy=o.is_buy, size=o.size, limit_price=o.limit_px,
                        reduce_only=o.reduce_only, is_trigger=o.trigger_px is not None, trigger_price=o.trigger_px,
                        order_type=("Stop Market" if o.tpsl == "sl" else "Take Profit Market" if o.tpsl == "tp" else "Limit"))
              for o in self.orders.values()]
        return AccountState(equity=self.balance + upnl, balance=self.balance, withdrawable=self.balance,
                            positions=positions, open_orders=oo)

    async def get_fills(self, since_ms: int) -> list[Fill]:
        return [Fill(coin=f["coin"], price=f["price"], size=f["size"], is_buy=f["is_buy"], time=f["time"], fee=f["fee"],
                     oid=f["oid"], closed_pnl=f["closed_pnl"], direction=f["direction"], crossed=f["crossed"])
                for f in self.fills if f["time"] >= since_ms]

    async def get_funding_paid(self, since_ms: int) -> float:
        return sum(e["paid"] for e in self.funding_events if e["time"] >= since_ms)

    async def set_leverage(self, leverage: int, isolated: bool) -> bool:
        self.leverage, self.isolated = leverage, isolated
        return True

    # ------------------------------------------------------------------ simulation tick
    async def on_market_update(self) -> None:
        now = _now()
        mark = self._mark()
        changed = False
        # funding settlement at each hour boundary
        hour = now // 3_600_000
        if hour > self.last_funding_hour:
            if self.pos_size and mark:
                oracle = self.store.asset_ctx.get("oraclePx") or mark
                paid = self.pos_size * float(oracle) * self.store.funding_rate
                self.balance -= paid
                self.funding_events.append({"time": now, "paid": paid, "rate": self.store.funding_rate})
            self.last_funding_hour = hour
            changed = True
        if mark is None:
            return
        recent = [t for t in self.store.trades if t["time"] > self._last_trade_check]
        self._last_trade_check = now
        best_bid = self.store.bids[0][0] if self.store.bids else None
        best_ask = self.store.asks[0][0] if self.store.asks else None
        for o in list(self.orders.values()):
            if o.trigger_px is not None:
                fire = ((o.tpsl == "sl" and ((not o.is_buy and mark <= o.trigger_px) or (o.is_buy and mark >= o.trigger_px)))
                        or (o.tpsl == "tp" and ((not o.is_buy and mark >= o.trigger_px) or (o.is_buy and mark <= o.trigger_px))))
                if not fire:
                    continue
                if o.reduce_only:
                    o.size = self._reduce_only_size(o.is_buy, o.size)
                if o.size > 0:
                    slip = self.costs.slippage_bps_stop if o.tpsl == "sl" else 0.0
                    self._walk_book(o, None, extra_slip_bps=slip)
                o.state = OrderState.TRIGGERED.value if o.filled > 0 else OrderState.CANCELED.value
                self.history[o.oid] = self.orders.pop(o.oid)
                changed = True
            else:
                crossed = any((t["px"] < o.limit_px) if o.is_buy else (t["px"] > o.limit_px) for t in recent)
                crossed = crossed or (o.is_buy and best_ask is not None and best_ask <= o.limit_px) or \
                    (not o.is_buy and best_bid is not None and best_bid >= o.limit_px)
                if not crossed:
                    continue
                if o.reduce_only:
                    o.size = self._reduce_only_size(o.is_buy, o.size)
                if o.size > 0:
                    self._apply_fill(o, o.limit_px, o.size, taker=False)
                o.state = OrderState.FILLED.value if o.filled > 0 else OrderState.CANCELED.value
                self.history[o.oid] = self.orders.pop(o.oid)
                changed = True
        # reduce-only orders left without a position are cancelled (venue behaviour)
        if self.pos_size == 0:
            for o in list(self.orders.values()):
                if o.reduce_only:
                    o.state = OrderState.CANCELED.value
                    self.history[o.oid] = self.orders.pop(o.oid)
                    changed = True
        if changed:
            self._save()
