"""FastAPI backend for the dashboard.

Security:
* every /api route except /api/health requires `Authorization: Bearer <DASHBOARD_TOKEN>`
  (constant-time comparison); binds to 127.0.0.1 by default,
* mutating routes: pause / resume / emergency stop and a *paper/testnet*
  mode request applied at the next manual restart. LIVE can never be
  enabled from the API, and risk limits are read-only here.
"""
from __future__ import annotations

import hmac
import json
import math
import time
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from agents.orchestrator import TradingSystem, mode_request_path, write_mode_request
from backtesting.metrics import equity_metrics, grouped, trade_metrics
from config.settings import PROJECT_ROOT, Settings
from risk.kill_switch import KillSwitchError

WEB_OUT = PROJECT_ROOT / "dashboard" / "web" / "out"


def _clean(obj: Any) -> Any:
    """Make payloads JSON-safe (NaN/inf -> None)."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    return obj


class EmergencyBody(BaseModel):
    confirm: str


class ModeBody(BaseModel):
    mode: str


def create_app(system: TradingSystem | None, settings: Settings, token: str) -> FastAPI:
    app = FastAPI(title="BTC AI Trading — Hyperliquid", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                       allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])

    def auth(request: Request) -> None:
        h = request.headers.get("authorization", "")
        supplied = h.removeprefix("Bearer ").strip()
        if not supplied or not hmac.compare_digest(supplied.encode(), token.encode()):
            raise HTTPException(status_code=401, detail="invalid or missing dashboard token")

    def sys_() -> TradingSystem:
        if system is None:
            raise HTTPException(status_code=503, detail="trading system not running")
        return system

    def ok(data: Any) -> JSONResponse:
        return JSONResponse(_clean(data))

    # ------------------------------------------------------------------ public
    @app.get("/api/health")
    def health():
        if system is None:
            return {"ok": False, "status": "system not running"}
        return {"ok": True, "mode": system.mode.value, "kill_switch": system.kill_switch.state.value,
                "loops": system.loops, "ws_connected": system.market.ws.connected}

    # ------------------------------------------------------------------ protected
    @app.get("/api/overview", dependencies=[Depends(auth)])
    def overview():
        s = sys_()
        st = s.state()
        trades = s.db.trades(s.mode.value, limit=5000)
        tm = trade_metrics(trades)
        eq_curve = s.db.equity_curve(s.mode.value)
        acct = st["account"] or {}
        risk = st["risk"]
        return ok({
            "mode": s.mode.value, "capital": acct.get("balance"), "equity": acct.get("equity"),
            "unrealized_pnl": sum(p["unrealized_pnl"] for p in acct.get("positions", [])),
            "pnl_today": risk["daily_pnl"], "pnl_total": (acct.get("equity") or settings.initial_capital_usd) - settings.initial_capital_usd,
            "drawdown_pct": risk["drawdown_pct"], "win_rate": tm["win_rate"], "profit_factor": tm["profit_factor"],
            "trades": tm["trades"], "expectancy_usd": tm["expectancy_usd"], "fees": tm["fees"], "funding": tm["funding"],
            "initial_capital": settings.initial_capital_usd, "equity_curve": eq_curve, "kill_switch": risk["kill_switch"]["state"],
            "regime": st["regime"], "active_strategy": st["active_strategy"], "position": st["position"],
            "last_signal": st["last_signal"], "uptime_s": (time.time() * 1000 - s.started_ms) / 1000,
            "targets_note": "Daily USD goals are exploratory targets, never forced: no trade is taken to reach them.",
        })

    @app.get("/api/market", dependencies=[Depends(auth)])
    def market():
        s = sys_()
        rep = s.last_reports
        scan = rep.get("scan").data if rep.get("scan") else {}
        regime = rep.get("regime").data if rep.get("regime") else {}
        tech = rep.get("technical").data if rep.get("technical") else {}
        strat = rep.get("strategy").data if rep.get("strategy") else {}
        return ok({"price": s.store.mid, "mark": s.store.mark, "funding_rate_hourly": s.store.funding_rate,
                   "open_interest": s.store.asset_ctx.get("openInterest"), "day_volume": s.store.asset_ctx.get("dayNtlVlm"),
                   "prev_day_px": s.store.asset_ctx.get("prevDayPx"), "scan": scan, "regime": regime,
                   "technical": {"overall_bias": tech.get("overall_bias"), "direction": tech.get("direction"),
                                 "timeframes": {k: {"bias": v["bias"], "rsi": v["rsi"], "adx": v["adx"]}
                                                for k, v in tech.get("timeframes", {}).items()}},
                   "strategy": strat, "signals": s.state()["signals"][:30],
                   "book": s.store.book().to_dict() if s.store.book() else None})

    @app.get("/api/candles", dependencies=[Depends(auth)])
    def candles(tf: str = "15m", limit: int = 300):
        s = sys_()
        if tf not in s.store.timeframes:
            raise HTTPException(400, f"tf must be one of {s.store.timeframes}")
        f = s.store.features(tf).tail(min(limit, 1500))
        cols = ["open_time", "open", "high", "low", "close", "volume", "ema20", "ema50", "ema200", "vwap"]
        return ok([{c: (r[c] if c in r else None) for c in cols} for r in f[cols].to_dict("records")])

    @app.get("/api/agents", dependencies=[Depends(auth)])
    def agents():
        s = sys_()
        return ok({"agents": s.agents_state(), "decisions": s.db.decisions(s.mode.value, 50), "ml": s.ml_status})

    @app.get("/api/trades", dependencies=[Depends(auth)])
    def trades(limit: int = 200):
        s = sys_()
        tr = s.db.trades(s.mode.value, limit=limit)
        return ok({"open_position": s.execution.position.model_dump() if s.execution.position else None,
                   "account_positions": (s.account.model_dump()["positions"] if s.account else []),
                   "open_orders": (s.account.model_dump()["open_orders"] if s.account else []),
                   "trades": [t.model_dump(mode="json", exclude={"features"}) for t in reversed(tr)],
                   "orders": s.db.orders(s.mode.value, 50)})

    @app.get("/api/performance", dependencies=[Depends(auth)])
    def performance():
        s = sys_()
        tr = s.db.trades(s.mode.value, limit=5000)
        eq = s.db.equity_curve(s.mode.value)
        import pandas as pd
        em = equity_metrics(pd.Series([e["equity"] for e in eq], index=[e["ts"] for e in eq]), settings.initial_capital_usd) if eq else {}
        rep = s.performance.analyze().data
        return ok({"overall": trade_metrics(tr), "equity": em, "by_strategy": grouped(tr, "strategy"),
                   "by_regime": grouped(tr, "regime"), "recommendations": rep["recommendations"],
                   "execution_errors_7d": rep["execution_errors_7d"]})

    @app.get("/api/risk", dependencies=[Depends(auth)])
    def risk():
        s = sys_()
        st = s.state()
        return ok({"status": st["risk"], "health": st["health"], "market_health": st["market_health"],
                   "last_verdict": (s.risk.last_report.data.get("verdict") if s.risk.last_report else None),
                   "events": s.db.events(s.mode.value, 50)})

    @app.get("/api/backtests", dependencies=[Depends(auth)])
    def backtests():
        out = {}
        for name in ("latest.json", "ml_report.json", "walk_forward_trend.json"):
            p = PROJECT_ROOT / "reports" / name
            if p.exists():
                out[name.removesuffix(".json")] = json.loads(p.read_text(encoding="utf-8"))
        return ok(out)

    @app.get("/api/settings", dependencies=[Depends(auth)])
    def get_settings_():
        s = sys_()
        req = mode_request_path(settings)
        return ok({
            "mode": s.mode.value, "mode_request": json.loads(req.read_text()) if req.exists() else None,
            "market_data_url": settings.market_data_api_url, "execution_url": settings.execution_api_url,
            "account_address": settings.hl_account_address or None,
            "enabled_strategies": [x.value for x in settings.enabled_strategies], "min_setup_score": settings.min_setup_score,
            "decision_interval_seconds": settings.decision_interval_seconds,
            "risk_limits_read_only": s.risk.risk_status(s.account)["limits"],
            "costs": {"taker_fee": settings.taker_fee_rate, "maker_fee": settings.maker_fee_rate,
                      "slippage_bps_market": settings.slippage_bps_market, "slippage_bps_stop": settings.slippage_bps_stop},
            "emergency_position_policy": settings.emergency_position_policy,
            "telegram_enabled": bool(settings.telegram_bot_token.get_secret_value()),
            "live_note": "LIVE cannot be enabled from the dashboard. See docs/GO_LIVE.md.",
        })

    @app.post("/api/settings/mode-request", dependencies=[Depends(auth)])
    def mode_request(body: ModeBody):
        try:
            return ok(write_mode_request(settings, body.mode, "dashboard"))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @app.post("/api/control/pause", dependencies=[Depends(auth)])
    async def pause():
        return ok({"state": await sys_().pause("dashboard")})

    @app.post("/api/control/resume", dependencies=[Depends(auth)])
    async def resume():
        try:
            return ok({"state": await sys_().resume("dashboard")})
        except KillSwitchError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.post("/api/control/emergency-stop", dependencies=[Depends(auth)])
    async def emergency(body: EmergencyBody):
        if body.confirm != "EMERGENCY":
            raise HTTPException(400, "confirm must be 'EMERGENCY'")
        return ok({"state": await sys_().emergency_stop("dashboard")})

    # ------------------------------------------------------------------ static dashboard
    if WEB_OUT.exists():
        @app.get("/{path:path}", include_in_schema=False)
        def static(path: str):
            root = WEB_OUT.resolve()
            target = (WEB_OUT / path).resolve()
            if not target.is_relative_to(root):
                raise HTTPException(404)
            for cand in (target, target.with_suffix(".html"), target / "index.html"):
                if cand.is_file():
                    return FileResponse(cand)
            return FileResponse(WEB_OUT / "index.html")

    return app


def resolve_token(settings: Settings) -> tuple[str, Path | None]:
    """Use DASHBOARD_TOKEN if strong enough, else generate one into runtime/dashboard_token.txt."""
    import secrets

    tok = settings.dashboard_token.get_secret_value()
    if tok and len(tok) >= 16 and not tok.startswith("change-me"):
        return tok, None
    p = settings.runtime_dir / "dashboard_token.txt"
    if p.exists():
        return p.read_text(encoding="utf-8").strip(), p
    tok = secrets.token_urlsafe(32)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(tok, encoding="utf-8")
    try:
        p.chmod(0o600)
    except OSError:
        pass
    return tok, p


__all__ = ["create_app", "resolve_token"]
