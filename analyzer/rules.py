from __future__ import annotations

from typing import Any


def risk_plan(entry_price: float, score: float) -> dict[str, float | int]:
    stop_pct = 6.0
    take1_pct = 8.0
    take2_pct = 15.0
    time_stop_days = 10
    base_risk = 1.0
    sized_risk = base_risk * (1.0 + min(max(score - 50.0, 0.0) / 100.0, 0.5))
    return {
        "stop_pct": stop_pct,
        "take1_pct": take1_pct,
        "take2_pct": take2_pct,
        "time_stop_days": time_stop_days,
        "account_risk_pct": round(sized_risk, 2),
        "stop_price": round(entry_price * (1 - stop_pct / 100), 2),
        "take1_price": round(entry_price * (1 + take1_pct / 100), 2),
        "take2_price": round(entry_price * (1 + take2_pct / 100), 2),
    }


def action_comment(row: dict[str, Any], regime: str) -> dict[str, str]:
    """종목 품질 + 돌파 확인 + 시장 상태. 매수관심은 돌파 확인 후에만."""
    if not row.get("liquidity_ok", False):
        return {
            "action": "회피",
            "reason": "거래가 너무 적어 원하는 가격에 사기/팔기 어려울 수 있어요.",
        }
    if float(row.get("price_change_pct", 0)) > 15:
        return {
            "action": "회피",
            "reason": "이미 많이 올라 지금 따라 사면 고점에 잡을 위험이 커요.",
        }

    setup_ready = (
        row.get("is_flat_setup")
        and row.get("is_theme_leader")
        and float(row.get("score", 0)) >= 55
    )
    soft = float(row.get("smart_money_net", 0)) > 0 and float(row.get("price_change_pct", 100)) <= 8
    breakout = bool(row.get("is_breakout"))
    exp = row.get("expectancy") or {}
    expectancy_ok = float(exp.get("expectancy_pct", 0) or 0) >= 0 and int(exp.get("sample_size", 0) or 0) >= 5

    if regime == "방어":
        if setup_ready and breakout:
            return {
                "action": "관망축소",
                "reason": "돌파까지 나왔지만 시장이 약해요. 사더라도 아주 소액만, 아니면 관망하세요.",
            }
        if setup_ready or soft or float(row.get("pick_score", 0) or row.get("score", 0)) >= 40:
            return {
                "action": "관심목록",
                "reason": "종목은 괜찮아 보여도 시장이 약해서, 지금은 리스트에만 두고 지켜보세요.",
            }
        return {
            "action": "회피",
            "reason": "시장도 약하고 종목 조건도 약해서 지금은 사지 않는 게 좋아요.",
        }

    # 매수관심: 셋업 + 돌파(+가능하면 기대값 플러스)
    if setup_ready and breakout:
        if expectancy_ok or int(exp.get("sample_size", 0) or 0) < 5:
            return {
                "action": "매수관심",
                "reason": "큰손 유입 + 가격 대기 + 테마 대장 + 고점 돌파가 겹쳤어요. 손절을 꼭 지키세요.",
            }
    if setup_ready and not breakout:
        return {
            "action": "관망",
            "reason": "조건은 좋은데 아직 고점을 뚫지 못했어요. 돌파 나오면 매수 후보로 올릴 수 있어요.",
        }
    if soft:
        return {
            "action": "관망",
            "reason": "돈은 들어오는데 확신이 덜해요. 며칠 더 수급·돌파를 확인하세요.",
        }
    if float(row.get("pick_score", 0) or 0) >= 45 or float(row.get("score", 0)) >= 45:
        return {
            "action": "관심목록",
            "reason": "상대적으로 괜찮아 보여 리스트에 넣어둡니다. 바로 사라는 뜻은 아니에요.",
        }
    return {
        "action": "회피",
        "reason": "지금은 사기에 조건이 부족해요.",
    }
