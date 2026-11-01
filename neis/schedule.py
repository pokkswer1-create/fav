from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from .oma import dismissal_for_periods


@dataclass(frozen=True)
class GradeDaySummary:
    ymd: str
    grade: int
    last_period: int
    class_end: str
    after_lunch: str | None
    by_class: dict[str, list[tuple[int, str]]]
    note: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "ymd": self.ymd,
            "grade": self.grade,
            "last_period": self.last_period,
            "class_end": self.class_end,
            "after_lunch": self.after_lunch,
            "note": self.note,
            "by_class": {
                class_name: [{"period": period, "subject": subject} for period, subject in lessons]
                for class_name, lessons in self.by_class.items()
            },
        }


def summarize_grade_day(rows: list[dict[str, Any]], *, grade: int, ymd: str) -> GradeDaySummary:
    by_class: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for row in rows:
        class_name = str(row.get("CLASS_NM") or "")
        period = int(row["PERIO"])
        subject = str(row.get("ITRT_CNTNT") or "")
        by_class[class_name].append((period, subject))

    ordered: dict[str, list[tuple[int, str]]] = {}
    for class_name in sorted(by_class, key=lambda value: int(value) if value.isdigit() else value):
        ordered[class_name] = sorted(by_class[class_name], key=lambda item: item[0])

    if not ordered:
        raise ValueError(f"no timetable rows for grade {grade} on {ymd}")

    last_periods = [max(period for period, _ in lessons) for lessons in ordered.values()]
    last_period = max(last_periods)
    dismissal = dismissal_for_periods(last_period)
    return GradeDaySummary(
        ymd=ymd,
        grade=grade,
        last_period=last_period,
        class_end=str(dismissal["class_end"]),
        after_lunch=str(dismissal["after_lunch"]) if "after_lunch" in dismissal else None,
        by_class=ordered,
        note=str(dismissal["note"]),
    )
