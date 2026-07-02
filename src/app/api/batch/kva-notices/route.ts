import { scrapeKVANotice } from "@/lib/external/kva";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const supabaseServer = getSupabaseServer();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notices = await scrapeKVANotice();
  if (notices.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const payload = notices.map((notice) => ({
    source: "KVA",
    title: notice.title,
    link: notice.link,
    original_date: notice.originalDate,
    author: notice.author,
    scraped_at: new Date().toISOString(),
    is_active: true,
  }));

  const { error } = await supabaseServer
    .from("external_notices")
    .upsert(payload, { onConflict: "source,link" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: notices.length });
}
