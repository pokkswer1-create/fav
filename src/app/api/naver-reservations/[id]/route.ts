import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("naver_reservations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, reservation: data });
}
