import { requireRole } from "@/lib/auth/guards";
import { publishToInstagram, publishToInstagramForAccount } from "@/lib/instagram/graph";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function parseHashtags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
  } catch {
    return raw
      .split(" ")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("#"));
  }
  return [];
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin", "teacher"]);
  if (!guard.ok) return guard.response;

  const supabaseServer = getSupabaseServer();
  const form = await request.formData();
  const caption = String(form.get("caption") ?? "");
  const hashtags = parseHashtags(form.get("hashtags")?.toString() ?? null);
  const location = String(form.get("location") ?? "");
  const publishType = String(form.get("publishType") ?? "now");
  const scheduledTime = form.get("scheduledTime")?.toString() ?? null;
  const mediaFile = form.get("media");
  const mediaUrlInput = form.get("mediaUrl")?.toString() ?? "";

  let imageUrl = mediaUrlInput;
  if (!imageUrl && mediaFile instanceof File) {
    imageUrl = `https://example.com/mock-upload/${Date.now()}-${encodeURIComponent(mediaFile.name)}`;
  }
  if (!imageUrl) {
    return NextResponse.json({ error: "미디어 URL 또는 파일이 필요합니다." }, { status: 400 });
  }

  // 현재 사용자(프로필)에 연결된 인스타 비즈니스 계정 조회
  const { data: link } = await supabaseServer
    .from("instagram_links")
    .select("instagram_business_id, access_token")
    .eq("owner_profile_id", guard.userId)
    .maybeSingle();

  const { data: inserted, error: insertError } = await supabaseServer
    .from("instagram_posts")
    .insert({
      caption,
      image_url: imageUrl,
      hashtags,
      location: location || null,
      status: "draft",
      account_type: "own",
      account_name: "우리 학원",
      media_type: "IMAGE",
      posted_at: new Date().toISOString(),
      is_scheduled: publishType === "scheduled",
      scheduled_time: publishType === "scheduled" ? scheduledTime : null,
    })
    .select("*")
    .single();
  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "게시물 저장 실패" }, { status: 500 });
  }

  if (publishType === "now") {
    const instagram = link
      ? await publishToInstagramForAccount(
          link.instagram_business_id,
          link.access_token,
          imageUrl,
          caption,
          hashtags,
        )
      : await publishToInstagram(imageUrl, caption, hashtags);
    const { error: updateError } = await supabaseServer
      .from("instagram_posts")
      .update({
        status: "published",
        instagram_post_id: instagram.id,
        posted_at: new Date().toISOString(),
        is_scheduled: false,
      })
      .eq("id", inserted.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ success: true, postId: inserted.id, message: "게시물이 발행되었습니다." });
  }

  const { error: scheduleError } = await supabaseServer
    .from("instagram_posts")
    .update({
      status: "scheduled",
      is_scheduled: true,
      scheduled_time: scheduledTime,
    })
    .eq("id", inserted.id);
  if (scheduleError) return NextResponse.json({ error: scheduleError.message }, { status: 500 });
  return NextResponse.json({
    success: true,
    postId: inserted.id,
    message: `${scheduledTime ?? "지정된 시간"}에 발행 예약되었습니다.`,
  });
}
