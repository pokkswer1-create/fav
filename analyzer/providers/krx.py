from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from analyzer.providers import config
from analyzer.providers.http_util import get_json, url_with_query


def _to_float(value: Any) -> float:
    try:
        return float(str(value).replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def parse_krx_price_payload(payload: dict[str, Any]) -> pd.DataFrame:
    body = ((payload.get("response") or {}).get("body") or {})
    items = (body.get("items") or {}).get("item") or []
    if isinstance(items, dict):
        items = [items]
    records = []
    for row in items:
        day = str(row.get("basDt") or "")
        if len(day) != 8:
            continue
        close = _to_float(row.get("clpr"))
        vol = _to_float(row.get("trqu"))
        records.append(
            {
                "날짜": datetime.strptime(day, "%Y%m%d"),
                "시가": _to_float(row.get("mkp")),
                "고가": _to_float(row.get("hipr")),
                "저가": _to_float(row.get("lopr")),
                "종가": close,
                "거래량": vol,
                "거래대금": close * vol,
            }
        )
    if not records:
        return pd.DataFrame()
    return pd.DataFrame(records).drop_duplicates("날짜").sort_values("날짜").set_index("날짜")


def fetch_daily_prices(ticker: str, days: int = 100) -> pd.DataFrame:
    if not config.krx_configured():
        return pd.DataFrame()
    end = datetime.now()
    start = end - timedelta(days=int(days * 1.8) + 5)
    url = url_with_query(
        "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo",
        {
            "serviceKey": config.krx_service_key(),
            "numOfRows": str(min(max(days, 1), 100)),
            "pageNo": "1",
            "resultType": "json",
            "likeSrtnCd": ticker,
            "beginBasDt": start.strftime("%Y%m%d"),
            "endBasDt": end.strftime("%Y%m%d"),
        },
    )
    payload = get_json(url)
    df = parse_krx_price_payload(payload if isinstance(payload, dict) else {})
    return df.tail(days) if not df.empty else df
