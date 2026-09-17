function tail(arr, n) {
  return arr.slice(-n);
}

function consecutiveSmartDays(flow, lookback = 20) {
  const money = tail(flow, lookback);
  let streak = 0;
  for (let i = money.length - 1; i >= 0; i -= 1) {
    const smart = (money[i].foreign || 0) + (money[i].institution || 0);
    if (smart > 0) streak += 1;
    else break;
  }
  return streak;
}

export function scoreMoneyInPriceFlat(ohlcv, flow, lookbackDays = 20) {
  const cfg = {
    lookbackDays,
    maxPriceChangePct: 8,
    minSmartMoney: 1e8,
    minAvgValue: 3e9,
    minConsecutive: 2,
  };
  const price = tail(ohlcv, cfg.lookbackDays);
  const money = tail(flow, cfg.lookbackDays);
  const empty = {
    score: 0,
    price_change_pct: 0,
    smart_money_net: 0,
    foreign_net: 0,
    institution_net: 0,
    individual_net: 0,
    consecutive_smart_days: 0,
    liquidity_ok: false,
    is_flat_setup: false,
  };
  if (price.length < 5 || money.length < 5) return empty;

  const start = price[0].close;
  const end = price[price.length - 1].close;
  const priceChangePct = start ? ((end / start) - 1) * 100 : 0;
  const foreignNet = money.reduce((s, r) => s + (r.foreign || 0), 0);
  const institutionNet = money.reduce((s, r) => s + (r.institution || 0), 0);
  const individualNet = money.reduce((s, r) => s + (r.individual || 0), 0);
  const smart = foreignNet + institutionNet;
  const avgValue =
    price.reduce((s, r) => s + (r.value || r.close * (r.volume || 0)), 0) / price.length;
  const consecutive = consecutiveSmartDays(flow, cfg.lookbackDays);
  const liquidityOk = avgValue >= cfg.minAvgValue;

  const moneyScore = Math.min(Math.max(smart / 1e8, 0), 100);
  let flatScore;
  if (priceChangePct <= 0) flatScore = 100;
  else if (priceChangePct <= cfg.maxPriceChangePct) {
    flatScore = 100 * (1 - priceChangePct / cfg.maxPriceChangePct);
  } else {
    flatScore = Math.max(0, 40 - (priceChangePct - cfg.maxPriceChangePct) * 3);
  }
  const consecutiveScore = Math.min(consecutive * 20, 100);

  let score;
  if (smart < cfg.minSmartMoney || !liquidityOk) score = moneyScore * 0.15;
  else score = (moneyScore + 1.2 * flatScore + 0.4 * consecutiveScore) / 2.6;

  const isFlat =
    smart >= cfg.minSmartMoney &&
    priceChangePct <= cfg.maxPriceChangePct &&
    liquidityOk &&
    consecutive >= cfg.minConsecutive;

  return {
    score: Math.round(score * 100) / 100,
    price_change_pct: Math.round(priceChangePct * 100) / 100,
    smart_money_net: smart,
    foreign_net: foreignNet,
    institution_net: institutionNet,
    individual_net: individualNet,
    consecutive_smart_days: consecutive,
    liquidity_ok: liquidityOk,
    is_flat_setup: isFlat,
  };
}

export function themeLeaderRank(rows) {
  const byTheme = {};
  for (const row of rows) {
    (byTheme[row.theme] ||= []).push(row);
  }
  const out = [];
  for (const items of Object.values(byTheme)) {
    const ranked = [...items].sort((a, b) => (b.smart_money_net || 0) - (a.smart_money_net || 0));
    ranked.forEach((item, i) => {
      out.push({
        ...item,
        theme_rank: i + 1,
        is_theme_leader: i < 2,
      });
    });
  }
  return out;
}

