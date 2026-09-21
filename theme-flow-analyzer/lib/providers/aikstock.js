import { getJson, toFloat } from "./http.js";

export function parseHistoryPayload(payload) {
  const rows = payload?.rows || [];
  const records = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const day = String(row[0] || "");
    if (day.length !== 8) continue;
    const close = toFloat(row[1]);
    const vol = toFloat(row[2] || 0);
    records.push({
      date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
      open: close,
      high: close,
      low: close,
      close,
      volume: vol,
      value: close * vol,
    });
  }
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseDisclosureItems(payload, tickers) {
  const wanted = tickers ? new Set([...tickers].map((t) => String(t).padStart(6, "0"))) : null;
  const items = payload?.items || payload?.top_disclosures || [];
  const out = {};
  for (const item of items) {
    const code = String(item.code || "").padStart(6, "0");
    if (wanted && !wanted.has(code)) continue;
    const row = {
      ticker: code,
      title: String(item.title || item.report_nm || ""),
      label: String(item.label || item.cat || "공시"),
      fact: String(item.fact || ""),
      date: String(item.rcept_dt || item.date || ""),
      url: String(item.url || item.dart_url || ""),
      source: "aikstock",
    };
    if (!out[code]) out[code] = [];
    out[code].push(row);
  }
  return out;
}

export async function fetchDailyHistory(ticker, days = 140) {
  const payload = await getJson(`https://aikstockdata.com/data/public/s/${ticker}_history.json`);
  return parseHistoryPayload(payload).slice(-days);
}

export async function fetchRecentDisclosuresForTickers(tickers) {
  const payload = await getJson("https://aikstockdata.com/data/public/disclosures_top100.json");
  return parseDisclosureItems(payload, tickers);
}
