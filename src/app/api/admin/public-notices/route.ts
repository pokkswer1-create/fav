import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("public_notices")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  if (!title || !content) {
    return NextResponse.json({ error: "제목과 내용이 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("public_notices")
    .insert({
      title,
      content,
      category: body.category ? String(body.category) : "announcement",
      image_url: body.imageUrl ? String(body.imageUrl) : null,
      is_published: body.isPublished !== false,
      published_at: body.publishedAt || new Date().toISOString(),
      expiry_date: body.expiryDate || null,
      created_by_admin_id: guard.userId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
