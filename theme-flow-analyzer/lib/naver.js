const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://stock.naver.com/",
  Accept: "application/json,text/plain,*/*",
};

function toFloat(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const s = String(value).replace(/[^\d.\-]/g, "");
  if (!s || s === "." || s === "-" || s === "-.") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

async function getJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchRealtimeQuotes(tickers) {
  if (!tickers.length) return {};
  const url = `https://polling.finance.naver.com/api/realtime/domestic/v2/stock?itemCodes=${tickers.join(",")}`;
  const payload = await getJson(url);
  const out = {};
  for (const row of payload.datas || []) {
    const krx = row.krx || {};
    const code = String(row.itemCode || "");
    out[code] = {
      name: String(row.itemName || ""),
      price: toFloat(krx.currentPrice),
      change: toFloat(krx.changePrice),
      change_pct: toFloat(krx.changeRate),
      volume: toFloat(krx.tradingVolume),
      market_status: String(krx.marketState || ""),
      local_traded_at: String(krx.localTradedAt || ""),
    };
  }
  return out;
}

export async function fetchRealtimeIndex(indexCode = "KOSPI") {
  const url = `https://polling.finance.naver.com/api/realtime/domestic/index/${indexCode}`;
  const payload = await getJson(url);
  const row = (payload.datas || [{}])[0];
  return {
    price: toFloat(row.closePrice),
    change_pct: toFloat(row.fluctuationsRatio),
    market_status: String(row.marketStatus || ""),
    as_of: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
}

export async function fetchInvestorTrend(ticker, days = 40) {
  const pageSize = Math.min(Math.max(days, 20), 80);
  const url =
    `https://stock.naver.com/api/domestic/detail/${ticker}/trend` +
    `?tradeType=KRX&startIdx=0&pageSize=${pageSize}`;
  const rows = await getJson(url);
  if (!Array.isArray(rows) || !rows.length) return [];
  const records = [];
  for (const row of rows) {
    const close = toFloat(row.closePrice);
    const biz = String(row.bizdate || "");
    if (biz.length !== 8) continue;
    records.push({
      date: `${biz.slice(0, 4)}-${biz.slice(4, 6)}-${biz.slice(6, 8)}`,
      close,
      foreign: toFloat(row.foreignerPureBuyQuant) * close,
      institution: toFloat(row.organPureBuyQuant) * close,
      individual: toFloat(row.individualPureBuyQuant) * close,
    });
  }
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchDailyPrices(ticker, days = 40) {
  const params = new URLSearchParams({ size: String(Math.min(100, days + 5)) });
  const url =
    `https://stock.naver.com/api/stockSecurity/items/v2/domestic/${ticker}/daily-prices?${params}`;
  const payload = await getJson(url);
  const items = payload.items || [];
  const records = [];
  for (const row of items) {
    const day = String(row.tradingDateKst || "").slice(0, 10);
    if (!day) continue;
    records.push({
      date: day,
      open: toFloat(row.openingPrice),
      high: toFloat(row.highPrice),
      low: toFloat(row.lowPrice),
      close: toFloat(row.closingPrice),
      volume: toFloat(row.tradingVolume),
      value: toFloat(row.tradingValue),
    });
  }
  return records.sort((a, b) => a.date.localeCompare(b.date)).slice(-days);
}
