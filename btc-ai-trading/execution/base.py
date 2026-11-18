"""Exchange client interface shared by PaperExchange and HyperliquidExchange.

The interface deliberately exposes ONLY trading actions (orders, cancels,
leverage) and read-only queries. There is no transfer / withdrawal method,
so no code path in this project can move funds.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from core.models import AccountState, Fill, OrderAck, OrderRequest, OrderStatusInfo


class ExchangeError(RuntimeError):
    pass


class ExchangeClient(ABC):
    mode: str = "abstract"
    coin: str = "BTC"

    @abstractmethod
    async def get_account_state(self) -> AccountState: ...

    @abstractmethod
    async def place_order(self, req: OrderRequest) -> OrderAck: ...

    @abstractmethod
    async def cancel_order(self, oid: int | None = None, cloid: str | None = None) -> bool: ...

    @abstractmethod
    async def query_order(self, oid: int | None = None, cloid: str | None = None) -> OrderStatusInfo: ...

    @abstractmethod
    async def get_fills(self, since_ms: int) -> list[Fill]: ...

    @abstractmethod
    async def get_funding_paid(self, since_ms: int) -> float:
        """Funding paid by the account for `coin` since `since_ms` (positive = cost)."""

    @abstractmethod
    async def set_leverage(self, leverage: int, isolated: bool) -> bool: ...

    async def on_market_update(self) -> None:
        """Hook for simulated exchanges (process triggers / resting orders)."""
        return None

    async def close(self) -> None:
        return None
