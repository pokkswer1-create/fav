import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("public_notices")
      .select("id, title, content, category, image_url, published_at, expiry_date")
      .eq("is_published", true)
      .or(`expiry_date.is.null,expiry_date.gte.${today}`)
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
