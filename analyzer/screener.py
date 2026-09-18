from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class ScoreConfig:
    lookback_days: int = 20
    max_price_change_pct: float = 8.0
    min_smart_money: float = 1e8
    min_avg_value: float = 3e9
    min_consecutive_smart_days: int = 2
    money_weight: float = 1.0
    flat_weight: float = 1.2
    consecutive_weight: float = 0.4


def _tail(df: pd.DataFrame, days: int) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    return df.tail(days)


def _pick_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    return None


def consecutive_smart_buy_days(flow: pd.DataFrame, lookback: int = 20) -> int:
    money = _tail(flow, lookback)
    if money.empty:
        return 0
    foreign = _pick_col(money, ["외국인합계", "외국인", "외국인합계"])
    inst = _pick_col(money, ["기관합계", "기관", "기관합계"])
    if not foreign or not inst:
        return 0
    smart = money[foreign].fillna(0) + money[inst].fillna(0)
    streak = 0
    for val in reversed(smart.tolist()):
        if val > 0:
            streak += 1
        else:
            break
    return streak


def score_money_in_price_flat(
    ohlcv: pd.DataFrame,
    flow: pd.DataFrame,
    config: ScoreConfig | None = None,
) -> dict[str, Any]:
    cfg = config or ScoreConfig()
    price = _tail(ohlcv, cfg.lookback_days)
    money = _tail(flow, cfg.lookback_days)
    empty = {
        "score": 0.0,
        "price_change_pct": 0.0,
        "smart_money_net": 0.0,
        "foreign_net": 0.0,
        "institution_net": 0.0,
        "individual_net": 0.0,
        "avg_trading_value": 0.0,
        "consecutive_smart_days": 0,
        "liquidity_ok": False,
        "is_flat_setup": False,
    }
    if price.empty or money.empty or len(price) < 5 or "종가" not in price.columns:
        return empty

    start = float(price["종가"].iloc[0])
    end = float(price["종가"].iloc[-1])
    price_change_pct = ((end / start) - 1.0) * 100.0 if start else 0.0

    foreign = _pick_col(money, ["외국인합계", "외국인"])
    inst = _pick_col(money, ["기관합계", "기관"])
    indiv = _pick_col(money, ["개인"])
    foreign_net = float(money[foreign].sum()) if foreign else 0.0
    institution_net = float(money[inst].sum()) if inst else 0.0
    individual_net = float(money[indiv].sum()) if indiv else 0.0
    smart_money_net = foreign_net + institution_net

    if "거래대금" in price.columns:
        avg_trading_value = float(price["거래대금"].mean())
    elif "거래량" in price.columns:
        avg_trading_value = float((price["종가"] * price["거래량"]).mean())
    else:
        avg_trading_value = 0.0

    consecutive = consecutive_smart_buy_days(flow, cfg.lookback_days)
    liquidity_ok = avg_trading_value >= cfg.min_avg_value

    money_score = min(max(smart_money_net / 1e8, 0.0), 100.0)
    if price_change_pct <= 0:
        flat_score = 100.0
    elif price_change_pct <= cfg.max_price_change_pct:
        flat_score = 100.0 * (1.0 - price_change_pct / cfg.max_price_change_pct)
    else:
        flat_score = max(0.0, 40.0 - (price_change_pct - cfg.max_price_change_pct) * 3.0)
    consecutive_score = min(consecutive * 20.0, 100.0)

    if smart_money_net < cfg.min_smart_money or not liquidity_ok:
        score = money_score * 0.15
    else:
        denom = cfg.money_weight + cfg.flat_weight + cfg.consecutive_weight
        score = (
            cfg.money_weight * money_score
            + cfg.flat_weight * flat_score
            + cfg.consecutive_weight * consecutive_score
        ) / denom

    is_flat_setup = (
        smart_money_net >= cfg.min_smart_money
        and price_change_pct <= cfg.max_price_change_pct
        and liquidity_ok
        and consecutive >= cfg.min_consecutive_smart_days
    )
    return {
        "score": round(float(score), 2),
        "price_change_pct": round(float(price_change_pct), 2),
        "smart_money_net": float(smart_money_net),
        "foreign_net": float(foreign_net),
        "institution_net": float(institution_net),
        "individual_net": float(individual_net),
        "avg_trading_value": float(avg_trading_value),
        "consecutive_smart_days": int(consecutive),
        "liquidity_ok": bool(liquidity_ok),
        "is_flat_setup": bool(is_flat_setup),
    }


