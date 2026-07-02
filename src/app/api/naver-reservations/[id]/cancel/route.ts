import { mockEmailProvider } from "@/lib/providers/email/mock";
import { requireRole } from "@/lib/auth/guards";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const guard = await requireRole(["admin"]);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const { reason } = await request.json();
  const supabaseServer = getSupabaseServer();

  const { data: reservation, error: findError } = await supabaseServer
    .from("naver_reservations")
    .select("*")
    .eq("id", id)
    .single();
  if (findError) return NextResponse.json({ success: false, message: findError.message }, { status: 500 });

  const { error } = await supabaseServer
    .from("naver_reservations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      notes: `취소 사유: ${reason}`,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  if (reservation.customer_email) {
    await mockEmailProvider.send({
      to: reservation.customer_email,
      subject: "예약 취소 안내",
      html: `<p>${reservation.customer_name}님 예약이 취소되었습니다. 사유: ${reason}</p>`,
    });
  }

  return NextResponse.json({ success: true, message: "예약이 취소되었습니다." });
}
