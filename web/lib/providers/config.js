function truthy(v) {
  return ["1", "true", "yes", "y", "on"].includes(String(v || "").trim().toLowerCase());
}

export function kisConfigured() {
  return !!(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
}

export function dartConfigured() {
  return String(process.env.DART_API_KEY || "").trim().length >= 20;
}

export function krxConfigured() {
  return !!(process.env.KRX_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEY);
}

export function kisBaseUrl() {
  if (truthy(process.env.KIS_USE_MOCK)) {
    return "https://openapivts.koreainvestment.com:29443";
  }
  return "https://openapi.koreainvestment.com:9443";
}

export function providerStatus() {
  return {
    naver: true,
    aikstock: true,
    kis: kisConfigured(),
    dart: dartConfigured(),
    krx: krxConfigured(),
    kis_mock: kisConfigured() && truthy(process.env.KIS_USE_MOCK),
    citation: "Source: aikstockdata (when used) — FSS DART / FSC open data",
  };
}
