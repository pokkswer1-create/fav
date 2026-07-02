import { defaultAcademySettings } from "@/lib/parent-site/defaults";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SETTING_KEYS = [
  "site_branding",
  "tuition",
  "preparation_items",
  "shuttle_info",
  "payment_guide",
  "makeup_policy",
  "refund_policy",
] as const;

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data: rows, error: settingsError } = await supabase
      .from("academy_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [...SETTING_KEYS]);

    if (settingsError) {
      return NextResponse.json(
        { error: settingsError.message, settings: defaultAcademySettings, notices: [] },
        { status: 200 }
      );
    }

    const settings: Record<string, unknown> = { ...defaultAcademySettings };
    for (const row of rows ?? []) {
      const k = row.setting_key as string;
      if (row.setting_value != null) {
        settings[k] = row.setting_value;
      }
    }

    const { data: notices, error: noticesError } = await supabase
      .from("public_notices")
      .select("id, title, content, category, image_url, published_at, expiry_date")
      .eq("is_published", true)
      .or("expiry_date.is.null,expiry_date.gte." + new Date().toISOString().slice(0, 10))
      .order("published_at", { ascending: false })
      .limit(24);

    if (noticesError) {
      return NextResponse.json({
        settings,
        notices: [],
        noticeError: noticesError.message,
      });
    }

    return NextResponse.json(
      {
        settings,
        notices: notices ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
