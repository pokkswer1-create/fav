import { requireRole } from "@/lib/auth/guards";
import { fetchInstagramPostStats } from "@/lib/instagram/graph";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const supabaseServer = getSupabaseServer();
  const { postId } = await context.params;

  const { data: post, error } = await supabaseServer
    .from("instagram_posts")
    .select("id, instagram_post_id")
    .eq("id", postId)
    .single();
  if (error || !post) return NextResponse.json({ error: error?.message ?? "게시물 없음" }, { status: 404 });

  const sourceId = post.instagram_post_id ?? postId;
  const stats = await fetchInstagramPostStats(sourceId);
  const { error: updateError } = await supabaseServer
    .from("instagram_posts")
    .update({
      like_count: Number(stats.like_count ?? 0),
      comment_count: Number(stats.comments_count ?? 0),
      view_count: Number(stats.reach ?? 0),
    })
    .eq("id", postId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json(stats);
}
