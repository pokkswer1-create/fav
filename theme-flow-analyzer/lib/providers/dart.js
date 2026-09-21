import { dartConfigured } from "./config.js";
import { getJson } from "./http.js";

export function normalizeDisclosure(row) {
  const rceptNo = String(row.rcept_no || "");
  const title = String(row.report_nm || row.title || "");
  return {
    ticker: String(row.stock_code || "").padStart(6, "0"),
    title,
    label: "공시",
    fact: title,
    date: String(row.rcept_dt || row.date || ""),
    url: rceptNo ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}` : "",
    source: "dart",
  };
}

export function parseDartListPayload(payload, stockCode) {
  const status = String(payload?.status ?? "");
  if (status && status !== "000" && status !== "0" && status !== "013") {
    if (!payload?.list) return [];
  }
  if (status === "013") return [];
  let rows = payload?.list || [];
  if (stockCode) {
    const code = String(stockCode).padStart(6, "0");
    rows = rows.filter((r) => String(r.stock_code || "").padStart(6, "0") === code);
  }
  return rows;
}

export async function fetchDisclosuresForStock(stockCode, days = 14, pageCount = 20) {
  if (!dartConfigured()) return [];
  const end = new Date();
  const start = new Date(end.getTime() - Math.max(days, 1) * 86400000);
  const fmt = (d) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const qs = new URLSearchParams({
    crtfc_key: process.env.DART_API_KEY,
    bgn_de: fmt(start),
    end_de: fmt(end),
    page_no: "1",
    page_count: String(Math.min(pageCount, 100)),
    sort: "date",
    sort_mth: "desc",
  });
  const payload = await getJson(`https://opendart.fss.or.kr/api/list.json?${qs}`);
  return parseDartListPayload(payload, stockCode).slice(0, 5).map(normalizeDisclosure);
}
