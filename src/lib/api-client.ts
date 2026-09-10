export function getClientApiKey(): string {
  return process.env.NEXT_PUBLIC_FAV_API_KEY?.trim() || "fav-local-dev-key";
}

export function withApiKeyHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("x-fav-api-key", getClientApiKey());
  return headers;
}

export function sampleVideoUrl(): string {
  return `/api/video/highlights?key=${encodeURIComponent(getClientApiKey())}`;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = withApiKeyHeaders(init.headers);
  return fetch(input, { ...init, headers });
}
