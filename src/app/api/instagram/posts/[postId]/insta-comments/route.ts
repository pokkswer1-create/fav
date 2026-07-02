import { requireRole } from "@/lib/auth/guards";
import { fetchInstagramComments } from "@/lib/instagram/graph";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, context: Context) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const { postId } = await context.params;
  const supabaseServer = getSupabaseServer();

  const { data: post } = await supabaseServer
    .from("instagram_posts")
    .select("instagram_post_id")
    .eq("id", postId)
    .maybeSingle();
  const instagramPostId = post?.instagram_post_id;

  if (instagramPostId) {
    const remoteComments = await fetchInstagramComments(instagramPostId);
    if (remoteComments.length > 0) {
      await supabaseServer.from("instagram_comments").upsert(
        remoteComments.map((comment) => ({
          post_id: postId,
          instagram_comment_id: comment.id,
          author: comment.username ?? "unknown",
          content: comment.text ?? "",
          like_count: Number(comment.like_count ?? 0),
          posted_at: comment.timestamp ?? null,
        })),
        { onConflict: "instagram_comment_id" }
      );
    }
  }

  const { data, error } = await supabaseServer
    .from("instagram_comments")
    .select("*")
    .eq("post_id", postId)
    .order("posted_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
