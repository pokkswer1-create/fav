import { mockNotificationProvider } from "@/lib/providers/notification/mock";
import { getSupabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const supabaseServer = getSupabaseServer();
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  const { data: unpaidPayments, error } = await supabaseServer
    .from("payments")
    .select("id, student_id, amount_due, amount_paid, students(name, parent_phone)")
    .eq("month_key", monthKey)
    .eq("status", "unpaid");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sentCount = 0;
  for (const payment of unpaidPayments ?? []) {
    const name = (payment.students as { name?: string } | null)?.name ?? "학부모";
    const parentPhone =
      (payment.students as { parent_phone?: string } | null)?.parent_phone ?? "";

    await mockNotificationProvider.send({
      to: parentPhone,
      title: "학원 미납 안내",
      body: `${name} 학생의 ${monthKey} 수강료 미납이 확인되었습니다.`,
    });

    await supabaseServer.from("payment_reminders").insert({
      payment_id: payment.id,
      reminder_type: "manual",
      message: "Daily batch mock reminder",
    });

    sentCount += 1;
  }

  return NextResponse.json({
    ok: true,
    monthKey,
    sentCount,
  });
}
