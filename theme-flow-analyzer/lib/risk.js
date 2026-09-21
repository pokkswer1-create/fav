export function riskPlan(entryPrice, score) {
  const stopPct = 6;
  const take1Pct = 8;
  const take2Pct = 15;
  const timeStopDays = 10;
  const baseRisk = 1;
  const sizedRisk = baseRisk * (1 + Math.min(Math.max(score - 50, 0) / 100, 0.5));
  const entry = Number(entryPrice) || 0;
  return {
    stop_pct: stopPct,
    take1_pct: take1Pct,
    take2_pct: take2Pct,
    time_stop_days: timeStopDays,
    account_risk_pct: Math.round(sizedRisk * 100) / 100,
    stop_price: Math.round(entry * (1 - stopPct / 100)),
    take1_price: Math.round(entry * (1 + take1Pct / 100)),
    take2_price: Math.round(entry * (1 + take2Pct / 100)),
  };
}
