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
  if (smartEok > 0) bits.push(`큰손 유입 +${smartEok.toFixed(1)}억`);
  if (row.is_flat_setup) bits.push("돈은 들어오는데 가격은 아직 조용");
  else if (priceChg <= 8) bits.push(`가격 변화 ${priceChg >= 0 ? "+" : ""}${priceChg.toFixed(1)}%로 아직 덜 오름`);
  if (row.is_theme_leader) bits.push(`${row.theme} 테마에서 돈이 더 몰림`);
  if ((row.consecutive_smart_days || 0) >= 2) bits.push(`${row.consecutive_smart_days}일 연속 큰손 매수`);
  if (row.is_breakout) bits.push("최근 고점 돌파 확인");
  const exp = row.expectancy || {};
  if ((exp.sample_size || 0) >= 5) {
    bits.push(`과거 유사셋업 기대수익 ${Number(exp.expectancy_pct || 0) >= 0 ? "+" : ""}${Number(exp.expectancy_pct || 0).toFixed(1)}%`);
  }
  return bits.length ? bits.join(" · ") : "상대적으로 나아 보이지만, 핵심 조건은 약해요.";
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
    return { action: "회피", reason: "거래가 너무 적어 원하는 가격에 사기/팔기 어려울 수 있어요." };
  }
  if (Number(row.price_change_pct || 0) > 15) {
    return { action: "회피", reason: "이미 많이 올라 지금 따라 사면 고점에 잡을 위험이 커요." };
  }
  const setupReady = row.is_flat_setup && row.is_theme_leader && Number(row.score || 0) >= 55;
  const soft = Number(row.smart_money_net || 0) > 0 && Number(row.price_change_pct || 100) <= 8;
  const breakout = !!row.is_breakout;
  const exp = row.expectancy || {};
  const expectancyOk = Number(exp.expectancy_pct || 0) >= 0 && Number(exp.sample_size || 0) >= 5;

  if (regime === "방어") {
    if (setupReady && breakout) {
      return { action: "관망축소", reason: "돌파까지 나왔지만 시장이 약해요. 사더라도 아주 소액만, 아니면 관망하세요." };
    }
    if (setupReady || soft || Number(row.pick_score || row.score || 0) >= 40) {
      return { action: "관심목록", reason: "종목은 괜찮아 보여도 시장이 약해서, 지금은 리스트에만 두고 지켜보세요." };
    }
    return { action: "회피", reason: "시장도 약하고 종목 조건도 약해서 지금은 사지 않는 게 좋아요." };
  }
  if (setupReady && breakout) {
    if (expectancyOk || Number(exp.sample_size || 0) < 5) {
      return { action: "매수관심", reason: "큰손 유입 + 가격 대기 + 테마 대장 + 고점 돌파가 겹쳤어요. 손절을 꼭 지키세요." };
    }
  }
  if (setupReady && !breakout) {
    return { action: "관망", reason: "조건은 좋은데 아직 고점을 뚫지 못했어요. 돌파 나오면 매수 후보로 올릴 수 있어요." };
  }
  if (soft) {
    return { action: "관망", reason: "돈은 들어오는데 확신이 덜해요. 며칠 더 수급·돌파를 확인하세요." };
  }
  if (Number(row.pick_score || 0) >= 45 || Number(row.score || 0) >= 45) {
    return { action: "관심목록", reason: "상대적으로 괜찮아 보여 리스트에 넣어둡니다. 바로 사라는 뜻은 아니에요." };
  }
  return { action: "회피", reason: "지금은 사기에 조건이 부족해요." };
}
