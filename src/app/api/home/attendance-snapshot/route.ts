import { requireRole } from "@/lib/auth/guards";
import { getTodayAttendanceSnapshot } from "@/lib/home/attendance-snapshot";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  try {
    const supabase = getSupabaseServer();
    const snapshot = await getTodayAttendanceSnapshot(supabase);
    return NextResponse.json({ data: snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "snapshot failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
