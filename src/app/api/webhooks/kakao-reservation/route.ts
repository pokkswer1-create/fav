import { mockEmailProvider } from "@/lib/providers/email/mock";
import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhookSecret = process.env.KAKAO_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const reservationId: string = body.reservationId;
  if (!reservationId) {
    return NextResponse.json({ success: false, message: "reservationId is required" }, { status: 400 });
  }

  const supabaseServer = getSupabaseServer();
  const { data: existing } = await supabaseServer
    .from("kakao_reservations")
    .select("id")
    .eq("kakao_reservation_id", reservationId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ success: false, message: "이미 저장된 예약입니다." });
  }

  const payload = {
    kakao_reservation_id: reservationId,
    kakao_channel_id: body.channelId ?? null,
    kakao_user_id: body.kakaoUserId ?? "unknown-user",
    customer_name: body.customerName,
    customer_phone: body.customerPhone,
    customer_email: body.customerEmail ?? null,
    reservation_date: body.reservationDate,
    reservation_time: body.reservationTime,
    class_type: body.className ?? null,
    number_of_people: Number(body.numberOfPeople ?? 1),
    status: "pending",
    notes: body.memo ?? null,
    kakao_message_id: body.messageId ?? null,
  };

  const { data, error } = await supabaseServer
    .from("kakao_reservations")
    .insert(payload)
    .select("*")
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await mockNotificationProvider.send({
    to: "academy-admin",
    title: "카카오채널 새 예약",
    body: `${payload.customer_name} (${payload.customer_phone}) ${payload.reservation_date} ${payload.reservation_time}`,
  });

  if (payload.customer_email) {
    await mockEmailProvider.send({
      to: payload.customer_email,
      subject: "카카오 예약 신청 완료",
      html: `<p>${payload.customer_name}님 예약 신청이 접수되었습니다.</p>`,
    });
  }

  return NextResponse.json({ success: true, reservationId: data.id, message: "예약이 저장되었습니다." });
}
