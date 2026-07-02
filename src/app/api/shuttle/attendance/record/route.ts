import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { registrationId, date, hasBoarded, arrivalTime, notes } = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("shuttle_attendance")
    .upsert(
      {
        registration_id: registrationId,
        date,
        has_boarded: Boolean(hasBoarded),
        arrival_time: arrivalTime ?? null,
        recorded_by_instructor_id: guard.userId,
        recorded_at: new Date().toISOString(),
        notes: notes ?? null,
      },
      { onConflict: "registration_id,date" }
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
