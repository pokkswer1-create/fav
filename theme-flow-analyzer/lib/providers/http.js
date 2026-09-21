const UA = "theme-flow-analyzer/1.0";

export async function getJson(url, { headers = {}, timeoutMs = 20000, method = "GET", body } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { "User-Agent": UA, Accept: "application/json", ...headers },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export function toFloat(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const s = String(value).replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
