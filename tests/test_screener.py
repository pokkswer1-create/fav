import pandas as pd

from analyzer.rules import action_comment, risk_plan
from analyzer.screener import (
    ScoreConfig,
    analyze_period,
    estimate_upside_probability,
    market_regime,
    pick_stocks,
    score_money_in_price_flat,
    screen_candidates,
    theme_leader_rank,
)


def _ohlcv(closes, volumes=None):
    n = len(closes)
    idx = pd.bdate_range("2025-01-02", periods=n)
    vol = volumes or [1_500_000] * n
    df = pd.DataFrame(
        {
            "시가": closes,
            "고가": [c * 1.01 for c in closes],
            "저가": [c * 0.99 for c in closes],
            "종가": closes,
            "거래량": vol,
        },
        index=idx,
    )
    df["거래대금"] = df["종가"] * df["거래량"]
    return df


def _flow(foreign, institution, individual=None):
    n = len(foreign)
    idx = pd.bdate_range("2025-01-02", periods=n)
    if individual is None:
        individual = [-(f + i) for f, i in zip(foreign, institution)]
    return pd.DataFrame(
        {"외국인합계": foreign, "기관합계": institution, "개인": individual},
        index=idx,
    )


def test_flat_money_setup_scores_high():
    ohlcv = _ohlcv([10000] * 20 + [10100] * 5)
    flow = _flow([0] * 15 + [5e8] * 10, [0] * 15 + [3e8] * 10)
    result = score_money_in_price_flat(
        ohlcv, flow, ScoreConfig(lookback_days=20, min_avg_value=1e9)
    )
    assert result["is_flat_setup"] is True
    assert result["score"] > 50
    assert result["consecutive_smart_days"] >= 2


def test_already_surged_not_flat_setup():
    ohlcv = _ohlcv([10000] * 10 + [13000] * 15)
    flow = _flow([0] * 10 + [5e8] * 15, [0] * 10 + [3e8] * 15)
    result = score_money_in_price_flat(
        ohlcv, flow, ScoreConfig(lookback_days=20, min_avg_value=1e9)
    )
    assert result["price_change_pct"] > 8
    assert result["is_flat_setup"] is False


def test_theme_leader_and_screen():
    rows = [
        {"ticker": "1", "theme": "HBM", "score": 80, "smart_money_net": 9e9, "is_flat_setup": True},
        {"ticker": "2", "theme": "HBM", "score": 70, "smart_money_net": 1e9, "is_flat_setup": True},
        {"ticker": "3", "theme": "HBM", "score": 90, "smart_money_net": 2e8, "is_flat_setup": True},
    ]
    ranked = theme_leader_rank(rows)
    leaders = [r for r in ranked if r["is_theme_leader"]]
    assert len(leaders) == 2
    out = screen_candidates(rows, min_score=60, leaders_only=True, flat_only=True)
    assert all(r["is_theme_leader"] for r in out)


def test_analyze_period_3m_6m():
    closes = [10000 + i * 5 for i in range(140)]
    ohlcv = _ohlcv(closes)
    flow = _flow([1e7] * 140, [5e6] * 140)
    three = analyze_period(ohlcv, flow, months=3)
    six = analyze_period(ohlcv, flow, months=6)
    assert three["trading_days"] <= six["trading_days"]
    assert len(three["cum_smart"]) == three["trading_days"]


def test_probability_and_rules():
    prob = estimate_upside_probability([1, 2, 6, 8, 10], target_pct=5)
    assert prob["sample_size"] == 5
    assert prob["prob_target_pct"] == 60.0
    assert market_regime(-3, -1) == "방어"
    plan = risk_plan(10000, 70)
    assert plan["stop_price"] < 10000
    comment = action_comment(
        {
            "liquidity_ok": True,
            "price_change_pct": 2,
            "is_flat_setup": True,
            "is_theme_leader": True,
            "score": 70,
            "smart_money_net": 1e9,
        },
        "중립",
    )
    assert comment["action"] == "매수관심"
    defense = action_comment(
        {
            "liquidity_ok": True,
            "price_change_pct": 2,
            "is_flat_setup": True,
            "is_theme_leader": True,
            "score": 70,
            "smart_money_net": 1e9,
        },
        "방어",
    )
    assert defense["action"] == "관망축소"


def test_pick_stocks_always_ranks_top_n():
    rows = [
        {
            "ticker": "1",
            "name": "A",
            "theme": "HBM",
            "score": 80,
            "smart_money_net": 9e9,
            "price_change_pct": 1,
            "consecutive_smart_days": 3,
            "is_flat_setup": True,
            "liquidity_ok": True,
            "probability": {"prob_target_pct": 55},
        },
        {
            "ticker": "2",
            "name": "B",
            "theme": "HBM",
            "score": 40,
            "smart_money_net": -1e9,
            "price_change_pct": 25,
            "consecutive_smart_days": 0,
            "is_flat_setup": False,
            "liquidity_ok": True,
            "probability": {"prob_target_pct": 10},
        },
        {
            "ticker": "3",
            "name": "C",
            "theme": "2차전지",
            "score": 65,
            "smart_money_net": 2e9,
            "price_change_pct": 3,
            "consecutive_smart_days": 2,
            "is_flat_setup": True,
            "liquidity_ok": True,
            "probability": {"prob_target_pct": 48},
        },
    ]
    picks = pick_stocks(rows, top_n=2)
    assert len(picks) == 2
    assert picks[0]["pick_rank"] == 1
    assert picks[0]["ticker"] == "1"
    assert "스마트머니" in picks[0]["pick_why"]
    assert picks[0]["pick_score"] >= picks[1]["pick_score"]