def analyze_period(ohlcv: pd.DataFrame, flow: pd.DataFrame, months: int = 3) -> dict[str, Any]:
    days = int(months * 21)
    price = _tail(ohlcv, days)
    money = _tail(flow, days)
    if price.empty or "종가" not in price.columns:
        return {
            "months": months,
            "trading_days": 0,
            "price_change_pct": 0.0,
            "foreign_net": 0.0,
            "institution_net": 0.0,
            "individual_net": 0.0,
            "smart_money_net": 0.0,
            "high": 0.0,
            "low": 0.0,
            "avg_volume": 0.0,
            "dates": [],
            "closes": [],
            "cum_foreign": [],
            "cum_institution": [],
            "cum_individual": [],
            "cum_smart": [],
        }

    start = float(price["종가"].iloc[0])
    end = float(price["종가"].iloc[-1])
    price_change_pct = ((end / start) - 1.0) * 100.0 if start else 0.0

    foreign = _pick_col(money, ["외국인합계", "외국인"]) if not money.empty else None
    inst = _pick_col(money, ["기관합계", "기관"]) if not money.empty else None
    indiv = _pick_col(money, ["개인"]) if not money.empty else None

    def series(col: str | None) -> pd.Series:
        if col and not money.empty and col in money.columns:
            return money[col].reindex(price.index).fillna(0.0)
        return pd.Series(0.0, index=price.index)

    foreign_s = series(foreign)
    inst_s = series(inst)
    indiv_s = series(indiv)
    smart_s = foreign_s + inst_s
    return {
        "months": months,
        "trading_days": int(len(price)),
        "price_change_pct": round(price_change_pct, 2),
        "foreign_net": float(foreign_s.sum()),
        "institution_net": float(inst_s.sum()),
        "individual_net": float(indiv_s.sum()),
        "smart_money_net": float(smart_s.sum()),
        "high": float(price["고가"].max()) if "고가" in price.columns else float(price["종가"].max()),
        "low": float(price["저가"].min()) if "저가" in price.columns else float(price["종가"].min()),
        "avg_volume": float(price["거래량"].mean()) if "거래량" in price.columns else 0.0,
        "dates": [d.strftime("%Y-%m-%d") for d in price.index],
        "closes": price["종가"].astype(float).tolist(),
        "cum_foreign": foreign_s.cumsum().astype(float).tolist(),
        "cum_institution": inst_s.cumsum().astype(float).tolist(),
        "cum_individual": indiv_s.cumsum().astype(float).tolist(),
        "cum_smart": smart_s.cumsum().astype(float).tolist(),
    }


