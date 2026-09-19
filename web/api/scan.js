import { listThemes, stocksForTheme } from "../lib/themes.js";
import {
  fetchDailyPrices,
  fetchInvestorTrend,
  fetchRealtimeIndex,
  fetchRealtimeQuotes,
} from "../lib/naver.js";
import {
  actionComment,
  marketRegime,
  pickStocks,
  scoreMoneyInPriceFlat,
} from "../lib/screener.js";
import {
  backtestSetupExpectancy,
  beginnerExplain,
  detectBreakout,
} from "../lib/signals.js";
import { riskPlan } from "../lib/risk.js";

export const config = {
  maxDuration: 60,
};

function alignFlow(ohlcv, flow) {
  if (!ohlcv.length) return [];
  const map = new Map(flow.map((r) => [r.date, r]));
  return ohlcv.map((p) => {
    const f = map.get(p.date);
    return {
      date: p.date,
      foreign: f ? f.foreign : 0,
      institution: f ? f.institution : 0,
      individual: f ? f.individual : 0,
    };
  });
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const cur = idx;
      idx += 1;
      results[cur] = await worker(items[cur], cur);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function buildSnapshot(item, lookbackDays, quote) {
  const days = Math.max(lookbackDays + 80, 120);
  const [ohlcv, flowRaw] = await Promise.all([
    fetchDailyPrices(item.ticker, days),
    fetchInvestorTrend(item.ticker, Math.min(days, 80)),
  ]);
  const flow = alignFlow(ohlcv, flowRaw);
  const score = scoreMoneyInPriceFlat(ohlcv, flow, lookbackDays);
  const breakout = detectBreakout(ohlcv, lookbackDays);
  const latest = quote?.price || (ohlcv.length ? ohlcv[ohlcv.length - 1].close : 0);
  const risk = riskPlan(latest, Number(score.score || 0));
  const expectancy = backtestSetupExpectancy(
    ohlcv,
    flow,
    lookbackDays,
    Number(risk.stop_pct || 6),
    Number(risk.take1_pct || 8),
    Number(risk.time_stop_days || 10),
  );
  const chartSlice = ohlcv.slice(-60);
  return {
    ticker: item.ticker,
    name: item.name,
    theme: item.theme,
    ...score,
    latest_close: latest,
    realtime_change_pct: quote?.change_pct || 0,
    is_breakout: !!breakout.is_breakout,
    is_near_breakout: !!breakout.is_near_breakout,
    breakout,
    expectancy,
    risk,
    stop_price: risk.stop_price,
    take1_price: risk.take1_price,
    take2_price: risk.take2_price,
    chart: {
      dates: chartSlice.map((r) => r.date),
      closes: chartSlice.map((r) => r.close),
    },
    data_source: "naver_live",
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const theme = url.searchParams.get("theme") || "전체";
    const lookback = Number(url.searchParams.get("lookback") || 20);
    const topN = Number(url.searchParams.get("top") || 5);

    const idx = await fetchRealtimeIndex("KOSPI");
    const smartProxy = Number(idx.change_pct || 0) >= 0 ? 1 : -1;
    const regime = marketRegime(Number(idx.change_pct || 0), smartProxy);
    const universe = stocksForTheme(theme === "전체" ? null : theme);
    const uniqueItems = [];
    const seenTickers = new Set();
    for (const item of universe) {
      if (seenTickers.has(item.ticker)) continue;
      seenTickers.add(item.ticker);
      uniqueItems.push(item);
    }
    const quotes = await fetchRealtimeQuotes(uniqueItems.map((u) => u.ticker));

    const snapshots = (
      await mapPool(uniqueItems, 10, async (item) => {
        try {
          return await buildSnapshot(item, lookback, quotes[item.ticker]);
        } catch (err) {
          return null;
        }
      })
    ).filter(Boolean);
    const byTicker = new Map(snapshots.map((s) => [s.ticker, s]));
    const raw = universe
      .map((item) => {
        const snap = byTicker.get(item.ticker);
        if (!snap) return null;
        return { ...snap, theme: item.theme, name: item.name };
      })
      .filter(Boolean);

    const picks = pickStocks(raw, topN).map((row) => {
      const comment = actionComment(row, regime);
      const item = { ...row, action: comment.action, reason: comment.reason };
      const explain = beginnerExplain(item, regime);
      return {
        ...item,
        beginner_summary: explain.summary,
        beginner_backtest: explain.backtest,
        beginner_guide: explain.guide,
        beginner_full: explain.full,
      };
    });

    const themeScores = {};
    for (const row of raw) {
      themeScores[row.theme] = (themeScores[row.theme] || 0) + Number(row.smart_money_net || 0);
    }
    const theme_top = Object.entries(themeScores)
      .map(([t, smart_money_net]) => ({ theme: t, smart_money_net }))
      .sort((a, b) => b.smart_money_net - a.smart_money_net);

    res.status(200).json({
      regime: {
        regime,
        kospi_price: idx.price,
        kospi_change_pct: Math.round(Number(idx.change_pct || 0) * 100) / 100,
        market_status: idx.market_status,
        data_source: "naver_realtime",
        as_of: idx.as_of,
      },
      picks,
      theme_top,
      themes: listThemes(),
      scanned_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      mode: "live",
      count: raw.length,
      universe_size: uniqueItems.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
