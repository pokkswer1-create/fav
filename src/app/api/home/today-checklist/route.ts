import { buildTodayChecklist } from "@/lib/home/today-checklist";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseServer();
    const data = await buildTodayChecklist(supabase);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checklist failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
