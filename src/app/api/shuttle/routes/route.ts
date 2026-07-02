import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const day = new URL(request.url).searchParams.get("day");
  const supabaseServer = getSupabaseServer();
  let builder = supabaseServer
    .from("shuttle_routes")
    .select("*, shuttle_registrations(id)")
    .eq("is_active", true)
    .order("start_time", { ascending: true });
  if (day) builder = builder.eq("day_of_week", day);
  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
