import {
  INTEGRATION_KEYS,
  integrationReturnUrl,
  isValidOAuthState,
  requestOrigin,
} from "@/lib/integrations/oauth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      integrationReturnUrl(
        request,
        `?provider=naver&status=error&message=${encodeURIComponent(providerError)}`
      )
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      integrationReturnUrl(request, "?provider=naver&status=error&message=code/state 누락")
    );
  }

  const supabase = getSupabaseServer();
  const { data: stateRow } = await supabase
    .from("academy_settings")
    .select("setting_value")
    .eq("setting_key", INTEGRATION_KEYS.naverState)
    .maybeSingle();

  const valid = isValidOAuthState(stateRow?.setting_value, state);
  if (!valid.ok) {
    return NextResponse.redirect(
      integrationReturnUrl(
        request,
        `?provider=naver&status=error&message=${encodeURIComponent(valid.reason ?? "state 오류")}`
      )
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      integrationReturnUrl(request, "?provider=naver&status=error&message=네이버 키 미설정")
    );
  }

  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.searchParams.set("grant_type", "authorization_code");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("state", state);

  const tokenRes = await fetch(tokenUrl, { cache: "no-store" });
  const tokenJson = (await tokenRes.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        scope?: string;
        error_description?: string;
      }
    | null;

  if (!tokenRes.ok || !tokenJson?.access_token) {
    const msg = tokenJson?.error_description ?? "네이버 토큰 발급 실패";
    return NextResponse.redirect(
      integrationReturnUrl(request, `?provider=naver&status=error&message=${encodeURIComponent(msg)}`)
    );
  }

  let naverUserId: string | null = null;
  let naverUserName: string | null = null;
  const profileRes = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    cache: "no-store",
  });
  if (profileRes.ok) {
    const profileJson = (await profileRes.json().catch(() => null)) as
      | {
          response?: { id?: string; name?: string; nickname?: string };
        }
      | null;
    naverUserId = profileJson?.response?.id ?? null;
    naverUserName = profileJson?.response?.name ?? profileJson?.response?.nickname ?? null;
  }

  const expiresAt =
    typeof tokenJson.expires_in === "number"
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

  await supabase.from("academy_settings").upsert(
    {
      setting_key: INTEGRATION_KEYS.naverPlace,
      setting_value: {
        provider: "naver_place",
        connected_at: new Date().toISOString(),
        token_type: tokenJson.token_type ?? "bearer",
        scope: tokenJson.scope ?? null,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token ?? null,
        expires_at: expiresAt,
        user: { id: naverUserId, name: naverUserName },
        redirect_origin: requestOrigin(request),
      },
      category: "integration",
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" }
  );

  await supabase.from("academy_settings").delete().eq("setting_key", INTEGRATION_KEYS.naverState);
  return NextResponse.redirect(integrationReturnUrl(request, "?provider=naver&status=connected"));
}

