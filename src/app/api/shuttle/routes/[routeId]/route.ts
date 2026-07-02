import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ routeId: string }> };

export async function PATCH(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { routeId } = await context.params;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("shuttle_routes")
    .update({
      day_of_week: body.dayOfWeek,
      class_name: body.className,
      start_time: body.startTime,
      end_time: body.endTime,
      description: body.description ?? null,
      is_active: body.isActive ?? true,
    })
    .eq("id", routeId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { routeId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { error } = await supabaseServer
    .from("shuttle_routes")
    .update({ is_active: false })
    .eq("id", routeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
