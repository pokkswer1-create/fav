import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ accountId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { accountId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { error } = await supabaseServer
    .from("reference_accounts")
    .delete()
    .eq("id", accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
