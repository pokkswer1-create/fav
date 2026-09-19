function tail(arr, n) {
  return arr.slice(-n);
}

export function detectBreakout(ohlcv, lookback = 20, volumeMult = 1.2, nearPct = 2.0) {
  const empty = { is_breakout: false, is_near_breakout: false, breakout_level: 0, volume_ok: false, distance_pct: 0 };
  if (!ohlcv || ohlcv.length < lookback + 1) return empty;
  const window = ohlcv.slice(-(lookback + 1));
  const prior = window.slice(0, -1);
  const last = window[window.length - 1];
  const lookbackHigh = Math.max(...prior.map((r) => r.high ?? r.close));
  const close = last.close;
  const avgVol = prior.reduce((s, r) => s + (r.volume || 0), 0) / prior.length;
  const volumeOk = !avgVol || (last.volume || 0) >= avgVol * volumeMult;
  const distancePct = close ? ((lookbackHigh / close) - 1) * 100 : 0;
  const isBreakout = close > lookbackHigh && volumeOk;
  const isNear = !isBreakout && lookbackHigh > 0 && distancePct <= nearPct;
  return {
    is_breakout: isBreakout,
    is_near_breakout: isNear,
    breakout_level: lookbackHigh,
    volume_ok: volumeOk,
    distance_pct: Math.round(distancePct * 100) / 100,
    lookback_high: lookbackHigh,
  };
}

function isSetupAt(ohlcv, flow, endIdx, lookback) {
  const start = Math.max(0, endIdx - lookback + 1);
  const price = ohlcv.slice(start, endIdx + 1);
  if (price.length < 5) return false;
  const startPx = price[0].close;
  const endPx = price[price.length - 1].close;
  if (!startPx) return false;
  const chg = ((endPx / startPx) - 1) * 100;
  const money = flow.slice(start, endIdx + 1);
  const smart = money.reduce((s, r) => s + (r.foreign || 0) + (r.institution || 0), 0);
  return smart >= 1e8 && chg <= 8;
}

export function simulateTradeDetail(closes, entryI, stopPct = 6, takePct = 8, maxDays = 10) {
  const empty = { return_pct: 0, days: 0, exit: "none" };
  if (entryI < 0 || entryI >= closes.length - 1) return empty;
  const entry = closes[entryI];
  if (!entry) return empty;
  const stop = entry * (1 - stopPct / 100);
  const take = entry * (1 + takePct / 100);
  const end = Math.min(closes.length - 1, entryI + maxDays);
  for (let j = entryI + 1; j <= end; j += 1) {
    const px = closes[j];
    const days = j - entryI;
    if (px <= stop) return { return_pct: ((stop / entry) - 1) * 100, days, exit: "stop" };
    if (px >= take) return { return_pct: ((take / entry) - 1) * 100, days, exit: "take" };
  }
  const days = end - entryI;
  return { return_pct: ((closes[end] / entry) - 1) * 100, days, exit: "time" };
}

export function simulateTradePath(closes, entryI, stopPct = 6, takePct = 8, maxDays = 10) {
  return simulateTradeDetail(closes, entryI, stopPct, takePct, maxDays).return_pct;
}

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function backtestSetupExpectancy(ohlcv, flow, lookback = 20, stopPct = 6, takePct = 8, maxDays = 10) {
  const empty = {
    sample_size: 0,
    win_rate_pct: 0,
    up_prob_pct: 0,
    hit_take_prob_pct: 0,
    avg_win_pct: 0,
    avg_loss_pct: 0,
    expectancy_pct: 0,
    median_days_to_take: 0,
    median_days_when_up: 0,
    likely_within_days: 0,
    horizon_days: maxDays,
  };
  if (!ohlcv || ohlcv.length < lookback + 15) return empty;
  const closes = ohlcv.map((r) => r.close);
  const details = [];
  let lastSetup = -lookback;
  for (let i = lookback; i < closes.length - maxDays; i += 1) {
    if (i - lastSetup < Math.floor(lookback / 2)) continue;
    if (!isSetupAt(ohlcv, flow, i, lookback)) continue;
    details.push(simulateTradeDetail(closes, i, stopPct, takePct, maxDays));
    lastSetup = i;
  }
  if (!details.length) return empty;
  const rets = details.map((d) => d.return_pct);
  const wins = rets.filter((r) => r > 0);
  const losses = rets.filter((r) => r <= 0);
  const takeHits = details.filter((d) => d.exit === "take");
  const upTrades = details.filter((d) => d.return_pct > 0);
  const avg = rets.reduce((s, r) => s + r, 0) / rets.length;
  const winRate = Math.round((wins.length / rets.length) * 1000) / 10;
  const hitTake = Math.round((takeHits.length / details.length) * 1000) / 10;
  const medianDaysToTake = takeHits.length ? Math.round(median(takeHits.map((d) => d.days))) : 0;
  const medianDaysWhenUp = upTrades.length ? Math.round(median(upTrades.map((d) => d.days))) : 0;
  let likelyWithin = maxDays;
  if (hitTake >= 30 && medianDaysToTake > 0) likelyWithin = medianDaysToTake;
  else if (medianDaysWhenUp > 0) likelyWithin = medianDaysWhenUp;
  return {
    sample_size: rets.length,
    win_rate_pct: winRate,
    up_prob_pct: winRate,
    hit_take_prob_pct: hitTake,
    avg_win_pct: wins.length ? Math.round((wins.reduce((s, r) => s + r, 0) / wins.length) * 100) / 100 : 0,
    avg_loss_pct: losses.length ? Math.round((losses.reduce((s, r) => s + r, 0) / losses.length) * 100) / 100 : 0,
    expectancy_pct: Math.round(avg * 100) / 100,
    median_days_to_take: medianDaysToTake,
    median_days_when_up: medianDaysWhenUp,
    likely_within_days: likelyWithin,
    horizon_days: maxDays,
  };
}

