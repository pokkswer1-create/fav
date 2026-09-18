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
    """초보도 구분되게: 매수관심 / 분할관심 / 돌파대기 / 관심목록 / 회피."""
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

    score = float(row.get("score", 0) or 0)
    pick_score = float(row.get("pick_score", 0) or score)
    smart = float(row.get("smart_money_net", 0) or 0)
    price_chg = float(row.get("price_change_pct", 100) or 100)
    consec = int(row.get("consecutive_smart_days", 0) or 0)
    leader = bool(row.get("is_theme_leader"))
    flat = bool(row.get("is_flat_setup"))
    breakout = bool(row.get("is_breakout"))
    near = bool(row.get("is_near_breakout"))

    setup_ready = flat and leader and score >= 50
    money_ok = smart > 0 and price_chg <= 12
    scale_in_ready = (
        leader
        and money_ok
        and pick_score >= 55
        and (near or consec >= 2 or score >= 45)
    )
    already_up = 12 < price_chg <= 15 and smart > 0 and pick_score >= 50

    if already_up and not breakout:
        return {
            "action": "추격주의",
            "reason": "큰손은 들어왔지만 이미 꽤 올랐어요. 따라잡기보다 눌림이나 재돌파를 보는 게 낫습니다.",
        }

    if regime == "방어":
        if (setup_ready or scale_in_ready) and (breakout or near):
            return {
                "action": "소액관심",
                "reason": "종목 조건은 상위권이에요. 다만 시장이 약하니 사더라도 소액·손절 필수예요.",
            }
        if setup_ready or scale_in_ready or pick_score >= 50:
            return {
                "action": "돌파대기",
                "reason": "추천 상위권이에요. 시장이 약하니 지금은 사지 말고, 고점 돌파+거래량 나오면 소액만 검토하세요.",
            }
        return {
            "action": "관심목록",
            "reason": "리스트에만 두고, 시장이 회복되는지 먼저 보세요.",
        }

    if setup_ready and breakout:
        return {
            "action": "매수관심",
            "reason": "큰손 유입 + 가격 대기 + 테마 대장 + 고점 돌파가 겹쳤어요. 손절을 지키며 관심 매수 후보예요.",
        }
    if scale_in_ready and (breakout or near):
        return {
            "action": "분할관심",
            "reason": "상위 추천이고 돌파가 나왔거나 바로 앞이에요. 한 번에 몰빵 말고 나눠 사는 방식만 검토하세요.",
        }
    if setup_ready or scale_in_ready:
        return {
            "action": "돌파대기",
            "reason": "돈은 들어오고 추천 상위예요. 최근 고점을 뚫는 순간을 노리면 됩니다.",
        }
    if money_ok and pick_score >= 45:
        return {
            "action": "관심목록",
            "reason": "상대적으로 괜찮아 리스트에 넣어둡니다. 돌파·연속 수급을 확인한 뒤 결정하세요.",
        }
    return {
        "action": "회피",
        "reason": "지금은 사기에 조건이 부족해요.",
    }
