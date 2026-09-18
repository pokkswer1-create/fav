"""테마 → 종목 시드 맵."""

from __future__ import annotations

THEMES: dict[str, list[dict[str, str]]] = {
    "HBM/반도체": [
        {"ticker": "000660", "name": "SK하이닉스"},
        {"ticker": "005930", "name": "삼성전자"},
        {"ticker": "042700", "name": "한미반도체"},
        {"ticker": "058470", "name": "리노공업"},
        {"ticker": "039030", "name": "이오테크닉스"},
        {"ticker": "403870", "name": "HPSP"},
        {"ticker": "089030", "name": "테크윙"},
    ],
    "2차전지": [
        {"ticker": "373220", "name": "LG에너지솔루션"},
        {"ticker": "006400", "name": "삼성SDI"},
        {"ticker": "247540", "name": "에코프로비엠"},
        {"ticker": "086520", "name": "에코프로"},
        {"ticker": "003670", "name": "포스코퓨처엠"},
        {"ticker": "051910", "name": "LG화학"},
        {"ticker": "450080", "name": "에코프로머티"},
    ],
    "AI/로봇": [
        {"ticker": "277810", "name": "레인보우로보틱스"},
        {"ticker": "108490", "name": "로보티즈"},
        {"ticker": "012450", "name": "한화에어로스페이스"},
        {"ticker": "034020", "name": "두산에너빌리티"},
        {"ticker": "402030", "name": "코난테크놀로지"},
        {"ticker": "086960", "name": "MDS테크"},
    ],
    "바이오": [
        {"ticker": "207940", "name": "삼성바이오로직스"},
        {"ticker": "068270", "name": "셀트리온"},
        {"ticker": "326030", "name": "SK바이오팜"},
        {"ticker": "196170", "name": "알테오젠"},
        {"ticker": "128940", "name": "한미약품"},
        {"ticker": "145020", "name": "휴젤"},
    ],
    "자동차/자율주행": [
        {"ticker": "005380", "name": "현대차"},
        {"ticker": "000270", "name": "기아"},
        {"ticker": "012330", "name": "현대모비스"},
        {"ticker": "204320", "name": "HL만도"},
        {"ticker": "011070", "name": "LG이노텍"},
        {"ticker": "018880", "name": "한온시스템"},
    ],
    "방산/우주": [
        {"ticker": "012450", "name": "한화에어로스페이스"},
        {"ticker": "047810", "name": "한국항공우주"},
        {"ticker": "079550", "name": "LIG넥스원"},
        {"ticker": "272210", "name": "한화시스템"},
        {"ticker": "064350", "name": "현대로템"},
        {"ticker": "103590", "name": "일진전기"},
    ],
    "원전/전력": [
        {"ticker": "034020", "name": "두산에너빌리티"},
        {"ticker": "267260", "name": "HD현대일렉트릭"},
        {"ticker": "010120", "name": "LS ELECTRIC"},
        {"ticker": "298040", "name": "효성중공업"},
        {"ticker": "001440", "name": "대한전선"},
        {"ticker": "103590", "name": "일진전기"},
    ],
    "조선/해운": [
        {"ticker": "329180", "name": "HD현대중공업"},
        {"ticker": "009540", "name": "HD한국조선해양"},
        {"ticker": "042660", "name": "한화오션"},
        {"ticker": "010140", "name": "삼성중공업"},
        {"ticker": "011200", "name": "HMM"},
        {"ticker": "028670", "name": "팬오션"},
    ],
    "인터넷/플랫폼": [
        {"ticker": "035420", "name": "NAVER"},
        {"ticker": "035720", "name": "카카오"},
        {"ticker": "259960", "name": "크래프톤"},
        {"ticker": "036570", "name": "엔씨소프트"},
        {"ticker": "251270", "name": "넷마블"},
        {"ticker": "263750", "name": "펄어비스"},
    ],
    "엔터/미디어": [
        {"ticker": "352820", "name": "하이브"},
        {"ticker": "041510", "name": "에스엠"},
        {"ticker": "122870", "name": "와이지엔터테인먼트"},
        {"ticker": "035900", "name": "JYP Ent."},
        {"ticker": "253450", "name": "스튜디오드래곤"},
        {"ticker": "376300", "name": "디어유"},
    ],
    "금융/증권": [
        {"ticker": "105560", "name": "KB금융"},
        {"ticker": "055550", "name": "신한지주"},
        {"ticker": "086790", "name": "하나금융지주"},
        {"ticker": "316140", "name": "우리금융지주"},
        {"ticker": "005940", "name": "NH투자증권"},
        {"ticker": "071050", "name": "한국금융지주"},
    ],
    "건설/인프라": [
        {"ticker": "000720", "name": "현대건설"},
        {"ticker": "028260", "name": "삼성물산"},
        {"ticker": "006360", "name": "GS건설"},
        {"ticker": "047040", "name": "대우건설"},
        {"ticker": "375500", "name": "DL이앤씨"},
        {"ticker": "294870", "name": "HDC현대산업개발"},
    ],
    "화장품/소비": [
        {"ticker": "090430", "name": "아모레퍼시픽"},
        {"ticker": "002790", "name": "아모레G"},
        {"ticker": "192820", "name": "코스맥스"},
        {"ticker": "161890", "name": "한국콜마"},
        {"ticker": "257720", "name": "실리콘투"},
        {"ticker": "278470", "name": "에이피알"},
    ],
    "석유화학": [
        {"ticker": "010950", "name": "S-Oil"},
        {"ticker": "096770", "name": "SK이노베이션"},
        {"ticker": "011170", "name": "롯데케미칼"},
        {"ticker": "009830", "name": "한화솔루션"},
        {"ticker": "051910", "name": "LG화학"},
        {"ticker": "014680", "name": "한솔케미칼"},
    ],
    "통신/IT": [
        {"ticker": "017670", "name": "SK텔레콤"},
        {"ticker": "030200", "name": "KT"},
        {"ticker": "032640", "name": "LG유플러스"},
        {"ticker": "018260", "name": "삼성에스디에스"},
        {"ticker": "053800", "name": "안랩"},
        {"ticker": "023590", "name": "다우기술"},
    ],
    "음식료": [
        {"ticker": "097950", "name": "CJ제일제당"},
        {"ticker": "271560", "name": "오리온"},
        {"ticker": "004370", "name": "농심"},
        {"ticker": "005180", "name": "빙그레"},
        {"ticker": "001680", "name": "대상"},
        {"ticker": "280360", "name": "롯데웰푸드"},
    ],
    "수소/신재생": [
        {"ticker": "336260", "name": "두산퓨얼셀"},
        {"ticker": "112610", "name": "씨에스윈드"},
        {"ticker": "100090", "name": "SK오션플랜트"},
        {"ticker": "018000", "name": "유니슨"},
        {"ticker": "009830", "name": "한화솔루션"},
        {"ticker": "083650", "name": "비에이치아이"},
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
