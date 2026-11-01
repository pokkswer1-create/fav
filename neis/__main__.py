from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from .client import NeisClient, NeisError
from .oma import OMA_ELEMENTARY
from .schedule import summarize_grade_day


def _ymd(value: str | None) -> str:
    if value:
        return value.replace("-", "")
    today = date.today()
    return today.strftime("%Y%m%d")


def cmd_dismiss(args: argparse.Namespace) -> int:
    client = NeisClient()
    school = OMA_ELEMENTARY
    ymd = _ymd(args.date)
    grades = args.grades or [1, 2]
    payload = []
    for grade in grades:
        rows = client.els_timetable_by_grade(
            office_code=school.office_code,
            school_code=school.school_code,
            ymd=ymd,
            grade=grade,
        )
        if not rows:
            payload.append({"grade": grade, "ymd": ymd, "error": "no timetable"})
            continue
        summary = summarize_grade_day(rows, grade=grade, ymd=ymd)
        payload.append(summary.as_dict())

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"{school.name} {ymd}")
        for item in payload:
            if "error" in item:
                print(f"- {item['grade']}학년: 시간표 없음")
                continue
            lunch = f" (급식 후 약 {item['after_lunch']})" if item.get("after_lunch") else ""
            print(
                f"- {item['grade']}학년: {item['last_period']}교시 종료 {item['class_end']}{lunch}"
            )
            print(f"  {item['note']}")
    return 0


def cmd_meal(args: argparse.Namespace) -> int:
    client = NeisClient()
    school = OMA_ELEMENTARY
    ymd = _ymd(args.date)
    rows = client.meal(
        office_code=school.office_code,
        school_code=school.school_code,
        ymd=ymd,
    )
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    if not rows:
        print(f"{school.name} {ymd}: 급식 없음")
        return 0
    for row in rows:
        dishes = str(row.get("DDISH_NM", "")).replace("<br/>", " / ")
        print(f"{row.get('MMEAL_SC_NM', '급식')} ({row.get('CAL_INFO', '')})")
        print(dishes)
    return 0


def cmd_ping(args: argparse.Namespace) -> int:
    client = NeisClient()
    rows = client.school_info(
        school_name=OMA_ELEMENTARY.name,
        office_code=OMA_ELEMENTARY.office_code,
    )
    if not rows:
        print("NEIS ping failed: school not found")
        return 1
    row = rows[0]
    key_state = "set" if client.api_key else "unset (sample/keyless mode)"
    print(
        "NEIS OK:",
        row["SCHUL_NM"],
        row["ATPT_OFCDC_SC_CODE"],
        row["SD_SCHUL_CODE"],
        f"| KEY={key_state}",
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m neis", description="오마초 NEIS 조회")
    sub = parser.add_subparsers(dest="command", required=True)

    ping = sub.add_parser("ping", help="학교 정보로 연결 확인")
    ping.set_defaults(func=cmd_ping)

    dismiss = sub.add_parser("dismiss", help="학년별 하교(마지막 교시) 확인")
    dismiss.add_argument("--date", help="YYYYMMDD or YYYY-MM-DD (default: today)")
    dismiss.add_argument(
        "--grades",
        type=int,
        nargs="+",
        help="조회할 학년 (기본: 1 2)",
    )
    dismiss.add_argument("--json", action="store_true")
    dismiss.set_defaults(func=cmd_dismiss)

    meal = sub.add_parser("meal", help="급식 메뉴 확인")
    meal.add_argument("--date", help="YYYYMMDD or YYYY-MM-DD (default: today)")
    meal.add_argument("--json", action="store_true")
    meal.set_defaults(func=cmd_meal)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except NeisError as exc:
        print(f"NEIS error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
