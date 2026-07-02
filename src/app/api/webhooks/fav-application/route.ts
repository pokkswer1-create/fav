import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type FavApplyPayload = {
  formMode?: "regular" | "trial";
  name?: string;
  phone?: string;
  guardianPhone?: string;
  address?: string;
  programType?: string;
  grade?: string;
  participantCount?: number;
  paymentMethod?: string;
  agreePrivacy?: boolean;
  agreeMakeup?: boolean;
  source?: string;
};

export async function POST(request: Request) {
  const secret = process.env.FAV_WEBHOOK_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as FavApplyPayload | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const studentName = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const parentPhone = String(body.guardianPhone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const programType = String(body.programType ?? "").trim();
  const grade = String(body.grade ?? "").trim();
  const participantCount = Number.isFinite(body.participantCount)
    ? Number(body.participantCount)
    : 1;

  if (!studentName || !phone || !parentPhone || !programType) {
    return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const notes = [
    `[source] ${body.source || "fav2"}`,
    `[program] ${programType}`,
    `[participantCount] ${participantCount}`,
    `[paymentMethod] ${body.paymentMethod || "-"}`,
    `[agreePrivacy] ${Boolean(body.agreePrivacy)}`,
    `[agreeMakeup] ${Boolean(body.agreeMakeup)}`,
  ].join("\n");

  if (body.formMode === "trial") {
    const { data, error } = await supabase
      .from("trial_class_applications")
      .insert({
        student_name: studentName,
        phone,
        parent_phone: parentPhone,
        parent_name: null,
        school: grade || null,
        agree_personal_info: Boolean(body.agreePrivacy),
        agree_refund_policy: Boolean(body.agreeMakeup),
        status: "pending",
        payment_status: "pending",
        notes: `${notes}\n[address] ${address || "-"}`,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, table: "trial_class_applications" });
  }

  const { data, error } = await supabase
    .from("regular_class_applications")
    .insert({
      student_name: studentName,
      phone,
      parent_phone: parentPhone,
      parent_name: null,
      school: grade || null,
      address: address || null,
      agree_personal_info: Boolean(body.agreePrivacy),
      agree_refund_policy: Boolean(body.agreeMakeup),
      status: "pending",
      payment_status: "pending",
      notes,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, table: "regular_class_applications" });
}

