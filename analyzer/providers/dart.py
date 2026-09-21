from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from analyzer.providers import config
from analyzer.providers.http_util import get_json, url_with_query


def normalize_disclosure(row: dict[str, Any]) -> dict[str, str]:
    rcept_no = str(row.get("rcept_no") or "")
    title = str(row.get("report_nm") or row.get("title") or "")
    return {
        "ticker": str(row.get("stock_code") or "").zfill(6) if row.get("stock_code") else "",
        "title": title,
        "label": "공시",
        "fact": title,
        "date": str(row.get("rcept_dt") or row.get("date") or ""),
        "url": f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}" if rcept_no else "",
        "source": "dart",
    }


def parse_dart_list_payload(
    payload: dict[str, Any], stock_code: str | None = None
) -> list[dict[str, Any]]:
    if str(payload.get("status")) not in {"000", "0", ""}:
        # 013 = no data
        if str(payload.get("status")) == "013":
            return []
        if payload.get("list") is None and payload.get("status") not in (None, "000"):
            return []
    rows = payload.get("list") or []
    if stock_code:
        code = str(stock_code).zfill(6)
        rows = [r for r in rows if str(r.get("stock_code") or "").zfill(6) == code]
    return rows


def fetch_disclosures_for_stock(stock_code: str, days: int = 14, page_count: int = 20) -> list[dict[str, str]]:
    if not config.dart_configured():
        return []
    end = datetime.now()
    start = end - timedelta(days=max(days, 1))
    url = url_with_query(
        "https://opendart.fss.or.kr/api/list.json",
        {
            "crtfc_key": config.dart_api_key(),
            "bgn_de": start.strftime("%Y%m%d"),
            "end_de": end.strftime("%Y%m%d"),
            "page_no": "1",
            "page_count": str(min(page_count, 100)),
            "sort": "date",
            "sort_mth": "desc",
        },
    )
    payload = get_json(url)
    rows = parse_dart_list_payload(payload if isinstance(payload, dict) else {}, stock_code=stock_code)
    return [normalize_disclosure(r) for r in rows[:5]]
