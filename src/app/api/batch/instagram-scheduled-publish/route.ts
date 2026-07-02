import { publishToInstagram } from "@/lib/instagram/graph";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseServer = getSupabaseServer();
  const now = new Date().toISOString();
  const { data: scheduledPosts, error } = await supabaseServer
    .from("instagram_posts")
    .select("id, caption, image_url, hashtags")
    .eq("status", "scheduled")
    .lte("scheduled_time", now);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let publishedCount = 0;
  for (const post of scheduledPosts ?? []) {
    try {
      const res = await publishToInstagram(post.image_url ?? "", post.caption ?? "", post.hashtags ?? []);
      await supabaseServer
        .from("instagram_posts")
        .update({
          status: "published",
          instagram_post_id: res.id,
          posted_at: new Date().toISOString(),
          is_scheduled: false,
        })
        .eq("id", post.id);
      publishedCount += 1;
    } catch {
      // keep scheduled state for retry
    }
  }
  return NextResponse.json({ ok: true, publishedCount });
}
