import { requireRole } from "@/lib/auth/guards";
import { monthRangeTs } from "@/lib/month-range";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const supabaseServer = getSupabaseServer();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const rangeTs = monthRangeTs(month);

  const { data, error } = await supabaseServer
    .from("teacher_journals")
    .select("category, teacher_profile_id, created_at")
    .gte("created_at", rangeTs.fromTs)
    .lte("created_at", rangeTs.toTs);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byCategory: Record<string, number> = {};
  const byInstructor: Record<string, number> = {};
  const heatmap: Record<string, number> = {};

  for (const item of data ?? []) {
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    byInstructor[item.teacher_profile_id] = (byInstructor[item.teacher_profile_id] ?? 0) + 1;
    const weekday = new Date(item.created_at).getDay();
    const key = `${item.teacher_profile_id}:${weekday}`;
    heatmap[key] = (heatmap[key] ?? 0) + 1;
  }

  return NextResponse.json({ byCategory, byInstructor, heatmap });
}
