from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd

from analyzer.naver_live import (
    fetch_ohlcv_and_flow,
    fetch_realtime_index,
)
from analyzer.providers.market import (
    fetch_daily_prices_cascaded,
    fetch_disclosures_cascaded,
    fetch_quotes_cascaded,
    provider_status,
)
from analyzer.rules import action_comment, risk_plan
from analyzer.screener import (
    ScoreConfig,
    analyze_period,
    estimate_upside_probability,
    market_regime,
    score_money_in_price_flat,
    screen_candidates,
)
from analyzer.signals import backtest_setup_expectancy, beginner_explain, detect_breakout
from analyzer.themes import full_market_size, list_themes, stocks_for_theme
from analyzer.tiers import build_tiered_picks


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
    ohlcv, _source = fetch_daily_prices_cascaded(ticker, days=160)
    return ohlcv


@lru_cache(maxsize=256)
def fetch_investor_flow(ticker: str, start: str, end: str, demo: bool = False) -> pd.DataFrame:
    if demo:
        return make_demo_flow(seed=sum(map(ord, ticker)) % 10_000)
    _, flow = fetch_ohlcv_and_flow(ticker, days=160)
    return flow


def _ohlcv_and_flow_live(ticker: str, days: int = 160) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    ohlcv, source = fetch_daily_prices_cascaded(ticker, days=days)
    try:
        _, flow = fetch_ohlcv_and_flow(ticker, days=days)
    except Exception:  # noqa: BLE001
        flow = pd.DataFrame()
    if ohlcv.empty and not flow.empty and "종가" in flow.columns:
        ohlcv = pd.DataFrame(
            {
                "시가": flow["종가"],
                "고가": flow["종가"],
                "저가": flow["종가"],
                "종가": flow["종가"],
                "거래량": 0.0,
                "거래대금": 0.0,
            },
            index=flow.index,
        )
        source = f"{source}+naver_flow" if source != "none" else "naver_flow"
    if not flow.empty and not ohlcv.empty:
        flow = flow.reindex(ohlcv.index).fillna(0.0)
    return ohlcv, flow, source


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
        # 방향만 참고. 소폭 하락을 방어장으로 만들지는 않음.
        if chg >= 0.3:
            smart_proxy = 1.0
        elif chg <= -0.3:
            smart_proxy = -1.0
        else:
            smart_proxy = 0.0
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
    disclosures: list[dict] | None = None,
) -> dict:
    if demo:
        ohlcv = make_demo_ohlcv(seed=sum(map(ord, ticker)) % 10_000)
        flow = make_demo_flow(seed=sum(map(ord, ticker)) % 10_000)
        source = "demo"
    else:
        ohlcv, flow, source = _ohlcv_and_flow_live(ticker, days=160)

    score = score_money_in_price_flat(ohlcv, flow, ScoreConfig(lookback_days=lookback_days))
    three = analyze_period(ohlcv, flow, months=3)
    six = analyze_period(ohlcv, flow, months=6)
    latest = float(ohlcv["종가"].iloc[-1]) if not ohlcv.empty else 0.0
    if quote and quote.get("price"):
        latest = float(quote["price"])
    prob = estimate_upside_probability(_forward_returns(ohlcv), target_pct=5.0)
    breakout = detect_breakout(ohlcv, lookback=lookback_days)
    risk = risk_plan(latest or 1.0, float(score["score"]))
    expectancy = backtest_setup_expectancy(
        ohlcv,
        flow,
        lookback=lookback_days,
        stop_pct=float(risk["stop_pct"]),
        take_pct=float(risk["take1_pct"]),
        max_days=int(risk["time_stop_days"]),
        min_samples=1,
    )
    disc = list(disclosures or [])
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
        "risk": risk,
        "is_breakout": bool(breakout.get("is_breakout")),
        "is_near_breakout": bool(breakout.get("is_near_breakout")),
        "breakout": breakout,
        "expectancy": expectancy,
        "is_theme_leader": False,
        "data_source": source,
        "disclosures": disc,
    }
    # normalize liquidity key for rules
    row["liquidity_ok"] = bool(row.get("liquidity_ok", False))
    comment = action_comment(row, regime)
    row["action"] = comment["action"]
    row["reason"] = comment["reason"]
    explain = beginner_explain(row, regime)
    row["beginner_summary"] = explain["summary"]
    row["beginner_backtest"] = explain["backtest"]
    row["beginner_guide"] = explain["guide"]
    row["beginner_disclosure"] = explain.get("disclosure") or ""
    row["beginner_full"] = explain["full"]
    return row


