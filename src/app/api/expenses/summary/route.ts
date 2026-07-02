import { requireRole } from "@/lib/auth/guards";
import { monthRange } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const supabaseServer = getSupabaseServer();
  const range = monthRange(month);
  const [{ data: expenses }, { data: payments }] = await Promise.all([
    supabaseServer.from("expenses").select("category, amount").gte("expense_date", range.from).lte("expense_date", range.to),
    supabaseServer.from("payments").select("amount_paid").eq("month_key", month),
  ]);
  const byCategory: Record<string, number> = {};
  for (const row of expenses ?? []) {
    byCategory[row.category] = (byCategory[row.category] ?? 0) + (row.amount ?? 0);
  }
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const revenue = (payments ?? []).reduce((s, v) => s + (v.amount_paid ?? 0), 0);
  const ratio = revenue ? Number(((total / revenue) * 100).toFixed(1)) : 0;
  const profitMargin = revenue ? Number((((revenue - total) / revenue) * 100).toFixed(1)) : 0;
  return NextResponse.json({ byCategory, total, ratio, profitMargin });
}
