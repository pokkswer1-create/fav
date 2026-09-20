from __future__ import annotations

from typing import Any

import pandas as pd

from analyzer.providers import config
from analyzer.providers import aikstock as aik
from analyzer.providers import dart as dart_api
from analyzer.providers import kis as kis_api
from analyzer.providers import krx as krx_api
from analyzer.naver_live import (
    fetch_daily_prices as naver_fetch_daily_prices,
    fetch_realtime_quotes as naver_fetch_realtime_quotes,
)


def kis_fetch_daily_prices(ticker: str, days: int = 100) -> pd.DataFrame:
    if not config.kis_configured():
        return pd.DataFrame()
    try:
        return kis_api.fetch_daily_prices(ticker, days=days)
    except Exception:  # noqa: BLE001
        return pd.DataFrame()


def aik_fetch_daily_history(ticker: str, days: int = 140) -> pd.DataFrame:
    try:
        return aik.fetch_daily_history(ticker, days=days)
    except Exception:  # noqa: BLE001
        return pd.DataFrame()


def krx_fetch_daily_prices(ticker: str, days: int = 100) -> pd.DataFrame:
    if not config.krx_configured():
        return pd.DataFrame()
    try:
        return krx_api.fetch_daily_prices(ticker, days=days)
    except Exception:  # noqa: BLE001
        return pd.DataFrame()


def kis_fetch_quotes(tickers: list[str]) -> dict[str, dict[str, float | str]]:
    if not config.kis_configured():
        return {}
    try:
        return kis_api.fetch_quotes(tickers)
    except Exception:  # noqa: BLE001
        return {}


def fetch_daily_prices_cascaded(ticker: str, days: int = 140) -> tuple[pd.DataFrame, str]:
    """Naver → KIS → aikstockdata → KRX."""
    try:
        df = naver_fetch_daily_prices(ticker, days=days)
        if df is not None and not df.empty:
            return df, "naver"
    except Exception:  # noqa: BLE001
        pass

    df = kis_fetch_daily_prices(ticker, days=days)
    if df is not None and not df.empty:
        return df, "kis"

    df = aik_fetch_daily_history(ticker, days=days)
    if df is not None and not df.empty:
        return df, "aikstock"

    df = krx_fetch_daily_prices(ticker, days=days)
    if df is not None and not df.empty:
        return df, "krx"

    return pd.DataFrame(), "none"


def fetch_quotes_cascaded(tickers: list[str]) -> tuple[dict[str, dict[str, float | str]], str]:
    """Naver realtime → KIS inquire-price."""
    try:
        quotes = naver_fetch_realtime_quotes(tickers)
        if quotes:
            return quotes, "naver"
    except Exception:  # noqa: BLE001
        quotes = {}

    if config.kis_configured():
        kis_q = kis_fetch_quotes(tickers)
        if kis_q:
            return kis_q, "kis"
    return quotes or {}, "none" if not quotes else "naver"


def fetch_disclosures_cascaded(tickers: list[str]) -> tuple[dict[str, list[dict[str, str]]], str]:
    """aikstockdata (no key) first; enrich with DART when key present."""
    out: dict[str, list[dict[str, str]]] = {}
    source = "none"
    try:
        out = aik.fetch_recent_disclosures_for_tickers(tickers)
        if out:
            source = "aikstock"
    except Exception:  # noqa: BLE001
        out = {}

    if config.dart_configured():
        for ticker in tickers:
            try:
                rows = dart_api.fetch_disclosures_for_stock(ticker, days=21)
            except Exception:  # noqa: BLE001
                rows = []
            if not rows:
                continue
            merged = list(out.get(ticker) or [])
            seen = {r.get("url") or r.get("title") for r in merged}
            for row in rows:
                key = row.get("url") or row.get("title")
                if key in seen:
                    continue
                merged.append(row)
                seen.add(key)
            out[ticker] = merged[:5]
            source = "dart+aikstock" if source == "aikstock" else "dart"
    return out, source


def provider_status() -> dict[str, Any]:
    return {
        "naver": True,
        "aikstock": True,
        "kis": config.kis_configured(),
        "dart": config.dart_configured(),
        "krx": config.krx_configured(),
        "kis_mock": config.kis_use_mock() if config.kis_configured() else False,
        "citation": "Source: aikstockdata (when used) — FSS DART / FSC open data",
    }
