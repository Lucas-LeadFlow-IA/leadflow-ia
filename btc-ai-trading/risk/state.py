"""Persistent risk state: daily P&L baseline, equity peak (drawdown),
consecutive losses and cool-down. Persisted as JSON so a restart cannot
silently reset the daily loss or the drawdown reference."""
from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path


def utc_day(ts_ms: int) -> int:
    return ts_ms // 86_400_000


@dataclass
class RiskState:
    day: int = -1
    day_start_equity: float = 0.0
    peak_equity: float = 0.0
    last_equity: float = 0.0
    realized_pnl_today: float = 0.0
    trades_today: int = 0
    consecutive_losses: int = 0
    cooldown_until_ms: int = 0
    daily_lock_day: int = -1          # day on which the daily loss limit was hit
    history: list[dict] = field(default_factory=list)
    path: str | None = None

    # ------------------------------------------------------------------ persistence
    @classmethod
    def load(cls, path: Path | None) -> RiskState:
        if path is not None and Path(path).exists():
            data = json.loads(Path(path).read_text(encoding="utf-8"))
            data["path"] = str(path)
            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        return cls(path=str(path) if path else None)

    def save(self) -> None:
        if not self.path:
            return
        p = Path(self.path)
        p.parent.mkdir(parents=True, exist_ok=True)
        data = asdict(self)
        data.pop("path", None)
        data["history"] = data["history"][-200:]
        fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=".risk_state")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=1)
        os.replace(tmp, p)

    # ------------------------------------------------------------------ updates
    def update_equity(self, equity: float, now_ms: int) -> None:
        d = utc_day(now_ms)
        if d != self.day:
            self.day = d
            self.day_start_equity = equity
            self.realized_pnl_today = 0.0
            self.trades_today = 0
        if self.peak_equity <= 0:
            self.peak_equity = equity
        self.peak_equity = max(self.peak_equity, equity)
        self.last_equity = equity

    def on_trade_closed(self, net_pnl: float, now_ms: int, max_consecutive: int, cooldown_min: int) -> None:
        self.realized_pnl_today += net_pnl
        self.trades_today += 1
        if net_pnl < 0:
            self.consecutive_losses += 1
            if self.consecutive_losses >= max_consecutive:
                self.cooldown_until_ms = now_ms + cooldown_min * 60_000
                self.history.append({"ts": now_ms, "event": "cooldown", "losses": self.consecutive_losses})
                self.consecutive_losses = 0
        else:
            self.consecutive_losses = 0

    # ------------------------------------------------------------------ metrics
    def daily_pnl(self, equity: float) -> float:
        return equity - self.day_start_equity if self.day_start_equity > 0 else 0.0

    def daily_loss_pct(self, equity: float) -> float:
        if self.day_start_equity <= 0:
            return 0.0
        return max(0.0, -(equity - self.day_start_equity) / self.day_start_equity * 100)

    def drawdown_pct(self, equity: float) -> float:
        if self.peak_equity <= 0:
            return 0.0
        return max(0.0, (self.peak_equity - equity) / self.peak_equity * 100)
