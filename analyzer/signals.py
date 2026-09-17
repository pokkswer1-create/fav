"""돌파 확인, 백테스트 기대값, 초보자용 설명."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def detect_breakout(
    ohlcv: pd.DataFrame,
    lookback: int = 20,
    volume_mult: float = 1.2,
    near_pct: float = 2.0,
) -> dict[str, Any]:
    """최근 고점 돌파 / 근접 돌파 + 거래량 확인."""
    empty = {
        "is_breakout": False,
        "is_near_breakout": False,
        "breakout_level": 0.0,
        "volume_ok": False,
        "close": 0.0,
        "lookback_high": 0.0,
        "distance_pct": 0.0,
    }
    if ohlcv is None or ohlcv.empty or "종가" not in ohlcv.columns or len(ohlcv) < lookback + 1:
        return empty

    window = ohlcv.iloc[-(lookback + 1) :]
    prior = window.iloc[:-1]
    last = window.iloc[-1]
    high_col = "고가" if "고가" in prior.columns else "종가"
    lookback_high = float(prior[high_col].max())
    close = float(last["종가"])
    vol_ok = True
    if "거래량" in window.columns:
        avg_vol = float(prior["거래량"].mean()) or 0.0
        last_vol = float(last["거래량"])
        vol_ok = avg_vol <= 0 or last_vol >= avg_vol * volume_mult
    distance_pct = ((lookback_high / close) - 1.0) * 100.0 if close else 0.0
    is_breakout = close > lookback_high and vol_ok
    is_near = (not is_breakout) and lookback_high > 0 and distance_pct <= near_pct
    return {
        "is_breakout": bool(is_breakout),
        "is_near_breakout": bool(is_near),
        "breakout_level": round(lookback_high, 2),
        "volume_ok": bool(vol_ok),
        "close": round(close, 2),
        "lookback_high": round(lookback_high, 2),
        "distance_pct": round(float(distance_pct), 2),
    }


def _is_setup_at(
    ohlcv: pd.DataFrame,
    flow: pd.DataFrame,
    end_idx: int,
    lookback: int,
    max_price_change_pct: float = 8.0,
    min_smart_money: float = 1e8,
) -> bool:
    start = max(0, end_idx - lookback + 1)
    price = ohlcv.iloc[start : end_idx + 1]
    money = flow.reindex(price.index).fillna(0.0) if flow is not None and not flow.empty else None
    if price.empty or money is None or len(price) < 5 or "종가" not in price.columns:
        return False
    start_px = float(price["종가"].iloc[0])
    end_px = float(price["종가"].iloc[-1])
    if not start_px:
        return False
    chg = ((end_px / start_px) - 1.0) * 100.0
    foreign = money["외국인합계"] if "외국인합계" in money.columns else money.get("외국인")
    inst = money["기관합계"] if "기관합계" in money.columns else money.get("기관")
    if foreign is None or inst is None:
        return False
    smart = float(foreign.fillna(0).sum() + inst.fillna(0).sum())
    return smart >= min_smart_money and chg <= max_price_change_pct


def simulate_trade_path(
    closes: list[float],
    entry_i: int,
    stop_pct: float = 6.0,
    take_pct: float = 8.0,
    max_days: int = 10,
) -> float:
    """진입 다음날부터 손절/익절/시간손절 적용 후 수익률%."""
    if entry_i < 0 or entry_i >= len(closes) - 1:
        return 0.0
    entry = closes[entry_i]
    if not entry:
        return 0.0
    stop = entry * (1 - stop_pct / 100)
    take = entry * (1 + take_pct / 100)
    end = min(len(closes) - 1, entry_i + max_days)
    for j in range(entry_i + 1, end + 1):
        px = closes[j]
        if px <= stop:
            return ((stop / entry) - 1.0) * 100.0
        if px >= take:
            return ((take / entry) - 1.0) * 100.0
    return ((closes[end] / entry) - 1.0) * 100.0


def backtest_setup_expectancy(
    ohlcv: pd.DataFrame,
    flow: pd.DataFrame,
    lookback: int = 20,
    stop_pct: float = 6.0,
    take_pct: float = 8.0,
    max_days: int = 10,
    min_samples: int = 5,
) -> dict[str, float | int]:
    """유사 수급↑·가격정체 셋업의 과거 기대값(참고용)."""
    empty = {
        "sample_size": 0,
        "win_rate_pct": 0.0,
        "avg_win_pct": 0.0,
        "avg_loss_pct": 0.0,
        "expectancy_pct": 0.0,
        "avg_return_pct": 0.0,
    }
    if ohlcv is None or ohlcv.empty or "종가" not in ohlcv.columns or len(ohlcv) < lookback + max_days + 5:
        return empty

    closes = ohlcv["종가"].astype(float).tolist()
    rets: list[float] = []
    last_setup = -lookback
    for i in range(lookback, len(closes) - max_days):
        if i - last_setup < lookback // 2:
            continue
        if not _is_setup_at(ohlcv, flow, i, lookback):
            continue
        rets.append(simulate_trade_path(closes, i, stop_pct=stop_pct, take_pct=take_pct, max_days=max_days))
        last_setup = i

    if len(rets) < min_samples:
        # 표본이 적으면 전체 forward로 완화 추정은 하지 않고 부족 표시
        if not rets:
            return empty
    arr = np.asarray(rets, dtype=float)
    wins = arr[arr > 0]
    losses = arr[arr <= 0]
    win_rate = float((arr > 0).mean() * 100) if len(arr) else 0.0
    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = float(losses.mean()) if len(losses) else 0.0
    expectancy = float(arr.mean()) if len(arr) else 0.0
    return {
        "sample_size": int(len(arr)),
        "win_rate_pct": round(win_rate, 1),
        "avg_win_pct": round(avg_win, 2),
        "avg_loss_pct": round(avg_loss, 2),
        "expectancy_pct": round(expectancy, 2),
        "avg_return_pct": round(expectancy, 2),
    }


def beginner_explain(row: dict[str, Any], regime: str = "중립") -> dict[str, str]:
    """주식 초보도 이해하게 쉬운 말로 추천 이유를 작성."""
    name = str(row.get("name") or "이 종목")
    theme = str(row.get("theme") or "관련")
    smart_eok = float(row.get("smart_money_net", 0)) / 1e8
    price_chg = float(row.get("price_change_pct", 0))
    action = str(row.get("action") or "관심목록")
    breakout = bool(row.get("is_breakout"))
    exp = row.get("expectancy") or {}
    exp_pct = float(exp.get("expectancy_pct", 0) or 0)
    win_rate = float(exp.get("win_rate_pct", 0) or 0)
    samples = int(exp.get("sample_size", 0) or 0)

    money_line = (
        f"최근 큰손(외국인·기관) 돈이 약 {smart_eok:.1f}억 들어왔어요."
        if smart_eok > 0
        else "최근 큰손 돈이 많이 들어오진 않았어요."
    )
    if price_chg <= 8:
        price_line = f"그런데 가격은 아직 {price_chg:+.1f}% 정도로, 크게 뛰진 않은 상태예요."
    else:
        price_line = f"가격은 이미 {price_chg:+.1f}% 올랐어서, 따라잡기 매수는 위험할 수 있어요."

    if row.get("is_theme_leader"):
        theme_line = f"{theme} 테마 안에서도 돈이 상대적으로 더 몰리는 편이에요."
    else:
        theme_line = f"{theme} 테마 종목이에요. 대장보다는 후순위일 수 있어요."

    if breakout:
        trigger_line = "최근 고점을 거래량과 함께 뚫었어요. ‘관심 매수’로 볼 신호가 나왔어요."
    elif row.get("is_near_breakout"):
        trigger_line = "고점까지 거의 다 왔어요. 돌파+거래량이 나오면 분할 매수를 검토할 구간이에요."
    elif row.get("is_flat_setup") or float(row.get("smart_money_net", 0) or 0) > 0:
        trigger_line = "돈은 들어오는데 가격이 아직 대기 중이에요. ‘돌파대기’로 고점 돌파를 노리면 됩니다."
    else:
        trigger_line = "지금은 조건이 약해서, 다른 상위 추천을 먼저 보는 게 좋아요."

    if samples >= 5:
        backtest_line = (
            f"비슷한 상황이 과거에 {samples}번 있었고, "
            f"그때 규칙(손절 {row.get('risk', {}).get('stop_pct', 6)}% / 익절 {row.get('risk', {}).get('take1_pct', 8)}%)으로 보면 "
            f"승률 약 {win_rate:.0f}%, 1회 평균 기대수익 약 {exp_pct:+.1f}%예요. "
            "미래 보장은 아니에요."
        )
    else:
        backtest_line = "비슷한 과거 사례가 아직 적어, 숫자로 확정하긴 어려워요."

    regime_line = {
        "방어": "지금은 시장이 약한 편이라, 사더라도 비중을 작게 잡는 게 좋아요.",
        "공격": "시장이 강한 편이라, 조건이 맞으면 관심 가져볼 만해요.",
        "중립": "시장은 보통이에요. 종목 조건만 잘 보면 됩니다.",
    }.get(regime, "시장 상태를 같이 보고 결정하세요.")

    action_guide = {
        "추격주의": f"초보 가이드: {name}은(는) 이미 올랐어요. 지금 따라 사지 말고, 조정을 기다리세요.",
        "매수관심": f"초보 가이드: {name}은(는) 관심 매수 후보예요. 몰빵 금지, 손절가부터 정하세요.",
        "분할관심": f"초보 가이드: {name}은(는) 나눠 사기만 검토하세요. 1차로 소액 → 돌파 확인 후 추가.",
        "소액관심": f"초보 가이드: 시장이 약해요. {name}은(는) 사더라도 아주 소액 + 손절 필수예요.",
        "돌파대기": f"초보 가이드: {name}은(는) 지금은 사지 말고, 고점 돌파+거래량 나오는 순간을 노리세요.",
        "관망": f"초보 가이드: {name}은(는) 관심만 두고, 돌파·추가 수급을 확인한 뒤 생각하세요.",
        "관망축소": f"초보 가이드: 조건은 괜찮은데 시장이 약해요. 매수보다 관망·소액만 고려하세요.",
        "관심목록": f"초보 가이드: {name}을(를) 리스트에 넣고, 상위 추천(돌파대기/분할관심)을 우선 보세요.",
        "회피": f"초보 가이드: 지금은 {name}을(를) 사지 않는 편이 낫습니다.",
    }.get(action, f"초보 가이드: {name}은(는) 신중히 보세요.")

    summary = " ".join([money_line, price_line, theme_line, trigger_line])
    return {
        "summary": summary,
        "backtest": backtest_line,
        "regime": regime_line,
        "guide": action_guide,
        "full": "\n".join([summary, backtest_line, regime_line, action_guide]),
    }
