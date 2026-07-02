import { requireRole } from "@/lib/auth/guards";
import { INTEGRATION_KEYS } from "@/lib/integrations/oauth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("academy_settings")
    .select("setting_value, last_updated_at")
    .eq("setting_key", INTEGRATION_KEYS.kakaoChannel)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const setting = (data?.setting_value ?? null) as
    | {
        connected_at?: string;
        expires_at?: string | null;
        scope?: string | null;
        user?: { id?: string | null; name?: string | null };
      }
    | null;
  return NextResponse.json({
    connected: Boolean(setting),
    provider: "kakao",
    connectedAt: setting?.connected_at ?? null,
    expiresAt: setting?.expires_at ?? null,
    scope: setting?.scope ?? null,
    user: setting?.user ?? null,
    updatedAt: data?.last_updated_at ?? null,
  });
}

export async function DELETE() {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("academy_settings")
    .delete()
    .eq("setting_key", INTEGRATION_KEYS.kakaoChannel);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

