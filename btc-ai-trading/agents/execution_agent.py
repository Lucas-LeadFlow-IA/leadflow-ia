"""AGENT 7 — EXECUTION AGENT.

Turns an approved signal into exchange orders and keeps the position
protected. Golden rules implemented here:

1. Never assume execution: an API "ok" is an acknowledgement; the fill is
   confirmed by querying the order status AND the account position.
2. Pre-flight reconciliation: refuse to open if the exchange shows any
   position or open order (never a second position).
3. Partial fills: the remainder is cancelled and protection is sized on
   the REAL position size.
4. Every position gets a verified stop-loss. If the stop cannot be
   installed after retries, the position is closed immediately
   (reduce-only) and a critical error is raised (kill switch).
5. Stops only tighten; the new stop is installed and verified BEFORE the
   old one is cancelled (no unprotected window).
"""
from __future__ import annotations

import asyncio
import time
from collections import deque

from agents.base import BaseAgent
from core.models import (AccountState, AgentReport, Direction, EntryType, Fill, ManagedPosition, OrderKind,
                         OrderRequest, OrderState, Regime, StrategyName, TradeRecord, TradeSignal, now_ms)
from execution.base import ExchangeClient
from execution.rounding import new_cloid, round_price, round_size


class CriticalExecutionError(RuntimeError):
    """Raised when the system could not guarantee protection; triggers a HALT."""


