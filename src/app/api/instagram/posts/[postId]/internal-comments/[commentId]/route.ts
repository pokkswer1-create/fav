import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ postId: string; commentId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { postId, commentId } = await context.params;
  const supabaseServer = getSupabaseServer();

  let builder = supabaseServer
    .from("post_internal_comments")
    .delete()
    .eq("id", commentId)
    .eq("post_id", postId);
  if (guard.role !== "admin") {
    builder = builder.eq("user_id", guard.userId);
  }
  const { error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
