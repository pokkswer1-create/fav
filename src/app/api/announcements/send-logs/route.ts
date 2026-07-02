import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("announcement_send_logs")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
