from __future__ import annotations

from datetime import datetime
from typing import Any

import pandas as pd

from analyzer.providers.http_util import get_json


def parse_history_payload(payload: dict[str, Any]) -> pd.DataFrame:
    rows = payload.get("rows") or []
    records = []
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        day = str(row[0])
        if len(day) == 8:
            dt = datetime.strptime(day, "%Y%m%d")
        else:
            continue
        close = float(row[1] or 0)
        vol = float(row[2] or 0) if len(row) > 2 else 0.0
        records.append(
            {
                "날짜": dt,
                "시가": close,
                "고가": close,
                "저가": close,
                "종가": close,
                "거래량": vol,
                "거래대금": close * vol,
            }
        )
    if not records:
        return pd.DataFrame()
    return pd.DataFrame(records).drop_duplicates("날짜").sort_values("날짜").set_index("날짜")


def parse_disclosure_items(
    payload: dict[str, Any], tickers: set[str] | None = None
) -> dict[str, list[dict[str, str]]]:
    items = payload.get("items") or payload.get("top_disclosures") or []
    out: dict[str, list[dict[str, str]]] = {}
    for item in items:
        code = str(item.get("code") or "").zfill(6)
        if tickers is not None and code not in tickers:
            continue
        row = {
            "ticker": code,
            "title": str(item.get("title") or item.get("report_nm") or ""),
            "label": str(item.get("label") or item.get("cat") or "공시"),
            "fact": str(item.get("fact") or ""),
            "date": str(item.get("rcept_dt") or item.get("date") or ""),
            "url": str(item.get("url") or item.get("dart_url") or ""),
            "source": "aikstock",
        }
        out.setdefault(code, []).append(row)
    return out


def fetch_daily_history(ticker: str, days: int = 140) -> pd.DataFrame:
    url = f"https://aikstockdata.com/data/public/s/{ticker}_history.json"
    payload = get_json(url)
    df = parse_history_payload(payload if isinstance(payload, dict) else {})
    return df.tail(days) if not df.empty else df


def fetch_recent_disclosures_for_tickers(tickers: list[str]) -> dict[str, list[dict[str, str]]]:
    wanted = {str(t).zfill(6) for t in tickers}
    url = "https://aikstockdata.com/data/public/disclosures_top100.json"
    payload = get_json(url)
    if not isinstance(payload, dict):
        return {}
    return parse_disclosure_items(payload, wanted)
