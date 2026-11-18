"""Application settings loaded from environment / `.env`.

Mode separation rules (enforced here and in `config.live_guard`):
* PAPER is the default and never constructs a signing client.
* TESTNET talks to the Hyperliquid testnet only.
* LIVE requires explicit configuration *and* an interactive human
  confirmation at process start. Nothing at runtime can switch to LIVE.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from typing_extensions import Annotated

from core.models import StrategyName, TradingMode
from risk.limits import RiskLimits

PROJECT_ROOT = Path(__file__).resolve().parent.parent

MAINNET_API_URL = "https://api.hyperliquid.xyz"
TESTNET_API_URL = "https://api.hyperliquid-testnet.xyz"
MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws"
TESTNET_WS_URL = "wss://api.hyperliquid-testnet.xyz/ws"

LIVE_CONFIRMATION_PHRASE = "I ACCEPT REAL MONEY RISK ON HYPERLIQUID MAINNET"

SYMBOL = "BTC"  # the system is BTC-only by design


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"), env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # --- mode -------------------------------------------------------------
    trading_mode: TradingMode = TradingMode.PAPER
    paper_data_source: Literal["mainnet", "testnet"] = "mainnet"

    # --- Hyperliquid credentials (testnet/live only) ------------------------
    hl_account_address: str = ""
    hl_api_wallet_private_key: SecretStr = SecretStr("")

    # --- live gates ---------------------------------------------------------
    live_trading_confirmation: str = ""
    live_eligibility_acknowledged: bool = False

    # --- risk -----------------------------------------------------------------
    initial_capital_usd: float = 1000.0
    risk_per_trade_pct: float = 0.25
    max_daily_loss_pct: float = 1.0
    max_drawdown_pct: float = 8.0
    max_leverage: int = 1
    margin_mode: Literal["isolated", "cross"] = "isolated"
    max_consecutive_losses: int = 3
    cooldown_minutes_after_losses: int = 120
    emergency_position_policy: Literal["flatten", "protect"] = "flatten"

    # --- costs ----------------------------------------------------------------
    taker_fee_rate: float = 0.00045
    maker_fee_rate: float = 0.00015
    slippage_bps_market: float = 2.0
    slippage_bps_stop: float = 5.0

    # --- engine ---------------------------------------------------------------
    decision_interval_seconds: float = 15.0
    max_data_staleness_seconds: float = 90.0
    enabled_strategies: Annotated[list[StrategyName], NoDecode] = Field(
        default_factory=lambda: [
            StrategyName.SCALPING,
            StrategyName.INTRADAY,
            StrategyName.TREND_FOLLOWING,
            StrategyName.RANGE_TRADING,
        ]
    )
    min_setup_score: float = 60.0

    # --- storage ----------------------------------------------------------------
    database_url: str = "sqlite:///./data/trading.db"
    data_dir: Path = Path("./data")
    runtime_dir: Path = Path("./runtime")
    models_dir: Path = Path("./models")

    # --- dashboard --------------------------------------------------------------
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    dashboard_token: SecretStr = SecretStr("")

    # --- telegram -----------------------------------------------------------------
    telegram_bot_token: SecretStr = SecretStr("")
    telegram_allowed_user_ids: Annotated[list[int], NoDecode] = Field(default_factory=list)

    # --- logging ------------------------------------------------------------------
    log_level: str = "INFO"
    log_json: bool = True

    # ------------------------------------------------------------------------
    @field_validator("enabled_strategies", mode="before")
    @classmethod
    def _parse_strategies(cls, v):  # noqa: D401
        if isinstance(v, str):
            return [StrategyName(s.strip()) for s in v.split(",") if s.strip()]
        return v

    @field_validator("telegram_allowed_user_ids", mode="before")
    @classmethod
    def _parse_ids(cls, v):
        if isinstance(v, str):
            return [int(s.strip()) for s in v.split(",") if s.strip()]
        if isinstance(v, int):
            return [v]
        return v

    @field_validator("data_dir", "runtime_dir", "models_dir", mode="after")
    @classmethod
    def _absolute(cls, v: Path) -> Path:
        return v if v.is_absolute() else (PROJECT_ROOT / v).resolve()

    # ------------------------------------------------------------------------
    @property
    def risk_limits(self) -> RiskLimits:
        """Validated limits (raises RiskLimitError if a hard ceiling is violated)."""
        return RiskLimits(
            risk_per_trade_pct=self.risk_per_trade_pct,
            max_daily_loss_pct=self.max_daily_loss_pct,
            max_drawdown_pct=self.max_drawdown_pct,
            max_leverage=self.max_leverage,
            margin_mode=self.margin_mode,
            max_consecutive_losses=self.max_consecutive_losses,
            cooldown_minutes_after_losses=self.cooldown_minutes_after_losses,
        )

    @property
    def market_data_api_url(self) -> str:
        if self.trading_mode == TradingMode.TESTNET:
            return TESTNET_API_URL
        if self.trading_mode == TradingMode.LIVE:
            return MAINNET_API_URL
        return MAINNET_API_URL if self.paper_data_source == "mainnet" else TESTNET_API_URL

    @property
    def market_data_ws_url(self) -> str:
        return MAINNET_WS_URL if self.market_data_api_url == MAINNET_API_URL else TESTNET_WS_URL

    @property
    def execution_api_url(self) -> str | None:
        """URL used for SIGNED actions. None in paper mode (nothing is signed)."""
        if self.trading_mode == TradingMode.TESTNET:
            return TESTNET_API_URL
        if self.trading_mode == TradingMode.LIVE:
            return MAINNET_API_URL
        return None

    @property
    def sqlite_path(self) -> Path | None:
        if self.database_url.startswith("sqlite:///"):
            p = Path(self.database_url.removeprefix("sqlite:///"))
            return p if p.is_absolute() else (PROJECT_ROOT / p).resolve()
        return None

    def ensure_dirs(self) -> None:
        for d in (self.data_dir, self.runtime_dir, self.models_dir):
            d.mkdir(parents=True, exist_ok=True)

    def secret_values(self) -> list[str]:
        """Secret strings that must never appear in logs."""
        vals = [
            self.hl_api_wallet_private_key.get_secret_value(),
            self.dashboard_token.get_secret_value(),
            self.telegram_bot_token.get_secret_value(),
        ]
        return [v for v in vals if v and len(v) >= 8]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
