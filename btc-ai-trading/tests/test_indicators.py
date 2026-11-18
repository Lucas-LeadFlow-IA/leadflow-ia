import numpy as np
import pandas as pd
import pytest

from analysis import indicators as ind
from analysis.orderbook import book_stats, market_impact_price, trade_flow
from tests.conftest import make_candles


def test_ema_matches_recursive_definition():
    s = pd.Series(np.arange(1, 31, dtype=float))
    e = ind.ema(s, 10)
    alpha = 2 / 11
    manual = [s[0]]
    for x in s[1:]:
        manual.append(alpha * x + (1 - alpha) * manual[-1])
    assert np.isnan(e[8]) and e[9] == pytest.approx(manual[9])
    assert e.iloc[-1] == pytest.approx(manual[-1])


def test_rsi_bounds_and_extremes():
    up = pd.Series(np.linspace(100, 200, 50))
    assert ind.rsi(up).iloc[-1] == pytest.approx(100.0)
    down = pd.Series(np.linspace(200, 100, 50))
    assert ind.rsi(down).iloc[-1] == pytest.approx(0.0, abs=1e-9)
    r = ind.rsi(make_candles(500)["close"]).dropna()
    assert ((r >= 0) & (r <= 100)).all()


def test_rsi_wilder_reference_value():
    # Classic Wilder example (first 15 closes from "New Concepts in Technical Trading Systems")
    closes = pd.Series([44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
                        45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64])
    r = ind.rsi(closes, 14)
    # Hand computation on these rounded closes: avg gain = 3.34/14, avg loss = 1.40/14
    # RS = 2.3857 -> RSI = 70.464 (published 70.53 uses unrounded source prices)
    expected = 100 - 100 / (1 + (3.34 / 14) / (1.40 / 14))
    assert r.iloc[14] == pytest.approx(expected, abs=1e-6)
    assert np.isnan(r.iloc[13])
    assert r.iloc[-1] < r.iloc[17]


def test_atr_constant_range():
    n = 60
    df = pd.DataFrame({"open": np.full(n, 100.0), "high": np.full(n, 101.0), "low": np.full(n, 99.0),
                       "close": np.full(n, 100.0), "volume": np.ones(n), "open_time": np.arange(n) * 60000})
    assert ind.atr(df, 14).iloc[-1] == pytest.approx(2.0)


def test_adx_strong_trend_is_high():
    n = 200
    close = np.linspace(100, 300, n)
    df = pd.DataFrame({"open": close - 0.5, "high": close + 1, "low": close - 1, "close": close})
    a = ind.adx(df, 14)
    assert a["adx"].iloc[-1] > 50
    assert a["plus_di"].iloc[-1] > a["minus_di"].iloc[-1]


def test_bollinger_and_vwap():
    df = make_candles(300)
    bb = ind.bollinger(df["close"], 20, 2)
    valid = bb.dropna()
    assert (valid["bb_upper"] >= valid["bb_mid"]).all() and (valid["bb_lower"] <= valid["bb_mid"]).all()
    v = ind.session_vwap(df)
    assert v.notna().all()
    assert (v <= df["high"].cummax()).all()


def test_volume_profile_poc_at_heavy_level():
    high = np.array([101, 101, 101, 110, 105.0])
    low = np.array([99, 99, 99, 104, 100.0])
    vol = np.array([10, 10, 10, 1, 1.0])
    poc, vah, val = ind.volume_profile(high, low, vol, bins=20)
    assert 99 <= poc <= 101
    assert val <= poc <= vah


def test_efficiency_ratio_extremes():
    trend = pd.Series(np.arange(50, dtype=float))
    assert ind.efficiency_ratio(trend, 20).iloc[-1] == pytest.approx(1.0)
    chop = pd.Series([0.0, 1.0] * 25)
    assert ind.efficiency_ratio(chop, 20).iloc[-1] == pytest.approx(0.0)


def test_book_stats_and_impact():
    bids = [(100.0, 1.0), (99.95, 2.0), (99.0, 50.0)]
    asks = [(100.05, 0.5), (100.10, 1.0), (101.0, 3.0)]
    st = book_stats(bids, asks)
    assert st is not None
    assert st.spread_bps == pytest.approx(0.05 / 100.025 * 1e4)
    assert st.imbalance_10bps > 0  # more bid depth near mid
    avg, filled = market_impact_price(asks, 1.0)
    assert filled == pytest.approx(1.0)
    assert avg == pytest.approx((0.5 * 100.05 + 0.5 * 100.10))
    flow = trade_flow([{"time": 1000, "sz": "1", "side": "B"}, {"time": 1000, "sz": "3", "side": "A"}], 5000, 2000)
    assert flow["delta"] == pytest.approx(-2.0)
