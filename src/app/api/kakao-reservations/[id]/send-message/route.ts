import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const { message } = await request.json();
  const supabaseServer = getSupabaseServer();
  const { data: reservation, error } = await supabaseServer
    .from("kakao_reservations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await mockNotificationProvider.send({
    to: reservation.customer_phone,
    title: "카카오채널 안내",
    body: message ?? "안내 메시지입니다.",
  });

  await supabaseServer
    .from("kakao_reservations")
    .update({ kakao_message_id: `mock-kakao-msg-${Date.now()}`, updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ success: true, message: "채널 메시지를 발송했습니다." });
}
