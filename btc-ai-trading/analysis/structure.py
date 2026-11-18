"""Market structure and liquidity concepts, computed in a single causal pass.

Covers (per bar, using only data available at the bar close):
* swing highs/lows (pivots confirmed `swing_len` bars after they print —
  the confirmation lag is what keeps this free of look-ahead bias),
* HH / HL / LH / LL labelling and structural trend,
* Break of Structure (BOS) and Change of Character (CHOCH),
* support / resistance clusters built from confirmed swings,
* Fair Value Gaps (3-candle imbalances) and their mitigation,
* Order Blocks (last opposite candle before a structure break),
* equal highs / equal lows (resting liquidity pools),
* liquidity sweeps (wick through a level, close back inside) — i.e.
  stop-hunt *patterns*; we never claim to know other traders' stops,
* false breakouts (break of structure that fails within 3 bars),
* volume spikes.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

OUTPUT_COLUMNS = [
    "swing_high_last", "swing_high_prev", "swing_low_last", "swing_low_prev",
    "high_label", "low_label", "structure_trend", "struct_bias",
    "bos_bull", "bos_bear", "choch_bull", "choch_bear",
    "sweep_bull", "sweep_bear", "sweep_level",
    "false_break_bull", "false_break_bear",
    "fvg_bull_top", "fvg_bull_bottom", "fvg_bear_top", "fvg_bear_bottom",
    "in_fvg_bull", "in_fvg_bear",
    "ob_bull_top", "ob_bull_bottom", "ob_bear_top", "ob_bear_bottom",
    "in_ob_bull", "in_ob_bear",
    "eqh_level", "eql_level",
    "resistance", "resistance_touches", "support", "support_touches",
]


def _bars_since(events: np.ndarray) -> np.ndarray:
    out = np.full(len(events), np.nan)
    last = -1
    for i, e in enumerate(events):
        if e:
            last = i
        if last >= 0:
            out[i] = i - last
    return out


def _cluster(levels: list[float], tol: float) -> tuple[np.ndarray, np.ndarray]:
    if not levels:
        return np.array([]), np.array([])
    pts = np.sort(np.asarray(levels, dtype=float))
    centers, counts = [], []
    group = [pts[0]]
    for p in pts[1:]:
        if p - group[-1] <= tol:
            group.append(p)
        else:
            centers.append(float(np.mean(group)))
            counts.append(len(group))
            group = [p]
    centers.append(float(np.mean(group)))
    counts.append(len(group))
    return np.asarray(centers), np.asarray(counts)


def compute_structure(
    df: pd.DataFrame,
    atr_values: np.ndarray,
    swing_len: int = 3,
    eq_tol_atr: float = 0.15,
    fvg_min_atr: float = 0.10,
    ob_lookback: int = 10,
    sr_tol_atr: float = 0.5,
    max_levels: int = 40,
) -> pd.DataFrame:
    o = df["open"].to_numpy(float)
    h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float)
    c = df["close"].to_numpy(float)
    n = len(df)
    out = {k: np.full(n, np.nan) for k in OUTPUT_COLUMNS}
    for k in ("bos_bull", "bos_bear", "choch_bull", "choch_bear", "sweep_bull", "sweep_bear",
              "false_break_bull", "false_break_bear", "in_fvg_bull", "in_fvg_bear", "in_ob_bull", "in_ob_bear"):
        out[k] = np.zeros(n)

    sh: list[tuple[int, float]] = []
    sl: list[tuple[int, float]] = []
    high_label = 0  # +1 HH, -1 LH
    low_label = 0   # +1 HL, -1 LL
    bias = 0
    ref_high, ref_high_broken = np.nan, True
    ref_low, ref_low_broken = np.nan, True
    fvg_bull = fvg_bear = None  # (top, bottom, born)
    ob_bull = ob_bear = None    # (top, bottom)
    eqh = eql = np.nan
    levels: list[float] = []
    centers, counts = np.array([]), np.array([])
    pending_up = pending_dn = None  # (level, bar) for false-breakout detection

    for i in range(n):
        a = atr_values[i] if np.isfinite(atr_values[i]) and atr_values[i] > 0 else max(h[i] - l[i], 1e-9)
        levels_changed = False

        # 1) pivot confirmation (pivot at j confirmed at i = j + swing_len)
        j = i - swing_len
        if j - swing_len >= 0:
            left_h, right_h = h[j - swing_len: j], h[j + 1: i + 1]
            if h[j] >= left_h.max() and h[j] > right_h.max():
                p = h[j]
                if sh:
                    high_label = 1 if p > sh[-1][1] else -1
                    for _, q in sh[-5:]:
                        if abs(p - q) <= eq_tol_atr * a and max(p, q) > c[i]:
                            eqh = max(p, q) if not np.isfinite(eqh) else max(eqh, p, q)
                sh.append((j, p))
                ref_high, ref_high_broken = p, False
                levels.append(p)
                levels_changed = True
            left_l, right_l = l[j - swing_len: j], l[j + 1: i + 1]
            if l[j] <= left_l.min() and l[j] < right_l.min():
                p = l[j]
                if sl:
                    low_label = 1 if p > sl[-1][1] else -1
                    for _, q in sl[-5:]:
                        if abs(p - q) <= eq_tol_atr * a and min(p, q) < c[i]:
                            eql = min(p, q) if not np.isfinite(eql) else min(eql, p, q)
                sl.append((j, p))
                ref_low, ref_low_broken = p, False
                levels.append(p)
                levels_changed = True

        # 2) liquidity sweeps (wick beyond the level, close back inside)
        for lvl in (ref_high if not ref_high_broken else np.nan, eqh):
            if np.isfinite(lvl) and h[i] > lvl and c[i] < lvl:
                out["sweep_bear"][i] = 1
                out["sweep_level"][i] = lvl
        for lvl in (ref_low if not ref_low_broken else np.nan, eql):
            if np.isfinite(lvl) and l[i] < lvl and c[i] > lvl:
                out["sweep_bull"][i] = 1
                out["sweep_level"][i] = lvl
        if np.isfinite(eqh) and h[i] > eqh:
            eqh = np.nan  # liquidity taken (swept or broken)
        if np.isfinite(eql) and l[i] < eql:
            eql = np.nan

        # 3) false breakouts: a recent break that closes back inside within 3 bars
        if pending_up is not None:
            lvl, b = pending_up
            if c[i] < lvl:
                out["false_break_bear"][i] = 1  # failed bullish break -> bearish signal
                pending_up = None
            elif i - b >= 3:
                pending_up = None
        if pending_dn is not None:
            lvl, b = pending_dn
            if c[i] > lvl:
                out["false_break_bull"][i] = 1
                pending_dn = None
            elif i - b >= 3:
                pending_dn = None

        # 4) BOS / CHOCH
        if not ref_high_broken and c[i] > ref_high:
            if bias == -1:
                out["choch_bull"][i] = 1
            else:
                out["bos_bull"][i] = 1
            bias, ref_high_broken = 1, True
            pending_up = (ref_high, i)
            for k in range(i - 1, max(-1, i - 1 - ob_lookback), -1):
                if c[k] < o[k]:
                    ob_bull = (h[k], l[k])
                    break
        if not ref_low_broken and c[i] < ref_low:
            if bias == 1:
                out["choch_bear"][i] = 1
            else:
                out["bos_bear"][i] = 1
            bias, ref_low_broken = -1, True
            pending_dn = (ref_low, i)
            for k in range(i - 1, max(-1, i - 1 - ob_lookback), -1):
                if c[k] > o[k]:
                    ob_bear = (h[k], l[k])
                    break

        # 5) FVG mitigation then detection
        if fvg_bull is not None:
            top, bot, born = fvg_bull
            if born < i:
                if c[i] < bot:
                    fvg_bull = None
                elif l[i] <= top:
                    out["in_fvg_bull"][i] = 1
        if fvg_bear is not None:
            top, bot, born = fvg_bear
            if born < i:
                if c[i] > top:
                    fvg_bear = None
                elif h[i] >= bot:
                    out["in_fvg_bear"][i] = 1
        if i >= 2:
            if l[i] > h[i - 2] and (l[i] - h[i - 2]) >= fvg_min_atr * a:
                fvg_bull = (l[i], h[i - 2], i)
            if h[i] < l[i - 2] and (l[i - 2] - h[i]) >= fvg_min_atr * a:
                fvg_bear = (l[i - 2], h[i], i)

        # 6) order block mitigation
        if ob_bull is not None:
            top, bot = ob_bull
            if c[i] < bot:
                ob_bull = None
            elif l[i] <= top:
                out["in_ob_bull"][i] = 1
        if ob_bear is not None:
            top, bot = ob_bear
            if c[i] > top:
                ob_bear = None
            elif h[i] >= bot:
                out["in_ob_bear"][i] = 1

        # 7) support / resistance from swing clusters
        if levels_changed:
            levels = levels[-max_levels:]
            centers, counts = _cluster(levels, sr_tol_atr * a)
        if len(centers):
            k = int(np.searchsorted(centers, c[i]))
            if k < len(centers):
                out["resistance"][i], out["resistance_touches"][i] = centers[k], counts[k]
            if k > 0:
                out["support"][i], out["support_touches"][i] = centers[k - 1], counts[k - 1]

        # 8) state snapshot
        if sh:
            out["swing_high_last"][i] = sh[-1][1]
            if len(sh) > 1:
                out["swing_high_prev"][i] = sh[-2][1]
        if sl:
            out["swing_low_last"][i] = sl[-1][1]
            if len(sl) > 1:
                out["swing_low_prev"][i] = sl[-2][1]
        out["high_label"][i] = high_label
        out["low_label"][i] = low_label
        out["structure_trend"][i] = 1 if (high_label == 1 and low_label == 1) else (
            -1 if (high_label == -1 and low_label == -1) else 0)
        out["struct_bias"][i] = bias
        if fvg_bull is not None:
            out["fvg_bull_top"][i], out["fvg_bull_bottom"][i] = fvg_bull[0], fvg_bull[1]
        if fvg_bear is not None:
            out["fvg_bear_top"][i], out["fvg_bear_bottom"][i] = fvg_bear[0], fvg_bear[1]
        if ob_bull is not None:
            out["ob_bull_top"][i], out["ob_bull_bottom"][i] = ob_bull
        if ob_bear is not None:
            out["ob_bear_top"][i], out["ob_bear_bottom"][i] = ob_bear
        out["eqh_level"][i] = eqh
        out["eql_level"][i] = eql

    res = pd.DataFrame(out, index=df.index)
    for ev in ("bos_bull", "bos_bear", "choch_bull", "choch_bear", "sweep_bull", "sweep_bear"):
        res[f"bars_since_{ev}"] = _bars_since(res[ev].to_numpy())
    return res
