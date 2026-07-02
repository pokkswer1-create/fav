import { mockEmailProvider } from "@/lib/providers/email/mock";
import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhookSecret = process.env.NAVER_WEBHOOK_SECRET;
  const authHeader = request.headers.get("authorization");
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const supabaseServer = getSupabaseServer();

  const reservationId: string = body.reservationId;
  if (!reservationId) {
    return NextResponse.json(
      { success: false, message: "reservationId is required" },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabaseServer
    .from("naver_reservations")
    .select("id")
    .eq("naver_reservation_id", reservationId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ success: false, message: existingError.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ success: false, message: "이미 저장된 예약입니다." });
  }

  const payload = {
    naver_reservation_id: reservationId,
    naver_place_id: body.placeId ?? null,
    customer_name: body.customerName,
    customer_phone: body.customerPhone,
    customer_email: body.customerEmail ?? null,
    reservation_date: body.reservationDate,
    reservation_time: body.reservationTime,
    class_type: body.className ?? null,
    number_of_people: Number(body.numberOfPeople ?? 1),
    notes: body.memo ?? null,
    status: "pending",
  };

  const { data, error } = await supabaseServer
    .from("naver_reservations")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  await mockNotificationProvider.send({
    to: "academy-admin",
    title: "네이버 플레이스 새 예약",
    body: `${payload.customer_name} (${payload.customer_phone}) - ${payload.reservation_date} ${payload.reservation_time} ${payload.class_type ?? ""}`,
  });

  if (payload.customer_email) {
    await mockEmailProvider.send({
      to: payload.customer_email,
      subject: "예약 신청 완료",
      html: `<p>${payload.customer_name}님 예약 신청 완료</p>`,
    });
  }

  return NextResponse.json({
    success: true,
    reservationId: data.id,
    message: "예약이 저장되었습니다.",
  });
}
