import { fullMarketSize, listThemes, stocksForTheme } from "../lib/themes.js";
import { fetchInvestorTrend, fetchRealtimeIndex } from "../lib/naver.js";
import {
  actionComment,
  marketRegime,
  scoreMoneyInPriceFlat,
} from "../lib/screener.js";
import {
  backtestSetupExpectancy,
  beginnerExplain,
  detectBreakout,
} from "../lib/signals.js";
import { riskPlan } from "../lib/risk.js";
import {
  fetchDailyPricesCascaded,
  fetchDisclosuresCascaded,
  fetchQuotesCascaded,
  providerStatus,
} from "../lib/providers/market.js";
import { buildTieredPicks } from "../lib/tiers.js";

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

async function buildSnapshot(item, lookbackDays, quote, disclosures) {
  const days = Math.max(lookbackDays + 80, 120);
  const [{ rows: ohlcv, source }, flowRaw] = await Promise.all([
    fetchDailyPricesCascaded(item.ticker, days),
    fetchInvestorTrend(item.ticker, Math.min(days, 80)).catch(() => []),
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
    data_source: source,
    disclosures: disclosures || [],
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
    const scanLimit = Number(url.searchParams.get("scan_limit") || 80);
    const fullMarket = theme === "전체" || theme === "ALL";
    const effectiveLimit = fullMarket ? Math.min(Math.max(scanLimit, 40), 120) : 9999;

    const idx = await fetchRealtimeIndex("KOSPI");
    const smartProxy = Number(idx.change_pct || 0) >= 0 ? 1 : -1;
    const regime = marketRegime(Number(idx.change_pct || 0), smartProxy);
    const universe = await stocksForTheme(theme, {
      fullMarket,
      scanLimit: effectiveLimit,
    });
    const marketTotal = fullMarket ? await fullMarketSize() : universe.length;
    const uniqueItems = [];
    const seenTickers = new Set();
    for (const item of universe) {
      if (seenTickers.has(item.ticker)) continue;
      seenTickers.add(item.ticker);
      uniqueItems.push(item);
    }
    const [{ quotes, source: quoteSource }, { disclosures, source: disclosureSource }] =
      await Promise.all([
        fetchQuotesCascaded(uniqueItems.map((u) => u.ticker)),
        fetchDisclosuresCascaded(uniqueItems.map((u) => u.ticker)),
      ]);

    const snapshots = (
      await mapPool(uniqueItems, 8, async (item) => {
        try {
          return await buildSnapshot(
            item,
            lookback,
            quotes[item.ticker],
            disclosures[item.ticker] || [],
          );
        } catch {
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

    const actioned = raw.map((row) => {
      const comment = actionComment(row, regime);
      const item = { ...row, action: comment.action, reason: comment.reason };
      const explain = beginnerExplain(item, regime);
      return {
        ...item,
        beginner_summary: explain.summary,
        beginner_backtest: explain.backtest,
        beginner_guide: explain.guide,
        beginner_disclosure: explain.disclosure || "",
        beginner_full: explain.full,
      };
    });

    const tiers = buildTieredPicks(actioned, { regime, topN });
    const picks = tiers.picks;

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
      short_buy: tiers.short_buy,
      short_watch: tiers.short_watch,
      long_buy: tiers.long_buy,
      long_watch: tiers.long_watch,
      buy_count: tiers.buy_count,
      watch_count: tiers.watch_count,
      defense_buys_blocked: tiers.defense_buys_blocked,
      tier_rules: tiers.rules,
      theme_top,
      themes: listThemes(),
      scanned_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      mode: "live",
      count: raw.length,
      universe_size: uniqueItems.length,
      market_total: marketTotal,
      scan_limit: fullMarket ? effectiveLimit : uniqueItems.length,
      full_market: fullMarket,
      providers: providerStatus(),
      quote_source: quoteSource,
      disclosure_source: disclosureSource,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
}
