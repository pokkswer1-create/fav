import { krxConfigured } from "./config.js";
import { getJson, toFloat } from "./http.js";

export function parseKrxPricePayload(payload) {
  const body = payload?.response?.body || {};
  let items = body?.items?.item || [];
  if (!Array.isArray(items)) items = items ? [items] : [];
  const records = [];
  for (const row of items) {
    const day = String(row.basDt || "");
    if (day.length !== 8) continue;
    const close = toFloat(row.clpr);
    const vol = toFloat(row.trqu);
    records.push({
      date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
      open: toFloat(row.mkp),
      high: toFloat(row.hipr),
      low: toFloat(row.lopr),
      close,
      volume: vol,
      value: close * vol,
    });
  }
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchDailyPrices(ticker, days = 100) {
  if (!krxConfigured()) return [];
  const key = process.env.KRX_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEY;
  const end = new Date();
  const start = new Date(end.getTime() - (days * 1.8 + 5) * 86400000);
  const fmt = (d) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const qs = new URLSearchParams({
    serviceKey: key,
    numOfRows: String(Math.min(Math.max(days, 1), 100)),
    pageNo: "1",
    resultType: "json",
    likeSrtnCd: ticker,
    beginBasDt: fmt(start),
    endBasDt: fmt(end),
  });
  const payload = await getJson(
    `https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo?${qs}`,
  );
  return parseKrxPricePayload(payload).slice(-days);
}
