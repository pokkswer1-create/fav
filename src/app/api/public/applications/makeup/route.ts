import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const makeupClassId = body.makeupClassId ? String(body.makeupClassId).trim() : "";
    const studentName = String(body.studentName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const parentPhone = String(body.parentPhone ?? "").trim();
    if (!makeupClassId || !studentName || !phone || !parentPhone) {
      return NextResponse.json({ error: "필수 항목을 입력해주세요." }, { status: 400 });
    }
    if (!body.preferredDate || !body.preferredTime) {
      return NextResponse.json({ error: "희망 일시를 입력해주세요." }, { status: 400 });
    }
    if (!body.agreePersonalInfo || !body.agreeGuidelineConsent) {
      return NextResponse.json({ error: "동의 항목을 확인해주세요." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("makeup_class_applications")
      .insert({
        makeup_class_id: makeupClassId,
        student_name: studentName,
        age: body.age != null ? Number(body.age) : null,
        phone,
        parent_phone: parentPhone,
        preferred_date: body.preferredDate,
        preferred_time: body.preferredTime,
        agree_personal_info: Boolean(body.agreePersonalInfo),
        agree_guideline_consent: Boolean(body.agreeGuidelineConsent),
        status: "pending",
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
