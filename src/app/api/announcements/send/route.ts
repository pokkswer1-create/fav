import { requireRole } from "@/lib/auth/guards";
import { mockEmailProvider } from "@/lib/providers/email/mock";
import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type InfobankAuthResponse = {
  data?: {
    token?: string;
  };
};

async function getInfobankToken(baseUrl: string, clientId: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/auth/token`, {
    method: "POST",
    headers: {
      "X-IB-Client-Id": clientId,
      "X-IB-Client-Passwd": password,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Infobank auth 실패: ${res.status} ${text}`);
  }

  const json = (await res.json()) as InfobankAuthResponse;
  const token = json?.data?.token;
  if (!token) {
    throw new Error("Infobank auth 토큰이 비어 있습니다.");
  }
  return token;
}

async function sendInfobankFriendtalk(
  baseUrl: string,
  token: string,
  senderKey: string,
  to: string,
  text: string,
) {
  const res = await fetch(`${baseUrl}/v1/send/friendtalk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      senderKey,
      msgType: "FT",
      to: to.replace(/[^0-9]/g, ""),
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Infobank friendtalk 실패: ${res.status} ${body}`);
  }
}

export async function POST(request: Request) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;
  const { announcementId, memberIds, channel } = await request.json();
  if (!announcementId || !Array.isArray(memberIds)) {
    return NextResponse.json({ error: "announcementId/memberIds가 필요합니다." }, { status: 400 });
  }

  const supabaseServer = getSupabaseServer();
  const [{ data: announcement }, { data: link }] = await Promise.all([
    supabaseServer.from("class_announcements").select("id, title").eq("id", announcementId).single(),
    supabaseServer
      .from("class_application_links")
      .select("short_url, external_form_url")
      .eq("announcement_id", announcementId)
      .maybeSingle(),
  ]);
  if (!announcement) return NextResponse.json({ error: "안내를 찾을 수 없습니다." }, { status: 404 });

  const { data: members, error: memberError } = await supabaseServer
    .from("students")
    .select("id, name, father_phone, mother_phone, parent_phone, phone, email")
    .in("id", memberIds);
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  let sentCount = 0;
  let failCount = 0;
  const url = link?.short_url ?? link?.external_form_url ?? "";
  const infobankBaseUrl = process.env.INFOBANK_BASE_URL?.trim() || "https://omni.ibapi.kr";
  const infobankClientId = process.env.INFOBANK_CLIENT_ID?.trim();
  const infobankPassword = process.env.INFOBANK_PASSWORD?.trim();
  const infobankSenderKey = process.env.INFOBANK_SENDER_KEY?.trim();
  let infobankToken: string | null = null;

  for (const member of members ?? []) {
    try {
      const targetPhone: string | null =
        member.father_phone || member.parent_phone || member.mother_phone || member.phone || null;

      if (channel === "email" && member.email) {
        await mockEmailProvider.send({
          to: member.email,
          subject: `[안내] ${announcement.title}`,
          html: `<p>${member.name}님 안내입니다.</p><p><a href="${url}">${url}</a></p>`,
        });
      } else if (channel === "kakao" && targetPhone) {
        if (!infobankClientId || !infobankPassword || !infobankSenderKey) {
          throw new Error(
            "INFOBANK_CLIENT_ID / INFOBANK_PASSWORD / INFOBANK_SENDER_KEY 환경변수가 필요합니다.",
          );
        }
        if (!infobankToken) {
          infobankToken = await getInfobankToken(
            infobankBaseUrl,
            infobankClientId,
            infobankPassword,
          );
        }

        const message =
          url && url.length > 0
            ? `[안내] ${announcement.title}\n${member.name}님 안내 링크: ${url}`
            : `[안내] ${announcement.title}\n${member.name}님 안내입니다.`;
        await sendInfobankFriendtalk(
          infobankBaseUrl,
          infobankToken,
          infobankSenderKey,
          targetPhone,
          message,
        );
      } else {
        await mockNotificationProvider.send({
          to: targetPhone ?? "",
          title: announcement.title,
          body: `${member.name}님 안내 링크: ${url}`,
        });
      }
      sentCount += 1;
    } catch {
      failCount += 1;
    }
  }

  await supabaseServer.from("announcement_send_logs").insert({
    announcement_id: announcementId,
    class_id: null,
    member_ids: memberIds,
    channel: channel ?? "kakao",
    sent_count: sentCount,
    fail_count: failCount,
    sent_by_admin_id: guard.userId,
  });

  return NextResponse.json({ success: true, sentCount, failCount });
}
