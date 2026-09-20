from __future__ import annotations

import time
from datetime import datetime
from typing import Any

import pandas as pd

from analyzer.providers import config
from analyzer.providers.http_util import get_json, url_with_query

_token_cache: dict[str, Any] = {"token": "", "expires_at": 0.0}


def _to_float(value: Any) -> float:
    try:
        return float(str(value).replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def get_access_token(force: bool = False) -> str:
    if not config.kis_configured():
        return ""
    now = time.time()
    if not force and _token_cache["token"] and now < float(_token_cache["expires_at"]) - 60:
        return str(_token_cache["token"])
    url = f"{config.kis_base_url()}/oauth2/tokenP"
    body = (
        '{"grant_type":"client_credentials",'
        f'"appkey":"{config.kis_app_key()}","appsecret":"{config.kis_app_secret()}"}}'
    ).encode("utf-8")
    payload = get_json(
        url,
        headers={"Content-Type": "application/json"},
        method="POST",
        body=body,
    )
    token = str(payload.get("access_token") or "")
    expires_in = float(payload.get("expires_in") or 86400)
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + expires_in
    return token


def _auth_headers(tr_id: str) -> dict[str, str]:
    return {
        "authorization": f"Bearer {get_access_token()}",
        "appkey": config.kis_app_key(),
        "appsecret": config.kis_app_secret(),
        "tr_id": tr_id,
        "custtype": "P",
    }


def parse_price_quote(payload: dict[str, Any]) -> dict[str, float | str]:
    out = payload.get("output") or {}
    return {
        "name": str(out.get("hts_kor_isnm") or ""),
        "price": _to_float(out.get("stck_prpr")),
        "change": _to_float(out.get("prdy_vrss")),
        "change_pct": _to_float(out.get("prdy_ctrt")),
        "volume": _to_float(out.get("acml_vol")),
        "market_status": "KIS",
        "local_traded_at": "",
        "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def parse_daily_price_payload(payload: dict[str, Any]) -> pd.DataFrame:
    rows = payload.get("output") or []
    records = []
    for row in rows:
        day = str(row.get("stck_bsop_date") or "")
        if len(day) != 8:
            continue
        close = _to_float(row.get("stck_clpr"))
        vol = _to_float(row.get("acml_vol"))
        records.append(
            {
                "날짜": datetime.strptime(day, "%Y%m%d"),
                "시가": _to_float(row.get("stck_oprc")),
                "고가": _to_float(row.get("stck_hgpr")),
                "저가": _to_float(row.get("stck_lwpr")),
                "종가": close,
                "거래량": vol,
                "거래대금": close * vol,
            }
        )
    if not records:
        return pd.DataFrame()
    return pd.DataFrame(records).drop_duplicates("날짜").sort_values("날짜").set_index("날짜")


def fetch_quote(ticker: str) -> dict[str, float | str]:
    if not config.kis_configured():
        return {}
    url = url_with_query(
        f"{config.kis_base_url()}/uapi/domestic-stock/v1/quotations/inquire-price",
        {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
    )
    payload = get_json(url, headers=_auth_headers("FHKST01010100"))
    if str(payload.get("rt_cd")) != "0":
        return {}
    return parse_price_quote(payload)


def fetch_quotes(tickers: list[str]) -> dict[str, dict[str, float | str]]:
    out: dict[str, dict[str, float | str]] = {}
    for ticker in tickers:
        try:
            q = fetch_quote(ticker)
            if q and q.get("price"):
                out[ticker] = q
        except Exception:  # noqa: BLE001
            continue
    return out


def fetch_daily_prices(ticker: str, days: int = 100) -> pd.DataFrame:
    if not config.kis_configured():
        return pd.DataFrame()
    url = url_with_query(
        f"{config.kis_base_url()}/uapi/domestic-stock/v1/quotations/inquire-daily-price",
        {
            "FID_COND_MRKT_DIV_CODE": "J",
            "FID_INPUT_ISCD": ticker,
            "FID_ORG_ADJ_PRC": "0",
            "FID_PERIOD_DIV_CODE": "D",
        },
    )
    payload = get_json(url, headers=_auth_headers("FHKST01010400"))
    if str(payload.get("rt_cd")) != "0":
        return pd.DataFrame()
    df = parse_daily_price_payload(payload)
    return df.tail(days) if not df.empty else df
