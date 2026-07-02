import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const supabaseServer = getSupabaseServer();

  let builder = supabaseServer
    .from("instagram_posts")
    .select("id, account_name, caption, image_url, like_count, comment_count, posted_at, account_id")
    .eq("account_type", "reference")
    .order("posted_at", { ascending: false })
    .limit(60);
  if (category) {
    const { data: refs } = await supabaseServer
      .from("reference_accounts")
      .select("account_id")
      .eq("category", category);
    const ids = (refs ?? []).map((r) => r.account_id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json([]);
    builder = builder.in("account_id", ids);
  }

  const { data, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
