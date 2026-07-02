import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("shuttle_drivers")
    .insert({
      name: body.name,
      phone: body.phone,
      license_number: body.licenseNumber ?? null,
      license_expiry: body.licenseExpiry ?? null,
      car_info: body.carInfo ?? null,
      insurance: body.insurance ?? null,
      insurance_expiry: body.insuranceExpiry ?? null,
      status: body.status ?? "active",
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
