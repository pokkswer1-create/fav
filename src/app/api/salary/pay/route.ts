import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();

  const { error } = await supabaseServer
    .from("salary_runs")
    .update({ paid_status: "paid", paid_at: new Date().toISOString() })
    .eq("employee_id", body.employeeId)
    .eq("month_key", body.month);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseServer.from("salary_payments").insert({
    employee_id: body.employeeId,
    month_key: body.month,
    amount: Number(body.amount),
    method: body.method ?? "manual",
    receipt_url: body.receiptUrl ?? null,
  });

  return NextResponse.json({ ok: true });
}
