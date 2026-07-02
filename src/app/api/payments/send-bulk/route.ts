import { requireRole } from "@/lib/auth/guards";
import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { mockPaymentProvider } from "@/lib/providers/payment/mock";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type PhoneField = "phone" | "father_phone" | "mother_phone";

function usablePhone(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  if (t === "." || t === "．" || t === "-" || t === "—" || t === "–") return "";
  return t;
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    memberIds?: string[];
    month?: string;
    channel?: string;
    /** 본인 / 부 / 모 중 발송 대상 (미지정 시 기존과 동일: 부 → 학부모공통 → 모) */
    phoneField?: PhoneField;
  };
  const { memberIds, month, channel, phoneField } = body;
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: "memberIds가 필요합니다." }, { status: 400 });
  }

  const supabaseServer = getSupabaseServer();
  const monthKey = month ?? new Date().toISOString().slice(0, 7);
  let sent = 0;
  let failed = 0;

  for (const studentId of memberIds) {
    const { data: payment } = await supabaseServer
      .from("payments")
      .select("id, amount_due, status, students(name, phone, father_phone, mother_phone, parent_phone)")
      .eq("student_id", studentId)
      .eq("month_key", monthKey)
      .maybeSingle();
    if (!payment) {
      failed += 1;
      continue;
    }
    const s = payment.students as {
      name?: string;
      phone?: string;
      father_phone?: string;
      mother_phone?: string;
      parent_phone?: string;
    } | null;

    let toPhone = "";
    if (phoneField === "phone") {
      toPhone = usablePhone(s?.phone);
    } else if (phoneField === "father_phone") {
      toPhone = usablePhone(s?.father_phone);
    } else if (phoneField === "mother_phone") {
      toPhone = usablePhone(s?.mother_phone);
    } else {
      toPhone =
        usablePhone(s?.father_phone) ||
        usablePhone(s?.parent_phone) ||
        usablePhone(s?.mother_phone) ||
        "";
    }

    if (!toPhone) {
      failed += 1;
      continue;
    }

    const studentName = s?.name ?? "학생";
    const paymentLink = await mockPaymentProvider.createPaymentLink({
      studentId,
      amount: Number(payment.amount_due ?? 0),
      monthKey,
    });
    await mockNotificationProvider.send({
      to: toPhone,
      title: "결제 안내",
      body: `${studentName} ${monthKey} 수강료 안내 (${channel ?? "kakao"})\n결제 링크: ${paymentLink.paymentUrl}`,
    });
    sent += 1;
  }

  return NextResponse.json({ sent, failed });
}
