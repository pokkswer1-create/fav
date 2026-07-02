import { requireRole } from "@/lib/auth/guards";
import {
  isMissingEnrollmentDiscountColumn,
  isMissingPaymentsEmbedColumn,
  supabaseErrorText,
} from "@/lib/enrollment-db-compat";
import { calculateFinalFee } from "@/lib/tuition";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { id } = await context.params;
  const { data, error } = await supabaseServer
    .from("students")
    .select(
      `
      *,
      enrollments (
        id,
        class_id,
        classes (id, name, teacher_name, class_type)
      ),
      attendance_records (id, class_date, status, reason, makeup_status),
      payments (id, month_key, amount_due, amount_paid, status, paid_at),
      member_histories (id, action, note, created_at)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { id } = await context.params;
  const body = await request.json();
  const allowedStudentFields = [
    "name",
    "phone",
    "email",
    "birth_date",
    "grade",
    "status",
    "join_date",
    "parent_name",
    "parent_phone",
    "father_phone",
    "mother_phone",
    "notes",
  ] as const;

  const studentPatch: Record<string, unknown> = {};
  for (const key of allowedStudentFields) {
    if (key in body) {
      studentPatch[key] = body[key] ?? null;
    }
  }

  let updatedStudent: Record<string, unknown> | null = null;
  if (Object.keys(studentPatch).length > 0) {
    const studentRes = await supabaseServer
      .from("students")
      .update(studentPatch)
      .eq("id", id)
      .select("*")
      .single();
    if (studentRes.error) {
      return NextResponse.json({ error: studentRes.error.message }, { status: 500 });
    }
    updatedStudent = studentRes.data;
  }

  if (body.enrollment && body.enrollment.class_id) {
    const enrollment = body.enrollment as {
      class_id: string;
      monthly_fee?: number;
      discount_type?: "none" | "amount" | "percent";
      discount_value?: number;
      discount_reason?: string | null;
      discount_start_date?: string | null;
      discount_end_date?: string | null;
    };
    const baseFee = Number(enrollment.monthly_fee ?? 0);
    const discountType = enrollment.discount_type ?? "none";
    const discountValue = Number(enrollment.discount_value ?? 0);
    const finalFee = calculateFinalFee(baseFee, discountType, discountValue);

    const enrollmentRes = await supabaseServer.from("enrollments").upsert(
      {
        student_id: id,
        class_id: enrollment.class_id,
        monthly_fee: baseFee,
        discount_type: discountType,
        discount_value: discountValue,
        discount_reason: enrollment.discount_reason ?? null,
        discount_start_date: enrollment.discount_start_date ?? null,
        discount_end_date: enrollment.discount_end_date ?? null,
        final_fee: finalFee,
      },
      { onConflict: "student_id,class_id" }
    );
    if (enrollmentRes.error && isMissingEnrollmentDiscountColumn(supabaseErrorText(enrollmentRes.error))) {
      const minimal = await supabaseServer.from("enrollments").upsert(
        { student_id: id, class_id: enrollment.class_id, monthly_fee: baseFee },
        { onConflict: "student_id,class_id" }
      );
      if (minimal.error) {
        return NextResponse.json({ error: supabaseErrorText(minimal.error) }, { status: 500 });
      }
    } else if (enrollmentRes.error) {
      return NextResponse.json({ error: supabaseErrorText(enrollmentRes.error) }, { status: 500 });
    }
  }

  if (Array.isArray(body.payments)) {
    for (const item of body.payments as Array<{
      month_key: string;
      amount_due?: number;
      amount_paid?: number;
      status: "paid" | "pending" | "unpaid" | "refunded";
      payment_method?: "online" | "transfer" | "cash" | "card" | "manual";
      notes?: string | null;
      reason?: string;
    }>) {
      const amountDue = Number(item.amount_due ?? 0);
      const amountPaid =
        item.amount_paid != null
          ? Number(item.amount_paid)
          : item.status === "paid"
            ? amountDue
            : 0;
      const upsertRes = await supabaseServer
        .from("payments")
        .upsert(
          {
            student_id: id,
            month_key: item.month_key,
            amount_due: amountDue,
            amount_paid: amountPaid,
            status: item.status,
            payment_method: item.payment_method ?? "manual",
            notes: item.notes ?? null,
            updated_by: guard.userId,
            status_changed_at: new Date().toISOString(),
            paid_at: item.status === "paid" ? new Date().toISOString() : null,
          },
          { onConflict: "student_id,month_key" }
        )
        .select("id")
        .single();
      if (upsertRes.error) {
        return NextResponse.json({ error: upsertRes.error.message }, { status: 500 });
      }

      await supabaseServer.from("payment_change_logs").insert({
        payment_id: upsertRes.data.id,
        student_id: id,
        actor_profile_id: guard.userId,
        month_key: item.month_key,
        to_status: item.status,
        amount_due: amountDue,
        amount_paid: amountPaid,
        reason: item.reason ?? null,
      });
    }
  }

  await supabaseServer.from("member_change_logs").insert({
    student_id: id,
    actor_profile_id: guard.userId,
    action: "member_patch",
    reason: body.reason ?? null,
    before_data: {},
    after_data: {
      studentPatch,
      enrollment: body.enrollment ?? null,
      payments: body.payments ?? [],
    },
  });

  let { data, error } = await supabaseServer
    .from("students")
    .select(
      `
      *,
      enrollments(
        id,
        class_id,
        monthly_fee,
        discount_type,
        discount_value,
        discount_reason,
        discount_start_date,
        discount_end_date,
        final_fee,
        classes(id, name, monthly_fee)
      ),
      payments(id, month_key, amount_due, amount_paid, status, paid_at, payment_method, notes, status_changed_at)
    `
    )
    .eq("id", id)
    .single();

  if (error && isMissingEnrollmentDiscountColumn(supabaseErrorText(error))) {
    const fb = await supabaseServer
      .from("students")
      .select(
        `
      *,
      enrollments(
        id,
        class_id,
        monthly_fee,
        classes(id, name, monthly_fee)
      ),
      payments(id, month_key, amount_due, amount_paid, status, paid_at, payment_method, notes, status_changed_at)
    `
      )
      .eq("id", id)
      .single();
    data = fb.data;
    error = fb.error;
  }
  if (error && isMissingPaymentsEmbedColumn(supabaseErrorText(error))) {
    const fb2 = await supabaseServer
      .from("students")
      .select(
        `
      *,
      enrollments(
        id,
        class_id,
        monthly_fee,
        classes(id, name, monthly_fee)
      ),
      payments(id, month_key, amount_due, amount_paid, status, paid_at)
    `
      )
      .eq("id", id)
      .single();
    data = fb2.data;
    error = fb2.error;
  }
  if (error) {
    return NextResponse.json({ error: supabaseErrorText(error) }, { status: 500 });
  }
  return NextResponse.json({ data: updatedStudent ? { ...data, ...updatedStudent } : data });
}

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { id } = await context.params;
  const { error } = await supabaseServer.from("students").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: `회원 삭제 실패: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
