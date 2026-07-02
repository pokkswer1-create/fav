import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ driverId: string }> };

export async function PATCH(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { driverId } = await context.params;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("shuttle_drivers")
    .update({
      name: body.name,
      phone: body.phone,
      license_number: body.licenseNumber ?? null,
      license_expiry: body.licenseExpiry ?? null,
      car_info: body.carInfo ?? null,
      insurance: body.insurance ?? null,
      insurance_expiry: body.insuranceExpiry ?? null,
      status: body.status,
    })
    .eq("id", driverId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { driverId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { error } = await supabaseServer.from("shuttle_drivers").delete().eq("id", driverId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
