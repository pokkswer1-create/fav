from __future__ import annotations

from datetime import datetime, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd

from analyzer.rules import action_comment, risk_plan
from analyzer.screener import (
    ScoreConfig,
    analyze_period,
    estimate_upside_probability,
    market_regime,
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
            "기관합계": institution,
            "기타법인": np.zeros(n),
            "개인": individual,
            "외국인합계": foreign,
            "전체": np.zeros(n),
        },
        index=idx,
    )


@lru_cache(maxsize=512)
def fetch_ohlcv(ticker: str, start: str, end: str, demo: bool = False) -> pd.DataFrame:
    if demo:
        return make_demo_ohlcv(seed=sum(map(ord, ticker)) % 10_000)
    from pykrx import stock

    df = stock.get_market_ohlcv_by_date(start, end, ticker)
    if df is None or df.empty:
        return pd.DataFrame()
    out = df.copy()
    if "거래대금" not in out.columns:
        out["거래대금"] = out["종가"] * out["거래량"]
    return out


@lru_cache(maxsize=512)
def fetch_investor_flow(ticker: str, start: str, end: str, demo: bool = False) -> pd.DataFrame:
    if demo:
        return make_demo_flow(seed=sum(map(ord, ticker)) % 10_000)
    from pykrx import stock

    df = stock.get_market_trading_value_by_date(start, end, ticker)
    if df is None or df.empty:
        return pd.DataFrame()
    return df


def fetch_market_regime(demo: bool = False) -> dict:
    if demo:
        return {"kospi_change_pct": 0.4, "market_smart_money": 1.0, "regime": "중립"}
    start, end = period_range(1)
    try:
        from pykrx import stock

        ohlcv = stock.get_index_ohlcv_by_date(start, end, "1001")
        if ohlcv is None or len(ohlcv) < 2:
            return {"kospi_change_pct": 0.0, "market_smart_money": 0.0, "regime": "중립"}
        chg = (float(ohlcv["종가"].iloc[-1]) / float(ohlcv["종가"].iloc[-2]) - 1) * 100
        smart_proxy = 1.0 if chg >= 0 else -1.0
        return {
            "kospi_change_pct": round(chg, 2),
            "market_smart_money": smart_proxy,
            "regime": market_regime(chg, smart_proxy),
        }
    except Exception:  # noqa: BLE001
        return {"kospi_change_pct": 0.0, "market_smart_money": 0.0, "regime": "중립"}


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
) -> dict:
    start, end = period_range(6)
    ohlcv = fetch_ohlcv(ticker, start, end, demo=demo)
    flow = fetch_investor_flow(ticker, start, end, demo=demo)
    score = score_money_in_price_flat(ohlcv, flow, ScoreConfig(lookback_days=lookback_days))
    three = analyze_period(ohlcv, flow, months=3)
    six = analyze_period(ohlcv, flow, months=6)
    latest = float(ohlcv["종가"].iloc[-1]) if not ohlcv.empty else 0.0
    prob = estimate_upside_probability(_forward_returns(ohlcv), target_pct=5.0)
    row = {
        "ticker": ticker,
        "name": name,
        "theme": theme,
        **score,
        "latest_close": latest,
        "analysis_3m": three,
        "analysis_6m": six,
        "probability": prob,
        "risk": risk_plan(latest or 1.0, float(score["score"])),
        "is_theme_leader": False,
    }
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
) -> dict:
    regime_info = fetch_market_regime(demo=demo)
    regime = regime_info["regime"]
    raw: list[dict] = []
    errors: list[dict] = []
    for item in stocks_for_theme(theme):
        try:
            raw.append(
                build_stock_snapshot(
                    item["ticker"],
                    item["name"],
                    item["theme"],
                    lookback_days=lookback_days,
                    demo=demo,
                    regime=regime,
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append({"ticker": item["ticker"], "name": item["name"], "error": str(exc)})

    candidates = screen_candidates(
        raw,
        min_score=min_score,
        leaders_only=leaders_only,
        flat_only=flat_only,
    )
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
        "candidates": refreshed,
        "errors": errors,
        "themes": list_themes(),
    }
