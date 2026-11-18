"""Database access layer (synchronous SQLAlchemy, small and explicit)."""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from core.models import Direction, Regime, StrategyName, TradeRecord, TradeSignal
from database.models import Base, DecisionRow, EquityRow, EventRow, OrderRow, TradeRow

log = logging.getLogger(__name__)


class Database:
    def __init__(self, url: str):
        if url.startswith("sqlite:///"):
            p = Path(url.removeprefix("sqlite:///"))
            p.parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(url, pool_pre_ping=True, future=True)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(self.engine, expire_on_commit=False)

    def _add(self, row) -> None:
        try:
            with self.Session() as s:
                s.add(row)
                s.commit()
        except Exception:  # noqa: BLE001 - persistence must never crash trading
            log.exception("database write failed")

    # ------------------------------------------------------------------ writes
    def add_trade(self, t: TradeRecord) -> None:
        self._add(TradeRow(mode=t.mode, strategy=t.strategy.value, regime=t.regime.value, direction=t.direction.value,
                           entry_time=t.entry_time, exit_time=t.exit_time, entry_price=t.entry_price,
                           exit_price=t.exit_price, size=t.size, initial_stop=t.initial_stop, take_profit=t.take_profit,
                           risk_usd=t.risk_usd, gross_pnl=t.gross_pnl, fees=t.fees, funding=t.funding,
                           slippage_cost=t.slippage_cost, net_pnl=t.net_pnl, r_multiple=t.r_multiple,
                           exit_reason=t.exit_reason[:128], score=t.score, confidence=t.confidence, reasons=t.reasons))

    def add_decision(self, mode: str, sig: TradeSignal) -> None:
        self._add(DecisionRow(ts=sig.timestamp, mode=mode, direction=sig.direction.value, strategy=sig.strategy.value,
                              regime=sig.regime.value, approved=bool(sig.risk and sig.risk.approved),
                              score=sig.confidence.raw_score if sig.confidence else None, entry_price=sig.entry_price,
                              stop_loss=sig.stop_loss, take_profit=sig.take_profit, size=sig.size, risk_usd=sig.risk_usd,
                              payload=sig.model_dump(mode="json", exclude={"setup": {"features"}})))

    def add_equity(self, ts: int, mode: str, equity: float, balance: float, unrealized: float, dd: float, daily: float) -> None:
        self._add(EquityRow(ts=ts, mode=mode, equity=equity, balance=balance, unrealized=unrealized,
                            drawdown_pct=dd, daily_pnl=daily))

    def add_event(self, ts: int, mode: str, level: str, source: str, kind: str, message: str, payload: dict | None = None) -> None:
        self._add(EventRow(ts=ts, mode=mode, level=level, source=source, kind=kind, message=message[:4000],
                           payload=payload or {}))

    def add_order(self, mode: str, o: dict) -> None:
        self._add(OrderRow(ts=o["ts"], mode=mode, kind=o["kind"], side=o.get("side"), size=o.get("size"),
                           price=o.get("px"), trigger=o.get("trigger"), reduce_only=o.get("reduce_only"),
                           cloid=o.get("cloid"), oid=o.get("oid"), state=o.get("state"), error=o.get("error"),
                           note=o.get("note")))

    # ------------------------------------------------------------------ reads
    def trades(self, mode: str | None = None, limit: int = 500) -> list[TradeRecord]:
        with self.Session() as s:
            q = select(TradeRow).order_by(TradeRow.exit_time.desc()).limit(limit)
            if mode:
                q = q.where(TradeRow.mode == mode)
            rows = s.scalars(q).all()
        return [TradeRecord(mode=r.mode, strategy=StrategyName(r.strategy), regime=Regime(r.regime),
                            direction=Direction(r.direction), entry_time=r.entry_time, exit_time=r.exit_time,
                            entry_price=r.entry_price, exit_price=r.exit_price, size=r.size, initial_stop=r.initial_stop,
                            take_profit=r.take_profit, risk_usd=r.risk_usd, gross_pnl=r.gross_pnl, fees=r.fees,
                            funding=r.funding, slippage_cost=r.slippage_cost, net_pnl=r.net_pnl,
                            exit_reason=r.exit_reason, score=r.score, confidence=r.confidence, r_multiple=r.r_multiple,
                            reasons=r.reasons or []) for r in rows][::-1]

    def equity_curve(self, mode: str, since_ms: int = 0, max_points: int = 2000) -> list[dict]:
        with self.Session() as s:
            rows = s.scalars(select(EquityRow).where(EquityRow.mode == mode, EquityRow.ts >= since_ms)
                             .order_by(EquityRow.ts)).all()
        step = max(1, len(rows) // max_points)
        return [{"ts": r.ts, "equity": r.equity, "drawdown_pct": r.drawdown_pct} for r in rows[::step]]

    def decisions(self, mode: str, limit: int = 100) -> list[dict]:
        with self.Session() as s:
            rows = s.scalars(select(DecisionRow).where(DecisionRow.mode == mode).order_by(DecisionRow.ts.desc()).limit(limit)).all()
        return [{"ts": r.ts, "direction": r.direction, "strategy": r.strategy, "regime": r.regime, "approved": r.approved,
                 "score": r.score, "entry": r.entry_price, "stop": r.stop_loss, "tp": r.take_profit, "size": r.size,
                 "risk_usd": r.risk_usd, "reasons": (r.payload or {}).get("reasons", [])[:6],
                 "rationale": (r.payload or {}).get("strategy_rationale", "")} for r in rows]

    def events(self, mode: str | None = None, limit: int = 100, level: str | None = None) -> list[dict]:
        with self.Session() as s:
            q = select(EventRow).order_by(EventRow.ts.desc()).limit(limit)
            if mode:
                q = q.where(EventRow.mode == mode)
            if level:
                q = q.where(EventRow.level == level)
            rows = s.scalars(q).all()
        return [{"ts": r.ts, "level": r.level, "source": r.source, "kind": r.kind, "message": r.message} for r in rows]

    def count_events(self, mode: str, kind_prefix: str, since_ms: int) -> int:
        with self.Session() as s:
            return int(s.scalar(select(func.count(EventRow.id)).where(
                EventRow.mode == mode, EventRow.kind.like(f"{kind_prefix}%"), EventRow.ts >= since_ms)) or 0)

    def orders(self, mode: str, limit: int = 100) -> list[dict]:
        with self.Session() as s:
            rows = s.scalars(select(OrderRow).where(OrderRow.mode == mode).order_by(OrderRow.ts.desc()).limit(limit)).all()
        return [{"ts": r.ts, "kind": r.kind, "side": r.side, "size": r.size, "price": r.price, "trigger": r.trigger,
                 "reduce_only": r.reduce_only, "oid": r.oid, "state": r.state, "error": r.error, "note": r.note} for r in rows]

    def session(self) -> Session:
        return self.Session()
