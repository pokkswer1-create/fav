import { requireRole } from "@/lib/auth/guards";
import { INTEGRATION_KEYS, makeState, requestOrigin } from "@/lib/integrations/oauth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const restApiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!restApiKey) {
    return NextResponse.json(
      { error: "KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const state = makeState();
  const redirectUri = `${requestOrigin(request)}/api/integrations/kakao-channel/callback`;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("academy_settings").upsert(
    {
      setting_key: INTEGRATION_KEYS.kakaoState,
      setting_value: {
        state,
        createdBy: guard.userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
      category: "integration",
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const authUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", restApiKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}

