import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ routeId: string }> };

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { routeId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("shuttle_registrations")
    .select("*")
    .eq("shuttle_route_id", routeId)
    .eq("status", "active")
    .order("student_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
