"""AGENT 4 — MARKET REGIME DETECTOR.

Classifies BTC into one of: strong bullish trend, strong bearish trend,
sideways, high volatility, low volatility, unstable, news-driven (plus an
`unknown` transition state). Can always answer NO TRADE.

Method (deterministic, auditable):
* Trend: 6 independent votes on H1/H4 (ADX+DI, EMA stack, HH/HL structure,
  EMA50 slope, price vs EMA200, H4 trend). Strong trend = ADX >= 22 and >= 4 votes.
* Volatility: percentile rank of ATR% over a trailing window (H1).
* News-driven: we have no news feed. It is detected from market shocks
  (extreme return z-score, range > 3.5 ATR with volume z > 3) and from an
  optional user calendar of scheduled events (config/event_calendar.json).
  The state is held for a cool-down period after the last shock.
* Unstable: EMA whipsaw + high volatility + weak ADX, abnormal spread,
  or an anomaly flagged by the (optional) IsolationForest model.

Hysteresis: a new raw regime must persist over `confirm_bars` consecutive
15m bar closes before it becomes the stable regime (prevents strategy
flip-flopping on noise). Safety regimes (news/unstable) apply immediately.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from agents.base import BaseAgent
from core.models import AgentReport, Regime
from core.snapshot import MarketSnapshot, finite

SAFETY_REGIMES = {Regime.NEWS_DRIVEN, Regime.UNSTABLE}


def load_calendar(path: Path | None) -> list[dict]:
    if path is None or not Path(path).exists():
        return []
    try:
        events = json.loads(Path(path).read_text(encoding="utf-8")).get("events", [])
    except (ValueError, OSError):
        return []
    out = []
    for e in events:
        try:
            t = datetime.fromisoformat(e["time_utc"].replace("Z", "+00:00")).astimezone(timezone.utc)
            out.append({"name": e.get("name", "event"), "t_ms": int(t.timestamp() * 1000),
                        "before_ms": int(e.get("before_min", 30)) * 60_000,
                        "after_ms": int(e.get("after_min", 60)) * 60_000})
        except (KeyError, ValueError):
            continue
    return out


class RegimeDetector(BaseAgent):
    name = "regime_detector"
    role = "Identifie le régime de marché (tendance, range, volatilité, instabilité, news) — peut imposer NO TRADE"

    def __init__(self, confirm_bars: int = 2, news_cooldown_min: int = 45, calendar_path: Path | None = None,
                 anomaly_model=None):
        super().__init__()
        self.confirm_bars = confirm_bars
        self.news_cooldown_ms = news_cooldown_min * 60_000
        self.calendar = load_calendar(calendar_path)
        self.anomaly_model = anomaly_model
        self.stable: Regime = Regime.UNKNOWN
        self._candidate: Regime | None = None
        self._candidate_count = 0
        self._last_bar_time: float | None = None
        self._news_until = 0
        self.stable_since_ms: int | None = None

    # ------------------------------------------------------------------
    def raw_regime(self, snap: MarketSnapshot) -> tuple[Regime, dict]:
        h1 = lambda c: snap.get("1h", c)  # noqa: E731
        h4 = lambda c: snap.get("4h", c)  # noqa: E731
        m15 = lambda c: snap.get("15m", c)  # noqa: E731
        info: dict = {"reasons": []}

        # --- news-driven shock -------------------------------------------------
        shock = []
        for tf in ("1m", "5m", "15m"):
            if tf not in snap.rows:
                continue
            rz, rng, vz = snap.get(tf, "ret_z"), snap.get(tf, "range_atr"), snap.get(tf, "vol_z")
            if finite(rz) and abs(rz) >= 4.5:
                shock.append(f"{tf} return z={rz:.1f}")
            if finite(rng, vz) and rng >= 3.5 and vz >= 3.0:
                shock.append(f"{tf} range {rng:.1f}xATR with volume z={vz:.1f}")
        if shock:
            self._news_until = snap.timestamp + self.news_cooldown_ms
        for ev in self.calendar:
            if ev["t_ms"] - ev["before_ms"] <= snap.timestamp <= ev["t_ms"] + ev["after_ms"]:
                shock.append(f"scheduled event window: {ev['name']}")
                self._news_until = max(self._news_until, ev["t_ms"] + ev["after_ms"])
        if shock or snap.timestamp < self._news_until:
            info["reasons"] = shock or ["cool-down after recent market shock"]
            return Regime.NEWS_DRIVEN, info

        # --- unstable -----------------------------------------------------------
        unstable = []
        if finite(m15("ema_cross_count50"), m15("atr_pct_rank"), m15("adx")) and \
                m15("ema_cross_count50") >= 6 and m15("atr_pct_rank") > 0.7 and m15("adx") < 20:
            unstable.append("15m whipsaw: frequent EMA crosses with high volatility and weak ADX")
        if snap.book is not None and snap.book.spread_bps > 5.0:
            unstable.append(f"abnormal spread {snap.book.spread_bps:.1f} bps")
        if self.anomaly_model is not None:
            try:
                if self.anomaly_model.is_anomaly(snap):
                    unstable.append("anomaly model flags current market features")
            except Exception as exc:  # noqa: BLE001
                info["anomaly_error"] = str(exc)
        if unstable:
            info["reasons"] = unstable
            return Regime.UNSTABLE, info

        if not snap.has("1h"):
            info["reasons"] = ["insufficient 1h data"]
            return Regime.UNKNOWN, info

        # --- trend votes ----------------------------------------------------------
        close = h1("close")
        adx_v, pdi, mdi = h1("adx"), h1("plus_di"), h1("minus_di")
        bull = [
            finite(adx_v, pdi, mdi) and adx_v >= 22 and pdi > mdi,
            h1("ema_stack") == 1,
            h1("structure_trend") == 1 or (h1("struct_bias") == 1 and h1("low_label") == 1),
            finite(h1("ema50_slope")) and h1("ema50_slope") > 0.05,
            finite(h1("ema200")) and close > h1("ema200"),
            finite(h4("ema50"), h4("ema200")) and h4("ema50") > h4("ema200") and h4("close") > h4("ema50"),
        ]
        bear = [
            finite(adx_v, pdi, mdi) and adx_v >= 22 and mdi > pdi,
            h1("ema_stack") == -1,
            h1("structure_trend") == -1 or (h1("struct_bias") == -1 and h1("high_label") == -1),
            finite(h1("ema50_slope")) and h1("ema50_slope") < -0.05,
            finite(h1("ema200")) and close < h1("ema200"),
            finite(h4("ema50"), h4("ema200")) and h4("ema50") < h4("ema200") and h4("close") < h4("ema50"),
        ]
        nb, ns = sum(bool(x) for x in bull), sum(bool(x) for x in bear)
        info.update({"bull_votes": nb, "bear_votes": ns, "adx_1h": adx_v})
        rank = h1("atr_pct_rank")
        info["atr_rank_1h"] = rank
        if bull[0] and nb >= 4:
            info["reasons"] = [f"{nb}/6 bullish trend votes, ADX {adx_v:.0f}"]
            return Regime.STRONG_BULL, info
        if bear[0] and ns >= 4:
            info["reasons"] = [f"{ns}/6 bearish trend votes, ADX {adx_v:.0f}"]
            return Regime.STRONG_BEAR, info
        if finite(rank) and rank > 0.85:
            info["reasons"] = [f"1h ATR% in top {100 - rank * 100:.0f}% of trailing window without clear trend"]
            return Regime.HIGH_VOL, info
        bbr = h1("bb_width_rank")
        if finite(rank, bbr) and rank < 0.15 and bbr < 0.25:
            info["reasons"] = ["1h ATR% and Bollinger width in bottom percentiles (compression)"]
            return Regime.LOW_VOL, info
        if finite(adx_v) and adx_v < 22:
            info["reasons"] = [f"ADX {adx_v:.0f} < 22, no directional consensus ({nb} bull / {ns} bear votes)"]
            return Regime.SIDEWAYS, info
        info["reasons"] = [f"transition: ADX {adx_v:.0f} but only {max(nb, ns)}/6 trend votes"]
        return Regime.UNKNOWN, info

    # ------------------------------------------------------------------
    def analyze(self, snap: MarketSnapshot) -> AgentReport:
        raw, info = self.raw_regime(snap)
        bar_time = snap.get("15m", "close_time") if "15m" in snap.rows else snap.timestamp // 900_000
        changed = False
        if raw in SAFETY_REGIMES:
            changed = raw != self.stable
            self.stable, self._candidate, self._candidate_count = raw, None, 0
        elif raw == self.stable:
            self._candidate, self._candidate_count = None, 0
        else:
            if raw != self._candidate:
                self._candidate, self._candidate_count = raw, 1
                self._last_bar_time = bar_time
            elif bar_time != self._last_bar_time:
                self._candidate_count += 1
                self._last_bar_time = bar_time
            # hysteresis is only skipped at start-up (nothing established yet)
            if self._candidate_count >= self.confirm_bars or self.stable_since_ms is None:
                self.stable, self._candidate, self._candidate_count = raw, None, 0
                changed = True
        if changed:
            self.stable_since_ms = snap.timestamp
        votes = max(info.get("bull_votes", 0), info.get("bear_votes", 0))
        confidence = round(votes / 6.0, 2) if self.stable in (Regime.STRONG_BULL, Regime.STRONG_BEAR) else None
        data = {
            "regime": self.stable.value,
            "raw_regime": raw.value,
            "pending_change": self._candidate.value if self._candidate else None,
            "pending_count": self._candidate_count,
            "stable_since_ms": self.stable_since_ms,
            "trend_vote_ratio": confidence,
            "reasons": info.get("reasons", []),
            "details": {k: v for k, v in info.items() if k != "reasons"},
            "no_trade": self.stable in (Regime.NEWS_DRIVEN, Regime.UNSTABLE, Regime.UNKNOWN),
        }
        summary = f"regime {self.stable.value}" + (f" (raw {raw.value})" if raw != self.stable else "")
        status = "warning" if self.stable in SAFETY_REGIMES else "ok"
        return self.record(AgentReport(agent=self.name, timestamp=snap.timestamp, summary=summary, data=data), status)


def now_ms() -> int:
    return int(time.time() * 1000)
