import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const classId = new URL(request.url).searchParams.get("classId");
  const supabaseServer = getSupabaseServer();
  let builder = supabaseServer
    .from("class_announcements")
    .select("id, class_id, class_name, title, updated_at, is_active")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (classId) builder = builder.eq("class_id", classId);
  const { data, error } = await builder;
  if (error) {
    if (error.message.includes("class_announcements")) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
