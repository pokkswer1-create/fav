import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();

  const { data: existing } = await supabaseServer
    .from("shuttle_registrations")
    .select("id")
    .eq("shuttle_route_id", body.shuttleRouteId)
    .eq("member_id", body.memberId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 학생입니다." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("shuttle_registrations")
    .insert({
      shuttle_route_id: body.shuttleRouteId,
      member_id: body.memberId ?? null,
      student_name: body.studentName,
      pickup_location: body.pickupLocation,
      dropoff_location: body.dropoffLocation ?? null,
      parent_phone1: body.parentPhone1,
      parent_phone2: body.parentPhone2 ?? null,
      parent_name: body.parentName ?? null,
      special_notes: body.specialNotes ?? null,
      status: "active",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
