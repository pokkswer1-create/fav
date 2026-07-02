import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const body = await request.json();
  const grade: string = body.grade;
  const monthlyFee = Number(body.monthlyFee ?? 0);
  const supabaseServer = getSupabaseServer();

  const { data: reservation, error: findError } = await supabaseServer
    .from("naver_reservations")
    .select("*")
    .eq("id", id)
    .single();
  if (findError) return NextResponse.json({ success: false, message: findError.message }, { status: 500 });

  const { data: existingStudent } = await supabaseServer
    .from("students")
    .select("*")
    .eq("phone", reservation.customer_phone)
    .maybeSingle();

  let studentId = existingStudent?.id as string | undefined;
  if (!studentId) {
    const { data: newStudent, error: createError } = await supabaseServer
      .from("students")
      .insert({
        name: reservation.customer_name,
        phone: reservation.customer_phone,
        email: reservation.customer_email,
        grade,
        status: "active",
        join_date: new Date().toISOString().slice(0, 10),
        notes: "source: naver_place",
      })
      .select("*")
      .single();
    if (createError) {
      return NextResponse.json({ success: false, message: createError.message }, { status: 500 });
    }
    studentId = newStudent.id;
  } else {
    await supabaseServer
      .from("students")
      .update({ grade, status: "active" })
      .eq("id", studentId);
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  await supabaseServer.from("payments").upsert(
    {
      student_id: studentId,
      month_key: monthKey,
      amount_due: monthlyFee,
      amount_paid: 0,
      status: "pending",
    },
    { onConflict: "student_id,month_key" }
  );

  const { error: updateError } = await supabaseServer
    .from("naver_reservations")
    .update({
      student_id: studentId,
      is_converted: true,
      status: "converted",
    })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ success: false, message: updateError.message }, { status: 500 });
  }

  await mockNotificationProvider.send({
    to: reservation.customer_phone,
    title: "정규 회원 전환 안내",
    body: `${reservation.customer_name}님 정규 회원 등록이 완료되었습니다.`,
  });

  return NextResponse.json({ success: true, memberId: studentId, message: "정규 회원으로 전환되었습니다." });
}
