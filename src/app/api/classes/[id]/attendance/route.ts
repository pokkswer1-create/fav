import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  let builder = supabaseServer
    .from("attendance_records")
    .select("id, student_id, status, class_date, created_at, students(id, name)")
    .eq("class_id", id)
    .order("created_at", { ascending: false });
  if (date) builder = builder.eq("class_date", date);

  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
