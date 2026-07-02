import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const { notes } = await request.json();
  const supabaseServer = getSupabaseServer();

  const { data: reservation, error: findError } = await supabaseServer
    .from("kakao_reservations")
    .select("*")
    .eq("id", id)
    .single();
  if (findError) return NextResponse.json({ success: false, message: findError.message }, { status: 500 });

  const { error } = await supabaseServer
    .from("kakao_reservations")
    .update({ status: "confirmed", notes: notes ?? reservation.notes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await mockNotificationProvider.send({
    to: reservation.customer_phone,
    title: "카카오 예약 확정",
    body: `${reservation.customer_name}님 예약이 확정되었습니다.`,
  });
  return NextResponse.json({ success: true, message: "예약이 확정되었습니다." });
}
