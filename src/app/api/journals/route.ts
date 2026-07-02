import { requireRole } from "@/lib/auth/guards";
import { monthRangeTs } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const teacherId = searchParams.get("teacherId");

  let builder = supabaseServer
    .from("teacher_journals")
    .select("*, profiles!teacher_journals_teacher_profile_id_fkey(full_name), students(id, name)")
    .order("created_at", { ascending: false });

  if (month) {
    const rangeTs = monthRangeTs(month);
    builder = builder.gte("created_at", rangeTs.fromTs).lte("created_at", rangeTs.toTs);
  }
  if (teacherId) {
    builder = builder.eq("teacher_profile_id", teacherId);
  }
  if (guard.role === "teacher") {
    builder = builder.eq("teacher_profile_id", guard.userId);
  }

  const { data, error } = await builder;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const body = await request.json();
  const payload = {
    teacher_profile_id: guard.role === "teacher" ? guard.userId : body.teacher_profile_id,
    category: body.category,
    content: body.content,
    tagged_student_id: body.tagged_student_id || null,
  };

  const { data, error } = await supabaseServer
    .from("teacher_journals")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
