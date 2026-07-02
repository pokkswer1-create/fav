import { requireRole } from "@/lib/auth/guards";
import { monthRange, monthRangeTs } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const body = await request.json();
  const monthKey: string = body.month_key ?? new Date().toISOString().slice(0, 7);

  const range = monthRange(monthKey);
  const rangeTs = monthRangeTs(monthKey);

  const [teachersRes, policiesRes, attendanceRes, journalsRes] = await Promise.all([
    supabaseServer.from("profiles").select("id, full_name").eq("role", "teacher"),
    supabaseServer.from("salary_policies").select("*"),
    supabaseServer
      .from("attendance_records")
      .select("id, class_id, class_date, classes(teacher_name)")
      .gte("class_date", range.from)
      .lte("class_date", range.to),
    supabaseServer
      .from("teacher_journals")
      .select("id, teacher_profile_id, created_at")
      .gte("created_at", rangeTs.fromTs)
      .lte("created_at", rangeTs.toTs),
  ]);

  if (teachersRes.error || policiesRes.error || attendanceRes.error || journalsRes.error) {
    return NextResponse.json(
      {
        error:
          teachersRes.error?.message ??
          policiesRes.error?.message ??
          attendanceRes.error?.message ??
          journalsRes.error?.message,
      },
      { status: 500 }
    );
  }

  const teachers = teachersRes.data ?? [];
  const policies = policiesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const journals = journalsRes.data ?? [];

  const policyMap = new Map(policies.map((p) => [p.teacher_profile_id, p]));
  const teacherNameMap = new Map(teachers.map((t) => [t.id, t.full_name]));

  const rows = teachers.map((teacher) => {
    const policy = policyMap.get(teacher.id) ?? {
      base_salary: 2000000,
      class_bonus_per_record: 3000,
      journal_bonus_per_record: 5000,
      deduction_rate: 5,
    };

    const classCount = attendance.filter((a) => {
      const classTeacher = (a.classes as { teacher_name?: string } | null)?.teacher_name;
      return classTeacher === teacher.full_name;
    }).length;
    const journalCount = journals.filter((j) => j.teacher_profile_id === teacher.id).length;

    const bonusAmount =
      classCount * Number(policy.class_bonus_per_record) +
      journalCount * Number(policy.journal_bonus_per_record);
    const gross = Number(policy.base_salary) + bonusAmount;
    const deductionAmount = Math.round(gross * (Number(policy.deduction_rate) / 100));
    const netSalary = gross - deductionAmount;

    return {
      teacher_profile_id: teacher.id,
      month_key: monthKey,
      base_salary: Number(policy.base_salary),
      bonus_amount: bonusAmount,
      deduction_amount: deductionAmount,
      net_salary: netSalary,
      status: "calculated",
      paid_at: null,
      _meta: {
        teacherName: teacherNameMap.get(teacher.id) ?? teacher.id,
        classCount,
        journalCount,
      },
    };
  });

  const upsertRows = rows.map((row) => ({
    teacher_profile_id: row.teacher_profile_id,
    month_key: row.month_key,
    base_salary: row.base_salary,
    bonus_amount: row.bonus_amount,
    deduction_amount: row.deduction_amount,
    net_salary: row.net_salary,
    status: row.status,
    paid_at: row.paid_at,
  }));
  const { data, error } = await supabaseServer
    .from("salary_statements")
    .upsert(upsertRows, { onConflict: "teacher_profile_id,month_key" })
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    calculatedCount: data?.length ?? 0,
    breakdown: rows.map((row) => row._meta),
  });
}
