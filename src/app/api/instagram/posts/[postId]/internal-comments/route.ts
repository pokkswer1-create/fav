import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { postId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("post_internal_comments")
    .select("id, user_id, user_name, comment, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { postId } = await context.params;
  const body = await request.json();
  if (!body.comment || typeof body.comment !== "string") {
    return NextResponse.json({ error: "comment는 필수입니다." }, { status: 400 });
  }
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("post_internal_comments")
    .insert({
      post_id: postId,
      user_id: guard.userId,
      user_name: guard.role === "admin" ? "원장" : "강사",
      comment: body.comment,
    })
    .select("id, user_id, user_name, comment, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
