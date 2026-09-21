from analyzer.tiers import (
    build_tiered_picks,
    classify_horizon,
    is_buy_eligible,
    is_watch_eligible,
)


def _row(**kwargs):
    base = {
        "ticker": "000000",
        "name": "테스트",
        "theme": "KOSPI",
        "score": 50,
        "smart_money_net": 1e9,
        "is_flat_setup": True,
        "is_breakout": False,
        "is_near_breakout": False,
        "action": "돌파대기",
        "expectancy": {
            "sample_size": 12,
            "up_prob_pct": 60,
            "hit_take_prob_pct": 40,
            "expectancy_pct": 2.5,
            "likely_within_days": 3,
        },
    }
    base.update(kwargs)
    if "expectancy" in kwargs:
        exp = dict(base["expectancy"])
        exp.update(kwargs["expectancy"])
        base["expectancy"] = exp
    return base


def test_classify_horizon_short_vs_long():
    assert classify_horizon(_row(expectancy={"likely_within_days": 3})) == "short"
    assert classify_horizon(_row(expectancy={"likely_within_days": 5})) == "short"
    assert classify_horizon(_row(expectancy={"likely_within_days": 6})) == "long"


def test_buy_gate_requires_metrics_and_blocks_defense():
    good = _row(action="매수관심", is_breakout=True)
    assert is_buy_eligible(good, regime="중립") is True
    assert is_buy_eligible(good, regime="방어") is False
    weak = _row(action="매수관심", is_breakout=True, expectancy={"sample_size": 3})
    assert is_buy_eligible(weak, regime="중립") is False


def test_watch_includes_flat_setup():
    assert is_watch_eligible(_row(action="회피", smart_money_net=0, is_flat_setup=True))
    assert not is_watch_eligible(
        _row(
            action="회피",
            smart_money_net=0,
            is_flat_setup=False,
            is_near_breakout=False,
            is_breakout=False,
        )
    )


def test_build_tiered_picks_splits_and_ranks_by_expectancy():
    rows = [
        _row(
            ticker="1",
            name="빠른매수",
            action="매수관심",
            is_breakout=True,
            expectancy={
                "sample_size": 12,
                "up_prob_pct": 70,
                "hit_take_prob_pct": 40,
                "expectancy_pct": 3.0,
                "likely_within_days": 2,
            },
        ),
        _row(
            ticker="2",
            name="느린매수",
            action="분할관심",
            is_breakout=True,
            expectancy={
                "sample_size": 15,
                "up_prob_pct": 60,
                "hit_take_prob_pct": 35,
                "expectancy_pct": 5.0,
                "likely_within_days": 8,
            },
        ),
        _row(
            ticker="3",
            name="단기대기",
            action="돌파대기",
            expectancy={
                "sample_size": 4,
                "up_prob_pct": 50,
                "hit_take_prob_pct": 20,
                "expectancy_pct": 1.0,
                "likely_within_days": 4,
            },
        ),
        _row(
            ticker="4",
            name="낮은기대매수",
            action="매수관심",
            is_breakout=True,
            expectancy={
                "sample_size": 12,
                "up_prob_pct": 60,
                "hit_take_prob_pct": 35,
                "expectancy_pct": 1.0,
                "likely_within_days": 2,
            },
        ),
    ]
    out = build_tiered_picks(rows, regime="중립", top_n=5)
    assert [r["name"] for r in out["short_buy"]] == ["빠른매수", "낮은기대매수"]
    assert [r["name"] for r in out["long_buy"]] == ["느린매수"]
    assert out["short_watch"][0]["name"] == "단기대기"
    assert out["buy_count"] == 3
    assert out["defense_buys_blocked"] is False

    blocked = build_tiered_picks(rows, regime="방어", top_n=5)
    assert blocked["buy_count"] == 0
    assert blocked["defense_buys_blocked"] is True
    assert blocked["short_watch"] or blocked["long_watch"]
