import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("salary_runs")
    .select("*, employees(name)")
    .eq("month_key", month);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalPayroll = (data ?? []).reduce((sum, row) => sum + (row.net_salary ?? 0), 0);
  const stats = {
    average: data?.length ? Math.round(totalPayroll / data.length) : 0,
    count: data?.length ?? 0,
  };
  return NextResponse.json({ totalPayroll, byEmployee: data ?? [], stats });
}
