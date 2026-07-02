import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const payload = {
    name: body.name,
    position: body.position,
    employment_type: body.employmentType,
    phone: body.phone ?? null,
    bank_account: body.account ?? null,
    salary_type: body.salaryType,
    monthly_fee: Number(body.monthlyFee ?? 0),
    hourly_rate: Number(body.hourlyRate ?? 0),
    freelance_fee: Number(body.freelanceFee ?? 0),
    monthly_work_hours: Number(body.monthlyWorkHours ?? 40),
    tax_rate: Number(body.taxRate ?? 3.3),
    insurances: body.insurances ?? [],
    pension_rate: Number(body.pensionRate ?? 4.5),
    health_insurance_rate: Number(body.healthInsuranceRate ?? 3.55),
    long_term_care_rate: Number(body.longTermCareRate ?? 0.91),
    employment_insurance_rate: Number(body.employmentInsuranceRate ?? 0.9),
    work_days: body.workDays ?? [],
    start_date: body.startDate,
    end_date: body.endDate ?? null,
  };
  const { data, error } = await supabaseServer.from("employees").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
