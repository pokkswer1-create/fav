import { getJson } from "./providers/http.js";

let cache = { ts: 0, rows: [] };
const TTL = 6 * 3600 * 1000;

function normalizeCode(code) {
  return String(code || "").padStart(6, "0");
}

export function parseQuotesUniverse(payload) {
  const items = payload?.items || payload?.rows || [];
  const best = new Map();
  for (const row of items) {
    let rec;
    if (Array.isArray(row) && row.length >= 2) {
      rec = {
        ticker: normalizeCode(row[0]),
        name: String(row[1]),
        theme: String(row[2] || "KOSPI"),
        market: String(row[2] || "KOSPI"),
        trade_value: 0,
        market_cap: 0,
        close: 0,
      };
    } else if (row && typeof row === "object") {
      rec = {
        ticker: normalizeCode(row["종목코드"] || row.code || row.ticker),
        name: String(row["종목명"] || row.name || row.name_ko || ""),
        theme: String(row.mrktCtg || row.market || "전체"),
        market: String(row.mrktCtg || row.market || "전체"),
        trade_value: Number(row.trPrc || row.trade_value || 0),
        market_cap: Number(row.mrktTotAmt || row.market_cap || 0),
        close: Number(row.clpr || row.close || 0),
      };
    } else continue;
    if (rec.ticker.length !== 6 || !/^\d{6}$/.test(rec.ticker)) continue;
    const prev = best.get(rec.ticker);
    if (!prev || rec.trade_value >= prev.trade_value) best.set(rec.ticker, rec);
  }
  return [...best.values()];
}

export function selectScanUniverse(rows, { limit = 150, minTradeValue = 1e9 } = {}) {
  let liquid = rows.filter(
    (r) => Number(r.trade_value || 0) >= minTradeValue || Number(r.market_cap || 0) >= 5e11,
  );
  if (!liquid.length) liquid = [...rows];
  liquid.sort(
    (a, b) =>
      Number(b.trade_value || 0) - Number(a.trade_value || 0) ||
      Number(b.market_cap || 0) - Number(a.market_cap || 0),
  );
  return liquid.slice(0, Math.max(1, limit));
}

export async function loadFullUniverse(force = false) {
  const now = Date.now();
  if (!force && cache.rows.length && now - cache.ts < TTL) return cache.rows;
  let rows = [];
  try {
    const payload = await getJson("https://aikstockdata.com/data/public/quotes.json", {
      timeoutMs: 40000,
    });
    rows = parseQuotesUniverse(payload);
  } catch {
    rows = [];
  }
  if (!rows.length) {
    try {
      const payload = await getJson(
        "https://aikstockdata.com/data/public/search_index_rows.json",
        { timeoutMs: 40000 },
      );
      rows = parseQuotesUniverse(payload);
    } catch {
      rows = [];
    }
  }
  cache = { ts: now, rows };
  return rows;
}
