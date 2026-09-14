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
    """종목 품질 + 시장 상태를 반영한 액션. 방어장이어도 우량 셋업은 골라준다."""
    if not row.get("liquidity_ok", False):
        return {"action": "회피", "reason": "거래대금 부족으로 체결/슬리피지 위험이 큽니다."}
    if float(row.get("price_change_pct", 0)) > 15:
        return {"action": "회피", "reason": "이미 급등해 추격 매수 구간입니다."}

    strong = (
        row.get("is_flat_setup")
        and row.get("is_theme_leader")
        and float(row.get("score", 0)) >= 55
    )
    soft = float(row.get("smart_money_net", 0)) > 0 and float(row.get("price_change_pct", 100)) <= 8

    if regime == "방어":
        if strong:
            return {
                "action": "관망축소",
                "reason": "데이터상 우량 셋업이지만 시장이 방어 구간이라 비중을 줄이거나 분할만 고려합니다.",
            }
        if soft or float(row.get("pick_score", 0) or row.get("score", 0)) >= 40:
            return {
                "action": "관심목록",
                "reason": "상대적으로 수급이 나은 편이나 방어장에서는 매수보다 관찰 우선입니다.",
            }
        return {"action": "회피", "reason": "시장 방어 + 종목 셋업 부족으로 신규 진입을 미룹니다."}

    if strong:
        return {
            "action": "매수관심",
            "reason": "테마 대장 + 스마트머니 유입 + 가격 미반영 조건이 겹칩니다.",
        }
    if soft:
        return {
            "action": "관망",
            "reason": "수급은 들어오나 추가 확인(돌파/연속수급)이 필요합니다.",
        }
    if float(row.get("pick_score", 0) or 0) >= 45 or float(row.get("score", 0)) >= 45:
        return {
            "action": "관심목록",
            "reason": "스캔 상대점수 상위이나 핵심 셋업은 완전하지 않습니다.",
        }
    return {"action": "회피", "reason": "핵심 셋업 조건이 부족합니다."}
