import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  let builder = supabaseServer
    .from("salary_statements")
    .select("*, profiles!salary_statements_teacher_profile_id_fkey(full_name)")
    .eq("month_key", month)
    .order("created_at", { ascending: false });

  if (guard.role === "teacher") {
    builder = builder.eq("teacher_profile_id", guard.userId);
  }

  const { data, error } = await builder;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, month });
}
