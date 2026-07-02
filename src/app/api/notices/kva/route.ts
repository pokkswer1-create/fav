import { requireRole } from "@/lib/auth/guards";
import { scrapeKVANotice } from "@/lib/external/kva";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const { data, error } = await supabaseServer
    .from("external_notices")
    .select("id, title, link, original_date, author, scraped_at")
    .eq("source", "KVA")
    .eq("is_active", true)
    .ilike("link", "%/user/usr11Board/%")
    .ilike("link", "%p_idNm=notice%")
    .order("original_date", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .limit(5);

  if (error) {
    // 스키마 미적용 초기 상태에서는 에러 대신 빈 목록을 반환해 UI를 깨지 않게 한다.
    if (error.message.includes("external_notices")) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST() {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
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
  if (error) {
    if (error.message.includes("external_notices")) {
      return NextResponse.json({ ok: true, count: 0, skipped: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: notices.length });
}