class ExecutionAgent(BaseAgent):
    name = "execution_agent"
    role = "Passe et vérifie les ordres sur Hyperliquid; protège chaque position (SL vérifié)"

    def __init__(self, exchange: ExchangeClient, sz_decimals: int = 5, max_leverage: int = 1, isolated: bool = True,
                 market_slippage_cap: float = 0.001, stop_limit_slippage: float = 0.10, confirm_timeout_s: float = 10.0,
                 poll_interval_s: float = 0.5, limit_entry_timeout_s: float = 90.0, protection_retries: int = 3,
                 sleep=asyncio.sleep, clock=now_ms):
        super().__init__()
        self.ex = exchange
        self.coin = exchange.coin
        self.sz_decimals = sz_decimals
        self.max_leverage = max_leverage
        self.isolated = isolated
        self.market_slippage_cap = market_slippage_cap
        self.stop_limit_slippage = stop_limit_slippage
        self.confirm_timeout_s = confirm_timeout_s
        self.poll_interval_s = poll_interval_s
        self.limit_entry_timeout_s = limit_entry_timeout_s
        self.protection_retries = protection_retries
        self._sleep = sleep
        self._clock = clock
        self.position: ManagedPosition | None = None
        self.error_times: deque[int] = deque(maxlen=50)
        self.order_log: deque[dict] = deque(maxlen=200)

    # ------------------------------------------------------------------ helpers
    def errors_last_10min(self) -> int:
        cutoff = self._clock() - 600_000
        return sum(1 for t in self.error_times if t >= cutoff)

    def _err(self, msg: str) -> None:
        self.error_times.append(self._clock())
        self.errors.append({"ts": self._clock(), "error": msg, "context": "execution", "trace": ""})
        self.status = "error"
        self.log.error(msg)

    def _log_order(self, kind: str, req: OrderRequest | None, ack=None, note: str = "") -> None:
        self.order_log.append({
            "ts": self._clock(), "kind": kind, "side": None if req is None else ("buy" if req.is_buy else "sell"),
            "size": None if req is None else req.size, "px": None if req is None else req.limit_price,
            "trigger": None if req is None else req.trigger_price, "reduce_only": None if req is None else req.reduce_only,
            "cloid": None if req is None else req.cloid, "state": None if ack is None else ack.state.value,
            "oid": None if ack is None else ack.oid, "error": None if ack is None else ack.error, "note": note,
        })

    def _px(self, px: float, mode: str) -> float:
        return round_price(px, self.sz_decimals, mode)

    async def _wait_terminal(self, oid: int | None, cloid: str | None, timeout_s: float) -> OrderState:
        deadline = time.monotonic() + timeout_s
        state = OrderState.UNKNOWN
        while True:
            await self.ex.on_market_update()
            st = await self.ex.query_order(oid=oid, cloid=cloid)
            state = st.state
            if state in (OrderState.FILLED, OrderState.CANCELED, OrderState.REJECTED, OrderState.TRIGGERED):
                return state
            if time.monotonic() >= deadline:
                return state
            await self._sleep(self.poll_interval_s)

    async def _position_size(self) -> tuple[float, float, AccountState]:
        acct = await self.ex.get_account_state()
        p = acct.position(self.coin)
        return (p.size if p else 0.0), (p.entry_price if p else 0.0), acct

    # ------------------------------------------------------------------ open
    async def open_position(self, signal: TradeSignal) -> ManagedPosition | None:
        setup, verdict = signal.setup, signal.risk
        if setup is None or verdict is None or not verdict.approved or verdict.size <= 0:
            raise ValueError("open_position requires an approved signal")
        if self.position is not None:
            self._err("refused: a managed position already exists")
            return None
        # 1) pre-flight reconciliation with the exchange
        size0, _, acct = await self._position_size()
        if size0 != 0 or any(o.coin == self.coin for o in acct.open_orders):
            self._err("pre-flight failed: exchange is not flat (position or open orders present)")
            return None
        # 2) leverage / margin mode
        if not await self.ex.set_leverage(self.max_leverage, self.isolated):
            self._err("could not set leverage/margin mode — entry aborted")
            return None
        # 3) entry order
        is_buy = setup.direction == Direction.LONG
        size = round_size(verdict.size, self.sz_decimals)
        cloid = new_cloid()
        if setup.entry_type == EntryType.MARKET:
            cap = setup.entry_price * (1 + self.market_slippage_cap if is_buy else 1 - self.market_slippage_cap)
            req = OrderRequest(coin=self.coin, is_buy=is_buy, size=size, limit_price=self._px(cap, "down" if is_buy else "up"),
                               kind=OrderKind.ENTRY, tif="Ioc", cloid=cloid)
            timeout = self.confirm_timeout_s
        else:
            req = OrderRequest(coin=self.coin, is_buy=is_buy, size=size,
                               limit_price=self._px(setup.entry_price, "down" if is_buy else "up"),
                               kind=OrderKind.ENTRY, tif="Alo", cloid=cloid)
            timeout = self.limit_entry_timeout_s
        ack = await self.ex.place_order(req)
        self._log_order("entry", req, ack)
        if not ack.ok and ack.state == OrderState.REJECTED:
            self.log.info("entry rejected: %s", ack.error)
            self.record(AgentReport(agent=self.name, summary=f"entry rejected: {ack.error}", data={"ack": ack.model_dump(exclude={'raw'})}), "warning")
            return None
        # 4) confirm — never trust the ack alone
        state = await self._wait_terminal(ack.oid, cloid, timeout)
        if state not in (OrderState.FILLED, OrderState.CANCELED, OrderState.REJECTED):
            await self.ex.cancel_order(oid=ack.oid, cloid=cloid)  # stop the remainder (partial fill)
            await self._wait_terminal(ack.oid, cloid, self.confirm_timeout_s)
        pos_size, entry_px, _ = await self._position_size()
        if pos_size == 0:
            self.record(AgentReport(agent=self.name, summary="entry not filled", data={"state": state.value}), "ok")
            return None
        if (pos_size > 0) != is_buy:
            self._err("position direction mismatch after entry")
            await self.emergency_flatten("direction mismatch after entry")
            raise CriticalExecutionError("position direction mismatch after entry")
        filled = abs(pos_size)
        # 5) protection — stop-loss is mandatory
        stop_px = setup.stop_loss
        sl = await self._place_stop(is_buy, filled, stop_px)
        if sl is None:
            self._err("STOP-LOSS COULD NOT BE INSTALLED — emergency close")
            await self.emergency_flatten("stop-loss installation failed")
            raise CriticalExecutionError("stop-loss installation failed; position closed")
        tp = None
        if setup.take_profit is not None:
            tp = await self._place_tp(is_buy, filled, setup.take_profit, setup.tp_as_limit)
            if tp is None:
                self._err("take-profit could not be installed (position stays protected by the stop)")
        fills = await self.ex.get_fills(signal.timestamp - 60_000)
        entry_fee = sum(f.fee for f in fills if f.is_buy == is_buy)
        self.position = ManagedPosition(
            coin=self.coin, direction=setup.direction, size=filled, entry_price=entry_px or setup.entry_price,
            stop_loss=stop_px, initial_stop=stop_px, take_profit=setup.take_profit, strategy=setup.strategy,
            regime=signal.regime, opened_at=self._clock(), risk_usd=verdict.risk_usd, sl_oid=sl[0], sl_cloid=sl[1],
            tp_oid=tp[0] if tp else None, tp_cloid=tp[1] if tp else None, entry_fee=entry_fee, score=setup.score,
            confidence=signal.confidence.probability if signal.confidence else None,
            max_hold_minutes=setup.max_hold_minutes, reasons=setup.reasons,
        )
        partial = " (partial fill)" if filled + 1e-12 < size else ""
        self.record(AgentReport(agent=self.name, summary=f"opened {setup.direction.value} {filled} BTC @ {self.position.entry_price:,.1f}{partial}",
                                data={"position": self.position.model_dump()}))
        return self.position

    async def _place_stop(self, is_buy_entry: bool, size: float, stop_px: float) -> tuple[int | None, str] | None:
        close_buy = not is_buy_entry
        trig = self._px(stop_px, "down" if is_buy_entry else "up")
        # limit price = worst acceptable fill once triggered (market trigger slippage bound)
        lim = self._px(trig * (1 - self.stop_limit_slippage) if not close_buy else trig * (1 + self.stop_limit_slippage),
                       "down" if not close_buy else "up")
        for attempt in range(self.protection_retries):
            cloid = new_cloid()
            req = OrderRequest(coin=self.coin, is_buy=close_buy, size=size, limit_price=lim, kind=OrderKind.STOP_LOSS,
                               reduce_only=True, trigger_price=trig, tpsl="sl", cloid=cloid)
            ack = await self.ex.place_order(req)
            self._log_order("stop_loss", req, ack, note=f"attempt {attempt + 1}")
            # verification: the order must be visible as resting (armed) on the exchange
            st = await self.ex.query_order(oid=ack.oid, cloid=cloid)
            verified = st.state == OrderState.RESTING or (
                st.state == OrderState.UNKNOWN and await self._order_visible(ack.oid, cloid))
            if verified or st.state == OrderState.TRIGGERED:  # triggered = already closing the position
                return ack.oid or st.oid, cloid
            await self._sleep(self.poll_interval_s * (attempt + 1))
        return None

    async def _order_visible(self, oid: int | None, cloid: str) -> bool:
        acct = await self.ex.get_account_state()
        return any((oid is not None and o.oid == oid) or o.cloid == cloid for o in acct.open_orders)

    async def _place_tp(self, is_buy_entry: bool, size: float, tp_px: float, as_limit: bool) -> tuple[int | None, str] | None:
        close_buy = not is_buy_entry
        px = self._px(tp_px, "up" if is_buy_entry else "down")
        for attempt in range(self.protection_retries):
            cloid = new_cloid()
            if as_limit:
                req = OrderRequest(coin=self.coin, is_buy=close_buy, size=size, limit_price=px, kind=OrderKind.TAKE_PROFIT,
                                   reduce_only=True, tif="Gtc", cloid=cloid)
            else:
                lim = self._px(px * (1 + self.stop_limit_slippage) if close_buy else px * (1 - self.stop_limit_slippage),
                               "up" if close_buy else "down")
                req = OrderRequest(coin=self.coin, is_buy=close_buy, size=size, limit_price=lim, kind=OrderKind.TAKE_PROFIT,
                                   reduce_only=True, trigger_price=px, tpsl="tp", cloid=cloid)
            ack = await self.ex.place_order(req)
            self._log_order("take_profit", req, ack, note=f"attempt {attempt + 1}")
            st = await self.ex.query_order(oid=ack.oid, cloid=cloid)
            if st.state in (OrderState.RESTING, OrderState.FILLED, OrderState.TRIGGERED):
                return ack.oid or st.oid, cloid
            await self._sleep(self.poll_interval_s)
        return None

    # ------------------------------------------------------------------ manage
    async def update_stop(self, new_stop: float, reason: str = "") -> bool:
        pos = self.position
        if pos is None:
            return False
        sign = pos.direction.sign
        if not ((new_stop > pos.stop_loss) if sign > 0 else (new_stop < pos.stop_loss)):
            self.log.warning("refused to loosen stop %s -> %s", pos.stop_loss, new_stop)
            return False
        size, _, _ = await self._position_size()
        if size == 0:
            return False
        new = await self._place_stop(pos.direction == Direction.LONG, abs(size), new_stop)
        if new is None:
            self._err("could not place tightened stop — keeping previous stop")
            return False
        await self.ex.cancel_order(oid=pos.sl_oid, cloid=pos.sl_cloid)
        pos.sl_oid, pos.sl_cloid, pos.stop_loss = new[0], new[1], new_stop
        self.record(AgentReport(agent=self.name, summary=f"stop moved to {new_stop:,.1f} ({reason})",
                                data={"position": pos.model_dump()}))
        return True

    async def close_position(self, reason: str) -> bool:
        """Close with a reduce-only IOC (widening the price cap on retries), then verify flat."""
        size, _, _ = await self._position_size()
        if size == 0:
            await self._cancel_protection()
            return True
        for cap in (0.002, 0.005, 0.02):
            await self.ex.on_market_update()
            size, _, _ = await self._position_size()
            if size == 0:
                break
            close_buy = size < 0
            ref = await self._reference_price()
            if ref is None:
                break
            lim = self._px(ref * (1 + cap) if close_buy else ref * (1 - cap), "up" if close_buy else "down")
            cloid = new_cloid()
            req = OrderRequest(coin=self.coin, is_buy=close_buy, size=round_size(abs(size), self.sz_decimals),
                               limit_price=lim, kind=OrderKind.EXIT, reduce_only=True, tif="Ioc", cloid=cloid)
            ack = await self.ex.place_order(req)
            self._log_order("exit", req, ack, note=reason)
            await self._wait_terminal(ack.oid, cloid, self.confirm_timeout_s)
        size, _, _ = await self._position_size()
        if size != 0:
            self._err(f"position still open after close attempts ({size})")
            return False
        await self._cancel_protection()
        return True

    async def _reference_price(self) -> float | None:
        store = getattr(self.ex, "store", None)
        if store is not None and store.mid:
            return float(store.mid)
        if self.position is not None:
            return self.position.entry_price
        return None

    async def _cancel_protection(self) -> None:
        acct = await self.ex.get_account_state()
        for o in acct.open_orders:
            if o.coin == self.coin:
                await self.ex.cancel_order(oid=o.oid)

    async def emergency_flatten(self, reason: str) -> bool:
        """Cancel every order on the coin, then close any position (reduce-only)."""
        self.log.critical("EMERGENCY FLATTEN: %s", reason)
        await self._cancel_protection()
        ok = await self.close_position(f"emergency: {reason}")
        self.record(AgentReport(agent=self.name, summary=f"emergency flatten ({'ok' if ok else 'FAILED'}): {reason}"),
                    "warning" if ok else "error")
        return ok

    async def cancel_entries_keep_protection(self) -> None:
        """Kill-switch 'protect' policy: cancel non-reduce-only orders only."""
        acct = await self.ex.get_account_state()
        for o in acct.open_orders:
            if o.coin == self.coin and not o.reduce_only:
                await self.ex.cancel_order(oid=o.oid)

    # ------------------------------------------------------------------ closure accounting
    async def build_trade_record(self, pos: ManagedPosition, exit_reason: str, mode: str) -> TradeRecord:
        fills: list[Fill] = await self.ex.get_fills(pos.opened_at - 120_000)
        is_long = pos.direction == Direction.LONG
        entries = [f for f in fills if f.is_buy == is_long and f.time >= pos.opened_at - 120_000 and "Close" not in f.direction]
        exits = [f for f in fills if f.is_buy != is_long and f.time >= pos.opened_at - 120_000]
        def vwap(fs):
            q = sum(f.size for f in fs)
            return (sum(f.price * f.size for f in fs) / q) if q > 0 else None
        entry_px = vwap(entries) or pos.entry_price
        exit_px = vwap(exits) or entry_px
        size = sum(f.size for f in exits) or pos.size
        fees = sum(f.fee for f in entries) + sum(f.fee for f in exits)
        funding = await self.ex.get_funding_paid(pos.opened_at)
        gross = (exit_px - entry_px) * size * (1 if is_long else -1)
        net = gross - fees - funding
        r = net / pos.risk_usd if pos.risk_usd > 0 else 0.0
        return TradeRecord(mode=mode, strategy=pos.strategy, regime=pos.regime, direction=pos.direction,
                           entry_time=pos.opened_at, exit_time=self._clock(), entry_price=entry_px, exit_price=exit_px,
                           size=size, initial_stop=pos.initial_stop, take_profit=pos.take_profit, risk_usd=pos.risk_usd,
                           gross_pnl=gross, fees=fees, funding=funding, net_pnl=net, exit_reason=exit_reason,
                           score=pos.score, confidence=pos.confidence, r_multiple=r, reasons=pos.reasons)

    def state(self) -> dict:
        d = super().state()
        d["position"] = self.position.model_dump() if self.position else None
        d["orders"] = list(self.order_log)[-30:]
        d["errors_10min"] = self.errors_last_10min()
        return d


__all__ = ["ExecutionAgent", "CriticalExecutionError", "Regime", "StrategyName"]
