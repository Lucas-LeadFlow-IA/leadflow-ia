"""Base class shared by all agents: status, last report, error and decision history."""
from __future__ import annotations

import logging
import time
import traceback
from collections import deque
from typing import Any

from core.models import AgentReport


class BaseAgent:
    name: str = "agent"
    role: str = ""

    def __init__(self, history: int = 100):
        self.status = "idle"            # idle | ok | warning | error | disabled
        self.last_report: AgentReport | None = None
        self.last_run_ms: int | None = None
        self.last_duration_ms: float | None = None
        self.errors: deque[dict[str, Any]] = deque(maxlen=50)
        self.history: deque[dict[str, Any]] = deque(maxlen=history)
        self.log = logging.getLogger(f"agent.{self.name}")

    def record(self, report: AgentReport, status: str = "ok") -> AgentReport:
        self.last_report = report
        self.status = status
        self.last_run_ms = int(time.time() * 1000)
        self.history.append({"ts": report.timestamp, "summary": report.summary, "status": status})
        return report

    def record_error(self, exc: BaseException, context: str = "") -> None:
        self.status = "error"
        self.errors.append({"ts": int(time.time() * 1000), "error": f"{type(exc).__name__}: {exc}",
                            "context": context, "trace": traceback.format_exc(limit=3)})
        self.log.exception("agent error: %s", context)

    def state(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "role": self.role,
            "status": self.status,
            "last_run_ms": self.last_run_ms,
            "last_duration_ms": self.last_duration_ms,
            "last_report": self.last_report.model_dump() if self.last_report else None,
            "errors": list(self.errors)[-10:],
            "history": list(self.history)[-30:],
        }
