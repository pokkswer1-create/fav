import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isMissingTableError, supabaseErrorText } from "@/lib/enrollment-db-compat";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const limit = Number(searchParams.get("limit") ?? 50);

  const supabaseServer = getSupabaseServer();
  let builder = supabaseServer
    .from("member_change_logs")
    .select("id, student_id, action, reason, before_data, after_data, created_at, actor_profile_id")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (studentId) builder = builder.eq("student_id", studentId);

  const { data, error } = await builder;
  if (error) {
    const errText = supabaseErrorText(error);
    if (isMissingTableError(errText)) {
      // DB 마이그레이션이 아직 안 된 상태에서도 페이지가 깨지지 않게 빈 배열 반환
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
