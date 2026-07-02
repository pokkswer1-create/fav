import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const KEY_CATEGORY: Record<string, string> = {
  site_branding: "branding",
  tuition: "tuition",
  preparation_items: "preparation",
  shuttle_info: "shuttle",
  payment_guide: "payment",
  makeup_policy: "makeup",
  refund_policy: "refund",
};

export async function GET() {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("academy_settings")
    .select("setting_key, setting_value, category, last_updated_at")
    .order("setting_key");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function PUT(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const key = String(body.settingKey ?? "").trim();
  const value = body.settingValue;
  if (!key || value === undefined) {
    return NextResponse.json({ error: "settingKey, settingValue가 필요합니다." }, { status: 400 });
  }

  const category = KEY_CATEGORY[key] ?? "general";
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("academy_settings").upsert(
    {
      setting_key: key,
      setting_value: value,
      category,
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
