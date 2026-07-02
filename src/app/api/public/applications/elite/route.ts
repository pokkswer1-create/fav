import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentName = String(body.studentName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const parentPhone = String(body.parentPhone ?? "").trim();
    const school = String(body.school ?? "").trim();
    if (!studentName || !phone || !parentPhone || !school) {
      return NextResponse.json({ error: "필수 항목을 입력해주세요." }, { status: 400 });
    }
    if (!body.agreePersonalInfo || !body.agreeActivityConsent) {
      return NextResponse.json({ error: "동의 항목을 확인해주세요." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("elite_team_applications")
      .insert({
        student_name: studentName,
        age: body.age != null ? Number(body.age) : null,
        phone,
        school,
        parent_phone: parentPhone,
        parent_name: body.parentName ? String(body.parentName) : null,
        agree_personal_info: Boolean(body.agreePersonalInfo),
        agree_activity_consent: Boolean(body.agreeActivityConsent),
        test_date: body.testDate || null,
        test_time: body.testTime || null,
        test_location: body.testLocation ? String(body.testLocation) : null,
        status: "pending",
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
