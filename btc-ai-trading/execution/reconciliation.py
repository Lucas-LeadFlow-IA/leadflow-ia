"""Reconciliation between the local managed position and the exchange.

The exchange is the source of truth. Outcomes:
* `closed`      — we tracked a position, the exchange is flat (SL/TP hit,
                  liquidation or manual close): finalise the trade.
* `adopt_size`  — same direction, different size (e.g. late partial fill):
                  adopt the exchange size and resize protection.
* `missing_sl`  — position without a verified stop on the exchange:
                  re-install it immediately.
* `stray_orders`— non reduce-only orders while we are flat / in position:
                  cancel them (incoherent orders).
* `desync`      — unmanaged position or direction mismatch: HALT and
                  protect (human review required).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from core.models import AccountState, Direction, ManagedPosition


@dataclass
class ReconcileResult:
    actions: list[str] = field(default_factory=list)
    desync: bool = False
    detail: str = ""
    exchange_size: float = 0.0
    stray_order_ids: list[int] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.actions and not self.desync


def reconcile(local: ManagedPosition | None, acct: AccountState, coin: str = "BTC", lot: float = 1e-5) -> ReconcileResult:
    res = ReconcileResult()
    p = acct.position(coin)
    ex_size = p.size if p else 0.0
    res.exchange_size = ex_size
    orders = [o for o in acct.open_orders if o.coin == coin]

    if local is None:
        if ex_size != 0:
            res.desync = True
            res.detail = f"unmanaged {coin} position on exchange (size {ex_size})"
            res.actions.append("protect_unmanaged")
        stray = [o.oid for o in orders if not o.reduce_only]
        if stray:
            res.actions.append("stray_orders")
            res.stray_order_ids = stray
        leftover = [o.oid for o in orders if o.reduce_only]
        if leftover and ex_size == 0:
            res.actions.append("stray_orders")
            res.stray_order_ids += leftover
        return res

    if ex_size == 0:
        res.actions.append("closed")
        return res
    ex_dir = Direction.LONG if ex_size > 0 else Direction.SHORT
    if ex_dir != local.direction:
        res.desync = True
        res.detail = f"direction mismatch: local {local.direction.value}, exchange {ex_dir.value}"
        return res
    if abs(abs(ex_size) - local.size) > lot / 2:
        res.actions.append("adopt_size")
    close_side_buy = local.direction == Direction.SHORT
    # A stop is a reduce-only trigger on the closing side, identified by its id or its
    # order type ("Stop Market" in frontendOpenOrders) — TP triggers are not stops.
    sl_like = [o for o in orders
               if o.is_trigger and o.reduce_only and o.is_buy == close_side_buy and o.trigger_price is not None
               and ("Stop" in o.order_type or o.oid == local.sl_oid or (local.sl_cloid and o.cloid == local.sl_cloid))]
    if not sl_like:
        res.actions.append("missing_sl")
    stray = [o.oid for o in orders if not o.reduce_only]
    if stray:
        res.actions.append("stray_orders")
        res.stray_order_ids = stray
    return res
