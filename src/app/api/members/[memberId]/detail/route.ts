import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ memberId: string }> };

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { memberId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { data: member, error } = await supabaseServer
    .from("students")
    .select("*")
    .eq("id", memberId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [payments, attendance, notes, history] = await Promise.all([
    supabaseServer.from("payments").select("*").eq("student_id", memberId).order("month_key", { ascending: false }),
    supabaseServer.from("attendance_records").select("*").eq("student_id", memberId).order("class_date", { ascending: false }),
    Promise.resolve({ data: [{ text: member.notes ?? "" }] }),
    supabaseServer.from("member_histories").select("*").eq("student_id", memberId).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    member,
    payments: payments.data ?? [],
    attendance: attendance.data ?? [],
    notes: notes.data ?? [],
    history: history.data ?? [],
  });
}
