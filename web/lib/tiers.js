export const SHORT_WITHIN_DAYS = 5;
export const BUY_MIN_SAMPLES = 10;
export const BUY_MIN_UP_PROB = 55;
export const BUY_MIN_HIT_TAKE = 30;
export const BUY_ACTIONS = new Set(["매수관심", "분할관심"]);

export function classifyHorizon(row, shortWithin = SHORT_WITHIN_DAYS) {
  const exp = row.expectancy || {};
  const within = Number(exp.likely_within_days || exp.horizon_days || 99);
  return within <= shortWithin ? "short" : "long";
}

export function expectancyRankKey(row) {
  const exp = row.expectancy || {};
  return [
    Number(exp.expectancy_pct || 0),
    Number(exp.hit_take_prob_pct || 0),
    Number(exp.up_prob_pct ?? exp.win_rate_pct ?? 0),
  ];
}

export function isBuyEligible(row, regime = "중립") {
  if (regime === "방어") return false;
  const action = String(row.action || "");
  if (!BUY_ACTIONS.has(action)) return false;
  const exp = row.expectancy || {};
  const samples = Number(exp.sample_size || 0);
  const up = Number(exp.up_prob_pct ?? exp.win_rate_pct ?? 0);
  const hit = Number(exp.hit_take_prob_pct || 0);
  const expect = Number(exp.expectancy_pct || 0);
  if (samples < BUY_MIN_SAMPLES) return false;
  if (up < BUY_MIN_UP_PROB) return false;
  if (hit < BUY_MIN_HIT_TAKE) return false;
  if (expect <= 0) return false;
  return true;
}

export function isWatchEligible(row) {
  if (Number(row.smart_money_net || 0) > 0) return true;
  if (row.is_flat_setup || row.is_near_breakout || row.is_breakout) return true;
  const action = String(row.action || "");
  return ["돌파대기", "분할관심", "매수관심", "관심목록", "소액관심"].includes(action);
}

function rankBucket(items, labelPrefix, topN) {
  const ranked = [...items].sort((a, b) => {
    const ka = expectancyRankKey(a);
    const kb = expectancyRankKey(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (kb[i] !== ka[i]) return kb[i] - ka[i];
    }
    return 0;
  });
  return ranked.slice(0, Math.max(topN, 0)).map((row, i) => {
    const key = expectancyRankKey(row);
    return {
      ...row,
      pick_rank: i + 1,
      pick_label: `${labelPrefix} ${i + 1}위`,
      pick_score: Math.round((key[0] * 10 + key[1] * 0.1 + Number(row.score || 0) * 0.01) * 100) / 100,
    };
  });
}

export function buildTieredPicks(rows, { regime = "중립", topN = 5, shortWithin = SHORT_WITHIN_DAYS } = {}) {
  const shortBuy = [];
  const shortWatch = [];
  const longBuy = [];
  const longWatch = [];

  for (const row of rows) {
    const horizon = classifyHorizon(row, shortWithin);
    const item = {
      ...row,
      horizon,
      horizon_label: horizon === "short" ? "단기" : "장기",
    };
    if (isBuyEligible(item, regime)) {
      item.trade_tier = "buy";
      item.trade_tier_label = "오늘매수";
      (horizon === "short" ? shortBuy : longBuy).push(item);
    } else if (isWatchEligible(item)) {
      item.trade_tier = "watch";
      item.trade_tier_label = "대기";
      (horizon === "short" ? shortWatch : longWatch).push(item);
    }
  }

  const short_buy = rankBucket(shortBuy, "단기매수", topN);
  const short_watch = rankBucket(shortWatch, "단기대기", topN);
  const long_buy = rankBucket(longBuy, "장기매수", topN);
  const long_watch = rankBucket(longWatch, "장기대기", topN);

  const picks = [];
  for (const bucket of [short_buy, long_buy, short_watch, long_watch]) {
    for (const row of bucket) {
      if (picks.length >= topN) break;
      picks.push({ ...row, pick_rank: picks.length + 1 });
    }
    if (picks.length >= topN) break;
  }

  return {
    short_buy,
    short_watch,
    long_buy,
    long_watch,
    picks,
    buy_count: short_buy.length + long_buy.length,
    watch_count: short_watch.length + long_watch.length,
    defense_buys_blocked: regime === "방어",
    rules: {
      short_within_days: shortWithin,
      buy_min_samples: BUY_MIN_SAMPLES,
      buy_min_up_prob: BUY_MIN_UP_PROB,
      buy_min_hit_take: BUY_MIN_HIT_TAKE,
    },
  };
}
