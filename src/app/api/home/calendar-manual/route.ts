import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const eventDate = String(body.eventDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return NextResponse.json({ error: "eventDate(YYYY-MM-DD)가 필요합니다." }, { status: 400 });
  }

  const category = String(body.category ?? "기타").trim() || "기타";
  const studentName = body.studentName ? String(body.studentName).trim() : null;
  const className = body.className ? String(body.className).trim() : null;
  const note = body.note ? String(body.note).trim() : null;
  const eventTimeRaw = body.eventTime;
  const eventTime =
    eventTimeRaw && String(eventTimeRaw).trim() !== "" ? String(eventTimeRaw).trim().slice(0, 8) : null;

  const supabase = getSupabaseServer();
  const createdByProfileId =
    process.env.NEXT_PUBLIC_BYPASS_AUTH === "true" ? null : guard.userId;

  const { data, error } = await supabase
    .from("staff_calendar_events")
    .insert({
      event_date: eventDate,
      category,
      student_name: studentName,
      class_name: className,
      event_time: eventTime,
      note,
      created_by_profile_id: createdByProfileId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id 필요" }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("staff_calendar_events").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