function pickComposite(row) {
  const score = Number(row.score || 0);
  const smart = Number(row.smart_money_net || 0);
  const priceChg = Number(row.price_change_pct || 0);
  const consec = Number(row.consecutive_smart_days || 0);
  const leaderBonus = row.is_theme_leader ? 15 : 0;
  const flatBonus = row.is_flat_setup ? 20 : Math.max(0, 12 - Math.abs(priceChg));
  const moneyBonus = Math.min(Math.max(smart / 1e9, 0) * 5, 25);
  let pick = score + leaderBonus + flatBonus + moneyBonus + consec * 3;
  if (priceChg > 20) pick *= 0.35;
  else if (priceChg > 12) pick *= 0.7;
  if (smart <= 0) pick *= 0.35;
  if (!row.liquidity_ok) pick *= 0.5;
  return Math.round(pick * 100) / 100;
}

export function pickWhy(row) {
  const bits = [];
  const smartEok = Number(row.smart_money_net || 0) / 1e8;
  const priceChg = Number(row.price_change_pct || 0);
  if (smartEok > 0) bits.push(`스마트머니 +${smartEok.toFixed(1)}억`);
  if (row.is_flat_setup) bits.push("수급↑·가격정체 셋업");
  else if (priceChg <= 8) bits.push(`기간수익률 ${priceChg >= 0 ? "+" : ""}${priceChg.toFixed(1)}%로 아직 덜 상승`);
  if (row.is_theme_leader) bits.push(`${row.theme} 테마 대장권`);
  if ((row.consecutive_smart_days || 0) >= 2) bits.push(`연속수급 ${row.consecutive_smart_days}일`);
  return bits.length ? bits.join(" · ") : "상대 점수 상위이나 핵심 셋업은 약합니다.";
}

export function pickStocks(rows, topN = 5) {
  const ranked = themeLeaderRank(rows).map((row) => {
    const pick_score = pickComposite(row);
    return { ...row, pick_score, pick_why: pickWhy({ ...row, pick_score }) };
  });
  ranked.sort((a, b) => b.pick_score - a.pick_score);
  return ranked.slice(0, topN).map((item, i) => ({
    ...item,
    pick_rank: i + 1,
    pick_label: `추천 ${i + 1}위`,
  }));
}

export function marketRegime(kospiChangePct, marketSmartMoney) {
  if (kospiChangePct <= -2 || marketSmartMoney < 0) return "방어";
  if (kospiChangePct >= 1 && marketSmartMoney > 0) return "공격";
  return "중립";
}

export function actionComment(row, regime) {
  if (!row.liquidity_ok) {
    return { action: "회피", reason: "거래대금 부족으로 체결/슬리피지 위험이 큽니다." };
  }
  if (Number(row.price_change_pct || 0) > 15) {
    return { action: "회피", reason: "이미 급등해 추격 매수 구간입니다." };
  }
  const strong =
    row.is_flat_setup && row.is_theme_leader && Number(row.score || 0) >= 55;
  const soft =
    Number(row.smart_money_net || 0) > 0 && Number(row.price_change_pct || 100) <= 8;

  if (regime === "방어") {
    if (strong) {
      return {
        action: "관망축소",
        reason: "데이터상 우량 셋업이지만 시장이 방어 구간이라 비중을 줄이거나 분할만 고려합니다.",
      };
    }
    if (soft || Number(row.pick_score || row.score || 0) >= 40) {
      return {
        action: "관심목록",
        reason: "상대적으로 수급이 나은 편이나 방어장에서는 매수보다 관찰 우선입니다.",
      };
    }
    return { action: "회피", reason: "시장 방어 + 종목 셋업 부족으로 신규 진입을 미룹니다." };
  }
  if (strong) {
    return {
      action: "매수관심",
      reason: "테마 대장 + 스마트머니 유입 + 가격 미반영 조건이 겹칩니다.",
    };
  }
  if (soft) {
    return {
      action: "관망",
      reason: "수급은 들어오나 추가 확인(돌파/연속수급)이 필요합니다.",
    };
  }
  if (Number(row.pick_score || 0) >= 45 || Number(row.score || 0) >= 45) {
    return {
      action: "관심목록",
      reason: "스캔 상대점수 상위이나 핵심 셋업은 완전하지 않습니다.",
    };
  }
  return { action: "회피", reason: "핵심 셋업 조건이 부족합니다." };
}
