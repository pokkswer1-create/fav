import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const supabaseServer = getSupabaseServer();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  const { data: students, error: studentsError } = await supabaseServer
    .from("students")
    .select("id")
    .eq("status", "active");

  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 });
  }

  const payload =
    students?.map((student) => ({
      student_id: student.id,
      month_key: monthKey,
      total_count: 3,
      used_count: 0,
      carry_over_count: 0,
    })) ?? [];

  const { error } = await supabaseServer
    .from("makeup_tickets")
    .upsert(payload, { onConflict: "student_id,month_key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    createdCount: payload.length,
  });
}
