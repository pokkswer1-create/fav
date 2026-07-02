import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const body = await request.json();
  const nextStatus = body.class_status;
  if (nextStatus !== "active" && nextStatus !== "ended") {
    return NextResponse.json({ error: "class_status는 active 또는 ended여야 합니다." }, { status: 400 });
  }

  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("classes")
    .update({ class_status: nextStatus })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
