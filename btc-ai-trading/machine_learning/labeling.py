"""Outcome labels for candidate setups (meta-labeling).

Each candidate setup produced by a strategy at bar i is simulated
forward, independently of position constraints, with the same rules as
the backtester: entry at the next open (market) or a passive limit
(must trade through within 2 bars), stop first if stop and target share a
bar, time exit at `max_hold` bars, fees + slippage + approximate funding.
Label = 1 if the net R multiple is > 0.

Candidates of the same strategy/direction on consecutive bars are
de-duplicated (one every `dedupe_bars`) to limit overlapping labels.
"""
from __future__ import annotations

import numpy as np

from backtesting.costs import CostModel
from core.models import EntryType, TradeSetup
from market_data.candles import interval_ms


def simulate_outcome(o, h, l, c, i: int, setup: TradeSetup, costs: CostModel, max_bars: int,
                     bar_minutes: float, tick: float = 1.0) -> dict | None:
    n = len(o)
    j = i + 1
    if j >= n:
        return None
    sign = setup.direction.sign
    slip_m, slip_s = costs.slippage_bps_market / 1e4, costs.slippage_bps_stop / 1e4
    if setup.entry_type == EntryType.MARKET:
        fill = o[j] * (1 + sign * slip_m)
        start = j
    else:
        fill, start = None, None
        for k in range(j, min(n, j + 2)):
            if (l[k] <= setup.entry_price - tick) if sign > 0 else (h[k] >= setup.entry_price + tick):
                fill, start = setup.entry_price, k
                break
        if fill is None:
            return None
    dist = abs(setup.entry_price - setup.stop_loss)
    stop = fill - sign * dist
    tp = None if setup.take_profit is None else fill + sign * abs(setup.take_profit - setup.entry_price)
    exit_px, exit_k, exit_rate, reason = None, None, costs.taker_fee, "time"
    for k in range(start, min(n, start + max_bars)):
        if (l[k] <= stop) if sign > 0 else (h[k] >= stop):
            gap = (o[k] <= stop) if sign > 0 else (o[k] >= stop)
            exit_px = (o[k] if gap else stop) * (1 - sign * slip_s)
            exit_k, reason = k, "stop"
            break
        if tp is not None:
            hit = ((h[k] >= tp + tick) if sign > 0 else (l[k] <= tp - tick)) if setup.tp_as_limit else \
                ((h[k] >= tp) if sign > 0 else (l[k] <= tp))
            if hit:
                if setup.tp_as_limit:
                    exit_px, exit_rate = tp, costs.maker_fee
                else:
                    exit_px = tp * (1 - sign * slip_m)
                exit_k, reason = k, "tp"
                break
    if exit_px is None:
        exit_k = min(n, start + max_bars) - 1
        exit_px = c[exit_k] * (1 - sign * slip_m)
    hours = (exit_k - start + 1) * bar_minutes / 60
    funding = costs.funding_cost(fill, setup.direction, hours)
    net_unit = sign * (exit_px - fill) - fill * costs.entry_rate(setup.entry_type) - exit_px * exit_rate - funding
    risk_unit = dist + fill * costs.entry_rate(setup.entry_type) + stop * costs.exit_rate("stop")
    r = net_unit / risk_unit if risk_unit > 0 else 0.0
    return {"r": float(r), "win": int(r > 0), "exit_bar": int(exit_k), "reason": reason}


def label_candidates(base, candidates: list[dict], costs: CostModel, base_tf: str, max_hold_bars: int | None = None,
                     dedupe_bars: int = 4) -> list[dict]:
    o, h, l, c = (base[k].to_numpy(float) for k in ("open", "high", "low", "close"))
    bar_min = interval_ms(base_tf) / 60_000
    last_seen: dict[tuple, int] = {}
    out = []
    for cand in sorted(candidates, key=lambda x: x["i"]):
        s: TradeSetup = cand["setup"]
        key = (s.strategy, s.direction)
        if key in last_seen and cand["i"] - last_seen[key] < dedupe_bars:
            continue
        last_seen[key] = cand["i"]
        mb = max_hold_bars or max(1, int(s.max_hold_minutes / bar_min))
        res = simulate_outcome(o, h, l, c, cand["i"], s, costs, mb, bar_min)
        if res is None:
            continue
        t = int(base["close_time"].iat[cand["i"]])
        # "i" / "horizon" are expressed in MINUTES so samples from different base
        # timeframes share one time axis for purged walk-forward splits.
        out.append({"bar": cand["i"], "i": t // 60_000, "t": t, "regime": cand["regime"],
                    "strategy": s.strategy.value, "direction": s.direction.value, "score": s.score,
                    "features": s.features, "horizon": int((res["exit_bar"] - cand["i"] + 1) * bar_min),
                    "base_tf": base_tf, **res})
    return out


def feature_matrix(rows: list[dict], columns: list[str] | None = None) -> tuple[np.ndarray, list[str]]:
    """Build a dense matrix from setup feature dicts + strategy one-hot + regime one-hot."""
    from core.models import Regime, StrategyName

    if columns is None:
        keys = sorted({k for r in rows for k in r["features"].keys()})
        strat = [f"strat_{s.value}" for s in StrategyName if s != StrategyName.NONE]
        regs = [f"regime_{g.value}" for g in Regime]
        columns = keys + strat + regs
    X = np.full((len(rows), len(columns)), np.nan)
    col_idx = {k: j for j, k in enumerate(columns)}
    for i, r in enumerate(rows):
        for k, v in r["features"].items():
            j = col_idx.get(k)
            if j is not None:
                X[i, j] = v
        for prefix, val in (("strat_", r.get("strategy")), ("regime_", r.get("regime"))):
            j = col_idx.get(f"{prefix}{val}")
            for k2, j2 in col_idx.items():
                if k2.startswith(prefix):
                    X[i, j2] = 0.0
            if j is not None:
                X[i, j] = 1.0
    return X, columns
