import { requireRole } from "@/lib/auth/guards";
import { monthRange } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const month = new URL(request.url).searchParams.get("month");
  const supabaseServer = getSupabaseServer();
  let builder = supabaseServer.from("expenses").select("*").order("expense_date", { ascending: false });
  if (month) {
    const range = monthRange(month);
    builder = builder.gte("expense_date", range.from).lte("expense_date", range.to);
  }
  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
