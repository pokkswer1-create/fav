import { requireRole } from "@/lib/auth/guards";
import {
  computeDeductionBreakdown,
  grossSalaryBeforeBonus,
  type EmployeePayrollInput,
} from "@/lib/payroll/deductions";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function runHasInsuranceBreakdown(run: Record<string, unknown> | undefined): boolean {
  if (!run) return false;
  return (
    typeof run.deduction_pension === "number" &&
    typeof run.deduction_health === "number" &&
    typeof run.deduction_long_term_care === "number" &&
    typeof run.deduction_employment === "number" &&
    typeof run.deduction_other === "number"
  );
}

export async function GET(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const month = new URL(request.url).searchParams.get("month");
  const supabaseServer = getSupabaseServer();
  const { data: employees, error } = await supabaseServer
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!month) return NextResponse.json({ data: employees });

  const { data: runs } = await supabaseServer.from("salary_runs").select("*").eq("month_key", month);
  const runMap = new Map((runs ?? []).map((r) => [r.employee_id, r]));
  const data =
    employees?.map((employee) => {
      const e = employee as EmployeePayrollInput;
      const run = runMap.get(employee.id) as Record<string, unknown> | undefined;
      const bonus = (run?.bonus as number) ?? 0;
      const hours = employee.monthly_work_hours ?? 40;
      const salary =
        (run?.base_salary as number | undefined) ??
        grossSalaryBeforeBonus({ ...e, monthly_work_hours: hours });

      let pension = 0;
      let health = 0;
      let longTermCare = 0;
      let employment = 0;
      let other = 0;
      let deductions = 0;
      let netSalary = 0;

      if (runHasInsuranceBreakdown(run)) {
        pension = run!.deduction_pension as number;
        health = run!.deduction_health as number;
        longTermCare = run!.deduction_long_term_care as number;
        employment = run!.deduction_employment as number;
        other = run!.deduction_other as number;
        deductions = (run!.deductions as number) ?? pension + health + longTermCare + employment + other;
        netSalary = (run!.net_salary as number) ?? salary + bonus - deductions;
      } else {
        const breakdown = computeDeductionBreakdown({ ...e, monthly_work_hours: hours }, bonus);
        pension = breakdown.pension;
        health = breakdown.health;
        longTermCare = breakdown.longTermCare;
        employment = breakdown.employment;
        other = breakdown.other;
        deductions = breakdown.total;
        netSalary = salary + bonus - breakdown.total;
      }

      return {
        id: employee.id,
        name: employee.name,
        salaryType: employee.salary_type,
        salary,
        bonus,
        deductions,
        netSalary,
        monthlyWorkHours: hours,
        taxRate: Number(employee.tax_rate ?? 3.3),
        pensionRate: Number(employee.pension_rate ?? 4.5),
        healthInsuranceRate: Number(employee.health_insurance_rate ?? 3.55),
        longTermCareRate: Number(employee.long_term_care_rate ?? 0.91),
        employmentInsuranceRate: Number(employee.employment_insurance_rate ?? 0.9),
        deductionPension: pension,
        deductionHealth: health,
        deductionLongTermCare: longTermCare,
        deductionEmployment: employment,
        deductionOther: other,
        paidStatus: (run?.paid_status as string) ?? "pending",
      };
    }) ?? [];
  return NextResponse.json({ data });
}
