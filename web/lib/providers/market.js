import {
  fetchDailyPrices as naverDaily,
  fetchRealtimeQuotes as naverQuotes,
} from "../naver.js";
import { fetchDailyHistory, fetchRecentDisclosuresForTickers } from "./aikstock.js";
import { dartConfigured, kisConfigured, krxConfigured, providerStatus } from "./config.js";
import { fetchDisclosuresForStock } from "./dart.js";
import { fetchDailyPrices as kisDaily, fetchQuotes as kisQuotes } from "./kis.js";
import { fetchDailyPrices as krxDaily } from "./krx.js";

export { providerStatus };

export async function fetchDailyPricesCascaded(ticker, days = 140) {
  try {
    const rows = await naverDaily(ticker, days);
    if (rows?.length) return { rows, source: "naver" };
  } catch {
    /* fall through */
  }
  if (kisConfigured()) {
    try {
      const rows = await kisDaily(ticker, days);
      if (rows?.length) return { rows, source: "kis" };
    } catch {
      /* fall through */
    }
  }
  try {
    const rows = await fetchDailyHistory(ticker, days);
    if (rows?.length) return { rows, source: "aikstock" };
  } catch {
    /* fall through */
  }
  if (krxConfigured()) {
    try {
      const rows = await krxDaily(ticker, days);
      if (rows?.length) return { rows, source: "krx" };
    } catch {
      /* fall through */
    }
  }
  return { rows: [], source: "none" };
}

export async function fetchQuotesCascaded(tickers) {
  try {
    const quotes = await naverQuotes(tickers);
    if (quotes && Object.keys(quotes).length) return { quotes, source: "naver" };
  } catch {
    /* fall through */
  }
  if (kisConfigured()) {
    try {
      const quotes = await kisQuotes(tickers);
      if (quotes && Object.keys(quotes).length) return { quotes, source: "kis" };
    } catch {
      /* fall through */
    }
  }
  return { quotes: {}, source: "none" };
}

export async function fetchDisclosuresCascaded(tickers) {
  let out = {};
  let source = "none";
  try {
    out = await fetchRecentDisclosuresForTickers(tickers);
    if (out && Object.keys(out).length) source = "aikstock";
  } catch {
    out = {};
  }
  if (dartConfigured()) {
    for (const ticker of tickers) {
      try {
        const rows = await fetchDisclosuresForStock(ticker, 21);
        if (!rows.length) continue;
        const merged = [...(out[ticker] || [])];
        const seen = new Set(merged.map((r) => r.url || r.title));
        for (const row of rows) {
          const key = row.url || row.title;
          if (seen.has(key)) continue;
          merged.push(row);
          seen.add(key);
        }
        out[ticker] = merged.slice(0, 5);
        source = source === "aikstock" ? "dart+aikstock" : "dart";
      } catch {
        /* skip */
      }
    }
  }
  return { disclosures: out, source };
}
