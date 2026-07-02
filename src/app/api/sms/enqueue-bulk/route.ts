import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const { memberIds, message, meta } = await request.json();

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "memberIds가 필요합니다." }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, name, parent_phone, phone")
    .in("id", memberIds);

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  const rows =
    (students ?? [])
      .map((s) => {
        const to = s.parent_phone || s.phone;
        if (!to) return null;
        return {
          to_phone: to,
          message,
          meta: {
            ...(meta ?? {}),
            student_id: s.id,
            student_name: s.name,
          },
          status: "pending" as const,
        };
      })
      .filter(Boolean) ?? [];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "연락처가 있는 회원이 없습니다.", skipped: memberIds.length },
      { status: 400 },
    );
  }

  const { error: insertError } = await supabase.from("sms_queue").insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    enqueued: rows.length,
    requested: memberIds.length,
  });
}

