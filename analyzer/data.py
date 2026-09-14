from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd

from analyzer.naver_live import (
    fetch_ohlcv_and_flow,
    fetch_realtime_index,
    fetch_realtime_quotes,
)
from analyzer.rules import action_comment, risk_plan
from analyzer.screener import (
    ScoreConfig,
    analyze_period,
    estimate_upside_probability,
    market_regime,
    pick_stocks,
    score_money_in_price_flat,
    screen_candidates,
)
from analyzer.themes import list_themes, stocks_for_theme


def _ymd(dt: datetime) -> str:
    return dt.strftime("%Y%m%d")


def period_range(months: int = 6) -> tuple[str, str]:
    end = datetime.now()
    start = end - timedelta(days=int(months * 31) + 14)
    return _ymd(start), _ymd(end)


def make_demo_ohlcv(n: int = 140, start_price: float = 10000.0, seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range(end=datetime.now(), periods=n)
    rets = rng.normal(0.0005, 0.015, size=n)
    closes = start_price * np.cumprod(1 + rets)
    closes[-20:] = closes[-21] * np.linspace(1.0, 1.01, 20)
    volumes = rng.integers(1_200_000, 3_000_000, size=n)
    df = pd.DataFrame(
        {
            "시가": closes * 0.995,
            "고가": closes * 1.01,
            "저가": closes * 0.99,
            "종가": closes,
            "거래량": volumes,
        },
        index=idx,
    )
    df["거래대금"] = df["종가"] * df["거래량"]
    return df


def make_demo_flow(n: int = 140, seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed + 7)
    idx = pd.bdate_range(end=datetime.now(), periods=n)
    foreign = rng.normal(0, 2e8, size=n)
    institution = rng.normal(0, 1.5e8, size=n)
    foreign[-8:] = np.abs(rng.normal(5e8, 5e7, size=8))
    institution[-8:] = np.abs(rng.normal(4e8, 5e7, size=8))
    individual = -(foreign + institution)
    return pd.DataFrame(
        {
            "외국인합계": foreign,
            "기관합계": institution,
            "개인": individual,
        },
        index=idx,
    )


@lru_cache(maxsize=256)
def fetch_ohlcv(ticker: str, start: str, end: str, demo: bool = False) -> pd.DataFrame:
    if demo:
        return make_demo_ohlcv(seed=sum(map(ord, ticker)) % 10_000)
    ohlcv, _ = fetch_ohlcv_and_flow(ticker, days=160)
    return ohlcv


@lru_cache(maxsize=256)
def fetch_investor_flow(ticker: str, start: str, end: str, demo: bool = False) -> pd.DataFrame:
    if demo:
        return make_demo_flow(seed=sum(map(ord, ticker)) % 10_000)
    _, flow = fetch_ohlcv_and_flow(ticker, days=160)
    return flow


def fetch_market_regime(demo: bool = False) -> dict:
    if demo:
        return {
            "kospi_change_pct": 0.4,
            "market_smart_money": 1.0,
            "regime": "중립",
            "kospi_price": 0.0,
            "market_status": "DEMO",
            "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "data_source": "demo",
        }
    try:
        idx = fetch_realtime_index("KOSPI")
        chg = float(idx.get("change_pct") or 0.0)
        smart_proxy = 1.0 if chg >= 0 else -1.0
        return {
            "kospi_change_pct": round(chg, 2),
            "kospi_price": float(idx.get("price") or 0.0),
            "market_smart_money": smart_proxy,
            "regime": market_regime(chg, smart_proxy),
            "market_status": str(idx.get("market_status") or ""),
            "as_of": str(idx.get("as_of") or ""),
            "data_source": "naver_realtime",
        }
    except Exception:  # noqa: BLE001
        return {
            "kospi_change_pct": 0.0,
            "kospi_price": 0.0,
            "market_smart_money": 0.0,
            "regime": "중립",
            "market_status": "UNKNOWN",
            "as_of": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "data_source": "fallback",
        }


def _forward_returns(ohlcv: pd.DataFrame, horizon: int = 5) -> list[float]:
    if ohlcv is None or len(ohlcv) < horizon + 30:
        return []
    closes = ohlcv["종가"].astype(float).tolist()
    out = []
    for i in range(20, len(closes) - horizon):
        base = closes[i]
        if base:
            out.append((closes[i + horizon] / base - 1) * 100)
    return out[-80:]


def build_stock_snapshot(
    ticker: str,
    name: str,
    theme: str,
    lookback_days: int = 20,
    demo: bool = False,
    regime: str = "중립",
    quote: dict | None = None,
) -> dict:
    if demo:
        ohlcv = make_demo_ohlcv(seed=sum(map(ord, ticker)) % 10_000)
        flow = make_demo_flow(seed=sum(map(ord, ticker)) % 10_000)
        source = "demo"
    else:
        ohlcv, flow = fetch_ohlcv_and_flow(ticker, days=160)
        source = "naver_live"

    score = score_money_in_price_flat(ohlcv, flow, ScoreConfig(lookback_days=lookback_days))
    three = analyze_period(ohlcv, flow, months=3)
    six = analyze_period(ohlcv, flow, months=6)
    latest = float(ohlcv["종가"].iloc[-1]) if not ohlcv.empty else 0.0
    if quote and quote.get("price"):
        latest = float(quote["price"])
    prob = estimate_upside_probability(_forward_returns(ohlcv), target_pct=5.0)
    row = {
        "ticker": ticker,
        "name": name,
        "theme": theme,
        **score,
        "latest_close": latest,
        "realtime_change_pct": float((quote or {}).get("change_pct") or 0.0),
        "realtime_volume": float((quote or {}).get("volume") or 0.0),
        "market_status": str((quote or {}).get("market_status") or ""),
        "local_traded_at": str((quote or {}).get("local_traded_at") or ""),
        "analysis_3m": three,
        "analysis_6m": six,
        "probability": prob,
        "risk": risk_plan(latest or 1.0, float(score["score"])),
        "is_theme_leader": False,
        "data_source": source,
    }
    # normalize liquidity key for rules
    row["liquidity_ok"] = bool(row.get("liquidity_ok", False))
    comment = action_comment(row, regime)
    row["action"] = comment["action"]
    row["reason"] = comment["reason"]
    return row


def scan_market(
    theme: str | None = None,
    lookback_days: int = 20,
    min_score: float = 40.0,
    leaders_only: bool = True,
    flat_only: bool = True,
    demo: bool = False,
    max_workers: int = 8,
) -> dict:
    regime_info = fetch_market_regime(demo=demo)
    regime = regime_info["regime"]
    universe = stocks_for_theme(theme)
    quotes: dict[str, dict] = {}
    if not demo:
        try:
            quotes = fetch_realtime_quotes([x["ticker"] for x in universe])
        except Exception:  # noqa: BLE001
            quotes = {}

    raw: list[dict] = []
    errors: list[dict] = []

    def _one(item: dict) -> dict:
        return build_stock_snapshot(
            item["ticker"],
            item["name"],
            item["theme"],
            lookback_days=lookback_days,
            demo=demo,
            regime=regime,
            quote=quotes.get(item["ticker"]),
        )

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_one, item): item for item in universe}
        for fut in as_completed(futures):
            item = futures[fut]
            try:
                raw.append(fut.result())
            except Exception as exc:  # noqa: BLE001
                errors.append({"ticker": item["ticker"], "name": item["name"], "error": str(exc)})

    candidates = screen_candidates(
        raw,
        min_score=min_score,
        leaders_only=leaders_only,
        flat_only=flat_only,
    )
    picks = pick_stocks(raw, top_n=5)
    refreshed_picks = []
    for row in picks:
        comment = action_comment(row, regime)
        item = dict(row)
        item["action"] = comment["action"]
        item["reason"] = comment["reason"]
        refreshed_picks.append(item)

    refreshed = []
    for row in candidates:
        comment = action_comment(row, regime)
        item = dict(row)
        item["action"] = comment["action"]
        item["reason"] = comment["reason"]
        refreshed.append(item)

    theme_scores: dict[str, float] = {}
    for row in raw:
        theme_scores[row["theme"]] = theme_scores.get(row["theme"], 0.0) + float(
            row.get("smart_money_net", 0)
        )
    theme_top = sorted(
        [{"theme": k, "smart_money_net": v} for k, v in theme_scores.items()],
        key=lambda x: x["smart_money_net"],
        reverse=True,
    )
    return {
        "regime": regime_info,
        "theme_top": theme_top,
        "all": raw,
        "picks": refreshed_picks,
        "candidates": refreshed,
        "errors": errors,
        "themes": list_themes(),
        "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "mode": "demo" if demo else "live",
    }
