import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isMissingTableError, supabaseErrorText } from "@/lib/enrollment-db-compat";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const monthKey = searchParams.get("monthKey");
  const limit = Number(searchParams.get("limit") ?? 100);

  const supabaseServer = getSupabaseServer();
  let builder = supabaseServer
    .from("payment_change_logs")
    .select(
      "id, payment_id, student_id, month_key, from_status, to_status, amount_due, amount_paid, reason, created_at, actor_profile_id"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 300));

  if (studentId) builder = builder.eq("student_id", studentId);
  if (monthKey) builder = builder.eq("month_key", monthKey);

  const { data, error } = await builder;
  if (error) {
    const errText = supabaseErrorText(error);
    if (isMissingTableError(errText)) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
