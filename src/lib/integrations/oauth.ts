import type { NextRequest } from "next/server";

export const INTEGRATION_KEYS = {
  naverPlace: "integration_naver_place_oauth",
  kakaoChannel: "integration_kakao_channel_oauth",
  naverState: "integration_naver_place_oauth_state",
  kakaoState: "integration_kakao_channel_oauth_state",
} as const;

export function requestOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function makeState(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function isValidOAuthState(
  raw: unknown,
  inputState: string
): { ok: boolean; reason?: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "state가 저장되지 않았습니다." };
  }
  const o = raw as { state?: unknown; expiresAt?: unknown };
  if (typeof o.state !== "string" || o.state !== inputState) {
    return { ok: false, reason: "state 검증에 실패했습니다." };
  }
  if (typeof o.expiresAt === "string" && Date.now() > Date.parse(o.expiresAt)) {
    return { ok: false, reason: "state가 만료되었습니다." };
  }
  return { ok: true };
}

export function integrationReturnUrl(request: NextRequest, query: string): string {
  return `${requestOrigin(request)}/admin/channel-integrations${query}`;
}

