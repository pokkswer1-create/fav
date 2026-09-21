import pandas as pd
import pytest

from analyzer.signals import (
    backtest_setup_expectancy,
    beginner_explain,
    detect_breakout,
    simulate_trade_detail,
    simulate_trade_path,
)


def _ohlcv(closes, volumes=None, highs=None):
    n = len(closes)
    idx = pd.bdate_range("2024-01-02", periods=n)
    vol = volumes or [1_000_000] * n
    hi = highs or [c * 1.01 for c in closes]
    df = pd.DataFrame(
        {
            "시가": closes,
            "고가": hi,
            "저가": [c * 0.99 for c in closes],
            "종가": closes,
            "거래량": vol,
        },
        index=idx,
    )
    df["거래대금"] = df["종가"] * df["거래량"]
    return df


def _flow(n, smart_tail=8, smart_val=5e8):
    idx = pd.bdate_range("2024-01-02", periods=n)
    foreign = [0.0] * n
    inst = [0.0] * n
    for i in range(n - smart_tail, n):
        foreign[i] = smart_val
        inst[i] = smart_val * 0.6
    individual = [-(f + i) for f, i in zip(foreign, inst)]
    return pd.DataFrame(
        {"외국인합계": foreign, "기관합계": inst, "개인": individual},
        index=idx,
    )


def test_detect_breakout_true_with_volume():
    closes = [10000] * 20 + [10100]
    highs = [10050] * 20 + [10200]
    volumes = [1_000_000] * 20 + [2_000_000]
    ohlcv = _ohlcv(closes, volumes=volumes, highs=highs)
    # last close must exceed prior highs; adjust last close
    ohlcv.iloc[-1, ohlcv.columns.get_loc("종가")] = 10100
    ohlcv.iloc[:-1, ohlcv.columns.get_loc("고가")] = 10000
    out = detect_breakout(ohlcv, lookback=20, volume_mult=1.2)
    assert out["is_breakout"] is True
    assert out["volume_ok"] is True


def test_detect_breakout_false_without_volume():
    closes = [10000] * 20 + [10100]
    ohlcv = _ohlcv(closes, volumes=[1_000_000] * 20 + [100_000])
    ohlcv.iloc[:-1, ohlcv.columns.get_loc("고가")] = 10000
    ohlcv.iloc[-1, ohlcv.columns.get_loc("종가")] = 10100
    out = detect_breakout(ohlcv, lookback=20, volume_mult=1.2)
    assert out["is_breakout"] is False


def test_simulate_trade_hits_take():
    closes = [100, 101, 102, 109, 110]
    ret = simulate_trade_path(closes, entry_i=0, stop_pct=6, take_pct=8, max_days=10)
    assert ret == pytest.approx(8.0)
    detail = simulate_trade_detail(closes, entry_i=0, stop_pct=6, take_pct=8, max_days=10)
    assert detail["exit"] == "take"
    assert detail["days"] == 3
    assert detail["return_pct"] == pytest.approx(8.0)


def test_simulate_trade_hits_stop():
    closes = [100, 99, 93, 90]
    ret = simulate_trade_path(closes, entry_i=0, stop_pct=6, take_pct=8, max_days=10)
    assert ret == pytest.approx(-6.0)
    detail = simulate_trade_detail(closes, entry_i=0, stop_pct=6, take_pct=8, max_days=10)
    assert detail["exit"] == "stop"
    assert detail["days"] == 2


def test_backtest_expectancy_has_samples():
    # flat then rise patterns repeated
    closes = []
    for _ in range(8):
        closes.extend([10000] * 15 + [10050] * 5 + [10800] * 5)
    ohlcv = _ohlcv(closes)
    flow = _flow(len(closes), smart_tail=len(closes), smart_val=2e8)
    # inject smart money in flat windows roughly
    exp = backtest_setup_expectancy(ohlcv, flow, lookback=20, min_samples=1)
    assert exp["sample_size"] >= 1
    assert "expectancy_pct" in exp
    assert "win_rate_pct" in exp
    assert "up_prob_pct" in exp
    assert "hit_take_prob_pct" in exp
    assert "median_days_to_take" in exp
    assert "likely_within_days" in exp
    assert exp["horizon_days"] == 10
    assert exp["up_prob_pct"] == exp["win_rate_pct"]


def test_beginner_explain_is_plain_korean():
    text = beginner_explain(
        {
            "name": "한미반도체",
            "theme": "HBM/반도체",
            "smart_money_net": 1e10,
            "price_change_pct": 2.0,
            "is_theme_leader": True,
            "is_flat_setup": True,
            "is_breakout": False,
            "action": "관망",
            "expectancy": {
                "sample_size": 12,
                "win_rate_pct": 55,
                "up_prob_pct": 55,
                "expectancy_pct": 1.2,
                "hit_take_prob_pct": 40,
                "median_days_to_take": 4,
                "likely_within_days": 4,
                "horizon_days": 10,
            },
            "risk": {"stop_pct": 6, "take1_pct": 8},
        },
        "중립",
    )
    assert "큰손" in text["summary"]
    assert "초보 가이드" in text["guide"]
    assert "미래 보장은 아니에요" in text["backtest"]
    assert "상승 확률" in text["backtest"]
    assert "거래일" in text["backtest"]
