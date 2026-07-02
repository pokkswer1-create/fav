import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ regId: string }> };

export async function PATCH(request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { regId } = await context.params;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("shuttle_registrations")
    .update({
      student_name: body.studentName,
      pickup_location: body.pickupLocation,
      dropoff_location: body.dropoffLocation ?? null,
      parent_phone1: body.parentPhone1,
      parent_phone2: body.parentPhone2 ?? null,
      parent_name: body.parentName ?? null,
      special_notes: body.specialNotes ?? null,
      status: body.status ?? "active",
    })
    .eq("id", regId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { regId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { error } = await supabaseServer
    .from("shuttle_registrations")
    .update({ status: "inactive" })
    .eq("id", regId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
