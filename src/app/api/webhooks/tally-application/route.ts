import {
  buildApplicationNotes,
  parseTallyApplication,
  type TallyWebhookPayload,
} from "@/lib/tally/parse-application";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

function verifyTallySignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.TALLY_WEBHOOK_SECRET?.trim();
  const rawBody = await request.text();

  if (secret) {
    const signature = request.headers.get("tally-signature");
    if (!verifyTallySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: TallyWebhookPayload | null = null;
  try {
    payload = JSON.parse(rawBody) as TallyWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload.eventType && payload.eventType !== "FORM_RESPONSE") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const parsed = parseTallyApplication(payload);
  const notes = buildApplicationNotes(parsed);

  if (!parsed.studentName || !parsed.phone) {
    return NextResponse.json({ error: "필수 필드(이름, 전화)가 누락되었습니다." }, { status: 400 });
  }

  const parentPhone = parsed.parentPhone || parsed.phone;
  const agreePersonalInfo = parsed.agreePrivacy;
  const agreeRefundPolicy =
    parsed.formMode === "trial"
      ? parsed.agreePrivacy
      : parsed.agreeRefund && parsed.agreeMakeup;

  if (!agreePersonalInfo) {
    return NextResponse.json({ error: "개인정보 동의가 필요합니다." }, { status: 400 });
  }

  if (parsed.formMode === "regular" && !agreeRefundPolicy) {
    return NextResponse.json({ error: "환불/보강 규정 동의가 필요합니다." }, { status: 400 });
  }

  if (parsed.formMode === "trial" && (!parsed.trialDate || !parsed.trialDayOfWeek || !parsed.trialClassSlot)) {
    return NextResponse.json(
      { error: "체험수업 필수 항목(날짜, 요일, 반)이 누락되었습니다." },
      { status: 400 }
    );
  }

  if (!parsed.signatureUrl) {
    return NextResponse.json({ error: "서명이 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  if (parsed.formMode === "trial") {
    const { data, error } = await supabase
      .from("trial_class_applications")
      .insert({
        student_name: parsed.studentName,
        phone: parsed.phone,
        parent_phone: parentPhone,
        parent_name: parsed.parentName,
        school: parsed.school,
        agree_personal_info: agreePersonalInfo,
        agree_refund_policy: agreeRefundPolicy,
        status: "pending",
        payment_status: parsed.depositConfirmed ? "paid" : "pending",
        notes: `${notes}\n[address] ${parsed.address ?? "-"}`,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, table: "trial_class_applications" });
  }

  const { data, error } = await supabase
    .from("regular_class_applications")
    .insert({
      student_name: parsed.studentName,
      phone: parsed.phone,
      parent_phone: parentPhone,
      parent_name: parsed.parentName,
      school: parsed.school,
      address: parsed.address,
      agree_personal_info: agreePersonalInfo,
      agree_refund_policy: agreeRefundPolicy,
      status: "pending",
      payment_status: "pending",
      notes,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, table: "regular_class_applications" });
}
