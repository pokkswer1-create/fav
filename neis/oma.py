from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SchoolRef:
    name: str
    office_code: str
    school_code: str
    kind: str = "초등학교"


OMA_ELEMENTARY = SchoolRef(
    name="오마초등학교",
    office_code="J10",
    school_code="7621080",
    kind="초등학교",
)

# 2026학년도 오마초 시정표
PERIOD_END = {
    1: "09:40",
    2: "10:30",
    3: "11:20",
    4: "12:10",
    5: "13:40",
    6: "14:30",
}

LUNCH_END = "13:00"
CLEANUP_END = "14:40"


def period_end_time(period: int) -> str:
    try:
        return PERIOD_END[period]
    except KeyError as exc:
        raise ValueError(f"unsupported period: {period}") from exc


def dismissal_for_periods(last_period: int) -> dict[str, str | int]:
    class_end = period_end_time(last_period)
    result: dict[str, str | int] = {
        "last_period": last_period,
        "class_end": class_end,
    }
    if last_period <= 4:
        result["after_lunch"] = LUNCH_END
        result["note"] = "4교시 이하면 급식 후 하교는 약 13:00"
    elif last_period >= 6:
        result["cleanup_end"] = CLEANUP_END
        result["note"] = "6교시 날은 청소·정리 14:40까지"
    else:
        result["note"] = "5교시 종료 후 하교"
    return result
