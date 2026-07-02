import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");

  let builder = supabaseServer
    .from("naver_reservations")
    .select("*")
    .order("reservation_date", { ascending: true })
    .order("reservation_time", { ascending: true });

  if (status && status !== "all") builder = builder.eq("status", status);
  if (fromDate) builder = builder.gte("reservation_date", fromDate);
  if (toDate) builder = builder.lte("reservation_date", toDate);

  const { data, error } = await builder;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  return NextResponse.json({ success: true, reservations: data, count: data?.length ?? 0 });
}
