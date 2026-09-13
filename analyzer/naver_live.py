"""네이버 증권 실시간/일별/수급 API 클라이언트."""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any

import pandas as pd

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://stock.naver.com/",
    "Accept": "application/json,text/plain,*/*",
}


def _get_json(url: str, timeout: int = 20) -> Any:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", "ignore")
    return json.loads(text)


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).replace(",", "").replace("+", "").replace("%", "").strip()
    if not s or s == "-":
        return 0.0
    # e.g. 268,876천주
    s = re.sub(r"[^\d.\-]", "", s)
    if not s or s in {".", "-", "-."}:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def fetch_realtime_quotes(tickers: list[str]) -> dict[str, dict[str, float | str]]:
    if not tickers:
        return {}
    codes = ",".join(tickers)
    url = f"https://polling.finance.naver.com/api/realtime/domestic/v2/stock?itemCodes={codes}"
    payload = _get_json(url)
    out: dict[str, dict[str, float | str]] = {}
    for row in payload.get("datas", []):
        krx = row.get("krx") or {}
        code = str(row.get("itemCode") or "")
        out[code] = {
            "name": str(row.get("itemName") or ""),
            "price": _to_float(krx.get("currentPrice")),
            "change": _to_float(krx.get("changePrice")),
            "change_pct": _to_float(krx.get("changeRate")),
            "volume": _to_float(krx.get("tradingVolume")),
            "value": _to_float(krx.get("tradingValue")),
            "market_status": str(krx.get("marketState") or ""),
            "local_traded_at": str(krx.get("localTradedAt") or ""),
            "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
    return out


def fetch_realtime_index(index_code: str = "KOSPI") -> dict[str, float | str]:
    url = f"https://polling.finance.naver.com/api/realtime/domestic/index/{index_code}"
    payload = _get_json(url)
    row = (payload.get("datas") or [{}])[0]
    return {
        "price": _to_float(row.get("closePrice")),
        "change_pct": _to_float(row.get("fluctuationsRatio")),
        "market_status": str(row.get("marketStatus") or ""),
        "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def fetch_investor_trend(ticker: str, days: int = 140) -> pd.DataFrame:
    page_size = min(max(days, 20), 120)
    url = (
        "https://stock.naver.com/api/domestic/detail/"
        f"{ticker}/trend?tradeType=KRX&startIdx=0&pageSize={page_size}"
    )
    rows = _get_json(url)
    if not isinstance(rows, list) or not rows:
        return pd.DataFrame()

    records = []
    for row in rows:
        close = _to_float(row.get("closePrice"))
        foreign_q = _to_float(row.get("foreignerPureBuyQuant"))
        organ_q = _to_float(row.get("organPureBuyQuant"))
        indiv_q = _to_float(row.get("individualPureBuyQuant"))
        biz = str(row.get("bizdate") or "")
        if len(biz) != 8:
            continue
        dt = datetime.strptime(biz, "%Y%m%d")
        records.append(
            {
                "날짜": dt,
                "종가": close,
                "외국인합계": foreign_q * close,
                "기관합계": organ_q * close,
                "개인": indiv_q * close,
                "외국인수량": foreign_q,
                "기관수량": organ_q,
                "개인수량": indiv_q,
            }
        )
    if not records:
        return pd.DataFrame()
    return pd.DataFrame(records).sort_values("날짜").set_index("날짜")


def fetch_daily_prices(ticker: str, days: int = 140) -> pd.DataFrame:
    items: list[dict] = []
    cursor = None
    safety = 0
    while len(items) < days and safety < 8:
        safety += 1
        size = min(100, max(20, days - len(items) + 5))
        params: dict[str, str] = {"size": str(size)}
        if cursor:
            params["cursor"] = str(cursor)
        url = (
            "https://stock.naver.com/api/stockSecurity/items/v2/domestic/"
            f"{ticker}/daily-prices?{urllib.parse.urlencode(params)}"
        )
        payload = _get_json(url)
        batch = payload.get("items") or []
        if not batch:
            break
        items.extend(batch)
        if not payload.get("hasNext"):
            break
        cursor = payload.get("cursor")
        if not cursor:
            break

    if not items:
        return _fetch_sise_json(ticker, days)

    records = []
    for row in items:
        day = str(row.get("tradingDateKst") or "")[:10]
        if not day:
            continue
        records.append(
            {
                "날짜": datetime.strptime(day, "%Y-%m-%d"),
                "시가": _to_float(row.get("openingPrice")),
                "고가": _to_float(row.get("highPrice")),
                "저가": _to_float(row.get("lowPrice")),
                "종가": _to_float(row.get("closingPrice")),
                "거래량": _to_float(row.get("tradingVolume")),
                "거래대금": _to_float(row.get("tradingValue")),
            }
        )
    df = pd.DataFrame(records).drop_duplicates("날짜").sort_values("날짜").set_index("날짜")
    return df.tail(days)


def _fetch_sise_json(ticker: str, days: int = 140) -> pd.DataFrame:
    end = datetime.now().strftime("%Y%m%d")
    start_dt = datetime.fromordinal(datetime.now().toordinal() - int(days * 1.8))
    start = start_dt.strftime("%Y%m%d")
    url = (
        "https://api.finance.naver.com/siseJson.naver?"
        f"symbol={ticker}&requestType=1&startTime={start}&endTime={end}&timeframe=day"
    )
    req = urllib.request.Request(url, headers=_HEADERS)
    text = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
    rows = re.findall(
        r'\["(\d{8})",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)',
        text,
    )
    records = []
    for day, o, h, low, c, v in rows:
        close = float(c)
        vol = float(v)
        records.append(
            {
                "날짜": datetime.strptime(day, "%Y%m%d"),
                "시가": float(o),
                "고가": float(h),
                "저가": float(low),
                "종가": close,
                "거래량": vol,
                "거래대금": close * vol,
            }
        )
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame(records).drop_duplicates("날짜").sort_values("날짜").set_index("날짜")
    return df.tail(days)


def fetch_ohlcv_and_flow(ticker: str, days: int = 140) -> tuple[pd.DataFrame, pd.DataFrame]:
    ohlcv = fetch_daily_prices(ticker, days=days)
    flow_raw = fetch_investor_trend(ticker, days=days)
    if ohlcv.empty and not flow_raw.empty:
        ohlcv = pd.DataFrame(
            {
                "시가": flow_raw["종가"],
                "고가": flow_raw["종가"],
                "저가": flow_raw["종가"],
                "종가": flow_raw["종가"],
                "거래량": 0.0,
                "거래대금": 0.0,
            },
            index=flow_raw.index,
        )
    if flow_raw.empty:
        return ohlcv, pd.DataFrame()
    flow = flow_raw[["외국인합계", "기관합계", "개인"]].copy()
    if not ohlcv.empty:
        flow = flow.reindex(ohlcv.index).fillna(0.0)
    return ohlcv, flow
