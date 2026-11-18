"""Structured (JSON) logging with secret redaction.

Every log record passes through `RedactingFilter`, which masks:
* any configured secret value (API wallet key, dashboard token, Telegram token),
* anything that looks like an EVM private key (64 hex chars),
* Telegram bot tokens embedded in URLs.
"""
from __future__ import annotations

import json
import logging
import re
import sys
import time
from typing import Any

_PRIVKEY_RE = re.compile(r"(0x)?[0-9a-fA-F]{64}")
_TG_TOKEN_RE = re.compile(r"\d{6,12}:[A-Za-z0-9_-]{30,}")
_STD_ATTRS = set(vars(logging.LogRecord("x", 0, "x", 0, "x", None, None))) | {"message", "asctime"}


def redact(text: str, secrets: list[str] | None = None) -> str:
    for s in secrets or []:
        if s:
            text = text.replace(s, "***REDACTED***")
    text = _PRIVKEY_RE.sub("***REDACTED_KEY***", text)
    return _TG_TOKEN_RE.sub("***REDACTED_TOKEN***", text)


class RedactingFilter(logging.Filter):
    def __init__(self, secrets: list[str] | None = None):
        super().__init__()
        self.secrets = secrets or []

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # noqa: BLE001
            msg = str(record.msg)
        record.msg = redact(msg, self.secrets)
        record.args = ()
        for k, v in list(record.__dict__.items()):
            if k not in _STD_ATTRS and isinstance(v, str):
                record.__dict__[k] = redact(v, self.secrets)
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for k, v in record.__dict__.items():
            if k not in _STD_ATTRS and not k.startswith("_"):
                payload[k] = v if isinstance(v, (int, float, str, bool, type(None), list, dict)) else str(v)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def setup_logging(settings=None, level: str | None = None, json_logs: bool | None = None) -> None:
    level = level or (settings.log_level if settings else "INFO")
    json_logs = settings.log_json if (json_logs is None and settings) else bool(json_logs)
    secrets = settings.secret_values() if settings else []
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if json_logs else logging.Formatter(
        "%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    handler.addFilter(RedactingFilter(secrets))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level.upper())
    for noisy in ("httpx", "httpcore", "websockets", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
