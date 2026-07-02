import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("kakao_class_listings")
    .select("*, classes(id, name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();

  const payload = {
    class_id: body.class_id ?? null,
    kakao_class_id: body.kakao_class_id ?? null,
    kakao_display_name: body.kakao_display_name,
    kakao_description: body.kakao_description ?? null,
    kakao_price: Number(body.kakao_price ?? 0),
    available_times: body.available_times ?? [],
    available_days: body.available_days ?? [],
    rich_menu_button_id: body.rich_menu_button_id ?? null,
    is_active: body.is_active ?? true,
  };
  const { data, error } = await supabaseServer
    .from("kakao_class_listings")
    .upsert(payload, { onConflict: "kakao_class_id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