export function beginnerExplain(row, regime = "중립") {
  const name = row.name || "이 종목";
  const theme = row.theme || "관련";
  const smartEok = Number(row.smart_money_net || 0) / 1e8;
  const priceChg = Number(row.price_change_pct || 0);
  const action = row.action || "관심목록";
  const exp = row.expectancy || {};
  const risk = row.risk || {};
  const moneyLine =
    smartEok > 0
      ? `최근 큰손(외국인·기관) 돈이 약 ${smartEok.toFixed(1)}억 들어왔어요.`
      : "최근 큰손 돈이 많이 들어오진 않았어요.";
  const priceLine =
    priceChg <= 8
      ? `그런데 가격은 아직 ${priceChg >= 0 ? "+" : ""}${priceChg.toFixed(1)}% 정도로, 크게 뛰진 않은 상태예요.`
      : `가격은 이미 ${priceChg >= 0 ? "+" : ""}${priceChg.toFixed(1)}% 올랐어서, 따라잡기 매수는 위험할 수 있어요.`;
  const themeLine = row.is_theme_leader
    ? `${theme} 테마 안에서도 돈이 상대적으로 더 몰리는 편이에요.`
    : `${theme} 테마 종목이에요. 대장보다는 후순위일 수 있어요.`;
  let triggerLine = "지금은 조건이 약해서, 다른 상위 추천을 먼저 보는 게 좋아요.";
  if (row.is_breakout) {
    triggerLine = "최근 고점을 거래량과 함께 뚫었어요. ‘관심 매수’로 볼 신호가 나왔어요.";
  } else if (row.is_near_breakout) {
    triggerLine = "고점까지 거의 다 왔어요. 돌파+거래량이 나오면 분할 매수를 검토할 구간이에요.";
  } else if (row.is_flat_setup || Number(row.smart_money_net || 0) > 0) {
    triggerLine = "돈은 들어오는데 가격이 아직 대기 중이에요. ‘돌파대기’로 고점 돌파를 노리면 됩니다.";
  }
  const samples = Number(exp.sample_size || 0);
  const upProb = Number((exp.up_prob_pct ?? exp.win_rate_pct) || 0);
  const hitTake = Number(exp.hit_take_prob_pct || 0);
  const within = Number(exp.likely_within_days || 0);
  const horizon = Number(exp.horizon_days || 10);
  const takePct = risk.take1_pct || 8;
  const daysLine =
    within > 0
      ? `오른 경우 중간값으로 약 ${within}거래일 안에 반응했어요(최대 ${horizon}거래일 규칙).`
      : `보통 ${horizon}거래일 안에 손절/익절을 봅니다.`;
  const backtest =
    samples >= 5
      ? `비슷한 상황이 과거에 ${samples}번 있었고, 상승 확률 약 ${upProb.toFixed(0)}%, 1차익절(+${takePct}%) 도달 확률 약 ${hitTake.toFixed(0)}%, 1회 평균 기대수익 약 ${Number(exp.expectancy_pct || 0) >= 0 ? "+" : ""}${Number(exp.expectancy_pct || 0).toFixed(1)}%예요. ${daysLine} 미래 보장은 아니에요.`
      : "비슷한 과거 사례가 아직 적어, 숫자로 확정하긴 어려워요.";
  const regimeLine = {
    방어: "지금은 시장이 약한 편이라, 사더라도 비중을 작게 잡는 게 좋아요.",
    공격: "시장이 강한 편이라, 조건이 맞으면 관심 가져볼 만해요.",
    중립: "시장은 보통이에요. 종목 조건만 잘 보면 됩니다.",
  }[regime] || "시장 상태를 같이 보고 결정하세요.";
  const guide = {
    추격주의: `초보 가이드: ${name}은(는) 이미 올랐어요. 지금 따라 사지 말고, 조정을 기다리세요.`,
    매수관심: `초보 가이드: ${name}은(는) 관심 매수 후보예요. 몰빵 금지, 손절가부터 정하세요.`,
    분할관심: `초보 가이드: ${name}은(는) 나눠 사기만 검토하세요. 1차로 소액 → 돌파 확인 후 추가.`,
    소액관심: `초보 가이드: 시장이 약해요. ${name}은(는) 사더라도 아주 소액 + 손절 필수예요.`,
    돌파대기: `초보 가이드: ${name}은(는) 지금은 사지 말고, 고점 돌파+거래량 나오는 순간을 노리세요.`,
    관망: `초보 가이드: ${name}은(는) 관심만 두고, 돌파·추가 수급을 확인한 뒤 생각하세요.`,
    관심목록: `초보 가이드: ${name}을(를) 리스트에 넣고, 상위 추천(돌파대기/분할관심)을 우선 보세요.`,
    회피: `초보 가이드: 지금은 ${name}을(를) 사지 않는 편이 낫습니다.`,
  }[action] || `초보 가이드: ${name}은(는) 신중히 보세요.`;
  const summary = [moneyLine, priceLine, themeLine, triggerLine].join(" ");
  return { summary, backtest, regime: regimeLine, guide, full: [summary, backtest, regimeLine, guide].join("\n") };
}
