import { requireRole } from "@/lib/auth/guards";
import {
  computeDeductionBreakdown,
  grossSalaryBeforeBonus,
  type EmployeePayrollInput,
} from "@/lib/payroll/deductions";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const body = await request.json().catch(() => ({}));
  const supabaseServer = getSupabaseServer();

  const { data: employees, error } = await supabaseServer.from("employees").select("*").eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const employee of employees ?? []) {
    const e = employee as EmployeePayrollInput;
    const monthlyWorkHours = Number(employee.monthly_work_hours ?? body.monthlyWorkHours ?? 40);
    const baseSalary = grossSalaryBeforeBonus({ ...e, monthly_work_hours: monthlyWorkHours });
    const bonus = Number(body.bonus ?? 0);
    const breakdown = computeDeductionBreakdown({ ...e, monthly_work_hours: monthlyWorkHours }, bonus);
    const netSalary = baseSalary + bonus - breakdown.total;

    const upsertPayload: Record<string, unknown> = {
      employee_id: employee.id,
      month_key: month,
      base_salary: baseSalary,
      bonus,
      deductions: breakdown.total,
      net_salary: netSalary,
      paid_status: "pending",
      deduction_pension: breakdown.pension,
      deduction_health: breakdown.health,
      deduction_long_term_care: breakdown.longTermCare,
      deduction_employment: breakdown.employment,
      deduction_other: breakdown.other,
    };

    const { data: run, error: runError } = await supabaseServer
      .from("salary_runs")
      .upsert(upsertPayload, { onConflict: "employee_id,month_key" })
      .select("*")
      .single();
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
    results.push(run);
  }

  return NextResponse.json({ data: results });
}
