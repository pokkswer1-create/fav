"""테마 → 종목 시드 맵."""

from __future__ import annotations

THEMES: dict[str, list[dict[str, str]]] = {
    "HBM/반도체": [
        {"ticker": "000660", "name": "SK하이닉스"},
        {"ticker": "005930", "name": "삼성전자"},
        {"ticker": "042700", "name": "한미반도체"},
        {"ticker": "058470", "name": "리노공업"},
        {"ticker": "039030", "name": "이오테크닉스"},
    ],
    "2차전지": [
        {"ticker": "373220", "name": "LG에너지솔루션"},
        {"ticker": "006400", "name": "삼성SDI"},
        {"ticker": "247540", "name": "에코프로비엠"},
        {"ticker": "086520", "name": "에코프로"},
        {"ticker": "003670", "name": "포스코퓨처엠"},
    ],
    "AI/로봇": [
        {"ticker": "277810", "name": "레인보우로보틱스"},
        {"ticker": "108490", "name": "로보티즈"},
        {"ticker": "012450", "name": "한화에어로스페이스"},
        {"ticker": "034020", "name": "두산에너빌리티"},
    ],
    "바이오": [
        {"ticker": "207940", "name": "삼성바이오로직스"},
        {"ticker": "068270", "name": "셀트리온"},
        {"ticker": "326030", "name": "SK바이오팜"},
        {"ticker": "196170", "name": "알테오젠"},
    ],
    "자동차/자율주행": [
        {"ticker": "005380", "name": "현대차"},
        {"ticker": "000270", "name": "기아"},
        {"ticker": "012330", "name": "현대모비스"},
        {"ticker": "204320", "name": "HL만도"},
    ],
}


def list_themes() -> list[str]:
    return list(THEMES.keys())


def stocks_for_theme(theme: str | None = None) -> list[dict[str, str]]:
    if theme and theme not in {"전체", "ALL"}:
        return [{"theme": theme, **s} for s in THEMES.get(theme, [])]
    rows: list[dict[str, str]] = []
    for theme_name, stocks in THEMES.items():
        for s in stocks:
            rows.append({"theme": theme_name, **s})
    return rows
