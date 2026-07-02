import { requireRole } from "@/lib/auth/guards";
import { INTEGRATION_KEYS, makeState, requestOrigin } from "@/lib/integrations/oauth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      { error: "NAVER_CLIENT_ID 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const state = makeState();
  const redirectUri = `${requestOrigin(request)}/api/integrations/naver-place/callback`;
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("academy_settings").upsert(
    {
      setting_key: INTEGRATION_KEYS.naverState,
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

  const authUrl = new URL("https://nid.naver.com/oauth2.0/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}

