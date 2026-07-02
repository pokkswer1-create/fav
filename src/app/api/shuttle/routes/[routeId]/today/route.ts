import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ routeId: string }> };

export async function GET(request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { routeId } = await context.params;
  const date = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const supabaseServer = getSupabaseServer();

  const { data: regs, error: regError } = await supabaseServer
    .from("shuttle_registrations")
    .select("*")
    .eq("shuttle_route_id", routeId)
    .eq("status", "active")
    .order("student_name", { ascending: true });
  if (regError) return NextResponse.json({ error: regError.message }, { status: 500 });

  const regIds = (regs ?? []).map((r) => r.id);
  let attendance: {
    id: string;
    registration_id: string;
    has_boarded: boolean;
    arrival_time: string | null;
  }[] = [];
  if (regIds.length > 0) {
    const { data } = await supabaseServer
      .from("shuttle_attendance")
      .select("id, registration_id, has_boarded, arrival_time")
      .eq("date", date)
      .in("registration_id", regIds);
    attendance = data ?? [];
  }

  const map = new Map(attendance.map((a) => [a.registration_id, a]));
  const students = (regs ?? []).map((reg) => {
    const today = map.get(reg.id);
    const status = today ? (today.has_boarded ? "boarded" : "not_boarded") : "not_recorded";
    return {
      registrationId: reg.id,
      memberId: reg.member_id,
      studentName: reg.student_name,
      pickupLocation: reg.pickup_location,
      dropoffLocation: reg.dropoff_location,
      parentPhone1: reg.parent_phone1,
      parentPhone2: reg.parent_phone2,
      parentName: reg.parent_name,
      specialNotes: reg.special_notes,
      hasBoarded: today?.has_boarded ?? null,
      arrivalTime: today?.arrival_time ?? null,
      status,
    };
  });

  const stats = {
    total: students.length,
    boarded: students.filter((s) => s.status === "boarded").length,
    notBoarded: students.filter((s) => s.status === "not_boarded").length,
    notRecorded: students.filter((s) => s.status === "not_recorded").length,
  };
  return NextResponse.json({ students, stats });
}
