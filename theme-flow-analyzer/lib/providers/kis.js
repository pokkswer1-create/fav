import { kisBaseUrl, kisConfigured } from "./config.js";
import { getJson, toFloat } from "./http.js";

let tokenCache = { token: "", expiresAt: 0 };

async function getAccessToken(force = false) {
  if (!kisConfigured()) return "";
  const now = Date.now();
  if (!force && tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  const payload = await getJson(`${kisBaseUrl()}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });
  tokenCache = {
    token: String(payload.access_token || ""),
    expiresAt: now + Number(payload.expires_in || 86400) * 1000,
  };
  return tokenCache.token;
}

async function authHeaders(trId) {
  return {
    authorization: `Bearer ${await getAccessToken()}`,
    appkey: process.env.KIS_APP_KEY,
    appsecret: process.env.KIS_APP_SECRET,
    tr_id: trId,
    custtype: "P",
  };
}

export function parsePriceQuote(payload) {
  const out = payload?.output || {};
  return {
    name: String(out.hts_kor_isnm || ""),
    price: toFloat(out.stck_prpr),
    change: toFloat(out.prdy_vrss),
    change_pct: toFloat(out.prdy_ctrt),
    volume: toFloat(out.acml_vol),
    market_status: "KIS",
    local_traded_at: "",
  };
}

export function parseDailyPricePayload(payload) {
  const rows = payload?.output || [];
  const records = [];
  for (const row of rows) {
    const day = String(row.stck_bsop_date || "");
    if (day.length !== 8) continue;
    const close = toFloat(row.stck_clpr);
    const vol = toFloat(row.acml_vol);
    records.push({
      date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`,
      open: toFloat(row.stck_oprc),
      high: toFloat(row.stck_hgpr),
      low: toFloat(row.stck_lwpr),
      close,
      volume: vol,
      value: close * vol,
    });
  }
  return records.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchQuote(ticker) {
  if (!kisConfigured()) return null;
  const qs = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: ticker,
  });
  const payload = await getJson(
    `${kisBaseUrl()}/uapi/domestic-stock/v1/quotations/inquire-price?${qs}`,
    { headers: await authHeaders("FHKST01010100") },
  );
  if (String(payload.rt_cd) !== "0") return null;
  return parsePriceQuote(payload);
}

export async function fetchQuotes(tickers) {
  const out = {};
  for (const ticker of tickers) {
    try {
      const q = await fetchQuote(ticker);
      if (q?.price) out[ticker] = q;
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function fetchDailyPrices(ticker, days = 100) {
  if (!kisConfigured()) return [];
  const qs = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: ticker,
    FID_ORG_ADJ_PRC: "0",
    FID_PERIOD_DIV_CODE: "D",
  });
  const payload = await getJson(
    `${kisBaseUrl()}/uapi/domestic-stock/v1/quotations/inquire-daily-price?${qs}`,
    { headers: await authHeaders("FHKST01010400") },
  );
  if (String(payload.rt_cd) !== "0") return [];
  return parseDailyPricePayload(payload).slice(-days);
}
