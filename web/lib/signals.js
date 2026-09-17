function tail(arr, n) {
  return arr.slice(-n);
}

export function detectBreakout(ohlcv, lookback = 20, volumeMult = 1.2) {
  const empty = { is_breakout: false, breakout_level: 0, volume_ok: false };
  if (!ohlcv || ohlcv.length < lookback + 1) return empty;
  const window = ohlcv.slice(-(lookback + 1));
  const prior = window.slice(0, -1);
  const last = window[window.length - 1];
  const lookbackHigh = Math.max(...prior.map((r) => r.high ?? r.close));
  const close = last.close;
  const avgVol = prior.reduce((s, r) => s + (r.volume || 0), 0) / prior.length;
  const volumeOk = !avgVol || (last.volume || 0) >= avgVol * volumeMult;
  return {
    is_breakout: close > lookbackHigh && volumeOk,
    breakout_level: lookbackHigh,
    volume_ok: volumeOk,
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

export function simulateTradePath(closes, entryI, stopPct = 6, takePct = 8, maxDays = 10) {
  if (entryI < 0 || entryI >= closes.length - 1) return 0;
  const entry = closes[entryI];
  if (!entry) return 0;
  const stop = entry * (1 - stopPct / 100);
  const take = entry * (1 + takePct / 100);
  const end = Math.min(closes.length - 1, entryI + maxDays);
  for (let j = entryI + 1; j <= end; j += 1) {
    const px = closes[j];
    if (px <= stop) return ((stop / entry) - 1) * 100;
    if (px >= take) return ((take / entry) - 1) * 100;
  }
  return ((closes[end] / entry) - 1) * 100;
}

export function backtestSetupExpectancy(ohlcv, flow, lookback = 20) {
  const empty = {
    sample_size: 0,
    win_rate_pct: 0,
    avg_win_pct: 0,
    avg_loss_pct: 0,
    expectancy_pct: 0,
  };
  if (!ohlcv || ohlcv.length < lookback + 15) return empty;
  const closes = ohlcv.map((r) => r.close);
  const rets = [];
  let lastSetup = -lookback;
  for (let i = lookback; i < closes.length - 10; i += 1) {
    if (i - lastSetup < Math.floor(lookback / 2)) continue;
    if (!isSetupAt(ohlcv, flow, i, lookback)) continue;
    rets.push(simulateTradePath(closes, i));
    lastSetup = i;
  }
  if (!rets.length) return empty;
  const wins = rets.filter((r) => r > 0);
  const losses = rets.filter((r) => r <= 0);
  const avg = rets.reduce((s, r) => s + r, 0) / rets.length;
  return {
    sample_size: rets.length,
    win_rate_pct: Math.round((wins.length / rets.length) * 1000) / 10,
    avg_win_pct: wins.length ? Math.round((wins.reduce((s, r) => s + r, 0) / wins.length) * 100) / 100 : 0,
    avg_loss_pct: losses.length ? Math.round((losses.reduce((s, r) => s + r, 0) / losses.length) * 100) / 100 : 0,
    expectancy_pct: Math.round(avg * 100) / 100,
  };
}

export function beginnerExplain(row, regime = "중립") {
  const name = row.name || "이 종목";
  const theme = row.theme || "관련";
  const smartEok = Number(row.smart_money_net || 0) / 1e8;
  const priceChg = Number(row.price_change_pct || 0);
  const action = row.action || "관심목록";
  const exp = row.expectancy || {};
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
  let triggerLine = "지금은 조건이 완벽하진 않아서, 지켜보는 편이 안전해요.";
  if (row.is_breakout) {
    triggerLine = "최근 고점을 거래량과 함께 뚫어서, ‘관심’에서 ‘매수 후보’로 올릴 신호가 나왔어요.";
  } else if (row.is_flat_setup) {
    triggerLine = "돈은 들어오는데 가격이 아직 안 오른 ‘대기’ 구간이에요. 돌파가 나오면 더 확실해져요.";
  }
  const samples = Number(exp.sample_size || 0);
  const backtest =
    samples >= 5
      ? `비슷한 상황이 과거에 ${samples}번 있었고, 승률 약 ${Number(exp.win_rate_pct || 0).toFixed(0)}%, 1회 평균 기대수익 약 ${Number(exp.expectancy_pct || 0) >= 0 ? "+" : ""}${Number(exp.expectancy_pct || 0).toFixed(1)}%예요. 미래 보장은 아니에요.`
      : "비슷한 과거 사례가 아직 적어, 숫자로 확정하긴 어려워요.";
  const regimeLine = {
    방어: "지금은 시장이 약한 편이라, 사더라도 비중을 작게 잡는 게 좋아요.",
    공격: "시장이 강한 편이라, 조건이 맞으면 관심 가져볼 만해요.",
    중립: "시장은 보통이에요. 종목 조건만 잘 보면 됩니다.",
  }[regime] || "시장 상태를 같이 보고 결정하세요.";
  const guide = {
    매수관심: `초보 가이드: ${name}은(는) ‘관심 매수 후보’예요. 한 번에 몰빵하지 말고, 정해둔 손절가를 지키세요.`,
    관망: `초보 가이드: ${name}은(는) 관심만 두고, 돌파·추가 수급을 확인한 뒤 생각하세요.`,
    관망축소: `초보 가이드: 조건은 괜찮은데 시장이 약해요. 매수보다 관망·소액만 고려하세요.`,
    관심목록: `초보 가이드: ${name}을(를) 리스트에만 넣고, 매일 수급·돌파만 체크하세요.`,
    회피: `초보 가이드: 지금은 ${name}을(를) 사지 않는 편이 낫습니다.`,
  }[action] || `초보 가이드: ${name}은(는) 신중히 보세요.`;
  const summary = [moneyLine, priceLine, themeLine, triggerLine].join(" ");
  return { summary, backtest, regime: regimeLine, guide, full: [summary, backtest, regimeLine, guide].join("\n") };
}
