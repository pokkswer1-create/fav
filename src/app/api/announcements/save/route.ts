import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function makeToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const body = await request.json();
  const supabaseServer = getSupabaseServer();

  const payload = {
    class_id: body.classId ?? null,
    class_name: body.className,
    title: body.title,
    content: body.content,
    navercafe_url: body.navercafeUrl ?? null,
    open_chat_urls: body.openChatUrls ?? [],
    kakao_group_urls: body.kakaoGroupUrls ?? [],
    location: body.location ?? null,
    address: body.address ?? null,
    map_link: body.mapLink ?? null,
    preparation_items: body.preparationItems ?? [],
    shuttle_info: body.shuttleInfo ?? {},
    tuition_info: body.tuitionInfo ?? {},
    refund_policy: body.refundPolicy ?? null,
    agreement_items: body.agreementItems ?? {},
    agreement_description: body.agreementDescription ?? null,
    payment_guide: body.paymentGuide ?? null,
    makeup_policy: body.makeupPolicy ?? null,
    is_active: body.isActive ?? true,
    created_by_admin_id: guard.userId,
  };

  let announcementId = body.id as string | undefined;
  if (announcementId) {
    const { error } = await supabaseServer
      .from("class_announcements")
      .update(payload)
      .eq("id", announcementId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data, error } = await supabaseServer
      .from("class_announcements")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "생성 실패" }, { status: 500 });
    }
    announcementId = data.id;
  }

  if (body.externalFormUrl) {
    const token = body.linkToken ?? makeToken();
    const shortUrl = `${new URL(request.url).origin}/announcements/${token}`;
    await supabaseServer.from("class_application_links").upsert(
      {
        announcement_id: announcementId,
        class_id: body.classId ?? null,
        link_token: token,
        short_url: shortUrl,
        external_form_url: body.externalFormUrl,
        is_active: true,
        expiry_date: body.expiryDate ?? null,
      },
      { onConflict: "announcement_id" }
    );
  }

  return NextResponse.json({ id: announcementId });
}
