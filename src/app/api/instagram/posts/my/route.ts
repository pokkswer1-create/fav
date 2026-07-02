import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;
  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("instagram_posts")
    .select("id, caption, image_url, like_count, comment_count, posted_at, status")
    .eq("account_type", "own")
    .order("posted_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
