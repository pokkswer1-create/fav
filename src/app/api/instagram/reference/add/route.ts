import { requireRole } from "@/lib/auth/guards";
import {
  getInstagramAccountId,
  syncReferenceAccountPostsMock,
} from "@/lib/instagram/graph";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { username, category } = await request.json();
  if (!username || !category) {
    return NextResponse.json({ error: "username, category가 필요합니다." }, { status: 400 });
  }

  const normalized = String(username).replace("@", "").toLowerCase();
  const accountId = await getInstagramAccountId(normalized);
  const supabaseServer = getSupabaseServer();

  const { error } = await supabaseServer.from("reference_accounts").upsert(
    {
      instagram_username: normalized,
      account_id: accountId,
      category: String(category),
    },
    { onConflict: "instagram_username" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = await syncReferenceAccountPostsMock(normalized);
  if (posts.length > 0) {
    await supabaseServer.from("instagram_posts").upsert(
      posts.map((post) => ({
        instagram_post_id: post.instagramPostId,
        account_type: "reference",
        account_id: accountId,
        account_name: normalized,
        caption: post.caption,
        image_url: post.imageUrl,
        media_type: post.mediaType,
        like_count: post.likeCount,
        comment_count: post.commentCount,
        posted_at: post.postedAt,
        status: "published",
      })),
      { onConflict: "instagram_post_id" }
    );
  }

  return NextResponse.json({ success: true, message: "계정이 추가되었습니다." });
}
