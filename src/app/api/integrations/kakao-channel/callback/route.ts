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
        `?provider=kakao&status=error&message=${encodeURIComponent(providerError)}`
      )
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(
      integrationReturnUrl(request, "?provider=kakao&status=error&message=code/state 누락")
    );
  }

  const supabase = getSupabaseServer();
  const { data: stateRow } = await supabase
    .from("academy_settings")
    .select("setting_value")
    .eq("setting_key", INTEGRATION_KEYS.kakaoState)
    .maybeSingle();
  const valid = isValidOAuthState(stateRow?.setting_value, state);
  if (!valid.ok) {
    return NextResponse.redirect(
      integrationReturnUrl(
        request,
        `?provider=kakao&status=error&message=${encodeURIComponent(valid.reason ?? "state 오류")}`
      )
    );
  }

  const restApiKey = process.env.KAKAO_REST_API_KEY?.trim();
  const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  if (!restApiKey) {
    return NextResponse.redirect(
      integrationReturnUrl(request, "?provider=kakao&status=error&message=카카오 키 미설정")
    );
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("client_id", restApiKey);
  tokenBody.set("redirect_uri", `${requestOrigin(request)}/api/integrations/kakao-channel/callback`);
  tokenBody.set("code", code);
  if (clientSecret) tokenBody.set("client_secret", clientSecret);

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: tokenBody.toString(),
    cache: "no-store",
  });
  const tokenJson = (await tokenRes.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        scope?: string;
        refresh_token_expires_in?: number;
        error_description?: string;
      }
    | null;

  if (!tokenRes.ok || !tokenJson?.access_token) {
    const msg = tokenJson?.error_description ?? "카카오 토큰 발급 실패";
    return NextResponse.redirect(
      integrationReturnUrl(request, `?provider=kakao&status=error&message=${encodeURIComponent(msg)}`)
    );
  }

  let kakaoUserId: string | null = null;
  let kakaoUserName: string | null = null;
  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    cache: "no-store",
  });
  if (profileRes.ok) {
    const profileJson = (await profileRes.json().catch(() => null)) as
      | {
          id?: number;
          properties?: { nickname?: string };
          kakao_account?: { profile?: { nickname?: string } };
        }
      | null;
    kakaoUserId = profileJson?.id ? String(profileJson.id) : null;
    kakaoUserName =
      profileJson?.kakao_account?.profile?.nickname ?? profileJson?.properties?.nickname ?? null;
  }

  const expiresAt =
    typeof tokenJson.expires_in === "number"
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;
  const refreshExpiresAt =
    typeof tokenJson.refresh_token_expires_in === "number"
      ? new Date(Date.now() + tokenJson.refresh_token_expires_in * 1000).toISOString()
      : null;

  await supabase.from("academy_settings").upsert(
    {
      setting_key: INTEGRATION_KEYS.kakaoChannel,
      setting_value: {
        provider: "kakao_channel",
        connected_at: new Date().toISOString(),
        token_type: tokenJson.token_type ?? "bearer",
        scope: tokenJson.scope ?? null,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token ?? null,
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        user: { id: kakaoUserId, name: kakaoUserName },
        redirect_origin: requestOrigin(request),
      },
      category: "integration",
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" }
  );

  await supabase.from("academy_settings").delete().eq("setting_key", INTEGRATION_KEYS.kakaoState);
  return NextResponse.redirect(integrationReturnUrl(request, "?provider=kakao&status=connected"));
}

