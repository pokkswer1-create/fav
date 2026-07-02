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
    .from("instagram_posts")
    .select("*")
    .eq("id", postId)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { postId } = await context.params;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("instagram_posts")
    .update({
      caption: body.caption,
      location: body.location,
      hashtags: body.hashtags,
      scheduled_time: body.scheduledTime ?? null,
      status: body.status,
    })
    .eq("id", postId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { postId } = await context.params;
  const supabaseServer = getSupabaseServer();
  const { error } = await supabaseServer.from("instagram_posts").delete().eq("id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