def scan_market(
    theme: str | None = None,
    lookback_days: int = 20,
    min_score: float = 40.0,
    leaders_only: bool = True,
    flat_only: bool = True,
    demo: bool = False,
    max_workers: int = 12,
    scan_limit: int = 150,
    full_market: bool = True,
) -> dict:
    regime_info = fetch_market_regime(demo=demo)
    regime = regime_info["regime"]
    use_full = bool(full_market) and (theme is None or theme in {"전체", "ALL"})
    universe = stocks_for_theme(
        theme,
        full_market=use_full,
        scan_limit=scan_limit,
    )
    market_total = full_market_size() if use_full else len(universe)
    unique_items: list[dict] = []
    seen: set[str] = set()
    for item in universe:
        if item["ticker"] in seen:
            continue
        seen.add(item["ticker"])
        unique_items.append(item)
    quotes: dict[str, dict] = {}
    quote_source = "demo" if demo else "none"
    disclosures: dict[str, list] = {}
    disclosure_source = "none"
    if not demo:
        try:
            quotes, quote_source = fetch_quotes_cascaded([x["ticker"] for x in unique_items])
        except Exception:  # noqa: BLE001
            quotes, quote_source = {}, "none"
        try:
            disclosures, disclosure_source = fetch_disclosures_cascaded(
                [x["ticker"] for x in unique_items]
            )
        except Exception:  # noqa: BLE001
            disclosures, disclosure_source = {}, "none"

    snap_by_ticker: dict[str, dict] = {}
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
            disclosures=disclosures.get(item["ticker"]) or [],
        )

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_one, item): item for item in unique_items}
        for fut in as_completed(futures):
            item = futures[fut]
            try:
                snap_by_ticker[item["ticker"]] = fut.result()
            except Exception as exc:  # noqa: BLE001
                errors.append({"ticker": item["ticker"], "name": item["name"], "error": str(exc)})

    raw: list[dict] = []
    for item in universe:
        snap = snap_by_ticker.get(item["ticker"])
        if not snap:
            continue
        cloned = dict(snap)
        cloned["theme"] = item["theme"]
        cloned["name"] = item["name"]
        raw.append(cloned)
    candidates = screen_candidates(
        raw,
        min_score=min_score,
        leaders_only=leaders_only,
        flat_only=flat_only,
    )
    # 액션을 먼저 확정한 뒤 단기/장기·매수/대기 티어 분류
    actioned: list[dict] = []
    for row in raw:
        comment = action_comment(row, regime)
        item = dict(row)
        item["action"] = comment["action"]
        item["reason"] = comment["reason"]
        explain = beginner_explain(item, regime)
        item["beginner_summary"] = explain["summary"]
        item["beginner_backtest"] = explain["backtest"]
        item["beginner_guide"] = explain["guide"]
        item["beginner_disclosure"] = explain.get("disclosure") or ""
        item["beginner_full"] = explain["full"]
        actioned.append(item)

    tiers = build_tiered_picks(actioned, regime=regime, top_n=5)
    refreshed_picks = tiers["picks"]

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
        "short_buy": tiers["short_buy"],
        "short_watch": tiers["short_watch"],
        "long_buy": tiers["long_buy"],
        "long_watch": tiers["long_watch"],
        "buy_count": tiers["buy_count"],
        "watch_count": tiers["watch_count"],
        "defense_buys_blocked": tiers["defense_buys_blocked"],
        "tier_rules": tiers["rules"],
        "candidates": refreshed,
        "errors": errors,
        "themes": list_themes(),
        "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "mode": "demo" if demo else "live",
        "providers": provider_status(),
        "quote_source": quote_source,
        "disclosure_source": disclosure_source,
        "universe_size": len(unique_items),
        "market_total": market_total,
        "scan_limit": scan_limit if use_full else len(unique_items),
        "full_market": use_full,
    }