def theme_leader_rank(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_theme: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        by_theme.setdefault(str(row.get("theme", "")), []).append(row)
    out: list[dict[str, Any]] = []
    for items in by_theme.values():
        ranked = sorted(items, key=lambda r: r.get("smart_money_net", 0), reverse=True)
        for i, item in enumerate(ranked, start=1):
            cloned = dict(item)
            cloned["theme_rank"] = i
            cloned["is_theme_leader"] = i <= 2
            out.append(cloned)
    return out


def screen_candidates(
    rows: list[dict[str, Any]],
    min_score: float = 40.0,
    leaders_only: bool = False,
    flat_only: bool = True,
) -> list[dict[str, Any]]:
    ranked = theme_leader_rank(rows)
    out = []
    for row in ranked:
        if row.get("score", 0) < min_score:
            continue
        if flat_only and not row.get("is_flat_setup", False):
            continue
        if leaders_only and not row.get("is_theme_leader", False):
            continue
        out.append(row)
    return sorted(out, key=lambda r: r.get("score", 0), reverse=True)


def _pick_composite(row: dict[str, Any]) -> float:
    """필터와 별개로, 스캔 데이터만으로 상대 우량도를 계산."""
    score = float(row.get("score", 0))
    smart = float(row.get("smart_money_net", 0))
    price_chg = float(row.get("price_change_pct", 0))
    consec = int(row.get("consecutive_smart_days", 0))
    leader_bonus = 15.0 if row.get("is_theme_leader") else 0.0
    flat_bonus = 20.0 if row.get("is_flat_setup") else max(0.0, 12.0 - abs(price_chg))
    money_bonus = min(max(smart / 1e9, 0.0) * 5.0, 25.0)
    pick = score + leader_bonus + flat_bonus + money_bonus + consec * 3.0
    if price_chg > 20:
        pick *= 0.35
    elif price_chg > 12:
        pick *= 0.7
    if smart <= 0:
        pick *= 0.35
    if not row.get("liquidity_ok", False):
        pick *= 0.5
    return round(float(pick), 2)


def pick_why(row: dict[str, Any]) -> str:
    bits: list[str] = []
    smart_eok = float(row.get("smart_money_net", 0)) / 1e8
    price_chg = float(row.get("price_change_pct", 0))
    if smart_eok > 0:
        bits.append(f"큰손 유입 +{smart_eok:.1f}억")
    if row.get("is_flat_setup"):
        bits.append("돈은 들어오는데 가격은 아직 조용")
    elif price_chg <= 8:
        bits.append(f"가격 변화 {price_chg:+.1f}%로 아직 덜 오름")
    if row.get("is_theme_leader"):
        bits.append(f"{row.get('theme', '')} 테마에서 돈이 더 몰림")
    consec = int(row.get("consecutive_smart_days", 0))
    if consec >= 2:
        bits.append(f"{consec}일 연속 큰손 매수")
    if row.get("is_breakout"):
        bits.append("최근 고점 돌파 확인")
    exp = row.get("expectancy") or {}
    if int(exp.get("sample_size", 0) or 0) >= 5:
        bits.append(f"과거 유사셋업 기대수익 {float(exp.get('expectancy_pct', 0)):+.1f}%")
    if not bits:
        return "상대적으로 나아 보이지만, 핵심 조건은 약해요."
    return " · ".join(bits)


def pick_stocks(
    rows: list[dict[str, Any]],
    top_n: int = 5,
    min_smart_money: float = 0.0,
) -> list[dict[str, Any]]:
    """오늘 데이터 기준으로 고를 종목을 항상 Top-N으로 반환."""
    ranked = theme_leader_rank(rows)
    enriched: list[dict[str, Any]] = []
    for row in ranked:
        if float(row.get("smart_money_net", 0)) < min_smart_money:
            continue
        item = dict(row)
        item["pick_score"] = _pick_composite(item)
        item["pick_why"] = pick_why(item)
        enriched.append(item)
    enriched.sort(key=lambda r: r.get("pick_score", 0), reverse=True)
    out: list[dict[str, Any]] = []
    for i, item in enumerate(enriched[: max(top_n, 0)], start=1):
        item["pick_rank"] = i
        item["pick_label"] = f"추천 {i}위"
        out.append(item)
    return out


def estimate_upside_probability(
    historical_forward_returns: list[float],
    target_pct: float = 5.0,
) -> dict[str, float | int]:
    if not historical_forward_returns:
        return {
            "prob_target_pct": 0.0,
            "expected_return_pct": 0.0,
            "p25": 0.0,
            "p50": 0.0,
            "p75": 0.0,
            "sample_size": 0,
        }
    arr = np.asarray(historical_forward_returns, dtype=float)
    return {
        "prob_target_pct": round(float((arr >= target_pct).mean() * 100), 1),
        "expected_return_pct": round(float(arr.mean()), 2),
        "p25": round(float(np.percentile(arr, 25)), 2),
        "p50": round(float(np.percentile(arr, 50)), 2),
        "p75": round(float(np.percentile(arr, 75)), 2),
        "sample_size": int(len(arr)),
    }


def market_regime(kospi_change_pct: float, market_smart_money: float) -> str:
    # 소폭 음봉만으로 방어 처리하지 않음 (예전엔 하락=smart_proxy -1 → 전부 방어)
    if kospi_change_pct <= -1.5:
        return "방어"
    if kospi_change_pct >= 1.0 and market_smart_money > 0:
        return "공격"
    return "중립"
