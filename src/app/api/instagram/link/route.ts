import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("instagram_links")
    .select("instagram_business_id, created_at, expires_at")
    .eq("owner_profile_id", guard.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ link: data ?? null });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const { businessId, accessToken, expiresAt } = await request.json();
  if (!businessId || !accessToken) {
    return NextResponse.json(
      { error: "businessId / accessToken 은 필수입니다." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("instagram_links").upsert(
    {
      owner_profile_id: guard.userId,
      instagram_business_id: String(businessId),
      access_token: String(accessToken),
      expires_at: expiresAt ? new Date(expiresAt) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_profile_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("instagram_links")
    .delete()
    .eq("owner_profile_id", guard.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

