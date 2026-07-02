import { requireRole } from "@/lib/auth/guards";
import { monthRange } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const month = searchParams.get("month");

  let builder = supabaseServer
    .from("attendance_records")
    .select("*, students(id, name), classes(id, name)")
    .order("class_date", { ascending: false });

  if (classId) {
    builder = builder.eq("class_id", classId);
  }
  if (month) {
    const range = monthRange(month);
    builder = builder.gte("class_date", range.from).lte("class_date", range.to);
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
  if (Array.isArray(body.attendanceList)) {
    const results = [];
    for (const item of body.attendanceList) {
      const payload = {
        class_id: body.classId,
        student_id: item.memberId,
        class_date: body.date,
        status: item.status,
        reason: item.reason || null,
        makeup_status: item.status === "absent" ? "waiting" : null,
        makeup_scheduled_date: item.makeup_scheduled_date || null,
      };

      const { data, error } = await supabaseServer
        .from("attendance_records")
        .insert(payload)
        .select("*, students(id, name), classes(id, name)")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      await supabaseServer.from("attendance_audit_log").insert({
        attendance_record_id: data.id,
        class_id: body.classId,
        student_id: item.memberId,
        old_status: null,
        new_status: item.status,
        instructor_id: body.instructorId ?? "unknown",
        logged_at_time: body.loggedAt ?? new Date().toISOString(),
      });

      results.push(data);
    }

    return NextResponse.json({ data: results }, { status: 201 });
  }

  const payload = {
    class_id: body.class_id,
    student_id: body.student_id,
    class_date: body.class_date,
    status: body.status,
    reason: body.reason || null,
    makeup_status: body.status === "absent" ? "waiting" : body.makeup_status ?? null,
    makeup_scheduled_date: body.makeup_scheduled_date || null,
  };

  const { data, error } = await supabaseServer
    .from("attendance_records")
    .insert(payload)
    .select("*, students(id, name), classes(id, name)")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseServer.from("attendance_audit_log").insert({
    attendance_record_id: data.id,
    class_id: body.class_id,
    student_id: body.student_id,
    old_status: null,
    new_status: body.status,
    instructor_id: body.instructorId ?? "unknown",
    logged_at_time: body.loggedAt ?? new Date().toISOString(),
  });

  return NextResponse.json({ data }, { status: 201 });
}
