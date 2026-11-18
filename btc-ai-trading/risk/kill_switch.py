"""Kill switch.

States:
* RUNNING  — entries allowed (subject to the Risk Manager).
* PAUSED   — no new entries; open positions keep their protection and are
             managed normally. Can be resumed (dashboard / Telegram / CLI).
* HALTED   — emergency: no new entries, pending orders cancelled, open
             position handled by the emergency policy (flatten | protect).
             Only a human can reset it, from the CLI, with a typed code.

The state is persisted to disk *before* any action is taken so a crash or
restart never re-enables trading by itself.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from enum import Enum
from pathlib import Path


class SwitchState(str, Enum):
    RUNNING = "running"
    PAUSED = "paused"
    HALTED = "halted"


class KillSwitchError(RuntimeError):
    pass


class KillSwitch:
    def __init__(self, path: Path | None = None):
        self.path = Path(path) if path else None
        self.state = SwitchState.RUNNING
        self.reason = ""
        self.source = ""
        self.since_ms = int(time.time() * 1000)
        self.events: list[dict] = []
        self.pending_emergency = False   # orchestrator must run the emergency procedure
        self._load()

    # ------------------------------------------------------------------ persistence
    def _load(self) -> None:
        if self.path and self.path.exists():
            d = json.loads(self.path.read_text(encoding="utf-8"))
            self.state = SwitchState(d.get("state", "running"))
            self.reason = d.get("reason", "")
            self.source = d.get("source", "")
            self.since_ms = d.get("since_ms", self.since_ms)
            self.events = d.get("events", [])
            self.pending_emergency = d.get("pending_emergency", False)

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        d = {"state": self.state.value, "reason": self.reason, "source": self.source, "since_ms": self.since_ms,
             "events": self.events[-200:], "pending_emergency": self.pending_emergency}
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".kill_switch")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(d, fh, indent=1)
        os.replace(tmp, self.path)

    def _transition(self, state: SwitchState, reason: str, source: str) -> None:
        now = int(time.time() * 1000)
        self.events.append({"ts": now, "from": self.state.value, "to": state.value, "reason": reason, "source": source})
        self.state, self.reason, self.source, self.since_ms = state, reason, source, now
        self._save()

    # ------------------------------------------------------------------ API
    @property
    def entries_allowed(self) -> bool:
        return self.state == SwitchState.RUNNING

    def pause(self, reason: str, source: str) -> None:
        if self.state == SwitchState.HALTED:
            return  # never downgrade a halt
        if self.state != SwitchState.PAUSED:
            self._transition(SwitchState.PAUSED, reason, source)

    def resume(self, source: str) -> None:
        if self.state == SwitchState.HALTED:
            raise KillSwitchError("system is HALTED: only a manual CLI reset can re-enable trading")
        if self.state == SwitchState.PAUSED:
            self._transition(SwitchState.RUNNING, "resumed", source)

    def halt(self, reason: str, source: str) -> None:
        """Emergency stop. Idempotent; always (re)arms the emergency procedure."""
        self.pending_emergency = True
        if self.state != SwitchState.HALTED:
            self._transition(SwitchState.HALTED, reason, source)
        else:
            self._save()

    def emergency_done(self) -> None:
        self.pending_emergency = False
        self._save()

    def reset(self, operator_ack: str) -> None:
        """Manual reset (CLI only). `operator_ack` must be 'RESET'."""
        if operator_ack != "RESET":
            raise KillSwitchError("reset requires explicit operator acknowledgement 'RESET'")
        self.pending_emergency = False
        self._transition(SwitchState.RUNNING, "manual reset by operator", "cli")

    def to_dict(self) -> dict:
        return {"state": self.state.value, "reason": self.reason, "source": self.source, "since_ms": self.since_ms,
                "pending_emergency": self.pending_emergency, "events": self.events[-20:]}
