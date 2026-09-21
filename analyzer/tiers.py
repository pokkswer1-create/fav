"""단기/장기 · 매수/대기 티어 분류."""

from __future__ import annotations

from typing import Any


SHORT_WITHIN_DAYS = 5
BUY_MIN_SAMPLES = 10
BUY_MIN_UP_PROB = 55.0
BUY_MIN_HIT_TAKE = 30.0
BUY_ACTIONS = {"매수관심", "분할관심"}


def classify_horizon(row: dict[str, Any], short_within: int = SHORT_WITHIN_DAYS) -> str:
    exp = row.get("expectancy") or {}
    within = int(exp.get("likely_within_days") or exp.get("horizon_days") or 99)
    return "short" if within <= int(short_within) else "long"


def expectancy_rank_key(row: dict[str, Any]) -> tuple[float, float, float]:
    exp = row.get("expectancy") or {}
    expect = float(exp.get("expectancy_pct") or 0)
    hit = float(exp.get("hit_take_prob_pct") or 0)
    up = float(exp.get("up_prob_pct", exp.get("win_rate_pct", 0)) or 0)
    return (expect, hit, up)


def is_buy_eligible(row: dict[str, Any], regime: str = "중립") -> bool:
    """실매수 게이트: 방어장 OFF, 돌파형 액션, 샘플/승률/기대값."""
    if regime == "방어":
        return False
    action = str(row.get("action") or "")
    if action not in BUY_ACTIONS:
        return False
    exp = row.get("expectancy") or {}
    samples = int(exp.get("sample_size") or 0)
    up = float(exp.get("up_prob_pct", exp.get("win_rate_pct", 0)) or 0)
    hit = float(exp.get("hit_take_prob_pct") or 0)
    expect = float(exp.get("expectancy_pct") or 0)
    if samples < BUY_MIN_SAMPLES:
        return False
    if up < BUY_MIN_UP_PROB:
        return False
    if hit < BUY_MIN_HIT_TAKE:
        return False
    if expect <= 0:
        return False
    return True


def is_watch_eligible(row: dict[str, Any]) -> bool:
    """대기: 큰손 유입·정체·돌파근접 등 관심 유지."""
    if float(row.get("smart_money_net") or 0) > 0:
        return True
    if row.get("is_flat_setup") or row.get("is_near_breakout") or row.get("is_breakout"):
        return True
    action = str(row.get("action") or "")
    return action in {"돌파대기", "분할관심", "매수관심", "관심목록", "소액관심"}


def build_tiered_picks(
    rows: list[dict[str, Any]],
    *,
    regime: str = "중립",
    top_n: int = 5,
    short_within: int = SHORT_WITHIN_DAYS,
) -> dict[str, Any]:
    """단기/장기 × 매수/대기 티어로 분류 후 기대수익 순 정렬."""
    short_buy: list[dict[str, Any]] = []
    short_watch: list[dict[str, Any]] = []
    long_buy: list[dict[str, Any]] = []
    long_watch: list[dict[str, Any]] = []

    for row in rows:
        item = dict(row)
        horizon = classify_horizon(item, short_within=short_within)
        item["horizon"] = horizon
        item["horizon_label"] = "단기" if horizon == "short" else "장기"
        buy_ok = is_buy_eligible(item, regime=regime)
        watch_ok = is_watch_eligible(item)
        if buy_ok:
            item["trade_tier"] = "buy"
            item["trade_tier_label"] = "오늘매수"
            (short_buy if horizon == "short" else long_buy).append(item)
        elif watch_ok:
            item["trade_tier"] = "watch"
            item["trade_tier_label"] = "대기"
            (short_watch if horizon == "short" else long_watch).append(item)

    def _rank(items: list[dict[str, Any]], label_prefix: str) -> list[dict[str, Any]]:
        ranked = sorted(items, key=expectancy_rank_key, reverse=True)
        out: list[dict[str, Any]] = []
        for i, row in enumerate(ranked[: max(top_n, 0)], start=1):
            item = dict(row)
            item["pick_rank"] = i
            item["pick_label"] = f"{label_prefix} {i}위"
            item["pick_score"] = round(
                expectancy_rank_key(item)[0] * 10
                + expectancy_rank_key(item)[1] * 0.1
                + float(item.get("score") or 0) * 0.01,
                2,
            )
            out.append(item)
        return out

    short_buy_r = _rank(short_buy, "단기매수")
    short_watch_r = _rank(short_watch, "단기대기")
    long_buy_r = _rank(long_buy, "장기매수")
    long_watch_r = _rank(long_watch, "장기대기")

    # backward-compatible flat picks: buy first, then watch; short before long within tier
    picks: list[dict[str, Any]] = []
    for bucket in (short_buy_r, long_buy_r, short_watch_r, long_watch_r):
        for row in bucket:
            if len(picks) >= top_n:
                break
            picks.append(row)
        if len(picks) >= top_n:
            break
    # re-number overall picks 1..n for old UI
    for i, row in enumerate(picks, start=1):
        row["pick_rank"] = i
        if not row.get("pick_label"):
            row["pick_label"] = f"추천 {i}위"

    return {
        "short_buy": short_buy_r,
        "short_watch": short_watch_r,
        "long_buy": long_buy_r,
        "long_watch": long_watch_r,
        "picks": picks,
        "buy_count": len(short_buy_r) + len(long_buy_r),
        "watch_count": len(short_watch_r) + len(long_watch_r),
        "defense_buys_blocked": regime == "방어",
        "rules": {
            "short_within_days": short_within,
            "buy_min_samples": BUY_MIN_SAMPLES,
            "buy_min_up_prob": BUY_MIN_UP_PROB,
            "buy_min_hit_take": BUY_MIN_HIT_TAKE,
        },
    }
